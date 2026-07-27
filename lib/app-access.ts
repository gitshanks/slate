import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SLATE_HOSTED, SLATE_PUBLIC } from "@/lib/public-mode";

const UNLOCK_COOKIE = "slate-unlocked";

/**
 * Keep access checks at the protected layout / data boundary instead of
 * routing every request through Proxy. On Vercel, each Proxy invocation is a
 * separate Observability event, even when it only returns NextResponse.next().
 */
export const getAppSession = cache(async () => auth());

export const hasAppAccess = cache(async () => {
  if (SLATE_HOSTED) {
    const session = await getAppSession();
    return Boolean(session?.user?.id);
  }

  // Public demo installs intentionally skip the optional shared passcode.
  if (SLATE_PUBLIC) return true;

  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return true;

  const cookieStore = await cookies();
  return cookieStore.get(UNLOCK_COOKIE)?.value === passcode;
});

export async function requireAppAccess(): Promise<void> {
  if (await hasAppAccess()) return;
  redirect(SLATE_HOSTED ? "/login" : "/unlock");
}

/**
 * Route Handlers cannot rely on a layout check. Return a small 401 response
 * before doing database or third-party API work.
 */
export async function appApiUnauthorizedResponse(): Promise<Response | null> {
  if (await hasAppAccess()) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
