import "server-only";

import type { ChatContext, ChatMessage } from "@/lib/ai-chat";

// Request parsing and rate limiting shared by the web (/api/ai-chat) and
// native (/api/v1/ai/chat) chat routes, so both accept exactly the same input.

export const MAX_REQUEST_BYTES = 64_000;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_CONCURRENT_REQUESTS = 2;

export class PayloadTooLargeError extends Error {}

interface UsageState {
  windowStartedAt: number;
  requests: number;
  inFlight: number;
}

const usageByClient = new Map<string, UsageState>();

export async function readBoundedJson(request: Request): Promise<unknown> {
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

export function acquireAiPermit(key: string): (() => void) | null {
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

/** Validate and trim a chat request body into messages and poster context. */
export function parseChatBody(raw: unknown): {
  messages: ChatMessage[];
  context: ChatContext | null;
} {
  const body = raw as {
    messages?: unknown;
    context?: { results?: unknown };
  } | null;
  let messages: ChatMessage[] = [];
  let context: ChatContext | null = null;
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
          result_origin:
            value.result_origin === "saved_library" ||
            value.result_origin === "history_discovery" ||
            value.result_origin === "catalogue_discovery"
              ? value.result_origin
              : undefined,
          library_status:
            value.library_status === "want" ||
            value.library_status === "watching" ||
            value.library_status === "watched" ||
            value.library_status === "dropped"
              ? value.library_status
              : undefined,
          runtime:
            typeof value.runtime === "number" &&
            Number.isFinite(value.runtime)
              ? Math.max(0, Math.min(600, Math.round(value.runtime)))
              : null,
          genres: Array.isArray(value.genres)
            ? value.genres
                .filter((genre): genre is string => typeof genre === "string")
                .map((genre) => genre.trim().slice(0, 40))
                .filter(Boolean)
                .slice(0, 4)
            : [],
          current_season:
            typeof value.current_season === "number" &&
            Number.isFinite(value.current_season)
              ? Math.max(0, Math.min(100, Math.round(value.current_season)))
              : null,
          current_episode:
            typeof value.current_episode === "number" &&
            Number.isFinite(value.current_episode)
              ? Math.max(0, Math.min(10_000, Math.round(value.current_episode)))
              : null,
        };
      })
      .filter(
        (item: ChatContext["results"][number] | null): item is ChatContext["results"][number] =>
          item !== null,
      )
      .slice(0, 16);
    if (results.length > 0) context = { results };
  }
  return { messages, context };
}

/**
 * Serialise chat events as NDJSON, one event per line. Releases the rate
 * permit when the stream ends or the client disconnects.
 */
export function chatEventStream(
  request: Request,
  events: (signal: AbortSignal) => AsyncIterable<{ type: string; delta?: string; results?: unknown[] }>,
  releasePermit: () => void,
): Response {
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
        for await (const event of events(streamAbort.signal)) {
          if (
            (event.type === "text" && (event.delta ?? "").trim().length > 0) ||
            (event.type === "search_result" && (event.results?.length ?? 0) > 0) ||
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
