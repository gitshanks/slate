import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeProfileTaste, normalizeTopIds } from "../lib/profile-taste-core.ts";

const NOW = new Date("2026-11-25T12:00:00Z");

function row(overrides) {
  return {
    id: overrides.id,
    tmdb_id: 1,
    media_type: "movie",
    title: overrides.id,
    poster_path: null,
    backdrop_path: null,
    release_date: "2020-01-01",
    runtime: 120,
    genres: [],
    status: "watched",
    rating: null,
    added_at: "2026-01-10T00:00:00Z",
    watched_at: "2026-03-10T00:00:00Z",
    current_season: null,
    current_episode: null,
    seasons: null,
    ...overrides,
  };
}

describe("profile taste", () => {
  it("adds film runtimes and watched episodes into hours", () => {
    const taste = computeProfileTaste({
      titles: [
        row({ id: "a", runtime: 120 }),
        row({ id: "b", runtime: 90, watched_at: "2025-05-01T00:00:00Z" }),
        row({ id: "want", status: "want", runtime: 600 }),
        row({
          id: "show",
          media_type: "tv",
          status: "watching",
          runtime: 60,
          seasons: [{ n: 1, c: 10 }],
          current_season: 1,
          current_episode: 4,
        }),
      ],
      episodes: [
        { title_id: "show", watched_at: "2026-02-01T00:00:00Z" },
        { title_id: "show", watched_at: "2026-02-02T00:00:00Z" },
        { title_id: "show", watched_at: "2025-02-03T00:00:00Z" },
      ],
      listCount: 2,
      topIds: [],
      now: NOW,
    });
    // 120 + 90 + 3 × 60 = 390 minutes; this year 120 + 2 × 60 = 240.
    assert.equal(taste.hours, 7);
    assert.equal(taste.hoursThisYear, 4);
    assert.deepEqual(taste.counts, { watched: 2, watching: 1, upNext: 1, lists: 2 });
    assert.equal(taste.watching[0].progressLabel, "Season 1, episode 4 of 10");
    assert.equal(taste.watching[0].progress, 0.3);
  });

  it("counts a finished show's episodes when none were marked one by one", () => {
    const taste = computeProfileTaste({
      titles: [
        row({ id: "s", media_type: "tv", runtime: null, seasons: [{ n: 0, c: 3 }, { n: 1, c: 8 }] }),
      ],
      episodes: [],
      listCount: 0,
      topIds: [],
      now: NOW,
    });
    // Eight regular episodes at the 45-minute fallback: six hours.
    assert.equal(taste.hours, 6);
    assert.equal(taste.shows, 1);
  });

  it("ranks genres, splits ratings and fills the year", () => {
    const sci = { id: 878, name: "Science Fiction" };
    const drama = { id: 18, name: "Drama" };
    const titles = [
      row({ id: "1", genres: [sci, drama], rating: 3, watched_at: "2026-11-02T00:00:00Z" }),
      row({ id: "2", genres: [sci], rating: 3, watched_at: "2026-11-03T00:00:00Z" }),
      row({ id: "3", genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }], media_type: "tv", rating: 2 }),
      row({ id: "4", genres: [drama], rating: 2 }),
      row({ id: "5", genres: [], rating: 1, watched_at: "2025-12-01T00:00:00Z" }),
    ];
    const taste = computeProfileTaste({ titles, episodes: [], listCount: 0, topIds: [], now: NOW });
    assert.deepEqual(taste.genres.map((g) => g.name), ["Sci-fi", "Drama"]);
    assert.equal(taste.genres[0].share, 3 / 5);
    assert.equal(taste.tagline, "Mostly sci-fi and drama");
    assert.equal(taste.ratings.rated, 5);
    assert.equal(taste.ratings.verdict, "Generous");
    assert.equal(taste.year.months[10], 2);
    assert.equal(taste.year.months[2], 2);
    assert.equal(taste.year.total, 4);
    assert.deepEqual(taste.recent.map((t) => t.id), ["2", "1", "3", "4"]);
  });

  it("holds back the rating split until five are rated", () => {
    const taste = computeProfileTaste({
      titles: [row({ id: "1", rating: 3 })],
      episodes: [],
      listCount: 0,
      topIds: [],
      now: NOW,
    });
    assert.equal(taste.ratings, null);
    assert.equal(taste.tagline, null);
  });

  it("keeps the Top 4 in order and drops titles no longer on the slate", () => {
    const taste = computeProfileTaste({
      titles: [row({ id: "a" }), row({ id: "b" }), row({ id: "gone", status: "dropped" })],
      episodes: [],
      listCount: 0,
      topIds: ["b", "missing", "gone", "a"],
      now: NOW,
    });
    assert.deepEqual(taste.top.map((t) => t.id), ["b", "a"]);
  });

  it("cleans a submitted Top 4", () => {
    const known = new Set(["a", "b", "c", "d", "e"]);
    assert.deepEqual(normalizeTopIds(["a", "a", "x", "b", "c", "d", "e"], known), ["a", "b", "c", "d"]);
    assert.deepEqual(normalizeTopIds("a", known), []);
  });
});
