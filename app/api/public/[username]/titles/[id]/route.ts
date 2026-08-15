import { getPublicProfileTitle } from "@/lib/public-profile-library";
import { buildSpatialTitleDetail } from "@/lib/spatial-title-detail";

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

  return Response.json(detail, {
    headers: {
      // Public status can change at any time. Keep this response out of shared
      // caches so a previously public title never lingers after that switch.
      "Cache-Control": "private, no-store",
    },
  });
}
