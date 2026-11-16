/* Offline operator-path rehearsal for the BLSH native capture runner.
 * Synthetic adapter ONLY. The real adapter factory, NST client, ledger, admission and
 * lifecycle modules are never imported. Sockets, TLS, DNS and fetch are blocked and counted.
 * Run from web/: node --require ./node_modules/ts-node/register/transpile-only <this> <scenario> <outDir>
 * A shifted clock (REHEARSAL_CLOCK) is a rehearsal seam only; source files are not modified.
 */
// require() (not import *) so patches hit the same module objects the runner uses.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs") as typeof import("node:fs");
const net = require("node:net") as typeof import("node:net");
const tls = require("node:tls") as typeof import("node:tls");
const dns = require("node:dns") as typeof import("node:dns");
import { createHash } from "node:crypto";
import { resolve } from "node:path";

let networkAttempts = 0;
const forbid = (what: string) => () => { networkAttempts++; throw new Error(`network forbidden: ${what}`); };
(net.Socket.prototype as unknown as { connect: unknown }).connect = forbid("socket");
(tls as unknown as { connect: unknown }).connect = forbid("tls");
(dns as unknown as { lookup: unknown }).lookup = forbid("dns");
(globalThis as unknown as { fetch: unknown }).fetch = forbid("fetch");

const RealDate = Date;
if (process.env.REHEARSAL_CLOCK) {
  const offset = RealDate.parse(process.env.REHEARSAL_CLOCK) - RealDate.now();
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) { if (args.length === 0) super(RealDate.now() + offset); else super(...(args as [string])); }
    static now() { return RealDate.now() + offset; }
  }
  (globalThis as unknown as { Date: unknown }).Date = ShiftedDate;
}

const WEB = process.env.REHEARSAL_WEB ?? resolve(process.cwd());
// eslint-disable-next-line @typescript-eslint/no-require-imports
const prep = require(resolve(WEB, "scripts/blsh/nativeProcessCapturePreparation.ts"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runner = require(resolve(WEB, "scripts/blsh/nativeProcessCaptureRunner.ts"));

const [scenario, outDir] = process.argv.slice(2);
const DATE = process.env.REHEARSAL_DATE ?? fail("REHEARSAL_DATE required"); // successor: 2026-11-11 (verified slate)
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
function fail(message: string): never { throw new Error(message); }
const sha = (b: Buffer) => createHash("sha256").update(new Uint8Array(b)).digest("hex");
const roles: Record<string, string> = {
  runner: "scripts/blsh/nativeProcessCaptureRunner.ts", preparation: "scripts/blsh/nativeProcessCapturePreparation.ts",
  client: "lib/nst/client.ts", budget: "lib/nst/requestBudget.ts", admission: "lib/nst/sharedAdmission.ts",
  admissionOrigin: "lib/nst/admissionOrigin.ts", lifecycle: "lib/nst/jobLifecycle.server.ts", ratePolicy: "lib/cron/nstRateLimitPolicy.ts",
};

// Six synthetic games shaped like the verified 2026-11-11 slate (ids 2026020293-298, 12 distinct teams).
// Synthetic team ids; abbreviations follow the slate evidence. Not provider data.
const PAIRS = [["TBL", "BUF"], ["NYR", "CGY"], ["PHI", "EDM"], ["UTA", "VGK"], ["NSH", "ANA"], ["PIT", "SJS"]];
const slate = (firstOver: Record<string, unknown> = {}) => PAIRS.map(([home, away], i) => ({ id: 2026020293 + i, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
  homeTeam: { id: 2 * i + 1, abbrev: home }, awayTeam: { id: 2 * i + 2, abbrev: away }, ...(i === 0 ? firstOver : {}) }));
const rows = (n: number) => Array.from({ length: n }, (_, i) => `<tr><td>${i + 1}</td><td>Synthetic Skater ${i + 1}</td><td>NJD</td><td>C</td><td>${i % 3}</td></tr>`).join("");
const page = (n: number) => Buffer.from(`<!doctype html><table><thead><tr><th>#</th><th>Player</th><th>Team</th><th>Pos</th><th>G</th></tr></thead><tbody>${rows(n)}</tbody></table>\n`);

let scheduleBody: Buffer = Buffer.from(JSON.stringify({ gameWeek: [{ date: DATE, games: slate() }] }));
let nstBody: Record<string, Buffer> = { individual: page(40), onIce: page(40) };
let admissionAllowed = true;
let killAfter: string | undefined;
let tlsMissing: string | undefined;
let caSwapDuring: string | undefined, caSwapBetween = false;
// Real Node 22.23.4 API: replace the default CA store in-process (drops one bundled root).
const swapCAStore = () => {
  const api = tls as unknown as { getCACertificates: (type: string) => string[]; setDefaultCACertificates: (certs: string[]) => void };
  api.setDefaultCACertificates(api.getCACertificates("default").slice(1));
};
let tlsChange: Record<string, (tls: Record<string, unknown>) => Record<string, unknown>> = {};
const ORDER = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
const resumed = (extra: Record<string, unknown> = {}) => (tls: Record<string, unknown>) => ({ ...tls, sessionReused: true, peerCertificate: null, ...extra });
// SYNTHETIC socket-level TLS facts, shaped like the successor adapter's observation. Not evidence.
const synthTls = (url: string, operation: string) => ({ channel: "undici:client:sendHeaders", authorized: true, authorizationError: null, servername: new URL(url).hostname,
  alpnProtocol: "http/1.1", protocol: "TLSv1.3", cipher: { name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" },
  sessionReused: false, connectionReused: false, connectionSequence: ORDER.indexOf(operation) + 1,
  peerCertificate: { fingerprint256: Array(32).fill("00").join(":"), valid_from: "Nov  1 00:00:00 2026 GMT", valid_to: "Jan 30 00:00:00 2027 GMT",
    subjectCN: "synthetic.rehearsal.invalid", issuerCNChain: ["SYNTHETIC REHEARSAL CA"] } });
const dispatched: string[] = [];

switch (scenario) {
  case "happy": case "repeat": case "expired": case "expiry_boundary": break;
  case "schedule_not_final": scheduleBody = Buffer.from(JSON.stringify({ gameWeek: [{ date: DATE, games: slate({ gameState: "LIVE" }) }] })); break;
  case "schedule_duplicate_key": scheduleBody = Buffer.from(`{"gameWeek":[{"date":"${DATE}","date":"2026-11-12","games":[]}]}`); break;
  case "schedule_empty_day": scheduleBody = Buffer.from(JSON.stringify({ gameWeek: [{ date: DATE, games: [] }] })); break;
  case "schedule_wrong_season": scheduleBody = Buffer.from(JSON.stringify({ gameWeek: [{ date: DATE, games: slate({ season: 20252026 }) }] })); break;
  case "nst_no_rows": nstBody = { individual: Buffer.from("<html><body><p>Service unavailable</p></body></html>"), onIce: page(40) }; break;
  case "nst_row_cap": nstBody = { individual: page(5001), onIce: page(40) }; break;
  case "denied_permit": admissionAllowed = false; break;
  case "partial_write": {
    const original = fs.writeFileSync;
    // Fail only the second page's retained bytes (fd write); everything earlier is durable.
    let armed = false;
    const openOriginal = fs.openSync;
    (fs as unknown as { openSync: unknown }).openSync = (p: fs.PathLike, ...rest: unknown[]) => {
      if (String(p).endsWith("onIce.parser-input.html")) armed = true;
      return (openOriginal as (...a: unknown[]) => number)(p, ...rest);
    };
    (fs as unknown as { writeFileSync: unknown }).writeFileSync = (target: unknown, ...rest: unknown[]) => {
      if (armed) { armed = false; throw Object.assign(new Error("synthetic ENOSPC"), { code: "ENOSPC" }); }
      return (original as (...a: unknown[]) => void)(target, ...rest);
    };
    break;
  }
  case "interrupted": killAfter = "nst:individual"; break;
  case "tls_missing_admission": tlsMissing = "admission:individual"; break;
  case "tls_missing_nst": tlsMissing = "nst:individual"; break;
  case "tls_resumed_ok": tlsChange = { "admission:onIce": resumed(), "nst:onIce": resumed() }; break;
  case "tls_keepalive_ok": tlsChange = { "admission:onIce": tls => ({ ...tls, connectionReused: true, connectionSequence: 2 }), "nst:onIce": tls => ({ ...tls, connectionReused: true, connectionSequence: 3 }) }; break;
  case "tls_resumed_no_prior": tlsChange = { "nst:individual": resumed() }; break;
  case "tls_resumed_unauthorized": tlsChange = { "admission:onIce": resumed({ authorized: false }) }; break;
  // The runner records presence only; the verifier (and the bootstrap, offline-tested) refuse a present key.
  case "lifecycle_key_false": process.env.NST_JOB_LIFECYCLE_ENABLED = "false"; break;
  case "ca_store_swap_during": caSwapDuring = "admission:individual"; break;
  case "ca_store_swap_between": caSwapBetween = true; break;
  default: throw new Error(`unknown scenario ${scenario}`);
}

const response = async (operation: string, spec: { url: string }) => {
  dispatched.push(operation);
  if (killAfter === operation) process.kill(process.pid, "SIGKILL"); // crash mid-transport, after STARTED is durable
  if (caSwapDuring === operation) swapCAStore();
  const base = synthTls(spec.url, operation), tls = tlsMissing === operation ? {} : { tls: tlsChange[operation] ? tlsChange[operation](base) : base };
  if (operation.startsWith("admission:")) return { kind: "admission", httpStatus: 200, valid: true, allowed: admissionAllowed, waitMs: 0, ...tls };
  const bytes = operation === "schedule" ? scheduleBody : nstBody[operation.slice(4)];
  return { status: 200, finalUrl: spec.url, redirected: false, bytes, ...tls };
};
const adapter = {
  supabaseOrigin: ORIGIN, lifecycleMode: "disabled", sourcePath: __filename,
  schedule: (dispatch: Function) => dispatch("schedule", (spec: { url: string }) => response("schedule", spec)),
  async withJob(_options: unknown, work: () => Promise<void>) { await work(); },
  async nst(group: string, url: string, options: { dispatch: Function; requestControl: { attemptsStarted: number } }) {
    options.requestControl.attemptsStarted++;
    if (caSwapBetween && group === "individual") swapCAStore();
    await options.dispatch(`admission:${group}`, (spec: { url: string }) => response(`admission:${group}`, spec));
    return options.dispatch(`nst:${group}`, (spec: { url: string }) => { if (spec.url !== url) throw new Error("url drift"); return response(`nst:${group}`, spec); });
  },
};

(async () => {
  const startedAt = RealDate.now();
  let outcome: Record<string, unknown>;
  try {
    const plannedAtUTC = new Date().toISOString();
    const plan = prep.prepareNativeProcessCapture({ seasonId: 20262027, date: DATE, plannedAtUTC, groups: ["individual", "onIce"] });
    const sourceSHA256 = Object.fromEntries([...Object.entries(roles).map(([role, path]) => [role, sha(fs.readFileSync(resolve(WEB, path)))]),
      ["adapter", sha(fs.readFileSync(__filename))]]);
    const result = await runner.runNativeProcessCapture({ plan, supabaseOrigin: ORIGIN, lifecycleMode: "disabled", sourceSHA256 }, adapter, outDir);
    outcome = { ok: true, state: result.state, operationCount: result.operationCount };
  } catch (error) {
    outcome = { ok: false, error: (error as Error).message };
  }
  process.stdout.write(`${JSON.stringify({ scenario, ...outcome, dispatched, networkAttempts, outputExists: fs.existsSync(outDir), elapsedMs: RealDate.now() - startedAt })}\n`);
})();
