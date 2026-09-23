import { notFound } from "next/navigation";
import { ListPlus } from "lucide-react";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";
import { DiscoverTitleOverlayProvider } from "@/components/discover-title-overlay";
import { ListTitlesOverlayGrid } from "@/components/list-titles-overlay-grid";
import { EmptyState } from "@/components/empty-state";
import { AddToListPicker } from "@/components/add-to-list-picker";
import { DeleteListButton } from "@/components/delete-list-button";
import { ShareListButton } from "@/components/share-list-button";
import { ListPeople } from "@/components/list-people";
import {
  getAccessibleList,
  getEditableListOptions,
  getListTitles,
} from "@/lib/shared-lists";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const dynamic = "force-dynamic";

export default async function ListDetailPage(props: PageProps<"/lists/[slug]">) {
  const { slug } = await props.params;
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
  const allLists = await getEditableListOptions();

  return (
    <div>
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            {isShared ? "Shared list" : "List"}
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">{list.name}</h1>
          {list.description && (
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {list.description}
            </p>
          )}
          {isShared ? (
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <ListPeople people={people} />
              <span>{list.isOwner ? `You and ${list.members.length} ${list.members.length === 1 ? "person" : "people"}` : `Shared by ${list.owner?.displayName ?? "the owner"}`}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {SLATE_HOSTED ? <ShareListButton listId={list.id} listName={list.name} owner={list.owner} members={list.members} isOwner={list.isOwner} /> : null}
          {list.isOwner ? <DeleteListButton listId={list.id} listName={list.name} /> : null}
        </div>
      </div>

      <div className="mb-10">
        <AddToListPicker listId={list.id} candidates={candidates as TitleRow[]} />
      </div>

      {displayTitles.length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" />}
          title="Empty list"
          description="Add titles from your library above."
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
