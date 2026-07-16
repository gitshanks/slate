// Neon/Postgres client that presents the same `from(table)…` query-builder
// surface the app already uses through `supabase-js` (and mirrors in
// lib/demo-client.ts), but runs real SQL via `pg`. Selected in lib/supabase.ts
// when `DATABASE_URL` is set. Server-only so `pg` never reaches a client bundle.
//
// The pure SQL generation lives in lib/neon-sql.ts; this file owns the
// connection pool, result-type coercion, and the `{ data, error }` contract.

import "server-only";
import { createRequire } from "node:module";
import { connection } from "next/server";
import type { Pool } from "pg";
import { buildQuery, makeState, type BuilderState, type Op } from "@/lib/neon-sql";

// `pg` is loaded through a real Node require (created lazily inside getPool),
// NOT a top-level `import "pg"`. Turbopack bundles static imports of pg and
// mangles its `pg-types` internals, which throws at module-evaluation time and
// breaks the whole module (createNeonClient becomes undefined). A runtime
// require resolves the real, external package instead. `serverExternalPackages`
// in next.config keeps it out of the bundle and included in the traced output.

// ─── Result-type coercion (match PostgREST/supabase-js JSON shapes) ──
//
// A raw driver returns `numeric` as strings and `timestamptz`/`date` as `Date`
// objects; PostgREST (and lib/demo-client.ts) return numbers and ISO/`YYYY-MM-DD`
// strings, which the app's formatters and string comparisons depend on. These
// parsers are process-global, but this module is the project's only `pg`
// consumer and only loads when Neon is active (dynamic import in supabase.ts).
const OID_NUMERIC = 1700;
const OID_TIMESTAMPTZ = 1184;
const OID_DATE = 1082;

// Configured lazily (inside getPool) rather than at module top-level: this
// module must be importable during Next's build without evaluating any pg
// internals (see the lazy facade in lib/supabase.ts).
let typesConfigured = false;
function configureTypeParsers(pgTypes: typeof import("pg").types): void {
  if (typesConfigured) return;
  typesConfigured = true;
  const defaultTimestamptz = pgTypes.getTypeParser(OID_TIMESTAMPTZ);
  pgTypes.setTypeParser(OID_NUMERIC, (v: string) => parseFloat(v)); // numeric → number
  pgTypes.setTypeParser(OID_TIMESTAMPTZ, (v: string) => {
    const d = defaultTimestamptz(v);
    return d instanceof Date ? d.toISOString() : d; // timestamptz → ISO string
  });
  pgTypes.setTypeParser(OID_DATE, (v: string) => v); // date → keep 'YYYY-MM-DD' string
}

// ─── Connection pool (lazy singleton) ───────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    // Real Node require → the genuine external pg package, not a bundled copy.
    // Reached only at query time (runtime), after connection() has resolved, so
    // a static prerender never evaluates pg.
    const pg = createRequire(import.meta.url)("pg") as typeof import("pg");
    configureTypeParsers(pg.types);
    // SSL is driven by the connection string's `sslmode` (Neon's pooled URL
    // includes `sslmode=require`); local Postgres URLs omit it.
    pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
    });
    // A pool must have an 'error' handler or an idle-client failure crashes
    // the process; log and let the pool recycle the connection.
    pool.on("error", (err) => {
      console.error("[neon] idle client error:", err.message);
    });
  }
  return pool;
}

// ─── Error mapping ──────────────────────────────────────────────────

interface PgLikeError {
  message: string;
  code?: string;
}

// pg errors carry `.message` and a SQLSTATE `.code` (e.g. 23505 unique_violation,
// whose message contains "duplicate" — which several callers string-match on).
function toError(e: unknown): PgLikeError {
  if (e && typeof e === "object" && "message" in e) {
    const err = e as { message: unknown; code?: unknown };
    return {
      message: String(err.message),
      code: typeof err.code === "string" ? err.code : undefined,
    };
  }
  return { message: String(e) };
}

// PostgREST returns this code for `.single()` with no row; callers branch on it.
const NO_ROWS: PgLikeError = { message: "Results contain 0 rows", code: "PGRST116" };

// ─── Chainable builder ──────────────────────────────────────────────

type QueryResult = { data: unknown; error: unknown };

export interface QueryBuilder {
  select(cols?: string): QueryBuilder;
  eq(col: string, val: unknown): QueryBuilder;
  in(col: string, val: unknown[]): QueryBuilder;
  ilike(col: string, val: string): QueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  single(): QueryBuilder;
  maybeSingle(): QueryBuilder;
  then<R>(resolve: (v: QueryResult) => R, reject?: (e: unknown) => R): Promise<R>;
}

async function execute(state: BuilderState): Promise<QueryResult> {
  // A pg read is raw TCP I/O, invisible to Next's dynamic-rendering detection —
  // unlike the fetch() supabase-js used, which forced a dynamic bailout on any
  // page doing a DB read. Without this, DB-reading pages with no other dynamic
  // signal (/, /watching, /watched) would be statically prerendered at build
  // time and serve a stale/empty library after every deploy. connection() opts
  // reads out of prerendering the same way, and crucially — unlike
  // `export const dynamic = "force-dynamic"` — does NOT flip cached TMDB fetches
  // to no-store (see lib/tmdb.ts). Must run before the try/catch so Next's
  // bailout signal propagates instead of being swallowed as a query error.
  if (state.op === "select") await connection();

  try {
    const { text, params } = buildQuery(state);
    const res = await getPool().query(text, params as unknown[]);
    const rows = res.rows as Record<string, unknown>[];

    if (state.op === "select") {
      if (state.single) {
        return rows.length ? { data: rows[0], error: null } : { data: null, error: NO_ROWS };
      }
      if (state.maybeSingle) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }

    // Mutations: only return rows when a RETURNING projection was requested
    // via a chained `.select(...)`.
    if (state.returning) {
      if (state.returningSingle) {
        return rows.length ? { data: rows[0], error: null } : { data: null, error: NO_ROWS };
      }
      return { data: rows, error: null };
    }
    return { data: null, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

function builder(state: BuilderState): QueryBuilder {
  return {
    select(cols = "*") {
      // After a mutation, `.select(...)` requests a RETURNING projection.
      if (state.op !== "select") return builder({ ...state, returning: cols });
      return builder({ ...state, cols });
    },
    eq(col, val) {
      return builder({ ...state, filters: [...state.filters, { kind: "eq", col, val }] });
    },
    in(col, val) {
      return builder({ ...state, filters: [...state.filters, { kind: "in", col, val }] });
    },
    ilike(col, val) {
      return builder({ ...state, filters: [...state.filters, { kind: "ilike", col, val }] });
    },
    order(col, opts) {
      return builder({
        ...state,
        orders: [...state.orders, { col, ascending: opts?.ascending !== false }],
      });
    },
    limit(n) {
      return builder({ ...state, limit: n });
    },
    single() {
      if (state.op !== "select") return builder({ ...state, returningSingle: true });
      return builder({ ...state, single: true });
    },
    maybeSingle() {
      return builder({ ...state, maybeSingle: true });
    },
    then(resolve, reject) {
      return execute(state).then(resolve, reject);
    },
  };
}

// ─── Public factory (shape mirrors supabase-js `.from(...)`) ─────────

export function createNeonClient() {
  return {
    from(table: string) {
      return {
        select(cols = "*") {
          return builder(makeState(table, "select")).select(cols);
        },
        insert(data: unknown) {
          return builder(makeState(table, "insert", data));
        },
        upsert(data: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
          return builder(makeState(table, "upsert", data, opts));
        },
        update(data: unknown) {
          return builder(makeState(table, "update", data));
        },
        delete() {
          return builder(makeState(table, "delete" as Op));
        },
      };
    },
  };
}
