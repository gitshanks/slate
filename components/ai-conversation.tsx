"use client";

import * as React from "react";

// Wire shapes mirror lib/ai-chat.ts. Kept loose here so the client bundle
// doesn't couple to the server-only module.
export interface SearchIntent {
  media_type: "movie" | "tv" | "both";
  genres: string[];
  year_min: number | null;
  year_max: number | null;
  query_text: string | null;
  sort_by: "popularity" | "rating" | "recent" | null;
  min_rating: number | null;
  interpretation: string;
}

export interface ChatResultItem {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

export interface UserTurn {
  role: "user";
  content: string;
}

export interface AssistantTurn {
  role: "assistant";
  content: string;
  searching: boolean;
  intent: SearchIntent | null;
  results: ChatResultItem[] | null;
  error: string | null;
  /** Set true when the stream finishes for this turn. Drives the cursor blink. */
  done: boolean;
}

export type ChatTurn = UserTurn | AssistantTurn;

type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "search_start" }
  | { type: "search_result"; intent: SearchIntent; results: ChatResultItem[] }
  | { type: "done" }
  | { type: "error"; message: string };

function mutateLastAssistant(
  prev: ChatTurn[],
  mutator: (a: AssistantTurn) => AssistantTurn,
): ChatTurn[] {
  if (prev.length === 0) return prev;
  const last = prev[prev.length - 1];
  if (last.role !== "assistant") return prev;
  const updated = [...prev];
  updated[updated.length - 1] = mutator(last);
  return updated;
}

interface AiConversationValue {
  turns: ChatTurn[];
  streaming: boolean;
  /** Send a message as the next user turn and stream the reply. */
  submit: (message: string) => void;
  /** Abort any stream and clear the thread. */
  reset: () => void;
}

const Ctx = React.createContext<AiConversationValue | null>(null);

export function useAiConversation() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAiConversation must be used inside AiConversationProvider");
  return v;
}

// Per-tab so the thread also survives a full reload, but clears when the tab
// (or PWA) closes — "for that browser session".
const STORAGE_KEY = "slate:ai-conversation";

/**
 * Holds the AI search conversation so the command-palette modal AND the
 * /discover page render and extend one shared thread. Lives high in the
 * (app) layout, so the thread survives a client-side navigation from the
 * modal to the page (the layout — and this provider — stays mounted), and is
 * mirrored to sessionStorage so it also survives a full page reload within
 * the same browser session.
 */
export function AiConversationProvider({ children }: { children: React.ReactNode }) {
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Rehydrate once on mount. We start from [] (matching SSR) and restore in an
  // effect to avoid a hydration mismatch; `hydrated` then gates the writer so
  // it can't clobber storage with the initial empty state.
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatTurn[];
        if (Array.isArray(parsed) && parsed.length > 0) setTurns(parsed);
      }
    } catch {
      // Private mode / quota / parse error — just start fresh.
    }
    setHydrated(true);
  }, []);

  // Persist completed turns. Skipped mid-stream so we don't stringify the whole
  // thread on every token; the final state lands when streaming flips off.
  React.useEffect(() => {
    if (!hydrated || streaming) return;
    try {
      if (turns.length > 0) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures — persistence is best-effort.
    }
  }, [turns, hydrated, streaming]);

  const applyEvent = React.useCallback((event: ChatEvent) => {
    if (event.type === "text") {
      setTurns((prev) => mutateLastAssistant(prev, (a) => ({ ...a, content: a.content + event.delta })));
    } else if (event.type === "search_start") {
      setTurns((prev) => mutateLastAssistant(prev, (a) => ({ ...a, searching: true })));
    } else if (event.type === "search_result") {
      setTurns((prev) =>
        mutateLastAssistant(prev, (a) => ({
          ...a,
          searching: false,
          intent: event.intent,
          results: event.results,
        })),
      );
    } else if (event.type === "error") {
      setTurns((prev) => mutateLastAssistant(prev, (a) => ({ ...a, error: event.message, done: true })));
    }
  }, []);

  const submit = React.useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || streaming) return;

      const next: ChatTurn[] = [
        ...turns,
        { role: "user", content: trimmed },
        {
          role: "assistant",
          content: "",
          searching: false,
          intent: null,
          results: null,
          error: null,
          done: false,
        },
      ];
      setTurns(next);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            messages: next
              .filter((t) => t.role === "user" || (t.role === "assistant" && t.content))
              .map((t) => ({ role: t.role, content: t.content })),
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`chat failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // NDJSON: one event per line.
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: ChatEvent;
            try {
              event = JSON.parse(line) as ChatEvent;
            } catch {
              continue;
            }
            applyEvent(event);
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        const errMessage = err instanceof Error ? err.message : "chat error";
        setTurns((prev) => mutateLastAssistant(prev, (a) => ({ ...a, error: errMessage, done: true })));
      } finally {
        setTurns((prev) => mutateLastAssistant(prev, (a) => ({ ...a, done: true, searching: false })));
        setStreaming(false);
      }
    },
    [turns, streaming, applyEvent],
  );

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setStreaming(false);
  }, []);

  const value = React.useMemo(
    () => ({ turns, streaming, submit, reset }),
    [turns, streaming, submit, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
