import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";
import type { CSSProperties } from "react";

import PlayerStatsTable from "components/underlying-stats/PlayerStatsTable";
import TeamStatsFilters from "components/underlying-stats/TeamStatsFilters";
import { getTeamStatsColumns } from "components/underlying-stats/teamStatsColumns";
import UnderlyingStatsLandingShell from "components/underlying-stats/UnderlyingStatsLandingShell";
import UlsStatusPanel from "components/underlying-stats/UlsStatusPanel";
import { getAnalyticsSurfaceContract } from "lib/navigation/analyticsSurfaceOwnership";
import { teamsInfo } from "lib/teamsInfo";
import type { UlsRouteStatus } from "lib/underlying-stats/ulsRouteStatus";
import {
  applyTeamStatsScopeChange,
  buildTeamStatsSearchParams,
  createDefaultTeamLandingFilterState,
  getDefaultTeamLandingSortState,
  parseTeamStatsFilterStateFromQuery,
  serializeTeamStatsFilterStateToQuery,
  validateTeamStatsFilterState,
  type TeamStatsLandingFilterState,
} from "lib/underlying-stats/teamStatsFilters";
import {
  buildTeamStatsLandingApiPath,
  type TeamStatsLandingApiError,
  type TeamStatsLandingApiResponse,
} from "lib/underlying-stats/teamStatsLandingApi";
import styles from "../playerStats/playerStats.module.scss";

const TEAM_LANDING_PATHNAME = "/underlying-stats/teamStats";
const TEAM_EXPLORER_CONTRACT = getAnalyticsSurfaceContract(
  "uls-team-explorer"
);

type QueryRecord = Record<string, string>;

function normalizeQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }

  return null;
}

function normalizeRouteQuery(query: ParsedUrlQuery): QueryRecord {
  const normalized: QueryRecord = {};

  for (const [key, value] of Object.entries(query)) {
    const normalizedValue = normalizeQueryValue(value);
    if (normalizedValue == null || normalizedValue.length === 0) {
      continue;
    }

    normalized[key] = normalizedValue;
  }

  return normalized;
}

function areQueryRecordsEqual(left: QueryRecord, right: QueryRecord): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => {
    const rightKey = rightKeys[index];
    return key === rightKey && left[key] === right[rightKey];
  });
}

function buildCanonicalTeamLandingQuery(query: ParsedUrlQuery): QueryRecord {
  const fallbackState = createDefaultTeamLandingFilterState();
  const parsedState = parseTeamStatsFilterStateFromQuery(query, fallbackState);
  const normalizedQuery = normalizeRouteQuery(query);
  const hasExplicitSort =
    normalizedQuery.sortKey != null || normalizedQuery.sortDirection != null;

  return serializeTeamStatsFilterStateToQuery({
    ...parsedState,
    view: {
      ...parsedState.view,
      sort: hasExplicitSort
        ? parsedState.view.sort
        : getDefaultTeamLandingSortState(parsedState.primary.displayMode),
    },
  });
}

async function fetchLandingApiResponse(
  requestPath: string,
  signal: AbortSignal
): Promise<TeamStatsLandingApiResponse> {
  const response = await fetch(requestPath, { signal });
  const payload = (await response.json()) as
    | TeamStatsLandingApiResponse
    | TeamStatsLandingApiError;

  if (!response.ok) {
    const errorPayload =
      payload != null && typeof payload === "object" && "error" in payload
        ? (payload as TeamStatsLandingApiError)
        : null;
    const fallbackMessage =
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : "Unable to load team underlying stats from the server.";
    const detailedMessage =
      Array.isArray(errorPayload?.issues) &&
      typeof errorPayload.issues[0] === "string"
        ? errorPayload.issues[0]
        : fallbackMessage;

    throw new Error(
      process.env.NODE_ENV === "development"
        ? detailedMessage
        : fallbackMessage
    );
  }

  return payload as TeamStatsLandingApiResponse;
}

function buildRequestState(state: TeamStatsLandingFilterState): TeamStatsLandingFilterState {
  return {
    ...state,
    view: {
      ...state.view,
      pagination: {
        ...state.view.pagination,
        page: Math.max(1, state.view.pagination.page),
      },
    },
  };
}

function formatSeasonRange(
  fromSeasonId: number | null,
  throughSeasonId: number | null
) {
  if (!fromSeasonId || !throughSeasonId) {
    return "Season pending";
  }

  const formatSeason = (seasonId: number) => {
    const seasonString = String(seasonId);
    if (seasonString.length !== 8) {
      return seasonString;
    }

    return `${seasonString.slice(0, 4)}-${seasonString.slice(6, 8)}`;
  };

  return fromSeasonId === throughSeasonId
    ? formatSeason(fromSeasonId)
    : `${formatSeason(fromSeasonId)} to ${formatSeason(throughSeasonId)}`;
}

function formatTableFamily(family: "counts" | "rates") {
  return family === "rates" ? "Team Rates" : "Team Counts";
}

export default function TeamUnderlyingStatsLandingRoute() {
  const router = useRouter();
  const defaultLandingState = useMemo(
    () => createDefaultTeamLandingFilterState(),
    []
  );
  const [filterState, setFilterState] = useState(defaultLandingState);
  const [landingData, setLandingData] = useState<TeamStatsLandingApiResponse | null>(null);
  const [routeStatus, setRouteStatus] = useState<UlsRouteStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const hasHydratedFromQueryRef = useRef(false);
  const isApplyingHydratedQueryRef = useRef(false);
  const lastAppliedQueryStringRef = useRef<string | null>(null);
  const currentQuery = useMemo(
    () => normalizeRouteQuery(router.query),
    [router.query]
  );
  const canonicalQuery = useMemo(() => {
    if (!router.isReady) {
      return null;
    }

    return buildCanonicalTeamLandingQuery(router.query);
  }, [router.isReady, router.query]);
  const queryIsCanonical = useMemo(() => {
    if (canonicalQuery == null) {
      return false;
    }

    return areQueryRecordsEqual(currentQuery, canonicalQuery);
  }, [canonicalQuery, currentQuery]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/v1/underlying-stats/route-status", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load route status.");
        }

        return (await response.json()) as {
          success: boolean;
          status?: UlsRouteStatus;
        };
      })
      .then((payload) => {
        if (payload.success && payload.status) {
          setRouteStatus(payload.status);
        }
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!router.isReady || canonicalQuery == null || queryIsCanonical) {
      return;
    }

    void router.replace(
      {
        pathname: TEAM_LANDING_PATHNAME,
        query: canonicalQuery,
      },
      undefined,
      { shallow: true }
    );
  }, [canonicalQuery, queryIsCanonical, router]);

  useEffect(() => {
    if (!router.isReady || canonicalQuery == null || !queryIsCanonical) {
      return;
    }

    const parsedState = buildRequestState(
      parseTeamStatsFilterStateFromQuery(router.query, defaultLandingState)
    );
    const normalizedQueryString = buildTeamStatsSearchParams(parsedState).toString();

    if (
      hasHydratedFromQueryRef.current &&
      lastAppliedQueryStringRef.current === normalizedQueryString
    ) {
      return;
    }

    const currentQueryString = buildTeamStatsSearchParams(filterState).toString();
    isApplyingHydratedQueryRef.current = currentQueryString !== normalizedQueryString;
    hasHydratedFromQueryRef.current = true;
    lastAppliedQueryStringRef.current = normalizedQueryString;
    setFilterState(parsedState);
  }, [canonicalQuery, defaultLandingState, filterState, queryIsCanonical, router.isReady, router.query]);

  const activeQueryString = useMemo(
    () => buildTeamStatsSearchParams(buildRequestState(filterState)).toString(),
    [filterState]
  );
  const validation = useMemo(
    () => validateTeamStatsFilterState(filterState),
    [filterState]
  );
  const landingRequestPath = useMemo(
    () => buildTeamStatsLandingApiPath(buildRequestState(filterState)),
    [filterState]
  );

  useEffect(() => {
    if (
      isApplyingHydratedQueryRef.current &&
      activeQueryString === lastAppliedQueryStringRef.current
    ) {
      isApplyingHydratedQueryRef.current = false;
    }
  }, [activeQueryString]);

  useEffect(() => {
    if (
      !router.isReady ||
      !hasHydratedFromQueryRef.current ||
      isApplyingHydratedQueryRef.current ||
      !queryIsCanonical
    ) {
      return;
    }

    const nextQueryString = buildTeamStatsSearchParams(buildRequestState(filterState)).toString();
    if (lastAppliedQueryStringRef.current === nextQueryString) {
      return;
    }

    lastAppliedQueryStringRef.current = nextQueryString;

    void router.replace(
      {
        pathname: TEAM_LANDING_PATHNAME,
        query: serializeTeamStatsFilterStateToQuery(buildRequestState(filterState)),
      },
      undefined,
      { shallow: true }
    );
  }, [filterState, queryIsCanonical, router]);

  useEffect(() => {
    if (
      !router.isReady ||
      !hasHydratedFromQueryRef.current ||
      isApplyingHydratedQueryRef.current ||
      !queryIsCanonical
    ) {
      return;
    }

    if (!validation.isValid) {
      setIsLoading(false);
      setLandingData(null);
      setTableError(null);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setTableError(null);

    void fetchLandingApiResponse(landingRequestPath, controller.signal)
      .then((payload) => {
        setLandingData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLandingData(null);
        setTableError(
          error instanceof Error
            ? error.message
            : "Unable to load team underlying stats from the server."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [landingRequestPath, queryIsCanonical, router.isReady, validation.isValid]);

  function handleDisplayModeChange(nextDisplayMode: "counts" | "rates") {
    setFilterState((current) => ({
      ...current,
      primary: {
        ...current.primary,
        displayMode: nextDisplayMode,
      },
      view: {
        ...current.view,
        sort: getDefaultTeamLandingSortState(nextDisplayMode),
        pagination: {
          ...current.view.pagination,
          page: 1,
        },
      },
    }));
  }

  const pageTitle = "Team Underlying Stats | FHFH";
  const activeFamily = landingData?.family ?? filterState.primary.displayMode;
  const rows = landingData?.rows ?? [];
  const tableColumns = useMemo(() => getTeamStatsColumns(activeFamily), [activeFamily]);
  const seasonOptions = useMemo(
    () =>
      buildSeasonOptions(defaultLandingState.primary.seasonRange.throughSeasonId),
    [defaultLandingState.primary.seasonRange.throughSeasonId]
  );
  const teamOptions = useMemo(() => buildTeamOptions(), []);
  const summaryChips = [
    {
      key: "seasonRange",
      label: `Season: ${formatSeasonRange(
        filterState.primary.seasonRange.fromSeasonId,
        filterState.primary.seasonRange.throughSeasonId
      )}`,
    },
    {
      key: "strength",
      label: `Strength: ${filterState.primary.strength}`,
    },
    {
      key: "scoreState",
      label: `Score: ${filterState.primary.scoreState}`,
    },
    {
      key: "mode",
      label: `Mode: ${activeFamily === "rates" ? "Rates" : "Counts"}`,
    },
  ];

  if (!router.isReady || canonicalQuery == null || !queryIsCanonical) {
    return (
      <main aria-busy="true" aria-live="polite">
        Loading team underlying stats...
      </main>
    );
  }

  return (
    <UnderlyingStatsLandingShell
      title={pageTitle}
      description={TEAM_EXPLORER_CONTRACT.purpose}
      breadcrumbLabel={TEAM_EXPLORER_CONTRACT.label}
      heroTitle={TEAM_EXPLORER_CONTRACT.label}
      heroLead={`${TEAM_EXPLORER_CONTRACT.purpose} Use filters to compare counts and rates across season windows, score states, venues, and opponent context.`}
      defaultSpanLabel="Default Team Span"
      defaultSpanValue={formatSeasonRange(
        defaultLandingState.primary.seasonRange.fromSeasonId,
        defaultLandingState.primary.seasonRange.throughSeasonId
      )}
      activeFamilyLabel="Active Team Table"
      activeFamilyValue={formatTableFamily(activeFamily)}
      sectionAriaLabel="Team table"
      utilityLinkHref="/underlying-stats"
      utilityLinkLabel="Return to team intelligence landing"
      sectionHeader={
        <>
          <div className={styles.chipRow} aria-label="Current team landing defaults">
            {summaryChips.map((chip) => (
              <span
                key={chip.key}
                className={styles.chip}
                data-progress="false"
                style={undefined as CSSProperties | undefined}
              >
                <span className={styles.chipLabel}>{chip.label}</span>
              </span>
            ))}
          </div>
          <UlsStatusPanel status={routeStatus} variant="team" />
        </>
      }
    >
      <div className={styles.tableFrame}>
        <TeamStatsFilters
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
          onDisplayModeChange={handleDisplayModeChange}
          onAdvancedOpenChange={(advancedOpen) =>
            setFilterState((current) => ({
              ...current,
              expandable: {
                ...current.expandable,
                advancedOpen,
              },
            }))
          }
          onTeamChange={(teamId) =>
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
          onOpponentChange={(againstTeamId) =>
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
              ...applyTeamStatsScopeChange(current, scope),
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

        {!validation.isValid ? (
          <section role="alert" style={{ color: "#8a1c1c" }}>
            Team filters are invalid: {validation.issues.join(", ")}
          </section>
        ) : isLoading ? (
          <section aria-busy="true" aria-live="polite">
            Loading team results...
          </section>
        ) : tableError ? (
          <section role="alert" style={{ color: "#8a1c1c" }}>
            {tableError}
          </section>
        ) : rows.length === 0 ? (
          <section aria-live="polite">
            No team results matched the current team filters.
          </section>
        ) : (
          <section>
            <div style={{ marginBottom: "16px", color: "#555" }}>
              Showing {rows.length} of {landingData?.pagination.totalRows ?? rows.length} teams.
            </div>
            <PlayerStatsTable
              columns={tableColumns}
              rows={rows}
              sortState={landingData?.sort ?? filterState.view.sort}
              pagination={landingData?.pagination ?? null}
              showRankColumn
              className={styles.tableShell}
              paginationAriaLabel="Team stats table pagination"
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
            />
          </section>
        )}
      </div>
    </UnderlyingStatsLandingShell>
  );
}

function buildSeasonOptions(anchorSeasonId: number | null): Array<{
  value: number;
  label: string;
}> {
  const fallbackAnchor = createDefaultTeamLandingFilterState().primary.seasonRange
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

function formatSeason(seasonId: number): string {
  const seasonString = String(seasonId);
  if (!/^\d{8}$/.test(seasonString)) {
    return seasonString;
  }

  return `${seasonString.slice(0, 4)}-${seasonString.slice(6, 8)}`;
}
