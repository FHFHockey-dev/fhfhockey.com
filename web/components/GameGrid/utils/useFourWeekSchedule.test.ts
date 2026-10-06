import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameData, ScheduleData } from "lib/NHL/types";
import { getSchedule, getTeams } from "lib/NHL/client";
import useFourWeekSchedule from "./useFourWeekSchedule";

vi.mock("lib/NHL/client", () => ({ getSchedule: vi.fn(), getTeams: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const game = (id: number, gameType = 2): GameData => ({
  id, season: 20262027, gameType,
  homeTeam: { id: 1, winOdds: 50 }, awayTeam: { id: 2, winOdds: 50 }
});

describe("four-week calendar schedule summaries", () => {
  it.each([false, true])("uses regular-season counts and a consistent first-week horizon (extended=%s)", async (extended) => {
    vi.mocked(getTeams).mockResolvedValue([{ id: 1, abbreviation: "AAA" }, { id: 2, abbreviation: "BBB" }] as Awaited<ReturnType<typeof getTeams>>);
    vi.mocked(getSchedule).mockImplementation(async (start): Promise<ScheduleData> => {
      const regular = game(start === "2026-10-05" ? 1 : 2);
      const preseason = game(3, 1);
      return {
        data: { 1: { MON: regular, TUE: preseason }, 2: { MON: regular, TUE: preseason } },
        numGamesPerDay: [1, 1, 0, 0, 0, 0, 0]
      };
    });
    const { result } = renderHook(() => useFourWeekSchedule("2026-10-05", extended));
    await waitFor(() => expect(result.current[0]).toHaveLength(8));
    expect(result.current[2]).toBe(false);
    const week1 = result.current[0].find((row) => row.teamId === 1 && row.weekNumber === 1)!;
    expect(week1.totalGamesPlayed).toBe(extended ? 2 : 1);
    expect(week1.totalOffNights).toBe(extended ? 2 : 1);
    expect(week1.weekScore).toBeCloseTo(6 * ((extended ? 2 : 1) - (extended ? 2 : 1) / 16)
      + 4 * (extended ? 2 : 1) * (11 / 28) + .15 * 50);
    expect(result.current[1].slice(0, extended ? 10 : 7))
      .toEqual(extended ? [1, 0, 0, 0, 0, 0, 0, 1, 0, 0] : [1, 0, 0, 0, 0, 0, 0]);
    expect(result.current[0].filter((row) => row.weekNumber > 1).every((row) => row.totalGamesPlayed === 1)).toBe(true);
  });
});
