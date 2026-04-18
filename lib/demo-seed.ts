// Synthetic seed data for the public demo deployment.
// Loaded by lib/demo-client.ts as the immutable base layer; per-visitor
// overlays (adds, edits, deletions) live in a cookie on top of this.
//
// Real TMDB ids + poster paths so posters, cast, providers stay live against
// the TMDB CDN. Ids are stable strings so cookie overlays can reference them.

import type { ListRow, TitleRow } from "@/lib/types";

// Fixed ISO timestamps (descending, so default ordering looks natural).
function ts(daysAgo: number): string {
  // 2026-04-01 baseline so the list doesn't drift.
  const base = Date.UTC(2026, 3, 1);
  return new Date(base - daysAgo * 86400_000).toISOString();
}

// Helper so every row is fully typed without restating every field.
function title(partial: Partial<TitleRow> & Pick<TitleRow, "id" | "tmdb_id" | "media_type" | "title" | "status">): TitleRow {
  return {
    original_title: partial.title,
    overview: null,
    poster_path: null,
    backdrop_path: null,
    release_date: null,
    runtime: null,
    genres: null,
    rating: null,
    review: null,
    favorite: false,
    added_at: ts(0),
    watched_at: null,
    tmdb_rating: null,
    tmdb_vote_count: null,
    ...partial,
  };
}

export const DEMO_TITLES: TitleRow[] = [
  // ── Want (10) ──────────────────────────────────────────────────────
  title({
    id: "demo-want-1",
    tmdb_id: 693134,
    media_type: "movie",
    title: "Dune: Part Two",
    overview:
      "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.",
    poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop_path: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
    release_date: "2024-02-27",
    runtime: 167,
    genres: [{ id: 878, name: "Science Fiction" }, { id: 12, name: "Adventure" }],
    status: "want",
    added_at: ts(1),
  }),
  title({
    id: "demo-want-2",
    tmdb_id: 95396,
    media_type: "tv",
    title: "Severance",
    overview:
      "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
    poster_path: "/lu1DvG9UJzGPVqQ4Bp0cfsfeOQg.jpg",
    backdrop_path: "/iPdB4scKXjlomDFk8UyXHnFLfz3.jpg",
    release_date: "2022-02-17",
    genres: [{ id: 9648, name: "Mystery" }, { id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }],
    status: "want",
    added_at: ts(2),
  }),
  title({
    id: "demo-want-3",
    tmdb_id: 933260,
    media_type: "movie",
    title: "The Substance",
    overview:
      "A fading celebrity takes a black-market drug that creates a younger, better version of herself — with horrifying consequences.",
    poster_path: "/lqoMzCcZYEFK729d6qzt349fB4o.jpg",
    backdrop_path: "/t98L9uphqBSNn2Mkvdm3xSFCQyi.jpg",
    release_date: "2024-09-07",
    runtime: 141,
    genres: [{ id: 27, name: "Horror" }, { id: 878, name: "Science Fiction" }],
    status: "want",
    added_at: ts(3),
  }),
  title({
    id: "demo-want-4",
    tmdb_id: 126308,
    media_type: "tv",
    title: "Shōgun",
    overview:
      "In Japan, 1600, at the dawn of a century-defining civil war, Lord Yoshii Toranaga is fighting for his life.",
    poster_path: "/7O4iVfOMQmdCSxhOg1WnzG1AwQW.jpg",
    backdrop_path: "/67VbpYhB3BqmqoCgDBrp9vvzrgn.jpg",
    release_date: "2024-02-27",
    genres: [{ id: 18, name: "Drama" }, { id: 10759, name: "Action & Adventure" }, { id: 10768, name: "War & Politics" }],
    status: "want",
    added_at: ts(4),
  }),
  title({
    id: "demo-want-5",
    tmdb_id: 100088,
    media_type: "tv",
    title: "The Last of Us",
    overview:
      "Twenty years after modern civilization has been destroyed, Joel is hired to smuggle Ellie out of an oppressive quarantine zone.",
    poster_path: "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg",
    backdrop_path: "/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg",
    release_date: "2023-01-15",
    genres: [{ id: 18, name: "Drama" }, { id: 10765, name: "Sci-Fi & Fantasy" }],
    status: "want",
    added_at: ts(5),
  }),
  title({
    id: "demo-want-6",
    tmdb_id: 666277,
    media_type: "movie",
    title: "Past Lives",
    overview:
      "Nora and Hae Sung, two deeply connected childhood friends, are reunited in New York for one fateful week.",
    poster_path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    backdrop_path: "/yRSYT00Xc6BTqwwVnp4xaEpaoF.jpg",
    release_date: "2023-06-02",
    runtime: 106,
    genres: [{ id: 18, name: "Drama" }, { id: 10749, name: "Romance" }],
    status: "want",
    added_at: ts(6),
  }),
  title({
    id: "demo-want-7",
    tmdb_id: 106379,
    media_type: "tv",
    title: "Fallout",
    overview:
      "In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers.",
    poster_path: "/AnsSKfdeqvpPZjKTWjw96VOGQNK.jpg",
    backdrop_path: "/rjdFbVKVBgaS4ZFjX2FQaK4muFN.jpg",
    release_date: "2024-04-10",
    genres: [{ id: 10759, name: "Action & Adventure" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 35, name: "Comedy" }],
    status: "want",
    added_at: ts(7),
  }),
  title({
    id: "demo-want-8",
    tmdb_id: 792307,
    media_type: "movie",
    title: "Poor Things",
    overview:
      "Brought back to life by an unorthodox scientist, a young woman runs off with a lawyer on a whirlwind adventure across the continents.",
    poster_path: "/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg",
    backdrop_path: "/sqLowAZAGLAe5XYHUyxWLFZV6iS.jpg",
    release_date: "2023-12-07",
    runtime: 142,
    genres: [{ id: 35, name: "Comedy" }, { id: 18, name: "Drama" }, { id: 10749, name: "Romance" }],
    status: "want",
    added_at: ts(8),
  }),
  title({
    id: "demo-want-9",
    tmdb_id: 64196,
    media_type: "tv",
    title: "True Detective",
    overview:
      "An American anthology police detective series utilizing multiple timelines in which investigations seem to unearth personal and professional secrets.",
    poster_path: "/a7cEYGaKxQsBq0w9UnYGdpjcJw4.jpg",
    backdrop_path: "/g4zdnTQ7Gfrib4j7HMIUnRlUpbE.jpg",
    release_date: "2014-01-12",
    genres: [{ id: 80, name: "Crime" }, { id: 18, name: "Drama" }, { id: 9648, name: "Mystery" }],
    status: "want",
    added_at: ts(9),
  }),
  title({
    id: "demo-want-10",
    tmdb_id: 872585,
    media_type: "movie",
    title: "Oppenheimer",
    overview:
      "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop_path: "/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    release_date: "2023-07-19",
    runtime: 181,
    genres: [{ id: 18, name: "Drama" }, { id: 36, name: "History" }],
    status: "want",
    added_at: ts(10),
  }),

  // ── Watching (5) ──────────────────────────────────────────────────
  title({
    id: "demo-watching-1",
    tmdb_id: 1399,
    media_type: "tv",
    title: "Succession",
    overview:
      "Follow the lives of the Roy family as they contemplate their future once their aging father begins to step back from the media and entertainment conglomerate they control.",
    poster_path: "/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg",
    backdrop_path: "/eKnCOG5ZX0BXeSpmgZ0tnJNs7y1.jpg",
    release_date: "2018-06-03",
    genres: [{ id: 18, name: "Drama" }],
    status: "watching",
    added_at: ts(11),
  }),
  title({
    id: "demo-watching-2",
    tmdb_id: 94605,
    media_type: "tv",
    title: "Arcane",
    overview:
      "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.",
    poster_path: "/abf8tHznhSvl9BAElD2cQeRr7do.jpg",
    backdrop_path: "/8AetLFWzbH7gO80xaj7ug2ul77d.jpg",
    release_date: "2021-11-06",
    genres: [{ id: 16, name: "Animation" }, { id: 10765, name: "Sci-Fi & Fantasy" }, { id: 18, name: "Drama" }],
    status: "watching",
    added_at: ts(12),
  }),
  title({
    id: "demo-watching-3",
    tmdb_id: 60059,
    media_type: "tv",
    title: "Better Call Saul",
    overview:
      "Six years before Saul Goodman meets Walter White. We meet him when the man who will become Saul Goodman is known as Jimmy McGill.",
    poster_path: "/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg",
    backdrop_path: "/yNVh3dZnuVkoG11eY89m3jAIPZe.jpg",
    release_date: "2015-02-08",
    genres: [{ id: 80, name: "Crime" }, { id: 18, name: "Drama" }],
    status: "watching",
    added_at: ts(13),
  }),
  title({
    id: "demo-watching-4",
    tmdb_id: 83867,
    media_type: "tv",
    title: "Andor",
    overview:
      "In an era filled with danger, deception and intrigue, Cassian Andor embarks on the path that is destined to turn him into a rebel hero.",
    poster_path: "/cdeGFeVEjP7TM5Vj5Mu7aKJFjC6.jpg",
    backdrop_path: "/qjMftiLkHdxWzdydj1qK7wkpRW.jpg",
    release_date: "2022-09-21",
    genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }, { id: 10759, name: "Action & Adventure" }, { id: 18, name: "Drama" }],
    status: "watching",
    added_at: ts(14),
  }),
  title({
    id: "demo-watching-5",
    tmdb_id: 87108,
    media_type: "tv",
    title: "Chernobyl",
    overview:
      "The true story of one of the worst man-made catastrophes in history — the catastrophic nuclear accident at Chernobyl.",
    poster_path: "/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg",
    backdrop_path: "/ddX1S39UyQ7bTcwNWFe6WWy8BGI.jpg",
    release_date: "2019-05-06",
    genres: [{ id: 18, name: "Drama" }, { id: 36, name: "History" }],
    status: "watching",
    added_at: ts(15),
  }),

  // ── Watched (12) ──────────────────────────────────────────────────
  title({
    id: "demo-watched-1",
    tmdb_id: 545611,
    media_type: "movie",
    title: "Everything Everywhere All at Once",
    overview:
      "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save existence by exploring other universes.",
    poster_path: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    backdrop_path: "/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg",
    release_date: "2022-03-24",
    runtime: 140,
    genres: [{ id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 878, name: "Science Fiction" }],
    status: "watched",
    rating: 3,
    review: "Beautifully unhinged. Rarely does a film earn this much chaos.",
    favorite: true,
    added_at: ts(16),
    watched_at: ts(16),
  }),
  title({
    id: "demo-watched-2",
    tmdb_id: 1396,
    media_type: "tv",
    title: "Breaking Bad",
    overview:
      "A high school chemistry teacher turned methamphetamine producer partners with a former student to secure his family's financial future.",
    poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdrop_path: "/n3z4ndJqdQoAnfhSsrMjcbYl9vr.jpg",
    release_date: "2008-01-20",
    genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
    status: "watched",
    rating: 3,
    favorite: true,
    added_at: ts(17),
    watched_at: ts(17),
  }),
  title({
    id: "demo-watched-3",
    tmdb_id: 136315,
    media_type: "tv",
    title: "The Bear",
    overview:
      "A young chef from the fine dining world returns to Chicago to run his late brother's Italian beef sandwich shop.",
    poster_path: "/zPyHHCHQwFmHzTSsmbRXIjjrygZ.jpg",
    backdrop_path: "/jbKK6JBHAIFGoaL3vw5I0D6Y1YO.jpg",
    release_date: "2022-06-23",
    genres: [{ id: 35, name: "Comedy" }, { id: 18, name: "Drama" }],
    status: "watched",
    rating: 3,
    review: "Stress incarnate. Carmy, Sydney, and Richie are a masterclass in character writing.",
    added_at: ts(18),
    watched_at: ts(18),
  }),
  title({
    id: "demo-watched-4",
    tmdb_id: 496243,
    media_type: "movie",
    title: "Parasite",
    overview:
      "All unemployed, Ki-taek's family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.",
    poster_path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    backdrop_path: "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
    release_date: "2019-05-30",
    runtime: 133,
    genres: [{ id: 35, name: "Comedy" }, { id: 53, name: "Thriller" }, { id: 18, name: "Drama" }],
    status: "watched",
    rating: 3,
    favorite: true,
    added_at: ts(19),
    watched_at: ts(19),
  }),
  title({
    id: "demo-watched-5",
    tmdb_id: 72879,
    media_type: "tv",
    title: "Fleabag",
    overview:
      "A hilarious and poignant window into the mind of a dry-witted, sexual, angry, grief-riddled woman, as she hurls herself headlong at modern living.",
    poster_path: "/3NTAbAiao4JLzFQw6YxP1YZppM8.jpg",
    backdrop_path: "/iWxaGYn6YnKtPuexxqFaxHVADwx.jpg",
    release_date: "2016-07-21",
    genres: [{ id: 35, name: "Comedy" }, { id: 18, name: "Drama" }],
    status: "watched",
    rating: 3,
    added_at: ts(20),
    watched_at: ts(20),
  }),
  title({
    id: "demo-watched-6",
    tmdb_id: 493922,
    media_type: "movie",
    title: "Hereditary",
    overview:
      "When the matriarch of the Graham family passes away, her daughter's family begins to unravel cryptic and increasingly terrifying secrets about their ancestry.",
    poster_path: "/p81ooARzjKi08WmvHxuM60L7vla.jpg",
    backdrop_path: "/eYw3WyTmSUrYWlmTny6UNEzIOZl.jpg",
    release_date: "2018-06-07",
    runtime: 127,
    genres: [{ id: 27, name: "Horror" }, { id: 9648, name: "Mystery" }, { id: 53, name: "Thriller" }],
    status: "watched",
    rating: 2,
    added_at: ts(21),
    watched_at: ts(21),
  }),
  title({
    id: "demo-watched-7",
    tmdb_id: 244786,
    media_type: "movie",
    title: "Whiplash",
    overview:
      "A young and talented drummer attending a prestigious music academy finds himself under the wing of the most respected professor at the school.",
    poster_path: "/6uSPcdGNA2A6vJmCagXkvnutegs.jpg",
    backdrop_path: "/6bbZ6XyvgfjhQwbplnUh1LSj1ky.jpg",
    release_date: "2014-10-10",
    runtime: 106,
    genres: [{ id: 18, name: "Drama" }, { id: 10402, name: "Music" }],
    status: "watched",
    rating: 3,
    review: "Not my tempo. A perfect film.",
    favorite: true,
    added_at: ts(22),
    watched_at: ts(22),
  }),
  title({
    id: "demo-watched-8",
    tmdb_id: 87196,
    media_type: "tv",
    title: "The Queen's Gambit",
    overview:
      "In a Kentucky orphanage in the 1950s, a young girl discovers an astonishing talent for chess while struggling with addiction.",
    poster_path: "/zU0htwkhNvBQdVSIKB9s6hgVeFK.jpg",
    backdrop_path: "/34OGjFEbHj0E3lE2w0iTUVq0CBz.jpg",
    release_date: "2020-10-23",
    genres: [{ id: 18, name: "Drama" }],
    status: "watched",
    rating: 2,
    added_at: ts(23),
    watched_at: ts(23),
  }),
  title({
    id: "demo-watched-9",
    tmdb_id: 376867,
    media_type: "movie",
    title: "Moonlight",
    overview:
      "The tender, heartbreaking story of a young man's struggle to find himself, told across three defining chapters in his life.",
    poster_path: "/4911T5FbJ9eD2Faz5Z8cT3SUhU3.jpg",
    backdrop_path: "/A4Fvas8wDTrU6sjnbhyyRpMTwUJ.jpg",
    release_date: "2016-10-21",
    runtime: 111,
    genres: [{ id: 18, name: "Drama" }],
    status: "watched",
    rating: 3,
    added_at: ts(24),
    watched_at: ts(24),
  }),
  title({
    id: "demo-watched-10",
    tmdb_id: 1104,
    media_type: "tv",
    title: "Mad Men",
    overview:
      "A sexy, stylized and provocative drama about the lives and relationships of the ruthlessly competitive men and women of Madison Avenue advertising.",
    poster_path: "/7Mu5TXVXgOxTnsUUtn8fYmLHjDN.jpg",
    backdrop_path: "/4rfApU8VxjdKpLTS83bymTLmbVP.jpg",
    release_date: "2007-07-19",
    genres: [{ id: 18, name: "Drama" }],
    status: "watched",
    rating: 3,
    added_at: ts(25),
    watched_at: ts(25),
  }),
  title({
    id: "demo-watched-11",
    tmdb_id: 313369,
    media_type: "movie",
    title: "La La Land",
    overview:
      "A jazz pianist falls for an aspiring actress in Los Angeles.",
    poster_path: "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    backdrop_path: "/nlMHGdmVkVA9GfUo1fWqwDWJkmj.jpg",
    release_date: "2016-11-29",
    runtime: 128,
    genres: [{ id: 35, name: "Comedy" }, { id: 18, name: "Drama" }, { id: 10749, name: "Romance" }, { id: 10402, name: "Music" }],
    status: "watched",
    rating: 2,
    added_at: ts(26),
    watched_at: ts(26),
  }),
  title({
    id: "demo-watched-12",
    tmdb_id: 329865,
    media_type: "movie",
    title: "Arrival",
    overview:
      "Taking place after alien crafts land around the world, an expert linguist is recruited by the military to determine whether they come in peace or are a threat.",
    poster_path: "/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
    backdrop_path: "/yIZ1xendyqKvY3FGeeUYUd5X9Mm.jpg",
    release_date: "2016-11-11",
    runtime: 116,
    genres: [{ id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }, { id: 9648, name: "Mystery" }],
    status: "watched",
    rating: 3,
    added_at: ts(27),
    watched_at: ts(27),
  }),

  // ── Dropped (3) ───────────────────────────────────────────────────
  title({
    id: "demo-dropped-1",
    tmdb_id: 94997,
    media_type: "tv",
    title: "House of the Dragon",
    overview:
      "The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke.",
    poster_path: "/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg",
    backdrop_path: "/etj8E2o4Bud70HEi3b5DBrx0hvl.jpg",
    release_date: "2022-08-21",
    genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }, { id: 18, name: "Drama" }, { id: 10759, name: "Action & Adventure" }],
    status: "dropped",
    added_at: ts(28),
  }),
  title({
    id: "demo-dropped-2",
    tmdb_id: 71912,
    media_type: "tv",
    title: "The Witcher",
    overview:
      "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.",
    poster_path: "/cZ0d3rtvXPVvuiX22sP79K3Hmjz.jpg",
    backdrop_path: "/7HtvsC4OATmJzKmGSpPft7aHJNU.jpg",
    release_date: "2019-12-20",
    genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }, { id: 10759, name: "Action & Adventure" }, { id: 18, name: "Drama" }],
    status: "dropped",
    added_at: ts(29),
  }),
  title({
    id: "demo-dropped-3",
    tmdb_id: 63247,
    media_type: "tv",
    title: "Westworld",
    overview:
      "A dark odyssey about the dawn of artificial consciousness and the evolution of sin, set at the intersection of the near future and the reimagined past.",
    poster_path: "/8MfgyFHf7XEboZJPZXCIDqqiz6e.jpg",
    backdrop_path: "/9YqHkB70E8vlFO47j5Ylsp0IAfd.jpg",
    release_date: "2016-10-02",
    genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }, { id: 18, name: "Drama" }, { id: 37, name: "Western" }],
    status: "dropped",
    added_at: ts(30),
  }),
];

// ── Lists ───────────────────────────────────────────────────────────

export const DEMO_LISTS: ListRow[] = [
  {
    id: "demo-list-1",
    slug: "cozy-winter",
    name: "Cozy winter",
    description: "Films and series that feel like a warm blanket when it's cold outside.",
    created_at: ts(30),
  },
  {
    id: "demo-list-2",
    slug: "a24-horror",
    name: "A24 horror",
    description: "Slow-burn, unsettling, beautifully shot.",
    created_at: ts(25),
  },
  {
    id: "demo-list-3",
    slug: "all-time-favorites",
    name: "All-time favorites",
    description: "The ones I'd rewatch any day.",
    created_at: ts(20),
  },
];

export interface DemoListTitle {
  list_id: string;
  title_id: string;
  position: number;
  added_at: string;
}

export const DEMO_LIST_TITLES: DemoListTitle[] = [
  // Cozy winter
  { list_id: "demo-list-1", title_id: "demo-watched-11", position: 0, added_at: ts(30) },
  { list_id: "demo-list-1", title_id: "demo-watched-5", position: 1, added_at: ts(30) },
  { list_id: "demo-list-1", title_id: "demo-watched-9", position: 2, added_at: ts(30) },
  { list_id: "demo-list-1", title_id: "demo-want-6", position: 3, added_at: ts(30) },

  // A24 horror
  { list_id: "demo-list-2", title_id: "demo-watched-6", position: 0, added_at: ts(25) },
  { list_id: "demo-list-2", title_id: "demo-want-3", position: 1, added_at: ts(25) },
  { list_id: "demo-list-2", title_id: "demo-want-8", position: 2, added_at: ts(25) },

  // All-time favorites
  { list_id: "demo-list-3", title_id: "demo-watched-1", position: 0, added_at: ts(20) },
  { list_id: "demo-list-3", title_id: "demo-watched-2", position: 1, added_at: ts(20) },
  { list_id: "demo-list-3", title_id: "demo-watched-4", position: 2, added_at: ts(20) },
  { list_id: "demo-list-3", title_id: "demo-watched-7", position: 3, added_at: ts(20) },
  { list_id: "demo-list-3", title_id: "demo-watched-12", position: 4, added_at: ts(20) },
];
