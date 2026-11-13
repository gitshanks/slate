"use client";

import * as React from "react";

export interface ColumnDatum {
  key: string;
  /** Shown in the tooltip, e.g. "Tue 4 Nov". */
  label: string;
  value: number;
}

/**
 * One-series column chart: thin columns on a baseline, a recessive top
 * gridline, and a tooltip on hover or keyboard focus. Every column carries
 * its own label, so screen readers can step through the values.
 */
export function ColumnChart({
  data,
  unit,
  caption,
  startLabel,
  endLabel,
}: {
  data: ColumnDatum[];
  unit: [singular: string, plural: string];
  caption: string;
  startLabel: string;
  endLabel: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const current = active === null ? null : data[active];

  return (
    <figure className="m-0" role="group" aria-label={caption}>
      <div className="relative">
        <div className="flex items-baseline justify-between pb-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span>{max}</span>
          <span aria-live="polite" className="text-foreground">
            {current
              ? `${current.label}: ${current.value} ${current.value === 1 ? unit[0] : unit[1]}`
              : ""}
          </span>
        </div>
        <div
          className="flex h-40 items-end gap-[2px] border-t border-dashed border-border/80"
          onMouseLeave={() => setActive(null)}
        >
          {data.map((d, i) => (
            <div
              key={d.key}
              role="img"
              tabIndex={0}
              aria-label={`${d.label}: ${d.value} ${d.value === 1 ? unit[0] : unit[1]}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group flex h-full min-w-0 flex-1 cursor-default items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={`w-full rounded-t-[4px] ${
                  d.value === 0
                    ? "h-px bg-border"
                    : active === i
                      ? "bg-foreground"
                      : "bg-primary"
                }`}
                style={d.value === 0 ? undefined : { height: `${(d.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-xs text-muted-foreground">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
    </figure>
  );
}
