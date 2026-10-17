/** Local immutable publication runner. Import and default CLI do not access services or secret environment. */
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { publishNativeBaselinePlan, validateNativeBaselinePublication, type NativeBaselinePublicationPlan } from "../../../web/lib/player-forecasts/nativeBaselinePublication";
import { matchesPlannedObservation, playerForecastSourcePayloadHash, SOURCE_OBSERVATION_COLUMNS } from "../../../web/lib/player-forecasts/sourceSnapshot";
export const RUNNER_LIMITS = Object.freeze({ rows: 95, rowBytes: 8 * 1024 * 1024, uploadBytes: 32 * 1024 * 1024,
  responseBytes: 32 * 1024 * 1024, downloadBytes: 96 * 1024 * 1024, requestMs: 8000, totalMs: 180000 });
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const privateWrite = (path: string, data: unknown) => {
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(data, null, 2) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
};
class RunnerFailure extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new RunnerFailure(code); };

/** The supported SDK receives only this request-local fetch. Headers/authentication are never retained. */
export class PublicationTransport {
  requests = 0; inserts = 0; uploaded = 0; downloaded = 0;
  private active = false; private terminalWriteFailure = false; private verifyCollision: string | null = null;
  private readonly started: number;
  private readonly writtenIds = new Set<string>();
  private readonly uncertainIds = new Set<string>();
  unresolvedWriteIds() { return [...this.uncertainIds]; }
  constructor(private plan: NativeBaselinePublicationPlan, private network: typeof fetch,
    private event: (action: string, fields: Record<string, unknown>) => void,
    private monotonic: () => number = () => performance.now()) {
    if (!plan.rows.length || plan.rows.length > RUNNER_LIMITS.rows) fail("runner_row_cap");
    this.started = monotonic();
  }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (this.active || url.origin !== ORIGIN || url.pathname !== "/rest/v1/player_forecast_source_observations"
      || url.username || url.password || url.hash || url.port || !["GET", "POST"].includes(method)) fail("transport_scope_denied");
    const query = Object.fromEntries(url.searchParams);
    if ([...url.searchParams].length !== Object.keys(query).length) fail("transport_scope_denied");
    const ids = this.plan.rows.map(row => row.id);
    let writeId: string | null = null;
    let readIds = ids;
    const body = init?.body;
    if (method === "POST") {
      if (this.terminalWriteFailure || this.verifyCollision || typeof body !== "string"
        || Object.keys(query).some(key => key !== "select") || query.select !== undefined && query.select !== "id") fail("write_scope_denied");
      let row: any;
      try { row = JSON.parse(body); } catch { fail("write_scope_denied"); }
      const expected = this.plan.rows.find(expected => expected.id === row?.id);
      if (!expected || this.writtenIds.has(expected.id) || Array.isArray(row) || Object.keys(row).some(key => !SOURCE_OBSERVATION_COLUMNS.split(",").includes(key))
        || !matchesPlannedObservation({ ...row, source_url: row.source_url ?? null }, expected)
        || Buffer.byteLength(body) > RUNNER_LIMITS.rowBytes) fail("write_scope_denied");
      writeId = expected.id;
    } else {
      if (body != null || Object.keys(query).some(key => !["select", "id", "limit"].includes(key))
        || query.select !== SOURCE_OBSERVATION_COLUMNS) fail("read_scope_denied");
      const exactOne = ids.find(id => query.id === `eq.${id}`);
      if (exactOne ? query.limit !== "2" : query.id !== `in.(${ids.join(",")})` || query.limit !== String(ids.length + 1)) fail("read_scope_denied");
      readIds = exactOne ? [exactOne] : ids;
    }
    if (this.requests >= 2 * ids.length + 3 || method === "POST" && this.inserts >= ids.length) fail("request_cap");
    if (this.downloaded >= RUNNER_LIMITS.downloadBytes) fail("download_cap");
    const upload = typeof body === "string" ? Buffer.byteLength(body) : 0;
    if (this.uploaded + upload > RUNNER_LIMITS.uploadBytes) fail("upload_cap");
    this.event("request_intent", { method, plannedId: writeId, requestNumber: this.requests + 1, uploadBytes: upload });
    const remaining = Math.min(RUNNER_LIMITS.requestMs, RUNNER_LIMITS.totalMs - (this.monotonic() - this.started));
    if (remaining <= 0) fail("deadline_before_request");
    this.active = true; this.requests++; this.uploaded += upload;
    if (method === "POST") { this.inserts++; this.writtenIds.add(writeId!); }
    const controller = new AbortController();
    const abort = () => controller.abort();
    init?.signal?.addEventListener("abort", abort, { once: true });
    if (init?.signal?.aborted) controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = async () => {
        const response = await this.network(url.href, { ...init, redirect: "error", cache: "no-store", signal: controller.signal });
        if (response.redirected || response.status >= 300 && response.status < 400) fail("redirect_denied");
        const reader = response.body?.getReader({ mode: "byob" });
        const chunks: Uint8Array[] = []; let bytes = 0;
        if (reader) {
          try {
            for (;;) {
              const allowed = Math.min(65536, RUNNER_LIMITS.responseBytes - bytes, RUNNER_LIMITS.downloadBytes - this.downloaded);
              if (allowed <= 0) fail("download_cap");
              const next = await reader.read(new Uint8Array(allowed));
              if (next.value?.byteLength) { bytes += next.value.byteLength; this.downloaded += next.value.byteLength; chunks.push(next.value); }
              if (next.done) break;
              if (bytes >= RUNNER_LIMITS.responseBytes || this.downloaded >= RUNNER_LIMITS.downloadBytes) fail("download_cap");
            }
          } finally { reader.releaseLock(); }
        }
        const bytesBody = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        let decoded: any;
        if (bytesBody.length) { try { decoded = JSON.parse(bytesBody.toString("utf8")); } catch { fail("invalid_response_json"); } }
        if (response.ok && method === "GET") {
          if (!Array.isArray(decoded) || decoded.length > readIds.length || new Set(decoded.map(row => row.id)).size !== decoded.length
            || decoded.some(row => Buffer.byteLength(JSON.stringify(row)) > RUNNER_LIMITS.rowBytes
              || !readIds.includes(row.id) || !matchesPlannedObservation(row, this.plan.rows.find(expected => expected.id === row.id)!))) fail("readback_conflict");
          if (this.verifyCollision && decoded.some(row => row.id === this.verifyCollision)) this.verifyCollision = null;
          for (const row of decoded) this.uncertainIds.delete(row.id);
        } else if (response.ok && query.select === "id") {
          if (decoded?.id !== writeId) fail("insert_id_mismatch");
        } else if (response.ok && bytesBody.length && decoded !== null) {
          fail("unexpected_insert_response");
        } else if (!response.ok) {
          if (method === "POST" && response.status === 409 && decoded?.code === "23505") this.verifyCollision = writeId;
          else { this.terminalWriteFailure = true; if (writeId) this.uncertainIds.add(writeId); }
        }
        this.event("response_completed", { method, plannedId: writeId, status: response.status, bodyBytes: bytes, bodySHA256: sha(bytesBody) });
        const headers = new Headers();
        for (const key of ["content-type", "content-range"]) { const value = response.headers.get(key); if (value) headers.set(key, value); }
        return new Response(response.status === 204 ? null : bytesBody, { status: response.status, headers });
      };
      return await Promise.race([work(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new RunnerFailure("request_deadline")); }, remaining);
      })]);
    } catch (error) {
      controller.abort();
      if (method === "POST") { this.terminalWriteFailure = true; if (writeId) this.uncertainIds.add(writeId); }
      this.event("request_failed", { method, plannedId: writeId, reason: error instanceof RunnerFailure ? error.code : "transport_failure", writeState: method === "POST" ? "unknown_until_exact_readback" : "not_a_write" });
      throw new RunnerFailure("transport_stopped");
    } finally {
      if (timer) clearTimeout(timer);
      init?.signal?.removeEventListener("abort", abort); this.active = false;
    }
  };
}

export async function cli(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--plan", "--execute-approved-sha256", "--approved-package-hash", "--authorization-ref", "--out"].includes(argv[i])
      || !argv[i + 1] || args.has(argv[i])) fail("invalid_arguments");
    args.set(argv[i], argv[i + 1]);
  }
  if (!args.get("--plan")) fail("plan_required");
  const bytes = readFileSync(args.get("--plan")!);
  if (bytes.length > RUNNER_LIMITS.uploadBytes) fail("plan_byte_cap");
  const plan = JSON.parse(bytes.toString("utf8")) as NativeBaselinePublicationPlan;
  const validation = await validateNativeBaselinePublication(plan, new Date());
  if (plan.rows.length > RUNNER_LIMITS.rows) fail("runner_row_cap");
  if (!args.has("--execute-approved-sha256")) return { status: "dry_run", fileSHA256: sha(bytes), ...validation,
    limits: RUNNER_LIMITS, networkRequests: 0, credentialReads: 0 };
  if (args.get("--execute-approved-sha256") !== sha(bytes) || args.get("--approved-package-hash") !== validation.packageHash
    || !args.get("--authorization-ref")?.trim() || !args.get("--out")) fail("exact_authorization_required");
  const output = resolve(args.get("--out")!); mkdirSync(output, { mode: 0o700 });
  privateWrite(resolve(output, "intent.json"), { fileSHA256: sha(bytes), packageHash: validation.packageHash,
    runnerSHA256: sha(readFileSync(__filename)), coordinatorSHA256: sha(readFileSync(resolve(__dirname, "../../../web/lib/player-forecasts/nativeBaselinePublication.ts"))),
    authorizationRef: args.get("--authorization-ref"), rows: plan.rows.length, proposedPins: validation.proposedPins,
    limits: RUNNER_LIMITS, credentialPolicy: "existing_normal_server_configuration_in_memory_only; no export, renewal or settings changes" });
  const event = (action: string, fields: Record<string, unknown>) => {
    const fd = openSync(resolve(output, "ledger.jsonl"), "a", 0o600);
    try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  };
  // Same supported execution-only configuration pattern as the approved Yahoo collector.
  const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    requireWeb("@next/env").loadEnvConfig(resolve(__dirname, "../../../web"), true, { info() {}, error() {} });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url !== ORIGIN || !key) fail("normal_server_configuration_unavailable");
  const transport = new PublicationTransport(plan, fetch, event);
  const { createClient } = requireWeb("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport.fetch } });
  const result = await publishNativeBaselinePlan(plan, { now: new Date(), dryRun: false, approvedPackageHash: validation.packageHash, db });
  const uncertain = transport.unresolvedWriteIds();
  const reconciled = { ...result, status: uncertain.length ? "stopped" : result.status,
    missingIds: result.missingIds.filter(id => !uncertain.includes(id)), unknownIds: [...new Set([...result.unknownIds, ...uncertain])] };
  privateWrite(resolve(output, "receipt.json"), { ...reconciled, networkRequests: transport.requests, insertAttempts: transport.inserts,
    uploadBytes: transport.uploaded, downloadBytes: transport.downloaded, activation: "not_performed" });
  return { status: reconciled.status, rows: plan.rows.length, networkRequests: transport.requests, insertAttempts: transport.inserts,
    uploadBytes: transport.uploaded, downloadBytes: transport.downloaded, activation: "not_performed", output };
}
if (require.main === module) cli(process.argv.slice(2)).then(result => {
  console.log(JSON.stringify(result)); if (result.status === "stopped") process.exitCode = 1;
}).catch(() => { console.error("Native publication stopped; reconcile the private receipt before another attempt."); process.exitCode = 1; });
