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

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
