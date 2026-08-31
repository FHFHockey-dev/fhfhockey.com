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
});
