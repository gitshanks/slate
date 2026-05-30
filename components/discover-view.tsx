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

/**
 * Soft-keyboard height via the VisualViewport API. iOS doesn't shrink the
 * layout viewport when the keyboard opens (a `position: fixed` bar would sit
 * behind it), so we measure the overlap and lift the input by that much.
 * Returns 0 when the keyboard is closed or the API is unavailable (desktop).
 */
function useKeyboardInset() {
  const [inset, setInset] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore small deltas (URL-bar show/hide) — real keyboards are tall.
      setInset(overlap > 100 ? Math.round(overlap) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

function ConversationView({ turns }: { turns: ChatTurn[] }) {
  const { streaming, submit } = useAiConversation();
  const [input, setInput] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);
  const kbInset = useKeyboardInset();

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
    <div>
      <div className="mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3" />
          AI search
        </p>
        <h1 className="mt-1 line-clamp-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
      </div>

      <div className="lg:flex lg:items-start lg:gap-8">
        {/* Chat column — on desktop it's a distinct, sticky panel beside the
            results: its own scrolling thread with the follow-up pinned at the
            base. On mobile it collapses: thread here, results below, follow-up
            as a fixed bottom bar (so no panel chrome there). */}
        <div className="lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-7rem)] lg:w-[380px] lg:shrink-0 lg:flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-card/50 lg:p-5 xl:w-[440px]">
          {/* Conversation thread — per-turn rails suppressed; the latest
              answer's results render as the grid in the other column. */}
          <div className="flex flex-col gap-4 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <UserBubble key={i} text={t.content} />
              ) : (
                <AssistantBubble key={i} turn={t} hideResults />
              ),
            )}
            <div ref={endRef} />
          </div>

          {/* Follow-up. In normal flow when idle (under the thread on mobile,
              at the base of the chat panel on desktop). When the soft keyboard
              opens we pin it just above the keyboard via the VisualViewport
              inset — so it sits snug above the keys instead of floating. */}
          <div
            className={cn(
              "border-t border-border",
              kbInset > 0
                ? "fixed inset-x-0 z-50 bg-background px-4 py-3 sm:px-6"
                : "mt-4 pt-4",
            )}
            style={kbInset > 0 ? { bottom: kbInset } : undefined}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="relative mx-auto flex w-full max-w-2xl items-center lg:max-w-none"
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

        {/* Results column */}
        <div className="mt-10 min-w-0 lg:mt-0 lg:flex-1">
          {media.length > 0 ? (
            <SearchResults library={[]} media={media} people={[]} savedTmdbIds={[]} />
          ) : (
            <p className="text-sm text-muted-foreground">No results for this turn.</p>
          )}
        </div>
      </div>
    </div>
  );
}
