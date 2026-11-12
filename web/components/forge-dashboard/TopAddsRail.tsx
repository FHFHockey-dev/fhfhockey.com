import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO, startOfWeek } from "date-fns";

import OwnershipSparkline from "components/TransactionTrends/OwnershipSparkline";
import useSchedule from "components/GameGrid/utils/useSchedule";
import { fetchCachedJson } from "lib/dashboard/clientFetchCache";
import { buildForgeHref } from "lib/dashboard/forgeLinks";
import {
  deriveYahooSeason,
  fetchOwnershipSnapshotMap,
} from "lib/dashboard/playerOwnership";
import {
  rankTopAddsCandidates,
  toTopAddsProjection,
  TOP_ADDS_SCORING_LABEL,
  type RankedTopAddsCandidate,
  type TopAddsCandidateInput,
  type TopAddsMode,
} from "lib/dashboard/topAddsRanking";

/** Decision 118: Top Adds scores qualified per-game (one-game) lines. */
const TOP_ADDS_PROJECTION_HORIZON = 1;
import {
  buildTopAddsScheduleContextMap,
  type TopAddsScheduleContextMap,
} from "lib/dashboard/topAddsScheduleContext";
import {
  type ProjectionTeamIdentity,
  validateProjectionTeamIdentityForSeason,
} from "lib/NHL/seasonAwareScheduleTeam";
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
  g?: number | null;
  a?: number | null;
  pts: number | null;
  ppp: number | null;
  sog: number | null;
  hit: number | null;
  blk: number | null;
  uncertainty: unknown;
  teamIdentity?: ProjectionTeamIdentity | null;
  degradedProjectionContext?: TopAddsCandidateInput["degradedProjectionContext"];
};

type ProjectionResponse = {
  asOfDate: string | null;
  requestedDate: string | null;
  requestedSeasonId?: number | null;
  resolvedSeasonId?: number | null;
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
  diagnostics?: {
    state: "ready" | "empty" | "blocked";
    missingRequestedHorizon?: boolean;
    message?: string | null;
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

type TopAddsScheduleState = "idle" | "pending" | "ready" | "unavailable";

const DEFAULT_MIN_OWNERSHIP = 25;
const DEFAULT_MAX_OWNERSHIP = 75;
const MAX_VISIBLE_ADDS = 6;
const MAX_ADD_SPARKS = 2;
const MAX_ADD_INSPECTORS = 2;

function areScheduleMapsEqual(
  left: TopAddsScheduleContextMap,
  right: TopAddsScheduleContextMap,
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
  seasonId,
  onContextChange,
}: {
  date: string;
  seasonId: number | null;
  onContextChange: (payload: {
    contextMap: TopAddsScheduleContextMap;
    state: Exclude<TopAddsScheduleState, "idle">;
  }) => void;
}) {
  const weekStartDate = useMemo(
    () =>
      format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [date],
  );
  const [weekSchedule, weekNumGamesPerDay, scheduleLoading] = useSchedule(
    weekStartDate,
    false,
  );
  const requestKey = weekStartDate;
  const ownershipRef = useRef({
    requestKey,
    isInitialRequest: true,
    observedLoading: false,
  });

  if (ownershipRef.current.requestKey !== requestKey) {
    ownershipRef.current = {
      requestKey,
      isInitialRequest: false,
      observedLoading: false,
    };
  }
  if (scheduleLoading) {
    ownershipRef.current.observedLoading = true;
  }

  const ownsCurrentSchedule =
    seasonId !== null &&
    !scheduleLoading &&
    (ownershipRef.current.observedLoading ||
      ownershipRef.current.isInitialRequest);

  useEffect(() => {
    onContextChange({
      contextMap: ownsCurrentSchedule
        ? buildTopAddsScheduleContextMap(
            weekSchedule,
            weekNumGamesPerDay,
            date,
            seasonId,
          )
        : {},
      state:
        seasonId === null
          ? "unavailable"
          : ownsCurrentSchedule
            ? "ready"
            : "pending",
    });
  }, [
    date,
    onContextChange,
    ownsCurrentSchedule,
    seasonId,
    weekNumGamesPerDay,
    weekSchedule,
  ]);

  return null;
}

function resolveSelectedScheduleSeasonId(
  response: ProjectionResponse | null,
  selectedDate: string,
  mode: TopAddsMode,
): number | null {
  const seasonId = response?.requestedSeasonId;
  if (
    response?.requestedDate !== selectedDate ||
    // Decision 118: per-game (one-game) lines in both modes.
    response?.horizonGames !== TOP_ADDS_PROJECTION_HORIZON ||
    !Number.isSafeInteger(seasonId)
  ) {
    return null;
  }

  const seasonText = String(seasonId);
  const startYear = Number(seasonText.slice(0, 4));
  const endYear = Number(seasonText.slice(4));
  return /^\d{8}$/.test(seasonText) && endYear === startYear + 1
    ? Number(seasonId)
    : null;
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

function formatOwnership(value: number | null): string {
  return value == null ? "unknown" : `${value.toFixed(0)}%`;
}

/** Decision 118 expected points, or the typed incomplete state. */
function formatExpected(candidate: RankedTopAddsCandidate): string {
  const expected =
    candidate.score.total == null
      ? `incomplete (${candidate.score.missing.join(", ")})`
      : formatProjection(candidate.score.total);
  // Decision 132: an unconfirmed appearance shows the line as "if he plays".
  return candidate.score.lineLabel
    ? `${expected} · ${candidate.score.lineLabel}`
    : expected;
}


function formatOwnershipChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pts`;
}

function matchesPosition(
  position: string | null | undefined,
  filter: TopAddsRailProps["position"],
): boolean {
  const normalized = (position ?? "").toUpperCase();
  if (filter === "all") return true;
  if (filter === "f")
    return !normalized.includes("D") && !normalized.includes("G");
  if (filter === "d") return normalized.includes("D");
  if (filter === "g") return normalized.includes("G");
  return true;
}

function getOwnershipRows(
  response: OwnershipResponse | null,
): OwnershipTrendRow[] {
  if (!response) return [];
  if (
    Array.isArray(response.selectedPlayers) &&
    response.selectedPlayers.length > 0
  ) {
    return response.selectedPlayers;
  }
  return [...(response.risers ?? []), ...(response.fallers ?? [])];
}

export default function TopAddsRail({
  date,
  position,
  positionLabel,
  onResolvedDate,
  onStatusChange,
}: TopAddsRailProps) {
  const [mode, setMode] = useState<TopAddsMode>("tonight");
  const [minOwnership, setMinOwnership] = useState(DEFAULT_MIN_OWNERSHIP);
  const [maxOwnership, setMaxOwnership] = useState(DEFAULT_MAX_OWNERSHIP);
  const [projectionResponse, setProjectionResponse] =
    useState<ProjectionResponse | null>(null);
  const [projectionResponseSelectionKey, setProjectionResponseSelectionKey] =
    useState<string | null>(null);
  const [ownershipResponse, setOwnershipResponse] =
    useState<OwnershipResponse | null>(null);
  const [ownershipSnapshotMap, setOwnershipSnapshotMap] = useState<
    Record<number, number | null>
  >({});
  const [scheduleContextMap, setScheduleContextMap] =
    useState<TopAddsScheduleContextMap>({});
  const [scheduleState, setScheduleState] =
    useState<TopAddsScheduleState>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expectedHorizon = TOP_ADDS_PROJECTION_HORIZON;
  const projectionSelectionKey = `${date}:${expectedHorizon}:${position}`;
  const activeProjectionResponse =
    projectionResponseSelectionKey === projectionSelectionKey
      ? projectionResponse
      : null;
  const projectionSelectionPending =
    projectionResponseSelectionKey !== projectionSelectionKey;
  const handleWeekContextChange = useCallback(
    ({
      contextMap,
      state,
    }: {
      contextMap: TopAddsScheduleContextMap;
      state: Exclude<TopAddsScheduleState, "idle">;
    }) => {
      setScheduleContextMap((current) =>
        areScheduleMapsEqual(current, contextMap) ? current : contextMap,
      );
      setScheduleState((current) => (current === state ? current : state));
    },
    [],
  );
  const selectedScheduleSeasonId = resolveSelectedScheduleSeasonId(
    activeProjectionResponse,
    date,
    mode,
  );
  const projectionResponseOwnsSelection =
    activeProjectionResponse?.requestedDate === date &&
    activeProjectionResponse.horizonGames === expectedHorizon;
  const projectionContractError =
    activeProjectionResponse && !projectionResponseOwnsSelection
      ? "Projection response does not match the selected date and horizon."
      : null;
  const effectiveError = projectionSelectionPending
    ? null
    : (error ?? projectionContractError);

  useEffect(() => {
    if (mode !== "week") {
      setScheduleContextMap({});
      setScheduleState("idle");
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
    setOwnershipResponse(null);
    setOwnershipSnapshotMap({});

    const projectionParams = new URLSearchParams();
    projectionParams.set("date", date);
    projectionParams.set("horizon", String(expectedHorizon));

    fetchCachedJson<ProjectionResponse>(
      `/api/v1/forge/players?${projectionParams.toString()}`,
      {
        ttlMs: 60_000,
      },
    )
      .then(async (projectionPayload) => {
        if (!active) return;
        setProjectionResponse(projectionPayload);
        setProjectionResponseSelectionKey(projectionSelectionKey);

        if (
          projectionPayload.requestedDate !== date ||
          projectionPayload.horizonGames !== expectedHorizon
        ) {
          return;
        }

        if (projectionPayload.diagnostics?.state === "blocked") {
          setError(
            projectionPayload.diagnostics.message ??
              "The requested projection horizon is unavailable.",
          );
          setOwnershipResponse(null);
          setOwnershipSnapshotMap({});
          return;
        }

        const projectedPlayerIds = Array.from(
          new Set(
            (projectionPayload.data ?? [])
              .map((row) => row.player_id)
              .filter((playerId) => Number.isFinite(playerId)),
          ),
        );

        if (projectedPlayerIds.length === 0) {
          const ownershipParams = new URLSearchParams({
            window: "5",
          });
          if (position !== "all") {
            ownershipParams.set("pos", position.toUpperCase());
          }
          const ownershipPayload = await fetchCachedJson<OwnershipResponse>(
            `/api/v1/transactions/ownership-trends?${ownershipParams.toString()}`,
            {
              ttlMs: 60_000,
            },
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
          includeFlat: "1",
        });
        if (position !== "all") {
          ownershipParams.set("pos", position.toUpperCase());
        }

        const ownershipPayload = await fetchCachedJson<OwnershipResponse>(
          `/api/v1/transactions/ownership-trends?${ownershipParams.toString()}`,
          {
            ttlMs: 60_000,
          },
        );
        const coveredPlayerIds = new Set(
          getOwnershipRows(ownershipPayload)
            .map((row) => row.playerId)
            .filter((playerId): playerId is number =>
              Number.isFinite(playerId),
            ),
        );
        const missingSnapshotIds = projectedPlayerIds.filter(
          (playerId) => !coveredPlayerIds.has(playerId),
        );
        const snapshotMap =
          missingSnapshotIds.length > 0
            ? await fetchOwnershipSnapshotMap(missingSnapshotIds, date)
            : {};

        if (!active) return;
        setOwnershipResponse(ownershipPayload);
        setOwnershipSnapshotMap(snapshotMap);
      })
      .catch(() => {
        if (!active) return;
        setError("Top Adds are unavailable right now.");
        setProjectionResponse(null);
        setProjectionResponseSelectionKey(projectionSelectionKey);
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
  }, [date, expectedHorizon, position, projectionSelectionKey]);

  const candidateInputs = useMemo(() => {
    const projections = projectionResponseOwnsSelection
      ? (activeProjectionResponse?.data ?? [])
      : [];
    const ownershipRows = getOwnershipRows(ownershipResponse);
    const ownershipByPlayerId = new Map<number, OwnershipTrendRow>();

    ownershipRows.forEach((row) => {
      if (row.playerId != null) {
        ownershipByPlayerId.set(row.playerId, row);
      }
    });

    return projections.flatMap<TopAddsCandidateInput>((row) => {
      const ownershipRow = ownershipByPlayerId.get(row.player_id);
      if (!matchesPosition(row.position, position)) return [];

      const teamIdentity = validateProjectionTeamIdentityForSeason(
        row.teamIdentity,
        activeProjectionResponse?.resolvedSeasonId ?? Number.NaN,
      );
      if (!teamIdentity) return [];

      const ownership =
        ownershipRow?.latest ?? ownershipSnapshotMap[row.player_id] ?? null;
      if (ownership == null) return [];
      if (ownership < minOwnership || ownership > maxOwnership) return [];

      const teamAbbr = teamIdentity.canonical.abbreviation;
      const scheduleContext = scheduleContextMap[teamAbbr];

      const candidate: TopAddsCandidateInput = {
        playerId: row.player_id,
        name:
          row.player_name ?? ownershipRow?.name ?? `Player ${row.player_id}`,
        team: teamIdentity.source.name,
        teamAbbr,
        position: row.position ?? ownershipRow?.displayPosition ?? null,
        headshot: ownershipRow?.headshot ?? null,
        ownership,
        ownershipTimeline: ownershipRow?.sparkline ?? [],
        delta: ownershipRow?.delta ?? 0,
        // Missing heads stay null to the score (W3-2 D3).
        ...toTopAddsProjection(row),
        degradedProjectionContext: row.degradedProjectionContext ?? null,
        scheduleGamesRemaining: scheduleContext?.gamesRemaining ?? null,
        scheduleOffNightsRemaining: scheduleContext?.offNightsRemaining ?? null,
        scheduleLabel: scheduleContext?.summaryLabel ?? null,
      };

      return [candidate];
    });
  }, [
    maxOwnership,
    minOwnership,
    ownershipResponse,
    ownershipSnapshotMap,
    position,
    activeProjectionResponse,
    projectionResponseOwnsSelection,
    scheduleContextMap,
  ]);

  const missingOwnershipCount = useMemo(() => {
    const projections = projectionResponseOwnsSelection
      ? (activeProjectionResponse?.data ?? [])
      : [];
    const ownershipByPlayerId = new Map<number, OwnershipTrendRow>();

    getOwnershipRows(ownershipResponse).forEach((row) => {
      if (row.playerId != null) {
        ownershipByPlayerId.set(row.playerId, row);
      }
    });

    return projections.reduce((count, row) => {
      if (!matchesPosition(row.position, position)) return count;
      const ownershipRow = ownershipByPlayerId.get(row.player_id);
      const snapshotOwnership = ownershipSnapshotMap[row.player_id] ?? null;
      return ownershipRow || snapshotOwnership != null ? count : count + 1;
    }, 0);
  }, [
    ownershipResponse,
    ownershipSnapshotMap,
    position,
    activeProjectionResponse?.data,
    projectionResponseOwnsSelection,
  ]);

  const candidates = useMemo(() => {
    return rankTopAddsCandidates(candidateInputs, mode).slice(
      0,
      MAX_VISIBLE_ADDS,
    );
  }, [candidateInputs, mode]);

  const visibleDegradedCandidateCount = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.degradedProjectionContext?.isDegraded,
      ).length,
    [candidates],
  );

  const staleMessage =
    !loading && !effectiveError
      ? [
          activeProjectionResponse?.asOfDate &&
          activeProjectionResponse.asOfDate !== date
            ? `Top Adds using ${activeProjectionResponse.asOfDate}`
            : null,
          activeProjectionResponse?.degradedProjectionSummary?.note ?? null,
          visibleDegradedCandidateCount > 0
            ? `${visibleDegradedCandidateCount} visible add card${visibleDegradedCandidateCount === 1 ? "" : "s"} has less certain role data than usual.`
            : null,
          missingOwnershipCount > 0
            ? `Ownership is missing for ${missingOwnershipCount} projected candidates, so they are hidden by this ownership range.`
            : null,
        ]
          .filter(Boolean)
          .join(" • ") || null
      : null;

  useEffect(() => {
    onResolvedDate?.(activeProjectionResponse?.asOfDate ?? null);
  }, [activeProjectionResponse?.asOfDate, onResolvedDate]);

  const panelLoading =
    loading ||
    projectionSelectionPending ||
    (mode === "week" && scheduleState === "pending");

  useEffect(() => {
    onStatusChange?.({
      loading: panelLoading,
      error: effectiveError,
      staleMessage,
      empty: !panelLoading && !effectiveError && candidates.length === 0,
    });
  }, [
    candidates.length,
    effectiveError,
    onStatusChange,
    panelLoading,
    staleMessage,
  ]);

  return (
    <article className={styles.topAddsRailCard} aria-label="Best waiver adds">
      {mode === "week" ? (
        <TopAddsWeekScheduleBridge
          date={date}
          seasonId={selectedScheduleSeasonId}
          onContextChange={handleWeekContextChange}
        />
      ) : null}
      <header className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Best Waiver Adds</h3>
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
            {mode === "tonight" ? "Tonight" : "Next 5 games"}
          </span>
          {mode === "week" && (
            <span className={styles.topAddsChip}>
              {selectedScheduleSeasonId === null ||
              scheduleState === "unavailable"
                ? "Schedule unavailable"
                : scheduleState === "ready"
                  ? "Schedule included"
                  : "Loading schedule..."}
            </span>
          )}
        </div>

        <div className={styles.topAddsOwnershipControls}>
          <div className={styles.topAddsOwnershipHeader}>
            <strong>Show players owned in</strong>
            <span>
              {minOwnership}% to {maxOwnership}%
            </span>
          </div>
          <p className={styles.compactChartNote}>
            Adjust this if your league is deeper or shallower than normal.
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
                  Math.min(Number(event.target.value), maxOwnership),
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
                  Math.max(Number(event.target.value), minOwnership),
                )
              }
              aria-label="Maximum ownership"
            />
          </label>
        </div>
      </div>

      {panelLoading && <p className={styles.panelState}>Loading top adds...</p>}
      {!panelLoading && effectiveError && (
        <p className={styles.panelState}>Error: {effectiveError}</p>
      )}
      {!panelLoading && !effectiveError && staleMessage && (
        <p className={`${styles.panelState} ${styles.panelStateStale}`}>
          {staleMessage}
        </p>
      )}
      {!panelLoading && !effectiveError && candidates.length === 0 && (
        <p className={styles.panelState}>
          No add candidates for this ownership band yet.
        </p>
      )}

      {!panelLoading && !effectiveError && candidates.length > 0 && (
        <div className={styles.topAddsList}>
          <p className={styles.compactChartNote}>
            Higher add scores combine opportunity, recent demand, projection,
            schedule, and risk.
          </p>
          {candidates.map((candidate, index) => (
            <Link
              key={candidate.playerId}
              href={buildForgeHref(`/forge/player/${candidate.playerId}`, {
                date,
                mode,
                resolvedDate: activeProjectionResponse?.asOfDate,
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
                  Own <strong>{formatOwnership(candidate.ownership)}</strong>
                </span>
                <span>
                  Demand{" "}
                  <strong>{formatSigned(candidate.delta, " pts")}</strong>
                </span>
                <span>
                  Points{" "}
                  <strong>{formatProjection(candidate.projectionPts)}</strong>
                </span>
                <span>
                  Exp. pts{" "}
                  <strong>{formatExpected(candidate)}</strong>
                </span>
                {mode === "week" && (
                  <span>
                    Week <strong>{candidate.scheduleLabel ?? "--"}</strong>
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
                  <span className={styles.compactChartNote}>
                    No chart needed
                  </span>
                )}
              </div>

              <div className={styles.topAddsCandidateReasons}>
                <span>
                  Per game {formatProjection(candidate.score.perGamePoints)}
                </span>
                <span>
                  Games {candidate.score.games ?? "--"}
                </span>
                <span>
                  Risk {formatProjection(candidate.uncertainty)}
                </span>
              </div>

              {index < MAX_ADD_INSPECTORS && (
                <div
                  className={styles.topAddsInspector}
                  aria-label={`${candidate.name} score inspector`}
                >
                  <div className={styles.topAddsInspectorHeader}>
                    <strong>Why This Add</strong>
                    <span>The plain reasons behind the score</span>
                  </div>
                  <div className={styles.topAddsInspectorGrid}>
                    <div className={styles.topAddsInspectorBlock}>
                      <span className={styles.topAddsInspectorEyebrow}>
                        Fantasy Line
                      </span>
                      <p className={styles.topAddsInspectorText}>
                        Projected {formatProjection(candidate.projectionPts)}{" "}
                        pts • PP {formatProjection(candidate.ppp)} • SOG{" "}
                        {formatProjection(candidate.sog)}
                      </p>
                      <p className={styles.topAddsInspectorText}>
                        Hits + Blocks{" "}
                        {formatProjection(
                          candidate.hit == null || candidate.blk == null
                            ? null
                            : candidate.hit + candidate.blk,
                        )}{" "}
                        • Own {formatOwnership(candidate.ownership)} • 5D{" "}
                        {formatOwnershipChange(candidate.delta)}
                      </p>
                      {mode === "week" && (
                        <p className={styles.topAddsInspectorText}>
                          Week {candidate.scheduleGamesRemaining ?? 0} games •
                          Off-nights {candidate.scheduleOffNightsRemaining ?? 0}
                        </p>
                      )}
                    </div>

                    <div className={styles.topAddsInspectorBlock}>
                      <span className={styles.topAddsInspectorEyebrow}>
                        Expected Points
                      </span>
                      <div className={styles.topAddsInspectorBreakdown}>
                        <span>{TOP_ADDS_SCORING_LABEL}</span>
                        <span>
                          Per game{" "}
                          {formatProjection(candidate.score.perGamePoints)}
                        </span>
                        <span>
                          {mode === "week" ? "Games left" : "Games"}{" "}
                          {candidate.score.games ?? "--"}
                        </span>
                        <span>Total {formatExpected(candidate)}</span>
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
