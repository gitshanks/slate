"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { maskEmail, safeRedirectPath } from "@/lib/email-auth-core";
import { EmailAuthError, requestEmailCode } from "@/lib/email-auth";

export type RequestEmailCodeState = {
  step: "email" | "code";
  email?: string;
  maskedEmail?: string;
  error?: string;
};

export type VerifyEmailCodeState = {
  error?: string;
};

export async function requestEmailLoginCode(
  _state: RequestEmailCodeState,
  formData: FormData,
): Promise<RequestEmailCodeState> {
  const requestHeaders = await headers();
  const networkIdentifier =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("user-agent") ||
    "unknown";
  try {
    const email = await requestEmailCode(formData.get("email"), networkIdentifier);
    return { step: "code", email, maskedEmail: maskEmail(email) };
  } catch (error) {
    return {
      step: "email",
      error:
        error instanceof EmailAuthError
          ? error.message
          : "We couldn’t send a code. Try again shortly.",
    };
  }
}

export async function verifyEmailLoginCode(
  _state: VerifyEmailCodeState,
  formData: FormData,
): Promise<VerifyEmailCodeState> {
  const email = formData.get("email");
  const code = formData.get("code");
  const destination = safeRedirectPath(formData.get("redirectTo"));
  if (typeof email !== "string" || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    return { error: "Enter the six-digit code from your email." };
  }

  try {
    const result = await signIn("email-code", {
      email,
      code: code.trim(),
      redirect: false,
      redirectTo: destination,
    });
    const resultUrl = new URL(String(result), "https://www.s1ate.space");
    if (resultUrl.searchParams.has("error")) {
      return { error: "That code is invalid or has expired. Request a new one." };
    }
  } catch {
    return { error: "That code is invalid or has expired. Request a new one." };
  }
  redirect(destination);
}
