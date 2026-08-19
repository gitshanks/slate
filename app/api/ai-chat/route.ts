import {
  aiChatEnabled,
  streamChat,
  type ChatContext,
  type ChatMessage,
} from "@/lib/ai-chat";
import {
  appApiUnauthorizedResponse,
  getAppSession,
} from "@/lib/app-access";

// Force the Node runtime — the Anthropic and OpenAI SDKs use Node streams
// internally. Edge would also work but Node has fewer surprises.
export const runtime = "nodejs";

// No caching — every request is unique.
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 64_000;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_CONCURRENT_REQUESTS = 2;

class PayloadTooLargeError extends Error {}

interface UsageState {
  windowStartedAt: number;
  requests: number;
  inFlight: number;
}

const usageByClient = new Map<string, UsageState>();

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new SyntaxError("missing request body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

function clientRateKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  return `ip:${forwardedFor?.trim() || "local"}`;
}

function acquireAiPermit(key: string): (() => void) | null {
  const now = Date.now();
  for (const [clientKey, usage] of usageByClient) {
    if (
      usage.inFlight === 0 &&
      now - usage.windowStartedAt >= RATE_WINDOW_MS
    ) {
      usageByClient.delete(clientKey);
    }
  }
  const existing = usageByClient.get(key);
  const state: UsageState =
    existing && now - existing.windowStartedAt < RATE_WINDOW_MS
      ? existing
      : {
          windowStartedAt: now,
          requests: 0,
          inFlight: existing?.inFlight ?? 0,
        };

  if (
    state.requests >= MAX_REQUESTS_PER_WINDOW ||
    state.inFlight >= MAX_CONCURRENT_REQUESTS
  ) {
    usageByClient.set(key, state);
    return null;
  }

  state.requests += 1;
  state.inFlight += 1;
  usageByClient.set(key, state);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = usageByClient.get(key);
    if (!current) return;
    current.inFlight = Math.max(0, current.inFlight - 1);
    if (
      current.inFlight === 0 &&
      Date.now() - current.windowStartedAt >= RATE_WINDOW_MS
    ) {
      usageByClient.delete(key);
    }
  };
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

  let messages: ChatMessage[] = [];
  let context: ChatContext | null = null;
  try {
    const body = (await readBoundedJson(request)) as {
      messages?: unknown;
      context?: { results?: unknown };
    };
    if (Array.isArray(body?.messages)) {
      messages = body.messages
        .filter((m: unknown): m is ChatMessage => {
          if (typeof m !== "object" || m === null) return false;
          const role = (m as { role?: unknown }).role;
          return role === "user" || role === "assistant";
        })
        .map((m: ChatMessage) => ({
          role: m.role,
          content:
            typeof m.content === "string" ? m.content.slice(0, 2_000) : "",
        }))
        .slice(-12);
    }
    if (Array.isArray(body?.context?.results)) {
      const results = body.context.results
        .filter((item: unknown) => typeof item === "object" && item !== null)
        .map<ChatContext["results"][number] | null>((item: unknown) => {
          const value = item as Record<string, unknown>;
          const mediaType =
            value.media_type === "movie" || value.media_type === "tv"
              ? value.media_type
              : null;
          const id =
            typeof value.id === "number" && Number.isFinite(value.id)
              ? Math.round(value.id)
              : null;
          const title =
            typeof value.title === "string"
              ? value.title.trim().slice(0, 180)
              : "";
          if (!mediaType || id === null || !title) return null;
          return {
            id,
            media_type: mediaType,
            title,
            year:
              typeof value.year === "string"
                ? value.year.replace(/[^0-9]/g, "").slice(0, 4)
                : "",
            vote_average:
              typeof value.vote_average === "number" &&
              Number.isFinite(value.vote_average)
                ? Math.max(0, Math.min(10, value.vote_average))
                : null,
            overview:
              typeof value.overview === "string"
                ? value.overview.trim().slice(0, 320)
                : "",
          };
        })
        .filter(
          (item: ChatContext["results"][number] | null): item is ChatContext["results"][number] =>
            item !== null,
        )
        .slice(0, 16);
      if (results.length > 0) context = { results };
    }
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
  const encoder = new TextEncoder();
  const streamAbort = new AbortController();
  const abortStream = () => streamAbort.abort();
  if (request.signal.aborted) abortStream();
  else request.signal.addEventListener("abort", abortStream, { once: true });
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      let meaningfulEventCount = 0;
      const send = (event: object) => {
        if (closed || streamAbort.signal.aborted) return false;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          return true;
        } catch {
          closed = true;
          streamAbort.abort();
          return false;
        }
      };
      try {
        for await (const event of streamChat(
          messages,
          context,
          streamAbort.signal,
        )) {
          if (
            (event.type === "text" && event.delta.trim().length > 0) ||
            (event.type === "search_result" && event.results.length > 0) ||
            event.type === "error"
          ) {
            meaningfulEventCount += 1;
          }
          if (!send(event)) break;
        }
        if (meaningfulEventCount === 0 && !streamAbort.signal.aborted) {
          send({
            type: "error",
            message: "Slate couldn't complete that response. Please try again.",
          });
        }
        send({ type: "done" });
      } catch (err) {
        if (!streamAbort.signal.aborted) {
          const message = err instanceof Error ? err.message : "stream failed";
          send({ type: "error", message });
        }
      } finally {
        request.signal.removeEventListener("abort", abortStream);
        releasePermit();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // The reader may already have canceled the stream.
          }
        }
      }
    },
    cancel() {
      closed = true;
      streamAbort.abort();
      releasePermit();
      request.signal.removeEventListener("abort", abortStream);
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
