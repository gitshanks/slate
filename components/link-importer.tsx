"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  Star,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addSharedTitles, type AddSharedTitlesResult } from "@/lib/share-actions";
import type {
  SharedLinkCandidate,
  SharedLinkInput,
  SharedLinkResolution,
} from "@/lib/shared-link-resolver";
import { useLinkPreview } from "@/components/link-preview-context";
import { DUR, EASE, fadeIn, fadeInUp, staggerContainer } from "@/lib/motion";
import { posterUrl } from "@/lib/tmdb-image";
import { APP_ROOT } from "@/lib/public-mode";
import { cn } from "@/lib/utils";
import { captureAnalytics, countBucket } from "@/lib/analytics";

interface LinkImporterProps {
  initialShare?: SharedLinkInput;
  autoStart?: boolean;
  /** "embedded" drops the outer padding model of the page and fills its
      scroll container, so the action bar can pin to the bottom of a dialog. */
  variant?: "page" | "embedded";
}

type Phase = "idle" | "resolving" | "review" | "saved";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;
// Links that point at one catalogue page resolve to a single title, so the
// loading state can already take the single-title shape.
const SINGLE_TITLE_PATTERN =
  /(imdb\.com\/title\/|themoviedb\.org\/(movie|tv)\/|letterboxd\.com\/film\/|rottentomatoes\.com\/(m|tv)\/|trakt\.tv\/(movies|shows)\/)/i;

// The gathering move on save is the one long motion in the flow; everything
// else uses the shared DUR tokens.
const GATHER = { duration: 0.38, ease: EASE } as const;
const STACK_LIMIT = 5;

function initialDraft(share: SharedLinkInput | undefined): string {
  return share?.url?.trim() || share?.text?.trim() || share?.title?.trim() || "";
}

function candidateKey(candidate: SharedLinkCandidate): string {
  return `${candidate.tmdbId}:${candidate.mediaType}`;
}

interface SourceLabel {
  primary: string;
  rest: string | null;
  url: string | null;
}

function describeSource(value: string): SourceLabel {
  const match = value.match(URL_PATTERN);
  if (match) {
    try {
      const url = new URL(match[0]);
      const path = `${url.pathname}${url.search}`.replace(/\/$/, "");
      return {
        primary: url.hostname.replace(/^www\./, ""),
        rest: path || null,
        url: url.toString(),
      };
    } catch {
      // Fall through to the plain-text label.
    }
  }
  return { primary: value.replace(/\s+/g, " ").trim(), rest: null, url: null };
}

export function LinkImporter({
  initialShare,
  autoStart = false,
  variant = "page",
}: LinkImporterProps) {
  const embedded = variant === "embedded";
  const preview = useLinkPreview();
  const startsResolving = autoStart && Boolean(initialDraft(initialShare));
  const [draft, setDraft] = useState(() => initialDraft(initialShare));
  const [submitted, setSubmitted] = useState(() => initialDraft(initialShare));
  const [phase, setPhase] = useState<Phase>(startsResolving ? "resolving" : "idle");
  const [resolution, setResolution] = useState<SharedLinkResolution | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<AddSharedTitlesResult | null>(null);
  const [saving, startSaving] = useTransition();
  const autoStarted = useRef(false);
  const requestId = useRef(0);
  const focusField = useRef(false);
  const layoutScope = useId();

  const resolveShare = useCallback(async (input: SharedLinkInput) => {
    const request = ++requestId.current;
    setSubmitted(initialDraft(input));
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
      // The link was edited or resubmitted while this one was in flight.
      if (request !== requestId.current) return;
      const defaults = new Set(
        body.candidates
          .filter((candidate) => !candidate.inLibrary)
          .map(candidateKey),
      );
      setResolution(body);
      setSelected(defaults);
      setPhase("review");
      captureAnalytics("shared_link_resolved", {
        source_host: body.source.hostname ?? "unknown",
        candidate_count_bucket: countBucket(body.candidates.length),
        already_saved_count_bucket: countBucket(
          body.candidates.filter((candidate) => candidate.inLibrary).length,
        ),
        has_warning: Boolean(body.warning),
      });
    } catch (reason) {
      if (request !== requestId.current) return;
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

  function submitValue(raw: string) {
    const value = raw.trim();
    if (!value) {
      setError("Paste a link first.");
      return;
    }
    void resolveShare({ url: value, text: value });
  }

  function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitValue(draft);
  }

  async function pasteFromClipboard() {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) throw new Error("Clipboard is empty.");
      setDraft(value);
      setError(null);
      // A link is unambiguous, so it goes straight through. Anything else
      // waits in the field for the person to look at before it is sent.
      if (URL_PATTERN.test(value)) submitValue(value);
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

  function previewCandidate(candidate: SharedLinkCandidate) {
    if (!preview || !resolution) return;
    const key = candidateKey(candidate);
    preview(candidate, {
      // A title added from its card is in slate now, so it leaves the
      // selection here instead of being added twice.
      onClose: (savedFromCard) => {
        if (!savedFromCard) return;
        setResolution((current) =>
          current
            ? {
                ...current,
                candidates: current.candidates.map((item) =>
                  candidateKey(item) === key ? { ...item, inLibrary: true } : item,
                ),
              }
            : current,
        );
        setSelected((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      },
    });
  }

  function setAllSelected(on: boolean) {
    setSelected(
      on
        ? new Set(
            (resolution?.candidates ?? [])
              .filter((candidate) => !candidate.inLibrary)
              .map(candidateKey),
          )
        : new Set(),
    );
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
        captureAnalytics("shared_link_titles_saved", {
          added_count_bucket: countBucket(result.added),
          existing_count_bucket: countBucket(result.existing),
          failed_count_bucket: countBucket(result.failed),
        });
      } catch (reason) {
        toast.error(
          reason instanceof Error ? reason.message : "Those titles could not be added.",
        );
      }
    });
  }

  function editSource() {
    requestId.current += 1;
    focusField.current = true;
    setDraft(submitted);
    setPhase("idle");
  }

  function startOver() {
    focusField.current = true;
    setDraft("");
    setSubmitted("");
    setResolution(null);
    setSelected(new Set());
    setSaveResult(null);
    setError(null);
    setPhase("idle");
  }

  const pad = embedded ? "px-4 sm:px-5" : "";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        embedded && "min-h-full flex-1",
      )}
    >
      {phase === "idle" ? (
        <div className={cn(pad, embedded && "pt-4")}>
          <LinkField
            draft={draft}
            onDraft={setDraft}
            onSubmit={submitDraft}
            onSubmitValue={submitValue}
            onPaste={pasteFromClipboard}
            autoFocus={focusField.current}
          />
          {error ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm leading-snug text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          ) : (
            <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">
              Works with Instagram, YouTube, TikTok, articles, IMDb and TMDB
              links, or the recommendation text itself. slate reads public page
              text, captions, and video descriptions. You choose what gets
              saved.
            </p>
          )}
        </div>
      ) : (
        <SourceRow
          className={cn(pad, embedded ? "pt-3" : "")}
          label={describeSource(submitted)}
          resolution={resolution}
          resolving={phase === "resolving"}
          onEdit={phase === "saved" ? undefined : editSource}
        />
      )}

      {phase === "resolving" ? (
        <ResolvingState
          className={pad}
          single={SINGLE_TITLE_PATTERN.test(submitted)}
          wide={!embedded}
        />
      ) : null}

      {phase === "review" && resolution ? (
        <ReviewState
          className={pad}
          embedded={embedded}
          layoutScope={layoutScope}
          resolution={resolution}
          selected={selected}
          saving={saving}
          onToggle={toggleCandidate}
          onPreview={preview ? previewCandidate : undefined}
          onSelectAll={setAllSelected}
          onSave={saveSelected}
        />
      ) : null}

      {phase === "saved" && saveResult ? (
        <SavedState
          embedded={embedded}
          layoutScope={layoutScope}
          result={saveResult}
          saved={selectedCandidates}
          onAnother={startOver}
        />
      ) : null}
    </div>
  );
}

/* ─── The field ─────────────────────────────────────────────────── */

function LinkField({
  draft,
  onDraft,
  onSubmit,
  onSubmitValue,
  onPaste,
  autoFocus,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSubmitValue: (value: string) => void;
  onPaste: () => void;
  autoFocus: boolean;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const hasDraft = Boolean(draft.trim());

  // The field is one line until the text needs more.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (!autoFocus) return;
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [autoFocus]);

  return (
    <form
      onSubmit={onSubmit}
      data-analytics-form="shared_link_resolve"
      data-analytics-private
    >
      <label htmlFor="shared-link" className="sr-only">
        Link or recommendation text
      </label>
      <div className="flex items-end gap-2 rounded-2xl border border-input bg-card/60 py-2 pl-4 pr-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary/55 focus-within:ring-4 focus-within:ring-primary/10">
        <Link2
          aria-hidden
          className="mb-[11px] h-4 w-4 shrink-0 text-muted-foreground"
        />
        <textarea
          ref={fieldRef}
          id="shared-link"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          onPaste={(event) => {
            // Pasting a link into an empty field is the whole request.
            if (draft.trim()) return;
            const pasted = event.clipboardData.getData("text").trim();
            if (!URL_PATTERN.test(pasted)) return;
            event.preventDefault();
            onDraft(pasted);
            onSubmitValue(pasted);
          }}
          placeholder="Paste a link"
          rows={1}
          maxLength={8_000}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-[7px] text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-[15px]"
        />
        {hasDraft ? (
          <button
            type="submit"
            aria-label="Find titles"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground outline-none transition-[transform,background-color] duration-150 ease-[var(--ease-ui-out)] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.94]"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPaste}
            className="h-9 shrink-0 rounded-xl bg-accent px-3.5 text-sm font-medium text-foreground outline-none transition-[transform,background-color] duration-150 ease-[var(--ease-ui-out)] hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]"
          >
            Paste
          </button>
        )}
      </div>
    </form>
  );
}

/* ─── The source the titles came from ───────────────────────────── */

function SourceRow({
  className,
  label,
  resolution,
  resolving,
  onEdit,
}: {
  className?: string;
  label: SourceLabel;
  resolution: SharedLinkResolution | null;
  resolving: boolean;
  onEdit?: () => void;
}) {
  const sourceTitle = resolution?.source.title?.trim() || null;
  // A direct catalogue link is titled after the film itself, which the result
  // below already says; the address is the more useful label there.
  const title =
    resolution?.candidates.length === 1 &&
    sourceTitle === resolution.candidates[0].title
      ? null
      : sourceTitle;
  const host = resolution?.source.hostname?.replace(/^www\./, "") || null;
  const url = resolution?.source.url ?? label.url;
  const iconButton =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-[transform,background-color,color] duration-150 ease-[var(--ease-ui-out)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94]";

  return (
    <div className={className}>
      <div className="flex items-center gap-3 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-muted-foreground">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {title ?? (
              <>
                {label.primary}
                {label.rest ? (
                  <span className="font-normal text-muted-foreground">
                    {label.rest}
                  </span>
                ) : null}
              </>
            )}
          </p>
          <p
            className={cn(
              "truncate text-xs text-muted-foreground",
              resolving && "loading-breathe",
            )}
            aria-live="polite"
          >
            {resolving
              ? "Looking for films and shows"
              : title
                ? (host ?? label.primary)
                : label.url
                  ? "Link"
                  : "Pasted text"}
          </p>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open original"
            title="Open original"
            className={iconButton}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit link"
            title="Edit link"
            className={iconButton}
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div
        aria-hidden
        className="relative h-px overflow-hidden bg-border/70"
      >
        {resolving ? <span className="link-import-scan" /> : null}
      </div>
    </div>
  );
}

/* ─── Looking ───────────────────────────────────────────────────── */

const GRID =
  "grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 [&>*]:min-w-0";

function ResolvingState({
  className,
  single,
  wide,
}: {
  className?: string;
  single: boolean;
  wide: boolean;
}) {
  if (single) {
    return (
      <div className={cn("flex gap-4 py-5 sm:gap-5", className)} aria-hidden>
        <Skeleton className="aspect-[2/3] w-28 shrink-0 rounded-xl sm:w-36" />
        <div className="min-w-0 flex-1 pt-1">
          <Skeleton shape="text" className="h-5 w-3/5" />
          <Skeleton shape="text" className="mt-3 h-3 w-2/5" />
          <Skeleton shape="text" className="mt-5 h-3 w-full" />
          <Skeleton shape="text" className="mt-2 h-3 w-11/12" />
          <Skeleton shape="text" className="mt-2 h-3 w-3/5" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn("py-5", className)} aria-hidden>
      <Skeleton shape="text" className="mb-4 h-4 w-28" />
      <div className={cn(GRID, wide && "lg:grid-cols-5")}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              index > 5 && "hidden sm:block",
              index > 7 && "hidden",
            )}
          >
            <Skeleton
              className="aspect-[2/3] w-full rounded-xl"
              style={{ animationDelay: `${70 + index * 45}ms` }}
            />
            <Skeleton shape="text" className="mt-2.5 h-3 w-4/5" />
            <Skeleton shape="text" className="mt-1.5 h-2.5 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Choosing ──────────────────────────────────────────────────── */

function Poster({
  candidate,
  sizes,
  eager,
  className,
}: {
  candidate: SharedLinkCandidate;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  return candidate.posterPath ? (
    <Image
      src={posterUrl(candidate.posterPath, "w342")!}
      alt=""
      fill
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "absolute inset-0 flex items-center justify-center px-2 text-center text-xs leading-snug text-muted-foreground",
        className,
      )}
    >
      {candidate.title}
    </span>
  );
}

function mediaLabel(candidate: SharedLinkCandidate): string {
  return candidate.mediaType === "tv" ? "Series" : "Film";
}

function ReviewState({
  className,
  embedded,
  layoutScope,
  resolution,
  selected,
  saving,
  onToggle,
  onPreview,
  onSelectAll,
  onSave,
}: {
  className?: string;
  embedded: boolean;
  layoutScope: string;
  resolution: SharedLinkResolution;
  selected: Set<string>;
  saving: boolean;
  onToggle: (candidate: SharedLinkCandidate) => void;
  onPreview?: (candidate: SharedLinkCandidate) => void;
  onSelectAll: (on: boolean) => void;
  onSave: () => void;
}) {
  const { candidates } = resolution;
  const selectable = candidates.filter((candidate) => !candidate.inLibrary);
  const selectedCount = selectable.filter((candidate) =>
    selected.has(candidateKey(candidate)),
  ).length;
  const existingCount = candidates.length - selectable.length;
  const container = useMemo(
    () => staggerContainer(candidates.length),
    [candidates.length],
  );

  const warning = resolution.warning ? (
    <p className="mb-4 flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-3 text-xs leading-relaxed text-warning">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{resolution.warning}</span>
    </p>
  ) : null;

  if (candidates.length === 1) {
    const candidate = candidates[0];
    return (
      <motion.div
        className={cn("py-5", className)}
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {warning}
        <div className="flex gap-4 sm:gap-5">
          <motion.div
            layoutId={`${layoutScope}-${candidateKey(candidate)}`}
            transition={GATHER}
            style={{ borderRadius: 12 }}
            className="relative aspect-[2/3] w-28 shrink-0 self-start overflow-hidden bg-muted ring-1 ring-inset ring-foreground/10 sm:w-36"
          >
            <Poster candidate={candidate} sizes="144px" eager />
          </motion.div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-xl">
              {candidate.title}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
              {candidate.year ? <span>{candidate.year}</span> : null}
              <span>{mediaLabel(candidate)}</span>
              {candidate.voteAverage ? (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-star text-star" />
                  {candidate.voteAverage.toFixed(1)}
                </span>
              ) : null}
            </p>
            {candidate.overview ? (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:line-clamp-4">
                {candidate.overview}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-auto sm:pt-4">
              {candidate.inLibrary ? (
                <p className="mr-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Already in slate
                </p>
              ) : (
                <Button
                  type="button"
                  onClick={onSave}
                  loading={saving}
                  className="rounded-xl transition-[transform,background-color] active:scale-[0.97]"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  {saving ? "Adding…" : "Add to Up Next"}
                </Button>
              )}
              {onPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onPreview(candidate)}
                  className="rounded-xl transition-[transform,background-color] active:scale-[0.97]"
                >
                  View details
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const allSelected = selectedCount === selectable.length;

  return (
    <>
      <div className={cn("pb-5 pt-4", className)}>
        {warning}
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            {candidates.length} titles found
          </h2>
          {selectable.length > 1 ? (
            <button
              type="button"
              onClick={() => onSelectAll(!allSelected)}
              className="-mr-2 h-8 rounded-lg px-2 text-xs font-medium text-muted-foreground outline-none transition-[transform,background-color,color] duration-150 ease-[var(--ease-ui-out)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
            >
              {allSelected ? "Select none" : "Select all"}
            </button>
          ) : null}
        </div>

        <motion.div
          className={cn(GRID, !embedded && "lg:grid-cols-5")}
          initial="hidden"
          animate="visible"
          variants={container}
        >
          {candidates.map((candidate, index) => {
            const key = candidateKey(candidate);
            const checked = selected.has(key);
            const state = candidate.inLibrary
              ? "owned"
              : checked
                ? "on"
                : "off";
            return (
              <motion.div
                key={key}
                variants={fadeInUp}
                data-state={state}
                className="link-import-tile group"
              >
                <button
                  type="button"
                  onClick={() => onToggle(candidate)}
                  disabled={candidate.inLibrary}
                  aria-pressed={candidate.inLibrary ? undefined : checked}
                  aria-label={
                    candidate.inLibrary
                      ? `${candidate.title}, already in slate`
                      : `Add ${candidate.title}`
                  }
                  className="link-import-toggle group/toggle block w-full text-left outline-none disabled:cursor-default"
                >
                  <div className="link-import-press">
                    <motion.div
                      layoutId={`${layoutScope}-${key}`}
                      transition={GATHER}
                      style={{ borderRadius: 12 }}
                      className="relative aspect-[2/3] overflow-hidden bg-muted ring-1 ring-inset ring-foreground/10 group-focus-visible/toggle:ring-2 group-focus-visible/toggle:ring-ring"
                    >
                      <div className="link-import-art absolute inset-0">
                        <Poster
                          candidate={candidate}
                          eager={index < 8}
                          sizes="(max-width: 640px) 30vw, 160px"
                        />
                      </div>
                      {candidate.inLibrary ? (
                        <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                          <Check className="h-3 w-3" />
                          In slate
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white ring-1 ring-inset ring-white/30 backdrop-blur-md transition-[background-color,color,box-shadow] duration-150 group-data-[state=on]:bg-primary group-data-[state=on]:text-primary-foreground group-data-[state=on]:ring-transparent [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:transition-[opacity,transform] [&>*]:duration-150 [&>*]:ease-[var(--ease-ui-out)]"
                        >
                          <Check
                            className="h-3.5 w-3.5 group-data-[state=off]:scale-75 group-data-[state=off]:opacity-0"
                            strokeWidth={2.75}
                          />
                          <Plus
                            className="h-3.5 w-3.5 group-data-[state=on]:scale-75 group-data-[state=on]:opacity-0"
                            strokeWidth={2.25}
                          />
                        </span>
                      )}
                    </motion.div>
                  </div>
                </button>
                <TileCaption
                  candidate={candidate}
                  onPreview={onPreview ? () => onPreview(candidate) : undefined}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div
        className={cn(
          "sticky bottom-0 z-10 mt-auto flex items-center justify-between gap-4 border-t border-border/70 py-3 backdrop-blur-xl",
          embedded
            ? "bg-popover/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
            : "-mx-4 bg-background/90 px-4 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none",
        )}
      >
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {selectable.length === 0 && existingCount > 0
            ? "Everything here is already in slate"
            : selectedCount > 0
              ? `${selectedCount} of ${selectable.length} selected`
              : "Choose at least one title"}
        </p>
        <Button
          type="button"
          onClick={onSave}
          loading={saving}
          disabled={selectedCount === 0}
          className="shrink-0 rounded-xl transition-[transform,background-color] active:scale-[0.97]"
        >
          {saving ? (
            "Adding…"
          ) : selectedCount === 0 ? (
            "Add to Up Next"
          ) : (
            <>
              Add
              <RollingCount value={selectedCount} />
              to Up Next
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function TileCaption({
  candidate,
  onPreview,
}: {
  candidate: SharedLinkCandidate;
  onPreview?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center gap-0.5">
        <span className="truncate text-[13px] font-medium leading-tight text-foreground transition-colors duration-150 group-data-[state=off]:text-muted-foreground group-data-[state=owned]:text-muted-foreground">
          {candidate.title}
        </span>
        {onPreview ? (
          <ChevronRight
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-[transform,color] duration-150 ease-[var(--ease-ui-out)] group-hover/caption:translate-x-0.5 group-hover/caption:text-foreground"
          />
        ) : null}
      </span>
      <span className="mt-1 flex gap-1.5 truncate text-[11px] leading-tight text-muted-foreground">
        {candidate.year ? <span>{candidate.year}</span> : null}
        <span>{mediaLabel(candidate)}</span>
      </span>
    </>
  );

  if (!onPreview) return <div className="mt-2.5">{body}</div>;
  return (
    <button
      type="button"
      onClick={onPreview}
      aria-label={`View details for ${candidate.title}`}
      className="group/caption -mx-1 mt-1.5 block w-[calc(100%+0.5rem)] rounded-lg px-1 py-1 text-left outline-none transition-[transform,background-color] duration-150 ease-[var(--ease-ui-out)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      {body}
    </button>
  );
}

function RollingCount({ value }: { value: number }) {
  return (
    <span className="relative mx-[0.3em] inline-flex justify-center overflow-hidden tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, transform: "translateY(9px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transform: "translateY(-9px)" }}
          transition={{ duration: DUR.fast, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── Saved ─────────────────────────────────────────────────────── */

function SavedState({
  embedded,
  layoutScope,
  result,
  saved,
  onAnother,
}: {
  embedded: boolean;
  layoutScope: string;
  result: AddSharedTitlesResult;
  saved: SharedLinkCandidate[];
  onAnother: () => void;
}) {
  const stack = saved.slice(0, STACK_LIMIT);
  const extra = saved.length - stack.length;

  return (
    <div
      className={cn(
        "flex flex-col items-center px-5 text-center",
        embedded ? "flex-1 justify-center py-10" : "py-12",
      )}
    >
      <div className="flex items-end justify-center pl-7">
        {stack.map((candidate, index) => (
          <motion.div
            key={candidateKey(candidate)}
            layoutId={`${layoutScope}-${candidateKey(candidate)}`}
            transition={GATHER}
            style={{ borderRadius: 10, zIndex: index }}
            className="relative -ml-7 aspect-[2/3] w-[4.75rem] shrink-0 overflow-hidden bg-muted shadow-xl shadow-black/50 ring-2 ring-background sm:w-[5.5rem]"
          >
            <Poster candidate={candidate} sizes="88px" eager />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        transition={{ delay: 0.16 }}
        className="flex flex-col items-center"
      >
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          {result.added > 0
            ? `${result.added} ${result.added === 1 ? "title" : "titles"} added`
            : "Already in slate"}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {result.failed > 0
            ? `${result.failed} could not be added. The rest are waiting in Up Next.`
            : "They are waiting at the front of Up Next."}
          {extra > 0 ? ` ${extra} more not shown here.` : ""}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href={APP_ROOT}
            className={cn(
              buttonVariants(),
              "rounded-xl transition-[transform,background-color] active:scale-[0.97]",
            )}
          >
            Open watchlist
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={onAnother}
            className="rounded-xl transition-[transform,background-color] active:scale-[0.97]"
          >
            Add another link
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
