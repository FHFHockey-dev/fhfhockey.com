export const FORGE_ROLLING_HISTORY_INPUT_CONTRACT =
  "full_selected_scope_through_end_date_v1";

export type ForgeCalibrationEligibility = {
  eligible: boolean;
  observedContract: string | null;
  requiredContract: typeof FORGE_ROLLING_HISTORY_INPUT_CONTRACT;
  reason: "eligible" | "missing_or_legacy_rolling_history_contract";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function buildForgeInputProvenance() {
  return {
    rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
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
  const eligible = observedContract === FORGE_ROLLING_HISTORY_INPUT_CONTRACT;

  return {
    eligible,
    observedContract,
    requiredContract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
    reason: eligible
      ? "eligible"
      : "missing_or_legacy_rolling_history_contract",
  };
}
