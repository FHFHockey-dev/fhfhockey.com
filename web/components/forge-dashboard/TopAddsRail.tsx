import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO, startOfWeek } from "date-fns";

import OwnershipSparkline from "components/TransactionTrends/OwnershipSparkline";
import useSchedule from "components/GameGrid/utils/useSchedule";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
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
  uncertainty: number | null;
};

type ProjectionResponse = {
  asOfDate: string | null;
  requestedDate: string | null;
  horizonGames: number;
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
  generatedAt?: string;
  risers: OwnershipTrendRow[];
  fallers: OwnershipTrendRow[];
};

const DEFAULT_MIN_OWNERSHIP = 25;
const DEFAULT_MAX_OWNERSHIP = 75;
const MAX_VISIBLE_ADDS = 6;
const MAX_ADD_SPARKS = 2;

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

function formatOwnershipChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
}

function matchesPosition(position: string | null | undefined, filter: TopAddsRailProps["position"]): boolean {
  const normalized = (position ?? "").toUpperCase();
  if (filter === "all") return true;
  if (filter === "f") return !normalized.includes("D") && !normalized.includes("G");
  if (filter === "d") return normalized.includes("D");
  if (filter === "g") return normalized.includes("G");
  return true;
}

export default function TopAddsRail({
  date,
  position,
  positionLabel,
  onStatusChange
}: TopAddsRailProps) {
  const [mode, setMode] = useState<TopAddsMode>("tonight");
  const [minOwnership, setMinOwnership] = useState(DEFAULT_MIN_OWNERSHIP);
  const [maxOwnership, setMaxOwnership] = useState(DEFAULT_MAX_OWNERSHIP);
  const [projectionResponse, setProjectionResponse] =
    useState<ProjectionResponse | null>(null);
  const [ownershipResponse, setOwnershipResponse] =
    useState<OwnershipResponse | null>(null);
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

    const ownershipParams = new URLSearchParams();
    ownershipParams.set("window", "5");
    ownershipParams.set("limit", "40");
    if (position !== "all") {
      ownershipParams.set("pos", position.toUpperCase());
    }

    Promise.all([
      fetchCachedJson<ProjectionResponse>(
        `/api/v1/forge/players?${projectionParams.toString()}`,
        {
          ttlMs: 60_000
        }
      ),
      fetchCachedJson<OwnershipResponse>(
        `/api/v1/transactions/ownership-trends?${ownershipParams.toString()}`,
        {
          ttlMs: 60_000
        }
      )
    ])
      .then(([projectionPayload, ownershipPayload]) => {
        if (!active) return;
        setProjectionResponse(projectionPayload);
        setOwnershipResponse(ownershipPayload);
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
    const ownershipRows = ownershipResponse
      ? [...(ownershipResponse.risers ?? []), ...(ownershipResponse.fallers ?? [])]
      : [];
    const ownershipByPlayerId = new Map<number, OwnershipTrendRow>();
    const ownershipByName = new Map<string, OwnershipTrendRow>();

    ownershipRows.forEach((row) => {
      if (row.playerId != null) {
        ownershipByPlayerId.set(row.playerId, row);
      }
      ownershipByName.set(normalizeName(row.name), row);
    });

    return projections
      .map((row) => {
        const ownershipRow =
          ownershipByPlayerId.get(row.player_id) ??
          ownershipByName.get(normalizeName(row.player_name));

        if (!ownershipRow) return null;
        if (!matchesPosition(row.position, position)) return null;

        const ownership = ownershipRow.latest;
        if (ownership < minOwnership || ownership > maxOwnership) return null;

        const teamAbbr = resolveTeamAbbr(
          ownershipRow.teamAbbrev ?? null,
          row.team_name
        );
        const scheduleContext = teamAbbr
          ? scheduleContextMap[teamAbbr]
          : undefined;

        return {
          playerId: row.player_id,
          name: row.player_name ?? ownershipRow.name,
          team: ownershipRow.teamAbbrev ?? ownershipRow.teamFullName ?? row.team_name,
          teamAbbr,
          position: row.position ?? ownershipRow.displayPosition ?? null,
          headshot: ownershipRow.headshot,
          ownership,
          ownershipTimeline: ownershipRow.sparkline ?? [],
          delta: ownershipRow.delta,
          projectionPts: row.pts ?? 0,
          ppp: row.ppp ?? 0,
          sog: row.sog ?? 0,
          hit: row.hit ?? 0,
          blk: row.blk ?? 0,
          uncertainty: row.uncertainty,
          scheduleGamesRemaining: scheduleContext?.gamesRemaining ?? null,
          scheduleOffNightsRemaining: scheduleContext?.offNightsRemaining ?? null,
          scheduleLabel: scheduleContext?.summaryLabel ?? null
        } satisfies TopAddsCandidateInput;
      })
      .filter((row): row is TopAddsCandidateInput => Boolean(row));
  }, [
    maxOwnership,
    minOwnership,
    ownershipResponse,
    position,
    projectionResponse,
    scheduleContextMap
  ]);

  const candidates = useMemo(() => {
    return rankTopAddsCandidates(candidateInputs, mode)
      .slice(0, MAX_VISIBLE_ADDS);
  }, [candidateInputs, mode]);

  const staleMessage =
    !loading &&
    !error &&
    projectionResponse?.asOfDate &&
    projectionResponse.asOfDate !== date
      ? `Top Adds using ${projectionResponse.asOfDate}`
      : null;

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
            <strong>Ownership band</strong>
            <span>
              {minOwnership}% to {maxOwnership}%
            </span>
          </div>
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
            Compact ownership charts stay on the lead add cards only.
          </p>
          {candidates.map((candidate, index) => (
            <Link
              key={candidate.playerId}
              href={`/forge/player/${candidate.playerId}?date=${date}&mode=${mode}`}
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
                  Score <strong>{formatProjection(candidate.score.total)}</strong>
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
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
