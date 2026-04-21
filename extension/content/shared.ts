import type { RuntimeMessage, ServiceId, SlateRow } from "../src/shared";

/**
 * Content-script helpers used by every per-service scraper. Each scraper
 * registers itself via `registerScraper("netflix", scrape)` and this module
 * wires up the `chrome.runtime.onMessage` handler that the background
 * worker invokes.
 *
 * We keep the public API tiny on purpose — scrapers should be replaceable
 * when a service redesigns its history page.
 */

export type ScrapeFn = () => Promise<SlateRow[]>;

export function registerScraper(service: ServiceId, scrape: ScrapeFn): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, reply) => {
    if (message.type !== "SCRAPE" || message.service !== service) {
      return false;
    }
    scrape()
      .then((rows) =>
        reply({ type: "SCRAPE_RESULT", service, rows } satisfies RuntimeMessage)
      )
      .catch((err: unknown) =>
        reply({
          type: "SCRAPE_RESULT",
          service,
          rows: [],
          error: err instanceof Error ? err.message : String(err),
        } satisfies RuntimeMessage)
      );
    return true;
  });
}

/**
 * Scroll the page until no more content loads. Services use infinite
 * scroll — we have to ride it to the bottom to capture the full history.
 * Bails after N idle ticks (scroll height didn't change) or after a
 * safety cap of `maxMs` milliseconds.
 */
export async function autoScrollToBottom(
  step = 800,
  pauseMs = 400,
  maxMs = 120_000
): Promise<void> {
  const scroller = document.scrollingElement ?? document.documentElement;
  const started = Date.now();
  let lastHeight = -1;
  let idleTicks = 0;
  while (Date.now() - started < maxMs) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
    await sleep(pauseMs);
    scroller.scrollBy({ top: step, behavior: "instant" });
    await sleep(pauseMs);
    const h = scroller.scrollHeight;
    if (h === lastHeight) {
      idleTicks += 1;
      if (idleTicks >= 3) break;
    } else {
      idleTicks = 0;
      lastHeight = h;
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a selector to appear (useful when the user clicks Sync the
 * instant the page loads — rows may not be rendered yet).
 */
export async function waitFor(selector: string, timeout = 8000): Promise<Element | null> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(200);
  }
  return null;
}

export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

/**
 * Parse "Mon, Jan 8, 2024" / "Jan 8, 2024" / "2024-01-08" / "1/8/2024" into
 * an ISO string, or undefined if we can't. Services format dates
 * inconsistently; our import-parse normaliser re-parses on the server.
 */
export function toIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * Collapse whitespace inside a title string. Netflix episode titles often
 * come back with extra inline whitespace from the DOM text concatenation.
 */
export function squish(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
