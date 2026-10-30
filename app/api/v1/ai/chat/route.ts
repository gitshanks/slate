import { aiChatEnabled, streamChat } from "@/lib/ai-chat";
import {
  acquireAiPermit,
  chatEventStream,
  parseChatBody,
} from "@/lib/ai-chat-request";
import { runAsLibraryOwner } from "@/lib/library-db";
import { apiError, NativeApiError, readJsonObject } from "@/lib/native-api/http";
import { authenticateNativeRequest } from "@/lib/native-api/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Slate's AI chat for native clients: the same tools and NDJSON events as
 * /api/ai-chat, reading the library of the bearer token's owner.
 */
export async function POST(request: Request) {
  try {
    const claims = await authenticateNativeRequest(request);
    if (!aiChatEnabled) {
      throw new NativeApiError(503, "configuration_error", "AI search is not configured.");
    }
    const { messages, context } = parseChatBody(await readJsonObject(request));
    if (messages.length === 0) {
      throw new NativeApiError(400, "bad_request", "messages is required.");
    }
    const releasePermit = acquireAiPermit(`user:${claims.ownerId}`);
    if (!releasePermit) {
      throw new NativeApiError(429, "rate_limited", "Too many AI requests. Try again in a moment.");
    }
    return runAsLibraryOwner(claims.ownerId, () =>
      chatEventStream(
        request,
        (signal) => streamChat(messages, context, signal),
        releasePermit,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
