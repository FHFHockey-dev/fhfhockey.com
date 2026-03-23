const BASE_URL_ONE = "https://api-web.nhle.com/v1";
const BASE_URL_TWO = "https://api.nhle.com/stats/rest/en";

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)"
};

function summarizeHtmlError(value: string): string {
  const title = value.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const host = title?.split("|")[0]?.trim() ?? null;
  const code = title?.match(/\|\s*(\d{3})\s*:/)?.[1]?.trim() ?? null;
  const reason =
    title?.match(/\|\s*\d{3}\s*:\s*([^|]+)/)?.[1]?.trim() ??
    "HTML error response";

  return [
    "Upstream returned HTML instead of JSON.",
    code ? `Code ${code}.` : null,
    reason ? `${reason}.` : null,
    host ? `Host: ${host}.` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function truncate(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store"
  });
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  const trimmed = bodyText.trim();
  const parsed = tryParseJson<T>(bodyText);
  const looksLikeHtml =
    trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html");

  if (!response.ok) {
    if (looksLikeHtml) {
      throw new Error(`${url} -> ${summarizeHtmlError(bodyText)}`);
    }

    if (parsed && typeof parsed === "object") {
      const candidate = parsed as { error?: unknown; message?: unknown };
      const message =
        typeof candidate.error === "string"
          ? candidate.error
          : typeof candidate.message === "string"
            ? candidate.message
            : `Request failed with status ${response.status}`;
      throw new Error(`${url} -> ${message}`);
    }

    const bodySummary = trimmed ? ` ${truncate(trimmed)}` : "";
    throw new Error(
      `${url} -> Request failed with status ${response.status}.${bodySummary}`
    );
  }

  if (parsed !== null) {
    return parsed;
  }

  if (looksLikeHtml) {
    throw new Error(`${url} -> ${summarizeHtmlError(bodyText)}`);
  }

  throw new Error(
    `${url} -> Expected JSON but received ${contentType || "unknown content type"}`
  );
}

/**
 * `BASE_URL` https://api-web.nhle.com/v1
 * @param path
 * @returns
 */
export function get<T = any>(path: string, debug: boolean = false): Promise<T> {
  const url = `${BASE_URL_ONE}${path}`;
  if (debug) {
    console.log({ url });
  }
  return fetchJson<T>(url)
    .catch((e) => {
      throw new Error("Failed to fetch " + url + "\n" + e.message);
    });
}

/**
 * `BASE_URL` https://api.nhle.com/stats/rest/en
 * @param path
 * @returns
 */
export function restGet<T = any>(
  path: string
): Promise<{ data: T[]; total: number }> {
  return fetchJson<{ data: T[]; total: number }>(`${BASE_URL_TWO}${path}`);
}
