import { describe, expect, it } from "vitest";
import {
  buildGoalieReadings,
  buildTeamReadings,
  isoDateRange,
  resolveReadyThrough,
  type GoalieGameInput,
  type TeamGameInput
} from "./entityProducer";
import { checkRows } from "./entityProducerReport";
import { nhlToday, toScheduledTeamGames } from "./entityProducerData";

const SEASON = 20262027;

/** Deterministic per-team, per-date game numbers that differ across teams. */
function teamGame(teamId: number, date: string, seed = 0): TeamGameInput {
  const k = (teamId * 7 + Number(date.slice(8)) * 3 + seed) % 11;
  return {
    teamId,
    teamAbbrev: `T${teamId}`,
    date,
    xgf: 2 + k * 0.2,
    xga: 3 - k * 0.1,
    scf: 25 + k,
    sca: 30 - k,
    hdcf: 9 + (k % 4),
    hdca: 12 - (k % 5),
    gf: 1 + (k % 4),
    ga: 1 + ((k + 2) % 4),
    sf: 26 + k,
    sa: 32 - k
  };
}

/** Twelve teams; even teams play on even days, odd teams on odd days. */
function league(dates: string[]) {
  const teamIds = Array.from({ length: 12 }, (_, i) => i + 1);
  const games: TeamGameInput[] = [];
  for (const date of dates) {
    const day = Number(date.slice(8));
    for (const teamId of teamIds) {
      if (teamId % 2 === day % 2) games.push(teamGame(teamId, date));
    }
  }
  const completedGames = games.map((g) => ({ teamId: g.teamId, date: g.date }));
  return { teamIds, games, completedGames };
}

describe("team readings", () => {
  const dates = isoDateRange("2026-10-01", "2026-10-12");
  const { teamIds, games, completedGames } = league(dates);
  const result = buildTeamReadings({ seasonId: SEASON, dates, games, completedGames, teamIds });

  it("gives every team a reading on every date after its first game, off days included", () => {
    for (const date of dates.slice(1)) {
      const covered = new Set(
        result.scores
          .filter((s) => s.snapshot_date === date && s.window_code === "l5")
          .map((s) => s.entity_id)
      );
      expect([...covered].sort((a, b) => a - b)).toEqual(teamIds);
    }
  });

  it("carries the team's window forward on an off day and says so", () => {
    // Team 2 plays on 10-10 and 10-12, not 10-11.
    const played = result.scores.find(
      (s) => s.entity_id === 2 && s.snapshot_date === "2026-10-10" && s.window_code === "l5"
    )!;
    const offDay = result.scores.find(
      (s) => s.entity_id === 2 && s.snapshot_date === "2026-10-11" && s.window_code === "l5"
    )!;
    expect(offDay.snapshot_date).toBe("2026-10-11");
    expect(offDay.recent_value).toBe(played.recent_value);
    expect(offDay.expected_value).toBe(played.expected_value);
    expect(offDay.provenance.window_end_game_date).toBe("2026-10-10");
    expect(offDay.metadata).toMatchObject({
      carried_forward: true,
      played_on_snapshot: false,
      last_game_date: "2026-10-10",
      days_since_last_game: 1
    });
    expect(played.metadata).toMatchObject({ carried_forward: false, played_on_snapshot: true });
  });

  it("writes no row before a team's first game and reports why", () => {
    // Even teams first play on 10-02.
    expect(
      result.scores.some((s) => s.entity_id === 2 && s.snapshot_date === "2026-10-01")
    ).toBe(false);
    expect(result.skips).toContainEqual(
      expect.objectContaining({
        snapshot_date: "2026-10-01",
        entity_id: 2,
        reason: "no_game_yet_this_season"
      })
    );
  });

  it("writes rows that satisfy the table constraints and the reader contract", () => {
    expect(result.scores.length).toBeGreaterThan(0);
    expect(checkRows(result)).toEqual([]);
    for (const band of result.bands) {
      expect(band.distribution).toMatchObject({
        usualRange: { interval: "central_80", status: expect.stringMatching(/hot|cold|neutral/) }
      });
    }
    const metrics = new Set(result.bands.map((b) => b.metric_key));
    expect([...metrics].sort()).toEqual(
      ["hdcf_pct", "on_ice_sh_pct", "on_ice_sv_pct", "pdo", "scf_pct", "xgf_pct"]
    );
  });

  it("is strictly as-of: later games do not change an earlier date's rows", () => {
    const cutoff = "2026-10-07";
    const truncated = buildTeamReadings({
      seasonId: SEASON,
      dates: [cutoff],
      games: games.filter((g) => g.date <= cutoff),
      completedGames: completedGames.filter((g) => g.date <= cutoff),
      teamIds
    });
    const full = buildTeamReadings({
      seasonId: SEASON,
      dates: [cutoff],
      games,
      completedGames,
      teamIds
    });
    expect(full.scores).toEqual(truncated.scores);
    expect(full.bands).toEqual(truncated.bands);
  });

  it("skips a team from a completed game with no input onward, never carrying over the gap", () => {
    const missing = games.filter((g) => !(g.teamId === 4 && g.date === "2026-10-06"));
    const gated = buildTeamReadings({ seasonId: SEASON, dates, games: missing, completedGames, teamIds });
    const team4Dates = gated.scores.filter((s) => s.entity_id === 4).map((s) => s.snapshot_date);
    expect(team4Dates.every((d) => d < "2026-10-06")).toBe(true);
    expect(gated.skips).toContainEqual(
      expect.objectContaining({
        snapshot_date: "2026-10-06",
        entity_id: 4,
        reason: "scheduled_game_missing_input",
        detail: { missing_game_date: "2026-10-06" }
      })
    );
    // Other teams are unaffected.
    expect(gated.scores.some((s) => s.entity_id === 3 && s.snapshot_date === "2026-10-12")).toBe(true);
  });

  it("does not invent a state when the window has no goals", () => {
    const scoreless = games.map((g) =>
      g.teamId === 5 ? { ...g, gf: 0, ga: 0 } : g
    );
    const out = buildTeamReadings({ seasonId: SEASON, dates, games: scoreless, completedGames, teamIds });
    expect(out.scores.some((s) => s.entity_id === 5)).toBe(false);
    expect(out.skips.some((s) => s.entity_id === 5 && s.reason === "no_goals_in_window")).toBe(true);
  });

  it("classifies results against process with the documented threshold", () => {
    for (const row of result.scores) {
      const z = row.z_score as number;
      const expected = z >= 1 ? "overperforming" : z <= -1 ? "underperforming" : "stable";
      expect(row.expectation_state).toBe(expected);
    }
  });
});

function goalieGame(
  goalieId: number,
  teamId: number,
  date: string,
  overrides: Partial<GoalieGameInput> = {}
): GoalieGameInput {
  const k = (goalieId * 5 + Number(date.slice(8))) % 7;
  const shots = 26 + k;
  const ga = k % 4;
  return {
    goalieId,
    teamId,
    teamAbbrev: `T${teamId}`,
    date,
    started: true,
    saves: shots - ga,
    shotsAgainst: shots,
    goalsAgainst: ga,
    toiSeconds: 3600,
    qualityStart: ga <= 2,
    shutout: ga === 0,
    xgAgainst: 2.5 + k * 0.1,
    ...overrides
  };
}

describe("goalie readings", () => {
  const dates = isoDateRange("2026-10-01", "2026-10-10");
  const goalieIds = Array.from({ length: 12 }, (_, i) => 100 + i);
  const games: GoalieGameInput[] = [];
  for (const date of dates) {
    const day = Number(date.slice(8));
    goalieIds.forEach((goalieId, i) => {
      if (i % 2 === day % 2) games.push(goalieGame(goalieId, i + 1, date));
    });
  }
  const completedGames = games.map((g) => ({ teamId: g.teamId, date: g.date }));
  const result = buildGoalieReadings({ seasonId: SEASON, dates, games, completedGames });

  it("reads every goalie on off days from his last appearances, with all six metrics", () => {
    const offDay = result.scores.find(
      (s) => s.entity_id === 100 && s.snapshot_date === "2026-10-09" && s.window_code === "l3"
    )!;
    expect(offDay.metadata).toMatchObject({ carried_forward: true, last_game_date: "2026-10-08" });
    expect(offDay.player_id).toBe(100);
    expect(offDay.team_id).toBe(1);
    const keys = result.bands
      .filter((b) => b.entity_id === 100 && b.snapshot_date === "2026-10-09" && b.window_code === "l3")
      .map((b) => b.metric_key)
      .sort();
    expect(keys).toEqual([
      "goals_against_avg",
      "quality_starts_pct",
      "save_pct",
      "saves",
      "shots_against_per_60",
      "shutouts"
    ]);
    expect(checkRows(result)).toEqual([]);
  });

  it("compares save% with expected save% from xG against", () => {
    const row = result.scores.find((s) => s.entity_id === 101 && s.snapshot_date === "2026-10-10")!;
    // Percent, like the team rates.
    expect(row.expected_value).toBeGreaterThan(80);
    expect(row.expected_value).toBeLessThan(100);
    const band = result.bands.find(
      (b) => b.entity_id === 101 && b.snapshot_date === "2026-10-10" && b.metric_key === "save_pct"
    )!;
    expect(band.value).toBeGreaterThan(80);
    expect(band.value).toBeLessThanOrEqual(100);
    expect(row.components).toMatchObject({ expectation: { basis: "window_save_pct_vs_window_expected_save_pct" } });
  });

  it("skips a goalie whose team played without any goalie input", () => {
    // Team 1 (goalie 100) plays on 10-06; drop that appearance.
    const missing = games.filter((g) => !(g.goalieId === 100 && g.date === "2026-10-06"));
    const out = buildGoalieReadings({ seasonId: SEASON, dates, games: missing, completedGames });
    expect(
      out.scores.some((s) => s.entity_id === 100 && s.snapshot_date >= "2026-10-06" && s.snapshot_date < "2026-10-08")
    ).toBe(false);
    expect(out.skips).toContainEqual(
      expect.objectContaining({ entity_id: 100, snapshot_date: "2026-10-06", reason: "team_game_missing_goalie_input" })
    );
  });

  it("is strictly as-of: later appearances do not change an earlier date's rows", () => {
    const cutoff = "2026-10-06";
    const truncated = buildGoalieReadings({
      seasonId: SEASON,
      dates: [cutoff],
      games: games.filter((g) => g.date <= cutoff),
      completedGames: completedGames.filter((g) => g.date <= cutoff)
    });
    const full = buildGoalieReadings({ seasonId: SEASON, dates: [cutoff], games, completedGames });
    expect(full.scores).toEqual(truncated.scores);
    expect(full.bands).toEqual(truncated.bands);
  });

  it("stops a goalie's readings after 30 days without an appearance", () => {
    const later = isoDateRange("2026-11-08", "2026-11-10");
    const out = buildGoalieReadings({ seasonId: SEASON, dates: later, games, completedGames });
    // Goalie 100's last appearance is 2026-10-10: 30 days later is his last reading.
    expect(out.scores.some((s) => s.snapshot_date === "2026-11-10")).toBe(false);
    expect(out.scores.some((s) => s.entity_id === 100 && s.snapshot_date === "2026-11-09")).toBe(true);
    expect(out.scores.some((s) => s.entity_id === 101 && s.snapshot_date === "2026-11-09")).toBe(false);
    expect(out.skips).toContainEqual(
      expect.objectContaining({
        entity_id: 100,
        snapshot_date: "2026-11-10",
        reason: "no_appearance_in_max_days",
        detail: { last_game_date: "2026-10-10", days_since_last_game: 31 }
      })
    );
  });

  it("skips the score, never guessing, when expected goals are missing", () => {
    const noXg = games.map((g) => (g.goalieId === 102 && g.date === "2026-10-10" ? { ...g, xgAgainst: null } : g));
    const out = buildGoalieReadings({ seasonId: SEASON, dates: ["2026-10-10"], games: noXg, completedGames });
    expect(out.scores.some((s) => s.entity_id === 102)).toBe(false);
    expect(out.skips.some((s) => s.entity_id === 102 && s.reason === "missing_expected_goals_input")).toBe(true);
  });
});

describe("resolveReadyThrough", () => {
  it("stops the day before the first unfinished or uningested game", () => {
    const scheduled = [
      { teamId: 1, date: "2026-11-21", completed: true },
      { teamId: 1, date: "2026-11-22", completed: true },
      { teamId: 2, date: "2026-11-23", completed: false }
    ];
    expect(
      resolveReadyThrough({
        seasonStart: "2026-09-29",
        requestedEnd: "2026-11-23",
        scheduled,
        hasTeamInput: () => true
      })
    ).toBe("2026-11-22");
    expect(
      resolveReadyThrough({
        seasonStart: "2026-09-29",
        requestedEnd: "2026-11-23",
        scheduled,
        hasTeamInput: (_team, date) => date !== "2026-11-22"
      })
    ).toBe("2026-11-21");
  });
});

describe("schedule inputs", () => {
  const now = new Date("2026-11-23T16:00:00Z");
  const row = (overrides: Record<string, unknown>) => ({
    date: "2026-11-20",
    startTime: "2026-11-21T00:00:00Z",
    game_state: "OFF",
    game_schedule_state: "OK",
    game_state_observed_at: "2026-11-21T04:00:00Z",
    homeTeamId: 22,
    awayTeamId: 1,
    ...overrides
  });

  it("leaves out postponed and cancelled games so they cannot block later dates", () => {
    const scheduled = toScheduledTeamGames(
      [row({}), row({ date: "2026-11-21", game_state: "FUT", game_schedule_state: "PPD" })],
      now
    );
    expect(scheduled).toEqual([
      { teamId: 22, date: "2026-11-20", completed: true },
      { teamId: 1, date: "2026-11-20", completed: true }
    ]);
    expect(
      resolveReadyThrough({
        seasonStart: "2026-09-29",
        requestedEnd: "2026-11-22",
        scheduled,
        hasTeamInput: () => true
      })
    ).toBe("2026-11-22");
  });

  it("treats a game still to be played as blocking its date", () => {
    const scheduled = toScheduledTeamGames(
      [row({ date: "2026-11-23", startTime: "2026-11-24T00:00:00Z", game_state: "FUT", game_state_observed_at: "2026-11-23T12:00:00Z" })],
      now
    );
    expect(scheduled.every((g) => !g.completed)).toBe(true);
    expect(
      resolveReadyThrough({ seasonStart: "2026-09-29", requestedEnd: "2026-11-23", scheduled, hasTeamInput: () => true })
    ).toBe("2026-11-22");
  });

  it("uses the Eastern date for today", () => {
    expect(nhlToday(new Date("2026-11-23T03:30:00Z"))).toBe("2026-11-22");
    expect(nhlToday(new Date("2026-11-23T16:00:00Z"))).toBe("2026-11-23");
  });
});
