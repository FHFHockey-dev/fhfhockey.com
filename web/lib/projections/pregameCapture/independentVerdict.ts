import { u8 } from "./der";
import { canonicalJson, decodePacket, sha256Hex, type PregamePacket } from "./packet";
import { DEFAULT_CAPTURE_BUDGET, POLICY_ID } from "./policy";
import { verifyTimeStampToken, type TsaTrust, type VerifiedTimestamp } from "./rfc3161";
import { MICROS_PER_MINUTE, MICROS_PER_MS, parseInstantMicros as instant } from "./time";
import { pregameScheduleProblem, WITNESS_STATEMENT_VERSION } from "./verifier";

/**
 * Independent FORGE verdict over one armed game's committed custody, as read back by forge_witness.evidence_v1.
 * Pure: no I/O, no clock of its own (the database clock `dbNow` is the only "now"). It recomputes raw and canonical
 * digests from the stored bytes, checks the claim/game/cutoff bindings, the witness statement, the retained RFC 3161
 * token against the pinned trust, and the timing against T−60 of the earliest known start. Stored verdict fields
 * (witness verdict, outcome) are preconditions only; they never stand in for a check.
 */

export type VerdictReason =
  | "artifact_missing" | "save_fenced" | "outcome_not_qualified" | "witness_missing" | "packet_invalid" | "claim_binding"
  | "game_binding" | "hash_mismatch" | "cutoff_mismatch" | "statement_binding" | "token_invalid" | "schedule_changed"
  | "witness_late" | "verification_late" | "timing_invalid";

export interface ReadyEvidence {
  status: "ready";
  gameId: number;
  policyId: string;
  claim: { id: string; gameId: number; policyId: string; slateDate: string; homeTeamId: number; awayTeamId: number;
    calendarRevision: string; scheduledStart: string; inputCutoff: string; ackDeadline: string; codeVersion: string; claimedAt: string };
  outcome: string;
  saveFenced: boolean;
  artifact: { packetBase64: string; dbRawSha256: string; rawSha256: string; canonicalSha256: string; byteLength: number;
    rowVersion: string; insertedAt: string } | null;
  witness: { statementText: string; statementSha256: string; tokenBase64: string; dbTokenSha256: string; tokenSha256: string;
    genTime: string; accuracyUs: number; resolutionUs: number; accuracySource: string; signerSha256: string; ackUpper: string;
    dbReadAt: string; finalReadAt: string | null } | null;
  schedule: { gameDate: string; startTime: string | null; homeTeamId: number; awayTeamId: number; homeAbbrev: string | null;
    awayAbbrev: string | null; teamStatuses: string[] } | null;
  dbNow: string;
}

export interface IndependentVerdict {
  verdict: "accepted" | "rejected";
  reason: VerdictReason | null;
  claimId: string;
  rawSha256: string | null;
  canonicalSha256: string | null;
  tsaTokenSha256: string | null;
  statementSha256: string | null;
  inputCutoff: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

export function reviewWitnessEvidence(e: ReadyEvidence, gameId: number, trust: TsaTrust): IndependentVerdict {
  const result: IndependentVerdict = {
    verdict: "rejected", reason: null, claimId: e.claim.id, rawSha256: null, canonicalSha256: null, tsaTokenSha256: null,
    statementSha256: null, inputCutoff: e.claim.inputCutoff,
  };
  const reject = (reason: VerdictReason): IndependentVerdict => ({ ...result, verdict: "rejected", reason });
  if (!e.artifact) return reject("artifact_missing");
  if (e.saveFenced) return reject("save_fenced");
  if (e.outcome !== "qualified") return reject("outcome_not_qualified");
  if (!e.witness) return reject("witness_missing");
  const a = e.artifact, w = e.witness, c = e.claim;

  // 1. The stored bytes: raw digest recomputed here and by the database must agree with the stored column.
  const bytes = Buffer.from(a.packetBase64, "base64");
  const raw = sha256Hex(u8(bytes));
  result.rawSha256 = raw;
  if (bytes.length !== a.byteLength || raw !== a.dbRawSha256 || raw !== a.rawSha256) return reject("hash_mismatch");
  let packet: PregamePacket, canonical: string;
  try {
    const decoded = decodePacket(u8(bytes));
    if (decoded.rawSha256 !== raw) return reject("hash_mismatch");
    packet = decoded.packet;
    canonical = decoded.canonicalSha256;
  } catch {
    return reject("packet_invalid");
  }
  result.canonicalSha256 = canonical;
  if (canonical !== a.canonicalSha256) return reject("hash_mismatch");

  // 2. Game and claim: the armed game, the claim row and the packet binding name the same game, claim and policy.
  const b = packet.binding;
  if (e.gameId !== gameId || c.gameId !== gameId || b.gameId !== gameId) return reject("game_binding");
  if (b.claimId !== c.id || b.policyId !== POLICY_ID || c.policyId !== POLICY_ID || e.policyId !== POLICY_ID) return reject("claim_binding");
  if (b.slateDate !== c.slateDate || b.homeTeamId !== c.homeTeamId || b.awayTeamId !== c.awayTeamId
    || b.calendarRevision !== c.calendarRevision || b.codeVersion !== c.codeVersion
    || !same(b.scheduledStart, c.scheduledStart)) return reject("claim_binding");
  if (!e.schedule || !e.schedule.startTime) throw new Error("schedule_unavailable");
  const s = e.schedule, startTime: string = e.schedule.startTime;
  if (s.homeTeamId !== c.homeTeamId || s.awayTeamId !== c.awayTeamId || b.homeAbbrev !== s.homeAbbrev || b.awayAbbrev !== s.awayAbbrev) {
    return reject("game_binding");
  }

  // 3. Stated input cutoff: the packet's cutoff is the claim's own database clock, and its read window and stated
  //    availability cutoff sit inside [cutoff, saved] (transport tolerance only).
  const skew = BigInt(DEFAULT_CAPTURE_BUDGET.skewToleranceMs) * MICROS_PER_MS;
  const deadline = min(instant(c.scheduledStart), instant(startTime)) - BigInt(60) * MICROS_PER_MINUTE;
  const cutoff = instant(c.inputCutoff), inserted = instant(a.insertedAt);
  if (!same(b.inputCutoff, c.inputCutoff) || cutoff !== instant(c.claimedAt) || instant(packet.readWindow.start) < cutoff - skew
    || instant(packet.readWindow.end) > inserted + skew || instant(packet.statedCutoff) < cutoff
    || instant(packet.statedCutoff) > deadline) return reject("cutoff_mismatch");

  // 4. Witness statement: canonical text over exactly these bytes, this row version and this claim.
  let statement: Record<string, unknown>;
  try { statement = JSON.parse(w.statementText); } catch { return reject("statement_binding"); }
  const statementSha = sha256Hex(w.statementText);
  result.statementSha256 = statementSha;
  if (canonicalJson(statement) !== w.statementText || statementSha !== w.statementSha256 || statement.version !== WITNESS_STATEMENT_VERSION
    || statement.claimId !== c.id || statement.gameId !== String(gameId) || statement.policyId !== POLICY_ID
    || statement.rawSha256 !== raw || statement.canonicalSha256 !== canonical || statement.byteLength !== bytes.length
    || statement.rowVersion !== a.rowVersion || statement.calendarRevision !== c.calendarRevision
    || typeof statement.scheduledStart !== "string" || !same(statement.scheduledStart, c.scheduledStart)
    || typeof statement.dbReadAt !== "string" || !same(statement.dbReadAt, w.dbReadAt)
    || typeof statement.nonce !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(statement.nonce)) return reject("statement_binding");

  // 5. The retained RFC 3161 token, re-verified against the pinned trust; its parsed fields must equal the stored ones.
  const token = Buffer.from(w.tokenBase64, "base64");
  const tokenSha = sha256Hex(u8(token));
  result.tsaTokenSha256 = tokenSha;
  let stamp: VerifiedTimestamp;
  try {
    stamp = verifyTimeStampToken(token, { sha256Digest: Buffer.from(statementSha, "hex"), nonce: BigInt(statement.nonce) }, trust);
  } catch {
    return reject("token_invalid");
  }
  if (!HEX64.test(tokenSha) || stamp.tokenSha256 !== tokenSha || tokenSha !== w.tokenSha256 || tokenSha !== w.dbTokenSha256
    || stamp.signerSha256 !== w.signerSha256 || stamp.genTimeMicros !== instant(w.genTime) || stamp.upperMicros !== instant(w.ackUpper)
    || stamp.accuracyMicros !== BigInt(w.accuracyUs) || stamp.resolutionMicros !== BigInt(w.resolutionUs)
    || stamp.accuracySource !== w.accuracySource) return reject("token_invalid");

  // 6. Still the same game on the same schedule, still pregame.
  if (!same(startTime, c.scheduledStart) || s.gameDate !== c.slateDate || pregameScheduleProblem(s.teamStatuses)) {
    return reject("schedule_changed");
  }

  // 7. Custody order and the witness's own bounds, then this verdict's database clock, against T−60.
  if (!w.finalReadAt) return reject("timing_invalid");
  const read = instant(w.dbReadAt), final = instant(w.finalReadAt);
  const stampWait = BigInt(DEFAULT_CAPTURE_BUDGET.rpcMs + DEFAULT_CAPTURE_BUDGET.tsaTimeoutMs) * MICROS_PER_MS;
  if (instant(c.ackDeadline) !== instant(c.scheduledStart) - BigInt(60) * MICROS_PER_MINUTE || cutoff > inserted || inserted > read
    || read > final || read > stamp.upperMicros + skew || read + stampWait + skew < stamp.lowerMicros || final + skew < stamp.lowerMicros) {
    return reject("timing_invalid");
  }
  if (stamp.upperMicros > deadline || final > deadline) return reject("witness_late");
  if (instant(e.dbNow) > deadline) return reject("verification_late");
  return { ...result, verdict: "accepted", reason: null };
}

function same(a: string, b: string) {
  try { return instant(a) === instant(b); } catch { return false; }
}
const min = (a: bigint, b: bigint) => (a < b ? a : b);
