import { createHash, createHmac } from "node:crypto";

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().normalize("NFKC").toLowerCase();
  if (!email || email.length > 254 || !SIMPLE_EMAIL.test(email)) return null;
  return email;
}

export function accountEmailHash(email: string): string {
  return createHash("sha256").update(`slate-email:${email}`, "utf8").digest("hex");
}

export function emailOwnerId(email: string): string {
  return `email:${accountEmailHash(email).slice(0, 48)}`;
}

export function emailCodeHash(email: string, code: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`slate-email-code:${email}:${code}`, "utf8")
    .digest("hex");
}

export function emailRateKey(scope: "email" | "network", value: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`slate-email-rate:${scope}:${value}`, "utf8")
    .digest("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = local?.slice(0, Math.min(2, local.length)) || "•";
  return `${visible}${"•".repeat(Math.max(3, Math.min(8, (local?.length ?? 1) - visible.length)))}@${domain}`;
}

export function safeRedirectPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
