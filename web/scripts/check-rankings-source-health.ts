type RankingsPayload = {
  success?: boolean;
  error?: string;
  rankings?: Array<{
    entity?: { id?: number | null };
    metric?: { value?: number | null; percentile?: number | null };
  }>;
  rows?: Array<{
    entity?: { id?: number | null };
    team?: { abbreviation?: string | null };
    composite?: { resultsLuckIndex?: number | null };
    metrics?: Record<
      string,
      { rawValue?: number | null; percentile?: number | null }
    >;
    sort?: {
      metricKey?: string | null;
      rank?: number | null;
      percentile?: number | null;
    };
  }>;
  meta?: {
    rowCount?: number;
    totalRankedRows?: number;
    pageCount?: number;
    snapshotDate?: string | null;
    latestAvailableSnapshotDate?: string | null;
    styleSnapshotDate?: string | null;
    snapshotSelectionReason?: string;
    sourceTable?: string;
    sourceTables?: string[];
    rankingSource?: string;
    rankingSourceFallbackReason?: string | null;
    methodologyVersion?: string | null;
    methodologyUpdatedAt?: string | null;
    sourceQualityFlags?: string[];
    unavailable?: boolean;
    message?: string | null;
    sourceWarnings?: string[];
  };
};

type SnapshotPayload = {
  success?: boolean;
  error?: string;
  status?: "available" | "unavailable";
  source?: {
    snapshotDate?: string | null;
    sourceTables?: string[];
  } | null;
  row?: unknown;
  reason?: string;
};

type Check = {
  kind: "matrix" | "metric_explorer";
  label: string;
  minRows: number;
  minFiniteRows?: number;
  metricKey?: string;
  path: string;
};

type Args = {
  baseUrl: string;
};

const DEFAULT_BASE_URL = "http://localhost:3000";
const CHECKS: Check[] = [
  {
    label: "skater matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/matrix?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=1&min_toi=300&sort_metric=points_per_60&sort_direction=desc&page=1&page_size=10",
    minRows: 10,
  },
  {
    label: "skater matrix Results Luck sparse live",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/matrix?entity=skaters&season=20252026&window=last20&position=all&deployment=L2&strength=5v5&min_gp=1&min_toi=300&sort_metric=results_luck_index&sort_direction=desc&page=1&page_size=10",
    minRows: 1,
    minFiniteRows: 1,
    metricKey: "results_luck_index",
  },
  {
    label: "Metric Explorer 5v5 goals/60",
    kind: "metric_explorer",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=goals_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
    minRows: 10,
  },
  {
    label: "Metric Explorer 5v5 shot attempts/60",
    kind: "metric_explorer",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=shot_attempts_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
    minRows: 10,
  },
  {
    label: "Metric Explorer 5v5 ixG/60",
    kind: "metric_explorer",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&metric=ixg_per_60&min_gp=1&min_toi=300&sort=percentile&direction=desc&limit=25",
    minRows: 10,
  },
  {
    label: "Metric Explorer PP goals/60",
    kind: "metric_explorer",
    path: "/api/v1/contextual-rankings?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=pp&metric=goals_per_60&min_gp=1&min_toi=0&sort=percentile&direction=desc&limit=25",
    minRows: 10,
  },
  {
    label: "goalie matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/goalies?season=20252026&window=season&metric=save_percentage&sort_direction=desc&role=all&min_starts=3&min_shots=100&page=1&page_size=10",
    minRows: 10,
  },
  {
    label: "team matrix",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=off_rating&sort_direction=desc&page=1&page_size=10",
    minRows: 10,
  },
  {
    label: "team matrix Forward Top Load",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=forward_top_load_index&sort_direction=desc&page=1&page_size=10",
    minRows: 1,
    minFiniteRows: 1,
    metricKey: "forward_top_load_index",
  },
  {
    label: "team matrix Defense Pair Top Load",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=defense_pair_top_load_index&sort_direction=desc&page=1&page_size=10",
    minRows: 1,
    minFiniteRows: 1,
    metricKey: "defense_pair_top_load_index",
  },
  {
    label: "team matrix PP1/PP2 Usage Share",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=pp1_pp2_usage_share&sort_direction=desc&page=1&page_size=10",
    minRows: 10,
    minFiniteRows: 10,
    metricKey: "pp1_pp2_usage_share",
  },
  {
    label: "team matrix Home Edge",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=home_road_point_pct_gap&sort_direction=desc&page=1&page_size=10",
    minRows: 10,
    minFiniteRows: 10,
    metricKey: "home_road_point_pct_gap",
  },
  {
    label: "team matrix PP Opp/G",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=pp_opportunity_rate&sort_direction=desc&page=1&page_size=10",
    minRows: 10,
    minFiniteRows: 10,
    metricKey: "pp_opportunity_rate",
  },
  {
    label: "team matrix Pen/60",
    kind: "matrix",
    path: "/api/v1/contextual-rankings/teams?season=20252026&metric=penalties_taken_per_60&sort_direction=asc&page=1&page_size=10",
    minRows: 10,
    minFiniteRows: 10,
    metricKey: "penalties_taken_per_60",
  },
] as const;

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const next = argv[index + 1];
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
      continue;
    }
    if (next && !next.startsWith("--")) {
      values.set(rawKey, next);
      index += 1;
    }
  }

  return {
    baseUrl: values.get("baseUrl") ?? DEFAULT_BASE_URL,
  };
}

function finiteMetricRows(payload: RankingsPayload) {
  return (payload.rankings ?? []).filter(
    (row) =>
      row.metric?.value != null &&
      Number.isFinite(row.metric.value) &&
      row.metric?.percentile != null &&
      Number.isFinite(row.metric.percentile),
  ).length;
}

function finiteMatrixMetricRows(payload: RankingsPayload, metricKey: string) {
  return (payload.rows ?? []).filter((row) => {
    const cell = row.metrics?.[metricKey];
    if (
      cell?.rawValue != null &&
      Number.isFinite(cell.rawValue) &&
      cell?.percentile != null &&
      Number.isFinite(cell.percentile)
    ) {
      return true;
    }
    if (metricKey === "results_luck_index") {
      return (
        row.composite?.resultsLuckIndex != null &&
        Number.isFinite(row.composite.resultsLuckIndex) &&
        row.sort?.metricKey === metricKey &&
        row.sort.rank != null &&
        Number.isFinite(row.sort.rank)
      );
    }
    return false;
  }).length;
}

async function fetchCheck(baseUrl: string, path: string) {
  const url = new URL(path, baseUrl).toString();
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as RankingsPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `request failed (${response.status}): ${payload.error ?? "unknown error"}`,
    );
  }
  return { durationMs, payload, url };
}

async function fetchSnapshotCheck(baseUrl: string, label: string, path: string) {
  const url = new URL(path, baseUrl).toString();
  const startedAt = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - startedAt;
  const payload = (await response.json()) as SnapshotPayload;
  if (!response.ok || payload.success !== true) {
    throw new Error(
      `${label} request failed (${response.status}): ${
        payload.error ?? "unknown error"
      }`,
    );
  }
  if (payload.status !== "available" || !payload.row) {
    throw new Error(
      `${label} snapshot unavailable: ${payload.reason ?? "unknown reason"}`,
    );
  }
  if (!payload.source?.snapshotDate) {
    throw new Error(`${label} did not expose a source snapshot date.`);
  }
  if (!payload.source.sourceTables?.length) {
    throw new Error(`${label} did not expose source table metadata.`);
  }
  return { durationMs, payload, url };
}

function assertPayload(check: Check, payload: RankingsPayload) {
  const rowCount = payload.meta?.rowCount ?? 0;
  const returnedRows =
    check.kind === "metric_explorer"
      ? (payload.rankings?.length ?? 0)
      : (payload.rows?.length ?? 0);
  const finiteRows =
    check.kind === "metric_explorer"
      ? finiteMetricRows(payload)
      : check.metricKey
        ? finiteMatrixMetricRows(payload, check.metricKey)
        : returnedRows;
  const minimumFiniteRows = check.minFiniteRows ?? check.minRows;

  if (payload.meta?.unavailable) {
    throw new Error(`${check.label} is unavailable: ${payload.meta.message ?? ""}`);
  }
  if (!payload.meta?.snapshotDate) {
    throw new Error(`${check.label} did not expose a snapshot date.`);
  }
  if (!payload.meta?.sourceTable && !payload.meta?.sourceTables?.length) {
    throw new Error(`${check.label} did not expose source table metadata.`);
  }
  if (!payload.meta?.methodologyVersion) {
    throw new Error(`${check.label} did not expose methodology version metadata.`);
  }
  if (!Array.isArray(payload.meta.sourceQualityFlags)) {
    throw new Error(`${check.label} did not expose source-quality flag metadata.`);
  }
  if (
    rowCount < check.minRows ||
    returnedRows < check.minRows ||
    finiteRows < minimumFiniteRows
  ) {
    throw new Error(
      `${check.label} returned too few rows (rowCount=${rowCount}, returnedRows=${returnedRows}, finiteRows=${finiteRows}, min=${check.minRows}, minFinite=${minimumFiniteRows}).`,
    );
  }
}

function firstSkaterId(payload: RankingsPayload) {
  return payload.rows?.find((row) => row.entity?.id != null)?.entity?.id ?? null;
}

function firstGoalieId(payload: RankingsPayload) {
  return payload.rows?.find((row) => row.entity?.id != null)?.entity?.id ?? null;
}

function firstTeamAbbreviation(payload: RankingsPayload) {
  return (
    payload.rows?.find((row) => row.team?.abbreviation)?.team?.abbreviation ?? null
  );
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const results: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];
  const snapshotInputs: {
    skaterId: number | null;
    goalieId: number | null;
    teamAbbreviation: string | null;
  } = {
    skaterId: null,
    goalieId: null,
    teamAbbreviation: null,
  };

  for (const check of CHECKS) {
    const { durationMs, payload, url } = await fetchCheck(args.baseUrl, check.path);
    assertPayload(check, payload);
    if (check.label === "skater matrix") {
      snapshotInputs.skaterId = firstSkaterId(payload);
    }
    if (check.label === "goalie matrix") {
      snapshotInputs.goalieId = firstGoalieId(payload);
    }
    if (check.label === "team matrix") {
      snapshotInputs.teamAbbreviation = firstTeamAbbreviation(payload);
    }
    if (
      payload.meta?.snapshotDate &&
      payload.meta.latestAvailableSnapshotDate &&
      payload.meta.snapshotDate < payload.meta.latestAvailableSnapshotDate
    ) {
      warnings.push(
        `${check.label} is using fallback snapshot ${payload.meta.snapshotDate}; latest available is ${payload.meta.latestAvailableSnapshotDate}.`,
      );
    }
    if (payload.meta?.rankingSourceFallbackReason) {
      warnings.push(
        `${check.label} used fallback ranking source: ${payload.meta.rankingSourceFallbackReason}`,
      );
    }
    if (payload.meta?.sourceWarnings?.length) {
      warnings.push(
        `${check.label} reported source warnings: ${payload.meta.sourceWarnings.join(", ")}`,
      );
    }
    results.push({
      label: check.label,
      durationMs,
      rowCount: payload.meta?.rowCount ?? null,
      totalRankedRows: payload.meta?.totalRankedRows ?? null,
      pageCount: payload.meta?.pageCount ?? null,
      snapshotDate: payload.meta?.snapshotDate ?? null,
      latestAvailableSnapshotDate:
        payload.meta?.latestAvailableSnapshotDate ?? null,
      styleSnapshotDate: payload.meta?.styleSnapshotDate ?? null,
      snapshotSelectionReason: payload.meta?.snapshotSelectionReason ?? null,
      sourceTable: payload.meta?.sourceTable ?? null,
      sourceTables: payload.meta?.sourceTables ?? [],
      rankingSource: payload.meta?.rankingSource ?? null,
      rankingSourceFallbackReason:
        payload.meta?.rankingSourceFallbackReason ?? null,
      methodologyVersion: payload.meta?.methodologyVersion ?? null,
      methodologyUpdatedAt: payload.meta?.methodologyUpdatedAt ?? null,
      sourceQualityFlags: payload.meta?.sourceQualityFlags ?? [],
      sourceWarnings: payload.meta?.sourceWarnings ?? [],
      url,
    });
  }

  const snapshotChecks: Array<{ label: string; path: string }> = [];
  if (snapshotInputs.skaterId != null) {
    snapshotChecks.push({
      label: "selected skater snapshot",
      path: `/api/v1/contextual-rankings/snapshot?entity=skaters&season=20252026&window=season&position=all&deployment=all&strength=5v5&min_gp=1&min_toi=300&sort_metric=points_per_60&selected_player=${snapshotInputs.skaterId}`,
    });
  }
  if (snapshotInputs.goalieId != null) {
    snapshotChecks.push({
      label: "selected goalie snapshot",
      path: `/api/v1/contextual-rankings/snapshot?entity=goalies&season=20252026&window=season&goalie_metric=save_percentage&goalie_role=all&min_starts=3&min_shots=100&selected_goalie=${snapshotInputs.goalieId}`,
    });
  }
  if (snapshotInputs.teamAbbreviation != null) {
    snapshotChecks.push({
      label: "selected team snapshot",
      path: `/api/v1/contextual-rankings/snapshot?entity=teams&season=20252026&team_metric=forward_top_load_index&selected_team=${snapshotInputs.teamAbbreviation}`,
    });
  }

  if (snapshotChecks.length < 3) {
    throw new Error(
      `Unable to derive selected snapshot inputs from matrix checks: ${JSON.stringify(
        snapshotInputs,
      )}`,
    );
  }

  for (const check of snapshotChecks) {
    const { durationMs, payload, url } = await fetchSnapshotCheck(
      args.baseUrl,
      check.label,
      check.path,
    );
    results.push({
      label: check.label,
      durationMs,
      snapshotDate: payload.source?.snapshotDate ?? null,
      sourceTables: payload.source?.sourceTables ?? [],
      status: payload.status ?? null,
      url,
    });
  }

  console.info(
    "[check-rankings-source-health] summary",
    JSON.stringify({ results, warnings }, null, 2),
  );
}

run().catch((error) => {
  console.error(
    "[check-rankings-source-health] failed",
    JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});

export {};
