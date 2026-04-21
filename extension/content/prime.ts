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
 * Prime Video watch history (`amazon.com/gp/video/library` "Watch history"
 * tab, or `primevideo.com/settings/watch-history` on newer accounts).
 *
 * Amazon serves a paginated list of tiles rather than infinite scroll on
 * some accounts — we look for a "Load more" / "Show more" button and
 * click it until it disappears, then collect the tiles.
 */
async function scrape(): Promise<SlateRow[]> {
  await waitFor(
    '[data-testid="watch-history-list"], [data-automation-id="watch-history-list"], .DVWebNode-detail-btf-wrapper'
  );

  // Best-effort: repeatedly click any Show more button, then scroll.
  for (let i = 0; i < 40; i++) {
    const btn = Array.from(document.querySelectorAll("button, span, a")).find(
      (el) => /show more|load more|view more/i.test(textOf(el))
    ) as HTMLElement | undefined;
    if (!btn) break;
    btn.click();
    await new Promise((r) => setTimeout(r, 600));
  }
  await autoScrollToBottom(700, 400);

  // Multiple selector variants — Amazon A/B tests the DVD-era page against a
  // newer primevideo.com react layout.
  const candidateSelectors = [
    '[data-testid="watch-history-list"] li',
    '[data-automation-id="watch-history-list"] li',
    '.DVWebNode-detail-btf-wrapper .dv-node-dp-title',
    'li[data-automation-id^="video"]',
  ];
  let items: HTMLElement[] = [];
  for (const sel of candidateSelectors) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(sel));
    if (found.length > 0) {
      items = found;
      break;
    }
  }
  if (items.length === 0) {
    throw new Error("Prime Video: no history rows found. DOM may have changed.");
  }

  const out: SlateRow[] = [];
  for (const item of items) {
    // Title: look for a link or heading.
    const rawTitle =
      squish(textOf(item.querySelector("a[href*='/detail/']"))) ||
      squish(textOf(item.querySelector("h3, h4, .av-beard-title"))) ||
      squish(textOf(item));
    if (!rawTitle || rawTitle.length < 2) continue;

    // Date often appears as "Watched on Jan 8, 2024" in a secondary span.
    const metaText = squish(
      textOf(item.querySelector("time, .av-beard-metadata, [class*='WatchDate']"))
    );
    const dateMatch =
      metaText.match(
        /(\w{3,9}\s+\d{1,2},?\s+\d{4})/ // Jan 8, 2024
      ) ??
      metaText.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? toIsoDate(dateMatch[1]) : undefined;

    out.push({ title: rawTitle, sourceText: rawTitle, date });
  }
  return dedupeConsecutive(out);
}

/**
 * Prime lists every episode replay separately; the server dedupes by tmdb
 * id, but stripping obvious consecutive duplicates here keeps the POST
 * payload small.
 */
function dedupeConsecutive(rows: SlateRow[]): SlateRow[] {
  const out: SlateRow[] = [];
  let prev = "";
  for (const r of rows) {
    if (r.title === prev) continue;
    out.push(r);
    prev = r.title;
  }
  return out;
}

registerScraper("prime", scrape);
