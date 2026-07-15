import { fetchCachedJson } from "./clientFetchCache";
import type {
  CommandCenterMixedState,
  CommandCenterModuleContract,
  CommandCenterModuleState,
  CommandCenterRouteState
} from "./commandCenterTypes";
import {
  normalizeCtpiResponse,
  normalizeGoalieResponse,
  normalizeSkaterTrendResponse,
  normalizeStartChartResponse,
  normalizeSustainabilityResponse,
  normalizeTeamRatings,
  type NormalizedCtpiResponse,
  type NormalizedGoalieResponse,
  type NormalizedSkaterTrendResponse,
  type NormalizedStartChartResponse,
  type NormalizedSustainabilityResponse,
  type NormalizedTeamRatingRow
} from "./normalizers";

type OwnershipTrendRow = {
  playerId: number | null;
  name: string;
  latest: number;
  delta: number;
  teamAbbrev?: string | null;
  headshot?: string | null;
};

type OwnershipTrendsResponse = {
  success: boolean;
  risers: OwnershipTrendRow[];
  fallers: OwnershipTrendRow[];
};

type OwnershipSnapshotsResponse = {
  success?: boolean;
  rows?: unknown[];
  data?: unknown[];
};

type LatestRunResponse = {
  success?: boolean;
  latestRun?: unknown;
  run?: unknown;
  data?: unknown;
};

export type CommandCenterData = {
  routeState: CommandCenterRouteState;
  mixedState: CommandCenterMixedState;
  modules: {
    teamPower: CommandCenterModuleState<{
      ratings: NormalizedTeamRatingRow[];
      ctpi: NormalizedCtpiResponse;
    }>;
    focusedSlate: CommandCenterModuleState<NormalizedStartChartResponse>;
    topAdds: CommandCenterModuleState<{
      forgePlayers: unknown;
      ownershipTrends: OwnershipTrendsResponse | null;
      ownershipSnapshots: OwnershipSnapshotsResponse | null;
    }>;
    playerInsight: CommandCenterModuleState<{
      sustainable: NormalizedSustainabilityResponse;
      unsustainable: NormalizedSustainabilityResponse;
      skaterTrends: NormalizedSkaterTrendResponse;
      ownershipTrends: OwnershipTrendsResponse | null;
    }>;
    goalieContext: CommandCenterModuleState<NormalizedGoalieResponse>;
    runStatus: CommandCenterModuleState<LatestRunResponse | null>;
  };
};

const SNAPSHOT_TTL_MS = 60_000;
const TREND_TTL_MS = 5 * 60_000;

export const COMMAND_CENTER_MODULE_CONTRACTS: Record<
  CommandCenterModuleContract["id"],
  CommandCenterModuleContract
> = {
  team_power: {
    id: "team_power",
    label: "Team Power Terminal",
    sourceApis: ["/api/team-ratings", "/api/v1/trends/team-ctpi"],
    sourceTables: ["team_power_ratings_daily", "team_ctpi_daily"],
    freshnessExpectation: "Team ratings should be same-day; CTPI may warn stale.",
    fallbackStrategy: "Show available rows with a module warning.",
    emptyStateRule: "Show empty if both ratings and CTPI are empty.",
    clickDestination: "/forge/team/[teamId]"
  },
  focused_slate: {
    id: "focused_slate",
    label: "Focused Slate + Goalie Context",
    sourceApis: ["/api/v1/start-chart"],
    sourceTables: ["games", "goalie_start_projections", "forge_player_projections"],
    freshnessExpectation: "Slate should resolve to requested date or explicit fallback.",
    fallbackStrategy: "Use API serving contract and display resolved date.",
    emptyStateRule: "Show no slate if no games are returned.",
    clickDestination: "/start-chart"
  },
  top_adds: {
    id: "top_adds",
    label: "Top Adds Watchlist",
    sourceApis: [
      "/api/v1/forge/players",
      "/api/v1/transactions/ownership-trends",
      "/api/v1/transactions/ownership-snapshots"
    ],
    sourceTables: ["forge_player_projections", "yahoo_players"],
    freshnessExpectation: "Projection and ownership rows should be same-day or warned.",
    fallbackStrategy: "Rank only rows with usable projection and ownership evidence.",
    emptyStateRule: "Show empty when no players match the ownership band.",
    clickDestination: "/forge/player/[playerId]"
  },
  player_insight: {
    id: "player_insight",
    label: "Player Insight Core",
    sourceApis: [
      "/api/v1/sustainability/trends",
      "/api/v1/trends/skater-power",
      "/api/v1/transactions/ownership-trends"
    ],
    sourceTables: ["sustainability_scores", "rolling_player_game_metrics", "yahoo_players"],
    freshnessExpectation: "Trend feeds may warn stale; severe fallback blocks rows.",
    fallbackStrategy: "Preserve sustainable, unsustainable, and momentum states separately.",
    emptyStateRule: "Show empty if all insight row families are empty.",
    clickDestination: "/trends/player/[playerId]"
  },
  goalie_context: {
    id: "goalie_context",
    label: "Goalie Context",
    sourceApis: ["/api/v1/forge/goalies"],
    sourceTables: ["forge_goalie_projections", "goalie_start_projections"],
    freshnessExpectation: "Goalie rows should be requested date or explicit fallback.",
    fallbackStrategy: "Show fallback rows only with the resolved-date warning.",
    emptyStateRule: "Show empty when no goalie rows are returned.",
    clickDestination: "/forge/player/[playerId]"
  },
  run_status: {
    id: "run_status",
    label: "Run Status",
    sourceApis: ["/api/v1/runs/latest"],
    sourceTables: ["forge_runs"],
    freshnessExpectation: "Latest run should explain projection execution state.",
    fallbackStrategy: "Treat missing run status as non-blocking partial metadata.",
    emptyStateRule: "Show partial if latest run status is unavailable.",
    clickDestination: "/api/v1/runs/latest"
  }
};

function buildQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined>
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const rendered = search.toString();
  return rendered ? `${path}?${rendered}` : path;
}

async function requestJson<T>(url: string, ttlMs = SNAPSHOT_TTL_MS): Promise<T> {
  return fetchCachedJson<T>(url, { ttlMs });
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function settledError(result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") return null;
  return result.reason instanceof Error ? result.reason.message : String(result.reason);
}

function moduleState<T>(args: {
  contract: CommandCenterModuleContract;
  data: T;
  rowCount: number;
  requestedDate: string;
  resolvedDate?: string | null;
  fallbackApplied?: boolean;
  error?: string | null;
  partial?: boolean;
  message?: string | null;
}): CommandCenterModuleState<T> {
  const fallbackApplied = Boolean(args.fallbackApplied);
  const resolvedDate = args.resolvedDate ?? args.requestedDate;
  const status =
    args.error != null
      ? "error"
      : args.partial
        ? "partial"
        : fallbackApplied || resolvedDate !== args.requestedDate
          ? "stale"
          : args.rowCount > 0
            ? "ready"
            : "empty";

  return {
    status,
    data: args.data,
    requestedDate: args.requestedDate,
    resolvedDate,
    fallbackApplied,
    message: args.message ?? null,
    error: args.error ?? null,
    contract: args.contract
  };
}

function normalizeRequestedPosition(position: CommandCenterRouteState["position"]) {
  if (position === "d") return "D";
  if (position === "f") return "F";
  return "all";
}

function buildMixedState(input: {
  requestedDate: string;
  modules: CommandCenterModuleState<unknown>[];
}): CommandCenterMixedState {
  const resolvedDates = Array.from(
    new Set(
      input.modules
        .map((module) => module.resolvedDate)
        .filter((date): date is string => Boolean(date))
    )
  ).sort();
  const fallbackModuleIds = input.modules
    .filter(
      (module) =>
        module.fallbackApplied ||
        Boolean(module.resolvedDate && module.resolvedDate !== input.requestedDate)
    )
    .map((module) => module.contract.id);
  const hasMixedDates =
    resolvedDates.length > 1 ||
    (resolvedDates.length === 1 && resolvedDates[0] !== input.requestedDate);

  return {
    requestedDate: input.requestedDate,
    resolvedDates,
    hasMixedDates,
    fallbackModuleIds,
    message: hasMixedDates
      ? `Some command-center modules are serving fallback dates: ${resolvedDates.join(", ")}.`
      : null
  };
}

export async function loadCommandCenterData(
  routeState: CommandCenterRouteState
): Promise<CommandCenterData> {
  const position = normalizeRequestedPosition(routeState.position);
  const [
    teamRatingsResult,
    ctpiResult,
    startChartResult,
    forgePlayersResult,
    forgeGoaliesResult,
    ownershipTrendsResult,
    ownershipSnapshotsResult,
    sustainableResult,
    unsustainableResult,
    skaterTrendsResult,
    latestRunResult
  ] = await Promise.allSettled([
    requestJson<unknown>(buildQuery("/api/team-ratings", { date: routeState.date })),
    requestJson<unknown>("/api/v1/trends/team-ctpi", TREND_TTL_MS),
    requestJson<unknown>(buildQuery("/api/v1/start-chart", { date: routeState.date })),
    requestJson<unknown>(
      buildQuery("/api/v1/forge/players", {
        date: routeState.date,
        horizon: 1
      })
    ),
    requestJson<unknown>(
      buildQuery("/api/v1/forge/goalies", {
        date: routeState.date,
        horizon: 1,
        fallbackToLatestWithData: true
      })
    ),
    requestJson<OwnershipTrendsResponse>(
      "/api/v1/transactions/ownership-trends?window=5&limit=80",
      TREND_TTL_MS
    ),
    requestJson<OwnershipSnapshotsResponse>(
      "/api/v1/transactions/ownership-snapshots",
      TREND_TTL_MS
    ),
    requestJson<unknown>(
      buildQuery("/api/v1/sustainability/trends", {
        snapshot_date: routeState.date,
        window_code: "l10",
        pos: position,
        direction: "cold",
        limit: 25
      }),
      TREND_TTL_MS
    ),
    requestJson<unknown>(
      buildQuery("/api/v1/sustainability/trends", {
        snapshot_date: routeState.date,
        window_code: "l10",
        pos: position,
        direction: "hot",
        limit: 25
      }),
      TREND_TTL_MS
    ),
    requestJson<unknown>(
      buildQuery("/api/v1/trends/skater-power", {
        date: routeState.date,
        position:
          routeState.position === "d"
            ? "defense"
            : routeState.position === "f"
              ? "forward"
              : "all",
        window: 5,
        limit: 50
      }),
      TREND_TTL_MS
    ),
    requestJson<LatestRunResponse>("/api/v1/runs/latest")
  ]);

  const teamRatings = normalizeTeamRatings(settledValue(teamRatingsResult));
  const ctpi = normalizeCtpiResponse(settledValue(ctpiResult));
  const startChart = normalizeStartChartResponse(settledValue(startChartResult));
  const forgeGoalies = normalizeGoalieResponse(settledValue(forgeGoaliesResult));
  const sustainable = normalizeSustainabilityResponse(settledValue(sustainableResult));
  const unsustainable = normalizeSustainabilityResponse(
    settledValue(unsustainableResult)
  );
  const skaterTrends = normalizeSkaterTrendResponse(settledValue(skaterTrendsResult));
  const ownershipTrends = settledValue(ownershipTrendsResult);
  const ownershipSnapshots = settledValue(ownershipSnapshotsResult);
  const latestRun = settledValue(latestRunResult);

  const teamPower = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.team_power,
    data: { ratings: teamRatings, ctpi },
    rowCount: teamRatings.length + ctpi.teams.length,
    requestedDate: routeState.date,
    resolvedDate: teamRatings[0]?.date ?? routeState.date,
    error: settledError(teamRatingsResult) ?? settledError(ctpiResult),
    partial:
      teamRatingsResult.status === "rejected" || ctpiResult.status === "rejected"
  });

  const focusedSlate = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.focused_slate,
    data: startChart,
    rowCount: startChart.games.length,
    requestedDate: routeState.date,
    resolvedDate: startChart.dateUsed ?? routeState.date,
    fallbackApplied: startChart.fallbackApplied,
    error: settledError(startChartResult),
    message: startChart.serving?.message ?? null
  });

  const rawForgePlayers = settledValue(forgePlayersResult) as
    | Record<string, unknown>
    | null;
  const topAdds = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.top_adds,
    data: {
      forgePlayers: rawForgePlayers,
      ownershipTrends,
      ownershipSnapshots
    },
    rowCount:
      (ownershipTrends?.risers?.length ?? 0) +
      (ownershipTrends?.fallers?.length ?? 0),
    requestedDate: routeState.date,
    resolvedDate: (rawForgePlayers?.asOfDate as string | undefined) ?? routeState.date,
    fallbackApplied: Boolean(rawForgePlayers?.fallbackApplied),
    error:
      settledError(forgePlayersResult) ??
      settledError(ownershipTrendsResult) ??
      settledError(ownershipSnapshotsResult),
    partial:
      forgePlayersResult.status === "rejected" ||
      ownershipTrendsResult.status === "rejected" ||
      ownershipSnapshotsResult.status === "rejected"
  });

  const playerInsight = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.player_insight,
    data: {
      sustainable,
      unsustainable,
      skaterTrends,
      ownershipTrends
    },
    rowCount:
      sustainable.rows.length +
      unsustainable.rows.length +
      Object.values(skaterTrends.categories).reduce(
        (sum, category) => sum + category.rankings.length,
        0
      ),
    requestedDate: routeState.date,
    resolvedDate:
      sustainable.snapshot_date ??
      unsustainable.snapshot_date ??
      skaterTrends.dateUsed ??
      routeState.date,
    fallbackApplied:
      sustainable.snapshot_date !== null &&
      sustainable.snapshot_date !== routeState.date,
    error:
      settledError(sustainableResult) ??
      settledError(unsustainableResult) ??
      settledError(skaterTrendsResult),
    partial:
      sustainableResult.status === "rejected" ||
      unsustainableResult.status === "rejected" ||
      skaterTrendsResult.status === "rejected"
  });

  const goalieContext = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.goalie_context,
    data: forgeGoalies,
    rowCount: forgeGoalies.data.length,
    requestedDate: routeState.date,
    resolvedDate: forgeGoalies.asOfDate ?? routeState.date,
    fallbackApplied: forgeGoalies.fallbackApplied,
    error: settledError(forgeGoaliesResult),
    message: forgeGoalies.serving?.message ?? null
  });

  const runStatus = moduleState({
    contract: COMMAND_CENTER_MODULE_CONTRACTS.run_status,
    data: latestRun,
    rowCount: latestRun ? 1 : 0,
    requestedDate: routeState.date,
    resolvedDate: routeState.date,
    error: settledError(latestRunResult),
    partial: latestRunResult.status === "rejected"
  });

  const modules = {
    teamPower,
    focusedSlate,
    topAdds,
    playerInsight,
    goalieContext,
    runStatus
  };

  return {
    routeState,
    mixedState: buildMixedState({
      requestedDate: routeState.date,
      modules: Object.values(modules)
    }),
    modules
  };
}
