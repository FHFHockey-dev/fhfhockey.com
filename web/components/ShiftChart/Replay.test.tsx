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

// Decision 152 (TJ: blocks the release): with PP share served, a team's timeline PP bands are drawn only when they
// reconcile with the stored qualified clock. Real stored-row fixtures (__tests__/ppShare/fixtures).
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
  const renderReplay = (game: model.Game) => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<Replay game={game} mode="pp-toi" onModeChanged={() => {}} selection={<div />} />);
  };

  it("1. 2026020131 t18 (bands 29 s, stored clock 120 s): bands withheld, label shown, the verified 120 s share visible", async () => {
    const game = storedFixtureGame(2026020131);
    expect(model.ppBandSecondsByTeam(game)[18]).toBe(29);
    serve({ servingEnabled: true, clocks: [clockRow(2026020131, 18, "available", 120), clockRow(2026020131, 19, "available", 578)] });
    renderReplay(game);
    expect(await screen.findByText("PP timeline unavailable: timing mismatch.")).toBeTruthy();
    expect(screen.getByLabelText("T18: PP timeline unavailable: timing mismatch.")).toBeTruthy();
    // No team-18 power play anywhere: not as PP on T18 tracks, not as PK on T19 tracks.
    expect(bands("T18", "ppBand")).toHaveLength(0);
    expect(bands("T19", "pkBand")).toHaveLength(0);
    // The verified PP share stays visible: team 18's PP-mode grid (PP1 92.0% / PP2 8.0% of the 120 s clock).
    const matrices = within(screen.getByLabelText("Linemate matrices"));
    expect(matrices.getByText("Team 18")).toBeTruthy();
    expect(matrices.getAllByText("92.0%").length).toBeGreaterThan(0);
    expect(matrices.queryByText(/^Team 18:/)).toBeNull();
  });

  it("2. 2026020131 t19 (bands 578 s = stored 578 s): drawn whole, unscaled, no label", async () => {
    const game = storedFixtureGame(2026020131);
    expect(model.ppBandSecondsByTeam(game)[19]).toBe(578);
    serve({ servingEnabled: true, clocks: [clockRow(2026020131, 18, "available", 120), clockRow(2026020131, 19, "available", 578)] });
    renderReplay(game);
    await screen.findByText("PP timeline unavailable: timing mismatch.");
    expect(screen.queryByLabelText(/^T19: PP timeline/)).toBeNull();
    // Every team-19 power play is drawn on each track: as PP for T19, as PK for T18.
    expect(firstTrackBands("T19", "ppBand")).toBe(teamPowerPlays(game, 19));
    expect(firstTrackBands("T18", "pkBand")).toBe(teamPowerPlays(game, 19));
    // Drawn at their own times and lengths: the first T19 band is exactly the first team-19 interval.
    const first = game.powerPlays.find((pp) => pp.teamId === 19)!;
    const style = (tracks("T19").querySelector(`.${styles.ppBand}`) as HTMLElement).style;
    expect(style.left).toBe(`${(first.start / game.axisDuration) * 100}%`);
    expect(style.width).toBe(`${((first.end - first.start) / game.axisDuration) * 100}%`);
  });

  it("3. 2026020038 t55 (no power play): N/A, no shading, never 0%", async () => {
    const game = storedFixtureGame(2026020038);
    expect(model.ppBandSecondsByTeam(game)).toEqual({ 55: 0, 20: 172 });
    serve({ servingEnabled: true, clocks: [clockRow(2026020038, 55, "not_applicable", 0), clockRow(2026020038, 20, "available", 172)] });
    renderReplay(game);
    expect(await screen.findByText("Team 55: N/A: no power play in this game.")).toBeTruthy();
    expect(screen.queryByText(/PP timeline unavailable/)).toBeNull();
    expect(bands("T55", "ppBand")).toHaveLength(0);
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
