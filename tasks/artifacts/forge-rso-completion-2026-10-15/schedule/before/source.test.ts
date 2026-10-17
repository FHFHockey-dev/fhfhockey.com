import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, getScheduleDailyMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getScheduleDailyMock: vi.fn(),
}));

vi.mock("lib/NHL/base", () => ({ get: getMock }));
vi.mock("lib/NHL/server/scheduleDaily", () => ({
  getScheduleDaily: getScheduleDailyMock,
}));

import {
  fetchBoundedNhlSchedule,
  fetchFullSeasonNhlSchedule,
} from "./source";
import { normalizeNhlGameToTeamRows } from "./normalize";

const game = {
  id: 2026020001,
  season: 20262027,
  gameType: 2,
  gameDate: "2026-10-05",
  startTimeUTC: "2026-10-05T23:00:00Z",
  gameState: "FUT",
  gameScheduleState: "OK",
  awayTeam: { id: 4, abbrev: "PHI" },
  homeTeam: { id: 3, abbrev: "NYR" },
};

describe("roster optimizer NHL schedule source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deduplicates full-season club responses and reports the source IDs", async () => {
    getMock.mockResolvedValue({ games: [game] });

    const result = await fetchFullSeasonNhlSchedule({
      seasonId: 20262027,
      teams: [
        { id: 3, abbreviation: "NYR" },
        { id: 4, abbreviation: "PHI" },
      ],
    });

    expect(result.games).toHaveLength(1);
    expect(result.complete).toBe(true);
    expect(result.warnings).toEqual([
      expect.stringContaining("duplicate NHL source game IDs (2026020001)"),
    ]);
  });

  it("deduplicates bounded schedule results and returns diagnostic warnings", async () => {
    getScheduleDailyMock.mockResolvedValue({
      gameWeek: [{ date: "2026-10-05", games: [game, game] }],
    });

    const result = await fetchBoundedNhlSchedule({
      startDate: "2026-10-05",
      endDate: "2026-10-05",
    });

    expect(result.games).toHaveLength(1);
    expect(result.complete).toBe(true);
    expect(result.warnings).toEqual([
      expect.stringContaining("duplicate NHL source game IDs (2026020001)"),
    ]);
  });

  it("marks a partial club refresh incomplete so stale rows are preserved", async () => {
    getMock
      .mockResolvedValueOnce({ games: [game] })
      .mockRejectedValueOnce(new Error("club schedule unavailable"));

    const result = await fetchFullSeasonNhlSchedule({
      seasonId: 20262027,
      teams: [
        { id: 3, abbreviation: "NYR" },
        { id: 4, abbreviation: "PHI" },
      ],
    });

    expect(result.complete).toBe(false);
    expect(result.games).toHaveLength(1);
    expect(result.warnings).toContainEqual(
      expect.stringContaining("PHI: club schedule unavailable"),
    );
  });

  it("uses the authoritative day date when daily games omit it, preserving cross-UTC scoring dates", async () => {
    const { gameDate: _date, ...dailyGame } = game;
    getScheduleDailyMock.mockResolvedValue({ gameWeek: [{ date: "2026-10-05",
      games: [{ ...dailyGame, startTimeUTC: "2026-10-06T00:30:00Z" }] }] });
    const signal = new AbortController().signal;
    const result = await fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05", signal });
    expect(getScheduleDailyMock).toHaveBeenCalledWith("2026-10-05", signal);
    expect(result.games[0].game).toMatchObject({ gameDate: "2026-10-05", startTimeUTC: "2026-10-06T00:30:00Z" });
    const rows = normalizeNhlGameToTeamRows({ ...result.games[0], fetchedAt: "2026-10-01T10:00:00Z",
      gameKey: "477", yahooSeason: "2026", mapping: { status: "unmapped", reason: "no_week" } });
    expect(rows.map(row => [row.game_date, row.start_time])).toEqual([
      ["2026-10-05", "2026-10-06T00:30:00.000Z"], ["2026-10-05", "2026-10-06T00:30:00.000Z"] ]);
  });

  it("rejects malformed, unread or inconsistent daily scopes instead of claiming completeness", async () => {
    for (const payload of [{}, { gameWeek: null }, { gameWeek: [] }, { gameWeek: [{ date: "2026-10-05" }] },
      { gameWeek: [{ date: "2026-02-30", games: [] }] },
      { gameWeek: [{ date: "2026-10-05", games: [{ ...game, gameDate: "2026-10-06" }] }] }]) {
      getScheduleDailyMock.mockResolvedValueOnce(payload);
      await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05" })).rejects.toThrow(/NHL/);
    }
    for (const range of [{ startDate: "2026-10-06", endDate: "2026-10-05" },
      { startDate: "2026-02-30", endDate: "2026-03-02" }, { startDate: "2026-10-01", endDate: "2026-12-01" }]) {
      await expect(fetchBoundedNhlSchedule(range)).rejects.toThrow("Invalid bounded");
    }
    getScheduleDailyMock.mockResolvedValueOnce({ gameWeek: [{ date: "2026-10-05", games: [] }] });
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05" })).resolves.toMatchObject({ complete: true, games: [] });
    const controller = new AbortController();
    controller.abort();
    const calls = getScheduleDailyMock.mock.calls.length;
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05", signal: controller.signal })).rejects.toThrow(/abort/i);
    expect(getScheduleDailyMock).toHaveBeenCalledTimes(calls);
    const duringRead = new AbortController();
    getScheduleDailyMock.mockImplementationOnce(async () => { duringRead.abort(); return { gameWeek: [{ date: "2026-10-05", games: [] }] }; });
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05", signal: duringRead.signal })).rejects.toThrow(/abort/i);
  });

  it("checks every requested day across weekly calls and rejects a failed later week", async () => {
    const firstWeek = Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-${String(index + 5).padStart(2, "0")}`, games: [] }));
    getScheduleDailyMock.mockResolvedValueOnce({ gameWeek: firstWeek })
      .mockResolvedValueOnce({ gameWeek: [{ date: "2026-10-12", games: [] }] });
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-12" })).resolves.toMatchObject({ complete: true, games: [] });
    expect(getScheduleDailyMock.mock.calls.map(call => call[0])).toEqual(["2026-10-05", "2026-10-12"]);
    getScheduleDailyMock.mockResolvedValueOnce({ gameWeek: firstWeek }).mockRejectedValueOnce(new Error("unavailable"));
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-12" })).rejects.toThrow("unavailable");
  });

  it("rejects contradictory duplicate game versions and preserves equivalent start encodings", async () => {
    getMock.mockResolvedValueOnce({ games: [game] }).mockResolvedValueOnce({ games: [{ ...game, startTimeUTC: "2026-10-06T00:00:00Z" }] });
    await expect(fetchFullSeasonNhlSchedule({ seasonId: 20262027, teams: [{ id: 3, abbreviation: "NYR" },
      { id: 4, abbreviation: "PHI" }] })).rejects.toThrow("Conflicting NHL source");
    getScheduleDailyMock.mockResolvedValueOnce({ gameWeek: [{ date: "2026-10-05", games: [game,
      { ...game, startTimeUTC: "2026-10-05T23:30:00Z" }] }] });
    await expect(fetchBoundedNhlSchedule({ startDate: "2026-10-05", endDate: "2026-10-05" })).rejects.toThrow("Conflicting NHL source");
    getMock.mockResolvedValueOnce({ games: [game] }).mockResolvedValueOnce({ games: [{ ...game, startTimeUTC: "2026-10-05T19:00:00-04:00" }] });
    await expect(fetchFullSeasonNhlSchedule({ seasonId: 20262027, teams: [{ id: 3, abbreviation: "NYR" },
      { id: 4, abbreviation: "PHI" }] })).resolves.toMatchObject({ complete: true, games: [expect.anything()] });
    getMock.mockResolvedValueOnce({ games: [game] }).mockResolvedValueOnce({});
    await expect(fetchFullSeasonNhlSchedule({ seasonId: 20262027, teams: [{ id: 3, abbreviation: "NYR" },
      { id: 4, abbreviation: "PHI" }] })).resolves.toMatchObject({ complete: false });
  });
});
