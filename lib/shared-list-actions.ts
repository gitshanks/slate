"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLibraryOwnerId } from "@/lib/library-db";
import {
  createListInvite,
  joinListWithInvite,
  leaveSharedList,
  removeListMember,
} from "@/lib/shared-lists";

export async function createSharedListInvite(listId: string) {
  const invite = await createListInvite(listId);
  return invite;
}

export async function acceptSharedListInvite(token: string) {
  const ownerId = await getLibraryOwnerId();
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
