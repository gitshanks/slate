"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { PublicTitleDetailOverlay } from "@/components/spatial-poster-grid";
import { PublicProfileTitleActions } from "@/components/public-profile-title-actions";
import { SlateListTitle } from "@/components/slate-list-title";
import { addSlateListToLibrary } from "@/lib/slate-list-actions";
import { loadPublicTitleDetail } from "@/lib/public-title-detail-cache";
import { backdropUrl, posterUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import type { SlateListExtras } from "@/lib/slate-list-content";
import type { TitleRow } from "@/lib/types";

interface PublicListViewProps {
  slug: string;
  name: string;
  description: string | null;
  username: string;
  titles: TitleRow[];
  extras: SlateListExtras;
  viewerSignedIn?: boolean;
}

function isRedirect(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "digest" in error &&
      String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT"),
  );
}

// The page's one action is a quiet pill in the top bar, so the still, the
// name and the list read as one piece (DESIGN.md, Interaction).
const ACTION =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-background/55 px-3.5 text-[13px] font-semibold text-primary ring-1 ring-inset ring-primary/35 backdrop-blur-md transition-[background-color,transform] duration-150 hover:bg-background/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:opacity-70 sm:h-10 sm:px-4 sm:text-sm";


/**
 * A list made by Slate. A still from one of its films runs across the top
 * with the list's name over it. The films are a ranked list: a very large,
 * faint number half behind each poster, the title, and whatever that list says
 * about each film (a large value at the right, or a line under the title).
 */
export function PublicListView({
  slug,
  name,
  description,
  username,
  titles,
  extras,
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
        // A signed-out visitor now has a guest slate: no login wall, and a
        // nudge that it is theirs to keep.
        toast.success(`${name} is on your slate`, viewerSignedIn ? undefined : {
          description: "Sign up anytime to keep it on every device.",
        });
      } catch (error) {
        if (isRedirect(error)) throw error;
        toast.error(error instanceof Error ? error.message : "That did not work. Try again.");
      }
    });
  }, [name, slug, viewerSignedIn]);

  // Where guest mode is off, "Add to your slate" sends a signed-out visitor
  // to sign up (lib/slate-list-actions.ts). They come back here signed in
  // with ?add=1, so the list they asked for is added without a second press.
  const resumed = React.useRef(false);
  React.useEffect(() => {
    if (!viewerSignedIn || resumed.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") !== "1") return;
    resumed.current = true;
    url.searchParams.delete("add");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    addList();
  }, [addList, viewerSignedIn]);

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

  const hero = backdropUrl(
    extras.hero ?? titles.find((title) => title.backdrop_path)?.backdrop_path,
    "original",
  );
  const lede = extras.description ?? description;
  // From `lg` up the list runs down two columns: 1 to 5 beside 6 to 10.
  const rowsPerColumn = Math.ceil(titles.length / 2);

  return (
    <div className="app-tab-arrive relative">
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

      {hero ? (
        <div aria-hidden className="absolute inset-x-0 top-0 h-[330px] overflow-hidden lg:h-[470px]">
          <Image
            src={hero}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: extras.heroPosition ?? "50% 35%" }}
          />
          {/* Fades into the page below, and from `lg` darkens the left so the name reads on any still. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_10_9/0.55)_0%,rgb(8_10_9/0)_30%,rgb(8_10_9/0.2)_60%,rgb(8_10_9)_100%)]" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgb(8_10_9/0.72)_0%,rgb(8_10_9/0)_62%)] lg:block" />
        </div>
      ) : null}

      <div className="relative mx-auto w-full max-w-[1264px] px-5 pb-24 sm:px-8">
        <div className="flex h-14 items-center justify-between lg:h-[72px]">
          <Link href="/" aria-label="slate home" className="flex items-center">
            <Image src="/brand/wordmark-light.svg" alt="slate" width={64} height={23} priority />
          </Link>
          {saved ? (
            <Link href={viewerSignedIn ? "/lists" : "/app"} className={ACTION}>
              <Check aria-hidden className="size-4" />
              On your slate
            </Link>
          ) : (
            <button type="button" onClick={addList} disabled={isSaving} className={ACTION}>
              <Plus aria-hidden className="size-4" />
              {isSaving ? "Adding" : "Add to your slate"}
            </button>
          )}
        </div>

        <header id="public-list-header" className={hero ? "pt-[206px] lg:pt-[248px]" : "pt-16 lg:pt-24"}>
          <h1 className="text-balance text-[34px] font-bold leading-[38px] tracking-[-0.03em] text-white lg:text-[64px] lg:leading-[68px]">
            <SlateListTitle slug={slug} name={name} />
          </h1>
          {lede ? (
            <p className="mt-2.5 max-w-2xl text-balance text-[15px] leading-[22px] text-white/60 lg:mt-4 lg:max-w-none lg:text-pretty lg:text-xl lg:leading-[30px]">
              {lede}
            </p>
          ) : null}
        </header>

        <ol
          className="mt-5 grid gap-y-1 lg:mt-9 lg:grid-flow-col lg:grid-cols-2 lg:gap-x-32 lg:gap-y-0 lg:[grid-template-rows:repeat(var(--rows),auto)]"
          style={{ "--rows": rowsPerColumn } as React.CSSProperties}
        >
          {titles.map((title, index) => {
            const extra = extras.items[`${title.media_type}:${title.tmdb_id}`];
            const poster = posterUrl(title.poster_path, "w185");
            return (
              <li key={title.id} id={`shelf-title-${title.id}`} data-shelf-title-id={title.id}>
                <button
                  type="button"
                  onClick={() => open(title)}
                  aria-label={`${index + 1}. ${title.title}${extra?.value ? `, ${extra.value}` : ""}`}
                  className={cn(
                    "group grid h-[92px] w-full grid-cols-[14px_50px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl text-left",
                    "transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    "lg:h-[100px] lg:grid-cols-[22px_56px_minmax(0,1fr)_auto] lg:gap-5",
                    openTitle && openTitle.id !== title.id && "opacity-60",
                  )}
                >
                  {/* The rank: very large and faint, right-aligned so the poster covers about half of it. */}
                  <span
                    aria-hidden
                    className={cn(
                      "-mr-[30px] justify-self-end whitespace-nowrap text-right text-[76px] font-extrabold leading-[76px] tracking-[-0.06em] text-white/[0.13] tabular-nums lg:-mr-[38px] lg:text-[104px] lg:leading-[100px]",
                      // A two-digit rank is twice as wide. On a phone it starts at the same left edge
                      // as the others and runs further under the poster, instead of being cut. It is
                      // clipped inside the poster's right edge, so nothing shows beside the title.
                      index >= 9 &&
                        "max-lg:mr-0 max-lg:w-[70px] max-lg:justify-self-start max-lg:overflow-x-clip max-lg:text-left",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="relative block h-[75px] w-[50px] overflow-hidden rounded-lg bg-card transition-transform duration-200 ease-out hoverable:group-hover:scale-[1.04] lg:h-[84px] lg:w-14">
                    {poster ? <Image src={poster} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-balance text-base font-semibold leading-[21px] tracking-[-0.01em] text-white lg:truncate lg:text-xl lg:leading-7">
                      {title.title}
                    </span>
                    {extra?.line ? (
                      <span className="mt-0.5 block truncate text-[13px] leading-5 text-white/60 lg:text-[15px]">
                        {extra.line}
                      </span>
                    ) : null}
                  </span>
                  {extra?.value ? (
                    <span className="text-[46px] font-light leading-[46px] tracking-[-0.05em] text-primary tabular-nums lg:pl-5 lg:text-[60px] lg:leading-[60px]">
                      {extra.value}
                    </span>
                  ) : (
                    <span />
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        {extras.note ? (
          <p className="mt-8 text-[13px] leading-5 text-white/60 lg:mt-10 lg:text-sm">{extras.note}</p>
        ) : null}
      </div>

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
