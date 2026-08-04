"use client";

import * as React from "react";
import { Sparkles, ArrowUp, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiConversation, type ChatTurn } from "@/components/ai-conversation";
import { UserBubble, AssistantBubble } from "@/components/ai-chat-panel";
import { SearchResults } from "@/components/search-results";
import { EmptyState } from "@/components/empty-state";
import { RailScroller } from "@/components/rail-scroller";
import { TmdbTile } from "@/components/tmdb-tile";
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
 * Sizes the mobile chat shell so its bottom rides the visual viewport — it
 * shrinks when the soft keyboard opens (iOS doesn't reflow the layout viewport
 * for the keyboard). The thread (flex-1) absorbs the change so the input stays
 * just above the keys. Returns null until measured / on desktop (shell hidden).
 */
function useChatShellHeight(ref: React.RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = React.useState<number | null>(null);
  React.useEffect(() => {
    const vv = window.visualViewport;
    const compute = () => {
      const el = ref.current;
      if (!el || getComputedStyle(el).display === "none") return; // desktop
      const viewportBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const appScrollArea = el.closest("#app-scroll-area");
      const contentBottom = appScrollArea
        ? appScrollArea.getBoundingClientRect().bottom
        : viewportBottom;
      const top = el.getBoundingClientRect().top;
      setHeight(
        Math.max(260, Math.round(Math.min(viewportBottom, contentBottom) - top))
      );
    };
    compute();
    const t = window.setTimeout(compute, 120);
    window.addEventListener("resize", compute);
    vv?.addEventListener("resize", compute);
    vv?.addEventListener("scroll", compute);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", compute);
      vv?.removeEventListener("resize", compute);
      vv?.removeEventListener("scroll", compute);
    };
  }, [ref]);
  return height;
}

function FollowUpForm({
  value,
  onChange,
  onSend,
  streaming,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  streaming: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      className="relative flex w-full items-center"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        disabled={!value.trim() || streaming}
        className={cn(
          "absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
          value.trim() && !streaming
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground/50",
        )}
      >
        {streaming ? <Loader2 className="loading-spinner h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </form>
  );
}

/** Message list (+ Clear on the newest message), self-scrolling to the end. */
function ChatThread({ turns, onClear }: { turns: ChatTurn[]; onClear: () => void }) {
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);
  return (
    <>
      {turns.map((t, i) =>
        t.role === "user" ? (
          <UserBubble key={i} text={t.content} />
        ) : (
          <AssistantBubble
            key={i}
            turn={t}
            hideResults
            footerAction={
              i === turns.length - 1 ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              ) : undefined
            }
          />
        ),
      )}
      <div ref={endRef} />
    </>
  );
}

function ConversationView({ turns }: { turns: ChatTurn[] }) {
  const { streaming, submit, reset } = useAiConversation();
  const [input, setInput] = React.useState("");
  const shellRef = React.useRef<HTMLDivElement>(null);
  const shellHeight = useChatShellHeight(shellRef);

  const title = turns.find((t) => t.role === "user")?.content ?? "AI search";
  const media = lastResults(turns);

  const send = () => {
    const v = input.trim();
    if (!v || streaming) return;
    submit(v);
    setInput("");
  };

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Sparkles className="h-3 w-3" />
          AI search
        </p>
        <h1 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
          {title}
        </h1>
      </div>

      {/* MOBILE: chat-app shell — results rail pinned on top, thread scrolls,
          follow-up at the bottom. Height tracks the visual viewport so the
          input rides just above the keyboard. */}
      <div
        ref={shellRef}
        className="flex flex-col lg:hidden"
        style={shellHeight ? { height: shellHeight } : undefined}
      >
        {media.length > 0 && (
          <div className="-mr-4 shrink-0 pb-3">
            <RailScroller>
              {media.map((m) => (
                <TmdbTile key={`${m.media_type}-${m.id}`} item={m} variant="rail" />
              ))}
            </RailScroller>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-border pt-4">
          <ChatThread turns={turns} onClear={reset} />
        </div>
        <div className="shrink-0 border-t border-border pt-3">
          <FollowUpForm value={input} onChange={setInput} onSend={send} streaming={streaming} />
        </div>
      </div>

      {/* DESKTOP: two-column — sticky chat panel left, results grid right. */}
      <div className="hidden lg:flex lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-7rem)] lg:w-[380px] lg:shrink-0 lg:flex-col lg:rounded-2xl lg:border lg:border-border lg:bg-card/50 lg:p-5 xl:w-[440px]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            <ChatThread turns={turns} onClear={reset} />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <FollowUpForm value={input} onChange={setInput} onSend={send} streaming={streaming} />
          </div>
        </div>
        <div className="min-w-0 lg:flex-1">
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
