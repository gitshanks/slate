import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { isGuestOwnerId } from "@/lib/guest-id";

/**
 * The guest cookie holds a signed token naming the browser's guest account.
 * It is separate from the Auth.js session so that a real sign-in, which
 * replaces the session, can still find the guest to move into the account.
 * SameSite=None in production because Apple returns with a cross-site POST,
 * which drops Lax cookies.
 */
export const GUEST_COOKIE = "slate_guest";
export const GUEST_MAX_AGE = 90 * 24 * 60 * 60;

const AUDIENCE = "slate-guest";
const encoder = new TextEncoder();

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Guest mode needs AUTH_SECRET");
  return encoder.encode(secret);
}

export function guestModeEnabled(): boolean {
  // Guests are moved into accounts with SQL, so they need the Postgres backend.
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);
}

export async function signGuestToken(ownerId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ownerId)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${GUEST_MAX_AGE}s`)
    .sign(key());
}

export async function verifyGuestToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      audience: AUDIENCE,
    });
    return isGuestOwnerId(payload.sub) ? payload.sub! : null;
  } catch {
    return null;
  }
}

export function guestCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    maxAge: GUEST_MAX_AGE,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
  };
}
