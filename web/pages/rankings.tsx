import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
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
import WarPanel from "components/Rankings/WarPanel";
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
  buildSnapshotRequestPath,
  buildSplitsRequestPath,
  buildTeamMatrixRequestPath,
  buildTrendingRequestPath,
  buildWarRequestPath,
  defaultDirectionForSort,
  normalizeRankingsFilters,
} from "lib/rankings/rankingUrlState";
import type { ContextualRankingsMetadataResponse } from "lib/rankings/rankingMetadata";
import type { ContextualRankingSnapshotResponse } from "lib/rankings/snapshot";
import {
  formatPercentile,
  formatToiClock,
} from "lib/rankings/rankingFormatters";
import type { RankingsSplitsResponse } from "lib/rankings/splits";
import type { TrendingResponse } from "lib/rankings/trending";
import type { WarSurfaceResponse } from "lib/rankings/war";

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
    search: filters.search,
    display: filters.displayMode,
    sort: filters.sort,
    direction: filters.direction,
    sort_metric: filters.matrixSortMetric,
    goalie_metric: filters.goalieMetric,
    goalie_role: filters.goalieRole,
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
  if (filters.selectedGoalieId.trim() !== "") {
    query.selected_goalie = filters.selectedGoalieId.trim();
  }
  if (filters.selectedTeam.trim() !== "") {
    query.selected_team = filters.selectedTeam.trim();
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

function tabLabel(tab: RankingsFilterState["tab"]) {
  return TABS.find((entry) => entry.key === tab)?.label ?? "Rankings";
}

function UnsupportedSecondaryTabState({
  entity,
  tab,
}: {
  entity: Exclude<RankingsFilterState["entity"], "skaters">;
  tab: Exclude<RankingsFilterState["tab"], "rankings" | "war">;
}) {
  const title = tabLabel(tab);
  const entityLabel = entity === "goalies" ? "goalie" : "team";
  return (
    <section className={styles.statePanel} aria-label={`${title} status`}>
      <h2>{title}</h2>
      <p>
        {title} is Source Pending for {entityLabel} rankings. The ranking matrix
        and snapshot panels are live for this entity, but this secondary tab has
        no verified row contract yet.
      </p>
      <div className={styles.secondaryTabGrid}>
        {[
          {
            label: "Current state",
            text: `${entityLabel} rankings remain available in the Rankings tab.`,
          },
          {
            label: "Data contract",
            text: "No fake values are generated while the secondary-tab source contract is pending.",
          },
          {
            label: "Next gate",
            text: "Publish verified rows, methodology metadata, and sample semantics before enabling this tab.",
          },
        ].map((item) => (
          <article key={item.label}>
            <span className={styles.secondaryTabPlanned}>Source Pending</span>
            <h3>{item.label}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function activeMethodologySummary({
  filters,
  matrixData,
  goalieMatrixData,
  teamMatrixData,
  explorerData,
  warData,
}: {
  filters: RankingsFilterState;
  matrixData?: PlayerMatrixResponse;
  goalieMatrixData?: GoalieMatrixResponse;
  teamMatrixData?: TeamMatrixResponse;
  explorerData?: ContextualRankingsResponse;
  warData?: WarSurfaceResponse;
}) {
  if (filters.tab === "war" && warData) {
    return {
      label: warData.methodology.label,
      denominator: warData.methodology.denominator,
      methodologyVersion: "Source Pending",
      sample: warData.sourcePendingReason,
      source: warData.sourceTables.join(", "),
    };
  }

  if (filters.entity === "goalies") {
    const column = goalieMatrixData?.meta.metricColumns.find(
      (entry) => entry.metricKey === filters.goalieMetric,
    );
    return {
      label: column?.label ?? filters.goalieMetric,
      denominator:
        filters.goalieMetric === "start_share"
          ? "team goalie starts in selected window"
          : filters.goalieMetric === "save_percentage"
            ? "shots against"
            : "goalie starts / shots against where supported",
      methodologyVersion: "goalie_rankings_v1",
      sample: `Min ${filters.minGp} starts · Min ${filters.minToi} shots`,
      source:
        column?.source ??
        goalieMatrixData?.meta.sourceTables.join(", ") ??
        "goalie ranking snapshots",
    };
  }

  if (filters.entity === "teams") {
    const column = teamMatrixData?.meta.metricColumns.find(
      (entry) => entry.metricKey === filters.teamMetric,
    );
    return {
      label: column?.label ?? filters.teamMetric,
      denominator:
        filters.teamMetric === "xga60"
          ? "team minutes; lower raw xGA is better"
          : "team game snapshot metric",
      methodologyVersion: "team_rankings_v1",
      sample: "Qualified team snapshot rows only",
      source:
        column?.source ??
        teamMatrixData?.meta.sourceTables.join(", ") ??
        "team ranking snapshots",
    };
  }

  const metricKey =
    filters.tab === "metric_explorer"
      ? filters.metric
      : matrixData?.meta.sortMetric ?? filters.matrixSortMetric;
  const definition =
    explorerData?.meta.metric.key === metricKey
      ? explorerData.meta.metric
      : getContextualRankingMetricDefinition(metricKey);

  return {
    label: definition?.displayName ?? metricKey,
    denominator: definition?.denominatorDescription ?? "Metric-specific denominator.",
    methodologyVersion: definition?.methodologyVersion ?? "Source Pending",
    sample: definition?.sampleRequirements
      ? `Min ${definition.sampleRequirements.minimumGp} GP · Min ${Math.round(
          definition.sampleRequirements.minimumToiSeconds / 60,
        )} TOI min · ${definition.sampleRequirements.windowSource}`
      : `Min ${filters.minGp} GP · Min ${Math.round((Number(filters.minToi) || 0) / 60)} TOI min`,
    source:
      definition && "sourceTable" in definition
        ? definition.sourceTable ?? "contextual ranking snapshots"
        : matrixData?.meta.sourceTable ?? "contextual ranking snapshots",
  };
}

function WorkstationMethodologyPanel({
  filters,
  metadata,
  matrixData,
  goalieMatrixData,
  teamMatrixData,
  explorerData,
  warData,
}: {
  filters: RankingsFilterState;
  metadata?: ContextualRankingsMetadataResponse;
  matrixData?: PlayerMatrixResponse;
  goalieMatrixData?: GoalieMatrixResponse;
  teamMatrixData?: TeamMatrixResponse;
  explorerData?: ContextualRankingsResponse;
  warData?: WarSurfaceResponse;
}) {
  const active = activeMethodologySummary({
    filters,
    matrixData,
    goalieMatrixData,
    teamMatrixData,
    explorerData,
    warData,
  });
  const glossaryItems =
    metadata?.glossary.filter((entry) =>
      [
        "better_than_percentile",
        "source_quality_flags",
        "contextual_defensive_impact",
        "wins_above_replacement_source_pending",
      ].includes(entry.key),
    ) ?? [];

  return (
    <details className={styles.methodologyPanel}>
      <summary>
        <span>Legend & Methodology</span>
        <strong>{active.label}</strong>
      </summary>
      <div className={styles.methodologyPopover}>
        <section>
          <h2>Ranking Legend</h2>
          <dl>
            <div>
              <dt>Color</dt>
              <dd>Percentile among qualified peers; higher percentile is stronger.</dd>
            </div>
            <div>
              <dt>Rank</dt>
              <dd>Raw rank uses dense-rank semantics, so ties may share a rank.</dd>
            </div>
            <div>
              <dt>Lower Better</dt>
              <dd>Suppression metrics still color by positive better-is-higher percentile.</dd>
            </div>
            <div>
              <dt>States</dt>
              <dd>N/A, Source Pending, Low Sample, and Stale Source are distinct states.</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>Active Metric Contract</h3>
          <ul>
            <li>
              <strong>Denominator</strong>
              <span>{active.denominator}</span>
            </li>
            <li>
              <strong>Sample</strong>
              <span>{active.sample}</span>
            </li>
            <li>
              <strong>Methodology</strong>
              <span>{active.methodologyVersion}</span>
            </li>
            <li>
              <strong>Source</strong>
              <span>{active.source}</span>
            </li>
            {glossaryItems.map((entry) => (
              <li key={entry.key}>
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
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
  const role =
    payload.request.role === "all"
      ? "all goalie roles"
      : payload.rows[0]?.role.deploymentLabel ?? filters.goalieRole;
  return `Sorted by ${sortMetric?.label ?? payload.request.metric} percentile · ${window} · ${role}`;
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

type SnapshotAvailableRow = Extract<
  ContextualRankingSnapshotResponse,
  { status: "available" }
>["row"];

function isSkaterSnapshotRow(
  row: SnapshotAvailableRow,
): row is PlayerMatrixResponse["rows"][number] {
  return "entity" in row && "deployment" in row && row.entity.position !== "G";
}

function isGoalieSnapshotRow(
  row: SnapshotAvailableRow,
): row is GoalieMatrixResponse["rows"][number] {
  return "entity" in row && row.entity.position === "G";
}

function isTeamSnapshotRow(
  row: SnapshotAvailableRow,
): row is TeamMatrixResponse["rows"][number] {
  return "team" in row && !("entity" in row);
}

function compactPercent(value: number | null | undefined) {
  return value == null ? "N/A" : formatPercentile(value ?? null);
}

function pctValue(value: number | null | undefined) {
  return value == null ? "Source pending" : `${(value * 100).toFixed(1)}%`;
}

function GoalieSnapshotPanel({
  payload,
  selectedGoalieId,
  snapshotRow,
}: {
  payload: GoalieMatrixResponse | null;
  selectedGoalieId: number | null;
  snapshotRow?: GoalieMatrixResponse["rows"][number] | null;
}) {
  const row =
    (snapshotRow && (selectedGoalieId == null || snapshotRow.entity.id === selectedGoalieId)
      ? snapshotRow
      : null) ??
    payload?.rows.find((row) => row.entity.id === selectedGoalieId) ??
    payload?.rows[0] ??
    null;

  if (!payload || !row) {
    return (
      <aside className={styles.snapshotPanel} aria-label="Goalie snapshot">
        <h2>Goalie Snapshot</h2>
        <p className={styles.snapshotMuted}>No goalie is available for this filter set.</p>
      </aside>
    );
  }

  const metricCards = payload.meta.metricColumns.slice(0, 4).map((column) => {
    const cell = row.metrics[column.metricKey];
    return {
      title: column.label,
      value: cell?.formattedValue ?? "N/A",
      text:
        cell?.rank == null
          ? "Source pending"
          : `${compactPercent(cell.percentile)} · #${cell.rank}`,
    };
  });
  const bestMetric = payload.meta.metricColumns
    .map((column) => ({ column, cell: row.metrics[column.metricKey] }))
    .filter((entry) => entry.cell?.percentile != null)
    .sort((a, b) => (b.cell.percentile ?? 0) - (a.cell.percentile ?? 0))[0];

  return (
    <aside className={styles.snapshotPanel} aria-label="Goalie snapshot">
      <header className={styles.snapshotHeader}>
        <div className={styles.snapshotAvatar}>
          <img
            src={row.entity.imageUrl ?? "/pictures/player-placeholder.jpg"}
            alt={`${row.entity.name ?? `Goalie ${row.entity.id}`} headshot`}
            onError={(event) => {
              event.currentTarget.src = "/pictures/player-placeholder.jpg";
            }}
          />
        </div>
        <div>
          <h2>{row.entity.name ?? `Goalie ${row.entity.id}`}</h2>
          <p>G · {row.team.name ?? row.team.abbreviation ?? "Team unavailable"}</p>
        </div>
      </header>

      <dl className={styles.snapshotFacts}>
        <div>
          <dt>Starts</dt>
          <dd>{row.sample.gamesStarted}</dd>
        </div>
        <div>
          <dt>Shots</dt>
          <dd>{row.sample.shotsAgainst}</dd>
        </div>
        <div>
          <dt>TOI</dt>
          <dd>{formatToiClock(row.sample.toiSeconds)}</dd>
        </div>
        <div>
          <dt>Sample</dt>
          <dd>{row.sample.confidence}</dd>
        </div>
      </dl>

      <section className={styles.snapshotProfile}>
        <h3>Why He Stands Out</h3>
        <p>
          {bestMetric
            ? `${bestMetric.column.label} leads the visible goalie profile at ${compactPercent(bestMetric.cell.percentile)} with a raw value of ${bestMetric.cell.formattedValue ?? "N/A"}.`
            : "No live goalie percentile signal is available in this context."}
        </p>
      </section>

      <section className={styles.snapshotScores}>
        <h3>Key Goalie Signals</h3>
        <div>
          {metricCards.map((card) => (
            <article className={styles.snapshotScoreCard} key={card.title}>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.text}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.snapshotCaveats}>
        <h3>Role & Source Notes</h3>
        <ul>
          <li>Role bucket: {row.role.deploymentLabel ?? "Unavailable"}</li>
          <li>
            Role source:{" "}
            {row.role.deploymentSource === "goalie_start_projections.season_start_pct"
              ? "projected season start share"
              : row.role.deploymentSource === "selected_window_team_start_share"
                ? "selected-window team start share"
                : "Source Pending"}
          </li>
          <li>Start share: {pctValue(row.role.seasonStartShare)}</li>
          <li>Window start share: {pctValue(row.role.windowStartShare)}</li>
          <li>Start probability: {pctValue(row.role.startProbability)}</li>
          <li>Emergency call-up denominator adjustment remains Source Pending.</li>
          {(payload.meta.sourceWarnings.length ? payload.meta.sourceWarnings : row.warnings).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

function TeamSnapshotPanel({
  payload,
  selectedTeam,
  snapshotRow,
}: {
  payload: TeamMatrixResponse | null;
  selectedTeam: string;
  snapshotRow?: TeamMatrixResponse["rows"][number] | null;
}) {
  const normalizedSelectedTeam = selectedTeam.trim().toUpperCase();
  const row =
    (snapshotRow &&
    (normalizedSelectedTeam === "" ||
      snapshotRow.team.abbreviation.toUpperCase() === normalizedSelectedTeam)
      ? snapshotRow
      : null) ??
    payload?.rows.find(
      (row) => row.team.abbreviation.toUpperCase() === normalizedSelectedTeam,
    ) ??
    payload?.rows[0] ??
    null;

  if (!payload || !row) {
    return (
      <aside className={styles.snapshotPanel} aria-label="Team snapshot">
        <h2>Team Snapshot</h2>
        <p className={styles.snapshotMuted}>No team is available for this filter set.</p>
      </aside>
    );
  }

  const metricCards = payload.meta.metricColumns.slice(0, 4).map((column) => {
    const cell = row.metrics[column.metricKey];
    return {
      title: column.label,
      value: cell?.formattedValue ?? "N/A",
      text:
        cell?.rank == null
          ? "Source pending"
          : `${compactPercent(cell.percentile)} · #${cell.rank}`,
    };
  });
  const bestMetric = payload.meta.metricColumns
    .map((column) => ({ column, cell: row.metrics[column.metricKey] }))
    .filter((entry) => entry.cell?.percentile != null)
    .sort((a, b) => (b.cell.percentile ?? 0) - (a.cell.percentile ?? 0))[0];

  return (
    <aside className={styles.snapshotPanel} aria-label="Team snapshot">
      <header className={styles.snapshotHeader}>
        <div className={styles.snapshotAvatar}>
          <img
            src={`/teamLogos/${row.team.abbreviation}.png`}
            alt={`${row.team.name ?? row.team.abbreviation} logo`}
            onError={(event) => {
              event.currentTarget.src = "/teamLogos/FHFH.png";
            }}
          />
        </div>
        <div>
          <h2>{row.team.abbreviation}</h2>
          <p>{row.team.name ?? "Team name unavailable"}</p>
        </div>
      </header>

      <dl className={styles.snapshotFacts}>
        <div>
          <dt>Style</dt>
          <dd>{row.style.label}</dd>
        </div>
        <div>
          <dt>Games</dt>
          <dd>{row.record.styleGames || "Source pending"}</dd>
        </div>
        <div>
          <dt>PP Tier</dt>
          <dd>{row.record.ppTier ?? "N/A"}</dd>
        </div>
        <div>
          <dt>PK Tier</dt>
          <dd>{row.record.pkTier ?? "N/A"}</dd>
        </div>
      </dl>

      <section className={styles.snapshotProfile}>
        <h3>Why This Team Stands Out</h3>
        <p>
          {bestMetric
            ? `${bestMetric.column.label} is the top visible signal at ${compactPercent(bestMetric.cell.percentile)} with a raw value of ${bestMetric.cell.formattedValue ?? "N/A"}.`
            : "No live team percentile signal is available in this context."}
        </p>
      </section>

      <section className={styles.snapshotScores}>
        <h3>Team Style Signals</h3>
        <div>
          {metricCards.map((card) => (
            <article className={styles.snapshotScoreCard} key={card.title}>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.text}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.snapshotCaveats}>
        <h3>Style & Source Notes</h3>
        <ul>
          <li>Style source: {row.style.source}</li>
          <li>Shot quality uses xGF per Fenwick-for where source data supports it.</li>
          <li>Score/venue-adjusted style remains Source Pending when unavailable.</li>
          {(payload.meta.sourceWarnings.length ? payload.meta.sourceWarnings : row.warnings).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default function RankingsPage() {
  const router = useRouter();
  const [rankMode, setRankMode] = useState<"overall" | "deployment">("overall");
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
  const warRequestPath =
    filters.tab === "war" ? buildWarRequestPath(filters) : null;
  const snapshotRequestPath = buildSnapshotRequestPath(filters);
  const metadataRequestPath = "/api/v1/contextual-rankings/metadata";
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
  const {
    data: warData,
    error: warError,
    isLoading: warLoading,
  } = useSWR<WarSurfaceResponse>(
    warRequestPath,
    (url: string) => fetcher<WarSurfaceResponse>(url),
  );
  const { data: snapshotData } = useSWR<ContextualRankingSnapshotResponse>(
    snapshotRequestPath,
    (url: string) => fetcher<ContextualRankingSnapshotResponse>(url),
  );
  const { data: metadataData } = useSWR<ContextualRankingsMetadataResponse>(
    metadataRequestPath,
    (url: string) => fetcher<ContextualRankingsMetadataResponse>(url),
  );
  const metric = getContextualRankingMetricDefinition(filters.metric);
  const selectedPlayerId =
    filters.selectedPlayerId.trim() === ""
      ? matrixData?.selectedPlayerId ?? null
      : Number(filters.selectedPlayerId);
  const selectedGoalieId =
    filters.selectedGoalieId.trim() === ""
      ? goalieMatrixData?.rows[0]?.entity.id ?? null
      : Number(filters.selectedGoalieId);
  const selectedTeam =
    filters.selectedTeam.trim() === ""
      ? teamMatrixData?.rows[0]?.team.abbreviation ?? ""
      : filters.selectedTeam;
  const selectedSkaterSnapshotRow =
    filters.entity === "skaters" &&
    snapshotData?.status === "available" &&
    isSkaterSnapshotRow(snapshotData.row)
      ? snapshotData.row
      : null;
  const selectedGoalieSnapshotRow =
    filters.entity === "goalies" &&
    snapshotData?.status === "available" &&
    isGoalieSnapshotRow(snapshotData.row)
      ? snapshotData.row
      : null;
  const selectedTeamSnapshotRow =
    filters.entity === "teams" &&
    snapshotData?.status === "available" &&
    isTeamSnapshotRow(snapshotData.row)
      ? snapshotData.row
      : null;
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
                warData?.meta.generatedAt?.slice(0, 10) ??
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
          methodologyControl={
            <WorkstationMethodologyPanel
              filters={filters}
              metadata={metadataData}
              matrixData={matrixData}
              goalieMatrixData={goalieMatrixData}
              teamMatrixData={teamMatrixData}
              explorerData={explorerData}
              warData={warData}
            />
          }
        />

        <div className={styles.matrixActionBar}>
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
          <div className={styles.matrixToolbar}>
            {filters.entity === "skaters" && filters.tab === "rankings" ? (
              <>
                <div>
                  <strong>Rank Display</strong>
                  <span>
                    {rankMode === "overall"
                      ? "Overall peer rank"
                      : "Deployment bucket rank"}
                  </span>
                </div>
                <div className={styles.rankModeToggle} aria-label="Rank display mode">
                  <button
                    type="button"
                    aria-pressed={rankMode === "overall"}
                    onClick={() => setRankMode("overall")}
                  >
                    Overall
                  </button>
                  <button
                    type="button"
                    aria-pressed={rankMode === "deployment"}
                    onClick={() => setRankMode("deployment")}
                  >
                    Deployment
                  </button>
                </div>
              </>
            ) : (
              <span>
                Snapshot{" "}
                {matrixData?.meta.snapshotDate ??
                  goalieMatrixData?.meta.snapshotDate ??
                  teamMatrixData?.meta.snapshotDate ??
                  explorerData?.meta.snapshotDate ??
                  "pending"}
              </span>
            )}
          </div>
        </div>

        {filters.entity === "teams" && filters.tab === "rankings" ? (
          <section className={styles.workstation}>
            <div className={styles.matrixMain}>
              <h2 className={styles.visuallyHidden}>Team Rankings Matrix</h2>
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
                selectedTeam={selectedTeam}
                onSelectTeam={(team) => updateFilters({ selectedTeam: team })}
                displayMode={filters.displayMode}
              />
            </div>
            <TeamSnapshotPanel
              payload={teamMatrixData ?? null}
              selectedTeam={selectedTeam}
              snapshotRow={selectedTeamSnapshotRow}
            />
          </section>
        ) : null}

        {filters.entity === "goalies" && filters.tab === "rankings" ? (
          <section className={styles.workstation}>
            <div className={styles.matrixMain}>
              <h2 className={styles.visuallyHidden}>Goalie Rankings Matrix</h2>
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
                selectedGoalieId={selectedGoalieId}
                onSelectGoalie={(goalieId) =>
                  updateFilters({ selectedGoalieId: String(goalieId) })
                }
                displayMode={filters.displayMode}
              />
            </div>
            <GoalieSnapshotPanel
              payload={goalieMatrixData ?? null}
              selectedGoalieId={selectedGoalieId}
              snapshotRow={selectedGoalieSnapshotRow}
            />
          </section>
        ) : null}

        {filters.entity === "skaters" && filters.tab === "rankings" ? (
          <section className={styles.workstation}>
            <div className={styles.matrixMain}>
              <h2 className={styles.visuallyHidden}>Rankings Matrix</h2>
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
                displayMode={filters.displayMode}
                rankMode={rankMode}
              />
            </div>
            <PlayerSnapshotPanel
              payload={matrixData ?? null}
              selectedPlayerId={selectedPlayerId}
              snapshotRow={selectedSkaterSnapshotRow}
            />
          </section>
        ) : null}

        {filters.entity === "skaters" && filters.tab === "metric_explorer" ? (
          <section className={styles.results}>
            <h2 className={styles.visuallyHidden}>Metric Explorer</h2>
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
        {filters.entity !== "skaters" &&
        filters.tab !== "rankings" &&
        filters.tab !== "war" ? (
          <UnsupportedSecondaryTabState
            entity={filters.entity}
            tab={filters.tab}
          />
        ) : null}
        {filters.tab === "war" ? (
          <WarPanel
            payload={warData ?? null}
            isLoading={warLoading}
            errorMessage={warError instanceof Error ? warError.message : undefined}
          />
        ) : null}
      </main>
    </>
  );
}
