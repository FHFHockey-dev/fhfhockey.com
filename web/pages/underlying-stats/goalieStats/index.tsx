import Head from "next/head";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import type { ParsedUrlQuery } from "querystring";

import PlayerUnderlyingStatsLandingPage from "../playerStats";
import {
  applyPlayerStatsModeChange,
  getDefaultLandingSortState,
  parsePlayerStatsFilterStateFromQuery,
  serializePlayerStatsFilterStateToQuery,
} from "lib/underlying-stats/playerStatsFilters";
import { createDefaultGoalieLandingFilterState } from "lib/underlying-stats/goalieStatsQueries";

const GOALIE_LANDING_PATHNAME = "/underlying-stats/goalieStats";
const GOALIE_LANDING_PAGE_SIZE = 100;

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

function buildCanonicalGoalieLandingQuery(query: ParsedUrlQuery): QueryRecord {
  const fallbackState = createDefaultGoalieLandingFilterState({
    pageSize: GOALIE_LANDING_PAGE_SIZE,
  });
  const parsedState = parsePlayerStatsFilterStateFromQuery(query, fallbackState);
  const normalizationResult = applyPlayerStatsModeChange(parsedState, "goalies");
  const nextState = normalizationResult.state;
  const normalizedQuery = normalizeRouteQuery(query);
  const hasExplicitSort =
    normalizedQuery.sortKey != null || normalizedQuery.sortDirection != null;

  return serializePlayerStatsFilterStateToQuery({
    ...nextState,
    view: {
      ...nextState.view,
      sort: hasExplicitSort
        ? nextState.view.sort
        : getDefaultLandingSortState(
            nextState.primary.statMode,
            nextState.primary.displayMode
          ),
    },
  });
}

export default function GoalieUnderlyingStatsLandingRoute() {
  const router = useRouter();
  const currentQuery = useMemo(
    () => normalizeRouteQuery(router.query),
    [router.query]
  );
  const canonicalQuery = useMemo(() => {
    if (!router.isReady) {
      return null;
    }

    return buildCanonicalGoalieLandingQuery(router.query);
  }, [router.isReady, router.query]);
  const queryIsCanonical = useMemo(() => {
    if (canonicalQuery == null) {
      return false;
    }

    return areQueryRecordsEqual(currentQuery, canonicalQuery);
  }, [canonicalQuery, currentQuery]);

  useEffect(() => {
    if (!router.isReady || canonicalQuery == null || queryIsCanonical) {
      return;
    }

    void router.replace(
      {
        pathname: GOALIE_LANDING_PATHNAME,
        query: canonicalQuery,
      },
      undefined,
      { shallow: true }
    );
  }, [canonicalQuery, queryIsCanonical, router]);

  if (!router.isReady || canonicalQuery == null || !queryIsCanonical) {
    return (
      <>
        <Head>
          <title>Goalie Underlying Stats | FHFH</title>
        </Head>
        <main aria-busy="true" aria-live="polite">
          Loading goalie underlying stats...
        </main>
      </>
    );
  }

  return <PlayerUnderlyingStatsLandingPage />;
}
