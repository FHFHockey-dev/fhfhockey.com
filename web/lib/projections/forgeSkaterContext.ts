export type LineComboRecencyClass =
  | "FRESH"
  | "SOFT_STALE"
  | "HARD_STALE"
  | "MISSING";

export type SkaterProjectionDegradedContext = {
  usedLineComboFallback: boolean;
  lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null;
  lineComboRecencyClass: LineComboRecencyClass | null;
  lineComboDaysStale: number | null;
  skaterPoolRecoveryPath: string | null;
  isDegraded: boolean;
  summary: string | null;
};

export type SkaterProjectionDegradedSummary = {
  degradedPlayerCount: number;
  lineComboFallbackPlayerCount: number;
  hardStaleLineComboPlayerCount: number;
  missingLineComboPlayerCount: number;
  softStaleLineComboPlayerCount: number;
  skaterPoolRecoveryPlayerCount: number;
  note: string | null;
};

export type SkaterModelMetadata = {
  modelVersion: string | null;
  scenarioCount: number | null;
};

export const SKATER_INTERVAL_DEFINITIONS = {
  floor: "P10: roughly one outcome in ten is expected below this value.",
  typical: "P50: the model's median outcome, not a guarantee.",
  ceiling: "P90: roughly one outcome in ten is expected above this value.",
} as const;

export function parseFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLineComboRecencyClass(
  value: unknown,
): LineComboRecencyClass | null {
  if (
    value === "FRESH" ||
    value === "SOFT_STALE" ||
    value === "HARD_STALE" ||
    value === "MISSING"
  ) {
    return value;
  }
  return null;
}

export function extractSkaterModelMetadata(
  uncertainty: unknown,
): SkaterModelMetadata {
  const model = (uncertainty as any)?.model;
  const scenarioMetadata =
    model?.skater_selection?.role_scenarios?.scenario_metadata;
  const modelVersion =
    typeof model?.rollout?.modelVersion === "string"
      ? model.rollout.modelVersion
      : typeof scenarioMetadata?.model_version === "string"
        ? scenarioMetadata.model_version
        : null;
  const scenarioCount = parseFiniteNumber(scenarioMetadata?.scenario_count);
  return {
    modelVersion,
    scenarioCount:
      scenarioCount != null && scenarioCount >= 0 ? scenarioCount : null,
  };
}

export function extractSkaterConfidenceDrivers(uncertainty: unknown) {
  const model = (uncertainty as any)?.model ?? {};
  const selection = model.skater_selection ?? {};
  const powerPlay = selection.pp_opportunity ?? model.pp_opportunity ?? {};
  const opponentGoalie =
    selection.opponent_goalie_context ?? model.opponent_goalie_context ?? {};
  const teamLevel =
    selection.team_level_context ?? model.team_level_context ?? {};
  const restSchedule = selection.rest_schedule ?? model.rest_schedule ?? {};
  return {
    role: {
      evenStrength:
        typeof selection.es_role === "string" ? selection.es_role : null,
      unitTier:
        typeof selection.unit_tier === "string" ? selection.unit_tier : null,
      source: typeof selection.source === "string" ? selection.source : null,
      continuityShare: parseFiniteNumber(
        selection.role_continuity?.continuity_share,
      ),
      topScenarioProbability: parseFiniteNumber(
        selection.role_scenarios?.top_probability,
      ),
    },
    powerPlay: {
      allocatedShare: parseFiniteNumber(powerPlay.allocated_player_pp_share),
      teamTargetSeconds: parseFiniteNumber(powerPlay.team_pp_target_seconds),
    },
    matchup: {
      opponentGoalieGoalRateMultiplier: parseFiniteNumber(
        opponentGoalie.goal_rate_multiplier,
      ),
      opponentStarterCertainty: parseFiniteNumber(
        opponentGoalie.starter_certainty,
      ),
      opponentDefenseEdge: parseFiniteNumber(teamLevel.opponent_defense_edge),
    },
    rest: {
      teamRestDays: parseFiniteNumber(restSchedule.team_rest_days),
      opponentRestDays: parseFiniteNumber(restSchedule.opponent_rest_days),
      restDelta: parseFiniteNumber(restSchedule.rest_delta),
    },
    trend: {
      effectState:
        typeof selection.trend_adjustment?.effect_state === "string"
          ? selection.trend_adjustment.effect_state
          : null,
      recencyClass:
        typeof selection.trend_adjustment?.recency_class === "string"
          ? selection.trend_adjustment.recency_class
          : null,
      pointsMultiplier: parseFiniteNumber(
        selection.trend_adjustment?.multipliers?.points,
      ),
    },
  };
}

export function extractProjectionRange(uncertainty: unknown) {
  const points = (uncertainty as any)?.pts;
  const floor = parseFiniteNumber(points?.p10);
  const typical = parseFiniteNumber(points?.p50);
  const ceiling = parseFiniteNumber(points?.p90);
  return {
    points: { floor, typical, ceiling },
    labels: SKATER_INTERVAL_DEFINITIONS,
  };
}

export function buildDegradedProjectionSummary(
  contexts: Array<SkaterProjectionDegradedContext | null>,
): SkaterProjectionDegradedSummary {
  const nonNullContexts = contexts.filter(
    (context): context is SkaterProjectionDegradedContext => Boolean(context),
  );
  const lineComboFallbackPlayerCount = nonNullContexts.filter(
    (context) => context.usedLineComboFallback,
  ).length;
  const hardStaleLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "HARD_STALE",
  ).length;
  const missingLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "MISSING",
  ).length;
  const softStaleLineComboPlayerCount = nonNullContexts.filter(
    (context) => context.lineComboRecencyClass === "SOFT_STALE",
  ).length;
  const skaterPoolRecoveryPlayerCount = nonNullContexts.filter(
    (context) => context.skaterPoolRecoveryPath != null,
  ).length;
  const degradedPlayerCount = nonNullContexts.filter(
    (context) => context.isDegraded,
  ).length;

  const describeCount = (
    count: number,
    singular: string,
    plural: string,
  ): string =>
    `${count} projected skater${count === 1 ? "" : "s"} ${
      count === 1 ? singular : plural
    }`;
  let note: string | null = null;
  if (lineComboFallbackPlayerCount > 0) {
    note = describeCount(
      lineComboFallbackPlayerCount,
      "is using fallback role context because line combinations were missing, empty, or hard stale.",
      "are using fallback role context because line combinations were missing, empty, or hard stale.",
    );
  } else if (skaterPoolRecoveryPlayerCount > 0) {
    note = describeCount(
      skaterPoolRecoveryPlayerCount,
      "required emergency pool recovery beyond the initial line-combo group.",
      "required emergency pool recovery beyond the initial line-combo group.",
    );
  } else if (softStaleLineComboPlayerCount > 0) {
    note = describeCount(
      softStaleLineComboPlayerCount,
      "is still tied to soft-stale line-combo context.",
      "are still tied to soft-stale line-combo context.",
    );
  }

  return {
    degradedPlayerCount,
    lineComboFallbackPlayerCount,
    hardStaleLineComboPlayerCount,
    missingLineComboPlayerCount,
    softStaleLineComboPlayerCount,
    skaterPoolRecoveryPlayerCount,
    note,
  };
}

export function extractDegradedProjectionContext(
  uncertainty: unknown,
): SkaterProjectionDegradedContext | null {
  if (!uncertainty || typeof uncertainty !== "object") return null;
  const model = (uncertainty as Record<string, unknown>).model;
  if (!model || typeof model !== "object") return null;
  const selection = (model as Record<string, unknown>).skater_selection;
  if (!selection || typeof selection !== "object") return null;

  const root = selection as Record<string, unknown>;
  const fallbackPath = root.fallback_path;
  const recency = root.line_combo_recency;
  const activePool = root.active_pool;
  const fallbackRecovery =
    activePool && typeof activePool === "object"
      ? (activePool as Record<string, unknown>).fallback_recovery
      : null;
  const usedLineComboFallback =
    fallbackPath && typeof fallbackPath === "object"
      ? Boolean((fallbackPath as Record<string, unknown>).used)
      : false;
  const rawReason =
    fallbackPath && typeof fallbackPath === "object"
      ? (fallbackPath as Record<string, unknown>).reason
      : null;
  const lineComboFallbackReason =
    rawReason === "missing" ||
    rawReason === "hard_stale" ||
    rawReason === "empty"
      ? rawReason
      : null;
  const lineComboRecencyClass =
    recency && typeof recency === "object"
      ? parseLineComboRecencyClass((recency as Record<string, unknown>).class)
      : null;
  const lineComboDaysStale =
    recency && typeof recency === "object"
      ? parseFiniteNumber((recency as Record<string, unknown>).days_stale)
      : null;
  const skaterPoolRecoveryPath =
    fallbackRecovery && typeof fallbackRecovery === "object"
      ? typeof (fallbackRecovery as Record<string, unknown>).path === "string"
        ? ((fallbackRecovery as Record<string, unknown>).path as string)
        : null
      : null;
  const isDegraded = usedLineComboFallback || skaterPoolRecoveryPath != null;
  const staleSuffix =
    lineComboDaysStale != null ? ` (${lineComboDaysStale}d stale)` : "";

  let summary: string | null = null;
  if (usedLineComboFallback) {
    const reasonLabel =
      lineComboFallbackReason === "missing"
        ? "line combos were missing"
        : lineComboFallbackReason === "hard_stale"
          ? "line combos were hard stale"
          : lineComboFallbackReason === "empty"
            ? "the line-combo group was empty"
            : "line-combo context was unavailable";
    summary = `Fallback role context used because ${reasonLabel}${staleSuffix}.`;
  } else if (skaterPoolRecoveryPath != null) {
    summary = `Projected skater pool required ${skaterPoolRecoveryPath.replaceAll("_", " ")} recovery${staleSuffix}.`;
  } else if (lineComboRecencyClass === "SOFT_STALE") {
    summary = `Line-combo context is soft stale${staleSuffix}.`;
  }

  if (
    !usedLineComboFallback &&
    !skaterPoolRecoveryPath &&
    lineComboRecencyClass == null
  ) {
    return null;
  }

  return {
    usedLineComboFallback,
    lineComboFallbackReason,
    lineComboRecencyClass,
    lineComboDaysStale,
    skaterPoolRecoveryPath,
    isDegraded,
    summary,
  };
}
