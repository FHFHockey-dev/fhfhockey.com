import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Replay from "./Replay";
import * as model from "./model";
import { gameFixture } from "./testFixtures";
import { storedFixtureGame } from "./testStoredGame";
import styles from "styles/ShiftChart.module.scss";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("updates replay statistics without fetching or recalculating the full-game matrix", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // The only request is the one decision-152 PP clock gate read (serving off here).
  const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ servingEnabled: false, clocks: [] }) }));
  vi.stubGlobal("fetch", fetchMock);
  const matrixSpy = vi.spyOn(model, "matrixData");
  const f = gameFixture();
  const game = model.normalizeGame(f.box, f.shifts, f.pbp);
  render(
    <Replay
      game={game}
      mode="line-combination"
      onModeChanged={() => {}}
      selection={<div>Selection</div>}
    />,
  );
  expect(matrixSpy).toHaveBeenCalledTimes(1);
  const slider = screen.getByRole("slider", { name: "Replay time" });
  fireEvent.change(slider, { target: { value: "20" } });
  expect(screen.getByTestId("score-68").textContent).toBe("1");
  fireEvent.change(screen.getByLabelText("Timeline players"), {
    target: { value: "D" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Play replay" }));
  act(() => vi.advanceTimersByTime(1000));
  expect((slider as HTMLInputElement).value).toBe("24");
  expect(matrixSpy).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("/api/v1/pp-share/team-game-clock"))).toBe(true);
  fireEvent.change(slider, { target: { value: "3599" } });
  act(() => vi.advanceTimersByTime(1000));
  expect((slider as HTMLInputElement).value).toBe("3600");
  expect(screen.getByRole("button", { name: "Play replay" })).toBeTruthy();
});

it("decision 152: in PP mode, shows a team's matrix only when its stored clock is available and matches", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const f = gameFixture();
  const normalized = model.normalizeGame(f.box, f.shifts, f.pbp);
  // The fixture has no penalty, so give the home team one 2:00 power play; it gets an available, matching clock and
  // the away team an unavailable one.
  const homePp = [{ start: 100, end: 220, teamId: normalized.home.id }];
  const game = { ...normalized, powerPlays: homePp, qualifiedPowerPlays: homePp };
  const live = model.ppSecondsByTeam(game);
  const [ppTeam, other] = [game.home, game.away];
  expect(live).toEqual({ [game.home.id]: 120, [game.away.id]: 0 });
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ servingEnabled: true, clocks: [
      { gameId: game.id, teamId: ppTeam.id, availability: "available", clockSeconds: live[ppTeam.id], unavailableReason: null, computedAt: "t" },
      { gameId: game.id, teamId: other.id, availability: "unavailable", clockSeconds: null,
        unavailableReason: "No play-by-play for this game.", computedAt: "t" },
    ] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  render(<Replay game={game} mode="pp-toi" onModeChanged={() => {}} selection={<div>Selection</div>} />);
  expect(await screen.findByText(`${other.name}: No play-by-play for this game.`)).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith(`/api/v1/pp-share/team-game-clock?gameIds=${game.id}`);
  expect(screen.queryByText(new RegExp(`^${ppTeam.name}:`))).toBeNull();
});

// Decision 152: served timelines use the same full-field intervals as the matrix, guarded against the stored
// qualified clock. Real stored-row fixtures (__tests__/ppShare/fixtures); never create bands from a stored total.
describe("decision 152 replay PP bands against the stored clock", () => {
  const clockRow = (gameId: number, teamId: number, availability: string, clockSeconds: number | null) =>
    ({ gameId, teamId, availability, clockSeconds, unavailableReason: null, computedAt: "t" });
  const serve = (body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })));
  const tracks = (abbrev: string) => screen.getByLabelText(`${abbrev} shifts`);
  const bands = (abbrev: string, cls: "ppBand" | "pkBand") =>
    Array.from(tracks(abbrev).querySelectorAll(`.${styles[cls]}`));
  const firstTrackBands = (abbrev: string, cls: "ppBand" | "pkBand") =>
    tracks(abbrev).querySelector(`.${styles.track}`)!.querySelectorAll(`.${styles[cls]}`).length;
  const teamPowerPlays = (game: model.Game, teamId: number) => game.powerPlays.filter((pp) => pp.teamId === teamId).length;
  const expectTeamBands = (game: model.Game, ppTeamId: number, intervals: model.PowerPlay[]) => {
    const expected = intervals.filter((pp) => pp.teamId === ppTeamId);
    for (const team of [game.home, game.away]) {
      const cls = team.id === ppTeamId ? styles.ppBand : styles.pkBand;
      const teamTracks = tracks(team.abbrev).querySelectorAll(`.${styles.track}`);
      expect(teamTracks.length).toBeGreaterThan(0);
      for (const track of teamTracks) {
        const drawn = track.querySelectorAll<HTMLElement>(`.${cls}`);
        expect(drawn).toHaveLength(expected.length);
        expected.forEach((pp, i) => {
          expect(drawn[i].style.left).toBe(`${(pp.start / game.axisDuration) * 100}%`);
          expect(drawn[i].style.width).toBe(`${((pp.end - pp.start) / game.axisDuration) * 100}%`);
        });
      }
    }
  };
  const renderReplay = (game: model.Game) => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Replay game={game} mode="pp-toi" onModeChanged={() => {}} selection={<div />} />);
  };

  it("2026020131 NSH: exact P1 08:11–10:11 on every PP and complementary PK track, with the verified share visible", async () => {
    const game = storedFixtureGame(2026020131);
    expect(model.ppBandSecondsByTeam(game)[18]).toBe(29);
    const intervals = [{ teamId: 18, start: 491, end: 611 }];
    expect(game.qualifiedPowerPlays?.filter((pp) => pp.teamId === 18)).toEqual(intervals);
    serve({ servingEnabled: true, clocks: [clockRow(2026020131, 18, "available", 120), clockRow(2026020131, 19, "available", 578)] });
    renderReplay(game);
    await vi.waitFor(() => expectTeamBands(game, 18, intervals));
    expect(screen.queryByText(/PP timeline unavailable/)).toBeNull();
    // The verified PP share stays visible: team 18's PP-mode grid (PP1 92.0% / PP2 8.0% of the 120 s clock).
    const matrices = within(screen.getByLabelText("Linemate matrices"));
    expect(matrices.getByText("Team 18")).toBeTruthy();
    expect(matrices.getAllByText("92.0%").length).toBeGreaterThan(0);
    expect(matrices.queryByText(/^Team 18:/)).toBeNull();
  });

  it("2026020131 STL: all five intervals unchanged on every PP and complementary PK track", async () => {
    const game = storedFixtureGame(2026020131);
    expect(model.ppBandSecondsByTeam(game)[19]).toBe(578);
    serve({ servingEnabled: true, clocks: [clockRow(2026020131, 18, "available", 120), clockRow(2026020131, 19, "available", 578)] });
    renderReplay(game);
    await vi.waitFor(() => expect(firstTrackBands("T19", "ppBand")).toBe(5));
    expect(screen.queryByLabelText(/^T19: PP timeline/)).toBeNull();
    // Every team-19 power play is drawn on each track: as PP for T19, as PK for T18.
    expect(firstTrackBands("T19", "ppBand")).toBe(teamPowerPlays(game, 19));
    expect(firstTrackBands("T18", "pkBand")).toBe(teamPowerPlays(game, 19));
    const intervals = [[1170, 1290], [1558, 1656], [2261, 2381], [2646, 2766], [3248, 3368]]
      .map(([start, end]) => ({ teamId: 19, start, end }));
    expect(game.qualifiedPowerPlays?.filter((pp) => pp.teamId === 19)).toEqual(intervals);
    expect(game.powerPlays.filter((pp) => pp.teamId === 19)).toEqual(intervals);
    expectTeamBands(game, 19, intervals);
  });

  it("3. 2026020038 t55 (no power play): N/A, no shading, never 0%", async () => {
    const game = storedFixtureGame(2026020038);
    expect(model.ppBandSecondsByTeam(game)).toEqual({ 55: 0, 20: 172 });
    serve({ servingEnabled: true, clocks: [clockRow(2026020038, 55, "not_applicable", 0), clockRow(2026020038, 20, "available", 172)] });
    renderReplay(game);
    expect(await screen.findByText("Team 55: N/A: no power play in this game.")).toBeTruthy();
    expect(screen.queryByText(/PP timeline unavailable/)).toBeNull();
    expect(bands("T55", "ppBand")).toHaveLength(0);
    expect(bands("T20", "pkBand")).toHaveLength(0);
    expect(firstTrackBands("T20", "ppBand")).toBe(teamPowerPlays(game, 20));
    expect(screen.queryByText("0.0%")).toBeNull();
  });

  it("4. serving off: today's output, bands included (pinned)", async () => {
    const game = storedFixtureGame(2026020131);
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ servingEnabled: false, clocks: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    renderReplay(game);
    await vi.waitFor(() => expect(firstTrackBands("T18", "ppBand")).toBe(teamPowerPlays(game, 18)));
    expect(firstTrackBands("T19", "ppBand")).toBe(teamPowerPlays(game, 19));
    expect(firstTrackBands("T18", "pkBand")).toBe(teamPowerPlays(game, 19));
    expect(screen.queryByText(/PP timeline unavailable/)).toBeNull();
    // Today's team-18 band is the 29 s parser band, drawn as today.
    const t18 = game.powerPlays.filter((pp) => pp.teamId === 18);
    expect(t18.reduce((n, pp) => n + pp.end - pp.start, 0)).toBe(29);
    expectTeamBands(game, 18, game.powerPlays);
    expectTeamBands(game, 19, game.powerPlays);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", "available", 120, "No stored PP clock for this team-game yet."],
    ["unavailable", "unavailable", null, "The stored PP clock for this team-game is not usable."],
    ["mismatch", "available", 119, "timing mismatch."],
    ["false zero", "not_applicable", 0, "timing mismatch."],
  ])("%s stored clock: no affected PP or PK bands, other team's intervals remain", async (caseName, availability, seconds, reason) => {
    const game = storedFixtureGame(2026020131);
    const clocks = [clockRow(game.id, 19, "available", 578)];
    if (caseName !== "missing") clocks.push(clockRow(game.id, 18, availability as string, seconds as number | null));
    serve({ servingEnabled: true, clocks });
    renderReplay(game);
    expect(await screen.findByLabelText(`T18: PP timeline unavailable: ${reason}`)).toBeTruthy();
    expectTeamBands(game, 18, []);
    expectTeamBands(game, 19, game.qualifiedPowerPlays!);
  });

  it.each([2026020131, 2026020038])("%s: missing local intervals fail closed, including a stored qualified zero", async (gameId) => {
    const game = { ...storedFixtureGame(gameId), qualifiedPowerPlays: null };
    const clocks = gameId === 2026020131
      ? [clockRow(gameId, 18, "available", 120), clockRow(gameId, 19, "available", 578)]
      : [clockRow(gameId, 55, "not_applicable", 0), clockRow(gameId, 20, "available", 172)];
    serve({ servingEnabled: true, clocks });
    renderReplay(game);
    expect(await screen.findByLabelText(`${game.home.abbrev}: PP timeline unavailable: no qualified local intervals.`)).toBeTruthy();
    expectTeamBands(game, game.home.id, []);
    expectTeamBands(game, game.away.id, []);
  });

  it("withholds all PP and PK bands while the stored clock is loading or cannot be loaded", async () => {
    const game = storedFixtureGame(2026020131);
    let reject: (error: Error) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, fail) => { reject = fail; })));
    renderReplay(game);
    expectTeamBands(game, 18, []);
    expectTeamBands(game, 19, []);
    await act(async () => reject(new Error("Clock unavailable")));
    expect(await screen.findByLabelText("T18: PP timeline unavailable: the stored PP clock couldn't be loaded.")).toBeTruthy();
    expectTeamBands(game, 18, []);
    expectTeamBands(game, 19, []);
  });

  it("renders event-derived OT intervals on the same absolute clock for PP and PK", async () => {
    // The existing replay-model OT rule fixture: derive intervals from penalty/goal events, not a stored total.
    const f = gameFixture();
    f.box.periodDescriptor = { number: 4, periodType: "OT" };
    f.box.clock.secondsRemaining = 200;
    f.shifts.data.push({ ...f.shifts.data[0], period: 4, startTime: "00:00", endTime: "01:40" });
    f.pbp.plays.push(
      { eventId: 4, typeDescKey: "penalty", timeInPeriod: "00:10", periodDescriptor: { number: 4, periodType: "OT" },
        details: { eventOwnerTeamId: 21, committedByPlayerId: 201, duration: 2, typeCode: "MIN" } },
      { eventId: 5, typeDescKey: "goal", timeInPeriod: "01:40", periodDescriptor: { number: 4, periodType: "OT" },
        details: { eventOwnerTeamId: 68, scoringPlayerId: 101 } },
    );
    const game = model.normalizeGame(f.box, f.shifts, f.pbp);
    expect(game.qualifiedPowerPlays).toEqual([{ teamId: 68, start: 3610, end: 3700 }]);
    expect(game.axisDuration).toBe(3900);
    serve({ servingEnabled: true, clocks: [clockRow(game.id, 68, "available", 90), clockRow(game.id, 21, "not_applicable", 0)] });
    renderReplay(game);
    await vi.waitFor(() => expectTeamBands(game, 68, game.qualifiedPowerPlays!));
    expect(screen.queryByText(/PP timeline unavailable/)).toBeNull();
  });
});
