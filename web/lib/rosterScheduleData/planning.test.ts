import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPlanningData, normalizePlanningGames, parsePlanningDataQuery, publicPlanningForecasts } from "./planning";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";

const player: PlanningPlayer = { id: "canonical-1", nhlId: 847001, name: "Goalie", playerClass: "goalie", teamAbbreviation: "TOR", eligiblePositions: ["G"], availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [] };
const rows = [{ source_game_id: 2026020001, game_date: "2026-10-10", start_time: "2026-10-10T23:00:00Z", team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT", schedule_status: "OK", is_countable: true, game_type: 2 }];
const revision = (candidates: unknown[]): ForgeGameRevision => ({ id: "issued-1", run_id: "run-1", game_id: 2026020001, decision_as_of: "2026-10-10T10:00:00Z", published_at: "2026-10-10T10:00:00Z", payload: { players: [], teams: [], goalies: [{ uncertainty: { daily_board_candidates: candidates } }], codeVersion: "v1", inputProvenance: { private: "never expose" } } });
afterEach(() => vi.unstubAllEnvs());

describe("public RSO data boundary", () => {
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
  });
  it("uses the league-local game date across midnight and DST", () => {
    const shifted = normalizePlanningGames([{ ...rows[0], start_time: "2026-11-02T01:30:00Z", game_date: "2026-11-02" }], "America/Los_Angeles");
    expect(shifted[0].date).toBe("2026-11-01");
    expect(() => parsePlanningDataQuery({ seasonId: 20262027, startDate: "2026-11-01", endDate: "2026-11-07", timeZone: "bad/zone" })).toThrow(/time zone/);
  });
  it("uses issued goalie expectations once and never exposes research payloads", () => {
    const result = publicPlanningForecasts([revision([{ playerId: 847001, startingProbability: 0.5, conditional: { SAVES_GOALIE: 30 }, probabilityStatus: "uncalibrated_model" }])], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"));
    expect(result[0]).toMatchObject({ playerId: "canonical-1", stats: { SAVES_GOALIE: 15 }, startProbability: 0.5, confirmedStart: false, revisionId: "issued-1" });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result[0].limitations.join(" ")).toContain("not calibrated");
  });
  it("rejects future issued revisions and conflicting team-game starter mass", () => {
    const row = revision([{ playerId: 847001, startingProbability: 0.8, conditional: { SAVES_GOALIE: 30 } }, { playerId: 847002, startingProbability: 0.8, conditional: { SAVES_GOALIE: 25 } }]);
    expect(publicPlanningForecasts([row], [player], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"))).toEqual([]);
    expect(publicPlanningForecasts([revision([])], [player], normalizePlanningGames(rows), new Date("2026-10-09"))).toEqual([]);
  });
  it("does not turn a conditional skater forecast into a certain appearance", () => {
    const row = revision([]);
    row.payload.players = [{ player_id: 847001, proj_goals_es: 1, uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing" } } } }];
    expect(publicPlanningForecasts([row], [{ ...player, playerClass: "skater" }], normalizePlanningGames(rows), new Date("2026-10-10T12:00:00Z"))).toEqual([]);
  });
  it("preserves the shared serving canary without truncating the schedule", async () => {
    vi.stubEnv("STARTER_BOARD_CANARY_GAME_IDS", "2026020001");
    const allowed = revision([{ playerId: 847001, startingProbability: 1, conditional: { SAVES_GOALIE: 30 } }]);
    const tables: Record<string, unknown[]> = {
      roster_optimizer_team_games: [...rows, { ...rows[0], source_game_id: 2026020002 }],
      fhfh_player_identities: [{ id: "canonical-1", nhl_player_id: 847001, canonical_name: "Goalie", canonical_position: "G" }],
      teams: [{ id: 1, abbreviation: "TOR" }], rosters: [{ playerId: 847001, teamId: 1 }],
    };
    const db = { from: (table: string) => {
      const result = Promise.resolve({ data: tables[table] ?? [], error: null });
      const chain: any = new Proxy({}, { get: (_, key) => key === "then" ? result.then.bind(result) : () => chain });
      return chain;
    }, rpc: vi.fn().mockResolvedValue({ data: [allowed, { ...allowed, id: "not-enabled", game_id: 2026020002 }], error: null }) };
    const result = await loadPlanningData(db as any, { seasonId: 20262027, startDate: "2026-10-10", endDate: "2026-10-10" }, { now: new Date("2026-10-10T12:00:00Z"), forecastsEnabled: true });
    expect(result.games).toHaveLength(2);
    expect(result.forecasts.map(row => row.gameId)).toEqual(["2026020001"]);
    expect(result.evidence.forecasts.limitations.join(" ")).toContain("rollout");
  });
});
