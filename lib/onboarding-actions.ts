"use server";

import { revalidatePath } from "next/cache";
import { addTitle } from "@/lib/actions";
import { getLibraryClient, getLibraryOwnerId } from "@/lib/library-db";
import { getProfileById } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";

export interface OnboardingState {
  ok: boolean;
  message: string;
  savedCount?: number;
}

interface SelectedTitle {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

const MAX_SELECTIONS = 10;

export async function completeOnboarding(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const ownerId = await getLibraryOwnerId();
  const profile = await getProfileById(ownerId);
  if (!profile) return { ok: false, message: "Your profile could not be loaded." };

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
            status: "want",
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

function parseSelections(value: FormDataEntryValue | null): SelectedTitle[] | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length > MAX_SELECTIONS) return null;

    const seen = new Set<string>();
    const selections: SelectedTitle[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      if (
        !Number.isInteger(candidate.tmdbId) ||
        Number(candidate.tmdbId) <= 0 ||
        (candidate.mediaType !== "movie" && candidate.mediaType !== "tv")
      ) {
        return null;
      }
      const key = `${candidate.mediaType}:${candidate.tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selections.push({
        tmdbId: Number(candidate.tmdbId),
        mediaType: candidate.mediaType,
      });
    }
    return selections;
  } catch {
    return null;
  }
}
