import { describe, expect, it } from "vitest";
import type { TeamDataWithTotals } from "lib/NHL/types";
import { buildOpponentRatings, percentileMap } from "components/GameGrid/utils/scheduleOpportunity";
import { buildScheduleSnapshot, selectScheduleDates, weekDates } from "./schedule";
import { fictionalLeagueWeek, fictionalTeamStats } from "./fixtures";
import { buildOpponentLayer, easiestSchedules, opponentDefense, SOFT_DEFENSE_MAX, STREAM_TEAM_RANK_MAX, streamingNights } from "./matchups";
import type { SocialShareSnapshot } from "./types";

const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", season = 20262027, dates = weekDates(weekStart);
function edition(statsUpdatedAt = "2026-10-26T08:00:00Z", stats = fictionalTeamStats(season, statsUpdatedAt)): SocialShareSnapshot {
  const snapshot = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
  return { ...snapshot, opponents: buildOpponentLayer(stats, { season, teams: snapshot.teams, fetchedAt: now, generatedAt: now }) };
}

describe("opponent rate layer", () => {
  it("is ready only for complete, valid, current-season rows updated within 72 hours", () => {
    const ready = edition();
    expect(ready.opponents).toMatchObject({ state: "ready", reasons: [], updatedAt: "2026-10-26T08:00:00.000Z" });
    expect(Object.keys(ready.opponents!.teams)).toHaveLength(32);
    expect(edition("2026-10-22T11:00:00Z").opponents!.state).toBe("stale");
    expect(edition("2026-10-26T13:00:00Z").opponents!.state).toBe("missing");
    const { BOS: _bos, ...missingBoston } = fictionalTeamStats(season, "2026-10-26T08:00:00Z");
    expect(edition(undefined, missingBoston).opponents).toMatchObject({ state: "partial", reasons: ["Opponent rates are missing or invalid for BOS."] });
    expect(edition(undefined, fictionalTeamStats(season - 10001, "2026-10-26T08:00:00Z")).opponents!.state).toBe("partial");
    const snapshot = buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule: fictionalLeagueWeek(weekStart, now) });
    expect(buildOpponentLayer(null, { season, teams: snapshot.teams, fetchedAt: now, generatedAt: now })).toMatchObject({ state: "missing", teams: {} });
  });
});

describe("easiest schedules", () => {
  it("ranks 3+ game teams by Game Grid's opponent DEF rating, softest first", () => {
    const snapshot = edition(), { floor, rows } = easiestSchedules(snapshot, true);
    expect(floor).toBe(3);
    expect(rows).toHaveLength(8);
    expect(rows.map(row => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].def).toBeLessThanOrEqual(rows[i].def);
    for (const row of rows) {
      expect(row.remainingGames).toBeGreaterThanOrEqual(3);
      expect(row.games).toHaveLength(row.remainingGames);
      expect(row.games.filter(game => game.offNight)).toHaveLength(row.offNightGames);
    }
  });

  it("matches Game Grid's buildOpponentRatings DEF for the same opponents and rates", () => {
    const snapshot = edition(), rates = snapshot.opponents!.teams;
    const entries = snapshot.rows.filter(row => row.remainingGames > 0).map(row => {
      const opponents = row.games.map(game => game.homeTeam.id === row.team.id ? game.awayTeam : game.homeTeam);
      const avgXga = opponents.reduce((sum, team) => sum + rates[team.abbreviation].xga / rates[team.abbreviation].gp, 0) / opponents.length;
      const avgXgf = opponents.reduce((sum, team) => sum + rates[team.abbreviation].xgf / rates[team.abbreviation].gp, 0) / opponents.length;
      const team = { teamId: row.team.id, teamAbbreviation: row.team.abbreviation, weeks: [], totals: { opponents: [], gamesPlayed: row.remainingGames, offNights: row.offNightGames, scheduleCoverage: { known: 7, expected: 7 } } } as unknown as TeamDataWithTotals;
      return { team, averages: { avgXgf, avgXga, avgSf: null, avgSa: null, avgGoalFor: null, avgGoalAgainst: null, avgWinPct: null } };
    });
    const gameGrid = buildOpponentRatings(entries);
    for (const row of easiestSchedules(snapshot, true).rows) expect(row.def).toBeCloseTo(gameGrid[row.team.id].def!, 10);
  });

  it("publishes nothing for an untrusted schedule or an unready opponent layer", () => {
    expect(easiestSchedules(edition(), false).rows).toEqual([]);
    expect(easiestSchedules(edition("2026-10-20T00:00:00Z"), true).rows).toEqual([]);
    expect(streamingNights(edition("2026-10-20T00:00:00Z"), true)).toEqual([]);
  });

  it("lowers the games floor for a short selection", () => {
    const thursdayOn = selectScheduleDates(edition(), dates.slice(3));
    const { floor, rows } = easiestSchedules(thursdayOn, true);
    expect(floor).toBe(Math.min(3, Math.max(...thursdayOn.rows.map(row => row.remainingGames))));
    expect(rows.every(row => row.remainingGames >= floor && row.games.every(game => dates.slice(3).includes(game.date)))).toBe(true);
  });
});

describe("streaming nights", () => {
  it("picks one night per top-half team: soft defense or a storm signal, most signals first", () => {
    const snapshot = edition(), nights = streamingNights(snapshot, true), defense = opponentDefense(snapshot);
    expect(nights.length).toBe(6);
    expect(new Set(nights.map(night => night.team.id)).size).toBe(nights.length);
    for (const night of nights) {
      expect(night.weekRank).toBeLessThanOrEqual(STREAM_TEAM_RANK_MAX);
      expect((night.oppDef ?? 100) <= SOFT_DEFENSE_MAX || night.evidence.goals.storm || night.evidence.shots.storm).toBe(true);
      expect(night.oppDef).toBe(defense.get(night.opponent.id));
    }
    const signals = nights.map(night => night.evidence.flags.length);
    expect(signals).toEqual([...signals].sort((a, b) => b - a));
    expect(nights.some(night => night.evidence.flags.length > 0)).toBe(true);
  });

  it("backs each pairing with ranked GF/GA and SF/SA and the opponent's back-to-back", () => {
    const snapshot = edition(), rates = snapshot.opponents!.teams;
    for (const night of streamingNights(snapshot, true)) {
      const { goals, shots, rest, flags } = night.evidence, team = rates[night.team.abbreviation], opponent = rates[night.opponent.abbreviation];
      expect(goals.team!.perGame).toBeCloseTo(team.gf! / team.gp, 12);
      expect(goals.opponent!.perGame).toBeCloseTo(opponent.ga! / opponent.gp, 12);
      expect(shots.team!.perGame).toBeCloseTo(team.sf! / team.gp, 12);
      expect(goals.storm).toBe(goals.team!.rank <= 11 && goals.opponent!.rank <= 11);
      expect(shots.storm).toBe(shots.team!.rank <= 11 && shots.opponent!.rank <= 11);
      const before = new Date(Date.parse(`${night.date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      const playedBefore = (id: number) => snapshot.games.some(game => game.date === before && (game.homeTeam.id === id || game.awayTeam.id === id));
      if (night.date === weekStart) expect(rest).toEqual({ opponentSecondNight: null, teamSecondNight: null });
      else expect(rest).toEqual({ opponentSecondNight: playedBefore(night.opponent.id), teamSecondNight: playedBefore(night.team.id) });
      expect(flags.includes("tired")).toBe(!!rest.opponentSecondNight && !rest.teamSecondNight);
    }
  });

  it("uses single-team DEF = 100 − percentile of xGA/GP", () => {
    const snapshot = edition(), rates = snapshot.opponents!.teams;
    const expected = percentileMap(snapshot.teams.map(team => ({ teamId: team.id, value: rates[team.abbreviation].xga / rates[team.abbreviation].gp })));
    for (const [teamId, def] of opponentDefense(snapshot)) expect(def).toBe(100 - expected.get(teamId)!);
  });
});

describe("pickups fixture contract (card not built)", () => {
  it("covers every tier for forwards, defense and goalies using yahoo_players columns", async () => {
    const { PICKUP_OWNERSHIP_COLUMNS, PICKUP_TIERS, fictionalPickupRows } = await import("./pickupsFixture");
    const rows = fictionalPickupRows(2026, "2026-10-26");
    for (const row of rows) expect(Object.keys(row).sort()).toEqual([...PICKUP_OWNERSHIP_COLUMNS].sort());
    const group = (row: typeof rows[number]) => {
      const positions = (row.eligible_positions as { position: string }[]).map(item => item.position);
      return positions.includes("G") ? "G" : positions.includes("D") ? "D" : "F";
    };
    for (const position of ["F", "D", "G"]) for (const tier of PICKUP_TIERS) {
      expect(rows.filter(row => group(row) === position && row.percent_ownership! < tier).length).toBeGreaterThanOrEqual(3);
    }
  });
});
