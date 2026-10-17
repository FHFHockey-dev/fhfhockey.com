/** Standalone staged SDK runner. No application route, collection, scheduler or implicit execution. */
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { materializeNativeInputs, prepareNativeInputMaterialization, verifyNativeMaterialization, type NativeMaterializationRequest } from "../lib/player-forecasts/nativeInputMaterialization";
import { nativeCadenceClosureScope, nativeCadenceInputManifest, nativeCadenceJournalIds, publishObservedNativeBaselineCadence } from "../lib/player-forecasts/nativeBaselineCadence";
import { prepareNativeCatalogObservation } from "../lib/player-forecasts/nativeCatalogHead";
import { prepareNativeCadenceOutputs } from "../lib/player-forecasts/nativeCadenceOutputPreparation";
import { validateNativeBaselinePublication } from "../lib/player-forecasts/nativeBaselinePublication";
import { matchesPlannedObservation, SOURCE_OBSERVATION_COLUMNS, playerForecastSourcePayloadHash as hash, validPlannedObservationId, type PlannedSourceObservation } from "../lib/player-forecasts/sourceSnapshot";
import { timestampMicros } from "../lib/projections/evidenceTime";

export const CADENCE_RUNNER_LIMITS = Object.freeze({ inputBytes: 64 * 1024 * 1024, publishBytes: 48 * 1024 * 1024,
  rowBytes: 8 * 1024 * 1024, uploadBytes: 64 * 1024 * 1024, responseBytes: 48 * 1024 * 1024,
  downloadBytes: 256 * 1024 * 1024, requests: 1320, requestMs: 8000, totalMs: 180000 });
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const HEAD_COLUMNS = "id,season_id,revision,observation_id,payload_hash,selected_at";
const RELEASE_COLUMNS = "id,provider,dataset_key,entity_key,available_at,payload_hash,payload";
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const fail = (reason: string): never => { throw new Error(reason); };
export function boundedFile(path: string, expected: string, limit: number) {
  if (!/^[a-f0-9]{64}$/.test(expected)) fail("exact_file_hash_required");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size <= 0 || before.size > limit) fail("file_byte_bound");
    const bytes = new Uint8Array(before.size + 1); let length = 0, count = 0;
    while (length < bytes.length && (count = readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
    const after = fstatSync(fd);
    if (length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || sha(bytes.subarray(0, length)) !== expected) fail("file_changed_or_hash_mismatch");
    return JSON.parse(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes.subarray(0, length)));
  } finally { closeSync(fd); }
}
export function privateWrite(path: string, value: unknown) {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
}
type PublishCommand = { version: "native-cadence-command-v1";
  cadenceInput: Parameters<typeof publishObservedNativeBaselineCadence>[0];
  producerReceiptIds: Record<string, string>;
  catalogHead: { headId: string; expectedRevision: number; expectedHash: string | null; observationId: string } };
type Proof = { status: string; rows: PlannedSourceObservation[]; report: PlannedSourceObservation; closure: PlannedSourceObservation };

/** Dry-run proof is self-consistency evidence only. Execution independently reads the durable originals. */
export async function validateCadenceCommand(command: PublishCommand, proof: Proof, now: Date) {
  if (command?.version !== "native-cadence-command-v1" || !proof || proof.status !== "closed"
    || !Array.isArray(proof.rows) || proof.rows.length > 318) fail("closed_materialization_proof_required");
  const input = structuredClone(command.cadenceInput); input.cadence.now = now;
  const rows = [...proof.rows, proof.report, proof.closure];
  const local: any = { from() { let selected = rows.slice(); const query: any = { select: () => query, limit: (n: number) => { selected = selected.slice(0, n); return query; },
    eq: (key: string, value: unknown) => { selected = selected.filter(row => (row as any)[key] === value); return query; }, abortSignal: () => query,
    then: (ok: any, no: any) => Promise.resolve({ data: selected, error: null }).then(ok, no) }; return query; } };
  await verifyNativeMaterialization(local, proof.closure);
  const closure = proof.closure.payload as any, manifest = nativeCadenceInputManifest(input.publicationPlan);
  const required = input.requiredAcquisitionScopes?.[closure.sourceKey ?? (proof.report.payload as any).sourceKey];
  if (closure.scopeHash !== nativeCadenceClosureScope(input) || closure.inputRevision !== manifest.revision
    || closure.expectedItems !== manifest.expectedItems || !required || required.scopeHash !== closure.acquisitionScopeHash
    || required.cutoffAt !== closure.inputCutoffAt
    || input.cadence.requiredSources.length !== 1 || input.cadence.requiredSources[0] !== (proof.report.payload as any).sourceKey
    || command.producerReceiptIds[(proof.report.payload as any).sourceKey] !== proof.closure.id) fail("materialization_publication_scope_mismatch");
  const closedAt = timestampMicros(closure.closedAt);
  for (const row of input.publicationPlan.rows) {
    const payload = row.payload as any;
    const issued = payload.manifest?.issuedAt ?? (row.entity_kind === "participation_bundle" ? payload.issuedAt : null);
    if (issued !== null && (closedAt === null || timestampMicros(issued) === null || timestampMicros(issued)! < closedAt)) fail("outputs_must_be_issued_after_closed_inputs");
  }
  const validation = await validateNativeBaselinePublication(input.publicationPlan, now);
  return { input, validation };
}

/** Adapted from the reviewed native-publication-runner transport: exact host/path,
 * durable intent before reservation, BYOB bounded original bytes, no retries or redirects. */
export class CadenceTransport {
  requests = 0; inserts = 0; uploaded = 0; downloaded = 0;
  private active = false; private writesStopped = false; private casAttempted = false;
  private started: number; private writes = new Set<string>();
  private expected = new Map<string, PlannedSourceObservation>();
  constructor(private configuration: { materialization?: NativeMaterializationRequest; prepared?: ReturnType<typeof prepareNativeInputMaterialization>;
    command?: PublishCommand; proof?: Proof; selection?: PlannedSourceObservation }, private network: typeof fetch,
    private event: (action: string, fields: Record<string, unknown>) => void, private monotonic = () => performance.now()) {
    this.started = monotonic();
    for (const row of [...(configuration.prepared?.rows ?? []), ...(configuration.proof?.rows ?? []),
      ...(configuration.command?.cadenceInput.publicationPlan.rows ?? []), ...[configuration.proof?.report, configuration.proof?.closure, configuration.selection].filter(Boolean) as PlannedSourceObservation[]]) {
      const old = this.expected.get(row.id); if (old && !matchesPlannedObservation(old, row)) fail("conflicting_planned_row"); this.expected.set(row.id, row);
    }
    if (configuration.prepared) for (const row of [configuration.prepared.report, configuration.prepared.closure]) this.expected.set(row.id, row);
  }
  private allowed(row: any): boolean {
    const expected = this.expected.get(row?.id);
    if (expected && matchesPlannedObservation(row, expected)) return true;
    const request = this.configuration.materialization;
    if (request && ["input_materialization", "producer_closure"].includes(row?.entity_kind)) {
      const closedAt = row.payload?.closedAt;
      if (timestampMicros(closedAt) === null || timestampMicros(closedAt)! > BigInt(Date.now()) * BigInt(1000)) return false;
      const prepared = prepareNativeInputMaterialization(request, closedAt);
      const match = [prepared.report, prepared.closure].find(candidate => matchesPlannedObservation(row, candidate));
      if (match) { this.expected.set(row.id, match); return true; }
    }
    const command = this.configuration.command, payload = row?.payload;
    if (command && payload && row.dataset_key === "native-baseline-cadence-slot-v1") {
      const input = command.cadenceInput, identities = nativeCadenceJournalIds(input.publicationPlan.seasonId, input.slotKey);
      const identity = identities.find(value => value.id === row.id);
      if (!identity || payload.version !== row.dataset_key || payload.seasonId !== input.publicationPlan.seasonId || payload.slotKey !== input.slotKey
        || Object.keys(payload).some(key => !["version", "seasonId", "slotKey", "attempt", "phase", "owner", "packageHash", "inputRevision", "recordedAt", "status"].includes(key))
        || payload.attempt !== identity.attempt || payload.phase !== identity.phase || !validPlannedObservationId(payload.owner)
        || payload.packageHash !== hash(input.publicationPlan) || payload.inputRevision !== nativeCadenceInputManifest(input.publicationPlan).revision
        || !["running", "succeeded", "failed"].includes(payload.status) || (identity.phase === "claim" && payload.status !== "running")
        || timestampMicros(payload.recordedAt) === null || timestampMicros(payload.recordedAt)! > BigInt(Date.now()) * BigInt(1000)) return false;
      const exact = { id: row.id, provider: "fhfh", dataset_key: payload.version, entity_kind: "cadence_slot",
        entity_key: `${payload.seasonId}:${payload.slotKey}`, source_url: null, source_revision_key: payload.packageHash,
        observed_at: payload.recordedAt, available_at: payload.recordedAt, payload_hash: hash(payload), payload,
        metadata: { phase: identity.phase, attempt: identity.attempt } };
      return matchesPlannedObservation(row, exact);
    }
    return false;
  }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), method = (init?.method ?? "GET").toUpperCase();
    if (this.active || url.origin !== ORIGIN || url.username || url.password || url.hash || url.port || !["GET", "POST"].includes(method)) fail("transport_scope_denied");
    const query = Object.fromEntries(url.searchParams);
    if (Object.keys(query).length !== [...url.searchParams].length) fail("duplicate_query_denied");
    const command = this.configuration.command, body = init?.body;
    let writeId: string | null = null, readIds: string[] = [], runLookup = false, writeExpiresAt: string | undefined;
    const source = url.pathname === "/rest/v1/player_forecast_source_observations", head = url.pathname === "/rest/v1/native_forecast_catalog_heads";
    const cas = url.pathname === "/rest/v1/rpc/cas_native_forecast_catalog_head";
    if (source && method === "POST") {
      if (this.writesStopped || typeof body !== "string" || Object.keys(query).some(key => key !== "select") || query.select !== undefined && query.select !== "id") fail("write_scope_denied");
      const row = JSON.parse(body as string); // The preceding runtime scope guard requires a string body.
      if (!this.allowed(row) || this.writes.has(row.id) || Object.keys(row).some(key => !SOURCE_OBSERVATION_COLUMNS.split(",").includes(key))) fail("write_scope_denied");
      const expiry = row.payload?.manifest?.expiresAt ?? row.payload?.expiresAt;
      if (expiry !== undefined && (timestampMicros(expiry) === null || timestampMicros(expiry)! <= BigInt(Date.now()) * BigInt(1000))) fail("expired_output_write_denied");
      writeExpiresAt = expiry;
      writeId = row.id;
    } else if (source && method === "GET") {
      if (body != null || ![SOURCE_OBSERVATION_COLUMNS, RELEASE_COLUMNS].includes(query.select)) fail("read_scope_denied");
      const request = this.configuration.materialization;
      if (request && query["payload->>runId"] !== undefined) {
        runLookup = Object.keys(query).every(key => ["select", "provider", "dataset_key", "entity_kind", "entity_key", "payload->>runId", "limit"].includes(key))
          && query.provider === "eq.fhfh" && query.entity_key === `eq.${request.date}:${request.sourceKey}` && query["payload->>runId"] === `eq.${request.runId}`
          && query.limit === "2" && (query.dataset_key === "eq.native-input-materialization-v1" && query.entity_kind === "eq.input_materialization"
            || query.dataset_key === "eq.native-producer-closure-v1" && query.entity_kind === "eq.producer_closure");
        if (!runLookup) fail("run_read_scope_denied");
      } else {
        if (Object.keys(query).some(key => !["select", "id", "limit"].includes(key))) fail("read_scope_denied");
        readIds = query.id?.startsWith("eq.") ? [query.id.slice(3)] : query.id?.startsWith("in.(") && query.id.endsWith(")") ? query.id.slice(4, -1).split(",") : [];
        const journalIds = command ? nativeCadenceJournalIds(command.cadenceInput.publicationPlan.seasonId, command.cadenceInput.slotKey).map(row => row.id) : [];
        if (!readIds.length || readIds.length > 320 || new Set(readIds).size !== readIds.length || readIds.some(id => !this.expected.has(id) && !journalIds.includes(id))
          || query.limit !== String(query.id.startsWith("eq.") ? 2 : readIds.length + 1)) fail("read_scope_denied");
      }
    } else if (head && method === "GET" && command) {
      if (body != null || Object.keys(query).sort().join() !== "id,limit,select" || query.select !== HEAD_COLUMNS || query.id !== `eq.${command.catalogHead.headId}` || query.limit !== "2") fail("head_read_denied");
    } else if (cas && method === "POST" && command && this.configuration.selection) {
      const selection = this.configuration.selection;
      const expected = { p_head_id: command.catalogHead.headId, p_season_id: command.cadenceInput.publicationPlan.seasonId,
        p_expected_revision: command.catalogHead.expectedRevision, p_expected_hash: command.catalogHead.expectedHash,
        p_observation_id: selection.id, p_payload_hash: selection.payload_hash };
      if (this.writesStopped || this.casAttempted || Object.keys(query).length || typeof body !== "string" || hash(JSON.parse(body)) !== hash(expected)) fail("cas_scope_denied");
      if (timestampMicros((selection.payload as any).expiresAt)! <= BigInt(Date.now()) * BigInt(1000)) fail("expired_catalog_cas_denied");
      writeExpiresAt = (selection.payload as any).expiresAt;
    } else fail("transport_path_denied");
    const upload = typeof body === "string" ? Buffer.byteLength(body) : 0;
    if (upload > CADENCE_RUNNER_LIMITS.rowBytes || this.uploaded + upload > CADENCE_RUNNER_LIMITS.uploadBytes
      || this.requests >= CADENCE_RUNNER_LIMITS.requests) fail("transport_byte_or_request_bound");
    this.event("request_intent", { method, path: url.pathname, plannedId: writeId, requestNumber: this.requests + 1, uploadBytes: upload });
    const remaining = Math.min(CADENCE_RUNNER_LIMITS.requestMs, CADENCE_RUNNER_LIMITS.totalMs - (this.monotonic() - this.started));
    if (remaining <= 0) fail("deadline_before_request");
    if (writeExpiresAt !== undefined && timestampMicros(writeExpiresAt)! <= BigInt(Date.now()) * BigInt(1000)) fail("expired_write_before_request");
    this.active = true; this.requests++; this.uploaded += upload;
    if (writeId) { this.writes.add(writeId); this.inserts++; } if (cas) this.casAttempted = true;
    const controller = new AbortController(), abort = () => controller.abort();
    init?.signal?.addEventListener("abort", abort, { once: true }); if (init?.signal?.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([(async () => {
        const response = await this.network(url.href, { ...init, redirect: "error", cache: "no-store", signal: controller.signal });
        if (response.redirected || response.status >= 300 && response.status < 400) fail("redirect_denied");
        const reader = response.body?.getReader({ mode: "byob" }), chunks: Uint8Array[] = []; let bytes = 0;
        if (reader) try { for (;;) {
          const capacity = Math.min(65536, CADENCE_RUNNER_LIMITS.responseBytes - bytes, CADENCE_RUNNER_LIMITS.downloadBytes - this.downloaded);
          if (capacity <= 0) fail("download_bound");
          const next = await reader.read(new Uint8Array(capacity));
          if (next.value?.byteLength) { bytes += next.value.byteLength; this.downloaded += next.value.byteLength; chunks.push(next.value); }
          if (next.done) break;
        } } finally { reader.releaseLock(); }
        const raw = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
        const decoded = raw.length ? JSON.parse(new TextDecoder("utf-8", { ignoreBOM: true }).decode(raw)) : null;
        if (response.ok && source && method === "GET") {
          if (!Array.isArray(decoded) || decoded.length > (runLookup ? 1 : readIds.length) || new Set(decoded.map(row => row.id)).size !== decoded.length) fail("readback_shape_conflict");
          for (const row of decoded) {
            if (Buffer.byteLength(JSON.stringify(row)) > CADENCE_RUNNER_LIMITS.rowBytes || !runLookup && !readIds.includes(row.id)) fail("readback_scope_conflict");
            if (query.select === SOURCE_OBSERVATION_COLUMNS ? !this.allowed(row) : !this.expected.has(row.id)
              || query.select === RELEASE_COLUMNS && (hash(row.payload) !== row.payload_hash || row.payload_hash !== this.expected.get(row.id)!.payload_hash)) fail("readback_conflict");
          }
        } else if (response.ok && head) {
          if (!Array.isArray(decoded) || decoded.length > 1 || decoded.some(row => row.id !== command!.catalogHead.headId || row.season_id !== command!.cadenceInput.publicationPlan.seasonId)) fail("head_readback_conflict");
        } else if (response.ok && source && query.select === "id" && decoded?.id !== writeId) fail("insert_id_conflict");
        else if (response.ok && source && method === "POST" && query.select === undefined && raw.length && decoded !== null) fail("unexpected_insert_response");
        if (!response.ok && method === "POST") this.writesStopped = true;
        this.event("response_completed", { method, plannedId: writeId, status: response.status, bytes, sha256: sha(raw) });
        return new Response(response.status === 204 ? null : raw, { status: response.status, headers: { "content-type": "application/json" } });
      })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("request_deadline")); }, remaining); })]);
    } catch {
      controller.abort(); if (method === "POST") this.writesStopped = true;
      this.event("request_failed", { method, plannedId: writeId, status: "unknown_until_exact_readback" }); throw new Error("guarded_transport_stopped");
    } finally { if (timer) clearTimeout(timer); init?.signal?.removeEventListener("abort", abort); this.active = false; }
  };
}

export async function runNativeCadence(argv: string[]) {
  const [stage, ...rest] = argv; if (!["materialize", "prepare", "publish"].includes(stage)) fail("stage_required");
  const args = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!["--input", "--input-sha256", "--proof", "--proof-sha256", "--out", "--execute-target", "--execute-intent", "--approved-package-hash"].includes(rest[i]) || !rest[i + 1] || args.has(rest[i])) fail("invalid_arguments");
    args.set(rest[i], rest[i + 1]);
  }
  if (!args.has("--input") || !args.has("--input-sha256") || !args.has("--out")) fail("input_hash_and_private_output_required");
  const execute = args.has("--execute-target");
  if (execute && (args.get("--execute-target") !== ORIGIN || !args.get("--execute-intent")?.trim())
    || !execute && (args.has("--execute-intent") || args.has("--approved-package-hash"))) fail("explicit_execution_target_and_intent_required");
  const input = boundedFile(args.get("--input")!, args.get("--input-sha256")!, stage === "publish" ? CADENCE_RUNNER_LIMITS.publishBytes : CADENCE_RUNNER_LIMITS.inputBytes);
  const now = new Date();
  if (stage === "prepare") {
    // Offline only: no execution target, network or database client exists for this stage.
    if (execute || !args.has("--proof") || !args.has("--proof-sha256")) fail("offline_prepare_requires_exact_closed_proof");
    const closed = boundedFile(args.get("--proof")!, args.get("--proof-sha256")!, CADENCE_RUNNER_LIMITS.inputBytes);
    const result = await prepareNativeCadenceOutputs(input, closed, now);
    const output = resolve(args.get("--out")!); mkdirSync(output, { mode: 0o700 });
    privateWrite(resolve(output, "publication-plan.json"), result.plan);
    privateWrite(resolve(output, "cadence-command.json"), result.cadenceCommand);
    const receipt = { stage, ...result.receipt, execute: false, inputSHA256: args.get("--input-sha256"), proofSHA256: args.get("--proof-sha256"),
      publicEnvironmentActivation: "not_performed", output };
    privateWrite(resolve(output, "receipt.json"), receipt); return receipt;
  } let prepared: ReturnType<typeof prepareNativeInputMaterialization> | undefined, proof: Proof | undefined;
  let command: PublishCommand | undefined, selection: PlannedSourceObservation | undefined;
  if (stage === "materialize") prepared = prepareNativeInputMaterialization(input, now.toISOString());
  else {
    if (!args.has("--proof") || !args.has("--proof-sha256")) fail("exact_closed_proof_required");
    proof = boundedFile(args.get("--proof")!, args.get("--proof-sha256")!, CADENCE_RUNNER_LIMITS.inputBytes);
    command = input;
    const validation = await validateCadenceCommand(command!, proof!, now); command!.cadenceInput = validation.input;
    if (execute && args.get("--approved-package-hash") !== validation.validation.packageHash) fail("exact_publication_package_required");
    selection = prepareNativeCatalogObservation({ plan: command!.cadenceInput.publicationPlan, pins: validation.validation.proposedPins,
      observationId: command!.catalogHead.observationId, issuedAt: now.toISOString() });
  }
  const output = resolve(args.get("--out")!); mkdirSync(output, { mode: 0o700 });
  privateWrite(resolve(output, "intent.json"), { stage, execute, inputSHA256: args.get("--input-sha256"), proofSHA256: args.get("--proof-sha256") ?? null,
    executionIntent: args.get("--execute-intent") ?? null, target: execute ? ORIGIN : null, limits: CADENCE_RUNNER_LIMITS, recordedAt: now.toISOString() });
  const event = (action: string, fields: Record<string, unknown>) => { const fd = openSync(resolve(output, "ledger.jsonl"), "a", 0o600);
    try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); } };
  let transport: CadenceTransport | undefined;
  try {
    let db: any;
    if (execute) {
      const requireWeb = createRequire(resolve(__dirname, "../package.json"));
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) requireWeb("@next/env").loadEnvConfig(resolve(__dirname, ".."), true, { info() {}, error() {} });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (url !== ORIGIN || !key) fail("normal_server_configuration_unavailable");
      transport = new CadenceTransport({ materialization: stage === "materialize" ? input : undefined, prepared, command, proof, selection }, fetch, event);
      db = requireWeb("@supabase/supabase-js").createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport.fetch } });
    }
    const result = stage === "materialize" ? await materializeNativeInputs(input, { now, dryRun: !execute, db })
      : await publishObservedNativeBaselineCadence(command!.cadenceInput, { dryRun: !execute, db,
        approvedPackageHash: hash(command!.cadenceInput.publicationPlan), producerReceiptIds: command!.producerReceiptIds, catalogHead: command!.catalogHead });
    privateWrite(resolve(output, "stage.json"), result);
    const receipt = { stage, status: result.status, execute, networkRequests: transport?.requests ?? 0, insertAttempts: transport?.inserts ?? 0,
      uploadBytes: transport?.uploaded ?? 0, downloadBytes: transport?.downloaded ?? 0, publicEnvironmentActivation: "not_performed", output };
    privateWrite(resolve(output, "receipt.json"), receipt); return receipt;
  } catch {
    const receipt = { stage, status: "stopped", execute, networkRequests: transport?.requests ?? 0, insertAttempts: transport?.inserts ?? 0,
      uploadBytes: transport?.uploaded ?? 0, downloadBytes: transport?.downloaded ?? 0, reason: "reconcile_private_ledger_before_retry", output };
    privateWrite(resolve(output, "receipt.json"), receipt); return receipt;
  }
}
if (require.main === module) runNativeCadence(process.argv.slice(2)).then(result => { console.log(JSON.stringify(result));
  if (["stopped", "unknown"].includes(result.status)) process.exitCode = 1;
}).catch(() => { console.error("Native cadence stopped before execution; inspect exact input scope and private receipts."); process.exitCode = 1; });
