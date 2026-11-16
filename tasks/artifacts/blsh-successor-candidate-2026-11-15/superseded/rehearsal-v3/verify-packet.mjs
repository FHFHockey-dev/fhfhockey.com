#!/usr/bin/env node
// Independent read-only readback of a BLSH native-capture packet.
// Imports nothing from the repository: it re-derives every check from the bytes on disk.
// Usage: node verify-packet.mjs <packetDir> <expected-pins.json> [--synthetic-adapter-ok]
// Successor candidate: TLS observations, their resumption/keep-alive bindings and RUNTIME.json are always required.
// Exit 0 = complete_pending_review (still NOT accepted evidence); 2 = vetoed.
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dir, pinsPath, ...flags] = process.argv.slice(2);
const syntheticOk = flags.includes("--synthetic-adapter-ok");
const requireTls = true;
const HEX64 = /^[0-9a-f]{64}$/;
const RUNTIME_ENV = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "all_proxy", "no_proxy"];
const ADAPTER_ENV = ["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NST_JOB_LIFECYCLE_ENABLED"];
const FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const reasons = [];
const veto = code => { if (!reasons.includes(code)) reasons.push(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const ORDER = ["schedule", "admission:individual", "nst:individual", "admission:onIce", "nst:onIce"];
const counts = { files: 0, started: 0, settled: 0, uncertain: 0, totalBytes: 0 };
let manifest = null;

function readJson(file) {
  try { return JSON.parse(readFileSync(join(dir, file), "utf8")); } catch { veto(`unreadable_json:${file}`); return null; }
}

try {
  const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
  const top = lstatSync(dir);
  if (!top.isDirectory() || top.isSymbolicLink()) veto("packet_not_directory");
  if ((top.mode & 0o777) !== 0o700) veto("packet_directory_mode_not_0700");
  if (top.uid !== process.getuid()) veto("packet_directory_not_owned_by_reader");
  const names = readdirSync(dir).sort();
  for (const name of names) {
    const st = lstatSync(join(dir, name));
    if (!st.isFile() || st.isSymbolicLink()) veto(`non_regular_entry:${name}`);
    if ((st.mode & 0o777) !== 0o600) veto(`file_mode_not_0600:${name}`);
    counts.files++; counts.totalBytes += st.size;
  }
  if (counts.totalBytes > 8 * 1024 * 1024 + 64 * 1024) veto("packet_exceeds_byte_budget");
  if (names.includes(".MANIFEST.json.tmp")) veto("unpublished_manifest_temp_present");
  if (names.includes("FAILED.json")) veto("failed_receipt_present");
  if (!names.includes("STARTED.json") || !names.includes("PLAN.json")) veto("missing_started_or_plan");

  // Operation journal: every STARTED needs its SETTLED; unmatched = possibly dispatched.
  const started = names.filter(n => /^operation-\d+-STARTED\.json$/.test(n));
  const ops = [];
  for (const file of started) {
    const index = Number(file.split("-")[1]);
    const s = readJson(file); counts.started++;
    const settledName = `operation-${index}-SETTLED.json`;
    const settled = names.includes(settledName) ? readJson(settledName) : null;
    if (settled) counts.settled++; else { counts.uncertain++; veto(`operation_${index}_started_without_settlement_possibly_dispatched`); }
    ops[index - 1] = { started: s, settled };
  }
  const plan = names.includes("PLAN.json") ? readJson("PLAN.json") : null;
  ops.forEach((op, i) => {
    if (!op) { veto(`operation_${i + 1}_missing`); return; }
    if (op.started?.operation !== ORDER[i]) veto(`operation_${i + 1}_out_of_order`);
    if (op.settled && op.settled.operation !== op.started?.operation) veto(`operation_${i + 1}_settlement_mismatch`);
    const name = ORDER[i];
    let expectedUrl = null;
    if (name === "schedule" && plan) expectedUrl = `https://api-web.nhle.com/v1/schedule/${plan.input?.date}`;
    if (name.startsWith("nst:") && plan) expectedUrl = plan.pages?.find(p => `nst:${p.group}` === name)?.url ?? null;
    if (name.startsWith("admission:")) expectedUrl = `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`;
    if (expectedUrl && op.started?.url !== expectedUrl) veto(`operation_${i + 1}_url_not_planned`);
    if (requireTls && op.settled) {
      const t = op.settled.tls;
      const shapeOk = !!t && typeof t === "object" && t.channel === "undici:client:sendHeaders" && typeof t.authorized === "boolean" && !!expectedUrl
        && t.servername === new URL(expectedUrl).hostname && typeof t.sessionReused === "boolean" && typeof t.connectionReused === "boolean"
        && Number.isSafeInteger(t.connectionSequence) && t.connectionSequence > 0
        && (t.peerCertificate === null ? t.sessionReused === true && t.authorized === true : FINGERPRINT.test(t.peerCertificate?.fingerprint256 ?? ""));
      if (!shapeOk) veto(`operation_${i + 1}_tls_observation_missing`);
      else {
        // Re-derive the bindings from earlier SETTLED records only.
        const earlier = ops.slice(0, i).map((o, j) => ({ index: j + 1, tls: o?.settled?.tls })).filter(o => o.tls && typeof o.tls === "object");
        const full = earlier.find(o => o.tls.servername === t.servername && o.tls.sessionReused === false && o.tls.connectionReused === false && o.tls.peerCertificate !== null);
        const opener = earlier.find(o => o.tls.connectionSequence === t.connectionSequence);
        const resumedOk = t.sessionReused ? t.authorized === true && !!full && t.resumedFromOperation === full.index : t.resumedFromOperation === null;
        const connectionOk = t.connectionReused ? !!opener && opener.tls.servername === t.servername && t.connectionFromOperation === opener.index : !opener && t.connectionFromOperation === null;
        if (!resumedOk || !connectionOk) veto(`operation_${i + 1}_tls_binding_invalid`);
      }
    }
    if (name.startsWith("admission:") && op.settled && op.settled.permit !== "allowed") veto(`operation_${i + 1}_permit_${op.settled.permit}`);
    if (!name.startsWith("admission:") && op.settled) {
      const t = op.settled.transport ?? {};
      if (t.httpStatus !== 200 || t.finalUrlMatchesRequested !== true || t.redirected !== false) veto(`operation_${i + 1}_transport_invalid`);
    }
  });
  if (started.length > 5) veto("more_than_five_operations");
  const nstStarts = ops.filter(op => op?.started?.operation?.startsWith("nst:")).map(op => Date.parse(op.started.startedAtUTC));
  if (nstStarts.length === 2 && nstStarts[1] - nstStarts[0] < 22_000) veto("nst_spacing_under_22s");

  // Source snapshots must equal STARTED bindings, and the frozen candidate pins.
  const startedJson = names.includes("STARTED.json") ? readJson("STARTED.json") : null;
  // Every role in the pins file must be bound, exactly once, and nothing else.
  const requiredRoles = Object.keys(pins).filter(k => !k.startsWith("_")).sort();
  const boundRoles = (startedJson?.sourceBindings ?? []).map(b => b.role).sort();
  if (JSON.stringify(requiredRoles) !== JSON.stringify(boundRoles)) veto("source_role_set_mismatch");
  for (const binding of startedJson?.sourceBindings ?? []) {
    if (!names.includes(binding.file)) { veto(`source_snapshot_missing:${binding.role}`); continue; }
    const actual = sha(readFileSync(join(dir, binding.file)));
    if (actual !== binding.sha256) veto(`source_snapshot_hash_changed:${binding.role}`);
    const expected = pins[binding.role];
    if (binding.role === "adapter" && syntheticOk) continue;
    if (!expected || expected !== actual) veto(`source_not_frozen_candidate:${binding.role}`);
  }
  if (startedJson && startedJson.supabaseOrigin !== ORIGIN) veto("wrong_project");

  // Packet-bound runtime receipt: present, bound to STARTED, presence booleans only.
  if (!names.includes("RUNTIME.json")) veto("runtime_receipt_missing");
  else {
    const rt = readJson("RUNTIME.json");
    if (!rt || rt.version !== "fhfh.blsh.native-capture-runtime.v1" || rt.startedAtUTC !== startedJson?.startedAtUTC || rt.supabaseOrigin !== ORIGIN
      || rt.lifecycleMode !== "disabled" || rt.valuesRecorded !== false) veto("runtime_receipt_incoherent");
    if (!/^v\d+\.\d+\.\d+$/.test(rt?.node?.version ?? "") || typeof rt?.node?.execPath !== "string" || !HEX64.test(rt?.node?.execPathSHA256 ?? "")
      || !Array.isArray(rt?.node?.execArgv) || !HEX64.test(rt?.tls?.rootCertificatesSHA256 ?? "")) veto("runtime_receipt_incomplete");
    for (const [group, keys] of [["environmentPresence", RUNTIME_ENV], ["adapterEnvironmentPresence", ADAPTER_ENV]]) {
      const value = rt?.[group] ?? {};
      if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()) || !Object.values(value).every(v => typeof v === "boolean")) veto(`runtime_${group}_not_presence_booleans`);
    }
    for (const key of RUNTIME_ENV) if (rt?.environmentPresence?.[key] === true) veto(`runtime_override_present:${key}`);
    if (!syntheticOk && !["NST_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"].every(key => rt?.adapterEnvironmentPresence?.[key] === true)) veto("runtime_adapter_environment_absent");
  }
  if (startedJson && startedJson.lifecycleMode !== "disabled") veto("lifecycle_not_disabled");

  // Retained evidence and provenance receipts.
  for (const [name, file] of [["schedule", "schedule.raw.json"], ["individual", "individual.parser-input.html"], ["onIce", "onIce.parser-input.html"]]) {
    const obsName = `${name}.TRANSPORT-OBSERVATION.json`;
    if (!names.includes(file)) { veto(`retained_missing:${file}`); continue; }
    if (!names.includes(obsName)) { veto(`provenance_missing:${obsName}`); continue; }
    const obs = readJson(obsName);
    const bytes = readFileSync(join(dir, file));
    if (!obs || obs.sha256 !== sha(bytes) || obs.bytes !== bytes.length || obs.file !== file) veto(`provenance_hash_mismatch:${name}`);
    if (obs && (obs.TLSVerified !== null || obs.independentlyAccepted !== false || obs.advancedAdmission !== false || obs.score !== null)) veto(`provenance_overclaims:${name}`);
    if (obs && name !== "schedule" && !(obs.parsedRows > 0 && obs.parsedRows <= 5000)) veto(`parsed_rows_out_of_bounds:${name}`);
    if (obs && JSON.stringify(obs.sourceBindings) !== JSON.stringify(startedJson?.sourceBindings)) veto(`provenance_source_binding_mismatch:${name}`);
    if (requireTls && obs) {
      const settledTls = ops.find(op => op?.started?.operation === (name === "schedule" ? "schedule" : `nst:${name}`))?.settled?.tls;
      if (!obs.tls || JSON.stringify(obs.tls) !== JSON.stringify(settledTls)) veto(`provenance_tls_mismatch:${name}`);
    }
  }

  // Credential echo scan on all non-source files.
  const secret = /(apikey|authorization:|bearer\s|service_role|eyJ[A-Za-z0-9_-]{16,}|[?&]key=(?!\[REDACTED\]))/i;
  for (const name of names.filter(n => !n.startsWith("source-"))) {
    // RUNTIME.json legitimately names SUPABASE_SERVICE_ROLE_KEY as a presence key; scan its values, not that key name.
    let body = readFileSync(join(dir, name), "latin1");
    if (name === "RUNTIME.json") body = body.split('"SUPABASE_SERVICE_ROLE_KEY":').join('"<presence-key>":');
    if (secret.test(body)) veto(`possible_credential_echo:${name}`);
  }

  // Completion marker last: present, coherent, and listing every other file exactly.
  if (!names.includes("MANIFEST.json")) veto("no_completion_manifest");
  else {
    manifest = readJson("MANIFEST.json");
    if (manifest?.state !== "packet_complete_pending_review" || manifest.operationCount !== 5 || manifest.lifecycleMode !== "disabled"
      || JSON.stringify(manifest.retained) !== JSON.stringify(["individual", "onIce"])
      || manifest.independentlyAccepted !== false || manifest.advancedAdmission !== false || manifest.score !== null) veto("manifest_incoherent");
    const listed = new Map((manifest?.files ?? []).map(f => [f.file, f]));
    for (const name of names.filter(n => n !== "MANIFEST.json")) if (!listed.has(name)) veto(`unlisted_file:${name}`);
    for (const [file, entry] of listed) {
      if (!names.includes(file)) { veto(`manifest_file_missing:${file}`); continue; }
      const bytes = readFileSync(join(dir, file));
      if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) veto(`manifest_hash_mismatch:${file}`);
    }
  }
} catch (error) {
  veto(`verifier_error:${error?.code ?? "unknown"}`);
}

const verdict = reasons.length === 0 ? "complete_pending_review" : "vetoed";
const result = { verdict, evidenceClass: verdict === "complete_pending_review" ? (syntheticOk ? "diagnostic_only_synthetic_adapter" : "candidate_pending_independent_source_review") : "not_evidence",
  reasons, counts, independentlyAccepted: false };
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = verdict === "complete_pending_review" ? 0 : 2;
