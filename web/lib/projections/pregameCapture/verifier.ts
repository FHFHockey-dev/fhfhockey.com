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
 * game binding, then retains an RFC 3161 token over a statement naming exactly those bytes, and reads
 * back again to prove the committed version did not change around the stamp.
 */

export const WITNESS_STATEMENT_VERSION = "forge-pregame-witness-v1";
const PREGAME_STATUSES = new Set(["FUT", "PRE"]);

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
  timestamp: Pick<VerifiedTimestamp, "genTime" | "accuracyMicros" | "accuracySource" | "serial" | "tokenSha256"> | null;
  verifyMs: number;
}

const nonceDefault = () => BigInt(`0x${randomBytes(8).toString("hex")}`);

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
  if (!first || !first.artifactPresent || !first.packetBase64) return fail("artifact_absent");
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
  if (parseInstantMicros(decoded.packet.readWindow.start) < parseInstantMicros(first.inputCutoff)) return fail("reads_before_cutoff");

  // 2. Witness statement over exactly the committed bytes and version.
  const statement = {
    version: WITNESS_STATEMENT_VERSION, claimId: first.claimId, gameId: String(first.gameId), policyId: first.policyId,
    rawSha256: raw, canonicalSha256: decoded.canonicalSha256, byteLength: bytes.byteLength, rowVersion: first.rowVersion,
    calendarRevision: first.calendarRevision, scheduledStart: first.scheduledStart, currentStart: first.currentStart, dbReadAt: first.dbReadAt,
  };
  const digest = Buffer.from(sha256Hex(canonicalJson(statement)), "hex");
  const nonce = (deps.nonce ?? nonceDefault)();
  const t2 = deps.now();
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

  // 3. Read back after the stamp: same committed version and bytes; game still pregame.
  let second: ReadRow | null;
  try { second = await deps.rpc.read(expect.claimId); } catch (error) { second = null; void error; }
  const reasons: string[] = [];
  if (!second || !second.artifactPresent || second.rowVersion !== first.rowVersion || second.rawSha256 !== raw || second.storedRawSha256 !== raw) {
    reasons.push("version_changed_or_unreadable");
  }
  const statuses = [...first.teamGameStatuses, ...(second?.teamGameStatuses ?? [])];
  if (statuses.length === 0 || statuses.some((s) => !PREGAME_STATUSES.has(s.split(":").pop()!.trim().toUpperCase()))) reasons.push("game_not_pregame");

  // 4. Database clock must agree with the TSA bound (separate clocks, separate parties).
  const skew = BigInt(deps.skewToleranceMs) * MICROS_PER_MS;
  const elapsed = BigInt(Math.max(0, t3 - t0)) * MICROS_PER_MS;
  const dbRead = parseInstantMicros(first.dbReadAt);
  if (dbRead > stamped.upperMicros + skew || dbRead < stamped.lowerMicros - elapsed - skew) reasons.push("db_clock_disagrees_with_tsa");
  if (second && parseInstantMicros(second.dbReadAt) + skew < stamped.lowerMicros) reasons.push("db_clock_disagrees_with_tsa_after");

  // 5. Deadline: conservative upper bound at or before T−60 of the earliest known start, strictly before it.
  const starts = [first.currentStart, second?.currentStart].filter((v): v is string => Boolean(v));
  const clocks: StartClocks = {
    scheduledStart: first.scheduledStart,
    currentScheduledStart: starts.length ? formatMicros(minMicros(...starts.map((s) => parseInstantMicros(s)))) : null,
  };
  if (!ackQualifies(stamped.upperMicros, clocks)) reasons.push("ack_after_deadline");
  const ackDeadline = parseInstantMicros(first.ackDeadline);
  const ackUpper = formatMicros(stamped.upperMicros);
  const verdict = reasons.length === 0 ? "qualified" : "saved_without_valid_witness";
  const reason = reasons.length ? reasons.join(",") : null;
  void t2;

  let witnessRecorded = false;
  try {
    await deps.rpc.recordWitness({
      claimId: first.claimId, statement, statementSha256: digest.toString("hex"), tsaTokenBase64: token.toString("base64"),
      tsaGenTime: formatMicros(stamped.genTimeMicros), tsaAccuracyMicros: stamped.accuracyMicros, ackUpper, dbReadAt: first.dbReadAt,
      verdict, verdictReason: reason,
    });
    witnessRecorded = true;
  } catch (error) {
    return { ...fail(`witness_record_failed:${message(error)}`), ackUpper, ackDeadline: first.ackDeadline,
      slackMs: Number((ackDeadline - stamped.upperMicros) / MICROS_PER_MS) };
  }
  return {
    verdict, reason, witnessRecorded, ackUpper, ackDeadline: first.ackDeadline,
    slackMs: Number((ackDeadline - stamped.upperMicros) / MICROS_PER_MS),
    timestamp: { genTime: stamped.genTime, accuracyMicros: stamped.accuracyMicros, accuracySource: stamped.accuracySource,
      serial: stamped.serial, tokenSha256: stamped.tokenSha256 },
    verifyMs: deps.now() - started,
  };
}

function sameInstant(a: string, b: string) {
  try { return parseInstantMicros(a) === parseInstantMicros(b); } catch { return false; }
}
function message(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}
