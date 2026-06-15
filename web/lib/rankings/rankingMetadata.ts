import {
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS,
} from "./metricDefinitions";
import { buildContextualRankingsAvailableFilters } from "./availableFilters";
import {
  ADJUSTED_DEFENSE_MODEL_ROADMAP,
  ADJUSTED_DEFENSE_MODEL_PREREQUISITES,
  DEFENSIVE_COMPOSITE_CAVEATS,
  DEFENSIVE_COMPOSITE_LABELS,
  DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS,
} from "./defensiveCompositeMethodology";
import {
  ADJUSTED_IMPACT_PROMOTION_CONTRACT,
  evaluateAdjustedImpactPromotionReadiness,
} from "./adjustedImpactPromotionContract";
import { RANKING_ENTITY_COVERAGE_CONTRACTS } from "./entityCoverageContracts";
import { TEAM_STYLE_SOURCE_CONTRACT } from "./teamStyleMethodology";
import { buildWarSurface } from "./war";

export const CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT = "2026-06-09";

export const CONTEXTUAL_RANKING_FILTER_OPTIONS = {
  entities: ["skaters", "goalies", "teams"] as const,
  windows: ["season", "last5", "last10", "last20"] as const,
  positions: ["all", "F", "D"] as const,
  deployments: [
    "all",
    "L1",
    "L2",
    "L3",
    "L4",
    "P1",
    "P2",
    "P3",
    "PP1",
    "PP2",
    "PP3",
    "PK1",
    "PK2",
  ] as const,
  strengths: ["all", "5v5", "ev", "pp", "pk"] as const,
  peerGroups: ["all_skaters", "position", "deployment", "team"] as const,
  sorts: ["percentile", "raw_rank", "metric_value", "gp", "toi_per_game"] as const,
};

export const CONTEXTUAL_RANKING_GLOSSARY = [
  {
    key: "player_last_n_games_played",
    label: "Player last N games",
    description:
      "A production window based on the player's own most recent appearances, not the team's last N games.",
  },
  {
    key: "season_to_date",
    label: "Season to date",
    description:
      "A season-window snapshot through the selected ranking date and strength state.",
  },
  {
    key: "deployment_bucket",
    label: "Deployment bucket",
    description:
      "A peer context derived from verified even-strength line or special-teams usage.",
  },
  {
    key: "better_than_percentile",
    label: "Peer percentile",
    description:
      "The share of qualified peers at or below the row's normalized value after directionality is applied, so the top qualified peer group displays as 100.",
  },
  {
    key: "source_quality_flags",
    label: "Source caveats",
    description:
      "Metric-specific flags for source limitations such as rink-scorekeeper sensitivity or denominator semantics.",
  },
  {
    key: "raw_contextual_team_style",
    label: "Raw/contextual team style",
    description:
      "Team-style helpers are descriptive raw/contextual 5v5 reads until score- and venue-adjusted aggregates are verified.",
  },
  {
    key: "contextual_defensive_impact",
    label: "Contextual defensive impact",
    description:
      "Defensive composites use context-influenced on-ice inputs and must not be presented as adjusted defensive talent until a validated RAPM-like model is published.",
  },
  {
    key: "goalie_rankings_source_contract",
    label: "Goalie rankings source contract",
    description:
      "Goalie ranking sources are verified and power the live goalie matrix with goalie-specific peer groups, workload filters, and sample-confidence caveats.",
  },
  {
    key: "team_rankings_source_contract",
    label: "Team rankings source contract",
    description:
      "Team ranking sources are verified and power the live team matrix with raw/contextual style labels and stale-source caveats where source dates diverge.",
  },
  {
    key: "wins_above_replacement_source_pending",
    label: "Wins Above Replacement source pending",
    description:
      "WAR is not published until replacement baseline, position adjustment, win conversion, and validation gates are documented and populated.",
  },
  {
    key: "comparison_payload_contract",
    label: "Comparison payload contract",
    description:
      "Comparison payloads use cached ranking matrix surfaces, return per-subject unavailable states, and do not fabricate missing rows.",
  },
] as const;

export type ContextualRankingsMetadataResponse = ReturnType<
  typeof buildContextualRankingsMetadataSurface
>;

export function buildContextualRankingsMetadataSurface() {
  return {
    success: true,
    generatedAt: new Date().toISOString(),
    filters: CONTEXTUAL_RANKING_FILTER_OPTIONS,
    availableFilters: buildContextualRankingsAvailableFilters(),
    metrics: CONTEXTUAL_RANKING_METRIC_DEFINITIONS.map((definition) => ({
      key: definition.metricKey,
      displayName: definition.displayName,
      entityType: definition.entityType,
      category: definition.category,
      description: definition.description,
      formulaDescription: definition.formulaDescription,
      higherIsBetter: definition.higherIsBetter,
      defaultStrengthState: definition.defaultStrengthState,
      defaultPeerGroup: definition.defaultPeerGroup,
      availabilityStatus: definition.availabilityStatus,
      applicableStrengthStates: [...definition.applicableStrengthStates],
      denominatorKey: definition.denominatorKey,
      denominatorDescription: definition.denominatorDescription,
      sampleRequirements: definition.sampleRequirements,
      methodologyVersion: definition.methodologyVersion,
      methodologyUpdatedAt: CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT,
      sourceQualityFlags: [...definition.sourceQualityFlags],
      metadata: definition.metadata ?? {},
    })),
    glossary: CONTEXTUAL_RANKING_GLOSSARY,
    comparison: {
      endpoint: "/api/v1/contextual-rankings/comparison",
      version: "contextual_ranking_comparison_v1",
      status: "available",
      supportedEntities: ["skaters", "goalies", "teams"],
      maxSubjects: 6,
      subjectParams: {
        skaters: ["player_ids", "entity_ids"],
        goalies: ["goalie_ids", "entity_ids"],
        teams: ["teams", "team_abbreviations"],
      },
      notes: [
        "Comparison payloads page through the same cached matrix surfaces used by the workstation.",
        "Unavailable subjects are returned with explicit reasons instead of fabricated rows.",
        "The endpoint returns available, partial, or unavailable status for the requested subject set.",
      ],
      legacyListComparison: {
        endpoint: "/api/v1/contextual-rankings",
        entityIdsParam: "entity_ids",
        maxEntityIds: 25,
        supportedEntities: ["skaters"],
      },
    },
    snapshot: {
      endpoint: "/api/v1/contextual-rankings/snapshot",
      supportedEntities: ["skaters", "goalies", "teams"],
      status: "available",
      notes: [
        "Returns a selected entity row from the same cached matrix surfaces used by the workstation.",
        "Returns status unavailable rather than fabricating a row when the selected entity is absent from the requested context.",
      ],
    },
    defensiveComposites: {
      labels: DEFENSIVE_COMPOSITE_LABELS,
      caveats: [...DEFENSIVE_COMPOSITE_CAVEATS],
      sourceQualityFlags: [...DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS],
      adjustedModelPrerequisites: [...ADJUSTED_DEFENSE_MODEL_PREREQUISITES],
      adjustedModelRoadmap: ADJUSTED_DEFENSE_MODEL_ROADMAP,
      adjustedImpactPromotion: {
        ...ADJUSTED_IMPACT_PROMOTION_CONTRACT,
        readiness: evaluateAdjustedImpactPromotionReadiness(
          ADJUSTED_IMPACT_PROMOTION_CONTRACT.controls
        ),
      },
    },
    teamStyle: TEAM_STYLE_SOURCE_CONTRACT,
    war: buildWarSurface({
      entity: "skaters",
      season: 20252026,
      window: "season",
      strength: "5v5",
      position: "all",
      deployment: "all",
    }),
    entityCoverage: RANKING_ENTITY_COVERAGE_CONTRACTS,
  };
}
