/** FORGE v2 daily `means` stage driver (pure logic in lib/player-forecasts/nativeDailyMeansCapture.ts). Stages:
 *   plan     - offline: universe + retained receipt cache -> capture plan (requests, budget, coverage)
 *   capture  - plan-only unless --execute true: bounded serial GETs of each round's planned originals, re-planned
 *              until complete, within one request/byte budget
 *   assemble - offline: universe + cache + plan -> native observations, selection, parents, coverage and previews
 * Integration into scripts/forge-daily.ts is a separate step. Nothing here writes to a database. */
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { boundedFile, privateWrite } from "./native-baseline-cadence";
import { previewNativeBaseline, previewNativeGoalieShutouts, previewNativeGoalieVolume, previewNativeGoalieWins,
  type NativeBaselinePreviewScope } from "./preview-native-baseline";
import { assembleNativeDailyMeans, nativeMeansUrlKind, planNativeMeansCapture, type NativeDailyMeans,
  type NativeMeansUniverseRow } from "../lib/player-forecasts/nativeDailyMeansCapture";
import { buildNativeGoalieSummaryWinRates, dryRunGoalieContributionBundle, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
  NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, NATIVE_GOALIE_VOLUME_POLICY_VERSION, NATIVE_GOALIE_WIN_POLICY_VERSION } from "../lib/player-forecasts/goalieBaselineRates";
import type { HttpReceipt } from "../lib/player-forecasts/nativeDailyPipeline";
import { nativeDailyUniverse, nativeDailyV2Flags } from "../lib/player-forecasts/nativeDailyPipelineV2";
import { playerForecastSourcePayloadHash as hash } from "../lib/player-forecasts/sourceSnapshot";

/** Defaults equal the 2026-10-17 approved operational bound (about 120 responses / 2 MB). */
export const NATIVE_MEANS_CAPTURE_LIMITS = Object.freeze({ requests: 120, bodyBytes: 1024 * 1024, totalBytes: 2 * 1024 * 1024,
  requestMs: 8000, totalMs: 600000, spacingMs: 1000, rounds: 5 });
/** An explicit owner approval (--approval-ref) may raise requests/bytes up to these ceilings, never beyond. */
export const NATIVE_MEANS_CAPTURE_CEILINGS = Object.freeze({ requests: 400, totalBytes: 8 * 1024 * 1024 });
const MAX_INPUT = 96 * 1024 * 1024;
const fail = (reason: string): never => { throw new Error(reason); };
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const message = (error: unknown) => error instanceof Error ? error.message : "unknown";
type Event = (action: string, fields: Record<string, unknown>) => void;
export type NativeMeansCollectOptions = { network?: typeof fetch; wait?: (ms: number) => Promise<void>; clock?: () => number;
  limits?: { requests: number; totalBytes: number }; spent?: { requests: number; bytes: number; startedAt: number } };

async function boundedText(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!response.body) { const text = await response.text(); return Buffer.byteLength(text) > limit ? null : text; }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Serial, exact allowlist, 1 s spacing, 8 s timeout, per-body and total byte caps, no retries or redirects, and a
 * durable intent event before every request. `spent` carries one budget across re-planned rounds. */
export async function collectNativeMeansOriginals(urls: string[], event: Event, options: NativeMeansCollectOptions = {}) {
  const network = options.network ?? fetch, wait = options.wait ?? ((ms: number) => new Promise<void>(done => setTimeout(done, ms)));
  const clock = options.clock ?? Date.now, limits = options.limits ?? NATIVE_MEANS_CAPTURE_LIMITS;
  const spent = options.spent ?? { requests: 0, bytes: 0, startedAt: clock() };
  if (!Array.isArray(urls) || new Set(urls).size !== urls.length || urls.some(url => !nativeMeansUrlKind(url))) fail("capture_scope_denied");
  if (limits.requests > NATIVE_MEANS_CAPTURE_CEILINGS.requests || limits.totalBytes > NATIVE_MEANS_CAPTURE_CEILINGS.totalBytes) fail("capture_ceiling_exceeded");
  if (spent.requests + urls.length > limits.requests) fail("capture_budget_exceeded");
  const receipts: HttpReceipt[] = [];
  for (const url of urls) {
    if (spent.requests) await wait(NATIVE_MEANS_CAPTURE_LIMITS.spacingMs);
    if (clock() - spent.startedAt > NATIVE_MEANS_CAPTURE_LIMITS.totalMs) return { receipts, failures: [{ url, reason: "capture_deadline" }], spent };
    spent.requests++;
    event("request_intent", { index: spent.requests, url });
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), NATIVE_MEANS_CAPTURE_LIMITS.requestMs);
    try {
      const response = await network(url, { redirect: "error", cache: "no-store", signal: controller.signal, headers: { accept: "application/json" } });
      const rawBody = response.ok ? await boundedText(response, NATIVE_MEANS_CAPTURE_LIMITS.bodyBytes) : null;
      const capturedAt = new Date(clock()).toISOString(), bytes = rawBody === null ? 0 : Buffer.byteLength(rawBody);
      spent.bytes += bytes;
      event("response_completed", { index: spent.requests, url, status: response.status, bytes, sha256: rawBody === null ? null : sha(rawBody) });
      if (!response.ok) fail(`http_status_${response.status}`);
      if (rawBody === null) fail("body_byte_bound");
      if (spent.bytes > limits.totalBytes) fail("total_byte_bound");
      JSON.parse(rawBody!);
      receipts.push({ url, capturedAt, bodySha256: sha(rawBody!), rawBody: rawBody! });
    } catch (error) {
      event("request_failed", { index: spent.requests, url, reason: message(error) });
      return { receipts, failures: [{ url, reason: message(error) }], spent };
    } finally { clearTimeout(timer); }
  }
  return { receipts, failures: [] as Array<{ url: string; reason: string }>, spent };
}

const noDatabase = new Proxy({}, { get() { throw new Error("Native means preview forbids database access"); } });
/** Unreleased per-player previews with the existing producers, bound to each player's next scheduled game. */
export async function previewNativeDailyMeans(means: Pick<NativeDailyMeans, "seasonId" | "additionalNativeObservations">, bindings: Record<string, { gameId: number; scheduledAt: string; scheduleRevision: string }>,
  now = new Date()) {
  const previews: any[] = [], skipped: Array<{ playerId: number; policyVersion: string; reason: string }> = [];
  for (const observation of means.additionalNativeObservations) {
    const payload = observation.payload, binding = bindings[String(payload.playerId)], policyVersion = payload.policyVersion as string;
    if (!binding) { skipped.push({ playerId: payload.playerId, policyVersion, reason: "no_future_game_binding" }); continue; }
    const scope: NativeBaselinePreviewScope = { seasonId: means.seasonId, scheduleRevision: binding.scheduleRevision,
      games: [{ gameId: binding.gameId, scheduledAt: binding.scheduledAt }],
      players: [{ playerId: payload.playerId, nhlPlayerId: payload.nhlPlayerId, teamId: payload.teamId, rosterRevision: payload.rosterRevision }] };
    const expiresAt = new Date(Math.min(now.getTime() + 12 * 3600000, Date.parse(binding.scheduledAt) - 1)).toISOString();
    try {
      let result: { checksum: string; bundle: { sources: any[] } };
      if (policyVersion === NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION) {
        const snapshot = buildNativeGoalieSummaryWinRates({ ...payload, seasonId: means.seasonId, cutoffAt: payload.capturedAt, sourceWatermark: observation.payload_hash } as any);
        const bundle = await dryRunGoalieContributionBundle(noDatabase as never, { seasonId: means.seasonId, cutoffAt: payload.capturedAt,
          issuedAt: now.toISOString(), expiresAt, scheduleRevision: binding.scheduleRevision, snapshots: [{ snapshot, teamId: payload.teamId, rosterRevision: payload.rosterRevision }] });
        result = { checksum: hash(bundle), bundle };
      } else if (policyVersion === NATIVE_GOALIE_SHUTOUT_POLICY_VERSION) result = await previewNativeGoalieShutouts([observation as any], scope, expiresAt, now);
      else if (policyVersion === NATIVE_GOALIE_WIN_POLICY_VERSION) result = await previewNativeGoalieWins([observation as any], scope, expiresAt, now);
      else if (policyVersion === NATIVE_GOALIE_VOLUME_POLICY_VERSION) result = await previewNativeGoalieVolume([observation as any], scope, expiresAt, now);
      else result = await previewNativeBaseline([observation as any], scope, expiresAt, now);
      previews.push({ playerId: payload.playerId, policyVersion, inputHash: observation.payload_hash, checksum: result.checksum, expiresAt, binding,
        sources: result.bundle.sources.map((source: any) => ({ targetKey: source.targetKey, unit: source.unit, mean: source.mean, sourceId: source.sourceId })) });
    } catch (error) { skipped.push({ playerId: payload.playerId, policyVersion, reason: message(error) }); }
  }
  return { version: "native-daily-means-previews-v1" as const, status: "unreleased_preview" as const, generatedAt: now.toISOString(),
    previews, skipped, publicUsesApproved: false, databaseWrites: 0 };
}

function parse(argv: string[], allowed: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || argv[i + 1] === undefined || args.has(argv[i])) fail("invalid_arguments");
    args.set(argv[i], argv[i + 1]);
  }
  return args;
}
const output = (path: string) => { const out = resolve(path); mkdirSync(out, { mode: 0o700 }); return out; };
const input = (args: Map<string, string>, name: string) => boundedFile(args.get(`--${name}`) ?? fail(`missing_${name}`),
  args.get(`--${name}-sha256`) ?? fail(`missing_${name}_sha256`), MAX_INPUT);
const optional = (args: Map<string, string>, name: string) => args.has(`--${name}`) ? input(args, name) : undefined;
/** Universe rows, or the `forge-daily universe` document itself through the same gate inputs-v2 applies (thresholds off). */
const universeOf = (value: any): NativeMeansUniverseRow[] => Array.isArray(value) ? value
  : value?.version === "forge-daily-yahoo-universe-v1" ? nativeDailyUniverse(value, nativeDailyV2Flags(undefined)).rows : value?.universe ?? fail("universe_shape");
const receiptsOf = (value: any): HttpReceipt[] => Array.isArray(value?.receipts) ? value.receipts : fail("cache_shape");
const PLAN_ARGS = ["--universe", "--universe-sha256", "--cache", "--cache-sha256", "--season", "--as-of", "--anchor",
  "--prior-games", "--prior-games-sha256", "--out"];

export async function runNativeMeansCapture(argv: string[], now = () => new Date(), network: typeof fetch = fetch) {
  const [stage, ...rest] = argv;
  if (stage === "plan" || stage === "capture") {
    const args = parse(rest, [...PLAN_ARGS, ...(stage === "capture" ? ["--execute", "--approval-ref", "--max-requests", "--max-bytes"] : [])]);
    const base = { seasonId: Number(args.get("--season") ?? fail("missing_season")), asOf: args.get("--as-of") ?? fail("missing_as_of"),
      scheduleAnchor: args.get("--anchor") ?? fail("missing_anchor"), universe: universeOf(input(args, "universe")),
      priorSeasonGames: optional(args, "prior-games") };
    let cache = receiptsOf(input(args, "cache"));
    const execute = stage === "capture" && args.get("--execute") === "true", approval = args.get("--approval-ref");
    if ((args.has("--max-requests") || args.has("--max-bytes")) && !approval?.trim()) fail("raised_bound_requires_approval_ref");
    const limits = { requests: Number(args.get("--max-requests") ?? NATIVE_MEANS_CAPTURE_LIMITS.requests),
      totalBytes: Number(args.get("--max-bytes") ?? NATIVE_MEANS_CAPTURE_LIMITS.totalBytes) };
    if (![limits.requests, limits.totalBytes].every(value => Number.isSafeInteger(value) && value > 0)
      || limits.requests > NATIVE_MEANS_CAPTURE_CEILINGS.requests || limits.totalBytes > NATIVE_MEANS_CAPTURE_CEILINGS.totalBytes) fail("invalid_capture_bound");
    const out = output(args.get("--out") ?? fail("missing_out"));
    let plan = planNativeMeansCapture({ ...base, cache });
    privateWrite(resolve(out, "plan.json"), { plan, limits, approvalRef: approval ?? null, execute, recordedAt: now().toISOString() });
    if (!execute) return { stage, status: "plan_only", planStatus: plan.status, requests: plan.estimate.requests,
      estimatedBytes: plan.estimate.bytes, withinDefaultBound: plan.estimate.requests <= NATIVE_MEANS_CAPTURE_LIMITS.requests
        && plan.estimate.bytes <= NATIVE_MEANS_CAPTURE_LIMITS.totalBytes, networkRequests: 0, out };
    const event: Event = (action, fields) => { const fd = openSync(resolve(out, "ledger.jsonl"), "a", 0o600);
      try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); } };
    event("capture_started", { approvalRef: approval ?? null, limits, planStatus: plan.status, planned: plan.estimate.requests });
    const fetched: HttpReceipt[] = [], spent = { requests: 0, bytes: 0, startedAt: Date.now() };
    let status = "complete", failures: Array<{ url: string; reason: string }> = [], rounds = 0;
    while (plan.status !== "complete") {
      const urls = plan.requests.map(value => value.url);
      // A re-planned original already fetched this run means no progress; stop rather than loop.
      if (urls.some(url => fetched.some(receipt => receipt.url === url))) { status = "stopped_no_progress"; break; }
      if (rounds >= NATIVE_MEANS_CAPTURE_LIMITS.rounds) { status = "stopped_round_bound"; break; }
      if (spent.requests + urls.length > limits.requests) { status = "stopped_budget"; event("round_refused", { urls: urls.length, spent }); break; }
      const result = await collectNativeMeansOriginals(urls, event, { network, limits, spent });
      fetched.push(...result.receipts); cache = [...cache, ...result.receipts]; rounds++;
      if (result.failures.length) { status = "stopped_failure"; failures = result.failures; break; }
      plan = planNativeMeansCapture({ ...base, cache });
    }
    privateWrite(resolve(out, "receipts.json"), { receipts: fetched, failures, attempted: spent.requests, bytes: spent.bytes, rounds });
    privateWrite(resolve(out, "cache-next.json"), { receipts: cache });
    privateWrite(resolve(out, "plan-final.json"), plan);
    return { stage, status, rounds, requests: spent.requests, bytes: spent.bytes, receipts: fetched.length, planStatus: plan.status, out };
  }
  if (stage === "assemble") {
    const args = parse(rest, ["--universe", "--universe-sha256", "--cache", "--cache-sha256", "--plan", "--plan-sha256",
      "--cutoff", "--bindings", "--bindings-sha256", "--out"]);
    const planFile = input(args, "plan"), plan = planFile.plan ?? planFile, cutoffAt = args.get("--cutoff") ?? fail("missing_cutoff");
    if (plan?.version !== "native-means-capture-plan-v1") fail("plan_required");
    const means = assembleNativeDailyMeans({ seasonId: plan.seasonId, cutoffAt, universe: universeOf(input(args, "universe")),
      games: plan.assembly.games, playerGames: plan.assembly.playerGames, summaries: plan.assembly.summaries,
      priorGames: plan.assembly.priorGames, notes: plan.assembly.notes, receipts: receiptsOf(input(args, "cache")) }, now());
    const bindings = optional(args, "bindings");
    const out = output(args.get("--out") ?? fail("missing_out"));
    // inputs-v2 binds only means assembled from a complete plan, so the plan's status travels with them.
    privateWrite(resolve(out, "means.json"), { ...means, plan: { status: plan.status, inputHash: plan.inputHash, asOf: plan.asOf, pendingRequests: plan.requests.length } });
    if (bindings) privateWrite(resolve(out, "previews.json"), await previewNativeDailyMeans(means, bindings, now()));
    return { stage, status: "means_assembled", planStatus: plan.status, ...means.stats, previews: !!bindings, networkRequests: 0, databaseWrites: 0, out };
  }
  return fail("stage_required");
}
if (require.main === module) runNativeMeansCapture(process.argv.slice(2)).then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof Error ? error.message : "native-means-capture stopped"); process.exitCode = 1; });
