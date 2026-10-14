// Per-episode progress math — pure, client-safe, unit-tested in
// tests/episode-progress.test.mjs. Seasons are canonical {n, c} pairs
// (regular seasons only, ascending).

export interface SeasonCount {
  n: number;
  c: number;
}

export function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

function orderedSeasons(seasons: SeasonCount[]): SeasonCount[] {
  return seasons
    .filter((s) => s.n >= 1 && s.c > 0)
    .slice()
    .sort((a, b) => a.n - b.n);
}

/** Every episode key in canonical watch order. */
export function allEpisodeKeys(seasons: SeasonCount[]): string[] {
  const keys: string[] = [];
  for (const season of orderedSeasons(seasons)) {
    for (let episode = 1; episode <= season.c; episode += 1) {
      keys.push(episodeKey(season.n, episode));
    }
  }
  return keys;
}

export function totalEpisodes(seasons: SeasonCount[]): number {
  return orderedSeasons(seasons).reduce((sum, s) => sum + s.c, 0);
}

/**
 * Marking an episode watched cascades backwards (TV Time pattern): checking
 * E5 also checks E1–E4 of every season up to it, so a mid-series check-in
 * never leaves phantom gaps.
 */
export function cascadeKeys(
  seasons: SeasonCount[],
  season: number,
  episode: number,
): string[] {
  const keys: string[] = [];
  for (const s of orderedSeasons(seasons)) {
    if (s.n > season) break;
    const last = s.n === season ? Math.min(episode, s.c) : s.c;
    for (let e = 1; e <= last; e += 1) keys.push(episodeKey(s.n, e));
  }
  return keys;
}

/** First unwatched episode in canonical order, or null when complete. */
export function nextUnwatched(
  seasons: SeasonCount[],
  watched: ReadonlySet<string>,
): { season: number; episode: number } | null {
  for (const s of orderedSeasons(seasons)) {
    for (let e = 1; e <= s.c; e += 1) {
      if (!watched.has(episodeKey(s.n, e))) return { season: s.n, episode: e };
    }
  }
  return null;
}

/** Step one episode across season boundaries. Null past either end. */
export function stepEpisode(
  seasons: SeasonCount[],
  season: number,
  episode: number,
  direction: -1 | 1,
): { season: number; episode: number } | null {
  const ordered = orderedSeasons(seasons);
  const current = ordered.find((s) => s.n === season);

  if (direction === 1) {
    // Unknown counts still advance within the season (the player knows best
    // once episodes load); known counts roll into the next season.
    if (!current) return { season, episode: episode + 1 };
    if (episode < current.c) return { season, episode: episode + 1 };
    const nextSeason = ordered.find((s) => s.n > season);
    return nextSeason ? { season: nextSeason.n, episode: 1 } : null;
  }

  if (episode > 1) return { season, episode: episode - 1 };
  const prevSeason = ordered
    .slice()
    .reverse()
    .find((s) => s.n < season);
  return prevSeason ? { season: prevSeason.n, episode: prevSeason.c } : null;
}

export function isComplete(
  seasons: SeasonCount[],
  watched: ReadonlySet<string>,
): boolean {
  const total = totalEpisodes(seasons);
  if (total === 0) return false;
  return nextUnwatched(seasons, watched) === null;
}

/** Advance the resume pointer past a played episode (never backwards). */
export function advancePointer(
  seasons: SeasonCount[],
  current: { season: number; episode: number } | null,
  played: { season: number; episode: number },
): { season: number; episode: number } {
  const next = stepEpisode(seasons, played.season, played.episode, 1);
  const candidate = next ?? played;
  if (!current) return candidate;
  if (candidate.season > current.season) return candidate;
  if (candidate.season === current.season && candidate.episode > current.episode) {
    return candidate;
  }
  return current;
}
