import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
} from "lib/underlying-stats/playerStatsFilters";

import PlayerStatsFilters from "./PlayerStatsFilters";

describe("PlayerStatsFilters", () => {
  it("renders the primary dropdown controls and forwards canonical changes", () => {
    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    const onSeasonRangeChange = vi.fn();
    const onSeasonTypeChange = vi.fn();
    const onStrengthChange = vi.fn();
    const onScoreStateChange = vi.fn();
    const onModeChange = vi.fn();
    const onDisplayModeChange = vi.fn();

    render(
      <PlayerStatsFilters
        state={state}
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" },
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" },
        ]}
        onSeasonRangeChange={onSeasonRangeChange}
        onSeasonTypeChange={onSeasonTypeChange}
        onStrengthChange={onStrengthChange}
        onScoreStateChange={onScoreStateChange}
        onModeChange={onModeChange}
        onDisplayModeChange={onDisplayModeChange}
        onAdvancedOpenChange={vi.fn()}
        onTeamContextFilterChange={vi.fn()}
        onPositionGroupChange={vi.fn()}
        onVenueChange={vi.fn()}
        onMinimumToiChange={vi.fn()}
        onScopeChange={vi.fn()}
        onTradeModeChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("From Season"), {
      target: { value: "20242025" },
    });
    expect(onSeasonRangeChange).toHaveBeenCalledWith({
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    });

    fireEvent.change(screen.getByLabelText("Season Type"), {
      target: { value: "playoffs" },
    });
    expect(onSeasonTypeChange).toHaveBeenCalledWith("playoffs");

    fireEvent.change(screen.getByLabelText("Strength"), {
      target: { value: "powerPlay" },
    });
    expect(onStrengthChange).toHaveBeenCalledWith("powerPlay");

    fireEvent.change(screen.getByLabelText("Score State"), {
      target: { value: "withinOne" },
    });
    expect(onScoreStateChange).toHaveBeenCalledWith("withinOne");

    fireEvent.change(screen.getByLabelText("Stat Mode"), {
      target: { value: "goalies" },
    });
    expect(onModeChange).toHaveBeenCalledWith("goalies");

    fireEvent.change(screen.getByLabelText("Display Mode"), {
      target: { value: "rates" },
    });
    expect(onDisplayModeChange).toHaveBeenCalledWith("rates");
  });

  it("renders expandable filters and forwards advanced filter changes through one shared scope control", () => {
    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    const onAdvancedOpenChange = vi.fn();
    const onTeamContextFilterChange = vi.fn();
    const onPositionGroupChange = vi.fn();
    const onVenueChange = vi.fn();
    const onMinimumToiChange = vi.fn();
    const onScopeChange = vi.fn();
    const onTradeModeChange = vi.fn();

    render(
      <PlayerStatsFilters
        state={{
          ...state,
          expandable: {
            ...state.expandable,
            advancedOpen: true,
          },
        }}
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" },
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" },
        ]}
        onSeasonRangeChange={vi.fn()}
        onSeasonTypeChange={vi.fn()}
        onStrengthChange={vi.fn()}
        onScoreStateChange={vi.fn()}
        onModeChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onAdvancedOpenChange={onAdvancedOpenChange}
        onTeamContextFilterChange={onTeamContextFilterChange}
        onPositionGroupChange={onPositionGroupChange}
        onVenueChange={onVenueChange}
        onMinimumToiChange={onMinimumToiChange}
        onScopeChange={onScopeChange}
        onTradeModeChange={onTradeModeChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide advanced filters" }));
    expect(onAdvancedOpenChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "2" },
    });
    expect(onTeamContextFilterChange).toHaveBeenCalledWith(2);

    fireEvent.change(screen.getByLabelText("Position Group"), {
      target: { value: "centers" },
    });
    expect(onPositionGroupChange).toHaveBeenCalledWith("centers");

    fireEvent.change(screen.getByLabelText("Home or Away"), {
      target: { value: "away" },
    });
    expect(onVenueChange).toHaveBeenCalledWith("away");

    fireEvent.change(screen.getByLabelText("Minimum TOI"), {
      target: { value: "900" },
    });
    expect(onMinimumToiChange).toHaveBeenCalledWith(900);

    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: "gameRange" },
    });
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "gameRange",
      value: null,
    });

    fireEvent.change(screen.getByLabelText("Combine or Split"), {
      target: { value: "split" },
    });
    expect(onTradeModeChange).toHaveBeenCalledWith("split");
  });

  it("uses Against Specific Team semantics on the detail surface", () => {
    const state = createDefaultDetailFilterState({ currentSeasonId: 20252026 });
    const onTeamContextFilterChange = vi.fn();

    render(
      <PlayerStatsFilters
        state={{
          ...state,
          expandable: {
            ...state.expandable,
            advancedOpen: true,
          },
        }}
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" },
        ]}
        teamOptions={[
          { value: 6, label: "BOS · Boston Bruins" },
          { value: 14, label: "TBL · Tampa Bay Lightning" },
        ]}
        onSeasonRangeChange={vi.fn()}
        onSeasonTypeChange={vi.fn()}
        onStrengthChange={vi.fn()}
        onScoreStateChange={vi.fn()}
        onModeChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onAdvancedOpenChange={vi.fn()}
        onTeamContextFilterChange={onTeamContextFilterChange}
        onPositionGroupChange={vi.fn()}
        onVenueChange={vi.fn()}
        onMinimumToiChange={vi.fn()}
        onScopeChange={vi.fn()}
        onTradeModeChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Primary controls now drive the canonical detail filter state. Against Specific Team filters the selected player's rows by opponent team, not by the player's own team."
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Against Specific Team"), {
      target: { value: "14" },
    });
    expect(onTeamContextFilterChange).toHaveBeenCalledWith(14);
  });
});
