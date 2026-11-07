import { notFound } from "next/navigation";
import { ListPlus } from "lucide-react";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { DiscoverTitleOverlayProvider } from "@/components/discover-title-overlay";
import { ListTitlesOverlayGrid } from "@/components/list-titles-overlay-grid";
import { EmptyState } from "@/components/empty-state";
import { AddToListPicker } from "@/components/add-to-list-picker";
import { DeleteListButton } from "@/components/delete-list-button";
import { ShareListButton } from "@/components/share-list-button";
import { ListPeople } from "@/components/list-people";
import { ListTvToggle } from "@/components/list-tv-toggle";
import { ListHeader } from "@/components/list-header";
import { getTvHiddenListIds } from "@/lib/list-tv";
import {
  getAccessibleList,
  getEditableListOptions,
  getListTitles,
} from "@/lib/shared-lists";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const dynamic = "force-dynamic";

export default async function ListDetailPage(props: PageProps<"/lists/[slug]">) {
  const [{ slug }, search] = await Promise.all([props.params, props.searchParams]);
  const db = await getLibraryClient();
  const list = await getAccessibleList(slug);
  if (!list) notFound();
  const titles = await getListTitles(list);

  // Library titles not yet in this list, for the picker
  const { data: libRows } = await db
    .from("titles")
    .select("id, tmdb_id, title, poster_path, release_date, media_type, rating")
    .order("added_at", { ascending: false });
  const inThisList = new Set(titles.map((t) => t.id));
  const inThisCatalogue = new Set(
    titles.map((title) => `${title.media_type}:${title.tmdb_id}`),
  );
  const candidates = (libRows ?? []).filter(
    (title) =>
      !inThisList.has(title.id) &&
      !inThisCatalogue.has(`${title.media_type}:${title.tmdb_id}`),
  );
  const people = list.owner ? [list.owner, ...list.members] : list.members;
  const isShared = people.length > 1;
  const displayTitles = isShared
    ? titles.map((title) => ({
        ...title,
        status: "want" as const,
        rating: null,
        review: null,
        favorite: false,
        watched_at: null,
      }))
    : titles;

  // Every list this person can edit, for the overlay's add-to-list picker.
  const [allLists, hiddenOnTv] = await Promise.all([
    getEditableListOptions(),
    getLibraryOwnerId().then(getTvHiddenListIds).catch(() => new Set<string>()),
  ]);

  return (
    <div>
      <ListHeader
        listId={list.id}
        name={list.name}
        description={list.description}
        canEdit={list.isOwner}
        people={isShared ? (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <ListPeople people={people} />
            <span>{list.isOwner ? `Shared with ${list.members.length} ${list.members.length === 1 ? "person" : "people"}` : `Shared by ${list.owner?.displayName ?? "the owner"}`}</span>
          </div>
        ) : null}
        actions={
          <>
            <ListTvToggle listId={list.id} onTv={!hiddenOnTv.has(list.id)} />
            {SLATE_HOSTED ? <ShareListButton listId={list.id} listName={list.name} owner={list.owner} members={list.members} isOwner={list.isOwner} /> : null}
          </>
        }
        trailing={list.isOwner ? <DeleteListButton listId={list.id} listName={list.name} iconOnly className="h-9 w-9" /> : null}
      />

      <div className="mb-10">
        <AddToListPicker
          listId={list.id}
          candidates={candidates as TitleRow[]}
          inList={[...inThisCatalogue]}
          defaultOpen={search.add === "1"}
        />
      </div>

      {displayTitles.length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" />}
          title="Nothing here yet"
          description="Use Add titles to search any film or show. You can also add from any title's page, Discover or search."
        />
      ) : (
        <DiscoverTitleOverlayProvider lists={allLists}>
          <ListTitlesOverlayGrid
            titles={displayTitles}
            showCardActions={!isShared}
            reorderContext={{
              kind: "list",
              listId: list.id,
            }}
          />
        </DiscoverTitleOverlayProvider>
      )}
    </div>
  );
}
