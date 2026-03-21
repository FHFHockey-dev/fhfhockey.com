import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";

type SqlRpcClient = {
  rpc: (
    fn: string,
    args: { sql_statement: string }
  ) =>
    | Promise<{ data: unknown; error: { message?: string } | null }>
    | { then: (onfulfilled?: any, onrejected?: any) => any };
};

export type SqlRpcFailureClassification =
  | "html_upstream_response"
  | "transport_timeout"
  | "transport_fetch_failure"
  | "structured_upstream_error";

export type SqlRpcFailure = {
  kind: "sql_rpc_transport_failure";
  classification: SqlRpcFailureClassification;
  message: string;
  detail: string | null;
  statusCode: number | null;
  retryable: boolean;
  attempts: number;
};

export type SqlRpcExecutionResult =
  | {
      ok: true;
      data: unknown;
      attempts: number;
      notes: string[];
    }
  | {
      ok: false;
      failure: SqlRpcFailure;
      notes: string[];
    };

function extractStatusCode(input: string): number | null {
  const matched = input.match(/\b(520|522|524|500|502|503|504)\b/);
  return matched ? Number(matched[1]) : null;
}

export function normalizeSqlRpcFailure(
  error: unknown,
  attempts: number
): SqlRpcFailure {
  const normalized = normalizeDependencyError(error);
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : normalized.detail ?? normalized.message;
  const statusCode = extractStatusCode(raw);

  let classification: SqlRpcFailureClassification =
    normalized.classification === "html_upstream_response"
      ? "html_upstream_response"
      : normalized.classification === "transport_fetch_failure"
        ? "transport_fetch_failure"
        : "structured_upstream_error";

  if (statusCode === 522 || statusCode === 524) {
    classification = "transport_timeout";
  }

  const retryable =
    classification === "html_upstream_response" ||
    classification === "transport_timeout" ||
    classification === "transport_fetch_failure" ||
    statusCode === 520 ||
    statusCode === 522 ||
    statusCode === 524;

  return {
    kind: "sql_rpc_transport_failure",
    classification,
    message:
      classification === "transport_timeout"
        ? "Supabase execute_sql RPC timed out before returning a structured response."
        : classification === "html_upstream_response"
          ? "Supabase execute_sql RPC returned an HTML proxy/origin error page."
          : classification === "transport_fetch_failure"
            ? "Supabase execute_sql RPC request failed before a structured response was returned."
            : normalized.message,
    detail: normalized.detail,
    statusCode,
    retryable,
    attempts
  };
}

export async function executeSqlRpcWithRetry(args: {
  client: SqlRpcClient;
  sqlText: string;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<SqlRpcExecutionResult> {
  const maxAttempts = Math.max(1, args.maxAttempts ?? 3);
  const sleep =
    args.sleep ??
    (async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await args.client.rpc("execute_sql", {
      sql_statement: args.sqlText
    });

    if (!error) {
      const notes =
        attempt > 1
          ? [
              `Executed through Supabase execute_sql RPC after ${attempt} attempts.`,
              `Recovered after ${attempt - 1} SQL RPC retr${attempt === 2 ? "y" : "ies"}.`
            ]
          : ["Executed through Supabase execute_sql RPC."];

      return {
        ok: true,
        data,
        attempts: attempt,
        notes
      };
    }

    const failure = normalizeSqlRpcFailure(error, attempt);
    const shouldRetry = failure.retryable && attempt < maxAttempts;

    if (!shouldRetry) {
      return {
        ok: false,
        failure,
        notes: [
          "Supabase execute_sql RPC failed.",
          `Classification: ${failure.classification}.`,
          failure.statusCode != null
            ? `Status code: ${failure.statusCode}.`
            : "Status code: unavailable.",
          `Attempts: ${attempt}.`
        ]
      };
    }

    await sleep(250 * attempt);
  }

  return {
    ok: false,
    failure: {
      kind: "sql_rpc_transport_failure",
      classification: "structured_upstream_error",
      message: "Supabase execute_sql RPC failed without returning a final error.",
      detail: null,
      statusCode: null,
      retryable: false,
      attempts: maxAttempts
    },
    notes: ["Supabase execute_sql RPC failed."]
  };
}
