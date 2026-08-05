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

export async function rotateDeviceSession(
  refreshToken: string,
): Promise<IssuedNativeSession> {
  const oldHash = hashRefreshToken(refreshToken);
  const { data, error } = await supabase
    .from("device_sessions")
    .select(
      "id, owner_id, platform, device_name, refresh_token_hash, expires_at, revoked_at",
    )
    .eq("refresh_token_hash", oldHash)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const session = data as DeviceSessionRow | null;
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
  const { data: rotated, error: rotateError } = await supabase
    .from("device_sessions")
    .update({
      refresh_token_hash: next.hash,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("refresh_token_hash", oldHash)
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
