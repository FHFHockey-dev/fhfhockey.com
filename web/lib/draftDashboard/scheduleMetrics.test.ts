import { describe, expect, it } from "vitest";
import type { GameData } from "lib/NHL/types";
import { calculateScheduleMetrics, normalizeScheduleSettings, totalRosterScheduleMetrics } from "./scheduleMetrics";

const week = { week: 19, start_date: "2027-02-01", end_date: "2027-02-14" };
const game = (id: number, date: string, home = 1, away = 2): GameData => ({ id, gameDate: date, gameType: 2, season: 20262027, homeTeam: { id: home }, awayTeam: { id: away } } as GameData);

describe("draft schedule metrics", () => {
  it("includes eight-game nights but excludes nine-game nights, deduplicating team rows", () => {
    const games = [8, 9].flatMap((count, day) => Array.from({ length: count }, (_, i) => game(day * 100 + i, `2027-02-0${day + 1}`, i * 2 + 1, i * 2 + 2)));
    expect(calculateScheduleMetrics([...games, ...games], [week]).get(1)).toEqual({ games: 2, off: 1, b2b: 1 });
  });
  it("counts cross-boundary pairs on their second day and two pairs for three consecutive dates", () => {
    const games = [game(1, "2027-01-31"), game(2, "2027-02-01"), game(3, "2027-02-02")];
    expect(calculateScheduleMetrics(games, [week]).get(1)).toEqual({ games: 2, off: 2, b2b: 2 });
  });
  it("covers the full two-week Yahoo interval and excludes gaps between selections", () => {
    const games = [game(1, "2027-02-14"), game(2, "2027-02-15"), game(3, "2027-02-22")];
    const later = { week: 21, start_date: "2027-02-22", end_date: "2027-02-28" };
    expect(calculateScheduleMetrics(games, [week, later]).get(1)).toEqual({ games: 2, off: 2, b2b: 0 });
  });
  it("excludes cancelled, postponed and preseason games", () => {
    expect(calculateScheduleMetrics([{ ...game(1, "2027-02-01"), gameScheduleState: "PPD" }, { ...game(2, "2027-02-01"), gameType: 1 }, { ...game(3, "2027-02-01"), gameState: "CNCL" }], [week]).size).toBe(0);
  });
  it("counts each roster player once and preserves unavailable data", () => {
    const metrics = new Map([["1", { games: 3, off: 2, b2b: 1 }]]);
    expect(totalRosterScheduleMetrics(["1", "1"], metrics)).toEqual(metrics.get("1"));
    expect(totalRosterScheduleMetrics(["1", "2"], metrics)).toBeNull();
    expect(totalRosterScheduleMetrics([], undefined)).toBeNull();
  });
  it("normalizes legacy settings and round-trips nonconsecutive playoff weeks", () => {
    expect(normalizeScheduleSettings({})).toEqual({ playoffWeeks: [], scheduleScope: "season" });
    expect(normalizeScheduleSettings(JSON.parse(JSON.stringify({ playoffWeeks: [27, 24, 24], scheduleScope: "playoffs" })))).toEqual({ playoffWeeks: [24, 27], scheduleScope: "playoffs" });
    expect(normalizeScheduleSettings({ playoffWeeks: [], scheduleScope: "playoffs" }).scheduleScope).toBe("season");
  });
});
