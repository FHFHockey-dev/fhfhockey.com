import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useSchedule from "./useSchedule";
import type { ScheduleData } from "lib/NHL/types";
const mocks = vi.hoisted(() => ({ getSchedule: vi.fn(), getTeams: vi.fn() }));
vi.mock("lib/NHL/client", () => mocks);
const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
const game = { id: 1, season: 20262027, gameType: 2, gameDate: dates[3], gameState: "FUT", startTimeUTC: "2026-10-08T23:00:00Z",
  venue: { default: "Fixture Arena" }, homeTeam: { id: 1 }, awayTeam: { id: 2 } };
const window = (): ScheduleData => ({ data: { 1: { THU: game }, 2: { THU: game } }, numGamesPerDay: [0, 0, 0, 1, 0, 0, 0],
  coveredDates: dates, retrievedAt: "2026-10-07T16:00:00Z" });
beforeEach(() => { mocks.getSchedule.mockReset(); mocks.getTeams.mockResolvedValue([{ id: 1, abbreviation: "A" }, { id: 2, abbreviation: "B" }]); });
afterEach(cleanup);

describe("selected schedule metadata", () => {
  it("preserves actual start, venue, date coverage and retrieval timestamps through both team rows", async () => {
    mocks.getSchedule.mockResolvedValue(window());
    const { result } = renderHook(() => useSchedule(dates[0]));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[0].map(row => row.THU)).toEqual([game, game]);
    expect(result.current[3]).toMatchObject({ coverage: { known: 7, expected: 7 }, retrievedAtByDate: { [dates[3]]: "2026-10-07T16:00:00Z" } });
    expect(result.current[1]).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it("keeps ten-day windows' individual receipt times and excludes dates beyond the selection", async () => {
    mocks.getSchedule.mockResolvedValueOnce(window()).mockResolvedValueOnce({ data: {}, numGamesPerDay: Array(7).fill(0),
      coveredDates: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"], retrievedAt: "2026-10-07T16:01:00Z" });
    const { result } = renderHook(() => useSchedule(dates[0], true));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[3].coverage).toEqual({ known: 10, expected: 10 });
    expect(result.current[3].retrievedAtByDate).toMatchObject({ "2026-10-08": "2026-10-07T16:00:00Z", "2026-10-12": "2026-10-07T16:01:00Z" });
    expect(result.current[3].retrievedAtByDate).not.toHaveProperty("2026-10-15");
  });

  it("leaves absent start, venue and source freshness unknown; invalid receipt time is not filled with now", async () => {
    const incomplete = { ...game, startTimeUTC: undefined, venue: undefined };
    mocks.getSchedule.mockResolvedValue({ ...window(), data: { 1: { THU: incomplete } }, retrievedAt: "not-a-timestamp" });
    const { result } = renderHook(() => useSchedule(dates[0]));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[0][0].THU?.startTimeUTC).toBeUndefined();
    expect(result.current[0][0].THU?.venue).toBeUndefined();
    expect(result.current[3].retrievedAtByDate).toEqual({});
    expect(result.current[3]).not.toHaveProperty("sourceObservedAt");
  });
});
