"use server";

import { revalidatePath } from "next/cache";
import { addTitle } from "@/lib/actions";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import { MAX_ONBOARDING_SELECTIONS, parseOnboardingPicks, type OnboardingPick } from "@/lib/onboarding-recommendations";

export interface OnboardingState {
  ok: boolean;
  message: string;
  savedCount?: number;
}

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const ownerId = await getLibraryOwnerId();
  const profile = await getProfileById(ownerId);
  if (!profile) return { ok: false, message: "Your profile could not be loaded." };
  if (profile.onboarding_completed_at) return { ok: true, message: "Your slate is ready.", savedCount: 0 };

  const selections = parseSelections(formData.get("selections"));
  if (!selections) {
    return { ok: false, message: "Those picks could not be read. Try again." };
  }

  try {
    // Process a few at a time. This remains one server action while avoiding a
    // burst of catalogue and rating lookups when somebody keeps every title.
    const saved: Array<{ id: string; status: string }> = [];
    for (let index = 0; index < selections.length; index += 3) {
      const batch = selections.slice(index, index + 3);
      const rows = await Promise.all(
        batch.map((selection) =>
          addTitle({
            tmdbId: selection.tmdbId,
            mediaType: selection.mediaType,
            status: "want",
          }),
        ),
      );
      saved.push(...rows);
    }

    // New accounts are normally empty. Explicit positions also make a retry
    // idempotent and preserve the order in which the person kept the titles.
    const db = await getLibraryClient();
    await Promise.all(
      saved.map(async (row, index) => {
        const { error } = await db
          .from("titles")
          .update({
            position: -1_000 + index,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }),
    );

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: now, updated_at: now })
      .eq("id", ownerId);
    if (error) throw new Error(error.message);

    revalidatePath("/", "layout");
    revalidatePath("/app", "layout");
    revalidatePath("/discover");
    revalidatePath("/previews");
    return {
      ok: true,
      message: selections.length ? "Your slate is ready." : "You are all set.",
      savedCount: selections.length,
    };
  } catch {
    return {
      ok: false,
      message: "Your picks could not be saved. Nothing is lost — try once more.",
    };
  }
}

function parseSelections(value: FormDataEntryValue | null): OnboardingPick[] | null {
  if (typeof value !== "string" || value.length > 8_000) return null;
  try {
    return parseOnboardingPicks(JSON.parse(value), MAX_ONBOARDING_SELECTIONS);
  } catch {
    return null;
  }
}
