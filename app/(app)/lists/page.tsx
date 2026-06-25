import type { Metadata } from "next";
import Link from "next/link";
import { supabase, type ListRow } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { CreateListForm } from "@/components/create-list-form";
import { DeleteListButton } from "@/components/delete-list-button";
import { ShareListButton } from "@/components/share-list-button";
import { ListPlus, Film } from "lucide-react";
import { MotionGrid, MotionItem } from "@/components/motion-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "slate — Lists",
};

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
  const counts: Record<string, number> = {};
  const posters: Record<string, string[]> = {};
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
      <div className="mb-8 flex items-end justify-between gap-4 sm:mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Collections
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Lists</h1>
        </div>
        {/* Trigger sits in the header's top-right at every breakpoint —
            saves the standalone row that used to live below the header
            and makes the spacing read consistently on mobile. */}
        <CreateListForm />
      </div>

      {(lists ?? []).length === 0 ? (
        <EmptyState
          icon={<ListPlus className="h-6 w-6" />}
          title="No lists yet"
          description="Group titles into themed collections — Cozy winter, A24 horror, Long flights…"
        />
      ) : (
        <MotionGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(lists as ListRow[]).map((list) => {
            const covers = posters[list.id] ?? [];
            const count = counts[list.id] ?? 0;
            return (
              // Wrapper so we can absolutely position the action buttons
              // without nesting interactive elements inside <Link>.
              <MotionItem key={list.id} className="relative group/card">
                <Link
                  href={`/lists/${list.slug}`}
                  className="block overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.35)]"
                >
                  {/* Poster cover — the list's first titles fanned out as the
                      hero. Empty lists get a muted placeholder. */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-b from-muted/40 to-muted/10">
                    {covers.length > 0 ? (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center gap-2 px-6">
                          {covers.map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={`https://image.tmdb.org/t/p/w185${p}`}
                              alt=""
                              loading="lazy"
                              className="h-[78%] w-auto rounded-md object-cover shadow-lg shadow-black/40 ring-1 ring-white/10 transition-transform duration-300 ease-out group-hover/card:-translate-y-0.5"
                              style={{ transform: `rotate(${(i - (covers.length - 1) / 2) * 5}deg)` }}
                            />
                          ))}
                        </div>
                        {/* Bottom fade so the title block below sits cleanly. */}
                        <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                        <Film className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Name · count · description */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="truncate text-lg font-semibold tracking-tight">
                        {list.name}
                      </h3>
                      <span className="shrink-0 text-xs text-muted-foreground font-mono">
                        {count} {count === 1 ? "title" : "titles"}
                      </span>
                    </div>
                    {list.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {list.description}
                      </p>
                    )}
                  </div>
                </Link>
                {/* Share + Delete — absolutely positioned over the cover, stop
                    click propagation. Visible on hover (and always on touch). */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                  <ShareListButton listSlug={list.slug} listName={list.name} />
                  <DeleteListButton listId={list.id} listName={list.name} iconOnly />
                </div>
              </MotionItem>
            );
          })}
        </MotionGrid>
      )}
    </div>
  );
}
