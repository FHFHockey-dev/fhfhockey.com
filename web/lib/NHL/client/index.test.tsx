import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, format, parseISO } from "date-fns";
import { getSchedule, getTeams } from "./index";
import useSchedule from "components/GameGrid/utils/useSchedule";
import useFourWeekSchedule from "components/GameGrid/utils/useFourWeekSchedule";
import { useTeamsMap } from "hooks/useTeams";

const dateAt = (start: string, days: number) => format(addDays(parseISO(start), days), "yyyy-MM-dd");
const teams = [{ id: 1, abbreviation: "AAA", name: "Fixture A" }, { id: 2, abbreviation: "BBB", name: "Fixture B" }];
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
function payload(start: string, odds: boolean) {
  const game = { id: Number(start.replaceAll("-", "")), season: 20262027, gameType: 2,
    gameDate: dateAt(start, 2), gameScheduleState: "OK", gameState: "FUT",
    homeTeam: { id: 1, winOdds: odds ? 77 : null }, awayTeam: { id: 2, winOdds: odds ? 23 : null } };
  return { data: { 1: { WED: game }, 2: { WED: game } }, numGamesPerDay: [0, 0, 1, 0, 0, 0, 0],
    coveredDates: Array.from({ length: 7 }, (_, i) => dateAt(start, i)), retrievedAt: "2026-10-07T16:00:00Z" };
}
const transport = (input: string) => {
  if (input.startsWith("/api/v1/team/")) return json(teams);
  const url = new URL(input, "https://fixture.invalid");
  if (!url.pathname.startsWith("/api/v1/schedule/")) throw new Error(`Unexpected mocked request: ${input}`);
  return json(payload(url.pathname.split("/").at(-1)!, !url.search));
};
let clock = 0;
beforeEach(() => { clock += 60_000; vi.spyOn(Date, "now").mockReturnValue(clock); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Game Grid shared public reads", () => {
  // Decision 64: the Game Grid never requests win odds, so every grid read uses
  // the odds-free key and the selected and four-week hooks share it.
  it.each([false, true])("loads four odds-free windows and one team list in extended=%s", async extended => {
    const fetch = vi.fn(async (input: string) => transport(input));
    vi.stubGlobal("fetch", fetch);
    const view = renderHook(({ extended, excluded }) => {
      const metadata = useTeamsMap();
      const selected = useSchedule("2026-10-05", extended);
      const four = useFourWeekSchedule("2026-10-05");
      return { metadata, selected, four, excluded };
    }, { initialProps: { extended, excluded: false } });
    await waitFor(() => expect(view.result.current.selected[2] || view.result.current.four[2]).toBe(false));
    const schedules = () => fetch.mock.calls.filter(([url]) => url.includes("/schedule/"));
    expect(schedules()).toHaveLength(4);
    expect(new Set(schedules().map(([url]) => url.split("?")[0])).size).toBe(4);
    expect(schedules().every(([url]) => url.endsWith("?includeOdds=0"))).toBe(true);
    expect(fetch.mock.calls.filter(([url]) => url.includes("/team/"))).toHaveLength(1);
    expect(view.result.current.selected[0][0].WED?.homeTeam.winOdds).toBeNull();
    expect(view.result.current.selected[3].retrievedAtByDate?.["2026-10-07"]).toBe("2026-10-07T16:00:00Z");
    expect(view.result.current.selected[3].coverage.known).toBe(extended ? 10 : 7);
    expect(view.result.current.four[3].knownDays).toBe(28);
    view.rerender({ extended, excluded: true });
    expect(schedules()).toHaveLength(4);
    view.rerender({ extended: !extended, excluded: true });
    await waitFor(() => expect(view.result.current.selected[2]).toBe(false));
    // The next week is already shared from the four-week read: no odds upgrade.
    expect(schedules()).toHaveLength(4);
    if (!extended) expect(view.result.current.selected[0][0].nWED?.homeTeam.winOdds).toBeNull();
    view.rerender({ extended, excluded: true });
    await waitFor(() => expect(view.result.current.selected[2]).toBe(false));
    expect(schedules()).toHaveLength(4);
  });

  it("shares odds-bearing windows but never uses fixture-only payloads for an odds request", async () => {
    const fetch = vi.fn(async (input: string) => transport(input));
    vi.stubGlobal("fetch", fetch);
    await getSchedule("2026-11-02", { includeOdds: false });
    const selected = await getSchedule("2026-11-02");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(selected.data[1].WED?.homeTeam.winOdds).toBe(77);
    expect(await getSchedule("2026-11-02", { includeOdds: false })).toBe(selected);
    expect(fetch).toHaveBeenCalledTimes(2);
    await Promise.all([getTeams(20252026), getTeams(20252026), getTeams(20262027)]);
    expect(fetch.mock.calls.filter(([url]) => url.includes("/team/"))).toHaveLength(2);
  });

  it("unmounting one hook does not abort a shared window or start the cancelled chain", async () => {
    let finish!: (value: Response) => void;
    let sharedSignal!: AbortSignal;
    const fetch = vi.fn(async (input: string, init?: RequestInit) => {
      // Both hooks share the odds-free key (decision 64).
      if (input === "/api/v1/schedule/2026-12-07?includeOdds=0") {
        sharedSignal = init!.signal!;
        return new Promise<Response>(resolve => { finish = resolve; });
      }
      return transport(input);
    });
    vi.stubGlobal("fetch", fetch);
    const selected = renderHook(() => useSchedule("2026-12-07"));
    const four = renderHook(() => useFourWeekSchedule("2026-12-07"));
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    // Let the four-week reader subscribe after its team metadata resolves.
    await act(async () => {});
    four.unmount();
    expect(sharedSignal.aborted).toBe(false);
    await act(async () => finish(transport("/api/v1/schedule/2026-12-07?includeOdds=0")));
    await waitFor(() => expect(selected.result.current[2]).toBe(false));
    expect(selected.result.current[0][0].WED?.homeTeam.winOdds).toBeNull();
    expect(fetch.mock.calls.filter(([url]) => url.includes("/schedule/"))).toHaveLength(2);
  });

  it("aborts transport only after its last subscriber leaves and permits a fresh retry", async () => {
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((input: string, init?: RequestInit) => {
      const signal = init!.signal!;
      signals.push(signal);
      return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("fixture cancelled", "AbortError")), { once: true }));
    });
    vi.stubGlobal("fetch", fetch);
    const a = new AbortController(); const b = new AbortController();
    const first = getSchedule("2027-01-04", { signal: a.signal }).catch(error => error.name);
    const second = getSchedule("2027-01-04", { includeOdds: false, signal: b.signal }).catch(error => error.name);
    await act(async () => {});
    a.abort();
    expect(await first).toBe("AbortError");
    expect(signals[0].aborted).toBe(false);
    b.abort();
    expect(await second).toBe("AbortError");
    expect(signals[0].aborted).toBe(true);
    fetch.mockImplementation(async input => transport(input));
    await getSchedule("2027-01-04");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
