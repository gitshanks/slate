"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Film, Tv, Sparkles, Search, Wand2, ArrowRight, Trash2 } from "lucide-react";
import { posterUrl } from "@/lib/tmdb-image";
import { formatTmdbScore, cn } from "@/lib/utils";
import { RailScroller } from "@/components/rail-scroller";
import {
  useAiConversation,
  type ChatResultItem,
  type SearchIntent,
  type AssistantTurn,
} from "@/components/ai-conversation";

interface AiChatPanelProps {
  /** The shared input value — the chat treats it as the next user message. */
  query: string;
  setQuery: (q: string) => void;
  /** Live AI suggestion chips fed by /api/ai-suggest, shown in the empty state. */
  suggestions: string[];
  /** Closes the palette. Called when the user clicks a result. */
  onClose: () => void;
  /** Bumped by the parent every time the input fires Enter. */
  submitTick: number;
}

export function AiChatPanel({
  query,
  setQuery,
  suggestions,
  onClose,
  submitTick,
}: AiChatPanelProps) {
  // Conversation state is shared with the /discover page via the provider in
  // the (app) layout, so the thread survives the modal → page hop.
  const { turns, submit, reset } = useAiConversation();
  const router = useRouter();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Parent bumps `submitTick` whenever it wants us to submit the current
  // query — Enter on the input, or clicking the AI Mode toggle while
  // there's text. We initialise the ref to 0 (not the current submitTick)
  // so that a *non-zero* submitTick at mount time triggers the auto-submit;
  // that's the path used when the user clicks AI Mode with text in the box.
  const lastTickRef = React.useRef(0);
  React.useEffect(() => {
    if (submitTick === lastTickRef.current) return;
    lastTickRef.current = submitTick;
    if (query.trim()) {
      submit(query);
      setQuery("");
    }
  }, [submitTick, query, submit, setQuery]);

  // Auto-scroll on new content.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const isEmpty = turns.length === 0;

  return (
    <div className="flex max-h-[70vh] min-h-[280px] flex-col">
      {!isEmpty && (
        <div className="flex justify-end border-b border-border/60 px-3 py-1.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
      {/* Empty state: prompt + suggestion chips + a hint about Enter to send. */}
      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>AI search</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Describe what you&rsquo;re in the mood for. Press{" "}
            <kbd className="font-mono">↵</kbd> to send. Follow-ups continue the thread — here or on the results page.
          </p>
          {suggestions.length > 0 ? (
            <div className="flex max-w-md flex-wrap justify-center gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={`${i}-${s}`}
                  type="button"
                  onClick={() => submit(s)}
                  className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70">
              e.g. <em>&ldquo;cozy autumn mysteries&rdquo;</em>,{" "}
              <em>&ldquo;A24 horror after 2020&rdquo;</em>
            </p>
          )}
        </div>
      )}

      {!isEmpty && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <UserBubble key={i} text={turn.content} />
              ) : (
                <AssistantBubble
                  key={i}
                  turn={turn}
                  onResultClick={(item) => {
                    onClose();
                    router.push(`/discover/${item.media_type}/${item.id}`);
                  }}
                  onBrowse={
                    turn.intent && turn.results && turn.results.length > 0
                      ? () => {
                          onClose();
                          const prev = turns[i - 1];
                          router.push(
                            browseUrl(
                              turn.intent!,
                              prev && prev.role === "user" ? prev.content : "",
                            ),
                          );
                        }
                      : undefined
                  }
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary/10 px-3 py-2 text-sm text-foreground">
        {text}
      </div>
    </div>
  );
}

export function AssistantBubble({
  turn,
  onResultClick,
  onBrowse,
  hideResults = false,
  footerAction,
}: {
  turn: AssistantTurn;
  onResultClick?: (item: ChatResultItem) => void;
  /** Present only when this turn has browsable results — opens the full page. */
  onBrowse?: () => void;
  /** Page view shows the latest results as a grid below, so the per-turn rail + browse link are suppressed. */
  hideResults?: boolean;
  /** Optional control rendered on the intent-chip row, right-aligned (e.g. Clear on the newest turn). */
  footerAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 text-sm text-foreground">
          {turn.content ? (
            <span className="whitespace-pre-wrap">
              {turn.content}
              {!turn.done && !turn.error && (
                <span className="loading-breathe ml-0.5 inline-block h-3 w-1.5 bg-foreground/40 align-middle" />
              )}
            </span>
          ) : turn.error ? (
            // Error replaces the loading state — no "Thinking…" stacked on top.
            <span className="text-destructive">{turn.error}</span>
          ) : turn.searching ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Search className="loading-breathe h-3.5 w-3.5" />
              Searching…
            </span>
          ) : !turn.done ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="loading-spinner h-3.5 w-3.5" />
              Thinking…
            </span>
          ) : turn.results && turn.results.length > 0 ? null : (
            // Finished with no prose and no results — don't spin forever.
            <span className="text-muted-foreground">
              I didn&rsquo;t catch a response there — mind asking again?
            </span>
          )}
        </div>
      </div>

      {turn.searching && turn.content && (
        <div className="ml-8 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Search className="loading-breathe h-3 w-3" />
          Searching…
        </div>
      )}

      {(turn.intent || footerAction) && (
        <div className="ml-8 flex items-center justify-between gap-3">
          {turn.intent ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              <Wand2 className="h-3 w-3" />
              <span className="normal-case tracking-normal">
                {summarizeIntent(turn.intent)}
              </span>
            </span>
          ) : (
            <span />
          )}
          {footerAction}
        </div>
      )}

      {!hideResults && onResultClick && turn.results && turn.results.length > 0 && (
        <ResultRail items={turn.results} onClick={onResultClick} />
      )}

      {!hideResults && onBrowse && (
        <button
          type="button"
          onClick={onBrowse}
          className="ml-8 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
        >
          Browse all
          <ArrowRight className="h-3 w-3" />
        </button>
      )}

      {/* Inline error rendered separately only if we already have prose
          (so the user keeps seeing the partial response above). */}
      {turn.error && turn.content && (
        <div className="ml-8 text-xs text-destructive">{turn.error}</div>
      )}
    </div>
  );
}

/** Encode an AI intent into the /discover browse-page URL. */
function browseUrl(intent: SearchIntent, title: string): string {
  const p = new URLSearchParams();
  if (intent.media_type !== "both") p.set("mt", intent.media_type);
  if (intent.genres.length > 0) p.set("genres", intent.genres.join(","));
  if (intent.year_min != null) p.set("ymin", String(intent.year_min));
  if (intent.year_max != null) p.set("ymax", String(intent.year_max));
  if (intent.sort_by) p.set("sort", intent.sort_by);
  if (intent.min_rating != null) p.set("minr", String(intent.min_rating));
  if (intent.query_text) p.set("q", intent.query_text);
  if (title) p.set("title", title);
  return `/discover?${p.toString()}`;
}

function summarizeIntent(intent: SearchIntent): string {
  const parts: string[] = [];
  if (intent.media_type !== "both") parts.push(intent.media_type === "movie" ? "movies" : "TV");
  if (intent.genres.length > 0) parts.push(intent.genres.slice(0, 3).join(", "));
  if (intent.year_min || intent.year_max) {
    parts.push(`${intent.year_min ?? "…"}–${intent.year_max ?? "…"}`);
  }
  if (intent.sort_by === "rating") parts.push("highly rated");
  if (intent.sort_by === "recent") parts.push("recent");
  if (intent.query_text) parts.push(`"${intent.query_text}"`);
  return parts.length > 0 ? parts.join(" · ") : "broad search";
}

const RAIL_TYPES = [
  { value: "", label: "All" },
  { value: "movie", label: "Films" },
  { value: "tv", label: "Series" },
] as const;

function ResultRail({
  items,
  onClick,
}: {
  items: ChatResultItem[];
  onClick: (item: ChatResultItem) => void;
}) {
  const [type, setType] = React.useState<"" | "movie" | "tv">("");
  // Only offer the filter when a single answer actually mixes films and
  // series — otherwise the AI already committed to one type and chips are noise.
  const mixed =
    items.some((i) => i.media_type === "movie") &&
    items.some((i) => i.media_type === "tv");
  const shown = type ? items.filter((i) => i.media_type === type) : items;

  return (
    // ml-8 indents the rail beneath the assistant text; -mr-4 bleeds it to the
    // dialog edge. RailScroller supplies the desktop hover arrows — a plain
    // overflow-x-auto rail can't be scrolled with a mouse wheel (a vertical
    // delta won't move horizontal-only overflow), which left this list stuck
    // on desktop even though it panned fine on touch.
    <div className="ml-8 -mr-4">
      {mixed && (
        <div className="mb-2 inline-flex items-center rounded-full border border-border bg-card p-0.5">
          {RAIL_TYPES.map(({ value, label }) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setType(value)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                type === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <RailScroller>
        {shown.map((item) => {
          const name = item.title || item.name || "Untitled";
          const date = item.release_date || item.first_air_date || "";
          const year = date ? date.slice(0, 4) : "";
          const poster = posterUrl(item.poster_path, "w185");
          const score = formatTmdbScore(item.vote_average);
          return (
            <button
              key={`${item.media_type}-${item.id}`}
              type="button"
              onClick={() => onClick(item)}
              className="group flex w-[110px] shrink-0 snap-start flex-col items-start gap-1 text-left"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted ring-1 ring-border transition-shadow group-hover:ring-primary/50">
                {poster ? (
                  <Image
                    src={poster}
                    alt={name}
                    fill
                    sizes="110px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {item.media_type === "movie" ? (
                      <Film className="h-5 w-5" />
                    ) : (
                      <Tv className="h-5 w-5" />
                    )}
                  </div>
                )}
              </div>
              <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                {name}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {year}
                {score && <> · {score}</>}
              </span>
            </button>
          );
        })}
      </RailScroller>
    </div>
  );
}
