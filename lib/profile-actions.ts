"use server";

import { revalidatePath } from "next/cache";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

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
