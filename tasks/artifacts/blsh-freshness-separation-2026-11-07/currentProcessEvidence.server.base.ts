/** Server-only byte boundary. No network, filesystem, scorer or source mutation. */
import { createHash } from "node:crypto";
import { qualifyCurrentInputs, type CurrentInputRequest } from "./currentInput";

type Group = "individual" | "onIce";
type Acceptance = {
  bundleSHA256: string;
  requestSHA256: string;
  reviewSHA256: string;
  reviewScope: "exact_rows_native_cells_scope_and_model";
  requiredArtifactSHA256: readonly string[];
};
/** Trusted server configuration, never populated from a request or bundle.
 * No real native NST evidence has been accepted in the default policy.
 */
export type ProcessEvidencePolicy = { acceptances: readonly Acceptance[] };
export const CLOSED_PROCESS_EVIDENCE_POLICY: ProcessEvidencePolicy = Object.freeze({ acceptances: Object.freeze([]) });
type Witness = {
  group: Group; wgoSourceId: number; processSourceId: number;
  playerId: number; gameId: number; date: string; team: string;
  wgoRowSHA256: string; processRowSHA256: string;
  nativeBodySHA256: string; nativeReceiptSHA256: string;
  producerSHA256: string; redactorSHA256: string;
  definitionSHA256: string; officialFrameSHA256: string;
  nativeValuesMatched: true;
  qualifiedScope: { strengthScope: "all_strength"; dateMeaning: "game_date"; toiUnit: "seconds" };
};
type Bundle = {
  version: "fhfh.blsh.reviewed-process-evidence.v1";
  sourceRequestSHA256: string;
  witnesses: Witness[];
};
type NativeReceipt = {
  url: string; status: "success"; httpStatus: 200; TLSVerified: true;
  representation: "parser_input_after_redaction";
  parserInputSHA256: string; parserInputBytes: number;
  producerSHA256: string; redactorSHA256: string;
  toiParsingContract: "minutes_decimal_or_mmss_to_seconds_half_up";
  retrievedAtUTC: string;
};
type OfficialFrame = {
  seasonId: 20262027; playerId: number; gameId: number; date: string; team: string;
  final: true; gamesPlayed: 1; totalToiSeconds: number;
  completedByUTC: string; observedAtUTC: string;
};

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
class GateFailure extends Error {}
const need = (value: unknown, reason: string): void => { if (!value) throw new GateFailure(reason); };
const SECOND_US = BigInt(1000000);
const HOUR_US = BigInt(3600) * SECOND_US;
const DAY_US = BigInt(24) * HOUR_US;
// Parse whole UTC seconds separately; Date never sees fractional input or an
// implicit/local timezone. Subsecond precision stays integer microseconds.
const time = (value: string): bigint => {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value) : null;
  need(match !== null, "invalid_evidence_time");
  const second = `${match![1]}T${match![2]}`;
  const milliseconds = Date.parse(`${second}Z`);
  need(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 19) === second, "invalid_evidence_time");
  let offsetMinutes = 0;
  if (match![4] !== "Z") {
    const hours = Number(match![6]), minutes = Number(match![7]);
    need(hours <= 14 && minutes <= 59 && (hours < 14 || minutes === 0) && match![4] !== "-00:00", "invalid_evidence_time");
    offsetMinutes = (hours * 60 + minutes) * (match![5] === "+" ? 1 : -1);
  }
  return BigInt(milliseconds) * BigInt(1000) + BigInt((match![3] ?? "").padEnd(6, "0")) - BigInt(offsetMinutes) * BigInt(60) * SECOND_US;
};
const earliest = (...values: bigint[]) => values.reduce((a, b) => a < b ? a : b);
const latest = (...values: bigint[]) => values.reduce((a, b) => a > b ? a : b);
const utc = (value: bigint): string => {
  const seconds = value >= 0 ? value / SECOND_US : (value - SECOND_US + BigInt(1)) / SECOND_US;
  const fraction = (value - seconds * SECOND_US).toString().padStart(6, "0");
  const digits = value % BigInt(1000) === BigInt(0) ? fraction.slice(0, 3) : fraction;
  return new Date(Number(seconds * BigInt(1000))).toISOString().replace(".000Z", `.${digits}Z`);
};
// Exact decimal powers avoid ES2015 downleveling exponentiation to Math.pow.
// Exponents come from finite Number.toString(), so at most 324 zeros are needed.
const powerOfTen = (exponent: number): bigint => BigInt("1" + "0".repeat(exponent));
const duration = (value: number, unit: bigint): bigint => {
  need(typeof value === "number" && Number.isFinite(value) && value >= 0, "invalid_freshness_precision");
  // Convert the policy number's decimal representation without another floating
  // multiplication rounding a sub-microsecond budget into an allowed boundary.
  const [coefficient, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const scale = fraction.length - Number(exponent);
  const numerator = BigInt(whole + fraction) * unit;
  const divisor = scale > 0 ? powerOfTen(scale) : BigInt(1);
  need(numerator % divisor === BigInt(0), "invalid_freshness_precision");
  const microseconds = numerator / divisor * (scale < 0 ? powerOfTen(-scale) : BigInt(1));
  need(microseconds <= BigInt(Number.MAX_SAFE_INTEGER), "invalid_freshness_precision");
  return microseconds;
};
const decode = <T>(bytes: Uint8Array, maxBytes: number): T => {
  need(bytes.byteLength > 0 && bytes.byteLength <= maxBytes, "artifact_byte_bound");
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as T; }
  catch { throw new GateFailure("invalid_artifact_json"); }
};
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { need(Number.isFinite(value), "invalid_row_number"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  need(typeof value === "object" && value !== null, "invalid_row_value");
  return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
export const processEvidenceRowSHA256 = (row: unknown): string => digest(new TextEncoder().encode(canonical(row)));

/** A reviewed policy binds exact bytes, not caller claims of "verified".
 * This loader verifies bindings and consumption, not the native HTML semantics:
 * that separate review must cover exact cells, conversions, model and scope.
 */
export function createCurrentProcessEvidenceGate(policy: ProcessEvidencePolicy = CLOSED_PROCESS_EVIDENCE_POLICY) {
  const acceptances = structuredClone(policy.acceptances);
  need(acceptances.length <= 100, "acceptance_bound");
  const accepted = new Map<string, Acceptance>();
  for (const a of acceptances) {
    need(hash(a.bundleSHA256) && hash(a.requestSHA256) && hash(a.reviewSHA256) &&
      a.reviewScope === "exact_rows_native_cells_scope_and_model" &&
      a.requiredArtifactSHA256.length > 0 && a.requiredArtifactSHA256.length <= 10000 &&
      a.requiredArtifactSHA256.every(hash) && new Set(a.requiredArtifactSHA256).size === a.requiredArtifactSHA256.length &&
      a.requiredArtifactSHA256.includes(a.reviewSHA256) && !accepted.has(a.bundleSHA256), "invalid_server_acceptance_policy");
    accepted.set(a.bundleSHA256, a);
  }
  // The server supplies its evaluation time; frozen request.asOfUTC never acts
  // as an indefinitely fresh clock for a later application read.
  return (requestBytes: Uint8Array, evaluatedAtUTC: string, bundleBytes: Uint8Array | null = null, artifacts: ReadonlyMap<string, Uint8Array> = new Map()) => {
    const request = decode<CurrentInputRequest>(requestBytes, 32 * 1024 * 1024);
    need(time(evaluatedAtUTC) >= time(request.asOfUTC), "evaluation_precedes_source_request");
    const raw = qualifyCurrentInputs({ ...request, asOfUTC: evaluatedAtUTC });
    const witnesses = new Map<string, Witness>();
    const verified = new Map<string, Uint8Array>();
    const globalReasons: string[] = [];
    let acceptance: Acceptance | undefined;
    try {
      need(bundleBytes !== null, "native_evidence_not_supplied");
      need(bundleBytes!.byteLength <= 8 * 1024 * 1024, "bundle_byte_bound");
      acceptance = accepted.get(digest(bundleBytes!));
      need(acceptance, "native_evidence_not_independently_accepted");
      need(digest(requestBytes) === acceptance!.requestSHA256, "accepted_capture_bytes_changed");
      let totalBytes = 0;
      for (const expected of acceptance!.requiredArtifactSHA256) {
        const bytes = artifacts.get(expected);
        need(bytes && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024, "accepted_artifact_missing_or_oversized");
        totalBytes += bytes!.byteLength; need(totalBytes <= 64 * 1024 * 1024, "evidence_total_byte_bound");
        const copy = Uint8Array.from(bytes!);
        need(digest(copy) === expected, "accepted_artifact_hash_mismatch"); verified.set(expected, copy);
      }
      const bundle = decode<Bundle>(bundleBytes!, 8 * 1024 * 1024);
      need(bundle.version === "fhfh.blsh.reviewed-process-evidence.v1" && bundle.sourceRequestSHA256 === acceptance!.requestSHA256,
        "bundle_contract_or_capture_mismatch");
      need(Array.isArray(bundle.witnesses) && bundle.witnesses.length > 0 && bundle.witnesses.length <= 10000, "empty_or_excessive_witnesses");
      const ids = new Set(raw.records.map(r => r.record.id));
      for (const w of bundle.witnesses) {
        need((w.group === "individual" || w.group === "onIce") && Number.isSafeInteger(w.wgoSourceId) &&
          Number.isSafeInteger(w.processSourceId) && w.processSourceId > 0 && ids.has(w.wgoSourceId), "invalid_witness_scope");
        const key = `${w.wgoSourceId}|${w.group}`; need(!witnesses.has(key), "duplicate_row_witness"); witnesses.set(key, w);
      }
    } catch (error) {
      globalReasons.push(error instanceof GateFailure ? error.message : "invalid_provenance_bundle"); witnesses.clear(); verified.clear();
    }
    const records = raw.records.map(row => {
      const record = row.record;
      const qualifyGroup = (group: Group) => {
        const original = row[group]; const reasons = [...globalReasons];
        let availableAtUTC: string | null = null; let oldestEvidenceAtUTC: string | null = null;
        try {
          need(reasons.length === 0, "unaccepted_bundle");
          const w = witnesses.get(`${record.id}|${group}`); need(w, "no_exact_row_witness");
          need(original.observed.length === 1, "missing_or_ambiguous_captured_process_row");
          const observed = original.observed[0];
          need(w!.processSourceId === observed.id && w!.playerId === record.player_id && w!.gameId === record.game_id &&
            w!.date === record.date && w!.team === record.team_abbrev &&
            w!.wgoRowSHA256 === processEvidenceRowSHA256(record) && w!.processRowSHA256 === processEvidenceRowSHA256(observed), "row_or_identity_drift");
          for (const sha of [w!.nativeBodySHA256, w!.nativeReceiptSHA256, w!.producerSHA256, w!.redactorSHA256, w!.definitionSHA256, w!.officialFrameSHA256]) {
            need(hash(sha) && verified.has(sha), "witness_artifact_not_bound_by_acceptance");
          }
          need(w!.nativeValuesMatched === true, "native_cells_not_matched");
          need(w!.qualifiedScope?.strengthScope === "all_strength" && w!.qualifiedScope.dateMeaning === "game_date" &&
            w!.qualifiedScope.toiUnit === "seconds", "reviewed_native_semantics_unqualified");
          const receipt = decode<NativeReceipt>(verified.get(w!.nativeReceiptSHA256)!, 64 * 1024);
          need(receipt.status === "success" && receipt.httpStatus === 200 && receipt.TLSVerified === true &&
            receipt.representation === "parser_input_after_redaction" && receipt.parserInputSHA256 === w!.nativeBodySHA256 &&
            receipt.parserInputBytes === verified.get(w!.nativeBodySHA256)!.byteLength &&
            receipt.producerSHA256 === w!.producerSHA256 && receipt.redactorSHA256 === w!.redactorSHA256 &&
            receipt.toiParsingContract === "minutes_decimal_or_mmss_to_seconds_half_up", "native_transport_or_representation_unqualified");
          const url = new URL(receipt.url);
          const expected = { fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all",
            stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0",
            gpfilt: "gpdate", fd: record.date, td: record.date, lines: "single", draftteam: "ALL" };
          need(url.protocol === "https:" && ["data.naturalstattrick.com", "www.naturalstattrick.com"].includes(url.hostname) &&
            !url.username && !url.password && (!url.port || url.port === "443") && !url.hash && url.pathname === "/playerteams.php" &&
            Object.entries(expected).every(([key, value]) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value) &&
            [...url.searchParams.keys()].every(key => Object.hasOwn(expected, key) || key === "tgp") && url.searchParams.getAll("tgp").length <= 1, "native_date_strength_or_unit_scope_unqualified");
          const frame = decode<OfficialFrame>(verified.get(w!.officialFrameSHA256)!, 64 * 1024);
          need(frame.seasonId === 20262027 && frame.playerId === w!.playerId && frame.gameId === w!.gameId &&
            frame.date === w!.date && frame.team === w!.team && frame.final === true && frame.gamesPlayed === 1 &&
            Number.isSafeInteger(frame.totalToiSeconds) && frame.totalToiSeconds > 0 && frame.totalToiSeconds === record.toi_per_game &&
            frame.totalToiSeconds === observed.toi, "official_identity_or_exposure_hold");
          const nativeTime = time(receipt.retrievedAtUTC), frameTime = time(frame.observedAtUTC), asOf = time(evaluatedAtUTC);
          const completed = time(frame.completedByUTC);
          need(frame.date <= utc(completed).slice(0, 10) && completed <= nativeTime &&
            completed <= frameTime && nativeTime <= asOf && frameTime <= asOf, "evidence_chronology_unqualified");
          availableAtUTC = utc(latest(nativeTime, frameTime));
          oldestEvidenceAtUTC = utc(earliest(nativeTime, frameTime));
          const relevantFeeds = [request.calendar, request.wgo, request[group]];
          need(relevantFeeds.every(Boolean), "current_use_capture_unavailable");
          const captureTimes = relevantFeeds.map(feed => time(feed!.capture.retrievedAtUTC));
          const today = time(`${utc(asOf).slice(0, 10)}T00:00:00Z`);
          const maxCaptureAge = duration(request.freshnessPolicy.maxCaptureAgeHours, HOUR_US);
          const maxEventAge = duration(request.freshnessPolicy.maxEventAgeDays, DAY_US);
          need(captureTimes.every(t => t <= asOf) &&
            asOf - earliest(nativeTime, frameTime, ...captureTimes) <= maxCaptureAge &&
            today - time(`${record.date}T00:00:00Z`) <= maxEventAge, "current_use_evidence_stale_or_unknown");
        } catch (error) { if (!reasons.length) reasons.push(error instanceof GateFailure ? error.message : "invalid_row_provenance"); }
        const provenanceReasons = [...new Set(reasons)].sort();
        const scopeReasons = new Set(["unqualified_strength_scope", "unqualified_date_meaning", "unqualified_exposure_unit"]);
        const retained = provenanceReasons.length ? original.reasons : original.reasons.filter(reason => !scopeReasons.has(reason));
        const combined = [...new Set([...retained, ...provenanceReasons])].sort();
        return { qualified: combined.length === 0, reasons: combined,
          provenance: { state: provenanceReasons.length ? "withheld" : "exact_reviewed_row_provenance", reasons: provenanceReasons,
            availableAtUTC, oldestEvidenceAtUTC, originalPublicationUTC: null,
            acceptedReviewSHA256: provenanceReasons.length ? null : acceptance!.reviewSHA256 } };
      };
      return { ...row, individual: { ...row.individual, ...qualifyGroup("individual") }, onIce: { ...row.onIce, ...qualifyGroup("onIce") },
        rawProcessQualification: { individual: { qualified: row.individual.qualified, reasons: [...row.individual.reasons] },
          onIce: { qualified: row.onIce.qualified, reasons: [...row.onIce.reasons] } } };
    });
    return { ...raw, version: "fhfh.blsh.current-process-provenance-gate.v1", sourceRequestAsOfUTC: request.asOfUTC, records,
      coverage: { ...raw.coverage, individualQualified: records.filter(r => r.individual.qualified).length,
        onIceQualified: records.filter(r => r.onIce.qualified).length },
      rawInputQualificationPreservedSeparately: true, sourceDataChanged: false,
      score: null, trusted: false, productionAdopted: false };
  };
}
