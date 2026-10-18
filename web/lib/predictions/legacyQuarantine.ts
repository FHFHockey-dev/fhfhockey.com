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
  /** Owner decision that keeps these files as lineage only (no restoration, no deletion). */
  historicalOnly?: { decidedAt: string; record: string };
};

const SKO_HISTORICAL_ONLY = {
  decidedAt: "2026-07-28",
  record: "tasks/TASKS/sko-charts/sko-ownership-contract.md"
};

export const LEGACY_PREDICTION_ARTIFACTS: LegacyPredictionArtifact[] = [
  {
    id: "sko_predictions",
    paths: [
      "web/pages/api/v1/ml/update-predictions-sko.ts",
      "web/pages/api/v1/ml/get-predictions-sko.ts",
      "web/lib/ml/predictionsSkoDependencyChecks.ts",
      "web/lib/ml/predictionsSkoRunControl.ts"
    ],
    disposition: "quarantined",
    reason:
      "sKO is not validated as a core FORGE/game-prediction model and lacks persisted feature importance and promotion metrics. The writer and read API remain compatibility-only.",
    promotionRequirement:
      "Persist top_features, feature importances, freshness metadata, backtest metrics, and pass model-promotion gates."
  },
  {
    id: "sko_reader_ui_bundle",
    paths: [
      "web/lib/hooks/useQuarantinedPredictionsSko.ts",
      "web/components/Predictions/PredictionsLeaderboard.tsx",
      "web/components/Predictions/InfoPopover.tsx",
      "web/components/Predictions/SkoExplainer.tsx",
      "web/components/Predictions/MetricCards.tsx",
      "web/components/Predictions/PlayerTable.tsx",
      "web/components/Predictions/PredictionsHeader.tsx",
      "web/components/Predictions/SearchBox.tsx",
      "web/components/Predictions/Sparkline.tsx",
      "web/components/Predictions/Stepper.tsx",
      "web/components/Predictions/Predictions.module.scss",
      "web/lib/trends/skoTypes.ts",
      "web/lib/trends/skoUtils.ts"
    ],
    disposition: "quarantined",
    reason:
      "Orphaned sKO prediction reader/UI bundle. No supported page mounts it; it reads only through the quarantined API.",
    promotionRequirement:
      "Deliberate reintegration under a promoted sKO contract, or checkpointed removal; never mount it as current FORGE output.",
    historicalOnly: SKO_HISTORICAL_ONLY
  },
  {
    id: "sko_legacy_formula_family",
    paths: [
      "web/lib/supabase/utils/calculations.ts",
      "web/lib/supabase/utils/statistics.ts",
      "web/lib/supabase/utils/dataFetching.ts",
      "web/lib/supabase/utils/types.ts",
      "web/lib/supabase/utils/constants.ts",
      "web/components/GameScoreChart/GameScoreChart.tsx",
      "web/components/GameScoreChart/GameLogTable.tsx",
      "web/components/SkoLineChart/LineChart.tsx"
    ],
    disposition: "quarantined",
    reason:
      "Legacy GameScore, capped weighted-squared-z characteristic value and its charts. Lineage only; failed the pass-4 FORGE audit.",
    promotionRequirement:
      "Re-derive and validate before any product reuse; do not label it current production behavior.",
    historicalOnly: SKO_HISTORICAL_ONLY
  },
  {
    id: "sko_charts_route",
    paths: ["web/pages/skoCharts.tsx"],
    disposition: "quarantined",
    reason: "Static noindex quarantine notice kept for lineage; it runs no sKO calculation or data join.",
    promotionRequirement:
      "Remove or redirect only through a checkpointed burn-down or route decision.",
    historicalOnly: SKO_HISTORICAL_ONLY
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

/**
 * sKO-named files that are deliberately outside the quarantine registry. Every other file whose
 * path names sKO, or whose header says "Legacy sKO-only", must be registered above.
 */
export const SKO_NAMED_NON_QUARANTINE_PATHS: Record<string, string> = {
  "web/pages/api/v1/db/update-sko-stats.ts": "Operational legacy source writer for sko_skater_stats (ownership contract, Phase 2).",
  "web/lib/supabase/Upserts/fetchSKOskaterStats.js": "Legacy manual source-ingest script for sko_* tables; not part of the reader or formula bundle.",
  "web/lib/supabase/Upserts/fetchSKOyears.js": "Legacy manual source-ingest script for sko_* tables; not part of the reader or formula bundle.",
  "web/scripts/sko-output-authority.ts": "Authority over the retained sko_* output artifacts (historical evidence, not runtime).",
  "web/sql/functions/analytics.rpc_sko_player_series.sql": "Legacy research SQL; no runtime TypeScript caller. Classification open.",
  "web/sql/functions/public.rpc_sko_player_series.sql": "Legacy research SQL; no runtime TypeScript caller. Classification open.",
  "web/sql/tests/sko_trends_validation.sql": "Legacy research SQL validation. Classification open.",
  "web/sql/views/analytics.vw_sko_skater_base.sql": "Legacy research SQL view. Classification open.",
  "web/sql/views/analytics.vw_sko_skater_scores.sql": "Legacy research SQL view. Classification open.",
  "web/sql/views/analytics.vw_sko_skater_zscores.sql": "Legacy research SQL view. Classification open.",
  "web/pages/sko-element/preview.tsx": "The Sko Element fixture prototype (new contract), not legacy sKO.",
  "web/lib/skoElement/": "The Sko Element shared interpretation core (new contract), not legacy sKO.",
  "web/components/skoElement/": "The Sko Element fixture UI (new contract), not legacy sKO."
};

export function getLegacyPredictionArtifact(
  id: string
): LegacyPredictionArtifact | null {
  return LEGACY_PREDICTION_ARTIFACTS.find((artifact) => artifact.id === id) ?? null;
}
