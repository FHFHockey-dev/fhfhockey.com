import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Replay from "./Replay";
import * as model from "./model";
import { gameFixture } from "./testFixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("updates replay statistics without fetching or recalculating the full-game matrix", () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const fetchMock = vi.fn();
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
  expect(fetchMock).not.toHaveBeenCalled();
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
