type YahooGameRow = {
  game_id: string | number | null;
  game_key?: string | null;
  season?: string | number | null;
  is_offseason?: boolean | null;
  is_game_over?: boolean | null;
  current_week?: string | number | null;
};

type YahooRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (event: {
    attempt: number;
    delayMs: number;
    rateLimited: boolean;
  }) => void;
};

export type YahooPlayerKeySnapshotRow = {
  player_key: string;
  player_id: number | null;
  player_name: string | null;
};

export type YahooSheetExportReceipt = {
  attempted: boolean;
  succeeded: boolean;
  statusCode: number | null;
  reason:
    | "complete_player_receipt"
    | "incomplete_player_receipt"
    | "missing_cron_secret"
    | "request_failed";
};

type YahooPlayerKeySnapshot = {
  players: YahooPlayerKeySnapshotRow[];
  pagesFetched: number;
};

type YahooPlayerKeyPaginationOptions = {
  pageSize?: number;
  maxPages?: number;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function findNestedValue(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNestedValue(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (value[key] !== undefined) return value[key];
  for (const nested of Object.values(value)) {
    const found = findNestedValue(nested, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function extractYahooPlayerKeyPage(
  response: unknown,
): YahooPlayerKeySnapshotRow[] {
  if (!isRecord(response) || !isRecord(response.fantasy_content)) {
    throw new Error("Yahoo player-key page is malformed.");
  }

  const gameParts = Array.isArray(response.fantasy_content.game)
    ? response.fantasy_content.game
    : [response.fantasy_content.game];
  const holder = gameParts.find(
    (part) => isRecord(part) && isRecord(part.players),
  );
  if (!isRecord(holder) || !isRecord(holder.players)) {
    throw new Error("Yahoo player-key collection is missing.");
  }

  const rows = Object.entries(holder.players)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([, entry]) => {
      const playerKey = findNestedValue(entry, "player_key");
      if (typeof playerKey !== "string" || !/^\d+\.p\.\d+$/.test(playerKey)) {
        throw new Error("Yahoo player-key row is malformed.");
      }

      const rawPlayerId = findNestedValue(entry, "player_id");
      const playerId = finiteNumber(rawPlayerId);
      const rawName = findNestedValue(entry, "name");
      const playerName =
        isRecord(rawName) && typeof rawName.full === "string"
          ? rawName.full.trim() || null
          : null;

      return {
        player_key: playerKey,
        player_id: playerId == null ? null : Math.trunc(playerId),
        player_name: playerName,
      };
    });

  const uniqueKeys = new Set(rows.map((row) => row.player_key));
  if (uniqueKeys.size !== rows.length) {
    throw new Error("Yahoo player-key page contains duplicate keys.");
  }
  return rows;
}

export async function fetchCompleteYahooPlayerKeySnapshot(
  gameId: string,
  requestPage: (url: string) => Promise<unknown>,
  options: YahooPlayerKeyPaginationOptions = {},
): Promise<YahooPlayerKeySnapshot> {
  if (!/^\d+$/.test(gameId)) {
    throw new Error("Yahoo game ID is invalid.");
  }

  const pageSize = Math.min(
    25,
    Math.max(1, Math.trunc(options.pageSize ?? 25)),
  );
  const maxPages = Math.max(1, Math.trunc(options.maxPages ?? 200));
  const players: YahooPlayerKeySnapshotRow[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * pageSize;
    const url =
      `https://fantasysports.yahooapis.com/fantasy/v2/game/${gameId}` +
      `/players;start=${start};count=${pageSize}`;
    const pageRows = extractYahooPlayerKeyPage(await requestPage(url));

    for (const row of pageRows) {
      if (seen.has(row.player_key)) {
        throw new Error("Yahoo player-key pagination repeated a key.");
      }
      seen.add(row.player_key);
      players.push(row);
    }

    if (pageRows.length < pageSize) {
      return {
        players: players.sort((left, right) =>
          left.player_key.localeCompare(right.player_key),
        ),
        pagesFetched: page + 1,
      };
    }
  }

  throw new Error("Yahoo player-key pagination exceeded its safety bound.");
}

export function selectCanonicalYahooGame<T extends YahooGameRow>(
  rows: T[],
): T | null {
  return (
    [...rows]
      .filter((row) => row.game_id != null)
      .sort((left, right) => {
        const seasonDifference =
          (finiteNumber(right.season) ?? Number.NEGATIVE_INFINITY) -
          (finiteNumber(left.season) ?? Number.NEGATIVE_INFINITY);
        if (seasonDifference !== 0) return seasonDifference;

        return (
          (finiteNumber(right.game_id) ?? Number.NEGATIVE_INFINITY) -
          (finiteNumber(left.game_id) ?? Number.NEGATIVE_INFINITY)
        );
      })[0] ?? null
  );
}

export function isYahooSheetExportEligible(args: {
  providerComplete: boolean;
  ownershipOmitted: number;
  persistedRows: number;
  sourceRows: number;
}): boolean {
  return (
    args.providerComplete &&
    args.ownershipOmitted === 0 &&
    args.sourceRows > 0 &&
    args.persistedRows === args.sourceRows
  );
}

export async function requestYahooSheetExport(args: {
  gameId: string | number;
  cronSecret: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<YahooSheetExportReceipt> {
  if (!args.cronSecret) {
    return {
      attempted: false,
      succeeded: false,
      statusCode: null,
      reason: "missing_cron_secret",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, args.timeoutMs ?? 3_000),
  );
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=${encodeURIComponent(String(args.gameId))}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${args.cronSecret}` },
        signal: controller.signal,
      },
    );
    return {
      attempted: true,
      succeeded: response.ok,
      statusCode: response.status,
      reason: response.ok ? "complete_player_receipt" : "request_failed",
    };
  } catch {
    return {
      attempted: true,
      succeeded: false,
      statusCode: null,
      reason: "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getErrorStatus(error: any): number | null {
  return (
    finiteNumber(error?.statusCode) ??
    finiteNumber(error?.status) ??
    finiteNumber(error?.response?.status)
  );
}

function getRetryAfterHeader(error: any): string | null {
  const headers = error?.response?.headers ?? error?.headers;
  if (typeof headers?.get === "function") {
    return headers.get("retry-after");
  }

  const value = headers?.["retry-after"] ?? headers?.["Retry-After"];
  return value == null ? null : String(value);
}

export function getYahooRetryAfterMs(
  error: unknown,
  nowMs = Date.now(),
): number | null {
  const value = getRetryAfterHeader(error);
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : null;
}

export function isRetryableYahooError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 429 || (status != null && status >= 500 && status <= 599)) {
    return true;
  }
  if (status != null) return false;

  const code = String((error as any)?.code ?? "").toUpperCase();
  return ["ECONNABORTED", "ECONNRESET", "ENETUNREACH", "ETIMEDOUT"].includes(
    code,
  );
}

export async function withYahooRetry<T>(
  operation: () => Promise<T>,
  options: YahooRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 10_000);
  const random = options.random ?? Math.random;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableYahooError(error)) {
        throw error;
      }

      const retryAfterMs = getYahooRetryAfterMs(error);
      const exponentialMs = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1),
      );
      const jitteredMs = Math.ceil(exponentialMs * (0.75 + random() * 0.5));
      const delayMs = Math.min(
        maxDelayMs,
        Math.max(retryAfterMs ?? 0, jitteredMs),
      );

      options.onRetry?.({
        attempt,
        delayMs,
        rateLimited: getErrorStatus(error) === 429,
      });
      await sleep(delayMs);
    }
  }
}
