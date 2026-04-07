import Head from "next/head";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/router";

import PlayerStatsExpandedRowChart from "components/underlying-stats/PlayerStatsExpandedRowChart";
import PlayerStatsFilters from "components/underlying-stats/PlayerStatsFilters";
import PlayerStatsTable from "components/underlying-stats/PlayerStatsTable";
import type { PlayerStatsColumnDefinition } from "components/underlying-stats/playerStatsColumns";
import {
  getPlayerStatsColumns,
  resolvePlayerStatsTableFamily
} from "components/underlying-stats/playerStatsColumns";
import Spinner from "components/Spinner/Spinner";
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
  type PlayerStatsLandingApiRow,
  type PlayerStatsLandingApiResponse
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

import UnderlyingStatsNavBar from "../../../components/underlying-stats/UnderlyingStatsNavBar";

const LANDING_RESPONSE_CACHE_PREFIX = "player-stats-landing-response";
const INITIAL_LANDING_PLAYER_ROW_COUNT = 100;
type LandingSummaryChip =
  | {
      key: string;
      label: string;
      progress?: undefined;
    }
  | {
      key: string;
      label: string;
      progress: {
        current: number;
        total: number;
      };
    };

function buildLandingPageRequestState(
  state: PlayerStatsLandingFilterState,
  pageSize = INITIAL_LANDING_PLAYER_ROW_COUNT
): PlayerStatsLandingFilterState {
  return {
    ...state,
    view: {
      ...state.view,
      pagination: {
        page: 1,
        pageSize
      }
    }
  };
}

async function fetchLandingApiResponse(
  requestPath: string,
  signal: AbortSignal
): Promise<PlayerStatsLandingApiResponse> {
  const response = await fetch(requestPath, { signal });
  const payload = (await response.json()) as
    | PlayerStatsLandingApiResponse
    | { error?: string; issues?: string[] };

  if (!response.ok) {
    const errorPayload = payload as { error?: string; issues?: string[] };
    throw new Error(
      errorPayload.error ??
        "Unable to load player underlying stats from the server."
    );
  }

  return payload as PlayerStatsLandingApiResponse;
}

function buildLandingPageProgressLabel(args: {
  loadedRowCount: number;
  totalRowCount: number;
}) {
  const remainingRowCount = Math.max(
    args.totalRowCount - args.loadedRowCount,
    0
  );
  const nextChunkSize = Math.min(
    INITIAL_LANDING_PLAYER_ROW_COUNT,
    remainingRowCount
  );

  return `Loading next ${nextChunkSize} skaters (${args.loadedRowCount}/${args.totalRowCount})`;
}

function formatElapsedSeconds(elapsedMs: number) {
  return `${Math.max(1, Math.floor(elapsedMs / 1000))}s`;
}

function buildColdLoadStatus(elapsedMs: number) {
  if (elapsedMs >= 12000) {
    return {
      title: `Still building landing rows (${formatElapsedSeconds(elapsedMs)})`,
      message:
        "This first season load is still running on the server. The page has not hung; it is rebuilding the current sorted landing aggregate from persisted game summaries.",
      chipLabel: `Cold load ${formatElapsedSeconds(elapsedMs)}`,
    };
  }

  if (elapsedMs >= 5000) {
    return {
      title: `Warming landing aggregate (${formatElapsedSeconds(elapsedMs)})`,
      message:
        "Cold season loads can take around 10 to 20 seconds the first time while the table aggregate warms. Once it completes, repeat loads should be much faster.",
      chipLabel: `Warming ${formatElapsedSeconds(elapsedMs)}`,
    };
  }

  return {
    title: "Loading first 100 rows",
    message:
      "Building the initial sorted player rows for the current landing query. This can be slow on the first season request.",
    chipLabel: "Loading first 100 rows",
  };
}

function mergeLandingRows(
  currentRows: readonly PlayerStatsLandingApiRow[],
  incomingRows: readonly PlayerStatsLandingApiRow[]
) {
  const mergedRows = [...currentRows];
  const seenRowKeys = new Set(currentRows.map((row) => row.rowKey));

  for (const row of incomingRows) {
    if (seenRowKeys.has(row.rowKey)) {
      continue;
    }

    seenRowKeys.add(row.rowKey);
    mergedRows.push(row);
  }

  return mergedRows;
}

export default function PlayerUnderlyingStatsLandingPage() {
  const router = useRouter();
  const defaultLandingState = useMemo(
    () =>
      createDefaultLandingFilterState({
        pageSize: INITIAL_LANDING_PLAYER_ROW_COUNT
      }),
    []
  );
  const [filterState, setFilterState] = useState(defaultLandingState);
  const [landingData, setLandingData] = useState<PlayerStatsLandingApiResponse | null>(
    null
  );
  const [landingDataRequestPath, setLandingDataRequestPath] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRemainingRows, setIsLoadingRemainingRows] = useState(false);
  const [loadingElapsedMs, setLoadingElapsedMs] = useState(0);
  const [tableError, setTableError] = useState<string | null>(null);
  const [backgroundLoadError, setBackgroundLoadError] = useState<string | null>(
    null
  );
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [expandedMetricByRowKey, setExpandedMetricByRowKey] = useState<
    Record<string, string>
  >({});
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

    const parsedState = buildLandingPageRequestState(
      parsePlayerStatsFilterStateFromQuery(router.query, defaultLandingState)
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
    () =>
      buildPlayerStatsLandingApiPath(buildLandingPageRequestState(filterState)),
    [filterState]
  );
  const validation = useMemo(
    () => validatePlayerStatsFilterState(filterState),
    [filterState]
  );
  const defaultLandingQueryString = useMemo(
    () =>
      buildPlayerStatsSearchParams(
        buildLandingPageRequestState(defaultLandingState)
      ).toString(),
    [defaultLandingState]
  );
  const activeLandingQueryString = useMemo(
    () =>
      buildPlayerStatsSearchParams(
        buildLandingPageRequestState(filterState)
      ).toString(),
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

    const nextQueryString = buildPlayerStatsSearchParams(
      buildLandingPageRequestState(filterState)
    ).toString();
    if (lastAppliedQueryStringRef.current === nextQueryString) {
      return;
    }

    lastAppliedQueryStringRef.current = nextQueryString;

    void router.replace(
      {
        pathname: router.pathname,
        query: serializePlayerStatsFilterStateToQuery(
          buildLandingPageRequestState(filterState)
        )
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
      setIsLoadingRemainingRows(false);
      setLandingData(null);
      setLandingDataRequestPath(null);
      setTableError(null);
      setBackgroundLoadError(null);
      return;
    }

    const controller = new AbortController();

    const hydrateAllRows = async (
      partialPayload: PlayerStatsLandingApiResponse
    ) => {
      const totalRows = partialPayload.pagination.totalRows;
      if (partialPayload.rows.length >= totalRows) {
        setIsLoadingRemainingRows(false);
        setBackgroundLoadError(null);
        return;
      }

      setIsLoadingRemainingRows(true);
      setBackgroundLoadError(null);

      try {
        const totalPages = Math.ceil(
          totalRows / INITIAL_LANDING_PLAYER_ROW_COUNT
        );
        let nextRows = [...partialPayload.rows];

        for (let page = 2; page <= totalPages; page += 1) {
          const nextPageState = {
            ...buildLandingPageRequestState(filterState),
            view: {
              ...filterState.view,
              pagination: {
                page,
                pageSize: INITIAL_LANDING_PLAYER_ROW_COUNT
              }
            }
          };
          const nextRequestPath = buildPlayerStatsLandingApiPath(nextPageState);
          const cachedPageResponse = getPlayerStatsClientCachedResponse({
            requestPath: nextRequestPath,
            storagePrefix: LANDING_RESPONSE_CACHE_PREFIX,
            memoryCache: landingResponseCacheRef.current,
            ttlMs: PLAYER_STATS_CLIENT_CACHE_TTL_MS
          });
          const nextPayload = cachedPageResponse
            ? cachedPageResponse.payload
            : await fetchLandingApiResponse(nextRequestPath, controller.signal);

          if (!cachedPageResponse) {
            setPlayerStatsClientCachedResponse({
              requestPath: nextRequestPath,
              storagePrefix: LANDING_RESPONSE_CACHE_PREFIX,
              memoryCache: landingResponseCacheRef.current,
              payload: nextPayload
            });
          }

          nextRows = mergeLandingRows(nextRows, nextPayload.rows);

          startTransition(() => {
            setLandingData({
              ...partialPayload,
              rows: nextRows,
              pagination: {
                ...partialPayload.pagination,
                page: 1,
                pageSize: nextRows.length,
                totalRows,
                totalPages: totalRows === 0 ? 0 : 1
              }
            });
          });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setBackgroundLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load the remaining player rows."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRemainingRows(false);
        }
      }
    };

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
      setBackgroundLoadError(null);
    }

    setIsLoading(true);
    setIsLoadingRemainingRows(false);
    setTableError(null);
    setBackgroundLoadError(null);

    void fetchLandingApiResponse(landingRequestPath, controller.signal)
      .then((nextPayload) => {
        setPlayerStatsClientCachedResponse({
          requestPath: landingRequestPath,
          storagePrefix: LANDING_RESPONSE_CACHE_PREFIX,
          memoryCache: landingResponseCacheRef.current,
          payload: nextPayload
        });
        setLandingData(nextPayload);
        setLandingDataRequestPath(landingRequestPath);
        void hydrateAllRows(nextPayload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
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
  const loadedRowCount = landingData?.rows.length ?? 0;
  const totalRowCount = landingData?.pagination.totalRows ?? loadedRowCount;
  const isProgressivelyHydratingRows =
    isLoadingRemainingRows && totalRowCount > loadedRowCount;
  const rowLoadProgress =
    totalRowCount > 0 ? Math.min(loadedRowCount / totalRowCount, 1) : 0;
  const coldLoadStatus = useMemo(
    () => buildColdLoadStatus(loadingElapsedMs),
    [loadingElapsedMs]
  );

  useEffect(() => {
    if (!isLoading || canRenderStaleLandingData) {
      setLoadingElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    setLoadingElapsedMs(0);

    const intervalId = window.setInterval(() => {
      setLoadingElapsedMs(Date.now() - startedAt);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canRenderStaleLandingData, isLoading, landingRequestPath]);

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
  const timeframeColumns = useMemo<PlayerStatsColumnDefinition[]>(
    () =>
      filterState.expandable.scope.kind === "none"
        ? []
        : [
            {
              key: "windowStartDate",
              label: "From",
              sortKey: "windowStartDate",
              format: "date",
              align: "center",
              isIdentity: true
            },
            {
              key: "windowEndDate",
              label: "Through",
              sortKey: "windowEndDate",
              format: "date",
              align: "center",
              isIdentity: true
            }
          ],
    [filterState.expandable.scope.kind]
  );
  const activeTableFamily = landingData?.family ?? tableFamily;
  const chartMetricColumns = useMemo(
    () =>
      getPlayerStatsColumns(activeTableFamily).filter(
        (column) =>
          column.key !== "playerName" &&
          column.key !== "teamLabel" &&
          column.key !== "positionCode"
      ),
    [activeTableFamily]
  );
  const defaultExpandedMetricKey = useMemo(
    () =>
      resolveDefaultExpandedMetricKey(
        chartMetricColumns,
        landingData?.sort.sortKey ?? filterState.view.sort.sortKey
      ),
    [
      chartMetricColumns,
      filterState.view.sort.sortKey,
      landingData?.sort.sortKey
    ]
  );

  const summaryChips: LandingSummaryChip[] = [
    {
      key: "seasonRange",
      label: formatSeasonRange(
        filterState.primary.seasonRange.fromSeasonId,
        filterState.primary.seasonRange.throughSeasonId
      )
    },
    { key: "seasonType", label: formatSeasonType(filterState.primary.seasonType) },
    { key: "strength", label: formatStrength(filterState.primary.strength) },
    { key: "scoreState", label: formatScoreState(filterState.primary.scoreState) },
    {
      key: "mode",
      label: formatMode(filterState.primary.statMode, filterState.primary.displayMode)
    },
    { key: "scope", label: formatActiveScope(filterState.expandable.scope) },
    { key: "tradeMode", label: formatTradeMode(filterState.expandable.tradeMode) },
    {
      key: "rows",
      label: isLoading
        ? coldLoadStatus.chipLabel
        : isProgressivelyHydratingRows
          ? `Loading remaining rows (${loadedRowCount}/${totalRowCount})`
          : `Rows ready (${loadedRowCount}/${totalRowCount})`,
      progress: {
        current: loadedRowCount,
        total: totalRowCount
      }
    }
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
            message: coldLoadStatus.message,
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
          tableState.kind === "loading"
            ? coldLoadStatus.title
            : tableState.kind === "warning"
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
    setBackgroundLoadError(null);
    setIsLoadingRemainingRows(false);
    setExpandedRowKey(null);
    setExpandedMetricByRowKey({});
    setFilterState(defaultLandingState);
  }

  useEffect(() => {
    if (expandedRowKey == null) {
      return;
    }

    const visibleRows = landingData?.rows ?? [];
    if (!visibleRows.some((row) => row.rowKey === expandedRowKey)) {
      setExpandedRowKey(null);
    }
  }, [expandedRowKey, landingData]);

  function handleExpandedRowToggle(
    row: PlayerStatsLandingApiRow,
    preferredMetricKey?: string
  ) {
    const nextRowKey = row.rowKey;

    if (expandedRowKey === nextRowKey) {
      setExpandedRowKey(null);
      return;
    }

    const nextMetricKey =
      preferredMetricKey ??
      expandedMetricByRowKey[nextRowKey] ??
      defaultExpandedMetricKey;

    if (nextMetricKey) {
      setExpandedMetricByRowKey((current) => ({
        ...current,
        [nextRowKey]: nextMetricKey
      }));
    }

    setExpandedRowKey(nextRowKey);
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
            </div>
            <Link href="/trends" className={styles.breadcrumbLink}>
              View trends dashboard
            </Link>
          </div>

          <UnderlyingStatsNavBar />

          <header className={styles.hero}>
            <div className={styles.heroBody}>
              <div className={styles.heroCopy}>
                <h1 className={styles.title}>
                  <span className={styles.accent}> Underlying </span>Stats
                </h1>
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
                </div>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>Current Table Family</p>
                  <p className={styles.metaValue}>
                    {formatTableFamily(tableFamily)}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <section className={styles.section} aria-label="Player table">
            <div className={styles.sectionHeader}>
                <div
                  className={styles.chipRow}
                  aria-label="Current landing defaults"
                >
                  {summaryChips.map((chip) => (
                  <span
                    key={chip.key}
                    className={styles.chip}
                    data-progress={chip.progress ? "true" : "false"}
                    style={
                      chip.progress
                        ? ({
                            "--chip-progress": `${Math.round(
                              ((chip.progress.total > 0
                                ? chip.progress.current / chip.progress.total
                                : rowLoadProgress) *
                                10000)
                            ) / 100}%`
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {chip.progress ? (
                      <span className={styles.chipProgressFill} aria-hidden="true" />
                    ) : null}
                    <span className={styles.chipLabel}>{chip.label}</span>
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
                    role={
                      pageStatusBanner.tone === "error" ? "alert" : "status"
                    }
                    aria-live={
                      pageStatusBanner.tone === "loading" ? "polite" : undefined
                    }
                  >
                    <div className={styles.stateBannerLead}>
                      {pageStatusBanner.tone === "loading" ? (
                        <Spinner
                          className={styles.stateBannerSpinner}
                          size="small"
                        />
                      ) : null}
                      <div className={styles.stateBannerCopy}>
                        <p className={styles.stateBannerTitle}>
                          {pageStatusBanner.title}
                        </p>
                        <p className={styles.stateBannerMessage}>
                          {pageStatusBanner.message}
                        </p>
                      </div>
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
                        seasonRange: nextRange
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onSeasonTypeChange={(seasonType) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        seasonType
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onStrengthChange={(strength) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        strength
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onScoreStateChange={(scoreState) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        scoreState
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
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
                            page: 1
                          }
                        }
                      };
                    });

                    return normalizationResult!;
                  }}
                  onDisplayModeChange={(displayMode) =>
                    setFilterState((current) => ({
                      ...current,
                      primary: {
                        ...current.primary,
                        displayMode
                      },
                      view: {
                        ...current.view,
                        sort: getDefaultLandingSortState(
                          current.primary.statMode,
                          displayMode
                        ),
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onAdvancedOpenChange={(advancedOpen) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        advancedOpen
                      }
                    }))
                  }
                  onTeamContextFilterChange={(teamId) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        teamId
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onPositionGroupChange={(positionGroup) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        positionGroup
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onVenueChange={(venue) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        venue
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onMinimumToiChange={(minimumToiSeconds) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        minimumToiSeconds
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onScopeChange={(scope) =>
                    setFilterState((current) => ({
                      ...applyPlayerStatsScopeChange(current, scope),
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  onTradeModeChange={(tradeMode) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        tradeMode
                      },
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                />
                <PlayerStatsTable
                  family={activeTableFamily}
                  rows={landingData?.rows ?? []}
                  sortState={landingData?.sort ?? filterState.view.sort}
                  state={tableState}
                  pagination={landingData?.pagination ?? null}
                  showRankColumn
                  extraColumns={timeframeColumns}
                  className={styles.tableShell}
                  expandedRowKey={expandedRowKey}
                  loadingMoreIndicator={
                    isProgressivelyHydratingRows ? (
                      <div
                        className={styles.progressIndicator}
                        aria-live="polite"
                        role="status"
                      >
                        <Spinner
                          className={styles.progressSpinner}
                          size="small"
                        />
                        <span>
                          {buildLandingPageProgressLabel({
                            loadedRowCount,
                            totalRowCount
                          })}
                        </span>
                      </div>
                    ) : null
                  }
                  onSortChange={(nextSort) =>
                    setFilterState((current) => ({
                      ...current,
                      view: {
                        ...current.view,
                        sort: nextSort,
                        pagination: {
                          ...current.view.pagination,
                          page: 1
                        }
                      }
                    }))
                  }
                  renderCell={({ row, columnKey, formattedValue }) => {
                    if (columnKey !== "playerName") {
                      return formattedValue;
                    }

                    const playerId = Number(row.playerId);
                    const canExpand = Number.isFinite(playerId) && playerId > 0;
                    const isExpanded = expandedRowKey === row.rowKey;

                    return (
                      <div className={styles.playerCellContent}>
                        <button
                          type="button"
                          className={styles.expandToggle}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleExpandedRowToggle(row);
                          }}
                          aria-expanded={isExpanded}
                          aria-label={
                            canExpand
                              ? isExpanded
                                ? `Collapse trend chart for ${formattedValue}`
                                : `Expand trend chart for ${formattedValue}`
                              : `No chart available for ${formattedValue}`
                          }
                          title={
                            isExpanded
                              ? "Collapse player trend"
                              : "Expand player trend"
                          }
                          disabled={!canExpand}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                        {canExpand ? (
                          <Link
                            href={buildPlayerStatsDetailHref(
                              playerId,
                              filterState
                            )}
                            className={styles.playerLink}
                          >
                            {formattedValue}
                          </Link>
                        ) : (
                          <span className={styles.playerText}>
                            {formattedValue}
                          </span>
                        )}
                      </div>
                    );
                  }}
                  renderExpandedRow={({ row, viewportWidth }) => {
                    const playerId = Number(row.playerId);
                    if (!Number.isFinite(playerId) || playerId <= 0) {
                      return (
                        <div className={styles.expandedFallback}>
                          No player chart is available for this row.
                        </div>
                      );
                    }

                    const selectedMetricKey =
                      expandedMetricByRowKey[row.rowKey] ??
                      defaultExpandedMetricKey;
                    if (!selectedMetricKey || chartMetricColumns.length === 0) {
                      return (
                        <div className={styles.expandedFallback}>
                          No chartable metrics are available for this table
                          family.
                        </div>
                      );
                    }

                    return (
                      <PlayerStatsExpandedRowChart
                        playerId={playerId}
                        splitTeamId={
                          typeof row.teamId === "number" ? row.teamId : null
                        }
                        viewportWidth={viewportWidth}
                        state={filterState}
                        metricColumns={chartMetricColumns}
                        selectedMetricKey={selectedMetricKey}
                        onMetricChange={(metricKey) =>
                          setExpandedMetricByRowKey((current) => ({
                            ...current,
                            [row.rowKey]: metricKey
                          }))
                        }
                      />
                    );
                  }}
                />
                <p className={styles.footnote}>
                  Table data is served through
                  <code> /api/v1/underlying-stats/players </code> using
                  canonical filter and sort params with staged loading: first
                  100 rows immediately, then the remaining sorted rows in
                  sequential 100-player batches.
                </p>
                {isProgressivelyHydratingRows ? (
                  <p className={styles.footnote}>
                    Showing the first {loadedRowCount} of {totalRowCount} player
                    rows while the rest load behind the current table.
                  </p>
                ) : null}
                {backgroundLoadError ? (
                  <p className={styles.footnote}>
                    Remaining player rows did not finish loading in the
                    background. The current sorted top {loadedRowCount} rows are
                    still available.
                  </p>
                ) : null}
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

function resolveDefaultExpandedMetricKey(
  metricColumns: readonly PlayerStatsColumnDefinition[],
  activeSortKey: string | null
): string | null {
  if (metricColumns.length === 0) {
    return null;
  }

  if (activeSortKey) {
    const matchingMetric = metricColumns.find(
      (column) =>
        column.sortKey === activeSortKey || column.key === activeSortKey
    );
    if (matchingMetric) {
      return matchingMetric.key;
    }
  }

  return metricColumns[0]?.key ?? null;
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
