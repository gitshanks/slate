import Link from "next/link";
import { supabase, type ListRow } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { CreateListForm } from "@/components/create-list-form";
import { DeleteListButton } from "@/components/delete-list-button";
import { ListPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const { data: lists, error } = await supabase
    .from("lists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <EmptyState
        icon={<ListPlus className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  // Per-list count of titles + first 4 poster paths, batched
  const ids = (lists ?? []).map((l) => l.id);
  let counts: Record<string, number> = {};
  let posters: Record<string, string[]> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("list_titles")
      .select("list_id, titles(poster_path)")
      .in("list_id", ids);
    (rows ?? []).forEach((r) => {
      counts[r.list_id] = (counts[r.list_id] ?? 0) + 1;
      // Supabase embed can return single object or array depending on relationship type
      const t = r.titles;
      const poster: string | null | undefined = Array.isArray(t)
        ? t[0]?.poster_path
        : (t as { poster_path: string | null } | null)?.poster_path;
      if (poster && (posters[r.list_id]?.length ?? 0) < 4) {
        posters[r.list_id] = [...(posters[r.list_id] ?? []), poster];
      }
    });
  }

  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Collections
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Lists</h1>
        </div>
      </div>

      <div className="mb-12">
        <CreateListForm />
      </div>

      {(lists ?? []).length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" />}
          title="No lists yet"
          description="Group titles into themed collections — Cozy winter, A24 horror, Long flights…"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(lists as ListRow[]).map((list) => (
            // Wrapper div so we can absolutely position the delete button
            // without nesting interactive elements inside <Link>
            <div key={list.id} className="relative group/card">
              <Link
                href={`/lists/${list.slug}`}
                className="flex min-h-[148px] flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.35)]"
              >
                <div className="flex-1 pr-8">
                  <h3 className="text-lg font-semibold tracking-tight">{list.name}</h3>
                  {list.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {list.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-xs text-muted-foreground font-mono">
                    {counts[list.id] ?? 0}{" "}
                    {(counts[list.id] ?? 0) === 1 ? "title" : "titles"}
                  </p>
                  {(posters[list.id] ?? []).length > 0 && (
                    <div className="flex gap-1">
                      {(posters[list.id] ?? []).map((p, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={`https://image.tmdb.org/t/p/w92${p}`}
                          alt=""
                          className="h-9 w-6 rounded-sm object-cover opacity-80"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
              {/* Delete — absolutely positioned, stops click propagation */}
              <DeleteListButton
                listId={list.id}
                listName={list.name}
                iconOnly
                className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
