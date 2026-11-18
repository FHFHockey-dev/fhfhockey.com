// Offline custody of one completed official export. The independent review pins select the run, grant key and runtime.
import { createPublicKey, verify } from "node:crypto";
import { readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual as equal } from "node:util";
import { encode, isHash, MIB, need, parseJson, readBound, sha, stamp } from "../../../tasks/artifacts/blsh-evidence-bridge-2026-11-15/lib.mjs";
import { BUDGET, liveRoots, officialUrl } from "../../lib/blsh/nativeCaptureV6/officialPilotAcquisition.transport.mjs";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const runtimeFields = ["region", "nodeVersion", "nodeABI", "opensslVersion", "execPathSHA256", "routeBundleSHA256", "bundledCASHA256", "defaultCASHA256"];
const hasKeys = (value, names) => value && typeof value === "object" && !Array.isArray(value) && equal(Object.keys(value).sort(), [...names].sort());
export function evidenceMicros(value) {
  stamp(value);
  const micros = Date.parse(value) * 1000 + Number((value.match(/\.(\d{1,6})/)?.[1] ?? "").padEnd(6, "0").slice(3));
  need(Number.isSafeInteger(micros), "invalid_microsecond_timestamp");
  return micros;
}

function canonicalBase64(text, maxBytes) {
  need(typeof text === "string" && text.length > 0 && text.length <= 4 * Math.ceil(maxBytes / 3), "official_grant_encoding");
  const bytes = Buffer.from(text, "base64");
  need(bytes.length <= maxBytes && bytes.toString("base64") === text, "official_grant_encoding");
  return bytes;
}

function verifyGrant(runtime, target, pins) {
  const bytes = canonicalBase64(runtime.grantBase64, 3072);
  need(sha(bytes) === pins.acquisitionPinsSHA256, "official_grant_digest");
  const grant = parseJson(bytes), pem = pins.hostedOfficial.approvalPublicKey;
  need(hasKeys(grant, ["approval", "signature"]) && equal(grant.approval, target)
    && typeof pem === "string" && pem.length <= 512 && /^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PUBLIC KEY-----$/.test(pem.trim()), "official_grant_binding");
  const key = createPublicKey(pem), signature = canonicalBase64(grant.signature, 64);
  const signed = JSON.stringify(["fhfh.blsh.official-pilot-approval.v1", target.sourceDate, target.nativeRunId, target.nativeManifestSHA256,
    target.scheduleSHA256, target.deploymentId, target.gitCommitSha, target.gameIds]);
  need(signature.length === 64 && key.type === "public" && key.asymmetricKeyType === "ed25519"
    && verify(null, Buffer.from(signed), key, signature), "official_grant_signature");
}

export function readHostedOfficialV6Export(directory, pins, profile, nativeRunBytes, fixtureOnly = false) {
  const h = pins.hostedOfficial, native = parseJson(nativeRunBytes);
  need(hasKeys(h, ["runId", "deploymentId", "gitCommitSha", "approvalPublicKey", "runtime"]) && hasKeys(h.runtime, runtimeFields)
    && typeof h.runId === "string" && UUID.test(h.runId) && typeof h.deploymentId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(h.deploymentId)
    && typeof h.gitCommitSha === "string" && /^[a-f0-9]{40}$/.test(h.gitCommitSha)
    && isHash(pins.acquisitionPinsSHA256) && isHash(pins.acquisitionManifestSHA256), "official_hosted_pins");
  const gameIds = profile.completedGameIds;
  need(profile.status === "v6_packet_profile_checked_pending_independent_review" && pins.sourceDate === "2026-11-20"
    && pins.sourceDate === profile.sourceDate && pins.runId === profile.runId && native.run_id === profile.runId && native.source_date === profile.sourceDate
    && h.deploymentId === profile.deploymentId && h.gitCommitSha === profile.gitCommitSha
    && native.manifest_sha256 === profile.manifestSHA256 && native.state === "packet_complete_pending_review"
    && Array.isArray(gameIds) && gameIds.length > 0 && gameIds.length <= BUDGET.maxGames
    && gameIds.every((g, i) => Number.isSafeInteger(g) && /^202602\d{4}$/.test(String(g)) && (!i || gameIds[i - 1] < g)), "official_hosted_native_binding");
  const target = { sourceDate: profile.sourceDate, nativeRunId: profile.runId, nativeManifestSHA256: profile.manifestSHA256,
    scheduleSHA256: profile.bodies.schedule.sha256, deploymentId: h.deploymentId, gitCommitSha: h.gitCommitSha, gameIds };
  const root = realpathSync(directory);
  const read = (name, limit) => {
    const path = join(root, name);
    need(realpathSync(path) === path, "official_export_path_mismatch");
    return readBound(path, limit);
  };
  const runBytes = read("run.json", 65536), objectsBytes = read("objects.json", 65536);
  const run = parseJson(runBytes), rows = parseJson(objectsBytes);
  need(run.run_id === h.runId && run.state === "packet_complete_pending_review" && run.reason === null && run.manifest_sha256 === pins.acquisitionManifestSHA256
    && run.source_date === target.sourceDate && run.native_run_id === target.nativeRunId && run.native_manifest_sha256 === target.nativeManifestSHA256
    && run.deployment_id === h.deploymentId && run.git_commit_sha === h.gitCommitSha && run.schedule_sha256 === target.scheduleSHA256 && equal(run.game_ids, gameIds),
  "official_hosted_run_mismatch");
  const claimed = evidenceMicros(run.claimed_at), closed = evidenceMicros(run.closed_at);
  const opens = evidenceMicros("2026-11-21T12:45:00Z"), expires = evidenceMicros("2026-11-21T12:46:00Z");
  need(evidenceMicros(native.closed_at) <= claimed && opens <= claimed && claimed < expires && claimed <= closed
    && closed <= evidenceMicros(pins.evidenceAsOfUTC), "official_hosted_ledger_clock");
  const names = ["RUNTIME.json", ...gameIds.flatMap((g, i) => [`operation-${i + 1}-STARTED.json`, `boxscore-${g}.body.json`, `boxscore-${g}.receipt.json`]), "MANIFEST.json"];
  const prefix = `official-v1/${target.sourceDate}/${h.runId}/`;
  need(Array.isArray(rows) && rows.length === names.length, "official_hosted_index_count");
  const sorted = [...rows].sort((a, b) => a.ordinal - b.ordinal), files = new Map(), written = [];
  const objectDir = join(root, "objects", prefix.slice(0, -1));
  need(realpathSync(objectDir) === objectDir && equal(readdirSync(objectDir).sort(), [...names].sort()), "official_hosted_object_set");
  let prior = claimed;
  const descriptors = names.map((file, i) => {
    const row = sorted[i], path = prefix + file, game = Math.floor((i - 1) / 3), journal = file.startsWith("operation-");
    const max = file.endsWith(".body.json") ? 4 * MIB : file.endsWith(".receipt.json") ? 384 * 1024 : 65536;
    need(row.run_id === h.runId && row.ordinal === i + 1 && row.path === path && isHash(row.sha256)
      && Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes <= max
      && row.game_ordinal === (journal ? game + 1 : null) && row.game_id === (journal ? gameIds[game] : null)
      && row.intent_url === (journal ? officialUrl(gameIds[game]) : null), "official_hosted_index_mismatch");
    const at = evidenceMicros(row.written_at);
    need(prior <= at && at <= closed, "official_hosted_index_clock");
    prior = at; written.push(at);
    const bytes = read(join("objects", path), row.bytes);
    need(bytes.length === row.bytes && sha(bytes) === row.sha256, "official_hosted_object_digest");
    files.set(file, bytes);
    return { file, bytes: row.bytes, sha256: row.sha256 };
  });
  const runtime = parseJson(files.get("RUNTIME.json")), manifest = parseJson(files.get("MANIFEST.json"));
  const klass = fixtureOnly ? "loopback_fixture_only" : "vercel_direct_https";
  const identity = { runId: h.runId, ...target, acquisitionPinsSHA256: pins.acquisitionPinsSHA256 };
  const roots = fixtureOnly ? [runtime.fixtureCA] : liveRoots();
  need(runtime.acquisitionClass === klass && (!fixtureOnly || (typeof runtime.fixtureCA === "string" && runtime.fixtureCA.startsWith("-----BEGIN CERTIFICATE-----")))
    && equal(runtime, {version: "fhfh.blsh.official-pilot-runtime.v1", acquisitionClass: klass, ...identity, grantBase64: runtime.grantBase64, startedAtUTC: runtime.startedAtUTC,
      supabaseOrigin: "https://fyhftlxokyjtpndbkfse.supabase.co", ...h.runtime, overrideKeysPresent: [], ...(fixtureOnly ? {fixtureCA: runtime.fixtureCA} : {})}),
  "official_hosted_runtime_profile");
  need(runtime.region === "iad1" && /^v22\.\d+\.\d+$/.test(runtime.nodeVersion)
    && runtime.nodeABI === "127" && typeof runtime.opensslVersion === "string" && runtime.opensslVersion.length > 0
    && ["execPathSHA256", "routeBundleSHA256", "bundledCASHA256", "defaultCASHA256"].every(k => isHash(runtime[k]))
    && runtime.bundledCASHA256 === sha(roots.join("\n")) && (fixtureOnly || runtime.defaultCASHA256 === runtime.bundledCASHA256), "official_hosted_runtime_pins");
  verifyGrant(runtime, target, pins);
  need(descriptors.at(-1).sha256 === pins.acquisitionManifestSHA256 && equal(manifest, {version: "fhfh.blsh.official-pilot-manifest.v1",
    status: "acquisition_complete_pending_review", ...identity, requests: gameIds.length, retries: 0, completedAtUTC: manifest.completedAtUTC, files: descriptors.slice(0, -1)}),
  "official_hosted_manifest_mismatch");
  const started = evidenceMicros(runtime.startedAtUTC), completed = evidenceMicros(manifest.completedAtUTC);
  need(claimed <= started && started < expires && started <= written[0] && started <= completed && completed <= written.at(-1)
    && completed >= written.at(-2) && closed - started <= BUDGET.totalMs * 1000 && closed - claimed <= 225_000_000, "official_hosted_runtime_clock");
  for (const [i, g] of gameIds.entries()) {
    const j = 3*i + 1, journal = parseJson(files.get(names[j])), receipt = parseJson(files.get(`boxscore-${g}.receipt.json`));
    const began = evidenceMicros(journal.startedAtUTC);
    need(written[j - 1] <= began && began <= written[j] && written[j] <= evidenceMicros(receipt.dispatchedAtUTC)
      && evidenceMicros(receipt.retrievedAtUTC) <= written[j + 1], "official_hosted_intent_chronology");
  }
  return { runBytes, objectsBytes, files, gameIds, runtime, manifest, roots, klass, started, completed,
    provenance: { officialRunId: h.runId, deploymentId: h.deploymentId, gitCommitSha: h.gitCommitSha, routeBundleSHA256: runtime.routeBundleSHA256,
      profileSHA256: sha(encode(profile)) } };
}
