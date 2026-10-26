import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RollingRow } from "./types/run-forge-projections.types";
import {
  buildReserveGoalieRow, buildReserveSkaterLine, buildReserveSkaterRow, forgeReservePassEnabled,
  RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS, selectReserveSkaters,
} from "./reserveProjections";

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
