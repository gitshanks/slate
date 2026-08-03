import { appApiUnauthorizedResponse } from "@/lib/app-access";
import {
  resolveSharedLink,
  type SharedLinkInput,
} from "@/lib/shared-link-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  let input: SharedLinkInput;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    input = {
      url: typeof body.url === "string" ? body.url : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!input.url?.trim() && !input.text?.trim() && !input.title?.trim()) {
    return Response.json(
      { error: "Paste a link or recommendation text first." },
      { status: 400 },
    );
  }

  try {
    return Response.json(await resolveSharedLink(input));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The shared link could not be read.";
    return Response.json({ error: message }, { status: 422 });
  }
}
