/** Offline preparation only. No client import, credentials, network, admission or scoring.
 * A retained observation is NOT a NativeReceipt and cannot authorize process evidence.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const GROUPS = ["individual", "onIce"] as const;
type Group = typeof GROUPS[number];
const DAY = 86_400_000;
const PLAN_LIFETIME_MS = 15 * 60_000;
export const NATIVE_PROCESS_RETENTION_BYTES = 2 * 1024 * 1024;
const sha = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
const object = (value: unknown): Record<string, unknown> => {
  need(value !== null && typeof value === "object" && !Array.isArray(value), "invalid_object");
  return value as Record<string, unknown>;
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  need(Object.keys(value).sort().join("|") === [...keys].sort().join("|"), "unexpected_or_missing_fields");
const stamp = (value: unknown): number => {
  need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), "invalid_utc_time");
  const ms = Date.parse(value as string);
  need(Number.isFinite(ms) && new Date(ms).toISOString() === value, "invalid_utc_time");
  return ms;
};
function pageUrl(date: string, group: Group): string {
  const url = new URL("https://data.naturalstattrick.com/playerteams.php");
  const query = { fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all",
    stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0",
    gpfilt: "gpdate", fd: date, td: date, lines: "single", draftteam: "ALL" };
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

/** Date is a candidate, not proof that every game finished. Refresh at execution time. */
export function prepareNativeProcessCapture(input: unknown) {
  const value = object(input);
  exactKeys(value, ["seasonId", "date", "plannedAtUTC", "groups"]);
  need(value.seasonId === 20262027, "outside_current_season");
  need(typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date), "invalid_game_date");
  const date = value.date as string;
  const eventMs = stamp(`${date}T00:00:00.000Z`);
  const plannedMs = stamp(value.plannedAtUTC), now = Date.now();
  need(plannedMs <= now && now - plannedMs <= PLAN_LIFETIME_MS, "future_or_stale_plan");
  const today = new Date(now).toISOString().slice(0, 10);
  need(today >= "2026-07-01" && today <= "2027-06-30" && date >= "2026-07-01" && date <= "2027-06-30", "outside_current_season");
  need(date < today && now - eventMs < 8 * DAY, "future_incomplete_or_stale_date");
  need(Array.isArray(value.groups) && value.groups.length === 2 && value.groups[0] === "individual" && value.groups[1] === "onIce", "exact_two_ordered_groups_required");
  return {
    version: "fhfh.blsh.native-process-capture-preparation.v1" as const,
    input: { seasonId: 20262027, date, plannedAtUTC: value.plannedAtUTC as string, groups: [...GROUPS] },
    expiresAtUTC: new Date(plannedMs + PLAN_LIFETIME_MS).toISOString(),
    pages: GROUPS.map(group => ({ group, url: pageUrl(date, group) })),
    futureExecution: { client: "web/lib/nst/client.ts:fetchNstTextByUrl", plannedProviderPages: 2, maxProviderAttempts: 2, concurrency: 1, retries: 0,
      timeoutMs: 15_000, deadlineMs: 120_000, maxAttempts: 2, plannedRequestCount: 2,
      minInterval: "NST_MIN_REQUEST_INTERVAL_MS", allowQueryKeyFallback: false,
      sharedControls: ["withNstRequestBudget", "admitSharedNstAttempt"],
      sharedAdmissionRPC: { maxCalls: null, deadlineBounded: true, mayWriteProductionLedger: true } },
    limits: { retainedParserInputBytesPerPage: NATIVE_PROCESS_RETENTION_BYTES, responseConsumptionBytes: null,
      note: "Retention is checked after text consumption. It does not bound downloaded bytes. The frozen client uses response.clone().text()." },
    executionAllowed: false as const,
    blockers: ["bounded_response_client_change_required", "shared_admission_write_authorization_required", "official_completed_date_review_required"],
    completionVerified: false, originalPublicationUTC: null, modelDefinition: "unknown",
    score: null, advancedAdmission: false, independentlyAccepted: false, productionAdopted: false,
  };
}
export type NativeProcessCapturePlan = ReturnType<typeof prepareNativeProcessCapture>;

/** There is deliberately no escape hatch, transport argument, or live CLI. */
export function executeNativeProcessCapture(_plan: NativeProcessCapturePlan): never {
  throw new Error("native_capture_not_implemented_pending_bounded_client_and_authorization");
}

/** Accept ONLY local, unverified parser-input observations. Original timestamps are
 * preserved as claims; retention time is separate and never used as retrieval time.
 * Failure codes are a whitelist: no upstream error strings/headers/credentials/URLs.
 */
export type NativeProcessObservation =
  | { group: Group; state: "observed"; parserInputText: string; retrievedAtUTC: string }
  | { group: Group; state: "failed"; reason: "transport_failed" | "capture_interrupted" };

export function retainNativeProcessPacket(outputDirectory: string, plan: NativeProcessCapturePlan, observations: readonly NativeProcessObservation[]) {
  need(JSON.stringify(plan) === JSON.stringify(prepareNativeProcessCapture(plan.input)), "plan_modified");
  need(Array.isArray(observations) && observations.length <= 2 && observations.every((item, index) => item.group === GROUPS[index]), "unexpected_duplicate_or_unordered_group");
  // No arbitrary code paths are accepted. These are proposed bindings, NOT proof
  // that this client produced caller-supplied offline observations.
  const code = [
    { name: "nativeProcessCapturePreparation.ts", role: "offline_packet_retainer", path: __filename },
    { name: "client.ts", role: "proposed_authenticated_client_and_redactor", path: resolve(__dirname, "../../lib/nst/client.ts") },
  ].map(source => ({ ...source, bytes: readFileSync(source.path) }));
  mkdirSync(outputDirectory, { mode: 0o700 }); // Existing paths, including symlinks, fail.
  const write = (name: string, bytes: string | Buffer) => writeFileSync(join(outputDirectory, name), typeof bytes === "string" ? bytes : new Uint8Array(bytes), { flag: "wx", mode: 0o600 });
  const json = (name: string, value: unknown) => write(name, `${JSON.stringify(value, null, 2)}\n`);
  const codeBindings = code.map(source => ({ file: source.name, role: source.role, sha256: sha(source.bytes), bytes: source.bytes.byteLength }));
  json("STARTED.json", { version: plan.version, state: "retention_started_not_capture_success", retainedAtUTC: new Date().toISOString(), codeBindings });
  json("PLAN.json", plan);
  for (const source of code) write(source.name, source.bytes);
  const retained: { group: Group; state: string; reason?: string; observationSHA256?: string }[] = [];
  for (let index = 0; index < GROUPS.length; index++) {
    const group = GROUPS[index], observation = observations[index];
    if (!observation || retained.some(item => item.state !== "retained_unverified")) {
      retained.push({ group, state: "not_retained", reason: "missing_or_after_failure" });
      continue;
    }
    try {
      const item = object(observation);
      if (item.state === "failed") {
        exactKeys(item, ["group", "state", "reason"]);
        need(item.reason === "transport_failed" || item.reason === "capture_interrupted", "invalid_failure_code");
        retained.push({ group, state: "failed", reason: item.reason as "transport_failed" | "capture_interrupted" });
        continue;
      }
      exactKeys(item, ["group", "state", "parserInputText", "retrievedAtUTC"]);
      need(item.state === "observed" && typeof item.parserInputText === "string", "invalid_observation");
      const retrieved = stamp(item.retrievedAtUTC);
      need(retrieved >= stamp(plan.input.plannedAtUTC) && retrieved <= Date.now(), "unqualified_observation_time");
      const bytes = Buffer.from(item.parserInputText as string, "utf8");
      need(bytes.toString("utf8") === item.parserInputText, "non_roundtrippable_parser_input");
      need(bytes.byteLength > 0 && bytes.byteLength <= NATIVE_PROCESS_RETENTION_BYTES, "retention_byte_bound");
      write(`${group}.parser-input.html`, bytes);
      const metadata = {
        version: "fhfh.blsh.unverified-native-observation.v1", group, status: "retained_unverified",
        plannedUrl: plan.pages[index].url, representation: "parser_input_after_redaction_claimed",
        parserInputSHA256: sha(bytes), parserInputBytes: bytes.byteLength,
        reportedRetrievedAtUTC: item.retrievedAtUTC, retainedAtUTC: new Date().toISOString(),
        transport: { httpStatus: null, TLSVerified: null, finalOrigin: null, redirected: null },
        provenance: "caller_supplied_offline_observation_not_verified_transport",
        codeBindings, originalPublicationUTC: null, modelDefinition: "unknown",
        nativeValuesMatched: null, score: null, advancedAdmission: false, independentlyAccepted: false,
      };
      const metadataBytes = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      write(`${group}.UNVERIFIED-OBSERVATION.json`, metadataBytes);
      retained.push({ group, state: "retained_unverified", observationSHA256: sha(metadataBytes) });
    } catch {
      // Partial files remain, with no successful observation record. Do not copy
      // exception text into a packet: it may contain secrets or local paths.
      retained.push({ group, state: "failed", reason: "observation_invalid_or_write_failed" });
    }
  }
  const result = {
    version: plan.version, state: retained.every(item => item.state === "retained_unverified") ? "offline_packet_retained" : "partial_offline_packet",
    retained, liveRequests: 0, captureCompleted: false, score: null, advancedAdmission: false, independentlyAccepted: false, productionAdopted: false,
  };
  json("RESULT.json", result); // If this fails, STARTED + partial files remain; no success is returned.
  return result;
}
