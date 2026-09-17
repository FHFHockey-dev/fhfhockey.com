import {
  getYahooLiveDraftResponseFormat,
  type YahooLiveDraftResponseFormat,
} from "./config";
import type { YahooGameContext } from "./gameContext";
import {
  parseRetryAfterSeconds,
  yahooFantasyResourceUrl,
  YahooLiveDraftError,
  assertYahooLeagueKey,
  YAHOO_FANTASY_API_BASE_URL,
} from "./liveDraft";
import type { YahooLiveDraftClient } from "./liveDraftDatabase";
import {
  getYahooAccessToken,
  markYahooReauthenticationRequired,
} from "./tokenManager";

export type YahooDraftResource = "draftresults" | "settings" | "teams";

export type YahooProviderTransportMetadata = {
  ageSeconds: number | null;
  cacheControl: string | null;
  contentType: string | null;
  etagPresent: boolean;
  httpStatus: number | null;
  lastModifiedPresent: boolean;
  refreshRate: string | null;
  requestDurationMs: number;
  requestId: string | null;
  responseDate: string | null;
  responseFormat: YahooLiveDraftResponseFormat;
  retryAfterSeconds: number | null;
  tokenRefreshAttempted: boolean;
  tokenRefreshOutcome: string;
};

export type YahooProviderJsonResult = {
  payload: unknown;
  transport: YahooProviderTransportMetadata;
};

export class YahooProviderRequestError extends YahooLiveDraftError {
  constructor(
    message: string,
    statusCode: number,
    code: string,
    retryAfterSeconds: number | null,
    public readonly transport: YahooProviderTransportMetadata,
  ) {
    super(message, statusCode, code, retryAfterSeconds);
    this.name = "YahooProviderRequestError";
  }
}

function requestSignal() {
  const timeout = (globalThis.AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  }).timeout;
  return typeof timeout === "function" ? timeout(10_000) : undefined;
}

function responseRequestId(headers: Headers) {
  return (
    headers.get("x-yahoo-request-id") ||
    headers.get("x-request-id") ||
    headers.get("x-amzn-requestid") ||
    null
  );
}

function normalizedResponseDate(headers: Headers | undefined) {
  const value = headers?.get("date");
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function responseMetadata(args: {
  durationMs: number;
  format: YahooLiveDraftResponseFormat;
  response?: Response;
  tokenRefreshAttempted: boolean;
  tokenRefreshOutcome: string;
  now: Date;
}): YahooProviderTransportMetadata {
  const headers = args.response?.headers;
  const age = Number(headers?.get("age"));
  return {
    ageSeconds: Number.isFinite(age) && age >= 0 ? Math.floor(age) : null,
    cacheControl: headers?.get("cache-control") ?? null,
    contentType: headers?.get("content-type") ?? null,
    etagPresent: Boolean(headers?.get("etag")),
    httpStatus: args.response?.status ?? null,
    lastModifiedPresent: Boolean(headers?.get("last-modified")),
    refreshRate:
      headers?.get("x-yahoo-refresh-rate") ?? headers?.get("refresh-rate") ?? null,
    requestDurationMs: Math.max(0, Math.round(args.durationMs)),
    requestId: headers ? responseRequestId(headers) : null,
    responseDate: normalizedResponseDate(headers),
    responseFormat: args.format,
    retryAfterSeconds: parseRetryAfterSeconds(
      headers?.get("retry-after"),
      args.now,
    ),
    tokenRefreshAttempted: args.tokenRefreshAttempted,
    tokenRefreshOutcome: args.tokenRefreshOutcome,
  };
}

function errorForResponse(
  response: Response,
  metadata: YahooProviderTransportMetadata,
) {
  if (response.status === 429) {
    return new YahooProviderRequestError(
      "Yahoo asked the live draft companion to slow down.",
      429,
      "yahoo_rate_limited",
      metadata.retryAfterSeconds,
      metadata,
    );
  }
  if (response.status === 403) {
    return new YahooProviderRequestError(
      "Yahoo denied access to this league. Reconnect Yahoo and verify league access.",
      403,
      "yahoo_access_denied",
      null,
      metadata,
    );
  }
  if (response.status === 404) {
    return new YahooProviderRequestError(
      "Yahoo could not find this configured-season league.",
      409,
      "yahoo_league_unavailable",
      null,
      metadata,
    );
  }
  if (response.status >= 500) {
    return new YahooProviderRequestError(
      `Yahoo draft data is temporarily unavailable (HTTP ${response.status}).`,
      502,
      "yahoo_provider_outage",
      metadata.retryAfterSeconds,
      metadata,
    );
  }
  return new YahooProviderRequestError(
    `Yahoo draft data is temporarily unavailable (HTTP ${response.status}).`,
    502,
    "yahoo_api_error",
    metadata.retryAfterSeconds,
    metadata,
  );
}

export async function fetchYahooDraftResource(args: {
  client: YahooLiveDraftClient;
  connectedAccountId: string;
  context: YahooGameContext;
  fetchImpl?: typeof fetch;
  format?: YahooLiveDraftResponseFormat;
  leagueKey: string;
  now?: Date;
  resource: YahooDraftResource;
  userId: string;
}): Promise<YahooProviderJsonResult> {
  const format = args.format ?? getYahooLiveDraftResponseFormat();
  return fetchYahooJson(args, yahooFantasyResourceUrl(args.leagueKey, args.resource, args.context, format), format);
}

/** Read-only board resources; callers must first authorize the stored league/team. */
export async function fetchYahooBoardResource(args: Omit<Parameters<typeof fetchYahooDraftResource>[0], "resource"> & {
  resource: { type: "roster"; teamKey: string; date: string }
    | { type: "league_rosters" }
    | { type: "availability"; playerKeys: string[] }
    | { type: "available_players"; start: number };
}) {
  assertYahooLeagueKey(args.leagueKey, args.context);
  const format = args.format ?? getYahooLiveDraftResponseFormat();
  let path: string;
  if (args.resource.type === "league_rosters") {
    path = `league/${encodeURIComponent(args.leagueKey)}/teams/roster/players`;
  } else if (args.resource.type === "roster") {
    const { teamKey, date } = args.resource;
    if (!/^\d+\.l\.\d+\.t\.\d+$/.test(teamKey) || !teamKey.startsWith(`${args.leagueKey}.t.`)
      || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid Yahoo roster scope");
    path = `team/${encodeURIComponent(teamKey)}/roster;date=${date}`;
  } else if (args.resource.type === "available_players") {
    const { start } = args.resource;
    if (!Number.isInteger(start) || start < 0 || start > 75 || start % 25 !== 0) throw new Error("Invalid Yahoo availability page scope");
    // Yahoo's league-context A filter includes both free agents and waivers.
    // Explicit ownership still determines each returned player's status.
    path = `league/${encodeURIComponent(args.leagueKey)}/players;status=A;sort=OR;start=${start};count=25/ownership`;
  } else {
    const keys = args.resource.playerKeys;
    if (!keys.length || keys.length > 25 || keys.some((key) => !/^\d+\.p\.\d+$/.test(key)
      || !key.startsWith(`${args.context.gameKey}.p.`))) throw new Error("Invalid Yahoo player scope");
    path = `league/${encodeURIComponent(args.leagueKey)}/players;player_keys=${keys.map(encodeURIComponent).join(",")}/ownership`;
  }
  return fetchYahooJson(args, `${YAHOO_FANTASY_API_BASE_URL}/${path}?format=${format === "json_f" ? "json_f" : "json"}`, format);
}

async function fetchYahooJson(args: Omit<Parameters<typeof fetchYahooDraftResource>[0], "resource">,
  url: string, format: YahooLiveDraftResponseFormat): Promise<YahooProviderJsonResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const now = args.now ?? new Date();
  let token = await getYahooAccessToken(args.connectedAccountId, args.userId, {
    client: args.client,
    fetchImpl,
    now,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token.accessToken}`,
          "Cache-Control": "no-cache",
        },
        method: "GET",
        signal: requestSignal(),
      });
    } catch (error) {
      const transport = responseMetadata({
        durationMs: Date.now() - startedAt,
        format,
        now,
        tokenRefreshAttempted: token.refreshAttempted,
        tokenRefreshOutcome: token.refreshOutcome,
      });
      throw new YahooProviderRequestError(
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
          ? "Yahoo draft data timed out."
          : "Yahoo draft data is temporarily unavailable.",
        502,
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
          ? "yahoo_api_timeout"
          : "yahoo_api_unavailable",
        null,
        transport,
      );
    }
    const transport = responseMetadata({
      durationMs: Date.now() - startedAt,
      format,
      now,
      response,
      tokenRefreshAttempted: token.refreshAttempted,
      tokenRefreshOutcome: token.refreshOutcome,
    });
    if (response.ok) {
      try {
        return { payload: await response.json(), transport };
      } catch {
        throw new YahooProviderRequestError(
          "Yahoo returned an invalid draft response.",
          502,
          "yahoo_draft_response_invalid",
          null,
          transport,
        );
      }
    }
    if (response.status === 401 && attempt === 0) {
      token = await getYahooAccessToken(args.connectedAccountId, args.userId, {
        client: args.client,
        fetchImpl,
        forceRefresh: true,
        now,
      });
      continue;
    }
    if (response.status === 401) {
      await markYahooReauthenticationRequired({
        client: args.client,
        connectedAccountId: args.connectedAccountId,
        userId: args.userId,
      });
      throw new YahooProviderRequestError(
        "Yahoo authorization has expired. Reconnect Yahoo and try again.",
        409,
        "yahoo_reauth_required",
        null,
        transport,
      );
    }
    throw errorForResponse(response, transport);
  }
  throw new YahooLiveDraftError(
    "Yahoo authorization has expired. Reconnect Yahoo and try again.",
    409,
    "yahoo_reauth_required",
  );
}
