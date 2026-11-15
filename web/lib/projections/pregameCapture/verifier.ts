import { randomBytes } from "node:crypto";
import { decodePacket, canonicalJson, sha256Hex } from "./packet";
import { u8 } from "./der";
import { buildTimeStampRequest, extractToken, verifyTimeStampToken, type TsaTrust, type VerifiedTimestamp } from "./rfc3161";
import { ackQualifies, type StartClocks } from "./deadline";
import { formatMicros, MICROS_PER_MS, minMicros, parseInstantMicros } from "./time";
import type { CaptureRpc, ReadRow } from "./rpc";

/**
 * Independent verifier. Trusts nothing the writer holds in memory: it reads the authoritative committed
 * row back through its own client, recomputes raw and canonical hashes from the stored bytes, checks the
 * game binding, then retains an RFC 3161 token over a statement naming exactly those bytes and that row
 * version, and reads back again to prove the committed version did not change around the stamp.
 */

export const WITNESS_STATEMENT_VERSION = "forge-pregame-witness-v1";
const PREGAME_GAME_STATUSES = new Set(["FUT", "PRE"]);
const SCHEDULE_OK = "OK";

export interface TsaClient { stamp(request: Buffer, signal: AbortSignal): Promise<Buffer> }
export interface VerifierDeps {
  rpc: CaptureRpc; tsa: TsaClient; trust: TsaTrust;
  now(): number; nonce?(): bigint;
  tsaTimeoutMs: number; skewToleranceMs: number;
}
export interface VerifyExpectation { claimId: string; gameId: number; policyId: string; rawSha256: string; canonicalSha256: string }
export interface VerifyResult {
  verdict: "qualified" | "saved_without_valid_witness";
  reason: string | null;
  witnessRecorded: boolean;
  ackUpper: string | null; ackDeadline: string | null; slackMs: number | null;
  timestamp: Pick<VerifiedTimestamp, "genTime" | "accuracyMicros" | "accuracySource" | "serial" | "tokenSha256" | "signerSha256"> | null;
  verifyMs: number;
}

const nonceDefault = () => BigInt(`0x${randomBytes(8).toString("hex")}`);

/** Game still pregame and on schedule in every team row; returns a reason when not. */
export function pregameScheduleProblem(statuses: string[]): string | null {
  if (statuses.length < 2) return "schedule_rows_missing";
  for (const entry of statuses) {
    const [, game = "", schedule = ""] = entry.split(":");
    if (!PREGAME_GAME_STATUSES.has(game.trim().toUpperCase())) return "game_not_pregame";
    if (schedule.trim().toUpperCase() !== SCHEDULE_OK) return "schedule_not_ok";
  }
  return null;
}

export async function verifyAndWitness(deps: VerifierDeps, expect: VerifyExpectation): Promise<VerifyResult> {
  const started = deps.now();
  const fail = (reason: string, extra: Partial<VerifyResult> = {}): VerifyResult => ({
    verdict: "saved_without_valid_witness", reason, witnessRecorded: false, ackUpper: null, ackDeadline: null, slackMs: null,
    timestamp: null, verifyMs: deps.now() - started, ...extra,
  });

  // 1. Authoritative committed read.
  let first: ReadRow | null;
  const t0 = deps.now();
  try { first = await deps.rpc.read(expect.claimId); } catch (error) { return fail(`read_failed:${message(error)}`); }
  if (!first || !first.artifactPresent || !first.packetBase64 || !first.rowVersion) return fail("artifact_absent");
  const bytes = Buffer.from(first.packetBase64, "base64");
  const raw = sha256Hex(u8(bytes));
  if (raw !== first.rawSha256 || raw !== first.storedRawSha256 || raw !== expect.rawSha256) return fail("raw_hash_mismatch");
  let decoded: ReturnType<typeof decodePacket>;
  try { decoded = decodePacket(u8(bytes)); } catch (error) { return fail(`packet_invalid:${message(error)}`); }
  if (decoded.canonicalSha256 !== first.canonicalSha256 || decoded.canonicalSha256 !== expect.canonicalSha256) return fail("canonical_hash_mismatch");
  const b = decoded.packet.binding;
  if (first.claimId !== expect.claimId || first.gameId !== expect.gameId || first.policyId !== expect.policyId) return fail("claim_binding_mismatch");
  if (b.claimId !== first.claimId || b.gameId !== first.gameId || b.policyId !== first.policyId || b.slateDate !== first.slateDate
    || b.homeTeamId !== first.homeTeamId || b.awayTeamId !== first.awayTeamId || b.calendarRevision !== first.calendarRevision
    || b.codeVersion !== first.codeVersion || !sameInstant(b.scheduledStart, first.scheduledStart) || !sameInstant(b.inputCutoff, first.inputCutoff)) {
    return fail("packet_binding_mismatch");
  }

  // 2. Witness statement over exactly the committed bytes and row version; the nonce is bound inside it.
  const nonce = (deps.nonce ?? nonceDefault)();
  const statement = {
    version: WITNESS_STATEMENT_VERSION, claimId: first.claimId, gameId: String(first.gameId), policyId: first.policyId,
    rawSha256: raw, canonicalSha256: decoded.canonicalSha256, byteLength: bytes.byteLength, rowVersion: first.rowVersion,
    calendarRevision: first.calendarRevision, scheduledStart: first.scheduledStart, currentStart: first.currentStart,
    dbReadAt: first.dbReadAt, nonce: nonce.toString(),
  };
  const statementText = canonicalJson(statement);
  const digest = Buffer.from(sha256Hex(statementText), "hex");
  let token: Buffer, stamped: VerifiedTimestamp;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.tsaTimeoutMs);
  try {
    token = extractToken(await deps.tsa.stamp(buildTimeStampRequest(digest, nonce), controller.signal));
    stamped = verifyTimeStampToken(token, { sha256Digest: digest, nonce }, deps.trust);
  } catch (error) {
    return fail(`tsa_failed:${message(error)}`);
  } finally { clearTimeout(timer); }
  const t3 = deps.now();

  // 3. Read back after the stamp: same committed version and bytes; game still pregame and on schedule.
  let second: ReadRow | null = null;
  try { second = await deps.rpc.read(expect.claimId); } catch { second = null; }
  const reasons: string[] = [];
  if (!second || !second.artifactPresent || second.rowVersion !== first.rowVersion || second.rawSha256 !== raw || second.storedRawSha256 !== raw) {
    reasons.push("version_changed_or_unreadable");
  }
  const scheduleProblem = pregameScheduleProblem(first.teamGameStatuses) ?? pregameScheduleProblem(second?.teamGameStatuses ?? []);
  if (scheduleProblem) reasons.push(scheduleProblem);

  // 4. Database clock must agree with the TSA bound (separate clocks, separate parties).
  const skew = BigInt(deps.skewToleranceMs) * MICROS_PER_MS;
  const elapsed = BigInt(Math.max(0, t3 - t0)) * MICROS_PER_MS;
  const dbRead = parseInstantMicros(first.dbReadAt);
  if (dbRead > stamped.upperMicros + skew || dbRead < stamped.lowerMicros - elapsed - skew) reasons.push("db_clock_disagrees_with_tsa");
  if (second && parseInstantMicros(second.dbReadAt) + skew < stamped.lowerMicros) reasons.push("db_clock_disagrees_with_tsa_after");

  // 5. Deadline: conservative upper bound at or before T−60 of the earliest known start, strictly before it.
  const starts = [first.currentStart, second?.currentStart];
  if (starts.some((value) => !value)) reasons.push("current_start_missing");
  const known = starts.filter((value): value is string => Boolean(value));
  const clocks: StartClocks = {
    scheduledStart: first.scheduledStart,
    currentScheduledStart: known.length ? formatMicros(minMicros(...known.map((s) => parseInstantMicros(s)))) : null,
  };
  if (!ackQualifies(stamped.upperMicros, clocks)) reasons.push("ack_after_deadline");
  const ackDeadline = parseInstantMicros(first.ackDeadline);
  const ackUpper = formatMicros(stamped.upperMicros);
  const verdict = reasons.length === 0 ? "qualified" : "saved_without_valid_witness";
  const reason = reasons.length ? reasons.join(",") : null;
  const slackMs = Number((ackDeadline - stamped.upperMicros) / MICROS_PER_MS);
  const timestamp = { genTime: stamped.genTime, accuracyMicros: stamped.accuracyMicros, accuracySource: stamped.accuracySource,
    serial: stamped.serial, tokenSha256: stamped.tokenSha256, signerSha256: stamped.signerSha256 };

  let witnessRecorded = false;
  let recordedVerdict: VerifyResult["verdict"] = verdict;
  try {
    await deps.rpc.recordWitness({
      claimId: first.claimId, statementText, tsaTokenBase64: token.toString("base64"), tsaGenTime: formatMicros(stamped.genTimeMicros),
      tsaAccuracyMicros: stamped.accuracyMicros, tsaAccuracySource: stamped.accuracySource, tsaSignerSha256: stamped.signerSha256,
      ackUpper, dbReadAt: first.dbReadAt, verdict, verdictReason: reason,
    });
    witnessRecorded = true;
  } catch (error) {
    // Never retried: reconcile by reading the committed witness, if any.
    let after: ReadRow | null = null;
    try { after = await deps.rpc.read(expect.claimId); } catch { after = null; }
    if (after?.witnessVerdict && after.witnessStatementText === statementText) {
      witnessRecorded = true;
      recordedVerdict = after.witnessVerdict;
    } else {
      return { ...fail(`witness_record_failed:${message(error)}`), ackUpper, ackDeadline: first.ackDeadline, slackMs, timestamp };
    }
  }
  return { verdict: recordedVerdict, reason: recordedVerdict === "qualified" ? null : reason ?? "witness_not_qualified",
    witnessRecorded, ackUpper, ackDeadline: first.ackDeadline, slackMs, timestamp, verifyMs: deps.now() - started };
}

/**
 * Offline re-verification of a retained witness, for the pilot receipt and audits: recomputes the statement digest,
 * re-verifies the stored RFC 3161 token against the pinned anchors, and recomputes the conservative bound.
 */
export function reverifyStoredWitness(row: Pick<ReadRow, "witnessStatementText" | "witnessTokenBase64" | "rawSha256" | "storedRawSha256"
  | "canonicalSha256" | "rowVersion" | "claimId" | "ackDeadline">, trust: TsaTrust) {
  if (!row.witnessStatementText || !row.witnessTokenBase64) throw new Error("witness_absent");
  const statement = JSON.parse(row.witnessStatementText) as Record<string, string>;
  if (canonicalJson(statement) !== row.witnessStatementText) throw new Error("statement_not_canonical");
  if (statement.claimId !== row.claimId || statement.rawSha256 !== row.storedRawSha256 || statement.rawSha256 !== row.rawSha256
    || statement.canonicalSha256 !== row.canonicalSha256 || statement.rowVersion !== row.rowVersion) throw new Error("statement_binding");
  const digest = Buffer.from(sha256Hex(row.witnessStatementText), "hex");
  const stamped = verifyTimeStampToken(Buffer.from(row.witnessTokenBase64, "base64"), { sha256Digest: digest, nonce: BigInt(statement.nonce) }, trust);
  return { ackUpper: formatMicros(stamped.upperMicros), withinDeadline: stamped.upperMicros <= parseInstantMicros(row.ackDeadline),
    tokenSha256: stamped.tokenSha256, signerSha256: stamped.signerSha256, genTime: stamped.genTime, accuracyMicros: stamped.accuracyMicros.toString() };
}

function sameInstant(a: string, b: string) {
  try { return parseInstantMicros(a) === parseInstantMicros(b); } catch { return false; }
}
function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}
