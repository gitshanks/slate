"use client";

import * as React from "react";
import { Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiConversation, type ChatTurn } from "@/components/ai-conversation";
import { UserBubble, AssistantBubble } from "@/components/ai-chat-panel";
import { SearchResults } from "@/components/search-results";
import { EmptyState } from "@/components/empty-state";
import type { TmdbMediaResult } from "@/lib/tmdb";

/**
 * The /discover view. When a live AI conversation exists in the shared store
 * (arrived via "Browse all"), it renders the thread + the latest answer's
 * results as a grid + a follow-up box, so the conversation continues here in
 * sync with the modal. A fresh / shared-link visit (no thread) falls back to
 * the URL-intent grid the server prefetched.
 */
export function DiscoverView({
  serverMedia,
  serverSaved,
  title,
  summary,
  hasIntent,
}: {
  serverMedia: TmdbMediaResult[];
  serverSaved: number[];
  title: string;
  summary: string;
  hasIntent: boolean;
}) {
  const { turns } = useAiConversation();

  // A live thread always wins, regardless of how we got here.
  if (turns.length > 0) return <ConversationView turns={turns} />;

  // No conversation → the URL-intent grid the server prefetched (shareable).
  if (!hasIntent) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title="Nothing to browse yet"
        description="Open ⌘K, switch to AI mode, and choose “Browse all” on a set of results."
      />
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3" />
          AI search
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title || "Results"}
        </h1>
        {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </div>
      {serverMedia.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No matches"
          description="Try a broader ask in AI mode."
        />
      ) : (
        <SearchResults library={[]} media={serverMedia} people={[]} savedTmdbIds={serverSaved} />
      )}
    </div>
  );
}

function lastResults(turns: ChatTurn[]): TmdbMediaResult[] {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "assistant" && t.results && t.results.length > 0) {
      // ChatResultItem lacks backdrop_path; TmdbTile doesn't use it, so null is fine.
      return t.results.map((r) => ({ ...r, backdrop_path: null })) as TmdbMediaResult[];
    }
  }
  return [];
}

function ConversationView({ turns }: { turns: ChatTurn[] }) {
  const { streaming, submit } = useAiConversation();
  const [input, setInput] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);

  const title = turns.find((t) => t.role === "user")?.content ?? "AI search";
  const media = lastResults(turns);

  // Keep the newest turn in view as the thread grows.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const send = () => {
    const v = input.trim();
    if (!v || streaming) return;
    submit(v);
    setInput("");
  };

  return (
    <div className="pb-28">
      <div className="mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3" />
          AI search
        </p>
        <h1 className="mt-1 line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
      </div>

      {/* Conversation thread — per-turn rails suppressed; the latest answer's
          results render as the grid below. */}
      <div className="mb-10 flex flex-col gap-4">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <UserBubble key={i} text={t.content} />
          ) : (
            <AssistantBubble key={i} turn={t} hideResults />
          ),
        )}
        <div ref={endRef} />
      </div>

      {media.length > 0 && (
        <SearchResults library={[]} media={media} people={[]} savedTmdbIds={[]} />
      )}

      {/* Follow-up bar — pinned above the mobile BottomNav, flush on desktop. */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 sm:px-6 lg:px-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="relative mx-auto flex max-w-2xl items-center"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up…"
            inputMode="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 w-full rounded-full border border-border bg-card pl-4 pr-12 text-base sm:text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim() || streaming}
            className={cn(
              "absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
              input.trim() && !streaming
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/50",
            )}
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
