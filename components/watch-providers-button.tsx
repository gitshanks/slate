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
}

export function WatchProvidersButton({ providers, link, titleName }: WatchProvidersButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-card/80"
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
