import { getAppSession } from "@/lib/app-access";
import { libraryClientForOwner } from "@/lib/library-db";
import { getPublicProfileTitle } from "@/lib/public-profile-library";
import { buildSpatialTitleDetail } from "@/lib/spatial-title-detail";
import { SLATE_HOSTED } from "@/lib/public-mode";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/public/[username]/titles/[id]">,
) {
  const { username, id } = await context.params;

  if (!username || !id || username.length > 64 || id.length > 128) {
    return Response.json({ error: "Invalid title." }, { status: 400 });
  }

  const record = await getPublicProfileTitle(username, id);
  if (!record) {
    return Response.json({ error: "Title not found." }, { status: 404 });
  }

  const detail = await buildSpatialTitleDetail(record.title);

  // Attach the viewer's own copy (if any) so a shared profile can offer an
  // Add control without ever exposing another account's private rows.
  let savedTitle: { id: string; status: string } | null = null;
  if (SLATE_HOSTED) {
    try {
      const session = await getAppSession();
      const viewerId = session?.user?.id;
      if (viewerId) {
        const { data } = await libraryClientForOwner(viewerId)
          .from("titles")
          .select("id, status")
          .eq("tmdb_id", record.title.tmdb_id)
          .eq("media_type", record.title.media_type)
          .maybeSingle();
        if (data) savedTitle = data as unknown as { id: string; status: string };
      }
    } catch {
      savedTitle = null;
    }
  }

  return Response.json(
    { ...detail, savedTitle },
    {
    headers: {
      // Public status can change at any time. Keep this response out of shared
      // caches so a previously public title never lingers after that switch.
      "Cache-Control": "private, no-store",
    },
  });
}
