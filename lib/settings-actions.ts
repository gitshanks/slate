"use server";

import { rotateImportToken } from "@/lib/slate-token";

/**
 * Thin server-action wrapper so the settings token card can call
 * `rotateImportToken()` from the browser. Returns null if the
 * `app_settings` table is missing — the card renders a setup hint in
 * that case.
 */
export async function rotateImportTokenAction(): Promise<string | null> {
  return rotateImportToken();
}
