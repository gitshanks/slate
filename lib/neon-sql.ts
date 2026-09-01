// Pure SQL builder for the Neon/Postgres data layer.
//
// Translates the small `supabase-js` query surface the app actually uses
// (see lib/demo-client.ts for the mirror in-memory implementation) into
// parameterized SQL. Deliberately dependency-free and side-effect-free — no
// `server-only`, no `pg` — so it can be unit-tested in isolation. The client
// that executes these queries lives in lib/neon-client.ts.
//
// Security: table and column identifiers come from a fixed allowlist of
// developer-authored strings (never user input) and are additionally validated
// against `IDENT` / `ALLOWED_TABLES`. Every *value* is a bound `$n` parameter.

export type Op = "select" | "insert" | "upsert" | "update" | "delete";

export type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "in"; col: string; val: unknown[] }
  | { kind: "ilike"; col: string; val: string };

export interface OrderSpec {
  col: string;
  ascending: boolean;
}

export interface BuilderState {
  table: string;
  op: Op;
  /** Raw select projection, e.g. "id, title" or "title_id, position, titles(*)". */
  cols: string;
  filters: Filter[];
  orders: OrderSpec[];
  limit: number | null;
  offset: number | null;
  single: boolean;
  maybeSingle: boolean;
  /** insert/update payload (object) or upsert payload (object | object[]). */
  data: unknown;
  onConflict: string | null;
  ignoreDuplicates: boolean;
  /** RETURNING projection when a mutation is chained with `.select(...)`. */
  returning: string | null;
  returningSingle: boolean;
}

export function makeState(
  table: string,
  op: Op,
  data?: unknown,
  opts?: { onConflict?: string; ignoreDuplicates?: boolean }
): BuilderState {
  return {
    table,
    op,
    cols: "*",
    filters: [],
    orders: [],
    limit: null,
    offset: null,
    single: false,
    maybeSingle: false,
    data: data ?? null,
    onConflict: opts?.onConflict ?? null,
    ignoreDuplicates: opts?.ignoreDuplicates ?? false,
    returning: null,
    returningSingle: false,
  };
}

// ─── Allowlists ─────────────────────────────────────────────────────

const ALLOWED_TABLES = new Set([
  "titles",
  "lists",
  "list_titles",
  "profiles",
  "auth_identities",
  "device_sessions",
  "preview_feedback",
]);
const IDENT = /^[a-z_][a-z0-9_]*$/;

/** jsonb columns need JSON.stringify + a ::jsonb cast on write. */
const JSONB_COLUMNS: Record<string, Set<string>> = {
  titles: new Set(["genres", "seasons"]),
  preview_feedback: new Set([
    "source_weights",
    "genre_weights",
    "media_type_weights",
    "recent_exposures",
    "totals",
    "recent_batch_ids",
  ]),
};

/**
 * Embeddable relationships, keyed by base table → embed name. Only the
 * to-one `list_titles → titles` relationship (via `title_id`) is used.
 */
const EMBEDS: Record<string, Record<string, { table: string; fk: string }>> = {
  list_titles: { titles: { table: "titles", fk: "title_id" } },
};

function assertTable(t: string): void {
  if (!ALLOWED_TABLES.has(t)) throw new Error(`Unknown table: ${t}`);
}
function assertIdent(c: string): void {
  if (!IDENT.test(c)) throw new Error(`Invalid identifier: ${c}`);
}
function jsonbCols(table: string): Set<string> {
  return JSONB_COLUMNS[table] ?? new Set();
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Split a projection on top-level commas, respecting `embed(...)` parens. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") {
      depth++;
      cur += ch;
    } else if (ch === ")") {
      depth--;
      cur += ch;
    } else if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

type Param = (v: unknown) => string;

/** Column reference, qualified with the base table when a join is present. */
function qualifier(table: string, hasJoin: boolean): (col: string) => string {
  return (col) => {
    assertIdent(col);
    return hasJoin ? `${table}.${col}` : col;
  };
}

function buildWhere(filters: Filter[], p: Param, q: (col: string) => string): string {
  return filters
    .map((f) => {
      if (f.kind === "eq") return `${q(f.col)} = ${p(f.val)}`;
      if (f.kind === "ilike") return `${q(f.col)} ILIKE ${p(f.val)}`;
      // in
      if (f.val.length === 0) return "false"; // matches nothing, valid SQL
      return `${q(f.col)} IN (${f.val.map((v) => p(v)).join(", ")})`;
    })
    .join(" AND ");
}

function parseSelect(
  table: string,
  cols: string
): { select: string; join: string; hasJoin: boolean } {
  const tokens = splitTopLevel(cols);
  const parts: string[] = [];
  let join = "";
  let hasJoin = false;

  for (const tok of tokens) {
    const embed = tok.match(/^(\w+)\s*\((.*)\)$/);
    if (embed) {
      const name = embed[1];
      const inner = embed[2].trim();
      const rel = EMBEDS[table]?.[name];
      if (!rel) throw new Error(`Unsupported embed: ${name} on ${table}`);
      assertIdent(name);
      if (inner === "*") {
        parts.push(`row_to_json(e.*) AS ${name}`);
      } else {
        const built = splitTopLevel(inner).map((c) => {
          assertIdent(c);
          return `'${c}', e.${c}`;
        });
        parts.push(`json_build_object(${built.join(", ")}) AS ${name}`);
      }
      join += ` LEFT JOIN ${rel.table} e ON e.id = ${table}.${rel.fk}`;
      hasJoin = true;
    } else if (tok === "*") {
      parts.push("*");
    } else {
      assertIdent(tok);
      parts.push(tok);
    }
  }

  // With a join present, qualify bare base columns to avoid ambiguity.
  if (hasJoin) {
    for (let i = 0; i < parts.length; i++) {
      const sp = parts[i];
      if (sp === "*") parts[i] = `${table}.*`;
      else if (!sp.includes("(") && !sp.includes(" ")) parts[i] = `${table}.${sp}`;
    }
  }

  return { select: parts.join(", "), join, hasJoin };
}

/** Shared VALUES-tuple builder for insert/upsert (handles jsonb + DEFAULT). */
function buildRowsValues(
  table: string,
  rows: unknown[],
  p: Param
): { cols: string[]; valuesSql: string } {
  const jset = jsonbCols(table);
  const colSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r as object)) colSet.add(k);
  }
  const cols = [...colSet];
  cols.forEach(assertIdent);

  const tuples = rows.map((r) => {
    const rec = r as Record<string, unknown>;
    const cells = cols.map((c) => {
      if (!(c in rec)) return "DEFAULT"; // let the column default apply
      const v = rec[c];
      if (jset.has(c)) {
        if (v == null) return p(null);
        return `${p(JSON.stringify(v))}::jsonb`;
      }
      return p(v);
    });
    return `(${cells.join(", ")})`;
  });

  return { cols, valuesSql: tuples.join(", ") };
}

function returningClause(state: BuilderState): string {
  if (!state.returning) return "";
  const cols = splitTopLevel(state.returning).map((c) => {
    assertIdent(c);
    return c;
  });
  return ` RETURNING ${cols.join(", ")}`;
}

// ─── Per-op builders ────────────────────────────────────────────────

function buildSelect(state: BuilderState): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const p: Param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const { select, join, hasJoin } = parseSelect(state.table, state.cols);
  const q = qualifier(state.table, hasJoin);

  let text = `SELECT ${select} FROM ${state.table}${join}`;
  const where = buildWhere(state.filters, p, q);
  if (where) text += ` WHERE ${where}`;
  if (state.orders.length) {
    text +=
      " ORDER BY " +
      state.orders.map((o) => `${q(o.col)} ${o.ascending ? "ASC" : "DESC"}`).join(", ");
  }
  if (state.limit != null) text += ` LIMIT ${p(state.limit)}`;
  if (state.offset != null) text += ` OFFSET ${p(state.offset)}`;
  return { text, params };
}

function buildInsert(state: BuilderState): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const p: Param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const rows = Array.isArray(state.data) ? state.data : [state.data];
  const { cols, valuesSql } = buildRowsValues(state.table, rows, p);
  const text =
    `INSERT INTO ${state.table} (${cols.join(", ")}) VALUES ${valuesSql}` +
    returningClause(state);
  return { text, params };
}

function buildUpsert(state: BuilderState): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const p: Param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const rows = Array.isArray(state.data) ? state.data : [state.data];
  const { cols, valuesSql } = buildRowsValues(state.table, rows, p);

  const conflictCols = (state.onConflict ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  conflictCols.forEach(assertIdent);
  if (!conflictCols.length) throw new Error("upsert requires onConflict");

  let text = `INSERT INTO ${state.table} (${cols.join(", ")}) VALUES ${valuesSql} ON CONFLICT (${conflictCols.join(", ")}) `;
  const updateCols = cols.filter((c) => !conflictCols.includes(c));
  if (state.ignoreDuplicates || updateCols.length === 0) {
    text += "DO NOTHING";
  } else {
    text += "DO UPDATE SET " + updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  }
  text += returningClause(state);
  return { text, params };
}

function buildUpdate(state: BuilderState): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const p: Param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const jset = jsonbCols(state.table);
  const rec = state.data as Record<string, unknown>;
  const keys = Object.keys(rec);
  keys.forEach(assertIdent);
  if (!keys.length) throw new Error("update requires data");

  const sets = keys.map((c) => {
    const v = rec[c];
    if (jset.has(c)) {
      if (v == null) return `${c} = ${p(null)}`;
      return `${c} = ${p(JSON.stringify(v))}::jsonb`;
    }
    return `${c} = ${p(v)}`;
  });

  const q = qualifier(state.table, false);
  const where = buildWhere(state.filters, p, q);
  if (!where) throw new Error("update requires a filter (refusing full-table update)");

  const text =
    `UPDATE ${state.table} SET ${sets.join(", ")} WHERE ${where}` + returningClause(state);
  return { text, params };
}

function buildDelete(state: BuilderState): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const p: Param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const q = qualifier(state.table, false);
  const where = buildWhere(state.filters, p, q);
  if (!where) throw new Error("delete requires a filter (refusing full-table delete)");

  const text = `DELETE FROM ${state.table} WHERE ${where}` + returningClause(state);
  return { text, params };
}

// ─── Entry point ────────────────────────────────────────────────────

export function buildQuery(state: BuilderState): { text: string; params: unknown[] } {
  assertTable(state.table);
  switch (state.op) {
    case "select":
      return buildSelect(state);
    case "insert":
      return buildInsert(state);
    case "upsert":
      return buildUpsert(state);
    case "update":
      return buildUpdate(state);
    case "delete":
      return buildDelete(state);
    default:
      throw new Error(`Unsupported op: ${state.op}`);
  }
}
