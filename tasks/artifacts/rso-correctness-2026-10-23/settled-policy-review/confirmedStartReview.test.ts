import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "../projections/dailyBoardEvidence";
import { buildForgeDailyBridgeForecasts } from "../rosterScheduleData/forgeDailyBridge";
import { forecastCalendarPolicy } from "../player-forecasts/contributions";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { executeRosterPlanning } from "./executionAdapter";
import { defaultWorkspace } from "./workspace";
import { currentRsoUsePolicy } from "../player-forecasts/rsoUsePolicy";
import { compactBridgeForecasts, expandBridgeForecasts, type BridgeForecastWire } from "../rosterScheduleData/bridgeForecastWire";
import type { PlanningData, PlanningSnapshot } from "./planningTypes";
const now = "2026-10-22T12:00:00.000Z";
function fixture() {
  const workspace = defaultWorkspace(), revision = "forge-daily-bridge-v1:synthetic-run";
  const player = { id: "7", nhlId: 77, nhlTeamId: 1, rosterRevision: "roster-a", name: "Synthetic player",
    teamAbbreviation: "MIN", eligiblePositions: ["C"], playerClass: "skater" as const, eligibilityVerified: true,
    availability: "rostered" as const, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] };
  const game = { id: "30", date: "2026-10-23", startsAt: "2026-10-23T20:00:00Z", teamAbbreviation: "MIN",
    opponent: "TOR", home: true, status: "scheduled" as const, scheduleRevision: "schedule-a" };
  const wire: BridgeForecastWire = { version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations: ["Synthetic approved bridge fixture"],
    runs: [[revision, revision, "forge-daily-bridge-v1:fixture", now, now]],
    rows: [["7", "30", 0, "2026-10-24T00:00:00Z", { GOALS: 2 }, null, false, null]] };
  const data: PlanningData = { players: [player], games: [game], forecasts: [], baselineSources: [], participationSources: [],
    evidence: { schedule: { source: "synthetic complete schedule", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] },
      forecasts: { source: "synthetic bridge", asOf: now, seasonId: 20262027, completeness: "complete", limitations: [] } },
    forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: now,
      scheduleRevision: "schedule-a", rosterRevision: "roster-a", issuedRevisionIds: [revision], baselineChecksum: null,
      requiredOpportunities: 1, forecastedOpportunities: 1, exclusionCounts: {},
      rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: [revision] } } };
  const forecasts = expandBridgeForecasts(wire, data);
  const snapshot: PlanningSnapshot = { id: "private-saved-work", context: { provider: "manual", seasonId: 20262027,
    leagueId: "private-league", teamId: "private-team", startDate: game.date, endDate: game.date, timeZone: "UTC", asOf: now },
    players: [player], games: [game], forecasts, roster: [{ playerId: "7", position: "active" }],
    rules: { ...workspace.rules, lineupMode: "daily", rosterSlots: { C: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: now, end: "2026-10-25T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { GOALS: 1 }, categories: [] } },
    realized: { GOALS: 5 }, opponent: { roster: [], realized: { GOALS: 3 }, remaining: { GOALS: 1 } },
    lockedAssignments: [{ date: game.date, playerId: "7", slotId: "C#1", source: "manager" }],
    evidence: data.evidence, forecastManifest: data.forecastManifest };
  const body = { success: true, data, bridgeForecasts: wire };
  return { snapshot: structuredClone(snapshot), body, intent: workspace.intent };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function goalieFixture(mark: boolean | null, observedAt = now) {
  const result = fixture(), { snapshot, body } = result;
  snapshot.context.provider = "yahoo";
  snapshot.players[0].playerClass = "goalie";
  snapshot.players[0].eligiblePositions = ["G"];
  body.data.players = structuredClone(snapshot.players);
  if (mark !== null) snapshot.players[0].startingStatus = { source: "yahoo", date: snapshot.games[0].date, isStarting: mark, observedAt };
  snapshot.rules.rosterSlots = { G: 1 };
  snapshot.rules.scoring = { mode: "points", weights: { SAVES_GOALIE: 1 }, categories: [] };
  snapshot.rules.goalieMinimum = { required: 1, credited: 0, counts: "starts", penalty: "none",
    periodStart: now, periodEnd: "2026-10-24T00:00:00Z" };
  snapshot.realized = {}; snapshot.opponent = null; snapshot.lockedAssignments = [];
  body.bridgeForecasts.rows[0] = ["7", "30", 0, "2026-10-24T00:00:00Z", { SAVES_GOALIE: 7.5 }, 0.3, false, { SAVES_GOALIE: 25 }];
  snapshot.forecasts = expandBridgeForecasts(body.bridgeForecasts, body.data);
  return result;
}
function mockRead(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ ...structuredClone(body as object),
    read: { nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now } }) })));
}

function acceptedObservation(status: string): BoardGoalieEvidence {
  return { id: "synthetic-server-observation", game_id: 30, team_id: 1, player_id: 77,
    observed_at: "2026-10-22T11:59:00Z", available_at: "2026-10-22T11:59:01Z", created_at: "2026-10-22T11:59:02Z",
    expires_at: "2026-10-23T20:00:00Z", accepted: true, source_key: "synthetic-accepted-news", observation_status: status };
}
function fromServerObservation(observation: BoardGoalieEvidence | null, prior = 0.3) {
  const result = goalieFixture(true), { snapshot, body } = result;
  const second = { ...snapshot.players[0], id: "8", nhlId: 78, name: "Synthetic teammate", availability: "free_agent" as const, startingStatus: undefined };
  snapshot.players.push(second); body.data.players.push(structuredClone(second));
  const goalieNews = resolveDailyBoardEvidence({ cutoff: now, lineups: [], goalies: observation ? [observation] : [], conflicts: [] });
  const emitted = buildForgeDailyBridgeForecasts({ runs: [{ run_id: "trusted-run", as_of_date: "2026-10-22", created_at: now, git_sha: "synthetic-sha" }],
    skaters: [], goalies: [{ run_id: "trusted-run", as_of_date: "2026-10-22", horizon_games: 1, game_id: 30, goalie_id: 77, team_id: 1,
      starter_probability: prior, proj_saves: 25, proj_goals_allowed: 2.5, proj_shots_against: 27.5, proj_win_prob: 0.5, proj_shutout_prob: 0.05 }],
    goalieShares: [{ player_id: 77, game_id: 30, game_date: "2026-10-23", l10_start_pct: 0.3, season_start_pct: 0.3, updated_at: now },
      { player_id: 78, game_id: 30, game_date: "2026-10-23", l10_start_pct: 0.7, season_start_pct: 0.7, updated_at: now }], goalieNews,
  }, body.data.players, body.data.games, new Date(now), 20262027, forecastCalendarPolicy(14));
  const ids = [...new Set(emitted.forecasts.map(row => row.revisionId))];
  body.data.forecastManifest!.issuedRevisionIds = ids;
  body.data.forecastManifest!.rsoUsePolicy!.bridgeRevisionIds = ids;
  const packed = compactBridgeForecasts(emitted.forecasts, body.data, 20262027);
  expect(packed.wire).not.toBeNull();
  body.data.forecasts = packed.forecasts; body.bridgeForecasts = packed.wire!;
  snapshot.forecastManifest = structuredClone(body.data.forecastManifest);
  snapshot.forecasts = structuredClone(emitted.forecasts);
  return { ...result, goalieNews };
}

it("applies trusted confirmed and ruled-out server evidence through real adapter and worker, without trusting contradictory Yahoo labels", async () => {
  const worker = { onmessage: null as ((event: { data: unknown }) => Promise<void>) | null, postMessage: vi.fn() };
  vi.stubGlobal("self", worker); await import("../../hooks/rosterPlanning.worker");
  for (const [status, probability] of [["confirmed", 1], ["ruled_out", 0]] as const) {
    const { snapshot, body, intent, goalieNews } = fromServerObservation(acceptedObservation(status));
    expect(goalieNews.assertions).toHaveLength(1);
    // The saved Yahoo label deliberately disagrees with current server evidence.
    snapshot.players[0].startingStatus!.isStarting = status !== "confirmed";
    mockRead(body);
    const result = await executeRosterPlanning(JSON.parse(JSON.stringify(snapshot)), intent);
    const row = result.displaySnapshot.forecasts.find(item => item.playerId === "7")!;
    expect(row).toMatchObject({ startProbability: probability, confirmedStart: status === "confirmed", stats: { SAVES_GOALIE: 25 * probability } });
    expect(result.result.selected.projectedValue).toBe(25 * probability);
    worker.postMessage.mockClear();
    await worker.onmessage!({ data: { snapshot: structuredClone(snapshot), intent, options: {}, candidateOptions: {} } });
    expect(worker.postMessage).toHaveBeenCalledWith(result);
  }
});
// TJ selected these floors on October23; they are product policy, not calibrated probabilities.
it.each([["likely", 0.8], ["projected", 0.65], ["unknown", 0.3], ["unconfirmed", 0.3]] as const)
("applies chosen policy without claiming confirmation for server status %s", async (status, probability) => {
  const { snapshot, body, intent } = fromServerObservation(acceptedObservation(status)); mockRead(body);
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.displaySnapshot.forecasts.find(row => row.playerId === "7")).toMatchObject({
    startProbability: probability, confirmedStart: false, stats: { SAVES_GOALIE: 25 * probability } });
});
it.each(["likely", "projected"])("keeps a higher modeled prior above the chosen %s floor", async status => {
  const { snapshot, body, intent } = fromServerObservation(acceptedObservation(status), 0.9); mockRead(body);
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.displaySnapshot.forecasts.find(row => row.playerId === "7")).toMatchObject({
    startProbability: 0.9, confirmedStart: false, stats: { SAVES_GOALIE: 22.5 } });
});
it.each(["not_accepted", "expired", "future_published", "future_available", "future_created", "wrong_game", "wrong_team", "wrong_player", "absent"])
("does not override for %s server observation", async kind => {
  const observation = acceptedObservation("confirmed");
  if (kind === "not_accepted") observation.accepted = false;
  if (kind === "expired") observation.expires_at = now;
  if (kind === "future_published") observation.observed_at = "2026-10-22T12:00:01Z";
  if (kind === "future_available") observation.available_at = "2026-10-22T12:00:01Z";
  if (kind === "future_created") observation.created_at = "2026-10-22T12:00:01Z";
  if (kind === "wrong_game") observation.game_id = 31;
  if (kind === "wrong_team") observation.team_id = 2;
  if (kind === "wrong_player") observation.player_id = 99;
  const { snapshot, body, intent } = fromServerObservation(kind === "absent" ? null : observation);mockRead(body);
  const result = await executeRosterPlanning(snapshot, intent);
  expect(result.displaySnapshot.forecasts.find(row => row.playerId === "7")).toMatchObject({
    startProbability: 0.3, confirmedStart: false, stats: { SAVES_GOALIE: 7.5 } });
});
