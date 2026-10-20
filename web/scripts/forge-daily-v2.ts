/** v2 daily FORGE stages (tasks/prd-forge-daily-pipeline.md, v2 decisions), dispatched from forge-daily.ts:
 *   capture-v2 - bounded serial NHL GETs planned for the run date's participation method (plan-only unless --execute):
 *                v1's plan for the frozen window; for rolling, the window schedules, their final boxscores, future weeks
 *                and the universe clubs' rosters
 *   inputs-v2  - offline: universe + fresh means + day capture (+ retained frozen-window templates) -> two bound requests,
 *                skaters and goalies (A-14), each materialized on its own under one cadence scope
 *   outputs-v2 - offline: both closed proofs -> one pending plan with fresh-means bundles, standing-approval policy rows and
 *                pending reviews, plus participation bundles
 * The universe and means stages run through `forge-daily universe` and `forge-daily means`. Nothing here fetches or
 * writes to a database. Behaviour still awaiting TJ is behind flags (lib/player-forecasts/nativeDailyPipelineV2.ts). */
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, closeSync, fsyncSync, mkdirSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { boundedFile, privateWrite } from "./native-baseline-cadence";
import { captureOriginals, dailyCapturePlan, historyWeekDates, morningDueAt } from "./forge-daily";
import { collectNativeMeansOriginals } from "./native-means-capture";
import { buildDailyParticipationInputs, dailyExpiresAt, dailyGames, dailyScheduleBindings, excludeMeansOnlyNatives, reobserveHistoryWindow,
  type HttpReceipt } from "../lib/player-forecasts/nativeDailyPipeline";
import { assertFreshMeansBinding, assertFreshMeansPolicyTemplates, assertParticipationCoverage, assertParticipationMaterializationBound,
  assertStandingApprovalMethods, buildDailyMaterializationRequestsV2, NATIVE_DAILY_APPROVED_METHODS, NATIVE_DAILY_SOURCE_KEYS, nativeDailyCaptureMethod, nativeDailyRollingCapturePlan, buildRollingDailyParticipationInputs, frozenWindowParticipationParents, nativeDailyKnownConflicts,
  nativeDailyNullParticipation, nativeDailyOriginalParent, nativeDailyParticipationMethod, nativeDailyScheduleRevision, nativeDailyUniverse,
  nativeDailyV2Flags } from "../lib/player-forecasts/nativeDailyPipelineV2";
import { buildRollingParticipationHistories, rollingHistoryScheduleUrls } from "../lib/player-forecasts/rollingParticipationFrame";
import { mergeNativeMaterializationParents, type NativeMeansUniverseRow } from "../lib/player-forecasts/nativeDailyMeansCapture";
import { prepareNativeCadenceOutputs, type NativeOutputPreparationCommand } from "../lib/player-forecasts/nativeCadenceOutputPreparation";
import { timestampMicros } from "../lib/projections/evidenceTime";

const MAX_INPUT = 96 * 1024 * 1024;
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const nyDate = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
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
const scheduleUrl = (day: string) => `https://api-web.nhle.com/v1/schedule/${day}`;

/** v1's capture_differs_from_plan for v2: the capture holds exactly the planned URLs of the run's participation method. Its
 * recorded week count (capture-v2) is used when present, so a dropped last week also fails. */
export function assertCaptureMatchesPlanV2(args: { method: "frozen_window" | "rolling_14d"; capture: { method?: string; weeks?: number; receipts: HttpReceipt[] };
  retained: any; universe: NativeMeansUniverseRow[]; seasonId: number; date: string }) {
  const receipts = args.capture.receipts, schedules = receipts.filter(receipt => /\/v1\/schedule\//.test(receipt.url));
  const history = args.method === "frozen_window" ? historyWeekDates(args.retained).map(scheduleUrl) : rollingHistoryScheduleUrls(`${args.date}T16:00:00Z`);
  const weeks = args.capture.weeks ?? schedules.filter(receipt => !history.includes(receipt.url)).length;
  let planned: string[];
  if (args.method === "frozen_window") planned = dailyCapturePlan(args.retained, args.date, weeks);
  else {
    const plan = nativeDailyRollingCapturePlan({ universe: args.universe, seasonId: args.seasonId, date: args.date, weeks, scheduleReceipts: schedules });
    planned = [...plan.windowSchedules, ...(plan.boxscores ?? []), ...plan.futureSchedules, ...(plan.rosters ?? [])];
  }
  if ((args.capture.method !== undefined && args.capture.method !== args.method)
    || JSON.stringify(receipts.map(receipt => receipt.url).sort()) !== JSON.stringify(planned.slice().sort())) fail("capture_differs_from_plan");
}

export async function runForgeDailyV2(stage: string, argv: string[], now = () => new Date(),
  io: { network?: typeof fetch; wait?: (ms: number) => Promise<void> } = {}) {
  if (stage === "capture-v2") {
    const args = parse(argv, ["--universe", "--universe-sha256", "--retained", "--retained-sha256", "--date", "--weeks", "--out", "--execute"]);
    const date = args.get("--date") ?? fail("missing_date"), weeks = Number(args.get("--weeks") ?? 8), method = nativeDailyCaptureMethod(date);
    const universe = input(args, "universe"), { rows: players } = nativeDailyUniverse(universe, nativeDailyV2Flags(undefined)), seasonId = universe.seasonId;
    if (universe.date !== date) fail("capture_not_on_run_date");
    const retained = method === "frozen_window" ? input(args, "retained") : undefined;
    const rolling = (scheduleReceipts?: HttpReceipt[]) => nativeDailyRollingCapturePlan({ universe: players, seasonId, date, weeks, scheduleReceipts });
    const first = retained ? dailyCapturePlan(retained, date, weeks) : rolling().windowSchedules, execute = args.get("--execute") === "true";
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "plan.json"), { method, date, weeks, urls: first, plannedAfterSchedules: retained ? [] : ["boxscores", "future_schedules", "rosters"],
      execute, recordedAt: now().toISOString() });
    if (!execute) return { stage, status: "plan_only", method, requests: first.length, networkRequests: 0, out };
    const event = (action: string, fields: Record<string, unknown>) => { const fd = openSync(resolve(out, "ledger.jsonl"), "a", 0o600);
      try { appendFileSync(fd, JSON.stringify({ at: new Date().toISOString(), action, ...fields }) + "\n"); fsyncSync(fd); } finally { closeSync(fd); } };
    const receipts: HttpReceipt[] = [];
    let failures: Array<{ url: string; reason: string }> = [], attempted = 0;
    // Rolling phases in order; each later phase is planned from the schedules already captured. Boxscores use the means collector's allowlist and budget.
    const phases: Array<() => Promise<void>> = [async () => { const result = await captureOriginals(first, event, io.network, io.wait);
      receipts.push(...result.receipts); failures = result.failures; attempted += result.attempted; }];
    if (!retained) phases.push(async () => { const result = await collectNativeMeansOriginals(rolling(receipts).boxscores!, event, { network: io.network, wait: io.wait });
      receipts.push(...result.receipts); failures = result.failures; attempted += result.spent.requests; },
    async () => { const result = await captureOriginals(rolling(receipts).futureSchedules, event, io.network, io.wait);
      receipts.push(...result.receipts); failures = result.failures; attempted += result.attempted; },
    async () => { const result = await captureOriginals(rolling(receipts.filter(receipt => /\/v1\/schedule\//.test(receipt.url))).rosters!, event, io.network, io.wait);
      receipts.push(...result.receipts); failures = result.failures; attempted += result.attempted; });
    for (const phase of phases) { await phase(); if (failures.length) break; }
    privateWrite(resolve(out, "receipts.json"), { version: "forge-daily-capture-v2", method, date, weeks, receipts, failures, attempted });
    return { stage, status: failures.length ? "stopped" : "captured", method, requests: attempted, receipts: receipts.length,
      bytes: receipts.reduce((sum, receipt) => sum + Buffer.byteLength(receipt.rawBody), 0), out };
  }
  if (stage === "inputs-v2") {
    const args = parse(argv, ["--universe", "--universe-sha256", "--means", "--means-sha256", "--capture", "--capture-sha256", "--retained",
      "--retained-sha256", "--date", "--out", "--flags", "--flags-sha256", "--approved-injury-policy-hash", "--means-uncovered-ceiling",
      "--means-ceiling-approval-ref"]);
    const universe = input(args, "universe"), means = input(args, "means"), capture = input(args, "capture"), retained = input(args, "retained");
    const flags = nativeDailyV2Flags(optional(args, "flags")), date = args.get("--date") ?? fail("missing_date");
    if (capture.failures?.length) fail("capture_incomplete");
    const receipts: HttpReceipt[] = capture.receipts, seasonId = retained.acquisition.seasonId;
    if (universe.seasonId !== seasonId || means.seasonId !== seasonId) fail("season_conflict");
    if (universe.date !== date || receipts.some(receipt => nyDate(receipt.capturedAt) !== date)) fail("capture_not_on_run_date");
    // The cutoff is the latest fresh capture, never earlier than the fresh means it binds.
    const cutoffAt = [...receipts.map(receipt => receipt.capturedAt), means.cutoffAt].sort((a, b) => Number(micros(a) - micros(b))).at(-1)!;
    const { rows: players, gate } = nativeDailyUniverse(universe, flags), byId = new Map(players.map(player => [player.playerId, player]));
    const ceiling = Number(args.get("--means-uncovered-ceiling") ?? 0), ceilingRef = args.get("--means-ceiling-approval-ref") ?? null;
    if (!Number.isSafeInteger(ceiling) || ceiling < 0) fail("invalid_means_uncovered_ceiling");
    if (ceiling && !ceilingRef?.trim()) fail("means_ceiling_requires_approval_ref");
    const meansBinding = { ...assertFreshMeansBinding(means, players, date, ceiling), approvalRef: ceilingRef };
    for (const { payload } of means.additionalNativeObservations) {
      const player = byId.get(payload.playerId);
      if (!player || player.nhlPlayerId !== payload.nhlPlayerId || player.teamId !== payload.teamId || player.rosterRevision !== payload.rosterRevision) fail("means_universe_conflict");
    }
    const method = nativeDailyParticipationMethod(cutoffAt, flags), knownConflicts = nativeDailyKnownConflicts(universe, cutoffAt, flags, args.get("--approved-injury-policy-hash"));
    assertCaptureMatchesPlanV2({ method, capture, retained, universe: players, seasonId, date });
    const schedules = receipts.filter(receipt => /\/v1\/schedule\//.test(receipt.url)), rosters = receipts.filter(receipt => /\/v1\/roster\//.test(receipt.url));
    const runIds = { skater: randomUUID(), goalie: randomUUID() }, yahoo = { gameKey: "477", season: String(seasonId).slice(0, 4) };
    let participation: { inputs: any[]; coverage: any[] }, participationParents: any[], acquisition = retained.acquisition, games: Array<{ gameId: number; startsAt: string }>;
    let futureSchedules: HttpReceipt[], extra: Record<string, unknown> = {};
    if (method === "frozen_window") {
      const historyUrls = historyWeekDates(retained).map(day => `https://api-web.nhle.com/v1/schedule/${day}`);
      futureSchedules = schedules.filter(receipt => !historyUrls.includes(receipt.url));
      const bindings = dailyScheduleBindings(futureSchedules, cutoffAt, yahoo);
      const history = reobserveHistoryWindow({ retained: retained.participationInputs, weeks: schedules.filter(receipt => historyUrls.includes(receipt.url)), cutoffAt });
      // Frozen templates apply only to universe members whose identity and roster revision are unchanged.
      const templates = retained.participationInputs.filter((value: any) => { const player = byId.get(value.scope.playerId);
        return player && player.nhlPlayerId === value.scope.nhlPlayerId && player.teamId === value.scope.teamId && player.rosterRevision === value.scope.rosterRevision; });
      participation = buildDailyParticipationInputs({ retained: templates, rosterReceipts: rosters, bindings, historyEvidence: history.evidence, cutoffAt, seasonId, knownConflicts });
      const templated = new Set(retained.participationInputs.map((value: any) => value.scope.playerId)), kept = new Set(templates.map((value: any) => value.scope.playerId));
      assertParticipationCoverage(participation.coverage, players.filter(player => templated.has(player.playerId) && !kept.has(player.playerId)).map(player => player.playerId));
      const covered = new Set(participation.coverage.map(row => row.playerId));
      participation.coverage.push(...players.filter(player => !covered.has(player.playerId)).map(player => ({ playerId: player.playerId,
        playerClass: player.playerClass, teamId: player.teamId, games: 0, reasons: ["no_frozen_window_template_or_identity_changed"] })));
      games = dailyGames(bindings, date);
      const frozen = frozenWindowParticipationParents({ retained, freshReceipts: [...rosters, ...schedules], derivedParents: [history.parent],
        participationInputs: participation.inputs, cutoffAt, runId: runIds.skater, date, sourceKey: NATIVE_DAILY_SOURCE_KEYS.skater, seasonId, games });
      participationParents = frozen.parents; acquisition = frozen.acquisition; extra = { exclusions: bindings.exclusions, droppedRetainedParents: frozen.droppedParents };
    } else {
      const windowUrls = rollingHistoryScheduleUrls(cutoffAt);
      futureSchedules = schedules.filter(receipt => !windowUrls.includes(receipt.url));
      const frame = buildRollingParticipationHistories({ cutoffAt, seasonId, players: players.map(({ playerId, nhlPlayerId, teamId, playerClass }) =>
        ({ playerId, nhlPlayerId, teamId, playerClass })), scheduleReceipts: schedules.filter(receipt => windowUrls.includes(receipt.url)),
        boxscoreReceipts: receipts.filter(receipt => /\/gamecenter\/\d+\/boxscore$/.test(receipt.url)) });
      const bindings = dailyScheduleBindings(futureSchedules, cutoffAt, yahoo);
      participation = buildRollingDailyParticipationInputs({ players, rosterReceipts: rosters, bindings, frame, cutoffAt, seasonId, knownConflicts });
      assertParticipationCoverage(participation.coverage);
      games = dailyGames(bindings, date);
      participationParents = mergeNativeMaterializationParents(frame.parents, [...rosters, ...futureSchedules].map(nativeDailyOriginalParent)).parents;
      extra = { exclusions: bindings.exclusions, rollingFrame: frame.coverage };
    }
    assertParticipationMaterializationBound(participation.inputs);
    // Only players with a participation target are served (TJ, 2026-10-19, option (a)), by the same rule as v1. It runs after the
    // coverage gates above, so a lost template still stops the run instead of quietly dropping that player's means.
    const scoped = excludeMeansOnlyNatives({ acquisition: { roster: players }, nativeSelection: means.nativeSelection,
      additionalNativeObservations: means.additionalNativeObservations } as any, participation.inputs);
    const served = { ...means, nativeSelection: scoped.request.nativeSelection, additionalNativeObservations: scoped.request.additionalNativeObservations! };
    const bound = buildDailyMaterializationRequestsV2({ acquisition, universe: players, means: served, participationInputs: participation.inputs,
      participationParents, cutoffAt, runIds, date, seasonId, games });
    const out = output(args.get("--out") ?? fail("missing_out"));
    const ref = (kind: "skater" | "goalie") => ({ runId: runIds[kind], sourceKey: bound.requests[kind].sourceKey, date, closureScopeHash: bound.closureScopeHash });
    const command = { version: "native-output-preparation-v1" as const, slotKey: `morning:${date}`, dueAt: morningDueAt(date),
      materialization: ref("skater"), goalieMaterialization: ref("goalie"), games, requiredAcquisitionScopes: bound.requiredAcquisitionScopes,
      freshMeans: { scheduleRevision: nativeDailyScheduleRevision(futureSchedules) } };
    // Two materializations, one issuance: materialize each request, then pass both proofs to outputs-v2.
    privateWrite(resolve(out, "materialization-request-skater.json"), bound.requests.skater);
    privateWrite(resolve(out, "materialization-request-goalie.json"), bound.requests.goalie);
    privateWrite(resolve(out, "preparation-command.json"), command);
    privateWrite(resolve(out, "coverage.json"), { cutoffAt, method, flags, universe: gate, games, ...extra, means: { cutoffAt: means.cutoffAt,
      selected: means.nativeSelection.length, coverage: means.coverage, meansOnlyExcluded: scoped.excluded, plan: means.plan, binding: meansBinding },
      participation: participation.coverage,
      requestBytes: bound.requestBytes, participationInputs: { skater: bound.requests.skater.participationInputs!.length, goalie: bound.requests.goalie.participationInputs!.length } });
    return { stage, status: "inputs_bound", method, cutoffAt, flags, universe: gate, nativeSelected: served.nativeSelection.length,
      meansOnlyExcluded: scoped.excluded.length,
      participationInputs: participation.inputs.length, parents: bound.requests.skater.parents?.length, requestBytes: bound.requestBytes, games: games.length,
      materializations: { skater: bound.requests.skater.participationInputs!.length, goalie: bound.requests.goalie.participationInputs!.length },
      dueAt: command.dueAt, networkRequests: 0, databaseWrites: 0, out };
  }
  if (stage === "outputs-v2") {
    const args = parse(argv, ["--command", "--command-sha256", "--proof", "--proof-sha256", "--goalie-proof", "--goalie-proof-sha256", "--templates", "--templates-sha256", "--approval-ref",
      "--max-null-participation", "--flags", "--flags-sha256", "--out"]);
    const maxNull = Number(args.get("--max-null-participation") ?? fail("missing_max_null_participation"));
    if (!Number.isSafeInteger(maxNull) || maxNull < 0) fail("invalid_max_null_participation");
    const flags = nativeDailyV2Flags(optional(args, "flags")), approvalRef = args.get("--approval-ref") ?? fail("missing_approval_ref");
    if (approvalRef !== NATIVE_DAILY_APPROVED_METHODS.standingApprovalRef) fail("standing_approval_ref_not_pinned");
    const { freshMeans, ...command } = input(args, "command"), templates = input(args, "templates"), issued = now();
    if (!freshMeans?.scheduleRevision) fail("fresh_means_command_required");
    // A split day (A-14) needs both closures; a single-request command takes one proof, as before.
    if (!!command.goalieMaterialization !== args.has("--goalie-proof")) fail("split_materialization_proofs_required");
    const skaterProof = input(args, "proof"), goalieProof = command.goalieMaterialization ? input(args, "goalie-proof") : undefined;
    const proof = goalieProof ? { skater: skaterProof, goalie: goalieProof } : skaterProof;
    assertFreshMeansPolicyTemplates(templates.rows);
    // The reviewed plan contributes only policy terms; its bundles and participation are not re-issued.
    const reviewedPlan = { ...templates, rows: templates.rows.filter((row: any) => ["baseline_evaluation_policy", "baseline_validation_review"].includes(row.entity_kind)) };
    const participationInputs = [skaterProof, goalieProof].filter(Boolean).flatMap((value: any) => value.rows)
      .filter((row: any) => row.dataset_key === "native-participation-input-v1").flatMap((row: any) => row.payload.inputs);
    const result = await prepareNativeCadenceOutputs({ ...(command as Omit<NativeOutputPreparationCommand, "reviewedPlan" | "daily">), reviewedPlan,
      daily: { expiresAt: dailyExpiresAt(issued.toISOString(), participationInputs, command.games), participationOwnerApprovalRef: approvalRef,
        freshMeans: { standingApprovalRef: approvalRef, scheduleRevision: freshMeans.scheduleRevision } } }, proof, issued);
    const methods = assertStandingApprovalMethods(result.plan, flags), nulls = nativeDailyNullParticipation(result.plan, flags);
    if (nulls.gated > maxNull) fail(`null_participation_exceeds_gate:${nulls.gated}`);
    const out = output(args.get("--out") ?? fail("missing_out"));
    privateWrite(resolve(out, "pending-plan.json"), result.plan);
    privateWrite(resolve(out, "pending-cadence-command.json"), result.cadenceCommand);
    privateWrite(resolve(out, "receipt.json"), { ...result.receipt, nulls, flags, methods, templatesSha256: args.get("--templates-sha256"),
      proofSha256: { skater: args.get("--proof-sha256"), goalie: args.get("--goalie-proof-sha256") ?? null } });
    return { stage, ...result.receipt, nulls, flags, methods, planSha256: sha(JSON.stringify(result.plan)), out };
  }
  return fail("stage_required");
}
