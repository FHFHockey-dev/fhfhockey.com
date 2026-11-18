/**
 * Offline, held one-date/skater comparison. From web/ under Node 22:
 * ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"Node16","moduleResolution":"Node16"}' scripts/blsh/prepareV6Observation.ts EXPORT LEDGER_PINS EVIDENCE REVIEW_PINS NEW_PRIVATE_DIR
 *
 * EXPORT and LEDGER_PINS follow readNativeV6Ledger.ts. EVIDENCE contains context-ledger/ (the request run row, eight index rows and their original
 * Storage bytes), OFFICIAL-FRAME.json and official/
 * (the entire untouched acquisition directory: manifest, tool, runtime, ordered journals,
 * boxscore bodies and v6 acquisition pins and matching v6 receipts). REVIEW_PINS is an independently held JSON object
 * with sourceDate, runId, playerId, evidenceAsOfUTC, contextSHA256, requestSHA256, frameSHA256, acquisitionPinsSHA256 and acquisitionManifestSHA256,
 * plus contextRunId, contextManifestSHA256, contextDeploymentId and contextGitCommitSha.
 * Neither pins file may be inside an input directory. Output is a new private directory outside
 * the checkout and inputs. No native receipt or installable bundle is emitted.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { readRequestContextV6Export } from "./readRequestContextV6";
import { timestamp } from "../../lib/blsh/nativeCaptureV6/packetFormat";
import { readNativeV6Ledger, readNativeV6LedgerExport } from "./readNativeV6Ledger";

const root = resolve(__dirname, "../../..");
const inside = (directory: string, path: string) => {
  const rel = relative(directory, path);
  return rel !== ".." && !rel.startsWith(".." + sep);
};

export async function prepareV6Observation(exportDir: string, ledgerPinsPath: string, evidenceDir: string, reviewPinsPath: string, newDir: string, fixtureOnly = false) {
  const { createOutput, need, parseJson, readBound, sha, MIB } = await import("../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs");
  const { reviewNativeV6Packet } = await import("./reviewNativeV6Packet.mjs");
  const { compareV6ObservationInputs } = await import("./prepareV6ObservationEvidence.mjs");
  const ledger = realpathSync(exportDir), evidence = realpathSync(evidenceDir);
  const pinsFile = realpathSync(ledgerPinsPath), reviewFile = realpathSync(reviewPinsPath);
  const destination = join(realpathSync(dirname(resolve(newDir))), basename(resolve(newDir)));
  need([pinsFile, reviewFile].every(file => !inside(ledger, file) && !inside(evidence, file)) && pinsFile !== reviewFile, "pins_must_be_independent_files");
  need(!inside(root, destination) && !inside(ledger, destination) && !inside(evidence, destination), "private_output_must_be_external");
  const verified = readNativeV6LedgerExport(ledger, pinsFile);
  const profile = reviewNativeV6Packet(verified);
  const bytes = new Map<string, Buffer>();
  const keep = (name: string, value: Buffer) => { need(!bytes.has(name), "duplicate_artifact_name"); bytes.set(name, value); };
  // Rebind the actual metadata bytes being exported to the same verified packet buffers.
  const run = readBound(join(ledger, "run.json"), 65536), objects = readBound(join(ledger, "objects.json"), 65536), pins = readBound(pinsFile, 65536);
  const rebound = readNativeV6Ledger(parseJson(run), parseJson(objects), parseJson(pins), path => verified.files.get(basename(path))!);
  need(JSON.stringify(rebound.receipt) === JSON.stringify(verified.receipt), "ledger_metadata_changed");
  keep("ledger-run.json", run); keep("ledger-objects.json", objects); keep("ledger-pins.json", pins);
  for (const [name, value] of verified.files) keep("packet-" + name, value);
  const reviewBytes = readBound(reviewFile, 65536), reviewPins = parseJson(reviewBytes);
  const contextDir = join(evidence, "context-ledger");
  need(realpathSync(contextDir) === contextDir, "context_export_path_mismatch");
  const context = readRequestContextV6Export(contextDir, {
    sourceDate: profile.sourceDate, nativeRunId: profile.runId, nativeManifestSHA256: profile.manifestSHA256,
    runId: reviewPins.contextRunId, manifestSHA256: reviewPins.contextManifestSHA256,
    deploymentId: reviewPins.contextDeploymentId, gitCommitSha: reviewPins.contextGitCommitSha,
  });
  need(timestamp(parseJson(run).closed_at) <= timestamp(context.receipt.claimedAtUTC), "context_claim_precedes_native_close");
  need(timestamp(context.receipt.closedAtUTC) <= timestamp(reviewPins.evidenceAsOfUTC), "context_closed_after_review_cutoff");
  for (const group of ["individual", "onIce"] as const) {
    need(timestamp(context.receipt.nativeRetrievedAtUTC[group]) === timestamp(profile.bodies[group].retrievedAtUTC), "context_native_retrieval_mismatch");
  }
  keep("context-ledger-run.json", context.runBytes); keep("context-ledger-objects.json", context.objectRowsBytes);
  keep("context-MANIFEST.json", context.files.get("MANIFEST.json")!); keep("context-RESULT.json", context.files.get("RESULT.json")!);
  const comparison = compareV6ObservationInputs(profile, verified.files, evidence, reviewPins, keep, run, fixtureOnly, context);
  keep("review-pins.json", reviewBytes);
  const parserSource = readBound(join(__dirname, "prepareV6ObservationEvidence.mjs"), MIB);
  const contextBuilderSource = readBound(join(root, "web/lib/blsh/nativeCaptureV6/requestContext.ts"), MIB);
  keep("comparison-source.mjs", parserSource);
  keep("request-context-builder.ts", contextBuilderSource);
  const sourceFiles = Object.entries(profile.sourceFiles).map(([path, pin]) => {
    const value = execFileSync("git", ["--no-replace-objects", "--no-lazy-fetch", "cat-file", "blob", profile.gitCommitSha + ":" + path],
      { cwd: root, maxBuffer: MIB, stdio: ["ignore", "pipe", "ignore"] });
    need(sha(value) === pin, "producer_source_bytes_changed");
    const name = "source-" + path.replaceAll("/", "_");
    keep(name, value);
    return { path, file: name, sha256: pin };
  });
  const report = { version: "fhfh.blsh.v6-held-skater-observation.v1", status: fixtureOnly ? "fixture_only_held_observation" : "held_pending_independent_acquisition_and_lineage_review",
    sourceDate: profile.sourceDate, runId: profile.runId, playerId: reviewPins.playerId, evidenceAsOfUTC: reviewPins.evidenceAsOfUTC,
    contextSHA256: reviewPins.contextSHA256, requestSHA256: reviewPins.requestSHA256, acquisitionManifestSHA256: reviewPins.acquisitionManifestSHA256, acquisitionPinsSHA256: reviewPins.acquisitionPinsSHA256,
    contextRun: context.receipt, comparison, sourceFiles, comparisonSourceSHA256: sha(parserSource), contextBuilderSHA256: sha(contextBuilderSource),
    officialAcquisitionQualified: false, frozenGateLineageExecuted: false,
    pending: ["independent_v6_official_acquisition_review", "independent_official_frame_and_native_cell_lineage_review"],
    acceptedWitnesses: 0, independentlyAccepted: false, advancedAdmission: false, currentUseQualified: false, score: null };
  const out = createOutput(destination);
  for (const [name, value] of bytes) out.write(name, value);
  out.writeJson("V6-PROFILE.json", profile);
  out.writeJson("HELD-OBSERVATION.json", report);
  const manifestSHA256 = out.complete(report.status);
  return { status: report.status, acceptedWitnesses: 0, currentUseQualified: false, score: null, manifestSHA256 };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 5 && !(args.length === 6 && args[5] === "--fixture-only")) { process.stderr.write("Usage: prepareV6Observation.ts EXPORT LEDGER_PINS EVIDENCE REVIEW_PINS NEW_PRIVATE_DIR\n"); process.exitCode = 1; }
  else void prepareV6Observation(args[0], args[1], args[2], args[3], args[4], args[5] === "--fixture-only")
    .then(report => process.stdout.write(JSON.stringify(report) + "\n"))
    .catch(error => { process.stderr.write((error instanceof Error ? error.message : "observation_export_refused") + "\n"); process.exitCode = 1; });
}
