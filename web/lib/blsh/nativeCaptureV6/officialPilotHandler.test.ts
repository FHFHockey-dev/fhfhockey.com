// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import route, { config } from "../../../pages/api/v1/db/blsh-official-boxscores";
import { exportHostedOfficialFixture, fakeOfficialInvocation, fixtureDeployment, pilotSlot, setOfficialFixtureEnv, signedOfficialGrant } from "./officialPilotHandler.testHelper";
import { officialPilotHandler } from "./officialPilotHandler";
import type { OfficialPilotStore } from "./officialPilotStore";

const { factory } = vi.hoisted(() => ({ factory: vi.fn(() => { throw new Error("external_store_forbidden"); }) }));
vi.mock("./officialPilotStore", () => ({ createOfficialPilotStore: factory }));
const target = { ...fixtureDeployment, sourceDate: "2026-11-21", nativeRunId: "00000000-0000-4000-8000-000000000001",
  nativeManifestSHA256: "b".repeat(64), scheduleSHA256: "c".repeat(64), gameIds: [2026020001, 2026020002] };
const boxes = target.gameIds.map(id => ({ id, gameDate: target.sourceDate, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK" }));
const dirs: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), "official-hosted-handler-")); dirs.push(dir); return dir; };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.clearAllMocks(); while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
describe("one approved hosted official GET", () => {
  it("does no external I/O for missing key, wrong slot, unsigned identity, ambiguous grant, wrong project, or caller parameters", async () => {
    const grant = signedOfficialGrant(target); setOfficialFixtureEnv(grant.approvalPublicKey);
    expect(config).toEqual({ maxDuration: 240, api: { bodyParser: false } });
    const clock = vi.spyOn(Date, "now").mockReturnValue(pilotSlot);
    expect((await fakeOfficialInvocation(route, grant.header, { method: "POST" })).code).toBe(405);
    expect((await fakeOfficialInvocation(route, grant.header, { headers: { authorization: "Bearer adminkey" } })).code).toBe(403);
    for (const req of [{ query: { gameIds: "1" } }, { body: {} }, { headers: { authorization: "Bearer fixture-cron", "transfer-encoding": "chunked" } }]) {
      expect((await fakeOfficialInvocation(route, grant.header, req)).code).toBe(400);
    }
    vi.stubEnv("BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY", ""); expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("disabled");
    vi.stubEnv("BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY", grant.approvalPublicKey);
    for (const time of [Date.parse("2026-11-22T12:44:59.999Z"),Date.parse("2026-11-22T12:46:00Z"),pilotSlot+86400000,
      Date.parse("2026-11-21T12:45:02Z") /* retired 2026-11-21 slot */]) {
      clock.mockReturnValue(time); expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("outside_official_slot");
    }
    clock.mockReturnValue(pilotSlot);
    const original = Buffer.from(grant.header, "base64").toString("utf8"), other = generateKeyPairSync("ed25519").publicKey.export({ format: "pem", type: "spki" }).toString();
    for (const invalid of [original.replace(target.nativeManifestSHA256,"d".repeat(64)), original.replace('"gameIds":','"gameIds":[],"gameIds":'), '{"approval":{}}']) {
      expect((await fakeOfficialInvocation(route, Buffer.from(invalid).toString("base64"))).value.reason).toBe("approval_invalid");
    }
    vi.stubEnv("BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY", other); expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("approval_invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://other.invalid"); expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("environment_mismatch");
    expect(factory).not.toHaveBeenCalled();
  });
  it("rejects a signed out-of-scope game/date/deployment and a TLS override before a claim", async () => {
    vi.spyOn(Date,"now").mockReturnValue(pilotSlot);
    for (const change of [{ sourceDate:"2026-11-19" }, { sourceDate:"2026-11-20" /* retired slate */ }, { sourceDate:"2026-11-22" }, { gameIds:[] }, { gameIds:[target.gameIds[0],target.gameIds[0]] },
      { gameIds:[...target.gameIds].reverse() }, { gameIds:[2025020003] }, { gitCommitSha:"0".repeat(40) }]) {
      const grant = signedOfficialGrant({ ...target, ...change }); setOfficialFixtureEnv(grant.approvalPublicKey);
      expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("approval_invalid");
    }
    const grant = signedOfficialGrant(target); setOfficialFixtureEnv(grant.approvalPublicKey); vi.stubEnv("NODE_EXTRA_CA_CERTS", "unused");
    expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("official_runtime_unverified"); expect(factory).not.toHaveBeenCalled();
    for (const [k,v] of [["VERCEL_REGION","sfo1"],["VERCEL_PROJECT_ID","other-project"]]) {
      setOfficialFixtureEnv(grant.approvalPublicKey); vi.stubEnv(k,v);
      expect((await fakeOfficialInvocation(route, grant.header)).value.reason).toBe("official_runtime_unverified"); expect(factory).not.toHaveBeenCalled();
      vi.stubEnv(k,undefined);
    }
  });
  it("binds exact private custody and signature to original boxscore bytes and per-game TLS v2 receipt, serially", async () => {
    const f = await exportHostedOfficialFixture({ ...target, outDir: temp(), boxes });
    expect(f.result).toMatchObject({ state:"packet_complete_pending_review", requests:2,manifestSHA256:f.acquisitionManifestSHA256 });
    expect(f.events).toEqual(["claim","RUNTIME.json", ...target.gameIds.flatMap((id,i)=>[`operation-${i+1}-STARTED.json`,`GET /v1/gamecenter/${id}/boxscore`,`boxscore-${id}.body.json`,`boxscore-${id}.receipt.json`]),"MANIFEST.json","packet_complete_pending_review"]);
    const runtime = JSON.parse(readFileSync(join(f.fileRoot,"RUNTIME.json"),"utf8"));
    expect(runtime).toMatchObject({ acquisitionClass:"loopback_fixture_only", ...target, overrideKeysPresent:[], acquisitionPinsSHA256:f.acquisitionPinsSHA256 });
    const times = [];
    for (const [i,id] of target.gameIds.entries()) {
      expect(readFileSync(join(f.fileRoot,`boxscore-${id}.body.json`))).toEqual(f.bodies[id]);
      const receipt = JSON.parse(readFileSync(join(f.fileRoot,`boxscore-${id}.receipt.json`),"utf8"));
      expect(receipt).toMatchObject({ version:"fhfh.blsh.v6-official-boxscore-receipt.v2", operation:i+1, writeEvents:1, httpStatus:200, redirected:false,
        tls:{servername:"api-web.nhle.com",authorized:true,sessionReused:false,connectionReused:false}, acquisitionPinsSHA256:f.acquisitionPinsSHA256 });
      expect(Date.parse(receipt.dispatchedAtUTC)).toBeLessThanOrEqual(Date.parse(receipt.retrievedAtUTC)); times.push(receipt);
    }
    expect(Date.parse(times[1].dispatchedAtUTC)-Date.parse(times[0].retrievedAtUTC)).toBeGreaterThanOrEqual(1000);
  });
  it("issues no provider GET after an unacknowledged durable journal", async () => {
    const f = await exportHostedOfficialFixture({ ...target, outDir:temp(), boxes, afterJournal: () => { throw new Error("lost journal acknowledgement"); } });
    expect(f.result).toMatchObject({ state:"failed" }); expect(f.events).toEqual(["claim","RUNTIME.json","operation-1-STARTED.json","failed"]);
    expect(existsSync(join(f.fileRoot,"MANIFEST.json"))).toBe(false);
  });
  it("reports a refused repeat and uncertain claim or terminal writes without dispatching", async () => {
    vi.spyOn(Date, "now").mockReturnValue(pilotSlot);
    const grant = signedOfficialGrant(target); setOfficialFixtureEnv(grant.approvalPublicKey); const old = process.execArgv; process.execArgv=[];
    const store = { claim:vi.fn<OfficialPilotStore["claim"]>(), putObject: vi.fn<OfficialPilotStore["putObject"]>().mockRejectedValue(new Error("lost write")),
      close:vi.fn<OfficialPilotStore["close"]>().mockRejectedValue(new Error("lost close")) };
    const handler=officialPilotHandler(__filename,{store,socket:{port:1,ca:"unused"}});
    try {
      store.claim.mockResolvedValueOnce({claimed:false}).mockRejectedValueOnce(new Error("unknown")).mockResolvedValueOnce({claimed:true,runId:"fixture"});
      expect((await fakeOfficialInvocation(handler, grant.header)).value.reason).toBe("already_claimed");
      expect((await fakeOfficialInvocation(handler, grant.header)).value.reason).toBe("claim_unacknowledged");
      expect((await fakeOfficialInvocation(handler, grant.header)).value.reason).toBe("failure_close_unacknowledged");
      expect(store.putObject).toHaveBeenCalledTimes(1); expect(store.close).toHaveBeenCalledTimes(1);
    } finally {process.execArgv=old;}
  });
  it.each([["journal",15001],["RUNTIME.json",120001],["RUNTIME.json",225001]] as const)("stops at a late %s acknowledgement after %i ms", async (stage, elapsed) => {
    let time = pilotSlot;
    vi.spyOn(Date,"now").mockImplementation(() => time);
    const grant = signedOfficialGrant(target); setOfficialFixtureEnv(grant.approvalPublicKey);
    const old = process.execArgv; process.execArgv = [];
    const store = { claim: vi.fn<OfficialPilotStore["claim"]>().mockResolvedValue({claimed:true,runId:"fixture"}),
      putObject:vi.fn<OfficialPilotStore["putObject"]>().mockImplementation(async (_run,_day,_n,file,_bytes,_sha,remaining) => {
        expect(remaining!()).toBeGreaterThan(0);
        if (file === stage || (stage === "journal" && file === "operation-1-STARTED.json")) {
          if (stage === "journal") expect(remaining!()).toBeLessThanOrEqual(15000);
          time += elapsed;
          expect(remaining!()).toBeLessThanOrEqual(0);
        }
      }), close:vi.fn<OfficialPilotStore["close"]>().mockResolvedValue() };
    try {
      const res = await fakeOfficialInvocation(officialPilotHandler(__filename,{store,socket:{port:1,ca:"unused"}}),grant.header);
      expect(res.value).toMatchObject({state:elapsed>225000?"uncertain":"failed",nativeRunId:target.nativeRunId,nativeManifestSHA256:target.nativeManifestSHA256});
      expect(store.putObject.mock.calls.map(c=>c[3])).toEqual(stage==="journal"?["RUNTIME.json","operation-1-STARTED.json"]:["RUNTIME.json"]);
      expect(store.close).toHaveBeenCalledTimes(elapsed>225000?0:1);
    } finally { process.execArgv=old; }
  });
});
