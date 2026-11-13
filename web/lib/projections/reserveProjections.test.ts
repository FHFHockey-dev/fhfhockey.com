import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RollingRow } from "./types/run-forge-projections.types";
import {
  buildReserveGoalieRow, buildReserveSkaterLine, buildReserveSkaterRow, forgeReservePassEnabled,
  RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS, selectReserveSkaters,
} from "./reserveProjections";
import { skaterAvailabilityForGame } from "./skaterCoverage";
import { timeAwayDisclosure, timeAwayEvidence } from "./timeAwayDecay";

const rolling = (strength: "ev" | "pp" | "all", overrides: Partial<RollingRow> = {}): RollingRow => ({
  game_id: 2026020010, season: 20262027, player_id: 7, strength_state: strength, game_date: "2026-10-20",
  toi_seconds_avg_last5: strength === "pp" ? 90 : 760, toi_seconds_avg_all: strength === "pp" ? 80 : 740,
  sog_per_60_last5: 7, sog_per_60_all: 6.5, sog_per_60_avg_last5: null, sog_per_60_avg_all: null,
  goals_total_last5: 1, shots_total_last5: 9, assists_total_last5: 2, goals_total_all: 3, shots_total_all: 30, assists_total_all: 4,
  ipp_all: 55, hits_per_60_last5: 5, hits_per_60_all: 5, blocks_per_60_last5: 2, blocks_per_60_all: 2,
  hits_per_60_avg_last5: null, hits_per_60_avg_all: null, blocks_per_60_avg_last5: null, blocks_per_60_avg_all: null,
  toi_seconds_total_last5: strength === "pp" ? 450 : 3800, ...overrides,
});
const neutral = { toiMultiplier: 1, shotRateMultiplier: 1, goalRateMultiplier: 1, assistRateMultiplier: 1 };
const team = { goalsEs: 2.2, goalsPp: 0.6, toiEs: 14400, toiPp: 1200, assistScaleEs: 1.1, assistScalePp: 1.05 };
const line = (overrides: Partial<Parameters<typeof buildReserveSkaterLine>[0]> = {}) => buildReserveSkaterLine({
  position: "C", ev: rolling("ev"), pp: rolling("pp"), all: rolling("all"), currentSeasonId: 20262027, league: null,
  context: neutral, team, ...overrides });

describe("FORGE reserve skater line", () => {
  it("projects his own recent usage with the lineup's rate model and team environment", () => {
    const result = line()!;
    expect(result.toiEs).toBe(760);
    expect(result.toiPp).toBe(90);
    expect(result.toiBasis).toEqual({ es: "recent", pp: "recent" });
    expect(result.shotsEs).toBeGreaterThan(0);
    expect(result.goalsEs).toBeGreaterThan(0);
    // Assists scale with his share of the lineup's on-ice goals: double the team's ES goals, double his ES assists.
    expect(line({ team: { ...team, goalsEs: 4.4 } })!.assistsEs).toBeCloseTo(result.assistsEs * 2, 10);
    expect(result.hits).toBeGreaterThan(0);
    expect(result.blocks).toBeGreaterThan(0);
  });

  it("falls back to season usage, then a depth role for even strength and no power play", () => {
    expect(line({ ev: rolling("ev", { toi_seconds_avg_last5: null }) })!.toiBasis.es).toBe("season");
    const depth = line({ position: "D", ev: rolling("ev", { toi_seconds_avg_last5: null, toi_seconds_avg_all: null }), pp: undefined })!;
    expect(depth.toiEs).toBe(RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS.D);
    expect(depth.toiPp).toBe(0);
    expect(depth.toiBasis).toEqual({ es: "role_default", pp: "none_recorded" });
    expect(depth.goalsPp).toBe(0);
  });

  it("keeps the exposure of a known zero-shot history (BC W1-6 A2)", () => {
    // 100 hours with no shots is evidence; no history at all is not. Without toiSecondsAll both read the prior.
    const known = (strength: "ev" | "pp") => rolling(strength, { shots_total_all: 0, sog_per_60_all: 0, toi_seconds_total_all: 360000 });
    const unknown = (strength: "ev" | "pp") => rolling(strength, { shots_total_all: null, sog_per_60_all: null, toi_seconds_total_all: 360000 });
    const zeroShooter = line({ ev: known("ev"), pp: known("pp") })!, noHistory = line({ ev: unknown("ev"), pp: unknown("pp") })!;
    expect(zeroShooter.toiEs).toBe(noHistory.toiEs);
    expect(zeroShooter.shotsEs).toBeLessThan(noHistory.shotsEs);
    expect(zeroShooter.shotsPp).toBeLessThan(noHistory.shotsPp);
  });

  it("applies the game's context multipliers and refuses a player with no NHL usage", () => {
    const base = line()!, boosted = line({ context: { ...neutral, goalRateMultiplier: 1.2, toiMultiplier: 0.9 } })!;
    expect(boosted.toiEs).toBeCloseTo(base.toiEs * 0.9, 6);
    expect(boosted.goalsEs / boosted.shotsEs).toBeGreaterThan(base.goalsEs / base.shotsEs);
    expect(line({ ev: undefined, pp: undefined })).toBeNull();
  });
});

describe("FORGE reserve selection and rows", () => {
  it("selects only this team's current skaters outside the lineup, with the run's reason", () => {
    const metaById = new Map([[1, { position: "C", team_id: 10 }], [2, { position: "D", team_id: 10 }], [3, { position: "G", team_id: 10 }],
      [4, { position: "C", team_id: 12 }], [5, { position: "L", team_id: 10 }], [6, { position: "R", team_id: 10 }], [7, { position: "C", team_id: 10 }]]);
    expect(selectReserveSkaters({ teamId: 10, rosterPlayerIds: [7, 6, 5, 4, 3, 2, 1, 1], lineupPlayerIds: [1], goalieIds: [3], metaById,
      ruledOutIds: [2], hardStaleIds: [5], missingMetricIds: [6] })).toEqual([
      { playerId: 2, position: "D", reason: "ruled_out" }, { playerId: 5, position: "L", reason: "hard_stale" },
      { playerId: 6, position: "R", reason: "missing_recent_metrics" }, { playerId: 7, position: "C", reason: "not_in_lineup" }]);
  });

  it("marks every row conditional, excluded from team totals and without a participation chance", () => {
    const scope = { runId: "r", asOfDate: "2026-10-26", horizonGames: 1, gameId: 1, playerId: 7, teamId: 10, opponentTeamId: 12 };
    const skater = buildReserveSkaterRow({ ...scope, reason: "not_in_lineup", line: line()!, horizonScalar: 1 });
    expect(skater).toMatchObject({ player_class: "skater", conditioning: "if_dressed", reserve_reason: "not_in_lineup", model_version: "forge-reserve-v1",
      proj_saves: null, uncertainty: { conditioning: "if_dressed", participation_probability: null, excluded_from_team_totals: true } });
    const goalie = buildReserveGoalieRow({ ...scope, reason: "backup_goalie", horizonScalar: 1,
      model: { shotsAgainst: 28, projectedSaves: 25.4, projectedGoalsAllowed: 2.6, shutoutProbability: 0.05, modeledSavePct: 0.907 } });
    expect(goalie).toMatchObject({ player_class: "goalie", conditioning: "if_starts", proj_goals_es: null, proj_saves: 25.4,
      uncertainty: { conditioning: "if_starts", start_probability: null, excluded_from_team_totals: true } });
  });

  const event = (event_type: string, payload: Record<string, unknown> = {}) => ({ event_id: 9, event_type, confidence: 0.75, payload });
  const rowScope = { runId: "r", asOfDate: "2026-10-26", horizonGames: 1, gameId: 5, playerId: 7, teamId: 10, opponentTeamId: 12 };

  it("labels a scratch for this game and keeps his if-plays line with 0 expected (decision 31)", () => {
    const scratched = buildReserveSkaterRow({ ...rowScope, reason: "ruled_out", line: line()!, horizonScalar: 1,
      availability: skaterAvailabilityForGame({ gameId: 5, event: event("SCRATCH", { game_id: 5 }), inLineup: false }) });
    expect(scratched.reserve_reason).toBe("scratched_not_expected_to_dress");
    expect(scratched.uncertainty).toMatchObject({ reserve_reason: "scratched_not_expected_to_dress", participation_probability: null,
      availability: { state: "confirmed_out", expected_for_game: 0, label: "scratched / not expected to dress" } });
    expect(scratched.proj_shots_es).toBeGreaterThan(0);
    // An injury keeps the ruled-out reason; a scratch for another game says nothing about this one.
    const injured = buildReserveSkaterRow({ ...rowScope, reason: "ruled_out", line: line()!, horizonScalar: 1,
      availability: skaterAvailabilityForGame({ gameId: 5, event: event("INJURY_OUT"), inLineup: false }) });
    expect(injured.reserve_reason).toBe("ruled_out");
    const otherGame = buildReserveSkaterRow({ ...rowScope, reason: "not_in_lineup", line: line()!, horizonScalar: 1,
      availability: skaterAvailabilityForGame({ gameId: 5, event: event("SCRATCH", { game_id: 6 }), inLineup: false }) });
    expect(otherGame.reserve_reason).toBe("not_in_lineup");
  });

  it("serializes availability and time away beside the line, never a participation chance (decision 132.2-132.4)", () => {
    const out = buildReserveSkaterRow({ ...rowScope, reason: "ruled_out", line: line()!, horizonScalar: 1,
      availability: skaterAvailabilityForGame({ gameId: 5, event: event("INJURY_OUT"), inLineup: false }),
      timeAway: timeAwayDisclosure(timeAwayEvidence("2026-10-20", rowScope.asOfDate)) });
    expect(out.uncertainty.participation_probability).toBeNull();
    expect(out.uncertainty.availability).toMatchObject({ state: "confirmed_out", expected_for_game: 0, participation_probability: null });
    expect(out.proj_goals_es).toBeGreaterThan(0);
    // No row in the 365-day scope, one 600 days ago: he still gets a line, and the row says he has been away.
    const lastGame = "2025-03-05";
    const longAway = line({ ev: rolling("ev", { game_date: lastGame }), pp: rolling("pp", { game_date: lastGame }), all: rolling("all", { game_date: lastGame }) })!;
    const away = buildReserveSkaterRow({ ...rowScope, reason: "hard_stale", line: longAway, horizonScalar: 1,
      availability: skaterAvailabilityForGame({ gameId: 5, event: undefined, inLineup: false }),
      timeAway: timeAwayDisclosure(timeAwayEvidence(lastGame, rowScope.asOfDate)) });
    expect(away.proj_toi_es_seconds).toBeGreaterThan(0);
    expect(away.uncertainty.time_away).toMatchObject({ status: "away", days_away: 600, last_game_date: lastGame });
    expect(away.uncertainty.availability).toMatchObject({ state: "unknown", expected_for_game: null });
  });

  it("keeps the reserve shutout per game over a multi-game horizon and labels each basis (W3-4 N6)", () => {
    const scope = { runId: "r", asOfDate: "2026-10-26", horizonGames: 3, gameId: 1, playerId: 7, teamId: 10, opponentTeamId: 12 };
    const goalie = buildReserveGoalieRow({ ...scope, reason: "backup_goalie", horizonScalar: 3,
      model: { shotsAgainst: 28, projectedSaves: 25.4, projectedGoalsAllowed: 2.6, shutoutProbability: 0.05, modeledSavePct: 0.907 } });
    expect(goalie.proj_saves).toBeCloseTo(76.2, 6);
    expect(goalie.proj_shutout_prob).toBe(0.05);
    expect(goalie.uncertainty.value_basis).toEqual({ counts: "horizon_total", shutout_prob: "single_game" });
  });

  it("is off unless explicitly enabled", () => {
    expect(forgeReservePassEnabled({})).toBe(false);
    expect(forgeReservePassEnabled({ FORGE_RESERVE_PASS_ENABLED: "1" })).toBe(false);
    expect(forgeReservePassEnabled({ FORGE_RESERVE_PASS_ENABLED: "true" })).toBe(true);
  });

  it("is read and written only by the reserve writer, the source audit and the RSO bridge", () => {
    // Start Chart, accuracy, team rows, game revisions and every other reader never see reserve rows.
    const root = path.resolve(__dirname, "../..");
    const files = execFileSync("git", ["grep", "--untracked", "-l", "forge_reserve_projections", "--", "lib", "pages", "components", "scripts"],
      { cwd: root, encoding: "utf8" }).trim().split("\n").filter(file => !/\.test\.tsx?$/.test(file)).sort();
    expect(files).toEqual([
      "lib/projections/reserveProjections.ts",
      "lib/projections/run-forge-projections.ts",
      "lib/projections/stages/persistence-stage.ts",
      "lib/rosterScheduleData/forgeDailyBridge.ts",
    ]);
  });
});
