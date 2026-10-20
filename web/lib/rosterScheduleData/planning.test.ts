// @vitest-environment node
import { encodePlanningDataTransport, decodePlanningDataTransport, PLANNING_DATA_TRANSPORT_LIMITS, PlanningDataTransportLimitError } from "./planningDataTransport";
import * as nativeAdmissionModule from "lib/player-forecasts/nativeContributionAdmission";
import * as planningModule from "./planning";
import planningHandler from "../../pages/api/v1/roster-schedule-optimizer/data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGameExpectations } from "lib/player-forecasts/gameExpectationReader";
import { loadPlanningData, normalizePlanningGames, parsePlanningDataQuery, publicPlanningForecasts } from "./planning";
import type { ContributionPlanningSnapshot, ForecastDiscoveryExclusion, PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import { resolvePlanningContributions } from "lib/player-forecasts/planningContributions";
import { buildGoalieParticipationReceipt, buildFrozenWindowGoalieParticipationReceipt, buildFrozenWindowGoalieStartReceipt, type GoalieParticipationInput, buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt } from "lib/player-forecasts/modeledGoalieParticipation";
import { GOALIE_PARTICIPATION_DATASET, FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET, FROZEN_WINDOW_GOALIE_START_DATASET, type GoalieParticipationBundle, ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET, ROSTER_OBSERVATION_GOALIE_START_DATASET } from "lib/player-forecasts/modeledGoalieParticipationStore";
import { buildSkaterParticipationReceipt, buildFrozenWindowSkaterParticipationReceipt, type SkaterParticipationInput, buildRosterObservationSkaterParticipationReceipt } from "lib/player-forecasts/modeledSkaterParticipation";
import { PARTICIPATION_DATASET, FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET, type SkaterParticipationBundle, ROSTER_OBSERVATION_SKATER_PARTICIPATION_DATASET } from "lib/player-forecasts/modeledSkaterParticipationStore";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "lib/projections/issuedContext";
import { admittedBoardGoalieForecast } from "lib/projections/starterBoardScoring";
import { normalizeStartChartResponse } from "lib/projections/startChartContract";
import { buildNativeSkaterParticipationFields } from "lib/projections/nativeGoalAccounting";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "lib/projections/calibrationEligibility";
import { acceptedNewsSupersedes, loadAcceptedForecastNews } from "lib/projections/acceptedNews";
import { timestampMicros } from "lib/projections/evidenceTime";

import { ROSTER_CONTINUATION_ASSUMPTION } from "lib/player-forecasts/targetRosterObservation";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt, buildRollingWindowSkaterParticipationReceipt,
  rollingParticipationWindow } from "lib/player-forecasts/rollingWindowParticipation";
import { ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET, ROLLING_WINDOW_GOALIE_START_DATASET } from "lib/player-forecasts/modeledGoalieParticipationStore";
import { ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET } from "lib/player-forecasts/modeledSkaterParticipationStore";
import { fetchBoundedNhlSchedule } from "./source";
import { normalizeNhlGameToTeamRows } from "./normalize";

vi.mock("lib/supabase/server", () => ({ default: {} }));

const membershipCreatedAt = ["2026-09-01T00:00:00Z"];
const rosterRevision = forgeRosterRevision({ canonicalId: 7, nhlId: 847001, seasonId: 20262027, teamId: 1, membershipCreatedAt });
const player: PlanningPlayer = { id: "7", nhlId: 847001, nhlTeamId: 1, rosterRevision, name: "Goalie", playerClass: "goalie", teamAbbreviation: "TOR", eligiblePositions: ["G"], availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const rows = [{ id: 1, source_game_id: 2026020001, source_season_id: 20262027, game_date: "2026-10-10", start_time: "2026-10-10T23:00:00Z", team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT", schedule_status: "OK", is_countable: true, game_type: 2 }];
const issuedContext: ForgeIssuedContextV1 = { version: "forge-issued-context-v1", game: { id: 2026020001, date: "2026-10-10", seasonId: 20262027,
  startTime: "2026-10-10T23:00:00Z", homeTeamId: 1, awayTeamId: 2 },
  schedule: [
    { gameKey: "nhl", season: "2026", sourceSeasonId: 20262027, teamId: 1, opponentTeamId: 2,
      teamAbbreviation: "TOR", opponentAbbreviation: "MTL", startTime: "2026-10-10T23:00:00Z",
      gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z",
      revision: forgeScheduleRevision({ source_game_id: 2026020001, start_time: "2026-10-10T23:00:00Z",
        team_abbreviation: "TOR", opponent_abbreviation: "MTL", game_status: "FUT", schedule_status: "OK" }) },
    { gameKey: "nhl", season: "2026", sourceSeasonId: 20262027, teamId: 2, opponentTeamId: 1,
      teamAbbreviation: "MTL", opponentAbbreviation: "TOR", startTime: "2026-10-10T23:00:00Z",
      gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: "2026-10-10T09:00:00Z",
      revision: forgeScheduleRevision({ source_game_id: 2026020001, start_time: "2026-10-10T23:00:00Z",
        team_abbreviation: "MTL", opponent_abbreviation: "TOR", game_status: "FUT", schedule_status: "OK" }) },
  ], roster: [{ canonicalId: 7, nhlId: 847001, seasonId: 20262027, teamId: 1,
    membershipCreatedAt, identityUpdatedAt: "2026-09-01T00:00:00Z", revision: rosterRevision }],
  observedAt: "2026-10-10T09:00:00Z" };
const revision = (candidates: unknown[]): ForgeGameRevision => ({ id: "issued-1", run_id: "run-1", game_id: 2026020001, decision_as_of: "2026-10-10T10:00:00Z", published_at: "2026-10-10T10:00:00Z", payload: { players: [], teams: [], goalies: [{ game_id: 2026020001, team_id: 1, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", uncertainty: { daily_board_candidates: candidates } }], codeVersion: "v1", inputProvenance: { rolling_player_history_contract: "test-history", external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, private: "never expose", capturedReads: { version: "forge-captured-reads-v1", hash: "a".repeat(64), readCount: 2, firstReceivedAt: "2026-10-10T09:00:00Z", lastReceivedAt: "2026-10-10T09:01:00Z" }, issuedContexts: [issuedContext] } as ForgeGameRevision["payload"]["inputProvenance"] } });
// Fictional captured evidence; never a provider observation or readiness proof.
function scopedSkaterSelection(row: ForgeGameRevision, probability: 0 | 1 = 1) {
  const evidence = { informationCutoffAt: "2026-10-10T10:00:00Z", assertions: [{
    gameId: 2026020001, teamId: 1, playerId: 847001, dimension: probability ? "ev" as const : "availability" as const,
    value: probability ? "L1" : "out", evidenceId: "private-source-id", sourceKey: "fictional-source", sourceUrl: null,
    publishedAt: "2026-10-10T09:00:00Z", receivedAt: "2026-10-10T09:01:00Z", confirmed: true,
    privateText: "never expose",
  }], conflicts: [] };
  row.payload.evidence = evidence;
  return buildNativeSkaterParticipationFields({ gameId: 2026020001, teamId: 1, playerId: 847001, compute: true, evidence });
}
function rpcResponse(value: unknown): any {
  const promise = Promise.resolve(value);
  return Object.assign(promise, { abortSignal: () => promise });
}
function formDb(historyGames: unknown[], stats: unknown[], fail?: "games" | "skatersGameStats",
  options: { cap?: number; badTable?: string; failure?: string; hangTable?: string } = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const tables: Record<string, unknown[]> = {
    roster_optimizer_team_games: rows,
    fhfh_player_identities: [{ id: 7, nhl_player_id: 847001, canonical_name: "Skater", canonical_position: "L" }],
    teams: [{ id: 1, abbreviation: "TOR" }], rosters: [{ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] }],
    yahoo_matchup_weeks: [], games: historyGames, skatersGameStats: stats,
  };
  const db = { from: (table: string) => {
    let start = 0, end = Infinity;
    let selected = tables[table] ?? [];
    const result = () => {
      if (table === options.hangTable) return new Promise<never>(() => {});
      const failure = table === options.badTable ? options.failure : undefined;
      const offset = failure === "duplicate" ? 0 : start;
      return Promise.resolve({ count: failure === "missing_count" ? null : failure === "overflow" ? 100000
        : selected.length + (failure === "count_drift" && start ? 1 : 0),
      data: failure === "null_data" ? null : failure === "no_progress" && start ? []
        : selected.slice(offset, offset + Math.min(end - start + 1, options.cap ?? Infinity)),
      error: table === fail || failure === "late_error" && start ? { message: "private database details" } : null });
    };
    const chain: any = new Proxy({}, { get: (_, method) => method === "then" ? Promise.resolve(result()).then.bind(Promise.resolve(result()))
      : (...args: any[]) => {
        calls.push({ table, method: String(method), args });
        if (method === "range") [start, end] = args;
        if (method === "in") selected = selected.filter((row: any) => args[1].includes(row[args[0]]));
        return chain;
      } });
    return chain;
  }, rpc: vi.fn().mockReturnValue(rpcResponse({ data: [], error: null })) };
  return { db, calls, tables };
}
function newsDb(events: Array<{ id: string; game_id: number; queue_version: number; accepted_at: string }>,
  options: { cap?: number; missingCount?: boolean; failPage?: number; duplicatePage?: boolean } = {}) {
  const result = formDb([], []);
  result.tables.fhfh_player_identities = [{ id: 7, nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }];
  const from = result.db.from;
  const reads: Array<{ ids: number[]; asOf: string; start: number }> = [];
  result.db.from = (table: string) => {
    if (table !== "forge_board_news_events") return from(table);
    let ids: number[] = [], asOf = "", start = 0, end = 0;
    const chain: any = new Proxy({}, { get: (_, method) => {
      if (method === "then") {
        reads.push({ ids, asOf, start });
        const selected = events.filter(row => ids.includes(row.game_id) && Date.parse(row.accepted_at) <= Date.parse(asOf));
        const offset = options.duplicatePage ? 0 : start;
        const response = { data: selected.slice(offset, offset + Math.min(end - start + 1, options.cap ?? 500)),
          count: options.missingCount ? null : selected.length,
          error: options.failPage === reads.length ? { message: "private failure" } : null };
        return Promise.resolve(response).then.bind(Promise.resolve(response));
      }
      return (...args: any[]) => {
        if (method === "in") ids = args[1];
        if (method === "lte") asOf = args[1];
        if (method === "range") [start, end] = args;
        return chain;
      };
    } });
    return chain;
  };
  result.db.rpc.mockReturnValue(rpcResponse({ data: [revision([{ playerId: 847001, startingProbability: 1,
    conditional: { SAVES_GOALIE: 30 } }])], error: null }));
  return { ...result, reads };
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("public RSO data boundary", () => {
  it("shared game expectations skip unused ownership and recent outcome reads while RSO defaults retain them", async () => {
    const { db, calls } = formDb([], []);
    const scope = { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10", timeZone: "America/New_York", mode: "calendar" as const, games: 1 };
    const now = new Date("2026-10-10T12:00:00Z");
    await loadGameExpectations(db as never, scope, now);
    const optionalTables = ["yahoo_player_ownership_daily", "yahoo_nhl_player_map_read", "games", "skatersGameStats"];
    expect(calls.filter(call => optionalTables.includes(call.table))).toEqual([]);
    calls.length = 0;
    const result = await loadPlanningData(db as never, scope, { now, forecastsEnabled: false });
    expect(calls.some(call => call.table === "yahoo_player_ownership_daily")).toBe(true);
    expect(calls.some(call => call.table === "games")).toBe(true);
    expect(result.evidence.form?.source).not.toBe("not_requested");
  });

  const publicQuery = { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-11" };
  const publicOptions = { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: false };

  it("serves interim FORGE daily projections to RSO callers only, and never once native serving is selected", async () => {
    const { db, tables } = formDb([], []);
    Object.assign(tables, {
      forge_runs: [{ run_id: "run-b", as_of_date: "2026-10-09", created_at: "2026-10-09T15:00:00Z", git_sha: "abc" }],
      forge_player_projections: [{ run_id: "run-b", as_of_date: "2026-10-09", horizon_games: 1, game_id: 2026020000, player_id: 847001, team_id: 1,
        proj_goals_es: 0.3, proj_goals_pp: 0.1, proj_assists_es: 0.4, proj_assists_pp: 0.1, proj_shots_es: 2, proj_shots_pp: 0.5,
        proj_toi_es_seconds: 900, proj_toi_pp_seconds: 120, proj_hits: 1, proj_blocks: 0.4 }],
      forge_goalie_projections: [], goalie_start_projections: [] });
    const bridged = await loadPlanningData(db as never, publicQuery, { ...publicOptions, forgeDailyBridge: true });
    expect(bridged.forecasts).toEqual([expect.objectContaining({ playerId: "7", gameId: "2026020001",
      revisionId: "forge-daily-bridge-v1:run-b", stats: expect.objectContaining({ GOALS: 0.4, POINTS: 0.9 }) })]);
    expect(bridged.evidence.forecasts.source).toBe("Interim FORGE daily projections");
    expect(bridged.forecastManifest).toMatchObject({ issuedRevisionIds: ["forge-daily-bridge-v1:run-b"], forecastedOpportunities: 1 });
    expect(bridged.forecastManifest?.exclusionCounts.serving_disabled).toBeUndefined();
    expect((await loadPlanningData(db as never, publicQuery, publicOptions)).forecasts).toEqual([]);
    expect((await loadPlanningData(db as never, publicQuery, { ...publicOptions, forgeDailyBridge: true,
      source: { kind: "empty", reason: "native_catalog_expired", environment: {} } })).forecasts).toEqual([]);
    vi.stubEnv("RSO_FORGE_DAILY_BRIDGE", "off");
    expect((await loadPlanningData(db as never, publicQuery, { ...publicOptions, forgeDailyBridge: true })).forecasts).toEqual([]);
  });

  it.each(["frozen", "roster observation", "rolling"].flatMap(family => ["skater", "goalie", "start"].map(kind => ({ family, kind }))))
  ("loads and revokes the separately approved $family $kind catalog", async ({ family, kind }) => {
    const observed = family === "roster observation", rolling = family === "rolling";
    const { db, tables } = formDb([], []);
    const evidence = { id: "synthetic-frozen-source", hash: "a".repeat(64),
      availableAt: "2026-10-16T09:00:00Z", capturedAt: "2026-10-16T09:00:00Z" };
    const eligibility = { playerId: 7, nhlPlayerId: 847001, teamId: 1, eligible: true,
      effectiveFrom: "2026-10-01T00:00:00Z", effectiveUntil: "2026-10-17T00:00:00Z", evidence };
    const common = { cutoffAt: "2026-10-16T10:00:00Z",
      scope: { playerId: 7, nhlPlayerId: 847001, seasonId: 20262027, teamId: 1, gameId: 2026020001,
        scheduledAt: "2026-10-17T23:00:00Z", scheduleRevision: "synthetic-schedule", rosterRevision },
      scheduleEvidence: evidence, rosterEvidence: evidence,
      history: { complete: true, windowStartAt: "2026-09-29T04:00:00Z", windowEndAt: "2026-10-13T04:00:00Z",
        scheduleEvidence: evidence, games: [{ gameId: 2026020000, teamId: 1, scheduledAt: "2026-10-13T00:00:00Z",
          occurred: true, eligibility, positiveMinutes: true, resolution: "positive_toi" as const, outcomeEvidence: evidence,
          officialStarter: true, starterEvidence: evidence }] } };
    const clocks = { issuedAt: "2026-10-16T11:00:00Z", expiresAt: "2026-10-16T18:00:00Z" };
    const observation = { playerId: 7, nhlPlayerId: 847001, teamId: 1, seasonId: 20262027, listed: true,
      sourceKind: "official_season_roster" as const, knownConflict: null, evidence, continuationAssumptionVersion: ROSTER_CONTINUATION_ASSUMPTION };
    const window = rollingParticipationWindow(common.cutoffAt);
    const rollingCommon = { ...common, targetRosterObservation: observation,
      history: { ...common.history, windowStartAt: window.startAt, windowEndAt: window.endAt } };
    const input = rolling ? kind === "skater"
      ? { ...rollingCommon, playerClass: "skater" as const, version: "skater-rolling-14d-participation-input-v1" as const }
      : kind === "start" ? { ...rollingCommon, playerClass: "goalie" as const, version: "goalie-rolling-14d-start-input-v1" as const }
      : { ...rollingCommon, playerClass: "goalie" as const, version: "goalie-rolling-14d-participation-input-v1" as const }
      : observed ? kind === "skater"
      ? { ...common, targetRosterObservation: observation, playerClass: "skater" as const, version: "skater-roster-observation-participation-input-v1" as const }
      : kind === "start" ? { ...common, targetRosterObservation: observation, playerClass: "goalie" as const, version: "goalie-roster-observation-start-input-v1" as const }
      : { ...common, targetRosterObservation: observation, playerClass: "goalie" as const, version: "goalie-roster-observation-participation-input-v1" as const }
      : kind === "skater"
      ? { ...common, targetEligibility: eligibility, playerClass: "skater" as const, version: "skater-frozen-window-participation-input-v1" as const }
      : kind === "start" ? { ...common, targetEligibility: eligibility, playerClass: "goalie" as const, version: "goalie-frozen-window-start-input-v1" as const }
      : { ...common, targetEligibility: eligibility, playerClass: "goalie" as const, version: "goalie-frozen-window-participation-input-v1" as const };
    const receipt = (() => {
      switch (input.version) {
        case "skater-roster-observation-participation-input-v1": return buildRosterObservationSkaterParticipationReceipt(input, clocks);
        case "goalie-roster-observation-participation-input-v1": return buildRosterObservationGoalieParticipationReceipt(input, clocks);
        case "goalie-roster-observation-start-input-v1": return buildRosterObservationGoalieStartReceipt(input, clocks);
        case "skater-frozen-window-participation-input-v1": return buildFrozenWindowSkaterParticipationReceipt(input, clocks);
        case "goalie-frozen-window-start-input-v1": return buildFrozenWindowGoalieStartReceipt(input, clocks);
        case "goalie-frozen-window-participation-input-v1": return buildFrozenWindowGoalieParticipationReceipt(input, clocks);
        case "skater-rolling-14d-participation-input-v1": return buildRollingWindowSkaterParticipationReceipt(input, clocks);
        case "goalie-rolling-14d-participation-input-v1": return buildRollingWindowGoalieParticipationReceipt(input, clocks);
        case "goalie-rolling-14d-start-input-v1": return buildRollingWindowGoalieStartReceipt(input, clocks);
      }
    })();
    const dataset = rolling ? kind === "start" ? ROLLING_WINDOW_GOALIE_START_DATASET
      : kind === "skater" ? ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET : ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET
      : observed ? kind === "start" ? ROSTER_OBSERVATION_GOALIE_START_DATASET
      : kind === "skater" ? ROSTER_OBSERVATION_SKATER_PARTICIPATION_DATASET : ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET
      : kind === "start" ? FROZEN_WINDOW_GOALIE_START_DATASET
      : kind === "skater" ? FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET : FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET;
    const env = rolling ? kind === "start" ? "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES"
      : `PLAYER_FORECAST_ROLLING_14D_${kind.toUpperCase()}_PARTICIPATION_RELEASES`
      : observed ? kind === "start" ? "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES"
      : `PLAYER_FORECAST_ROSTER_OBSERVATION_${kind.toUpperCase()}_PARTICIPATION_RELEASES`
      : kind === "start" ? "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES"
      : `PLAYER_FORECAST_FROZEN_WINDOW_${kind.toUpperCase()}_PARTICIPATION_RELEASES`;
    const payload = { version: dataset, seasonId: 20262027, ...clocks, released: true,
      ownerApprovalRef: "synthetic-owner", reviewRef: "synthetic-review", entries: [{ input, receipt }],
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false } };
    const id = "11111111-1111-4111-8111-111111111111", hash = playerForecastSourcePayloadHash(payload);
    tables.player_forecast_source_observations = [{ id, provider: "fhfh", dataset_key: dataset,
      entity_kind: "participation_bundle", entity_key: "20262027", available_at: clocks.issuedAt, payload_hash: hash, payload }];
    const options = { now: new Date("2026-10-16T12:00:00Z"), forecastsEnabled: false };
    const disabled = await loadPlanningData(db as never, publicQuery, options);
    expect(disabled.participationSources).toEqual([]);
    vi.stubEnv(env, `${id}:${hash}`);
    const accepted = await loadPlanningData(db as never, publicQuery, options);
    expect(accepted.participationSources).toHaveLength(1);
    const catalogChecksum = playerForecastSourcePayloadHash([[id, hash]]);
    expect(disabled.forecastManifest?.participationChecksum).toBeNull();
    expect(accepted.forecastManifest?.participationChecksum).toBe(playerForecastSourcePayloadHash(rolling
      ? { existing: null, rollingSkater: kind === "skater" ? catalogChecksum : null,
        rollingGoalie: kind === "goalie" ? catalogChecksum : null, rollingGoalieStarts: kind === "start" ? catalogChecksum : null }
      : observed
      ? { existing: null, observedSkater: kind === "skater" ? catalogChecksum : null,
        observedGoalie: kind === "goalie" ? catalogChecksum : null, observedGoalieStarts: kind === "start" ? catalogChecksum : null }
      : { legacy: null, frozenSkater: kind === "skater" ? catalogChecksum : null,
        frozenGoalie: kind === "goalie" ? catalogChecksum : null, ...(kind === "start" ? { frozenGoalieStarts: catalogChecksum } : {}) }));
    expect(accepted.participationSources![0].model?.version).toContain(rolling ? "rolling-14d" : observed ? "roster-observation" : "frozen-window");
    expect(accepted.participationSources![0].basis).toBe(kind === "start" ? "start" : "appearance");
    if (observed) expect(accepted.evidence.participation.source).toContain("roster-observation continuation proxies");
    if (rolling) expect(accepted.evidence.participation.source).toContain("rolling 14-day history and official roster-observation");
    expect(accepted.forecastManifest?.participationRevisionIds).toEqual([accepted.participationSources![0].revisionId]);
    vi.stubEnv(env, "");
    const revoked = await loadPlanningData(db as never, publicQuery, options);
    expect(revoked.participationSources).toEqual([]);
    expect(revoked.forecastManifest?.id).toBe(disabled.forecastManifest?.id);
    expect(revoked.forecastManifest?.id).not.toBe(accepted.forecastManifest?.id);
  });

  it("loads an exact reviewed participation catalog independently of atomic forecasts and manifests its revocation", async () => {
    const { db, tables } = formDb([], []);
    const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-10T09:00:00Z", capturedAt: "2026-10-10T09:00:00Z" };
    const input: SkaterParticipationInput = { version: "skater-participation-input-v1", cutoffAt: "2026-10-10T10:00:00Z",
      scope: { playerId: 7, nhlPlayerId: 847001, seasonId: 20262027, teamId: 1, gameId: 2026020001,
        scheduledAt: "2026-10-10T23:00:00Z", scheduleRevision: issuedContext.schedule[0].revision, rosterRevision },
      scheduleEvidence: evidence, rosterEvidence: evidence,
      history: { complete: true, windowStartAt: "2026-08-11T10:00:00.000Z", scheduleEvidence: evidence,
        games: [{ gameId: 2026020000, teamId: 1, scheduledAt: "2026-10-08T23:00:00Z", occurred: true, eligible: true,
          positiveMinutes: true, resolution: "positive_toi", eligibilityEvidence: evidence, outcomeEvidence: evidence }] } };
    const clocks = { issuedAt: "2026-10-10T11:00:00Z", expiresAt: "2026-10-10T18:00:00Z" };
    const payload: SkaterParticipationBundle = { version: PARTICIPATION_DATASET, seasonId: 20262027, ...clocks,
      released: true, ownerApprovalRef: "synthetic-owner-ref", reviewRef: "synthetic-review-ref",
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      entries: [{ input, receipt: buildSkaterParticipationReceipt(input, clocks) }] };
    const id = "11111111-1111-4111-8111-111111111111", payloadHash = playerForecastSourcePayloadHash(payload);
    tables.player_forecast_source_observations = [{ id, provider: "fhfh", dataset_key: PARTICIPATION_DATASET,
      entity_kind: "participation_bundle", entity_key: "20262027", available_at: clocks.issuedAt, payload_hash: payloadHash, payload }];
    vi.stubEnv("PLAYER_FORECAST_PARTICIPATION_RELEASES", `${id}:${payloadHash}`);
    const accepted = await loadPlanningData(db as never, publicQuery, publicOptions);
    expect(accepted.forecasts).toEqual([]); expect(accepted.participationSources).toHaveLength(1);
    expect(accepted.forecastManifest?.participationRevisionIds).toEqual([accepted.participationSources![0].revisionId]);
    expect(accepted.evidence.participation.limitations.join(" ")).toContain("calibration unavailable");
    vi.stubEnv("PLAYER_FORECAST_PARTICIPATION_RELEASES", "");
    const revoked = await loadPlanningData(db as never, publicQuery, publicOptions);
    expect(revoked.participationSources).toEqual([]); expect(revoked.forecastManifest?.participationRevisionIds).toEqual([]);
    expect(revoked.forecastManifest?.id).not.toBe(accepted.forecastManifest?.id);
  });

  it("loads goalie appearance receipts through the released catalog into shared contributions and revokes them", async () => {
    const { db, tables } = formDb([], []);
    const evidence = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-10T09:00:00Z", capturedAt: "2026-10-10T09:00:00Z" };
    tables.fhfh_player_identities = [{ id: 7, nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }];
    const eligibility = { playerId: 7, nhlPlayerId: 847001, teamId: 1, eligible: true,
      effectiveFrom: "2026-10-01T00:00:00Z", effectiveUntil: "2026-10-12T00:00:00Z", evidence };
    const input: GoalieParticipationInput = { version: "goalie-participation-input-v1", playerClass: "goalie", targetEligibility: eligibility, cutoffAt: "2026-10-10T10:00:00Z",
      scope: { playerId: 7, nhlPlayerId: 847001, seasonId: 20262027, teamId: 1, gameId: 2026020001,
        scheduledAt: "2026-10-10T23:00:00Z", scheduleRevision: issuedContext.schedule[0].revision, rosterRevision },
      scheduleEvidence: evidence, rosterEvidence: evidence,
      history: { complete: true, windowStartAt: "2026-08-11T10:00:00.000Z", scheduleEvidence: evidence,
        games: [{ gameId: 2026020000, teamId: 1, scheduledAt: "2026-10-08T23:00:00Z", occurred: true, eligibility,
          positiveMinutes: true, resolution: "positive_toi", outcomeEvidence: evidence }] } };
    const clocks = { issuedAt: "2026-10-10T11:00:00Z", expiresAt: "2026-10-10T18:00:00Z" };
    const payload: GoalieParticipationBundle = { version: GOALIE_PARTICIPATION_DATASET, seasonId: 20262027, ...clocks,
      released: true, ownerApprovalRef: "synthetic-owner-ref", reviewRef: "synthetic-review-ref",
      allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
      entries: [{ input, receipt: buildGoalieParticipationReceipt(input, clocks) }] };
    const id = "11111111-1111-4111-8111-111111111111", payloadHash = playerForecastSourcePayloadHash(payload);
    tables.player_forecast_source_observations = [{ id, provider: "fhfh", dataset_key: GOALIE_PARTICIPATION_DATASET,
      entity_kind: "participation_bundle", entity_key: "20262027", available_at: clocks.issuedAt, payload_hash: payloadHash, payload }];
    vi.stubEnv("PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES", `${id}:${payloadHash}`);
    const accepted = await loadPlanningData(db as never, publicQuery, publicOptions);
    expect(accepted.forecasts).toEqual([]); expect(accepted.participationSources).toHaveLength(1);
    expect(accepted.forecastManifest?.participationRevisionIds).toEqual([accepted.participationSources![0].revisionId]);
    expect(accepted.evidence.participation.limitations.join(" ")).toContain("calibration unavailable");
    const baseline = { ...input.scope, kind: "baseline" as const, sourceId: "synthetic-native-volume",
      policyVersion: "native-goalie-appearance-volume-rates-v1", targetKey: "SAVES_GOALIE", unit: "count" as const,
      basis: "per_appearance" as const, mean: 2, participationIntegrated: false, released: true,
      cutoffAt: input.cutoffAt, ...clocks, allowedUses: payload.allowedUses, sourceWatermark: "synthetic-only" };
    const context = { ...publicQuery, asOf: publicOptions.now.toISOString() };
    const resolved = resolvePlanningContributions({ ...accepted, context, baselineSources: [baseline] });
    expect(resolved.forecasts[0].stats.SAVES_GOALIE).toBe(2);
    expect(resolved.forecasts[0].startProbability).toBeNull();
    expect(resolved.forecasts[0].appearanceProbability).toBe(1);
    vi.stubEnv("PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES", "");
    const revoked = await loadPlanningData(db as never, publicQuery, publicOptions);
    expect(revoked.participationSources).toEqual([]); expect(revoked.forecastManifest?.participationRevisionIds).toEqual([]);
    expect(revoked.forecastManifest?.id).not.toBe(accepted.forecastManifest?.id);
    expect(resolvePlanningContributions({ ...revoked, context, baselineSources: [baseline] }).forecasts[0].stats.SAVES_GOALIE).toBeNull();
  });

  function cappedInputs(options: Parameters<typeof formDb>[3] = {}) {
    const fixture = formDb([], [], undefined, { cap: 1, ...options });
    fixture.tables.roster_optimizer_team_games = [...rows, { ...rows[0], id: 2, source_game_id: 2026020002,
      game_date: "2026-10-11", start_time: "2026-10-11T23:00:00Z" }];
    fixture.tables.fhfh_player_identities = [7, 8].map(id => ({ id, nhl_player_id: 847001 + id - 7,
      canonical_name: `Player ${id}`, canonical_position: "L" }));
    fixture.tables.rosters = [847001, 847002].map(playerId => ({ playerId, teamId: 1, created_at: membershipCreatedAt[0] }));
    fixture.tables.teams = [{ id: 1, abbreviation: "TOR" }, { id: 2, abbreviation: "MTL" }];
    return fixture;
  }

  it("reflects corrected memberships without filling missing or conflicting teams from identity pointers", async () => {
    const { db, tables, calls } = formDb([], []);
    tables.fhfh_player_identities = [{ id: 7, nhl_player_id: 847001, canonical_name: "Skater", canonical_position: "L", current_nhl_team_id: 1 }];
    tables.teams = [{ id: 1, abbreviation: "TOR" }, { id: 2, abbreviation: "MTL" }];
    tables.rosters = [];
    const missing = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(missing.players[0]).toMatchObject({ id: "7", nhlId: 847001, teamAbbreviation: null, eligibilityVerified: false });
    expect(missing.evidence.identities.completeness).toBe("partial");
    tables.rosters = [{ playerId: 847001, teamId: 2, created_at: "2026-10-10T10:00:00Z" }];
    const corrected = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(corrected.players[0]).toMatchObject({ id: "7", nhlId: 847001, nhlTeamId: 2, teamAbbreviation: "MTL", eligibilityVerified: false });
    expect(corrected.players[0].rosterRevision).toBeTruthy();
    tables.rosters.push({ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] });
    const conflict = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(conflict.players[0].teamAbbreviation).toBeNull();
    expect(conflict.players[0].rosterRevision).toBeUndefined();
    expect(conflict.evidence.identities.completeness).toBe("partial");
    expect(calls).toContainEqual({ table: "rosters", method: "eq", args: ["is_current", true] });
    expect(calls).toContainEqual({ table: "rosters", method: "eq", args: ["seasonId", 20262027] });
  });

  it("includes a newly reconciled canonical player without promoting roster evidence to league eligibility or participation", async () => {
    const { db, tables, calls } = formDb([], []);
    tables.fhfh_player_identities.push({ id: 11482, nhl_player_id: 8486171, canonical_name: "New roster player", canonical_position: "C" });
    tables.rosters.push({ playerId: 8486171, teamId: 1, created_at: "2026-10-10T10:00:00Z" });
    const result = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(result.players.find(player => player.id === "11482")).toMatchObject({ nhlId: 8486171, teamAbbreviation: "TOR", availability: "unknown", eligibilityVerified: false });
    expect(result.forecasts).toEqual([]);
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "eq", args: ["lifecycle_status", "active_nhl"] });
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "eq", args: ["verification_status", "verified"] });
    expect(calls).toContainEqual({ table: "fhfh_player_identities", method: "is", args: ["merged_into_id", null] });
  });

  it("keeps returned-row freshness separate from unverified horizon coverage", async () => {
    const { db, tables } = cappedInputs();
    tables.roster_optimizer_team_games = [{ ...rows[0], fetched_at: "2026-10-10T09:00:00Z" },
      { ...rows[0], id: 2, source_game_id: 2026020002, game_date: "2026-10-09",
        start_time: "2026-10-09T23:00:00Z", fetched_at: "2026-08-29T17:57:18Z" }];
    const query = { ...publicQuery, timeZone: "UTC" };
    const fresh = await loadPlanningData(db as any, query, publicOptions);
    expect(fresh.games).toHaveLength(1);
    expect(fresh.evidence.schedule).toMatchObject({ completeness: "partial", asOf: "2026-10-10T09:00:00Z" });
    expect(fresh.evidence.schedule.limitations.join(" ")).toContain("source-day coverage");
    expect(fresh.evidence.schedule.limitations.join(" ")).not.toContain("may be stale");
    expect(fresh.forecastManifest?.exclusions?.some(row => row.reasons.includes("incomplete_refresh"))).toBe(true);
    (tables.roster_optimizer_team_games[1] as Record<string, unknown>).start_time = "2026-10-10T00:30:00Z";
    const crossing = await loadPlanningData(db as any, query, publicOptions);
    expect(crossing.games).toHaveLength(2);
    expect(crossing.evidence.schedule.completeness).toBe("partial");
    expect(crossing.evidence.schedule.limitations.join(" ")).toContain("may be stale");
    expect(crossing.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["incomplete_refresh"] });
  });

  it("rejects missing, malformed, future and stale source receipts for returned games", async () => {
    for (const fetched_at of [null, "not-a-time", "2026-10-10T13:00:00Z", "2026-08-29T17:57:18Z"]) {
      const { db, tables } = cappedInputs();
      tables.roster_optimizer_team_games = [{ ...rows[0], fetched_at }];
      const result = await loadPlanningData(db as any, publicQuery, publicOptions);
      expect(result.evidence.schedule.completeness).toBe("partial");
      expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["incomplete_refresh"] });
    }
  });

  it("requires a complete captured day, paired games and explicit off days before certifying the horizon", async () => {
    const { db, tables } = formDb([], []);
    const coverage = { version: "nhl-source-days-v1", date: "2026-10-10", gameIds: [2026020001], emptyDates: ["2026-10-09", "2026-10-11", "2026-10-12"] };
    const side = { ...rows[0], fetched_at: "2026-10-10T09:00:00Z", source_metadata: { scheduleCoverage: coverage } };
    const away = { ...side, id: 2, team_abbreviation: "MTL", opponent_abbreviation: "TOR", home_away: "away" };
    tables.roster_optimizer_team_games = [side, away];
    const query = { ...publicQuery, timeZone: "UTC" };
    const read = () => loadPlanningData(db as never, query, publicOptions);
    expect((await read()).evidence.schedule.completeness).toBe("complete");
    tables.roster_optimizer_team_games = [side];
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    tables.roster_optimizer_team_games = [side, { ...away, fetched_at: "2026-10-10T10:00:00Z" }];
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    tables.roster_optimizer_team_games = [side, away];
    coverage.gameIds.push(2026020002);
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    coverage.gameIds.pop();
    coverage.emptyDates = ["2026-10-11", "2026-10-12"];
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    coverage.emptyDates.push("2026-10-09", "2026-10-10");
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    coverage.emptyDates = ["2026-10-09", "2026-10-11", "2026-10-12"];
    side.fetched_at = away.fetched_at = "2026-10-08T09:00:00Z";
    expect((await read()).evidence.schedule.completeness).toBe("partial");
    side.fetched_at = away.fetched_at = "2026-10-10T11:00:00Z";
    expect((await read()).evidence.schedule.completeness).toBe("complete");
    tables.roster_optimizer_team_games = [];
    expect((await read()).evidence.schedule.completeness).toBe("partial");
  });

  it("certifies the horizon from rows the bounded schedule writer stamps, not from unstamped rows", async () => {
    const nhlGame = { id: 2026020001, season: 20262027, gameType: 2, gameDate: "2026-10-10", startTimeUTC: "2026-10-10T23:00:00Z",
      gameState: "FUT", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "TOR" }, awayTeam: { id: 2, abbrev: "MTL" } };
    const page = { gameWeek: ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]
      .map(date => ({ date, games: date === nhlGame.gameDate ? [nhlGame] : [] })) };
    const source = await fetchBoundedNhlSchedule({ startDate: "2026-10-09", endDate: "2026-10-12",
      readSchedulePage: async () => page as never });
    const written = source.games.flatMap(entry => normalizeNhlGameToTeamRows({ ...entry, fetchedAt: "2026-10-10T09:00:00Z",
      gameKey: "477", yahooSeason: "2026", mapping: { status: "unmapped", reason: "no_week" } }))
      .map((row, index) => ({ ...row, id: index + 1 }));
    const { db, tables } = formDb([], []);
    const read = () => loadPlanningData(db as never, { ...publicQuery, timeZone: "UTC" }, publicOptions);
    tables.roster_optimizer_team_games = written;
    expect((await read()).evidence.schedule.completeness).toBe("complete");
    // The production writer bytes persist the same rows without the witness.
    tables.roster_optimizer_team_games = written.map(({ source_metadata: { scheduleCoverage: _witness, ...metadata }, ...row }) =>
      ({ ...row, source_metadata: metadata }));
    expect((await read()).evidence.schedule.completeness).toBe("partial");
  });

  it("completes capped required scopes before counting games and competing players", async () => {
    const { db, calls } = cappedInputs();
    const result = await loadPlanningData(db as any, publicQuery, publicOptions);
    expect(result.games).toHaveLength(2);
    expect(result.players).toHaveLength(2);
    expect(result.players.every(player => player.teamAbbreviation === "TOR")).toBe(true);
    expect(result.forecastManifest?.requiredOpportunities).toBe(4);
    for (const table of ["roster_optimizer_team_games", "fhfh_player_identities", "rosters", "teams"]) {
      expect(calls.filter(call => call.table === table && call.method === "range").map(call => call.args[0])).toEqual([0, 1]);
      expect(calls.filter(call => call.table === table && call.method === "select")
        .every(call => (call.args[1] as any).count === "exact")).toBe(true);
    }
  });

  it.each(["missing_count", "null_data", "count_drift", "late_error", "duplicate", "no_progress", "overflow"])(
    "does not certify a fresh snapshot after %s in a required scope", async failure => {
      for (const badTable of ["roster_optimizer_team_games", "fhfh_player_identities", "rosters", "teams"]) {
        const { db } = cappedInputs({ badTable, failure });
        await expect(loadPlanningData(db as any, publicQuery, publicOptions)).rejects.toThrow(/Planning source/);
      }
    });

  it("preserves complete schedule planning when optional reads are incomplete", async () => {
    for (const badTable of ["yahoo_player_ownership_daily", "yahoo_matchup_weeks", "games"]) {
      const { db } = cappedInputs({ badTable, failure: "missing_count" });
      const result = await loadPlanningData(db as any, publicQuery, publicOptions);
      expect(result.games).toHaveLength(2);
      expect(result.players).toHaveLength(2);
      expect(result.forecastManifest?.requiredOpportunities).toBe(4);
      const source = badTable === "games" ? "form" : badTable === "yahoo_matchup_weeks" ? "matchupWeeks" : "ownership";
      expect(result.evidence[source].limitations.length).toBeGreaterThan(0);
    }
  });

  it("bounds a hung required read and aborts its transport", async () => {
    vi.useFakeTimers();
    const { db, calls } = cappedInputs({ hangTable: "rosters" });
    const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, deadlineMs: Date.now() + 1000 });
    const rejected = expect(pending).rejects.toThrow("deadline");
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    const signal = calls.find(call => call.table === "rosters" && call.method === "abortSignal")?.args[0] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a hung revision RPC while retaining a separately verified game's forecast", async () => {
    vi.useFakeTimers();
    const { db, tables } = newsDb([]);
    tables.roster_optimizer_team_games = [...rows, { ...rows[0], id: 2, source_game_id: 2026020002,
      game_date: "2026-10-11", start_time: "2026-10-11T23:00:00Z" }];
    const complete = db.rpc.getMockImplementation()!();
    let hungSignal: AbortSignal | undefined;
    db.rpc.mockImplementation((_method: string, args: { p_slate_date: string }) => args.p_slate_date === "2026-10-10"
      ? complete : { abortSignal: (signal: AbortSignal) => { hungSignal = signal; return new Promise(() => {}); } });
    const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, forecastsEnabled: true });
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;
    expect(result.games).toHaveLength(2);
    expect(result.forecasts.map(row => row.gameId)).toEqual(["2026020001"]);
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["discovery_timeout"] });
    expect(result.forecastManifest?.exclusions).not.toContainEqual({ gameId: "2026020002", reasons: ["no_issued_revision"] });
    expect(hungSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows the multi-stage native admission sequence beyond eight seconds within the existing route deadline", async () => {
    vi.useFakeTimers(); const { db } = cappedInputs({});
    const admission = vi.spyOn(nativeAdmissionModule, "loadNativeContributionBundle").mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({ sources: [], manifests: [], checksum: "closed-after-nine-seconds", limitations: [] }), 9000);
    }));
    try {
      let settled = false;
      const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, skipOwnership: true, skipRecentForm: true }).then(result => { settled = true; return result; });
      await vi.advanceTimersByTimeAsync(8000); expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1000); const result = await pending;
      expect(result.forecastManifest?.baselineChecksum).toBe("closed-after-nine-seconds");
      expect(result.evidence.baselines.limitations).not.toContain("baseline_read_unavailable");
      expect(vi.getTimerCount()).toBe(0);
    } finally { admission.mockRestore(); }
  });
  it("retains ordinary inputs and clears every release pin after a catalog-head timeout", async () => {
    vi.useFakeTimers();
    const id = "11111111-1111-4111-8111-111111111111";
    for (const key of ["PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID", "PLAYER_FORECAST_BASELINE_RELEASE_IDS",
      "PLAYER_FORECAST_PARTICIPATION_RELEASES", "PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES",
      "PLAYER_FORECAST_FROZEN_WINDOW_SKATER_PARTICIPATION_RELEASES", "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES",
      "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES", "PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES",
      "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES", "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES",
      "PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES", "PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES",
      "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES"]) vi.stubEnv(key, id);
    const { db, calls } = cappedInputs({ hangTable: "native_forecast_catalog_heads" });
    const pending = loadPlanningData(db as any, publicQuery, { ...publicOptions, skipOwnership: true, skipRecentForm: true })
      .catch(error => ({ error }));
    await vi.advanceTimersByTimeAsync(8000);
    const result = await pending;
    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.players).toHaveLength(2);
    expect(result.games).toHaveLength(2);
    expect(result.baselineSources).toEqual([]);
    expect(result.participationSources).toEqual([]);
    expect(result.evidence.baselines.limitations).toContain("native_catalog_head_unavailable_or_invalid");
    expect(calls.some(call => call.table === "player_forecast_source_observations")).toBe(false);
    const signal = calls.find(call => call.table === "native_forecast_catalog_heads" && call.method === "abortSignal")?.args[0] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["yahoo_player_ownership_daily", "player_forecast_source_observations"])(
    "degrades a hung optional %s read within its deadline", async hangTable => {
      vi.useFakeTimers();
      vi.stubEnv("PLAYER_FORECAST_BASELINE_RELEASE_IDS", "11111111-1111-4111-8111-111111111111");
      const { db, calls } = cappedInputs({ hangTable });
      const pending = loadPlanningData(db as any, publicQuery, publicOptions);
      await vi.advanceTimersByTimeAsync(hangTable === "player_forecast_source_observations" ? 20000 : 8000);
      const result = await pending;
      expect(result.games).toHaveLength(2);
      expect(result.baselineSources).toEqual([]);
      const source = hangTable === "yahoo_player_ownership_daily" ? "ownership" : "baselines";
      expect(result.evidence[source].limitations.length).toBeGreaterThan(0);
      const signal = calls.find(call => call.table === hangTable && call.method === "abortSignal")?.args[0] as AbortSignal;
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

  it("invalidates an issued forecast after accepted news and restores only a refreshed revision", async () => {
    const events: Parameters<typeof newsDb>[0] = [];
    const { db } = newsDb(events);
    const query = { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" };
    const options = { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true };
    const before = await loadPlanningData(db as any, query, options);
    expect(before.forecasts).toHaveLength(1);
    events.push({ id: "accepted-news", game_id: 2026020001, queue_version: 1, accepted_at: "2026-10-10T10:01:00Z" });
    const invalidated = await loadPlanningData(db as any, query, options);
    expect(invalidated.games).toHaveLength(1);
    expect(invalidated.forecasts).toEqual([]);
    expect(invalidated.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["stale_source"] });
    expect(invalidated.forecastManifest?.id).not.toBe(before.forecastManifest?.id);
    expect(invalidated.forecastManifest?.acceptedNewsRevision).not.toBe(before.forecastManifest?.acceptedNewsRevision);
    expect(JSON.stringify(invalidated)).not.toContain("accepted-news");
    const next = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    next.id = "new-issuance"; next.published_at = "2026-10-10T10:30:00Z";
    next.payload.inputCutoff = "2026-10-10T10:02:00Z";
    db.rpc.mockReturnValue(rpcResponse({ data: [next], error: null }));
    expect((await loadPlanningData(db as any, query, options)).forecasts[0].revisionId).toBe("new-issuance");
  });

  it("completes bounded accepted-news reads under backend caps and rejects unverified reads", async () => {
    const events = [0, 1, 2].map(index => ({ id: `news-${index}`, game_id: 2026020001,
      queue_version: index + 1, accepted_at: `2026-10-10T10:0${index}:00Z` }));
    const { db, reads } = newsDb(events, { cap: 1 });
    const result = await loadAcceptedForecastNews(db as any, [2026020001], "2026-10-10T12:00:00Z");
    expect(result.latestAcceptedAt.get(2026020001)).toBe(events[2].accepted_at);
    expect(reads.map(row => row.start)).toEqual([0, 1, 2]);
    expect(reads.every(row => row.ids.length === 1 && row.ids[0] === 2026020001)).toBe(true);
    for (const failure of [{ missingCount: true }, { cap: 1, failPage: 2 }, { cap: 1, duplicatePage: true }]) {
      const broken = newsDb(events, failure);
      const response = await loadPlanningData(broken.db as any,
        { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
        { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
      expect(response.games).toHaveLength(1);
      expect(response.forecasts).toEqual([]);
      expect(response.forecastManifest?.acceptedNewsRevision).toBeNull();
      expect(response.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["incomplete_refresh"] });
      expect(JSON.stringify(response)).not.toContain("private failure");
    }
    await expect(loadAcceptedForecastNews(db as any, [2026020001], "2026-10-10T12:00:00Z", 0)).rejects.toThrow("deadline");
  });

  it("compares accepted news to the input cutoff with PostgreSQL timestamp precision", () => {
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001+00:00", "2026-10-10T10:00:00.000Z")).toBe(true);
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001+00:00", "2026-10-10T06:00:00.000001-04:00")).toBe(false);
    expect(acceptedNewsSupersedes("2026-10-10T10:00:00.000001Z", "2026-10-10T10:00:00.000002Z")).toBe(false);
    expect(acceptedNewsSupersedes("invalid", "2026-10-10T10:00:00Z")).toBe(true);
  });
  it.each([
    "2026-02-30T12:00:00.123456Z", "2026-02-29T12:00:00Z",
    "2024-02-30T12:00:00Z", "1900-02-29T12:00:00Z", "2100-02-29T12:00:00Z",
    "2026-04-31T12:00:00-04:00", "2026-02-30T00:00:00+14:00",
    "2026-00-15T12:00:00Z", "2026-13-15T12:00:00Z", "2026-02-00T12:00:00Z",
  ])("rejects impossible evidence dates and fails closed: %s", invalid => {
    expect(timestampMicros(invalid)).toBeNull();
    const valid = "2026-03-10T12:00:00Z";
    expect(acceptedNewsSupersedes(invalid, valid)).toBe(true);
    expect(acceptedNewsSupersedes(valid, invalid)).toBe(true);
    expect(acceptedNewsSupersedes(invalid, invalid)).toBe(true);
  });
  it.each([
    "2024-02-29T12:00:00.123456Z", "2024-02-29T17:45:00.123456+05:45",
    "2024-02-29T08:00:00.123456-04:00", "2024-03-01T02:00:00.123456+14:00",
  ])("preserves leap-day offset equivalence and microseconds: %s", value => {
    expect(timestampMicros(value)).toBe(BigInt("1709208000123456"));
    expect(acceptedNewsSupersedes(value, "2024-02-29T12:00:00.123455Z")).toBe(true);
    expect(acceptedNewsSupersedes(value, "2024-02-29T12:00:00.123456Z")).toBe(false);
    expect(acceptedNewsSupersedes(value, "2024-02-29T12:00:00.123457Z")).toBe(false);
  });
  it("validates the source calendar date before timezone conversion", () => {
    expect(timestampMicros("2024-02-29T23:00:00.000001-03:30"))
      .toBe(timestampMicros("2024-03-01T02:30:00.000001Z"));
    expect(timestampMicros("2000-02-29T12:00:00Z")).not.toBeNull();
    expect(timestampMicros("+010000-02-29T12:00:00Z")).not.toBeNull();
  });
  it("validates actual dates, season shape and bounded custom ranges", () => {
    expect(parsePlanningDataQuery({ seasonId: "20262027", startDate: "2026-10-10", endDate: "2026-11-05" }).seasonId).toBe(20262027);
    for (const input of [
      { seasonId: "20262028", startDate: "2026-10-10", endDate: "2026-11-05" },
      { seasonId: "20262027", startDate: "2026-02-30", endDate: "2026-03-01" },
      { seasonId: "20262027", startDate: "2026-10-10", endDate: "2028-11-05" },
    ]) expect(() => parsePlanningDataQuery(input)).toThrow();
  });
  it("retains game timing/opponents and deduplicates Yahoo mapping rows", () => {
    const games = normalizePlanningGames([...rows, ...rows]);
    expect(games).toHaveLength(1);
    expect(normalizePlanningGames([{ ...rows[0], is_countable: false }])).toHaveLength(1);
    expect(games[0]).toMatchObject({ startsAt: "2026-10-10T23:00:00.000Z", opponent: "MTL", status: "scheduled" });
    expect(normalizePlanningGames([{ ...rows[0], schedule_status: "PPD" }])[0].status).toBe("postponed");
    expect(normalizePlanningGames([{ ...rows[0], schedule_status: "SUSPENDED" }])[0].status).toBe("postponed");
    expect(() => normalizePlanningGames([{ ...rows[0], game_status: "UNKNOWN" }])).toThrow("status could not be verified");
  });
  it("uses the league-local game date across midnight and DST", () => {
    const shifted = normalizePlanningGames([{ ...rows[0], start_time: "2026-11-02T01:30:00Z", game_date: "2026-11-02" }], "America/Los_Angeles");
    expect(shifted[0].date).toBe("2026-11-01");
    expect(() => parsePlanningDataQuery({ seasonId: 20262027, startDate: "2026-11-01", endDate: "2026-11-07", timeZone: "bad/zone" })).toThrow(/time zone/);
  });
  it("shares schedule revisions across equivalent transport timestamps but rejects a changed start", () => {
    const original = normalizePlanningGames(rows)[0].scheduleRevision;
    for (const start_time of ["2026-10-10T23:00:00.000Z", "2026-10-10T23:00:00+00:00", "2026-10-10 23:00:00+00", "2026-10-10T19:00:00-04:00"]) {
      const row = { ...rows[0], start_time };
      expect(normalizePlanningGames([row])[0].scheduleRevision).toBe(original);
      expect(forgeScheduleRevision(row)).toBe(original);
    }
    expect(normalizePlanningGames([{ ...rows[0], start_time: "2026-10-11T00:00:00Z" }])[0].scheduleRevision).not.toBe(original);
    expect(normalizePlanningGames([{ ...rows[0], schedule_status: "PPD" }])[0].scheduleRevision).not.toBe(original);
  });
  it("uses issued goalie expectations once and never exposes research payloads", () => {
    const result = publicPlanningForecasts([revision([{ playerId: 847001, startingProbability: 0.5, conditional: { SAVES_GOALIE: 30 }, probabilityStatus: "uncalibrated_model" }])], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    expect(result[0]).toMatchObject({ playerId: "7", stats: { SAVES_GOALIE: 15 }, startProbability: 0.5, confirmedStart: false, revisionId: "issued-1" });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result[0].sourceWatermark).toBe(`forge-captured-reads-v1:${"a".repeat(64)}`);
    expect(JSON.stringify(result)).not.toContain("capturedReads");
    expect(result[0].limitations.join(" ")).toContain("not calibrated");
    expect(result[0].issuedContext).toMatchObject({ playerId: "7", gameId: "2026020001",
      scheduleSourceUpdatedAt: null, scheduleFetchedAt: "2026-10-10T09:00:00Z",
      membershipCreatedAt });
  });
  it("rejects legacy, ambiguous, postponed, traded and wrong-season issued context", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1,
      conditional: { SAVES_GOALIE: 30 } }]);
    const games = normalizePlanningGames(rows);
    const now = new Date("2026-10-10T12:00:00Z");
    const rejects = (input: ForgeGameRevision, currentPlayer = player, currentGames = games, season = 20262027) => {
      const exclusions: ForecastDiscoveryExclusion[] = [];
      expect(publicPlanningForecasts([input], [currentPlayer], currentGames, now, {}, exclusions, season)).toEqual([]);
      expect(exclusions.some(item => item.reasons.includes("identity_conflict"))).toBe(true);
    };
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { rolling_player_history_contract: "legacy" } } });
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, issuedContexts: [issuedContext, issuedContext] } } });
    rejects(row, player, normalizePlanningGames([{ ...rows[0], schedule_status: "PPD" }]));
    rejects(row, { ...player, nhlTeamId: 2 });
    rejects(row, player, games, 20272028);
    rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, issuedContexts: [
      { ...issuedContext, roster: [issuedContext.roster[0], issuedContext.roster[0]] }] } } });
    for (const context of [
      { ...issuedContext, schedule: [null, issuedContext.schedule[1]] },
      { ...issuedContext, roster: [null] },
      { ...issuedContext, roster: [{ ...issuedContext.roster[0], membershipCreatedAt: [null] }] },
      { ...issuedContext, schedule: issuedContext.schedule.map(item => ({ ...item, fetchedAt: "invalid" })) },
      { ...issuedContext, schedule: issuedContext.schedule.map(item => ({ ...item, sourceUpdatedAt: "2026-10-11T00:00:00Z" })) },
    ]) rejects({ ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!,
      issuedContexts: [context as ForgeIssuedContextV1] } } });
  });
  it("rejects future issued revisions and conflicting team-game starter mass", () => {
    const row = revision([{ playerId: 847001, startingProbability: 0.8, conditional: { SAVES_GOALIE: 30 } }, { playerId: 847002, startingProbability: 0.8, conditional: { SAVES_GOALIE: 25 } }]);
    expect(publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"))).toEqual([]);
    expect(publicPlanningForecasts([revision([])], [player], normalizePlanningGames(rows), new Date("2026-10-09"))).toEqual([]);
  });
  it("binds public goalie confirmation to exact source evidence rather than a certainty flag", () => {
    const candidate = { playerId: 847001, startingProbability: 0.8, probabilityStatus: "confirmed_evidence", conditional: { SAVES_GOALIE: 30 } };
    const row = revision([candidate]);
    const games = normalizePlanningGames(rows), now = new Date("2026-10-10T12:00:00Z");
    const publicForecast = () => publicPlanningForecasts([row], [player], games, now)[0];
    expect(publicForecast()).toMatchObject({ confirmedStart: false, startProbability: 0.8, stats: { SAVES_GOALIE: 24 } });
    const source = scopedSkaterSelection(row).same_day_evidence!;
    source.assertions[0].dimension = "goalie";
    source.assertions[0].value = "confirmed";
    expect(publicForecast()).toMatchObject({ confirmedStart: true, startProbability: 0.8, stats: { SAVES_GOALIE: 24 } });
    source.assertions[0].playerId = 847002;
    expect(publicForecast().confirmedStart).toBe(false);
  });
  it.each(["missing", "wrong-player", "contradictory", "valid"])
  ("preserves the admitted goalie confirmation through RSO and Start Chart output: %s", scenario => {
    const source = { informationCutoffAt: "2026-10-10T10:00:00Z", assertions: [{
      gameId: 2026020001, teamId: 1, playerId: 847001, dimension: "goalie" as const, value: "confirmed", confirmed: true,
      evidenceId: "synthetic-confirmation", sourceKey: "synthetic-source", sourceUrl: null,
      publishedAt: "2026-10-10T09:00:00Z", receivedAt: "2026-10-10T09:01:00Z",
    }], conflicts: [] };
    const candidate = { gameId: 2026020001, teamId: 1, playerId: 847001, horizonGames: 1,
      evidenceCutoffAt: source.informationCutoffAt, sameDayEvidence: structuredClone(source),
      startingProbability: 0.8, probabilityStatus: "confirmed_evidence", conditional: { SAVES_GOALIE: 30 } };
    const row = revision([candidate]);
    if (scenario !== "missing") row.payload.evidence = structuredClone(source);
    if (scenario === "wrong-player") row.payload.evidence!.assertions[0].playerId = 847002;
    if (scenario === "contradictory") row.payload.evidence!.assertions.push({ ...source.assertions[0], playerId: 847002, evidenceId: "other-confirmation" });
    const admitted = publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"))[0];
    expect(admitted.confirmedStart).toBe(scenario === "valid");
    const snapshot: ContributionPlanningSnapshot = {
      context: { seasonId: 20262027, asOf: "2026-10-10T12:00:00Z", startDate: "2026-10-10", endDate: "2026-10-10" },
      players: [player], games: normalizePlanningGames(rows), forecasts: [admitted],
    };
    const resolved = resolvePlanningContributions(snapshot);
    expect(resolved.forecasts[0]).toMatchObject({ confirmedStart: scenario === "valid",
      startProbability: 0.8, stats: { SAVES_GOALIE: 24 }, revisionId: admitted.revisionId });
    expect(resolved.forecastInputExclusions).toEqual([]);
    const rawBefore = JSON.stringify(candidate);
    const output = admittedBoardGoalieForecast(candidate, admitted);
    const normalized = normalizeStartChartResponse({ dateUsed: "2026-10-10", players: [{
      game_id: 2026020001, player_id: 847001, team_id: 1, positions: ["G"], forecast: output,
      confirmed_status: admitted.confirmedStart ? true : null, start_probability: admitted.startProbability,
    }] }).players[0];
    expect(normalized.forecast).toMatchObject({ conditioning: "unconditional", participationProbability: 0.8,
      probabilityStatus: scenario === "valid" ? "confirmed_evidence" : "uncalibrated_model",
      conditional: { SAVES_GOALIE: 30 }, expected: { SAVES_GOALIE: 24 }, evidence: [] });
    expect(normalized.confirmed_status).toBe(scenario === "valid" ? true : null);
    expect(normalized.start_probability).toBe(0.8);
    expect(JSON.stringify(candidate)).toBe(rawBefore);
    expect(admittedBoardGoalieForecast(candidate, undefined)).toBeNull();
  });
  it("requires a bounded timestamped captured-read receipt instead of inventing a source watermark", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const receipt = row.payload.inputProvenance!.capturedReads!;
    for (const capturedReads of [undefined, { ...receipt, hash: "not-a-hash" }, { ...receipt, readCount: 0 },
      { ...receipt, firstReceivedAt: "2026-10-10T09:30:00Z" },
      { ...receipt, lastReceivedAt: "2026-10-10T10:01:00Z" }]) {
      const excluded: ForecastDiscoveryExclusion[] = [];
      const input = { ...row, payload: { ...row.payload, inputProvenance: { ...row.payload.inputProvenance!, capturedReads } } };
      expect(publicPlanningForecasts([input], [player], normalizePlanningGames(rows),
        new Date("2026-10-10T12:00:00Z"), {}, excluded)).toEqual([]);
      expect(excluded).toContainEqual({ gameId: "2026020001", reasons: ["identity_conflict"] });
    }
  });
  it("does not turn a conditional skater forecast into a certain appearance", () => {
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 1, uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing" } } } }];
    const exclusions: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), {}, exclusions)).toEqual([]);
    expect(exclusions).toContainEqual({ gameId: "2026020001", playerId: "7", reasons: ["missing_participation"] });
  });
  it("publishes confirmed skater participation once with sanitized lineage", () => {
    const skater = { ...player, playerClass: "skater" as const, eligiblePositions: ["LW"] };
    const forecast = (probability: 0 | 1) => {
      const row = revision([]);
      row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0,
        uncertainty: { model: { skater_selection: scopedSkaterSelection(row, probability) } } }];
      return publicPlanningForecasts([row], [skater], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    };
    expect(forecast(1)[0]).toMatchObject({ sourceKind: "detailed", stats: { GOALS: 2 }, conditionalStats: { GOALS: 2 },
      appearanceProbability: 1, cutoffAt: "2026-10-10T10:00:00Z", expiresAt: "2026-10-10T23:00:00.000Z" });
    expect(forecast(0)[0]).toMatchObject({ stats: { GOALS: 0 }, conditionalStats: { GOALS: 2 }, appearanceProbability: 0 });
    expect(JSON.stringify(forecast(1))).not.toMatch(/private-source-id|never expose|privateText|inputProvenance/);
  });
  it.each(["scalar", "erased", "copied-player", "source", "late-arrival", "missing-source"])
  ("rejects unbound issued participation without publishing a conditional forecast: %s", attack => {
    const row = revision([]);
    const selection = scopedSkaterSelection(row);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
      proj_goals_es: 2, proj_goals_pp: 1, proj_goals_pk: null, proj_pp_goals: 0.1, proj_assists_pp: 0.3,
      uncertainty: { model: { skater_selection: structuredClone(selection) } } }];
    const stored = row.payload.players[0].uncertainty.model.skater_selection;
    if (attack === "scalar") stored.participation.probability = 0;
    if (attack === "erased") stored.same_day_evidence.assertions = [];
    if (attack === "copied-player") stored.same_day_evidence.assertions[0].playerId++;
    if (attack === "source") row.payload.evidence!.assertions[0].evidenceId = "other-source-record";
    if (attack === "late-arrival") row.payload.evidence!.assertions[0].receivedAt = "2026-10-10T10:00:00.000001Z";
    if (attack === "missing-source") delete row.payload.evidence;
    const exclusions: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows),
      new Date("2026-10-10T12:00:00Z"), {}, exclusions)).toEqual([]);
    expect(exclusions).toContainEqual({ gameId: "2026020001", playerId: "7", reasons: ["missing_participation"] });
  });
  it("keeps all-strength targets unknown when PK is unsupported", () => {
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
      proj_goals_es: 2, proj_goals_pp: 0.1, proj_goals_pk: null, proj_assists_pp: 0.3, proj_hits: 3,
      uncertainty: { model: { skater_selection: scopedSkaterSelection(row) } } }];
    const result = publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    expect(result[0].stats).toMatchObject({ GOALS: null, HITS: 3, PP_POINTS: 0.4 });
    expect(result[0].conditionalStats?.PP_POINTS).toBe(0.4);
    expect(result[0].appearanceProbability).toBe(1);
  });
  it.each([
    ["horizon_games", 5, "outside_horizon"], ["horizon_games", undefined, "outside_horizon"],
    ["as_of_date", "2026-10-11", "identity_conflict"], ["run_id", "different-run", "identity_conflict"],
  ].flatMap(fields => ["skater", "goalie"].map(kind => [kind, ...fields])))
  ("rejects incompatible issued %s scope: %s=%s", (kind, key, value, reason) => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    if (kind === "skater") {
      row.payload.goalies = [];
      row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
        proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0, uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
          participation: { version: "skater-participation-v1", probability: 1, status: "confirmed_evidence", evidenceIds: ["e"] } } } } }];
    }
    (kind === "skater" ? row.payload.players : row.payload.goalies)[0][key as string] = value;
    const exclusions: Record<string, number> = {};
    const currentPlayer = kind === "skater" ? { ...player, playerClass: "skater" as const } : player;
    expect(publicPlanningForecasts([row], [currentPlayer], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions[reason as string]).toBe(1);
  });
  it("keeps revision identity deterministic across equal issuance times and recovers with a later compatible revision", () => {
    const first = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const second = { ...first, id: "issued-2" }, later = { ...first, id: "issued-3", published_at: "2026-10-10T07:00:00-04:00" };
    const games = normalizePlanningGames(rows), now = new Date("2026-10-10T12:00:00Z"), exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([first, second], [player], games, now, exclusions)).toEqual([]);
    expect(publicPlanningForecasts([second, first], [player], games, now)).toEqual([]);
    expect(exclusions.conflicting_forecast).toBe(1);
    expect(publicPlanningForecasts([first, first], [player], games, now)).toHaveLength(1);
    expect(publicPlanningForecasts([first, second, later], [player], games, now)[0].revisionId).toBe("issued-3");
    expect(publicPlanningForecasts([later, first, second], [player], games, now)[0].revisionId).toBe("issued-3");
  });
  it("rejects a player/goalie class conflict without substituting team statistics", () => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    row.payload.teams = [{ game_id: 2026020001, team_id: 1, proj_goals_es: 5 }];
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows),
      new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions.identity_conflict).toBe(1);
  });
  it("preserves PostgreSQL microsecond revision ordering and rejects a future input cutoff", () => {
    const first = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    first.published_at = "2026-10-10T10:00:00.000001Z";
    const next = { ...first, id: "later-microsecond", published_at: "2026-10-10T06:00:00.000002-04:00" };
    const games = normalizePlanningGames(rows), now = new Date("2026-10-10T12:00:00Z");
    expect(publicPlanningForecasts([first, next], [player], games, now)[0].revisionId).toBe(next.id);
    expect(publicPlanningForecasts([next, first], [player], games, now)[0].revisionId).toBe(next.id);
    const invalid = { ...first, payload: { ...first.payload, inputCutoff: "2026-10-10T10:00:00.000002Z" } };
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([invalid], [player], games, now, exclusions)).toEqual([]);
    expect(exclusions.invalid_cutoff).toBe(1);
  });
  it.each([
    ["000001", "000002", "000001"], ["000002", "000001", "000003"],
  ])("rejects receipt chronology beyond issuance or with reversed microseconds (%s/%s/%s)", (first, last, published) => {
    const row = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    row.published_at = `2026-10-10T10:00:00.${published}Z`;
    row.payload.inputProvenance!.capturedReads!.firstReceivedAt = `2026-10-10T10:00:00.${first}Z`;
    row.payload.inputProvenance!.capturedReads!.lastReceivedAt = `2026-10-10T10:00:00.${last}Z`;
    const exclusions: Record<string, number> = {};
    expect(publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"), exclusions)).toEqual([]);
    expect(exclusions.identity_conflict).toBe(1);
  });
  it("rejects unsupported conditioning, invalid issue cutoffs, expiry, and identity conflicts", () => {
    const skater = { ...player, playerClass: "skater" as const, eligiblePositions: ["LW"] };
    const row = revision([]);
    row.payload.players = [{ game_id: 2026020001, team_id: 1, player_id: 847001, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1", proj_goals_es: 2, proj_goals_pp: 0, proj_goals_pk: 0,
      uncertainty: { model: { skater_selection: { production_conditioning: "legacy_availability_adjusted" } } } }];
    const games = normalizePlanningGames(rows);
    const now = new Date("2026-10-10T12:00:00Z");
    const exclusions: Record<string, number> = {};
    const exclusionRows: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([row], [skater], games, now, exclusions, exclusionRows)).toEqual([]);
    expect(exclusions.unsupported_conditioning).toBe(1);
    expect(exclusionRows).toEqual([{ gameId: "2026020001", playerId: "7",
      reasons: ["unsupported_conditioning"] }]);
    row.payload.players[0].uncertainty.model.skater_selection = scopedSkaterSelection(row);
    expect(publicPlanningForecasts([row], [skater], games, now)[0]).toBeDefined();
    expect(publicPlanningForecasts([{ ...row, decision_as_of: "2026-10-10T09:00:00Z" }], [skater], games, now)).toEqual([]);
    expect(publicPlanningForecasts([{ ...row, decision_as_of: "2026-10-10T13:00:00Z" }], [skater], games, now)).toEqual([]);
    expect(publicPlanningForecasts([row], [skater], games, new Date("2026-10-10T23:00:00Z"))).toEqual([]);
    expect(publicPlanningForecasts([row], [{ ...skater, nhlTeamId: 2 }], games, now)).toEqual([]);
    expect(publicPlanningForecasts([{ ...row, payload: { ...row.payload, players: [{ ...row.payload.players[0], game_id: 2026020999 }] } }], [skater], games, now)).toEqual([]);
    const horizonExclusions: Record<string, number> = {};
    const distantGames = games.map(game => ({ ...game, startsAt: "2026-10-24T00:00:00Z" }));
    expect(publicPlanningForecasts([row], [skater], distantGames, now, horizonExclusions)).toEqual([]);
    expect(horizonExclusions.outside_horizon).toBe(1);
  });
  it("preserves the shared serving canary without truncating the schedule", async () => {
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020001");
    const allowed = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const tables: Record<string, unknown[]> = {
      roster_optimizer_team_games: [...rows, { ...rows[0], id: 2, source_game_id: 2026020002 }],
      fhfh_player_identities: [{ id: 7, nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }],
      yahoo_matchup_weeks: [{ id: 1, game_key: "477", week: 1, start_date: "2026-09-29", end_date: "2026-10-04" }, { id: 2, game_key: "477", week: 2, start_date: "2026-10-05", end_date: "2026-10-11" }],
      teams: [{ id: 1, abbreviation: "TOR" }], rosters: [{ playerId: 847001, teamId: 1, created_at: membershipCreatedAt[0] }],
    };
    const db = { from: (table: string) => {
      const result = Promise.resolve({ data: tables[table] ?? [], count: (tables[table] ?? []).length, error: null });
      const chain: any = new Proxy({}, { get: (_, key) => key === "then" ? result.then.bind(result) : () => chain });
      return chain;
    }, rpc: vi.fn().mockReturnValue(rpcResponse({ data: [allowed, { ...allowed, id: "not-enabled", game_id: 2026020002 }], error: null })) };
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" }, { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
    expect(result.games).toHaveLength(2);
    expect(result.forecasts.map(row => row.gameId)).toEqual(["2026020001"]);
    expect(result.forecastManifest).toMatchObject({ version: "planning-forecasts-v1", seasonId: 20262027,
      issuedRevisionIds: ["issued-1"], requiredOpportunities: 2, forecastedOpportunities: 1 });
    expect(result.forecastManifest?.scheduleRevision).toBeTruthy();
    expect(result.forecastManifest?.rosterRevision).toBeTruthy();
    expect(result.forecastManifest?.calendarPolicy).toEqual({ version: "forecast-calendar-v1", calendarDays: 14,
      overlapDays: 7, timeZone: "UTC" });
    vi.stubEnv("STARTER_BOARD_CALENDAR_HORIZON_DAYS", "21");
    const changedPolicy = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
    expect(changedPolicy.forecastManifest?.calendarPolicy?.calendarDays).toBe(21);
    expect(changedPolicy.forecastManifest?.id).not.toBe(result.forecastManifest?.id);
    expect(changedPolicy.forecasts).toEqual(result.forecasts);
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020002", reasons: ["canary_excluded"] });
    expect(JSON.stringify(result.forecastManifest)).not.toContain("private");
    expect(result.evidence.forecasts.limitations.join(" ")).toContain("rollout");
    expect(result.matchupWeeks).toEqual([{ gameKey: "477", week: 1, startDate: "2026-09-29", endDate: "2026-10-04" }, { gameKey: "477", week: 2, startDate: "2026-10-05", endDate: "2026-10-11" }]);
  });
  it("skips the skater stats read when no prior regular-season games are present", async () => {
    const { db, calls } = formDb([], []);
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(calls.some(call => call.table === "games")).toBe(true);
    expect(calls.some(call => call.table === "skatersGameStats")).toBe(false);
    expect(result.evidence.form.limitations.join(" ")).not.toContain("query_failed");
    expect(result.forecastManifest?.exclusions).toContainEqual({ gameId: "2026020001", reasons: ["serving_disabled"] });
  });
  it("reports a safe recent-form failure stage without database details", async () => {
    for (const stage of ["games", "skatersGameStats"] as const) {
      const { db } = formDb([{ id: 100, date: "2026-10-09" }], [], stage);
      const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
        { now: new Date("2026-10-10T12:00:00Z") });
      expect(result.evidence.form.limitations).toContain(`recent_form_${stage === "games" ? "games" : "stats"}_query_failed`);
      expect(JSON.stringify(result.evidence.form)).not.toContain("private database details");
    }
  });
  it("orders NHL-identity game logs by actual date before deriving recent form", async () => {
    const history = [100, 200, 300, 400, 500, 600].map((id, index) => ({ id, date: `2026-10-0${9 - index}` }));
    const stats = [3, 3, 1, 0, 0, 0].map((points, index) => ({ playerId: 847001, gameId: history[index].id, points }));
    const { db, calls } = formDb(history, stats);
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(result.players[0].form).toEqual({ label: "Scoring hot", games: 3, points: 7, includedInForecast: null });
    expect(calls.find(call => call.table === "skatersGameStats" && call.method === "in")?.args[0]).toBe("gameId");
    expect(calls.filter(call => call.table === "skatersGameStats" && call.method === "in").every(call => (call.args[1] as number[]).length <= 100)).toBe(true);
  });
  it("bounds each skater stats lookup to 100 game IDs", async () => {
    const history = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, date: "2026-10-09" }));
    const { db, calls } = formDb(history, []);
    await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" },
      { now: new Date("2026-10-10T12:00:00Z") });
    expect(calls.filter(call => call.table === "skatersGameStats" && call.method === "in").map(call => (call.args[1] as number[]).length))
      .toEqual([100, 1]);
  });
});


describe("lossless planning data transport", () => {
  function transportFixture() {
    const model = { version: "goalie-roster-observation-appearance-frequency-v1" as const, event: "positive_minutes" as const,
      probabilityStatus: "uncalibrated_model" as const, calibration: "unavailable" as const, inputHash: "input-a",
      evidenceHashes: ["original-body-hash"], numerator: 1, denominator: 2, selectedGameIds: [2026020001, 2026020002], limitations: ["Uncalibrated; original evidence retained."] };
    const source = { playerId: 7, nhlPlayerId: 847001, seasonId: 20262027, teamId: 1, gameId: 2026020001,
      basis: "appearance" as const, probability: 0.5, revisionId: "receipt-a", released: false,
      allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false },
      scheduleRevision: "schedule", rosterRevision, cutoffAt: "2026-10-10T01:00:00.123456Z",
      issuedAt: "2026-10-10T02:00:00.123456Z", expiresAt: "2026-10-10T20:00:00.123456Z", model };
    return { players: [structuredClone(player)], games: normalizePlanningGames(rows), forecasts: [], evidence: {},
      participationSources: [source, { ...source, gameId: 2026020002, revisionId: "receipt-b", model: { ...model, inputHash: "input-b" } }] };
  }
  it("preserves every proof, source clock, flag, optional field and unknown without admitting a receipt", () => {
    const raw = transportFixture(), encoded = encodePlanningDataTransport(raw), decoded = decodePlanningDataTransport(JSON.parse(JSON.stringify(encoded)));
    expect(decoded).toEqual(raw); expect(encoded.catalogs.models).toHaveLength(1); expect(encoded.catalogs.hashes).toEqual(["original-body-hash"]);
    expect(decoded.participationSources?.[0]).toMatchObject({ released: false, model: { inputHash: "input-a", evidenceHashes: ["original-body-hash"] } });
    expect(decodePlanningDataTransport(raw)).toEqual(raw);
    const { model: _proof, ...unmodeled } = raw.participationSources[0];
    const withoutModel = { ...raw, participationSources: [unmodeled] };
    expect(decodePlanningDataTransport(encodePlanningDataTransport(withoutModel))).toEqual(withoutModel);
    const optional = { ...raw, participationSources: undefined };
    expect(decodePlanningDataTransport(encodePlanningDataTransport(optional))).toEqual(optional);
  });
  it.each(["version", "metadata", "hash", "tuple", "players", "games", "finite", "proof"])("rejects malformed %s without defaulting missing data", kind => {
    const wire: any = encodePlanningDataTransport(transportFixture());
    if (kind === "version") wire.version = "unknown-v2";
    if (kind === "metadata") wire.data.participationSources[0].model[0] = 99999;
    if (kind === "hash") wire.data.participationSources[0].model[2] = [-1];
    if (kind === "tuple") wire.data.participationSources[0].model.push("extra");
    if (kind === "players") wire.data.players.push(wire.data.players[0]);
    if (kind === "games") wire.data.games.push(wire.data.games[0]);
    if (kind === "finite") wire.catalogs.models[0].denominator = Infinity;
    if (kind === "proof") wire.catalogs.models[0].inputHash = "unexpected-proof";
    expect(() => decodePlanningDataTransport(wire)).toThrow("Invalid planning response");
  });
  it("bounds the complete success envelope and rejects the entire oversized range", () => {
    const raw = transportFixture(), initial = JSON.stringify({ success: true, data: encodePlanningDataTransport(raw) });
    raw.players[0].name += "x".repeat(PLANNING_DATA_TRANSPORT_LIMITS.bytes - Buffer.byteLength(initial));
    const exact = encodePlanningDataTransport(raw);
    expect(Buffer.byteLength(JSON.stringify({ success: true, data: exact }))).toBe(PLANNING_DATA_TRANSPORT_LIMITS.bytes);
    expect(decodePlanningDataTransport(exact).players[0].name).toBe(raw.players[0].name);
    raw.players[0].name += "x";
    expect(() => encodePlanningDataTransport(raw)).toThrow(PlanningDataTransportLimitError);
    exact.data.players[0].name += "x";
    expect(() => decodePlanningDataTransport(exact)).toThrow(PlanningDataTransportLimitError);
  });
  it("encodes the real route response and reports overflow as a truthful503", async () => {
    const raw = transportFixture(), load = vi.spyOn(planningModule, "loadPlanningData").mockResolvedValue(raw);
    const response = () => { const res: any = { statusCode: 200, body: undefined, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } }; return res; };
    const req: any = { method: "GET", query: { seasonId: "20262027", startDate: "2026-10-10", endDate: "2026-10-10" } }, good = response();
    await planningHandler(req, good); expect(good.statusCode).toBe(200); expect(decodePlanningDataTransport(good.body.data)).toEqual(raw);
    load.mockRejectedValueOnce(new PlanningDataTransportLimitError()); const large = response();
    await planningHandler(req, large); expect(large.statusCode).toBe(503); expect(large.body).toMatchObject({ success: false, code: "planning_range_too_large" }); expect(large.body).not.toHaveProperty("data"); load.mockRestore();
  });
});
