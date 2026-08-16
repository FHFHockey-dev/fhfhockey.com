import { z } from "zod";

const ESPN_FANTASY_BASE_URL =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl";
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_INLINE_RETRY_DELAY_MS = 10_000;

const leagueResponseSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    seasonId: z.union([z.number(), z.string()]),
    settings: z.record(z.unknown()).optional(),
    teams: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    transactions: z.array(z.unknown()).optional(),
    draftDetail: z.record(z.unknown()).optional(),
    status: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type EspnCredentials = { swid: string; espnS2: string };
export type EspnLeagueRequest = {
  leagueId: string;
  season: number;
  credentials: EspnCredentials;
};

export class EspnApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "EspnApiError";
  }
}

type FetchLike = typeof fetch;

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(raw);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - Date.now()) / 1000))
    : null;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function logRequest(args: {
  view: "full" | "draft" | "transactions";
  status: number | "network";
  durationMs: number;
  errorCode: string | null;
}) {
  const entry = JSON.stringify({ event: "espn_fantasy_request", ...args });
  if (args.errorCode) console.warn(entry);
  else console.info(entry);
}

function cookieHeader(credentials: EspnCredentials) {
  return `SWID=${credentials.swid}; espn_s2=${credentials.espnS2}`;
}

const FULL_VIEWS = [
  "mSettings",
  "mTeam",
  "mRoster",
  "mStandings",
  "mMatchupScore",
  "mScoreboard",
  "mTransactions2",
  "mDraftDetail",
] as const;

export async function espnLeagueGet(
  args: EspnLeagueRequest & {
    view?: "full" | "draft" | "transactions";
    scoringPeriodId?: number;
    transactionOffset?: number;
    transactionLimit?: number;
  },
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    maxAttempts?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const sleep = options.sleep ?? wait;
  const view = args.view ?? "full";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    let upstreamStatus: number | "network" = "network";
    try {
      const url = new URL(
        `${ESPN_FANTASY_BASE_URL}/seasons/${args.season}/segments/0/leagues/${args.leagueId}`,
      );
      const views =
        view === "draft"
          ? ["mDraftDetail", "mTeam", "mRoster"]
          : view === "transactions"
            ? ["mTransactions2"]
            : FULL_VIEWS;
      views.forEach((item) => url.searchParams.append("view", item));
      if (view === "transactions" && args.scoringPeriodId != null) {
        url.searchParams.set("scoringPeriodId", String(args.scoringPeriodId));
      }
      const response = await fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          cookie: cookieHeader(args.credentials),
          ...(view === "transactions"
            ? {
                "x-fantasy-filter": JSON.stringify({
                  transactions: {
                    filterType: {
                      value: [
                        "DRAFT",
                        "TRADE_ACCEPT",
                        "WAIVER",
                        "ROSTER",
                        "FREEAGENT",
                        "TRADE_PROPOSAL",
                        "TRADE_DECLINE",
                        "TRADE_UPHOLD",
                        "TRADE_VETO",
                        "RETRO_ROSTER",
                        "FUTURE_ROSTER",
                        "WAIVER_ERROR",
                        "TRADE_ERROR",
                      ],
                    },
                    limit: args.transactionLimit ?? 100,
                    offset: args.transactionOffset ?? 0,
                  },
                }),
              }
            : {}),
        },
        redirect: "error",
        signal: controller.signal,
      });
      upstreamStatus = response.status;
      const retryAfter = retryAfterSeconds(response);
      if (!response.ok) {
        if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
          if (retryAfter != null && retryAfter * 1000 > MAX_INLINE_RETRY_DELAY_MS) {
            throw new EspnApiError(
              "ESPN Fantasy is temporarily rate limiting requests.",
              "ESPN_RATE_LIMITED",
              429,
              retryAfter,
            );
          }
          const delay =
            retryAfter == null
              ? 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200)
              : retryAfter * 1000;
          await sleep(delay);
          continue;
        }
        if (response.status === 401 || response.status === 403) {
          throw new EspnApiError(
            "The ESPN session has expired or cannot access this private league.",
            "ESPN_REAUTH_REQUIRED",
            409,
          );
        }
        if (response.status === 404) {
          throw new EspnApiError(
            "ESPN could not find that hockey league for the selected season.",
            "ESPN_LEAGUE_NOT_FOUND",
            404,
          );
        }
        throw new EspnApiError(
          "ESPN Fantasy could not be reached.",
          response.status === 429 ? "ESPN_RATE_LIMITED" : "ESPN_HTTP_ERROR",
          response.status === 429 ? 429 : 502,
          retryAfter,
        );
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new EspnApiError(
          "ESPN Fantasy returned invalid JSON.",
          "ESPN_INVALID_JSON",
          502,
        );
      }
      const parsed = leagueResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new EspnApiError(
          "ESPN Fantasy returned an unsupported response shape.",
          "ESPN_SCHEMA_MISMATCH",
          502,
        );
      }
      logRequest({
        view,
        status: response.status,
        durationMs: Date.now() - startedAt,
        errorCode: null,
      });
      return parsed.data;
    } catch (error) {
      if (error instanceof EspnApiError) {
        logRequest({
          view,
          status: upstreamStatus,
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
        });
        throw error;
      }
      if (attempt < maxAttempts) {
        await sleep(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
        continue;
      }
      const timedOut = error instanceof Error && error.name === "AbortError";
      const mapped = new EspnApiError(
        timedOut
          ? "ESPN Fantasy request timed out."
          : "ESPN Fantasy could not be reached.",
        timedOut ? "ESPN_TIMEOUT" : "ESPN_NETWORK_ERROR",
        502,
      );
      logRequest({
        view,
        status: "network",
        durationMs: Date.now() - startedAt,
        errorCode: mapped.code,
      });
      throw mapped;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new EspnApiError(
    "ESPN Fantasy request failed.",
    "ESPN_REQUEST_FAILED",
    502,
  );
}

export function getEspnLeague(args: EspnLeagueRequest, options?: Parameters<typeof espnLeagueGet>[1]) {
  return espnLeagueGet({ ...args, view: "full" }, options);
}

export function getEspnDraft(args: EspnLeagueRequest, options?: Parameters<typeof espnLeagueGet>[1]) {
  return espnLeagueGet({ ...args, view: "draft" }, options);
}

export function getEspnTransactions(
  args: EspnLeagueRequest & {
    scoringPeriodId: number;
    transactionOffset?: number;
    transactionLimit?: number;
  },
  options?: Parameters<typeof espnLeagueGet>[1],
) {
  return espnLeagueGet({ ...args, view: "transactions" }, options);
}
