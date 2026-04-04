export type FreshnessCheck = {
  source: string;
  timestamp: string | null;
  maxAgeHours: number;
  severity: "warn" | "error";
};

export type FreshnessIssue = {
  source: string;
  severity: "warn" | "error";
  message: string;
};

export type FreshnessAuditResult = {
  ok: boolean;
  issues: FreshnessIssue[];
};

export type RequestedDateServingStrategy =
  | "requested_date"
  | "latest_available_with_data"
  | "previous_date_with_games";

export type RequestedDateServingState = {
  requestedDate: string | null;
  resolvedDate: string | null;
  fallbackApplied: boolean;
  isSameDay: boolean;
  state: "same_day" | "fallback" | "unknown";
  strategy: RequestedDateServingStrategy | null;
};

export type ResolvedDataServingContract = RequestedDateServingState & {
  gapDays: number | null;
  severity: "none" | "warn" | "error";
  status: "requested_date" | "fallback_recent" | "degraded" | "blocked";
  message: string | null;
  requestedScheduledGames: number | null;
  resolvedScheduledGames: number | null;
  requestedHadGames: boolean | null;
  resolvedHadGames: boolean | null;
};

export type HomepageModulePresentationState =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "stale";

export type HomepageModulePresentation = {
  state: HomepageModulePresentationState;
  panelState: "loading" | "empty" | "error" | "info" | null;
  message: string | null;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateOnly = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  return DATE_ONLY_PATTERN.test(value) ? value : null;
};

const parseTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;

  // Accept date-only values by interpreting them as UTC midnight.
  if (DATE_ONLY_PATTERN.test(value)) {
    const asIso = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(asIso) ? asIso : null;
  }

  return null;
};

const diffDateOnlyDays = (
  laterDate: string | null,
  earlierDate: string | null
): number | null => {
  const laterTs = parseTimestamp(laterDate);
  const earlierTs = parseTimestamp(earlierDate);
  if (laterTs == null || earlierTs == null) return null;
  return Math.max(0, Math.round((laterTs - earlierTs) / (24 * MS_PER_HOUR)));
};

export const buildRequestedDateServingState = (input: {
  requestedDate: string | null | undefined;
  resolvedDate: string | null | undefined;
  fallbackApplied?: boolean | null;
  strategy?: RequestedDateServingStrategy | null;
}): RequestedDateServingState => {
  const requestedDate = normalizeDateOnly(input.requestedDate);
  const resolvedDate = normalizeDateOnly(input.resolvedDate);
  const datesDiffer =
    requestedDate != null &&
    resolvedDate != null &&
    requestedDate !== resolvedDate;
  const fallbackApplied = Boolean(input.fallbackApplied) || datesDiffer;
  const isSameDay =
    requestedDate != null &&
    resolvedDate != null &&
    requestedDate === resolvedDate;

  return {
    requestedDate,
    resolvedDate,
    fallbackApplied,
    isSameDay,
    state:
      requestedDate == null || resolvedDate == null
        ? "unknown"
        : fallbackApplied
          ? "fallback"
          : "same_day",
    strategy:
      input.strategy ??
      (requestedDate != null && resolvedDate != null && requestedDate === resolvedDate
        ? "requested_date"
        : null)
  };
};

export const buildResolvedDataServingContract = (input: {
  requestedDate: string | null | undefined;
  resolvedDate: string | null | undefined;
  fallbackApplied?: boolean | null;
  strategy?: RequestedDateServingStrategy | null;
  requestedScheduledGames?: number | null;
  resolvedScheduledGames?: number | null;
  sourceLabel: string;
}): ResolvedDataServingContract => {
  const base = buildRequestedDateServingState({
    requestedDate: input.requestedDate,
    resolvedDate: input.resolvedDate,
    fallbackApplied: input.fallbackApplied,
    strategy: input.strategy
  });
  const gapDays = diffDateOnlyDays(base.requestedDate, base.resolvedDate);
  const requestedScheduledGames = Number.isFinite(Number(input.requestedScheduledGames))
    ? Math.max(0, Number(input.requestedScheduledGames))
    : null;
  const resolvedScheduledGames = Number.isFinite(Number(input.resolvedScheduledGames))
    ? Math.max(0, Number(input.resolvedScheduledGames))
    : null;
  const requestedHadGames =
    requestedScheduledGames == null ? null : requestedScheduledGames > 0;
  const resolvedHadGames =
    resolvedScheduledGames == null ? null : resolvedScheduledGames > 0;

  if (!base.fallbackApplied || gapDays == null || gapDays <= 0) {
    return {
      ...base,
      gapDays: gapDays ?? 0,
      severity: "none",
      status: "requested_date",
      message: null,
      requestedScheduledGames,
      resolvedScheduledGames,
      requestedHadGames,
      resolvedHadGames
    };
  }

  if (requestedHadGames) {
    return {
      ...base,
      gapDays,
      severity: "error",
      status: "blocked",
      message: `${input.sourceLabel} is serving ${base.resolvedDate} even though ${requestedScheduledGames} game${requestedScheduledGames === 1 ? "" : "s"} were scheduled on requested date ${base.requestedDate}. Treat this module as degraded until same-day data is available.`,
      requestedScheduledGames,
      resolvedScheduledGames,
      requestedHadGames,
      resolvedHadGames
    };
  }

  if (gapDays <= 3) {
    return {
      ...base,
      gapDays,
      severity: "warn",
      status: "fallback_recent",
      message: `${input.sourceLabel} is serving the nearest available date (${base.resolvedDate}), ${gapDays} day${gapDays === 1 ? "" : "s"} behind the requested date.`,
      requestedScheduledGames,
      resolvedScheduledGames,
      requestedHadGames,
      resolvedHadGames
    };
  }

  if (gapDays >= 14) {
    return {
      ...base,
      gapDays,
      severity: "error",
      status: "blocked",
      message: `${input.sourceLabel} fallback is materially stale: requested ${base.requestedDate}, but latest available date is ${base.resolvedDate} (${gapDays} days old). Treat this module as degraded until fresher data exists.`,
      requestedScheduledGames,
      resolvedScheduledGames,
      requestedHadGames,
      resolvedHadGames
    };
  }

  return {
    ...base,
    gapDays,
    severity: "warn",
    status: "degraded",
    message: `${input.sourceLabel} is using stale fallback data from ${base.resolvedDate}, ${gapDays} days behind the requested date.`,
    requestedScheduledGames,
    resolvedScheduledGames,
    requestedHadGames,
    resolvedHadGames
  };
};

export const evaluateFreshness = (
  checks: FreshnessCheck[],
  nowMs = Date.now()
): FreshnessAuditResult => {
  const issues: FreshnessIssue[] = [];

  checks.forEach((check) => {
    const ts = parseTimestamp(check.timestamp);
    if (ts == null) {
      issues.push({
        source: check.source,
        severity: check.severity,
        message: `Missing or invalid timestamp for ${check.source}`
      });
      return;
    }

    const ageHours = (nowMs - ts) / MS_PER_HOUR;
    if (ageHours < 0) {
      // Future timestamps are suspicious but non-blocking for now.
      issues.push({
        source: check.source,
        severity: "warn",
        message: `Timestamp for ${check.source} is in the future` 
      });
      return;
    }

    if (ageHours > check.maxAgeHours) {
      issues.push({
        source: check.source,
        severity: check.severity,
        message: `${check.source} stale by ${ageHours.toFixed(1)}h (max ${check.maxAgeHours}h)`
      });
    }
  });

  const hasErrors = issues.some((issue) => issue.severity === "error");
  return {
    ok: !hasErrors,
    issues
  };
};

export const DASHBOARD_FRESHNESS_POLICY: FreshnessCheck[] = [
  // Snapshot-like sources should be near-real-time (allow for pipeline lag).
  { source: "team-ratings", timestamp: null, maxAgeHours: 30, severity: "error" },
  { source: "forge-goalies", timestamp: null, maxAgeHours: 30, severity: "error" },
  { source: "start-chart", timestamp: null, maxAgeHours: 30, severity: "error" },

  // Trend feeds can lag longer while still useful.
  { source: "team-ctpi", timestamp: null, maxAgeHours: 72, severity: "warn" },
  { source: "skater-power", timestamp: null, maxAgeHours: 72, severity: "warn" },
  { source: "sustainability", timestamp: null, maxAgeHours: 72, severity: "warn" }
];

export const buildDashboardFreshnessChecks = (input: {
  teamRatingsDate: string | null;
  goalieAsOfDate: string | null;
  startChartDateUsed: string | null;
  teamCtpiGeneratedAt: string | null;
  skaterPowerGeneratedAt: string | null;
  sustainabilitySnapshotDate: string | null;
}): FreshnessCheck[] => [
  {
    source: "team-ratings",
    timestamp: input.teamRatingsDate,
    maxAgeHours: 30,
    severity: "error"
  },
  {
    source: "forge-goalies",
    timestamp: input.goalieAsOfDate,
    maxAgeHours: 30,
    severity: "error"
  },
  {
    source: "start-chart",
    timestamp: input.startChartDateUsed,
    maxAgeHours: 30,
    severity: "error"
  },
  {
    source: "team-ctpi",
    timestamp: input.teamCtpiGeneratedAt,
    maxAgeHours: 72,
    severity: "warn"
  },
  {
    source: "skater-power",
    timestamp: input.skaterPowerGeneratedAt,
    maxAgeHours: 72,
    severity: "warn"
  },
  {
    source: "sustainability",
    timestamp: input.sustainabilitySnapshotDate,
    maxAgeHours: 72,
    severity: "warn"
  }
];

export const buildHomepageModulePresentation = (input: {
  source: string;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  timestamp?: string | null;
  maxAgeHours?: number;
  loadingMessage?: string;
  emptyMessage?: string;
  staleMessage?: string;
}): HomepageModulePresentation => {
  if (input.loading) {
    return {
      state: "loading",
      panelState: "loading",
      message: input.loadingMessage ?? "Loading module..."
    };
  }

  if (typeof input.error === "string" && input.error.trim().length > 0) {
    return {
      state: "error",
      panelState: "error",
      message: input.error
    };
  }

  if (input.isEmpty) {
    return {
      state: "empty",
      panelState: "empty",
      message: input.emptyMessage ?? "No data available."
    };
  }

  if (input.timestamp && typeof input.maxAgeHours === "number") {
    const freshness = evaluateFreshness([
      {
        source: input.source,
        timestamp: input.timestamp,
        maxAgeHours: input.maxAgeHours,
        severity: "warn"
      }
    ]);

    if (freshness.issues.length > 0) {
      return {
        state: "stale",
        panelState: "info",
        message: input.staleMessage ?? freshness.issues[0].message
      };
    }
  }

  return {
    state: "ready",
    panelState: null,
    message: null
  };
};
