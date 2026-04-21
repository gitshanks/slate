"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { parseAndMatch, confirmImport } from "@/lib/import-actions";
import type { ReviewRow } from "@/lib/import-pipeline";
import { ImportReviewRow } from "@/components/import-review-row";

type Phase = "input" | "review" | "done";

interface DoneSummary {
  inserted: number;
  unmatched: number;
  total: number;
}

/**
 * The `/import` page's interactive core. Three states:
 *
 *   input  — user drops a file or pastes text, hits Analyse
 *   review — table of matched + unmatched rows; user unchecks bad ones, hits Import
 *   done   — summary card with counts + link to the Watched page
 *
 * Selection is tracked as a `Set<string>` of row keys so toggling one row
 * doesn't re-render every other row. Memoised `ImportReviewRow` + stable
 * `onToggle` callback keep editing a 500-row list fluid.
 */
export function ImportWidget() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("input");
  const [pending, startTransition] = React.useTransition();
  const [paste, setPaste] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [parsedCount, setParsedCount] = React.useState(0);
  // Keys of rows currently selected for import. We derive the initial set from
  // `rows` whenever we enter the review phase — rows with a match default to
  // checked, rows with no match can't be checked at all.
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [summary, setSummary] = React.useState<DoneSummary | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Derive counts during render — no effect needed.
  const matchedCount = rows.reduce((n, r) => (r.tmdbId != null ? n + 1 : n), 0);
  const unmatchedCount = rows.length - matchedCount;
  const selectedCount = selected.size;

  // Stable toggle reference so ImportReviewRow's memo actually helps.
  const toggle = React.useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setPaste(text);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function analyse() {
    if (!paste.trim()) return;
    startTransition(async () => {
      try {
        const result = await parseAndMatch(paste, fileName ?? undefined);
        if (result.rows.length === 0) {
          toast.error("Nothing to import — parser found no titles");
          return;
        }
        setRows(result.rows);
        setParsedCount(result.parsedCount);
        // Default-select every row that found a match.
        setSelected(
          new Set(result.rows.filter((r) => r.tmdbId != null).map((r) => r.key))
        );
        setPhase("review");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Parse failed");
      }
    });
  }

  function runImport() {
    if (selectedCount === 0) return;
    startTransition(async () => {
      try {
        const finalRows = rows.map((r) => ({
          ...r,
          selected: selected.has(r.key),
        }));
        const { inserted, unmatchedCount: unmatched } = await confirmImport(
          finalRows
        );
        setSummary({
          inserted,
          unmatched,
          total: rows.length,
        });
        setPhase("done");
        toast.success(`Imported ${inserted} titles`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  function reset() {
    setPhase("input");
    setPaste("");
    setFileName(null);
    setRows([]);
    setParsedCount(0);
    setSelected(new Set());
    setSummary(null);
  }

  // ─── Render ──
  if (phase === "done" && summary) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-6">
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground font-mono">
          Done
        </p>
        <h2 className="mb-4 text-xl font-semibold">
          Imported {summary.inserted}{" "}
          {summary.inserted === 1 ? "title" : "titles"}
        </h2>
        <dl className="mb-6 grid grid-cols-3 gap-4 text-sm">
          <SummaryStat label="Parsed" value={summary.total} />
          <SummaryStat
            label="Unmatched"
            value={summary.unmatched}
            muted={summary.unmatched === 0}
          />
          <SummaryStat label="Saved" value={summary.inserted} />
        </dl>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/watched")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View watched
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-card/80"
          >
            Import another
          </button>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="rounded-xl border border-border bg-card/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
              Review
            </p>
            <p className="text-sm">
              <span className="font-medium">{matchedCount}</span>
              <span className="text-muted-foreground"> matched</span>
              {unmatchedCount > 0 && (
                <>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {unmatchedCount}
                  </span>
                  <span className="text-muted-foreground"> unrecognised</span>
                </>
              )}
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="text-muted-foreground">from {parsedCount} rows</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={reset}
              className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-card/80 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={pending || selectedCount === 0}
              onClick={runImport}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>Import {selectedCount} {selectedCount === 1 ? "title" : "titles"}</>
              )}
            </button>
          </div>
        </div>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
          {rows.map((row) => (
            <ImportReviewRow
              key={row.key}
              row={row}
              checked={selected.has(row.key)}
              onToggle={toggle}
            />
          ))}
        </ul>
      </div>
    );
  }

  // Input phase
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center transition-colors hover:border-primary/40"
      >
        <UploadCloud className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="mb-1 text-sm font-medium">Drop a CSV or paste below</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Netflix viewing activity, Letterboxd diary, IMDb list, Trakt JSON, or
          one title per line.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.json,.txt,text/csv,text/plain,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-card/80"
        >
          <FileText className="h-3.5 w-3.5" />
          Choose file
        </button>
        {fileName && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Loaded <span className="font-mono">{fileName}</span>
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground font-mono">
          Or paste rows
        </label>
        <textarea
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value);
            // Typing clears any previously-loaded filename so format detection
            // uses the text content only.
            if (fileName) setFileName(null);
          }}
          rows={8}
          placeholder={`Breaking Bad\nThe Shawshank Redemption\nBlade Runner 2049`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={pending || !paste.trim()}
          onClick={analyse}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              Analyse
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: number;
  muted?: boolean;
}

function SummaryStat({ label, value, muted }: SummaryStatProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-semibold ${
          muted ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
