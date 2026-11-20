"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLibraryOwnerId } from "@/lib/library-db";
import { isGuestOwnerId } from "@/lib/guest-id";

/** Shared lists need an account for everyone on them. */
async function requireAccount() {
  const ownerId = await getLibraryOwnerId();
  if (isGuestOwnerId(ownerId)) throw new Error("Sign up to share lists.");
  return ownerId;
}
import {
  createListInvite,
  joinListWithInvite,
  leaveSharedList,
  removeListMember,
} from "@/lib/shared-lists";

export async function createSharedListInvite(listId: string) {
  await requireAccount();
  const invite = await createListInvite(listId);
  return invite;
}

export async function acceptSharedListInvite(token: string) {
  const ownerId = await getLibraryOwnerId();
  // A guest signs up first and comes back to the invite.
  if (isGuestOwnerId(ownerId)) redirect(`/login?mode=create&next=${encodeURIComponent(`/join/${token}`)}`);
  const list = await joinListWithInvite(token, ownerId);
  revalidatePath("/lists", "layout");
  redirect(`/lists/${list.id}`);
}

export async function removeSharedListMember(listId: string, profileId: string) {
  await removeListMember(listId, profileId);
  revalidatePath("/lists", "layout");
}

export async function leaveList(listId: string) {
  await leaveSharedList(listId);
  revalidatePath("/lists", "layout");
  redirect("/lists");
}
