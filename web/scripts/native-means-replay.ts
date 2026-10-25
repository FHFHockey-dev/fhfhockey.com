/** Offline acceptance replay of the FORGE v2 `means` stage on the retained 2026-10-16 originals.
 * Each 2026-10-16 native observation came from one assembly batch (its own cutoff, players and approved games). The
 * replay feeds the stage the same batch inputs, rebuilt from the retained receipt files, and compares its selection
 * and observation payload hashes with the retained materialization request. It also re-plans the owned and full
 * universes from the retained schedules, checks the pieces against the unchanged materializer, and estimates the
 * first-run and steady-state capture budget. No network, no database; one new private output file.
 *
 * Usage: native-means-replay.ts --root FHFH_PRIVATE_FORGE_RSO_COMPLETION_20261016_DIR --out NEW_PRIVATE_JSON
 * When bundled (esbuild), call runNativeMeansReplay from a small runner and pass --define:require.main=null, or the
 * imported scripts' own CLI entry points also start (they stop at argument parsing). */
import { createHash, randomUUID } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assembleNativeDailyMeans, NATIVE_MEANS_BODY_BYTES, nativeMeansMaterializationPieces,
  planNativeMeansCapture, type NativeMeansGame, type NativeMeansObservation, type NativeMeansUniverseRow } from "../lib/player-forecasts/nativeDailyMeansCapture";
import { prepareNativeInputMaterialization, type NativeMaterializationRequest } from "../lib/player-forecasts/nativeInputMaterialization";
import { buildNativeSkaterBaselineSnapshot } from "../lib/player-forecasts/baselineGeneration";
import { PRIOR_APPEARANCE_POLICY_VERSION } from "../lib/player-forecasts/baselineRates";
import type { HttpReceipt } from "../lib/player-forecasts/nativeDailyPipeline";
import { previewNativeDailyMeans } from "./native-means-capture";

const fail = (reason: string): never => { throw new Error(reason); };
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
type Run = { name: string; cutoffAt: string; universe: NativeMeansUniverseRow[]; games: NativeMeansGame[];
  playerGames: Record<string, number[]>; summaries?: Record<string, any>; priorGames?: Record<string, number[]> };

export async function runNativeMeansReplay(argv: string[], now = new Date()) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--root", "--out"].includes(argv[i]) || !argv[i + 1] || args.has(argv[i])) fail("usage: --root DIR --out NEW_FILE");
    args.set(argv[i], argv[i + 1]);
  }
  const root = resolve(args.get("--root") ?? fail("missing_root")), out = resolve(args.get("--out") ?? fail("missing_out"));
  const pins: Record<string, string> = {};
  const read = (name: string) => { const bytes = readFileSync(join(root, name)); pins[name] = sha(new Uint8Array(bytes)); return JSON.parse(bytes.toString("utf8")); };
  const retained: NativeMaterializationRequest = read("daily-acquisition-contract-20261016-v1/retained-materialization-request.json");
  const seasonId = retained.acquisition.seasonId;

  // Retained original receipts named for this replay (2026-10-16 capture directories).
  const hart = read("goalie-shutout-hart-v1/observation.json")[0], oettinger = read("goalie-shutout-oettinger-v1/observation.json")[0];
  const cache: HttpReceipt[] = [...read("native-capture-v2/receipts.json").receipts, ...read("candidate-participation-capture-v1/receipts.json").receipts,
    ...read("candidate-conditional-capture-v1/receipts.json").receipts, ...hart.payload.shutoutSummary.receipts,
    ...oettinger.payload.shutoutSummary.receipts, ...read("fiala-prior-landings-v1/receipts.json").receipts];
  const strip = ({ endpoints: _endpoints, ...game }: any): NativeMeansGame => game;
  const all = (universe: NativeMeansUniverseRow[], games: NativeMeansGame[]) =>
    Object.fromEntries(universe.map(player => [player.playerId, games.map(game => game.id)]));

  // Batch scopes as retained.
  const scopeA = read("native-assembly-scope-v2.json"), scopeB = read("candidate-native-development-v1/scope.json");
  const gamesA = scopeA.games.map(strip), gamesB = scopeB.games.map(strip);
  const extra = read("candidate-participation-preparation-v1/missing-source-allocation-v1.json").requests
    .filter((value: any) => value.kind === "historical_boxscore").map((value: any): NativeMeansGame => ({ id: value.gameId, seasonId, date: value.date,
      type: 2, startTime: value.scheduledAt, homeTeamId: value.homeTeamId, awayTeamId: value.awayTeamId }));
  const gamesC = [...new Map([...gamesA, ...extra].map(game => [game.id, game])).values()];
  const conditional = read("candidate-conditional-gap-preparation-v1/capture-allocation.json").requests.filter((value: any) => value.kind === "goalie_summary");
  const summaryScope = (value: any) => { const [, start, end] = /gameDate%3E%3D%22(\d{4}-\d{2}-\d{2})%22%20and%20gameDate%3C%3D%22(\d{4}-\d{2}-\d{2})%22/.exec(value.url) ?? fail("summary_url");
    return { nhlPlayerId: value.nhlPlayerId, seasonId, startDate: start, endDate: end, approvedGameIds: value.approvedGameIds }; };
  const cutoffC = read("candidate-conditional-means-preparation-v1/preparation-receipt.json").preparedAt;
  const cutoffW = read("goalie-summary-win-preparation-v1/publication-proposal.json").cutoffAt;
  const only = (universe: NativeMeansUniverseRow[], playerId: number) => universe.filter(player => player.playerId === playerId);

  const runs: Run[] = [
    { name: "A_owned_native_capture", cutoffAt: scopeA.cutoffAt, universe: scopeA.roster, games: gamesA, playerGames: all(scopeA.roster, gamesA) },
    { name: "B_candidate_reuse", cutoffAt: scopeB.cutoffAt, universe: scopeB.roster, games: gamesB, playerGames: all(scopeB.roster, gamesB) },
    { name: "hart_shutout", cutoffAt: read("goalie-shutout-hart-v1/report.json").captureCutoffAt, universe: only(scopeA.roster, hart.payload.playerId),
      games: gamesA, playerGames: all(only(scopeA.roster, hart.payload.playerId), gamesA), summaries: { [hart.payload.playerId]: hart.payload.shutoutSummary.scope } },
    { name: "oettinger_shutout", cutoffAt: read("goalie-shutout-oettinger-v1/report.json").captureCutoffAt, universe: only(scopeA.roster, oettinger.payload.playerId),
      games: gamesA, playerGames: all(only(scopeA.roster, oettinger.payload.playerId), gamesA), summaries: { [oettinger.payload.playerId]: oettinger.payload.shutoutSummary.scope } },
  ];
  const results = new Map<string, ReturnType<typeof assembleNativeDailyMeans>>();
  const execute = (run: Run) => { const result = assembleNativeDailyMeans({ seasonId, cutoffAt: run.cutoffAt, universe: run.universe, games: run.games,
    playerGames: run.playerGames, receipts: cache, summaries: run.summaries, priorGames: run.priorGames }, now); results.set(run.name, result); return result; };
  for (const run of runs) execute(run);
  // Batch C: each candidate's current-club games among the 88 retained universe-club games, plus the games where
  // batch B had already verified a positive-minute appearance (players whose club changed).
  const positiveB = new Map(results.get("B_candidate_reuse")!.coverage.map(row => [row.playerId,
    row.games.filter((game: any) => game.status === "verified_positive_minutes").map((game: any) => game.gameId as number)]));
  const playerGamesC = Object.fromEntries(scopeB.roster.map((player: NativeMeansUniverseRow) => [player.playerId, gamesC
    .filter(game => game.homeTeamId === player.teamId || game.awayTeamId === player.teamId || positiveB.get(player.playerId)?.includes(game.id)).map(game => game.id)]));
  const summariesC = Object.fromEntries(conditional.map((value: any) => [value.playerId, summaryScope(value)]));
  const runC: Run = { name: "C_candidate_conditional", cutoffAt: cutoffC, universe: scopeB.roster, games: gamesC, playerGames: playerGamesC, summaries: summariesC };
  execute(runC); runs.push(runC);
  const shesterkin = Number(read("goalie-summary-win-preparation-v1/publication-proposal.json").playerId);
  const runW: Run = { name: "shesterkin_summary_win", cutoffAt: cutoffW, universe: only(scopeB.roster, shesterkin), games: gamesC,
    playerGames: { [shesterkin]: playerGamesC[shesterkin] }, summaries: { [shesterkin]: summariesC[shesterkin] } };
  execute(runW); runs.push(runW);

  // Compare every retained selection with the stage output of the batch that produced it (matched by its cutoff).
  const expected = new Map((retained.additionalNativeObservations ?? []).map(value => [value.payload_hash, value]));
  const comparisons = retained.nativeSelection.map(selection => {
    const original = expected.get(selection.inputHash)!, run = runs.find(value => value.cutoffAt === original.available_at);
    const produced = run && results.get(run.name)!.nativeSelection.find(value => value.playerId === selection.playerId && value.policyVersion === selection.policyVersion);
    return { ...selection, cutoffAt: original.available_at, run: run?.name ?? null, producedHash: produced?.inputHash ?? null,
      identical: produced?.inputHash === selection.inputHash };
  });
  const reproduced = comparisons.filter(value => value.identical);
  const assignments = (selections: Array<{ playerId: number; policyVersion: string }>) => new Set(selections.map(value => `${value.playerId}:${value.policyVersion}`));
  const stageAssignments = assignments(runs.flatMap(run => results.get(run.name)!.nativeSelection)), retainedAssignments = assignments(retained.nativeSelection);

  // Prior appearance (Fiala): 2026-10-16 used database raw rows (April fetch clocks, PBP roster lineage) rather than
  // HTTP receipts, so byte identity is impossible by construction. Rebuild HTTP-form receipts from the same original
  // bytes and compare the policy assignment and the means.
  const fiala = (retained.additionalNativeObservations ?? []).find(value => value.payload.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION)!;
  const priorReceipts: HttpReceipt[] = fiala.payload.appearances.map((appearance: any) => {
    // The retained original is a byte span with its own hash (bound as an original parent on 2026-10-16).
    const raw = appearance.finalBoxscore.rawRow, { rawBody, bodySha256 } = raw.retainedOriginal;
    if (sha(rawBody) !== bodySha256) fail("retained_prior_original_hash_mismatch");
    return { url: `https://api-web.nhle.com/v1/gamecenter/${raw.game_id}/boxscore`, capturedAt: new Date(raw.fetched_at).toISOString(), bodySha256, rawBody };
  });
  const fialaPlayer = only(scopeA.roster, fiala.payload.playerId);
  const prior = assembleNativeDailyMeans({ seasonId, cutoffAt: fiala.available_at, universe: fialaPlayer, games: gamesA,
    playerGames: all(fialaPlayer, gamesA), receipts: [...cache, ...priorReceipts],
    priorGames: { [fiala.payload.playerId]: fiala.payload.appearances.map((appearance: any) => appearance.gameId) } }, now);
  const means = (observation: any) => Object.fromEntries(buildNativeSkaterBaselineSnapshot({ ...observation.payload, seasonId,
    cutoffAt: observation.payload.capturedAt, sourceWatermark: observation.payload_hash }).targets.map((target: any) => [target.targetKey, target.ratePerAppearance]));
  const priorProduced = prior.additionalNativeObservations[0];
  const priorComparison = { playerId: fiala.payload.playerId, policyAssigned: priorProduced?.payload.policyVersion ?? null,
    retainedMeans: means(fiala), producedMeans: priorProduced ? means(priorProduced) : null };
  const priorMeansEqual = !!priorProduced && JSON.stringify(priorComparison.retainedMeans) === JSON.stringify(priorComparison.producedMeans);

  // The reproduced observations, bound to the retained acquisition, must pass the unchanged materializer.
  const matched = runs.flatMap(run => results.get(run.name)!.additionalNativeObservations)
    .filter(value => reproduced.some(entry => entry.inputHash === value.payload_hash));
  const unique = [...new Map(matched.map(value => [value.payload_hash, value])).values()] as NativeMeansObservation[];
  const pieces = nativeMeansMaterializationPieces(unique), closedAt = now.toISOString();
  const request: NativeMaterializationRequest = { runId: randomUUID(), sourceKey: "native-means-replay", closureScopeHash: "0".repeat(64),
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now), acquisition: retained.acquisition, ...pieces };
  const prepared = prepareNativeInputMaterialization(request, closedAt), requestBytes = Buffer.byteLength(JSON.stringify(request));
  const appearances = unique.reduce((sum, value) => sum + value.payload.appearances.length, 0);
  const observationBytes = Buffer.byteLength(JSON.stringify(unique));

  // Previews with the existing producers, bound to each club's next retained scheduled game, against the reviewed
  // 2026-10-16 bundles (same input watermark and target): identical means and source IDs.
  const previewNow = new Date(Date.parse(cutoffW) + 30 * 60000);
  const reviewed = read("daily-dry-run-20261020-replay-v1/reviewed-native.json").rows.filter((row: any) => row.entity_kind === "seasonal_rate_bundle")
    .flatMap((row: any) => row.payload.sources);
  const upcoming = new Map<number, { gameId: number; scheduledAt: string }>();
  for (const parent of retained.parents ?? []) if (parent.original && /\/v1\/schedule\//.test(parent.original.url)) {
    for (const day of JSON.parse(parent.original.rawBody).gameWeek ?? []) for (const game of day.games ?? []) {
      if (game.gameType !== 2 || Date.parse(game.startTimeUTC) <= previewNow.getTime()) continue;
      for (const teamId of [game.homeTeam.id, game.awayTeam.id]) {
        const known = upcoming.get(teamId);
        if (!known || Date.parse(game.startTimeUTC) < Date.parse(known.scheduledAt)) upcoming.set(teamId, { gameId: game.id, scheduledAt: new Date(game.startTimeUTC).toISOString() });
      }
    }
  }
  const bindings = Object.fromEntries(unique.flatMap(value => { const next = upcoming.get(value.payload.teamId);
    const revision = reviewed.find((source: any) => source.sourceWatermark === value.payload_hash)?.scheduleRevision;
    return next && revision ? [[value.payload.playerId, { ...next, scheduleRevision: revision }]] : []; }));
  const previewed = await previewNativeDailyMeans({ seasonId, additionalNativeObservations: unique }, bindings, previewNow);
  const previewSources = previewed.previews.flatMap(preview => preview.sources.map((source: any) => ({ ...source, inputHash: preview.inputHash })));
  const meanChecks = previewSources.map(source => { const old = reviewed.find((value: any) => value.sourceWatermark === source.inputHash && value.targetKey === source.targetKey);
    return { mean: old?.mean === source.mean, sourceId: old?.sourceId === source.sourceId, found: !!old }; });

  // Planning from the retained weekly schedules (captured 2026-10-16 04:56-05:13Z) with the 2026-10-16 history cut,
  // passed explicitly: games before 2026-10-13 New York, and that day's walk-forward reservation register.
  const reserved: number[] = read("native-capture-allocation-v2.json").reservedGameIds;
  const schedules = (retained.parents ?? []).flatMap(parent => parent.original && /\/v1\/schedule\//.test(parent.original.url)
    ? [{ url: parent.original.url, capturedAt: parent.capturedAt, bodySha256: parent.original.bodySha256, rawBody: parent.original.rawBody }] : []);
  const planAsOf = "2026-10-16T07:30:00.000Z", historyBefore = "2026-10-13T03:59:59.999Z", anchor = "2026-09-29";
  const ownedPlan = planNativeMeansCapture({ seasonId, asOf: planAsOf, historyBefore, excludedGameIds: reserved, scheduleAnchor: anchor,
    universe: scopeA.roster, cache: [...cache, ...schedules] });
  const fullPlan = planNativeMeansCapture({ seasonId, asOf: planAsOf, historyBefore, excludedGameIds: reserved, scheduleAnchor: anchor,
    universe: retained.acquisition.roster, cache: [...cache, ...schedules] });
  const plannedA = assembleNativeDailyMeans({ seasonId, cutoffAt: scopeA.cutoffAt, universe: scopeA.roster, games: ownedPlan.assembly.games,
    playerGames: ownedPlan.assembly.playerGames, receipts: cache, notes: ownedPlan.assembly.notes }, now);
  const plannedAIdentical = comparisons.filter(value => value.run === "A_owned_native_capture")
    .filter(value => plannedA.nativeSelection.some(entry => entry.inputHash === value.inputHash)).length;

  // Budget: first scheduled v2 run (2026-10-20 07:00 New York) on this universe, seeded with these retained originals.
  // All walk-forward games are ordinary inputs since the 2026-10-17 closure amendment, so nothing is excluded.
  const mondayAsOf = "2026-10-20T11:00:00.000Z";
  const monday = planNativeMeansCapture({ seasonId, asOf: mondayAsOf, scheduleAnchor: anchor, universe: retained.acquisition.roster, cache: [...cache, ...schedules] });
  const clubs = new Set(retained.acquisition.roster.map(player => player.teamId));
  const knownFuture = new Map<number, any>();
  for (const receipt of schedules) for (const day of JSON.parse(receipt.rawBody).gameWeek ?? []) for (const game of day.games ?? []) {
    if (game.gameType === 2 && day.date >= "2026-10-16" && Date.parse(game.startTimeUTC) < Date.parse(mondayAsOf)
      && (clubs.has(game.homeTeam.id) || clubs.has(game.awayTeam.id))) knownFuture.set(game.id, game);
  }
  const retainedGameIds = new Set(cache.flatMap(receipt => /\/gamecenter\/(\d+)\/boxscore$/.exec(receipt.url)?.[1] ?? []).map(Number)
    .filter(gameId => String(gameId).startsWith(String(seasonId).slice(0, 4))));
  const lastBefore = Math.max(...[...retainedGameIds].filter(gameId => String(gameId).startsWith("202602"))), firstAfter = Math.min(...knownFuture.keys());
  // Oct 13-15 hold the `gap` league games between the last retained boxscore and the first retained Oct 16 game.
  const gap = firstAfter - lastBefore - 1, goalies = retained.acquisition.roster.filter(player => player.playerClass === "goalie");
  const lines = { schedule: monday.requests.filter(value => value.kind === "schedule").length, boxscore: gap + knownFuture.size,
    landing: gap + knownFuture.size, goalie_summary: goalies.length };
  const bytes = (value: Record<string, number>) => Object.entries(value).reduce((sum, [kind, count]) => sum + count * (NATIVE_MEANS_BODY_BYTES as any)[kind], 0);
  const firstRun = { requests: Object.values(lines).reduce((a, b) => a + b, 0), bytes: bytes(lines), byKind: lines };
  const firstRunWithPrior = { requests: firstRun.requests + 20, bytes: firstRun.bytes + 20 * NATIVE_MEANS_BODY_BYTES.prior_boxscore,
    note: "adds 20 prior-season boxscores for one zero-appearance skater (landings already retained)" };
  const cold = { schedule: lines.schedule + 2, boxscore: lines.boxscore + retainedGameIds.size, landing: lines.landing + retainedGameIds.size, goalie_summary: goalies.length };
  const steady = { schedule: 1, boxscore: 7, landing: 7, goalie_summary: 3 };

  const report = { version: "native-means-replay-20261016-v1", generatedAt: now.toISOString(), root, inputPins: pins,
    runs: runs.map(run => ({ name: run.name, cutoffAt: run.cutoffAt, players: run.universe.length, games: run.games.length,
      selected: results.get(run.name)!.nativeSelection.length, assemblerCalls: results.get(run.name)!.stats.assemblerCalls })),
    selection: { retained: retained.nativeSelection.length, reproducedIdentical: reproduced.length,
      notReproduced: comparisons.filter(value => !value.identical) },
    policyAssignment: { stageOnly: [...stageAssignments].filter(value => !retainedAssignments.has(value)),
      retainedOnly: [...retainedAssignments].filter(value => !stageAssignments.has(value)) },
    priorAppearance: { ...priorComparison, meansEqual: priorMeansEqual, reasons: prior.coverage[0]?.reasons,
      limitation: "2026-10-16 prior inputs were database raw rows; the stage consumes HTTP receipts, so payload bytes differ by construction." },
    previews: { now: previewNow.toISOString(), previews: previewed.previews.length, skipped: previewed.skipped, sources: previewSources.length,
      reviewedSourcesForReproducedInputs: reviewed.filter((value: any) => unique.some(input => input.payload_hash === value.sourceWatermark)).length,
      identicalMeans: meanChecks.filter(value => value.mean).length, identicalSourceIds: meanChecks.filter(value => value.sourceId).length,
      unmatched: meanChecks.filter(value => !value.found).length },
    materialization: { status: "prepared", observations: unique.length, parents: pieces.parents.length, rows: prepared.rows.length + 2,
      expectedItems: prepared.manifest.expectedItems, requestBytes, appearances, observationBytes,
      bytesPerSelectedAppearance: Math.round(observationBytes / appearances),
      projection: [10, 15, 20].map(perPlayer => ({ appearancesPerObservation: perPlayer,
        observationBytes: Math.round(observationBytes / appearances * perPlayer * unique.length),
        note: "same 80 observations; parents and participation inputs come on top; materializer request bound is 64 MiB" })) },
    plan: { asOf: planAsOf, historyBefore, excludedGameIds: reserved.length, owned: { status: ownedPlan.status, requests: ownedPlan.requests.map(value => value.kind + ":" + value.reason),
      games: ownedPlan.assembly.games.length, sameGamesAsRetainedScopeA: JSON.stringify(ownedPlan.assembly.games.map(game => game.id).sort())
        === JSON.stringify(gamesA.map((game: NativeMeansGame) => game.id).sort()), summaries: ownedPlan.summaries,
      plannedRunAIdentical: plannedAIdentical, plannedRunARetained: comparisons.filter(value => value.run === "A_owned_native_capture").length },
    full: { status: fullPlan.status, games: fullPlan.assembly.games.length, sameGamesAsRetainedBatchC: JSON.stringify(fullPlan.assembly.games.map(game => game.id).sort())
      === JSON.stringify(gamesC.map(game => game.id).sort()), requests: fullPlan.estimate } },
    budget: { firstScheduledRun: { asOf: mondayAsOf, roundOne: monday.estimate, roundOneRequests: monday.requests.map(value => value.url),
      projection: { ...firstRun,
        assumptions: [`${gap} Oct 13-15 league games (ID gap; the released walk-forward games included), all touching universe clubs`,
          `${knownFuture.size} Oct 16-19 universe-club games from the retained weekly schedules`,
          `${goalies.length} goalie summaries, one per universe goalie`,
          "the same 69-player universe; schedules include the week containing the run date"] }, withPrior: firstRunWithPrior },
    coldCache: { requests: Object.values(cold).reduce((a, b) => a + b, 0), bytes: bytes(cold), byKind: cold },
    steadyStateDaily: { requests: Object.values(steady).reduce((a, b) => a + b, 0), bytes: bytes(steady), byKind: steady,
      assumption: "about 7 league games a day, the current schedule week and about 3 goalie summaries" },
    approvedBound: { requests: 120, bytes: 2 * 1024 * 1024 } },
    networkRequests: 0, databaseWrites: 0 };
  const fd = openSync(out, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(report, null, 2)); } finally { closeSync(fd); }
  return { out, reproducedIdentical: reproduced.length, retained: retained.nativeSelection.length, priorMeansEqual, previews: report.previews,
    materializationRows: prepared.rows.length + 2, ownedPlanSameGames: report.plan.owned.sameGamesAsRetainedScopeA,
    fullPlanSameGames: report.plan.full.sameGamesAsRetainedBatchC, firstRun: report.budget.firstScheduledRun.projection, networkRequests: 0 };
}

if (require.main === module) runNativeMeansReplay(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(error instanceof Error ? error.stack : "native-means-replay failed"); process.exitCode = 1; });
