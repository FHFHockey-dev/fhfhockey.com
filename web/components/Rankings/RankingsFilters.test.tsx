import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RANKINGS_FILTERS,
  type RankingsFilterState,
} from "lib/rankings/rankingUrlState";

import RankingsFilters from "./RankingsFilters";

afterEach(() => {
  cleanup();
});

const groups = [
  { key: "offense", label: "Offense", description: "Offense" },
  {
    key: "defense_on_ice",
    label: "Defense / On-Ice",
    description: "Defense",
  },
] as const;

const columns = [
  {
    metricKey: "points_per_60",
    groupKey: "offense",
    shortLabel: "P/60",
    fullLabel: "Points/60",
    tooltip: "Points",
    defaultVisible: true,
    playerTypes: ["skater"],
    definition: undefined,
    availabilityState: "available",
    lowerIsBetter: false,
    sourceQualityFlags: [],
    denominatorKey: "toi_seconds",
    denominatorDescription: "TOI seconds",
    methodologyVersion: "contextual_rankings_v1",
  },
  {
    metricKey: "xga_per_60",
    groupKey: "defense_on_ice",
    shortLabel: "xGA/60",
    fullLabel: "xGA/60",
    tooltip: "xGA",
    defaultVisible: true,
    playerTypes: ["skater"],
    definition: undefined,
    availabilityState: "available",
    lowerIsBetter: true,
    sourceQualityFlags: ["context_influenced_unadjusted_on_ice"],
    denominatorKey: "toi_seconds",
    denominatorDescription: "TOI seconds",
    methodologyVersion: "contextual_rankings_v1",
  },
] as const;

function renderFilters(
  onChange = vi.fn(),
  value: RankingsFilterState = DEFAULT_RANKINGS_FILTERS,
) {
  render(
    <RankingsFilters
      value={value}
      onChange={onChange}
      showMetric={false}
      matrixMetricGroups={groups}
      matrixMetricColumns={columns}
    />,
  );
  return onChange;
}

describe("RankingsFilters", () => {
  it("opens More Filters and emits advanced filter patches", () => {
    const onChange = renderFilters();

    fireEvent.click(screen.getByRole("button", { name: "More Filters" }));
    const dialog = screen.getByRole("dialog", { name: "More ranking filters" });

    fireEvent.change(within(dialog).getByLabelText("Sample"), {
      target: { value: "medium_plus" },
    });
    expect(onChange).toHaveBeenCalledWith({
      sampleConfidence: "medium_plus",
      page: "1",
    });

    fireEvent.change(within(dialog).getByLabelText("Source Quality"), {
      target: { value: "clean_only" },
    });
    expect(onChange).toHaveBeenCalledWith({ sourceQuality: "clean_only" });

    fireEvent.click(within(dialog).getByLabelText("Defense / On-Ice"));
    expect(onChange).toHaveBeenCalledWith({ metricGroups: "offense" });

    fireEvent.click(within(dialog).getByLabelText("xGA/60"));
    expect(onChange).toHaveBeenCalledWith({ metricColumns: "points_per_60" });
  });
});
