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

const MS_PER_HOUR = 60 * 60 * 1000;

const parseTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;

  // Accept date-only values by interpreting them as UTC midnight.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnly.test(value)) {
    const asIso = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(asIso) ? asIso : null;
  }

  return null;
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
