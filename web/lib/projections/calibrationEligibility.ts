export const FORGE_ROLLING_HISTORY_INPUT_CONTRACT =
  "full_selected_scope_through_end_date_v1";
export const FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT = "excluded_from_native_inputs_v1";

export type ForgeCalibrationEligibility = {
  eligible: boolean;
  observedContract: string | null;
  requiredContract: typeof FORGE_ROLLING_HISTORY_INPUT_CONTRACT;
  observedExternalFantasyContract: string | null;
  requiredExternalFantasyContract: typeof FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT;
  reason: "eligible" | "missing_or_legacy_rolling_history_contract"
    | "missing_or_legacy_external_fantasy_exclusion_contract";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function buildForgeInputProvenance() {
  return {
    rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
    external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
  } as const;
}

export function evaluateForgeCalibrationEligibility(
  metrics: unknown,
): ForgeCalibrationEligibility {
  const inputProvenance = asRecord(asRecord(metrics)?.input_provenance);
  const observedContract =
    typeof inputProvenance?.rolling_player_history_contract === "string"
      ? inputProvenance.rolling_player_history_contract
      : null;
  const observedExternalFantasyContract =
    typeof inputProvenance?.external_fantasy_input_contract === "string"
      ? inputProvenance.external_fantasy_input_contract
      : null;
  const reason = observedContract !== FORGE_ROLLING_HISTORY_INPUT_CONTRACT
    ? "missing_or_legacy_rolling_history_contract"
    : observedExternalFantasyContract !== FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT
      ? "missing_or_legacy_external_fantasy_exclusion_contract"
      : "eligible";

  return {
    eligible: reason === "eligible",
    observedContract,
    requiredContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
    observedExternalFantasyContract,
    requiredExternalFantasyContract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
    reason,
  };
}
