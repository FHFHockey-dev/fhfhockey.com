import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { at, bindingFor, syntheticPacket, syntheticWitness } from "./__fixtures__/witnessCustody";
import { testTsaTrust } from "./__fixtures__/testTsa";
import { reviewWitnessEvidence, type ReadyEvidence } from "./independentVerdict";
import type { PregamePacket } from "./packet";
import { extractToken, verifyTimeStampToken, type TsaTrust } from "./rfc3161";
import { parseInstantMicros } from "./time";
import { tsaProfile, trustFromProfile } from "./tsaProfiles";

const GAME = 2099020991, CLAIM = "11111111-2222-4333-8444-555555555555", SHA = "a".repeat(40);
const T = "2099-01-01T20:00:00.000000Z";
const minutes = (n: number) => n * 60_000;

interface Options {
  cutoffBeforeMs?: number; readToStamp?: number; finalAfterRead?: number;
  binding?: Record<string, unknown>; tamperPacket?: (p: PregamePacket) => void;
  statement?: Record<string, unknown>; tsa?: Record<string, unknown>;
  patch?: (e: ReadyEvidence) => void;
}

function evidence(o: Options = {}): ReadyEvidence {
  const cutoff = at(T, -(o.cutoffBeforeMs ?? minutes(100)));
  const inserted = at(cutoff, 2_000), read = at(inserted, 500), final = at(read, o.finalAfterRead ?? 2_000);
  const binding = { ...bindingFor({ gameId: GAME, claimId: CLAIM, scheduledStart: T, inputCutoff: cutoff, codeVersion: SHA }), ...o.binding };
  const packet = syntheticPacket(binding as never, o.tamperPacket);
  const w = syntheticWitness({ claimId: CLAIM, gameId: GAME, rawSha256: packet.rawSha256, canonicalSha256: packet.canonicalSha256,
    byteLength: packet.bytes.length, rowVersion: "777", calendarRevision: "c".repeat(64), scheduledStart: T, dbReadAt: read,
    genTimeMicros: parseInstantMicros(read) + BigInt(o.readToStamp ?? 1_000) * BigInt(1000), statement: o.statement, tsa: o.tsa });
  const e: ReadyEvidence = {
    status: "ready", gameId: GAME, policyId: "pregame-native-v1",
    claim: { id: CLAIM, gameId: GAME, policyId: "pregame-native-v1", slateDate: T.slice(0, 10), homeTeamId: 1, awayTeamId: 2,
      calendarRevision: "c".repeat(64), scheduledStart: T, inputCutoff: cutoff, ackDeadline: at(T, -minutes(60)), codeVersion: SHA, claimedAt: cutoff },
    outcome: "qualified", saveFenced: false,
    artifact: { packetBase64: packet.bytes.toString("base64"), dbRawSha256: packet.rawSha256, rawSha256: packet.rawSha256,
      canonicalSha256: packet.canonicalSha256, byteLength: packet.bytes.length, rowVersion: "777", insertedAt: inserted },
    witness: { statementText: w.statementText, statementSha256: w.statementSha256, tokenBase64: w.token.toString("base64"),
      dbTokenSha256: w.tokenSha256, tokenSha256: w.tokenSha256, genTime: w.genTime, accuracyUs: w.accuracyUs, resolutionUs: w.resolutionUs,
      accuracySource: w.accuracySource, signerSha256: w.signerSha256, ackUpper: w.ackUpper, dbReadAt: read, finalReadAt: final },
    schedule: { gameDate: T.slice(0, 10), startTime: T, homeTeamId: 1, awayTeamId: 2, homeAbbrev: "NJD", awayAbbrev: "NYI",
      teamStatuses: ["NJD:FUT:OK", "NYI:FUT:OK"] },
    dbNow: at(T, -minutes(90)),
  };
  o.patch?.(e);
  return e;
}

const trust = testTsaTrust();
const review = (e: ReadyEvidence, game = GAME, t: TsaTrust = trust) => reviewWitnessEvidence(e, game, t);
const flip = (b64: string, index: number) => { const b = Buffer.from(b64, "base64"); b[index] ^= 0x01; return b.toString("base64"); };

describe("independent witness verdict", () => {
  it("accepts committed custody whose bytes, bindings, cutoff, token and timing all check out", () => {
    const e = evidence();
    expect(review(e)).toEqual({ verdict: "accepted", reason: null, claimId: CLAIM, rawSha256: e.artifact!.rawSha256,
      canonicalSha256: e.artifact!.canonicalSha256, tsaTokenSha256: e.witness!.tokenSha256, statementSha256: e.witness!.statementSha256,
      inputCutoff: e.claim.inputCutoff });
  });

  it.each<[string, Options, string, number?]>([
    ["missing artifact", { patch: e => { e.artifact = null; e.witness = null; e.outcome = "source_failed"; } }, "artifact_missing"],
    ["fenced save", { patch: e => { e.saveFenced = true; } }, "save_fenced"],
    ["unqualified outcome", { patch: e => { e.outcome = "saved_without_valid_witness"; } }, "outcome_not_qualified"],
    ["missing witness", { patch: e => { e.witness = null; } }, "witness_missing"],
    ["evidence for another armed game", {}, "game_binding", GAME + 1],
    ["packet bound to another game", { binding: { gameId: GAME + 1 } }, "game_binding"],
    ["team abbreviation differs from the schedule", { patch: e => { e.schedule!.homeAbbrev = "BOS"; } }, "game_binding"],
    ["packet bound to another claim", { binding: { claimId: "99999999-2222-4333-8444-555555555555" } }, "claim_binding"],
    ["packet bound to another release", { binding: { codeVersion: "b".repeat(40) } }, "claim_binding"],
    ["stored canonical hash differs", { patch: e => { e.artifact!.canonicalSha256 = "0".repeat(64); } }, "hash_mismatch"],
    ["stored bytes tampered", { patch: e => { e.artifact!.packetBase64 = flip(e.artifact!.packetBase64, 40); } }, "hash_mismatch"],
    ["database raw digest differs", { patch: e => { e.artifact!.dbRawSha256 = "0".repeat(64); } }, "hash_mismatch"],
    ["claim cutoff differs from the packet", { patch: e => { e.claim.inputCutoff = at(e.claim.inputCutoff, 1); e.claim.claimedAt = e.claim.inputCutoff; } }, "cutoff_mismatch"],
    ["cutoff is not the claim clock", { patch: e => { e.claim.claimedAt = at(e.claim.claimedAt, -1); } }, "cutoff_mismatch"],
    ["reads before the cutoff", { tamperPacket: p => { p.readWindow.start = at(p.binding.inputCutoff, -60_000); p.reads[0].receivedAt = p.readWindow.start; } }, "cutoff_mismatch"],
    ["statement names other bytes", { statement: { rawSha256: "0".repeat(64) } }, "statement_binding"],
    ["statement names another row version", { statement: { rowVersion: "778" } }, "statement_binding"],
    ["token tampered", { patch: e => { e.witness!.tokenBase64 = flip(e.witness!.tokenBase64, 200); } }, "token_invalid"],
    ["token under another TSA policy", { tsa: { policy: "1.3.6.1.4.1.99999.9" } }, "token_invalid"],
    ["token signer without the timestamping EKU", { tsa: { signer: "plain" } }, "token_invalid"],
    ["stored token fields differ from the token", { patch: e => { e.witness!.ackUpper = at(e.witness!.ackUpper, 1); } }, "token_invalid"],
    ["start moved later", { patch: e => { e.schedule!.startTime = at(T, minutes(10)); } }, "schedule_changed"],
    ["start moved earlier", { patch: e => { e.schedule!.startTime = at(T, -minutes(30)); } }, "schedule_changed"],
    ["game no longer pregame", { patch: e => { e.schedule!.teamStatuses = ["NJD:LIVE:OK", "NYI:LIVE:OK"]; } }, "schedule_changed"],
    ["final readback missing", { patch: e => { e.witness!.finalReadAt = null; } }, "timing_invalid"],
    ["artifact saved after the witness read", { patch: e => { e.artifact!.insertedAt = at(e.witness!.dbReadAt, 1); } }, "timing_invalid"],
    ["stamp long after the read", { readToStamp: 60_000 }, "timing_invalid"],
    ["witness bound after T−60", { cutoffBeforeMs: minutes(60) + 10_000, readToStamp: 8_000, finalAfterRead: 6_000,
      patch: e => { e.dbNow = at(T, -minutes(61)); } }, "witness_late"],
    ["verification after T−60", { patch: e => { e.dbNow = at(T, -minutes(60) + 1); } }, "verification_late"],
  ])("rejects %s", (_name, options, reason, game) => {
    expect(review(evidence(options), game)).toMatchObject({ verdict: "rejected", reason });
  });

  it("accepts verification exactly at T−60 on the database clock", () => {
    expect(review(evidence({ patch: e => { e.dbNow = at(T, -minutes(60)); } }))).toMatchObject({ verdict: "accepted" });
  });

  it("refuses to decide when the schedule row is invisible (no verdict, retryable)", () => {
    expect(() => review(evidence({ patch: e => { e.schedule = null; } }))).toThrow("schedule_unavailable");
  });

  it("rejects a fixture-TSA token under the released DigiCert pin the route uses", () => {
    expect(review(evidence(), GAME, trustFromProfile(tsaProfile("digicert-g4-v1"), "capture"))).toMatchObject({ verdict: "rejected", reason: "token_invalid" });
  });

  it("the released DigiCert pin still verifies DigiCert's real probe token (positive control)", () => {
    const dir = join(__dirname, "__fixtures__", "tsa");
    const probe = JSON.parse(readFileSync(join(dir, "digicert-probe-20261115T023745Z.json"), "utf8")) as { sha256Digest: string; nonce: string };
    const stamp = verifyTimeStampToken(extractToken(readFileSync(join(dir, "digicert-probe-20261115T023745Z.tsr"))),
      { sha256Digest: Buffer.from(probe.sha256Digest, "hex"), nonce: BigInt(probe.nonce) }, trustFromProfile(tsaProfile("digicert-g4-v1"), "capture"));
    expect(stamp.accuracySource).toBe("pinned_policy");
  });
});
