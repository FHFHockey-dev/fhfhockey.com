// @ts-expect-error memory-cache has no declarations in this project
import cacheData from "memory-cache";
import { NstExecutionLimitError, withNstRequestBudget, type NstRequestControl } from "./requestBudget";

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

export function isNstNotFoundError(error: unknown): error is NstResponseError {
  return isNstResponseError(error) && error.status === 404;
}

export interface NstRequestOptions {
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  allowQueryKeyFallback?: boolean;
  requestControl?: NstRequestControl;
}

export interface NstRequestResult {
  response: Response;
  url: string;
  redactedUrl: string;
  text?: string;
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

export function buildNstUrlString(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  return buildNstUrl(path, query).toString();
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

function stripRawQueryKey(rawSearch: string): string {
  if (!rawSearch) return "";

  const query = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
  const parts = query.split("&").filter((part) => {
    const key = part.split("=", 1)[0];
    return key.toLowerCase() !== "key";
  });

  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function buildNstRequestUrlFromAbsoluteUrl(
  inputUrl: string,
  allowQueryKeyFallback = false
): URL {
  const parsed = new URL(inputUrl);
  let rawSearch = stripRawQueryKey(parsed.search);
  if (allowQueryKeyFallback) {
    rawSearch += `${rawSearch ? "&" : "?"}key=${encodeURIComponent(getNstKey())}`;
  }

  return new URL(
    `${normalizePath(parsed.pathname)}${rawSearch}`,
    `${NST_BASE_URL}/`
  );
}

async function executeNstUrl(
  url: URL,
  options: Omit<NstRequestOptions, "path" | "query">
): Promise<NstRequestResult> {
  const headers = getNstHeaders(options);
  const control = options.requestControl!;
  return withNstRequestBudget(url.toString(), control, async () => {
    const controller = new AbortController();
    const timeoutMs = Math.min(options.timeoutMs ?? NST_DEFAULT_TIMEOUT_MS, control.deadlineAt - Date.now());
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method: "GET", signal: controller.signal, headers, cache: "no-store", redirect: "error"
      });
      const redactedUrl = redactNstUrl(url);
      if (!response.ok) {
        controller.abort();
        throw new NstResponseError({ status: response.status, redactedUrl });
      }
      // Keep the abort timer active through body consumption, not only headers.
      const text = await response.clone().text();
      return { response, url: url.toString(), redactedUrl, text };
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function executeNstRequest(options: NstRequestOptions): Promise<NstRequestResult> {
  return executeNstUrl(buildNstRequestUrl(options.path, options.query, options.allowQueryKeyFallback ?? false), options);
}

async function executeNstRequestUrl(
  inputUrl: string,
  options: Omit<NstRequestOptions, "path" | "query">
): Promise<NstRequestResult> {
  return executeNstUrl(buildNstRequestUrlFromAbsoluteUrl(inputUrl, options.allowQueryKeyFallback ?? false), options);
}

function withRequestControl<T extends Omit<NstRequestOptions, "path" | "query">>(options: T): T {
  return {
    ...options,
    requestControl: options.requestControl ?? {
      deadlineAt: Date.now() + 220_000,
      maxAttempts: (options.retries ?? NST_DEFAULT_RETRIES) + 1,
      attemptsStarted: 0,
      // Other callers retain their existing pacing/parallelism. Gamelog passes
      // its day-aperture interval explicitly; all clients share rolling budgets.
      minIntervalMs: 0
    }
  };
}

function shouldRetry(response: Response | null, error: unknown): boolean {
  if (error) {
    if (error instanceof NstExecutionLimitError || isNstConfigError(error)) return false;
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
  options = withRequestControl(options);
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

async function nstRequestUrl(
  url: string,
  options?: Omit<NstRequestOptions, "path" | "query">
): Promise<NstRequestResult> {
  options = withRequestControl(options ?? {});
  const retries = options.retries ?? NST_DEFAULT_RETRIES;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await executeNstRequestUrl(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(null, error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("NST request failed");
}

export async function fetchNstText(
  options: NstRequestOptions
): Promise<{ text: string; redactedUrl: string; response: Response }> {
  const result = await nstRequest(options);
  const text = result.text ?? await result.response.text();
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
  const result = await nstRequestUrl(url, options);
  const text = result.text ?? await result.response.text();
  return {
    text: redactNstMessage(text),
    redactedUrl: result.redactedUrl,
    response: result.response
  };
}

export async function fetchNstTextWithCache(
  options: NstRequestOptions
): Promise<{ text: string; redactedUrl: string }> {
  return fetchNstTextWithCacheByUrl(buildNstRequestUrl(options.path, options.query, options.allowQueryKeyFallback ?? false).toString(), options);
}

export async function fetchNstTextWithCacheByUrl(
  url: string,
  options?: Omit<NstRequestOptions, "path" | "query">
): Promise<{ text: string; redactedUrl: string }> {
  const redactedUrl = redactNstUrl(buildNstRequestUrlFromAbsoluteUrl(url, options?.allowQueryKeyFallback ?? false));
  const cacheKey = `nst-budgeted:${redactedUrl}`;
  const cached = cacheData.get(cacheKey);
  if (typeof cached === "string") return { text: cached, redactedUrl };
  const result = await fetchNstTextByUrl(url, options);
  cacheData.put(cacheKey, result.text, 24 * 60 * 60 * 1000);
  return { text: result.text, redactedUrl };
}
