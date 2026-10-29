import "server-only";

import { createPrivateKey, sign } from "node:crypto";

// Sign in with Apple on the web reuses the Services ID the native apps accept
// as a token audience. Apple has no static client secret: it is an ES256 JWT
// signed with a Sign in with Apple key, valid for at most six months, so it is
// minted per server instance instead of pasted into the environment.
const CLIENT_SECRET_TTL_SECONDS = 150 * 24 * 60 * 60;

function appleWebConfig() {
  const clientId = process.env.APPLE_SERVICE_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  // Hosting dashboards often store the .p8 contents with escaped newlines.
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { clientId, teamId, keyId, privateKey };
}

export function appleSignInConfigured(): boolean {
  return appleWebConfig() !== null;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** Returns the Services ID and a freshly signed client secret, or null. */
export function appleClientCredentials(): { clientId: string; clientSecret: string } | null {
  const config = appleWebConfig();
  if (!config) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: config.teamId,
      iat: now,
      exp: now + CLIENT_SECRET_TTL_SECONDS,
      aud: "https://appleid.apple.com",
      sub: config.clientId,
    }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });

  return {
    clientId: config.clientId,
    clientSecret: `${header}.${payload}.${base64url(signature)}`,
  };
}
