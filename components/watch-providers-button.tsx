"use client";

import { useState } from "react";
import Image from "next/image";
import { Tv } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TmdbProvider } from "@/lib/tmdb";
import { TMDB_IMG } from "@/lib/tmdb-image";

// Maps TMDB provider_id → streaming service search URL template (title appended as query).
const PROVIDER_URLS: Record<number, (t: string) => string> = {
  8:    (t) => `https://www.netflix.com/search?q=${t}`,
  9:    (t) => `https://www.amazon.com/s?k=${t}&i=instant-video`,
  10:   (t) => `https://www.amazon.com/s?k=${t}&i=instant-video`,
  15:   (t) => `https://www.hulu.com/search?q=${t}`,
  337:  (t) => `https://www.disneyplus.com/search/${t}`,
  350:  (t) => `https://tv.apple.com/search?term=${t}`,
  384:  (t) => `https://www.max.com/search?q=${t}`,
  1899: (t) => `https://www.max.com/search?q=${t}`,
  386:  (t) => `https://www.peacocktv.com/search?q=${t}`,
  387:  (t) => `https://www.peacocktv.com/search?q=${t}`,
  531:  (t) => `https://www.paramountplus.com/search/${t}/`,
  283:  (t) => `https://www.crunchyroll.com/search?q=${t}`,
  11:   (t) => `https://mubi.com/en/search?q=${t}`,
};

function providerUrl(providerId: number, titleName: string, fallback: string): string {
  const fn = PROVIDER_URLS[providerId];
  return fn ? fn(encodeURIComponent(titleName)) : fallback;
}

interface WatchProvidersButtonProps {
  providers: TmdbProvider[];
  link: string;
  titleName: string;
}

export function WatchProvidersButton({ providers, link, titleName }: WatchProvidersButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
        title="Where to watch"
      >
        <Tv className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          {providers.slice(0, 4).map((p) => (
            <Image
              key={p.provider_id}
              src={`${TMDB_IMG}/w45${p.logo_path}`}
              alt={p.provider_name}
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
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-sm font-semibold">Where to watch</DialogTitle>
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
