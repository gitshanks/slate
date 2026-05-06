// Cookie-backed mock Supabase client for the public demo deployment.
// Covers exactly the query surface the app uses — no more, no less.
//
// State model:
//   Base layer : DEMO_TITLES / DEMO_LISTS / DEMO_LIST_TITLES (immutable seed)
//   Overlay    : JSON cookie "slate-demo-state" (per-visitor mutations)
//   On read    : merge seed + overlay (patches override, deletions hide)
//   On write   : update overlay, persist cookie (Server Actions only)

import "server-only";
import { cookies } from "next/headers";
import {
  DEMO_TITLES,
  DEMO_LISTS,
  DEMO_LIST_TITLES,
  type DemoListTitle,
} from "@/lib/demo-seed";
import type { TitleRow, ListRow } from "@/lib/types";

// ─── Cookie state ─────────────────────────────────────────────────

const COOKIE_KEY = "slate-demo-state";
const COOKIE_BUDGET = 3800; // bytes; leave headroom below 4 096

interface DemoState {
  titlePatches: Record<string, Partial<TitleRow>>; // patches to seed rows
  addedTitles: TitleRow[]; // visitor-added rows not in seed
  deletedIds: string[]; // seed or added IDs that were removed
  addedLists: ListRow[]; // visitor-added lists
  deletedListIds: string[];
  addedListTitles: DemoListTitle[];
  removedListTitleKeys: string[]; // "listId:titleId"
}

function emptyState(): DemoState {
  return {
    titlePatches: {},
    addedTitles: [],
    deletedIds: [],
    addedLists: [],
    deletedListIds: [],
    addedListTitles: [],
    removedListTitleKeys: [],
  };
}

async function readState(): Promise<DemoState> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE_KEY)?.value;
    if (!raw) return emptyState();
    return JSON.parse(raw) as DemoState;
  } catch {
    return emptyState();
  }
}

async function writeState(next: DemoState): Promise<void> {
  try {
    let json = JSON.stringify(next);
    // Budget: if over limit, drop oldest added titles (sacrificial trimming)
    if (json.length > COOKIE_BUDGET && next.addedTitles.length > 0) {
      next = { ...next, addedTitles: next.addedTitles.slice(-3) };
      json = JSON.stringify(next);
    }
    // If still over, drop oldest title patches
    if (json.length > COOKIE_BUDGET) {
      const keys = Object.keys(next.titlePatches);
      const trimmed: Record<string, Partial<TitleRow>> = {};
      keys.slice(-8).forEach((k) => { trimmed[k] = next.titlePatches[k]; });
      next = { ...next, titlePatches: trimmed };
      json = JSON.stringify(next);
    }
    if (json.length > COOKIE_BUDGET) return; // give up gracefully
    const jar = await cookies();
    jar.set(COOKIE_KEY, json, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
  } catch {
    // cookies().set() only works inside Server Actions; reads from Server
    // Components will still return the unmodified cookie, which is fine.
  }
}

// ─── Merged-view helpers ──────────────────────────────────────────

function allTitles(state: DemoState): TitleRow[] {
  const patched = DEMO_TITLES.map((t) =>
    state.titlePatches[t.id] ? { ...t, ...state.titlePatches[t.id] } : t
  );
  const added = state.addedTitles.map((t) =>
    state.titlePatches[t.id] ? { ...t, ...state.titlePatches[t.id] } : t
  );
  return [...patched, ...added].filter((t) => !state.deletedIds.includes(t.id));
}

function allLists(state: DemoState): ListRow[] {
  return [...DEMO_LISTS, ...state.addedLists].filter(
    (l) => !state.deletedListIds.includes(l.id)
  );
}

function allListTitles(state: DemoState): DemoListTitle[] {
  const base = DEMO_LIST_TITLES.filter(
    (lt) => !state.removedListTitleKeys.includes(`${lt.list_id}:${lt.title_id}`)
  );
  return [...base, ...state.addedListTitles].filter(
    (lt) => !state.removedListTitleKeys.includes(`${lt.list_id}:${lt.title_id}`)
  );
}

// ─── Builder ─────────────────────────────────────────────────────

type FilterSpec =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "in"; col: string; val: unknown[] }
  | { kind: "ilike"; col: string; val: string };

type OpKind = "select" | "insert" | "upsert" | "update" | "delete";

interface BuilderState {
  table: string;
  op: OpKind;
  cols: string;
  filters: FilterSpec[];
  order: { col: string; ascending: boolean }[];
  limitN: number | null;
  isSingle: boolean;
  isMaybeSingle: boolean;
  mutData: unknown;
  upsertOpts: { onConflict?: string };
  // for .select("id").single() chained after upsert
  postMutCols: string | null;
  postMutSingle: boolean;
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: FilterSpec[]): T[] {
  return filters.reduce((acc, f) => {
    if (f.kind === "eq") return acc.filter((r: T) => r[f.col] === f.val);
    if (f.kind === "in") return acc.filter((r: T) => (f.val as unknown[]).includes(r[f.col]));
    if (f.kind === "ilike") {
      const pat = f.val.replace(/%/g, "").toLowerCase();
      return acc.filter((r: T) => String(r[f.col] ?? "").toLowerCase().includes(pat));
    }
    return acc;
  }, rows);
}

function applyOrder<T extends Record<string, unknown>>(rows: T[], order: { col: string; ascending: boolean }[]): T[] {
  if (!order.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { col, ascending } of order) {
      const av = a[col] as string | number | null;
      const bv = b[col] as string | number | null;
      if (av === bv) continue;
      if (av == null) return ascending ? 1 : -1;
      if (bv == null) return ascending ? -1 : 1;
      const cmp = av < bv ? -1 : 1;
      return ascending ? cmp : -cmp;
    }
    return 0;
  });
}

// Pick a subset of columns from a row object (for partial selects).
// If cols is "*" or empty, return the full row.
function pickCols(row: Record<string, unknown>, cols: string): Record<string, unknown> {
  if (!cols || cols.trim() === "*") return row;
  const wanted = cols.split(",").map((c) => c.trim().split(" ")[0].split("(")[0].trim());
  // If any col is "*", return full row
  if (wanted.includes("*")) return row;
  const result: Record<string, unknown> = {};
  for (const k of wanted) result[k] = row[k];
  return result;
}

function nanoid(): string {
  return `demo-usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Thenable builder — awaitable as `{ data, error }`.
// `then` must return a Promise so that calling `.then(transform)` as a method
// (e.g. `supabase.from("titles").select("tmdb_id").then(({data}) => ...)`)
// returns a real Promise rather than void.
type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = {
  select(cols?: string): QueryBuilder;
  eq(col: string, val: unknown): QueryBuilder;
  in(col: string, val: unknown[]): QueryBuilder;
  ilike(col: string, val: string): QueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  single(): QueryBuilder;
  maybeSingle(): QueryBuilder;
  then<R>(
    resolve: (v: QueryResult) => R,
    reject?: (e: unknown) => R
  ): Promise<R>;
};

function createBuilder(s: BuilderState): QueryBuilder {
  return {
    select(cols = "*") {
      if (s.op !== "select") return createBuilder({ ...s, postMutCols: cols });
      return createBuilder({ ...s, cols });
    },
    eq(col, val) {
      return createBuilder({ ...s, filters: [...s.filters, { kind: "eq", col, val }] });
    },
    in(col, val) {
      return createBuilder({ ...s, filters: [...s.filters, { kind: "in", col, val }] });
    },
    ilike(col, val) {
      return createBuilder({ ...s, filters: [...s.filters, { kind: "ilike", col, val }] });
    },
    order(col, opts) {
      return createBuilder({
        ...s,
        order: [...s.order, { col, ascending: opts?.ascending !== false }],
      });
    },
    limit(n) {
      return createBuilder({ ...s, limitN: n });
    },
    single() {
      if (s.op !== "select") return createBuilder({ ...s, postMutSingle: true });
      return createBuilder({ ...s, isSingle: true });
    },
    maybeSingle() {
      return createBuilder({ ...s, isMaybeSingle: true });
    },
    then(resolve, reject) {
      return executeBuilder(s).then(resolve, reject);
    },
  };
}

async function executeBuilder(b: BuilderState): Promise<{ data: unknown; error: unknown }> {
  const state = await readState();

  try {
    // ── Mutations ───────────────────────────────────────────────────
    if (b.op === "insert") return execInsert(b, state);
    if (b.op === "upsert") return execUpsert(b, state);
    if (b.op === "update") return execUpdate(b, state);
    if (b.op === "delete") return execDelete(b, state);

    // ── Selects ─────────────────────────────────────────────────────
    return execSelect(b, state);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { data: null, error: { message } };
  }
}

async function execSelect(
  b: BuilderState,
  state: DemoState
): Promise<{ data: unknown; error: null }> {
  let rows: Record<string, unknown>[] = [];

  if (b.table === "titles") {
    rows = allTitles(state) as unknown as Record<string, unknown>[];
  } else if (b.table === "lists") {
    rows = allLists(state) as unknown as Record<string, unknown>[];
  } else if (b.table === "list_titles") {
    const lts = allListTitles(state);
    const titles = allTitles(state);
    const titlesById = Object.fromEntries(titles.map((t) => [t.id, t]));

    rows = lts.map((lt) => {
      const row: Record<string, unknown> = {
        list_id: lt.list_id,
        title_id: lt.title_id,
        position: lt.position,
        added_at: lt.added_at,
      };
      // Handle "titles(*)" join pattern
      if (b.cols.includes("titles(")) {
        row.titles = titlesById[lt.title_id] ?? null;
      }
      return row;
    });
  }

  rows = applyFilters(rows, b.filters);
  rows = applyOrder(rows, b.order);
  if (b.limitN !== null) rows = rows.slice(0, b.limitN);

  // Project columns
  const projected = rows.map((r) => pickCols(r, b.cols));

  if (b.isSingle) {
    if (projected.length === 0)
      return { data: null, error: { message: "Row not found", code: "PGRST116" } } as never;
    return { data: projected[0], error: null };
  }
  if (b.isMaybeSingle) {
    return { data: projected[0] ?? null, error: null };
  }
  return { data: projected, error: null };
}

async function execInsert(
  b: BuilderState,
  state: DemoState
): Promise<{ data: unknown; error: unknown }> {
  const row = b.mutData as Record<string, unknown>;
  const next = { ...state };

  if (b.table === "titles") {
    const newTitle: TitleRow = {
      id: nanoid(),
      tmdb_id: Number(row.tmdb_id),
      media_type: row.media_type as TitleRow["media_type"],
      title: String(row.title ?? ""),
      original_title: (row.original_title as string | null) ?? null,
      overview: (row.overview as string | null) ?? null,
      poster_path: (row.poster_path as string | null) ?? null,
      backdrop_path: (row.backdrop_path as string | null) ?? null,
      release_date: (row.release_date as string | null) ?? null,
      runtime: (row.runtime as number | null) ?? null,
      genres: (row.genres as TitleRow["genres"]) ?? null,
      status: (row.status as TitleRow["status"]) ?? "want",
      rating: (row.rating as number | null) ?? null,
      review: (row.review as string | null) ?? null,
      favorite: Boolean(row.favorite ?? false),
      added_at: new Date().toISOString(),
      watched_at: (row.watched_at as string | null) ?? null,
      tmdb_rating: (row.tmdb_rating as number | null) ?? null,
      tmdb_vote_count: (row.tmdb_vote_count as number | null) ?? null,
      imdb_id: (row.imdb_id as string | null) ?? null,
      imdb_rating: (row.imdb_rating as number | null) ?? null,
      imdb_votes: (row.imdb_votes as number | null) ?? null,
      rt_score: (row.rt_score as number | null) ?? null,
      metacritic_score: (row.metacritic_score as number | null) ?? null,
      ratings_fetched_at: (row.ratings_fetched_at as string | null) ?? null,
      current_season: (row.current_season as number | null) ?? null,
      current_episode: (row.current_episode as number | null) ?? null,
      seasons: (row.seasons as TitleRow["seasons"]) ?? null,
    };
    next.addedTitles = [...state.addedTitles, newTitle];
    await writeState(next);
    return { data: newTitle, error: null };
  }

  if (b.table === "lists") {
    const newList: ListRow = {
      id: nanoid(),
      slug: String(row.slug ?? ""),
      name: String(row.name ?? ""),
      description: (row.description as string | null) ?? null,
      created_at: new Date().toISOString(),
    };
    next.addedLists = [...state.addedLists, newList];
    await writeState(next);
    return { data: newList, error: null };
  }

  if (b.table === "list_titles") {
    const lt: DemoListTitle = {
      list_id: String(row.list_id),
      title_id: String(row.title_id),
      position: Number(row.position ?? 0),
      added_at: new Date().toISOString(),
    };
    const key = `${lt.list_id}:${lt.title_id}`;
    // Check for duplicate
    const existing = allListTitles(state).some(
      (e) => e.list_id === lt.list_id && e.title_id === lt.title_id
    );
    if (existing) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
    next.addedListTitles = [...state.addedListTitles, lt];
    next.removedListTitleKeys = state.removedListTitleKeys.filter((k) => k !== key);
    await writeState(next);
    return { data: lt, error: null };
  }

  return { data: null, error: { message: `Unknown table: ${b.table}` } };
}

async function execUpsert(
  b: BuilderState,
  state: DemoState
): Promise<{ data: unknown; error: unknown }> {
  const row = b.mutData as Record<string, unknown>;

  if (b.table === "titles") {
    const tmdbId = Number(row.tmdb_id);
    const mediaType = row.media_type as string;

    // Check if a matching title exists (seed or added)
    const existingSeed = DEMO_TITLES.find(
      (t) => t.tmdb_id === tmdbId && t.media_type === mediaType
    );
    const existingAdded = state.addedTitles.find(
      (t) => t.tmdb_id === tmdbId && t.media_type === mediaType
    );
    const existing = existingSeed ?? existingAdded;

    const next = { ...state };
    let resultId: string;

    if (existing && !state.deletedIds.includes(existing.id)) {
      // Update via patch
      resultId = existing.id;
      next.titlePatches = {
        ...state.titlePatches,
        [existing.id]: { ...(state.titlePatches[existing.id] ?? {}), ...row } as Partial<TitleRow>,
      };
    } else {
      // Insert new
      const newTitle: TitleRow = {
        id: nanoid(),
        tmdb_id: tmdbId,
        media_type: mediaType as TitleRow["media_type"],
        title: String(row.title ?? ""),
        original_title: (row.original_title as string | null) ?? null,
        overview: (row.overview as string | null) ?? null,
        poster_path: (row.poster_path as string | null) ?? null,
        backdrop_path: (row.backdrop_path as string | null) ?? null,
        release_date: (row.release_date as string | null) ?? null,
        runtime: (row.runtime as number | null) ?? null,
        genres: (row.genres as TitleRow["genres"]) ?? null,
        status: (row.status as TitleRow["status"]) ?? "want",
        rating: (row.rating as number | null) ?? null,
        review: (row.review as string | null) ?? null,
        favorite: Boolean(row.favorite ?? false),
        added_at: new Date().toISOString(),
        watched_at: (row.watched_at as string | null) ?? null,
        tmdb_rating: (row.tmdb_rating as number | null) ?? null,
        tmdb_vote_count: (row.tmdb_vote_count as number | null) ?? null,
        imdb_id: (row.imdb_id as string | null) ?? null,
        imdb_rating: (row.imdb_rating as number | null) ?? null,
        imdb_votes: (row.imdb_votes as number | null) ?? null,
        rt_score: (row.rt_score as number | null) ?? null,
        metacritic_score: (row.metacritic_score as number | null) ?? null,
        ratings_fetched_at: (row.ratings_fetched_at as string | null) ?? null,
        current_season: (row.current_season as number | null) ?? null,
        current_episode: (row.current_episode as number | null) ?? null,
        seasons: (row.seasons as TitleRow["seasons"]) ?? null,
      };
      next.addedTitles = [...state.addedTitles, newTitle];
      // Un-delete if previously deleted
      next.deletedIds = state.deletedIds.filter((id) => id !== newTitle.id);
      resultId = newTitle.id;
    }

    await writeState(next);

    // Handle chained .select("id").single()
    if (b.postMutCols && b.postMutSingle) {
      return { data: { id: resultId }, error: null };
    }
    return { data: { id: resultId }, error: null };
  }

  return { data: null, error: { message: `Upsert not supported for table: ${b.table}` } };
}

async function execUpdate(
  b: BuilderState,
  state: DemoState
): Promise<{ data: unknown; error: unknown }> {
  const patch = b.mutData as Record<string, unknown>;

  if (b.table === "titles") {
    const eqFilter = b.filters.find((f) => f.kind === "eq" && f.col === "id");
    if (!eqFilter) return { data: null, error: { message: "update requires .eq('id', ...)" } };
    const id = String(eqFilter.val);

    const next = {
      ...state,
      titlePatches: {
        ...state.titlePatches,
        [id]: { ...(state.titlePatches[id] ?? {}), ...patch } as Partial<TitleRow>,
      },
    };
    await writeState(next);
    return { data: null, error: null };
  }

  return { data: null, error: { message: `Update not supported for table: ${b.table}` } };
}

async function execDelete(
  b: BuilderState,
  state: DemoState
): Promise<{ data: unknown; error: unknown }> {
  const next = { ...state };

  if (b.table === "titles") {
    const eqFilter = b.filters.find((f) => f.kind === "eq" && f.col === "id");
    if (!eqFilter) return { data: null, error: { message: "delete requires .eq('id', ...)" } };
    const id = String(eqFilter.val);
    next.deletedIds = [...new Set([...state.deletedIds, id])];
    await writeState(next);
    return { data: null, error: null };
  }

  if (b.table === "lists") {
    const eqFilter = b.filters.find((f) => f.kind === "eq" && f.col === "id");
    if (!eqFilter) return { data: null, error: { message: "delete requires .eq('id', ...)" } };
    const id = String(eqFilter.val);
    next.deletedListIds = [...new Set([...state.deletedListIds, id])];
    // Also remove all list_titles for this list
    const keys = allListTitles(state)
      .filter((lt) => lt.list_id === id)
      .map((lt) => `${lt.list_id}:${lt.title_id}`);
    next.removedListTitleKeys = [...new Set([...state.removedListTitleKeys, ...keys])];
    await writeState(next);
    return { data: null, error: null };
  }

  if (b.table === "list_titles") {
    const listFilter = b.filters.find((f) => f.kind === "eq" && f.col === "list_id");
    const titleFilter = b.filters.find((f) => f.kind === "eq" && f.col === "title_id");
    if (!listFilter || !titleFilter)
      return { data: null, error: { message: "delete list_titles requires .eq('list_id'...).eq('title_id'...)" } };
    const key = `${listFilter.val}:${titleFilter.val}`;
    next.removedListTitleKeys = [...new Set([...state.removedListTitleKeys, key])];
    next.addedListTitles = state.addedListTitles.filter(
      (lt) => `${lt.list_id}:${lt.title_id}` !== key
    );
    await writeState(next);
    return { data: null, error: null };
  }

  return { data: null, error: { message: `Delete not supported for table: ${b.table}` } };
}

// ─── Public factory ────────────────────────────────────────────────

function newBuilder(table: string, op: OpKind, data?: unknown, opts = {}): ReturnType<typeof createBuilder> {
  return createBuilder({
    table,
    op,
    cols: "*",
    filters: [],
    order: [],
    limitN: null,
    isSingle: false,
    isMaybeSingle: false,
    mutData: data ?? null,
    upsertOpts: opts as { onConflict?: string },
    postMutCols: null,
    postMutSingle: false,
  });
}

export function createDemoClient() {
  return {
    from(table: string) {
      return {
        select(cols = "*") { return newBuilder(table, "select").select(cols); },
        insert(data: unknown) { return newBuilder(table, "insert", data); },
        upsert(data: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
          return newBuilder(table, "upsert", data, { onConflict: opts?.onConflict });
        },
        update(data: unknown) { return newBuilder(table, "update", data); },
        delete() { return newBuilder(table, "delete"); },
      };
    },
  };
}
