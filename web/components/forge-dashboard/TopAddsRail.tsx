import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO, startOfWeek } from "date-fns";

import OwnershipSparkline from "components/TransactionTrends/OwnershipSparkline";
import useSchedule from "components/GameGrid/utils/useSchedule";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import { buildForgeHref } from "lib/dashboard/forgeLinks";
import {
  deriveYahooSeason,
  fetchOwnershipSnapshotMap
} from "lib/dashboard/playerOwnership";
import {
  rankTopAddsCandidates,
  type TopAddsCandidateInput,
  type TopAddsMode
} from "lib/dashboard/topAddsRanking";
import {
  buildTopAddsScheduleContextMap,
  type TopAddsScheduleContextMap
} from "lib/dashboard/topAddsScheduleContext";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeDashboard.module.scss";

type TopAddsRailProps = {
  date: string;
  position: "all" | "f" | "d" | "g";
  positionLabel: string;
  onResolvedDate?: (resolvedDate: string | null) => void;
  onStatusChange?: (status: {
    loading: boolean;
    error: string | null;
    staleMessage: string | null;
    empty: boolean;
  }) => void;
};

type ProjectionRow = {
  player_id: number;
  player_name: string | null;
  team_name: string | null;
  position: string | null;
  pts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  uncertainty: unknown;
  degradedProjectionContext?: TopAddsCandidateInput["degradedProjectionContext"];
};

type ProjectionResponse = {
  asOfDate: string | null;
  requestedDate: string | null;
  horizonGames: number;
  degradedProjectionSummary?: {
    degradedPlayerCount: number;
    lineComboFallbackPlayerCount: number;
    hardStaleLineComboPlayerCount: number;
    missingLineComboPlayerCount: number;
    softStaleLineComboPlayerCount: number;
    skaterPoolRecoveryPlayerCount: number;
    note: string | null;
  } | null;
  data: ProjectionRow[];
};

type OwnershipPoint = {
  date: string;
  value: number;
};

type OwnershipTrendRow = {
  playerKey: string;
  playerId: number | null;
  name: string;
  headshot: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  teamAbbrev?: string | null;
  latest: number;
  previous: number;
  delta: number;
  deltaPct: number;
  sparkline: OwnershipPoint[];
};

type OwnershipResponse = {
  success: boolean;
  windowDays: number;
  generatedAt?: string | null;
  selectedPlayers?: OwnershipTrendRow[];
  risers?: OwnershipTrendRow[];
  fallers?: OwnershipTrendRow[];
};

const DEFAULT_MIN_OWNERSHIP = 25;
const DEFAULT_MAX_OWNERSHIP = 75;
const MAX_VISIBLE_ADDS = 6;
const MAX_ADD_SPARKS = 2;
const MAX_ADD_INSPECTORS = 2;

function areScheduleMapsEqual(
  left: TopAddsScheduleContextMap,
  right: TopAddsScheduleContextMap
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => {
    const leftEntry = left[key];
    const rightEntry = right[key];
    if (!leftEntry || !rightEntry) return false;

    return (
      leftEntry.teamAbbr === rightEntry.teamAbbr &&
      leftEntry.gamesRemaining === rightEntry.gamesRemaining &&
      leftEntry.offNightsRemaining === rightEntry.offNightsRemaining &&
      leftEntry.summaryLabel === rightEntry.summaryLabel
    );
  });
}

function TopAddsWeekScheduleBridge({
  date,
  onContextChange
}: {
  date: string;
  onContextChange: (payload: {
    contextMap: TopAddsScheduleContextMap;
    loading: boolean;
  }) => void;
}) {
  const weekStartDate = useMemo(
    () =>
      format(
        startOfWeek(parseISO(date), { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      ),
    [date]
  );
  const [weekSchedule, weekNumGamesPerDay, scheduleLoading] = useSchedule(
    weekStartDate,
    false
  );

  useEffect(() => {
    onContextChange({
      contextMap: buildTopAddsScheduleContextMap(
        weekSchedule,
        weekNumGamesPerDay,
        date
      ),
      loading: scheduleLoading
    });
  }, [date, onContextChange, scheduleLoading, weekNumGamesPerDay, weekSchedule]);

  return null;
}

function resolveTeamAbbr(
  teamAbbrev: string | null | undefined,
  teamName: string | null | undefined
): string | null {
  if (teamAbbrev && teamAbbrev.trim().length > 0) {
    return teamAbbrev.trim().toUpperCase();
  }

  const normalizedName = (teamName ?? "").trim().toLowerCase();
  if (!normalizedName) return null;

  const match = Object.values(teamsInfo).find(
    (team) => team.name.toLowerCase() === normalizedName
  );
  return match?.abbrev ?? null;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatSigned(value: number | null | undefined, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function formatProjection(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
}

function formatSignedContribution(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function formatOwnershipChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
}

function extractUncertaintyPenalty(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const model = (value as Record<string, unknown>).model;
  if (!model || typeof model !== "object") {
    return null;
  }

  const skaterSelection = (model as Record<string, unknown>).skater_selection;
  if (!skaterSelection || typeof skaterSelection !== "object") {
    return null;
  }

  const roleContinuity = (skaterSelection as Record<string, unknown>).role_continuity;
  if (!roleContinuity || typeof roleContinuity !== "object") {
    return null;
  }

  const volatilityIndex = (roleContinuity as Record<string, unknown>).volatility_index;
  return typeof volatilityIndex === "number" && Number.isFinite(volatilityIndex)
    ? volatilityIndex
    : null;
}

function matchesPosition(position: string | null | undefined, filter: TopAddsRailProps["position"]): boolean {
  const normalized = (position ?? "").toUpperCase();
  if (filter === "all") return true;
  if (filter === "f") return !normalized.includes("D") && !normalized.includes("G");
  if (filter === "d") return normalized.includes("D");
  if (filter === "g") return normalized.includes("G");
  return true;
}

function getOwnershipRows(response: OwnershipResponse | null): OwnershipTrendRow[] {
  if (!response) return [];
  if (Array.isArray(response.selectedPlayers) && response.selectedPlayers.length > 0) {
    return response.selectedPlayers;
  }
  return [...(response.risers ?? []), ...(response.fallers ?? [])];
}

export default function TopAddsRail({
  date,
  position,
  positionLabel,
  onResolvedDate,
  onStatusChange
}: TopAddsRailProps) {
  const [mode, setMode] = useState<TopAddsMode>("tonight");
  const [minOwnership, setMinOwnership] = useState(DEFAULT_MIN_OWNERSHIP);
  const [maxOwnership, setMaxOwnership] = useState(DEFAULT_MAX_OWNERSHIP);
  const [projectionResponse, setProjectionResponse] =
    useState<ProjectionResponse | null>(null);
  const [ownershipResponse, setOwnershipResponse] =
    useState<OwnershipResponse | null>(null);
  const [ownershipSnapshotMap, setOwnershipSnapshotMap] = useState<
    Record<number, number | null>
  >({});
  const [scheduleContextMap, setScheduleContextMap] =
    useState<TopAddsScheduleContextMap>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleWeekContextChange = useCallback(
    ({
      contextMap,
      loading: loadingValue
    }: {
      contextMap: TopAddsScheduleContextMap;
      loading: boolean;
    }) => {
      setScheduleContextMap((current) =>
        areScheduleMapsEqual(current, contextMap) ? current : contextMap
      );
      setScheduleLoading((current) =>
        current === loadingValue ? current : loadingValue
      );
    },
    []
  );

  useEffect(() => {
    if (mode !== "week") {
      setScheduleContextMap({});
      setScheduleLoading(false);
      return;
    }
  }, [mode]);

  useEffect(() => {
    if (minOwnership > maxOwnership) {
      setMaxOwnership(minOwnership);
    }
  }, [minOwnership, maxOwnership]);

  useEffect(() => {
    if (maxOwnership < minOwnership) {
      setMinOwnership(maxOwnership);
    }
  }, [maxOwnership, minOwnership]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const projectionParams = new URLSearchParams();
    projectionParams.set("date", date);
    projectionParams.set("horizon", mode === "tonight" ? "1" : "5");

    fetchCachedJson<ProjectionResponse>(
      `/api/v1/forge/players?${projectionParams.toString()}`,
      {
        ttlMs: 60_000
      }
    )
      .then(async (projectionPayload) => {
        if (!active) return;
        setProjectionResponse(projectionPayload);

        const projectedPlayerIds = Array.from(
          new Set(
            (projectionPayload.data ?? [])
              .map((row) => row.player_id)
              .filter((playerId) => Number.isFinite(playerId))
          )
        );

        if (projectedPlayerIds.length === 0) {
          const ownershipParams = new URLSearchParams({
            window: "5"
          });
          if (position !== "all") {
            ownershipParams.set("pos", position.toUpperCase());
          }
          const ownershipPayload = await fetchCachedJson<OwnershipResponse>(
            `/api/v1/transactions/ownership-trends?${ownershipParams.toString()}`,
            {
              ttlMs: 60_000
            }
          );
          if (!active) return;
          setOwnershipResponse(ownershipPayload);
          setOwnershipSnapshotMap({});
          return;
        }

        const ownershipParams = new URLSearchParams({
          window: "5",
          playerIds: projectedPlayerIds.join(","),
          season: String(deriveYahooSeason(date)),
          includeFlat: "1"
        });
        if (position !== "all") {
          ownershipParams.set("pos", position.toUpperCase());
        }

        const ownershipPayload = await fetchCachedJson<OwnershipResponse>(
          `/api/v1/transactions/ownership-trends?${ownershipParams.toString()}`,
          {
            ttlMs: 60_000
          }
        );
        const coveredPlayerIds = new Set(
          getOwnershipRows(ownershipPayload)
            .map((row) => row.playerId)
            .filter((playerId): playerId is number => Number.isFinite(playerId))
        );
        const missingSnapshotIds = projectedPlayerIds.filter(
          (playerId) => !coveredPlayerIds.has(playerId)
        );
        const snapshotMap =
          missingSnapshotIds.length > 0
            ? await fetchOwnershipSnapshotMap(missingSnapshotIds, date)
            : {};

        if (!active) return;
        setOwnershipResponse(ownershipPayload);
        setOwnershipSnapshotMap(snapshotMap);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load top-adds rail.";
        setError(message);
        setProjectionResponse(null);
        setOwnershipResponse(null);
        setOwnershipSnapshotMap({});
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, mode, position]);

  const candidateInputs = useMemo(() => {
    const projections = projectionResponse?.data ?? [];
    const ownershipRows = getOwnershipRows(ownershipResponse);
    const ownershipByPlayerId = new Map<number, OwnershipTrendRow>();
    const ownershipByName = new Map<string, OwnershipTrendRow>();

    ownershipRows.forEach((row) => {
      if (row.playerId != null) {
        ownershipByPlayerId.set(row.playerId, row);
      }
      ownershipByName.set(normalizeName(row.name), row);
    });

    return projections.flatMap<TopAddsCandidateInput>((row) => {
        const ownershipRow =
          ownershipByPlayerId.get(row.player_id) ??
          ownershipByName.get(normalizeName(row.player_name));
        if (!matchesPosition(row.position, position)) return [];

        const ownership =
          ownershipRow?.latest ?? ownershipSnapshotMap[row.player_id] ?? null;
        if (ownership == null) return [];
        if (ownership < minOwnership || ownership > maxOwnership) return [];

        const teamAbbr = resolveTeamAbbr(
          ownershipRow?.teamAbbrev ?? null,
          row.team_name
        );
        const scheduleContext = teamAbbr
          ? scheduleContextMap[teamAbbr]
          : undefined;

        const candidate: TopAddsCandidateInput = {
          playerId: row.player_id,
          name: row.player_name ?? ownershipRow?.name ?? `Player ${row.player_id}`,
          team:
            ownershipRow?.teamAbbrev ??
            ownershipRow?.teamFullName ??
            row.team_name,
          teamAbbr,
          position: row.position ?? ownershipRow?.displayPosition ?? null,
          headshot: ownershipRow?.headshot ?? null,
          ownership,
          ownershipTimeline: ownershipRow?.sparkline ?? [],
          delta: ownershipRow?.delta ?? 0,
          projectionPts: row.pts ?? 0,
          ppp: row.ppp ?? 0,
          sog: row.sog ?? 0,
          hit: row.hit ?? 0,
          blk: row.blk ?? 0,
          uncertainty: extractUncertaintyPenalty(row.uncertainty),
          degradedProjectionContext: row.degradedProjectionContext ?? null,
          scheduleGamesRemaining: scheduleContext?.gamesRemaining ?? null,
          scheduleOffNightsRemaining: scheduleContext?.offNightsRemaining ?? null,
          scheduleLabel: scheduleContext?.summaryLabel ?? null
        };

        return [candidate];
      });
  }, [
    maxOwnership,
    minOwnership,
    ownershipResponse,
    ownershipSnapshotMap,
    position,
    projectionResponse,
    scheduleContextMap
  ]);

  const missingOwnershipCount = useMemo(() => {
    const projections = projectionResponse?.data ?? [];
    const ownershipByPlayerId = new Map<number, OwnershipTrendRow>();
    const ownershipByName = new Map<string, OwnershipTrendRow>();

    getOwnershipRows(ownershipResponse).forEach((row) => {
      if (row.playerId != null) {
        ownershipByPlayerId.set(row.playerId, row);
      }
      ownershipByName.set(normalizeName(row.name), row);
    });

    return projections.reduce((count, row) => {
      if (!matchesPosition(row.position, position)) return count;
      const ownershipRow =
        ownershipByPlayerId.get(row.player_id) ??
        ownershipByName.get(normalizeName(row.player_name));
      const snapshotOwnership = ownershipSnapshotMap[row.player_id] ?? null;
      return ownershipRow || snapshotOwnership != null ? count : count + 1;
    }, 0);
  }, [ownershipResponse, ownershipSnapshotMap, position, projectionResponse?.data]);

  const candidates = useMemo(() => {
    return rankTopAddsCandidates(candidateInputs, mode)
      .slice(0, MAX_VISIBLE_ADDS);
  }, [candidateInputs, mode]);

  const visibleDegradedCandidateCount = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.degradedProjectionContext?.isDegraded
      ).length,
    [candidates]
  );

  const staleMessage =
    !loading && !error
      ? [
          projectionResponse?.asOfDate && projectionResponse.asOfDate !== date
            ? `Top Adds using ${projectionResponse.asOfDate}`
            : null,
          projectionResponse?.degradedProjectionSummary?.note ?? null,
          visibleDegradedCandidateCount > 0
            ? `${visibleDegradedCandidateCount} visible add card${visibleDegradedCandidateCount === 1 ? "" : "s"} use fallback or emergency skater-pool context.`
            : null,
          missingOwnershipCount > 0
            ? `Ownership context missing for ${missingOwnershipCount} projected candidates; those players were excluded from the ownership-banded rail.`
            : null
        ]
          .filter(Boolean)
          .join(" • ") || null
      : null;

  useEffect(() => {
    onResolvedDate?.(projectionResponse?.asOfDate ?? null);
  }, [onResolvedDate, projectionResponse?.asOfDate]);

  useEffect(() => {
    onStatusChange?.({
      loading: loading || (mode === "week" && scheduleLoading),
      error,
      staleMessage,
      empty:
        !loading &&
        !(mode === "week" && scheduleLoading) &&
        !error &&
        candidates.length === 0
    });
  }, [
    candidates.length,
    error,
    loading,
    mode,
    onStatusChange,
    scheduleLoading,
    staleMessage
  ]);

  return (
    <article className={styles.topAddsRailCard} aria-label="Top player adds rail">
      {mode === "week" ? (
        <TopAddsWeekScheduleBridge
          date={date}
          onContextChange={handleWeekContextChange}
        />
      ) : null}
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Top Player Adds</h3>
        <span className={styles.panelMeta}>
          Own {minOwnership}% - {maxOwnership}%
        </span>
      </header>

      <div className={styles.topAddsControls}>
        <div
          className={styles.topAddsToggleGroup}
          role="group"
          aria-label="Top adds mode"
        >
          <button
            type="button"
            className={`${styles.topAddsToggleButton} ${mode === "tonight" ? styles.topAddsToggleButtonActive : ""}`}
            aria-pressed={mode === "tonight"}
            onClick={() => setMode("tonight")}
          >
            Tonight
          </button>
          <button
            type="button"
            className={`${styles.topAddsToggleButton} ${mode === "week" ? styles.topAddsToggleButtonActive : ""}`}
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            This Week
          </button>
        </div>

        <div className={styles.topAddsContextRow}>
          <span className={styles.topAddsChip}>{positionLabel}</span>
          <span className={styles.topAddsChip}>
            {mode === "tonight" ? "1G horizon" : "5G horizon"}
          </span>
          {mode === "week" && (
            <span className={styles.topAddsChip}>
              {scheduleLoading ? "Week context..." : "Streaming-aware"}
            </span>
          )}
        </div>

        <div className={styles.topAddsOwnershipControls}>
          <div className={styles.topAddsOwnershipHeader}>
            <strong>Top Adds ownership band</strong>
            <span>
              {minOwnership}% to {maxOwnership}%
            </span>
          </div>
          <p className={styles.compactChartNote}>
            This band only filters the Top Adds rail. Insight cards use the dashboard-level insight band.
          </p>
          <label className={styles.topAddsRangeLabel}>
            <span>Min</span>
            <input
              className={styles.topAddsRangeInput}
              type="range"
              min="0"
              max="100"
              step="1"
              value={minOwnership}
              onChange={(event) =>
                setMinOwnership(
                  Math.min(Number(event.target.value), maxOwnership)
                )
              }
              aria-label="Minimum ownership"
            />
          </label>
          <label className={styles.topAddsRangeLabel}>
            <span>Max</span>
            <input
              className={styles.topAddsRangeInput}
              type="range"
              min="0"
              max="100"
              step="1"
              value={maxOwnership}
              onChange={(event) =>
                setMaxOwnership(
                  Math.max(Number(event.target.value), minOwnership)
                )
              }
              aria-label="Maximum ownership"
            />
          </label>
        </div>
      </div>

      {loading && <p className={styles.panelState}>Loading top adds...</p>}
      {!loading && error && <p className={styles.panelState}>Error: {error}</p>}
      {!loading && !error && staleMessage && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {staleMessage}
        </p>
      )}
      {!loading && !error && candidates.length === 0 && (
        <p className={styles.panelState}>
          No add candidates for this ownership band yet.
        </p>
      )}

      {!loading && !error && candidates.length > 0 && (
        <div className={styles.topAddsList}>
          <p className={styles.compactChartNote}>
            Lead add cards keep the ownership trace and score inspector for pass-4 vetting.
          </p>
          {candidates.map((candidate, index) => (
            <Link
              key={candidate.playerId}
              href={buildForgeHref(`/forge/player/${candidate.playerId}`, {
                date,
                mode,
                resolvedDate: projectionResponse?.asOfDate
              })}
              className={styles.topAddsCandidateCard}
            >
              <div className={styles.topAddsCandidateHeader}>
                <span className={styles.topAddsCandidateRank}>{index + 1}</span>
                {candidate.headshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={candidate.headshot}
                    alt=""
                    className={styles.topAddsCandidateHeadshot}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.topAddsCandidateHeadshotPlaceholder} />
                )}
                <div className={styles.topAddsCandidateIdentity}>
                  <strong>{candidate.name}</strong>
                  <span>
                    {candidate.team ?? "--"} • {candidate.position ?? "--"}
                  </span>
                </div>
              </div>

              <div className={styles.topAddsCandidateMetrics}>
                <span>
                  Own <strong>{candidate.ownership.toFixed(0)}%</strong>
                </span>
                <span>
                  Trend <strong>{formatSigned(candidate.delta, "%")}</strong>
                </span>
                <span>
                  Proj <strong>{formatProjection(candidate.projectionPts)} PTS</strong>
                </span>
                <span>
                  Model <strong>{formatProjection(candidate.score.total)}</strong>
                </span>
                {mode === "week" && (
                  <span>
                    Week{" "}
                    <strong>
                      {candidate.scheduleLabel ?? "--"}
                    </strong>
                  </span>
                )}
              </div>

              {candidate.degradedProjectionContext?.summary ? (
                <p className={`${styles.panelState} ${styles.panelStateStale}`}>
                  {candidate.degradedProjectionContext.summary}
                </p>
              ) : null}

              <div className={styles.topAddsOwnershipTrend}>
                <div className={styles.topAddsOwnershipTrendLabel}>
                  <span>Ownership 5D</span>
                  <strong>{formatOwnershipChange(candidate.delta)}</strong>
                </div>
                {index < MAX_ADD_SPARKS ? (
                  <OwnershipSparkline
                    points={candidate.ownershipTimeline}
                    variant={candidate.delta >= 0 ? "rise" : "fall"}
                    width={100}
                    height={24}
                    svgClassName={styles.sparkSvg}
                    areaClassName={styles.sparkArea}
                    pathClassName={styles.sparkPath}
                    riseClassName={styles.sparkRise}
                    fallClassName={styles.sparkFall}
                    emptyClassName={styles.sparkEmpty}
                  />
                ) : (
                  <span className={styles.compactChartNote}>Text-first card</span>
                )}
              </div>

              <div className={styles.topAddsCandidateReasons}>
                <span>Trend Wt {formatProjection(candidate.score.trendStrengthScore)}</span>
                <span>Own Wt {formatProjection(candidate.score.ownershipBiasScore)}</span>
                <span>Proj Wt {formatProjection(candidate.score.projectionSupportScore)}</span>
                {mode === "week" && (
                  <span>Sched Wt {formatProjection(candidate.score.scheduleContextScore)}</span>
                )}
                <span>Risk {formatProjection(candidate.score.riskPenaltyScore)}</span>
              </div>

              {index < MAX_ADD_INSPECTORS && (
                <div
                  className={styles.topAddsInspector}
                  aria-label={`${candidate.name} score inspector`}
                >
                  <div className={styles.topAddsInspectorHeader}>
                    <strong>Score inspector</strong>
                    <span>Raw inputs and weighted path</span>
                  </div>
                  <div className={styles.topAddsInspectorGrid}>
                    <div className={styles.topAddsInspectorBlock}>
                      <span className={styles.topAddsInspectorEyebrow}>Raw inputs</span>
                      <p className={styles.topAddsInspectorText}>
                        Proj {formatProjection(candidate.projectionPts)} pts • PPP{" "}
                        {formatProjection(candidate.ppp)} • SOG{" "}
                        {formatProjection(candidate.sog)}
                      </p>
                      <p className={styles.topAddsInspectorText}>
                        Hits + Blocks{" "}
                        {formatProjection(candidate.hit + candidate.blk)} • Own{" "}
                        {candidate.ownership.toFixed(0)}% • 5D{" "}
                        {formatOwnershipChange(candidate.delta)}
                      </p>
                      {mode === "week" && (
                        <p className={styles.topAddsInspectorText}>
                          Week {candidate.scheduleGamesRemaining ?? 0} games • Off-nights{" "}
                          {candidate.scheduleOffNightsRemaining ?? 0}
                        </p>
                      )}
                    </div>

                    <div className={styles.topAddsInspectorBlock}>
                      <span className={styles.topAddsInspectorEyebrow}>Weighted path</span>
                      <div className={styles.topAddsInspectorBreakdown}>
                        <span>Trend {formatSignedContribution(candidate.score.trendStrengthScore)}</span>
                        <span>Own {formatSignedContribution(candidate.score.ownershipBiasScore)}</span>
                        <span>Proj {formatSignedContribution(candidate.score.projectionSupportScore)}</span>
                        <span>Sched {formatSignedContribution(candidate.score.scheduleContextScore)}</span>
                        <span>Risk -{formatProjection(candidate.score.riskPenaltyScore)}</span>
                        <span>Total {formatProjection(candidate.score.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
