import crypto from "crypto";

import type {
  YahooDraftPollObservationInsert,
  YahooLiveDraftClient,
} from "./liveDraftDatabase";
import type { YahooProviderTransportMetadata } from "./providerClient";

const fallbackWorkerId = `worker-${crypto.randomUUID().slice(0, 12)}`;

function observationSecret() {
  return process.env.YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET?.trim() || null;
}

export function yahooDraftObservationReference(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex").slice(0, 24);
}

function workerInstanceId() {
  const configured = process.env.YAHOO_LIVE_DRAFT_WORKER_INSTANCE_ID?.trim();
  return configured && /^[A-Za-z0-9._:-]{1,96}$/u.test(configured)
    ? configured
    : fallbackWorkerId;
}

export async function recordYahooDraftPollObservation(args: {
  accountId: string;
  client: YahooLiveDraftClient;
  observation: Omit<
    YahooDraftPollObservationInsert,
    "account_ref" | "request_id_ref" | "session_ref" | "worker_instance_id"
  >;
  requestId?: string | null;
  sessionId: string;
}) {
  const secret = observationSecret();
  if (!secret) return false;
  const row: YahooDraftPollObservationInsert = {
    ...args.observation,
    account_ref: yahooDraftObservationReference(args.accountId, secret),
    request_id_ref: args.requestId
      ? yahooDraftObservationReference(args.requestId, secret)
      : null,
    session_ref: yahooDraftObservationReference(args.sessionId, secret),
    worker_instance_id: workerInstanceId(),
  };
  const { error } = await args.client
    .from("yahoo_draft_poll_observations")
    .insert(row);
  return !error;
}

export function transportObservation(
  transport: YahooProviderTransportMetadata | null | undefined,
) {
  if (!transport) return {};
  return {
    age_seconds: transport.ageSeconds,
    cache_control: transport.cacheControl,
    content_type: transport.contentType,
    etag_present: transport.etagPresent,
    http_status: transport.httpStatus,
    last_modified_present: transport.lastModifiedPresent,
    refresh_rate: transport.refreshRate,
    request_duration_ms: transport.requestDurationMs,
    response_date: transport.responseDate,
    response_format: transport.responseFormat,
    retry_after_seconds: transport.retryAfterSeconds,
    token_refresh_attempted: transport.tokenRefreshAttempted,
    token_refresh_outcome: transport.tokenRefreshOutcome,
  } satisfies Partial<YahooDraftPollObservationInsert>;
}
