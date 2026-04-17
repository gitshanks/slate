"use client";

import { useState } from "react";
import Image from "next/image";
import { Tv, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TmdbProvider } from "@/lib/tmdb";
import { TMDB_IMG } from "@/lib/tmdb-image";

interface WatchProvidersButtonProps {
  providers: TmdbProvider[];
  link: string;
}

export function WatchProvidersButton({ providers, link }: WatchProvidersButtonProps) {
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
              <div
                key={p.provider_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5"
              >
                <Image
                  src={`${TMDB_IMG}/w92${p.logo_path}`}
                  alt={p.provider_name}
                  width={36}
                  height={36}
                  className="rounded-lg"
                />
                <span className="text-sm font-medium">{p.provider_name}</span>
              </div>
            ))}
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            View all options on JustWatch
            <ExternalLink className="h-3 w-3" />
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
