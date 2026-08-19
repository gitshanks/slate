import { NextResponse } from "next/server";
import { appApiUnauthorizedResponse } from "@/lib/app-access";
import {
  getPersonRelevantCredits,
  searchAll,
  type TmdbMediaResult,
  type TmdbPersonResult,
} from "@/lib/tmdb";
import { type TitleRow } from "@/lib/supabase";
import { getLibraryClient } from "@/lib/library-db";

/** Shape we return for library hits — just enough for the palette row. */
type LibraryHit = Pick<
  TitleRow,
  | "id"
  | "tmdb_id"
  | "media_type"
  | "title"
  | "poster_path"
  | "release_date"
  | "imdb_rating"
  | "rt_score"
  | "metacritic_score"
  | "status"
>;

async function searchLibrary(q: string): Promise<LibraryHit[]> {
  try {
    const db = await getLibraryClient();
    const { data } = await db
      .from("titles")
      .select(
        "id, tmdb_id, media_type, title, poster_path, release_date, imdb_rating, rt_score, metacritic_score, status"
      )
      .ilike("title", `%${q}%`)
      .order("added_at", { ascending: false })
      .limit(8);
    return (data as LibraryHit[] | null) ?? [];
  } catch {
    return [];
  }
}

type SavedTitleHit = Pick<
  TitleRow,
  "id" | "tmdb_id" | "media_type" | "status"
>;

function mediaKey(mediaType: "movie" | "tv", tmdbId: number) {
  return `${mediaType}-${tmdbId}`;
}

async function findSavedTitles(
  results: TmdbMediaResult[],
): Promise<Record<string, SavedTitleHit>> {
  const ids = [...new Set(results.map((result) => result.id))];
  if (ids.length === 0) return {};

  try {
    const db = await getLibraryClient();
    const { data } = await db
      .from("titles")
      .select("id, tmdb_id, media_type, status")
      .in("tmdb_id", ids);
    return Object.fromEntries(
      ((data as SavedTitleHit[] | null) ?? []).map((title) => [
        mediaKey(title.media_type, title.tmdb_id),
        title,
      ]),
    );
  } catch {
    return {};
  }
}

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function resolvePersonMatch(
  people: TmdbPersonResult[],
  query: string,
  directMediaCount: number,
) {
  const normalizedQuery = normalizedName(query);
  const ranked = people
    .filter((person) => person.name)
    .slice()
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const exact = ranked.find(
    (person) => normalizedName(person.name ?? "") === normalizedQuery,
  );
  if (exact) return exact;

  if (normalizedQuery.length < 3) return null;
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const strongPartial = ranked.find((person) => {
    const name = normalizedName(person.name ?? "");
    const nameTokens = name.split(" ").filter(Boolean);
    if (queryTokens.length === 1 && nameTokens.includes(normalizedQuery)) {
      return true;
    }
    return (
      normalizedQuery.length >= 4 &&
      (name.startsWith(normalizedQuery) ||
        queryTokens.every((queryToken) =>
          nameTokens.some((nameToken) => nameToken.startsWith(queryToken)),
        ))
    );
  });
  if (strongPartial) return strongPartial;

  // When TMDB also found a title, avoid attaching a merely adjacent celebrity
  // result. With no title matches, the top person is still the most useful
  // fallback for a misspelled or unusually formatted name.
  if (directMediaCount > 0) return null;
  return ranked[0] ?? null;
}

export async function GET(request: Request) {
  const unauthorized = await appApiUnauthorizedResponse();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ library: [], results: [] });

  try {
    // Keep direct library matching instant while the same query searches the
    // catalogue and people. Person credits are fetched only for a confident
    // match, so ordinary title queries stay to one TMDB request.
    const [library, search] = await Promise.all([
      searchLibrary(q.trim()),
      searchAll(q.trim()),
    ]);

    const person = resolvePersonMatch(
      search.people,
      q.trim(),
      search.media.length,
    );
    const personResults: TmdbMediaResult[] = person
      ? (await getPersonRelevantCredits(
          person.id,
          person.known_for_department,
        ).catch(() => []))
          .filter((credit) => credit.poster_path)
          .slice(0, 12)
          .map((credit) => ({ ...credit }))
      : [];
    const personKeys = new Set(
      personResults.map((result) => mediaKey(result.media_type, result.id)),
    );
    const results = search.media
      .filter(
        (result) => !personKeys.has(mediaKey(result.media_type, result.id)),
      )
      .slice(0, 12);
    const saved = await findSavedTitles([...personResults, ...results]);

    return NextResponse.json({
      library,
      results,
      personMatch: person && personResults.length > 0
        ? {
            id: person.id,
            name: person.name ?? "Unknown",
            profile_path: person.profile_path ?? null,
            known_for_department: person.known_for_department ?? null,
            results: personResults,
          }
        : null,
      saved,
      approximate: search.approximate,
      approxQuery: search.approxQuery,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TMDB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
