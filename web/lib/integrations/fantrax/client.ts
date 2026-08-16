import { z } from "zod";

const FANTRAX_BASE_URL = "https://www.fantrax.com/fxea/general";
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_INLINE_RETRY_DELAY_MS = 30_000;

const leaguesResponseSchema = z.union([
  z.record(z.unknown()),
  z.array(z.unknown()),
]);

const positionConstraintsSchema = z.union([
  z.record(z.unknown()),
  z.array(z.unknown()),
]);

const leagueInfoResponseSchema = z
  .object({
    leagueName: z.string().min(1),
    rosterInfo: z
      .object({ positionConstraints: positionConstraintsSchema })
      .passthrough(),
    scoringSystem: z
      .object({
        type: z.unknown().refine((value) => value != null),
        scoringCategorySettings: z.array(z.unknown()),
      })
      .passthrough(),
    teamInfo: z.record(z.unknown()),
    draftSettings: z.record(z.unknown()).optional().default({}),
    draftType: z.unknown().optional(),
  })
  .passthrough();

export type FantraxEndpoint = "getLeagues" | "getLeagueInfo";

export class FantraxApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "FantraxApiError";
  }
}

type FetchLike = typeof fetch;

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(raw);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function logRequest(args: {
  endpoint: FantraxEndpoint;
  status: number | "network";
  durationMs: number;
  errorCode: string | null;
}) {
  const entry = JSON.stringify({ event: "fantrax_request", ...args });
  if (args.errorCode) {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

function parseResponse(endpoint: FantraxEndpoint, payload: unknown): unknown {
  const parsed =
    endpoint === "getLeagues"
      ? leaguesResponseSchema.safeParse(payload)
      : leagueInfoResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new FantraxApiError(
      "Fantrax returned an unsupported response shape.",
      "FANTRAX_SCHEMA_MISMATCH",
      502,
    );
  }
  return parsed.data;
}

export async function fantraxGet(
  endpoint: FantraxEndpoint,
  params: Record<string, string>,
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const sleep = options.sleep ?? wait;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    let upstreamStatus: number | "network" = "network";
    try {
      const url = new URL(`${FANTRAX_BASE_URL}/${endpoint}`);
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      upstreamStatus = response.status;
      const retryAfter = retryAfterSeconds(response);
      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
          if (
            retryAfter != null &&
            retryAfter * 1000 > MAX_INLINE_RETRY_DELAY_MS
          ) {
            throw new FantraxApiError(
              response.status === 429
                ? "Fantrax is rate limiting requests."
                : "Fantrax request failed.",
              response.status === 429
                ? "FANTRAX_RATE_LIMITED"
                : "FANTRAX_HTTP_ERROR",
              response.status === 429 ? 429 : 502,
              retryAfter,
            );
          }
          logRequest({
            endpoint,
            status: response.status,
            durationMs: Date.now() - startedAt,
            errorCode:
              response.status === 429
                ? "FANTRAX_RATE_LIMITED"
                : "FANTRAX_HTTP_RETRY",
          });
          const delay =
            retryAfter == null
              ? 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200)
              : retryAfter * 1000;
          await sleep(delay);
          continue;
        }
        throw new FantraxApiError(
          response.status === 429
            ? "Fantrax is rate limiting requests."
            : "Fantrax request failed.",
          response.status === 429 ? "FANTRAX_RATE_LIMITED" : "FANTRAX_HTTP_ERROR",
          response.status === 429 ? 429 : 502,
          retryAfter,
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new FantraxApiError(
          "Fantrax returned invalid JSON.",
          "FANTRAX_INVALID_JSON",
          502,
        );
      }
      const parsed = parseResponse(endpoint, payload);
      logRequest({
        endpoint,
        status: response.status,
        durationMs: Date.now() - startedAt,
        errorCode: null,
      });
      return parsed;
    } catch (error) {
      if (error instanceof FantraxApiError) {
        logRequest({
          endpoint,
          status: upstreamStatus,
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
        });
        throw error;
      }
      if (attempt < maxAttempts) {
        logRequest({
          endpoint,
          status: "network",
          durationMs: Date.now() - startedAt,
          errorCode:
            error instanceof Error && error.name === "AbortError"
              ? "FANTRAX_TIMEOUT"
              : "FANTRAX_NETWORK_RETRY",
        });
        await sleep(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
        continue;
      }
      const mapped = new FantraxApiError(
        error instanceof Error && error.name === "AbortError"
          ? "Fantrax request timed out."
          : "Fantrax could not be reached.",
        error instanceof Error && error.name === "AbortError"
          ? "FANTRAX_TIMEOUT"
          : "FANTRAX_NETWORK_ERROR",
        502,
      );
      logRequest({
        endpoint,
        status: "network",
        durationMs: Date.now() - startedAt,
        errorCode: mapped.code,
      });
      throw mapped;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new FantraxApiError(
    "Fantrax request failed.",
    "FANTRAX_REQUEST_FAILED",
    502,
  );
}

export function getFantraxLeagues(secretId: string, options?: Parameters<typeof fantraxGet>[2]) {
  return fantraxGet("getLeagues", { userSecretId: secretId }, options);
}

export function getFantraxLeagueInfo(
  leagueId: string,
  options?: Parameters<typeof fantraxGet>[2],
) {
  return fantraxGet("getLeagueInfo", { leagueId }, options);
}
