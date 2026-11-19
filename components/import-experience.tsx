"use client";

import * as React from "react";
import Link from "next/link";
import { importBatch, type ImportedTitle } from "@/lib/import-actions";
import { IMPORT_BATCH_LIMIT, parseCsv, type ParsedRow } from "@/lib/import-parse";
import { posterUrl } from "@/lib/tmdb-image";
import { APP_ROOT } from "@/lib/public-mode";
import { captureAnalytics, countBucket } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/*
 * The import page as one stage: a receding wall of empty poster frames that
 * the user's own history fills, poster by poster, as it is matched.
 *
 *   idle      the empty wall, leaning gently toward the pointer
 *   dragging  a file is over the window: the wall lifts and flattens
 *   ready     the file is read in the browser; its size lands as one numeral
 *   importing rows go to the server in batches; each batch's posters land in
 *             the next frames and the wall climbs as rows fill
 *   done      the wall eases flat; the count holds
 *   stopped   a batch failed; everything before it is saved, retry resumes
 */

const BATCH = Math.min(24, IMPORT_BATCH_LIMIT);
const MAX_BYTES = 5 * 1024 * 1024;

type Phase =
  | { kind: "idle"; error?: string }
  | { kind: "ready"; fileName: string; rows: ParsedRow[] }
  | { kind: "importing"; fileName: string; rows: ParsedRow[] }
  | { kind: "done"; fileName: string; rows: ParsedRow[] }
  | { kind: "stopped"; fileName: string; rows: ParsedRow[]; at: number; error: string };

interface Tile {
  key: string;
  title: string;
  poster: string | null;
  /** When the poster may appear, so a batch lands as a cascade. */
  revealAt: number;
}

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const format = (n: number) => n.toLocaleString("en-US");

// ─── Counting numeral ─────────────────────────────────────────────────────

/** A number that runs to its new value instead of jumping. */
function useRunningNumber(target: number, restartFrom: number | null, stage: string) {
  const [shown, setShown] = React.useState(target);
  const from = React.useRef(target);
  const current = React.useRef(target);
  const lastStage = React.useRef(stage);

  React.useEffect(() => {
    // A new step that counts something new starts from its own zero instead
    // of running down from the last step's number.
    if (stage !== lastStage.current) {
      lastStage.current = stage;
      if (restartFrom != null) current.current = restartFrom;
    }
    if (reduced()) {
      current.current = target;
      setShown(target);
      return;
    }
    from.current = current.current;
    const start = performance.now();
    const distance = target - from.current;
    const duration = Math.min(900, 380 + Math.abs(distance) * 4);
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const value = Math.round(from.current + distance * eased);
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, restartFrom, stage]);

  return shown;
}

// ─── The wall ─────────────────────────────────────────────────────────────

interface Geometry {
  width: number;
  height: number;
  cols: number;
  gap: number;
  pad: number;
  tileW: number;
  tileH: number;
}

function measure(width: number, height: number): Geometry {
  const narrow = width < 520;
  const cols = narrow ? 5 : Math.min(Math.max(Math.round(width / 104), 6), 11);
  const gap = narrow ? 8 : 12;
  const pad = narrow ? 14 : 28;
  const tileW = (width - pad * 2 - gap * (cols - 1)) / cols;
  return { width, height, cols, gap, pad, tileW, tileH: tileW * 1.5 };
}

const TILT: Record<Phase["kind"] | "dragging", number> = {
  idle: 28,
  dragging: 12,
  ready: 20,
  importing: 22,
  stopped: 22,
  done: 9,
};

function PosterFrame({ tile }: { tile: Tile }) {
  const art = React.useRef<HTMLElement | null>(null);

  const reveal = React.useCallback(() => {
    const node = art.current;
    if (!node) return;
    const wait = Math.max(0, tile.revealAt - performance.now());
    const play = () => {
      node.style.opacity = "1";
      if (reduced()) return;
      node.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(1.06)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 620, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" },
      );
    };
    if (wait > 0) window.setTimeout(play, wait);
    else play();
  }, [tile.revealAt]);

  // A title without a poster arrives as its name, on the same beat.
  React.useEffect(() => {
    if (!tile.poster) reveal();
  }, [tile.poster, reveal]);

  const src = posterUrl(tile.poster, "w185");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(node) => {
        art.current = node;
      }}
      src={src}
      alt={tile.title}
      title={tile.title}
      data-image-arrival="off"
      decoding="async"
      draggable={false}
      onLoad={reveal}
      onError={reveal}
      style={{ opacity: 0 }}
      className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
    />
  ) : (
    <span
      ref={(node) => {
        art.current = node;
      }}
      style={{ opacity: 0 }}
      className="absolute inset-0 grid place-items-center rounded-[inherit] bg-foreground/[0.07] p-1.5 text-center text-[10px] font-medium leading-tight text-muted-foreground"
    >
      {tile.title}
    </span>
  );
}

function Wall({
  tiles,
  phase,
  dragging,
}: {
  tiles: Tile[];
  phase: Phase["kind"];
  dragging: boolean;
}) {
  const frame = React.useRef<HTMLDivElement>(null);
  const lean = React.useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = React.useState<Geometry | null>(null);

  React.useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const update = () => setGeometry(measure(node.clientWidth, node.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // On a pointer, the wall leans a few degrees toward it, eased so it drifts
  // rather than tracks.
  React.useEffect(() => {
    const node = frame.current;
    const target = lean.current;
    if (!node || !target || reduced()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let aimX = 0;
    let aimY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const tick = () => {
      x += (aimX - x) * 0.06;
      y += (aimY - y) * 0.06;
      target.style.transform = `rotateY(${(x * 4).toFixed(3)}deg) rotateX(${(-y * 2).toFixed(3)}deg)`;
      raf = Math.abs(aimX - x) + Math.abs(aimY - y) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      aimX = ((event.clientX - box.left) / box.width - 0.5) * 2;
      aimY = ((event.clientY - box.top) / box.height - 0.5) * 2;
      kick();
    };
    const onLeave = () => {
      aimX = 0;
      aimY = 0;
      kick();
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const g = geometry;
  const rowH = g ? g.tileH + g.gap : 0;
  const rowsInView = g ? Math.ceil(g.height / Math.max(rowH, 1)) + 1 : 0;
  // The row being filled sits a little above the middle, clear of the words
  // at the bottom; the wall climbs to keep it there, so earlier rows recede.
  // Once it is all in, the last row drops lower so more of the wall shows.
  const anchor = Math.max(1, Math.floor(rowsInView * (phase === "done" ? 0.44 : 0.34)));
  const filling = g ? Math.floor(tiles.length / g.cols) : 0;
  const shift = filling - anchor;
  const first = shift - 4;
  const last = shift + rowsInView + 2;

  const slots: React.ReactNode[] = [];
  if (g) {
    for (let row = first; row <= last; row += 1) {
      for (let col = 0; col < g.cols; col += 1) {
        const index = row * g.cols + col;
        const tile = index >= 0 ? tiles[index] : undefined;
        slots.push(
          <div
            key={`slot-${index}`}
            className="absolute overflow-hidden rounded-[10px] bg-foreground/[0.045] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]"
            style={{
              width: g.tileW,
              height: g.tileH,
              transform: `translate3d(${g.pad + col * (g.tileW + g.gap)}px, ${row * rowH}px, 0)`,
            }}
          >
            {tile ? <PosterFrame tile={tile} /> : null}
          </div>,
        );
      }
    }
  }

  const tilt = dragging ? TILT.dragging : TILT[phase];

  return (
    <div
      ref={frame}
      aria-hidden
      className="pointer-events-auto absolute inset-0 [perspective:1100px] [perspective-origin:50%_0%]"
    >
      <div
        className="absolute inset-0 transition-transform duration-[1200ms] ease-[var(--ease-ui-move)] [transform-origin:50%_70%] [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: `rotateX(${tilt}deg) scale(${dragging ? 1.02 : 1})` }}
      >
        <div ref={lean} className="absolute inset-0 [transform-style:preserve-3d]">
          <div
            className="absolute inset-x-0 top-0 transition-transform duration-[900ms] ease-[var(--ease-ui-move)] will-change-transform motion-reduce:transition-none"
            style={{ transform: `translate3d(0, ${(-shift * rowH + (g?.gap ?? 0)).toFixed(2)}px, 0)` }}
          >
            {slots}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── The stage ────────────────────────────────────────────────────────────

const pill =
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-medium outline-none transition-[transform,background-color,opacity] duration-150 ease-[var(--ease-ui-out)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 sm:h-10";
const primary = cn(pill, "bg-primary text-primary-foreground hover:bg-[hsl(var(--primary-hover))]");
const quiet = cn(pill, "bg-foreground/[0.07] text-foreground hover:bg-foreground/[0.11]");

function FilePicker({
  onFile,
  className,
  children,
}: {
  onFile: (file: File) => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn(className, "cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card")}>
      {children}
      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

export function ImportExperience() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const [tiles, setTiles] = React.useState<Tile[]>([]);
  const [processed, setProcessed] = React.useState(0);
  const [unmatched, setUnmatched] = React.useState<string[]>([]);
  const [matching, setMatching] = React.useState<string[]>([]);
  const seen = React.useRef(new Set<string>());
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const busy = phase.kind === "importing";

  const adopt = React.useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setPhase({ kind: "idle", error: "That file is over 5 MB. Split it and import each part." });
      return;
    }
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      setPhase({
        kind: "idle",
        error: "No titles in that file. Use a CSV with a Title or Name column.",
      });
      return;
    }
    seen.current = new Set();
    setTiles([]);
    setProcessed(0);
    setUnmatched([]);
    setPhase({ kind: "ready", fileName: file.name, rows });
  }, []);

  // A file dragged anywhere over the window is for this page.
  React.useEffect(() => {
    if (busy) return;
    let depth = 0;
    const hasFile = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const enter = (event: DragEvent) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const leave = (event: DragEvent) => {
      if (!hasFile(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) void adopt(file);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [busy, adopt]);

  const run = React.useCallback(
    async (fileName: string, rows: ParsedRow[], from: number) => {
      setPhase({ kind: "importing", fileName, rows });
      let lost: string[] = [];
      for (let at = from; at < rows.length; at += BATCH) {
        if (!alive.current) return;
        const slice = rows.slice(at, at + BATCH);
        setMatching(slice.slice(0, 3).map((row) => row.sourceText || row.title));
        let result = await importBatch(slice).catch(() => null);
        if (!result?.ok) result = await importBatch(slice).catch(() => null);
        if (!alive.current) return;
        if (!result?.ok) {
          setPhase({
            kind: "stopped",
            fileName,
            rows,
            at,
            error: result?.error ?? "The connection dropped.",
          });
          return;
        }
        const landed = performance.now() + 60;
        const fresh: Tile[] = [];
        for (const title of result.titles as ImportedTitle[]) {
          const key = `${title.media_type}:${title.tmdb_id}`;
          if (seen.current.has(key)) continue;
          seen.current.add(key);
          fresh.push({
            key,
            title: title.year ? `${title.title} (${title.year})` : title.title,
            poster: title.poster_path,
            revealAt: landed + fresh.length * 38,
          });
        }
        lost = lost.concat(result.unmatched);
        setTiles((current) => current.concat(fresh));
        setUnmatched(lost.slice());
        setProcessed(Math.min(at + slice.length, rows.length));
      }
      setMatching([]);
      setPhase({ kind: "done", fileName, rows });
      captureAnalytics("import_completed", {
        imported_bucket: countBucket(seen.current.size),
        unmatched_bucket: countBucket(lost.length),
        had_unmatched: lost.length > 0,
      });
    },
    [],
  );

  const reset = () => {
    seen.current = new Set();
    setTiles([]);
    setProcessed(0);
    setUnmatched([]);
    setPhase({ kind: "idle" });
  };

  const total = "rows" in phase ? phase.rows.length : 0;
  const matched = tiles.length;
  const big = useRunningNumber(
    phase.kind === "ready" ? total : phase.kind === "idle" ? 0 : matched,
    phase.kind === "ready" || phase.kind === "importing" ? 0 : null,
    phase.kind,
  );

  return (
    <div data-analytics-private>
      <div
        className={cn(
          "relative isolate h-[max(400px,calc(100svh-18.5rem))] overflow-clip sm:h-[min(74svh,660px)] sm:min-h-[460px] rounded-[28px] bg-card shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-[box-shadow,transform] duration-500 ease-[var(--ease-ui-out)] motion-reduce:transition-none",
          dragging && "scale-[1.008] shadow-[inset_0_0_0_2px_hsl(var(--primary))]",
        )}
      >
        <Wall tiles={tiles} phase={phase.kind} dragging={dragging} />

        {/* The wall fades into the distance at the top and under the words. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,hsl(var(--card))_0%,hsl(var(--card)/0)_26%,hsl(var(--card)/0)_44%,hsl(var(--card)/0.92)_70%,hsl(var(--card))_86%)]"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <div aria-live="polite" className="pointer-events-auto">
            <Stage
              key={phase.kind + (dragging ? "-drag" : "")}
              phase={phase}
              dragging={dragging}
              big={big}
              total={total}
              processed={processed}
              matching={matching}
              onFile={adopt}
              onStart={() => {
                if (phase.kind === "ready") void run(phase.fileName, phase.rows, 0);
              }}
              onResume={() => {
                if (phase.kind === "stopped") void run(phase.fileName, phase.rows, phase.at);
              }}
              onReset={reset}
            />
          </div>
        </div>
      </div>

      {phase.kind === "done" && unmatched.length > 0 ? (
        <details className="group mt-6 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none list-none text-foreground/80 transition-colors hover:text-foreground">
            {`${format(unmatched.length)} ${unmatched.length === 1 ? "row" : "rows"} couldn’t be matched`}
            <span className="ml-1.5 inline-block transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 columns-1 gap-8 text-xs leading-6 sm:columns-2 lg:columns-3">
            {unmatched.slice(0, 120).map((row, index) => (
              <li key={index} className="truncate">
                {row}
              </li>
            ))}
            {unmatched.length > 120 ? <li>and {format(unmatched.length - 120)} more</li> : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Stage({
  phase,
  dragging,
  big,
  total,
  processed,
  matching,
  onFile,
  onStart,
  onResume,
  onReset,
}: {
  phase: Phase;
  dragging: boolean;
  big: number;
  total: number;
  processed: number;
  matching: string[];
  onFile: (file: File) => void;
  onStart: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  const numeral = (
    <p className="text-[clamp(5rem,19vw,10rem)] font-extralight leading-[0.86] tracking-[-0.04em] text-primary tabular-nums">
      {format(big)}
    </p>
  );
  const enter = "import-stage-in";

  if (dragging) {
    return (
      <div className={enter}>
        <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">Let go.</h2>
        <p className="mt-3 text-base text-muted-foreground">We&rsquo;ll read it right here.</p>
      </div>
    );
  }

  if (phase.kind === "idle") {
    return (
      <div className={cn(enter, "max-w-xl")}>
        <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="[@media(hover:hover)_and_(pointer:fine)]:hidden">Bring your history.</span>
          <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">Drop your history here.</span>
        </h2>
        <p className="mt-3 text-pretty text-base text-muted-foreground">
          Your Letterboxd, IMDb or Trakt export. Every title lands on your slate, posters and all.
        </p>
        {phase.error ? <p className="mt-3 text-sm text-destructive">{phase.error}</p> : null}
        <div className="mt-6 grid grid-cols-1 sm:flex">
          <FilePicker onFile={onFile} className={primary}>
            Choose a CSV
          </FilePicker>
        </div>
      </div>
    );
  }

  if (phase.kind === "ready") {
    return (
      <div className={enter}>
        {numeral}
        <p className="mt-3 truncate text-base text-muted-foreground">
          titles in <span className="text-foreground">{phase.fileName}</span>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={onStart} className={primary}>
            Bring them in
          </button>
          <FilePicker onFile={onFile} className={quiet}>
            Another file
          </FilePicker>
        </div>
      </div>
    );
  }

  if (phase.kind === "importing") {
    return (
      <div className={enter}>
        <div className="flex items-baseline gap-4">
          {numeral}
          <span className="text-lg text-muted-foreground tabular-nums">of {format(total)}</span>
        </div>
        <p className="mt-3 truncate text-base text-muted-foreground">
          {matching.length ? `Matching ${matching.join(", ")}…` : "Matching…"}
        </p>
        {/* Progress through the file, as a hairline under everything. */}
        <div className="mt-6 h-px w-full overflow-hidden bg-foreground/10">
          <div
            className="h-full origin-left bg-primary transition-transform duration-700 ease-[var(--ease-ui-out)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${total ? processed / total : 0})` }}
          />
        </div>
      </div>
    );
  }

  if (phase.kind === "stopped") {
    return (
      <div className={enter}>
        {numeral}
        <p className="mt-3 text-base text-muted-foreground">
          Stopped at {format(phase.at)} of {format(total)}. Everything above is saved.
        </p>
        <p className="mt-1 truncate text-sm text-destructive">{phase.error}</p>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={onResume} className={primary}>
            Carry on
          </button>
          <button type="button" onClick={onReset} className={quiet}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className={enter}>
      {numeral}
      <p className="mt-3 text-base text-muted-foreground">
        {big === 1 ? "title is" : "titles are"} on your slate.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
        <Link href={APP_ROOT} className={primary}>
          Open library
        </Link>
        <button type="button" onClick={onReset} className={quiet}>
          Import another
        </button>
      </div>
    </div>
  );
}
