import { describe, expect, it } from "vitest";
import calcWeekScore from "components/GameGrid/utils/calcWeekScore";
import { buildScheduleSnapshot, selectScheduleDates, weekDates } from "./schedule";
import { FICTIONAL_DAILY_GAMES, fictionalLeagueWeek } from "./fixtures";
import { countTiers, editionCountTiers, mondayGridRows } from "./mondayGrid";
import type { SocialScheduleData } from "./types";

const weekStart = "2026-10-26", now = "2026-10-26T12:00:00Z", dates = weekDates(weekStart);
const edition = (schedule: SocialScheduleData = fictionalLeagueWeek(weekStart, now)) =>
  buildScheduleSnapshot({ format: "game-grid", weekStart, generatedAt: now, schedule });

describe("fictional league week fixture", () => {
  it("is a complete, reconciled, ready edition with every team playing two to five times", () => {
    const schedule = fictionalLeagueWeek(weekStart, now), snapshot = edition(schedule);
    expect(snapshot.state).toBe("ready");
    expect(snapshot.reasons).toEqual([]);
    expect(snapshot.games).toHaveLength(FICTIONAL_DAILY_GAMES.reduce((sum, count) => sum + count, 0));
    expect(snapshot.rows).toHaveLength(32);
    for (const row of snapshot.rows) expect(row.remainingGames).toBeGreaterThanOrEqual(2), expect(row.remainingGames).toBeLessThanOrEqual(5);
    for (const date of dates) {
      const ids = snapshot.games.filter(game => game.date === date).flatMap(game => [game.homeTeam.id, game.awayTeam.id]);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(snapshot.days.filter(day => day.offNight).map(day => day.label)).toEqual(["MON", "WED", "FRI", "SUN"]);
    expect(fictionalLeagueWeek(weekStart, now)).toEqual(schedule);
  });
});

describe("Monday grid rows", () => {
  it("keeps Game Grid weekScore order and ranks, with one square cell per day", () => {
    const snapshot = edition(), rows = mondayGridRows(snapshot, true);
    expect(rows.map(row => row.team.id)).toEqual(snapshot.rows.map(row => row.team.id));
    expect(rows.map(row => row.rank)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].score).toBeGreaterThanOrEqual(rows[i].score);
    for (const row of rows) {
      expect(row.cells.map(cell => cell.date)).toEqual(dates);
      const counted = row.cells.flatMap(cell => cell.games.filter(game => game.counted));
      expect(counted).toHaveLength(row.remainingGames);
      expect(row.cells.filter(cell => cell.offNight).flatMap(cell => cell.games)).toHaveLength(row.offNightGames);
      const slate = row.cells.flatMap(cell => cell.games.map(() => snapshot.days.find(day => day.date === cell.date)!.leagueGames));
      expect(row.score).toBe(calcWeekScore([], row.offNightGames, snapshot.games.length, row.remainingGames, slate, true));
    }
  });

  it("leaves zero-game teams unranked, as Schedule Score does", () => {
    const rows = mondayGridRows(selectScheduleDates(edition(), [dates[2]]), true);
    expect(rows.filter(row => row.rank !== null)).toHaveLength(8);
    expect(rows.every(row => (row.rank === null) === (row.remainingGames === 0))).toBe(true);
  });

  it("mirrors home and away marks between opponents", () => {
    const rows = mondayGridRows(edition(), true);
    for (const row of rows) for (const cell of row.cells) for (const game of cell.games) {
      const other = rows.find(item => item.team.id === game.opponent.id)!.cells.find(item => item.date === cell.date)!.games.find(item => item.id === game.id)!;
      expect(other.opponent.id).toBe(row.team.id);
      expect(other.home).toBe(!game.home);
    }
  });

  it("publishes no order or rank for an untrusted edition", () => {
    const rows = mondayGridRows(edition(), false);
    expect(rows.every(row => row.rank === null)).toBe(true);
    expect(rows.map(row => row.team.abbreviation)).toEqual([...rows.map(row => row.team.abbreviation)].sort());
  });

  it("shows unselected, elapsed and final games without counting them, and omits postponed and nonregular games", () => {
    const schedule = fictionalLeagueWeek(weekStart, now);
    const [first, second, third, fourth] = schedule.games!;
    Object.assign(first, { gameState: "OFF" });
    Object.assign(second, { gameScheduleState: "PPD" });
    Object.assign(third, { gameType: 1 });
    const snapshot = selectScheduleDates(edition({ ...schedule, numGamesPerDay: [...schedule.numGamesPerDay] }), dates.filter(date => date !== fourth.gameDate));
    const rows = mondayGridRows(snapshot, false);
    const cellGame = (teamId: number, gameId: number) => rows.find(row => row.team.id === teamId)!.cells.flatMap(cell => cell.games).find(game => game.id === gameId);
    expect(cellGame(first.homeTeam.id, first.id)).toMatchObject({ counted: false });
    expect(cellGame(second.homeTeam.id, second.id)).toBeUndefined();
    expect(cellGame(third.homeTeam.id, third.id)).toBeUndefined();
    expect(cellGame(fourth.homeTeam.id, fourth.id)).toMatchObject({ counted: false, home: true });
    expect(rows.find(row => row.team.id === fourth.awayTeam.id)!.cells.find(cell => cell.date === fourth.gameDate)!.selected).toBe(false);
  });
});

describe("GP and off-night count tiers (ticket 12)", () => {
  const tiers = (values: number[]) => [...new Set(values)].sort((a, b) => b - a).map(value => countTiers(values).get(value));
  it("colours distinct values highest first: green, white, yellow…, red", () => {
    expect(tiers([4, 3, 2, 1])).toEqual(["high", "second", "between", "low"]);
    expect(tiers([4, 3, 2])).toEqual(["high", "second", "low"]);
    expect(tiers([5, 4, 3, 2, 1])).toEqual(["high", "second", "between", "between", "low"]);
  });
  it("handles two values, one value and ties", () => {
    expect(tiers([3, 2, 3])).toEqual(["high", "low"]);
    expect(tiers([3, 3, 3])).toEqual(["neutral"]);
    const tied = countTiers([4, 4, 3, 3, 3, 2, 1, 1]);
    expect([tied.get(4), tied.get(3), tied.get(2), tied.get(1)]).toEqual(["high", "second", "between", "low"]);
    expect(countTiers([])).toEqual(new Map());
  });
  it("ranks the GP and off-night columns independently over the edition", () => {
    const snapshot = edition(), { gp, off } = editionCountTiers(snapshot);
    expect(gp).toEqual(countTiers(snapshot.rows.map(row => row.remainingGames)));
    expect(off).toEqual(countTiers(snapshot.rows.map(row => row.offNightGames)));
    expect(snapshot.rows.some(row => gp.get(row.remainingGames) !== off.get(row.offNightGames))).toBe(true);
    // Synthetic: A has the most games but the fewest off-nights, so it is green on GP and red on OFF.
    const rows = [["A", 4, 0], ["B", 3, 2], ["C", 2, 1]].map(([abbreviation, remainingGames, offNightGames]) => ({ team: { abbreviation }, remainingGames, offNightGames }));
    const split = editionCountTiers({ rows } as unknown as Parameters<typeof editionCountTiers>[0]);
    expect([split.gp.get(4), split.off.get(0)]).toEqual(["high", "low"]);
    expect([split.gp.get(3), split.off.get(2)]).toEqual(["second", "high"]);
    expect([split.gp.get(2), split.off.get(1)]).toEqual(["low", "second"]);
  });
});
