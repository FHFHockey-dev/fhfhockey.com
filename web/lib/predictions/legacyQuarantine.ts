export type LegacyArtifactDisposition =
  | "quarantined"
  | "serving_only"
  | "remove_after_replacement";

export type LegacyPredictionArtifact = {
  id: string;
  paths: string[];
  disposition: LegacyArtifactDisposition;
  reason: string;
  promotionRequirement: string;
};

export const LEGACY_PREDICTION_ARTIFACTS: LegacyPredictionArtifact[] = [
  {
    id: "sko_predictions",
    paths: [
      "web/pages/api/v1/ml/update-predictions-sko.ts",
      "web/pages/api/v1/ml/get-predictions-sko.ts",
      "web/components/Predictions/PredictionsLeaderboard.tsx"
    ],
    disposition: "quarantined",
    reason:
      "sKO is not validated as a core FORGE/game-prediction model and lacks persisted feature importance and promotion metrics.",
    promotionRequirement:
      "Persist top_features, feature importances, freshness metadata, backtest metrics, and pass model-promotion gates."
  },
  {
    id: "legacy_projection_routes",
    paths: [
      "web/pages/api/v1/projections/players.ts",
      "web/pages/api/v1/projections/goalies.ts",
      "web/pages/api/v1/projections/teams.ts"
    ],
    disposition: "serving_only",
    reason:
      "Legacy projection API routes are compatibility wrappers over canonical FORGE routes.",
    promotionRequirement:
      "Do not add new model behavior here; route new behavior through `/api/v1/forge/*`."
  },
  {
    id: "current_lineup_sources",
    paths: [
      "web/lib/sources/lineupSourceIngestion.ts",
      "web/pages/api/v1/db/tweet-pattern-review.ts"
    ],
    disposition: "serving_only",
    reason:
      "Lineup/tweet sources are current-state prediction context and must not be used as historical training truth without coverage validation.",
    promotionRequirement:
      "Backfill dated coverage and prove no future leakage before using in historical model training."
  }
];

export function getLegacyPredictionArtifact(
  id: string
): LegacyPredictionArtifact | null {
  return LEGACY_PREDICTION_ARTIFACTS.find((artifact) => artifact.id === id) ?? null;
}
