import * as React from "react";
import { cn } from "@/lib/utils";

/** One labelled list of settings: a quiet label over a single hairlined card. */
export function SettingsGroup({
  label,
  id,
  index = 0,
  className,
  children,
}: {
  label?: string;
  id?: string;
  /** Position on the page, for the staggered entrance. */
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("profile-rise scroll-mt-44", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      {label ? (
        <h2 className="mb-2.5 px-1 text-[13px] font-medium text-muted-foreground">
          {label}
        </h2>
      ) : null}
      <div className="divide-y divide-border/60 overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/50">
        {children}
      </div>
    </section>
  );
}

export const settingsRowClass =
  "flex min-h-[4.5rem] items-center gap-4 px-4 py-3.5 sm:px-5";

export function SettingsRow({
  title,
  description,
  tone = "default",
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: "default" | "danger";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(settingsRowClass, className)}>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] font-medium leading-tight",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      ) : null}
    </div>
  );
}

/** The one secondary control every row uses. */
export const settingsButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13px] font-medium text-foreground outline-none transition-[transform,background-color,color] duration-150 ease-[var(--ease-ui-out)] hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

export const settingsLinkClass =
  "inline-flex h-9 shrink-0 items-center rounded-xl px-2.5 text-[13px] font-medium text-muted-foreground outline-none transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
