import { emailSignInConfigured } from "@/lib/email-auth";
import {
  emailAuthSchemaReady,
  ensureEmailAuthSchema,
} from "@/lib/email-auth-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const connected = await ensureEmailAuthSchema();
    const ready = connected && await emailAuthSchemaReady();
    return Response.json({ configured: emailSignInConfigured(), ready });
  } catch {
    return Response.json({ configured: false, ready: false }, { status: 500 });
  }
}
