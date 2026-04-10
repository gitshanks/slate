import { notFound } from "next/navigation";
import { supabase, type ListRow, type TitleRow } from "@/lib/supabase";
import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { AddToListPicker } from "@/components/add-to-list-picker";
import { ListPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ListDetailPage(props: PageProps<"/lists/[slug]">) {
  const { slug } = await props.params;

  const { data: list, error: listErr } = await supabase
    .from("lists")
    .select("*")
    .eq("slug", slug)
    .single();
  if (listErr || !list) notFound();

  const { data: rows } = await supabase
    .from("list_titles")
    .select("title_id, position, titles(*)")
    .eq("list_id", list.id)
    .order("position", { ascending: true });

  // Supabase returns the joined `titles` as an array; flatten it.
  const titles: TitleRow[] = (rows ?? []).flatMap((r) => {
    const t = (r as unknown as { titles: TitleRow | TitleRow[] | null }).titles;
    if (!t) return [];
    return Array.isArray(t) ? t : [t];
  });

  // Library titles not yet in this list, for the picker
  const { data: libRows } = await supabase
    .from("titles")
    .select("id, title, poster_path, release_date, media_type, rating")
    .order("added_at", { ascending: false });
  const inThisList = new Set(titles.map((t) => t.id));
  const candidates = (libRows ?? []).filter((t) => !inThisList.has(t.id));

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
          List
        </p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">{(list as ListRow).name}</h1>
        {(list as ListRow).description && (
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {(list as ListRow).description}
          </p>
        )}
      </div>

      <div className="mb-10">
        <AddToListPicker listId={(list as ListRow).id} candidates={candidates as TitleRow[]} />
      </div>

      {titles.length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" />}
          title="Empty list"
          description="Add titles from your library above."
        />
      ) : (
        <MediaGrid titles={titles} />
      )}
    </div>
  );
}
