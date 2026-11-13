// First-touch signup attribution, shared by the browser (which records where a
// visitor arrived from) and the server (which saves it once, when an account
// is created). Deliberately coarse: a source name, optional UTM tags, the
// referring site's host and the landing path. No identifiers, no full URLs.

export const SIGNUP_SOURCE_COOKIE = "slate_src";
export const SIGNUP_SOURCE_MAX_AGE = 30 * 24 * 60 * 60;

export interface SignupSource {
  source: string;
  medium: string | null;
  campaign: string | null;
  referrerHost: string | null;
  inApp: string | null;
  landingPath: string | null;
  firstSeenAt: string | null;
}

const SOURCE_ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  tt: "tiktok",
  fb: "facebook",
  twitter: "x",
  yt: "youtube",
  li: "linkedin",
};

const REFERRER_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/^t\.co$|(^|\.)(x|twitter)\.com$/, "x"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)linktr\.ee$/, "linktree"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)news\.ycombinator\.com$/, "hacker news"],
  [/(^|\.)producthunt\.com$/, "product hunt"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

// In-app browsers often send no referrer at all, so the user agent is the
// only sign that a visit came from a tap inside Instagram or TikTok.
const IN_APP_AGENTS: [RegExp, string][] = [
  [/Instagram/i, "instagram"],
  [/\bBarcelona\b/, "threads"],
  [/musical_ly|BytedanceWebview|TikTok/i, "tiktok"],
  [/FBAN|FBAV|FB_IAB/, "facebook"],
  [/LinkedInApp/i, "linkedin"],
  [/Snapchat/i, "snapchat"],
  [/Pinterest/i, "pinterest"],
  [/Twitter/i, "x"],
];

function clean(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase().slice(0, max);
  return trimmed || null;
}

export function normalizeSourceName(value: string): string {
  const key = value.trim().toLowerCase();
  return SOURCE_ALIASES[key] ?? key;
}

export function sourceForReferrerHost(host: string): string {
  const bare = host.toLowerCase().replace(/^www\./, "");
  return REFERRER_HOSTS.find(([pattern]) => pattern.test(bare))?.[1] ?? bare;
}

export function inAppBrowserFor(userAgent: string): string | null {
  return IN_APP_AGENTS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/** Resolve one visit into a source. UTM tags win, then the in-app browser,
 * then the referring site; anything else is a direct visit. */
export function resolveSignupSource(input: {
  search: string;
  referrer: string;
  userAgent: string;
  ownHost: string;
  path: string;
  now?: Date;
}): SignupSource {
  const params = new URLSearchParams(input.search);
  const utmSource = clean(params.get("utm_source"));
  let referrerHost: string | null = null;
  try {
    const host = input.referrer ? new URL(input.referrer).host.toLowerCase() : "";
    if (host && host !== input.ownHost.toLowerCase()) referrerHost = clean(host);
  } catch {
    referrerHost = null;
  }
  const inApp = inAppBrowserFor(input.userAgent);
  const source = utmSource
    ? normalizeSourceName(utmSource)
    : inApp ?? (referrerHost ? sourceForReferrerHost(referrerHost) : "direct");

  return {
    source,
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    referrerHost,
    inApp,
    landingPath: clean(input.path, 120),
    firstSeenAt: (input.now ?? new Date()).toISOString(),
  };
}

export function encodeSignupSource(value: SignupSource): string {
  return encodeURIComponent(JSON.stringify(value));
}

/** Parse the cookie defensively: it is client-written, so every field is
 * re-validated and clipped before it can reach the database. */
export function decodeSignupSource(raw: string | undefined | null): SignupSource | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const source = clean(parsed.source);
    if (!source) return null;
    const firstSeen = typeof parsed.firstSeenAt === "string" ? new Date(parsed.firstSeenAt) : null;
    return {
      source: normalizeSourceName(source),
      medium: clean(parsed.medium),
      campaign: clean(parsed.campaign),
      referrerHost: clean(parsed.referrerHost),
      inApp: clean(parsed.inApp, 20),
      landingPath: clean(parsed.landingPath, 120),
      firstSeenAt:
        firstSeen && !Number.isNaN(firstSeen.getTime()) ? firstSeen.toISOString() : null,
    };
  } catch {
    return null;
  }
}
