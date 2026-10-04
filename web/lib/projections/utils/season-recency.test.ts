import { describe, expect, it, vi } from "vitest";
import { loadSkaterRecencySeasons, regularSeasonRecencyDays } from "./season-recency";

const seasons = [
  { id: 20242025, startDate: "2024-10-04", regularSeasonEndDate: "2025-04-17", endDate: "2025-06-17", numberOfGames: 82 },
  { id: 20252026, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-17", endDate: "2026-06-15", numberOfGames: 82 },
  { id: 20262027, startDate: "2026-09-29", regularSeasonEndDate: "2027-04-10", endDate: "2027-06-10", numberOfGames: 84 },
];
const intSeason = (date: string) => date >= "2026-09-29" ? 20262027 : date >= "2025-10-07" ? 20252026 : 20242025;
const age = (eventDate: string, asOfDate = "2026-10-05", calendar = seasons) => regularSeasonRecencyDays({ eventDate, eventSeasonId: intSeason(eventDate), eventGameType: 2, asOfDate, currentSeasonId: 20262027, seasons: calendar });

describe("regular-season skater recency", () => {
  it("excludes the offseason without changing the event date", () => {
    expect(age("2026-04-13")).toBe(10);
    expect(age("2026-04-17")).toBe(6);
    expect(age("2026-10-03")).toBe(2);
    expect(age("2026-04-17", "2026-09-29")).toBe(0);
    expect(age("2026-04-01", "2026-11-01")).toBe(49);
  });
  it("counts intervening regular seasons and preserves truly stale history", () => {
    expect(age("2025-04-17")).toBe(198);
    expect(age("2025-03-01")).toBe(245);
  });
  it("requires a real regular-season event, excluding playoff and preseason dates", () => {
    expect(age("2026-05-01")).toBeNull();
    for (const eventGameType of [1, 3]) expect(regularSeasonRecencyDays({ eventDate: "2026-10-03", eventSeasonId: 20262027, eventGameType, asOfDate: "2026-10-05", currentSeasonId: 20262027, seasons })).toBeNull();
    expect(age("2026-09-20")).toBeNull();
    expect(age("2026-10-05")).toBeNull();
    expect(age("2026-10-06")).toBeNull();
    expect(age("2026-10-03", "2027-05-01")).toBe(189);
  });
  it("holds missing, invalid, overlapping and nonconsecutive metadata", () => {
    for (const calendar of [[], [seasons[2]], [seasons[0], seasons[2]],
      [seasons[1], seasons[2], seasons[2]],
      [seasons[1], { ...seasons[2], startDate: "2026-06-01" }],
      [seasons[1], { ...seasons[2], regularSeasonEndDate: null as any }],
      [seasons[1], { ...seasons[2], startDate: "2026-02-30" }]]) {
      expect(age("2026-04-13", "2026-10-05", calendar)).toBeNull();
    }
    expect(age("2026-04-13", "2026-09-20")).toBeNull();
    expect(age("2026-04-13", "2027-07-01")).toBeNull();
  });
  it("accepts native timestamp boundaries while rejecting fabricated date strings", () => {
    expect(age("2026-04-13", "2026-10-05", seasons.map(s => ({ ...s, startDate: s.startDate + "T00:00:00.000Z", regularSeasonEndDate: s.regularSeasonEndDate + "T00:00:00.000Z", endDate: s.endDate + "T00:00:00.000Z" })))).toBe(10);
    expect(age("2026-04-13 junk")).toBeNull();
  });
  it("loads exactly every required native season and fails on missing/denied reads", async () => {
    const readSeason = vi.fn(async (id: number) => seasons.find(s => s.id === id) ?? null);
    expect(await loadSkaterRecencySeasons({ currentSeasonId: 20262027, latestEventDates: ["2025-04-17"], readSeason })).toEqual(seasons);
    expect(readSeason.mock.calls.map(([id]) => id)).toEqual([20262027, 20252026, 20242025]);
    await expect(loadSkaterRecencySeasons({ currentSeasonId: 20262027, latestEventDates: ["2026-04-13"], readSeason: async () => null })).rejects.toThrow("Missing");
    await expect(loadSkaterRecencySeasons({ currentSeasonId: 20262027, latestEventDates: [], readSeason: async () => { throw new Error("denied"); } })).rejects.toThrow("denied");
  });
});
