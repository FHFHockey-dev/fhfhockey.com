import { describe, expect, it } from "vitest";

import {
  CANONICAL_ROLLING_WINDOW_CONTRACTS,
  getRollingWindowContractForMetric,
  ROLLING_METRIC_WINDOW_FAMILIES
} from "./rollingWindowContract";

describe("rollingWindowContract", () => {
  it("defines the canonical lastN contract for each metric family class", () => {
    expect(CANONICAL_ROLLING_WINDOW_CONTRACTS.availability).toEqual({
      family: "availability",
      selectionUnit: "current_team_chronological_team_games",
      aggregationMethod: "availability_ratio_from_selected_team_games",
      missingComponentPolicy: {
        selectedWindowSlotBehavior: "selected_slot_always_counts",
        missingNumeratorBehavior: "not_applicable",
        missingDenominatorBehavior: "not_applicable"
      },
      contractSummary: "Last N means the current team's last N chronological team games."
    });
    expect(CANONICAL_ROLLING_WINDOW_CONTRACTS.additive_performance).toEqual({
      family: "additive_performance",
      selectionUnit: "chronological_appearances_in_strength_state",
      aggregationMethod: "sum_and_mean_over_selected_appearances",
      missingComponentPolicy: {
        selectedWindowSlotBehavior: "selected_slot_counts_only_with_defined_value",
        missingNumeratorBehavior: "not_applicable",
        missingDenominatorBehavior: "not_applicable"
      },
      contractSummary:
        "Last N means the player's last N chronological appearances in the relevant strength state."
    });
    expect(CANONICAL_ROLLING_WINDOW_CONTRACTS.ratio_performance).toEqual({
      family: "ratio_performance",
      selectionUnit: "chronological_appearances_in_strength_state",
      aggregationMethod: "ratio_of_aggregated_components_over_selected_appearances",
      missingComponentPolicy: {
        selectedWindowSlotBehavior: "selected_slot_always_counts",
        missingNumeratorBehavior: "coerce_to_zero_when_denominator_present",
        missingDenominatorBehavior: "exclude_components_but_keep_selected_slot"
      },
      contractSummary:
        "Last N means the player's last N chronological appearances in the relevant strength state, then aggregate numerator and denominator components inside that fixed appearance window."
    });
    expect(
      CANONICAL_ROLLING_WINDOW_CONTRACTS.weighted_rate_performance
    ).toEqual({
      family: "weighted_rate_performance",
      selectionUnit: "chronological_appearances_in_strength_state",
      aggregationMethod:
        "weighted_rate_from_aggregated_components_over_selected_appearances",
      missingComponentPolicy: {
        selectedWindowSlotBehavior: "selected_slot_always_counts",
        missingNumeratorBehavior: "coerce_to_zero_when_denominator_present",
        missingDenominatorBehavior: "exclude_components_but_keep_selected_slot"
      },
      contractSummary:
        "Last N means the player's last N chronological appearances in the relevant strength state, then aggregate the raw event and TOI components inside that fixed appearance window."
    });
  });

  it("classifies every current rolling metric under an explicit canonical family", () => {
    expect(ROLLING_METRIC_WINDOW_FAMILIES.sog_per_60).toBe(
      "weighted_rate_performance"
    );
    expect(ROLLING_METRIC_WINDOW_FAMILIES.ixg).toBe("additive_performance");
    expect(ROLLING_METRIC_WINDOW_FAMILIES.shooting_pct).toBe(
      "ratio_performance"
    );
    expect(getRollingWindowContractForMetric("pp_share_pct")).toBe(
      CANONICAL_ROLLING_WINDOW_CONTRACTS.ratio_performance
    );
    expect(getRollingWindowContractForMetric("points")).toBe(
      CANONICAL_ROLLING_WINDOW_CONTRACTS.additive_performance
    );
  });
});
