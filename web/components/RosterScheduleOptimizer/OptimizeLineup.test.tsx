import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OptimizeLineup from "./OptimizeLineup";

afterEach(cleanup);

describe("Optimize lineup timing prompt", () => {
  it("sets the league's add timing", () => {
    const setTiming = vi.fn();
    render(<OptimizeLineup readOnly={false} setTiming={setTiming} />);
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    fireEvent.click(screen.getByRole("button", { name: "Same day" }));
    expect(setTiming.mock.calls).toEqual([["next_day"], ["same_day"]]);
  });

  it("is read-only for a saved plan", () => {
    render(<OptimizeLineup readOnly setTiming={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next day" }).hasAttribute("disabled")).toBe(true);
  });
});
