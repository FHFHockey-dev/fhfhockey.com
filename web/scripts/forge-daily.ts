/** v1 daily FORGE driver (see tasks/prd-forge-daily-pipeline.md). Stages:
 *   capture  - bounded serial NHL GETs (club rosters, weekly schedules); plan-only unless --execute
 *   inputs   - offline: retained request + captures -> bound materialization request and preparation command
 *   outputs  - offline: closed materialization proof -> pending daily publication plan
 *   review   - offline: independent reviewer decision -> reviewed plan and cadence command
 * v2 stages: universe (forge-daily-universe.ts), means (native-means-capture.ts), inputs-v2 and outputs-v2 (forge-daily-v2.ts).
 * Materialize and publish use scripts/native-baseline-cadence.ts. Nothing here writes to a database. */
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { boundedFile, privateWrite } from "./native-baseline-cadence";
import { buildDailyMaterializationRequest, buildDailyParticipationInputs, dailyExpiresAt, dailyGames, dailyScheduleBindings,
  applyNativeDailyReview, excludeMeansOnlyNatives, reobserveHistoryWindow, type HttpReceipt, type NativeDailyReviewDecision } from "../lib/player-forecasts/nativeDailyPipeline";
import { prepareNativeCadenceOutputs, type NativeOutputPreparationCommand } from "../lib/player-forecasts/nativeCadenceOutputPreparation";
import { playerForecastSourcePayloadHash as hash } from "../lib/player-forecasts/sourceSnapshot";

export const DAILY_CAPTURE_LIMITS = Object.freeze({ requests: 60, bodyBytes: 1024 * 1024, totalBytes: 8 * 1024 * 1024,
  requestMs: 8000, totalMs: 300000, spacingMs: 1000 });
const MAX_INPUT = 96 * 1024 * 1024;
const fail = (reason: string): never => { throw new Error(reason); };
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const weekStartDates = (date: string, weeks: number) => Array.from({ length: weeks }, (_, index) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + index * 7 * 86400000).toISOString().slice(0, 10));
/** 08:00 America/New_York on the date, as an instant (EDT/EST resolved by trying both offsets). */
export function morningDueAt(date: string) {
  for (const offset of ["-04:00", "-05:00"]) {
    const instant = new Date(`${date}T08:00:00${offset}`);
    if (new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(instant) === "08") return instant.toISOString();
  }
  return fail("due_time_unresolved");
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

const nyDate = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
/** The frozen participation window's two weekly schedule dates (re-observed for current scope evidence). */
export function historyWeekDates(retained: any) {
  const starts = new Set<string>(retained.participationInputs.map((value: any) => value.history.windowStartAt));
  if (starts.size !== 1) fail("retained_history_window_conflict");
  return weekStartDates(nyDate([...starts][0]), 2);
}

/** Capture plan from the retained request: every universe club roster, the two frozen-window weeks
 * (all games before the reserved experiment period) and weekly schedules from the date. */
export function dailyCapturePlan(retained: any, date: string, weeks: number) {
  if (!Number.isSafeInteger(weeks) || weeks < 1 || weeks > 10) fail("invalid_weeks");
  const clubs = new Map<number, string>();
  for (const parent of retained.parents ?? []) {
    const url: string | undefined = parent.original?.url;
    if (!url || !/\/v1\/schedule\//.test(url)) continue;
    for (const day of JSON.parse(parent.original.rawBody).gameWeek ?? []) for (const game of day.games ?? [])
      for (const team of [game.homeTeam, game.awayTeam]) clubs.set(team.id, team.abbrev);
  }
  const teamIds = [...new Set<number>(retained.participationInputs.map((value: any) => value.scope.teamId))].sort((a, b) => a - b);
  const missing = teamIds.filter(id => !clubs.has(id));
  if (missing.length) fail("club_abbreviation_unknown");
  const season = retained.acquisition.seasonId;
  return [...teamIds.map(id => `https://api-web.nhle.com/v1/roster/${clubs.get(id)}/${season}`),
    ...[...historyWeekDates(retained), ...weekStartDates(date, weeks)].map(day => `https://api-web.nhle.com/v1/schedule/${day}`)];
}

/** Serial, no retries or redirects, byte and time bounded, durable intent before each request. */
export async function captureOriginals(urls: string[], event: (action: string, fields: Record<string, unknown>) => void,
  network: typeof fetch = fetch, wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))) {
  if (urls.length > DAILY_CAPTURE_LIMITS.requests || new Set(urls).size !== urls.length
    || urls.some(url => !/^https:\/\/api-web\.nhle\.com\/v1\/(?:roster\/[A-Z]{2,4}\/\d{8}|schedule\/\d{4}-\d{2}-\d{2})$/.test(url))) fail("capture_scope_denied");
  const receipts: HttpReceipt[] = [], started = Date.now(); let total = 0;
  for (const [index, url] of urls.entries()) {
    if (index) await wait(DAILY_CAPTURE_LIMITS.spacingMs);
    if (Date.now() - started > DAILY_CAPTURE_LIMITS.totalMs) return { receipts, failures: [{ url, reason: "capture_deadline" }], attempted: index };
    event("request_intent", { index: index + 1, url });
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), DAILY_CAPTURE_LIMITS.requestMs);
    try {
      const response = await network(url, { redirect: "error", cache: "no-store", signal: controller.signal, headers: { accept: "application/json" } });
      const rawBody = await response.text(), bytes = Buffer.byteLength(rawBody), capturedAt = new Date().toISOString();
      total += bytes;
      event("response_completed", { index: index + 1, url, status: response.status, bytes, sha256: sha(rawBody) });
      if (!response.ok || bytes > DAILY_CAPTURE_LIMITS.bodyBytes || total > DAILY_CAPTURE_LIMITS.totalBytes) fail("capture_stopped");
      JSON.parse(rawBody);
      receipts.push({ url, capturedAt, bodySha256: sha(rawBody), rawBody });
    } catch (error) {
      event("request_failed", { index: index + 1, url, reason: error instanceof Error ? error.message : "unknown" });
      return { receipts, failures: [{ url, reason: error instanceof Error ? error.message : "unknown" }], attempted: index + 1 };
    } finally { clearTimeout(timer); }
  }
  return { receipts, failures: [] as Array<{ url: string; reason: string }>, attempted: urls.length };
}

export async function runForgeDaily(argv: string[], now = () => new Date()) {
  const [stage, ...rest] = argv;
  if (stage === "capture") {
    const args = parse(rest, ["--retained", "--retained-sha256", "--date", "--weeks", "--out", "--execute"]);
    const urls = dailyCapturePlan(input(args, "retained"), args.get("--date") ?? fail("missing_date"), Number(args.get("--weeks") ?? 8));
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "plan.json"), { urls, limits: DAILY_CAPTURE_LIMITS, execute: args.get("--execute") === "true", recordedAt: now().toISOString() });
    if (args.get("--execute") !== "true") return { stage, status: "plan_only", requests: urls.length, networkRequests: 0, out };
    const event = (action: string, fields: Record<string, unknown>) => { const fd = openSync(resolve(out, "ledger.jsonl"), "a", 0o600);
      try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); } };
    const result = await captureOriginals(urls, event);
    privateWrite(resolve(out, "receipts.json"), result);
    return { stage, status: result.failures.length ? "stopped" : "captured", requests: result.attempted, receipts: result.receipts.length,
      bytes: result.receipts.reduce((sum, receipt) => sum + Buffer.byteLength(receipt.rawBody), 0), out };
  }
  if (stage === "inputs") {
    const args = parse(rest, ["--retained", "--retained-sha256", "--capture", "--capture-sha256", "--date", "--out"]);
    const retained = input(args, "retained"), capture = input(args, "capture"), date = args.get("--date") ?? fail("missing_date");
    if (capture.failures?.length) fail("capture_incomplete");
    const receipts: HttpReceipt[] = capture.receipts, seasonId = retained.acquisition.seasonId;
    // The capture must be exactly today's plan, taken on the run date.
    const historyUrls = historyWeekDates(retained).map(day => `https://api-web.nhle.com/v1/schedule/${day}`);
    const futureWeeks = receipts.filter(receipt => receipt.url.includes("/schedule/") && !historyUrls.includes(receipt.url)).length;
    const planned = dailyCapturePlan(retained, date, futureWeeks);
    if (JSON.stringify(receipts.map(receipt => receipt.url).sort()) !== JSON.stringify(planned.slice().sort())) fail("capture_differs_from_plan");
    if (receipts.some(receipt => nyDate(receipt.capturedAt) !== date)) fail("capture_not_on_run_date");
    // The cutoff is the latest fresh capture, and never earlier than the frozen native inputs it carries.
    const cutoffAt = [...receipts.map(receipt => receipt.capturedAt), retained.acquisition.cutoffAt]
      .sort((x, y) => Date.parse(x) - Date.parse(y)).at(-1) ?? fail("no_receipts");
    const bindings = dailyScheduleBindings(receipts.filter(receipt => receipt.url.includes("/schedule/") && !historyUrls.includes(receipt.url)), cutoffAt,
      { gameKey: "477", season: String(seasonId).slice(0, 4) });
    const history = reobserveHistoryWindow({ retained: retained.participationInputs, weeks: receipts.filter(receipt => historyUrls.includes(receipt.url)), cutoffAt });
    const participation = buildDailyParticipationInputs({ retained: retained.participationInputs, rosterReceipts: receipts.filter(receipt => receipt.url.includes("/roster/")),
      bindings, historyEvidence: history.evidence, cutoffAt, seasonId });
    if (participation.coverage.some((row: any) => row.reasons.length || !row.games)) fail("participation_coverage_incomplete");
    const games = dailyGames(bindings, date), sourceKey = "native-daily-selected-inputs";
    const scoped = excludeMeansOnlyNatives(retained, participation.inputs);
    const bound = buildDailyMaterializationRequest({ retained: scoped.request, freshReceipts: receipts, derivedParents: [history.parent], participationInputs: participation.inputs, cutoffAt,
      runId: randomUUID(), date, sourceKey, seasonId, games });
    const out = output(args.get("--out") ?? fail("missing_out"));
    const command: Omit<NativeOutputPreparationCommand, "reviewedPlan" | "daily"> = { version: "native-output-preparation-v1", slotKey: `morning:${date}`,
      dueAt: morningDueAt(date), materialization: { runId: bound.request.runId, sourceKey, date, closureScopeHash: bound.closureScopeHash },
      games, requiredAcquisitionScopes: bound.requiredAcquisitionScopes };
    privateWrite(resolve(out, "materialization-request.json"), bound.request);
    privateWrite(resolve(out, "preparation-command.json"), command);
    privateWrite(resolve(out, "coverage.json"), { cutoffAt, games, exclusions: bindings.exclusions, players: participation.coverage, droppedParents: bound.droppedParents,
      meansOnlyExcluded: scoped.excluded });
    return { stage, status: "inputs_bound", cutoffAt, participationInputs: participation.inputs.length, parents: bound.request.parents?.length,
      droppedParents: bound.droppedParents, meansOnlyExcluded: scoped.excluded.length, games: games.length, dueAt: command.dueAt, networkRequests: 0, databaseWrites: 0, out };
  }
  if (stage === "outputs") {
    const args = parse(rest, ["--command", "--command-sha256", "--proof", "--proof-sha256", "--reviewed", "--reviewed-sha256", "--approval-ref",
      "--max-null-participation", "--standing-approval-ref", "--out"]);
    const maxNull = Number(args.get("--max-null-participation") ?? fail("missing_max_null_participation"));
    if (!Number.isSafeInteger(maxNull) || maxNull < 0) fail("invalid_max_null_participation");
    const command = input(args, "command"), proof = input(args, "proof"), reviewed = input(args, "reviewed"), issued = now();
    const participationInputs = proof.rows.filter((row: any) => row.dataset_key === "native-participation-input-v1").flatMap((row: any) => row.payload.inputs);
    const result = await prepareNativeCadenceOutputs({ ...command, reviewedPlan: reviewed, daily: { expiresAt: dailyExpiresAt(issued.toISOString(), participationInputs, command.games),
      participationOwnerApprovalRef: args.get("--approval-ref") ?? fail("missing_approval_ref"), standingApprovalRef: args.get("--standing-approval-ref") } },
      proof, issued);
    // A mostly-null participation set is not a usable daily forecast; stop before writing a plan.
    if (result.receipt.nullParticipation > maxNull) fail(`null_participation_exceeds_gate:${result.receipt.nullParticipation}`);
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "pending-plan.json"), result.plan);
    privateWrite(resolve(out, "pending-cadence-command.json"), result.cadenceCommand);
    privateWrite(resolve(out, "receipt.json"), result.receipt);
    return { stage, ...result.receipt, out };
  }
  if (stage === "review") {
    const args = parse(rest, ["--plan", "--plan-sha256", "--command", "--command-sha256", "--decision", "--decision-sha256",
      "--head-id", "--expected-revision", "--expected-hash", "--out"]);
    const plan = input(args, "plan"), command = input(args, "command"), decision: NativeDailyReviewDecision = input(args, "decision");
    if (hash(command.cadenceInput.publicationPlan) !== hash(plan)) fail("command_plan_mismatch");
    const reviewed = applyNativeDailyReview(plan, decision), revision = Number(args.get("--expected-revision") ?? fail("missing_expected_revision"));
    const expectedHash = args.get("--expected-hash") ?? fail("missing_expected_hash");
    const cadenceCommand = { ...command, cadenceInput: { ...command.cadenceInput, publicationPlan: reviewed },
      catalogHead: { headId: args.get("--head-id") ?? fail("missing_head_id"), expectedRevision: revision,
        expectedHash: expectedHash === "null" ? null : expectedHash, observationId: randomUUID() } };
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "cadence-command.json"), cadenceCommand);
    return { stage, status: "reviewed_pending_publish", reviewedPlanHash: hash(reviewed), rows: reviewed.rows.length, out };
  }
  if (stage === "universe") return (await import("./forge-daily-universe")).runForgeDailyUniverse(rest, now);
  if (stage === "means") return (await import("./native-means-capture")).runNativeMeansCapture(rest, now);
  if (stage === "inputs-v2" || stage === "outputs-v2") return (await import("./forge-daily-v2")).runForgeDailyV2(stage, rest, now);
  return fail("stage_required");
}
if (require.main === module) runForgeDaily(process.argv.slice(2)).then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error instanceof Error ? error.message : "forge-daily stopped"); process.exitCode = 1; });
