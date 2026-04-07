import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState
} from "lib/underlying-stats/playerStatsFilters";
import { createDefaultGoalieLandingFilterState } from "lib/underlying-stats/goalieStatsQueries";

import PlayerStatsFilters from "./PlayerStatsFilters";

afterEach(() => {
  cleanup();
});

describe("PlayerStatsFilters", () => {
  it("renders the primary dropdown controls and forwards canonical changes", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026
    });
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
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
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
      target: { value: "20242025" }
    });
    expect(onSeasonRangeChange).toHaveBeenCalledWith({
      fromSeasonId: 20242025,
      throughSeasonId: 20252026
    });

    fireEvent.change(screen.getByLabelText("Season Type"), {
      target: { value: "playoffs" }
    });
    expect(onSeasonTypeChange).toHaveBeenCalledWith("playoffs");

    fireEvent.change(screen.getByLabelText("Strength"), {
      target: { value: "powerPlay" }
    });
    expect(onStrengthChange).toHaveBeenCalledWith("powerPlay");

    fireEvent.change(screen.getByLabelText("Score State"), {
      target: { value: "withinOne" }
    });
    expect(onScoreStateChange).toHaveBeenCalledWith("withinOne");

    fireEvent.change(screen.getByLabelText("Stat Mode"), {
      target: { value: "goalies" }
    });
    expect(onModeChange).toHaveBeenCalledWith("goalies");

    fireEvent.change(screen.getByLabelText("Display Mode"), {
      target: { value: "rates" }
    });
    expect(onDisplayModeChange).toHaveBeenCalledWith("rates");
  });

  it("renders expandable filters and forwards advanced filter changes through one shared scope control", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026
    });
    const onAdvancedOpenChange = vi.fn();
    const onTeamContextFilterChange = vi.fn();
    const onPositionGroupChange = vi.fn();
    const onVenueChange = vi.fn();
    const onMinimumToiChange = vi.fn();
    const onScopeChange = vi.fn();
    const onTradeModeChange = vi.fn();

    const view = render(
      <PlayerStatsFilters
        state={{
          ...state,
          expandable: {
            ...state.expandable,
            advancedOpen: true
          }
        }}
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
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

    fireEvent.click(
      screen.getByRole("button", { name: "Hide advanced filters" })
    );
    expect(onAdvancedOpenChange).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "2" }
    });
    expect(onTeamContextFilterChange).toHaveBeenCalledWith(2);

    fireEvent.change(screen.getByLabelText("Position Group"), {
      target: { value: "centers" }
    });
    expect(onPositionGroupChange).toHaveBeenCalledWith("centers");

    fireEvent.change(screen.getByLabelText("Home or Away"), {
      target: { value: "away" }
    });
    expect(onVenueChange).toHaveBeenCalledWith("away");

    fireEvent.change(screen.getByLabelText("Minimum TOI"), {
      target: { value: "900" }
    });
    expect(onMinimumToiChange).toHaveBeenCalledWith(900);

    fireEvent.change(
      within(view.container).getByPlaceholderText("Last X player games"),
      {
        target: { value: "12" }
      }
    );
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "gameRange",
      value: 12
    });

    fireEvent.change(screen.getByLabelText("Combine or Split"), {
      target: { value: "split" }
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
            advancedOpen: true
          }
        }}
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 6, label: "BOS · Boston Bruins" },
          { value: 14, label: "TBL · Tampa Bay Lightning" }
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
      screen.getByText("Primary controls drive the canonical detail query.")
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Against Specific Team"), {
      target: { value: "14" }
    });
    expect(onTeamContextFilterChange).toHaveBeenCalledWith(14);
  });

  it("exposes the goalie primary controls without the mode switch and forwards their changes", () => {
    const state = createDefaultGoalieLandingFilterState({
      currentSeasonId: 20252026
    });
    const onSeasonRangeChange = vi.fn();
    const onSeasonTypeChange = vi.fn();
    const onStrengthChange = vi.fn();
    const onScoreStateChange = vi.fn();
    const onDisplayModeChange = vi.fn();

    render(
      <PlayerStatsFilters
        state={state}
        surfaceLabel="Goalie stats"
        hideModeControl
        hidePositionGroupControl
        hideTradeModeControl
        gameRangeLabel="# of Goalie GP"
        gameRangePlaceholder="Last X goalie appearances"
        minimumToiLabel="Minimum TOI (seconds)"
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
        ]}
        onSeasonRangeChange={onSeasonRangeChange}
        onSeasonTypeChange={onSeasonTypeChange}
        onStrengthChange={onStrengthChange}
        onScoreStateChange={onScoreStateChange}
        onModeChange={vi.fn()}
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

    expect(screen.queryByLabelText("Stat Mode")).toBeNull();

    fireEvent.change(screen.getByLabelText("From Season"), {
      target: { value: "20242025" }
    });
    expect(onSeasonRangeChange).toHaveBeenCalledWith({
      fromSeasonId: 20242025,
      throughSeasonId: 20252026
    });

    fireEvent.change(screen.getByLabelText("Season Type"), {
      target: { value: "playoffs" }
    });
    expect(onSeasonTypeChange).toHaveBeenCalledWith("playoffs");

    fireEvent.change(screen.getByLabelText("Strength"), {
      target: { value: "powerPlay" }
    });
    expect(onStrengthChange).toHaveBeenCalledWith("powerPlay");

    fireEvent.change(screen.getByLabelText("Score State"), {
      target: { value: "withinOne" }
    });
    expect(onScoreStateChange).toHaveBeenCalledWith("withinOne");

    fireEvent.change(screen.getByLabelText("Display Mode"), {
      target: { value: "rates" }
    });
    expect(onDisplayModeChange).toHaveBeenCalledWith("rates");
  });

  it("exposes goalie advanced filters and forwards team, venue, minimum TOI, game range, and team-game range changes", () => {
    const state = createDefaultGoalieLandingFilterState({
      currentSeasonId: 20252026
    });
    const onTeamContextFilterChange = vi.fn();
    const onVenueChange = vi.fn();
    const onMinimumToiChange = vi.fn();
    const onScopeChange = vi.fn();

    const view = render(
      <PlayerStatsFilters
        state={{
          ...state,
          expandable: {
            ...state.expandable,
            advancedOpen: true
          }
        }}
        surfaceLabel="Goalie stats"
        hideModeControl
        hidePositionGroupControl
        hideTradeModeControl
        gameRangeLabel="# of Goalie GP"
        gameRangePlaceholder="Last X goalie appearances"
        minimumToiLabel="Minimum TOI (seconds)"
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
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
        onVenueChange={onVenueChange}
        onMinimumToiChange={onMinimumToiChange}
        onScopeChange={onScopeChange}
        onTradeModeChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Team")).toBeTruthy();
    expect(screen.getByLabelText("Home or Away")).toBeTruthy();
    expect(screen.getByLabelText("Minimum TOI (seconds)")).toBeTruthy();
    expect(screen.getByLabelText("# of Goalie GP")).toBeTruthy();
    expect(screen.getByLabelText("# of Team GP")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "2" }
    });
    expect(onTeamContextFilterChange).toHaveBeenCalledWith(2);

    fireEvent.change(screen.getByLabelText("Home or Away"), {
      target: { value: "away" }
    });
    expect(onVenueChange).toHaveBeenCalledWith("away");

    fireEvent.change(screen.getByLabelText("Minimum TOI (seconds)"), {
      target: { value: "900" }
    });
    expect(onMinimumToiChange).toHaveBeenCalledWith(900);

    fireEvent.change(
      within(view.container).getByPlaceholderText("Last X goalie appearances"),
      {
        target: { value: "12" }
      }
    );
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "gameRange",
      value: 12
    });

    fireEvent.change(screen.getByLabelText("# of Team GP"), {
      target: { value: "5" }
    });
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "byTeamGames",
      value: 5
    });
  });

  it("forwards goalie date-range changes through the shared scope control", () => {
    const baseState = createDefaultGoalieLandingFilterState({
      currentSeasonId: 20252026
    });
    const onScopeChange = vi.fn();

    const { rerender } = render(
      <PlayerStatsFilters
        state={{
          ...baseState,
          expandable: {
            ...baseState.expandable,
            advancedOpen: true
          }
        }}
        surfaceLabel="Goalie stats"
        hideModeControl
        hidePositionGroupControl
        hideTradeModeControl
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
        ]}
        onSeasonRangeChange={vi.fn()}
        onSeasonTypeChange={vi.fn()}
        onStrengthChange={vi.fn()}
        onScoreStateChange={vi.fn()}
        onModeChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onAdvancedOpenChange={vi.fn()}
        onTeamContextFilterChange={vi.fn()}
        onPositionGroupChange={vi.fn()}
        onVenueChange={vi.fn()}
        onMinimumToiChange={vi.fn()}
        onScopeChange={onScopeChange}
        onTradeModeChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("From Date"), {
      target: { value: "2025-11-01" }
    });
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: null
    });

    rerender(
      <PlayerStatsFilters
        state={{
          ...baseState,
          expandable: {
            ...baseState.expandable,
            advancedOpen: true,
            scope: {
              kind: "dateRange",
              startDate: "2025-11-01",
              endDate: null
            }
          }
        }}
        surfaceLabel="Goalie stats"
        hideModeControl
        hidePositionGroupControl
        hideTradeModeControl
        seasonOptions={[
          { value: 20252026, label: "2025-26" },
          { value: 20242025, label: "2024-25" }
        ]}
        teamOptions={[
          { value: 1, label: "NJD · New Jersey Devils" },
          { value: 2, label: "NYI · New York Islanders" }
        ]}
        onSeasonRangeChange={vi.fn()}
        onSeasonTypeChange={vi.fn()}
        onStrengthChange={vi.fn()}
        onScoreStateChange={vi.fn()}
        onModeChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        onAdvancedOpenChange={vi.fn()}
        onTeamContextFilterChange={vi.fn()}
        onPositionGroupChange={vi.fn()}
        onVenueChange={vi.fn()}
        onMinimumToiChange={vi.fn()}
        onScopeChange={onScopeChange}
        onTradeModeChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Through Date"), {
      target: { value: "2026-02-01" }
    });
    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "dateRange",
      startDate: "2025-11-01",
      endDate: "2026-02-01"
    });
  });
});
