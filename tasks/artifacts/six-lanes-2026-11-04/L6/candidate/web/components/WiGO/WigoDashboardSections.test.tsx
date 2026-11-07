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
vi.mock("components/WiGO/PlayerRatingsDisplay", () => ({ default: () => null }));
vi.mock("components/WiGO/TeamPerformanceDrivers", () => ({ default: () => null }));
vi.mock("components/WiGO/OpponentGamelog", () => ({ default: () => null }));
vi.mock("components/WiGO/PerGameStatsTable", () => ({ default: () => null }));
vi.mock("components/WiGO/PlayerHeader", () => ({ default: () => null }));
afterEach(cleanup);

import { WigoOverviewSection, WigoPercentilesSection, WigoTrendsSection } from "./WigoDashboardSections";
import { defaultColors } from "./types";

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

describe("phone tab grouping (PLAN section 4)", () => {
  const coverage = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[data-coverage]")).flatMap((element) => element.dataset.coverage!.split(" "));

  it("shows each panel once across Overview, Trends and Percentiles", () => {
    const player = { id: 1, fullName: "Alex Fictional" } as any;
    const overview = coverage(render(<WigoOverviewSection selectedPlayer={player} headshotUrl={null} teamName="" teamAbbreviation="VAN"
      teamColors={defaultColors} teamIdForLog={23} currentSeasonId={20262027} minGp={10} />).container);
    cleanup();
    const trends = coverage(render(<WigoTrendsSection selectedPlayer={player} currentSeasonId={20262027} />).container);
    cleanup();
    const percentiles = coverage(render(<WigoPercentilesSection playerId={1} seasonId={20262027} minGp={10} onMinGpChange={() => {}}
      selectedPlayer={player} teamIdForLog={23} teamAbbreviation="VAN" />).container);
    expect(overview).toEqual(["C02", "C03", "C06"]);
    expect(trends).toEqual(["C14", "C16", "C17", "C18"]);
    expect(percentiles).toEqual(["C15", "C19", "C07", "C08", "C09", "C10", "C11"]);
  });
});
