"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ExternalLink, Tv } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TmdbProvider } from "@/lib/tmdb";
import { TMDB_IMG } from "@/lib/tmdb-image";
import { ActionRow } from "@/components/action-row";

// Maps TMDB provider_id → streaming service search URL template (title appended as query).
const PROVIDER_URLS: Record<number, (t: string) => string> = {
  2:    (t) => `https://tv.apple.com/search?term=${t}`,
  3:    (t) => `https://play.google.com/store/search?q=${t}&c=movies`,
  7:    (t) => `https://www.vudu.com/content/browse/list?searchTerm=${t}`,
  8:    (t) => `https://www.netflix.com/search?q=${t}`,
  9:    (t) => `https://www.amazon.com/s?k=${t}&i=instant-video`,
  10:   (t) => `https://www.amazon.com/s?k=${t}&i=instant-video`,
  11:   (t) => `https://mubi.com/films/search?query=${t}`,
  15:   (t) => `https://www.hulu.com/search?q=${t}`,
  68:   (t) => `https://www.microsoft.com/en-us/search?q=${t}`,
  99:   (t) => `https://www.shudder.com/search?q=${t}`,
  188:  (t) => `https://www.youtube.com/results?search_query=${t}`,
  192:  (t) => `https://www.youtube.com/results?search_query=${t}`,
  257:  (t) => `https://www.fubo.tv/welcome/search/${t}`,
  283:  (t) => `https://www.crunchyroll.com/search?q=${t}`,
  337:  (t) => `https://www.disneyplus.com/search?q=${t}`,
  350:  (t) => `https://tv.apple.com/search?term=${t}`,
  363:  (t) => `https://www.hoopladigital.com/search?q=${t}`,
  372:  (t) => `https://www.discoveryplus.com/search?q=${t}`,
  384:  (t) => `https://play.max.com/search?q=${t}`,
  386:  (t) => `https://www.peacocktv.com/search?q=${t}`,
  387:  (t) => `https://www.peacocktv.com/search?q=${t}`,
  465:  (t) => `https://www.amcplus.com/search?q=${t}`,
  531:  (t) => `https://www.paramountplus.com/search/?q=${t}`,
  1715: (t) => `https://www.amazon.com/s?k=${t}&i=instant-video`,
  1796: (t) => `https://www.netflix.com/search?q=${t}`,
  1899: (t) => `https://play.max.com/search?q=${t}`,
};

function providerUrl(providerId: number, titleName: string, fallback: string): string {
  const fn = PROVIDER_URLS[providerId];
  return fn ? fn(encodeURIComponent(titleName)) : fallback;
}

interface WatchProvidersButtonProps {
  providers: TmdbProvider[];
  link: string;
  titleName: string;
  /** "pill" (default, desktop row) or "row" (mobile More sheet). */
  variant?: "pill" | "row";
  /** Keep title-card inspectors self-contained while full pages retain a dialog. */
  presentation?: "dialog" | "inline";
}

export function WatchProvidersButton({
  providers,
  link,
  titleName,
  variant = "pill",
  presentation = "dialog",
}: WatchProvidersButtonProps) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const regionRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      window.requestAnimationFrame(() => {
        regionRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  };

  const trigger =
    variant === "row" ? (
      <ActionRow
        icon={<Tv className="h-[18px] w-[18px]" />}
        label="Where to watch"
        onClick={presentation === "inline" ? toggle : () => setOpen(true)}
        trailing={
          <span className="flex shrink-0 items-center gap-1">
            {providers.slice(0, 3).map((p) => (
              <Image
                key={p.provider_id}
                src={`${TMDB_IMG}/w45${p.logo_path}`}
                alt={p.provider_name}
                width={22}
                height={22}
                className="rounded-md ring-1 ring-border/50"
                title={p.provider_name}
              />
            ))}
            {providers.length > 3 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                +{providers.length - 3}
              </span>
            )}
          </span>
        }
      />
    ) : (
      <button
        type="button"
        onClick={presentation === "inline" ? toggle : () => setOpen(true)}
        aria-label="Where to watch"
        aria-expanded={presentation === "inline" ? open : undefined}
        aria-controls={presentation === "inline" ? regionId : undefined}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium transition-[border-color,background-color,color,transform] hover:border-primary/40 hover:bg-card/80 active:scale-[0.98]"
        title="Where to watch"
      >
        <Tv className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          {providers.slice(0, 4).map((p) => (
            <Image
              key={p.provider_id}
              src={`${TMDB_IMG}/w45${p.logo_path}`}
              alt=""
              width={20}
              height={20}
              className="rounded-sm"
              title={p.provider_name}
            />
          ))}
        </span>
        {providers.length > 4 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            +{providers.length - 4}
          </span>
        )}
        {presentation === "inline" ? (
          <ChevronDown
            aria-hidden
            className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        ) : null}
      </button>
    );

  if (presentation === "inline") {
    return (
      <div className="contents">
        {trigger}
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={regionId}
              ref={regionRef}
              role="region"
              aria-label="Where to watch"
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
              className="min-w-0 basis-full overflow-hidden"
            >
              <div className="mt-1 rounded-2xl border border-primary/15 bg-background/45 p-2 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 px-1 pb-2 pt-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    Where to watch
                  </span>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    All options
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                  </a>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {providers.map((provider) => (
                    <a
                      key={provider.provider_id}
                      href={providerUrl(provider.provider_id, titleName, link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-w-0 items-center gap-2 rounded-xl border border-border/80 bg-card/60 p-2 transition-[border-color,background-color,transform] hover:border-primary/30 hover:bg-card active:scale-[0.99]"
                    >
                      <Image
                        src={`${TMDB_IMG}/w92${provider.logo_path}`}
                        alt=""
                        width={30}
                        height={30}
                        className="h-[30px] w-[30px] shrink-0 rounded-lg ring-1 ring-border/45"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {provider.provider_name}
                      </span>
                      <ExternalLink
                        aria-hidden
                        className="h-3 w-3 shrink-0 text-muted-foreground/55 transition-colors group-hover:text-primary"
                      />
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[50%] translate-y-[-50%] left-[50%] translate-x-[-50%] right-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl p-4">
          <DialogTitle className="pr-6 text-sm font-semibold">Where to watch</DialogTitle>
          <div className="mt-1 grid grid-cols-1 gap-2">
            {providers.map((p) => (
              <a
                key={p.provider_id}
                href={providerUrl(p.provider_id, titleName, link)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <Image
                  src={`${TMDB_IMG}/w92${p.logo_path}`}
                  alt={p.provider_name}
                  width={36}
                  height={36}
                  className="rounded-lg"
                />
                <span className="text-sm font-medium">{p.provider_name}</span>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
