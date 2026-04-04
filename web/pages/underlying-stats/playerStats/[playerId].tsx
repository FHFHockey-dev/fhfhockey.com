import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import PlayerStatsFilters from "components/underlying-stats/PlayerStatsFilters";
import PlayerStatsTable from "components/underlying-stats/PlayerStatsTable";
import { resolvePlayerStatsTableFamily } from "components/underlying-stats/playerStatsColumns";
import {
  applyPlayerStatsModeChange,
  applyPlayerStatsScopeChange,
  buildPlayerStatsSearchParams,
  createDefaultDetailFilterState,
  getDefaultLandingSortState,
  parsePlayerStatsFilterStateFromQuery,
  serializePlayerStatsFilterStateToQuery,
  validatePlayerStatsFilterState,
} from "lib/underlying-stats/playerStatsFilters";
import {
  buildPlayerStatsDetailApiPath,
  type PlayerStatsDetailApiResponse,
} from "lib/underlying-stats/playerStatsQueries";
import {
  PLAYER_STATS_CLIENT_CACHE_TTL_MS,
  getPlayerStatsClientCachedResponse,
  isViewOnlyPlayerStatsRequestChange,
  setPlayerStatsClientCachedResponse,
} from "lib/underlying-stats/playerStatsClientCache";
import type { PlayerStatsDetailFilterState } from "lib/underlying-stats/playerStatsTypes";
import { teamsInfo } from "lib/teamsInfo";

import styles from "./playerStats.module.scss";

const DETAIL_RESPONSE_CACHE_PREFIX = "player-stats-detail-response";

export default function PlayerUnderlyingStatsDetailPage() {
  const router = useRouter();
  const defaultDetailState = useMemo(() => createDefaultDetailFilterState(), []);
  const [filterState, setFilterState] = useState(defaultDetailState);
  const [detailData, setDetailData] = useState<PlayerStatsDetailApiResponse | null>(null);
  const [detailDataRequestPath, setDetailDataRequestPath] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const hasHydratedFromQueryRef = useRef(false);
  const isApplyingHydratedQueryRef = useRef(false);
  const lastAppliedQueryStringRef = useRef<string | null>(null);
  const detailResponseCacheRef = useRef(
    new Map<
      string,
      {
        cachedAt: number;
        payload: PlayerStatsDetailApiResponse;
      }
    >()
  );

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const parsedState = parsePlayerStatsFilterStateFromQuery(
      router.query,
      defaultDetailState
    );
    const normalizedQueryString = buildPlayerStatsSearchParams(parsedState).toString();

    if (
      hasHydratedFromQueryRef.current &&
      lastAppliedQueryStringRef.current === normalizedQueryString
    ) {
      return;
    }

    const currentQueryString = buildPlayerStatsSearchParams(filterState).toString();
    isApplyingHydratedQueryRef.current = currentQueryString !== normalizedQueryString;
    hasHydratedFromQueryRef.current = true;
    lastAppliedQueryStringRef.current = normalizedQueryString;
    setFilterState(parsedState);
  }, [defaultDetailState, filterState, router.isReady, router.query]);

  const activeDetailQueryString = useMemo(
    () => buildPlayerStatsSearchParams(filterState).toString(),
    [filterState]
  );

  useEffect(() => {
    if (
      isApplyingHydratedQueryRef.current &&
      activeDetailQueryString === lastAppliedQueryStringRef.current
    ) {
      isApplyingHydratedQueryRef.current = false;
    }
  }, [activeDetailQueryString]);

  useEffect(() => {
    if (
      !router.isReady ||
      !hasHydratedFromQueryRef.current ||
      isApplyingHydratedQueryRef.current
    ) {
      return;
    }

    const nextQueryString = buildPlayerStatsSearchParams(filterState).toString();
    if (lastAppliedQueryStringRef.current === nextQueryString) {
      return;
    }

    lastAppliedQueryStringRef.current = nextQueryString;

    void router.replace(
      {
        pathname: router.pathname,
        query: {
          playerId: getRoutePlayerId(router.query.playerId),
          ...serializePlayerStatsFilterStateToQuery(filterState),
        },
      },
      undefined,
      { shallow: true }
    );
  }, [filterState, router]);

  const validation = useMemo(
    () => validatePlayerStatsFilterState(filterState),
    [filterState]
  );
  const playerId = getNumericPlayerId(router.query.playerId);
  const detailRequestPath = useMemo(
    () => (playerId == null ? null : buildPlayerStatsDetailApiPath(playerId, filterState)),
    [filterState, playerId]
  );
  const tableFamily = resolvePlayerStatsTableFamily(
    filterState.primary.statMode,
    filterState.primary.displayMode
  );
  const seasonOptions = useMemo(
    () =>
      buildSeasonOptions(
        filterState.primary.seasonRange.throughSeasonId ??
          defaultDetailState.primary.seasonRange.throughSeasonId
      ),
    [
      defaultDetailState.primary.seasonRange.throughSeasonId,
      filterState.primary.seasonRange.throughSeasonId,
    ]
  );
  const teamOptions = useMemo(() => buildTeamOptions(), []);

  const summaryChips = [
    playerId != null ? `Player ${playerId}` : "Player pending",
    formatSeasonRange(
      filterState.primary.seasonRange.fromSeasonId,
      filterState.primary.seasonRange.throughSeasonId
    ),
    formatSeasonType(filterState.primary.seasonType),
    formatStrength(filterState.primary.strength),
    formatScoreState(filterState.primary.scoreState),
    formatMode(filterState.primary.statMode, filterState.primary.displayMode),
    formatAgainstTeam(filterState.expandable.againstTeamId),
    formatTradeMode(filterState.expandable.tradeMode),
    isLoading ? "Server query loading" : "Server query ready",
  ];

  useEffect(() => {
    if (
      !router.isReady ||
      !hasHydratedFromQueryRef.current ||
      isApplyingHydratedQueryRef.current ||
      playerId == null ||
      detailRequestPath == null
    ) {
      return;
    }

    if (!validation.isValid) {
      setIsLoading(false);
      setDetailData(null);
      setDetailDataRequestPath(null);
      setTableError(null);
      return;
    }

    const cachedResponse = getPlayerStatsClientCachedResponse({
      requestPath: detailRequestPath,
      storagePrefix: DETAIL_RESPONSE_CACHE_PREFIX,
      memoryCache: detailResponseCacheRef.current,
      ttlMs: PLAYER_STATS_CLIENT_CACHE_TTL_MS,
    });
    if (cachedResponse) {
      setDetailData(cachedResponse.payload);
      setDetailDataRequestPath(detailRequestPath);
      setTableError(null);

      if (cachedResponse.isFresh) {
        setIsLoading(false);
        return;
      }
    }

    const controller = new AbortController();

    setIsLoading(true);
    setTableError(null);

    fetch(detailRequestPath, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as
          | PlayerStatsDetailApiResponse
          | { error?: string; issues?: string[] };

        if (!response.ok) {
          const errorPayload = payload as { error?: string; issues?: string[] };
          const message =
            errorPayload.error ??
            "Unable to load player detail underlying stats from the server.";
          throw new Error(message);
        }

        const nextPayload = payload as PlayerStatsDetailApiResponse;
        setPlayerStatsClientCachedResponse({
          requestPath: detailRequestPath,
          storagePrefix: DETAIL_RESPONSE_CACHE_PREFIX,
          memoryCache: detailResponseCacheRef.current,
          payload: nextPayload,
        });
        setDetailData(nextPayload);
        setDetailDataRequestPath(detailRequestPath);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setTableError(
          error instanceof Error
            ? error.message
            : "Unable to load player detail underlying stats from the server."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [detailRequestPath, playerId, router.isReady, validation.isValid]);

  const canRenderStaleDetailData =
    detailData?.rows.length != null &&
    detailData.rows.length > 0 &&
    detailRequestPath != null &&
    isLoading &&
    isViewOnlyPlayerStatsRequestChange(detailDataRequestPath, detailRequestPath);

  const tableState = !router.isReady || !hasHydratedFromQueryRef.current
    ? {
        kind: "loading" as const,
        message: "Preparing player detail filters...",
      }
    : playerId == null
      ? {
          kind: "warning" as const,
          title: "Invalid player route",
          message:
            "A numeric playerId is required in the detail route before the season-log query can run.",
        }
      : !validation.isValid
      ? {
          kind: "warning" as const,
          title: "Invalid filter combination",
          message: formatDetailValidationMessage(validation.issues),
        }
        : isLoading && !canRenderStaleDetailData
          ? {
              kind: "loading" as const,
              message: "Loading player detail underlying stats...",
            }
          : tableError && !detailData?.rows.length
            ? {
                kind: "error" as const,
                message: tableError,
              }
            : detailData?.rows.length
              ? null
              : {
            kind: "empty" as const,
            message:
                "No season rows matched the current detail filter combination.",
              };

  const pageStatusBanner = tableState
    ? {
        title:
          tableState.kind === "warning"
            ? tableState.title ?? "Invalid filter combination"
            : tableState.kind === "error"
              ? "Query error"
              : tableState.kind === "empty"
                ? "No season rows"
                : "Loading season rows",
        message: tableState.message,
        tone: tableState.kind,
      }
    : tableError && detailData?.rows.length
      ? {
          title: "Using cached season rows",
          message: `${tableError} Showing the last successful result while the refresh failed.`,
          tone: "warning" as const,
        }
      : canRenderStaleDetailData
        ? {
            title: "Refreshing season rows",
            message:
              "Updating the current detail table in the background while preserving the last loaded result.",
            tone: "loading" as const,
          }
        : null;

  return (
    <>
      <Head>
        <title>Player Underlying Detail | FHFHockey</title>
        <meta
          name="description"
          content="Review one player through the shared underlying-stat filter contract with live season-level detail aggregation."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.pageInner}>
          <section className={styles.hero}>
            <div className={styles.heroBody}>
              <div className={styles.heroCopy}>
                <div className={styles.breadcrumbs}>
                  <Link href="/underlying-stats" className={styles.breadcrumbLink}>
                    Underlying Stats
                  </Link>
                  <span>/</span>
                  <Link
                    href="/underlying-stats/playerStats"
                    className={styles.breadcrumbLink}
                  >
                    Players
                  </Link>
                  <span>/</span>
                  <span>{playerId != null ? `Player ${playerId}` : "Detail"}</span>
                </div>
                <p className={styles.eyebrow}>Player Season Log Route</p>
                <h1 className={styles.title}>
                  Player <span className={styles.accent}>Detail</span>
                </h1>
                <p className={styles.description}>
                  This drill-down route reuses the shared filter and table contracts
                  from the landing page, but swaps the landing team filter for the
                  detail-only against-team context and loads season-level detail
                  rows from the native summary query path.
                </p>
              </div>

              <div className={styles.heroMeta}>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>Route Player</p>
                  <p className={styles.metaValue}>
                    {playerId != null ? playerId : "Invalid route"}
                  </p>
                  <p className={styles.metaHint}>
                    The detail route reads the dynamic player id from the URL and
                    hydrates detail filters from shared query-state parsing.
                  </p>
                </div>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>Initial Table Family</p>
                  <p className={styles.metaValue}>
                    {formatTableFamily(tableFamily)}
                  </p>
                  <p className={styles.metaHint}>
                    The detail route reuses the same family resolution contract as
                    the landing surface.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Detail Controls</h2>
                <p className={styles.sectionCopy}>
                  Detail defaults now hydrate from the canonical detail filter
                  model. Carried landing context now feeds a live server-backed
                  season detail query.
                </p>
              </div>
              <div className={styles.chipRow} aria-label="Current detail context">
                {summaryChips.map((chip) => (
                  <span key={chip} className={styles.chip}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.tableSectionBody}>
              <div className={styles.tableFrame}>
                {pageStatusBanner ? (
                  <div
                    className={styles.stateBanner}
                    data-tone={pageStatusBanner.tone}
                    role={pageStatusBanner.tone === "error" ? "alert" : "status"}
                    aria-live={
                      pageStatusBanner.tone === "loading" ? "polite" : undefined
                    }
                  >
                    <div className={styles.stateBannerCopy}>
                      <p className={styles.stateBannerTitle}>
                        {pageStatusBanner.title}
                      </p>
                      <p className={styles.stateBannerMessage}>
                        {pageStatusBanner.message}
                      </p>
                    </div>
                  </div>
                ) : null}
                <PlayerStatsFilters
                  state={filterState}
                  seasonOptions={seasonOptions}
                  teamOptions={teamOptions}
                  onSeasonRangeChange={(nextRange) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        seasonRange: nextRange,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onSeasonTypeChange={(seasonType) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        seasonType,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onStrengthChange={(strength) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        strength,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onScoreStateChange={(scoreState) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        scoreState,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onModeChange={(mode) => {
                    let normalizationResult:
                      | ReturnType<
                          typeof applyPlayerStatsModeChange<PlayerStatsDetailFilterState>
                        >
                      | undefined;

                    setFilterState((current) => {
                      normalizationResult =
                        applyPlayerStatsModeChange<PlayerStatsDetailFilterState>(
                          current,
                          mode
                        );
                      const nextState = normalizationResult.state;

                      return {
                        ...nextState,
                        view: {
                          ...nextState.view,
                          sort: getDefaultLandingSortState(
                            nextState.primary.statMode,
                            nextState.primary.displayMode
                          ),
                          pagination: {
                            ...nextState.view.pagination,
                            page: 1,
                          },
                        },
                      };
                    });

                    return normalizationResult!;
                  }}
                  onDisplayModeChange={(displayMode) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        displayMode,
                      },
                      view: {
                        ...current.view,
                        sort: getDefaultLandingSortState(
                          current.primary.statMode,
                          displayMode
                        ),
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onAdvancedOpenChange={(advancedOpen) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        advancedOpen,
                      },
                    }))
                  }
                  onTeamContextFilterChange={(againstTeamId) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        againstTeamId,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onPositionGroupChange={(positionGroup) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        positionGroup,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onVenueChange={(venue) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        venue,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onMinimumToiChange={(minimumToiSeconds) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        minimumToiSeconds,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onScopeChange={(scope) =>
                    setFilterState((current) => ({
                      ...applyPlayerStatsScopeChange(current, scope),
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onTradeModeChange={(tradeMode) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        tradeMode,
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                />

                <PlayerStatsTable
                  family={detailData?.family ?? tableFamily}
                  rows={detailData?.rows ?? []}
                  sortState={detailData?.sort ?? filterState.view.sort}
                  state={tableState}
                  pagination={detailData?.pagination ?? null}
                  onSortChange={(nextSort) =>
                    setFilterState((current) => ({
                      ...current,
                      view: {
                        ...current.view,
                        sort: nextSort,
                        pagination: {
                          ...current.view.pagination,
                          page: 1,
                        },
                      },
                    }))
                  }
                  onPageChange={(page) =>
                    setFilterState((current) => ({
                      ...current,
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page,
                        },
                      },
                    }))
                  }
                  renderCell={({ row, columnKey, formattedValue }) => {
                    if (columnKey !== "playerName") {
                      return formattedValue;
                    }

                    const seasonLabel =
                      typeof row.seasonLabel === "string" ? row.seasonLabel : null;

                    return seasonLabel == null
                      ? formattedValue
                      : `${seasonLabel} · ${formattedValue}`;
                  }}
                />

                <p className={styles.footnote}>
                  The detail route now reconstructs carried query state for one
                  player and resolves season-level rows through the same native
                  summary contract used by the landing page.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function getRoutePlayerId(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

function getNumericPlayerId(value: string | string[] | undefined): number | null {
  const normalized = getRoutePlayerId(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

function buildSeasonOptions(anchorSeasonId: number | null): Array<{
  value: number;
  label: string;
}> {
  const fallbackAnchor = createDefaultDetailFilterState().primary.seasonRange
    .throughSeasonId;
  const resolvedAnchor = anchorSeasonId ?? fallbackAnchor ?? 20252026;

  return Array.from({ length: 8 }, (_, index) => {
    const startYear = Number(String(resolvedAnchor).slice(0, 4)) - index;
    const seasonId = Number(`${startYear}${startYear + 1}`);
    return {
      value: seasonId,
      label: formatSeason(seasonId),
    };
  });
}

function buildTeamOptions(): Array<{ value: number; label: string }> {
  return Object.values(teamsInfo)
    .map((team) => ({
      value: team.id,
      label: `${team.abbrev} · ${team.name}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function formatSeasonRange(
  fromSeasonId: number | null,
  throughSeasonId: number | null
): string {
  if (!fromSeasonId || !throughSeasonId) {
    return "Season pending";
  }

  if (fromSeasonId === throughSeasonId) {
    return formatSeason(fromSeasonId);
  }

  return `${formatSeason(fromSeasonId)} to ${formatSeason(throughSeasonId)}`;
}

function formatSeason(seasonId: number): string {
  const seasonString = String(seasonId);
  if (!/^\d{8}$/.test(seasonString)) {
    return seasonString;
  }

  return `${seasonString.slice(0, 4)}-${seasonString.slice(6, 8)}`;
}

function formatSeasonType(seasonType: string): string {
  switch (seasonType) {
    case "regularSeason":
      return "Regular season";
    case "playoffs":
      return "Playoffs";
    case "preSeason":
      return "Pre-season";
    default:
      return seasonType;
  }
}

function formatStrength(strength: string): string {
  switch (strength) {
    case "fiveOnFive":
      return "5v5";
    case "allStrengths":
      return "All strengths";
    case "evenStrength":
      return "Even strength";
    case "penaltyKill":
      return "Penalty kill";
    case "powerPlay":
      return "Power play";
    case "fiveOnFourPP":
      return "5 on 4 PP";
    case "fourOnFivePK":
      return "4 on 5 PK";
    case "threeOnThree":
      return "3 on 3";
    case "withEmptyNet":
      return "With empty net";
    case "againstEmptyNet":
      return "Against empty net";
    default:
      return strength;
  }
}

function formatScoreState(scoreState: string): string {
  switch (scoreState) {
    case "allScores":
      return "All scores";
    case "withinOne":
      return "Within 1";
    case "upOne":
      return "Up 1";
    case "downOne":
      return "Down 1";
    default:
      return scoreState.charAt(0).toUpperCase() + scoreState.slice(1);
  }
}

function formatMode(statMode: string, displayMode: string): string {
  const statModeLabel =
    statMode === "onIce"
      ? "On-ice"
      : statMode === "goalies"
        ? "Goalies"
        : "Individual";
  const displayLabel = displayMode === "counts" ? "counts" : "rates";

  return `${statModeLabel} ${displayLabel}`;
}

function formatTableFamily(family: string): string {
  switch (family) {
    case "individualCounts":
      return "Individual counts";
    case "individualRates":
      return "Individual rates";
    case "onIceCounts":
      return "On-ice counts";
    case "onIceRates":
      return "On-ice rates";
    case "goalieCounts":
      return "Goalie counts";
    case "goalieRates":
      return "Goalie rates";
    default:
      return family;
  }
}

function formatTradeMode(tradeMode: string): string {
  return tradeMode === "split"
    ? "Split traded-player rows"
    : "Combined traded-player rows";
}

function formatAgainstTeam(teamId: number | null): string {
  if (teamId == null) {
    return "Against: All teams";
  }

  const team = Object.values(teamsInfo).find((candidate) => candidate.id === teamId);
  return team ? `Against: ${team.abbrev}` : `Against team ${teamId}`;
}

function formatDetailValidationMessage(issues: readonly string[]): string {
  if (!issues.length) {
    return "The selected detail filters are invalid.";
  }

  return issues
    .map((issue) => {
      switch (issue) {
        case "seasonRangeMissing":
          return "Choose both a from-season and a through-season.";
        case "seasonRangeOrder":
          return "The from-season cannot be later than the through-season.";
        case "dateRangeMissingStart":
          return "Date Range requires a start date.";
        case "dateRangeMissingEnd":
          return "Date Range requires an end date.";
        case "dateRangeOrder":
          return "The start date cannot be later than the end date.";
        case "dateRangeOutsideSeasonSpan":
          return "The selected dates must stay inside the active season span.";
        default:
          return "The selected detail filters are invalid.";
      }
    })
    .join(" ");
}
