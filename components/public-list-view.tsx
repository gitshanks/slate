"use client";

import * as React from "react";
import Link from "next/link";
import { MediaGrid } from "@/components/media-grid";
import { PublicTitleDetailOverlay } from "@/components/spatial-poster-grid";
import { PublicProfileTitleActions } from "@/components/public-profile-title-actions";
import { SlateListTitle } from "@/components/slate-list-title";
import { addSlateListToLibrary } from "@/lib/slate-list-actions";
import { toast } from "sonner";
import { loadPublicTitleDetail } from "@/lib/public-title-detail-cache";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { TitleRow } from "@/lib/types";

interface PublicListViewProps {
  slug: string;
  name: string;
  description: string | null;
  curator: string;
  username: string;
  titles: TitleRow[];
  viewerSignedIn?: boolean;
}

// One action, so it takes the whole row on a phone (DESIGN.md, Interaction).
const ACTION =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:opacity-70 sm:h-10 sm:w-auto";

/** A list made by Slate, readable by anyone: its name, why it exists, and the posters. */
export function PublicListView({
  slug,
  name,
  description,
  curator,
  username,
  titles,
  viewerSignedIn = false,
}: PublicListViewProps) {
  const [openTitle, setOpenTitle] = React.useState<TitleRow | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isSaving, startSaving] = React.useTransition();

  const addList = React.useCallback(() => {
    startSaving(async () => {
      try {
        await addSlateListToLibrary(slug);
        setSaved(true);
        toast.success(`${name} is on your slate`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That did not work. Try again.");
      }
    });
  }, [name, slug]);

  const open = React.useCallback(
    (title: TitleRow) => {
      // Start the request on press so the card has its detail as it opens.
      void loadPublicTitleDetail(username, title.id).catch(() => undefined);
      setOpenTitle(title);
    },
    [username],
  );
  const close = React.useCallback(() => setOpenTitle(null), []);

  const renderActions = React.useCallback(
    (title: TitleRow, detail: PublicSpatialTitleDetail | null) => (
      <PublicProfileTitleActions
        title={title}
        detail={detail}
        username={username}
        viewerSignedIn={viewerSignedIn}
        showOwnerShelf={false}
      />
    ),
    [username, viewerSignedIn],
  );

  const count = `${titles.length} ${titles.length === 1 ? "title" : "titles"}`;

  return (
    <div className="app-tab-arrive mx-auto w-full max-w-[1600px] px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-10">
      <span
        data-title-overlay-safe-area
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-0"
        style={{
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
        }}
      />
      <header id="public-list-header" className="mb-8 max-w-2xl sm:mb-12">
        <p className="text-sm text-primary">A list by {curator}</p>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
          <SlateListTitle slug={slug} name={name} />
        </h1>
        {description ? (
          <p className="mt-3 text-pretty text-base leading-relaxed text-white/62">
            {description}
          </p>
        ) : null}
        <div className="mt-6 flex items-center gap-4">
          {!viewerSignedIn ? (
            <Link href="/login" className={ACTION}>
              Add to your slate
            </Link>
          ) : saved ? (
            <Link href="/lists" className={ACTION}>
              On your slate. Open your lists
            </Link>
          ) : (
            <button type="button" onClick={addList} disabled={isSaving} className={ACTION}>
              {isSaving ? "Adding" : "Add to your slate"}
            </button>
          )}
          <span className="hidden text-sm text-white/45 sm:inline">{count}</span>
        </div>
      </header>

      <MediaGrid
        titles={titles}
        readOnly
        titleHrefBase={`/u/${username}/title`}
        activeTitleId={openTitle?.id}
        presentation="profile"
        showStatus={false}
        onTitleSelect={open}
      />

      {openTitle ? (
        <PublicTitleDetailOverlay
          key={openTitle.id}
          title={openTitle}
          username={username}
          anchorTitleId={openTitle.id}
          centerAfterId="public-list-header"
          onClose={close}
          renderActions={renderActions}
        />
      ) : null}
    </div>
  );
}
