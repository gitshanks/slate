import "server-only";

import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { NativeApiError } from "@/lib/native-api/http";
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  REFRESH_TOKEN_LIFETIME_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  issueAccessToken,
  type NativePlatform,
} from "@/lib/native-api/tokens";

interface DeviceSessionRow {
  id: string;
  owner_id: string;
  platform: NativePlatform;
  device_name: string | null;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  rotated_at: string | null;
}

export interface IssuedNativeSession {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export async function createDeviceSession(input: {
  ownerId: string;
  platform: NativePlatform;
  deviceName: string | null;
}): Promise<IssuedNativeSession> {
  const sessionId = randomUUID();
  const refresh = createRefreshToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1000,
  ).toISOString();

  const { error } = await supabase.from("device_sessions").insert({
    id: sessionId,
    owner_id: input.ownerId,
    refresh_token_hash: refresh.hash,
    platform: input.platform,
    device_name: input.deviceName,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  return {
    accessToken: await issueAccessToken({
      ownerId: input.ownerId,
      sessionId,
      platform: input.platform,
    }),
    accessTokenExpiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: expiresAt,
  };
}

/**
 * How long the token replaced by a rotation keeps working. A client can lose
 * the rotated token (killed after the server rotated, before it saved the
 * reply); retrying with the previous one inside this window gets a fresh token
 * instead of being logged out. Outside it, an old token is refused as before.
 */
export const REFRESH_GRACE_SECONDS = 60;

const SESSION_COLUMNS =
  "id, owner_id, platform, device_name, refresh_token_hash, expires_at, revoked_at, rotated_at";

export async function rotateDeviceSession(
  refreshToken: string,
): Promise<IssuedNativeSession> {
  const presentedHash = hashRefreshToken(refreshToken);
  const { data, error } = await supabase
    .from("device_sessions")
    .select(SESSION_COLUMNS)
    .eq("refresh_token_hash", presentedHash)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let session = data as DeviceSessionRow | null;
  // The current token, or the one just replaced (a retry inside the grace window).
  let viaGrace = false;
  if (!session) {
    const { data: previous, error: previousError } = await supabase
      .from("device_sessions")
      .select(SESSION_COLUMNS)
      .eq("previous_refresh_token_hash", presentedHash)
      .maybeSingle();
    if (previousError) throw new Error(previousError.message);
    const candidate = previous as DeviceSessionRow | null;
    const rotatedAt = candidate?.rotated_at ? new Date(candidate.rotated_at).getTime() : 0;
    if (candidate && Date.now() - rotatedAt <= REFRESH_GRACE_SECONDS * 1000) {
      session = candidate;
      viaGrace = true;
    }
  }

  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    throw new NativeApiError(
      401,
      "invalid_credentials",
      "This device session is no longer valid.",
    );
  }

  const next = createRefreshToken();
  const now = new Date().toISOString();
  // A normal rotation remembers the token it replaces. A grace retry replaces
  // only the lost token and keeps the original window (rotated_at unchanged),
  // so the previous token can't be stretched beyond REFRESH_GRACE_SECONDS.
  const { data: rotated, error: rotateError } = viaGrace
    ? await supabase
        .from("device_sessions")
        .update({ refresh_token_hash: next.hash, last_used_at: now })
        .eq("id", session.id)
        .eq("previous_refresh_token_hash", presentedHash)
        .select("id")
        .single()
    : await supabase
        .from("device_sessions")
        .update({
          refresh_token_hash: next.hash,
          previous_refresh_token_hash: presentedHash,
          rotated_at: now,
          last_used_at: now,
        })
        .eq("id", session.id)
        .eq("refresh_token_hash", presentedHash)
        .select("id")
        .single();
  if (rotateError || !rotated) {
    throw new NativeApiError(
      401,
      "invalid_credentials",
      "This refresh token has already been used.",
    );
  }

  return {
    accessToken: await issueAccessToken({
      ownerId: session.owner_id,
      sessionId: session.id,
      platform: session.platform,
    }),
    accessTokenExpiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
    refreshToken: next.token,
    refreshTokenExpiresAt: session.expires_at,
  };
}

export async function revokeDeviceSession(ownerId: string, sessionId: string) {
  const { error } = await supabase
    .from("device_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}
