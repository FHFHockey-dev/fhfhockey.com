import React, { useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const renders = vi.hoisted(() => ({ toi: 0 }));
// next/dynamic resolves to the mocked chart synchronously here.
vi.mock("next/dynamic", () => ({
  default: () => function DynamicChart() {
    renders.toi += 1;
    return <div data-testid="chart" />;
  }
}));
vi.mock("components/CategoryCoverageChart", () => ({ default: () => null }));
afterEach(cleanup);

import { WigoTrendsSection } from "./WigoDashboardSections";

describe("WigoTrendsSection memo", () => {
  it("does not re-render its charts when an unrelated page state such as the compare pair changes", () => {
    let setCompare: (value: string) => void = () => {};
    function Page() {
      const [compare, setCompareState] = useState("STD-CA");
      setCompare = setCompareState;
      return <div data-compare={compare}><WigoTrendsSection selectedPlayer={null} currentSeasonId={20262027} trendsOnly /></div>;
    }
    render(<Page />);
    const afterFirstPaint = renders.toi;
    expect(afterFirstPaint).toBeGreaterThan(0);
    act(() => setCompare("L5-L20"));
    expect(renders.toi).toBe(afterFirstPaint);
  });
});
