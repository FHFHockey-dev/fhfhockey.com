export const DEFAULT_SUPABASE_PAGE_SIZE = 1000;
export const DEFAULT_SUPABASE_FILTER_CHUNK_SIZE = 200;

export type SupabaseRange = {
  from: number;
  to: number;
  pageIndex: number;
  pageSize: number;
};

type SupabasePageResult<T> = {
  data: T[] | null;
  error: unknown;
};

type SupabasePageQuery<T> = PromiseLike<SupabasePageResult<T>>;

export type SupabasePageQueryFactory<T> = (
  range: SupabaseRange,
) => SupabasePageQuery<T>;

export type FetchSupabasePagesOptions = {
  pageSize?: number;
  start?: number;
  limit?: number | null;
  retry?: {
    attempts?: number;
    delayMs?: number | ((attempt: number) => number);
    shouldRetry?: (
      error: unknown,
      attempt: number,
      range: SupabaseRange,
    ) => boolean;
    onRetry?: (args: {
      attempt: number;
      error: unknown;
      range: SupabaseRange;
      delayMs: number;
    }) => void;
  };
};

export type FetchSupabaseFilterChunksOptions = Omit<
  FetchSupabasePagesOptions,
  "start" | "limit"
> & {
  chunkSize?: number;
};

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number,
) {
  if (!Number.isFinite(value) || value == null) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

export function getSupabaseRange(options?: {
  pageIndex?: number;
  pageSize?: number;
  start?: number;
}): SupabaseRange {
  const pageIndex = Math.max(0, Math.trunc(options?.pageIndex ?? 0));
  const pageSize = normalizePositiveInteger(
    options?.pageSize,
    DEFAULT_SUPABASE_PAGE_SIZE,
  );
  const start = Math.max(0, Math.trunc(options?.start ?? 0));
  const from = start + pageIndex * pageSize;

  return {
    from,
    to: from + pageSize - 1,
    pageIndex,
    pageSize,
  };
}

export async function fetchSupabasePage<T>(
  queryFactory: SupabasePageQueryFactory<T>,
  options?: {
    pageIndex?: number;
    pageSize?: number;
    start?: number;
  },
): Promise<T[]> {
  const range = getSupabaseRange(options);
  const { data, error } = await queryFactory(range);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchAllSupabasePages<T>(
  queryFactory: SupabasePageQueryFactory<T>,
  options?: FetchSupabasePagesOptions,
): Promise<T[]> {
  const pageSize = normalizePositiveInteger(
    options?.pageSize,
    DEFAULT_SUPABASE_PAGE_SIZE,
  );
  const start = Math.max(0, Math.trunc(options?.start ?? 0));
  const limit =
    options?.limit == null ? null : Math.max(0, Math.trunc(options.limit));

  const rows: T[] = [];

  for (let pageIndex = 0; ; pageIndex += 1) {
    if (limit != null && rows.length >= limit) {
      break;
    }

    const remainingLimit = limit == null ? pageSize : limit - rows.length;
    const currentPageSize = Math.min(pageSize, remainingLimit);

    if (currentPageSize <= 0) {
      break;
    }

    const range = {
      from: start + pageIndex * pageSize,
      to: start + pageIndex * pageSize + currentPageSize - 1,
      pageIndex,
      pageSize: currentPageSize,
    };
    const { data, error } = await fetchSupabasePageWithRetry(
      queryFactory,
      range,
      options?.retry,
    );

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < currentPageSize) {
      break;
    }
  }

  return rows;
}

/**
 * Fetches a complete result set without serializing an unbounded `.in(...)`
 * value list into one PostgREST request. Each filter chunk receives its own
 * ordered range-pagination loop; callers remain responsible for applying a
 * deterministic `.order(...)` clause in `queryFactory` when a chunk can span
 * more than one page.
 */
export async function fetchAllSupabaseFilterChunks<T, TValue>(
  values: Iterable<TValue>,
  queryFactory: (chunk: TValue[], range: SupabaseRange) => SupabasePageQuery<T>,
  options?: FetchSupabaseFilterChunksOptions,
): Promise<T[]> {
  const chunkSize = normalizePositiveInteger(
    options?.chunkSize,
    DEFAULT_SUPABASE_FILTER_CHUNK_SIZE,
  );
  const uniqueValues = Array.from(new Set(values));
  const rows: T[] = [];

  for (let index = 0; index < uniqueValues.length; index += chunkSize) {
    const chunk = uniqueValues.slice(index, index + chunkSize);
    const chunkRows = await fetchAllSupabasePages<T>(
      (range) => queryFactory(chunk, range),
      {
        pageSize: options?.pageSize,
        retry: options?.retry,
      },
    );
    rows.push(...chunkRows);
  }

  return rows;
}

async function fetchSupabasePageWithRetry<T>(
  queryFactory: SupabasePageQueryFactory<T>,
  range: SupabaseRange,
  retry: FetchSupabasePagesOptions["retry"],
): Promise<SupabasePageResult<T>> {
  const attempts = normalizePositiveInteger(retry?.attempts, 1);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await queryFactory(range);

    if (!result.error) {
      return result;
    }

    const shouldRetry =
      attempt < attempts &&
      (retry?.shouldRetry?.(result.error, attempt, range) ?? true);

    if (!shouldRetry) {
      return result;
    }

    const delayMs =
      typeof retry?.delayMs === "function"
        ? retry.delayMs(attempt)
        : (retry?.delayMs ?? 0);

    retry?.onRetry?.({
      attempt,
      error: result.error,
      range,
      delayMs,
    });

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return queryFactory(range);
}
