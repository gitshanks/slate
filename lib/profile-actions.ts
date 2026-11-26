"use server";

import { isGuestOwnerId } from "@/lib/guest-id";

import { revalidatePath } from "next/cache";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import { saveProfileBio, saveTopTitleIds } from "@/lib/profile-taste";

export interface ProfileActionState {
  ok: boolean;
  message: string;
  displayName?: string;
  username?: string;
  isPublic?: boolean;
  attemptSnapshot?: string;
}

const USERNAME = /^[a-z0-9][a-z0-9-]{2,29}$/;
const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 60;

export async function updateProfile(
  _previous: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const isPublic = formData.get("isPublic") === "on";
  const attemptSnapshot = JSON.stringify([displayName, username, isPublic]);
  const ownerId = await getLibraryOwnerId();
  if (isGuestOwnerId(ownerId)) {
    return { ok: false, message: "Sign up to make your profile.", attemptSnapshot };
  }
  const current = await getProfileById(ownerId);
  if (!current) {
    return {
      ok: false,
      message: "Profile not found.",
      attemptSnapshot,
    };
  }

  const currentState = {
    displayName: current.display_name,
    username: current.username,
    isPublic: current.is_public,
  };

  if (
    displayName.length < DISPLAY_NAME_MIN ||
    displayName.length > DISPLAY_NAME_MAX
  ) {
    return {
      ok: false,
      message: "Use a display name between 2 and 60 characters.",
      attemptSnapshot,
      ...currentState,
    };
  }

  if (!USERNAME.test(username)) {
    return {
      ok: false,
      message: "Use 3–30 lowercase letters, numbers, or hyphens.",
      attemptSnapshot,
      ...currentState,
    };
  }

  const identityChanged = displayName !== current.display_name;
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      is_public: isPublic,
      ...(identityChanged ? { identity_customized: true } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (error) {
    return {
      ok: false,
      message: error.message.toLowerCase().includes("duplicate")
        ? "That profile URL is already taken."
        : error.message,
      attemptSnapshot,
      ...currentState,
    };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  // Hosted /app rewrites to /; refresh its sharing controls after profile edits.
  revalidatePath("/");
  revalidatePath(`/u/${current.username}`);
  revalidatePath(`/u/${username}`);
  return {
    ok: true,
    message: "Profile saved.",
    displayName,
    username,
    isPublic,
    attemptSnapshot,
  };
}

/** Save the ordered Top 4 shown on the profile. Returns the ids kept. */
export async function setTopTitles(
  ids: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const ownerId = await getLibraryOwnerId();
  if (isGuestOwnerId(ownerId)) {
    return { ok: false, message: "Sign up to pick your Top 4." };
  }
  const profile = await getProfileById(ownerId);
  if (!profile) return { ok: false, message: "Profile not found." };
  try {
    const saved = await saveTopTitleIds(ownerId, ids);
    revalidatePath("/profile");
    revalidatePath(`/u/${profile.username}`);
    return { ok: true, ids: saved };
  } catch {
    return { ok: false, message: "Your Top 4 didn't save. Try again." };
  }
}

export interface ProfileEdits {
  displayName: string;
  username: string;
  isPublic: boolean;
  /** Left out when the bio column isn't there yet. */
  bio?: string;
  /** Sent only when the backdrop choice reordered the Top 4. */
  topIds?: string[];
}

/**
 * Save everything Edit profile changes in one go: name, handle and privacy
 * first (the part that can be refused, say for a taken handle), then the bio
 * and the Top 4 order that picks the backdrop.
 */
export async function saveProfileEdits(
  edits: ProfileEdits
): Promise<{ ok: true; username: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.set("displayName", edits.displayName);
  form.set("username", edits.username);
  if (edits.isPublic) form.set("isPublic", "on");
  const identity = await updateProfile({ ok: false, message: "" }, form);
  if (!identity.ok) return { ok: false, message: identity.message };

  const ownerId = await getLibraryOwnerId();
  try {
    if (edits.bio !== undefined) await saveProfileBio(ownerId, edits.bio);
    if (edits.topIds) await saveTopTitleIds(ownerId, edits.topIds);
  } catch {
    return { ok: false, message: "Your name saved, but the rest didn't. Try again." };
  }
  revalidatePath("/profile");
  revalidatePath(`/u/${identity.username}`);
  return { ok: true, username: identity.username ?? edits.username };
}
