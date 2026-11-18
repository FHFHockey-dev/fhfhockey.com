// @vitest-environment node
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { PassThrough, Readable } from "node:stream";
import { join } from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import route from "../../../pages/api/v1/db/blsh-request-context";
import { requestContextApprovalBytes } from "./requestContextHandler";
import { prepareNativeProcessCapture } from "../../../scripts/blsh/nativeProcessCapturePreparation";
import { buildRequestFromContextV1, type RequestContextResult } from "./requestContext";

const { factory } = vi.hoisted(() => ({ factory: vi.fn() }));
vi.mock("./requestContextStore", () => ({ createRequestContextStore: factory }));
const D = "2026-11-19", FROM = "2026-10-22", DATE = "2026-11-20", START = DATE + "T12:40:00.000Z", END = DATE + "T12:40:05.000Z";
const nativeRunId = "12345678-1234-4567-8abc-123456789abc", runId = "abcdefab-1234-4567-8abc-123456789abc";
const deploymentId = "dpl_fixture", gitCommitSha = "a".repeat(40);
const hash = (b: Buffer) => createHash("sha256").update(new Uint8Array(b)).digest("hex");
const json = (v: unknown) => Buffer.from(JSON.stringify(v) + "\n");
const sample = readFileSync(join(__dirname, "__fixtures__/request-context-v1.sample.json"));
const parsed = (): RequestContextResult => JSON.parse(sample.toString());
const files = ["DB-CONTEXT.json", "RAW-wgo.json", "RAW-individual.json", "RAW-onIce.json", "RAW-calendar.json", "CURRENT-REQUEST.json", "RESULT.json", "MANIFEST.json"];
const testKeys = generateKeyPairSync("ed25519");
const publicPEM = testKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
let signed: { approval: Parameters<typeof requestContextApprovalBytes>[0]; signature: string } | undefined;
type Edits = (group: string, obs: Record<string, unknown>) => void;
function fixture(edit?: Edits) {
  const groups = ["individual", "onIce"] as const;
  const plan = prepareNativeProcessCapture({ seasonId: 20262027, date: D, plannedAtUTC: START, groups });
  const entries = Array.from({ length: 19 }, () => ({ file: "fixture", bytes: 10, sha256: "b".repeat(64) }));
  const source = { claimedAtUTC: DATE + "T12:04:58.000003+00:00", closedAtUTC: DATE + "T12:06:01.000004+00:00",
    individual: Buffer.alloc(0), onIce: Buffer.alloc(0), manifest: Buffer.alloc(0) };
  for (const [index, group] of groups.entries()) {
    const file = group + ".parser-input.html", bytes = 10, sha256 = "b".repeat(64);
    const retrievedAtUTC = DATE + (index ? "T12:05:45.003Z" : "T12:05:20.001Z");
    const obs = { status: "candidate_requires_adapter_and_source_review", operation: "nst:" + group, file, sha256, bytes, retrievedAtUTC,
      retainedAtUTC: retrievedAtUTC, httpStatus: 200, finalUrl: plan.pages[index].url, redirected: false, TLSVerified: null, tlsEvidence: "pending_runtime_review",
      representation: "client_redacted_parser_input", deploymentBinding: { deploymentId: "dpl_native", gitCommitSha, routeBundleSHA256: "7".repeat(64) },
      parsedRows: 3, completedGameIds: null, originalPublicationUTC: null, modelDefinition: "unknown", independentlyAccepted: false, advancedAdmission: false, score: null };
    edit?.(group, obs);
    const observation = json(obs);
    source[group] = observation;
    entries[index ? 17 : 11] = { file, sha256, bytes };
    entries[index ? 18 : 12] = { file: group + ".TRANSPORT-OBSERVATION.json", sha256: hash(observation), bytes: observation.length };
  }
  source.manifest = json({ state: "packet_complete_pending_review", sourceDate: D, runId: nativeRunId, files: entries, completedAtUTC: DATE + "T12:06:00.981Z" });
  const target = { sourceDate: D, nativeRunId, nativeManifestSHA256: hash(source.manifest) };
  const approve = (override: Record<string, unknown> = {}) => {
    const approval = { ...target, deploymentId, gitCommitSha, ...override };
    signed = { approval, signature: sign(null, requestContextApprovalBytes(approval), testKeys.privateKey).toString("base64") };
    vi.stubEnv("BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY", publicPEM);
  };
  approve();
  const store = { source: vi.fn(async () => source), claim: vi.fn(async () => ({ claimed: true, runId })),
    readContext: vi.fn(async () => { vi.setSystemTime(END); return sample; }),
    putObject: vi.fn(async (_id: string, _d: string, _i: number, _name: string, _b: Buffer, _sha: string) => {}),
    close: vi.fn(async () => {}) };
  factory.mockReturnValue(store);
  return { source, target, approve, store };
}
async function call(params: Partial<NextApiRequest> = {}, stream: Readable = Readable.from([json(signed ?? {})])) {
  const result = { statusCode: 0, body: {} as Record<string, unknown>, setHeader: vi.fn(), status(n: number) { this.statusCode = n; return this; },
    json(value: Record<string, unknown>) { this.body = value; return this; } };
  const request = Object.assign(stream, { method: "POST", query: {}, headers: { authorization: "Bearer fixture-secret", "content-type": "application/json" }, ...params });
  await route(request as unknown as NextApiRequest, result as unknown as NextApiResponse);
  return result;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(START); vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "fixture-secret"); vi.stubEnv("VERCEL_DEPLOYMENT_ID", deploymentId); vi.stubEnv("VERCEL_GIT_COMMIT_SHA", gitCommitSha);
  vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fyhftlxokyjtpndbkfse.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-key");
  vi.stubEnv("BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY", undefined); signed = undefined;
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("the one-date request/context POST", () => {
  it("closes by default and does no I/O for an unapproved, unauthorized, caller-selected or wrongly deployed operation", async () => {
    expect((await call()).body).toEqual({ state: "skipped", reason: "disabled" });
    const f = fixture();
    for (const p of [{ headers: {} }, { headers: { authorization: "Bearer admin-token" } }, { method: "GET" }, { query: { date: D } }, { body: { nativeRunId } }]) {
      expect((await call(p)).body.state).toBe("refused");
    }
    for (const v of [{ deploymentId: "other" }, { gitCommitSha: "2".repeat(40) }, { extra: 1 }, { sourceDate: "2026-11-31" }, { nativeRunId: "../bad" }]) {
      f.approve(v); expect((await call()).body.reason).toBe("approval_invalid");
    }
    f.approve({ sourceDate: "2026-11-18" }); expect((await call()).body.reason).toBe("outside_approved_date");
    f.approve();
    for (const [k, v] of [["VERCEL_ENV", "preview"], ["NEXT_PUBLIC_SUPABASE_URL", "https://other.invalid"], ["SUPABASE_SERVICE_ROLE_KEY", ""]]) {
      const previous = process.env[k]; vi.stubEnv(k, v); expect((await call()).body.reason).toBe("environment_mismatch"); vi.stubEnv(k, previous);
    }
    vi.stubEnv("CRON_SECRET", ""); expect((await call({ headers: { authorization: "Bearer " } })).statusCode).toBe(403);
    expect(factory).not.toHaveBeenCalled();
  });

  it("accepts a detached Ed25519 signature over the independently encoded ordered fields, regardless of object member order", async () => {
    const { target } = fixture();
    const encoded = Buffer.from(JSON.stringify(["fhfh.blsh.request-context-approval.v1", D, nativeRunId, target.nativeManifestSHA256, deploymentId, gitCommitSha]));
    expect(Buffer.from(requestContextApprovalBytes(signed!.approval))).toEqual(encoded);
    const signature = sign(null, new Uint8Array(encoded), testKeys.privateKey).toString("base64");
    const approval = { gitCommitSha, deploymentId, nativeManifestSHA256: target.nativeManifestSHA256, nativeRunId, sourceDate: D };
    expect((await call({}, Readable.from([json({ signature, approval })]))).body.state).toBe("packet_complete_pending_review");
  });

  it("refuses unsigned, extra, incorrectly signed or noncanonical grants and rejects private or non-Ed25519 verification keys", async () => {
    fixture();
    const { approval, signature } = signed!;
    const other = generateKeyPairSync("ed25519");
    for (const grant of [approval, {approval}, {approval,signature,extra:true}, {approval,signature:signature.slice(0,-2)},
      {approval,signature:sign(null,requestContextApprovalBytes(approval),other.privateKey).toString("base64")},
      {approval,signature:sign(null,new Uint8Array(json(approval)),testKeys.privateKey).toString("base64")},
      {approval:{...approval,nativeManifestSHA256:"0".repeat(64)},signature},
      {approval:{...approval,nativeRunId:runId},signature}]) {
      expect((await call({}, Readable.from([json(grant)]))).body.reason).toBe("approval_invalid");
    }
    for (const invalid of [testKeys.privateKey.export({type:"pkcs8",format:"pem"}).toString(),
      generateKeyPairSync("ec",{namedCurve:"prime256v1"}).publicKey.export({type:"spki",format:"pem"}).toString()]) {
      vi.stubEnv("BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY",invalid);
      expect((await call()).body.reason).toBe("approval_public_key_invalid");
    }
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects duplicate JSON keys, malformed UTF-8, oversized and truncated streams, and unsigned query parameters", async () => {
    fixture();
    const good = JSON.stringify(signed);
    for (const raw of [Buffer.from(good.replace('"signature":','"signature":"ignored","signature":')),
      Buffer.from(good.replace('"sourceDate":','"sourceDate":"ignored","sourceDate":')), Buffer.from([255]), Buffer.alloc(1025,32)]) {
      expect((await call({},Readable.from([raw]))).body.reason).toBe("approval_invalid");
    }
    const headers = {authorization:"Bearer fixture-secret","content-type":"application/json","content-length":String(Buffer.byteLength(good)+1)};
    expect((await call({headers},Readable.from([Buffer.from(good)]))).body.reason).toBe("approval_invalid");
    expect((await call({headers:{...headers,"content-type":"text/plain"}})).body.reason).toBe("approval_invalid");
    expect((await call({query:{sourceDate:D}})).body.reason).toBe("unexpected_parameters");
    expect(factory).not.toHaveBeenCalled();
  });

  it("refuses an aborted or stalled body within the absolute five-second ingress budget", async () => {
    fixture();
    const aborted = new PassThrough(), result = call({},aborted);
    aborted.write("{"); aborted.emit("aborted");
    expect((await result).body.reason).toBe("approval_invalid"); aborted.destroy();
    vi.useRealTimers(); vi.useFakeTimers({toFake:["setTimeout","clearTimeout"]});
    const slow = new PassThrough(), pending = call({},slow);
    slow.write("{"); await vi.advanceTimersByTimeAsync(4999); slow.write(" ");
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).body.reason).toBe("approval_invalid"); slow.destroy();
    expect(factory).not.toHaveBeenCalled();
  });

  it("saves the original accented and formatted response bytes, four exact RAW files and the actual reader projection, then closes the pinned manifest", async () => {
    const { target, store } = fixture();
    const result = await call(), writes = store.putObject.mock.calls;
    expect(result.statusCode).toBe(200); expect(result.body).toMatchObject({ state: "packet_complete_pending_review", sourceDate: D, runId });
    expect(store.source).toHaveBeenCalledExactlyOnceWith(target); expect(store.claim).toHaveBeenCalledExactlyOnceWith(target);
    expect(store.readContext).toHaveBeenCalledExactlyOnceWith(FROM, D);
    expect(writes.map(w => w[3])).toEqual(files);
    expect(writes[0][4]).toEqual(sample);
    const built = buildRequestFromContextV1(parsed(), { capturedAtUTC: END });
    for (let i = 1; i <= 4; i++) expect(writes[i][4]).toEqual(built.rawFiles[files[i]]);
    expect(writes[5][4]).toEqual(json(built.request));
    const descriptors = writes.map(([contextId, date, ordinal, file, b, sha256], i) => {
      expect([contextId, date, ordinal, sha256]).toEqual([runId, D, i + 1, hash(b)]);
      return { file, bytes: b.length, sha256 };
    });
    expect(JSON.parse(writes[6][4].toString())).toMatchObject({ ...target, runId, requestDeployment: { deploymentId, gitCommitSha },
      sessionClosed: true, atomicDatabaseSnapshot: true, executionMode: "definer_function_request_context_v1",
      rows: built.rows, snapshotUTC: parsed().snapshotUTC, statementUTC: parsed().statementUTC, asOfUTC: END,
      nativeRetrievedAtUTC: { individual: DATE + "T12:05:20.001Z", onIce: DATE + "T12:05:45.003Z" },
      artifacts: Object.fromEntries(descriptors.slice(0, 6).map(d => [d.file, d.sha256])) });
    expect(JSON.parse(writes[7][4].toString())).toEqual({ version: "fhfh.blsh.request-context-manifest.v1", ...target, runId, files: descriptors.slice(0, 7) });
    expect(store.close).toHaveBeenCalledExactlyOnceWith(runId, "packet_complete_pending_review", null, writes[7][5], writes[7][4]);
    expect(store.close.mock.invocationCallOrder[0]).toBeGreaterThan(store.putObject.mock.invocationCallOrder[7]);
    expect(Object.keys(result.body).sort()).toEqual(["manifestSHA256", "runId", "sourceDate", "state"]);
  });

  it.each<[string, Edits]>([
    ["wrong-date URL", (g, o) => { if (g === "individual") o.finalUrl = String(o.finalUrl).replaceAll(D, FROM); }],
    ["group swap", (g, o) => { if (g === "individual") o.operation = "nst:onIce"; }],
    ["possible promotion", (_g, o) => { o.independentlyAccepted = true; }],
    ["inconsistent source body", (_g, o) => { o.sha256 = "0".repeat(64); }],
    ["future original observation", (g, o) => { if (g === "onIce") o.retrievedAtUTC = END; }],
    ["reversed groups", (g, o) => { if (g === "onIce") o.retrievedAtUTC = DATE + "T12:05:20.000999Z"; }],
    ["missing source clock", (_g, o) => { delete o.retrievedAtUTC; }],
    ["disagreeing native deployments", (g, o) => { if (g === "onIce") (o.deploymentBinding as { gitCommitSha: string }).gitCommitSha = "0".repeat(40); }],
  ])("withholds %s before claiming", async (_name, edit) => {
    const f = fixture(edit); expect((await call()).body.reason).toBe("native_source_unverified"); expect(f.store.claim).not.toHaveBeenCalled();
  });

  it("rejects the wrong manifest, late native closure or source read error without consuming D", async () => {
    const f = fixture();
    f.approve({ nativeManifestSHA256: "d".repeat(64) }); expect((await call()).body.reason).toBe("native_source_unverified");
    f.approve(); f.source.closedAtUTC = END; expect((await call()).body.reason).toBe("native_source_unverified");
    f.store.source.mockRejectedValueOnce(new Error("private-db-response")); expect((await call()).body).toEqual({ state: "refused", reason: "native_source_unverified" });
    expect(f.store.claim).not.toHaveBeenCalled();
  });

  it("distinguishes a consumed date from a lost claim acknowledgement", async () => {
    const f = fixture(); f.store.claim.mockResolvedValueOnce({ claimed: false, runId });
    expect((await call()).body).toEqual({ state: "skipped", reason: "already_claimed", ...f.target });
    f.store.claim.mockRejectedValueOnce(new Error("secret")); expect((await call()).body).toEqual({ state: "uncertain", reason: "claim_unacknowledged", ...f.target });
    expect(f.store.readContext).not.toHaveBeenCalled(); expect(f.store.close).not.toHaveBeenCalled();
  });

  it("reserves enough bounded transport time before consuming D and before starting each write", async () => {
    const f = fixture();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    f.store.source.mockImplementationOnce(async () => { elapsed = 50000; return f.source; });
    expect((await call()).body.reason).toBe("context_budget_exhausted"); expect(f.store.claim).not.toHaveBeenCalled();
    elapsed = 0;
    f.store.putObject.mockImplementationOnce(async () => { elapsed = 203000; });
    expect((await call()).body).toMatchObject({ state: "failed", reason: "context_budget_exhausted" });
    expect(f.store.putObject).toHaveBeenCalledTimes(1); expect(f.store.close).toHaveBeenCalledExactlyOnceWith(runId, "failed", "context_budget_exhausted", null, null);
  });

  it.each<[string, (db: RequestContextResult) => Buffer | void]>([
    ["D minus 27", db => { db.dateFrom = "2026-10-23"; }],
    ["wrong event date", db => { db.eventThroughDate = FROM; }],
    ["snapshot before the later observation", db => { db.snapshotUTC = DATE + "T12:05:45.002999+00:00"; }],
    ["snapshot before the actual RPC", db => { db.snapshotUTC = DATE + "T12:39:59.999999+00:00"; }],
    ["statement before snapshot", db => { db.snapshotUTC = DATE + "T12:40:00.000001+00:00"; }],
    ["capture before statement", db => { db.statementUTC = DATE + "T12:40:05.000001+00:00"; }],
    ["changed column contract", db => { db.columnsSHA256 = ""; }],
    ["ambiguous source JSON", () => Buffer.from('{"rows":[],"rows":[]}')],
    ["over 8 MiB", () => Buffer.alloc(8 * 1024 * 1024 + 1)],
  ])("seals a failure without partial artifacts for %s", async (_label, edit) => {
    const f = fixture(); f.store.readContext.mockImplementationOnce(async () => { const db = parsed(); vi.setSystemTime(END); return edit(db) ?? json(db); });
    expect((await call()).body).toMatchObject({ state: "failed", reason: "context_evidence_invalid" });
    expect(f.store.readContext).toHaveBeenCalledTimes(1); expect(f.store.putObject).not.toHaveBeenCalled();
    expect(f.store.close).toHaveBeenCalledExactlyOnceWith(runId, "failed", "context_evidence_invalid", null, null);
  });

  it("uses the earliest native retrieval for the 12-hour limit even if the read finishes later than ingress", async () => {
    const f = fixture(); vi.setSystemTime(DATE + "T23:59:59.000Z");
    f.store.readContext.mockImplementationOnce(async () => { const db = parsed(); db.snapshotUTC = db.statementUTC = DATE + "T23:59:59.000123+00:00";
      vi.setSystemTime("2026-11-21T00:05:20.002Z"); return json(db); });
    expect((await call()).body.reason).toBe("context_evidence_invalid");
    expect(f.store.putObject).not.toHaveBeenCalled();
  });

  it("never retries the data RPC, reports partial storage failure and preserves an unacknowledged terminal transition", async () => {
    const f = fixture(); f.store.readContext.mockRejectedValueOnce(new Error("private-response"));
    const failed = await call(); expect(failed.body.reason).toBe("context_read_failed"); expect(f.store.readContext).toHaveBeenCalledTimes(1);
    expect(f.store.putObject).not.toHaveBeenCalled(); expect(JSON.stringify(failed.body)).not.toContain("private-response");
    f.store.putObject.mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error("private-write-body"));
    expect((await call()).body.reason).toBe("context_write_unacknowledged"); expect(f.store.putObject).toHaveBeenCalledTimes(2);
    expect(f.store.close).toHaveBeenLastCalledWith(runId, "failed", "context_write_unacknowledged", null, null);
    vi.setSystemTime(START); f.store.putObject.mockClear(); f.store.close.mockClear().mockRejectedValueOnce(new Error("lost reply"));
    expect((await call()).body).toMatchObject({ state: "uncertain", reason: "completion_close_unacknowledged" });
    expect(f.store.putObject).toHaveBeenCalledTimes(8); expect(f.store.close).toHaveBeenCalledTimes(1);
    f.store.readContext.mockRejectedValueOnce(new Error("private")); f.store.close.mockRejectedValueOnce(new Error("unknown"));
    expect((await call()).body).toMatchObject({ state: "uncertain", reason: "failure_close_unacknowledged" });
  });
});
