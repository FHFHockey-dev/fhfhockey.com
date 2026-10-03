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
