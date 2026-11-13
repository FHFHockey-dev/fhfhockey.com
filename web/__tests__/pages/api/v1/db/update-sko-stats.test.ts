import { describe, expect, it, vi } from "vitest";

import * as mod from "../../../../../pages/api/v1/db/update-sko-stats";

import {
  aggregateSkoSourceIngestDiagnostics,
  buildSkoSourceIngestDiagnostics,
  buildSkoSkaterStatsRow,
  hasFullSkoSourcePage,
  isTruthyQueryFlag,
  projectSkoSkaterStatsRow,
  resolveSkaterIncrementalWindow,
  upsertSkoSkaterStats,
} from "../../../../../pages/api/v1/db/update-sko-stats";

describe("/api/v1/db/update-sko-stats helpers", () => {
  it("treats common full-refresh flags as truthy", () => {
    expect(isTruthyQueryFlag("1")).toBe(true);
    expect(isTruthyQueryFlag("true")).toBe(true);
    expect(isTruthyQueryFlag("full")).toBe(true);
    expect(isTruthyQueryFlag(["no", "yes"])).toBe(true);
    expect(isTruthyQueryFlag(undefined)).toBe(false);
  });

  it("starts from the season start when no current-season snapshot exists", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: null,
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: "2025-10-07",
      endDate: "2026-03-14",
      upToDate: false,
    });
  });

  it("resumes from the day after the latest stored snapshot", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-10",
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: "2026-03-11",
      endDate: "2026-03-14",
      upToDate: false,
    });
  });

  it("reports up-to-date when the latest stored snapshot already reaches the bounded end date", () => {
    expect(
      resolveSkaterIncrementalWindow({
        seasonStartDate: "2025-10-07",
        seasonEndDate: "2026-04-15",
        latestStoredDate: "2026-03-14",
        today: "2026-03-14",
      }),
    ).toEqual({
      startDate: null,
      endDate: "2026-03-14",
      upToDate: true,
    });
  });

  it("continues pagination while any source family returns a full page", () => {
    expect(hasFullSkoSourcePage([99, 100, 12], 100)).toBe(true);
    expect(hasFullSkoSourcePage([99, 42, 0], 100)).toBe(false);
  });

  it("reports deterministic source freshness, family gaps, and atomic write state", () => {
    const diagnostic = buildSkoSourceIngestDiagnostics({
      requestedDate: "2026-03-14",
      primaryPlayerIds: [3, 1, 1, 2],
      sourceFamilyPlayerIds: {
        goalsForAgainst: [1, 2],
        timeOnIce: [3, 2, 1],
      },
      attemptedRows: 3,
      upsertedRows: 3,
      today: "2026-03-16",
    });

    expect(diagnostic).toEqual({
      freshness: {
        requestedDate: "2026-03-14",
        latestSourceDate: "2026-03-14",
        ageDaysFromToday: 2,
        empty: false,
      },
      coverage: {
        discoveredPlayers: 3,
        sourceFamilyRows: { goalsForAgainst: 2, timeOnIce: 3 },
        missingPlayersByFamily: { goalsForAgainst: 1, timeOnIce: 0 },
        missingPlayerAssociations: 1,
      },
      write: {
        attemptedRows: 3,
        upsertedRows: 3,
        partial: false,
      },
    });
  });

  it("aggregates bounded date diagnostics without hiding empty or partial work", () => {
    const first = buildSkoSourceIngestDiagnostics({
      requestedDate: "2026-03-14",
      primaryPlayerIds: [1, 2],
      sourceFamilyPlayerIds: { timeOnIce: [1] },
      attemptedRows: 2,
      upsertedRows: 2,
      today: "2026-03-16",
    });
    const second = buildSkoSourceIngestDiagnostics({
      requestedDate: "2026-03-15",
      primaryPlayerIds: [],
      sourceFamilyPlayerIds: { timeOnIce: [] },
      attemptedRows: 1,
      upsertedRows: 0,
      today: "2026-03-16",
    });

    expect(aggregateSkoSourceIngestDiagnostics([first, second])).toEqual({
      freshness: {
        latestSourceDate: "2026-03-14",
        emptySourceDates: 1,
      },
      coverage: {
        playerDateRows: 2,
        sourceFamilyRows: { timeOnIce: 1 },
        missingPlayersByFamily: { timeOnIce: 1 },
        missingPlayerAssociations: 1,
      },
      write: {
        attemptedRows: 3,
        upsertedRows: 2,
        partial: true,
      },
    });
  });

  it("maps one source snapshot to the exact 28-column live contract", () => {
    const row = buildSkoSkaterStatsRow({
      stat: {
        playerId: 8478402,
        skaterFullName: "Test Skater",
        positionCode: "C",
        gamesPlayed: 12,
        goals: 4,
        assists: 6,
        points: 10,
        shots: 20,
        shootingPct: 20,
      } as any,
      goalsForAgainstStat: {
        evenStrengthGoalsFor: 12,
        powerPlayGoalFor: 6,
        shortHandedGoalsFor: 2,
      } as any,
      powerPlayStat: { ppTimeOnIcePctPerGame: 25 } as any,
      puckPossessionStat: {
        onIceShootingPct: 11.5,
        zoneStartPct: 52,
      } as any,
      scoringRatesStat: {
        assists5v5: 3,
        assistsPer605v5: 1.2,
        primaryAssists5v5: 2,
        primaryAssistsPer605v5: 0.8,
        secondaryAssists5v5: 1,
        secondaryAssistsPer605v5: 0.4,
      } as any,
      scoringPerGameStat: {
        totalPrimaryAssists: 4,
        totalSecondaryAssists: 2,
      } as any,
      timeOnIceStat: { timeOnIce: 2400 } as any,
      formattedDate: "2026-03-14",
      seasonId: 20252026,
    });

    expect(Object.keys(row).sort()).toEqual(
      [
        "assists",
        "assists_5v5",
        "assists_per_60_5v5",
        "date",
        "es_goals_for",
        "games_played",
        "goals",
        "ipp",
        "on_ice_shooting_pct",
        "player_id",
        "player_name",
        "points",
        "position_code",
        "pp_goals_for",
        "pp_toi_pct_per_game",
        "primary_assists_5v5",
        "primary_assists_per_60_5v5",
        "season_id",
        "secondary_assists_5v5",
        "secondary_assists_per_60_5v5",
        "sh_goals_for",
        "shooting_percentage",
        "shots",
        "sog_per_60",
        "time_on_ice",
        "total_primary_assists",
        "total_secondary_assists",
        "zone_start_pct",
      ].sort(),
    );
    expect(row).toMatchObject({
      player_id: 8478402,
      date: "2026-03-14",
      season_id: 20252026,
      time_on_ice: 2400,
      ipp: null,
      sog_per_60: 30,
    });
  });

  it("projects legacy full-season payloads before they reach the live table", () => {
    const row = projectSkoSkaterStatsRow({
      player_id: 8478402,
      player_name: "Test Skater",
      date: "2026-03-14",
      season_id: 20252026,
      points: 10,
      assists_5v5: 3,
      assists_per_game: 0.5,
      shoots_catches: "L",
    });

    expect(Object.keys(row).sort()).toEqual(
      [
        "assists_5v5",
        "date",
        "player_id",
        "player_name",
        "points",
        "season_id",
      ].sort(),
    );
    expect(row).toEqual({
      player_id: 8478402,
      player_name: "Test Skater",
      date: "2026-03-14",
      season_id: 20252026,
      points: 10,
      assists_5v5: 3,
    });
  });

  it("submits an exact mapped batch once and fails closed on upsert errors", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("schema mismatch") });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as any;
    const payload = [
      buildSkoSkaterStatsRow({
        stat: {
          playerId: 8478402,
          skaterFullName: "Test Skater",
          points: 0,
          shots: 0,
        } as any,
        formattedDate: "2026-03-14",
        seasonId: 20252026,
      }),
    ];

    await upsertSkoSkaterStats(client, payload);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenLastCalledWith(payload);

    await expect(upsertSkoSkaterStats(client, payload)).rejects.toThrow(
      "schema mismatch",
    );
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("strips unsupported legacy columns at the write boundary", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as any;

    await upsertSkoSkaterStats(client, {
      player_id: 8478402,
      player_name: "Test Skater",
      date: "2026-03-14",
      season_id: 20252026,
      points: 10,
      assists_per_game: 0.5,
      shoots_catches: "L",
    } as any);

    expect(upsert).toHaveBeenCalledWith({
      player_id: 8478402,
      player_name: "Test Skater",
      date: "2026-03-14",
      season_id: 20252026,
      points: 10,
    });
  });
  // Decision 141: IPP is computed only over pooled multi-game windows, never per game. Points can
  // include assists on goals scored after the player changed off (shift-based on-ice GF).
  function ippRow(
    points: number | null,
    goalsFor: Partial<Record<"evenStrengthGoalsFor" | "powerPlayGoalFor" | "shortHandedGoalsFor", number | null>> | undefined,
  ) {
    return buildSkoSkaterStatsRow({
      stat: {
        playerId: 8478402,
        skaterFullName: "Test Skater",
        positionCode: "C",
        gamesPlayed: 1,
        points,
      } as any,
      goalsForAgainstStat: goalsFor as any,
      formattedDate: "2026-03-14",
      seasonId: 20252026,
    }).ipp;
  }

  it("never stores a per-game IPP", () => {
    expect(
      ippRow(2, { evenStrengthGoalsFor: 2, powerPlayGoalFor: 1, shortHandedGoalsFor: 1 }),
    ).toBeNull();
    expect(
      ippRow(1, { evenStrengthGoalsFor: 0, powerPlayGoalFor: 0, shortHandedGoalsFor: 0 }),
    ).toBeNull();
  });

  const game = (
    points: number | null,
    es: number | null,
    pp: number | null,
    sh: number | null,
  ) => ({ points, es_goals_for: es, pp_goals_for: pp, sh_goals_for: sh });

  it("pools IPP over a multi-game window, including a game with an off-ice assist", () => {
    const pooled = (mod as any).pooledSkoIpp;
    expect(typeof pooled).toBe("function");
    // Game 1: an assist on a goal scored after he changed off (on-ice GF 0).
    const window = [game(1, 0, 0, 0), game(1, 2, 1, 0), game(0, 1, 0, 0)];
    expect(pooled(window)).toEqual({ ipp: 50, reason: null });
    expect(pooled([game(1, 0, 0, 0)])).toEqual({
      ipp: null,
      reason: "single_game_window",
    });
    expect(pooled([game(2, 1, 0, 0), game(1, 1, 0, 0)])).toEqual({
      ipp: null,
      reason: "points_include_goals_while_off_ice",
    });
    expect(pooled([game(1, null, 1, 0), game(1, 2, 0, 0)])).toEqual({
      ipp: null,
      reason: "on_ice_goals_for_component_missing",
    });
    expect(pooled([game(null, 1, 0, 0), game(1, 2, 0, 0)])).toEqual({
      ipp: null,
      reason: "points_missing",
    });
    expect(pooled([game(0, 0, 0, 0), game(0, 0, 0, 0)])).toEqual({
      ipp: null,
      reason: "no_on_ice_goals_for",
    });
  });

  // Decision 142: a missing goalsForAgainst report row means 0/0/0 only when his shift rows
  // exist and the shift-based on-ice count is 0 for and 0 against; otherwise unknown.
  const shift = (period: number, start: number, end: number, playerId = 8478402, teamId = 10) => ({
    game_id: 2026020104,
    shift_id: period * 10_000 + start,
    team_id: teamId,
    player_id: playerId,
    period,
    start_seconds: start,
    end_seconds: end,
    duration_seconds: end - start,
    season_id: 20262027,
    shift_number: 1,
    game_date: "2026-11-01",
    type_code: 517,
  });
  const goal = (period: number, second: number, ownerTeamId: number) => ({
    game_id: 2026020104,
    period_number: period,
    period_seconds_elapsed: second,
    event_owner_team_id: ownerTeamId,
    period_type: "REG",
  });

  it("counts shift-based on-ice goals for and against", () => {
    const counts = (mod as any).shiftOnIceGoalCounts;
    expect(typeof counts).toBe("function");
    const shifts = [shift(1, 0, 45), shift(2, 100, 150)];
    expect(counts({ playerId: 8478402, shiftRows: shifts, goalEvents: [goal(1, 600, 10), goal(3, 20, 20)] })).toEqual({ goalsFor: 0, goalsAgainst: 0 });
    // A goal at the second his shift ends counts (shift-chart convention); one at his start does not.
    expect(counts({ playerId: 8478402, shiftRows: shifts, goalEvents: [goal(1, 45, 10), goal(2, 100, 20), goal(2, 120, 20)] })).toEqual({ goalsFor: 1, goalsAgainst: 1 });
    expect(counts({ playerId: 8478402, shiftRows: [], goalEvents: [] })).toBeNull();
    expect(counts({ playerId: 8478402, shiftRows: shifts, goalEvents: [{ ...goal(1, 10, 10), period_seconds_elapsed: null }] })).toBeNull();
    // Shootout goals are not on-ice goals.
    expect(counts({ playerId: 8478402, shiftRows: shifts, goalEvents: [{ ...goal(5, 0, 10), period_type: "SO" }] })).toEqual({ goalsFor: 0, goalsAgainst: 0 });
  });

  it("writes 0/0/0 on-ice goals for only when shifts confirm, unknown otherwise", () => {
    const resolve = (mod as any).resolveGoalsForAgainstStat;
    expect(typeof resolve).toBe("function");
    const report = { evenStrengthGoalsFor: 1, powerPlayGoalFor: 0, shortHandedGoalsFor: 0 };
    expect(resolve({ reportRow: report, timeOnIceSeconds: 900, shiftCounts: null })).toEqual({ stat: report, resolution: "report_row" });
    expect(resolve({ reportRow: undefined, timeOnIceSeconds: 900, shiftCounts: { goalsFor: 0, goalsAgainst: 0 } })).toEqual({
      stat: { evenStrengthGoalsFor: 0, powerPlayGoalFor: 0, shortHandedGoalsFor: 0 },
      resolution: "shift_confirmed_zero",
    });
    expect(resolve({ reportRow: undefined, timeOnIceSeconds: 900, shiftCounts: { goalsFor: 0, goalsAgainst: 1 } })).toEqual({ stat: undefined, resolution: "unknown_shift_count_nonzero" });
    expect(resolve({ reportRow: undefined, timeOnIceSeconds: 900, shiftCounts: null })).toEqual({ stat: undefined, resolution: "unknown_no_shift_count" });
    expect(resolve({ reportRow: undefined, timeOnIceSeconds: null, shiftCounts: { goalsFor: 0, goalsAgainst: 0 } })).toEqual({ stat: undefined, resolution: "unknown_no_ice_time" });

    const row = buildSkoSkaterStatsRow({
      stat: { playerId: 8478402, skaterFullName: "Test Skater", gamesPlayed: 1, points: 0 } as any,
      goalsForAgainstStat: resolve({ reportRow: undefined, timeOnIceSeconds: 900, shiftCounts: { goalsFor: 0, goalsAgainst: 0 } }).stat,
      formattedDate: "2026-11-01",
      seasonId: 20262027,
    });
    expect(row).toMatchObject({ es_goals_for: 0, pp_goals_for: 0, sh_goals_for: 0 });
  });

  it("loads shift counts for players missing a report row from stored shifts and goal events", async () => {
    const load = (mod as any).loadShiftOnIceGoalCounts;
    expect(typeof load).toBe("function");
    const tables: Record<string, any[]> = {
      nhl_api_shift_rows: [shift(1, 0, 45), shift(1, 0, 45, 99, 20)],
      nhl_api_pbp_events: [goal(1, 600, 10)],
    };
    const calls: Array<[string, string, unknown]> = [];
    const client = {
      from(table: string) {
        const builder: any = {
          select: () => builder,
          eq: (column: string, value: unknown) => (calls.push([table, column, value]), builder),
          in: (column: string, value: unknown) => (calls.push([table, column, value]), builder),
          then: (resolve: any) => resolve({ data: tables[table], error: null }),
        };
        return builder;
      },
    };
    const result: Map<number, unknown> = await load(client, "2026-11-01", [8478402, 77]);
    expect(result.get(8478402)).toEqual({ goalsFor: 0, goalsAgainst: 0 });
    expect(result.get(77)).toBeNull();
    expect(calls).toContainEqual(["nhl_api_shift_rows", "game_date", "2026-11-01"]);
    expect(calls).toContainEqual(["nhl_api_pbp_events", "type_code", 505]);
    expect(await load(client, "2026-11-01", [])).toEqual(new Map());
  });
});
