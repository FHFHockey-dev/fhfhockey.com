/** TEST-ONLY synthetic custody for the independent verdict: a packet, a witness statement and a fixture-TSA token. */
import { canonicalJson, encodePacket, PACKET_VERSION, sha256Hex, type CaptureBinding, type PregamePacket } from "../packet";
import { POLICY_ID } from "../policy";
import { buildTimeStampRequest, extractToken, verifyTimeStampToken } from "../rfc3161";
import { formatMicros, parseInstantMicros } from "../time";
import { WITNESS_STATEMENT_VERSION } from "../verifier";
import { mintTimeStampResponse, testTsaTrust, type TestTsaOptions } from "./testTsa";

const MS = BigInt(1000);
export const at = (base: string, ms: number) => formatMicros(parseInstantMicros(base) + BigInt(ms) * MS);

/** A minimal valid packet whose reads sit inside [cutoff, cutoff + 1 s]. */
export function syntheticPacket(binding: CaptureBinding, tamper: (packet: PregamePacket) => void = () => {}) {
  const start = at(binding.inputCutoff, 100), end = at(binding.inputCutoff, 900);
  const packet = {
    version: PACKET_VERSION, binding, readWindow: { start, end }, statedCutoff: at(end, 5_000), seasonBootstrapApplied: false,
    modelEnvironment: { FORGE_SKATER_MODEL: null }, candidates: { skaters: [8471001], goalies: [], reserves: [] },
    transport: { calls: 1, httpCalls: 1, rows: 1, bytes: 10, stampToleranceMs: 5_000 },
    reads: [{ receivedAt: at(start, 100) }],
  } as unknown as PregamePacket;
  tamper(packet);
  return encodePacket(packet);
}

export function bindingFor(game: { gameId: number; claimId: string; scheduledStart: string; inputCutoff: string; codeVersion: string }): CaptureBinding {
  return { claimId: game.claimId, policyId: POLICY_ID, codeVersion: game.codeVersion, gameId: game.gameId, slateDate: game.scheduledStart.slice(0, 10),
    homeTeamId: 1, awayTeamId: 2, homeAbbrev: "NJD", awayAbbrev: "NYI", scheduledStart: game.scheduledStart,
    calendarRevision: "c".repeat(64), inputCutoff: game.inputCutoff };
}

export interface WitnessInput {
  claimId: string; gameId: number; rawSha256: string; canonicalSha256: string; byteLength: number; rowVersion: string;
  calendarRevision: string; scheduledStart: string; dbReadAt: string; genTimeMicros: bigint;
  statement?: Record<string, unknown>; tsa?: Partial<TestTsaOptions>;
}

/** Statement over the committed bytes plus a fixture-TSA token over its digest; fields as the custody witness stores them. */
export function syntheticWitness(input: WitnessInput) {
  const nonce = BigInt(4242);
  const statementText = canonicalJson({
    version: WITNESS_STATEMENT_VERSION, claimId: input.claimId, gameId: String(input.gameId), policyId: POLICY_ID,
    rawSha256: input.rawSha256, canonicalSha256: input.canonicalSha256, byteLength: input.byteLength, rowVersion: input.rowVersion,
    calendarRevision: input.calendarRevision, scheduledStart: input.scheduledStart, currentStart: input.scheduledStart,
    dbReadAt: input.dbReadAt, nonce: nonce.toString(), ...input.statement,
  });
  const digest = Buffer.from(sha256Hex(statementText), "hex");
  const token = extractToken(mintTimeStampResponse(buildTimeStampRequest(digest, nonce), { genTimeMicros: input.genTimeMicros, accuracyMillis: 500, ...input.tsa }));
  // Fields come from the token as signed (verified leniently, so adversarial tokens still yield their stated fields).
  let stamp: ReturnType<typeof verifyTimeStampToken>;
  try {
    stamp = verifyTimeStampToken(token, { sha256Digest: digest, nonce }, { ...testTsaTrust(), policies: [] });
  } catch {
    // A token even the lenient check refuses (e.g. a signer without the timestamping EKU): store plausible fields.
    const gen = input.genTimeMicros, accuracy = BigInt(500_000), resolution = BigInt(1);
    stamp = { genTime: formatMicros(gen), genTimeMicros: gen, accuracyMicros: accuracy, accuracySource: "token", resolutionMicros: resolution,
      lowerMicros: gen - accuracy - resolution, upperMicros: gen + accuracy + resolution, policy: "", serial: "1", nonce: nonce.toString(),
      signerSha256: "e".repeat(64), tokenSha256: sha256Hex(token as unknown as Uint8Array) };
  }
  return {
    statementText, statementSha256: sha256Hex(statementText), token, tokenSha256: stamp.tokenSha256, genTime: formatMicros(stamp.genTimeMicros),
    accuracyUs: Number(stamp.accuracyMicros), resolutionUs: Number(stamp.resolutionMicros), accuracySource: stamp.accuracySource,
    signerSha256: stamp.signerSha256, ackUpper: formatMicros(stamp.upperMicros),
  };
}
