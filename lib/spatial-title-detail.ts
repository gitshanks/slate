import "server-only";

import { getOmdbMetadata } from "@/lib/omdb";
import { formatPlotText } from "@/lib/plot-format";
import type { PublicSpatialTitleDetail } from "@/lib/public-spatial-detail-types";
import { getTitleMeta } from "@/lib/tmdb";
import type { TitleRow } from "@/lib/types";

/**
 * Build the read-heavy detail payload shared by public and authenticated
 * collection inspectors. Ownership is deliberately resolved by the caller so
 * this helper can never make a private title public by itself.
 */
export async function buildSpatialTitleDetail(
  title: TitleRow,
): Promise<PublicSpatialTitleDetail> {
  const [meta, omdb] = await Promise.all([
    getTitleMeta(title.media_type, title.tmdb_id),
    title.omdb_plot || !title.imdb_id
      ? Promise.resolve(null)
      : getOmdbMetadata(title.imdb_id),
  ]);

  return {
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
}
