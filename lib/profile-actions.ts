"use server";

import { revalidatePath } from "next/cache";
import { getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

export interface ProfileActionState {
  ok: boolean;
  message: string;
  username?: string;
  isPublic?: boolean;
}

const USERNAME = /^[a-z0-9][a-z0-9-]{2,29}$/;

export async function updateProfile(
  _previous: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const ownerId = await getLibraryOwnerId();
  const current = await getProfileById(ownerId);
  if (!current) return { ok: false, message: "Profile not found." };

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const isPublic = formData.get("isPublic") === "on";

  if (!USERNAME.test(username)) {
    return {
      ok: false,
      message: "Use 3–30 lowercase letters, numbers, or hyphens.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (error) {
    return {
      ok: false,
      message: error.message.toLowerCase().includes("duplicate")
        ? "That profile URL is already taken."
        : error.message,
    };
  }

  revalidatePath("/profile");
  revalidatePath(`/u/${current.username}`);
  revalidatePath(`/u/${username}`);
  return {
    ok: true,
    message: isPublic
      ? "Your public profile is live."
      : "Your library is private.",
    username,
    isPublic,
  };
}
