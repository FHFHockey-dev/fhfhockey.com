// @vitest-environment node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { performance as monotonic } from "node:perf_hooks";
import { createServer } from "node:https";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { capture, fixtureGames, officialPilotDates } from "./prepareV6ObservationCapture.testHelper";

const { sourceDate } = officialPilotDates;
import { buildRequestFromContextV1, REQUEST_CONTEXT_CAPTURE, REQUEST_CONTEXT_COLUMNS } from "../../lib/blsh/nativeCaptureV6/requestContext";
import { acquireOfficialLoopbackFixture, readAcquisitionPlan } from "./acquireV6Official.mjs";
import { exportHostedOfficialFixture } from "../../lib/blsh/nativeCaptureV6/officialPilotHandler.testHelper";
import { deriveV6OfficialFrame } from "./acquireV6OfficialFrame";
import { prepareV6Observation } from "./prepareV6Observation";


const root = mkdtempSync(join(tmpdir(), "blsh-v6-observation-test-")), exportDir = join(root, "export"), ledgerPins = join(root, "ledger-pins.json");
const playerId = 900123, gameId = 2026020301, stamp = "2026-11-22T12:08:00.000Z", asOf = "2026-11-22T12:10:00.000Z";
const sha = (b: Buffer) => createHash("sha256").update(new Uint8Array(b)).digest("hex");
const json = (obj: unknown) => Buffer.from(JSON.stringify(obj) + "\n");
function write(path: string, bytes: Buffer) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, new Uint8Array(bytes)); return sha(bytes); }
const html = (group: string) => {
  const headers = ["Player", "Team", "GP", "TOI", ...(group === "individual" ? ["Goals", "Shots", "ixG"] : ["xGF", "xGA"])];
  const values = [`<a href="/playerreport.php?playerid=${playerId}">Fixture</a>`, "NJD", "1", group === "individual" ? "20.025" : "20:02",
    ...(group === "individual" ? ["0", "3", "0.0"] : ["0.5", "0"])];
  return "<table><thead><tr>" + headers.map(t => "<th>" + t + "</th>").join("") + "</tr></thead><tbody><tr>" +
    values.map(v => "<td>" + v + "</td>").join("") + "</tr></tbody></table>\r\n";
};
let packet: Awaited<ReturnType<typeof capture>>;
const archive = join(root, "acquired"), acquisitionPinPath = join(root,"acquisition-pins.json"), framePinPath = join(root,"frame-pins.json"), frameFile = join(root,"derived-frame.json");
let acquisitionPinsSHA256: string, acquisitionManifestSHA256: string, calls = 0;
const failedRequests: string[] = [];
const budgetRequests: Record<string, number[]> = {};
function lineup(base: number, selectedSkater?: number) {
  const row = (offset: number, toi: string) => ({ playerId: base + offset, toi, goals: 0, sog: 1 });
  const defense = Array.from({ length: 6 }, (_, i) => row(20 + i, "17:00"));
  if (selectedSkater) defense[0] = { playerId: selectedSkater, toi: "20:02", goals: 0, sog: 3 };
  return { forwards: Array.from({ length: 12 }, (_, i) => row(i, "14:00")), defense,
    goalies: [row(30, "60:00"), row(31, "00:00")] };
}
beforeAll(async () => {
  packet = await capture(html, fixtureGames, officialPilotDates);
  for (const [key, value] of packet.bytes) write(join(exportDir, "objects", key), value);
  write(join(exportDir, "run.json"), json(packet.run));
  write(join(exportDir, "objects.json"), json(packet.objects));
  write(ledgerPins, json(packet.pins));
  // Ephemeral, loopback-only TLS issuer valid across the fixed capture date and real handshake.
  const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: root, stdio: "ignore" });
  writeFileSync(join(root,"ca.cnf"), "[ca]\ndefault_ca=fixture\n[fixture]\ndatabase=index\nserial=serial\nnew_certs_dir=.\ndefault_md=sha256\npolicy=policy\nx509_extensions=ext\n[policy]\ncommonName=supplied\n[ext]\nbasicConstraints=critical,CA:true\nsubjectAltName=DNS:api-web.nhle.com\n");
  writeFileSync(join(root,"index"), ""); writeFileSync(join(root,"serial"), "01\n");
  openssl("req","-new","-newkey","rsa:2048","-nodes","-subj","/CN=api-web.nhle.com","-keyout","fixture.key","-out","fixture.csr");
  openssl("ca","-batch","-selfsign","-config","ca.cnf","-keyfile","fixture.key","-in","fixture.csr","-out","fixture.crt","-notext","-startdate","20200101000000Z","-enddate","20990101000000Z");
  const ca = readFileSync(join(root,"fixture.crt"),"utf8"), key = readFileSync(join(root,"fixture.key"));
  let responseMode = "boxscore";
  const server = createServer({ cert: ca, key }, (req, res) => {
    if (responseMode === "redirect" || responseMode === "oversize") {
      failedRequests.push(responseMode);
      if (responseMode === "redirect") { res.writeHead(302,{location:"/must-not-follow"}); res.end(); }
      else res.end(Buffer.alloc(4 * 1024 * 1024 + 1,32));
      return;
    }
    const index = responseMode === "boxscore" ? calls++ : budgetRequests[responseMode].length;
    const game = fixtureGames[index];
    if (responseMode !== "boxscore") budgetRequests[responseMode].push(game.id);
    expect([req.method,req.headers.host,req.url]).toEqual(["GET","api-web.nhle.com",`/v1/gamecenter/${game.id}/boxscore`]);
    res.end(json({ ...game, gameDate: sourceDate, season: 20262027, gameType: 2, gameState: "OFF", gameScheduleState: "OK",
      playerByGameStats: { homeTeam: lineup(1000000 + index * 1000, playerId + index), awayTeam: lineup(1000100 + index * 1000) } }));
  });
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  const loopback = { port: (server.address() as AddressInfo).port, ca, outDir: archive };
  try {
    const plan = readAcquisitionPlan(exportDir,ledgerPins);
    acquisitionPinsSHA256 = write(acquisitionPinPath,json(plan));
    const start = performance.now();
    const clock = vi.spyOn(Date,"now").mockImplementation(() => Date.parse(stamp) + Math.floor(performance.now() - start));
    try {
      const result = await acquireOfficialLoopbackFixture(exportDir,ledgerPins,acquisitionPinPath,loopback);
      acquisitionManifestSHA256 = result.manifestSHA256;
      const swapped = join(root,"swapped-slate-pins");
      write(swapped,json({...plan,gameIds:[gameId+1]}));
      await expect(acquireOfficialLoopbackFixture(exportDir,ledgerPins,swapped,{...loopback,outDir:root+"/unstarted"})).rejects.toThrow("official_independent_capture_pins_mismatch");
      expect(existsSync(root+"/unstarted")).toBe(false);
      for (const [mode,reason] of [["redirect","official_transport_response_invalid"],["oversize","official_body_limit"]]) {
        responseMode = mode;
        const failed = {...loopback,outDir:join(root,mode)};
        await expect(acquireOfficialLoopbackFixture(exportDir,ledgerPins,acquisitionPinPath,failed)).rejects.toThrow(reason);
        expect(existsSync(join(failed.outDir,"operation-1-STARTED.json"))).toBe(true);
        expect(existsSync(join(failed.outDir,"FAILED.json"))).toBe(true);
        expect(existsSync(join(failed.outDir,"MANIFEST.json"))).toBe(false);
        await expect(acquireOfficialLoopbackFixture(exportDir,ledgerPins,acquisitionPinPath,failed)).rejects.toThrow("EEXIST");
      }
      await expect(acquireOfficialLoopbackFixture(exportDir,ledgerPins,acquisitionPinPath,loopback)).rejects.toThrow("EEXIST");
      const realMono = monotonic.now.bind(monotonic);
      for (const [which, event, jump, reason] of [
        ["wall", "second-journal", 106000, "official_acquisition_deadline"],
        ["mono", "second-journal", 106000, "official_acquisition_deadline"],
        ["wall", "first-journal", 15000, "official_request_deadline"],
        ["mono", "last-receipt", 121000, "official_acquisition_deadline"],
        ["wall", "last-receipt", 121000, "official_acquisition_deadline"],
        ["wall", "last-receipt", 1999, "official_acquisition_chronology"],
        ["wall", "between-games", 999, "official_acquisition_chronology"],
      ] as const) {
        responseMode = which + "-" + event + "-" + jump;
        budgetRequests[responseMode] = [];
        const outDir = join(root, responseMode);
        const elapsed = () => {
          if (event === "second-journal") {
            if (existsSync(join(outDir, "operation-2-STARTED.json"))) return jump;
            if (existsSync(join(outDir, `boxscore-${gameId}.receipt.json`))) return 104000;
          } else if (event === "first-journal") {
            if (existsSync(join(outDir, "operation-1-STARTED.json"))) return jump;
          } else if (event === "between-games") {
            if (existsSync(join(outDir, `boxscore-${gameId}.receipt.json`))) return jump;
          } else {
            if (existsSync(join(outDir, `boxscore-${fixtureGames[1].id}.receipt.json`))) return jump;
            if (existsSync(join(outDir, `boxscore-${gameId}.receipt.json`))) return 2000;
          }
          return 0;
        };
        const began = realMono();
        clock.mockImplementation(() => Date.parse(stamp) + (which === "wall" ? elapsed() : Math.floor(realMono() - began)));
        const mono = vi.spyOn(monotonic, "now").mockImplementation(() => which === "mono" ? began + elapsed() : realMono());
        try {
          await expect(acquireOfficialLoopbackFixture(exportDir, ledgerPins, acquisitionPinPath, { ...loopback, outDir })).rejects.toThrow(reason);
          expect(budgetRequests[responseMode]).toEqual(event === "first-journal" ? [] : event === "last-receipt" ? fixtureGames.map(g => g.id) : [gameId]);
          expect(existsSync(join(outDir, "FAILED.json"))).toBe(true);
          expect(existsSync(join(outDir, "MANIFEST.json"))).toBe(false);
        } finally { mono.mockRestore(); }
      }
    } finally { clock.mockRestore(); }
  } finally { await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done())); }
  write(framePinPath,json({ runId: packet.run.run_id, sourceDate, playerId, evidenceAsOfUTC: asOf, acquisitionPinsSHA256, acquisitionManifestSHA256 }));
  await deriveV6OfficialFrame(exportDir,ledgerPins,archive,framePinPath,frameFile,true);
}, 30000);
afterAll(() => rmSync(root, { recursive: true, force: true }));

function evidence(options: { badCell?: boolean; rawDate?: boolean; wrongFrame?: boolean; badBoxGoals?: boolean; afterTwelveHours?: boolean; earlySnapshot?: boolean; wrongCutoff?: boolean; wrongStart?: boolean; edges?: boolean; claimedTLS?: boolean } = {}) {
  const dir = mkdtempSync(join(root, "case-")), evidenceDir = join(dir, "evidence"), out = join(dir, "out"), pinsPath = join(dir, "pins.json");
  const keep = (name: string, data: unknown) => write(join(evidenceDir, name), json(data));
  const wgo = { id: 77, player_id: playerId, game_id: gameId, season_id: 20262027, date: sourceDate, team_abbrev: "NJD",
    position_code: "D", games_played: 1, toi_per_game: 1202, goals: 0, shots: 3 };
  const stored = { player_id: playerId, date_scraped: sourceDate, season: 20262027, gp: 1, toi: 1202 };
  const array = (feed: keyof typeof REQUEST_CONTEXT_COLUMNS, row: Record<string, unknown>) => REQUEST_CONTEXT_COLUMNS[feed].map(k => row[k] ?? null);
  const latestNative = "2026-11-22T12:05:22.000000Z", dbSnapshot = "2026-11-22T07:09:59.000001-05:00";
  const captured = options.afterTwelveHours ? "2026-11-23T00:05:00.000001Z" : options.edges ? "2026-11-22T12:05:23.000Z" : asOf;
  const decision = options.afterTwelveHours || options.edges ? "2026-11-23T01:00:00Z" : asOf;
  const context = { version: "fhfh.blsh.request-context.v1", seasonId: 20262027, dateFrom: options.wrongStart ? "2026-10-25" : "2026-10-24",
    eventThroughDate: options.wrongCutoff ? "2026-11-22" : sourceDate, snapshotUTC: options.earlySnapshot ? "2026-11-22T12:05:21.999999Z" : options.edges ? latestNative : dbSnapshot,
    statementUTC: options.edges ? latestNative : dbSnapshot, columnsSHA256: "c14231f0e62595eed0cb37175360cab33e4731e48a520f22f4bf494e0c127750", keySeal: { ids: [wgo.id], rows: 1 },
    rows: [[array("wgo", wgo), [array("individual", { ...stored, id: 81, goals: 0, shots: 3, ixg: options.badCell ? 1 : 0 })],
      [array("onIce", { ...stored, id: 82, xgf: 0.5, xga: 0 })], [array("calendar", { id: gameId, date: sourceDate, type: 2, seasonId: 20262027 })]]] };
  const contextRunId = "12345678-1234-4321-8abc-123456789abc", contextDeploymentId = "dpl_context_fixture", contextGitCommitSha = "c".repeat(40);
  const contextRoot = join(evidenceDir, "context-ledger");
  const identity = { runId: contextRunId, sourceDate, nativeRunId: packet.run.run_id, nativeManifestSHA256: packet.run.manifest_sha256 };
  const files: { file: string; bytes: number; sha256: string }[] = [];
  function put(file: string, bytes: Buffer) {
    const sha256 = write(join(contextRoot, "objects", "request-context-v1", sourceDate, contextRunId, file), bytes);
    files.push({ file, bytes: bytes.length, sha256 });
    return sha256;
  }
  const contextSHA256 = put("DB-CONTEXT.json", json(context));
  const built = buildRequestFromContextV1(context, { capturedAtUTC: captured });
  if (options.rawDate) {
    const raw = JSON.parse(built.rawFiles["RAW-calendar.json"].toString());
    raw.records[0].date = "2026-11-19";
    built.rawFiles["RAW-calendar.json"] = json(raw);
    (built.request.calendar as { capture: { sha256: string } }).capture.sha256 = sha(built.rawFiles["RAW-calendar.json"]);
  }
  for (const [file, bytes] of Object.entries(built.rawFiles)) put(file, bytes);
  const requestSHA256 = put("CURRENT-REQUEST.json", json(built.request));
  const nativeRetrievedAtUTC = Object.fromEntries(["individual", "onIce"].map(group => {
    const desc = packet.objects.find(r => r.path.endsWith("/" + group + ".TRANSPORT-OBSERVATION.json"))!;
    return [group, JSON.parse(packet.bytes.get(desc.path)!.toString()).retrievedAtUTC];
  }));
  put("RESULT.json", json({ version: "fhfh.blsh.request-context-result.v1", state: "CAPTURED_READ_ONLY_UNQUALIFIED",
    executionMode: REQUEST_CONTEXT_CAPTURE, captureContext: REQUEST_CONTEXT_CAPTURE, atomicDatabaseSnapshot: true, sessionClosed: true,
    ...identity, requestDeployment: { deploymentId: contextDeploymentId, gitCommitSha: contextGitCommitSha }, dateFrom: context.dateFrom,
    eventThroughDate: context.eventThroughDate, snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC,
    nativeRetrievedAtUTC, asOfUTC: captured, rows: built.rows, artifacts: Object.fromEntries(files.map(f => [f.file, f.sha256])),
    independentlyAccepted: false, advancedAdmission: false, score: null }));
  const contextManifestSHA256 = put("MANIFEST.json", json({ version: "fhfh.blsh.request-context-manifest.v1", ...identity, files }));
  const rows = files.map((f, i) => ({ run_id: contextRunId, ordinal: i + 1, bytes: f.bytes, sha256: f.sha256, written_at: captured,
    path: "request-context-v1/" + sourceDate + "/" + contextRunId + "/" + f.file }));
  write(join(contextRoot, "objects.json"), json(rows));
  write(join(contextRoot, "run.json"), json({ run_id: contextRunId, native_run_id: identity.nativeRunId, source_date: sourceDate,
    native_manifest_sha256: identity.nativeManifestSHA256, state: "packet_complete_pending_review", reason: null,
    manifest_sha256: contextManifestSHA256, claimed_at: options.edges ? latestNative : "2026-11-22T12:09:58.000Z", closed_at: captured }));
  cpSync(archive, join(evidenceDir,"official"), { recursive: true });
  let manifestHash = acquisitionManifestSHA256;
  const frame = JSON.parse(readFileSync(frameFile,"utf8"));
  const change = options.claimedTLS ? `boxscore-${gameId}.receipt.json` : options.badBoxGoals ? `boxscore-${gameId}.body.json` : undefined;
  if (change) {
    const path = join(evidenceDir,"official",change), obj = JSON.parse(readFileSync(path,"utf8"));
    if (options.claimedTLS) obj.TLSVerified = true; else obj.playerByGameStats.homeTeam.defense[0].goals = 2;
    const manifest = JSON.parse(readFileSync(join(archive,"MANIFEST.json"),"utf8"));
    const replace = (name: string, value: unknown) => {
      const bytes = json(value), item = manifest.files.find((f: { file: string }) => f.file === name);
      item.sha256 = write(join(evidenceDir,"official",name),bytes); item.bytes = bytes.length;
      return item;
    };
    const meta = replace(change,obj);
    if (options.badBoxGoals) {
      const name = `boxscore-${gameId}.receipt.json`, receipt = JSON.parse(readFileSync(join(archive,name),"utf8"));
      receipt.sha256 = frame.provenance.boxscoreSHA256 = meta.sha256; receipt.bytes = meta.bytes;
      frame.provenance.boxscoreReceiptSHA256 = replace(name,receipt).sha256;
    }
    manifestHash = keep("official/MANIFEST.json",manifest); frame.provenance.acquisitionManifestSHA256 = manifestHash;
  }
  if (options.wrongFrame) frame.totalToiSeconds = 1200;
  const frameSHA256 = keep("OFFICIAL-FRAME.json", frame);
  write(pinsPath, json({ playerId, runId: packet.run.run_id, sourceDate, evidenceAsOfUTC: decision, contextSHA256, frameSHA256, requestSHA256,
    acquisitionManifestSHA256: manifestHash, acquisitionPinsSHA256, contextRunId, contextManifestSHA256, contextDeploymentId, contextGitCommitSha }));
  return { out, evidenceDir, pinsPath, run: () => prepareV6Observation(exportDir, ledgerPins, evidenceDir, pinsPath, out, true) };
}

describe("original, run-bound v6 official acquisition", () => {
  it("sends one loopback request per successful game and stops on the first terminal failure, with no redirect, byte-limit retry or reopened journal", () => {
    expect(calls).toBe(2); expect(failedRequests).toEqual(["redirect","oversize"]);
  });
  it("links each skater to the original body and receipt from their own game on the same slate", async () => {
    for (const [index, game] of fixtureGames.entries()) {
      const review = join(root, "skater-review-" + index), out = join(root, "skater-frame-" + index);
      write(review, json({ ...JSON.parse(readFileSync(framePinPath, "utf8")), playerId: playerId + index }));
      await deriveV6OfficialFrame(exportDir, ledgerPins, archive, review, out, true);
      const frame = JSON.parse(readFileSync(out, "utf8"));
      expect(frame).toMatchObject({ gameId: game.id, playerId: playerId + index, team: game.homeTeam.abbrev, provenance: {
        boxscoreSHA256: sha(readFileSync(join(archive, `boxscore-${game.id}.body.json`))),
        boxscoreReceiptSHA256: sha(readFileSync(join(archive, `boxscore-${game.id}.receipt.json`))),
      } });
    }
  });
  it("refuses the original archive when its review cutoff precedes completion by one millisecond", async () => {
    const review = join(root, "before-completion.json"), out = join(root, "late-frame.json");
    const manifest = JSON.parse(readFileSync(join(archive, "MANIFEST.json"), "utf8"));
    const evidenceAsOfUTC = new Date(Date.parse(manifest.completedAtUTC) - 1).toISOString();
    write(review, json({ ...JSON.parse(readFileSync(framePinPath, "utf8")), evidenceAsOfUTC }));
    await expect(deriveV6OfficialFrame(exportDir, ledgerPins, archive, review, out, true)).rejects.toThrow("official_acquisition_chronology");
    expect(existsSync(out)).toBe(false);
  });
  it.each([
    ["switched run", "official_independent_capture_pins_mismatch"],
    ["switched manifest", "official_independent_capture_pins_mismatch"],
    ["switched tool", "official_independent_capture_pins_mismatch"],
    ["legacy runtime", "acquisition_runtime_source_mismatch"],
    ["foreign receipt", "official_receipt_or_chronology_mismatch"],
    ["receipt from neighboring game", "official_receipt_or_chronology_mismatch"],
    ["neighboring journal too late to dispatch", "official_receipt_or_chronology_mismatch"],
    ["missing actual dispatch", "official_receipt_or_chronology_mismatch"],
    ["v1 receipt", "official_receipt_or_chronology_mismatch"],
    ["dispatch before journal", "official_receipt_or_chronology_mismatch"],
    ["neighbor ID string", "official_player_identity"],
    ["duplicate across positions", "official_player_date_ambiguous"],
    ["empty neighbor side", "official_roster_scope"],
    ["neighbor skaters zero exposure", "official_roster_scope"],
    ["switched TLS peer", "official_certificate_identity"],
    ["private CA relabeled as live", "official_certificate_untrusted"],
    ["acquisition before close", "official_acquisition_chronology"],
  ])("refuses %s after recomputing archive and frame pins", async (change,reason) => {
    const dir = mkdtempSync(join(root,"changed-")), archiveCopy = join(dir,"official"), reviewFile = join(dir,"review.json");
    cpSync(archive, archiveCopy, {recursive:true});
    const read = (name: string) => JSON.parse(readFileSync(join(archiveCopy,name),"utf8"));
    const manifest = read("MANIFEST.json"), pins = read("ACQUISITION-PINS.json"), runtime = read("ACQUISITION-RUNTIME.json");
    const persist = (name: string, bytes: Buffer) => {
      const entry = manifest.files.find((f: { file: string }) => f.file === name);
      entry.sha256 = write(join(archiveCopy,name),bytes); entry.bytes = bytes.length;
      return entry.sha256;
    };
    const receiptName = `boxscore-${gameId}.receipt.json`, receipt = read(receiptName);
    let inputHash = acquisitionPinsSHA256, fixtureOnly = true;
    if (change === "switched run") pins.runId = "00000000-0000-4000-8000-000000000000";
    if (change === "switched manifest") pins.manifestSHA256 = "e".repeat(64);
    if (change === "switched tool") pins.toolSHA256 = runtime.toolSHA256 = persist("source-tool.mjs",Buffer.from("// other tool"));
    if (change.startsWith("switched ") && change !== "switched TLS peer") {
      manifest.acquisitionPinsSHA256 = runtime.acquisitionPinsSHA256 = receipt.acquisitionPinsSHA256 = inputHash = persist("ACQUISITION-PINS.json",json(pins));
      const journal = read("operation-1-STARTED.json"); journal.acquisitionPinsSHA256 = inputHash;
      receipt.journalSHA256 = persist("operation-1-STARTED.json",json(journal));
    }
    if (change === "receipt from neighboring game") {
      persist(`boxscore-${fixtureGames[1].id}.receipt.json`, json(receipt));
    }
    if (change === "neighboring journal too late to dispatch") {
      const name = `boxscore-${fixtureGames[1].id}.receipt.json`;
      const second = read(name), journal = read("operation-2-STARTED.json");
      const startMs = Date.parse(runtime.startedAtUTC);
      // The second response fits inside 120s, but fewer than 15s remained at dispatch.
      journal.startedAtUTC = new Date(startMs + 104000).toISOString();
      second.journalSHA256 = persist("operation-2-STARTED.json", json(journal));
      second.dispatchedAtUTC = new Date(startMs + 106000).toISOString();
      manifest.completedAtUTC = second.retrievedAtUTC = new Date(startMs + 107000).toISOString();
      persist(name, json(second));
    }
    if (change === "missing actual dispatch") delete receipt.dispatchedAtUTC;
    if (change === "v1 receipt") receipt.version = "fhfh.blsh.v6-official-boxscore-receipt.v1";
    if (change === "dispatch before journal") receipt.dispatchedAtUTC = new Date(Date.parse(read("operation-1-STARTED.json").startedAtUTC) - 1).toISOString();
    if (["neighbor ID string", "duplicate across positions", "empty neighbor side", "neighbor skaters zero exposure"].includes(change)) {
      const name = `boxscore-${fixtureGames[1].id}.body.json`, neighbor = read(name), roster = neighbor.playerByGameStats.awayTeam;
      if (change === "neighbor ID string") roster.forwards[0].playerId = String(playerId);
      if (change === "duplicate across positions") roster.goalies[0].playerId = roster.defense[0].playerId;
      if (change === "empty neighbor side") neighbor.playerByGameStats.awayTeam = { forwards: [], defense: [], goalies: [] };
      if (change === "neighbor skaters zero exposure") for (const p of [...roster.forwards, ...roster.defense]) p.toi = "00:00";
      const bytes = json(neighbor), receiptName = `boxscore-${fixtureGames[1].id}.receipt.json`, neighborReceipt = read(receiptName);
      neighborReceipt.sha256 = persist(name, bytes); neighborReceipt.bytes = bytes.length;
      persist(receiptName, json(neighborReceipt));
    }
    if (change === "legacy runtime") runtime.version = "fhfh.blsh.official-acquisition-runtime.v2";
    if (change === "foreign receipt") receipt.acquisitionPinsSHA256 = "9".repeat(64);
    if (change === "switched TLS peer") receipt.tls.peerFingerprint256 = "AA:BB";
    if (change === "private CA relabeled as live") {
      fixtureOnly = false; runtime.acquisitionClass = "direct_https"; delete runtime.fixtureCA;
      runtime.rootStoreSHA256 = pins.bundledCASHA256; runtime.outputDirectory = join(root,".fhfh-blsh-official-v6-" + sourceDate);
    }
    if (change === "acquisition before close") runtime.startedAtUTC = "2026-11-22T12:05:21.999999Z";
    persist("ACQUISITION-RUNTIME.json",json(runtime)); persist(receiptName,json(receipt));
    const archiveHash = write(join(archiveCopy,"MANIFEST.json"),json(manifest));
    write(reviewFile,json({...JSON.parse(readFileSync(framePinPath,"utf8")),acquisitionPinsSHA256:inputHash,acquisitionManifestSHA256:archiveHash}));
    const out = join(dir,"frame.json");
    await expect(deriveV6OfficialFrame(exportDir,ledgerPins,archiveCopy,reviewFile,out,fixtureOnly)).rejects.toThrow(reason);
    expect(existsSync(out)).toBe(false);
  });
});

describe("one-skater v6 held observation export", () => {
  it("derives a fixture frame from the two-game capture and refuses fixture evidence in the default frame/proposal modes", async () => {
    expect(calls).toBe(2);
    await expect(deriveV6OfficialFrame(exportDir,ledgerPins,archive,framePinPath,frameFile+"-direct")).rejects.toThrow("official_acquisition_class_mismatch");
    const test = evidence();
    await expect(prepareV6Observation(exportDir,ledgerPins,test.evidenceDir,test.pinsPath,test.out)).rejects.toThrow("official_acquisition_class_mismatch");
    const preview = JSON.parse(execFileSync(process.execPath, ["scripts/blsh/acquireV6Official.mjs",exportDir,ledgerPins], {encoding:"utf8"}));
    expect(preview).toMatchObject({ requests: 0, status: "offline_plan_no_requests", intendedPins: {runId:packet.run.run_id,gameIds:fixtureGames.map(g => g.id)} });
  });
  it("re-reads the writer packet, retains original bytes and checks source cells while withholding witnesses", async () => {
    const test = evidence();
    await expect(test.run()).resolves.toMatchObject({ acceptedWitnesses: 0, currentUseQualified: false, score: null });
    const result = JSON.parse(readFileSync(join(test.out, "HELD-OBSERVATION.json"), "utf8"));
    expect(result.comparison.dbContext).toMatchObject({ snapshotUTC: "2026-11-22T07:09:59.000001-05:00", statementUTC: "2026-11-22T07:09:59.000001-05:00" });
    expect(result.comparison.cells.individual.fields).toMatchObject({ goals: { nativeValue: 0, rawText: "0" }, toi: { nativeValue: 1202 } });
    expect(result.comparison.cells.onIce.fields.xga.nativeValue).toBe(0);
    expect(result.contextRun).toMatchObject({ status: "request_context_readback_pending_review", independentlyAccepted: false });
    expect(result.pending).toContain("independent_v6_official_acquisition_review");
    const manifest = JSON.parse(readFileSync(join(test.out, "MANIFEST.json"), "utf8"));
    for (const { file, sha256 } of manifest.files) expect(sha(readFileSync(join(test.out, file)))).toBe(sha256);
    expect(readFileSync(join(test.out, "packet-individual.parser-input.html"), "utf8")).toBe(html("individual"));
    expect(existsSync(join(test.out, "PROPOSED-BUNDLE.json"))).toBe(false);
    const cli = execFileSync(process.execPath, ["./node_modules/.bin/ts-node", "--transpile-only", "--compiler-options",
      '{"module":"Node16","moduleResolution":"Node16"}', "scripts/blsh/prepareV6Observation.ts", exportDir, ledgerPins,
      test.evidenceDir, test.pinsPath, test.out + "-cli", "--fixture-only"], { encoding: "utf8" });
    expect(JSON.parse(cli)).toMatchObject({ status: result.status, acceptedWitnesses: 0, manifestSHA256: sha(readFileSync(join(test.out, "MANIFEST.json"))) });
    await expect(test.run()).rejects.toThrow(/EEXIST/);
  });
  it.each([
    [{ badCell: true }, "native_stored_cell_mismatch"], [{ rawDate: true }, "context_projection_mismatch"],
    [{ wrongFrame: true }, "supplied_frame_original_bytes_mismatch"], [{ afterTwelveHours: true }, "context_clock_mismatch"],
    [{ earlySnapshot: true }, "context_clock_mismatch"], [{ wrongCutoff: true }, "context_scope_mismatch"],
    [{ wrongStart: true }, "context_scope_mismatch"],
    [{ badBoxGoals: true }, "official_wgo_native_count_mismatch"],
    [{ claimedTLS: true }, "official_receipt_or_chronology_mismatch"],
  ] as const)("refuses independently repinned incompatible material (%j)", async (opts, code) => {
    const test = evidence(opts);
    await expect(test.run()).rejects.toThrow(code); expect(existsSync(test.out)).toBe(false);
  });
  it("includes the exact last native retrieval and preserves the later independent review time", async () => {
    const test = evidence({ edges: true });
    await test.run();
    const report = JSON.parse(readFileSync(join(test.out, "HELD-OBSERVATION.json"), "utf8"));
    expect(report.comparison.dbContext).toMatchObject({ dateFrom: "2026-10-24", eventThroughDate: sourceDate,
      snapshotUTC: "2026-11-22T12:05:22.000000Z", capturedAtUTC: "2026-11-22T12:05:23.000Z" });
    expect(report.evidenceAsOfUTC).toBe("2026-11-23T01:00:00Z");
  });
  it("withholds a proposal when the context manifest exists on a failed run", async () => {
    const test = evidence(), file = join(test.evidenceDir, "context-ledger", "run.json");
    const row = JSON.parse(readFileSync(file, "utf8"));
    write(file, json({ ...row, state: "failed", reason: "context_write_unacknowledged", manifest_sha256: null }));
    await expect(test.run()).rejects.toThrow("context_run");
    expect(existsSync(test.out)).toBe(false);
  });
  it("withholds a corrected boxscore and receipt under either the original manifest or the original frame", async () => {
    const test = evidence({ badBoxGoals: true });
    const pins = JSON.parse(readFileSync(test.pinsPath, "utf8"));
    const originalFrame = readFileSync(frameFile);
    const frame = JSON.parse(originalFrame.toString());
    expect(frame.provenance.boxscoreReceiptSHA256).not.toBe(sha(readFileSync(join(test.evidenceDir, "official", `boxscore-${gameId}.receipt.json`))));
    write(test.pinsPath, json({ ...pins, acquisitionManifestSHA256 }));
    await expect(test.run()).rejects.toThrow("independent_evidence_digest_mismatch");
    expect(existsSync(test.out)).toBe(false);
    const frameSHA256 = write(join(test.evidenceDir, "OFFICIAL-FRAME.json"), originalFrame);
    write(test.pinsPath, json({ ...pins, frameSHA256 }));
    await expect(test.run()).rejects.toThrow("supplied_frame_original_bytes_mismatch");
    expect(existsSync(test.out)).toBe(false);
  });
  it.each(fixtureGames)("rejects a missing receipt for slate game $id without producing output", async game => {
    const test = evidence();
    rmSync(join(test.evidenceDir, "official", `boxscore-${game.id}.receipt.json`));
    await expect(test.run()).rejects.toThrow("acquisition_directory_file_set"); expect(existsSync(test.out)).toBe(false);
  });
});

describe("signed hosted official export through the actual frame and held reader", () => {
  let fixture: Awaited<ReturnType<typeof exportHostedOfficialFixture>>;
  let framePins: Record<string, unknown>;
  const dir = join(root, "hosted-archive"), originalFrame = join(root, "hosted-frame.json");
  beforeAll(async () => {
    const boxes = fixtureGames.map(game => JSON.parse(readFileSync(join(archive, `boxscore-${game.id}.body.json`), "utf8")));
    fixture = await exportHostedOfficialFixture({ outDir: dir, nativeRunId: packet.run.run_id, nativeManifestSHA256: packet.run.manifest_sha256!,
      scheduleSHA256: packet.objects.find(row => row.path.endsWith("/schedule.raw.json"))!.sha256, boxes,
      deploymentId: packet.pins.deploymentId, gitCommitSha: packet.pins.gitCommitSha });
    framePins = { runId: packet.run.run_id, sourceDate, playerId, evidenceAsOfUTC: fixture.evidenceAsOfUTC, hostedOfficial: fixture.hostedOfficial,
      acquisitionPinsSHA256: fixture.acquisitionPinsSHA256, acquisitionManifestSHA256: fixture.acquisitionManifestSHA256 };
    const pins = join(root, "hosted-frame-pins.json");
    write(pins, json(framePins));
    await deriveV6OfficialFrame(exportDir, ledgerPins, dir, pins, originalFrame, true);
  });
  function held() {
    const c = evidence(), ledger = join(c.evidenceDir, "official-ledger");
    cpSync(dir, ledger, { recursive: true });
    const frameSHA256 = write(join(c.evidenceDir, "OFFICIAL-FRAME.json"), readFileSync(originalFrame));
    const pins = { ...JSON.parse(readFileSync(c.pinsPath, "utf8")), ...framePins, frameSHA256 };
    write(c.pinsPath, json(pins));
    return { ...c, ledger, pins };
  }
  it("reaches a held observation from the real signed route and copies both original metadata buffers and every hosted object", async () => {
    const c = held(), result = await c.run();
    expect(result).toMatchObject({ status: "fixture_only_held_observation", acceptedWitnesses: 0, score: null, currentUseQualified: false });
    const report = JSON.parse(readFileSync(join(c.out, "HELD-OBSERVATION.json"), "utf8"));
    expect(report.comparison.official).toMatchObject({ acquisitionClass: "loopback_fixture_only", officialRunId: fixture.hostedOfficial.runId,
      acquisitionManifestSHA256: fixture.acquisitionManifestSHA256, acquisitionPinsSHA256: fixture.acquisitionPinsSHA256,
      boxscoreSHA256: sha(fixture.bodies[String(gameId)]) });
    for (const file of ["run.json", "objects.json"]) expect(readFileSync(join(c.out, "official-ledger-" + file))).toEqual(readFileSync(join(dir, file)));
    for (const row of fixture.rows) {
      const path = row.path as string, file = path.split("/").pop()!;
      expect(readFileSync(join(c.out, "evidence-official-" + file))).toEqual(readFileSync(join(dir, "objects", path)));
    }
  });
  it("refuses a hosted loopback packet under real-host policy", async () => {
    const c = held();
    await expect(prepareV6Observation(exportDir, ledgerPins, c.evidenceDir, c.pinsPath, c.out)).rejects.toThrow("official_hosted_runtime_profile");
    expect(existsSync(c.out)).toBe(false);
  });
  it.each([
    ["uncertain", "official_hosted_run_mismatch"], ["expired", "official_hosted_ledger_clock"],
    ["wrong key", "official_grant_signature"], ["changed runtime pin", "official_hosted_runtime_profile"],
    ["missing receipt", "official_hosted_index_count"], ["wrong game", "official_hosted_run_mismatch"],
    ["reordered intent", "official_hosted_index_mismatch"], ["journal before prior commit", "official_hosted_intent_chronology"], ["corrected original", "official_hosted_object_digest"],
    ["resealed wrong receipt", "official_receipt_or_chronology_mismatch"], ["resealed wrong game", "official_game_scope"],
    ["late claim", "official_hosted_ledger_clock"], ["late closure", "official_hosted_runtime_clock"],
    ["resealed frame", "supplied_frame_original_bytes_mismatch"],
  ])("withholds %s before writing a proposal", async (kind, reason) => {
      const c = held(), run = { ...fixture.run }, rows = fixture.rows.map(row => ({ ...row }));
      if (kind === "uncertain") { run.state = "claimed"; run.closed_at = null; write(join(c.ledger, "run.json"), json(run)); }
      if (kind === "expired") { c.pins.evidenceAsOfUTC = "2026-11-22T12:45:00Z"; write(c.pinsPath, json(c.pins)); }
      if (kind === "wrong key") {
        const { generateKeyPairSync } = await import("node:crypto");
        c.pins.hostedOfficial = { ...c.pins.hostedOfficial, approvalPublicKey: generateKeyPairSync("ed25519").publicKey.export({type: "spki",format: "pem"}).toString() };
        write(c.pinsPath, json(c.pins));
      }
      if (kind === "changed runtime pin") {
        c.pins.hostedOfficial = { ...c.pins.hostedOfficial, runtime: { ...c.pins.hostedOfficial.runtime, routeBundleSHA256: "d".repeat(64) } };
        write(c.pinsPath,json(c.pins));
      }
      if (kind === "missing receipt") { rows.splice(3, 1); write(join(c.ledger, "objects.json"), json(rows)); }
      if (kind === "wrong game") { run.game_ids = [gameId+1]; write(join(c.ledger, "run.json"), json(run)); }
      if (kind === "reordered intent") { rows[1].game_id = fixtureGames[1].id; write(join(c.ledger, "objects.json"), json(rows)); }
      if (kind === "corrected original") {
        const path = join(c.ledger, "objects", rows[2].path as string), bytes = readFileSync(path);
        bytes[bytes.length-1] = 32; write(path,bytes);
      }
      if (kind === "resealed wrong receipt" || kind === "resealed wrong game" || kind === "journal before prior commit") {
        const manifestPath = join(c.ledger, "objects", rows[rows.length - 1].path as string);
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        const replace = (i: number, patch: Record<string, unknown>) => {
          const file = join(c.ledger, "objects", rows[i].path as string);
          const bytes = json({ ...JSON.parse(readFileSync(file, "utf8")), ...patch });
          const hash = write(file, bytes);
          Object.assign(rows[i], { bytes: bytes.length, sha256: hash });
          if (i < rows.length - 1) Object.assign(manifest.files[i], { bytes: bytes.length, sha256: hash });
          return { bytes: bytes.length, sha256: hash };
        };
        if (kind === "resealed wrong game") {
          const updated = replace(2, { id: fixtureGames[1].id });
          replace(3, updated);
        } else if (kind === "journal before prior commit") {
          // A valid ledger and wire order apart from one edge: the runtime commits 1µs after journal creation.
          const journal = JSON.parse(readFileSync(join(c.ledger, "objects", rows[1].path as string), "utf8"));
          const late = journal.startedAtUTC.replace("Z", "001Z");
          rows[0].written_at = rows[1].written_at = late;
          replace(3, { dispatchedAtUTC: new Date(Date.parse(journal.startedAtUTC) + 1).toISOString() });
        } else replace(3, { operation: 2 });
        c.pins.acquisitionManifestSHA256 = run.manifest_sha256 = replace(rows.length - 1, manifest).sha256;
        if (kind === "journal before prior commit") {
          const path = join(c.evidenceDir, "OFFICIAL-FRAME.json"), frame = JSON.parse(readFileSync(path, "utf8"));
          frame.provenance.acquisitionManifestSHA256 = run.manifest_sha256;
          frame.provenance.boxscoreReceiptSHA256 = rows[3].sha256;
          c.pins.frameSHA256 = write(path, json(frame));
        }
        write(join(c.ledger, "run.json"), json(run));
        write(join(c.ledger, "objects.json"), json(rows));
        write(c.pinsPath, json(c.pins));
      }
      if (kind === "late claim" || kind === "late closure") {
        if (kind === "late claim") run.claimed_at = "2026-11-22T12:46:00Z";
        else run.closed_at = "2026-11-22T12:48:00Z";
        c.pins.evidenceAsOfUTC = "2026-11-22T13:00:00Z";
        write(join(c.ledger, "run.json"), json(run));
        write(c.pinsPath, json(c.pins));
      }
      if (kind === "resealed frame") {
        const file = join(c.evidenceDir,"OFFICIAL-FRAME.json"), frame = JSON.parse(readFileSync(file,"utf8"));
        c.pins.frameSHA256 = write(file,json({ ...frame, totalToiSeconds: frame.totalToiSeconds + 1 }));
        write(c.pinsPath,json(c.pins));
      }
      await expect(c.run()).rejects.toThrow(reason);
      expect(existsSync(c.out)).toBe(false);
    });
});
