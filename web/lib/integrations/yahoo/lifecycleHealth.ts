export type YahooLifecycleHealthSnapshot = {
  mappedPlayers: number;
  unmatchedPlayers: number;
};

export type YahooLifecycleWarning = {
  code:
    | "stale_last_success"
    | "repeated_ownership_failure"
    | "mapping_coverage_regression"
    | "unmatched_growth"
    | "rate_limit_saturation"
    | "token_failure"
    | "schema_drift"
    | "provider_unavailable";
  message: string;
};

type YahooAuditObservation = {
  time: string;
  status: "success" | "failure" | "unknown";
  response: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function readYahooLifecycleHealthSnapshot(
  value: unknown,
): YahooLifecycleHealthSnapshot | null {
  const root = record(value);
  const health = record(root?.health);
  const mappedPlayers = finiteCount(health?.mappedPlayers);
  const unmatchedPlayers = finiteCount(health?.unmatchedPlayers);
  return mappedPlayers == null || unmatchedPlayers == null
    ? null
    : { mappedPlayers, unmatchedPlayers };
}

export function classifyYahooLifecycleError(
  error: unknown,
): "token_failure" | "schema_drift" | "provider_unavailable" | null {
  const value = record(error);
  const response = record(value?.response);
  const status = [value?.statusCode, value?.status, response?.status].find(
    (candidate): candidate is number =>
      typeof candidate === "number" && Number.isFinite(candidate),
  );
  const text = [
    value?.code,
    value?.message,
    value?.description,
    response?.statusText,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  if (
    /token|oauth|unauthori[sz]ed|invalid cookie|request denied|401|403/.test(
      text,
    )
  ) {
    return "token_failure";
  }
  if (
    /schema|column|relation|function .* does not exist|pgrst|42p01|42703/.test(
      text,
    )
  ) {
    return "schema_drift";
  }
  if (
    (status != null && (status === 429 || (status >= 500 && status <= 599))) ||
    /econnaborted|econnreset|enetunreach|etimedout|eai_again|econnrefused|fetch failed|network|timed out|timeout|temporarily unavailable|bad gateway|service unavailable|gateway timeout|too many requests|rate limit/.test(
      text,
    )
  ) {
    return "provider_unavailable";
  }
  return null;
}

export function assessYahooLifecycleHealth(args: {
  observations: YahooAuditObservation[];
  nowMs: number;
  staleAfterMs?: number;
  rateLimitThreshold?: number;
}): YahooLifecycleWarning[] {
  const ordered = [...args.observations].sort(
    (left, right) => Date.parse(right.time) - Date.parse(left.time),
  );
  const warnings: YahooLifecycleWarning[] = [];
  const lastSuccess = ordered.find((row) => row.status === "success");
  const staleAfterMs = args.staleAfterMs ?? 36 * 60 * 60 * 1000;

  if (
    !lastSuccess ||
    !Number.isFinite(Date.parse(lastSuccess.time)) ||
    args.nowMs - Date.parse(lastSuccess.time) > staleAfterMs
  ) {
    warnings.push({
      code: "stale_last_success",
      message:
        "Yahoo player ingestion has no success inside its freshness window.",
    });
  }

  if (
    ordered.slice(0, 2).length === 2 &&
    ordered.slice(0, 2).every((row) => row.status === "failure")
  ) {
    warnings.push({
      code: "repeated_ownership_failure",
      message: "Yahoo player ingestion failed on two consecutive observations.",
    });
  }

  const current = ordered[0] ? record(ordered[0].response) : null;
  const previous = ordered[1] ? record(ordered[1].response) : null;
  const currentHealth = readYahooLifecycleHealthSnapshot(current);
  const previousHealth = readYahooLifecycleHealthSnapshot(previous);
  if (
    currentHealth &&
    previousHealth &&
    currentHealth.mappedPlayers < previousHealth.mappedPlayers
  ) {
    warnings.push({
      code: "mapping_coverage_regression",
      message:
        "Yahoo mapped-player coverage regressed from the prior observation.",
    });
  }
  if (
    currentHealth &&
    previousHealth &&
    currentHealth.unmatchedPlayers > previousHealth.unmatchedPlayers
  ) {
    warnings.push({
      code: "unmatched_growth",
      message: "Yahoo unmatched-player volume grew from the prior observation.",
    });
  }

  if (
    finiteCount(current?.rateLimitEvents) != null &&
    Number(current?.rateLimitEvents) >= (args.rateLimitThreshold ?? 3)
  ) {
    warnings.push({
      code: "rate_limit_saturation",
      message:
        "Yahoo ingestion reached the configured rate-limit alert threshold.",
    });
  }

  const errorCategory = current?.errorCategory;
  if (
    errorCategory === "token_failure" ||
    errorCategory === "schema_drift" ||
    errorCategory === "provider_unavailable"
  ) {
    warnings.push({
      code: errorCategory,
      message:
        errorCategory === "token_failure"
          ? "Yahoo ingestion reported an OAuth/token failure."
          : errorCategory === "schema_drift"
            ? "Yahoo ingestion reported provider or database schema drift."
            : "Yahoo ingestion reported a transient Yahoo/provider failure.",
    });
  }

  return warnings;
}
