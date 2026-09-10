import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { shiftScheduleDate } from "lib/draftDashboard/scheduleMetrics";
import { useDraftSchedule } from "./useDraftSchedule";
import { useScheduleRange } from "components/GameGrid/utils/useSchedule";

const mocks = vi.hoisted(() => ({ schedule: vi.fn(), teams: vi.fn(), weeks: vi.fn() }));
vi.mock("lib/NHL/client", () => ({ getSchedule: mocks.schedule, getTeams: mocks.teams }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: () => ({ select: () => ({ eq: () => ({ order: mocks.weeks }) }) }) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shares NHL windows across scope changes and maps missing teams to unavailable", async () => {
  mocks.weeks.mockResolvedValue({ data: [{ week: 24, start_date: "2027-03-15", end_date: "2027-03-21" }, { week: 25, start_date: "2027-03-22", end_date: "2027-03-28" }], error: null });
  mocks.teams.mockResolvedValue([{ id: 1, abbreviation: "CAR" }]);
  mocks.schedule.mockImplementation(async (start: string) => ({ coveredDates: Array.from({ length: 7 }, (_, i) => shiftScheduleDate(start, i)), numGamesPerDay: [], data: { 1: { MON: { id: Number(start.replaceAll("-", "")), gameDate: shiftScheduleDate(start, 1), gameType: 2, season: 20262027, homeTeam: { id: 1 }, awayTeam: { id: 2 } } } } }));
  const players = [{ playerId: 1, displayTeam: "CAR" }, { playerId: 2, displayTeam: "UNKNOWN" }] as any;
  const { result, rerender } = renderHook(({ scope }) => useDraftSchedule(players, [24], scope), { initialProps: { scope: "season" as "season" | "playoffs" } });
  await waitFor(() => expect(result.current.playerMetrics?.get("1")?.games).toBe(2));
  expect(result.current.playerMetrics?.has("2")).toBe(false);
  const requests = mocks.schedule.mock.calls.length;
  rerender({ scope: "playoffs" });
  expect(result.current.playerMetrics?.get("1")?.games).toBe(1);
  expect(mocks.schedule).toHaveBeenCalledTimes(requests);
  expect(mocks.schedule).toHaveBeenCalledWith("2027-03-14", { includeOdds: false });
});

it("rejects incomplete date coverage instead of reporting zeros", async () => {
  mocks.schedule.mockResolvedValue({ data: {}, numGamesPerDay: [], coveredDates: [] });
  const { result } = renderHook(() => useScheduleRange("2028-01-03", "2028-01-09"));
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.error).toContain("does not yet cover");
  expect(result.current.games).toEqual([]);
});

it("reports failed NHL requests", async () => {
  mocks.schedule.mockRejectedValue(new Error("NHL unavailable"));
  const { result } = renderHook(() => useScheduleRange("2029-01-03", "2029-01-09"));
  await waitFor(() => expect(result.current.error).toBe("NHL unavailable"));
});
