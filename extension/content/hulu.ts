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
 * Hulu /account/watch-history. Hulu renders cards with the title as a
 * primary heading and the watch date as a secondary label underneath.
 * Infinite scroll — auto-scroll then collect.
 *
 * Hulu exposes episode titles like "S1 E3 — Pilot" alongside the show name,
 * which we leave in the sourceText. The server strips the episode suffix
 * when it sees `Series/Season` markers; Hulu's `"S1 E3"` format doesn't
 * match that regex, so we normalise here to the same colon-separated
 * form Netflix uses before sending.
 */
async function scrape(): Promise<SlateRow[]> {
  await waitFor(
    '[data-testid="watch-history"], .WatchHistory, [data-automationid="WatchHistory"]'
  );
  await autoScrollToBottom(700, 400);

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="watch-history-item"], .WatchHistoryCard, [data-automationid="WatchHistoryItem"]'
    )
  );
  if (cards.length === 0) {
    throw new Error("Hulu: no watch-history cards found. DOM may have changed.");
  }

  const out: SlateRow[] = [];
  for (const card of cards) {
    const showName = squish(
      textOf(
        card.querySelector(
          'h3, h4, [data-testid="series-title"], [class*="ShowTitle"]'
        )
      )
    );
    const episodeInfo = squish(
      textOf(
        card.querySelector(
          '[data-testid="episode-info"], [class*="EpisodeInfo"], [class*="Subtitle"]'
        )
      )
    );
    const dateRaw = squish(
      textOf(
        card.querySelector(
          'time, [data-testid="date"], [class*="WatchedDate"]'
        )
      )
    );

    if (!showName) continue;

    const isEpisode = /^S\d+\s*E\d+/i.test(episodeInfo);
    const normalisedTitle = isEpisode
      ? `${showName}: Season ${seasonFrom(episodeInfo) ?? "?"}: ${episodeInfo}`
      : showName;

    out.push({
      title: normalisedTitle,
      sourceText: normalisedTitle,
      date: toIsoDate(dateRaw),
      isEpisode,
      mediaHint: isEpisode ? "tv" : undefined,
    });
  }
  return out;
}

function seasonFrom(label: string): string | null {
  const m = label.match(/S(\d+)/i);
  return m ? m[1] : null;
}

registerScraper("hulu", scrape);
