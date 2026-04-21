import type { SlateRow } from "../src/shared";
import {
  autoScrollToBottom,
  registerScraper,
  squish,
  textOf,
  toIsoDate,
  waitFor,
} from "./shared";

/**
 * Netflix /viewingactivity scraper. The page virtualises nothing — it just
 * lazy-appends rows when you scroll — so we can collect everything in one
 * pass once auto-scroll finishes.
 *
 * Row shape (subject to Netflix redesigns):
 *   <li class="retableRow">
 *     <div class="col date"> Jan 8, 2024 </div>
 *     <div class="col title">
 *       <a href="/title/12345"> Breaking Bad: Season 1: Pilot </a>
 *     </div>
 *     …
 *   </li>
 *
 * We don't try to tell films from shows here — the server-side stripEpisode
 * + TMDB match handles that. Titles with a `":"` segment matching
 * Season/Chapter/… get collapsed to the show title server-side.
 */
async function scrape(): Promise<SlateRow[]> {
  await waitFor(".retableRow, li.retable");
  await autoScrollToBottom(600, 350);

  const rows = Array.from(
    document.querySelectorAll<HTMLLIElement>(".retableRow, li.retable")
  );
  if (rows.length === 0) {
    throw new Error("Netflix: no rows found. DOM may have changed.");
  }

  const out: SlateRow[] = [];
  for (const row of rows) {
    const rawTitle = squish(
      textOf(row.querySelector("a, .col.title a, .col.titleCol a")) ||
        textOf(row.querySelector(".col.title, .col.titleCol"))
    );
    if (!rawTitle) continue;

    const dateText =
      textOf(row.querySelector(".col.date, .col.dateCol")) || undefined;
    const date = toIsoDate(dateText);

    out.push({
      title: rawTitle,
      sourceText: rawTitle,
      date,
      // mediaHint intentionally undefined — Netflix mixes movies and shows;
      // the server infers TV from episode syntax and falls back to TMDB.
    });
  }
  return out;
}

registerScraper("netflix", scrape);
