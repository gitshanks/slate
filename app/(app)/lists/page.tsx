import Link from "next/link";
import { supabase, type ListRow } from "@/lib/supabase";
import { EmptyState } from "@/components/empty-state";
import { CreateListForm } from "@/components/create-list-form";
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

  // Per-list count of titles, batched
  const ids = (lists ?? []).map((l) => l.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from("list_titles")
      .select("list_id")
      .in("list_id", ids);
    counts = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.list_id] = (acc[r.list_id] ?? 0) + 1;
      return acc;
    }, {});
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
            <Link
              key={list.id}
              href={`/lists/${list.slug}`}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.35)]"
            >
              <h3 className="text-lg font-semibold tracking-tight">{list.name}</h3>
              {list.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {list.description}
                </p>
              )}
              <p className="mt-4 text-xs text-muted-foreground font-mono">
                {counts[list.id] ?? 0}{" "}
                {(counts[list.id] ?? 0) === 1 ? "title" : "titles"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
