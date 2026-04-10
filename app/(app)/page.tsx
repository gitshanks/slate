import { supabase, type TitleRow } from "@/lib/supabase";
import { MediaGrid } from "@/components/media-grid";
import { EmptyState } from "@/components/empty-state";
import { Film } from "lucide-react";
import { OpenPaletteHint } from "@/components/open-palette-hint";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("status", "want")
    .order("added_at", { ascending: false });

  if (error) {
    return (
      <EmptyState
        icon={<Film className="h-6 w-6" />}
        title="Couldn't reach the database"
        description={error.message}
      />
    );
  }

  const titles = (data ?? []) as TitleRow[];

  const userName = process.env.APP_USER_NAME || "there";

  return (
    <div>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Hi {userName} 👋
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your Watchlist</h1>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {titles.length} {titles.length === 1 ? "title" : "titles"}
        </p>
      </div>

      {titles.length === 0 ? (
        <EmptyState
          icon={<Film className="h-6 w-6" />}
          title="Your watchlist is empty"
          description="Press ⌘K to search TMDB and add the first title you want to watch."
          action={<OpenPaletteHint />}
        />
      ) : (
        <MediaGrid titles={titles} />
      )}
    </div>
  );
}
