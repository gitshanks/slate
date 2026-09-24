import "server-only";

import { randomInt } from "node:crypto";
import {
  accountEmailHash,
  emailCodeHash,
  emailOwnerId,
  emailRateKey,
  normalizeEmail,
} from "@/lib/email-auth-core";
import { ensureEmailAuthSchema } from "@/lib/email-auth-schema";
import { runNeonQuery } from "@/lib/neon-client";
import { ensureEmailProfile } from "@/lib/profiles";

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

export class EmailAuthError extends Error {
  constructor(
    readonly code: "invalid_email" | "rate_limited" | "invalid_code" | "configuration" | "delivery",
    message: string,
  ) {
    super(message);
    this.name = "EmailAuthError";
  }
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new EmailAuthError("configuration", "Email sign-in is not configured yet.");
  return secret;
}

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new EmailAuthError("configuration", "Email sign-in is not configured yet.");
  }
  return { apiKey, from };
}

export function emailSignInConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.AUTH_SECRET &&
      (process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY) &&
      (process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM),
  );
}

async function enforceRateLimit(scopeHash: string, maximum: number) {
  const [row] = await runNeonQuery<{ request_count: number }>(`
    insert into email_auth_rate_limits (scope_hash, request_count, window_started_at)
    values ($1, 1, now())
    on conflict (scope_hash) do update set
      request_count = case
        when email_auth_rate_limits.window_started_at < now() - interval '1 hour' then 1
        else email_auth_rate_limits.request_count + 1
      end,
      window_started_at = case
        when email_auth_rate_limits.window_started_at < now() - interval '1 hour' then now()
        else email_auth_rate_limits.window_started_at
      end
    returning request_count
  `, [scopeHash]);
  if (!row || Number(row.request_count) > maximum) {
    throw new EmailAuthError("rate_limited", "Too many codes were requested. Try again later.");
  }
}

async function sendCode(email: string, code: string, idempotencyKey: string) {
  const { apiKey, from } = resendConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your slate sign-in code`,
      text: `Your slate sign-in code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
      html: `<div style="background:#09090b;color:#f4f4f5;font-family:Inter,Arial,sans-serif;padding:36px;border-radius:20px"><p style="color:#adebb3;font-size:12px;letter-spacing:.16em;text-transform:uppercase">slate</p><h1 style="font-size:24px;margin:28px 0 8px">Your sign-in code</h1><p style="font-size:38px;font-weight:700;letter-spacing:.22em;margin:20px 0">${code}</p><p style="color:#a1a1aa;font-size:14px;line-height:1.6">It expires in ${CODE_TTL_MINUTES} minutes. If you didn’t request this, you can ignore this email.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new EmailAuthError("delivery", "We couldn’t send a code. Try again shortly.");
}

export async function requestEmailCode(rawEmail: unknown, networkIdentifier: string) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new EmailAuthError("invalid_email", "Enter a valid email address.");
  if (!(await ensureEmailAuthSchema())) {
    throw new EmailAuthError("configuration", "Email sign-in is not configured yet.");
  }
  const secret = authSecret();
  resendConfig();
  const emailHash = accountEmailHash(email);
  await Promise.all([
    enforceRateLimit(emailRateKey("email", email, secret), 5),
    enforceRateLimit(emailRateKey("network", networkIdentifier || "unknown", secret), 20),
  ]);

  const [recent] = await runNeonQuery<{ requested_at: string }>(`
    select requested_at from email_login_codes where email_hash = $1
  `, [emailHash]);
  if (
    recent &&
    Date.now() - new Date(recent.requested_at).getTime() < RESEND_COOLDOWN_SECONDS * 1_000
  ) {
    return email;
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = emailCodeHash(email, code, secret);
  await runNeonQuery(`
    insert into email_login_codes (email_hash, code_hash, attempts, requested_at, expires_at)
    values ($1, $2, 0, now(), now() + interval '${CODE_TTL_MINUTES} minutes')
    on conflict (email_hash) do update set
      code_hash = excluded.code_hash,
      attempts = 0,
      requested_at = excluded.requested_at,
      expires_at = excluded.expires_at
  `, [emailHash, codeHash]);

  try {
    await sendCode(email, code, `slate-login/${emailHash}/${codeHash.slice(0, 16)}`);
  } catch (error) {
    await runNeonQuery(
      "delete from email_login_codes where email_hash = $1 and code_hash = $2",
      [emailHash, codeHash],
    );
    throw error;
  }
  return email;
}

export async function accountOwnerForEmail(rawEmail: unknown): Promise<string | null> {
  const email = normalizeEmail(rawEmail);
  if (!email || !(await ensureEmailAuthSchema())) return null;
  const emailHash = accountEmailHash(email);
  const [mapping] = await runNeonQuery<{ owner_id: string }>(
    "select owner_id from account_emails where email_hash = $1",
    [emailHash],
  );
  if (mapping?.owner_id) return mapping.owner_id;

  // Native Google/Apple identities already retain verified email addresses.
  try {
    const [identity] = await runNeonQuery<{ owner_id: string }>(`
      select owner_id from auth_identities
      where lower(email) = $1 and email_verified = true
      order by created_at asc
      limit 1
    `, [email]);
    return identity?.owner_id ?? null;
  } catch {
    // Native-auth tables are optional for web-only deployments.
    return null;
  }
}

export async function linkAccountEmail(rawEmail: unknown, ownerId: string) {
  const email = normalizeEmail(rawEmail);
  if (!email || !ownerId || !(await ensureEmailAuthSchema())) return null;
  const emailHash = accountEmailHash(email);
  await runNeonQuery(`
    insert into account_emails (email_hash, owner_id)
    values ($1, $2)
    on conflict (email_hash) do nothing
  `, [emailHash, ownerId]);
  const [mapping] = await runNeonQuery<{ owner_id: string }>(
    "select owner_id from account_emails where email_hash = $1",
    [emailHash],
  );
  return mapping?.owner_id ?? null;
}

export async function consumeEmailCode(rawEmail: unknown, rawCode: unknown) {
  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!email || !/^\d{6}$/.test(code) || !(await ensureEmailAuthSchema())) return null;
  const emailHash = accountEmailHash(email);
  const secret = authSecret();
  const attempted = await runNeonQuery<{ attempts: number }>(`
    update email_login_codes
    set attempts = attempts + 1
    where email_hash = $1
      and expires_at > now()
      and attempts < ${MAX_CODE_ATTEMPTS}
    returning attempts
  `, [emailHash]);
  if (!attempted.length) return null;

  const consumed = await runNeonQuery<{ email_hash: string }>(`
    delete from email_login_codes
    where email_hash = $1 and code_hash = $2 and expires_at > now()
    returning email_hash
  `, [emailHash, emailCodeHash(email, code, secret)]);
  if (!consumed.length) return null;

  const existingOwner = await accountOwnerForEmail(email);
  const ownerId = existingOwner ?? emailOwnerId(email);
  await ensureEmailProfile({ id: ownerId, email });
  return (await linkAccountEmail(email, ownerId)) ?? ownerId;
}
