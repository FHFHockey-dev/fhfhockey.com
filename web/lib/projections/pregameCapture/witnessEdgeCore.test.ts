// @vitest-environment node
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { at, bindingFor, syntheticPacket, syntheticWitness } from "./__fixtures__/witnessCustody";
import { testTsaTrust } from "./__fixtures__/testTsa";
import type { ReadyEvidence } from "./independentVerdict";
import { canonicalJson } from "./packet";
import { parseInstantMicros } from "./time";
import { checkSignedVerdict, witnessKeyId, type SignedVerdictPayload } from "./signedVerdict";
import { ed25519Signer, handleWitnessEdgeRequest } from "./witnessEdgeCore";
import { witnessSelfTest } from "./witnessSelfTest";
import { tsaProfile, trustFromProfile } from "./tsaProfiles";

const GAME = 2099020991, CLAIM = "11111111-2222-4333-8444-555555555555", SHA = "a".repeat(40), RELEASE = "e".repeat(64);
const T = "2099-01-01T20:00:00.000000Z";
const minutes = (n: number) => n * 60_000;
const keyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { pkcs8: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"), x: publicKey.export({ format: "jwk" }).x!, privateKey };
};
const real = keyPair(), attacker = keyPair();
const PINNED = { [witnessKeyId(real.x)]: real.x };

function evidence(): ReadyEvidence & { gameId: number } {
  const cutoff = at(T, -minutes(100)), inserted = at(cutoff, 2_000), read = at(inserted, 500), final = at(read, 2_000);
  const packet = syntheticPacket(bindingFor({ gameId: GAME, claimId: CLAIM, scheduledStart: T, inputCutoff: cutoff, codeVersion: SHA }));
  const w = syntheticWitness({ claimId: CLAIM, gameId: GAME, rawSha256: packet.rawSha256, canonicalSha256: packet.canonicalSha256,
    byteLength: packet.bytes.length, rowVersion: "777", calendarRevision: "c".repeat(64), scheduledStart: T, dbReadAt: read,
    genTimeMicros: parseInstantMicros(read) + BigInt(1_000_000) });
  return { status: "ready", gameId: GAME, policyId: "pregame-native-v1",
    claim: { id: CLAIM, gameId: GAME, policyId: "pregame-native-v1", slateDate: T.slice(0, 10), homeTeamId: 1, awayTeamId: 2,
      calendarRevision: "c".repeat(64), scheduledStart: T, inputCutoff: cutoff, ackDeadline: at(T, -minutes(60)), codeVersion: SHA, claimedAt: cutoff },
    outcome: "qualified", saveFenced: false,
    artifact: { packetBase64: packet.bytes.toString("base64"), dbRawSha256: packet.rawSha256, rawSha256: packet.rawSha256,
      canonicalSha256: packet.canonicalSha256, byteLength: packet.bytes.length, rowVersion: "777", insertedAt: inserted },
    witness: { statementText: w.statementText, statementSha256: w.statementSha256, tokenBase64: w.token.toString("base64"),
      dbTokenSha256: w.tokenSha256, tokenSha256: w.tokenSha256, genTime: w.genTime, accuracyUs: w.accuracyUs, resolutionUs: w.resolutionUs,
      accuracySource: w.accuracySource, signerSha256: w.signerSha256, ackUpper: w.ackUpper, dbReadAt: read, finalReadAt: final },
    // The database's schedule is ignored by the edge verifier (here it even lies about the start).
    schedule: { gameDate: T.slice(0, 10), startTime: at(T, minutes(120)), homeTeamId: 1, awayTeamId: 2, homeAbbrev: "NJD", awayAbbrev: "NYI",
      teamStatuses: ["NJD:FUT:OK", "NYI:FUT:OK"] },
    dbNow: T };
}
const landing = (start = T, state = "FUT") => ({ id: GAME, startTimeUTC: start.replace(".000000Z", "Z"), gameDate: T.slice(0, 10), gameState: state,
  gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "NJD" }, awayTeam: { id: 2, abbrev: "NYI" } });

async function run(o: { now?: number; official?: unknown; officialStatus?: number; trust?: boolean; env?: Record<string, string | undefined>;
  method?: string; url?: string } = {}) {
  const records: Array<{ p_payload: string; p_signature: string }> = [];
  const calls: string[] = [];
  const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url.replace(/^https?:\/\/[^/]+/, ""));
    if (url.startsWith("https://api-web.nhle.com/")) {
      return new Response(JSON.stringify(o.official ?? landing()), { status: o.officialStatus ?? 200 });
    }
    expect(new Headers(init?.headers).get("content-profile")).toBe("forge_witness_api");
    const name = url.split("/rpc/")[1];
    const body = JSON.parse(String(init?.body));
    if (name === "signed_pending_v1") return Response.json([GAME]);
    if (name === "signed_evidence_v1") return Response.json(evidence());
    if (name === "record_signed_v1") { records.push(body); return Response.json({ created: records.length === 1 }); }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const env = { SUPABASE_URL: "https://ref.supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "service-key", FORGE_WITNESS_SIGNING_KEY: real.pkcs8, ...o.env };
  const response = await handleWitnessEdgeRequest(new Request(o.url ?? "https://edge.invalid/forge-witness-verify", { method: o.method ?? "POST" }),
    name => env[name as keyof typeof env], { fetch: fetchMock, now: () => o.now ?? Date.parse(T) - minutes(90), release: RELEASE,
      trust: o.trust === false ? undefined : testTsaTrust() });
  return { status: response.status, body: await response.json(), records, calls };
}

const e0 = evidence();
const expectation = { claimId: CLAIM, gameId: GAME, rawSha256: e0.artifact!.rawSha256, canonicalSha256: e0.artifact!.canonicalSha256,
  tsaTokenSha256: e0.witness!.tokenSha256 };
const signWith = (privateKey: ReturnType<typeof keyPair>["privateKey"], payload: SignedVerdictPayload) => {
  const text = canonicalJson(payload);
  return { payload: text, signature: nodeSign(null, Buffer.from(text) as unknown as Uint8Array, privateKey).toString("base64") };
};

describe("independent witness edge function core", () => {
  it("signs an accepted verdict that the release-side gate verifies with the pinned key only", async () => {
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", release: RELEASE, keyId: witnessKeyId(real.x), selfTest: { tsa: true, packet: true, signature: true },
      results: [{ gameId: GAME, status: "recorded", verdict: "accepted", reason: null }] });
    expect(JSON.stringify(r.body)).not.toContain(real.pkcs8.slice(20, 60));
    const row = { payload: r.records[0].p_payload, signature: r.records[0].p_signature };
    expect(checkSignedVerdict(row, expectation, PINNED)).toMatchObject({ accepted: true, reason: null });
    expect(JSON.parse(row.payload)).toMatchObject({ officialStart: "2099-01-01T20:00:00.000000Z", deadline: "2099-01-01T19:00:00.000000Z" });
    // A second POST re-signs, but the database keeps the first row (created: false).
    expect(r.calls.filter(c => c.endsWith("record_signed_v1"))).toHaveLength(1);
  });

  it("refuses forged, altered, replayed, unpinned and missing verdicts", async () => {
    const r = await run();
    const row = { payload: r.records[0].p_payload, signature: r.records[0].p_signature };
    const genuine = JSON.parse(row.payload) as SignedVerdictPayload;
    const edit = (patch: Partial<SignedVerdictPayload>) => ({ payload: canonicalJson({ ...genuine, ...patch }), signature: row.signature });
    const cases: Array<[string, Parameters<typeof checkSignedVerdict>[0], string, Record<string, string>?]> = [
      ["missing", null, "verdict_missing"],
      ["no key pinned (release default)", row, "key_unpinned", {}],
      ["attacker key, own keyId", signWith(attacker.privateKey, { ...genuine, keyId: witnessKeyId(attacker.x) }), "key_unpinned"],
      ["attacker key, pinned keyId", signWith(attacker.privateKey, genuine), "signature_invalid"],
      ["verdict flipped", edit({ verdict: "accepted", reason: null, verifiedAt: at(genuine.verifiedAt, 1) }), "signature_invalid"],
      ["hashes swapped", edit({ canonicalSha256: "0".repeat(64) }), "signature_invalid"],
      ["deadline moved", edit({ officialStart: at(T, minutes(60)), deadline: T }), "signature_invalid"],
      ["non-canonical encoding", { payload: row.payload.replace(":", ": "), signature: row.signature }, "payload_invalid"],
      ["signature truncated", { payload: row.payload, signature: row.signature.slice(0, 40) }, "signature_invalid"],
    ];
    for (const [name, candidate, reason, keys] of cases) {
      expect(checkSignedVerdict(candidate, expectation, keys ?? PINNED), name).toMatchObject({ accepted: false, reason });
    }
    expect(checkSignedVerdict(row, { ...expectation, claimId: "99999999-2222-4333-8444-555555555555" }, PINNED).reason).toBe("binding_mismatch");
    expect(checkSignedVerdict(row, { ...expectation, tsaTokenSha256: "0".repeat(64) }, PINNED).reason).toBe("binding_mismatch");
    // Even a genuine signature does not pass a verdict decided after its deadline.
    const lateKey = (await import("node:crypto")).createPrivateKey({ key: Buffer.from(real.pkcs8, "base64"), format: "der", type: "pkcs8" });
    expect(checkSignedVerdict(signWith(lateKey, { ...genuine, verifiedAt: at(genuine.deadline, 1) }), expectation, PINNED).reason).toBe("verified_late");
  });

  it("signs a rejection when it runs after T−60, and the gate refuses it", async () => {
    const r = await run({ now: Date.parse(T) - minutes(60) + 1 });
    expect(r.body.results[0]).toMatchObject({ status: "recorded", verdict: "rejected", reason: "verification_late" });
    expect(checkSignedVerdict({ payload: r.records[0].p_payload, signature: r.records[0].p_signature }, expectation, PINNED).reason)
      .toBe("verdict_rejected");
  });

  it("uses the NHL schedule, not the database: a claim whose start differs from the official one is rejected", async () => {
    const r = await run({ official: landing(at(T, minutes(15))) });
    expect(r.body.results[0]).toMatchObject({ status: "recorded", verdict: "rejected", reason: "schedule_changed" });
    const live = await run({ official: landing(T, "LIVE") });
    expect(live.body.results[0]).toMatchObject({ verdict: "rejected", reason: "schedule_changed" });
  });

  it("decides nothing when the official schedule is unavailable or malformed", async () => {
    for (const o of [{ officialStatus: 503 }, { official: { ...landing(), id: GAME + 1 } }, { official: { ...landing(), homeTeam: null } }]) {
      const r = await run(o);
      expect(r.body.results[0]).toMatchObject({ status: "official_unavailable" });
      expect(r.records).toHaveLength(0);
    }
  });

  it("rejects a fixture-TSA token under the released DigiCert pin (the deployed default)", async () => {
    const r = await run({ trust: false });
    expect(r.body.results[0]).toMatchObject({ verdict: "rejected", reason: "token_invalid" });
  });

  it.each([
    [{ method: "GET" }, 405, "method_not_allowed"],
    [{ url: "https://edge.invalid/forge-witness-verify?gameId=1" }, 400, "unexpected_parameters"],
    [{ env: { FORGE_WITNESS_SIGNING_KEY: undefined } }, 503, "configuration_invalid"],
    [{ env: { FORGE_WITNESS_SIGNING_KEY: "bm90LWEta2V5" } }, 503, "configuration_invalid"],
    [{ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } }, 503, "configuration_invalid"],
  ])("refuses %j before any request", async (o, status, body) => {
    const r = await run(o as never);
    expect(r).toMatchObject({ status, body: { status: body } });
    expect(r.calls).toHaveLength(0);
  });

  it("derives the key id from the private key and never exposes it", async () => {
    const signer = await ed25519Signer(real.pkcs8);
    expect(signer.keyId).toBe(witnessKeyId(real.x));
    expect(signer.publicKey).toBe(real.x);
    expect(Object.keys(signer).sort()).toEqual(["keyId", "publicKey", "sign"]);
  });

  it("self-test passes with the released DigiCert pin and catches a broken signer or trust", async () => {
    const signer = await ed25519Signer(real.pkcs8);
    const pinned = trustFromProfile(tsaProfile("digicert-g4-v1"), "capture");
    expect(await witnessSelfTest(pinned, signer)).toEqual({ tsa: true, packet: true, signature: true });
    expect(await witnessSelfTest(pinned, { ...signer, sign: async () => "A".repeat(86) + "==" })).toMatchObject({ signature: false });
    expect(await witnessSelfTest(testTsaTrust(), signer)).toMatchObject({ tsa: false, packet: true });
  });
});
