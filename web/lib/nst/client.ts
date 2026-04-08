import fetchWithCache from "lib/fetchWithCache";

export const NST_BASE_URL = "https://data.naturalstattrick.com";
export const NST_KEY_ENV_NAME = "NST_KEY";
export const NST_HEADER_NAME = "nst-key";
export const NST_DEFAULT_TIMEOUT_MS = 15_000;
export const NST_DEFAULT_RETRIES = 2;

export class NstConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NstConfigError";
  }
}

export class NstResponseError extends Error {
  status: number;
  redactedUrl: string;

  constructor(args: { status: number; redactedUrl: string; message?: string }) {
    super(args.message ?? `NST request failed with status ${args.status}`);
    this.name = "NstResponseError";
    this.status = args.status;
    this.redactedUrl = args.redactedUrl;
  }
}

export function isNstConfigError(error: unknown): error is NstConfigError {
  return error instanceof NstConfigError;
}

export function isNstResponseError(error: unknown): error is NstResponseError {
  return error instanceof NstResponseError;
}

export function isNstAuthError(error: unknown): error is NstResponseError {
  return isNstResponseError(error) && (error.status === 401 || error.status === 403);
}

export function isNstRateLimitError(error: unknown): error is NstResponseError {
  return isNstResponseError(error) && error.status === 429;
}

export interface NstRequestOptions {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  allowQueryKeyFallback?: boolean;
}

export interface NstRequestResult {
  response: Response;
  url: string;
  redactedUrl: string;
}

export interface ParsedNstUrl {
  path: string;
  query: Record<string, string>;
}

const NST_QUERY_KEY_PATTERN = /([?&]key=)([^&]+)/gi;

function normalizePath(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

export function parseNstUrl(url: string): ParsedNstUrl {
  const parsed = new URL(url);
  const query: Record<string, string> = {};

  parsed.searchParams.forEach((value, key) => {
    if (key === "key") {
      return;
    }
    query[key] = value;
  });

  return {
    path: normalizePath(parsed.pathname),
    query
  };
}

export function getNstKey(): string {
  const key = process.env[NST_KEY_ENV_NAME]?.trim();
  if (!key) {
    throw new NstConfigError("NST_KEY missing");
  }
  return key;
}

export function toNstOperatorMessage(error: unknown): string {
  if (isNstConfigError(error)) {
    return error.message;
  }

  if (isNstAuthError(error)) {
    return "NST authentication failed";
  }

  if (isNstRateLimitError(error)) {
    return "NST token budget exhausted";
  }

  if (isNstResponseError(error) && error.status >= 500) {
    return "NST upstream failed";
  }

  if (error instanceof Error && /abort|timeout/i.test(error.message)) {
    return "NST request timed out";
  }

  return "NST request failed";
}

export function buildNstUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): URL {
  const url = new URL(normalizePath(path), `${NST_BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function redactNstUrl(input: string | URL): string {
  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  if (url.searchParams.has("key")) {
    url.searchParams.set("key", "[REDACTED]");
  }
  return url.toString();
}

export function redactNstMessage(input: string): string {
  return input.replace(NST_QUERY_KEY_PATTERN, "$1[REDACTED]");
}

export function getNstHeaders(
  options?: Pick<NstRequestOptions, "headers" | "allowQueryKeyFallback">
): Record<string, string> {
  const key = getNstKey();
  return {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)",
    [NST_HEADER_NAME]: key,
    ...(options?.headers ?? {})
  };
}

export function buildNstRequestUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
  allowQueryKeyFallback = false
): URL {
  const url = buildNstUrl(path, query);
  if (allowQueryKeyFallback) {
    url.searchParams.set("key", getNstKey());
  }
  return url;
}

async function executeNstRequest(
  options: NstRequestOptions
): Promise<NstRequestResult> {
  const timeoutMs = options.timeoutMs ?? NST_DEFAULT_TIMEOUT_MS;
  const url = buildNstRequestUrl(
    options.path,
    options.query,
    options.allowQueryKeyFallback ?? false
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: getNstHeaders(options),
      cache: "no-store"
    });

    const redactedUrl = redactNstUrl(url);

    if (!response.ok) {
      throw new NstResponseError({
        status: response.status,
        redactedUrl
      });
    }

    return {
      response,
      url: url.toString(),
      redactedUrl
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(response: Response | null, error: unknown): boolean {
  if (error) {
    if (isNstResponseError(error)) {
      return error.status >= 500;
    }

    return true;
  }

  if (!response) {
    return true;
  }

  return response.status >= 500;
}

export async function nstRequest(
  options: NstRequestOptions
): Promise<NstRequestResult> {
  const retries = options.retries ?? NST_DEFAULT_RETRIES;
  let lastError: unknown = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await executeNstRequest(options);
      lastResponse = result.response;
      if (result.response.ok || !shouldRetry(result.response, null) || attempt === retries) {
        return result;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(null, error)) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return {
      response: lastResponse,
      url: "",
      redactedUrl: ""
    };
  }

  throw lastError instanceof Error ? lastError : new Error("NST request failed");
}

export async function fetchNstText(
  options: NstRequestOptions
): Promise<{ text: string; redactedUrl: string; response: Response }> {
  const result = await nstRequest(options);
  const text = await result.response.text();
  return {
    text: redactNstMessage(text),
    redactedUrl: result.redactedUrl,
    response: result.response
  };
}

export async function fetchNstTextByUrl(
  url: string,
  options?: Omit<NstRequestOptions, "path" | "query">
): Promise<{ text: string; redactedUrl: string; response: Response }> {
  const parsed = parseNstUrl(url);
  return fetchNstText({
    ...options,
    path: parsed.path,
    query: parsed.query
  });
}

export async function fetchNstTextWithCache(
  options: NstRequestOptions
): Promise<{ text: string; redactedUrl: string }> {
  const url = buildNstRequestUrl(
    options.path,
    options.query,
    options.allowQueryKeyFallback ?? false
  );
  const redactedUrl = redactNstUrl(url);
  const text = (await fetchWithCache(url.toString(), false, {
    cacheKey: redactedUrl,
    init: {
      headers: getNstHeaders(options),
      cache: "no-store"
    }
  })) as string;

  return {
    text: redactNstMessage(text),
    redactedUrl
  };
}

export async function fetchNstTextWithCacheByUrl(
  url: string,
  options?: Omit<NstRequestOptions, "path" | "query">
): Promise<{ text: string; redactedUrl: string }> {
  const parsed = parseNstUrl(url);
  return fetchNstTextWithCache({
    ...options,
    path: parsed.path,
    query: parsed.query
  });
}
