import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import {
  fetchPlayerValidationSourceData,
  recomputePlayerRowsForValidation,
  type StrengthState
} from "./fetchRollingPlayerAverages";
import {
  summarizeDerivedWindowDiagnostics,
  summarizeSuspiciousOutputs
} from "./rollingPlayerPipelineDiagnostics";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type RollingMetricRow =
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"];
type ValidationSourceData = Awaited<
  ReturnType<typeof fetchPlayerValidationSourceData>
>;
type CoverageSummary = ValidationSourceData["byStrength"][StrengthState]["coverageSummary"];
type SourceTailFreshnessSummary =
  ValidationSourceData["byStrength"][StrengthState]["sourceTailFreshness"];
type SuspiciousOutputsSummary = ReturnType<typeof summarizeSuspiciousOutputs>;
type DerivedWindowSummary = ReturnType<typeof summarizeDerivedWindowDiagnostics>;

type SelectedMetricMetadata = {
  key: string | null;
  family: string | null;
  canonicalField: string | null;
  legacyFields: string[];
  supportFields: string[];
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
  } | null;
  contracts: null;
  formulas: null;
  windows: null;
  comparisons: {
    focusedRow: {
      storedRowKey: string | null;
      recomputedRowKey: string | null;
      selectedMetric: {
        field: string | null;
        storedValue: unknown;
        recomputedValue: unknown;
        diff: number | null;
      } | null;
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

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const supportFields = keys.filter((field) => {
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

  return {
    key: metricKey,
    family: metricFamily ?? null,
    canonicalField,
    legacyFields,
    supportFields
  };
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

  const [player, sourceData, storedRows] = await Promise.all([
    fetchPlayer(request.playerId),
    includeSourceRows || includeDiagnostics
      ? fetchPlayerValidationSourceData(request)
      : Promise.resolve(null),
    includeStoredRows ? fetchStoredRows(request) : Promise.resolve([])
  ]);

  let recomputeRows: Record<string, unknown>[] = [];
  let recomputeError: string | null = null;
  if (includeRecomputedRows || includeDiagnostics) {
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

  const selectedStrengthData = sourceData?.byStrength[request.strength] ?? null;
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
            latestStoredGameDate:
              filteredStoredRows.at(-1)?.game_date ?? null,
            latestRecomputedGameDate: getRowGameDate(
              recomputeRows.at(-1) ?? {}
            ),
            latestSourceDate: sourceData?.wgoRows.at(-1)?.date ?? null,
            storedRowCount: filteredStoredRows.length,
            recomputedRowCount: recomputeRows.length
          }
        }
      : null;

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
    readiness: buildReadiness({
      recomputeError,
      coverage: diagnostics?.coverage ?? null,
      sourceTailFreshness: diagnostics?.sourceTailFreshness ?? null,
      suspiciousOutputs: diagnostics?.suspiciousOutputs ?? null,
      storedRows: filteredStoredRows,
      recomputedRows: recomputeRows
    }),
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
                  selectedStrengthData.mergedGames as unknown as Record<string, unknown>[]
              }
            : null
        }
      : null,
    diagnostics,
    contracts: null,
    formulas: null,
    windows: null,
    comparisons:
      focusedStoredRow || focusedRecomputedRow
        ? {
            focusedRow: {
              storedRowKey: focusedStoredRow ? getRowKey(focusedStoredRow) : null,
              recomputedRowKey: focusedRecomputedRow
                ? getRowKey(focusedRecomputedRow)
                : null,
              selectedMetric: selectedMetricField
                ? {
                    field: selectedMetricField,
                    storedValue: storedMetricValue,
                    recomputedValue: recomputedMetricValue,
                    diff:
                      toNumberOrNull(storedMetricValue) != null &&
                      toNumberOrNull(recomputedMetricValue) != null
                        ? Number(
                            (
                              (toNumberOrNull(storedMetricValue) ?? 0) -
                              (toNumberOrNull(recomputedMetricValue) ?? 0)
                            ).toFixed(6)
                          )
                        : null
                  }
                : null
            }
          }
        : null,
    helpers: null
  };
}

export const __testables = {
  filterRowsForRequest,
  pickFocusedRow,
  inferMetricMetadata,
  buildReadiness
};
