"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createListFromTitles } from "@/lib/actions";
import { SignupActions } from "@/components/guest-context";
import { captureAnalytics } from "@/lib/analytics";
import { posterUrl } from "@/lib/tmdb-image";
import { cn } from "@/lib/utils";

// Client-safe copies of the server shapes in lib/library-nudges.ts.
export interface NewEpisodeNudge {
  titleId: string;
  title: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
}

export interface ListSuggestionNudge {
  name: string;
  titleIds: string[];
  posterPaths: string[];
}

const SMALL_LIBRARY_TITLES = 5;
/** Shared with app/(app)/page.tsx, which reads it so hidden prompts never render. */
export const NUDGE_COOKIE = "slate_nudges_hidden";
type GuestStage = "guestback" | "guest10" | "guest3";
type NudgeKind = "small" | "list" | GuestStage;
const NUDGE_KINDS = new Set<string>(["small", "list", "guestback", "guest10", "guest3"]);

export interface GuestNudgeState {
  listCount: number;
  /** First came at least half a day ago. */
  returning: boolean;
}

/**
 * The milestones at which a guest is asked to keep their slate: a third title
 * or a first list, a tenth title, and coming back another day. Each shows
 * once; closing it quiets every milestone reached so far.
 */
function guestStages(guest: GuestNudgeState, titleCount: number): GuestStage[] {
  const stages: GuestStage[] = [];
  if (guest.returning) stages.push("guestback");
  if (titleCount >= 10) stages.push("guest10");
  if (titleCount >= 3 || guest.listCount > 0) stages.push("guest3");
  return stages;
}

function hideNudge(kind: NudgeKind | NudgeKind[], hidden: Set<NudgeKind>) {
  const next = new Set(hidden);
  for (const item of Array.isArray(kind) ? kind : [kind]) next.add(item);
  // A cookie, not localStorage, so the server leaves hidden prompts out and
  // the shelf never shifts when they would have been removed after load.
  document.cookie = `${NUDGE_COOKIE}=${[...next].join(".")}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return next;
}

// Full width and 44px tall on a phone, their own width from `sm` up.
const buttonBase =
  "inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 text-xs font-medium transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:h-10 sm:w-auto";
const primaryButton = cn(buttonBase, "bg-primary text-primary-foreground");
const secondaryButton = cn(
  buttonBase,
  "border border-border bg-foreground/[0.055] text-foreground hover:bg-foreground/[0.09]",
);
const dismissButton =
  "grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** "today", "yesterday", a weekday within the week, else "3 Nov". */
function airedLabel(airDate: string) {
  const aired = new Date(`${airDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((today.getTime() - aired.getTime()) / 86_400_000);
  if (days <= 0) return "out today";
  if (days === 1) return "out yesterday";
  if (days < 7) return `out ${aired.toLocaleDateString(undefined, { weekday: "short" })}`;
  return `out ${aired.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/**
 * One row of actions. On a phone they share the row in equal widths and a
 * single action takes the whole row; from `sm` up they sit at their own width.
 */
function ActionRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  return (
    <div
      className={cn(
        "grid gap-2 sm:flex sm:items-center",
        count > 1 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The ways in for a small or empty library. */
export function SmallLibraryActions({
  canPickMore,
  secondary = false,
  className,
}: {
  canPickMore: boolean;
  /** Both as quiet buttons, when a primary action already sits above them. */
  secondary?: boolean;
  className?: string;
}) {
  return (
    <ActionRow className={className}>
      {canPickMore ? (
        <Link
          href="/onboarding?more=1"
          className={secondary ? secondaryButton : primaryButton}
          data-analytics-action="nudge_pick_more"
          data-analytics-area="library_small"
        >
          Pick a few
        </Link>
      ) : null}
      <Link
        href="/import"
        className={canPickMore || secondary ? secondaryButton : primaryButton}
        data-analytics-action="nudge_import"
        data-analytics-area="library_small"
      >
        {canPickMore ? "Import history" : "Import from Letterboxd or IMDb"}
      </Link>
    </ActionRow>
  );
}

/**
 * The frame every Library prompt shares: the close button pinned to the top
 * right corner with the text kept clear of it, and the actions in one row,
 * under the text on a phone and beside it from `sm` up.
 */
function NudgeCard({
  id,
  top,
  heading,
  body,
  actions,
  onDismiss,
  dismissDisabled = false,
}: {
  id: string;
  top?: React.ReactNode;
  heading: React.ReactNode;
  body: React.ReactNode;
  actions: React.ReactNode;
  onDismiss: () => void;
  dismissDisabled?: boolean;
}) {
  return (
    <section
      aria-labelledby={id}
      className="app-tab-arrive relative rounded-2xl border border-border bg-card/60 p-4 sm:flex sm:items-end sm:gap-6 sm:p-5"
    >
      <div className="min-w-0 flex-1 pr-10">
        {top ? <div className="mb-3">{top}</div> : null}
        <h2 id={id} className="text-balance text-base font-semibold leading-snug text-foreground">
          {heading}
        </h2>
        <div className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</div>
      </div>
      <div className="mt-4 shrink-0 sm:mt-0">{actions}</div>
      <button
        type="button"
        onClick={onDismiss}
        disabled={dismissDisabled}
        aria-label="Hide this"
        className={cn(dismissButton, "absolute right-2.5 top-2.5 sm:right-3 sm:top-3")}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

const thumb = "h-[4.5rem] w-12 shrink-0 rounded-lg";

/** A small poster, or an empty slot of the same size. */
function Thumb({ path }: { path: string | null }) {
  return path ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={posterUrl(path, "w185")!} alt="" className={cn(thumb, "bg-muted object-cover")} />
  ) : (
    <span className={cn(thumb, "bg-muted")} />
  );
}

/**
 * The five slots of a library worth having: what they saved, then the empty
 * places still to fill.
 */
function LibrarySlots({ posters, count }: { posters: (string | null)[]; count: number }) {
  return (
    <div
      role="img"
      aria-label={`${count} of ${SMALL_LIBRARY_TITLES} titles saved`}
      className="flex gap-1.5"
    >
      {Array.from({ length: SMALL_LIBRARY_TITLES }, (_, index) =>
        index < count ? (
          <Thumb key={index} path={posters[index] ?? null} />
        ) : (
          <span
            key={index}
            className={cn(thumb, "border border-dashed border-foreground/20")}
          />
        ),
      )}
    </div>
  );
}

export function LibraryNudges({
  titleCount,
  canPickMore,
  newEpisodes,
  listSuggestion,
  onOpenTitle,
  hiddenNudges = [],
  savedPosters = [],
  guestNudge = null,
}: {
  guestNudge?: GuestNudgeState | null;
  savedPosters?: (string | null)[];
  titleCount: number;
  canPickMore: boolean;
  newEpisodes: NewEpisodeNudge[];
  listSuggestion: ListSuggestionNudge | null;
  onOpenTitle: (titleId: string) => void;
  hiddenNudges?: string[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = React.useState(
    () => new Set(hiddenNudges.filter((kind): kind is NudgeKind => NUDGE_KINDS.has(kind))),
  );
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState("");

  const dismiss = (which: NudgeKind | NudgeKind[]) => {
    setHidden((current) => hideNudge(which, current));
    captureAnalytics("nudge_dismissed", { nudge: Array.isArray(which) ? which[0] : which });
  };

  const makeList = async () => {
    if (!listSuggestion || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const { id } = await createListFromTitles(listSuggestion.name, listSuggestion.titleIds);
      hideNudge("list", hidden);
      captureAnalytics("list_created", { source: "library_suggestion" });
      router.push(`/lists/${id}`);
    } catch {
      setCreateError("That list could not be made. Try once more.");
      setCreating(false);
    }
  };

  const remaining = SMALL_LIBRARY_TITLES - titleCount;
  const showSmall = titleCount > 0 && remaining > 0 && !hidden.has("small");
  const showList = Boolean(listSuggestion) && !hidden.has("list");
  const reachedStages = guestNudge ? guestStages(guestNudge, titleCount) : [];
  const guestStage = reachedStages.find((stage) => !hidden.has(stage)) ?? null;
  // One prompt card at a time: while a guest is asked to keep their slate,
  // the others wait.
  const showSmallCard = showSmall && !guestStage;
  const showListCard = showList && !guestStage;
  if (!newEpisodes.length && !showSmallCard && !showListCard && !guestStage) return null;

  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-6">
      {guestStage ? (
        <NudgeCard
          id="guest-signup-heading"
          heading={
            guestStage === "guestback"
              ? "Welcome back. Your slate is still here"
              : guestStage === "guest10"
                ? `${titleCount} titles saved. Keep them safe`
                : "Keep your slate"
          }
          body="Right now it lives only in this browser. Sign up free to keep it and open it on your phone, computer and iPad."
          actions={<SignupActions analyticsArea={`library_${guestStage}`} />}
          onDismiss={() => dismiss(reachedStages)}
        />
      ) : null}
      {newEpisodes.length ? (
        <section aria-labelledby="new-episodes-heading" className="app-tab-arrive">
          <h2 id="new-episodes-heading" className="mb-2 px-1 text-sm font-semibold text-foreground">
            New episodes
          </h2>
          <ul className="scrollbar-hide -mx-3 flex gap-3 overflow-x-auto overscroll-x-contain px-3 pb-1 sm:mx-0 sm:px-0">
            {newEpisodes.map((item) => (
              <li key={item.titleId} className="w-[5.75rem] shrink-0 sm:w-28">
                <button
                  type="button"
                  onClick={() => onOpenTitle(item.titleId)}
                  data-analytics-action="nudge_new_episode"
                  data-analytics-area="library_new_episodes"
                  aria-label={`${item.title}, season ${item.season} episode ${item.episode}, ${airedLabel(item.airDate)}`}
                  className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-muted transition-transform duration-200 ease-out group-active:scale-[0.97] motion-reduce:transition-none motion-reduce:group-active:scale-100">
                    {item.posterPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={posterUrl(item.posterPath, "w342")!} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="mt-1.5 block truncate text-xs font-medium text-foreground">{item.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">
                      S{item.season} E{item.episode}
                    </span>{" "}
                    {airedLabel(item.airDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showSmallCard ? (
        <NudgeCard
          id="small-library-heading"
          top={<LibrarySlots posters={savedPosters} count={titleCount} />}
          heading={`${remaining} more and Slate gets to know your taste`}
          body="Recommendations and Previews learn from what you save. Pick a few we chose, or import from Letterboxd or IMDb."
          actions={<SmallLibraryActions canPickMore={canPickMore} />}
          onDismiss={() => dismiss("small")}
        />
      ) : null}

      {showListCard && listSuggestion ? (
        <NudgeCard
          id="first-list-heading"
          top={
            <div className="flex gap-1.5" aria-hidden="true">
              {listSuggestion.posterPaths.map((path) => (
                <Thumb key={path} path={path} />
              ))}
              {listSuggestion.titleIds.length > listSuggestion.posterPaths.length ? (
                <span className={cn(thumb, "grid place-items-center bg-foreground/[0.06] text-xs font-medium text-muted-foreground")}>
                  +{listSuggestion.titleIds.length - listSuggestion.posterPaths.length}
                </span>
              ) : null}
            </div>
          }
          heading={`Make ${listSuggestion.name} your first list`}
          body={
            <>
              {listSuggestion.titleIds.length} titles you saved, ready to share with whoever you watch with.
              {createError ? (
                <span className="mt-1 block text-destructive" role="alert">
                  {createError}
                </span>
              ) : null}
            </>
          }
          actions={
            <ActionRow>
              <button
                type="button"
                onClick={makeList}
                disabled={creating}
                className={primaryButton}
                data-analytics-action="nudge_make_list"
                data-analytics-area="library_first_list"
              >
                {creating ? "Making it…" : "Make this list"}
              </button>
            </ActionRow>
          }
          onDismiss={() => dismiss("list")}
          dismissDisabled={creating}
        />
      ) : null}
    </div>
  );
}
