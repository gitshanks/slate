import { supabase, type TitleRow } from "@/lib/supabase";
import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WatchedPage() {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("status", "watched")
    .order("watched_at", { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <EmptyState
        icon={<Eye className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  const titles = (data ?? []) as TitleRow[];
  const ratedCount = titles.filter((t) => t.rating != null).length;
  const avg =
    ratedCount > 0
      ? titles.reduce((s, t) => s + (Number(t.rating) || 0), 0) / ratedCount
      : null;

  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
            Already seen
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Watched</h1>
        </div>
        <div className="hidden text-right text-xs text-muted-foreground sm:block">
          <div>
            {titles.length} {titles.length === 1 ? "title" : "titles"}
          </div>
          {avg != null && (
            <div className="font-mono">avg {avg.toFixed(1)} / 5</div>
          )}
        </div>
      </div>

      {titles.length === 0 ? (
        <EmptyState
          icon={<Eye className="h-6 w-6" />}
          title="Nothing watched yet"
          description="When you mark a title as watched it'll show up here."
        />
      ) : (
        <MediaGrid titles={titles} />
      )}
    </div>
  );
}
