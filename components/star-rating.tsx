"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
}

/**
 * Half-star input. Click left half = .5, right half = full.
 * Click the same value again to clear. Keyboard: ←/→ to step.
 */
export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
  className,
}: StarRatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const display = hover ?? value ?? 0;

  function handleClick(rating: number) {
    if (!onChange) return;
    if (value === rating) onChange(null);
    else onChange(rating);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!onChange || readOnly) return;
    const current = value ?? 0;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(Math.min(5, current + 0.5));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(Math.max(0, current - 0.5));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      onChange(null);
    }
  }

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role={readOnly ? "img" : "slider"}
      aria-label="Rating"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value ?? 0}
      tabIndex={readOnly ? -1 : 0}
      onKeyDown={handleKey}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = display >= i;
        const half = display >= i - 0.5 && display < i;
        return (
          <span
            key={i}
            className="relative inline-flex"
            style={{ width: size, height: size }}
          >
            <Star
              className="absolute inset-0 text-muted-foreground/40"
              style={{ width: size, height: size }}
            />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: half ? size / 2 : size, height: size }}
              >
                <Star
                  className="text-[hsl(var(--star))] fill-[hsl(var(--star))]"
                  style={{ width: size, height: size }}
                />
              </span>
            )}
            {!readOnly && (
              <>
                <button
                  type="button"
                  aria-label={`${i - 0.5} stars`}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(i - 0.5)}
                  onClick={() => handleClick(i - 0.5)}
                />
                <button
                  type="button"
                  aria-label={`${i} stars`}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => handleClick(i)}
                />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
