import { getLandingPosterColumns } from "@/lib/landing-posters";
import { posterUrl } from "@/lib/tmdb-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const columns = await getLandingPosterColumns();
  return Response.json(
    {
      data: {
        posterColumns: columns.map((column) =>
          column.map((path) => posterUrl(path, "w500")),
        ),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
