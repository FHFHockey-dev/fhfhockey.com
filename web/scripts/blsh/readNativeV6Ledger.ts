/** Offline first-stage readback. Supply an independently selected run/date and release
 * deployment-to-git mapping. A passing readback still needs the runtime, source and
 * evidence reviews. The verified file buffers are the ones to use for those reviews.
 *
 * From web/: ./node_modules/.bin/ts-node --transpile-only --compiler-options
 * '{"module":"Node16","moduleResolution":"Node16"}' scripts/blsh/readNativeV6Ledger.ts EXPORT_DIR PINS.json
 * EXPORT_DIR holds run.json (one blsh_capture_runs row), objects.json (its complete
 * blsh_capture_objects rows), and objects/<original storage key> for each object.
 * PINS.json is outside EXPORT_DIR and contains {sourceDate,runId,deploymentId,gitCommitSha}.
 */
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { selectSourceDate } from "../../lib/blsh/nativeCaptureV6/sourceDate";
import { packetObjectPath } from "../../lib/blsh/nativeCaptureV6/writer";

import { NATIVE_PACKET_FILES as FILES, matches, nativeObjectLimit, need, object, parseJSON, timestamp, validateNativeManifest } from "../../lib/blsh/nativeCaptureV6/packetFormat";

const GROUPS = ["individual", "onIce"];
const MIB = 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const COMPLETE = "packet_complete_pending_review";
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";

const millis = (micros: number) => Math.floor(micros / 1000);

export function readNativeV6Ledger(runValue: unknown, objectRows: unknown, pinValue: unknown, readBytes: (path: string, expectedBytes: number) => Uint8Array | Buffer) {
  const run = object(runValue), pins = object(pinValue);
  const { sourceDate, runId, deploymentId, gitCommitSha } = pins;
  need(matches(sourceDate, /^\d{4}-\d\d-\d\d$/) && matches(runId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
    && matches(deploymentId, /^[A-Za-z0-9_-]{1,128}$/) && matches(gitCommitSha, /^[0-9a-f]{40}$/), "independent_pins_invalid");
  need(run.pipeline === "native-v6" && run.run_id === runId && run.source_date === sourceDate, "run_identity_mismatch");
  if (run.state !== COMPLETE) {
    need(typeof run.state === "string" && ["claimed", "no_slate", "refused_schedule", "failed", "abandoned_uncertain"].includes(run.state), "run_state_invalid");
    throw new Error(`run_state_${run.state}`);
  }
  need(run.pruned_at === null, "run_pruned_or_retention_unknown");
  need(run.reason === null && matches(run.manifest_sha256, SHA256), "run_completion_invalid");
  const claimed = timestamp(run.claimed_at), closed = timestamp(run.closed_at);
  need(claimed <= closed, "run_time_mismatch");
  const claimDeployment = object(run.deployment);
  need(claimDeployment.deploymentId === deploymentId && (claimDeployment.gitCommitSha === gitCommitSha || claimDeployment.gitCommitSha === null),
    "claim_deployment_mismatch");

  need(Array.isArray(objectRows) && objectRows.length === FILES.length, "object_count_mismatch");
  // The export can arrive in any row order. The writer assigns the ordinal.
  const rows = objectRows.map(object);
  need(rows.every(row => typeof row.ordinal === "number" && Number.isInteger(row.ordinal)), "object_ordinal_invalid");
  rows.sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
  const files = new Map<string, Buffer>();
  let previousWrite = claimed, payloadBytes = 0;
  for (const [index, row] of rows.entries()) {
    need(row.ordinal === index + 1 && row.run_id === runId, "object_ordinal_or_run_mismatch");
    const name = FILES[index], path = packetObjectPath(sourceDate, runId, name);
    need(row.path === path, "object_path_mismatch");
    const written = timestamp(row.written_at);
    need(written >= previousWrite && written <= closed, "object_time_mismatch");
    previousWrite = written;
    const limit = nativeObjectLimit(name);
    need(typeof row.bytes === "number" && Number.isSafeInteger(row.bytes) && row.bytes >= 1 && row.bytes <= limit
      && matches(row.sha256, SHA256), "object_metadata_invalid");
    if (name !== "MANIFEST.json") payloadBytes += row.bytes;
    need(payloadBytes <= 8 * MIB, "packet_byte_limit");
    const downloaded = readBytes(path, row.bytes);
    need(downloaded instanceof Uint8Array && downloaded.byteLength === row.bytes, "object_size_mismatch");
    const bytes = Buffer.from(new Uint8Array(downloaded));
    need(createHash("sha256").update(new Uint8Array(bytes)).digest("hex") === row.sha256, "object_digest_mismatch");
    files.set(name, bytes);
  }
  need(rows.at(-1)!.sha256 === run.manifest_sha256, "closed_manifest_digest_mismatch");
  const json = (name: string) => object(parseJSON(new Uint8Array(files.get(name)!)));
  const manifest = json("MANIFEST.json");
  validateNativeManifest(manifest, runId, sourceDate, rows);
  const started = json("STARTED.json"), runtime = json("RUNTIME.json"), plan = object(json("PLAN.json").input);
  need(started.version === "fhfh.blsh.native-capture-run.v6" && started.runId === runId && started.sourceDate === sourceDate
    && runtime.version === "fhfh.blsh.native-capture-runtime.v6-vercel" && started.startedAtUTC === runtime.startedAtUTC
    && started.supabaseOrigin === ORIGIN && runtime.supabaseOrigin === ORIGIN && started.lifecycleMode === "disabled"
    && runtime.lifecycleMode === "disabled" && plan.date === sourceDate && plan.seasonId === 20262027, "packet_identity_mismatch");
  const planned = timestamp(plan.plannedAtUTC), start = timestamp(started.startedAtUTC), complete = timestamp(manifest.completedAtUTC);
  const selection = selectSourceDate(millis(planned));
  // The route selects D at ingress, before the switch read. PLAN carries the
  // later timestamp only. A delayed plan cannot prove when that invocation entered.
  if (!selection.ok && selection.reason === "outside_window") throw new Error("capture_ingress_window_unconfirmed");
  need(selection.ok && selection.sourceDate === sourceDate && planned <= claimed && millis(claimed) <= millis(start)
    && millis(start - planned) <= 15 * 60_000 && start <= complete && complete <= previousWrite && millis(complete - start) < 120_000, "packet_time_or_source_date_mismatch");

  const deployment = object(runtime.deployment), instance = object(runtime.instance);
  need(deployment.provider === "vercel" && deployment.env === "production" && deployment.deploymentId === deploymentId
    && deployment.gitCommitSha === claimDeployment.gitCommitSha && (deployment.routeBundleSHA256 === null || matches(deployment.routeBundleSHA256, SHA256))
    && deployment.region === claimDeployment.region && Number.isSafeInteger(instance.invocationOrdinal)
    && Number(instance.invocationOrdinal) >= 1 && instance.invocationOrdinal === claimDeployment.invocationOrdinal, "runtime_deployment_mismatch");
  for (const record of [started, ...["schedule", ...GROUPS].map(group => json(`${group}.TRANSPORT-OBSERVATION.json`))]) {
    const binding = object(record.deploymentBinding);
    need(binding.deploymentId === deploymentId && binding.gitCommitSha === deployment.gitCommitSha
      && binding.routeBundleSHA256 === deployment.routeBundleSHA256, "packet_deployment_binding_mismatch");
  }
  need(Array.isArray(run.operation_intents) && run.operation_intents.length === GROUPS.length, "run_intent_count_mismatch");
  // The intent RPC happens after the preceding retained observation checkpoint, before
  // this group's admission starts. Compare database stamps at their full precision.
  // Runner stamps record milliseconds, so a DB write in the same tick can precede them.
  let previousIntent = claimed;
  for (const [i, raw] of run.operation_intents.entries()) {
    const intent = object(raw), group = GROUPS[i], intended = timestamp(intent.intendedAtUTC);
    const checkpointOrdinal = i === 0 ? 7 : 13;
    const admission = json(`operation-${i === 0 ? 2 : 4}-STARTED.json`);
    need(intended >= timestamp(rows[checkpointOrdinal - 1].written_at) && intended <= timestamp(rows[checkpointOrdinal].written_at)
      && millis(intended) <= millis(timestamp(admission.startedAtUTC)), "run_intent_checkpoint_mismatch");
    need(intent.group === group && JSON.stringify(intent.operations) === JSON.stringify([`admission:${group}`, `nst:${group}`])
      && intended >= previousIntent && millis(intended) <= millis(complete), "run_intent_mismatch");
    previousIntent = intended;
  }

  return {
    receipt: { status: "offline_ledger_readback_pending_review" as const, state: COMPLETE, runId, sourceDate, deploymentId,
      gitCommitSha, manifestSHA256: run.manifest_sha256, objectCount: files.size, independentlyAccepted: false as const,
      advancedAdmission: false as const, score: null },
    files: files as ReadonlyMap<string, Buffer>,
  };
}

function boundedFile(path: string, maxBytes: number) {
  const stat = statSync(path);
  need(stat.isFile() && stat.size > 0 && stat.size <= maxBytes, "local_file_invalid");
  return new Uint8Array(readFileSync(path));
}

export function readNativeV6LedgerExport(exportDir: string, pinsFile: string) {
  const directory = realpathSync(exportDir), pinsPath = realpathSync(pinsFile);
  const pinsRelative = relative(directory, pinsPath);
  need(pinsRelative === ".." || pinsRelative.startsWith(`..${sep}`), "pins_must_be_external_to_export");
  const local = (name: string, maxBytes: number) => {
    const path = join(directory, name);
    need(realpathSync(path) === path, "export_symlink_refused");
    return boundedFile(path, maxBytes);
  };
  return readNativeV6Ledger(parseJSON(local("run.json", 64 * 1024)), parseJSON(local("objects.json", 64 * 1024)),
    parseJSON(boundedFile(pinsPath, 64 * 1024)), (path, expectedBytes) => local(join("objects", path), expectedBytes));
}

async function runCLI() {
  need(process.argv.length === 4, "Usage: readNativeV6Ledger.ts EXPORT_DIR PINS.json");
  const result = readNativeV6LedgerExport(process.argv[2], process.argv[3]);
  const { reviewNativeV6Packet } = await import("./reviewNativeV6Packet.mjs");
  process.stdout.write(JSON.stringify(reviewNativeV6Packet(result)) + "\n");
}

if (require.main === module) runCLI().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : "readback_failed"}\n`);
  process.exitCode = 1;
});
