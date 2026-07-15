const MAX_FAILURE_SAMPLES = 5;
const MAX_ERROR_MESSAGE_LENGTH = 300;
const MAX_ERROR_CODE_LENGTH = 64;
const MAX_PAGE_START = 1_000_000;
const MAX_PAGE_LIMIT = 1_000;
const SAFE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface WgoGoaliePersistenceRecord {
  goalie_id?: number | string | null;
  date?: string | null;
  season_id?: number | string | null;
  [key: string]: unknown;
}

export interface WgoGoalieUpsertError {
  code?: string | null;
  message: string;
}

export interface WgoGoalieFailureSample {
  goalieId: number | string | null;
  date: string | null;
  seasonId: number | string | null;
  code: string | null;
  message: string;
}

export interface WgoGoalieWriteFailureDetails {
  code: "WGO_GOALIE_WRITE_FAILED";
  requestedRows: number;
  persistedRows: number;
  completedRowsBeforeFailure: number;
  totalPersistedRows: number;
  failedRows: number;
  bulkErrorCode: string | null;
  bulkError: string;
  failedSamples: WgoGoalieFailureSample[];
}

export interface WgoGoalieBulkFallbackRecoveryDetails {
  code: "WGO_GOALIE_BULK_FALLBACK_RECOVERED";
  requestedRows: number;
  persistedRows: number;
  bulkErrorCode: string | null;
  bulkError: string;
}

export type WgoGoalieFetchSource =
  | "season"
  | "summary"
  | "advanced"
  | "days_rest";

export interface WgoGoalieFetchFailureDetails {
  code: "WGO_GOALIE_FETCH_FAILED";
  date: string;
  source: WgoGoalieFetchSource;
  pageStart: number;
  pageLimit: number;
  completedRowsBeforeFailure: number;
  upstreamError: string;
}

export interface WgoGoaliePruneFailureDetails {
  code: "WGO_GOALIE_PRUNE_FAILED";
  date: string;
  replacementRowsPersisted: number;
  completedRowsBeforeFailure: number;
  totalPersistedRows: number;
  safeSupersetRetained: true;
  upstreamError: string;
}

export interface WgoGoaliePageResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export interface FetchRequiredWgoGoaliePageOptions {
  date: string;
  source: WgoGoalieFetchSource;
  pageStart: number;
  pageLimit: number;
  request: () => Promise<WgoGoaliePageResponse>;
}

export interface WgoGoaliePersistenceOptions {
  onBulkFallbackRecovered?: (
    details: WgoGoalieBulkFallbackRecoveryDetails,
  ) => void;
}

export interface WgoGoalieWriteFailureClassification {
  jobStatus: "error";
  httpStatus: 500;
  details: WgoGoalieWriteFailureDetails;
  response: WgoGoalieWriteFailureDetails & {
    message: string;
    success: false;
  };
}

export interface WgoGoalieFetchFailureClassification {
  jobStatus: "error";
  httpStatus: 500;
  details: WgoGoalieFetchFailureDetails;
  response: WgoGoalieFetchFailureDetails & {
    message: string;
    success: false;
  };
}

export interface WgoGoaliePruneFailureClassification {
  jobStatus: "error";
  httpStatus: 500;
  details: WgoGoaliePruneFailureDetails;
  response: WgoGoaliePruneFailureDetails & {
    message: string;
    success: false;
  };
}

type UpsertGoalieRows<T> = (
  rows: T | T[],
) => Promise<WgoGoalieUpsertError | null>;

function boundedMessage(message: string): string {
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function sanitizeWgoGoalieDiagnostic(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error);
  return boundedMessage(
    message
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
      .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/[\r\n\t]+/g, " "),
  );
}

function sanitizedUpstreamCode(error: unknown): string | null {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  if (!code) {
    return null;
  }

  const sanitized = code
    .replace(/[^a-z0-9_.-]+/gi, "_")
    .slice(0, MAX_ERROR_CODE_LENGTH);
  return sanitized || null;
}

async function executeWgoGoalieUpsert<T>(
  upsertRows: UpsertGoalieRows<T>,
  rows: T | T[],
): Promise<WgoGoalieUpsertError | null> {
  try {
    const error = await upsertRows(rows);
    if (!error) {
      return null;
    }

    return {
      code: sanitizedUpstreamCode(error),
      message: sanitizeWgoGoalieDiagnostic(error),
    };
  } catch (error: unknown) {
    return {
      code: sanitizedUpstreamCode(error),
      message: sanitizeWgoGoalieDiagnostic(error),
    };
  }
}

function sanitizedDate(date: string): string {
  return SAFE_DATE_PATTERN.test(date) ? date : "[invalid-date]";
}

function boundedPageStart(pageStart: number): number {
  if (!Number.isFinite(pageStart)) return 0;
  return Math.min(MAX_PAGE_START, Math.max(0, Math.trunc(pageStart)));
}

function boundedPageLimit(pageLimit: number): number {
  if (!Number.isFinite(pageLimit)) return 1;
  return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.trunc(pageLimit)));
}

function normalizedRowCount(rows: number): number {
  return Number.isFinite(rows) ? Math.max(0, Math.trunc(rows)) : 0;
}

export class WgoGoalieFetchError extends Error {
  readonly details: WgoGoalieFetchFailureDetails;

  constructor(
    details: Omit<
      WgoGoalieFetchFailureDetails,
      "completedRowsBeforeFailure" | "upstreamError"
    > & {
      upstreamError: unknown;
    },
  ) {
    const date = sanitizedDate(details.date);
    const pageStart = boundedPageStart(details.pageStart);
    const pageLimit = boundedPageLimit(details.pageLimit);
    super(
      `Failed to fetch required WGO ${details.source} data for ${date} at page start ${pageStart}.`,
    );
    this.name = "WgoGoalieFetchError";
    this.details = {
      ...details,
      date,
      pageStart,
      pageLimit,
      completedRowsBeforeFailure: 0,
      upstreamError: sanitizeWgoGoalieDiagnostic(details.upstreamError),
    };
  }

  addCompletedRowsBeforeFailure(rows: number): void {
    const completedRows = Number.isFinite(rows)
      ? Math.max(0, Math.trunc(rows))
      : 0;
    this.details.completedRowsBeforeFailure += completedRows;
  }
}

export class WgoGoalieWriteError extends Error {
  readonly details: WgoGoalieWriteFailureDetails;

  constructor(details: WgoGoalieWriteFailureDetails) {
    super(
      `Failed to persist ${details.failedRows} of ${details.requestedRows} wgo_goalie_stats rows after bounded row retries.`,
    );
    this.name = "WgoGoalieWriteError";
    this.details = {
      ...details,
      bulkErrorCode: sanitizedUpstreamCode({ code: details.bulkErrorCode }),
      bulkError: sanitizeWgoGoalieDiagnostic(details.bulkError),
      failedSamples: details.failedSamples.map((sample) => ({
        ...sample,
        code: sanitizedUpstreamCode({ code: sample.code }),
        message: sanitizeWgoGoalieDiagnostic(sample.message),
      })),
    };
  }

  addCompletedRowsBeforeFailure(rows: number): void {
    const completedRows = Number.isFinite(rows)
      ? Math.max(0, Math.trunc(rows))
      : 0;
    this.details.completedRowsBeforeFailure += completedRows;
    this.details.totalPersistedRows += completedRows;
  }
}

export class WgoGoaliePruneError extends Error {
  readonly details: WgoGoaliePruneFailureDetails;

  constructor(
    details: Omit<
      WgoGoaliePruneFailureDetails,
      | "completedRowsBeforeFailure"
      | "safeSupersetRetained"
      | "totalPersistedRows"
      | "upstreamError"
    > & { upstreamError: unknown },
  ) {
    const date = sanitizedDate(details.date);
    const replacementRowsPersisted = normalizedRowCount(
      details.replacementRowsPersisted,
    );
    super(
      `Failed to prune stale WGO goalie rows for ${date} after persisting ${replacementRowsPersisted} replacement rows; the safe superset was retained.`,
    );
    this.name = "WgoGoaliePruneError";
    this.details = {
      code: details.code,
      date,
      replacementRowsPersisted,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: replacementRowsPersisted,
      safeSupersetRetained: true,
      upstreamError: sanitizeWgoGoalieDiagnostic(details.upstreamError),
    };
  }

  addCompletedRowsBeforeFailure(rows: number): void {
    const completedRows = normalizedRowCount(rows);
    this.details.completedRowsBeforeFailure += completedRows;
    this.details.totalPersistedRows += completedRows;
  }
}

export async function persistWgoGoalieStatsRecords<
  T extends WgoGoaliePersistenceRecord,
>(
  records: T[],
  upsertRows: UpsertGoalieRows<T>,
  options: WgoGoaliePersistenceOptions = {},
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const bulkError = await executeWgoGoalieUpsert(upsertRows, records);
  if (!bulkError) {
    return records.length;
  }

  let persistedRows = 0;
  let failedRows = 0;
  const failedSamples: WgoGoalieFailureSample[] = [];

  for (const record of records) {
    const rowError = await executeWgoGoalieUpsert(upsertRows, record);
    if (!rowError) {
      persistedRows++;
      continue;
    }

    failedRows++;
    if (failedSamples.length < MAX_FAILURE_SAMPLES) {
      failedSamples.push({
        goalieId: record.goalie_id ?? null,
        date: record.date ?? null,
        seasonId: record.season_id ?? null,
        code: rowError.code ?? null,
        message: sanitizeWgoGoalieDiagnostic(rowError.message),
      });
    }
  }

  if (failedRows > 0) {
    throw new WgoGoalieWriteError({
      code: "WGO_GOALIE_WRITE_FAILED",
      requestedRows: records.length,
      persistedRows,
      completedRowsBeforeFailure: 0,
      totalPersistedRows: persistedRows,
      failedRows,
      bulkErrorCode: bulkError.code ?? null,
      bulkError: sanitizeWgoGoalieDiagnostic(bulkError.message),
      failedSamples,
    });
  }

  options.onBulkFallbackRecovered?.({
    code: "WGO_GOALIE_BULK_FALLBACK_RECOVERED",
    requestedRows: records.length,
    persistedRows,
    bulkErrorCode: bulkError.code ?? null,
    bulkError: sanitizeWgoGoalieDiagnostic(bulkError.message),
  });

  return persistedRows;
}

export async function fetchRequiredWgoGoaliePage<T>(
  options: FetchRequiredWgoGoaliePageOptions,
): Promise<T[]> {
  try {
    const response = await options.request();
    if (!response.ok) {
      const status = Number.isFinite(response.status)
        ? Math.max(0, Math.trunc(response.status))
        : 0;
      throw new Error(`Upstream returned HTTP ${status}.`);
    }

    const payload = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !Array.isArray((payload as { data?: unknown }).data)
    ) {
      throw new Error("Upstream response omitted the required data array.");
    }

    const page = (payload as { data: T[] }).data;
    const pageLimit = boundedPageLimit(options.pageLimit);
    if (page.length > pageLimit) {
      throw new Error(
        `Upstream returned ${page.length} rows, exceeding the requested page limit ${pageLimit}.`,
      );
    }

    return page;
  } catch (error: unknown) {
    if (error instanceof WgoGoalieFetchError) {
      throw error;
    }

    throw new WgoGoalieFetchError({
      code: "WGO_GOALIE_FETCH_FAILED",
      date: options.date,
      source: options.source,
      pageStart: options.pageStart,
      pageLimit: options.pageLimit,
      upstreamError: error,
    });
  }
}

export function getWgoGoalieWriteFailureDetails(
  error: unknown,
): WgoGoalieWriteFailureDetails | null {
  return error instanceof WgoGoalieWriteError ? error.details : null;
}

export function getWgoGoalieFetchFailureDetails(
  error: unknown,
): WgoGoalieFetchFailureDetails | null {
  return error instanceof WgoGoalieFetchError ? error.details : null;
}

export function getWgoGoaliePruneFailureDetails(
  error: unknown,
): WgoGoaliePruneFailureDetails | null {
  return error instanceof WgoGoaliePruneError ? error.details : null;
}

export function classifyWgoGoalieWriteFailure(
  error: unknown,
): WgoGoalieWriteFailureClassification | null {
  if (!(error instanceof WgoGoalieWriteError)) {
    return null;
  }

  return {
    jobStatus: "error",
    httpStatus: 500,
    details: error.details,
    response: {
      message: error.message,
      success: false,
      ...error.details,
    },
  };
}

export function classifyWgoGoalieFetchFailure(
  error: unknown,
): WgoGoalieFetchFailureClassification | null {
  if (!(error instanceof WgoGoalieFetchError)) {
    return null;
  }

  return {
    jobStatus: "error",
    httpStatus: 500,
    details: error.details,
    response: {
      message: error.message,
      success: false,
      ...error.details,
    },
  };
}

export function classifyWgoGoaliePruneFailure(
  error: unknown,
): WgoGoaliePruneFailureClassification | null {
  if (!(error instanceof WgoGoaliePruneError)) {
    return null;
  }

  return {
    jobStatus: "error",
    httpStatus: 500,
    details: error.details,
    response: {
      message: error.message,
      success: false,
      ...error.details,
    },
  };
}
