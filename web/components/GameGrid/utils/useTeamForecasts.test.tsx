import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useTeamForecasts, { decodeTeamForecastResponse } from "./useTeamForecasts";
import { summarizeTeamForecasts, TEAM_FORECAST_CREDITS, type TeamForecastRecord } from "./teamForecasts";

const game = { id: 103, season: 20262027, gameType: 2, gameDate: "2026-10-07", gameState: "FUT",
  startTimeUTC: "2026-10-07T23:00:00Z", homeTeam: { id: 1 }, awayTeam: { id: 2 } };
const context = { seasonId: game.season, scheduleRevision: "schedule-r1", rosterRevision: "roster-r1",
  rosterScope: "skaters" as const, games: [{ gameId: game.id, startsAt: game.startTimeUTC, state: "scheduled" as const }] };
const record: TeamForecastRecord = { teamId: 1, gameId: game.id, seasonId: game.season, category: "G", mean: 0,
  unit: "count", scope: "full_game_regulation_overtime", conditioning: "unconditional", creditDefinition: TEAM_FORECAST_CREDITS.G,
  rosterScope: "skaters", rosterRevision: context.rosterRevision, scheduleRevision: context.scheduleRevision,
  startsAt: game.startTimeUTC, status: "qualified", allowedUses: { totals: true, comparison: false }, revisionId: "output-1",
  modelVersion: "model-1", comparisonLineageId: "run-1", sourceWatermark: "source-1",
  sourceAvailableAt: "2026-10-07T13:00:00Z", cutoffAt: "2026-10-07T14:00:00Z", issuedAt: "2026-10-07T14:30:00Z",
  availableAt: "2026-10-07T14:31:00Z", expiresAt: "2026-10-07T22:00:00Z" };
const payload = (data: unknown[] = [record]) => ({ asOfDate: "2026-10-07", horizonGames: 1, runId: "run-1", data, context });
const response = (value: unknown) => ({ ok: true, json: async () => value });
const rows = [{ teamId: 1, WED: game }];
const fetchMock = vi.fn();

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime("2026-10-07T16:00:00Z"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("existing public team reader consumer", () => {
  it("reads horizon=1 once, accepts explicit zero, and does not fetch on table sorting", async () => {
    fetchMock.mockResolvedValue(response(payload()));
    const { result, rerender } = renderHook(({ schedule }) => useTeamForecasts(schedule, true, "retrieved-r1"), { initialProps: { schedule: rows } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/projections/teams?date=2026-10-07&horizon=1");
    expect(summarizeTeamForecasts({ teamId: 1, gameIds: [103], asOf: result.current.checkedAt,
      records: result.current.records, context: result.current.contexts[1] }).G.mean).toBe(0);
    rerender({ schedule: [...rows] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads actual legacy team rows but never turns component goals/shots into category forecasts", () => {
    const legacy = { run_id: "run-1", game_id: 103, team_id: 1, proj_goals_es: 2, proj_goals_pp: 1,
      proj_goals_pk: null, proj_shots_es: 20, uncertainty: { native_goal_accounting: { fullGameEligible: false } } };
    const decoded = decodeTeamForecastResponse(payload([legacy]), [game]);
    expect(decoded).toMatchObject({ inspected: 1, rejected: 1, records: [], contexts: {} });
  });

  it("never derives context/admission from forecast values or accepts another run", () => {
    const decoded = decodeTeamForecastResponse({ ...payload(), context: undefined }, [game]);
    expect(decoded.records).toHaveLength(1);
    expect(decoded.contexts).toEqual({});
    expect(summarizeTeamForecasts({ teamId: 1, gameIds: [103], asOf: "2026-10-07T16:00:00Z", records: decoded.records }).G.mean).toBeNull();
    expect(decodeTeamForecastResponse(payload([{ ...record, comparisonLineageId: "different-run" }]), [game]).rejected).toBe(1);
  });

  it.each([null, { data: [] }, { ...payload(), horizonGames: 7 }, { ...payload(), data: Array(2001).fill({}) }])("rejects malformed/unbounded envelope %#", value => {
    expect(() => decodeTeamForecastResponse(value, [game])).toThrow();
  });

  it("withholds prior results immediately on refresh; an obsolete request cannot overwrite recovery", async () => {
    let release!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { result, rerender } = renderHook(({ snapshot }) => useTeamForecasts(rows, true, snapshot), { initialProps: { snapshot: "r1" } });
    fetchMock.mockResolvedValueOnce(response(payload([{ ...record, mean: 3 }])));
    rerender({ snapshot: "r2" });
    expect(result.current.records).toEqual([]);
    await waitFor(() => expect(result.current.records[0]?.mean).toBe(3));
    await act(async () => { release(response(payload([{ ...record, mean: 99 }]))); });
    expect(result.current.records[0]?.mean).toBe(3);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("retains schedule after a read error, retries, and removes values on a failed refresh", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTeamForecasts(rows, true, "r1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    fetchMock.mockResolvedValueOnce(response(payload()));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.records).toHaveLength(1);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.retry());
    expect(result.current.records).toEqual([]);
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("rejects a mismatched reader date and missing permission/expiry fields", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...payload(), asOfDate: "2026-10-06" }));
    const { result } = renderHook(() => useTeamForecasts(rows, true, "r1"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(decodeTeamForecastResponse(payload([{ ...record, expiresAt: undefined }, { ...record, allowedUses: undefined }]), [game]).rejected).toBe(2);
  });

  it("rechecks at a same-day puck drop without opening a row or fabricating live remaining means", async () => {
    vi.useRealTimers(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(new Date("2026-10-07T22:59:59Z"));
    fetchMock.mockResolvedValue(response(payload([{ ...record, expiresAt: "2026-10-08T01:00:00Z" }])));
    const { result } = renderHook(() => useTeamForecasts(rows, true, "r1"));
    await act(async () => {});
    expect(result.current.status).toBe("ready");
    expect(summarizeTeamForecasts({ teamId: 1, gameIds: [103], asOf: result.current.checkedAt,
      records: result.current.records, context: result.current.contexts[1] }).G.mean).toBe(0);
    expect(Date.now()).toBe(Date.parse("2026-10-07T22:59:59Z"));
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(summarizeTeamForecasts({ teamId: 1, gameIds: [103], asOf: result.current.checkedAt,
      records: result.current.records, context: result.current.contexts[1] }).G.mean).toBeNull();
  });

  it("bounds a hung reader request and permits retry after timeout", async () => {
    vi.useRealTimers(); vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    fetchMock.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const { result } = renderHook(() => useTeamForecasts(rows, true, "r1"));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.status).toBe("error");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce(response(payload()));
    await act(async () => { result.current.retry(); });
    expect(result.current.status).toBe("ready");
  });

  it("does not read for incomplete or covered empty schedules", () => {
    const { result, rerender } = renderHook(({ schedule, enabled }) => useTeamForecasts(schedule, enabled, "r1"), { initialProps: { schedule: rows, enabled: false } });
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ schedule: [], enabled: true });
    expect(result.current.status).toBe("ready");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
