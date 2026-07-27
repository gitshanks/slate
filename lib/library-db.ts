import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { supabase } from "@/lib/supabase";

export const SELF_HOSTED_OWNER_ID = "self-hosted";

const OWNED_TABLES = new Set(["titles", "lists", "list_titles"]);

function withOwner<T>(data: T, ownerId: string): T {
  if (Array.isArray(data)) {
    return data.map((row) => withOwner(row, ownerId)) as T;
  }
  if (data && typeof data === "object") {
    return { ...(data as object), owner_id: ownerId } as T;
  }
  return data;
}

function ownerConflict(onConflict: string | undefined): string | undefined {
  if (!onConflict) return onConflict;
  const columns = onConflict.split(",").map((column) => column.trim());
  return columns.includes("owner_id")
    ? columns.join(",")
    : ["owner_id", ...columns].join(",");
}

/**
 * Wrap the existing Supabase-like query seam so every owned read/update/delete
 * gets an owner predicate and every insert/upsert receives an immutable owner.
 * Pages and actions cannot accidentally query another account's rows.
 */
export function libraryClientForOwner(ownerId: string): SupabaseClient {
  return {
    from(table: string) {
      const source = supabase.from(table);
      if (!OWNED_TABLES.has(table)) return source;

      return {
        select(columns = "*") {
          return source.select(columns).eq("owner_id", ownerId);
        },
        insert(data: unknown) {
          return source.insert(
            withOwner(data, ownerId) as Record<string, unknown>
          );
        },
        upsert(
          data: unknown,
          options?: { onConflict?: string; ignoreDuplicates?: boolean }
        ) {
          return source.upsert(withOwner(data, ownerId) as Record<string, unknown>, {
            ...options,
            onConflict: ownerConflict(options?.onConflict),
          });
        },
        update(data: unknown) {
          return source
            .update(data as Record<string, unknown>)
            .eq("owner_id", ownerId);
        },
        delete() {
          return source.delete().eq("owner_id", ownerId);
        },
      };
    },
  } as unknown as SupabaseClient;
}

export const getLibraryOwnerId = cache(async () => {
  if (!SLATE_HOSTED) return SELF_HOSTED_OWNER_ID;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
});

export async function getLibraryClient(): Promise<SupabaseClient> {
  // Preserve the original single-user data contract exactly. In particular,
  // an existing Docker volume does not rerun schema.sql on upgrade, so it may
  // not have owner_id yet. Account scoping is a hosted-mode concern only.
  if (!SLATE_HOSTED) return supabase;
  return libraryClientForOwner(await getLibraryOwnerId());
}
