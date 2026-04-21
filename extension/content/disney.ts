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
 * Disney+ doesn't expose a proper "watch history" page — the closest public
 * surface is the watchlist + continue-watching rail. This scraper targets
 * `/watchlist` (explicitly saved titles) and a profile "watch history" page
 * some markets ship behind `.../profile/watch-history`.
 *
 * Because Disney+ lacks a true history, imports from here skew toward
 * watchlist intent rather than actual completions. The review screen on
 * /import lets the user uncheck things they haven't watched; extension-path
 * users get everything auto-imported as watched. Document this trade-off
 * in the extension popup later; for now we just label and go.
 */
async function scrape(): Promise<SlateRow[]> {
  await waitFor(
    '[data-testid="standard-card"], [data-testid="watchlist-item"], .asset-list-item, [data-gv2containerkey]'
  );
  await autoScrollToBottom(800, 500);

  const candidateSelectors = [
    '[data-testid="watchlist-item"]',
    '[data-testid="standard-card"]',
    ".asset-list-item",
    '[data-gv2containerkey="watchlist"] [role="listitem"]',
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
    throw new Error("Disney+: no list items found. DOM may have changed.");
  }

  const out: SlateRow[] = [];
  for (const item of items) {
    // Primary title — prefer an aria-label on the container, then fall back
    // to text from any link or heading.
    const aria = item.getAttribute("aria-label") ?? "";
    const linkAria = item.querySelector("a")?.getAttribute("aria-label") ?? "";
    const heading = squish(textOf(item.querySelector("h3, h4, h5")));
    const title = squish(linkAria || aria || heading || textOf(item));

    if (!title || title.length < 2) continue;

    // Disney+ cards don't ship a watched date — leave undefined; the
    // pipeline stamps `now()` when absent.
    const dateAttr = item.getAttribute("data-watched-at");
    out.push({
      title,
      sourceText: title,
      date: toIsoDate(dateAttr ?? undefined),
    });
  }
  return out;
}

registerScraper("disney", scrape);
