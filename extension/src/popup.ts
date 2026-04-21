import {
  SERVICES,
  STORAGE_KEYS,
  type LastSyncRecord,
  type RuntimeMessage,
  type ServiceId,
} from "./shared";

/**
 * Popup entry point. Wires up the config inputs, renders the per-service
 * action list, and shows a simple activity log. All persistent state lives
 * in `chrome.storage.local`.
 */

const els = {
  slateUrl: document.getElementById("slate-url") as HTMLInputElement,
  slateToken: document.getElementById("slate-token") as HTMLInputElement,
  saveConfig: document.getElementById("save-config") as HTMLButtonElement,
  clearConfig: document.getElementById("clear-config") as HTMLButtonElement,
  services: document.getElementById("services") as HTMLDivElement,
  log: document.getElementById("log") as HTMLDivElement,
};

init().catch((err) => log(`error: ${err instanceof Error ? err.message : err}`, "err"));

async function init() {
  await loadConfig();
  bindConfigButtons();
  await renderServices();
}

// ─── Config ──────────────────────────────────────────────────────────

async function loadConfig() {
  const { [STORAGE_KEYS.slateUrl]: url, [STORAGE_KEYS.slateToken]: token } =
    await chrome.storage.local.get([
      STORAGE_KEYS.slateUrl,
      STORAGE_KEYS.slateToken,
    ]);
  if (typeof url === "string") els.slateUrl.value = url;
  if (typeof token === "string") els.slateToken.value = token;
}

function bindConfigButtons() {
  els.saveConfig.addEventListener("click", async () => {
    const url = els.slateUrl.value.trim().replace(/\/+$/, "");
    const token = els.slateToken.value.trim();
    if (!url || !token) {
      log("Need both Slate URL and token", "warn");
      return;
    }
    try {
      // Reject obviously malformed URLs here so the background worker
      // doesn't have to trip over them later.
      new URL(url);
    } catch {
      log("Slate URL is not a valid URL", "err");
      return;
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.slateUrl]: url,
      [STORAGE_KEYS.slateToken]: token,
    });
    log("Saved Slate config", "ok");
    await renderServices();
  });

  els.clearConfig.addEventListener("click", async () => {
    await chrome.storage.local.remove([
      STORAGE_KEYS.slateUrl,
      STORAGE_KEYS.slateToken,
    ]);
    els.slateUrl.value = "";
    els.slateToken.value = "";
    log("Cleared Slate config", "warn");
    await renderServices();
  });
}

// ─── Services ────────────────────────────────────────────────────────

async function renderServices() {
  const [{ [STORAGE_KEYS.slateUrl]: slateUrl }, lastSyncRaw] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEYS.slateUrl),
    chrome.storage.local.get(STORAGE_KEYS.lastSync),
  ]);
  const lastSync = (lastSyncRaw[STORAGE_KEYS.lastSync] ?? {}) as Record<
    ServiceId,
    LastSyncRecord
  >;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tab?.url ?? "";

  els.services.innerHTML = "";
  if (!slateUrl) {
    els.services.innerHTML = `<div class="empty">Save your Slate URL above to enable sync.</div>`;
    return;
  }

  for (const def of SERVICES) {
    const row = document.createElement("div");
    row.className = "service";

    const onThisTab = def.urlPattern.test(currentUrl);
    const last = lastSync[def.id];

    const name = document.createElement("div");
    name.className = "service-name";
    name.innerHTML = `<strong>${def.label}</strong><span>${
      last
        ? `last: ${formatRelative(last.at)} · ${last.inserted} saved`
        : "never synced"
    }</span>`;

    const action = document.createElement("div");
    action.style.display = "flex";
    action.style.alignItems = "center";
    action.style.gap = "6px";

    const status = document.createElement("span");
    status.className = "status";
    if (onThisTab) {
      status.textContent = "on this tab";
      status.classList.add("ok");
    } else {
      status.textContent = "not open";
    }

    const btn = document.createElement("button");
    btn.textContent = onThisTab ? "Sync now" : "Open";
    btn.className = onThisTab ? "primary" : "";
    btn.addEventListener("click", async () => {
      if (!onThisTab) {
        await chrome.tabs.create({ url: def.historyUrl });
        window.close();
        return;
      }
      await triggerSync(def.id, btn);
    });

    action.append(status, btn);
    row.append(name, action);
    els.services.append(row);
  }
}

async function triggerSync(service: ServiceId, btn: HTMLButtonElement) {
  const originalLabel = btn.textContent ?? "Sync now";
  btn.disabled = true;
  btn.textContent = "Syncing…";
  log(`${service}: scraping…`);
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "SYNC_SERVICE",
      service,
    } satisfies RuntimeMessage)) as RuntimeMessage;
    if (res.type !== "SYNC_RESULT") {
      log(`${service}: unexpected response`, "err");
      return;
    }
    if (!res.ok) {
      log(`${service}: ${res.error ?? "failed"}`, "err");
      return;
    }
    const unmatched =
      (res.unmatchedCount ?? 0) > 0
        ? ` — ${res.unmatchedCount} unmatched`
        : "";
    log(`${service}: ${res.inserted ?? 0} saved${unmatched}`, "ok");
  } catch (err) {
    log(`${service}: ${err instanceof Error ? err.message : err}`, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
    await renderServices();
  }
}

// ─── Log ─────────────────────────────────────────────────────────────

type LogLevel = "ok" | "warn" | "err" | "info";

function log(message: string, level: LogLevel = "info") {
  const row = document.createElement("div");
  row.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  if (level !== "info") row.style.color = colorFor(level);
  els.log.prepend(row);
  while (els.log.children.length > 8) {
    els.log.lastChild?.remove();
  }
}

function colorFor(level: LogLevel): string {
  switch (level) {
    case "ok":
      return "var(--ok)";
    case "warn":
      return "var(--warn)";
    case "err":
      return "var(--err)";
    default:
      return "var(--muted)";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  if (!Number.isFinite(then)) return iso;
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}
