import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { NativeApiError } from "@/lib/native-api/http";

export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
export const REFRESH_TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export type NativePlatform = "ios" | "android";

export interface NativeAccessClaims {
  ownerId: string;
  sessionId: string;
  platform: NativePlatform;
}

const AUDIENCE = "slate-native";
const encoder = new TextEncoder();

function issuer(): string {
  return process.env.NATIVE_AUTH_ISSUER?.trim() || "https://s1ate.space";
}

function signingKey(): Uint8Array {
  // A separate key is recommended, but falling back to the existing Auth.js
  // secret makes the native rollout non-breaking for current hosted installs.
  const value = process.env.NATIVE_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!value || encoder.encode(value).byteLength < 32) {
    throw new NativeApiError(
      503,
      "configuration_error",
      "Native authentication is not configured.",
    );
  }
  return encoder.encode(value);
}

export async function issueAccessToken(claims: NativeAccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sessionId, platform: claims.platform })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(claims.ownerId)
    .setIssuer(issuer())
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_SECONDS}s`)
    .sign(signingKey());
}

export async function verifyAccessToken(token: string): Promise<NativeAccessClaims> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: issuer(),
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      (payload.platform !== "ios" && payload.platform !== "android")
    ) {
      throw new Error("Missing native access claims");
    }
    return {
      ownerId: payload.sub,
      sessionId: payload.sid,
      platform: payload.platform,
    };
  } catch {
    throw new NativeApiError(401, "not_authenticated", "Your session has expired.");
  }
}

export function accessTokenFromRequest(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    throw new NativeApiError(401, "not_authenticated", "Sign in to continue.");
  }
  return match[1];
}

export async function authenticateNativeRequest(
  request: Request,
): Promise<NativeAccessClaims> {
  return verifyAccessToken(accessTokenFromRequest(request));
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
