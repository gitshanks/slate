import {
  SERVICES,
  STORAGE_KEYS,
  type LastSyncRecord,
  type RuntimeMessage,
  type ServiceId,
  type SlateRow,
} from "./shared";

/**
 * MV3 service worker. Owns the Slate API POST — centralising the token read
 * keeps it out of content scripts (which run in page context and could be
 * read by the host service's JS).
 *
 * Flow when the popup asks for a sync:
 *   1. Popup sends SYNC_SERVICE { service }.
 *   2. We find the matching tab, inject the content script's `scrape()` via
 *      `chrome.scripting.executeScript`, and wait for the rows it returns.
 *   3. We POST the rows to /api/import/submit with the stored bearer token.
 *   4. We stash a last-sync record and reply SYNC_RESULT to the popup.
 */

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, reply) => {
  if (message.type === "SYNC_SERVICE") {
    // Handled async — return true to keep the channel open for `reply`.
    runSync(message.service)
      .then((result) => reply(result))
      .catch((err: unknown) =>
        reply({
          type: "SYNC_RESULT",
          service: message.service,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies RuntimeMessage)
      );
    return true;
  }
  return false;
});

async function runSync(service: ServiceId): Promise<RuntimeMessage> {
  const def = SERVICES.find((s) => s.id === service);
  if (!def) {
    return { type: "SYNC_RESULT", service, ok: false, error: "Unknown service" };
  }

  const { [STORAGE_KEYS.slateUrl]: slateUrl, [STORAGE_KEYS.slateToken]: token } =
    await chrome.storage.local.get([
      STORAGE_KEYS.slateUrl,
      STORAGE_KEYS.slateToken,
    ]);
  if (!slateUrl || !token) {
    return {
      type: "SYNC_RESULT",
      service,
      ok: false,
      error: "Slate URL or token missing — open the popup and paste them.",
    };
  }

  // Find the active tab that matches this service. We require the user to be
  // on the right page first so we don't open tabs they didn't ask for.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !def.urlPattern.test(tab.url)) {
    return {
      type: "SYNC_RESULT",
      service,
      ok: false,
      error: `Open ${def.historyUrl} in the active tab first.`,
    };
  }

  const rows = await scrapeTab(tab.id, service);
  if (rows.length === 0) {
    return {
      type: "SYNC_RESULT",
      service,
      ok: false,
      error: "No titles scraped — check that the history page has loaded.",
    };
  }

  const res = await postToSlate(String(slateUrl), String(token), service, rows);
  if (!res.ok) {
    return { type: "SYNC_RESULT", service, ok: false, error: res.error };
  }

  await recordLastSync(service, res.inserted, res.unmatchedCount);
  return {
    type: "SYNC_RESULT",
    service,
    ok: true,
    inserted: res.inserted,
    unmatchedCount: res.unmatchedCount,
  };
}

/**
 * Ask the tab's content script for its scraped rows. The manifest declares
 * per-service content scripts so any tab the user NAVIGATED TO after install
 * already has the listener registered. But a tab that was open BEFORE install
 * has no listener — `sendMessage` then fails with "Receiving end does not
 * exist". We detect that and fall back to programmatic injection via
 * `chrome.scripting.executeScript`, which matches what the manifest would
 * have done, then retry the message.
 */
async function scrapeTab(tabId: number, service: ServiceId): Promise<SlateRow[]> {
  try {
    return await sendScrapeMessage(tabId, service);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(msg)) {
      throw err;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [`content/${service}.js`],
    });
    return await sendScrapeMessage(tabId, service);
  }
}

function sendScrapeMessage(
  tabId: number,
  service: ServiceId
): Promise<SlateRow[]> {
  return new Promise((resolve, reject) => {
    const message: RuntimeMessage = { type: "SCRAPE", service };
    chrome.tabs.sendMessage(
      tabId,
      message,
      (response: RuntimeMessage | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? "Tab unreachable"));
          return;
        }
        if (!response || response.type !== "SCRAPE_RESULT") {
          reject(new Error("Scraper returned unexpected message"));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.rows);
      }
    );
  });
}

interface SubmitResponse {
  inserted: number;
  unmatchedCount: number;
  unmatched: string[];
}

async function postToSlate(
  baseUrl: string,
  token: string,
  service: ServiceId,
  rows: SlateRow[]
): Promise<
  | { ok: true; inserted: number; unmatchedCount: number; unmatched: string[] }
  | { ok: false; error: string }
> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/import/submit`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ service, rows }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) {
        return {
          ok: false,
          error: "Token invalid — regenerate it in Slate /settings.",
        };
      }
      return { ok: false, error: `Slate ${res.status}: ${body.slice(0, 160)}` };
    }
    const json = (await res.json()) as SubmitResponse;
    return { ok: true, ...json };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function recordLastSync(
  service: ServiceId,
  inserted: number,
  unmatchedCount: number
) {
  const existing = await chrome.storage.local.get(STORAGE_KEYS.lastSync);
  const record = (existing[STORAGE_KEYS.lastSync] ?? {}) as Record<
    ServiceId,
    LastSyncRecord
  >;
  record[service] = {
    at: new Date().toISOString(),
    inserted,
    unmatchedCount,
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.lastSync]: record });
}
