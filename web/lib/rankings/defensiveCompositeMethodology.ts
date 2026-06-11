export const DEFENSIVE_COMPOSITE_LABELS = {
  overall: "Defensive Impact in Context",
  deployment: "Deployment Defensive Impact in Context",
} as const;

export const DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS = [
  "context_influenced_unadjusted_on_ice",
] as const;

export const DEFENSIVE_COMPOSITE_CAVEATS = [
  "Raw on-ice defensive metrics are influenced by teammates, opponents, usage, zone starts, and score state.",
  "Do not present contextual defensive composites as pure defensive talent until an adjusted RAPM/GAR-like layer exists.",
] as const;

export const ADJUSTED_DEFENSE_MODEL_PREREQUISITES = [
  "verified teammate and opponent on-ice context",
  "zone-start and score-state controls",
  "strength-state-specific rolling samples",
  "model validation against held-out games",
  "reuse the existing xG adjusted-impact output contract before adding rankings-specific tables",
] as const;

export const ADJUSTED_DEFENSE_MODEL_ROADMAP = {
  currentLabel: "contextual_defensive_impact",
  replacementLabel: "adjusted_defensive_impact",
  recommendedModelFamily:
    "regularized RAPM-like contextual residual model before any GAR-like replacement score",
  currentSourceAudit: {
    teammateOpponentContext:
      "NHL on-ice attribution utilities and the xG adjusted-impact design-row builder already encode teammate/opponent skater coefficients from shift stints.",
    zoneStarts:
      "NST 5v5 on-ice tables expose zone starts and faceoff context, but the rankings defense composite does not yet adjust for them.",
    scoreState:
      "Approved shot-xG features include score-state context; the adjusted-impact endpoint now emits leakage and chronological held-out validation before persistence.",
    strengthState:
      "rolling_player_game_metrics supports all, true 5v5, EV, PP, and PK contexts; adjusted defense should start with 5v5 before broader strength support.",
    outputContract:
      "Use nhl_xg_adjusted_impact_model_runs and nhl_xg_adjusted_player_impacts from the existing migration path; live verification on 2026-06-09 found the tables installed, RLS enabled, and populated with one validated model run plus 802 player-impact rows.",
  },
  validationCriteria: [
    "chronological train/validation split by game date",
    "held-out error improvement over raw on-ice xGA/xGF baselines",
    "coefficient shrinkage or regularization selected before production scoring",
    "stability check across minimum TOI buckets and deployment buckets",
    "source-quality metadata proving teammate, opponent, score, zone, and rest controls used",
    "model-run provenance includes leakage validation and held-out validation metrics",
  ],
  publishGate:
    "Do not replace contextual defensive labels until the existing adjusted-impact output tables are installed live, populated from an approved shot-xG source, pass chronological held-out validation, and emit methodology/provenance metadata for every published row.",
} as const;
