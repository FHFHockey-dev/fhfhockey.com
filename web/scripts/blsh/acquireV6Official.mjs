// Standalone official NHL read. Default invocation only rechecks the local ledger/profile and prints intended pins.
// From web: node scripts/blsh/acquireV6Official.mjs EXPORT LEDGER_PINS
// A separately authorized operator may add: --authorized-get INDEPENDENT_ACQUISITION_PINS
import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, realpathSync } from "node:fs";
import { request } from "node:https";
import { userInfo } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import * as tls from "node:tls";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { BUDGET } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/acquire-boxscores.mjs";
import { createOutput, encode, MIB, need, parseJson, readBound, sha, stamp } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs";

export { BUDGET };

const self = fileURLToPath(import.meta.url), web = resolve(dirname(self), "../..");
const bridge = resolve(web, "../tasks/artifacts/blsh-evidence-bridge-2026-11-15");
const host = "api-web.nhle.com";
export const officialUrl = id => `https://${host}/v1/gamecenter/${id}/boxscore`;
export const fixedOutput = date => join(userInfo().homedir, ".fhfh-blsh-official-v6-" + date);
export const liveRoots = () => [...tls.rootCertificates];
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
    toolSHA256: sha(readBound(self, MIB)), budgetSourceSHA256: sha(readBound(join(bridge, "acquire-boxscores.mjs"), MIB)),
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

// Verify the actual leaf, its identity, validity intervals and signature chain against the enumerated roots.
// Each operation demands a fresh full handshake, so there is no inferred certificate from an earlier game.
export function verifyOfficialTLS(observed, roots, when) {
  need(observed?.servername === host && observed.authorized === true && observed.authorizationError === null
    && observed.channel === "https.ClientRequest:secureConnect" && observed.sessionReused === false && observed.connectionReused === false
    && ["TLSv1.2", "TLSv1.3"].includes(observed.protocol) && typeof observed.cipher === "string" && observed.cipher.length > 0
    && Array.isArray(observed.chainDER) && observed.chainDER.length > 0 && observed.chainDER.length <= 10, "official_tls_observation_invalid");
  const chain = observed.chainDER.map(der => {
    need(typeof der === "string" && der.length <= 32768 && /^[A-Za-z0-9+/]+=*$/.test(der), "official_certificate_invalid");
    const certificate = new X509Certificate(Buffer.from(der, "base64"));
    need(Date.parse(certificate.validFrom) <= when && when <= Date.parse(certificate.validTo), "official_certificate_time");
    return certificate;
  });
  need(chain[0].checkHost(host) && chain[0].fingerprint256 === observed.peerFingerprint256, "official_certificate_identity");
  for (let i = 1; i < chain.length; i++) need(chain[i].ca && chain[i-1].checkIssued(chain[i]) && chain[i-1].verify(chain[i].publicKey), "official_certificate_chain");
  const top = chain.at(-1);
  need(roots.some(pem => {
    const ca = new X509Certificate(pem);
    return ca.ca && Date.parse(ca.validFrom) <= when && when <= Date.parse(ca.validTo) &&
      (top.fingerprint256 === ca.fingerprint256 || (top.checkIssued(ca) && top.verify(ca.publicKey)));
  }), "official_certificate_untrusted");
}

function getBox(url, journalWall, journalMono, runWall, runMono, fixture) {
  return new Promise((resolveGet, reject) => {
    const endpoint = new URL(url), roots = fixture ? [fixture.ca] : liveRoots();
    let observation, writes = 0;
    const requestOptions = { method: "GET", agent: false, ca: roots, rejectUnauthorized: true, servername: host,
      headers: { Host: host, Accept: "application/json", "Accept-Encoding": "identity", Connection: "close" },
      // A fixture can only connect to numeric loopback. It can never route to a provider.
      ...(fixture ? { hostname: "127.0.0.1", port: fixture.port } : {}) };
    // The journal and its directory have been fsynced. Re-read both clocks at
    // the actual outbound boundary; journaling consumes the original operation budget.
    const dispatched = Date.now(), dispatchedMono = performance.now();
    const wallDeadline = journalWall + BUDGET.perRequestTimeoutMs, monoDeadline = journalMono + BUDGET.perRequestTimeoutMs;
    need(dispatched >= journalWall && dispatched < wallDeadline && dispatchedMono >= journalMono && dispatchedMono < monoDeadline, "official_request_deadline");
    need(dispatched + BUDGET.perRequestTimeoutMs <= runWall + BUDGET.totalMs
      && dispatchedMono + BUDGET.perRequestTimeoutMs <= runMono + BUDGET.totalMs, "official_acquisition_deadline");
    const req = request(url, requestOptions, response => {
      const chunks = []; let size = 0;
      const fail = error => { req.destroy(); response.destroy(); reject(error); };
      try {
        need(response.statusCode === 200 && !response.headers.location && ["identity", undefined].includes(response.headers["content-encoding"])
          && req.method === "GET" && req.path === endpoint.pathname && req.getHeader("host") === host
          && writes === 1 && observation, "official_transport_response_invalid");
      } catch (e) { fail(e); return; }
      response.on("data", chunk => {
        size += chunk.length;
        if (size > BUDGET.maxBodyBytes) { fail(new Error("official_body_limit")); return; }
        chunks.push(chunk);
      });
      response.once("error", fail);
      response.once("end", () => {
        if (!response.complete || !size) { fail(new Error("official_incomplete_body")); return; }
        resolveGet({ body: Buffer.concat(chunks), tls: observation, writes, httpStatus: response.statusCode, dispatchedAtUTC: new Date(dispatched).toISOString() });
      });
    });
    // Hard timeout covers resolution, handshake, headers and body, including a stalled stream.
    const timer = setTimeout(() => req.destroy(new Error("official_request_deadline")), Math.max(1, Math.min(wallDeadline - Date.now(), monoDeadline - performance.now())));
    req.once("close", () => clearTimeout(timer));
    req.once("error", reject);
    req.once("finish", () => { writes++; });
    req.once("socket", socket => socket.once("secureConnect", () => {
      try {
        const chainDER = [], seen = new Set(); let cert = socket.getPeerCertificate(true);
        while (cert?.raw && !seen.has(cert.fingerprint256)) {
          need(chainDER.length < 10, "official_certificate_chain_length");
          seen.add(cert.fingerprint256); chainDER.push(cert.raw.toString("base64")); cert = cert.issuerCertificate;
        }
        observation = { channel: "https.ClientRequest:secureConnect", servername: socket.servername, authorized: socket.authorized,
          authorizationError: socket.authorizationError || null, protocol: socket.getProtocol(), cipher: socket.getCipher()?.name,
          sessionReused: socket.isSessionReused(), connectionReused: req.reusedSocket === true, peerFingerprint256: socket.getPeerCertificate().fingerprint256, chainDER };
        verifyOfficialTLS(observation, roots, Date.now());
      } catch (error) { req.destroy(error); }
    }));
    req.end();
  });
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
