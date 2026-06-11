import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo } from "react";
import useSWR from "swr";

import DeploymentTiersPanel from "components/Rankings/DeploymentTiersPanel";
import GoalieMatrixTable from "components/Rankings/GoalieMatrixTable";
import PlayerMatrixTable from "components/Rankings/PlayerMatrixTable";
import PlayerSnapshotPanel from "components/Rankings/PlayerSnapshotPanel";
import RankingsFilters, {
  type RankingsFilterState,
} from "components/Rankings/RankingsFilters";
import RankingsTable from "components/Rankings/RankingsTable";
import SplitsPanel from "components/Rankings/SplitsPanel";
import TeamMatrixTable from "components/Rankings/TeamMatrixTable";
import TrendingPanel from "components/Rankings/TrendingPanel";
import { getContextualRankingMetricDefinition } from "lib/rankings/metricDefinitions";
import type { DeploymentTiersResponse } from "lib/rankings/deploymentTiers";
import type {
  GoalieMatrixMetricKey,
  GoalieMatrixResponse,
} from "lib/rankings/goalieMatrix";
import type { PlayerMatrixResponse } from "lib/rankings/playerMatrix";
import type {
  TeamMatrixMetricKey,
  TeamMatrixResponse,
} from "lib/rankings/teamMatrix";
import type {
  ContextualRankingsResponse,
  ContextualRankingsSortDirection,
  ContextualRankingsSortKey,
} from "lib/rankings/rankingTypes";
import {
  buildClientRankingsRequest,
  buildDeploymentTiersRequestPath,
  buildGoalieMatrixRequestPath,
  buildMatrixRequestPath,
  buildRankingsContextSummary,
  buildRankingsRequestPath,
  buildSplitsRequestPath,
  buildTeamMatrixRequestPath,
  buildTrendingRequestPath,
  defaultDirectionForSort,
  normalizeRankingsFilters,
} from "lib/rankings/rankingUrlState";
import type { RankingsSplitsResponse } from "lib/rankings/splits";
import type { TrendingResponse } from "lib/rankings/trending";

import styles from "styles/Rankings.module.scss";

const TABS: Array<{
  key: RankingsFilterState["tab"];
  label: string;
  planned?: boolean;
}> = [
  { key: "rankings", label: "Rankings" },
  { key: "metric_explorer", label: "Metric Explorer" },
  { key: "deployment_tiers", label: "Deployment Tiers" },
  { key: "trending", label: "Trending" },
  { key: "splits", label: "Splits" },
  { key: "war", label: "Wins Above Replacement", planned: true },
];

const fetcher = async <T,>(url: string) => {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload != null &&
      typeof payload === "object" &&
      typeof payload.error === "string"
        ? payload.error
        : "Unable to load rankings.";
    throw new Error(message);
  }
  return payload as T;
};

function filtersToQuery(filters: RankingsFilterState) {
  const query: Record<string, string> = {
    entity: filters.entity,
    tab: filters.tab,
    season: filters.season,
    window: filters.window,
    position: filters.position,
    deployment: filters.deployment,
    strength: filters.strength,
    metric: filters.metric,
    min_gp: filters.minGp,
    min_toi: filters.minToi,
    sort: filters.sort,
    direction: filters.direction,
    sort_metric: filters.matrixSortMetric,
    goalie_metric: filters.goalieMetric,
    team_metric: filters.teamMetric,
    sort_direction: filters.matrixSortDirection,
    page: filters.page,
    page_size: filters.pageSize,
  };
  if (filters.sampleConfidence !== "all") {
    query.sample_confidence = filters.sampleConfidence;
  }
  if (filters.sourceQuality !== "all") {
    query.source_quality = filters.sourceQuality;
  }
  if (filters.metricGroups.trim() !== "") {
    query.groups = filters.metricGroups.trim();
  }
  if (filters.metricColumns.trim() !== "") {
    query.columns = filters.metricColumns.trim();
  }
  if (filters.team.trim() !== "") query.team = filters.team.trim();
  if (filters.selectedPlayerId.trim() !== "") {
    query.selected_player = filters.selectedPlayerId.trim();
  }
  return query;
}

function csvSet(value: string) {
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function applyMatrixDisplayFilters(
  payload: PlayerMatrixResponse | undefined,
  filters: RankingsFilterState,
) {
  if (!payload) return null;
  const groups = csvSet(filters.metricGroups);
  const columns = csvSet(filters.metricColumns);
  const metricColumns = payload.meta.metricColumns.filter((column) => {
    if (groups.size > 0 && !groups.has(column.groupKey)) return false;
    if (columns.size > 0 && !columns.has(column.metricKey)) return false;
    if (filters.sourceQuality === "clean_only") {
      return column.sourceQualityFlags.length === 0;
    }
    if (filters.sourceQuality === "caveats_only") {
      return column.sourceQualityFlags.length > 0;
    }
    return true;
  });
  const visibleGroupKeys = new Set(metricColumns.map((column) => column.groupKey));
  return {
    ...payload,
    meta: {
      ...payload.meta,
      metricColumns,
      metricGroups: payload.meta.metricGroups.filter((group) =>
        visibleGroupKeys.has(group.key),
      ),
    },
  };
}

const SECONDARY_TAB_COPY: Record<
  Exclude<RankingsFilterState["tab"], "rankings" | "metric_explorer">,
  {
    title: string;
    status: string;
    items: Array<{ label: string; state: "verified" | "planned"; text: string }>;
  }
> = {
  deployment_tiers: {
    title: "Deployment Tiers",
    status: "Source contract verified; tier summaries are staged next.",
    items: [
      {
        label: "EV buckets",
        state: "verified",
        text: "L1-L4 and P1-P3 come from rolling line-combination context.",
      },
      {
        label: "Special teams",
        state: "verified",
        text: "PP unit labels are available; PK buckets remain conservative.",
      },
      {
        label: "Tier summaries",
        state: "planned",
        text: "Percentile rollups by bucket are not published yet.",
      },
    ],
  },
  trending: {
    title: "Trending",
    status: "Rolling windows are verified; delta publishing is staged next.",
    items: [
      {
        label: "Windows",
        state: "verified",
        text: "Season, last 5, last 10, and last 20 player-game windows exist.",
      },
      {
        label: "Usage",
        state: "verified",
        text: "TOI/G, line context, PP context, and sample confidence are available.",
      },
      {
        label: "Trend deltas",
        state: "planned",
        text: "Change calculations are not published as tab rows yet.",
      },
    ],
  },
  splits: {
    title: "Splits",
    status: "Only verified split dimensions are enabled for this milestone.",
    items: [
      {
        label: "Strength",
        state: "verified",
        text: "All, true 5v5, EV, PP, and PK ranking contexts are supported.",
      },
      {
        label: "Windows",
        state: "verified",
        text: "Season and rolling player-game windows are supported.",
      },
      {
        label: "Home/away",
        state: "planned",
        text: "Home/away split rows are not wired into this ranking surface.",
      },
    ],
  },
  war: {
    title: "Wins Above Replacement",
    status: "WAR remains unavailable until a defensible model is documented.",
    items: [
      {
        label: "Model target",
        state: "planned",
        text: "Replacement baseline, position adjustment, and validation are not approved.",
      },
      {
        label: "Inputs",
        state: "planned",
        text: "Current matrix metrics are not a WAR substitute.",
      },
      {
        label: "Publishing",
        state: "planned",
        text: "No WAR values are exposed in API or UI.",
      },
    ],
  },
};

function SecondaryTabState({ tab }: { tab: Exclude<RankingsFilterState["tab"], "rankings" | "metric_explorer"> }) {
  const copy = SECONDARY_TAB_COPY[tab];
  return (
    <section className={styles.statePanel} aria-label={`${copy.title} status`}>
      <h2>{copy.title}</h2>
      <p>{copy.status}</p>
      <div className={styles.secondaryTabGrid}>
        {copy.items.map((item) => (
          <article key={item.label}>
            <span
              className={
                item.state === "verified"
                  ? styles.secondaryTabVerified
                  : styles.secondaryTabPlanned
              }
            >
              {item.state === "verified" ? "Verified" : "Planned"}
            </span>
            <h3>{item.label}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function matrixResultSummary(
  payload: PlayerMatrixResponse | undefined,
  filters: RankingsFilterState,
) {
  if (!payload) return "Loading rankings";
  const sortMetric = payload.meta.metricColumns.find(
    (column) => column.metricKey === payload.meta.sortMetric,
  );
  const window =
    filters.window === "season"
      ? "Season"
      : filters.window.replace("last", "Last ");
  return `Sorted by ${sortMetric?.fullLabel ?? payload.meta.sortMetric} percentile · ${payload.meta.activePeerGroupDescription} · ${filters.strength.toUpperCase()} · ${window}`;
}

function goalieResultSummary(
  payload: GoalieMatrixResponse | undefined,
  filters: RankingsFilterState,
) {
  if (!payload) return "Loading goalie rankings";
  const sortMetric = payload.meta.metricColumns.find(
    (column) => column.metricKey === payload.request.metric,
  );
  const window =
    filters.window === "season"
      ? "Season"
      : filters.window.replace("last", "Last ");
  return `Sorted by ${sortMetric?.label ?? payload.request.metric} percentile · ${window} · goalie workload filters`;
}

function teamResultSummary(
  payload: TeamMatrixResponse | undefined,
) {
  if (!payload) return "Loading team rankings";
  const sortMetric = payload.meta.metricColumns.find(
    (column) => column.metricKey === payload.request.metric,
  );
  return `Sorted by ${sortMetric?.label ?? payload.request.metric} percentile · raw/contextual team style · ${payload.meta.totalRankedRows} teams`;
}

export default function RankingsPage() {
  const router = useRouter();
  const filters = useMemo(
    () => normalizeRankingsFilters(router.query),
    [router.query],
  );
  const matrixRequestPath =
    filters.entity === "skaters" && filters.tab === "rankings"
      ? buildMatrixRequestPath(filters)
      : null;
  const goalieMatrixRequestPath =
    filters.entity === "goalies" && filters.tab === "rankings"
      ? buildGoalieMatrixRequestPath(filters)
      : null;
  const teamMatrixRequestPath =
    filters.entity === "teams" && filters.tab === "rankings"
      ? buildTeamMatrixRequestPath(filters)
      : null;
  const explorerRequestPath =
    filters.tab === "metric_explorer" ? buildRankingsRequestPath(filters) : null;
  const deploymentTiersRequestPath =
    filters.tab === "deployment_tiers"
      ? buildDeploymentTiersRequestPath(filters)
      : null;
  const trendingRequestPath =
    filters.tab === "trending" ? buildTrendingRequestPath(filters) : null;
  const splitsRequestPath =
    filters.tab === "splits" ? buildSplitsRequestPath(filters) : null;
  const {
    data: matrixData,
    error: matrixError,
    isLoading: matrixLoading,
  } = useSWR<PlayerMatrixResponse>(
    matrixRequestPath,
    (url: string) => fetcher<PlayerMatrixResponse>(url),
  );
  const {
    data: goalieMatrixData,
    error: goalieMatrixError,
    isLoading: goalieMatrixLoading,
  } = useSWR<GoalieMatrixResponse>(
    goalieMatrixRequestPath,
    (url: string) => fetcher<GoalieMatrixResponse>(url),
  );
  const {
    data: teamMatrixData,
    error: teamMatrixError,
    isLoading: teamMatrixLoading,
  } = useSWR<TeamMatrixResponse>(
    teamMatrixRequestPath,
    (url: string) => fetcher<TeamMatrixResponse>(url),
  );
  const {
    data: explorerData,
    error: explorerError,
    isLoading: explorerLoading,
  } = useSWR<ContextualRankingsResponse>(
    explorerRequestPath,
    (url: string) => fetcher<ContextualRankingsResponse>(url),
  );
  const {
    data: deploymentTiersData,
    error: deploymentTiersError,
    isLoading: deploymentTiersLoading,
  } = useSWR<DeploymentTiersResponse>(
    deploymentTiersRequestPath,
    (url: string) => fetcher<DeploymentTiersResponse>(url),
  );
  const {
    data: trendingData,
    error: trendingError,
    isLoading: trendingLoading,
  } = useSWR<TrendingResponse>(
    trendingRequestPath,
    (url: string) => fetcher<TrendingResponse>(url),
  );
  const {
    data: splitsData,
    error: splitsError,
    isLoading: splitsLoading,
  } = useSWR<RankingsSplitsResponse>(
    splitsRequestPath,
    (url: string) => fetcher<RankingsSplitsResponse>(url),
  );
  const metric = getContextualRankingMetricDefinition(filters.metric);
  const selectedPlayerId =
    filters.selectedPlayerId.trim() === ""
      ? matrixData?.selectedPlayerId ?? null
      : Number(filters.selectedPlayerId);
  const displayedMatrixData = useMemo(
    () => applyMatrixDisplayFilters(matrixData, filters),
    [matrixData, filters],
  );

  const updateFilters = (patch: Partial<RankingsFilterState>) => {
    const next = normalizeRankingsFilters(filtersToQuery({ ...filters, ...patch }));
    void router.replace(
      { pathname: router.pathname, query: filtersToQuery(next) },
      undefined,
      { shallow: true },
    );
  };

  const updateExplorerSort = (sort: ContextualRankingsSortKey) => {
    const direction =
      filters.sort === sort
        ? filters.direction === "asc"
          ? "desc"
          : "asc"
        : defaultDirectionForSort(sort);
    updateFilters({ sort, direction, page: "1" });
  };

  const updateMatrixSort = (
    metricKey: string,
    direction: ContextualRankingsSortDirection,
  ) => {
    updateFilters({
      matrixSortMetric: metricKey as RankingsFilterState["matrixSortMetric"],
      matrixSortDirection: direction,
      page: "1",
    });
  };

  return (
    <>
      <Head>
        <title>Player Rankings | FHFHockey</title>
        <meta
          name="description"
          content="Multi-metric NHL player rankings with contextual percentiles, deployment filters, and player snapshots."
        />
      </Head>

      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Player Rankings</p>
            <h1>Player Rankings</h1>
            <p>{buildRankingsContextSummary(filters)}</p>
          </div>
          <div className={styles.metaPanel}>
            <span>Data updated</span>
            <strong>
              {matrixData?.meta.snapshotDate ??
                goalieMatrixData?.meta.snapshotDate ??
                teamMatrixData?.meta.snapshotDate ??
                explorerData?.meta.snapshotDate ??
                deploymentTiersData?.meta.latestAvailableSnapshotDate ??
                trendingData?.meta.latestAvailableSnapshotDate ??
                splitsData?.meta.latestAvailableSnapshotDate ??
                "Loading"}
            </strong>
          </div>
        </header>

        <RankingsFilters
          value={filters}
          showMetric={filters.tab === "metric_explorer"}
          matrixMetricGroups={matrixData?.meta.metricGroups ?? []}
          matrixMetricColumns={matrixData?.meta.metricColumns ?? []}
          onChange={(patch) => updateFilters({ ...patch, page: "1" })}
        />

        <nav className={styles.tabs} aria-label="Rankings views">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={filters.tab === tab.key}
              onClick={() => updateFilters({ tab: tab.key, page: "1" })}
            >
              {tab.label}
              {tab.planned ? <span>Planned</span> : null}
            </button>
          ))}
        </nav>

        {filters.entity === "teams" && filters.tab === "rankings" ? (
          <section className={styles.results}>
            <div className={styles.resultsHeader}>
              <div>
                <h2>Team Rankings Matrix</h2>
                <p>{teamResultSummary(teamMatrixData)}</p>
              </div>
              <span>
                {teamMatrixData?.meta.snapshotDate
                  ? `Snapshot ${teamMatrixData.meta.snapshotDate}`
                  : "Live API"}
              </span>
            </div>
            <TeamMatrixTable
              payload={teamMatrixData ?? null}
              isLoading={teamMatrixLoading}
              errorMessage={
                teamMatrixError instanceof Error
                  ? teamMatrixError.message
                  : undefined
              }
              onSortMetric={(metricKey, direction) =>
                updateFilters({
                  teamMetric: metricKey as TeamMatrixMetricKey,
                  matrixSortDirection: direction,
                  page: "1",
                })
              }
              onPageChange={(page) => updateFilters({ page: String(page) })}
              onPageSizeChange={(pageSize) =>
                updateFilters({ page: "1", pageSize: String(pageSize) })
              }
            />
          </section>
        ) : null}

        {filters.entity === "goalies" && filters.tab === "rankings" ? (
          <section className={styles.results}>
            <div className={styles.resultsHeader}>
              <div>
                <h2>Goalie Rankings Matrix</h2>
                <p>{goalieResultSummary(goalieMatrixData, filters)}</p>
              </div>
              <span>
                {goalieMatrixData?.meta.snapshotDate
                  ? `Snapshot ${goalieMatrixData.meta.snapshotDate}`
                  : "Live API"}
              </span>
            </div>
            <GoalieMatrixTable
              payload={goalieMatrixData ?? null}
              isLoading={goalieMatrixLoading}
              errorMessage={
                goalieMatrixError instanceof Error
                  ? goalieMatrixError.message
                  : undefined
              }
              onSortMetric={(metricKey, direction) =>
                updateFilters({
                  goalieMetric: metricKey as GoalieMatrixMetricKey,
                  matrixSortDirection: direction,
                  page: "1",
                })
              }
              onPageChange={(page) => updateFilters({ page: String(page) })}
              onPageSizeChange={(pageSize) =>
                updateFilters({ page: "1", pageSize: String(pageSize) })
              }
            />
          </section>
        ) : null}

        {filters.entity === "skaters" && filters.tab === "rankings" ? (
          <section className={styles.workstation}>
            <div className={styles.matrixMain}>
              <div className={styles.resultsHeader}>
                <div>
                  <h2>Rankings Matrix</h2>
                  <p>
                    {matrixData?.meta.message ??
                      matrixResultSummary(matrixData, filters)}
                  </p>
                </div>
                <span>
                  {matrixData?.meta.snapshotDate
                    ? `Snapshot ${matrixData.meta.snapshotDate}`
                    : "Live API"}
                </span>
              </div>
              <PlayerMatrixTable
                payload={displayedMatrixData}
                isLoading={matrixLoading}
                errorMessage={
                  matrixError instanceof Error ? matrixError.message : undefined
                }
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={(playerId) =>
                  updateFilters({ selectedPlayerId: String(playerId) })
                }
                onSortMetric={updateMatrixSort}
                onPageChange={(page) => updateFilters({ page: String(page) })}
                onPageSizeChange={(pageSize) =>
                  updateFilters({ page: "1", pageSize: String(pageSize) })
                }
              />
            </div>
            <PlayerSnapshotPanel
              payload={matrixData ?? null}
              selectedPlayerId={selectedPlayerId}
            />
          </section>
        ) : null}

        {filters.entity === "skaters" && filters.tab === "metric_explorer" ? (
          <section className={styles.results}>
            <div className={styles.resultsHeader}>
              <div>
                <h2>Metric Explorer</h2>
                <p>
                  {explorerData?.meta.message ??
                    `${explorerData?.meta.rowCount ?? 0} rows`}
                </p>
              </div>
              <span>
                {metric?.displayName ?? filters.metric} ·{" "}
                {explorerData?.meta.snapshotDate
                  ? `Snapshot ${explorerData.meta.snapshotDate}`
                  : "Live API"}
              </span>
            </div>
            <RankingsTable
              rows={explorerData?.rankings ?? []}
              request={explorerData?.request ?? buildClientRankingsRequest(filters)}
              sort={filters.sort}
              direction={filters.direction}
              isLoading={explorerLoading}
              errorMessage={
                explorerError instanceof Error ? explorerError.message : undefined
              }
              unavailableMessage={
                explorerData?.meta.unavailable
                  ? explorerData.meta.message ?? "Metric unavailable."
                  : null
              }
              onSort={updateExplorerSort}
            />
          </section>
        ) : null}

        {filters.entity === "skaters" && filters.tab === "deployment_tiers" ? (
          <DeploymentTiersPanel
            payload={deploymentTiersData ?? null}
            isLoading={deploymentTiersLoading}
            errorMessage={
              deploymentTiersError instanceof Error
                ? deploymentTiersError.message
                : undefined
            }
          />
        ) : null}
        {filters.entity === "skaters" && filters.tab === "trending" ? (
          <TrendingPanel
            payload={trendingData ?? null}
            isLoading={trendingLoading}
            errorMessage={
              trendingError instanceof Error ? trendingError.message : undefined
            }
          />
        ) : null}
        {filters.entity === "skaters" && filters.tab === "splits" ? (
          <SplitsPanel
            payload={splitsData ?? null}
            isLoading={splitsLoading}
            errorMessage={
              splitsError instanceof Error ? splitsError.message : undefined
            }
          />
        ) : null}
        {filters.entity === "skaters" && filters.tab === "war" ? (
          <SecondaryTabState tab="war" />
        ) : null}
      </main>
    </>
  );
}
