import "server-only";

import { cookies } from "next/headers";
import { SLATE_PUBLIC } from "@/lib/public-mode";
import { supabase } from "@/lib/supabase";

/**
 * Which lists each person keeps off their TV. Lists show by default; a row
 * here hides one. It's per person, so someone sharing a list can hide it
 * from their own TV without hiding it from yours.
 */
const TABLE_SQL = `
create table if not exists list_tv_hidden (
  profile_id text not null,
  list_id    uuid not null references lists(id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (profile_id, list_id)
);
`;

// The public demo keeps its choices in the visitor's browser, like the rest of it.
const DEMO_COOKIE = "slate-demo-tv-hidden";

let tablePromise: Promise<void> | null = null;

async function ensureTable() {
  if (!process.env.DATABASE_URL) return;
  tablePromise ??= import("@/lib/neon-client")
    .then(({ runNeonQuery }) => runNeonQuery(TABLE_SQL))
    .then(() => undefined)
    .catch((error) => {
      tablePromise = null;
      throw error;
    });
  await tablePromise;
}

function tableMissing(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("list_tv_hidden") && (
    message.includes("does not exist") || message.includes("could not find")
  );
}

async function demoHidden(): Promise<Set<string>> {
  try {
    const raw = (await cookies()).get(DEMO_COOKIE)?.value;
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function getTvHiddenListIds(ownerId: string): Promise<Set<string>> {
  if (SLATE_PUBLIC) return demoHidden();
  const { data, error } = await supabase
    .from("list_tv_hidden")
    .select("list_id")
    .eq("profile_id", ownerId);
  if (error) {
    if (tableMissing(error)) {
      await ensureTable();
      return new Set();
    }
    throw new Error(error.message);
  }
  return new Set((data ?? []).map((row) => String(row.list_id)));
}

export async function setListShownOnTv(ownerId: string, listId: string, show: boolean) {
  if (SLATE_PUBLIC) {
    const hidden = await demoHidden();
    if (show) hidden.delete(listId);
    else hidden.add(listId);
    (await cookies()).set(DEMO_COOKIE, JSON.stringify([...hidden]), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return;
  }
  await ensureTable();
  const { error } = show
    ? await supabase.from("list_tv_hidden").delete().eq("profile_id", ownerId).eq("list_id", listId)
    : await supabase
        .from("list_tv_hidden")
        .upsert({ profile_id: ownerId, list_id: listId }, { onConflict: "profile_id,list_id" });
  if (error) throw new Error(error.message);
}
