"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Info,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { AddTitleToListButton } from "@/components/add-title-to-list-button";
import { useDiscoverTitleOverlay } from "@/components/discover-title-overlay-context";
import { StatusPill } from "@/components/status-pill";
import {
  titleFor,
  yearFor,
  primaryGenre,
  SOURCE_LABELS,
  SOURCE_TONES,
} from "@/lib/preview-display";
import { posterUrl } from "@/lib/tmdb-image";
import type { TmdbPreviewItem } from "@/lib/tmdb";
import type { TitleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SavedRecord {
  id: string;
  status: TitleStatus;
}

function PreviewPlayer({
  item,
  index,
  playing,
  failed,
  priority,
  onPlay,
  player,
}: {
  item: TmdbPreviewItem;
  index: number;
  playing: boolean;
  failed: boolean;
  priority: boolean;
  onPlay: () => void;
  player?: React.ReactNode;
}) {
  const name = titleFor(item);

  return (
    <div className="relative z-10 isolate flex h-full min-h-[12.5rem] w-full items-center justify-center overflow-hidden bg-transparent [container-type:size]">
      <div
        data-preview-player-index={index}
        className={cn(
          "preview-player-frame relative z-10 overflow-hidden rounded-2xl bg-black",
          item.orientationHint === "portrait"
            ? "preview-player-portrait"
            : "preview-player-landscape",
        )}
      >
        {player ? (
          <div
            className="pointer-events-none absolute inset-0 z-20"
            style={{ visibility: playing ? "visible" : "hidden" }}
          >
            {player}
          </div>
        ) : null}
        {!playing && failed ? (
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.videoKey)}`}
            target="_blank"
            rel="noreferrer"
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Watch ${name} trailer on YouTube`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-50"
                priority={priority}
              />
            ) : null}
            <span className="relative inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 text-xs font-semibold text-white shadow-xl">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Watch on YouTube
            </span>
          </a>
        ) : !playing ? (
          <button
            type="button"
            onClick={onPlay}
            className="group relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden bg-black/35 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            aria-label={`Play ${name} trailer`}
          >
            {posterUrl(item.poster_path) ? (
              <Image
                src={posterUrl(item.poster_path)!}
                alt=""
                fill
                sizes="(max-width: 767px) 80vw, 28rem"
                className="object-cover opacity-55 transition-opacity duration-200 group-hover:opacity-65 motion-reduce:transition-none"
                priority={priority}
              />
            ) : null}
            <span className="relative grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl">
              <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SaveControl({
  item,
  record,
  ensureSaved,
  onStatusChange,
  onMenuOpenChange,
}: {
  item: TmdbPreviewItem;
  record: SavedRecord | undefined;
  ensureSaved: () => Promise<string>;
  onStatusChange: (status: TitleStatus) => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  if (record) {
    return (
      <StatusPill
        titleId={record.id}
        status={record.status}
        onStatusChange={onStatusChange}
        onOpenChange={onMenuOpenChange}
        triggerClassName="h-11 shrink-0 px-4 font-semibold"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await ensureSaved();
            toast.success(`${titleFor(item)} is in your library`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not add title",
            );
          }
        });
      }}
      className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_12px_32px_-18px_hsl(var(--primary))] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 max-[359px]:w-11 max-[359px]:px-0 motion-reduce:active:scale-100"
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      <span className="max-[359px]:sr-only">
        {pending ? "Adding…" : "Up Next"}
      </span>
    </button>
  );
}

export function PreviewSlide({
  item,
  index,
  selected,
  playerVisible,
  playbackFailed,
  playerReady,
  soundReady = playerReady,
  playbackEnabled,
  soundEnabled,
  account,
  saveHref,
  player,
  onEnablePlayback,
  detailsId,
  detailExpanded,
  onTogglePlayback,
  onToggleSound,
  onDetail,
}: {
  item: TmdbPreviewItem;
  index: number;
  selected: boolean;
  playerVisible: boolean;
  playbackFailed: boolean;
  playerReady: boolean;
  soundReady?: boolean;
  playbackEnabled: boolean;
  soundEnabled: boolean;
  account?: {
    lists: { id: string; name: string }[];
    savedRecord: SavedRecord | undefined;
    ensureSaved: () => Promise<string>;
    onStatusChange: (status: TitleStatus) => void;
    onListIntent: () => void;
    onMenuOpenChange: (open: boolean) => void;
  };
  saveHref?: string;
  player?: React.ReactNode;
  detailsId?: string;
  detailExpanded?: boolean;
  onEnablePlayback: () => void;
  onTogglePlayback: () => void;
  onToggleSound: () => void;
  onDetail: () => void;
}) {
  const overlay = useDiscoverTitleOverlay();
  const name = titleFor(item);
  const year = yearFor(item);
  const genre = primaryGenre(item);
  const mediaLabel = item.media_type === "movie" ? "Film" : "Series";
  const anchorId = `preview-title-${item.media_type}-${item.id}`;
  const isSaved = Boolean(account?.savedRecord);
  const TitleHeading = account ? "h1" : "h3";
  return (
    <article
      id={`preview-${index + 1}`}
      data-preview-index={index}
      role="group"
      aria-label={`${name} trailer`}
      aria-roledescription="slide"
      inert={selected ? undefined : true}
      className="preview-feed-slide relative isolate grid h-full min-h-full snap-start snap-always grid-rows-[minmax(12.5rem,1fr)_auto] gap-0 overflow-hidden pt-[max(0.5rem,env(safe-area-inset-top))] pb-[var(--preview-dock-clearance,0.5rem)]"
    >
      <PreviewPlayer
        item={item}
        index={index}
        playing={playerVisible}
        failed={playbackFailed}
        priority={index < 2}
        onPlay={onEnablePlayback}
        player={player}
      />

      <div className="preview-feed-info relative z-30 mx-auto h-fit min-h-0 w-full max-w-[64rem] min-w-0 self-end overflow-hidden px-4 pt-7 pb-2 text-white sm:px-6 md:px-8 md:pt-8">
        <div className="preview-feed-kicker flex items-start">
          <span
            className={cn(
              "inline-flex items-center font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em]",
              SOURCE_TONES[item.source],
            )}
          >
            {SOURCE_LABELS[item.source]}
          </span>
        </div>

        <TitleHeading className="preview-feed-title mt-2 line-clamp-2 text-[clamp(1.4rem,5vw,2.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
          {name}
        </TitleHeading>

        <p className="preview-feed-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 sm:mt-2">
          {year ? <span>{year}</span> : null}
          {year ? <span aria-hidden>·</span> : null}
          <span>{mediaLabel}</span>
          {genre ? <span aria-hidden>·</span> : null}
          {genre ? <span>{genre}</span> : null}
          {item.vote_average ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.vote_average.toFixed(1)}</span>
            </>
          ) : null}
        </p>

        <div className="preview-feed-actions mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:gap-2.5">
          {account ? (
            <>
              <SaveControl
                item={item}
                record={account.savedRecord}
                ensureSaved={account.ensureSaved}
                onStatusChange={account.onStatusChange}
                onMenuOpenChange={account.onMenuOpenChange}
              />
              <AddTitleToListButton
                titleId={account.savedRecord?.id}
                ensureTitleId={account.ensureSaved}
                lists={account.lists}
                variant="icon"
                onOpenChange={(open) => {
                  account.onMenuOpenChange(open);
                  if (open) account.onListIntent();
                }}
              />
            </>
          ) : saveHref ? (
            <Link
              href={saveHref}
              scroll={false}
              aria-label={`Save ${name} to your watchlist`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[0_12px_32px_-18px_hsl(var(--primary))] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:active:scale-100"
            >
              <Plus className="h-4 w-4" aria-hidden />{" "}
              <span className="max-[359px]:sr-only">Up Next</span>
            </Link>
          ) : null}
          <button
            id={anchorId}
            type="button"
            onPointerEnter={() => overlay?.prefetch(item)}
            onFocus={() => overlay?.prefetch(item)}
            onClick={() => {
              onDetail();
              overlay?.open(item, isSaved, anchorId);
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-foreground shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-primary/40 hover:bg-card active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:active:scale-100"
            aria-label={`View details for ${name}`}
            aria-controls={detailsId}
            aria-expanded={detailExpanded}
            title="View details"
          >
            <Info className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!playerReady}
            onClick={onTogglePlayback}
            className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={playbackEnabled ? "Pause previews" : "Play previews"}
            title={playbackEnabled ? "Pause previews" : "Play previews"}
          >
            {playbackEnabled ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            disabled={!soundReady}
            onClick={onToggleSound}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-45"
            aria-label={soundEnabled ? "Mute previews" : "Unmute previews"}
            title={soundEnabled ? "Mute previews" : "Unmute previews"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" aria-hidden />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
