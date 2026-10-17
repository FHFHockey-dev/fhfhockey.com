/** Synthetic only: actual SDK, injected fake transport, no live configuration or services. */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { PublicationTransport, RUNNER_LIMITS, cli } from "./native-publication-runner";
import { playerForecastSourcePayloadHash as hash, SOURCE_OBSERVATION_COLUMNS } from "../../../web/lib/player-forecasts/sourceSnapshot";
import { buildSkaterParticipationReceipt } from "../../../web/lib/player-forecasts/modeledSkaterParticipation";
import { publishNativeBaselinePlan, type NativeBaselinePublicationPlan } from "../../../web/lib/player-forecasts/nativeBaselinePublication";
const origin = "https://fyhftlxokyjtpndbkfse.supabase.co", url = origin + "/rest/v1/player_forecast_source_observations";
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const row = { id, provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player", entity_key: "20262027:7",
  source_url: null, source_revision_key: null, observed_at: "2026-10-16T04:00:00Z", available_at: "2026-10-16T04:00:00Z", payload: { synthetic: true }, payload_hash: hash({ synthetic: true }), metadata: {} };
const plan: NativeBaselinePublicationPlan = { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: [row] };
const readURL = url + "?" + new URLSearchParams({ select: SOURCE_OBSERVATION_COLUMNS, id: `in.(${id})`, limit: "2" });
const events: any[] = [];
const transport = (network: typeof fetch, clock?: () => number, event = (action: string, detail: any) => events.push({ action, ...detail })) => new PublicationTransport(plan, network, event, clock);
const post = (t: PublicationTransport, value = row) => t.fetch(url, { method: "POST", body: JSON.stringify(value) });

test("accepts the exact 95-row catalog package ceiling and rejects one more before network", () => {
  let calls = 0;
  const network = async () => { calls++; return Response.json([]); };
  const rows = Array.from({ length: 95 }, (_, index) => ({ ...row, id: String(index) }));
  assert.doesNotThrow(() => new PublicationTransport({ ...plan, rows }, network, () => {}));
  assert.throws(() => new PublicationTransport({ ...plan, rows: [...rows, { ...row, id: "96" }] }, network, () => {}), /runner_row_cap/);
  assert.equal(calls, 0);
});

test("real SDK uses exact read/insert scope, no redirects, and never exposes headers to ledger", async () => {
  events.length = 0; const calls: string[] = [];
  const t = transport(async (input, init) => { calls.push(String(input)); assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-service-key");
    return init?.method === "POST" ? new Response(null, { status: 201 }) : Response.json([]); });
  const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
  const db = requireWeb("@supabase/supabase-js").createClient(origin, "synthetic-service-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: t.fetch } });
  assert.equal((await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).in("id", [id]).limit(2)).error, null);
  assert.equal((await db.from("player_forecast_source_observations").insert(row)).error, null);
  assert.equal(calls.length, 2); assert.equal(t.inserts, 1);
  assert.ok(!JSON.stringify(events).includes("synthetic-service-key")); assert.ok(!JSON.stringify(events).includes("Authorization"));
});
test("blocks arbitrary host, table, writes, unplanned ID, duplicate insert and query scope before network", async () => {
  for (const [target, init] of [[url.replace(origin, "https://elsewhere.invalid"), {}], [url.replace("observations", "accounts"), {}],
    [url, { method: "PATCH", body: "{}" }], [url, { method: "POST", body: JSON.stringify({ ...row, id: other }) }],
    [url + "?on_conflict=id", { method: "POST", body: JSON.stringify(row) }], [url + "?select=*", {}]] as const) {
    let calls = 0; const t = transport(async () => { calls++; return Response.json([]); });
    await assert.rejects(t.fetch(target, init)); assert.equal(calls, 0);
  }
  const t = transport(async () => new Response(null, { status: 201 })); await post(t); await assert.rejects(post(t), /write_scope/); assert.equal(t.requests, 1);
});
test("unknown POST stops further writes while exact-ID readback remains possible without retry", async () => {
  let calls = 0; const t = transport(async (_input, init) => { calls++; if (init?.method === "POST") throw new Error("synthetic failure"); return Response.json([row]); });
  await assert.rejects(post(t), /transport_stopped/); await assert.rejects(post(t));
  assert.deepEqual(t.unresolvedWriteIds(), [id]);
  assert.equal((await t.fetch(readURL)).status, 200); assert.equal(calls, 2); assert.equal(t.inserts, 1); assert.deepEqual(t.unresolvedWriteIds(), []);
  const absent = transport(async (_input, init) => { if (init?.method === "POST") throw new Error("uncertain"); return Response.json([]); });
  await assert.rejects(post(absent)); await absent.fetch(readURL); assert.deepEqual(absent.unresolvedWriteIds(), [id]);
});
test("real SDK single INSERT acknowledgement preserves exact planned ID and optional null URL", async () => {
  const bundleRow = { ...row, dataset_key: "contribution-bundle-v1", entity_kind: "seasonal_rate_bundle", entity_key: "20262027" };
  const t = new PublicationTransport({ ...plan, rows: [bundleRow] }, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("accept"), "application/vnd.pgrst.object+json");
    return Response.json({ id }, { status: 201 });
  }, () => {});
  const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
  const db = requireWeb("@supabase/supabase-js").createClient(origin, "synthetic-service-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: t.fetch } });
  const { source_url: _null, ...insert } = bundleRow;
  const result = await db.from("player_forecast_source_observations").insert(insert).select("id").single();
  assert.equal(result.error, null); assert.deepEqual(result.data, { id }); assert.equal(t.inserts, 1);
});
test("duplicate conflict must be resolved by exact planned readback, never by adopting another ID", async () => {
  const t = transport(async (_input, init) => init?.method === "POST" ? Response.json({ code: "23505" }, { status: 409 }) : Response.json([{ ...row, id: other }]));
  assert.equal((await post(t)).status, 409); await assert.rejects(t.fetch(readURL), /transport_stopped/); await assert.rejects(post(t));
  assert.equal(t.inserts, 1);
});
test("redirect, oversized response and unexpected readback fail closed", async () => {
  for (const response of [new Response(null, { status: 302 }), Response.json([{ ...row, entity_key: "foreign" }]), new Response(Buffer.alloc(RUNNER_LIMITS.responseBytes + 1))]) {
    const t = transport(async () => response); await assert.rejects(t.fetch(readURL), /transport_stopped/); assert.ok(t.downloaded <= RUNNER_LIMITS.responseBytes);
  }
});
test("durable intent consumes total budget; call and upload ceilings are enforced before acquisition", async () => {
  let elapsed = 0, calls = 0;
  const t = transport(async () => { calls++; return Response.json([]); }, () => elapsed, () => { elapsed = RUNNER_LIMITS.totalMs; });
  await assert.rejects(t.fetch(readURL), /deadline_before_request/); assert.equal(calls, 0); assert.equal(t.requests, 0);
  const cap = transport(async () => { calls++; return Response.json([]); }); cap.requests = 5;
  await assert.rejects(cap.fetch(readURL), /request_cap/); assert.equal(calls, 0);
  const upload = transport(async () => { calls++; return Response.json([]); }); upload.uploaded = RUNNER_LIMITS.uploadBytes;
  await assert.rejects(post(upload), /upload_cap/); assert.equal(calls, 0);
  const download = transport(async () => new Response("[12345]")); download.downloaded = RUNNER_LIMITS.downloadBytes - 5;
  await assert.rejects(download.fetch(readURL), /transport_stopped/); assert.equal(download.downloaded, RUNNER_LIMITS.downloadBytes);
});
test("short remaining lifetime aborts hung headers and does not begin another write", async () => {
  let elapsed = 0; const t = transport(async () => new Promise<Response>(() => {}), () => elapsed);
  elapsed = RUNNER_LIMITS.totalMs - 5;
  await assert.rejects(post(t), /transport_stopped/); await assert.rejects(post(t)); assert.equal(t.inserts, 1);
});
test("default CLI replays an immutable local model package without network/configuration; wrong hash cannot execute", async () => {
  const root = mkdtempSync(join(tmpdir(), "native-publication-runner-"));
  try {
    const now = Date.now(), at = (ms: number) => new Date(now + ms).toISOString();
    const evidence = { id: "synthetic", hash: "a".repeat(64), availableAt: at(-1800000), capturedAt: at(-1800000) };
    const input = { version: "skater-participation-input-v1" as const, cutoffAt: at(-1200000), scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
      teamId: 1, gameId: 30, scheduledAt: at(7200000), scheduleRevision: "synthetic", rosterRevision: "synthetic" }, scheduleEvidence: evidence, rosterEvidence: evidence,
      history: { complete: true, windowStartAt: at(-1200000-60*86400000), scheduleEvidence: evidence, games: [{ gameId: 10, teamId: 1,
        scheduledAt: at(-86400000), occurred: true, eligible: true, positiveMinutes: true, resolution: "positive_toi" as const, eligibilityEvidence: evidence, outcomeEvidence: evidence }] } };
    const clocks = { issuedAt: at(-600000), expiresAt: at(3600000) }, payload = { version: "skater-participation-bundle-v1", seasonId: 20262027, ...clocks,
      released: true, allowedUses: { assignment: true, totals: true, comparison: false, conditionalTieBreak: false }, ownerApprovalRef: "synthetic", reviewRef: "synthetic",
      entries: [{ input, receipt: buildSkaterParticipationReceipt(input, clocks) }] };
    const file = join(root, "plan.json"); writeFileSync(file, JSON.stringify({ ...plan, rows: [{ ...row, dataset_key: payload.version, entity_kind: "participation_bundle",
      entity_key: "20262027", observed_at: clocks.issuedAt, available_at: clocks.issuedAt, payload, payload_hash: hash(payload) }] }));
    assert.equal((await cli(["--plan", file])).status, "dry_run");
    await assert.rejects(cli(["--plan", file, "--execute-approved-sha256", "wrong"]), /exact_authorization/);
    const actualPlan = JSON.parse(readFileSync(file, "utf8")), stored: unknown[] = [];
    const t = new PublicationTransport(actualPlan, async (_url, init) => {
      if (init?.method === "POST") { stored.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }); }
      return Response.json(stored);
    }, () => {});
    const requireWeb = createRequire(resolve(__dirname, "../../../web/package.json"));
    const db = requireWeb("@supabase/supabase-js").createClient(origin, "synthetic-service-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: t.fetch } });
    const result = await publishNativeBaselinePlan(actualPlan, { now: new Date(), dryRun: false, approvedPackageHash: hash(actualPlan), db });
    assert.equal(result.status, "persisted_not_activated"); assert.equal(t.requests, 3); assert.equal(t.inserts, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
