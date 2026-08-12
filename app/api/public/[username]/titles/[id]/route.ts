import { getOmdbMetadata } from "@/lib/omdb";
import { formatPlotText } from "@/lib/plot-format";
import { getPublicProfileTitle } from "@/lib/public-profile-library";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import { getTitleMeta } from "@/lib/tmdb";

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

  const { title } = record;
  const [meta, omdb] = await Promise.all([
    getTitleMeta(title.media_type, title.tmdb_id),
    title.omdb_plot || !title.imdb_id
      ? Promise.resolve(null)
      : getOmdbMetadata(title.imdb_id),
  ]);
  const detail: PublicSpatialTitleDetail = {
    summary: formatPlotText(
      title.omdb_plot?.trim() || omdb?.omdb_plot || title.overview,
    ),
    tagline: meta.tagline,
    trailerKey: meta.trailerKey,
    directedBy: meta.directedBy,
    cast: meta.cast.slice(0, 10).map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.character || null,
      profilePath: person.profile_path,
    })),
    crew: meta.crew.slice(0, 8).map((person) => ({
      id: person.id,
      name: person.name,
      subtitle: person.job || null,
      profilePath: person.profile_path,
    })),
    watchProviders: meta.watchProviders
      ? {
          link: meta.watchProviders.link,
          providers: meta.watchProviders.providers.map((provider) => ({
            id: provider.provider_id,
            name: provider.provider_name,
            logoPath: provider.logo_path,
          })),
        }
      : null,
  };

  return Response.json(detail, {
    headers: {
      // Public status can change at any time. Keep this response out of shared
      // caches so a previously public title never lingers after that switch.
      "Cache-Control": "private, no-store",
    },
  });
}
