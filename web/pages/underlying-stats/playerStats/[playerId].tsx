import Head from "next/head";
import type { GetServerSideProps } from "next";
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
  buildGoalieStatsDetailApiPath,
  createDefaultGoalieDetailFilterState
} from "lib/underlying-stats/goalieStatsQueries";
import {
  buildPlayerStatsDetailApiPath,
  type PlayerStatsDetailApiResponse
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

type DetailPageVariant = "player" | "goalie";

type DetailPageShell = {
  title: string;
  metaDescription: string;
  loadingFiltersMessage: string;
  invalidRouteTitle: string;
  invalidRouteMessage: string;
  loadingRowsMessage: string;
  apiErrorFallback: string;
  emptyRowsMessage: string;
  breadcrumbLabel: string;
  landingPath: string;
  landingLabel: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  routePlayerLabel: string;
  routePlayerHint: string;
  initialFamilyLabel: string;
  initialFamilyHint: string;
  sectionTitle: string;
  sectionCopy: string;
  headerHintOverride?: string;
  surfaceLabel: string;
  footnote: string;
};

function getDetailPageShell(variant: DetailPageVariant): DetailPageShell {
  if (variant === "goalie") {
    return {
      title: "Goalie Underlying Detail | FHFHockey",
      metaDescription:
        "Review one goalie through the dedicated goalie underlying route contract with live season-level detail aggregation.",
      loadingFiltersMessage: "Preparing goalie detail filters...",
      invalidRouteTitle: "Invalid goalie route",
      invalidRouteMessage:
        "A numeric playerId is required in the goalie detail route before the season-log query can run.",
      loadingRowsMessage: "Loading goalie detail underlying stats...",
      apiErrorFallback:
        "Unable to load goalie detail underlying stats from the server.",
      emptyRowsMessage:
        "No goalie seasons matched the current detail filter combination.",
      breadcrumbLabel: "Underlying Stats",
      landingPath: "/underlying-stats/goalieStats",
      landingLabel: "Goalie Stats",
      heroEyebrow: "Goalie Season Log Route",
      heroTitle: "Goalie Detail",
      heroDescription:
        "This goalie drill-down route preserves the dedicated goalie landing context, keeps the current Against Specific Team detail filter semantics, and loads season-level goalie rows from the goalie API namespace.",
      routePlayerLabel: "Route Goalie",
      routePlayerHint:
        "The goalie detail route reads the dynamic player id from the URL and hydrates goalie-first detail filters from shared query-state parsing.",
      initialFamilyLabel: "Initial Goalie Table",
      initialFamilyHint:
        "The goalie detail route reuses the shared family resolution contract while constraining the surface to goalie-only families.",
      sectionTitle: "Goalie Detail Controls",
      sectionCopy:
        "Goalie detail defaults hydrate from the canonical goalie detail filter model. The current detail route keeps the Against Specific Team pattern because it already matches the shared opponent-team query semantics.",
      headerHintOverride:
        "Goalie detail controls drive the canonical goalie season-log query.",
      surfaceLabel: "Goalie detail",
      footnote:
        "The goalie detail route reconstructs carried goalie query state for one player and resolves season-level rows through the dedicated goalie API wrapper over the shared summary contract."
    };
  }

  return {
    title: "Player Underlying Detail | FHFHockey",
    metaDescription:
      "Review one player through the shared underlying-stat filter contract with live season-level detail aggregation.",
    loadingFiltersMessage: "Preparing player detail filters...",
    invalidRouteTitle: "Invalid player route",
    invalidRouteMessage:
      "A numeric playerId is required in the detail route before the season-log query can run.",
    loadingRowsMessage: "Loading player detail underlying stats...",
    apiErrorFallback:
      "Unable to load player detail underlying stats from the server.",
    emptyRowsMessage:
      "No season rows matched the current detail filter combination.",
    breadcrumbLabel: "Underlying Stats",
    landingPath: "/underlying-stats/playerStats",
    landingLabel: "Players",
    heroEyebrow: "Player Season Log Route",
    heroTitle: "Player Detail",
    heroDescription:
      "This drill-down route reuses the shared filter and table contracts from the landing page, but swaps the landing team filter for the detail-only against-team context and loads season-level detail rows from the native summary query path.",
    routePlayerLabel: "Route Player",
    routePlayerHint:
      "The detail route reads the dynamic player id from the URL and hydrates detail filters from shared query-state parsing.",
    initialFamilyLabel: "Initial Table Family",
    initialFamilyHint:
      "The detail route reuses the same family resolution contract as the landing surface.",
    sectionTitle: "Detail Controls",
    sectionCopy:
      "Detail defaults now hydrate from the canonical detail filter model. Carried landing context now feeds a live server-backed season detail query.",
    surfaceLabel: "Player detail",
    footnote:
      "The detail route now reconstructs carried query state for one player and resolves season-level rows through the same native summary contract used by the landing page."
  };
}

type PlayerUnderlyingStatsDetailPageProps = {
  variant?: DetailPageVariant;
};

export default function PlayerUnderlyingStatsDetailPage({
  variant = "player"
}: PlayerUnderlyingStatsDetailPageProps) {
  const router = useRouter();
  const pageShell = useMemo(() => getDetailPageShell(variant), [variant]);
  const defaultDetailState = useMemo(
    () =>
      variant === "goalie"
        ? createDefaultGoalieDetailFilterState()
        : createDefaultDetailFilterState(),
    [variant]
  );
  const [filterState, setFilterState] = useState(defaultDetailState);
  const [detailData, setDetailData] =
    useState<PlayerStatsDetailApiResponse | null>(null);
  const [detailDataRequestPath, setDetailDataRequestPath] = useState<
    string | null
  >(null);
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
    const normalizedQueryString =
      buildPlayerStatsSearchParams(parsedState).toString();

    if (
      hasHydratedFromQueryRef.current &&
      lastAppliedQueryStringRef.current === normalizedQueryString
    ) {
      return;
    }

    const currentQueryString =
      buildPlayerStatsSearchParams(filterState).toString();
    isApplyingHydratedQueryRef.current =
      currentQueryString !== normalizedQueryString;
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

    const nextQueryString =
      buildPlayerStatsSearchParams(filterState).toString();
    if (lastAppliedQueryStringRef.current === nextQueryString) {
      return;
    }

    lastAppliedQueryStringRef.current = nextQueryString;

    void router.replace(
      {
        pathname: router.pathname,
        query: {
          playerId: getRoutePlayerId(router.query.playerId),
          ...serializePlayerStatsFilterStateToQuery(filterState)
        }
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
    () =>
      playerId == null
        ? null
        : variant === "goalie"
          ? buildGoalieStatsDetailApiPath(playerId, filterState)
          : buildPlayerStatsDetailApiPath(playerId, filterState),
    [filterState, playerId, variant]
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
      filterState.primary.seasonRange.throughSeasonId
    ]
  );
  const teamOptions = useMemo(() => buildTeamOptions(), []);

  const summaryChips = [
    playerId != null
      ? `${variant === "goalie" ? "Goalie" : "Player"} ${playerId}`
      : `${variant === "goalie" ? "Goalie" : "Player"} pending`,
    formatSeasonRange(
      filterState.primary.seasonRange.fromSeasonId,
      filterState.primary.seasonRange.throughSeasonId
    ),
    formatSeasonType(filterState.primary.seasonType),
    formatStrength(filterState.primary.strength),
    formatScoreState(filterState.primary.scoreState),
    formatMode(filterState.primary.statMode, filterState.primary.displayMode),
    formatAgainstTeam(filterState.expandable.againstTeamId),
    formatTradeMode(filterState.expandable.tradeMode, variant),
    isLoading ? "Server query loading" : "Server query ready"
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
      ttlMs: PLAYER_STATS_CLIENT_CACHE_TTL_MS
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
          const message = errorPayload.error ?? pageShell.apiErrorFallback;
          throw new Error(message);
        }

        const nextPayload = payload as PlayerStatsDetailApiResponse;
        setPlayerStatsClientCachedResponse({
          requestPath: detailRequestPath,
          storagePrefix: DETAIL_RESPONSE_CACHE_PREFIX,
          memoryCache: detailResponseCacheRef.current,
          payload: nextPayload
        });
        setDetailData(nextPayload);
        setDetailDataRequestPath(detailRequestPath);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setTableError(
          error instanceof Error ? error.message : pageShell.apiErrorFallback
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    detailRequestPath,
    pageShell.apiErrorFallback,
    playerId,
    router.isReady,
    validation.isValid
  ]);

  const canRenderStaleDetailData =
    detailData?.rows.length != null &&
    detailData.rows.length > 0 &&
    detailRequestPath != null &&
    isLoading &&
    isViewOnlyPlayerStatsRequestChange(
      detailDataRequestPath,
      detailRequestPath
    );

  const tableState =
    !router.isReady || !hasHydratedFromQueryRef.current
      ? {
          kind: "loading" as const,
          message: pageShell.loadingFiltersMessage
        }
      : playerId == null
        ? {
            kind: "warning" as const,
            title: pageShell.invalidRouteTitle,
            message: pageShell.invalidRouteMessage
          }
        : !validation.isValid
          ? {
              kind: "warning" as const,
              title: "Invalid filter combination",
              message: formatDetailValidationMessage(validation.issues)
            }
          : isLoading && !canRenderStaleDetailData
            ? {
                kind: "loading" as const,
                message: pageShell.loadingRowsMessage
              }
            : tableError && !detailData?.rows.length
              ? {
                  kind: "error" as const,
                  message: tableError
                }
              : detailData?.rows.length
                ? null
                : {
                    kind: "empty" as const,
                    message: pageShell.emptyRowsMessage
                  };

  const pageStatusBanner = tableState
    ? {
        title:
          tableState.kind === "warning"
            ? (tableState.title ?? "Invalid filter combination")
            : tableState.kind === "error"
              ? "Query error"
              : tableState.kind === "empty"
                ? variant === "goalie"
                  ? "No goalie seasons"
                  : "No season rows"
                : variant === "goalie"
                  ? "Loading goalie seasons"
                  : "Loading season rows",
        message: tableState.message,
        tone: tableState.kind
      }
    : tableError && detailData?.rows.length
      ? {
          title:
            variant === "goalie"
              ? "Using cached goalie seasons"
              : "Using cached season rows",
          message: `${tableError} Showing the last successful result while the refresh failed.`,
          tone: "warning" as const
        }
      : canRenderStaleDetailData
        ? {
            title:
              variant === "goalie"
                ? "Refreshing goalie seasons"
                : "Refreshing season rows",
            message:
              "Updating the current detail table in the background while preserving the last loaded result.",
            tone: "loading" as const
          }
        : null;

  return (
    <>
      <Head>
        <title>{pageShell.title}</title>
        <meta name="description" content={pageShell.metaDescription} />
      </Head>

      <main className={styles.page}>
        <div className={styles.pageInner}>
          <section className={styles.hero}>
            <div className={styles.heroBody}>
              <div className={styles.heroCopy}>
                <div className={styles.breadcrumbs}>
                  <Link
                    href="/underlying-stats"
                    className={styles.breadcrumbLink}
                  >
                    {pageShell.breadcrumbLabel}
                  </Link>
                  <span>/</span>
                  <Link
                    href={pageShell.landingPath}
                    className={styles.breadcrumbLink}
                  >
                    {pageShell.landingLabel}
                  </Link>
                  <span>/</span>
                  <span>
                    {playerId != null
                      ? `${variant === "goalie" ? "Goalie" : "Player"} ${playerId}`
                      : "Detail"}
                  </span>
                </div>
                <p className={styles.eyebrow}>{pageShell.heroEyebrow}</p>
                <h1 className={styles.title}>
                  {variant === "goalie" ? (
                    pageShell.heroTitle
                  ) : (
                    <>
                      Player <span className={styles.accent}>Detail</span>
                    </>
                  )}
                </h1>
                <p className={styles.description}>
                  {pageShell.heroDescription}
                </p>
              </div>

              <div className={styles.heroMeta}>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>
                    {pageShell.routePlayerLabel}
                  </p>
                  <p className={styles.metaValue}>
                    {playerId != null ? playerId : "Invalid route"}
                  </p>
                  <p className={styles.metaHint}>{pageShell.routePlayerHint}</p>
                </div>
                <div className={styles.metaCard}>
                  <p className={styles.metaLabel}>
                    {pageShell.initialFamilyLabel}
                  </p>
                  <p className={styles.metaValue}>
                    {formatTableFamily(tableFamily)}
                  </p>
                  <p className={styles.metaHint}>
                    {pageShell.initialFamilyHint}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>
                  {pageShell.sectionTitle}
                </h2>
                <p className={styles.sectionCopy}>{pageShell.sectionCopy}</p>
              </div>
              <div
                className={styles.chipRow}
                aria-label="Current detail context"
              >
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
                    role={
                      pageStatusBanner.tone === "error" ? "alert" : "status"
                    }
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
                  surfaceLabel={pageShell.surfaceLabel}
                  hideModeControl={variant === "goalie"}
                  hidePositionGroupControl={variant === "goalie"}
                  hideTradeModeControl={variant === "goalie"}
                  headerHintOverride={pageShell.headerHintOverride}
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
                  onTeamContextFilterChange={(againstTeamId) =>
                    setFilterState((current) => ({
                      ...current,
                      expandable: {
                        ...current.expandable,
                        againstTeamId
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
                          page: 1
                        }
                      }
                    }))
                  }
                  onPageChange={(page) =>
                    setFilterState((current) => ({
                      ...current,
                      view: {
                        ...current.view,
                        pagination: {
                          ...current.view.pagination,
                          page
                        }
                      }
                    }))
                  }
                  renderCell={({ row, columnKey, formattedValue }) => {
                    if (columnKey !== "playerName") {
                      return formattedValue;
                    }

                    const seasonLabel =
                      typeof row.seasonLabel === "string"
                        ? row.seasonLabel
                        : null;

                    return seasonLabel == null
                      ? formattedValue
                      : `${seasonLabel} · ${formattedValue}`;
                  }}
                />

                <p className={styles.footnote}>{pageShell.footnote}</p>
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

function formatTradeMode(
  tradeMode: string,
  variant: DetailPageVariant = "player"
): string {
  if (variant === "goalie") {
    return tradeMode === "split" ? "Split team rows" : "Combined rows";
  }

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

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {}
});
