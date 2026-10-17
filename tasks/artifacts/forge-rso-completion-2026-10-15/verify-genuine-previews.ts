import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { buildGameExpectations } from "../../../web/lib/player-forecasts/gameExpectations";
import { startChartFromGameExpectations, selectStartChartExpectationBasis } from "../../../web/lib/projections/startChartContract";
import type { PlanningData, PlanningGame } from "../../../web/lib/rosterScheduleOptimizer/planningTypes";

// Read the explicitly captured development packet, never an endpoint or database.
const root = process.argv[2], out = process.argv[3];
if (!root || !out) throw new Error("Expected private capture root and exclusive output path");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const snapshot = read(join(root, "loaded-planning-evidence.json")).snapshot;
const execution = read(join(root, "native-mean-previews-v2/execution-report.json"));
const metadata = read(join(root, "future-games-metadata.json"));
const owned = new Set(snapshot.roster.map((row: any) => row.playerId));
const players = snapshot.players.filter((row: any) => owned.has(row.id));
const abbreviations = new Map<number, string>();
for (const player of snapshot.players) if (player.nhlTeamId && player.teamAbbreviation) {
  const prior = abbreviations.get(player.nhlTeamId);
  assert(!prior || prior === player.teamAbbreviation, "Conflicting retained club identities");
  abbreviations.set(player.nhlTeamId, player.teamAbbreviation);
}
const ownTeams = new Set(players.map((row: any) => row.nhlTeamId));
const games: PlanningGame[] = metadata.flatMap((game: any) => [true, false].flatMap(home => {
  const team = home ? game.homeTeamId : game.awayTeamId;
  const opponent = home ? game.awayTeamId : game.homeTeamId;
  if (!ownTeams.has(team)) return [];
  assert(abbreviations.has(team) && abbreviations.has(opponent), "Missing retained club identity");
  return [{ id: String(game.id), date: game.date, startsAt: new Date(game.startTime).toISOString(),
    teamAbbreviation: abbreviations.get(team)!, opponent: abbreviations.get(opponent)!, home,
    status: "scheduled" as const, scheduleRevision: execution.scheduleRevision }];
}));
const sources = execution.reports.flatMap((row: any) => {
  assert.equal(row.exitCode, 0);
  const preview = read(row.output);
  assert.equal(preview.publicUsesApproved, false);
  assert(preview.bundle.sources.every((source: any) => source.released === false));
  return preview.bundle.sources;
});
for (const path of process.argv.slice(4)) {
  const preview = read(path);
  assert.equal(preview.publicUsesApproved, false);
  assert(preview.bundle.sources.every((source: any) => source.released === false));
  sources.push(...preview.bundle.sources);
}
assert.equal(new Set(sources.map((source: any) => `${source.playerId}:${source.targetKey}`)).size, sources.length);
const conditionalAbility = players.map((player: any) => {
  const keys = player.playerClass === "goalie"
    ? ["WINS_GOALIE", "GOALS_AGAINST_GOALIE", "SAVES_GOALIE", "SHUTOUTS_GOALIE"]
    : ["GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS"];
  const required = keys.map(key => sources.find((source: any) => String(source.playerId) === player.id && source.targetKey === key));
  const complete = required.every((source: any) => source && Number.isFinite(source.mean) && source.basis === "per_appearance");
  return { playerId: player.id, weightedAbilityTargetsComplete: complete,
    perAppearancePoints: complete ? required.reduce((sum: number, source: any) => sum + source.mean * snapshot.rules.scoring.weights[source.targetKey], 0) : null,
    expectedDailyPoints: null, publicUsesApproved: false };
});
if (process.argv.length > 4) assert(conditionalAbility.every((row: any) => row.weightedAbilityTargetsComplete));
const data: PlanningData = { players, games, forecasts: [], baselineSources: sources, participationSources: [],
  evidence: { schedule: { source: "approved schedule metadata only", asOf: null, seasonId: 20262027,
    completeness: "partial", limitations: ["No authoritative source completeness witness."] } } };
const now = new Date();
const checks = [1, 10, 20].map(count => {
  const view = buildGameExpectations(data, { seasonId: 20262027, startDate: "2026-10-16", endDate: "2026-12-15",
    timeZone: "America/New_York", mode: "next_n", games: count, playerIds: players.map((row: any) => row.id) }, now);
  assert.equal(view.players.length, 19);
  assert.equal(view.players.reduce((n, player) => n + player.games.length, 0), 19 * count);
  for (const player of view.players) {
    assert.equal(player.horizonComplete, false);
    assert.equal(player.expectedAppearances, null);
    assert.equal(player.expectedStarts, null);
    for (const total of Object.values(player.totals)) assert.equal(total.expected, null);
    for (const ratio of Object.values(player.ratios)) assert.equal(ratio.value, null);
    for (const game of player.games) for (const target of Object.values(game.targets)) {
      assert.equal(target.expected, null);
      assert.equal(target.conditional, null);
      assert.equal(target.allowedUses.totals, false);
    }
  }
  const board = startChartFromGameExpectations(view);
  for (const basis of ["expected", "per_appearance"] as const) {
    const selected = selectStartChartExpectationBasis(board, basis);
    for (const player of selected.players) {
      assert.equal(player.proj_goals, null);
      assert.equal(player.proj_fantasy_points, null);
    }
  }
  return { scheduledTeamGames: count, rosterPlayers: 19, scheduledBindings: 19 * count,
    publicNumericForecasts: 0, allUnreleasedInputsWithheld: true, scheduleComplete: false };
});
const result = { status: "genuine_development_inputs_negative_admission_check", checkedAt: now.toISOString(),
  sourceCount: sources.length, checks, conditionalAbility, sourceRequests: 0, databaseWrites: 0,
  limitations: ["Offline shared FORGE/RSO/StartChart contract check only; no published feed, API or browser readback.",
    "Private per-appearance points are a diagnostic weighted sum under the retained league rules, not unconditional daily totals or a recommendation.",
    "Inputs retain their individual materialization clocks/policies; this check does not issue a common production revision.",
    "No permissions, participation, schedule evidence, release status or source values were changed to make the check pass."] };
writeFileSync(out, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ ...result, conditionalAbility: undefined,
  playersWithWeightedAbilityTargets: conditionalAbility.filter((row: any) => row.weightedAbilityTargetsComplete).length }));
