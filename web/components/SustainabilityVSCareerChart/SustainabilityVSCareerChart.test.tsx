import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// BC W1-9 D12: /charts colours follow the sample-aware career usual range.

const { recent, career } = vi.hoisted(() => ({
  recent: { current: undefined as any },
  career: { current: undefined as any }
}));

vi.mock("hooks/useSustainabilityStats", () => ({
  default: () => ({ stats: recent.current, loading: false })
}));
vi.mock("hooks/useCareerAveragesStats", () => ({
  default: () => ({ stats: career.current, loading: false })
}));
vi.mock("hooks/useScreenSize", () => ({
  default: () => ({ screen: "l" }),
  BreakPoint: { l: "l" }
}));

import SustainabilityVSCareerChart from "./SustainabilityVSCareerChart";

function rowFor(label: string) {
  const labelNode = screen.getByText(label, { selector: "span" });
  const row = labelNode.parentElement as HTMLElement;
  return {
    row,
    swatch: row.firstElementChild as HTMLElement
  };
}

describe("SustainabilityVSCareerChart", () => {
  afterEach(cleanup);

  it("colours by the usual range for the window's sample, not a fixed gap", () => {
    recent.current = {
      "S%": 0.2,
      "xS%": null,
      "SOG/60": 2,
      components: {
        // Doubled S% on 10 shots: within range (the old +2-point rule: red).
        "S%": { numerator: 2, denominator: 10 },
        "SOG/60": { numerator: 2, denominator: 60 },
        "xS%": { numerator: 1.5, denominator: null }
      }
    };
    career.current = {
      "S%": 0.1,
      "xS%": 0.06,
      "SOG/60": 10,
      components: {
        "S%": { numerator: 100, denominator: 1000 },
        "SOG/60": { numerator: 2400, denominator: 14_400 },
        "xS%": { numerator: 90, denominator: 1500 }
      }
    };

    render(<SustainabilityVSCareerChart playerId={1} timeOption={"L7" as any} />);

    expect(rowFor("S%").swatch.style.backgroundColor).toBe("rgb(7, 170, 227)");
    expect(rowFor("SOG/60").swatch.style.backgroundColor).toBe("rgb(246, 91, 97)");
    const xs = rowFor("xS%");
    expect(xs.swatch.style.backgroundColor).toBe("rgb(167, 180, 192)");
    expect(xs.row.getAttribute("title")).toBe(
      "Expected shooting percentage: ixG ÷ unblocked attempts (iFF) × 100 (insufficient sample to compare)"
    );
    expect(screen.queryByText(/XG Per Sixty/)).toBeNull();
  });
});
