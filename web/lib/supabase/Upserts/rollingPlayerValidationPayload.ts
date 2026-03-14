import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import {
  fetchPlayerValidationSourceData,
  recomputePlayerRowsForValidation,
  type StrengthState
} from "./fetchRollingPlayerAverages";
import {
  ROLLING_PLAYER_AVAILABILITY_CONTRACT
} from "./rollingPlayerAvailabilityContract";
import {
  ROLLING_PLAYER_LINE_CONTEXT_CONTRACT
} from "./rollingPlayerLineContextContract";
import {
  ROLLING_PLAYER_PP_SHARE_CONTRACT
} from "./rollingPlayerPpShareContract";
import {
  ROLLING_PLAYER_PP_UNIT_CONTRACT
} from "./rollingPlayerPpUnitContract";
import {
  normalizeWgoToiPerGame,
  resolveFallbackToiSeed,
  resolveRollingPlayerToiContext
} from "./rollingPlayerToiContract";
import {
  summarizeDerivedWindowDiagnostics,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";
import {
  CANONICAL_ROLLING_WINDOW_CONTRACTS,
  ROLLING_METRIC_WINDOW_FAMILIES,
  type RollingMetricKey,
  type RollingWindowContract,
  type RollingMetricWindowFamily
} from "./rollingWindowContract";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type RollingMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"];
type ValidationSourceData = Awaited<
  ReturnType<typeof fetchPlayerValidationSourceData>
>;
type MergedGameRow =
  ValidationSourceData["byStrength"][StrengthState]["mergedGames"][number];
type CoverageSummary = ValidationSourceData["byStrength"][StrengthState]["coverageSummary"];
type SourceTailFreshnessSummary =
  ValidationSourceData["byStrength"][StrengthState]["sourceTailFreshness"];
type SuspiciousOutputsSummary = ReturnType<typeof summarizeSuspiciousOutputs>;
type DerivedWindowSummary = ReturnType<typeof summarizeDerivedWindowDiagnostics>;
type DiagnosticsSectionStatus = "clean" | "caution" | "blocked";

type DiagnosticsSectionSnapshot = {
  status: DiagnosticsSectionStatus;
  issueCount: number;
  highlights: string[];
};

type RatioCompletenessState =
  | "complete"
  | "partial"
  | "absent"
  | "invalid"
  | "valuePresentWithoutComponents";

type RatioWindowCompletenessSnapshot = {
  state: RatioCompletenessState;
  counts: {
    complete: number;
    partial: number;
    absent: number;
    invalid: number;
    valuePresentWithoutComponents: number;
  };
};

type DiagnosticsSnapshot = {
  overallStatus: DiagnosticsSectionStatus;
  blockerCount: number;
  cautionCount: number;
  highlights: string[];
  categories: {
    coverage: DiagnosticsSectionSnapshot & {
      warningCount: number;
      unknownGameIds: number;
      ppCoverage: {
        latestExpectedPpGameId: number | null;
        latestBuilderGameCovered: boolean;
        latestShareGameCovered: boolean;
        windowBuilderCoverageComplete: boolean;
        windowShareCoverageComplete: boolean;
        missingPpGameIds: number[];
        missingPpShareGameIds: number[];
      };
    };
    freshness: DiagnosticsSectionSnapshot & {
      blockers: SourceTailFreshnessSummary["blockers"] | null;
      latest: SourceTailFreshnessSummary["latest"] | null;
    };
    completeness: DiagnosticsSectionSnapshot & {
      gpIssueCount: number;
      ratioIssueCount: number;
      impactedGpScopes: string[];
      impactedRatioFamilies: string[];
      ratioFamilies: Partial<
        Record<
          keyof DerivedWindowSummary["ratioWindows"],
          Record<"last3" | "last5" | "last10" | "last20", RatioWindowCompletenessSnapshot>
        >
      >;
      selectedMetric: {
        family: keyof DerivedWindowSummary["ratioWindows"] | null;
        states: Record<
          "last3" | "last5" | "last10" | "last20",
          RatioWindowCompletenessSnapshot
        > | null;
      };
    };
    suspiciousOutputs: DiagnosticsSectionSnapshot & {
      warningCount: number;
    };
    targetFreshness: DiagnosticsSectionSnapshot & {
      latestStoredGameDate: string | null;
      latestRecomputedGameDate: string | null;
      latestSourceDate: string | null;
      storedRowCount: number;
      recomputedRowCount: number;
    };
  };
};

type SelectedMetricMetadata = {
  key: string | null;
  family: string | null;
  canonicalField: string | null;
  legacyFields: string[];
  supportFields: string[];
};

type MetricFamilyId =
  | "all"
  | "availability"
  | "toi"
  | "surface_counts"
  | "weighted_rates"
  | "finishing"
  | "on_ice_context"
  | "territorial"
  | "pp_usage"
  | "pp_role"
  | "line_context"
  | "historical"
  | "support"
  | "other";

type FormulaMetadata = {
  field: string | null;
  baseKey: string | null;
  family: MetricFamilyId | null;
  windowFamily: RollingMetricWindowFamily | null;
  formula: string | null;
  formulaSource: "exact" | "base" | "family_default" | "unknown" | null;
  canonicalField: string | null;
  legacyFields: string[];
  supportFields: string[];
};

type WindowMembershipEntry = {
  rowKey: string;
  gameId: number | null;
  gameDate: string;
  season: number | null;
  teamId: number | null;
  strength: StrengthState | "team_game";
  source: "appearance" | "team_game";
  occupiesSelectedSlot: boolean;
  hasPlayerAppearance: boolean;
};

type WindowMembershipSnapshot = Record<
  "last3" | "last5" | "last10" | "last20",
  {
    windowSize: 3 | 5 | 10 | 20;
    selectionMode: "appearance_rows" | "team_games";
    members: WindowMembershipEntry[];
  }
>;

type ToiTraceRow = {
  rowKey: string;
  gameId: number | null;
  gameDate: string;
  strength: StrengthState | null;
  rawCandidates: {
    countsToi: number | null;
    countsOiToi: number | null;
    ratesToiPerGp: number | null;
    wgoToiPerGame: number | null;
  };
  fallbackSeed: {
    seconds: number | null;
    source: string;
    rejectedCandidates: Array<{
      source: string;
      reason: string;
    }>;
    wgoNormalization: string;
  };
  resolved: {
    seconds: number | null;
    source: string;
    trustTier: string;
    rejectedCandidates: Array<{
      source: string;
      reason: string;
    }>;
    wgoNormalization: string;
  };
  suspiciousNotes: string[];
};

type PpShareSource = "builder" | "wgo" | "missing";

type PpShareTraceRow = {
  rowKey: string;
  gameId: number | null;
  gameDate: string;
  strength: StrengthState | null;
  builder: {
    playerPpToi: number | null;
    share: number | null;
    teamPpToiInferred: number | null;
    valid: boolean;
  };
  wgo: {
    playerPpToi: number | null;
    share: number | null;
    teamPpToiInferred: number | null;
    valid: boolean;
  };
  chosen: {
    source: PpShareSource;
    playerPpToi: number | null;
    share: number | null;
    teamPpToiInferred: number | null;
  };
};

type PpShareWindowSummary = Record<
  "last3" | "last5" | "last10" | "last20",
  {
    windowSize: 3 | 5 | 10 | 20;
    sourcesUsed: PpShareSource[];
    mixedSourceWindow: boolean;
    missingSourceGameIds: number[];
    memberSources: Array<{
      rowKey: string;
      gameId: number | null;
      gameDate: string;
      source: PpShareSource;
    }>;
  }
>;

type ComparisonMismatchCauseBucket =
  | "stale source"
  | "stale target"
  | "logic defect"
  | "schema-contract issue"
  | "source-gap issue"
  | "fallback-side effect"
  | "unit/scale mismatch"
  | "unresolved verification blocker";

type ComparisonMatrixEntry = {
  field: string;
  family: MetricFamilyId | null;
  storedValue: unknown;
  recomputedValue: unknown;
  signedDiff: number | null;
  absoluteDiff: number | null;
  percentDiff: number | null;
  valuesMatch: boolean;
  fieldRole: "canonical" | "legacy" | "support" | "other";
};

export type RollingPlayerValidationRequest = {
  playerId: number;
  season: number;
  strength: StrengthState;
  teamId?: number;
  gameId?: number;
  gameDate?: string;
  startDate?: string;
  endDate?: string;
  metric?: string;
  metricFamily?: string;
  includeStoredRows?: boolean;
  includeRecomputedRows?: boolean;
  includeSourceRows?: boolean;
  includeDiagnostics?: boolean;
  includeWindowMembership?: boolean;
  includeContractMetadata?: boolean;
  includeComparisons?: boolean;
};

export type RollingPlayerValidationPayload = {
  generatedAt: string;
  request: {
    playerId: number;
    season: number;
    strength: StrengthState;
    teamId: number | null;
    gameId: number | null;
    gameDate: string | null;
    startDate: string | null;
    endDate: string | null;
    metric: string | null;
    metricFamily: string | null;
  };
  selected: {
    player: {
      id: number;
      fullName: string;
      position: string | null;
    } | null;
    focusedRow: {
      rowKey: string;
      gameId: number | null;
      gameDate: string;
      strength: StrengthState;
      season: number | null;
      teamId: number | null;
    } | null;
    metric: SelectedMetricMetadata;
  };
  readiness: {
    status: "READY" | "READY_WITH_CAUTIONS" | "BLOCKED";
    blockerReasons: string[];
    cautionReasons: string[];
    nextRecommendedAction: string | null;
  };
  stored: {
    focusedRow: RollingMetricRow | null;
    rowHistory: RollingMetricRow[];
  } | null;
  recomputed: {
    focusedRow: Record<string, unknown> | null;
    rowHistory: Record<string, unknown>[];
    error: string | null;
  } | null;
  sourceRows: {
    shared: {
      wgoRows: Record<string, unknown>[];
      ppRows: Record<string, unknown>[];
      lineRows: Record<string, unknown>[];
      games: Record<string, unknown>[];
    };
    selectedStrength: {
      countsRows: Record<string, unknown>[];
      ratesRows: Record<string, unknown>[];
      countsOiRows: Record<string, unknown>[];
      mergedGames: Record<string, unknown>[];
      toiTraceRows: ToiTraceRow[];
      ppShareTraceRows: PpShareTraceRow[];
      ppShareWindowSummary: PpShareWindowSummary | null;
    } | null;
  } | null;
  diagnostics: {
    coverage: CoverageSummary | null;
    sourceTailFreshness: SourceTailFreshnessSummary | null;
    derivedWindowCompleteness: DerivedWindowSummary | null;
    suspiciousOutputs: SuspiciousOutputsSummary | null;
    targetFreshness: {
      latestStoredGameDate: string | null;
      latestRecomputedGameDate: string | null;
      latestSourceDate: string | null;
      storedRowCount: number;
      recomputedRowCount: number;
    } | null;
    snapshot: DiagnosticsSnapshot | null;
  } | null;
  contracts: {
    selectedMetricFamily: MetricFamilyId | null;
    selectedWindowFamily: RollingMetricWindowFamily | null;
    windowContract: RollingWindowContract | null;
    helperSummaries: {
      availability: typeof ROLLING_PLAYER_AVAILABILITY_CONTRACT;
      ppShare: typeof ROLLING_PLAYER_PP_SHARE_CONTRACT;
      ppUnit: typeof ROLLING_PLAYER_PP_UNIT_CONTRACT;
      lineContext: typeof ROLLING_PLAYER_LINE_CONTEXT_CONTRACT;
      toi: {
        sourcePriority: string[];
        trustTiers: string[];
        fallbackSeedPriority: string[];
        summary: string;
      };
      sourceSelection: {
        additiveMetrics: string[];
        authoritySummary: string;
      };
    };
  } | null;
  formulas: {
    selectedMetric: FormulaMetadata | null;
  } | null;
  windows: {
    focusedRowKey: string | null;
    selectedMetricFamily: MetricFamilyId | null;
    selectedWindowFamily: RollingMetricWindowFamily | null;
    memberships: WindowMembershipSnapshot | null;
  } | null;
  comparisons: {
    familySummary: {
      selectedMetricFamily: MetricFamilyId | null;
      rowCountCompared: number;
      fieldCountCompared: number;
      mismatchFieldCount: number;
      mismatchRowCount: number;
      metrics: Array<{
        field: string;
        family: MetricFamilyId | null;
        mismatchedRows: number;
        comparedRows: number;
        latestStoredValue: unknown;
        latestRecomputedValue: unknown;
        latestDiff: number | null;
        valuesMatch: boolean;
      }>;
    } | null;
    focusedRow: {
      storedRowKey: string | null;
      recomputedRowKey: string | null;
      selectedMetric: {
        field: string | null;
        storedValue: unknown;
        recomputedValue: unknown;
        diff: number | null;
        absoluteDiff: number | null;
        signedDiff: number | null;
        percentDiff: number | null;
        valuesMatch: boolean | null;
        mismatchCauseBucket: ComparisonMismatchCauseBucket | null;
      } | null;
      comparisonMatrix: ComparisonMatrixEntry[];
      canonicalVsLegacy: Array<{
        field: string;
        canonicalValue: number | string | null;
        legacyValue: number | string | null;
        valuesMatch: boolean;
      }>;
      supportComparisons: Array<{
        field: string;
        storedValue: number | string | null;
        recomputedValue: number | string | null;
        valuesMatch: boolean;
      }>;
    } | null;
  } | null;
  helpers: null;
};

const CANONICAL_SCOPE_SUFFIXES = [
  "_all",
  "_last3",
  "_last5",
  "_last10",
  "_last20",
  "_season",
  "_3ya",
  "_career"
] as const;

const WINDOW_SPECS = [
  { key: "last3", size: 3 },
  { key: "last5", size: 5 },
  { key: "last10", size: 10 },
  { key: "last20", size: 20 }
] as const;

const METRIC_FORMULAS: Record<string, string> = {
  pp_share_pct:
    "sum(player_pp_toi_seconds) / sum(team_pp_toi_seconds_inferred_from_share)",
  pp_toi_seconds: "sum(player_pp_toi_seconds)",
  on_ice_sh_pct: "sum(on_ice_goals_for) / sum(on_ice_shots_for) * 100",
  on_ice_sv_pct:
    "sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against) * 100",
  pdo:
    "((sum(gf) / sum(sf)) * 100 + (sum(sa - ga) / sum(sa)) * 100) * 0.01",
  ipp: "sum(player_points) / sum(on_ice_goals_for) * 100",
  primary_points_pct: "sum(goals + first_assists) / sum(points)",
  expected_sh_pct: "sum(ixg) / sum(shots)",
  shooting_pct: "sum(goals) / sum(shots) * 100",
  primary_assists: "sum(first_assists)",
  secondary_assists: "sum(second_assists)",
  penalties_drawn: "sum(penalties_drawn)",
  oz_start_pct: "sum(oz_starts) / sum(oz_starts + dz_starts) * 100",
  cf_pct: "sum(cf) / sum(cf + ca) * 100",
  ff_pct: "sum(ff) / sum(ff + fa) * 100",
  sog_per_60: "sum(shots) / sum(toi_seconds) * 3600",
  ixg_per_60: "sum(ixg) / sum(toi_seconds) * 3600",
  goals_per_60: "sum(goals) / sum(toi_seconds) * 3600",
  assists_per_60: "sum(assists) / sum(toi_seconds) * 3600",
  penalties_drawn_per_60: "sum(penalties_drawn) / sum(toi_seconds) * 3600",
  primary_assists_per_60: "sum(primary_assists) / sum(toi_seconds) * 3600",
  secondary_assists_per_60: "sum(secondary_assists) / sum(toi_seconds) * 3600",
  hits_per_60: "sum(hits) / sum(toi_seconds) * 3600",
  blocks_per_60: "sum(blocks) / sum(toi_seconds) * 3600",
  availability_pct: "games_played / team_games_available",
  participation_pct: "participation_games / team_games_available"
};

const FAMILY_DEFAULT_FORMULAS: Record<MetricFamilyId, string> = {
  all: "See the selected metric field for the exact reconstruction formula.",
  availability: "availability or participation numerator / denominator support fields",
  toi: "sum(raw TOI seconds across the selected scope)",
  surface_counts: "sum(raw source values across the selected scope)",
  weighted_rates: "sum(raw_numerator) / sum(toi_seconds) * 3600",
  finishing: "ratio of aggregated numerator and denominator support fields",
  on_ice_context: "ratio of aggregated numerator and denominator support fields",
  territorial: "ratio or sum of aggregated on-ice territorial components",
  pp_usage: "ratio of aggregated PP usage numerator and denominator support fields",
  pp_role: "context label from refreshed power-play combination builder rows",
  line_context: "context label from refreshed line-combination builder rows",
  historical: "historical snapshot derived from season, 3YA, or career aggregated scope",
  support: "support field used to reconstruct or validate a higher-level metric",
  other: "See source and support fields for reconstruction path"
};

const WEIGHTED_RATE_SUPPORT_CONFIG = {
  sog_per_60: {
    numeratorAlias: "shots",
    numeratorActualBaseField: "shots"
  },
  ixg_per_60: {
    numeratorAlias: "ixg",
    numeratorActualBaseField: "ixg"
  },
  goals_per_60: {
    numeratorAlias: "goals",
    numeratorActualBaseField: "goals"
  },
  assists_per_60: {
    numeratorAlias: "assists",
    numeratorActualBaseField: "assists"
  },
  penalties_drawn_per_60: {
    numeratorAlias: "penalties_drawn",
    numeratorActualBaseField: "penalties_drawn"
  },
  primary_assists_per_60: {
    numeratorAlias: "primary_assists",
    numeratorActualBaseField: null
  },
  secondary_assists_per_60: {
    numeratorAlias: "secondary_assists",
    numeratorActualBaseField: null
  },
  hits_per_60: {
    numeratorAlias: "hits",
    numeratorActualBaseField: "hits"
  },
  blocks_per_60: {
    numeratorAlias: "blocks",
    numeratorActualBaseField: "blocks"
  }
} as const satisfies Record<
  string,
  {
    numeratorAlias: string;
    numeratorActualBaseField: string | null;
  }
>;
type WeightedRateSupportKey = keyof typeof WEIGHTED_RATE_SUPPORT_CONFIG;

function isWeightedRateSupportKey(value: string): value is WeightedRateSupportKey {
  return value in WEIGHTED_RATE_SUPPORT_CONFIG;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDisplayScalar(value: unknown): number | string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  return null;
}

function compareValues(
  storedValue: unknown,
  recomputedValue: unknown
): {
  valuesMatch: boolean;
  signedDiff: number | null;
  absoluteDiff: number | null;
  percentDiff: number | null;
} {
  const storedNumber = toNumberOrNull(storedValue);
  const recomputedNumber = toNumberOrNull(recomputedValue);

  if (storedNumber != null && recomputedNumber != null) {
    const signedDiff = Number((storedNumber - recomputedNumber).toFixed(6));
    const absoluteDiff = Number(Math.abs(signedDiff).toFixed(6));
    const percentDiff =
      Math.abs(recomputedNumber) > 1e-9
        ? Number(((signedDiff / Math.abs(recomputedNumber)) * 100).toFixed(6))
        : null;
    return {
      valuesMatch: absoluteDiff <= 0.000001,
      signedDiff,
      absoluteDiff,
      percentDiff
    };
  }

  return {
    valuesMatch: storedValue === recomputedValue,
    signedDiff: null,
    absoluteDiff: null,
    percentDiff: null
  };
}

function getRowGameId(row: Record<string, unknown>): number | null {
  const value = row.game_id ?? row.gameId;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRowGameDate(row: Record<string, unknown>): string | null {
  const value = row.game_date ?? row.gameDate;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRowStrength(row: Record<string, unknown>): StrengthState | null {
  const value = row.strength_state ?? row.strength;
  return value === "all" || value === "ev" || value === "pp" || value === "pk"
    ? value
    : null;
}

function getRowSeason(row: Record<string, unknown>): number | null {
  const value = row.season;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRowTeamId(row: Record<string, unknown>): number | null {
  const value = row.team_id ?? row.teamId;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRowKey(row: Record<string, unknown>): string | null {
  const gameDate = getRowGameDate(row);
  const strength = getRowStrength(row);
  if (!gameDate || !strength) return null;
  return `${gameDate}:${strength}:${getRowGameId(row) ?? "nogame"}`;
}

function sortRowsByDateAsc<T extends Record<string, unknown>>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftDate = getRowGameDate(left) ?? "";
    const rightDate = getRowGameDate(right) ?? "";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    const leftStrength = getRowStrength(left) ?? "";
    const rightStrength = getRowStrength(right) ?? "";
    if (leftStrength !== rightStrength) {
      return leftStrength.localeCompare(rightStrength);
    }
    return (getRowGameId(left) ?? 0) - (getRowGameId(right) ?? 0);
  });
}

function filterRowsForRequest<T extends Record<string, unknown>>(
  rows: T[],
  request: RollingPlayerValidationRequest
): T[] {
  return sortRowsByDateAsc(
    rows.filter((row) => {
      if (getRowSeason(row) !== request.season) return false;
      if (getRowStrength(row) !== request.strength) return false;
      if (
        typeof request.teamId === "number" &&
        getRowTeamId(row) !== request.teamId
      ) {
        return false;
      }
      const gameDate = getRowGameDate(row);
      if (request.startDate && gameDate && gameDate < request.startDate) {
        return false;
      }
      if (request.endDate && gameDate && gameDate > request.endDate) {
        return false;
      }
      return true;
    })
  );
}

function pickFocusedRow<T extends Record<string, unknown>>(
  rows: T[],
  request: RollingPlayerValidationRequest
): T | null {
  if (rows.length === 0) return null;
  if (typeof request.gameId === "number") {
    return rows.find((row) => getRowGameId(row) === request.gameId) ?? null;
  }
  if (request.gameDate) {
    const matches = rows.filter((row) => getRowGameDate(row) === request.gameDate);
    return matches.at(-1) ?? null;
  }
  return rows.at(-1) ?? null;
}

function inferMetricMetadata(
  focusedRow: Record<string, unknown> | null,
  metricKey?: string,
  metricFamily?: string
): SelectedMetricMetadata {
  if (!focusedRow || !metricKey) {
    return {
      key: metricKey ?? null,
      family: metricFamily ?? null,
      canonicalField: null,
      legacyFields: [],
      supportFields: []
    };
  }

  const keys = Object.keys(focusedRow);
  const exactMatch = keys.includes(metricKey) ? metricKey : null;
  const scopedCanonicalMatches = keys.filter(
    (field) =>
      field.startsWith(`${metricKey}_`) &&
      CANONICAL_SCOPE_SUFFIXES.some((suffix) => field.endsWith(suffix))
  );
  const legacyFields = keys.filter(
    (field) =>
      field.startsWith(`${metricKey}_avg_`) || field.startsWith(`${metricKey}_total_`)
  );
  const inferredSupportFields = keys.filter((field) => {
    if (field === metricKey) return false;
    if (!field.startsWith(`${metricKey}_`)) return false;
    if (scopedCanonicalMatches.includes(field)) return false;
    if (legacyFields.includes(field)) return false;
    return true;
  });

  const canonicalField =
    exactMatch ??
    scopedCanonicalMatches.find((field) => field.endsWith("_last5")) ??
    scopedCanonicalMatches[0] ??
    null;
  const supportFields = Array.from(
    new Set([
      ...inferredSupportFields,
      ...getMetricSupportFieldOverrides(
        exactMatch ?? canonicalField ?? metricKey ?? null
      )
    ])
  );

  return {
    key: metricKey,
    family: metricFamily ?? null,
    canonicalField,
    legacyFields,
    supportFields
  };
}

function isLegacyField(field: string): boolean {
  return (
    field.includes("_avg_") ||
    field.includes("_total_") ||
    field.startsWith("gp_pct_")
  );
}

function inferMetricFamily(field: string | null | undefined): MetricFamilyId | null {
  if (!field) return null;
  if (field.includes("availability") || field.includes("participation")) {
    return "availability";
  }
  if (
    field === "games_played" ||
    field === "team_games_played" ||
    field.startsWith("games_played_last") ||
    field.startsWith("team_games_available_last") ||
    field.startsWith("season_games_played") ||
    field.startsWith("season_team_games_available") ||
    field.startsWith("three_year_games_played") ||
    field.startsWith("three_year_team_games_available") ||
    field.startsWith("career_games_played") ||
    field.startsWith("career_team_games_available") ||
    field.startsWith("gp_pct_") ||
    field === "gp_semantic_type"
  ) {
    return "availability";
  }
  if (field.startsWith("toi_seconds")) return "toi";
  if (field.includes("_per_60")) return "weighted_rates";
  if (
    field.startsWith("shooting_pct") ||
    field.startsWith("expected_sh_pct") ||
    field.startsWith("primary_points_pct")
  ) {
    return "finishing";
  }
  if (
    field.startsWith("on_ice_sh_pct") ||
    field.startsWith("on_ice_sv_pct") ||
    field.startsWith("pdo") ||
    field.startsWith("oi_") ||
    field.startsWith("ipp")
  ) {
    return "on_ice_context";
  }
  if (
    field === "cf" ||
    field === "ca" ||
    field === "cf_pct" ||
    field === "ff" ||
    field === "fa" ||
    field === "ff_pct" ||
    field.startsWith("cf_") ||
    field.startsWith("ff_") ||
    field.startsWith("oz_") ||
    field.startsWith("dz_") ||
    field.startsWith("nz_")
  ) {
    return "territorial";
  }
  if (field.startsWith("pp_share_pct") || field.startsWith("pp_toi_seconds")) {
    return "pp_usage";
  }
  if (
    field.startsWith("pp_unit") ||
    field === "pp_share_of_team" ||
    field === "pp_vs_unit_avg"
  ) {
    return "pp_role";
  }
  if (field.startsWith("line_combo")) return "line_context";
  if (
    field.endsWith("_season") ||
    field.endsWith("_3ya") ||
    field.endsWith("_career")
  ) {
    return "historical";
  }
  if (
    field.startsWith("goals") ||
    field.startsWith("assists") ||
    field.startsWith("primary_assists") ||
    field.startsWith("secondary_assists") ||
    field.startsWith("penalties_drawn") ||
    field.startsWith("shots") ||
    field.startsWith("hits") ||
    field.startsWith("blocks") ||
    field.startsWith("points") ||
    field.startsWith("pp_points") ||
    field.startsWith("ixg") ||
    field.startsWith("iscf") ||
    field.startsWith("ihdcf")
  ) {
    return "surface_counts";
  }
  if (field.split("_").length >= 4 || isLegacyField(field)) return "support";
  return "other";
}

function getFieldRole(
  field: string,
  selectedMetric: SelectedMetricMetadata
): ComparisonMatrixEntry["fieldRole"] {
  if (selectedMetric.canonicalField === field) return "canonical";
  if (selectedMetric.legacyFields.includes(field)) return "legacy";
  if (selectedMetric.supportFields.includes(field)) return "support";
  return "other";
}

function hasOwnField(
  row: Record<string, unknown> | null | undefined,
  field: string
): boolean {
  return Boolean(row && Object.prototype.hasOwnProperty.call(row, field));
}

function getMetricBaseKey(metricField: string): string {
  return metricField
    .replace(/_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/, "")
    .replace(/_(all|last3|last5|last10|last20|season|3ya|career)$/, "");
}

function getMetricComponentScope(metricField: string | null | undefined): string | null {
  if (!metricField) return null;
  const legacyMatch = metricField.match(
    /_(avg|total)_(all|last3|last5|last10|last20|season|3ya|career)$/
  );
  if (legacyMatch) {
    return `${legacyMatch[1]}_${legacyMatch[2]}`;
  }

  const canonicalMatch = metricField.match(
    /_(all|last3|last5|last10|last20|season|3ya|career)$/
  );
  if (!canonicalMatch) return null;
  const scope = canonicalMatch[1];
  return ["all", "last3", "last5", "last10", "last20"].includes(scope)
    ? `total_${scope}`
    : `avg_${scope}`;
}

function getMetricSupportFieldOverrides(
  metricField: string | null | undefined
): string[] {
  if (!metricField) return [];
  const baseKey = getMetricBaseKey(metricField);
  const componentScope = getMetricComponentScope(metricField);
  if (!componentScope) return [];

  switch (baseKey) {
    case "sog_per_60":
    case "ixg_per_60":
    case "goals_per_60":
    case "assists_per_60":
    case "primary_assists_per_60":
    case "secondary_assists_per_60":
    case "hits_per_60":
    case "blocks_per_60": {
      const config = WEIGHTED_RATE_SUPPORT_CONFIG[baseKey as WeightedRateSupportKey];
      const historicalScope = componentScope.match(/^avg_(season|3ya|career)$/)?.[1];
      if (historicalScope) {
        return [
          `${baseKey}_${config.numeratorAlias}_${historicalScope}`,
          `${baseKey}_toi_seconds_${historicalScope}`
        ];
      }

      return [
        `${baseKey}_${config.numeratorAlias}_${componentScope}`,
        `${baseKey}_toi_seconds_${componentScope}`
      ];
    }
    case "on_ice_sv_pct":
      return [`oi_sa_${componentScope}`, `oi_ga_${componentScope}`];
    default:
      return [];
  }
}

function resolveWeightedRateSupportFieldValue(args: {
  row: Record<string, unknown> | null | undefined;
  supportField: string;
  selectedMetricField: string | null;
}): number | string | null | undefined {
  const { row, supportField, selectedMetricField } = args;
  if (!row) return null;
  if (hasOwnField(row, supportField)) {
    return row[supportField] as number | string | null | undefined;
  }

  const baseKey = selectedMetricField ? getMetricBaseKey(selectedMetricField) : null;
  if (!baseKey || !isWeightedRateSupportKey(baseKey)) {
    return undefined;
  }

  const config = WEIGHTED_RATE_SUPPORT_CONFIG[baseKey];
  const historicalScope = supportField.match(
    new RegExp(`^${baseKey}_(.+)_(season|3ya|career)$`)
  );
  const totalScope = supportField.match(
    new RegExp(`^${baseKey}_(.+)_(total_all|total_last3|total_last5|total_last10|total_last20)$`)
  );

  if (historicalScope) {
    return undefined;
  }

  if (!totalScope) {
    return undefined;
  }

  const [, alias, componentScope] = totalScope;
  if (alias === "toi_seconds") {
    const toiField = `toi_seconds_${componentScope}`;
    return hasOwnField(row, toiField)
      ? (row[toiField] as number | string | null | undefined)
      : null;
  }

  if (alias !== config.numeratorAlias) {
    return undefined;
  }

  if (config.numeratorActualBaseField) {
    const actualField = `${config.numeratorActualBaseField}_${componentScope}`;
    if (hasOwnField(row, actualField)) {
      return row[actualField] as number | string | null | undefined;
    }
  }

  const toiField = `toi_seconds_${componentScope}`;
  const toiSeconds = toNumberOrNull(row[toiField] ?? null);
  const metricRate = selectedMetricField
    ? toNumberOrNull(row[selectedMetricField] ?? null)
    : null;
  if (toiSeconds == null || metricRate == null) {
    return null;
  }

  return Number(((metricRate * toiSeconds) / 3600).toFixed(6));
}

function resolveSupportFieldValue(args: {
  row: Record<string, unknown> | null | undefined;
  supportField: string;
  selectedMetricField: string | null;
}): number | string | null {
  const { row, supportField, selectedMetricField } = args;
  if (!row) return null;
  if (hasOwnField(row, supportField)) {
    return toDisplayScalar(row[supportField]);
  }

  const weightedRateValue = resolveWeightedRateSupportFieldValue(args);
  if (weightedRateValue !== undefined) {
    return toDisplayScalar(weightedRateValue);
  }

  return null;
}

function inferWindowFamily(
  metricField: string | null | undefined
): RollingMetricWindowFamily | null {
  if (!metricField) return null;
  const baseKey = getMetricBaseKey(metricField);
  if (baseKey in ROLLING_METRIC_WINDOW_FAMILIES) {
    return ROLLING_METRIC_WINDOW_FAMILIES[
      baseKey as RollingMetricKey
    ];
  }
  if (inferMetricFamily(metricField) === "availability") {
    return "availability";
  }
  return null;
}

function buildFormulaMetadata(
  selectedMetric: SelectedMetricMetadata
): FormulaMetadata | null {
  const field = selectedMetric.key ?? selectedMetric.canonicalField;
  if (!field) return null;

  const family =
    (selectedMetric.family as MetricFamilyId | null) ??
    inferMetricFamily(field);
  const baseKey = getMetricBaseKey(field);
  const windowFamily = inferWindowFamily(field);

  const exactFormula = METRIC_FORMULAS[field];
  const baseFormula = METRIC_FORMULAS[baseKey];
  const familyFormula = family ? FAMILY_DEFAULT_FORMULAS[family] : null;

  return {
    field,
    baseKey,
    family,
    windowFamily,
    formula: exactFormula ?? baseFormula ?? familyFormula ?? null,
    formulaSource: exactFormula
      ? "exact"
      : baseFormula
        ? "base"
        : familyFormula
          ? "family_default"
          : "unknown",
    canonicalField: selectedMetric.canonicalField,
    legacyFields: selectedMetric.legacyFields,
    supportFields: selectedMetric.supportFields
  };
}

function buildContractMetadata(
  formulaMetadata: FormulaMetadata | null
): RollingPlayerValidationPayload["contracts"] {
  const selectedMetricFamily = formulaMetadata?.family ?? null;
  const selectedWindowFamily = formulaMetadata?.windowFamily ?? null;

  return {
    selectedMetricFamily,
    selectedWindowFamily,
    windowContract: selectedWindowFamily
      ? CANONICAL_ROLLING_WINDOW_CONTRACTS[selectedWindowFamily]
      : null,
    helperSummaries: {
      availability: ROLLING_PLAYER_AVAILABILITY_CONTRACT,
      ppShare: ROLLING_PLAYER_PP_SHARE_CONTRACT,
      ppUnit: ROLLING_PLAYER_PP_UNIT_CONTRACT,
      lineContext: ROLLING_PLAYER_LINE_CONTEXT_CONTRACT,
      toi: {
        sourcePriority: ["counts", "counts_oi", "rates", "fallback", "wgo"],
        trustTiers: ["authoritative", "supplementary", "fallback", "none"],
        fallbackSeedPriority: ["counts", "counts_oi", "wgo", "none"],
        summary:
          "TOI prefers counts, then counts-on-ice, then rates, then fallback seed, then WGO normalization."
      },
      sourceSelection: {
        additiveMetrics: [
          "goals",
          "assists",
          "primary_assists",
          "secondary_assists",
          "penalties_drawn",
          "shots",
          "hits",
          "blocks",
          "points",
          "pp_points",
          "ixg"
        ],
        authoritySummary:
          "Additive metrics prefer NST counts and fall back to WGO only where the current contract allows it."
      }
    }
  };
}

function buildAppearanceWindowMembership(
  rows: Record<string, unknown>[],
  focusedRow: Record<string, unknown>
): WindowMembershipSnapshot {
  const focusedRowKey = getRowKey(focusedRow);
  const focusedIndex = rows.findIndex((row) => getRowKey(row) === focusedRowKey);

  return WINDOW_SPECS.reduce((acc, spec) => {
    const slice =
      focusedIndex >= 0
        ? rows.slice(Math.max(0, focusedIndex - (spec.size - 1)), focusedIndex + 1)
        : [];
    acc[spec.key] = {
      windowSize: spec.size,
      selectionMode: "appearance_rows",
      members: slice.map((row, index) => ({
        rowKey: getRowKey(row) ?? `${getRowGameDate(row) ?? "unknown"}:${index}`,
        gameId: getRowGameId(row),
        gameDate: getRowGameDate(row) ?? "unknown",
        season: getRowSeason(row),
        teamId: getRowTeamId(row),
        strength: getRowStrength(row) ?? "all",
        source: "appearance",
        occupiesSelectedSlot: true,
        hasPlayerAppearance: true
      }))
    };
    return acc;
  }, {} as WindowMembershipSnapshot);
}

function buildAvailabilityWindowMembership(args: {
  games: ValidationSourceData["games"];
  wgoRows: ValidationSourceData["wgoRows"];
  request: RollingPlayerValidationRequest;
  focusedRow: Record<string, unknown>;
}): WindowMembershipSnapshot {
  const focusedDate = getRowGameDate(args.focusedRow);
  const focusedTeamId = getRowTeamId(args.focusedRow);
  const appearances = new Set(
    args.wgoRows
      .map((row) => row.game_id)
      .filter((gameId): gameId is number => typeof gameId === "number")
  );

  const eligibleGames = args.games.filter((game) => {
    if (game.seasonId !== args.request.season) return false;
    if (focusedTeamId == null) return false;
    if (game.date > (focusedDate ?? "")) return false;
    return game.homeTeamId === focusedTeamId || game.awayTeamId === focusedTeamId;
  });

  return WINDOW_SPECS.reduce((acc, spec) => {
    const slice = eligibleGames.slice(Math.max(0, eligibleGames.length - spec.size));
    acc[spec.key] = {
      windowSize: spec.size,
      selectionMode: "team_games",
      members: slice.map((game) => ({
        rowKey: `${game.date}:team_game:${game.id}`,
        gameId: game.id,
        gameDate: game.date,
        season: game.seasonId,
        teamId: focusedTeamId,
        strength: "team_game",
        source: "team_game",
        occupiesSelectedSlot: true,
        hasPlayerAppearance: appearances.has(game.id)
      }))
    };
    return acc;
  }, {} as WindowMembershipSnapshot);
}

function buildWindowMembership(args: {
  focusedRow: Record<string, unknown> | null;
  formulaMetadata: FormulaMetadata | null;
  storedRows: RollingMetricRow[];
  recomputedRows: Record<string, unknown>[];
  sourceData: ValidationSourceData | null;
  request: RollingPlayerValidationRequest;
}): RollingPlayerValidationPayload["windows"] {
  if (!args.focusedRow) {
    return {
      focusedRowKey: null,
      selectedMetricFamily: args.formulaMetadata?.family ?? null,
      selectedWindowFamily: args.formulaMetadata?.windowFamily ?? null,
      memberships: null
    };
  }

  const rowHistory = args.recomputedRows.length > 0 ? args.recomputedRows : args.storedRows;
  const memberships =
    args.formulaMetadata?.windowFamily === "availability" && args.sourceData
      ? buildAvailabilityWindowMembership({
          games: args.sourceData.games,
          wgoRows: args.sourceData.wgoRows,
          request: args.request,
          focusedRow: args.focusedRow
        })
      : buildAppearanceWindowMembership(
          rowHistory as Record<string, unknown>[],
          args.focusedRow
        );

  return {
    focusedRowKey: getRowKey(args.focusedRow),
    selectedMetricFamily: args.formulaMetadata?.family ?? null,
    selectedWindowFamily: args.formulaMetadata?.windowFamily ?? null,
    memberships
  };
}

function getComparisonFields(args: {
  storedRow: Record<string, unknown> | null;
  recomputedRow: Record<string, unknown> | null;
  selectedMetric: SelectedMetricMetadata;
}): string[] {
  const keys = new Set<string>();
  for (const row of [args.storedRow, args.recomputedRow]) {
    if (!row) continue;
    for (const key of Object.keys(row)) {
      if (key === "updated_at") continue;
      keys.add(key);
    }
  }
  const fields = Array.from(keys).filter((field) => inferMetricFamily(field) !== null);
  const ordered = [
    ...(args.selectedMetric.canonicalField ? [args.selectedMetric.canonicalField] : []),
    ...args.selectedMetric.legacyFields,
    ...args.selectedMetric.supportFields.filter(
      (field) => hasOwnField(args.storedRow, field) || hasOwnField(args.recomputedRow, field)
    ),
    ...fields
  ];
  return Array.from(new Set(ordered));
}

function inferMismatchCauseBucket(args: {
  readiness: RollingPlayerValidationPayload["readiness"];
  sourceTailFreshness: SourceTailFreshnessSummary | null;
  latestStoredGameDate: string | null;
  latestRecomputedGameDate: string | null;
  valuesMatch: boolean | null;
}): ComparisonMismatchCauseBucket | null {
  if (args.valuesMatch !== false) return null;
  if (args.readiness.status === "BLOCKED") {
    if (
      (args.sourceTailFreshness?.blockers.countsTailLag ?? 0) > 0 ||
      (args.sourceTailFreshness?.blockers.ratesTailLag ?? 0) > 0 ||
      (args.sourceTailFreshness?.blockers.countsOiTailLag ?? 0) > 0 ||
      (args.sourceTailFreshness?.blockers.ppTailLag ?? 0) > 0 ||
      (args.sourceTailFreshness?.blockers.lineTailLag ?? 0) > 0
    ) {
      return "stale source";
    }
    return "unresolved verification blocker";
  }
  if (
    args.latestStoredGameDate &&
    args.latestRecomputedGameDate &&
    args.latestStoredGameDate < args.latestRecomputedGameDate
  ) {
    return "stale target";
  }
  return "logic defect";
}

function buildFocusedRowComparisons(args: {
  storedRow: Record<string, unknown> | null;
  recomputedRow: Record<string, unknown> | null;
  selectedMetric: SelectedMetricMetadata;
  selectedMetricField: string | null;
  readiness: RollingPlayerValidationPayload["readiness"];
  sourceTailFreshness: SourceTailFreshnessSummary | null;
  latestStoredGameDate: string | null;
  latestRecomputedGameDate: string | null;
}): NonNullable<RollingPlayerValidationPayload["comparisons"]>["focusedRow"] {
  if (!args.storedRow && !args.recomputedRow) return null;
  type FocusedRowComparisons = NonNullable<
    NonNullable<RollingPlayerValidationPayload["comparisons"]>["focusedRow"]
  >;

  const comparisonFields = getComparisonFields({
    storedRow: args.storedRow,
    recomputedRow: args.recomputedRow,
    selectedMetric: args.selectedMetric
  });
  const comparisonMatrix = comparisonFields.map((field) => {
    const storedValue = args.storedRow?.[field] ?? null;
    const recomputedValue = args.recomputedRow?.[field] ?? null;
    const compared = compareValues(storedValue, recomputedValue);
    return {
      field,
      family: inferMetricFamily(field),
      storedValue,
      recomputedValue,
      signedDiff: compared.signedDiff,
      absoluteDiff: compared.absoluteDiff,
      percentDiff: compared.percentDiff,
      valuesMatch: compared.valuesMatch,
      fieldRole: getFieldRole(field, args.selectedMetric)
    };
  });

  const canonicalVsLegacy = args.selectedMetric.legacyFields.map((field) => {
    const canonicalValue = args.selectedMetric.canonicalField
      ? toDisplayScalar(args.storedRow?.[args.selectedMetric.canonicalField] ?? null)
      : null;
    const legacyValue = toDisplayScalar(args.storedRow?.[field] ?? null);
    return {
      field,
      canonicalValue,
      legacyValue,
      valuesMatch:
        canonicalValue === legacyValue ||
        compareValues(canonicalValue, legacyValue).valuesMatch
    };
  });

  const supportComparisonMap = new Map<
    string,
    FocusedRowComparisons["supportComparisons"][number]
  >();
  const addSupportComparison = (
    field: string,
    storedValue: unknown,
    recomputedValue: unknown
  ) => {
    supportComparisonMap.set(field, {
      field,
      storedValue: toDisplayScalar(storedValue),
      recomputedValue: toDisplayScalar(recomputedValue),
      valuesMatch: compareValues(storedValue, recomputedValue).valuesMatch
    });
  };

  const selectedMetricFieldForSupport =
    args.selectedMetricField ??
    args.selectedMetric.canonicalField ??
    args.selectedMetric.key ??
    null;

  args.selectedMetric.supportFields.forEach((field) => {
    addSupportComparison(
      field,
      resolveSupportFieldValue({
        row: args.storedRow,
        supportField: field,
        selectedMetricField: selectedMetricFieldForSupport
      }),
      resolveSupportFieldValue({
        row: args.recomputedRow,
        supportField: field,
        selectedMetricField: selectedMetricFieldForSupport
      })
    );
  });
  if (
    selectedMetricFieldForSupport &&
    getMetricBaseKey(selectedMetricFieldForSupport) === "on_ice_sv_pct"
  ) {
    const componentScope = getMetricComponentScope(selectedMetricFieldForSupport);
    const shotsAgainstField = componentScope ? `oi_sa_${componentScope}` : null;
    const goalsAgainstField = componentScope ? `oi_ga_${componentScope}` : null;
    const savesField = componentScope
      ? `on_ice_sv_pct_saves_${componentScope}`
      : null;

    const deriveSaves = (row: Record<string, unknown> | null): number | null => {
      if (!row || !shotsAgainstField || !goalsAgainstField) return null;
      const shotsAgainst = row[shotsAgainstField];
      const goalsAgainst = row[goalsAgainstField];
      if (
        typeof shotsAgainst !== "number" ||
        !Number.isFinite(shotsAgainst) ||
        typeof goalsAgainst !== "number" ||
        !Number.isFinite(goalsAgainst)
      ) {
        return null;
      }
      return Number((shotsAgainst - goalsAgainst).toFixed(6));
    };

    if (shotsAgainstField && goalsAgainstField) {
      addSupportComparison(
        shotsAgainstField,
        args.storedRow?.[shotsAgainstField] ?? null,
        args.recomputedRow?.[shotsAgainstField] ?? null
      );
      addSupportComparison(
        goalsAgainstField,
        args.storedRow?.[goalsAgainstField] ?? null,
        args.recomputedRow?.[goalsAgainstField] ?? null
      );
    }
    if (savesField) {
      addSupportComparison(
        savesField,
        deriveSaves(args.storedRow),
        deriveSaves(args.recomputedRow)
      );
    }
  }

  const supportComparisons = Array.from(supportComparisonMap.values());

  const selectedMetricEntry = args.selectedMetricField
    ? comparisonMatrix.find((entry) => entry.field === args.selectedMetricField) ?? null
    : null;

  return {
    storedRowKey: args.storedRow ? getRowKey(args.storedRow) : null,
    recomputedRowKey: args.recomputedRow ? getRowKey(args.recomputedRow) : null,
    selectedMetric: selectedMetricEntry
      ? {
          field: selectedMetricEntry.field,
          storedValue: selectedMetricEntry.storedValue,
          recomputedValue: selectedMetricEntry.recomputedValue,
          diff: selectedMetricEntry.signedDiff,
          absoluteDiff: selectedMetricEntry.absoluteDiff,
          signedDiff: selectedMetricEntry.signedDiff,
          percentDiff: selectedMetricEntry.percentDiff,
          valuesMatch: selectedMetricEntry.valuesMatch,
          mismatchCauseBucket: inferMismatchCauseBucket({
            readiness: args.readiness,
            sourceTailFreshness: args.sourceTailFreshness,
            latestStoredGameDate: args.latestStoredGameDate,
            latestRecomputedGameDate: args.latestRecomputedGameDate,
            valuesMatch: selectedMetricEntry.valuesMatch
          })
        }
      : null,
    comparisonMatrix,
    canonicalVsLegacy,
    supportComparisons
  };
}

function buildFamilyComparisonSummary(args: {
  storedRows: RollingMetricRow[];
  recomputedRows: Record<string, unknown>[];
  selectedMetricFamily: MetricFamilyId | null;
}): NonNullable<RollingPlayerValidationPayload["comparisons"]>["familySummary"] {
  const storedRowMap = new Map(
    args.storedRows.map((row) => [getRowKey(row as unknown as Record<string, unknown>), row])
  );
  const recomputedRowMap = new Map(
    args.recomputedRows.map((row) => [getRowKey(row), row])
  );
  const rowKeys = Array.from(
    new Set([...storedRowMap.keys(), ...recomputedRowMap.keys()].filter(Boolean))
  ) as string[];

  const fieldMap = new Map<
    string,
    {
      field: string;
      family: MetricFamilyId | null;
      mismatchedRows: number;
      comparedRows: number;
      latestStoredValue: unknown;
      latestRecomputedValue: unknown;
      latestDiff: number | null;
      valuesMatch: boolean;
    }
  >();

  let mismatchRowCount = 0;

  for (const rowKey of rowKeys) {
    const storedRow = storedRowMap.get(rowKey) as Record<string, unknown> | undefined;
    const recomputedRow = recomputedRowMap.get(rowKey);
    const fieldKeys = new Set<string>();
    for (const row of [storedRow, recomputedRow]) {
      if (!row) continue;
      for (const key of Object.keys(row)) {
        if (key === "updated_at") continue;
        fieldKeys.add(key);
      }
    }

    let rowHasMismatch = false;
    for (const field of fieldKeys) {
      const family = inferMetricFamily(field);
      if (args.selectedMetricFamily && family !== args.selectedMetricFamily) continue;
      const storedValue = storedRow?.[field] ?? null;
      const recomputedValue = recomputedRow?.[field] ?? null;
      const compared = compareValues(storedValue, recomputedValue);
      const existing = fieldMap.get(field);
      fieldMap.set(field, {
        field,
        family,
        mismatchedRows: (existing?.mismatchedRows ?? 0) + (compared.valuesMatch ? 0 : 1),
        comparedRows: (existing?.comparedRows ?? 0) + 1,
        latestStoredValue: storedValue,
        latestRecomputedValue: recomputedValue,
        latestDiff: compared.signedDiff,
        valuesMatch: compared.valuesMatch
      });
      if (!compared.valuesMatch) rowHasMismatch = true;
    }
    if (rowHasMismatch) mismatchRowCount += 1;
  }

  const metrics = Array.from(fieldMap.values()).sort((left, right) => {
    if (left.mismatchedRows !== right.mismatchedRows) {
      return right.mismatchedRows - left.mismatchedRows;
    }
    return left.field.localeCompare(right.field);
  });

  return {
    selectedMetricFamily: args.selectedMetricFamily,
    rowCountCompared: rowKeys.length,
    fieldCountCompared: metrics.length,
    mismatchFieldCount: metrics.filter((metric) => metric.mismatchedRows > 0).length,
    mismatchRowCount,
    metrics
  };
}

function buildToiTraceRows(mergedGames: MergedGameRow[]): ToiTraceRow[] {
  return mergedGames.map((game, index) => {
    const countsToi = toNumberOrNull(game.counts?.toi ?? null);
    const countsOiToi = toNumberOrNull(game.countsOi?.toi ?? null);
    const ratesToiPerGp = toNumberOrNull(game.rates?.toi_per_gp ?? null);
    const wgoToiPerGame = toNumberOrNull(game.wgo?.toi_per_game ?? null);

    const fallbackSeed = resolveFallbackToiSeed({
      countsToi,
      countsOiToi,
      wgoToiPerGame
    });
    const resolved = resolveRollingPlayerToiContext({
      countsToi,
      countsOiToi,
      ratesToiPerGp,
      fallbackToiSeconds: fallbackSeed.fallbackToiSeconds,
      wgoToiPerGame
    });
    const normalizedWgo = normalizeWgoToiPerGame({
      toiPerGame: wgoToiPerGame
    });

    const suspiciousNotes = [
      ...fallbackSeed.rejections.map(
        (entry) => `fallback-seed ${entry.source} rejected: ${entry.reason}`
      ),
      ...resolved.rejectedCandidates.map(
        (entry) => `resolved ${entry.source} rejected: ${entry.reason}`
      )
    ];

    if (normalizedWgo.rejection) {
      suspiciousNotes.push(`wgo normalization rejected: ${normalizedWgo.rejection}`);
    }

    return {
      rowKey: getRowKey(game as unknown as Record<string, unknown>) ??
        `${game.gameDate}:${game.strength}:${game.gameId ?? index}`,
      gameId: game.gameId ?? null,
      gameDate: game.gameDate,
      strength: game.strength,
      rawCandidates: {
        countsToi,
        countsOiToi,
        ratesToiPerGp,
        wgoToiPerGame
      },
      fallbackSeed: {
        seconds: fallbackSeed.fallbackToiSeconds,
        source: fallbackSeed.source,
        rejectedCandidates: fallbackSeed.rejections.map((entry) => ({
          source: entry.source,
          reason: entry.reason
        })),
        wgoNormalization: fallbackSeed.wgoNormalization
      },
      resolved: {
        seconds: resolved.seconds,
        source: resolved.source,
        trustTier: resolved.trustTier,
        rejectedCandidates: resolved.rejectedCandidates.map((entry) => ({
          source: entry.source,
          reason: entry.reason
        })),
        wgoNormalization: resolved.wgoNormalization
      },
      suspiciousNotes
    };
  });
}

function inferTeamPpToi(args: {
  playerPpToi: number | null;
  share: number | null;
}): number | null {
  if (
    args.playerPpToi == null ||
    !Number.isFinite(args.playerPpToi) ||
    args.playerPpToi < 0
  ) {
    return null;
  }
  if (args.share == null || !Number.isFinite(args.share) || args.share <= 0) {
    return null;
  }
  return Number((args.playerPpToi / args.share).toFixed(6));
}

function buildPpShareTraceRows(mergedGames: MergedGameRow[]): PpShareTraceRow[] {
  return mergedGames.map((game, index) => {
    const builderPlayerPpToi = toNumberOrNull(game.ppCombination?.PPTOI ?? null);
    const builderShare = toNumberOrNull(
      game.ppCombination?.pp_share_of_team ?? null
    );
    const wgoPlayerPpToi = toNumberOrNull(game.wgo?.pp_toi ?? null);
    const wgoShare = toNumberOrNull(game.wgo?.pp_toi_pct_per_game ?? null);

    const builderTeamPpToi = inferTeamPpToi({
      playerPpToi: builderPlayerPpToi,
      share: builderShare
    });
    const wgoTeamPpToi = inferTeamPpToi({
      playerPpToi: wgoPlayerPpToi,
      share: wgoShare
    });

    const chosenSource: PpShareSource =
      builderTeamPpToi != null ? "builder" : wgoTeamPpToi != null ? "wgo" : "missing";

    return {
      rowKey: getRowKey(game as unknown as Record<string, unknown>) ??
        `${game.gameDate}:${game.strength}:${game.gameId ?? index}`,
      gameId: game.gameId ?? null,
      gameDate: game.gameDate,
      strength: game.strength,
      builder: {
        playerPpToi: builderPlayerPpToi,
        share: builderShare,
        teamPpToiInferred: builderTeamPpToi,
        valid: builderTeamPpToi != null
      },
      wgo: {
        playerPpToi: wgoPlayerPpToi,
        share: wgoShare,
        teamPpToiInferred: wgoTeamPpToi,
        valid: wgoTeamPpToi != null
      },
      chosen: {
        source: chosenSource,
        playerPpToi:
          chosenSource === "builder"
            ? builderPlayerPpToi
            : chosenSource === "wgo"
              ? wgoPlayerPpToi
              : null,
        share:
          chosenSource === "builder"
            ? builderShare
            : chosenSource === "wgo"
              ? wgoShare
              : null,
        teamPpToiInferred:
          chosenSource === "builder"
            ? builderTeamPpToi
            : chosenSource === "wgo"
              ? wgoTeamPpToi
              : null
      }
    };
  });
}

function buildPpShareWindowSummary(args: {
  focusedRow: Record<string, unknown> | null;
  ppShareTraceRows: PpShareTraceRow[];
}): PpShareWindowSummary | null {
  if (!args.focusedRow || args.ppShareTraceRows.length === 0) return null;

  const focusedRowKey = getRowKey(args.focusedRow);
  const focusedIndex = args.ppShareTraceRows.findIndex(
    (row) => row.rowKey === focusedRowKey
  );
  if (focusedIndex < 0) return null;

  return WINDOW_SPECS.reduce((acc, spec) => {
    const slice = args.ppShareTraceRows.slice(
      Math.max(0, focusedIndex - (spec.size - 1)),
      focusedIndex + 1
    );
    const sourcesUsed = Array.from(
      new Set(slice.map((row) => row.chosen.source).filter(Boolean))
    ) as PpShareSource[];
    acc[spec.key] = {
      windowSize: spec.size,
      sourcesUsed,
      mixedSourceWindow:
        sourcesUsed.filter((source) => source !== "missing").length > 1,
      missingSourceGameIds: slice
        .filter((row) => row.chosen.source === "missing" && row.gameId != null)
        .map((row) => row.gameId as number),
      memberSources: slice.map((row) => ({
        rowKey: row.rowKey,
        gameId: row.gameId,
        gameDate: row.gameDate,
        source: row.chosen.source
      }))
    };
    return acc;
  }, {} as PpShareWindowSummary);
}

function buildReadiness(args: {
  recomputeError: string | null;
  coverage: CoverageSummary | null;
  sourceTailFreshness: SourceTailFreshnessSummary | null;
  suspiciousOutputs: SuspiciousOutputsSummary | null;
  storedRows: RollingMetricRow[];
  recomputedRows: Record<string, unknown>[];
}): RollingPlayerValidationPayload["readiness"] {
  const blockerReasons: string[] = [];
  const cautionReasons: string[] = [];

  if (args.recomputeError) {
    blockerReasons.push(`Recompute failed: ${args.recomputeError}`);
  }

  const freshness = args.sourceTailFreshness;
  if (freshness) {
    if (freshness.blockers.countsTailLag > 0) {
      blockerReasons.push(
        `NST counts tail lag: ${freshness.blockers.countsTailLag}`
      );
    }
    if (freshness.blockers.ratesTailLag > 0) {
      blockerReasons.push(
        `NST rates tail lag: ${freshness.blockers.ratesTailLag}`
      );
    }
    if (freshness.blockers.countsOiTailLag > 0) {
      blockerReasons.push(
        `NST on-ice counts tail lag: ${freshness.blockers.countsOiTailLag}`
      );
    }
    if (freshness.blockers.ppTailLag > 0) {
      blockerReasons.push(
        `PP builder tail lag: ${freshness.blockers.ppTailLag}`
      );
    }
    if (freshness.blockers.lineTailLag > 0) {
      blockerReasons.push(
        `Line-combination tail lag: ${freshness.blockers.lineTailLag}`
      );
    }
  }

  if (args.coverage?.counts.unknownGameIds && args.coverage.counts.unknownGameIds > 0) {
    blockerReasons.push(
      `Unknown game IDs detected: ${args.coverage.counts.unknownGameIds}`
    );
  }

  if (args.coverage?.warnings.length) {
    cautionReasons.push(...args.coverage.warnings);
  }

  const ppCoverage = args.coverage?.ppCoverage ?? null;
  if (
    ppCoverage &&
    ppCoverage.latestBuilderGameCovered &&
    !ppCoverage.windowBuilderCoverageComplete
  ) {
    cautionReasons.push(
      `PP builder latest game is covered, but the selected window is still missing builder rows: ${ppCoverage.missingPpGameIds.join(", ")}`
    );
  }
  if (
    ppCoverage &&
    ppCoverage.latestShareGameCovered &&
    !ppCoverage.windowShareCoverageComplete
  ) {
    cautionReasons.push(
      `PP share latest game is covered, but the selected window is still missing share coverage: ${ppCoverage.missingPpShareGameIds.join(", ")}`
    );
  }

  if (args.suspiciousOutputs?.issueCount && args.suspiciousOutputs.issueCount > 0) {
    cautionReasons.push(
      `Suspicious output checks found ${args.suspiciousOutputs.issueCount} issue(s)`
    );
  }

  if (args.storedRows.length === 0) {
    cautionReasons.push("No stored rolling rows matched the selected scope");
  }
  if (args.recomputedRows.length === 0 && !args.recomputeError) {
    cautionReasons.push("No recomputed rolling rows matched the selected scope");
  }

  let nextRecommendedAction: string | null = null;
  if (args.recomputeError) {
    nextRecommendedAction = "Fix the rolling validation recompute path before trusting comparisons.";
  } else if (freshness && freshness.blockers.countsTailLag > 0) {
    nextRecommendedAction = "Refresh the NST counts tail for the selected validation slice.";
  } else if (freshness && freshness.blockers.ratesTailLag > 0) {
    nextRecommendedAction = "Refresh the NST rates tail for the selected validation slice.";
  } else if (freshness && freshness.blockers.countsOiTailLag > 0) {
    nextRecommendedAction = "Refresh the NST on-ice counts tail for the selected validation slice.";
  } else if (freshness && freshness.blockers.ppTailLag > 0) {
    nextRecommendedAction = "Refresh power-play combination rows before validating PP context metrics.";
  } else if (
    ppCoverage &&
    ((!ppCoverage.windowBuilderCoverageComplete &&
      ppCoverage.latestBuilderGameCovered) ||
      (!ppCoverage.windowShareCoverageComplete &&
        ppCoverage.latestShareGameCovered))
  ) {
    nextRecommendedAction =
      "Inspect PP builder/share coverage gaps before treating PP validation as signoff-ready.";
  } else if (freshness && freshness.blockers.lineTailLag > 0) {
    nextRecommendedAction = "Refresh line-combination rows before validating line-context fields.";
  } else if (args.storedRows.length === 0) {
    nextRecommendedAction = "Recompute and upsert rolling rows for the selected player and season.";
  }

  return {
    status:
      blockerReasons.length > 0
        ? "BLOCKED"
        : cautionReasons.length > 0
          ? "READY_WITH_CAUTIONS"
          : "READY",
    blockerReasons,
    cautionReasons,
    nextRecommendedAction
  };
}

function buildDiagnosticsSnapshot(args: {
  coverage: CoverageSummary | null;
  sourceTailFreshness: SourceTailFreshnessSummary | null;
  derivedWindowCompleteness: DerivedWindowSummary | null;
  suspiciousOutputs: SuspiciousOutputsSummary | null;
  targetFreshness: RollingPlayerValidationPayload["diagnostics"] extends infer T
    ? T extends { targetFreshness: infer U }
      ? Exclude<U, null>
      : never
    : never | null;
  selectedMetricFamily?: MetricFamilyId | null;
  selectedMetricBaseKey?: string | null;
}): DiagnosticsSnapshot | null {
  const targetFreshness = args.targetFreshness ?? null;
  const coverageWarningCount = args.coverage?.warnings.length ?? 0;
  const unknownGameIds = args.coverage?.counts.unknownGameIds ?? 0;
  const ppCoverage = args.coverage?.ppCoverage ?? null;
  const ppCoverageHasGap =
    (ppCoverage?.missingPpGameIds.length ?? 0) > 0 ||
    (ppCoverage?.missingPpShareGameIds.length ?? 0) > 0;
  const coverageHighlights = [
    coverageWarningCount > 0
      ? `${coverageWarningCount} coverage warning(s) present`
      : null,
    unknownGameIds > 0 ? `${unknownGameIds} unknown game ID(s) detected` : null,
    ppCoverage && ppCoverage.latestBuilderGameCovered && !ppCoverage.windowBuilderCoverageComplete
      ? `latest PP game covered, but builder window coverage is incomplete: ${ppCoverage.missingPpGameIds.join(", ")}`
      : null,
    ppCoverage && ppCoverage.latestShareGameCovered && !ppCoverage.windowShareCoverageComplete
      ? `latest PP share game covered, but share window coverage is incomplete: ${ppCoverage.missingPpShareGameIds.join(", ")}`
      : null
  ].filter((value): value is string => Boolean(value));
  const coverageStatus: DiagnosticsSectionStatus =
    unknownGameIds > 0
      ? "blocked"
      : coverageWarningCount > 0 || ppCoverageHasGap
        ? "caution"
        : "clean";

  const freshnessBlockers = args.sourceTailFreshness?.blockers ?? null;
  const freshnessEntries = freshnessBlockers
    ? ([
        ["counts", freshnessBlockers.countsTailLag],
        ["rates", freshnessBlockers.ratesTailLag],
        ["counts_oi", freshnessBlockers.countsOiTailLag],
        ["pp", freshnessBlockers.ppTailLag],
        ["line", freshnessBlockers.lineTailLag]
      ] as Array<[string, number]>).filter((entry) => entry[1] > 0)
    : [];
  const freshnessHighlights = freshnessEntries.map(
    ([label, value]) => `${label} tail lag ${value}`
  );
  const freshnessStatus: DiagnosticsSectionStatus =
    freshnessEntries.length > 0 ? "blocked" : "clean";

  const gpScopes = args.derivedWindowCompleteness?.gpWindows ?? null;
  const impactedGpScopes = gpScopes
    ? Object.entries(gpScopes)
        .filter(([, summary]) => summary.partial > 0 || summary.absent > 0 || summary.invalid > 0)
        .map(([scope]) => scope)
    : [];
  const gpIssueCount = gpScopes
    ? Object.values(gpScopes).reduce(
        (total, summary) =>
          total + summary.partial + summary.absent + summary.invalid,
        0
      )
    : 0;

  const ratioWindows = args.derivedWindowCompleteness?.ratioWindows ?? null;
  const impactedRatioFamilies = ratioWindows
    ? Object.entries(ratioWindows)
        .filter(([, windowMap]) =>
          Object.values(windowMap).some(
            (summary) =>
              summary.partial > 0 ||
              summary.absent > 0 ||
              summary.invalid > 0 ||
              summary.valuePresentWithoutComponents > 0
          )
        )
        .map(([family]) => family)
    : [];
  const ratioIssueCount = ratioWindows
    ? Object.values(ratioWindows).reduce(
        (total, windowMap) =>
          total +
          Object.values(windowMap).reduce(
            (windowTotal, summary) =>
              windowTotal +
              summary.partial +
              summary.absent +
              summary.invalid +
              summary.valuePresentWithoutComponents,
            0
          ),
        0
      )
    : 0;
  const completenessHighlights = [
    gpIssueCount > 0 ? `${gpIssueCount} GP support completeness issue(s)` : null,
    ratioIssueCount > 0
      ? `${ratioIssueCount} ratio support completeness issue(s)`
      : null,
    impactedGpScopes.length > 0
      ? `impacted GP scopes: ${impactedGpScopes.join(", ")}`
      : null,
    impactedRatioFamilies.length > 0
      ? `impacted ratio families: ${impactedRatioFamilies.join(", ")}`
      : null
  ].filter((value): value is string => Boolean(value));
  const completenessStatus: DiagnosticsSectionStatus =
    gpIssueCount > 0 || ratioIssueCount > 0 ? "caution" : "clean";

  function toRatioWindowSnapshot(summary: {
    complete: number;
    partial: number;
    absent: number;
    invalid: number;
    valuePresentWithoutComponents: number;
  }): RatioWindowCompletenessSnapshot {
    const state: RatioCompletenessState =
      summary.invalid > 0
        ? "invalid"
        : summary.partial > 0
          ? "partial"
          : summary.valuePresentWithoutComponents > 0
            ? "valuePresentWithoutComponents"
            : summary.absent > 0
              ? "absent"
              : "complete";
    return {
      state,
      counts: {
        complete: summary.complete,
        partial: summary.partial,
        absent: summary.absent,
        invalid: summary.invalid,
        valuePresentWithoutComponents: summary.valuePresentWithoutComponents
      }
    };
  }

  const ratioFamilies = ratioWindows
    ? Object.fromEntries(
        Object.entries(ratioWindows).map(([family, windowMap]) => [
          family,
          Object.fromEntries(
            Object.entries(windowMap).map(([windowKey, summary]) => [
              windowKey,
              toRatioWindowSnapshot(summary)
            ])
          )
        ])
      )
    : {};

  const selectedRatioFamily =
    args.selectedMetricFamily && args.selectedMetricFamily === "pp_usage"
      ? "pp_share_pct"
      : args.selectedMetricBaseKey && args.selectedMetricBaseKey in (ratioWindows ?? {})
        ? (args.selectedMetricBaseKey as keyof DerivedWindowSummary["ratioWindows"])
        : null;
  const selectedMetricStates =
    selectedRatioFamily && ratioWindows?.[selectedRatioFamily]
      ? (Object.fromEntries(
          Object.entries(ratioWindows[selectedRatioFamily]).map(([windowKey, summary]) => [
            windowKey,
            toRatioWindowSnapshot(summary)
          ])
        ) as Record<"last3" | "last5" | "last10" | "last20", RatioWindowCompletenessSnapshot>)
      : null;

  const suspiciousIssueCount = args.suspiciousOutputs?.issueCount ?? 0;
  const suspiciousWarningCount = args.suspiciousOutputs?.warnings.length ?? 0;
  const suspiciousHighlights = [
    suspiciousIssueCount > 0
      ? `${suspiciousIssueCount} suspicious output issue(s)`
      : null
  ].filter((value): value is string => Boolean(value));
  const suspiciousStatus: DiagnosticsSectionStatus =
    suspiciousIssueCount > 0 ? "caution" : "clean";

  const targetFreshnessHighlights = [
    targetFreshness && targetFreshness.storedRowCount === 0
      ? "No stored rows matched the selected scope"
      : null,
    targetFreshness && targetFreshness.recomputedRowCount === 0
      ? "No recomputed rows matched the selected scope"
      : null,
    targetFreshness &&
    targetFreshness.latestStoredGameDate &&
    targetFreshness.latestRecomputedGameDate &&
    targetFreshness.latestStoredGameDate !== targetFreshness.latestRecomputedGameDate
      ? `stored/recomputed latest-date mismatch: ${targetFreshness.latestStoredGameDate} vs ${targetFreshness.latestRecomputedGameDate}`
      : null
  ].filter((value): value is string => Boolean(value));
  const targetFreshnessStatus: DiagnosticsSectionStatus =
    targetFreshness &&
    (targetFreshness.storedRowCount === 0 || targetFreshness.recomputedRowCount === 0)
      ? "blocked"
      : targetFreshnessHighlights.length > 0
        ? "caution"
        : "clean";

  const categories = {
    coverage: {
      status: coverageStatus,
      issueCount:
        coverageWarningCount +
        unknownGameIds +
        (ppCoverage?.missingPpGameIds.length ?? 0) +
        (ppCoverage?.missingPpShareGameIds.length ?? 0),
      highlights: coverageHighlights,
      warningCount: coverageWarningCount,
      unknownGameIds,
      ppCoverage: {
        latestExpectedPpGameId: ppCoverage?.latestExpectedPpGameId ?? null,
        latestBuilderGameCovered: ppCoverage?.latestBuilderGameCovered ?? true,
        latestShareGameCovered: ppCoverage?.latestShareGameCovered ?? true,
        windowBuilderCoverageComplete:
          ppCoverage?.windowBuilderCoverageComplete ?? true,
        windowShareCoverageComplete:
          ppCoverage?.windowShareCoverageComplete ?? true,
        missingPpGameIds: ppCoverage?.missingPpGameIds ?? [],
        missingPpShareGameIds: ppCoverage?.missingPpShareGameIds ?? []
      }
    },
    freshness: {
      status: freshnessStatus,
      issueCount: freshnessEntries.length,
      highlights: freshnessHighlights,
      blockers: freshnessBlockers,
      latest: args.sourceTailFreshness?.latest ?? null
    },
    completeness: {
      status: completenessStatus,
      issueCount: gpIssueCount + ratioIssueCount,
      highlights: completenessHighlights,
      gpIssueCount,
      ratioIssueCount,
      impactedGpScopes,
      impactedRatioFamilies,
      ratioFamilies,
      selectedMetric: {
        family: selectedRatioFamily,
        states: selectedMetricStates
      }
    },
    suspiciousOutputs: {
      status: suspiciousStatus,
      issueCount: suspiciousIssueCount,
      highlights: suspiciousHighlights,
      warningCount: suspiciousWarningCount
    },
    targetFreshness: {
      status: targetFreshnessStatus,
      issueCount: targetFreshnessHighlights.length,
      highlights: targetFreshnessHighlights,
      latestStoredGameDate: targetFreshness?.latestStoredGameDate ?? null,
      latestRecomputedGameDate: targetFreshness?.latestRecomputedGameDate ?? null,
      latestSourceDate: targetFreshness?.latestSourceDate ?? null,
      storedRowCount: targetFreshness?.storedRowCount ?? 0,
      recomputedRowCount: targetFreshness?.recomputedRowCount ?? 0
    }
  };

  const blockerCount = Object.values(categories).filter(
    (category) => category.status === "blocked"
  ).length;
  const cautionCount = Object.values(categories).filter(
    (category) => category.status === "caution"
  ).length;
  const highlights = Object.values(categories).flatMap((category) =>
    category.highlights.slice(0, 2)
  );

  return {
    overallStatus:
      blockerCount > 0 ? "blocked" : cautionCount > 0 ? "caution" : "clean",
    blockerCount,
    cautionCount,
    highlights,
    categories
  };
}

async function fetchPlayer(playerId: number): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position")
    .eq("id", playerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PlayerRow | null) ?? null;
}

async function fetchStoredRows(
  request: RollingPlayerValidationRequest
): Promise<RollingMetricRow[]> {
  let query = supabase
    .from("rolling_player_game_metrics")
    .select("*")
    .eq("player_id", request.playerId)
    .eq("season", request.season)
    .eq("strength_state", request.strength)
    .order("game_date", { ascending: true });

  if (typeof request.teamId === "number") {
    query = query.eq("team_id", request.teamId);
  }
  if (request.startDate) {
    query = query.gte("game_date", request.startDate);
  }
  if (request.endDate) {
    query = query.lte("game_date", request.endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data as RollingMetricRow[] | null) ?? []).sort((left, right) =>
    left.game_date.localeCompare(right.game_date)
  );
}

export async function buildRollingPlayerValidationPayload(
  request: RollingPlayerValidationRequest
): Promise<RollingPlayerValidationPayload> {
  const includeStoredRows = request.includeStoredRows ?? true;
  const includeRecomputedRows = request.includeRecomputedRows ?? true;
  const includeSourceRows = request.includeSourceRows ?? true;
  const includeDiagnostics = request.includeDiagnostics ?? true;
  const includeWindowMembership = request.includeWindowMembership ?? true;
  const includeContractMetadata = request.includeContractMetadata ?? true;
  const includeComparisons = request.includeComparisons ?? true;

  const [player, sourceData, storedRows] = await Promise.all([
    fetchPlayer(request.playerId),
    includeSourceRows || includeDiagnostics || includeWindowMembership
      ? fetchPlayerValidationSourceData(request)
      : Promise.resolve(null),
    includeStoredRows || includeComparisons || includeWindowMembership
      ? fetchStoredRows(request)
      : Promise.resolve([])
  ]);

  let recomputeRows: Record<string, unknown>[] = [];
  let recomputeError: string | null = null;
  if (
    includeRecomputedRows ||
    includeDiagnostics ||
    includeComparisons ||
    includeWindowMembership
  ) {
    try {
      const recomputed = await recomputePlayerRowsForValidation({
        playerId: request.playerId,
        season: request.season,
        startDate: request.startDate,
        endDate: request.endDate,
        skipDiagnostics: false
      });
      recomputeRows = filterRowsForRequest(
        (recomputed.rows ?? []) as Record<string, unknown>[],
        request
      );
    } catch (error) {
      recomputeError =
        error instanceof Error ? error.message : "Unknown recompute error";
    }
  }

  const filteredStoredRows = filterRowsForRequest(storedRows, request);
  const focusedStoredRow = pickFocusedRow(filteredStoredRows, request);
  const focusedRecomputedRow = pickFocusedRow(recomputeRows, request);
  const focusedRow = focusedStoredRow ?? focusedRecomputedRow;
  const selectedMetric = inferMetricMetadata(
    focusedRow as Record<string, unknown> | null,
    request.metric,
    request.metricFamily
  );
  const formulaMetadata = buildFormulaMetadata(selectedMetric);

  const selectedStrengthData = sourceData?.byStrength[request.strength] ?? null;
  const ppShareTraceRows = selectedStrengthData
    ? buildPpShareTraceRows(selectedStrengthData.mergedGames)
    : [];
  const latestStoredGameDate = filteredStoredRows.at(-1)?.game_date ?? null;
  const latestRecomputedGameDate = getRowGameDate(recomputeRows.at(-1) ?? {});
  const diagnostics =
    includeDiagnostics && selectedStrengthData
      ? {
          coverage: selectedStrengthData.coverageSummary,
          sourceTailFreshness: selectedStrengthData.sourceTailFreshness,
          derivedWindowCompleteness: summarizeDerivedWindowDiagnostics({
            rows: recomputeRows
          }),
          suspiciousOutputs: summarizeSuspiciousOutputs({
            playerId: request.playerId,
            strength: request.strength,
            rows: recomputeRows
          }),
          targetFreshness: {
            latestStoredGameDate,
            latestRecomputedGameDate,
            latestSourceDate: sourceData?.wgoRows.at(-1)?.date ?? null,
            storedRowCount: filteredStoredRows.length,
            recomputedRowCount: recomputeRows.length
          },
          snapshot: null as DiagnosticsSnapshot | null
        }
      : null;
  if (diagnostics) {
    diagnostics.snapshot = buildDiagnosticsSnapshot({
      coverage: diagnostics.coverage,
      sourceTailFreshness: diagnostics.sourceTailFreshness,
      derivedWindowCompleteness: diagnostics.derivedWindowCompleteness,
      suspiciousOutputs: diagnostics.suspiciousOutputs,
      targetFreshness: diagnostics.targetFreshness,
      selectedMetricFamily: formulaMetadata?.family ?? null,
      selectedMetricBaseKey: formulaMetadata?.baseKey ?? null
    });
  }
  const readiness = buildReadiness({
    recomputeError,
    coverage: diagnostics?.coverage ?? null,
    sourceTailFreshness: diagnostics?.sourceTailFreshness ?? null,
    suspiciousOutputs: diagnostics?.suspiciousOutputs ?? null,
    storedRows: filteredStoredRows,
    recomputedRows: recomputeRows
  });

  const selectedMetricField =
    request.metric && focusedStoredRow && request.metric in focusedStoredRow
      ? request.metric
      : request.metric && focusedRecomputedRow && request.metric in focusedRecomputedRow
        ? request.metric
        : selectedMetric.canonicalField;
  const storedMetricValue =
    selectedMetricField && focusedStoredRow
      ? (focusedStoredRow as Record<string, unknown>)[selectedMetricField]
      : null;
  const recomputedMetricValue =
    selectedMetricField && focusedRecomputedRow
      ? focusedRecomputedRow[selectedMetricField]
      : null;

  return {
    generatedAt: new Date().toISOString(),
    request: {
      playerId: request.playerId,
      season: request.season,
      strength: request.strength,
      teamId: request.teamId ?? null,
      gameId: request.gameId ?? null,
      gameDate: request.gameDate ?? null,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
      metric: request.metric ?? null,
      metricFamily: request.metricFamily ?? null
    },
    selected: {
      player: player
        ? {
            id: Number(player.id),
            fullName: player.fullName,
            position: player.position ?? null
          }
        : null,
      focusedRow: focusedRow
        ? {
            rowKey: getRowKey(focusedRow as Record<string, unknown>) ?? "unknown-row",
            gameId: getRowGameId(focusedRow as Record<string, unknown>),
            gameDate:
              getRowGameDate(focusedRow as Record<string, unknown>) ?? "unknown-date",
            strength:
              getRowStrength(focusedRow as Record<string, unknown>) ?? request.strength,
            season: getRowSeason(focusedRow as Record<string, unknown>),
            teamId: getRowTeamId(focusedRow as Record<string, unknown>)
          }
        : null,
      metric: selectedMetric
    },
    readiness,
    stored: includeStoredRows
      ? {
          focusedRow: focusedStoredRow ?? null,
          rowHistory: filteredStoredRows
        }
      : null,
    recomputed: includeRecomputedRows || includeDiagnostics
      ? {
          focusedRow: focusedRecomputedRow ?? null,
          rowHistory: recomputeRows,
          error: recomputeError
        }
      : null,
    sourceRows: includeSourceRows && sourceData
        ? {
            shared: {
            wgoRows: sourceData.wgoRows as unknown as Record<string, unknown>[],
            ppRows: sourceData.ppRows as unknown as Record<string, unknown>[],
            lineRows: sourceData.lineRows as unknown as Record<string, unknown>[],
            games: sourceData.games as unknown as Record<string, unknown>[]
          },
          selectedStrength: selectedStrengthData
            ? {
                countsRows:
                  selectedStrengthData.countsRows as unknown as Record<string, unknown>[],
                ratesRows:
                  selectedStrengthData.ratesRows as unknown as Record<string, unknown>[],
                countsOiRows:
                  selectedStrengthData.countsOiRows as unknown as Record<string, unknown>[],
                mergedGames:
                  selectedStrengthData.mergedGames as unknown as Record<string, unknown>[],
                toiTraceRows: buildToiTraceRows(selectedStrengthData.mergedGames),
                ppShareTraceRows,
                ppShareWindowSummary: buildPpShareWindowSummary({
                  focusedRow: focusedRow as Record<string, unknown> | null,
                  ppShareTraceRows
                })
              }
            : null
        }
      : null,
    diagnostics,
    contracts: includeContractMetadata
      ? buildContractMetadata(formulaMetadata)
      : null,
    formulas: includeContractMetadata
      ? {
          selectedMetric: formulaMetadata
        }
      : null,
    windows: includeWindowMembership
      ? buildWindowMembership({
          focusedRow: focusedRow as Record<string, unknown> | null,
          formulaMetadata,
          storedRows: filteredStoredRows,
          recomputedRows: recomputeRows,
          sourceData,
          request
        })
      : null,
    comparisons:
      includeComparisons && (focusedStoredRow || focusedRecomputedRow)
        ? {
            familySummary: buildFamilyComparisonSummary({
              storedRows: filteredStoredRows,
              recomputedRows: recomputeRows,
              selectedMetricFamily: formulaMetadata?.family ?? null
            }),
            focusedRow: buildFocusedRowComparisons({
              storedRow: focusedStoredRow as Record<string, unknown> | null,
              recomputedRow: focusedRecomputedRow,
              selectedMetric,
              selectedMetricField: selectedMetricField ?? null,
              readiness,
              sourceTailFreshness: diagnostics?.sourceTailFreshness ?? null,
              latestStoredGameDate,
              latestRecomputedGameDate
            })
          }
        : null,
    helpers: null
  };
}

export const __testables = {
  filterRowsForRequest,
  pickFocusedRow,
  inferMetricMetadata,
  buildReadiness,
  buildDiagnosticsSnapshot,
  inferMetricFamily,
  getMetricBaseKey,
  buildFormulaMetadata,
  buildContractMetadata,
  buildWindowMembership,
  buildToiTraceRows,
  buildPpShareTraceRows,
  buildPpShareWindowSummary,
  buildFocusedRowComparisons,
  buildFamilyComparisonSummary
};
