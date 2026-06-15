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

    expect(screen.getByRole("group", { name: "Ranking entity" })).toBeTruthy();

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

  it("emits shareable display mode changes for matrix cells", () => {
    const onChange = renderFilters();

    fireEvent.change(screen.getByLabelText("Display"), {
      target: { value: "raw_rank" },
    });

    expect(onChange).toHaveBeenCalledWith({ displayMode: "raw_rank" });
  });

  it("uses goalie-specific filter labels without exposing skater-only advanced filters", () => {
    const onChange = renderFilters(vi.fn(), {
      ...DEFAULT_RANKINGS_FILTERS,
      entity: "goalies",
      deployment: "all",
      minGp: "3",
      minToi: "100",
      team: "DAL",
    });

    const roleSelect = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(roleSelect.textContent).toContain("All Goalie Roles");
    expect(roleSelect.textContent).toContain("G1 Workhorse");
    expect(roleSelect.disabled).toBe(false);
    fireEvent.change(roleSelect, { target: { value: "g1_workhorse" } });
    expect(onChange).toHaveBeenCalledWith({
      goalieRole: "g1_workhorse",
      selectedGoalieId: "",
      page: "1",
    });
    expect((screen.getByLabelText("Min Starts") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("Min Shots") as HTMLInputElement).value).toBe("100");
    const teamInput = screen.getByLabelText("Team") as HTMLInputElement;
    expect(teamInput.value).toBe("DAL");
    expect(teamInput.inputMode).toBe("text");
    expect(teamInput.placeholder).toBe("Team code or name");
    fireEvent.change(teamInput, { target: { value: "NYR" } });
    expect(onChange).toHaveBeenCalledWith({ team: "NYR", page: "1" });
    expect(screen.queryByRole("button", { name: "More Filters" })).toBeNull();
    expect(screen.queryByLabelText("Min GP")).toBeNull();
  });

  it("keeps team rankings filters compact by hiding player-only controls", () => {
    renderFilters(vi.fn(), {
      ...DEFAULT_RANKINGS_FILTERS,
      entity: "teams",
    });

    expect(screen.queryByLabelText("Deployment")).toBeNull();
    expect(screen.queryByLabelText("Strength")).toBeNull();
    expect(screen.queryByLabelText("Min GP")).toBeNull();
    expect(screen.queryByLabelText("Team")).toBeNull();
    expect(screen.queryByRole("button", { name: "More Filters" })).toBeNull();
  });
});
