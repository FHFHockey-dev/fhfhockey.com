import "dotenv/config";

import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import serviceRoleClient from "lib/supabase/server";
import {
  yahooDraftObservationReference,
} from "lib/integrations/yahoo/observability";

const MARKER_KINDS = new Set([
  "browser_closed",
  "browser_opened",
  "correction",
  "keeper",
  "pause",
  "pick",
  "predraft",
  "resume",
  "timeout_autopick",
  "worker_restarted",
  "worker_stopped",
]);

type Marker = {
  event: "operator_marker";
  kind: string;
  markedAt: string;
  monotonicNanoseconds: string;
  pickNumber: number | null;
  sessionRef: string;
};

function option(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string) {
  const value = option(name)?.trim();
  if (!value) throw new Error(`Missing required --${name} option.`);
  return value;
}

function observationSecret() {
  const secret = process.env.YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET?.trim();
  if (!secret) {
    throw new Error("YAHOO_LIVE_DRAFT_OBSERVABILITY_SECRET is required.");
  }
  return secret;
}

function sessionReference() {
  const sessionId = requiredOption("session-id");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(sessionId)) {
    throw new Error("--session-id must be a UUID.");
  }
  return yahooDraftObservationReference(sessionId, observationSecret());
}

function markerFile() {
  return resolve(option("markers") ?? "/private/tmp/yahoo-live-draft-markers.jsonl");
}

function outputFile() {
  return resolve(option("out") ?? "/private/tmp/yahoo-live-draft-rehearsal.jsonl");
}

async function recordMarker() {
  const kind = requiredOption("kind");
  if (!MARKER_KINDS.has(kind)) throw new Error("Unsupported rehearsal marker kind.");
  const rawPickNumber = option("pick-number");
  const pickNumber = rawPickNumber === undefined ? null : Number(rawPickNumber);
  if (
    (kind === "pick" || kind === "timeout_autopick") &&
    (!Number.isInteger(pickNumber) || Number(pickNumber) < 1)
  ) {
    throw new Error("Pick markers require a positive --pick-number.");
  }
  const marker: Marker = {
    event: "operator_marker",
    kind,
    markedAt: new Date().toISOString(),
    monotonicNanoseconds: process.hrtime.bigint().toString(),
    pickNumber,
    sessionRef: sessionReference(),
  };
  await appendFile(markerFile(), `${JSON.stringify(marker)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(
    `${JSON.stringify({ event: "marker_recorded", kind, sessionRef: marker.sessionRef })}\n`,
  );
}

async function loadMarkers(sessionRef: string) {
  const contents = await readFile(markerFile(), "utf8");
  return contents
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Marker)
    .filter(
      (marker) =>
        marker.event === "operator_marker" && marker.sessionRef === sessionRef,
    );
}

async function buildReport() {
  const sessionRef = sessionReference();
  const markers = await loadMarkers(sessionRef);
  if (markers.length === 0) throw new Error("No matching rehearsal markers were found.");
  const firstMarkedAt = markers.reduce(
    (earliest, marker) =>
      marker.markedAt < earliest ? marker.markedAt : earliest,
    markers[0].markedAt,
  );
  const { data, error } = await serviceRoleClient
    .from("yahoo_draft_poll_observations")
    .select(
      "created_at,outcome,provider_status,local_status,http_status,request_duration_ms,pick_count,last_pick_number,snapshot_hash,snapshot_version,changed,refresh_rate,retry_after_seconds,cache_control,age_seconds,etag_present,last_modified_present,content_type,response_date,response_format,error_code,token_refresh_attempted,token_refresh_outcome,consecutive_failures,next_poll_at,due_poll_lag_ms,lease_claimed,anomaly_detected,correction_confirmation,worker_instance_id",
    )
    .eq("session_ref", sessionRef)
    .gte("created_at", firstMarkedAt)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Rehearsal observations could not be loaded.");
  const observations = data ?? [];
  const records: Array<Record<string, unknown>> = markers.map((marker) => ({
    ...marker,
    monotonicNanoseconds: marker.monotonicNanoseconds,
  }));
  for (const observation of observations) {
    records.push({
      ...observation,
      event: "provider_observation",
      sessionRef,
    });
  }
  for (const marker of markers) {
    if (marker.pickNumber === null) continue;
    const visible = observations.find(
      (observation) =>
        Number(observation.last_pick_number ?? 0) >= Number(marker.pickNumber) &&
        observation.created_at >= marker.markedAt,
    );
    records.push({
      event: "pick_visibility",
      firstVisibleAt: visible?.created_at ?? null,
      latencyMilliseconds: visible
        ? Math.max(0, Date.parse(visible.created_at) - Date.parse(marker.markedAt))
        : null,
      markedAt: marker.markedAt,
      pickNumber: marker.pickNumber,
      sessionRef,
    });
  }
  records.sort((left, right) =>
    String(left.created_at ?? left.markedAt ?? "").localeCompare(
      String(right.created_at ?? right.markedAt ?? ""),
    ),
  );
  await writeFile(
    outputFile(),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  process.stdout.write(
    `${JSON.stringify({
      event: "rehearsal_report_written",
      markerCount: markers.length,
      observationCount: observations.length,
      output: outputFile(),
      sessionRef,
    })}\n`,
  );
}

function printHelp() {
  process.stdout.write(`Yahoo live-draft rehearsal harness

  mark   --session-id UUID --kind KIND [--pick-number N] [--markers PATH]
  report --session-id UUID [--markers PATH] [--out PATH]

The raw session ID is accepted only as private input and is never written to output.
`);
}

async function main() {
  const command = process.argv[2];
  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }
  if (command === "mark") return recordMarker();
  if (command === "report") return buildReport();
  throw new Error("Expected mark, report, or --help.");
}

void main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      error: error instanceof Error ? error.message : "Rehearsal command failed.",
      event: "yahoo_live_draft_rehearsal_error",
    })}\n`,
  );
  process.exitCode = 1;
});
