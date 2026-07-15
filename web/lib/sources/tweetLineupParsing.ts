import * as cheerio from "cheerio";

export type TweetOEmbedHtmlData = {
  text: string | null;
  postedLabel: string | null;
  sourceTweetUrl: string | null;
};

export type ResolvedTweetReference = {
  tweetId: string;
  normalizedUrl: string;
  resolvedUrl: string;
  authorHandle: string | null;
  shortUrl: string | null;
};

const STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status(?:es)?\/\d+/gi;
const TCO_URL_PATTERN = /https?:\/\/t\.co\/[A-Za-z0-9]+/gi;

export function extractTweetIdFromUrl(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

export function extractTweetHandleFromUrl(value: string | null): string | null {
  if (!value) return null;
  const handle = value.match(
    /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)\/status(?:es)?\/\d+/i,
  )?.[1];
  return handle && handle.toLowerCase() !== "i" ? handle : null;
}

export function normalizeTweetStatusUrl(
  value: string | null,
  fallbackTweetId?: string | null
): string | null {
  const tweetId = extractTweetIdFromUrl(value) ?? fallbackTweetId ?? null;
  return tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null;
}

export function extractStatusUrlsFromText(text: string): string[] {
  return Array.from(text.matchAll(STATUS_URL_PATTERN), (match) => match[0]).filter(Boolean);
}

export function extractTcoUrlsFromText(text: string): string[] {
  return Array.from(text.matchAll(TCO_URL_PATTERN), (match) => match[0]).filter(Boolean);
}

export async function expandRedirectUrl(url: string): Promise<string | null> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
    },
    cache: "no-store"
  });

  const location = response.headers.get("location");
  if (location) {
    try {
      return new URL(location, url).toString();
    } catch {
      return location;
    }
  }

  return response.url && response.url !== url ? response.url : null;
}

export async function resolveQuotedTweetUrlFromText(text: string): Promise<string | null> {
  return (await resolveTweetReferenceFromText(text))?.normalizedUrl ?? null;
}

export async function resolveTweetReferenceFromText(
  text: string,
): Promise<ResolvedTweetReference | null> {
  const directStatusUrl = extractStatusUrlsFromText(text).find((value) =>
    Boolean(extractTweetIdFromUrl(value)),
  );
  if (directStatusUrl) {
    const tweetId = extractTweetIdFromUrl(directStatusUrl)!;
    return {
      tweetId,
      normalizedUrl: normalizeTweetStatusUrl(directStatusUrl, tweetId)!,
      resolvedUrl: directStatusUrl,
      authorHandle: extractTweetHandleFromUrl(directStatusUrl),
      shortUrl: null,
    };
  }

  for (const shortUrl of extractTcoUrlsFromText(text)) {
    const expandedUrl = await expandRedirectUrl(shortUrl);
    const tweetId = extractTweetIdFromUrl(expandedUrl);
    const normalizedUrl = normalizeTweetStatusUrl(expandedUrl, tweetId);
    if (expandedUrl && tweetId && normalizedUrl) {
      return {
        tweetId,
        normalizedUrl,
        resolvedUrl: expandedUrl,
        authorHandle: extractTweetHandleFromUrl(expandedUrl),
        shortUrl,
      };
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parseTweetOEmbedHtml(html: string): TweetOEmbedHtmlData {
  const root = cheerio.load(html);
  const paragraph = root("p").first();
  paragraph.find("br").replaceWith("\n");
  const text = paragraph.text().replace(/\n\s+/g, "\n").trim();
  const sourceLink = root("a").last();
  const postedLabel = normalizeWhitespace(sourceLink.text()) || null;
  const sourceTweetUrl = sourceLink.attr("href") ?? null;

  return {
    text: text || null,
    postedLabel,
    sourceTweetUrl
  };
}
