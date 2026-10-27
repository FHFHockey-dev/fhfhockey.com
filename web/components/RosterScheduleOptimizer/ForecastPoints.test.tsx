import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ForecastPoints from "./ForecastPoints";

afterEach(cleanup);

describe("ForecastPoints", () => {
  it("shows unavailable expected FP without a rank color", () => {
    render(<ForecastPoints goalie={false} points={{ expected: null, ifStarts: null }} tier="high" />);
    const value = screen.getByLabelText("Expected fantasy points: unavailable");
    expect(value.textContent).toBe("—");
    expect(value.getAttribute("data-tier")).toBeNull();
    expect(value.getAttribute("title")).toContain("weighted stat");
    expect(screen.queryByLabelText(/if starts/)).toBeNull();
  });

  it("labels expected and if-starts FP separately, with explicit semantics", () => {
    render(<ForecastPoints goalie points={{ expected: 2.31, ifStarts: 4.2 }} tier="mid" />);
    const expected = screen.getByLabelText("Expected fantasy points: 2.3");
    const conditional = screen.getByLabelText("Fantasy points if starts: 4.2");
    expect(expected.textContent).toBe("2.3 exp");
    expect(conditional.textContent).toBe("4.2 if GS");
    expect(expected.getAttribute("title")).toContain("including participation probability");
    expect(conditional.getAttribute("title")).toContain("conditional on starting");
    expect(conditional.getAttribute("data-tier")).toBeNull();
  });

  it("keeps genuine zero expected FP visible while conditional FP is unavailable", () => {
    render(<ForecastPoints goalie points={{ expected: 0, ifStarts: null }} tier="low" />);
    expect(screen.getByLabelText("Expected fantasy points: 0.0").textContent).toBe("0.0 exp");
    expect(screen.getByLabelText("Fantasy points if starts: unavailable").textContent).toBe("— if GS");
  });
});
