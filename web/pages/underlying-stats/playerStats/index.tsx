import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import PlayerStatsFilters from "components/underlying-stats/PlayerStatsFilters";
import PlayerStatsTable from "components/underlying-stats/PlayerStatsTable";
import { resolvePlayerStatsTableFamily } from "components/underlying-stats/playerStatsColumns";
import {
  applyPlayerStatsScopeChange,
  applyPlayerStatsModeChange,
  buildPlayerStatsSearchParams,
  buildPlayerStatsDetailHref,
  createDefaultLandingFilterState,
  getDefaultLandingSortState,
  parsePlayerStatsFilterStateFromQuery,
  serializePlayerStatsFilterStateToQuery,
  validatePlayerStatsFilterState,
} from "lib/underlying-stats/playerStatsFilters";
import {
  buildPlayerStatsLandingApiPath,
  type PlayerStatsLandingApiResponse,
} from "lib/underlying-stats/playerStatsQueries";
import {
  PLAYER_STATS_CLIENT_CACHE_TTL_MS,
  getPlayerStatsClientCachedResponse,
  isViewOnlyPlayerStatsRequestChange,
  setPlayerStatsClientCachedResponse,
} from "lib/underlying-stats/playerStatsClientCache";
import type { PlayerStatsLandingFilterState } from "lib/underlying-stats/playerStatsTypes";
import { teamsInfo } from "lib/teamsInfo";

import styles from "./playerStats.module.scss";

const LANDING_RESPONSE_CACHE_PREFIX = "player-stats-landing-response";

export default function PlayerUnderlyingStatsLandingPage() {
  const router = useRouter();
  const defaultLandingState = useMemo(() => createDefaultLandingFilterState(), []);
  const [filterState, setFilterState] = useState(defaultLandingState);
  const [landingData, setLandingData] = useState<PlayerStatsLandingApiResponse | null>(
    null
  );
  const [landingDataRequestPath, setLandingDataRequestPath] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const hasHydratedFromQueryRef = useRef(false);
  const isApplyingHydratedQueryRef = useRef(false);
  const lastAppliedQueryStringRef = useRef<string | null>(null);
  const landingResponseCacheRef = useRef(
    new Map<
      string,
      {
        cachedAt: number;
        payload: PlayerStatsLandingApiResponse;
      }
    >()
  );

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const parsedState = parsePlayerStatsFilterStateFromQuery(
      router.query,
      defaultLandingState
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
  }, [defaultLandingState, filterState, router.isReady, router.query]);

  const landingRequestPath = useMemo(
    () => buildPlayerStatsLandingApiPath(filterState),
    [filterState]
  );
  const validation = useMemo(
    () => validatePlayerStatsFilterState(filterState),
    [filterState]
  );
  const defaultLandingQueryString = useMemo(
    () => buildPlayerStatsSearchParams(defaultLandingState).toString(),
    [defaultLandingState]
  );
  const activeLandingQueryString = useMemo(
    () => buildPlayerStatsSearchParams(filterState).toString(),
    [filterState]
  );
  const canResetFilters = activeLandingQueryString !== defaultLandingQueryString;

  useEffect(() => {
    if (
      isApplyingHydratedQueryRef.current &&
      activeLandingQueryString === lastAppliedQueryStringRef.current
    ) {
      isApplyingHydratedQueryRef.current = false;
    }
  }, [activeLandingQueryString]);

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
        query: serializePlayerStatsFilterStateToQuery(filterState),
      },
      undefined,
      { shallow: true }
    );
  }, [filterState, router]);

  useEffect(() => {
    if (
      !router.isReady ||
      !hasHydratedFromQueryRef.current ||
      isApplyingHydratedQueryRef.current
    ) {
      return;
    }

    if (lastAppliedQueryStringRef.current !== activeLandingQueryString) {
      return;
    }

    if (!validation.isValid) {
      setIsLoading(false);
      setLandingData(null);
      setLandingDataRequestPath(null);
      setTableError(null);
      return;
    }

    const cachedResponse = getPlayerStatsClientCachedResponse({
      requestPath: landingRequestPath,
      storagePrefix: LANDING_RESPONSE_CACHE_PREFIX,
      memoryCache: landingResponseCacheRef.current,
      ttlMs: PLAYER_STATS_CLIENT_CACHE_TTL_MS,
    });
    if (cachedResponse) {
      setLandingData(cachedResponse.payload);
      setLandingDataRequestPath(landingRequestPath);
      setTableError(null);

      if (cachedResponse.isFresh) {
        setIsLoading(false);
        return;
      }
    }

    const controller = new AbortController();

    setIsLoading(true);
    setTableError(null);

    fetch(landingRequestPath, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as
          | PlayerStatsLandingApiResponse
          | { error?: string; issues?: string[] };

        if (!response.ok) {
          const errorPayload = payload as { error?: string; issues?: string[] };
          const message =
            errorPayload.error ??
            "Unable to load player underlying stats from the server.";
          throw new Error(message);
        }

        const nextPayload = payload as PlayerStatsLandingApiResponse;
        setPlayerStatsClientCachedResponse({
          requestPath: landingRequestPath,
          storagePrefix: LANDING_RESPONSE_CACHE_PREFIX,
          memoryCache: landingResponseCacheRef.current,
          payload: nextPayload,
        });
        setLandingData(nextPayload);
        setLandingDataRequestPath(landingRequestPath);
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setTableError(
          error instanceof Error
            ? error.message
            : "Unable to load player underlying stats from the server."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    activeLandingQueryString,
    landingRequestPath,
    router.isReady,
    validation.isValid,
  ]);

  const canRenderStaleLandingData =
    landingData?.rows.length != null &&
    landingData.rows.length > 0 &&
    isLoading &&
    isViewOnlyPlayerStatsRequestChange(landingDataRequestPath, landingRequestPath);

  const seasonOptions = useMemo(
    () =>
      buildSeasonOptions(
      filterState.primary.seasonRange.throughSeasonId ??
          defaultLandingState.primary.seasonRange.throughSeasonId
      ),
    [
      defaultLandingState.primary.seasonRange.throughSeasonId,
      filterState.primary.seasonRange.throughSeasonId,
    ]
  );
  const teamOptions = useMemo(() => buildTeamOptions(), []);

  const tableFamily = resolvePlayerStatsTableFamily(
    filterState.primary.statMode,
    filterState.primary.displayMode
  );

  const summaryChips = [
    formatSeasonRange(
      filterState.primary.seasonRange.fromSeasonId,
      filterState.primary.seasonRange.throughSeasonId
    ),
    formatSeasonType(filterState.primary.seasonType),
    formatStrength(filterState.primary.strength),
    formatScoreState(filterState.primary.scoreState),
    formatMode(filterState.primary.statMode, filterState.primary.displayMode),
    formatActiveScope(filterState.expandable.scope),
    formatTradeMode(filterState.expandable.tradeMode),
    isLoading ? "Server query loading" : "Server query ready",
  ];

  const tableState = !router.isReady || !hasHydratedFromQueryRef.current
    ? {
        kind: "loading" as const,
        message: "Preparing player underlying stats filters...",
      }
    : !validation.isValid
      ? {
          kind: "warning" as const,
          title: "Invalid filter combination",
          message: formatLandingValidationMessage(validation.issues),
        }
      : isLoading && !canRenderStaleLandingData
        ? {
            kind: "loading" as const,
            message: "Loading player underlying stats...",
          }
        : tableError && !landingData?.rows.length
          ? {
              kind: "error" as const,
              message: tableError,
            }
          : landingData?.rows.length
            ? null
            : {
                kind: "empty" as const,
                message: landingData?.placeholder
                  ? "The landing page is using the server query contract, but native aggregated player rows are still pending implementation."
                  : "No players matched the current filter combination. Widen the scope or reset filters.",
              };

  const pageStatusBanner = tableState
    ? {
        title:
          tableState.kind === "warning"
            ? tableState.title ?? "Invalid filter combination"
            : tableState.kind === "error"
              ? "Query error"
              : tableState.kind === "empty"
                ? "No landing rows"
                : "Loading landing rows",
        message: tableState.message,
        tone: tableState.kind,
      }
    : tableError && landingData?.rows.length
      ? {
          title: "Using cached landing rows",
          message: `${tableError} Showing the last successful result while the refresh failed.`,
          tone: "warning" as const,
        }
      : canRenderStaleLandingData
        ? {
            title: "Refreshing landing rows",
            message:
              "Updating the current table in the background while preserving the last loaded result.",
            tone: "loading" as const,
          }
        : null;

  function handleResetFilters() {
    setLandingData(null);
    setLandingDataRequestPath(null);
    setTableError(null);
    setFilterState(defaultLandingState);
  }

  return (
    <>
      <Head>
        <title>Player Underlying Stats | FHFHockey</title>
        <meta
          name="description"
          content="Compare skaters and goalies across shared underlying-stat views with sortable tables and drill-down player logs."
        />
      </Head>

      <main className={styles.page}>
        <div className={styles.pageInner}>
          <div className={styles.utilityRow}>
            <div className={styles.breadcrumbs}>
              <Link href="/underlying-stats" className={styles.breadcrumbLink}>
                Underlying Stats
              </Link>
              <span>/</span>
              <span>Players</span>
            </div>
            <Link href="/underlying-stats" className={styles.breadcrumbLink}>
              View team power rankings
            </Link>
          </div>

          <header className={styles.hero}>
            <div className={styles.heroBody}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Native xG Player Surface</p>
                <h1 className={styles.title}>
                  Player <span className={styles.accent}>Underlying Stats</span>
                </h1>
                <p className={styles.description}>
                  Compare skaters and goalies through one shared filter contract,
                  then drill directly into player-level detail pages from the
                  sortable landing table.
                </p>
              </div>

              <div className={styles.heroMeta}>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>Default Season Span</p>
                  <p className={styles.metaValue}>
                    {formatSeasonRange(
                      defaultLandingState.primary.seasonRange.fromSeasonId,
                      defaultLandingState.primary.seasonRange.throughSeasonId
                    )}
                  </p>
                  <p className={styles.metaHint}>
                    Shared landing defaults come from the central filter-state
                    contract, not page-local constants.
                  </p>
                </div>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>Current Table Family</p>
                  <p className={styles.metaValue}>
                    {formatTableFamily(tableFamily)}
                  </p>
                  <p className={styles.metaHint}>
                    Landing and detail routes resolve the same family from mode
                    plus display state.
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className={styles.section} aria-labelledby="player-table-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="player-table-heading" className={styles.sectionTitle}>
                  Player table
                </h2>
                <p className={styles.sectionCopy}>
                  Filters, sorting, and pagination all flow through the canonical
                  landing query contract so shared links and reloads preserve the
                  active table state.
                </p>
              </div>
              <div className={styles.chipRow} aria-label="Current landing defaults">
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
                    {canResetFilters &&
                    (pageStatusBanner.tone === "warning" ||
                      pageStatusBanner.tone === "error" ||
                      pageStatusBanner.tone === "empty") ? (
                      <button
                        type="button"
                        className={styles.resetButton}
                        onClick={handleResetFilters}
                      >
                        Reset landing filters
                      </button>
                    ) : null}
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
                          typeof applyPlayerStatsModeChange<PlayerStatsLandingFilterState>
                        >
                      | undefined;

                    setFilterState((current) => {
                      normalizationResult =
                        applyPlayerStatsModeChange<PlayerStatsLandingFilterState>(
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
                  onTeamContextFilterChange={(teamId) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        teamId,
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
                  family={landingData?.family ?? tableFamily}
                  rows={landingData?.rows ?? []}
                  sortState={landingData?.sort ?? filterState.view.sort}
                  state={tableState}
                  pagination={landingData?.pagination ?? null}
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

                    const playerId = Number(row.playerId);
                    if (!Number.isFinite(playerId) || playerId <= 0) {
                      return formattedValue;
                    }

                    return (
                      <Link
                        href={buildPlayerStatsDetailHref(playerId, filterState)}
                        className={styles.breadcrumbLink}
                      >
                        {formattedValue}
                      </Link>
                    );
                  }}
                />
                <p className={styles.footnote}>
                  Table data is served through
                  <code> /api/v1/underlying-stats/players </code> using canonical
                  filter, sort, and pagination params.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function buildSeasonOptions(anchorSeasonId: number | null): Array<{
  value: number;
  label: string;
}> {
  const fallbackAnchor = createDefaultLandingFilterState().primary.seasonRange
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

function formatActiveScope(
  scope: { kind: "none" | "dateRange" | "gameRange" | "byTeamGames" }
): string {
  switch (scope.kind) {
    case "dateRange":
      return "Scope: Date Range";
    case "gameRange":
      return "Scope: Game Range";
    case "byTeamGames":
      return "Scope: By Team Games";
    default:
      return "Scope: None";
  }
}

function formatLandingValidationMessage(issues: readonly string[]): string {
  if (!issues.length) {
    return "The selected landing filters are invalid.";
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
          return "The selected landing filters are invalid.";
      }
    })
    .join(" ");
}
