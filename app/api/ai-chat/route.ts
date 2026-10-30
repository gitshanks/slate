import { aiChatEnabled, streamChat } from "@/lib/ai-chat";
import {
  acquireAiPermit,
  chatEventStream,
  MAX_REQUEST_BYTES,
  parseChatBody,
  PayloadTooLargeError,
  readBoundedJson,
} from "@/lib/ai-chat-request";
import {
  appApiUnauthorizedResponse,
  getAppSession,
} from "@/lib/app-access";

// Force the Node runtime — the Anthropic and OpenAI SDKs use Node streams
// internally. Edge would also work but Node has fewer surprises.
export const runtime = "nodejs";

// No caching — every request is unique.
export const dynamic = "force-dynamic";

function clientRateKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  return `ip:${forwardedFor?.trim() || "local"}`;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "request is too large" }, { status: 413 });
  }

  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  if (!aiChatEnabled) {
    return new Response(
      JSON.stringify({ error: "AI chat is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let parsed: ReturnType<typeof parseChatBody>;
  try {
    parsed = parseChatBody(await readBoundedJson(request));
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: "request is too large" }, { status: 413 });
    }
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { messages, context } = parsed;

  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = await getAppSession();
  const releasePermit = acquireAiPermit(
    clientRateKey(request, session?.user?.id),
  );
  if (!releasePermit) {
    return Response.json(
      { error: "Too many AI requests. Try again in a moment." },
      { status: 429, headers: { "Retry-After": "2" } },
    );
  }

  // Stream NDJSON: one JSON event per line. Simpler to parse than SSE
  // and the only consumer is our own client.
  return chatEventStream(
    request,
    (signal) => streamChat(messages, context, signal),
    releasePermit,
  );
}
