"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Check, AlertTriangle, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runImport, type ImportResult } from "@/lib/import-actions";

/**
 * Single-form library-import widget.
 *
 * Wraps the `runImport` server action with `useActionState` so the form
 * submit + result render round-trip is one hook, no manual fetch/loading
 * state. File stays in a native <input type="file"> — we only track the
 * *name* in React state for the visual affordance on the drop zone.
 */
export function ImportWidget() {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(
    runImport,
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    setFileName(null);
  }

  function adoptFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    // Wire the dropped file into the native input so the server action
    // gets it via FormData on submit.
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setFileName(f.name);
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          adoptFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver
            ? "border-primary/60 bg-accent/40"
            : "border-border hover:bg-accent/30"
        )}
      >
        {fileName ? (
          <>
            <FileText className="mb-3 h-7 w-7 text-muted-foreground" />
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-mono">{fileName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearFile();
                }}
                aria-label="Remove file"
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ready to import
            </div>
          </>
        ) : (
          <>
            <Upload className="mb-3 h-7 w-7 text-muted-foreground" />
            <div className="text-sm text-foreground">
              Drop a CSV, or click to choose one
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Letterboxd · Trakt · any CSV with a Title/Name column
            </div>
          </>
        )}
        <input
          ref={inputRef}
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          required
        />
      </label>

      {/* Submit only shows once a file is staged — no orphan disabled button
          floating in its own row before the user picks anything. Full-width
          on mobile, auto-width on sm+ aligned to the right of the form. */}
      {fileName && (
        <div className="sm:flex sm:justify-end">
          <Button
            type="submit"
            loading={pending}
            className="w-full sm:w-auto"
          >
            {pending ? "Matching on TMDB…" : "Import to library"}
          </Button>
        </div>
      )}

      {state?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state?.ok && <Result result={state} />}
    </form>
  );
}

function Result({ result }: { result: ImportResult }) {
  const { imported, unmatched } = result;
  const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/40 px-5 py-4">
      <div className="flex items-center gap-2 text-sm">
        <Check className="h-4 w-4 text-emerald-400" />
        <span>
          <strong className="text-foreground">{plural(imported, "title")}</strong>{" "}
          matched and saved to your library
          {unmatched.length > 0 && (
            <>
              , <strong className="text-foreground">{plural(unmatched.length, "row")}</strong>{" "}
              couldn&rsquo;t be matched
            </>
          )}
          .
        </span>
      </div>
      {unmatched.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            See unmatched rows
          </summary>
          <ul className="mt-2 space-y-1 font-mono">
            {unmatched.slice(0, 50).map((s, i) => (
              <li key={i} className="truncate">
                {s}
              </li>
            ))}
            {unmatched.length > 50 && (
              <li className="italic">
                …and {unmatched.length - 50} more
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
