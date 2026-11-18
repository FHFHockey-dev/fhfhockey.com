// Standalone official NHL read. Default invocation only rechecks the local ledger/profile and prints intended pins.
// From web: node scripts/blsh/acquireV6Official.mjs EXPORT LEDGER_PINS
// A separately authorized operator may add: --authorized-get INDEPENDENT_ACQUISITION_PINS
import { execFileSync } from "node:child_process";
import { closeSync, fsyncSync, openSync, readFileSync, realpathSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { BUDGET } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/acquire-boxscores.mjs";
import { createOutput, encode, MIB, need, parseJson, readBound, sha, stamp } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs";

import { BUDGET as providerBudget, getBox, liveRoots, officialUrl, verifyOfficialTLS } from "../../lib/blsh/nativeCaptureV6/officialPilotAcquisition.transport.mjs";
export { BUDGET, liveRoots, officialUrl, verifyOfficialTLS };
need(isDeepStrictEqual(BUDGET, providerBudget), "official_provider_budget_changed");

const self = fileURLToPath(import.meta.url), web = resolve(dirname(self), "../..");
const bridge = resolve(web, "../tasks/artifacts/blsh-evidence-bridge-2026-11-15");
export const fixedOutput = date => join(userInfo().homedir, ".fhfh-blsh-official-v6-" + date);
const bundledHash = roots => sha(roots.join("\n"));
const nodeHash = () => sha(readFileSync(process.execPath));
const syncDirectory = path => { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };

export function captureBinding(profile, runBytes, acquisitionNodeSHA256 = nodeHash()) {
  const run = parseJson(runBytes);
  need(profile.status === "v6_packet_profile_checked_pending_independent_review" && run.run_id === profile.runId
    && run.source_date === profile.sourceDate && run.manifest_sha256 === profile.manifestSHA256, "official_ledger_binding_invalid");
  const gameIds = profile.completedGameIds;
  need(Array.isArray(gameIds) && gameIds.length > 0 && gameIds.length <= BUDGET.maxGames
    && gameIds.every((id, i) => /^202602\d{4}$/.test(String(id)) && Number.isSafeInteger(id) && (!i || gameIds[i - 1] < id)), "official_slate_invalid");
  stamp(run.closed_at);
  return { version: "fhfh.blsh.v6-official-acquisition-pins.v1", sourceDate: profile.sourceDate, runId: profile.runId,
    deploymentId: profile.deploymentId, gitCommitSha: profile.gitCommitSha, manifestSHA256: profile.manifestSHA256,
    profileSHA256: sha(encode(profile)), ledgerRowSHA256: sha(runBytes), ledgerClosedAtUTC: run.closed_at,
    scheduleSHA256: profile.bodies.schedule.sha256, gameIds,
    toolSHA256: sha(readBound(self, MIB)), transportSHA256: sha(readBound(join(web, "lib/blsh/nativeCaptureV6/officialPilotAcquisition.transport.mjs"), MIB)),
    budgetSourceSHA256: sha(readBound(join(bridge, "acquire-boxscores.mjs"), MIB)),
    helperSHA256: sha(readBound(join(bridge, "lib.mjs"), MIB)), ledgerReaderSHA256: sha(readBound(join(dirname(self), "readNativeV6Ledger.ts"), MIB)),
    packetFormatSHA256: sha(readBound(join(web, "lib/blsh/nativeCaptureV6/packetFormat.ts"), MIB)),
    profileReaderSHA256: sha(readBound(join(dirname(self), "reviewNativeV6Packet.mjs"), MIB)),
    converterSHA256: sha(readBound(join(bridge, "convert.mjs"), MIB)),
    nodeSHA256: acquisitionNodeSHA256, bundledCASHA256: bundledHash(liveRoots()) };
}

// The profile runs in a separate offline process. Read the exact row before and after that verifier runs.
export function readAcquisitionPlan(exportDir, ledgerPins) {
  const rowPath = join(realpathSync(exportDir), "run.json"), row = readBound(rowPath, 65536);
  const profile = parseJson(execFileSync(process.execPath, [join(web, "node_modules/ts-node/dist/bin.js"), "--transpile-only",
    "--compiler-options", '{"module":"Node16","moduleResolution":"Node16"}', join(dirname(self), "readNativeV6Ledger.ts"),
    realpathSync(exportDir), realpathSync(ledgerPins)], { cwd: web, env: { PATH: "/usr/bin:/bin:/usr/local/bin" }, timeout: 30000, maxBuffer: MIB }));
  need(readBound(rowPath, 65536).equals(row), "official_ledger_changed");
  return captureBinding(profile, row);
}

function readExternalPins(file, directory, ledgerPins) {
  const path = realpathSync(file), rel = relative(realpathSync(directory), path);
  need((rel === ".." || rel.startsWith(".." + sep)) && path !== realpathSync(ledgerPins), "acquisition_pins_must_be_external");
  return readBound(path, 65536);
}

async function acquire(exportDir, ledgerPins, pinsFile, fixture) {
  if (!fixture) need(process.execArgv.length === 0 && resolve(process.argv[1]) === self
    && Object.keys(process.env).every(key => ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"].includes(key)), "official_clean_direct_launch_required");
  const expected = readAcquisitionPlan(exportDir, ledgerPins), pinBytes = readExternalPins(pinsFile, exportDir, ledgerPins);
  need(isDeepStrictEqual(expected, parseJson(pinBytes)), "official_independent_capture_pins_mismatch");
  const outDir = fixture?.outDir ?? fixedOutput(expected.sourceDate), inputHash = sha(pinBytes);
  const roots = fixture ? [fixture.ca] : liveRoots(), t0 = Date.now(), monotonicStart = performance.now(), startedAtUTC = new Date(t0).toISOString();
  const fractionalMicros = (expected.ledgerClosedAtUTC.match(/\.(\d{1,6})/)?.[1] ?? "").padEnd(6, "0").slice(3);
  need(t0 * 1000 >= Date.parse(expected.ledgerClosedAtUTC) * 1000 + Number(fractionalMicros), "official_acquisition_precedes_close");
  const out = createOutput(outDir); syncDirectory(dirname(outDir));
  const runtime = { version: "fhfh.blsh.v6-official-acquisition-runtime.v1", acquisitionClass: fixture ? "loopback_fixture_only" : "direct_https",
    acquisitionPinsSHA256: inputHash, toolSHA256: expected.toolSHA256, rootStoreSHA256: bundledHash(roots),
    outputDirectory: outDir, startedAtUTC, ...(fixture ? { fixtureCA: fixture.ca } : {}) };
  let completed = 0, previousRetrieval = t0;
  try {
    out.write("source-tool.mjs", readBound(self, MIB)); out.write("ACQUISITION-PINS.json", pinBytes); out.writeJson("ACQUISITION-RUNTIME.json", runtime);
    for (const [k, id] of expected.gameIds.entries()) {
      if (k) await new Promise(done => setTimeout(done, BUDGET.spacingMs));
      const operation = k + 1, url = officialUrl(id), started = Date.now(), journalMono = performance.now();
      need(previousRetrieval + (k ? BUDGET.spacingMs : 0) <= started, "official_acquisition_chronology");
      need(started + BUDGET.perRequestTimeoutMs <= t0 + BUDGET.totalMs && journalMono - monotonicStart + BUDGET.perRequestTimeoutMs <= BUDGET.totalMs, "official_acquisition_deadline");
      const journal = { operation, method: "GET", url, acquisitionPinsSHA256: inputHash, startedAtUTC: new Date(started).toISOString() };
      const journalSHA256 = out.writeJson(`operation-${operation}-STARTED.json`, journal);
      syncDirectory(outDir);
      const result = await getBox(url, started, journalMono, t0, monotonicStart, fixture), retrievedAtUTC = new Date(Date.now()).toISOString();
      need(Date.parse(result.dispatchedAtUTC) <= Date.parse(retrievedAtUTC) && Date.parse(retrievedAtUTC) <= started + BUDGET.perRequestTimeoutMs
        && performance.now() <= journalMono + BUDGET.perRequestTimeoutMs, "official_request_deadline");
      previousRetrieval = Date.parse(retrievedAtUTC);
      const content = parseJson(result.body);
      need(content.id === id && content.gameDate === expected.sourceDate && content.season === 20262027 && content.gameType === 2
        && ["FINAL","OFF"].includes(content.gameState) && content.gameScheduleState === "OK", "official_game_scope");
      const bodyHash = out.write(`boxscore-${id}.body.json`, result.body);
      out.writeJson(`boxscore-${id}.receipt.json`, { version: "fhfh.blsh.v6-official-boxscore-receipt.v2", acquisitionPinsSHA256: inputHash,
        journalSHA256, acquisitionStartedAtUTC: startedAtUTC, operation, url, finalUrl: url, method: "GET", httpStatus: result.httpStatus,
        redirected: false, writeEvents: result.writes, dispatchedAtUTC: result.dispatchedAtUTC, retrievedAtUTC, sha256: bodyHash, bytes: result.body.length, tls: result.tls });
      syncDirectory(outDir); completed++;
    }
    const completionTime = () => {
      const now = Date.now();
      need(previousRetrieval <= now, "official_acquisition_chronology");
      need(now <= t0 + BUDGET.totalMs && performance.now() - monotonicStart <= BUDGET.totalMs, "official_acquisition_deadline");
      return now;
    };
    const manifestSHA256 = out.complete("acquisition_complete_pending_review", { acquisitionPinsSHA256: inputHash, requests: completed, retries: 0,
      completedAtUTC: new Date(completionTime()).toISOString() });
    completionTime(); // A late manifest fsync also leaves a FAILED marker and cannot return success.
    return { status: fixture ? "fixture_only_acquisition" : "official_acquisition_pending_independent_review", outDir, manifestSHA256,
      acquisitionPinsSHA256: inputHash, requests: completed, acceptedWitnesses: 0 };
  } catch (e) {
    out.writeJson("FAILED.json", { status: "partial_acquisition_not_evidence", completed, planned: expected.gameIds.length }); syncDirectory(outDir); throw e;
  }
}

export function acquireOfficialLoopbackFixture(exportDir, ledgerPins, pinsFile, fixture) {
  need(fixture && Number.isSafeInteger(fixture.port) && fixture.port > 0 && fixture.port <= 65535 && typeof fixture.ca === "string"
    && typeof fixture.outDir === "string" && resolve(fixture.outDir) !== fixedOutput(parseJson(readBound(ledgerPins, 65536)).sourceDate), "official_fixture_parameters");
  return acquire(exportDir, ledgerPins, pinsFile, fixture);
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  try {
    const args = process.argv.slice(2);
    need(args.length === 2 || (args.length === 4 && args[2] === "--authorized-get"), "usage_EXPORT_LEDGER_PINS_optional_authorized_get_ACQUISITION_PINS");
    const report = args.length === 2 ? { status: "offline_plan_no_requests", requests: 0, intendedPins: readAcquisitionPlan(...args) }
      : await acquire(args[0], args[1], args[3], null);
    process.stdout.write(JSON.stringify(report) + "\n");
  } catch (error) { process.stderr.write((error.code ?? "official_acquisition_refused") + "\n"); process.exitCode = 1; }
}
