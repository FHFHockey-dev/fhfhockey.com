export const PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION =
  "player-forecasts-research-v1";
export const PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256 =
  "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574";
export const PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION =
  "player-forecasts-research-v2-validation";
export const PLAYER_FORECAST_VALIDATION_CONTRACT_SHA256 =
  "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed";
export const PLAYER_FORECAST_APPROVED_CONTRACTS: Readonly<Record<string, string>> = {
  [PLAYER_FORECAST_RESEARCH_CONTRACT_VERSION]: PLAYER_FORECAST_RESEARCH_CONTRACT_SHA256,
  [PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION]: PLAYER_FORECAST_VALIDATION_CONTRACT_SHA256,
};
export const PLAYER_FORECAST_SCORING_VERSION = "player-forecast-skill-v1";

export function playerForecastResearchGate(environment: Record<string, string | undefined> = process.env): {
  contractApproved: true;
  inferenceEnabled: boolean;
  status: "approved_contract_only" | "approved_inference_enabled";
} {
  const inferenceEnabled =
    environment.PLAYER_FORECAST_ENABLE_INFERENCE?.trim().toLowerCase() === "true";
  return {
    contractApproved: true,
    inferenceEnabled,
    status: inferenceEnabled
      ? "approved_inference_enabled"
      : "approved_contract_only",
  };
}
