import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { DAYS, type GameData, type ScheduleData } from "lib/NHL/types";
import { getSchedule, getTeams } from "lib/NHL/client";
import { loadCachedCanonicalSchedule, loadCanonicalSchedule, useCanonicalSchedule } from "./canonicalSchedule";
vi.mock("lib/NHL/client", () => ({ getSchedule: vi.fn(), getTeams: vi.fn() }));
const dates = Array.from({ length: 7 }, (_, i) => `2026-10-${12 + i}`);
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const game: GameData = { id: 1, season: 20262027, gameType: 2, gameDate: dates[0], startTimeUTC: `${dates[0]}T23:00:00Z`, homeTeam: { id: 1 }, awayTeam: { id: 2 } };
function windowData(start: string, games = [game]): ScheduleData {
  const coveredDates = Array.from({ length: 7 }, (_, i) => shift(start, i));
  const data: ScheduleData["data"] = {};
  const numGamesPerDay = Array(7).fill(0);
  for (const item of games.filter(item => coveredDates.includes(item.gameDate!))) {
    const day = (new Date(`${item.gameDate}T12:00:00Z`).getUTCDay() + 6) % 7;
    numGamesPerDay[day]++;
    for (const team of [item.homeTeam.id, item.awayTeam.id]) (data[team] ??= {})[DAYS[day]] = item;
  }
  return { data, coveredDates, numGamesPerDay };
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getSchedule).mockImplementation(async start => windowData(start)); vi.mocked(getTeams).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("remaining-date cached schedule context", () => {
  const remaining = ["2026-10-16", "2026-10-17", "2026-10-18"];
  const weeks = [{ gameKey: "477", week: 1, startDate: "2026-10-12", endDate: "2026-10-18" },
    { gameKey: "477", week: 2, startDate: "2026-10-19", endDate: "2026-10-25" }];
  const now = Date.parse("2026-10-16T08:00:00Z");
  function rows() {
    const shared = { game_key: "477", source_season_id: 20262027, source_game_id: 2026020123,
      game_date: "2026-10-16", start_time: "2026-10-16T23:00:00Z", game_type: 2,
      game_status: "FUT", schedule_status: "OK", is_countable: true, fetched_at: "2026-10-16T07:00:00Z",
      source_metadata: { scheduleCoverage: { version: "nhl-source-days-v1", date: "2026-10-16",
        gameIds: [2026020123], emptyDates: ["2026-10-15", "2026-10-17", "2026-10-18", "2026-10-19"] } } };
    return [{ ...shared, team_id: 26, opponent_team_id: 17, team_abbreviation: "LAK", opponent_abbreviation: "DET", home_away: "home" },
      { ...shared, team_id: 17, opponent_team_id: 26, team_abbreviation: "DET", opponent_abbreviation: "LAK", home_away: "away" }];
  }
  function serve(games = rows()) {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true,
      data: { version: "roster-team-games.v1", games } }) });
    vi.stubGlobal("fetch", fetcher); return fetcher;
  }
  it("uses exact cached day witnesses without requiring unknown earlier-week dates or NHL fallback", async () => {
    const fetcher = serve();
    expect(await loadCachedCanonicalSchedule(remaining, 20262027, "America/New_York", weeks, now))
      .toMatchObject({ complete: true, games: [{ id: 2026020123, gameDate: "2026-10-16" }] });
    expect(fetcher).toHaveBeenCalledWith("/api/v1/roster-schedule-optimizer/schedule?gameKey=477&startWeek=1&endWeek=2&scope=witnessed", expect.anything());
    expect(getSchedule).not.toHaveBeenCalled(); expect(getTeams).not.toHaveBeenCalled();
    expect((await loadCachedCanonicalSchedule(dates, 20262027, "America/New_York", weeks, now)).complete).toBe(false);
  });
  it("verifies a witnessed postponed pair on the full cached set but returns only playable games", async () => {
    const values = rows().map(row => ({ ...row, source_metadata: { scheduleCoverage: {
      ...row.source_metadata.scheduleCoverage, gameIds: [2026020123, 2026020124] } } }));
    const postponed = values.map((row, index) => ({ ...row, source_game_id: 2026020124, team_id: index ? 9 : 8,
      opponent_team_id: index ? 8 : 9, team_abbreviation: index ? "MTL" : "TOR", opponent_abbreviation: index ? "TOR" : "MTL",
      schedule_status: "PPD", is_countable: false }));
    // Stand-in for the schedule route: non-countable sides appear only in the witnessed scope.
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ success: true, data: {
      version: "roster-team-games.v1", games: url.includes("scope=witnessed") ? [...values, ...postponed] : values } }) }));
    vi.stubGlobal("fetch", fetcher);
    const result = await loadCachedCanonicalSchedule(remaining, 20262027, "UTC", weeks, now);
    expect(result).toMatchObject({ complete: true, error: null });
    expect(result.games.map(item => item.id)).toEqual([2026020123]);
    const countableOnly = postponed.map(row => ({ ...row, schedule_status: "OK" }));
    fetcher.mockImplementation(async () => ({ ok: true, json: async () => ({ success: true, data: {
      version: "roster-team-games.v1", games: [...values, ...countableOnly.slice(0, 1)] } }) }));
    expect((await loadCachedCanonicalSchedule(remaining, 20262027, "UTC", weeks, now)).complete).toBe(false);
  });
  it("does not read any source while cached week mapping is missing", async () => {
    const fetcher = serve();
    expect((await loadCachedCanonicalSchedule(remaining, 20262027, "UTC", [], now)).complete).toBe(false);
    expect(fetcher).not.toHaveBeenCalled(); expect(getSchedule).not.toHaveBeenCalled();
  });
  it("keeps the cache-only hook closed while initial matchup metadata is loading", async () => {
    const fetcher = serve();
    const { result } = renderHook(() => useCanonicalSchedule(remaining, 20262027, "UTC", true, { source: "cache", weeks: [] }));
    await waitFor(() => expect(result.current.error).toContain("matchup-week mapping is unavailable"));
    expect(fetcher).not.toHaveBeenCalled(); expect(getSchedule).not.toHaveBeenCalled(); expect(getTeams).not.toHaveBeenCalled();
  });
  it("expires held-open coverage at its original clock without a read and recovers only on explicit refresh", async () => {
    vi.useFakeTimers();
    const deadline = Date.parse(rows()[0].fetched_at) + 36 * 3600000;
    vi.setSystemTime(deadline - 1000);
    const fetcher = serve();
    const { result, rerender } = renderHook(({ refresh }) => useCanonicalSchedule(remaining, 20262027, "UTC", true,
      { source: "cache", weeks }, refresh), { initialProps: { refresh: 101 } });
    await act(async () => {});
    expect(result.current).toMatchObject({ complete: true, validUntil: deadline });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(result.current).toMatchObject({ complete: false, games: [] });
    expect(result.current.error).toContain("expired"); expect(fetcher).toHaveBeenCalledTimes(1);
    const refreshed = rows().map(row => ({ ...row, fetched_at: new Date().toISOString() }));
    serve(refreshed);
    rerender({ refresh: 102 });
    await act(async () => {});
    expect(result.current).toMatchObject({ complete: true, validUntil: deadline + 36 * 3600000 });
    expect(getSchedule).not.toHaveBeenCalled(); expect(getTeams).not.toHaveBeenCalled();
  });
  it("does not apply deferred old-key results or expire the new key after cleanup", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    let resolveOld!: (value: unknown) => void;
    const fetcher = serve();
    fetcher.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const { result, rerender, unmount } = renderHook(({ refresh }) => useCanonicalSchedule(remaining, 20262027, "UTC", true,
      { source: "cache", weeks }, refresh), { initialProps: { refresh: 201 } });
    rerender({ refresh: 202 });
    await act(async () => {});
    expect(result.current.complete).toBe(true);
    await act(async () => { resolveOld({ ok: true, json: async () => ({ success: true,
      data: { version: "roster-team-games.v1", games: rows().slice(0, 1) } }) }); });
    expect(result.current.complete).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(getSchedule).not.toHaveBeenCalled();
  });
  it.each(["missing side", "stale", "wrong season", "conflicting side", "missing witness", "unknown countability", "read failure"])(
    "withholds incomplete cached evidence: %s", async mode => {
      const values = rows();
      if (mode === "missing side") values.pop();
      if (mode === "stale") values[0].fetched_at = "2026-10-12T00:00:00Z";
      if (mode === "wrong season") values[0].source_season_id = 20252026;
      if (mode === "conflicting side") values[1].home_away = "home";
      if (mode === "missing witness") values[0].source_metadata.scheduleCoverage.emptyDates = [];
      if (mode === "unknown countability") delete (values[0] as Partial<typeof values[0]>).is_countable;
      const fetcher = serve(values);
      if (mode === "read failure") fetcher.mockRejectedValue(new Error("unavailable"));
      expect(await loadCachedCanonicalSchedule(remaining, 20262027, "UTC", weeks, now)).toMatchObject({ complete: false, games: [] });
      expect(getSchedule).not.toHaveBeenCalled(); expect(getTeams).not.toHaveBeenCalled();
    });
});
describe("Game Grid canonical calendar admission for RSO context", () => {
  it("reads bounded padded canonical windows without roster or forecast inputs", async () => {
    expect(await loadCanonicalSchedule(dates, 20262027, "America/New_York")).toMatchObject({ complete: true, games: [game] });
    expect(vi.mocked(getSchedule).mock.calls.map(call => call[0])).toEqual(["2026-10-11", "2026-10-18"]);
    expect(getTeams).toHaveBeenCalledWith(20262027);
  });
  it("admits an explicitly covered zero-game calendar and tolerates unavailable team labels", async () => {
    vi.mocked(getSchedule).mockImplementation(async start => windowData(start, []));
    vi.mocked(getTeams).mockRejectedValue(new Error("metadata unavailable"));
    expect(await loadCanonicalSchedule(dates, 20262027, "UTC")).toEqual({ complete: true, games: [], teams: [], error: null });
  });
  it.each(["missing coverage", "count mismatch", "identity conflict", "wrong season", "read failure"])("withholds unresolved %s", async mode => {
    vi.mocked(getSchedule).mockImplementation(async start => {
      if (mode === "read failure") throw new Error("offline");
      const result = windowData(start, [{ ...game, ...(mode === "wrong season" ? { season: 20252026 } : {}) }]);
      if (mode === "missing coverage") result.coveredDates = result.coveredDates!.slice(1);
      if (mode === "count mismatch") result.numGamesPerDay[0]++;
      if (mode === "identity conflict" && result.data[2]) result.data[2].MON = { ...game, homeTeam: { id: 3 } };
      return result;
    });
    const result = await loadCanonicalSchedule(dates, 20262027, "UTC");
    expect(result.complete).toBe(false); expect(result.games).toEqual([]); expect(result.error).toBeTruthy();
  });
  it("converts source start times to league dates across midnight and filters nonregular or cancelled games", async () => {
    const items = [{ ...game, startTimeUTC: "2026-10-12T01:00:00Z" },
      { ...game, id: 2, homeTeam: { id: 3 }, awayTeam: { id: 4 }, gameType: 1 },
      { ...game, id: 3, homeTeam: { id: 5 }, awayTeam: { id: 6 }, gameState: "CNCL" }];
    vi.mocked(getSchedule).mockImplementation(async start => windowData(start, items));
    expect((await loadCanonicalSchedule(dates, 20262027, "America/New_York")).games).toEqual([]);
    expect((await loadCanonicalSchedule(dates, 20262027, "UTC")).games).toHaveLength(1);
  });
  it("requires clocks for a non-Eastern league calendar", async () => {
    vi.mocked(getSchedule).mockImplementation(async start => windowData(start, [{ ...game, startTimeUTC: undefined }]));
    expect((await loadCanonicalSchedule(dates, 20262027, "America/Los_Angeles")).complete).toBe(false);
    expect((await loadCanonicalSchedule(dates, 20262027, "America/New_York")).complete).toBe(true);
  });
  it("rejects unsupported ranges before issuing a read", async () => {
    for (const selected of [[], [dates[0], dates[2]], ["2026-02-30"]]) expect((await loadCanonicalSchedule(selected, 20262027, "UTC")).complete).toBe(false);
    expect(getSchedule).not.toHaveBeenCalled();
  });
});
