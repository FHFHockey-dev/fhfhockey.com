const ERROR_NAMES = new Set([
  "Error",
  "ErrorEvent",
  "TypeError",
  "RangeError",
  "TimeoutError",
  "ProtocolError",
  "AggregateError",
  "NonRetryableWebhookError"
]);

const ERROR_CODES = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ERR_INVALID_URL",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
] as const;

type ErrorCode = (typeof ERROR_CODES)[number];

type WebhookErrorDiagnostic = {
  name: string;
  code?: ErrorCode;
  syscall?: string;
  status?: number;
  reason?: string;
  cause?: WebhookErrorDiagnostic;
  error?: WebhookErrorDiagnostic;
};

function property(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

// Never copy arbitrary text or objects from dependency errors. In particular, ws
// ErrorEvents contain a WebSocket target with the authenticated connection URL.
// Fixed values also cover encoded/nested URLs without relying on URL redaction.
export function webhookErrorDiagnostic(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0
): WebhookErrorDiagnostic {
  const diagnostic: WebhookErrorDiagnostic = { name: "UnknownError" };
  if (depth >= 4 || seen.has(value)) return diagnostic;
  seen.add(value);

  const name = property(value, "name");
  if (typeof name === "string" && ERROR_NAMES.has(name)) diagnostic.name = name;

  const message = typeof value === "string" ? value : property(value, "message");
  const code = property(value, "code");
  const knownCode = ERROR_CODES.find((candidate) => candidate === code);
  if (knownCode) diagnostic.code = knownCode;
  else if (typeof message === "string") {
    diagnostic.code = ERROR_CODES.find((candidate) =>
      new RegExp(`\\b${candidate}\\b`).test(message)
    );
  }

  const syscall = property(value, "syscall");
  if (
    syscall === "connect" || syscall === "getaddrinfo" ||
    syscall === "read" || syscall === "write"
  ) {
    diagnostic.syscall = syscall;
  }
  const status = property(value, "status") ?? property(value, "statusCode");
  if (
    typeof status === "number" && Number.isInteger(status) &&
    status >= 400 && status <= 599
  ) {
    diagnostic.status = status;
  }

  if (message === "Cannot find the matrix") diagnostic.reason = "matrix_not_found";
  if (message === "PUPPETEER_ENDPOINT is not configured.") {
    diagnostic.reason = "endpoint_not_configured";
  }
  if (message === "Failed to connect to puppeteer: browser endpoint is unavailable.") {
    diagnostic.reason = "browser_endpoint_unavailable";
  }

  for (const key of ["cause", "error"] as const) {
    const nested = property(value, key);
    if (nested != null) {
      diagnostic[key] = webhookErrorDiagnostic(nested, seen, depth + 1);
    }
  }
  return diagnostic;
}
