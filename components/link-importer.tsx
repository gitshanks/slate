"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Link2,
  LoaderCircle,
  Plus,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addSharedTitles, type AddSharedTitlesResult } from "@/lib/share-actions";
import type {
  SharedLinkCandidate,
  SharedLinkInput,
  SharedLinkResolution,
} from "@/lib/shared-link-resolver";
import { posterUrl } from "@/lib/tmdb-image";
import { APP_ROOT } from "@/lib/public-mode";
import { cn } from "@/lib/utils";

interface LinkImporterProps {
  initialShare?: SharedLinkInput;
  autoStart?: boolean;
}

type Phase = "idle" | "resolving" | "review" | "saved";

function initialDraft(share: SharedLinkInput | undefined): string {
  return share?.url?.trim() || share?.text?.trim() || share?.title?.trim() || "";
}

function candidateKey(candidate: SharedLinkCandidate): string {
  return `${candidate.tmdbId}:${candidate.mediaType}`;
}

export function LinkImporter({
  initialShare,
  autoStart = false,
}: LinkImporterProps) {
  const [draft, setDraft] = useState(() => initialDraft(initialShare));
  const [phase, setPhase] = useState<Phase>("idle");
  const [resolution, setResolution] = useState<SharedLinkResolution | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<AddSharedTitlesResult | null>(null);
  const [saving, startSaving] = useTransition();
  const autoStarted = useRef(false);

  const resolveShare = useCallback(async (input: SharedLinkInput) => {
    setPhase("resolving");
    setError(null);
    setResolution(null);
    setSaveResult(null);
    try {
      const response = await fetch("/api/share/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as SharedLinkResolution & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error || "slate could not read that link.");
      }
      const defaults = new Set(
        body.candidates
          .filter((candidate) => !candidate.inLibrary)
          .map(candidateKey),
      );
      setResolution(body);
      setSelected(defaults);
      setPhase("review");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "slate could not read that link.",
      );
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    if (!autoStart || autoStarted.current || !initialDraft(initialShare)) return;
    autoStarted.current = true;
    void resolveShare(initialShare ?? {});
  }, [autoStart, initialShare, resolveShare]);

  const selectedCandidates = useMemo(() => {
    return (resolution?.candidates ?? []).filter((candidate) =>
      selected.has(candidateKey(candidate)),
    );
  }, [resolution, selected]);

  function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) {
      setError("Paste a link first.");
      return;
    }
    void resolveShare({ url: value, text: value });
  }

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) throw new Error("Clipboard is empty.");
      setDraft(value.trim());
      setError(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not read the clipboard.");
    }
  }

  function toggleCandidate(candidate: SharedLinkCandidate) {
    if (candidate.inLibrary) return;
    const key = candidateKey(candidate);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function saveSelected() {
    if (selectedCandidates.length === 0) return;
    startSaving(async () => {
      try {
        const result = await addSharedTitles(
          selectedCandidates.map((candidate) => ({
            tmdbId: candidate.tmdbId,
            mediaType: candidate.mediaType,
          })),
        );
        setSaveResult(result);
        setPhase("saved");
        if (result.added > 0) {
          toast.success(
            `${result.added} ${result.added === 1 ? "title" : "titles"} added to Up Next`,
          );
        }
      } catch (reason) {
        toast.error(
          reason instanceof Error ? reason.message : "Those titles could not be added.",
        );
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/45">
      <form onSubmit={submitDraft} className="p-4 sm:p-5">
        <label htmlFor="shared-link" className="text-sm font-medium text-foreground">
          Link or recommendation text
        </label>
        <div className="mt-2 flex items-start gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <textarea
              id="shared-link"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste an Instagram, YouTube, TikTok, article, IMDb, or TMDB link"
              rows={2}
              maxLength={8_000}
              className="min-h-[76px] w-full resize-none rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm leading-relaxed text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={pasteFromClipboard}
            aria-label="Paste from clipboard"
            className="mt-0.5 shrink-0"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            slate reads public page text, captions, and video descriptions. You
            choose what gets saved.
          </p>
          <Button
            type="submit"
            loading={phase === "resolving"}
            disabled={!draft.trim()}
            className="w-full shrink-0 sm:w-auto"
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            {phase === "resolving" ? "Reading link…" : "Find titles"}
          </Button>
        </div>
      </form>

      {error ? (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-5 sm:mb-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {phase === "resolving" ? <ResolvingState /> : null}
      {phase === "review" && resolution ? (
        <ReviewState
          resolution={resolution}
          selected={selected}
          saving={saving}
          onToggle={toggleCandidate}
          onSave={saveSelected}
        />
      ) : null}
      {phase === "saved" && saveResult ? (
        <SavedState
          result={saveResult}
          onAnother={() => {
            setDraft("");
            setResolution(null);
            setSelected(new Set());
            setSaveResult(null);
            setPhase("idle");
          }}
        />
      ) : null}
    </div>
  );
}

function ResolvingState() {
  return (
    <div className="border-t border-border/60 px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="loading-spinner h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Reading the recommendation</p>
          <p className="text-xs text-muted-foreground">Pulling out film and TV titles, then checking TMDB.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={cn(index > 2 && "hidden sm:block")}>
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton shape="text" className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewState({
  resolution,
  selected,
  saving,
  onToggle,
  onSave,
}: {
  resolution: SharedLinkResolution;
  selected: Set<string>;
  saving: boolean;
  onToggle: (candidate: SharedLinkCandidate) => void;
  onSave: () => void;
}) {
  const selectable = resolution.candidates.filter((candidate) => !candidate.inLibrary);
  const selectedCount = selectable.filter((candidate) =>
    selected.has(candidateKey(candidate)),
  ).length;
  const existingCount = resolution.candidates.length - selectable.length;

  return (
    <div className="border-t border-border/60">
      <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Check the matches
            </h2>
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {resolution.candidates.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {resolution.source.hostname ?? "Shared content"}
            {resolution.source.title ? ` · ${resolution.source.title}` : ""}
          </p>
        </div>
        {resolution.source.url ? (
          <a
            href={resolution.source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open original <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {resolution.warning ? (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning sm:mx-5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {resolution.warning}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pb-5 sm:grid-cols-3 sm:px-5 lg:grid-cols-4">
        {resolution.candidates.map((candidate, index) => {
          const key = candidateKey(candidate);
          const checked = selected.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => onToggle(candidate)}
              disabled={candidate.inLibrary}
              aria-pressed={checked}
              className={cn(
                "group min-w-0 text-left disabled:cursor-default",
                candidate.inLibrary && "opacity-55",
              )}
            >
              <div
                className={cn(
                  "relative aspect-[2/3] overflow-hidden rounded-xl border bg-muted transition-[border-color,transform,box-shadow]",
                  checked
                    ? "border-primary ring-2 ring-primary/35"
                    : "border-border/70 group-hover:border-primary/45",
                  !candidate.inLibrary && "group-active:scale-[0.985]",
                )}
              >
                {candidate.posterPath ? (
                  <Image
                    src={posterUrl(candidate.posterPath, "w342")!}
                    alt=""
                    fill
                    loading={index < 4 ? "eager" : "lazy"}
                    sizes="(max-width: 640px) 43vw, (max-width: 1024px) 28vw, 18vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
                    No poster
                  </span>
                )}
                <span
                  className={cn(
                    "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md",
                    candidate.inLibrary
                      ? "border-white/20 bg-black/65 text-white"
                      : checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/30 bg-black/45 text-white",
                  )}
                >
                  {candidate.inLibrary ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : checked ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </div>
              <h3 className="mt-2 truncate text-sm font-medium text-foreground">
                {candidate.title}
              </h3>
              <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{candidate.year ?? "Year unknown"} · {candidate.mediaType === "tv" ? "Series" : "Film"}</span>
                {candidate.inLibrary ? <span>In slate</span> : null}
              </p>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:static sm:px-5">
        <p className="text-xs text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : existingCount > 0 && selectable.length === 0
              ? "Everything here is already in slate"
              : "Choose at least one title"}
        </p>
        <Button
          type="button"
          onClick={onSave}
          loading={saving}
          disabled={selectedCount === 0}
          className="shrink-0"
          leftIcon={<Plus className="h-4 w-4" />}
        >
          {saving ? "Adding…" : `Add ${selectedCount || ""} to Up Next`}
        </Button>
      </div>
    </div>
  );
}

function SavedState({
  result,
  onAnother,
}: {
  result: AddSharedTitlesResult;
  onAnother: () => void;
}) {
  return (
    <div className="border-t border-border/60 px-5 py-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-success">
        <CheckCircle2 className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-foreground">
        {result.added > 0
          ? `${result.added} ${result.added === 1 ? "title" : "titles"} added`
          : "Already in slate"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {result.failed > 0
          ? `${result.failed} could not be added. The rest are waiting in Up Next.`
          : "They are waiting at the front of Up Next."}
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href={APP_ROOT} className={buttonVariants()}>
          Open watchlist
        </Link>
        <Button type="button" variant="outline" onClick={onAnother}>
          Add another link
        </Button>
      </div>
    </div>
  );
}
