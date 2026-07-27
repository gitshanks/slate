import { aiChatEnabled, streamChat, type ChatMessage } from "@/lib/ai-chat";
import { appApiUnauthorizedResponse } from "@/lib/app-access";

// Force the Node runtime — the Anthropic and OpenAI SDKs use Node streams
// internally. Edge would also work but Node has fewer surprises.
export const runtime = "nodejs";

// No caching — every request is unique.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  if (!aiChatEnabled) {
    return new Response(
      JSON.stringify({ error: "AI chat is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let messages: ChatMessage[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.messages)) {
      messages = body.messages
        .filter((m: unknown): m is ChatMessage => {
          if (typeof m !== "object" || m === null) return false;
          const role = (m as { role?: unknown }).role;
          return role === "user" || role === "assistant";
        })
        .map((m: ChatMessage) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : "",
        }));
    }
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Stream NDJSON: one JSON event per line. Simpler to parse than SSE
  // and the only consumer is our own client.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        for await (const event of streamChat(messages)) {
          send(event);
        }
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
