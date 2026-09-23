import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { profileAvatarUrl, type ProfileRow } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import { ensureSharedListSchema } from "@/lib/shared-list-schema";
import { supabase } from "@/lib/supabase";
import type { AccessibleList, ListRow, SharedListPerson, TitleRow } from "@/lib/types";

type MemberRow = {
  list_id: string;
  profile_id: string;
  role: "editor";
  joined_at: string;
};

type InviteRow = {
  list_id: string;
  token_hash: string;
  expires_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, avatar_mime, avatar_updated_at, identity_customized, is_public, created_at, updated_at";

function inviteHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function collaborationSchemaMissing(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("list_members") && (
    message.includes("does not exist") || message.includes("could not find")
  );
}

function person(profile: ProfileRow): SharedListPerson {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profileAvatarUrl(profile),
  };
}

async function profilesById(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map<string, SharedListPerson>();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [profile.id, person(profile)]),
  );
}

async function decorateLists(
  lists: ListRow[],
  viewerId: string,
  memberships: MemberRow[],
): Promise<AccessibleList[]> {
  const people = await profilesById([
    ...lists.map((list) => list.owner_id ?? ""),
    ...memberships.map((membership) => membership.profile_id),
  ]);
  return lists.map((list) => ({
    ...list,
    isOwner: list.owner_id === viewerId || !SLATE_HOSTED,
    owner: people.get(list.owner_id ?? "") ?? null,
    members: memberships
      .filter((membership) => membership.list_id === list.id)
      .map((membership) => people.get(membership.profile_id))
      .filter((member): member is SharedListPerson => Boolean(member)),
  }));
}

export async function getAccessibleListsForOwner(ownerId: string): Promise<AccessibleList[]> {
  if (!SLATE_HOSTED) {
    const db = await getLibraryClient();
    const { data, error } = await db
      .from("lists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return decorateLists((data ?? []) as ListRow[], ownerId, []);
  }

  const [{ data: owned, error: ownedError }, { data: membershipData, error: membershipError }] =
    await Promise.all([
      supabase
        .from("lists")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false }),
      supabase.from("list_members").select("list_id, profile_id, role, joined_at").eq("profile_id", ownerId),
    ]);
  if (ownedError) throw new Error(ownedError.message);
  if (membershipError) {
    if (collaborationSchemaMissing(membershipError)) {
      if (await ensureSharedListSchema()) {
        return getAccessibleListsForOwner(ownerId);
      }
      return decorateLists((owned ?? []) as ListRow[], ownerId, []);
    }
    throw new Error(membershipError.message);
  }

  const memberships = (membershipData ?? []) as MemberRow[];
  const sharedIds = memberships.map((membership) => membership.list_id);
  const shared = sharedIds.length
    ? await supabase.from("lists").select("*").in("id", sharedIds)
    : { data: [], error: null };
  if (shared.error) throw new Error(shared.error.message);

  const lists = [...((owned ?? []) as ListRow[]), ...((shared.data ?? []) as ListRow[])];
  const allIds = lists.map((list) => list.id);
  const allMemberships = allIds.length
    ? await supabase
        .from("list_members")
        .select("list_id, profile_id, role, joined_at")
        .in("list_id", allIds)
    : { data: [], error: null };
  if (allMemberships.error) throw new Error(allMemberships.error.message);
  return decorateLists(lists, ownerId, (allMemberships.data ?? []) as MemberRow[]);
}

export const getAccessibleLists = cache(async () =>
  getAccessibleListsForOwner(await getLibraryOwnerId()),
);

export async function getEditableListOptions() {
  const lists = await getAccessibleLists();
  return lists
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function requireListAccessForOwner(
  ownerId: string,
  listId: string,
  manage = false,
): Promise<ListRow> {
  if (!SLATE_HOSTED) {
    const db = await getLibraryClient();
    const { data, error } = await db.from("lists").select("*").eq("id", listId).maybeSingle();
    if (error || !data) throw new Error("List not found");
    return data as ListRow;
  }

  const { data, error } = await supabase.from("lists").select("*").eq("id", listId).maybeSingle();
  if (error || !data) throw new Error("List not found");
  const list = data as ListRow;
  if (list.owner_id === ownerId) return list;
  if (manage) throw new Error("Only the list owner can do that");
  const { data: membership, error: membershipError } = await supabase
    .from("list_members")
    .select("list_id")
    .eq("list_id", listId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (membershipError || !membership) throw new Error("List not found");
  return list;
}

export async function requireListAccess(listId: string, manage = false) {
  return requireListAccessForOwner(await getLibraryOwnerId(), listId, manage);
}

export async function getAccessibleList(segment: string): Promise<AccessibleList | null> {
  const ownerId = await getLibraryOwnerId();
  if (!SLATE_HOSTED) {
    const db = await getLibraryClient();
    const query = UUID.test(segment)
      ? db.from("lists").select("*").eq("id", segment)
      : db.from("lists").select("*").eq("slug", segment);
    const { data } = await query.maybeSingle();
    if (!data) return null;
    return (await decorateLists([data as ListRow], ownerId, []))[0] ?? null;
  }

  let list: ListRow | null = null;
  if (UUID.test(segment)) {
    const result = await supabase.from("lists").select("*").eq("id", segment).maybeSingle();
    list = (result.data as ListRow | null) ?? null;
  } else {
    const result = await supabase
      .from("lists")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("slug", segment)
      .maybeSingle();
    list = (result.data as ListRow | null) ?? null;
  }
  if (!list) return null;

  const { data: memberData, error } = await supabase
    .from("list_members")
    .select("list_id, profile_id, role, joined_at")
    .eq("list_id", list.id);
  if (error) {
    if (list.owner_id === ownerId && collaborationSchemaMissing(error)) {
      if (await ensureSharedListSchema()) {
        return getAccessibleList(segment);
      }
      return (await decorateLists([list], ownerId, []))[0] ?? null;
    }
    throw new Error(error.message);
  }
  const memberships = (memberData ?? []) as MemberRow[];
  if (list.owner_id !== ownerId && !memberships.some((member) => member.profile_id === ownerId)) {
    return null;
  }
  return (await decorateLists([list], ownerId, memberships))[0] ?? null;
}

export async function getListTitles(list: ListRow) {
  const client = SLATE_HOSTED ? supabase : await getLibraryClient();
  let query = client
    .from("list_titles")
    .select("title_id, position, titles(*)")
    .eq("list_id", list.id);
  if (SLATE_HOSTED) query = query.eq("owner_id", list.owner_id ?? "");
  const { data, error } = await query.order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const embedded = row.titles as unknown as TitleRow | TitleRow[] | null;
    return embedded ? (Array.isArray(embedded) ? embedded : [embedded]) : [];
  });
}

export async function getListCardRows(listIds: string[]) {
  if (!listIds.length) return [];
  const client = SLATE_HOSTED ? supabase : await getLibraryClient();
  const { data, error } = await client
    .from("list_titles")
    .select("list_id, position, titles(poster_path)")
    .in("list_id", listIds)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createListInvite(listId: string) {
  const ownerId = await getLibraryOwnerId();
  const list = await requireListAccessForOwner(ownerId, listId, true);
  if (!SLATE_HOSTED) throw new Error("Shared lists require a hosted Slate account");
  await ensureSharedListSchema();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
  await supabase.from("list_invites").delete().eq("list_id", list.id);
  const { error } = await supabase.from("list_invites").insert({
    list_id: list.id,
    token_hash: inviteHash(token),
    created_by: ownerId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export async function resolveListInvite(token: string) {
  if (!SLATE_HOSTED || token.length < 20) return null;
  const { data, error } = await supabase
    .from("list_invites")
    .select("list_id, token_hash, expires_at")
    .eq("token_hash", inviteHash(token))
    .maybeSingle();
  if (error || !data) return null;
  const invite = data as InviteRow;
  if (new Date(invite.expires_at).getTime() <= Date.now()) return null;
  const { data: listData } = await supabase.from("lists").select("*").eq("id", invite.list_id).maybeSingle();
  if (!listData) return null;
  const list = listData as ListRow;
  const ownerMap = await profilesById([list.owner_id ?? ""]);
  return { list, owner: ownerMap.get(list.owner_id ?? "") ?? null };
}

export async function joinListWithInvite(token: string, profileId: string) {
  const invitation = await resolveListInvite(token);
  if (!invitation) throw new Error("This invite link is no longer available");
  if (invitation.list.owner_id !== profileId) {
    const { error } = await supabase.from("list_members").upsert(
      {
        list_id: invitation.list.id,
        profile_id: profileId,
        role: "editor",
        invited_by: invitation.list.owner_id,
      },
      { onConflict: "list_id,profile_id" },
    );
    if (error) throw new Error(error.message);
  }
  return invitation.list;
}

export async function removeListMember(listId: string, profileId: string) {
  const list = await requireListAccess(listId, true);
  if (profileId === list.owner_id) throw new Error("The owner cannot be removed");
  const { error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
}

export async function leaveSharedList(listId: string) {
  const ownerId = await getLibraryOwnerId();
  const list = await requireListAccessForOwner(ownerId, listId);
  if (list.owner_id === ownerId) throw new Error("The owner cannot leave their own list");
  const { error } = await supabase
    .from("list_members")
    .delete()
    .eq("list_id", listId)
    .eq("profile_id", ownerId);
  if (error) throw new Error(error.message);
}
