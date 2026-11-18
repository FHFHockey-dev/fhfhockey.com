/** Exercise the hosted handler with in-process keys, numeric loopback TLS and a local SQL-shaped ledger. */
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import type { NextApiRequest, NextApiResponse } from "next";
import { vi } from "vitest";
import { OFFICIAL_ORIGIN, pilotDigest } from "./officialPilotAcquisition";
import { officialPilotApprovalBytes, officialPilotHandler } from "./officialPilotHandler";
import type { OfficialPilotTarget } from "./officialPilotStore";
import { RUNTIME_OVERRIDE_KEYS } from "./runtimeReceipt";

export const pilotSlot = Date.parse("2026-11-21T12:45:02Z");
export const fixtureDeployment = { deploymentId: "dpl_official_fixture", gitCommitSha: "a".repeat(40) };
const runId = "77777777-7777-4777-8777-777777777777";
export function signedOfficialGrant(approval: OfficialPilotTarget) {
  const key = generateKeyPairSync("ed25519");
  const signature = sign(null, officialPilotApprovalBytes(approval), key.privateKey).toString("base64");
  const bytes = Buffer.from(JSON.stringify({ approval, signature }), "utf8");
  return { header: bytes.toString("base64"), approvalPublicKey: key.publicKey.export({ type: "spki", format: "pem" }).toString(), acquisitionPinsSHA256: pilotDigest(bytes) };
}
export function setOfficialFixtureEnv(approvalPublicKey: string, deployment = fixtureDeployment) {
  for (const key of RUNTIME_OVERRIDE_KEYS) vi.stubEnv(key, undefined);
  for (const [k, v] of Object.entries({ BLSH_OFFICIAL_PILOT_APPROVAL_PUBLIC_KEY: approvalPublicKey, NEXT_PUBLIC_SUPABASE_URL: OFFICIAL_ORIGIN, CRON_SECRET: "fixture-cron",
    VERCEL_ENV: "production", VERCEL_REGION: "iad1", VERCEL_DEPLOYMENT_ID: deployment.deploymentId, VERCEL_GIT_COMMIT_SHA: deployment.gitCommitSha,
    SUPABASE_SERVICE_ROLE_KEY: "fixture-only" })) vi.stubEnv(k, v);
}
export async function fakeOfficialInvocation(handler: ReturnType<typeof officialPilotHandler>, header: string, overrides: Partial<NextApiRequest> = {}) {
  const res = { code: 0, value: {} as Record<string, unknown>, setHeader() {}, status(n: number) { this.code = n; return this; }, json(v: Record<string, unknown>) { this.value = v; } };
  await handler({ method: "GET", headers: { authorization: "Bearer fixture-cron", "x-blsh-official-grant": header }, query: {}, ...overrides } as NextApiRequest, res as unknown as NextApiResponse);
  return res;
}
export async function exportHostedOfficialFixture(args: { outDir: string; nativeRunId: string; nativeManifestSHA256: string; scheduleSHA256: string;
  boxes: Record<string, unknown>[]; deploymentId?: string; gitCommitSha?: string; afterJournal?: (operation: number) => void }) {
  const { outDir, nativeRunId, nativeManifestSHA256, scheduleSHA256 } = args;
  const gameIds = args.boxes.map(b => Number(b.id));
  const deployment = { deploymentId: args.deploymentId ?? fixtureDeployment.deploymentId, gitCommitSha: args.gitCommitSha ?? fixtureDeployment.gitCommitSha };
  const approval = { ...deployment, nativeRunId, nativeManifestSHA256, scheduleSHA256, sourceDate: "2026-11-20", gameIds };
  const grant = signedOfficialGrant(approval);
  mkdirSync(outDir, { recursive: true });
  const keys = mkdtempSync(join(tmpdir(), "official-pilot-ephemeral-"));
  const openssl = (...argv: string[]) => execFileSync("openssl", argv, { cwd: keys, stdio: "ignore" });
  let ca = "", socketKey: Buffer;
  try {
    writeFileSync(join(keys,"ca.cnf"), "[ca]\ndefault_ca=fixture\n[fixture]\ndatabase=index\nserial=serial\nnew_certs_dir=.\ndefault_md=sha256\npolicy=policy\nx509_extensions=ext\n[policy]\ncommonName=supplied\n[ext]\nbasicConstraints=critical,CA:true\nsubjectAltName=DNS:api-web.nhle.com\n");
    writeFileSync(join(keys,"index"), ""); writeFileSync(join(keys,"serial"), "01\n");
    openssl("req","-new","-newkey","rsa:2048","-nodes","-subj","/CN=api-web.nhle.com","-keyout","fixture.key","-out","fixture.csr");
    openssl("ca","-batch","-selfsign","-config","ca.cnf","-keyfile","fixture.key","-in","fixture.csr","-out","fixture.crt","-notext","-startdate","20200101000000Z","-enddate","20990101000000Z");
    ca = readFileSync(join(keys,"fixture.crt"),"utf8"); socketKey = readFileSync(join(keys,"fixture.key"));
  } finally { rmSync(keys, { recursive: true, force: true }); }
  const events: string[] = [], bodies: Record<string, Buffer> = {};
  for (const box of args.boxes) bodies[String(box.id)] = Buffer.from(JSON.stringify(box, null, 2) + "\r\n");
  const server = createServer({ cert: ca, key: socketKey }, (req, res) => {
    events.push(req.method + " " + req.url);
    const match = /^\/v1\/gamecenter\/(202602\d{4})\/boxscore$/.exec(req.url ?? "");
    if (req.method !== "GET" || req.headers.host !== "api-web.nhle.com" || !match || !bodies[match[1]]) { res.writeHead(404); res.end(); return; }
    res.end(bodies[match[1]]);
  });
  const at = () => new Date(Date.now()).toISOString();
  let claimed = false;
  const rows: Record<string, unknown>[] = [], run: Record<string, unknown> = { run_id: runId, source_date: approval.sourceDate,
    native_run_id: nativeRunId, native_manifest_sha256: nativeManifestSHA256, deployment_id: approval.deploymentId, git_commit_sha: approval.gitCommitSha,
    schedule_sha256: scheduleSHA256, game_ids: gameIds };
  const fileRoot = join(outDir, "objects", "official-v1", approval.sourceDate, runId);
  const { createOfficialPilotStore } = await vi.importActual<typeof import("./officialPilotStore")>("./officialPilotStore");
  const store = createOfficialPilotStore({ serviceKey: "fixture-only", transport: async request => {
    const prefix = OFFICIAL_ORIGIN + "/rest/v1/rpc/", body = JSON.parse(request.body!.toString("utf8"));
    if (request.method !== "POST" || !request.url.startsWith(prefix) || !(request.timeoutMs > 0 && request.timeoutMs <= 5000)) throw new Error("fixture_transport_scope");
    const rpc = request.url.slice(prefix.length);
    if (rpc === "blsh_official_claim_v1") {
      events.push("claim");
      if (claimed) return Buffer.from('{"claimed":false}');
      if (body.p_native_run_id !== nativeRunId || body.p_native_manifest_sha256 !== nativeManifestSHA256 || body.p_schedule_sha256 !== scheduleSHA256
        || body.p_deployment_id !== deployment.deploymentId || body.p_git_commit_sha !== deployment.gitCommitSha || body.p_source_date !== approval.sourceDate
        || JSON.stringify(body.p_game_ids) !== JSON.stringify(gameIds)) throw new Error("fixture_claim_binding");
      claimed = true; run.claimed_at = at(); return Buffer.from(JSON.stringify({ claimed: true, runId }));
    }
    if (!claimed || body.p_run_id !== runId) throw new Error("fixture_ledger_binding");
    if (rpc === "blsh_official_object_v1") {
      const ordinal = body.p_ordinal, bytes = Buffer.from(body.p_body_base64, "base64"), path = body.p_path, file = path.split("/").at(-1);
      if (path !== "official-v1/" + approval.sourceDate + "/" + runId + "/" + file || ordinal !== rows.length + 1 || body.p_bytes !== bytes.length
        || pilotDigest(bytes) !== body.p_sha256) throw new Error("fixture_ledger_binding");
      const journal = /^operation-(\d+)-STARTED\.json$/.exec(file), operation = journal ? Number(journal[1]) : null;
      const out = join(outDir, "objects", path);
      mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, new Uint8Array(bytes), { flag: "wx" });
      rows.push({ run_id: runId, ordinal, path, sha256: body.p_sha256, bytes: bytes.length, written_at: at(), game_ordinal: operation,
        game_id: operation === null ? null : gameIds[operation - 1], intent_url: operation === null ? null : JSON.parse(bytes.toString()).url });
      events.push(file); if (operation !== null) args.afterJournal?.(operation);
    } else if (rpc === "blsh_official_close_v1") {
      if (body.p_manifest_text !== null && pilotDigest(Buffer.from(body.p_manifest_text)) !== body.p_manifest_sha256) throw new Error("fixture_terminal_binding");
      Object.assign(run, { state: body.p_state, reason: body.p_reason, manifest_sha256: body.p_manifest_sha256, closed_at: at() }); events.push(body.p_state);
      writeFileSync(join(outDir, "run.json"), JSON.stringify(run)); writeFileSync(join(outDir, "objects.json"), JSON.stringify(rows));
    } else throw new Error("fixture_unknown_rpc");
    return Buffer.from("true");
  }});
  const argv = process.execArgv;
  setOfficialFixtureEnv(grant.approvalPublicKey, deployment); process.execArgv = [];
  const t0 = performance.now(), clock = vi.spyOn(Date,"now").mockImplementation(() => pilotSlot + Math.floor(performance.now() - t0));
  const routePath = join(__dirname, "../../../pages/api/v1/db/blsh-official-boxscores.ts");
  try {
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("fixture_port");
    const handler = officialPilotHandler(routePath, { socket: { ca, port: addr.port }, store });
    const result = await fakeOfficialInvocation(handler, grant.header);
    const runtime = JSON.parse(readFileSync(join(fileRoot, "RUNTIME.json"), "utf8"));
    return { outDir, result: result.value, events, bodies, run, rows, fileRoot, acquisitionPinsSHA256: grant.acquisitionPinsSHA256,
      acquisitionManifestSHA256: String(result.value.manifestSHA256 ?? ""), evidenceAsOfUTC: at(), hostedOfficial: { ...deployment,
        runId, approvalPublicKey: grant.approvalPublicKey, runtime: { region: "iad1", nodeVersion: process.version, nodeABI: process.versions.modules,
          opensslVersion: process.versions.openssl, routeBundleSHA256: createHash("sha256").update(new Uint8Array(readFileSync(routePath))).digest("hex"),
          execPathSHA256: createHash("sha256").update(new Uint8Array(readFileSync(process.execPath))).digest("hex"),
          bundledCASHA256: createHash("sha256").update(ca).digest("hex"), defaultCASHA256: runtime.defaultCASHA256 } } };
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); clock.mockRestore(); process.execArgv = argv; vi.unstubAllEnvs();
  }
}
