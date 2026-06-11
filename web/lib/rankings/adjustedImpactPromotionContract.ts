export type AdjustedImpactPromotionStatus =
  | "diagnostic_live"
  | "blocked_missing_controls"
  | "rankings_promotable";

export type AdjustedImpactPromotionControlKey =
  | "teammate_opponent_on_ice"
  | "score_strength_shot_context"
  | "rest_days"
  | "zone_starts"
  | "defense_specific_target";

export type AdjustedImpactPromotionControl = {
  key: AdjustedImpactPromotionControlKey;
  label: string;
  status: "verified" | "available_not_joined" | "missing";
  source: string;
  requirement: string;
};

export const ADJUSTED_IMPACT_PROMOTION_CONTROLS: AdjustedImpactPromotionControl[] = [
  {
    key: "teammate_opponent_on_ice",
    label: "Teammate/opponent on-ice coefficients",
    status: "verified",
    source: "nhl_api_shift_rows via adjusted-impact design rows",
    requirement:
      "Every modeled shot must encode non-goalie skaters for and against from the shift stint at event time.",
  },
  {
    key: "score_strength_shot_context",
    label: "Score, strength, and shot-context controls",
    status: "verified",
    source: "nhl_xg_shot_features feature_payload and typed columns",
    requirement:
      "The model must control for strength state, exact manpower, score differential, shot zone, and game-clock context.",
  },
  {
    key: "rest_days",
    label: "Team rest/fatigue controls",
    status: "available_not_joined",
    source: "nhl_xg_team_game_travel_fatigue_features migration and builder",
    requirement:
      "Rest-day and fatigue rows must be installed live, populated, and joined into adjusted-impact design rows before promotion.",
  },
  {
    key: "zone_starts",
    label: "Zone-start controls",
    status: "available_not_joined",
    source: "nst_gamelog_5v5_counts_oi and nst_gamelog_5v5_rates_oi",
    requirement:
      "5v5 zone-start or faceoff context must be transformed into a player/team control that is compatible with the adjusted-impact model target.",
  },
  {
    key: "defense_specific_target",
    label: "Defense-specific target or decomposition",
    status: "missing",
    source: "not yet implemented",
    requirement:
      "A promoted Defense Rating replacement needs a defense-only adjusted target or documented offensive/defensive decomposition instead of raw overall on-ice xG differential.",
  },
] as const;

export const ADJUSTED_IMPACT_PROMOTION_CONTRACT = {
  currentStatus: "diagnostic_live" as AdjustedImpactPromotionStatus,
  liveOutputTables: [
    "nhl_xg_adjusted_impact_model_runs",
    "nhl_xg_adjusted_player_impacts",
  ],
  currentTargetFamily: "on_ice_xg_differential_v1",
  currentUse:
    "Live methodology/diagnostic source only; do not render as a rankings metric or replace contextual Defense Rating.",
  promotionGate:
    "Promote only after every required control is verified, the model-run provenance passes leakage and chronological held-out validation, and the user-facing label distinguishes adjusted overall impact from defense-only impact.",
  controls: ADJUSTED_IMPACT_PROMOTION_CONTROLS,
} as const;

export function evaluateAdjustedImpactPromotionReadiness(
  controls: readonly Pick<AdjustedImpactPromotionControl, "status">[]
): {
  status: AdjustedImpactPromotionStatus;
  missingControlCount: number;
  unjoinedControlCount: number;
} {
  const missingControlCount = controls.filter((control) => control.status === "missing").length;
  const unjoinedControlCount = controls.filter(
    (control) => control.status === "available_not_joined"
  ).length;

  if (missingControlCount === 0 && unjoinedControlCount === 0) {
    return {
      status: "rankings_promotable",
      missingControlCount,
      unjoinedControlCount,
    };
  }

  return {
    status: "blocked_missing_controls",
    missingControlCount,
    unjoinedControlCount,
  };
}
