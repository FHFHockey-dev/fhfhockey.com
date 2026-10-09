import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format, parseISO } from "date-fns";
import { GameData, ScheduleData } from "lib/NHL/types";
import { getSchedule, getTeams } from "lib/NHL/client";
import useFourWeekSchedule, { normalizeCalendarWeek } from "./useFourWeekSchedule";
import useSchedule from "./useSchedule";

vi.mock("lib/NHL/client", () => ({ getSchedule: vi.fn(), getTeams: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const dateAt = (start: string, days: number) => format(addDays(parseISO(start), days), "yyyy-MM-dd");
const game = (id: number, gameDate: string, overrides: Partial<GameData> = {}): GameData => ({
  id, season: 20262027, gameType: 2, gameDate, gameScheduleState: "OK", gameState: "FUT",
  homeTeam: { id: 1, winOdds: 50 }, awayTeam: { id: 2, winOdds: 50 }, ...overrides
});

describe("selected schedule coverage and request identity", () => {
  it("fetches one window for seven days and preserves covered empty schedules", async () => {
    vi.mocked(getSchedule).mockImplementation(async (start) => ({ ...payload(start), data: {} }));
    const { result } = renderHook(() => useSchedule("2026-10-05"));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(getSchedule).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toHaveLength(3);
    expect(result.current[1]).toEqual(Array(7).fill(0));
    expect(result.current[3]).toMatchObject({ coverage: { known: 7, expected: 7 }, error: null });
  });
  it("does not claim complete coverage for a partial schedule", async () => {
    vi.mocked(getSchedule).mockImplementation(async (start) => ({ ...payload(start), coveredDates: [start] }));
    const { result } = renderHook(() => useSchedule("2026-10-05"));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[3].coverage).toEqual({ known: 1, expected: 7 });
  });
  it("uses actual dates across ten days and rejects prior-horizon results", async () => {
    let resolveOld!: (value: ScheduleData) => void;
    const { result, rerender } = renderHook(({ extended }) => useSchedule("2026-10-05", extended), { initialProps: { extended: false } });
    await waitFor(() => expect(result.current[2]).toBe(false));
    vi.mocked(getSchedule).mockImplementation(async (start) => start === "2026-10-05"
      ? new Promise((resolve) => { resolveOld = resolve; }) : payload(start));
    rerender({ extended: true });
    expect(result.current[0]).toEqual([]);
    expect(result.current[2]).toBe(true);
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    const oldRequest = resolveOld;
    vi.mocked(getSchedule).mockImplementation(async (start) => payload(start));
    rerender({ extended: false });
    await waitFor(() => expect(result.current[2]).toBe(false));
    await act(async () => oldRequest(payload("2026-10-05")));
    expect(result.current[3].coverage).toEqual({ known: 7, expected: 7 });
    expect(result.current[0][0].nMON).toBeUndefined();
  });
  it("rebuckets actual dates and clips next Thursday from the ten-day selection", async () => {
    const { result } = renderHook(() => useSchedule("2026-10-05", true));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[3].coverage).toEqual({ known: 10, expected: 10 });
    const row = result.current[0].find((entry) => entry.teamId === 1)!;
    expect(row.MON).toBeUndefined();
    expect(row.WED?.gameDate).toBe("2026-10-07");
    expect(row.nWED?.gameDate).toBe("2026-10-14");
    expect(result.current[1]).toEqual([0, 0, 1, 0, 0, 0, 1, 0, 0, 1]);
  });
  it("surfaces errors instead of displaying a verified empty slate", async () => {
    vi.mocked(getSchedule).mockRejectedValue(new Error("Fixture unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSchedule("2026-10-05"));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[0]).toEqual([]);
    expect(result.current[3]).toMatchObject({ coverage: { known: 0, expected: 7 }, error: "Fixture unavailable" });
    vi.restoreAllMocks();
  });
});
const payload = (start: string): ScheduleData => {
  const regular = game(Number(start.replaceAll("-", "")), dateAt(start, 2));
  const preseason = game(1, dateAt(start, 1), { gameType: 1 });
  const completed = game(regular.id + 1, dateAt(start, 6), { gameState: "FINAL" });
  return {
    data: { 1: { MON: regular, TUE: preseason, SUN: completed }, 2: { MON: regular, TUE: preseason, SUN: completed } },
    coveredDates: Array.from({ length: 7 }, (_, i) => dateAt(start, i)),
    numGamesPerDay: Array(7).fill(999)
  };
};
beforeEach(() => {
  vi.mocked(getTeams).mockResolvedValue([{ id: 1, abbreviation: "AAA" }, { id: 2, abbreviation: "BBB" }, { id: 3, abbreviation: "BYE" }] as Awaited<ReturnType<typeof getTeams>>);
  vi.mocked(getSchedule).mockImplementation(async (start) => payload(start));
});

describe("four-week calendar schedule summaries", () => {
  it.each(["2026-10-07", "2026-10-30", "2026-03-06", "2026-12-30"])("covers every one of 28 dates exactly once from %s across DST/year transitions", async (selected) => {
    vi.mocked(getSchedule).mockImplementation(async (start) => ({
      coveredDates: Array.from({ length: 7 }, (_, i) => dateAt(start, i)),
      data: { 1: Object.fromEntries(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) =>
        [day, game(Number(dateAt(start, i).replaceAll("-", "")), dateAt(start, i))])) },
      numGamesPerDay: Array(7).fill(1)
    }));
    const { result } = renderHook(() => useFourWeekSchedule(selected));
    await waitFor(() => expect(result.current[2]).toBe(false));
    const calendar = result.current[3];
    const dates = result.current[0].filter((row) => row.teamId === 1).flatMap((row) =>
      Object.entries(row).filter(([day]) => ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(day))
        .map(([, value]) => (value as GameData).gameDate));
    expect(dates).toEqual(Array.from({ length: 28 }, (_, i) => dateAt(calendar.start, i)));
    expect(new Set(dates).size).toBe(28);
    expect(calendar.knownDays).toBe(28);
    expect(result.current[1]).toEqual(Array(28).fill(1));
  });
  it.each([
    ["2026-10-07", "2026-10-05"], ["2026-10-05", "2026-10-05"],
    ["2026-03-06", "2026-03-02"], ["2026-12-30", "2026-12-28"]
  ])("anchors %s to four nonoverlapping Monday–Sunday weeks", async (selected, monday) => {
    const { result } = renderHook(() => useFourWeekSchedule(selected));
    await waitFor(() => expect(result.current[0]).toHaveLength(8));
    expect(result.current[2]).toBe(false);
    expect(vi.mocked(getSchedule).mock.calls.map(([start]) => start)).toEqual([0, 7, 14, 21].map((i) => dateAt(monday, i)));
    expect(result.current[3]).toMatchObject({ start: monday, end: dateAt(monday, 27), knownDays: 28, expectedDays: 28 });
    const rows = result.current[0].filter((row) => row.teamId === 1);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => !row.MON && row.WED && row.SUN && row.totalGamesPlayed === 2 && row.totalOffNights === 2)).toBe(true);
    expect(new Set(rows.flatMap((row) => [row.WED!.id, row.SUN!.id])).size).toBe(8);
    expect(result.current[1]).toEqual(Array.from({ length: 4 }, () => [0, 0, 1, 0, 0, 0, 1]).flat());
  });
  it("keeps uncovered weeks distinct from covered byes and retains unknown all-zero teams", async () => {
    vi.mocked(getSchedule).mockImplementation(async (start) => start === "2026-10-12"
      ? { data: {}, coveredDates: [], numGamesPerDay: Array(7).fill(0) } : payload(start));
    const { result } = renderHook(() => useFourWeekSchedule("2026-10-07"));
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[0]).toHaveLength(12);
    expect(result.current[3].knownDays).toBe(21);
    expect(result.current[0].find((row) => row.teamId === 3 && row.weekNumber === 2)?.scheduleCoverage).toEqual({ known: 0, expected: 7 });
    expect(result.current[0].find((row) => row.teamId === 3 && row.weekNumber === 1)?.scheduleCoverage).toEqual({ known: 7, expected: 7 });
  });
  it("counts a rescheduled game once on its valid date, clips outside dates and excludes inactive states", () => {
    const start = "2026-10-05";
    const schedule = payload(start);
    schedule.data = { 1: {
      MON: game(1, start, { gameScheduleState: "PPD" }),
      TUE: game(2, dateAt(start, 1), { gameState: "CANCELLED" }),
      WED: game(1, dateAt(start, 2)), THU: game(1, dateAt(start, 2)),
      FRI: game(3, dateAt(start, 7))
    } };
    const normalized = normalizeCalendarWeek(schedule, start);
    expect(Object.keys(normalized.data[1])).toEqual(["WED"]);
    expect(normalized.data[1].WED?.id).toBe(1);
    expect(normalized.coverage.known).toBe(7);
  });
  it("does not turn malformed or conflicting identities into a covered bye", () => {
    const schedule = payload("2026-10-05");
    schedule.data = { 1: { MON: game(1, "2026-10-05"), TUE: game(1, "2026-10-06") } };
    expect(normalizeCalendarWeek(schedule, "2026-10-05").coverage.known).toBe(0);
    schedule.data = { 1: { MON: { ...game(2, "2026-10-05"), gameDate: undefined } } };
    expect(normalizeCalendarWeek(schedule, "2026-10-05").data).toEqual({});
  });
  it("ignores an old completion after the selected week changes", async () => {
    let resolveOld!: (value: ScheduleData) => void;
    vi.mocked(getSchedule).mockImplementation(async (start) => start === "2026-10-05"
      ? new Promise((resolve) => { resolveOld = resolve; }) : payload(start));
    const { result, rerender } = renderHook(({ start }) => useFourWeekSchedule(start), { initialProps: { start: "2026-10-07" } });
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    rerender({ start: "2026-11-04" });
    await waitFor(() => expect(result.current[3].start).toBe("2026-11-02"));
    await act(async () => resolveOld(payload("2026-10-05")));
    expect(result.current[3].start).toBe("2026-11-02");
  });
});
