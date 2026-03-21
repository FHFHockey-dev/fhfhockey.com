export type NormalizedDependencyError = {
  kind: "dependency_error";
  source: "supabase_or_proxy" | "unknown";
  classification:
    | "html_upstream_response"
    | "transport_fetch_failure"
    | "structured_upstream_error";
  message: string;
  detail: string | null;
  htmlLike: boolean;
};

function truncate(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function getRawDependencyMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string") return candidate;
    if (candidate != null) return String(candidate);
  }
  return String(error);
}

export function normalizeDependencyError(
  error: unknown
): NormalizedDependencyError {
  const rawMessage = getRawDependencyMessage(error);
  const trimmed = rawMessage.trim();
  const htmlLike =
    trimmed.includes("<!DOCTYPE html>") || trimmed.includes("<html");
  const proxyLike =
    trimmed.includes("supabase.co") ||
    trimmed.includes("Cloudflare") ||
    trimmed.includes("Error code 520") ||
    trimmed.includes("Error code 522");

  if (htmlLike) {
    return {
      kind: "dependency_error",
      source: proxyLike ? "supabase_or_proxy" : "unknown",
      classification: "html_upstream_response",
      message:
        "Upstream dependency returned an HTML error page instead of structured JSON.",
      detail: truncate(trimmed),
      htmlLike: true
    };
  }

  if (trimmed.toLowerCase().includes("fetch failed")) {
    return {
      kind: "dependency_error",
      source: "unknown",
      classification: "transport_fetch_failure",
      message: "Upstream dependency request failed before a structured response was returned.",
      detail: truncate(trimmed),
      htmlLike: false
    };
  }

  return {
    kind: "dependency_error",
    source: proxyLike ? "supabase_or_proxy" : "unknown",
    classification: "structured_upstream_error",
    message: truncate(trimmed || "Dependency request failed."),
    detail: truncate(trimmed) || null,
    htmlLike: false
  };
}
