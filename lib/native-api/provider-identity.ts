import "server-only";

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { NativeApiError } from "@/lib/native-api/http";

export type IdentityProvider = "google" | "apple";

export interface VerifiedProviderIdentity {
  provider: IdentityProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const appleKeys = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

function configuredAudiences(names: string[]): string[] {
  return [...new Set(names.map((name) => process.env[name]?.trim()).filter(Boolean))] as string[];
}

function verifiedEmail(payload: JWTPayload): boolean {
  return payload.email_verified === true || payload.email_verified === "true";
}

function claimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function assertNonce(payload: JWTPayload, rawNonce: string | null, provider: IdentityProvider) {
  if (!rawNonce) return;
  const claim = claimString(payload.nonce);
  const digest = createHash("sha256").update(rawNonce, "utf8").digest("hex");
  const valid = provider === "apple" ? claim === digest : claim === rawNonce || claim === digest;
  if (!valid) {
    throw new NativeApiError(401, "invalid_credentials", "The sign-in nonce is invalid.");
  }
}

export async function verifyGoogleIdentity(
  idToken: string,
  rawNonce: string | null,
): Promise<VerifiedProviderIdentity> {
  const audience = configuredAudiences([
    "AUTH_GOOGLE_ID",
    "GOOGLE_IOS_CLIENT_ID",
    "GOOGLE_ANDROID_CLIENT_ID",
  ]);
  if (!audience.length) {
    throw new NativeApiError(503, "configuration_error", "Google sign-in is not configured.");
  }

  try {
    const { payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
      algorithms: ["RS256"],
    });
    assertNonce(payload, rawNonce, "google");
    if (!payload.sub) throw new Error("Missing subject");
    const email = claimString(payload.email);
    if (!email || !verifiedEmail(payload)) {
      throw new NativeApiError(401, "invalid_credentials", "Google did not verify this email.");
    }
    return {
      provider: "google",
      subject: payload.sub,
      email,
      emailVerified: true,
      name: claimString(payload.name),
      avatarUrl: claimString(payload.picture),
    };
  } catch (error) {
    if (error instanceof NativeApiError) throw error;
    throw new NativeApiError(401, "invalid_credentials", "Google sign-in could not be verified.");
  }
}

export async function verifyAppleIdentity(
  idToken: string,
  rawNonce: string | null,
  suppliedName: string | null,
): Promise<VerifiedProviderIdentity> {
  const audience = configuredAudiences(["APPLE_BUNDLE_ID", "APPLE_SERVICE_ID"]);
  if (!audience.length) {
    throw new NativeApiError(503, "configuration_error", "Apple sign-in is not configured.");
  }

  try {
    const { payload } = await jwtVerify(idToken, appleKeys, {
      issuer: "https://appleid.apple.com",
      audience,
      algorithms: ["RS256"],
    });
    assertNonce(payload, rawNonce, "apple");
    if (!payload.sub) throw new Error("Missing subject");
    return {
      provider: "apple",
      subject: payload.sub,
      email: claimString(payload.email),
      emailVerified: verifiedEmail(payload),
      name: suppliedName,
      avatarUrl: null,
    };
  } catch (error) {
    if (error instanceof NativeApiError) throw error;
    throw new NativeApiError(401, "invalid_credentials", "Apple sign-in could not be verified.");
  }
}
