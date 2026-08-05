import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type IncomingMessage } from "node:http";
import {
  request as httpsRequest,
  type RequestOptions as HttpsRequestOptions,
} from "node:https";
import { extractSharedTitleMentions, type SharedTitleMention } from "@/lib/ai-search";
import { getLibraryClient, libraryClientForOwner } from "@/lib/library-db";
import {
  findByImdbId,
  getMovie,
  getTv,
  searchMultiWithFallback,
  type TmdbMediaResult,
} from "@/lib/tmdb";

const MAX_PAGE_BYTES = 1_500_000;
const MAX_SOURCE_CHARS = 24_000;
const MAX_CANDIDATES = 12;

export interface SharedLinkInput {
  url?: string;
  text?: string;
  title?: string;
}

export interface SharedLinkCandidate {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  posterPath: string | null;
  overview: string | null;
  voteAverage: number | null;
  sourceTitle: string;
  inLibrary: boolean;
}

export interface SharedLinkResolution {
  source: {
    url: string | null;
    hostname: string | null;
    title: string | null;
  };
  candidates: SharedLinkCandidate[];
  warning?: string;
}

interface PageSignals {
  finalUrl: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  readableText: string;
  structuredTitles: SharedTitleMention[];
}

export async function resolveSharedLink(
  input: SharedLinkInput,
  ownerId?: string,
): Promise<SharedLinkResolution> {
  const suppliedTitle = cleanInput(input.title, 500);
  const suppliedText = cleanInput(input.text, 8_000);
  const suppliedUrl = cleanInput(input.url, 4_000);
  const url = extractFirstUrl(suppliedUrl || suppliedText || suppliedTitle);
  const direct = url ? await resolveDirectCatalogueUrl(url) : null;

  if (direct) {
    return attachLibraryState(
      {
        source: {
          url,
          hostname: hostnameOf(url),
          title: direct.title,
        },
        candidates: [direct],
      },
      ownerId,
    );
  }

  let page: PageSignals | null = null;
  let pageWarning: string | undefined;
  if (url) {
    try {
      page = await readPageSignals(url);
    } catch {
      pageWarning =
        "slate could not read the page itself. It matched against the text shared by the app instead.";
    }
  }

  const sourceText = buildExtractionSource({
    suppliedTitle,
    suppliedText,
    url,
    page,
  });
  if (!sourceText.trim()) {
    throw new Error("Paste a link or some text that mentions a film or show.");
  }

  const aiMentions = await extractSharedTitleMentions(sourceText);
  const mentions = dedupeMentions([
    ...(page?.structuredTitles ?? []),
    ...aiMentions,
    ...fallbackMentions(page),
  ]).slice(0, MAX_CANDIDATES);

  if (mentions.length === 0) {
    throw new Error(
      "No clear film or TV title was found. Try another link, or paste the recommendation text with it.",
    );
  }

  const matched = await mapPool(mentions, 4, matchMention);
  const candidates = dedupeCandidates(
    matched.filter((item): item is SharedLinkCandidate => item !== null),
  ).slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    throw new Error(
      "slate found some names, but none matched a film or TV show on TMDB.",
    );
  }

  return attachLibraryState({
    source: {
      url: page?.finalUrl ?? url,
      hostname: hostnameOf(page?.finalUrl ?? url),
      title: page?.title ?? (suppliedTitle || null),
    },
    candidates,
    warning: pageWarning,
  }, ownerId);
}

async function resolveDirectCatalogueUrl(
  url: string,
): Promise<SharedLinkCandidate | null> {
  const tmdb = url.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
  if (tmdb) {
    const mediaType = tmdb[1].toLowerCase() as "movie" | "tv";
    const tmdbId = Number(tmdb[2]);
    const detail = mediaType === "movie" ? await getMovie(tmdbId) : await getTv(tmdbId);
    return candidateFromDetail(mediaType, detail, "Direct TMDB link");
  }

  const imdb = url.match(/imdb\.com\/title\/(tt\d{5,12})/i);
  if (imdb) {
    const result = await findByImdbId(imdb[1].toLowerCase());
    return result ? candidateFromSearch(result, "Direct IMDb link") : null;
  }

  const knownPage = mentionFromKnownTitleUrl(url);
  if (knownPage) {
    const candidate = await matchMention(knownPage);
    return candidate ? { ...candidate, sourceTitle: "Direct title link" } : null;
  }

  return null;
}

function mentionFromKnownTitleUrl(url: string): SharedTitleMention | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const patterns: Array<{
    host: (value: string) => boolean;
    expression: RegExp;
    mediaType: SharedTitleMention["media_type"];
  }> = [
    {
      host: (value) => value === "letterboxd.com" || value.endsWith(".letterboxd.com"),
      expression: /^\/film\/([^/]+)/i,
      mediaType: "movie",
    },
    {
      host: (value) => value.endsWith("rottentomatoes.com"),
      expression: /^\/m\/([^/]+)/i,
      mediaType: "movie",
    },
    {
      host: (value) => value.endsWith("rottentomatoes.com"),
      expression: /^\/tv\/([^/]+)/i,
      mediaType: "tv",
    },
    {
      host: (value) => value === "trakt.tv" || value.endsWith(".trakt.tv"),
      expression: /^\/movies\/([^/]+)/i,
      mediaType: "movie",
    },
    {
      host: (value) => value === "trakt.tv" || value.endsWith(".trakt.tv"),
      expression: /^\/shows\/([^/]+)/i,
      mediaType: "tv",
    },
  ];
  const matchedPattern = patterns.find((pattern) => pattern.host(host));
  const slug = matchedPattern?.expression.exec(parsed.pathname)?.[1];
  if (!matchedPattern || !slug) return null;
  const decoded = decodeURIComponent(slug).replace(/[-_]+/g, " ").trim();
  const yearMatch = decoded.match(/\b((?:18|19|20|21)\d{2})$/);
  const title = yearMatch
    ? decoded.slice(0, yearMatch.index).trim()
    : decoded;
  if (!title) return null;
  return {
    title,
    year: yearMatch ? Number(yearMatch[1]) : null,
    media_type: matchedPattern.mediaType,
  };
}

function candidateFromDetail(
  mediaType: "movie" | "tv",
  detail: Awaited<ReturnType<typeof getMovie>> | Awaited<ReturnType<typeof getTv>>,
  sourceTitle: string,
): SharedLinkCandidate {
  const isMovie = mediaType === "movie";
  const movie = isMovie ? (detail as Awaited<ReturnType<typeof getMovie>>) : null;
  const tv = !isMovie ? (detail as Awaited<ReturnType<typeof getTv>>) : null;
  const date = movie?.release_date ?? tv?.first_air_date ?? null;
  return {
    tmdbId: detail.id,
    mediaType,
    title: movie?.title ?? tv?.name ?? "Untitled",
    year: date?.slice(0, 4) || null,
    posterPath: detail.poster_path,
    overview: detail.overview || null,
    voteAverage: detail.vote_average ?? null,
    sourceTitle,
    inLibrary: false,
  };
}

async function matchMention(
  mention: SharedTitleMention,
): Promise<SharedLinkCandidate | null> {
  try {
    const query = mention.year ? `${mention.title} ${mention.year}` : mention.title;
    const exact = await searchMultiWithFallback(query);
    let results = exact.results;
    if (results.length === 0 && mention.year) {
      results = (await searchMultiWithFallback(mention.title)).results;
    }
    if (results.length === 0) return null;

    const ranked = results
      .slice(0, 10)
      .map((result, index) => ({ result, score: scoreMatch(result, mention, index) }))
      .sort((a, b) => b.score - a.score);
    return candidateFromSearch(ranked[0].result, mention.title);
  } catch {
    return null;
  }
}

function scoreMatch(
  result: TmdbMediaResult,
  mention: SharedTitleMention,
  index: number,
): number {
  const resultTitle = displayTitle(result);
  const wanted = normalizeTitle(mention.title);
  const actual = normalizeTitle(resultTitle);
  let score = Math.max(0, 20 - index);
  if (actual === wanted) score += 200;
  else if (actual.includes(wanted) || wanted.includes(actual)) score += 70;
  if (mention.media_type !== "unknown" && result.media_type === mention.media_type) {
    score += 35;
  }
  const resultYear = yearOf(result);
  if (mention.year && resultYear === mention.year) score += 60;
  return score;
}

function candidateFromSearch(
  result: TmdbMediaResult,
  sourceTitle: string,
): SharedLinkCandidate {
  return {
    tmdbId: result.id,
    mediaType: result.media_type,
    title: displayTitle(result),
    year: yearOf(result)?.toString() ?? null,
    posterPath: result.poster_path ?? null,
    overview: result.overview || null,
    voteAverage:
      typeof result.vote_average === "number" ? result.vote_average : null,
    sourceTitle,
    inLibrary: false,
  };
}

async function attachLibraryState(
  resolution: SharedLinkResolution,
  ownerId?: string,
): Promise<SharedLinkResolution> {
  const db = ownerId ? libraryClientForOwner(ownerId) : await getLibraryClient();
  const { data } = await db.from("titles").select("tmdb_id, media_type");
  const existing = new Set(
    (data ?? []).map(
      (row) => `${Number(row.tmdb_id)}:${String(row.media_type)}`,
    ),
  );
  return {
    ...resolution,
    candidates: resolution.candidates.map((candidate) => ({
      ...candidate,
      inLibrary: existing.has(`${candidate.tmdbId}:${candidate.mediaType}`),
    })),
  };
}

async function readPageSignals(inputUrl: string): Promise<PageSignals> {
  const initialUrl = validateRemoteUrl(inputUrl);
  const [pageResult, oembedResult] = await Promise.allSettled([
    safeRequestText(initialUrl),
    readOembed(initialUrl),
  ]);
  const oembed =
    oembedResult.status === "fulfilled" ? oembedResult.value : null;

  if (pageResult.status === "rejected" && !oembed) {
    throw pageResult.reason;
  }

  const html = pageResult.status === "fulfilled" ? pageResult.value.body : "";
  const metadata = extractMetadata(html);
  const youtubeDescription = extractYoutubeDescription(html);
  const youtubeTranscript = await readYoutubeTranscript(html).catch(() => null);
  const readableText = [
    youtubeTranscript ? `VIDEO TRANSCRIPT:\n${youtubeTranscript}` : "",
    extractReadableText(html),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 20_000);
  const structuredTitles = extractStructuredTitles(html);

  return {
    finalUrl:
      pageResult.status === "fulfilled"
        ? pageResult.value.finalUrl
        : initialUrl.toString(),
    title: oembed?.title ?? metadata.title,
    description:
      youtubeDescription ?? oembed?.description ?? metadata.description,
    siteName: metadata.siteName ?? oembed?.authorName ?? null,
    readableText,
    structuredTitles,
  };
}

async function readOembed(url: URL): Promise<{
  title: string | null;
  description: string | null;
  authorName: string | null;
} | null> {
  const host = url.hostname.toLowerCase();
  let endpoint: URL | null = null;
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    endpoint = new URL("https://www.youtube.com/oembed");
  } else if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    endpoint = new URL("https://www.tiktok.com/oembed");
  }
  if (!endpoint) return null;
  endpoint.searchParams.set("url", url.toString());
  endpoint.searchParams.set("format", "json");
  const result = await safeRequestText(endpoint);
  const data = JSON.parse(result.body) as {
    title?: unknown;
    author_name?: unknown;
  };
  return {
    title: typeof data.title === "string" ? data.title : null,
    description: null,
    authorName:
      typeof data.author_name === "string" ? data.author_name : null,
  };
}

function buildExtractionSource({
  suppliedTitle,
  suppliedText,
  url,
  page,
}: {
  suppliedTitle: string;
  suppliedText: string;
  url: string | null;
  page: PageSignals | null;
}): string {
  const parts = [
    suppliedTitle && `SHARED TITLE:\n${suppliedTitle}`,
    suppliedText && `SHARED TEXT:\n${suppliedText}`,
    url && `SOURCE URL:\n${url}`,
    page?.title && `PAGE TITLE:\n${page.title}`,
    page?.description && `PAGE DESCRIPTION OR CAPTION:\n${page.description}`,
    page?.siteName && `SITE OR CREATOR:\n${page.siteName}`,
    page?.readableText && `READABLE PAGE TEXT:\n${page.readableText}`,
  ].filter(Boolean);
  const joined = parts.join("\n\n");
  if (joined.length <= MAX_SOURCE_CHARS) return joined;
  return `${joined.slice(0, 18_000)}\n\n[END OF PAGE]\n${joined.slice(-5_500)}`;
}

function fallbackMentions(page: PageSignals | null): SharedTitleMention[] {
  if (!page?.title) return [];
  const letterboxd = page.title.match(/^(.+?)\s+\((\d{4})\).*(?:Letterboxd|directed by)/i);
  if (letterboxd) {
    return [
      {
        title: letterboxd[1].trim(),
        year: Number(letterboxd[2]),
        media_type: "unknown",
      },
    ];
  }
  return [];
}

function extractMetadata(html: string): {
  title: string | null;
  description: string | null;
  siteName: string | null;
} {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content) values.set(key, decodeHtml(attrs.content));
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title:
      values.get("og:title") ??
      values.get("twitter:title") ??
      (titleTag ? decodeHtml(stripTags(titleTag)).trim() : null),
    description:
      values.get("og:description") ??
      values.get("twitter:description") ??
      values.get("description") ??
      null,
    siteName: values.get("og:site_name") ?? null,
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function extractYoutubeDescription(html: string): string | null {
  const encoded = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  if (!encoded) return null;
  try {
    return JSON.parse(`"${encoded}"`) as string;
  } catch {
    return null;
  }
}

async function readYoutubeTranscript(html: string): Promise<string | null> {
  const encodedTracks = html.match(
    /"captionTracks":(\[\{[\s\S]*?\}\])(?:,"audioTracks"|,"videoDetails")/,
  )?.[1];
  if (!encodedTracks) return null;

  let tracks: Array<{ baseUrl?: unknown; languageCode?: unknown; kind?: unknown }>;
  try {
    tracks = JSON.parse(encodedTracks) as typeof tracks;
  } catch {
    return null;
  }
  const preferred =
    tracks.find((track) => track.languageCode === "en" && track.kind !== "asr") ??
    tracks.find((track) => track.languageCode === "en") ??
    tracks[0];
  if (!preferred || typeof preferred.baseUrl !== "string") return null;

  const captionUrl = validateRemoteUrl(decodeHtml(preferred.baseUrl));
  captionUrl.searchParams.set("fmt", "json3");
  const response = await safeRequestText(captionUrl);
  try {
    const data = JSON.parse(response.body) as {
      events?: Array<{ segs?: Array<{ utf8?: unknown }> }>;
    };
    const transcript = (data.events ?? [])
      .flatMap((event) => event.segs ?? [])
      .map((segment) =>
        typeof segment.utf8 === "string" ? segment.utf8 : "",
      )
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return transcript.slice(0, 16_000) || null;
  } catch {
    const transcript = decodeHtml(stripTags(response.body))
      .replace(/\s+/g, " ")
      .trim();
    return transcript.slice(0, 16_000) || null;
  }
}

function extractStructuredTitles(html: string): SharedTitleMention[] {
  const output: SharedTitleMention[] = [];
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      walkJsonLd(JSON.parse(decodeHtml(match[1])), output, 0);
    } catch {
      // Invalid JSON-LD is common and should not sink the whole share.
    }
    if (output.length >= MAX_CANDIDATES) break;
  }
  return dedupeMentions(output);
}

function walkJsonLd(value: unknown, output: SharedTitleMention[], depth: number) {
  if (depth > 5 || output.length >= MAX_CANDIDATES || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkJsonLd(item, output, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  const rawType = object["@type"];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  const isMovie = types.includes("Movie");
  const isTv = types.some((type) =>
    ["TVSeries", "TVEpisode", "TVSeason"].includes(String(type)),
  );
  if ((isMovie || isTv) && typeof object.name === "string") {
    const date =
      typeof object.datePublished === "string" ? object.datePublished : "";
    const yearMatch = date.match(/\b(18|19|20|21)\d{2}\b/);
    output.push({
      title: object.name.trim(),
      year: yearMatch ? Number(yearMatch[0]) : null,
      media_type: isMovie ? "movie" : "tv",
    });
  }
  for (const child of Object.values(object)) {
    walkJsonLd(child, output, depth + 1);
  }
}

function extractReadableText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/article|\/section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(cleaned)
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 20_000);
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    }
    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    }
    return named[lower] ?? `&${entity};`;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

async function safeRequestText(
  input: URL,
  redirectsRemaining = 3,
): Promise<{ body: string; finalUrl: string }> {
  const url = validateRemoteUrl(input.toString());
  const addresses = await dnsLookup(url.hostname, { all: true, verbatim: true });
  const address = addresses.find((entry) => isPublicIp(entry.address));
  if (!address) throw new Error("The shared host is not publicly reachable.");

  return new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const options: HttpsRequestOptions = {
      protocol: url.protocol,
      hostname: address.address,
      family: address.family,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      method: "GET",
      path: `${url.pathname}${url.search}`,
      servername: url.protocol === "https:" ? url.hostname : undefined,
      headers: {
        Host: url.host,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8",
        "Accept-Encoding": "identity",
        "User-Agent":
          "Mozilla/5.0 (compatible; SlateLinkReader/1.0; +https://slate.nishh.dev)",
      },
    };
    const req = request(options, (response: IncomingMessage) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirectsRemaining <= 0) {
          reject(new Error("Too many redirects while reading the shared link."));
          return;
        }
        const next = new URL(location, url);
        safeRequestText(next, redirectsRemaining - 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Shared page returned ${status}.`));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_PAGE_BYTES) {
          req.destroy(new Error("Shared page is too large."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          finalUrl: url.toString(),
        });
      });
      response.on("error", reject);
    });
    req.setTimeout(8_000, () => req.destroy(new Error("Shared page timed out.")));
    req.on("error", reject);
    req.end();
  });
}

function validateRemoteUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a valid link.");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only web links can be imported.");
  }
  if (url.username || url.password) {
    throw new Error("Links containing credentials are not supported.");
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error("Links using custom ports are not supported.");
  }
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local")) {
    throw new Error("Local links cannot be imported.");
  }
  if (isIP(host) && !isPublicIp(host)) {
    throw new Error("Private network links cannot be imported.");
  }
  url.hash = "";
  return url;
}

function isPublicIp(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.includes(":")) {
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    ) {
      return false;
    }
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mapped ? isPublicIp(mapped) : true;
  }
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  return match ? match.replace(/[),.;!?]+$/, "") : null;
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function cleanInput(value: string | undefined, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function displayTitle(result: TmdbMediaResult): string {
  return result.title ?? result.name ?? "Untitled";
}

function yearOf(result: TmdbMediaResult): number | null {
  const date =
    result.media_type === "movie" ? result.release_date : result.first_air_date;
  const year = date ? Number(date.slice(0, 4)) : Number.NaN;
  return Number.isFinite(year) ? year : null;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeMentions(mentions: SharedTitleMention[]): SharedTitleMention[] {
  const seen = new Set<string>();
  return mentions.filter((mention) => {
    const title = mention.title?.trim();
    if (!title) return false;
    const key = `${normalizeTitle(title)}:${mention.year ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeCandidates(candidates: SharedLinkCandidate[]): SharedLinkCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.tmdbId}:${candidate.mediaType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        output[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return output;
}
