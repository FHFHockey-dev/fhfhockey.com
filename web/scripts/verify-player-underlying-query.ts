import dotenv from "dotenv";
import path from "path";

import serviceRoleClient from "lib/supabase/server";
import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
  parsePlayerStatsFilterStateFromQuery,
  validatePlayerStatsFilterState,
} from "lib/underlying-stats/playerStatsFilters";
import {
  buildPlayerStatsLandingAggregationFromSummaryRows,
  buildPlayerStatsDetailAggregationFromSummaryRows,
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  buildLandingApiResultFromAggregationRows,
  buildDetailApiResultFromAggregationRows,
  type PlayerStatsSourceGameRow,
} from "lib/underlying-stats/playerStatsLandingServer";
import { matchesPlayerStatsPositionGroup } from "lib/underlying-stats/playerStatsQueries";
import type {
  PlayerStatsDetailFilterState,
  PlayerStatsFilterState,
  PlayerStatsLandingFilterState,
  PlayerStatsMode,
  PlayerStatsSurface,
  PlayerStatsVenue,
} from "lib/underlying-stats/playerStatsTypes";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type QueryLike = Record<string, string | string[] | undefined>;

type SourceGameRow = PlayerStatsSourceGameRow;

type SummaryRow = {
  rowKey?: string;
  kind: "individual" | "onIce" | "goalies";
  mode: PlayerStatsMode;
  strength: string;
  supportedDisplayModes: string[];
  playerId: number;
  playerName: string;
  positionCode: string | null;
  gameId: number;
  seasonId: number;
  gameDate: string;
  teamId: number;
  teamAbbrev: string | null;
  opponentTeamId: number;
  isHome: boolean;
  metrics: Record<string, any>;
};

type Args = {
  playerId: number;
  surface: PlayerStatsSurface;
  query: string;
};

const MAX_ROUTE_PAGE_SIZE = 5000;
const SUPABASE_BATCH_SIZE = 1000;

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const getArgValue = (flag: string) => {
    const index = argv.findIndex((value) => value === flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const playerId = Number(getArgValue("--playerId"));
  if (!Number.isFinite(playerId) || playerId <= 0) {
    throw new Error("Missing required --playerId <number>.");
  }

  const surfaceValue = getArgValue("--surface");
  const surface: PlayerStatsSurface =
    surfaceValue === "detail" ? "detail" : "landing";

  const queryArg = getArgValue("--query");
  const urlArg = getArgValue("--url");

  let query = "";
  if (typeof urlArg === "string" && urlArg.length > 0) {
    const parsed = new URL(urlArg);
    query = parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search;
  } else if (typeof queryArg === "string" && queryArg.length > 0) {
    query = queryArg.startsWith("?") ? queryArg.slice(1) : queryArg;
  }

  return {
    playerId: Math.trunc(playerId),
    surface,
    query,
  };
}

function queryStringToObject(query: string): QueryLike {
  const searchParams = new URLSearchParams(query);
  const result: QueryLike = {};

  for (const [key, value] of searchParams.entries()) {
    const existing = result[key];
    if (existing == null) {
      result[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      result[key] = existing;
      continue;
    }

    result[key] = [existing, value];
  }

  return result;
}

function cloneStateWithLargePageSize<T extends PlayerStatsFilterState>(state: T): T {
  return {
    ...state,
    view: {
      ...state.view,
      pagination: {
        page: 1,
        pageSize: MAX_ROUTE_PAGE_SIZE,
      },
    },
  };
}

function enumerateSeasonIds(fromSeasonId: number, throughSeasonId: number): number[] {
  const fromYear = Number(String(fromSeasonId).slice(0, 4));
  const throughYear = Number(String(throughSeasonId).slice(0, 4));

  if (!Number.isFinite(fromYear) || !Number.isFinite(throughYear) || fromYear > throughYear) {
    return [fromSeasonId];
  }

  return Array.from({ length: throughYear - fromYear + 1 }, (_, offset) => {
    const startYear = fromYear + offset;
    return Number(`${startYear}${startYear + 1}`);
  });
}

function resolveGameType(seasonType: PlayerStatsFilterState["primary"]["seasonType"]) {
  if (seasonType === "preSeason") return 1;
  if (seasonType === "playoffs") return 3;
  return 2;
}

async function fetchEligibleGamesForState(state: PlayerStatsFilterState): Promise<SourceGameRow[]> {
  const fromSeasonId = state.primary.seasonRange.fromSeasonId;
  const throughSeasonId = state.primary.seasonRange.throughSeasonId;

  if (fromSeasonId == null || throughSeasonId == null) {
    return [];
  }

  const seasonIds = enumerateSeasonIds(fromSeasonId, throughSeasonId);
  const rows: SourceGameRow[] = [];
  let offset = 0;

  for (;;) {
    let query = serviceRoleClient
      .from("games")
      .select("id,date,startTime,seasonId,type,homeTeamId,awayTeamId")
      .in("seasonId", seasonIds)
      .eq("type", resolveGameType(state.primary.seasonType))
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_BATCH_SIZE - 1);

    if (state.expandable.scope.kind === "dateRange") {
      if (state.expandable.scope.startDate) {
        query = query.gte("date", state.expandable.scope.startDate);
      }
      if (state.expandable.scope.endDate) {
        query = query.lte("date", state.expandable.scope.endDate);
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`[verify-player-underlying-query] ${error.message}`);
    }

    const normalized = (data ?? []).flatMap((row) => {
      const id = Number(row.id);
      const seasonId = Number(row.seasonId);
      const type = Number(row.type);
      const homeTeamId = Number(row.homeTeamId);
      const awayTeamId = Number(row.awayTeamId);

      if (
        !Number.isFinite(id) ||
        !Number.isFinite(seasonId) ||
        !Number.isFinite(type) ||
        !Number.isFinite(homeTeamId) ||
        !Number.isFinite(awayTeamId) ||
        typeof row.date !== "string" ||
        typeof row.startTime !== "string"
      ) {
        return [];
      }

      return [
        {
          id,
          date: row.date,
          startTime: row.startTime,
          seasonId,
          type,
          homeTeamId,
          awayTeamId,
        },
      ];
    });

    rows.push(...normalized);

    if ((data?.length ?? 0) < SUPABASE_BATCH_SIZE) {
      break;
    }

    offset += SUPABASE_BATCH_SIZE;
  }

  return rows;
}

function compareGamesDescending(
  left: Pick<SourceGameRow, "date" | "id">,
  right: Pick<SourceGameRow, "date" | "id">
) {
  if (left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }

  return right.id - left.id;
}

function matchesVenue(venue: PlayerStatsVenue, isHome: boolean) {
  if (venue === "all") {
    return true;
  }

  return venue === "home" ? isHome : !isHome;
}

function getSelectedGamesForTeamContext(args: {
  games: readonly SourceGameRow[];
  teamId: number;
  venue: PlayerStatsVenue;
  limit: number | null;
}) {
  const eligibleGames = args.games
    .filter((game) => {
      if (game.homeTeamId !== args.teamId && game.awayTeamId !== args.teamId) {
        return false;
      }

      if (args.venue === "home") {
        return game.homeTeamId === args.teamId;
      }

      if (args.venue === "away") {
        return game.awayTeamId === args.teamId;
      }

      return true;
    })
    .sort(compareGamesDescending);

  return new Set(
    eligibleGames
      .slice(0, args.limit == null || args.limit <= 0 ? eligibleGames.length : args.limit)
      .map((game) => game.id)
  );
}

function matchesSummaryRowForState(
  playerId: number,
  state: PlayerStatsFilterState,
  row: SummaryRow
) {
  if (row.playerId !== playerId) {
    return false;
  }

  if (row.mode !== state.primary.statMode) {
    return false;
  }

  if (row.strength !== state.primary.strength) {
    return false;
  }

  if (!row.supportedDisplayModes.includes(state.primary.displayMode)) {
    return false;
  }

  if (state.surface === "landing") {
    const landingState = state as PlayerStatsLandingFilterState;
    if (landingState.expandable.teamId != null && row.teamId !== landingState.expandable.teamId) {
      return false;
    }
  } else {
    const detailState = state as PlayerStatsDetailFilterState;
    if (
      detailState.expandable.againstTeamId != null &&
      row.opponentTeamId !== detailState.expandable.againstTeamId
    ) {
      return false;
    }
  }

  if (!matchesVenue(state.expandable.venue, row.isHome)) {
    return false;
  }

  if (
    !matchesPlayerStatsPositionGroup({
      rawPosition: row.positionCode,
      positionGroup: state.expandable.positionGroup,
      mode: state.primary.statMode,
    })
  ) {
    return false;
  }

  return true;
}

function getGroupingKey(state: PlayerStatsFilterState, row: SummaryRow) {
  if (state.surface === "detail") {
    return state.expandable.tradeMode === "split"
      ? `${row.seasonId}:${row.teamId}`
      : `${row.seasonId}`;
  }

  return state.expandable.tradeMode === "split"
    ? `${row.playerId}:${row.teamId}`
    : `${row.playerId}`;
}

function takeMostRecentSummaryRows(rows: readonly SummaryRow[], limit: number | null) {
  if (limit == null || limit <= 0) {
    return [...rows];
  }

  return [...rows]
    .sort((left, right) =>
      compareGamesDescending(
        { date: left.gameDate, id: left.gameId },
        { date: right.gameDate, id: right.gameId }
      )
    )
    .slice(0, limit);
}

function applyScopeToSummaryRows(args: {
  state: PlayerStatsFilterState;
  games: readonly SourceGameRow[];
  rows: readonly SummaryRow[];
}) {
  const scope = args.state.expandable.scope;

  if (scope.kind === "none" || scope.kind === "dateRange") {
    return [...args.rows];
  }

  const rowsByGroupingKey = new Map<string, SummaryRow[]>();
  for (const row of args.rows) {
    const key = getGroupingKey(args.state, row);
    const existing = rowsByGroupingKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      rowsByGroupingKey.set(key, [row]);
    }
  }

  if (scope.kind === "gameRange") {
    return [...rowsByGroupingKey.values()].flatMap((groupRows) =>
      takeMostRecentSummaryRows(groupRows, scope.value)
    );
  }

  return [...rowsByGroupingKey.values()].flatMap((groupRows) => {
    const selectedGameIds = new Set<number>();
    const explicitLandingTeamId =
      args.state.surface === "landing" ? args.state.expandable.teamId ?? null : null;
    const teamIds =
      explicitLandingTeamId != null
        ? [explicitLandingTeamId]
        : [...new Set(groupRows.map((row) => row.teamId))];

    for (const teamId of teamIds) {
      const teamGameIds = getSelectedGamesForTeamContext({
        games: args.games,
        teamId,
        venue: args.state.expandable.venue,
        limit: scope.value,
      });

      for (const gameId of teamGameIds) {
        selectedGameIds.add(gameId);
      }
    }

    return groupRows.filter((row) => selectedGameIds.has(row.gameId));
  });
}

function sumNullable(values: Array<number | null | undefined>) {
  const numericValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((total, value) => total + value, 0);
}

function buildRawNumeratorTotals(mode: PlayerStatsMode, rows: readonly SummaryRow[]) {
  const uniqueRows = dedupeRowsByGameId(rows);
  const totals = {
    toiSeconds: uniqueRows.reduce((total, row) => total + (row.metrics.toiSeconds ?? 0), 0),
    gamesPlayed: uniqueRows.length,
    onIceGoalsForForIpp: uniqueRows.reduce(
      (total, row) => total + (row.metrics.onIceGoalsForForIpp ?? 0),
      0
    ),
  } as Record<string, unknown>;

  if (mode === "individual") {
    const keys = [
      "goals",
      "totalAssists",
      "firstAssists",
      "secondAssists",
      "shots",
      "ixg",
      "iCf",
      "iFf",
      "iScf",
      "iHdcf",
      "rushAttempts",
      "reboundsCreated",
      "pim",
      "totalPenalties",
      "minorPenalties",
      "majorPenalties",
      "misconductPenalties",
      "penaltiesDrawn",
      "giveaways",
      "takeaways",
      "hits",
      "hitsTaken",
      "shotsBlocked",
      "faceoffsWon",
      "faceoffsLost",
    ] as const;

    totals.individual = Object.fromEntries(
      keys.map((key) => [
        key,
        sumNullable(uniqueRows.map((row) => row.metrics.individual?.[key] ?? null)),
      ])
    );
    return totals;
  }

  if (mode === "onIce") {
    const keys = [
      "cf",
      "ca",
      "ff",
      "fa",
      "sf",
      "sa",
      "gf",
      "ga",
      "xgf",
      "xga",
      "scf",
      "sca",
      "hdcf",
      "hdca",
      "hdgf",
      "hdga",
      "mdcf",
      "mdca",
      "mdgf",
      "mdga",
      "ldcf",
    ] as const;

    totals.onIce = Object.fromEntries(
      keys.map((key) => [
        key,
        sumNullable(uniqueRows.map((row) => row.metrics.onIce?.[key] ?? null)),
      ])
    );
    return totals;
  }

  const keys = [
    "shotsAgainst",
    "saves",
    "goalsAgainst",
    "xgAgainst",
    "hdShotsAgainst",
    "hdSaves",
    "hdGoalsAgainst",
    "hdXgAgainst",
    "mdShotsAgainst",
    "mdSaves",
    "mdGoalsAgainst",
    "mdXgAgainst",
    "ldShotsAgainst",
    "ldSaves",
    "ldGoalsAgainst",
    "ldXgAgainst",
    "rushAttemptsAgainst",
    "reboundAttemptsAgainst",
    "shotDistanceTotal",
    "shotDistanceCount",
    "goalDistanceTotal",
    "goalDistanceCount",
  ] as const;

  totals.goalies = Object.fromEntries(
    keys.map((key) => [
      key,
      sumNullable(uniqueRows.map((row) => row.metrics.goalies?.[key] ?? null)),
    ])
  );
  return totals;
}

function dedupeRowsByGameId(rows: readonly SummaryRow[]) {
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.gameId)) {
      return false;
    }

    seen.add(row.gameId);
    return true;
  });
}

function findLandingAggregationRowForPlayer(args: {
  playerId: number;
  state: PlayerStatsLandingFilterState;
  rows: readonly any[];
  teamAbbrev: string | null;
}) {
  if (args.state.expandable.tradeMode === "split") {
    return (
      args.rows.find(
        (row) =>
          Number(row?.playerId) === args.playerId &&
          String(row?.teamAbbrev ?? "") === String(args.teamAbbrev ?? "")
      ) ?? null
    );
  }

  return args.rows.find((row) => Number(row?.playerId) === args.playerId) ?? null;
}

function findDetailAggregationRowForPlayer(args: {
  seasonId: number;
  rows: readonly any[];
}) {
  return args.rows.find((row) => Number(row?.seasonId) === args.seasonId) ?? null;
}

function pickDerivedRateValues(finalRowPayload: Record<string, unknown> | null) {
  if (!finalRowPayload) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(finalRowPayload).filter(([key, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return false;
      }

      return (
        key.endsWith("Per60") ||
        key.endsWith("Pct") ||
        key === "gaa" ||
        key === "gsaa" ||
        key === "avgShotDistance" ||
        key === "avgGoalDistance"
      );
    })
  );
}

async function main() {
  const args = parseArgs();
  const queryObject = queryStringToObject(args.query);
  const defaultState =
    args.surface === "detail"
      ? createDefaultDetailFilterState()
      : createDefaultLandingFilterState();
  const parsedState = parsePlayerStatsFilterStateFromQuery(
    queryObject,
    defaultState as any
  ) as PlayerStatsFilterState;
  const validation = validatePlayerStatsFilterState(parsedState);

  if (!validation.isValid) {
    throw new Error(
      `Invalid filter state: ${validation.issues.join(", ")}`
    );
  }

  console.error("[verify-player-underlying-query] fetching eligible games");
  const games = await fetchEligibleGamesForState(parsedState);
  console.error(
    `[verify-player-underlying-query] rebuilding summary snapshots for ${games.length} games`
  );
  const snapshots = await buildPlayerStatsLandingSummarySnapshotsForGameIds(
    games.map((game) => game.id),
    serviceRoleClient
  );
  console.error(
    `[verify-player-underlying-query] loaded ${snapshots.length} summary snapshots`
  );

  const summaryRows = snapshots.flatMap((snapshot) => {
    const payload = snapshot.payload as any;
    if (!Array.isArray(payload?.rows)) {
      return [];
    }

    return payload.rows as SummaryRow[];
  });

  const playerSummaryRows = summaryRows.filter((row) =>
    matchesSummaryRowForState(args.playerId, parsedState, row)
  );
  const scopedRows = applyScopeToSummaryRows({
    state: parsedState,
    games,
    rows: playerSummaryRows,
  });

  const rowsByGroupingKey = new Map<string, SummaryRow[]>();
  for (const row of scopedRows) {
    const key = getGroupingKey(parsedState, row);
    const existing = rowsByGroupingKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      rowsByGroupingKey.set(key, [row]);
    }
  }

  const landingAggregationRows =
    parsedState.surface === "landing"
      ? buildPlayerStatsLandingAggregationFromSummaryRows({
          state: parsedState as PlayerStatsLandingFilterState,
          games,
          rows: playerSummaryRows as any,
        })
      : null;
  const detailAggregationRows =
    parsedState.surface === "detail"
      ? buildPlayerStatsDetailAggregationFromSummaryRows({
          playerId: args.playerId,
          state: parsedState as PlayerStatsDetailFilterState,
          games,
          rows: playerSummaryRows as any,
        })
      : null;

  const verificationBlocks = [...rowsByGroupingKey.entries()].map(([groupKey, rows]) => {
    const dedupedRows = dedupeRowsByGameId(rows).sort((left, right) =>
      compareGamesDescending(
        { date: left.gameDate, id: left.gameId },
        { date: right.gameDate, id: right.gameId }
      )
    );
    const rebuiltFinalRowPayload =
      parsedState.surface === "landing"
        ? (() => {
            const aggregationRow = findLandingAggregationRowForPlayer({
              playerId: args.playerId,
              state: parsedState as PlayerStatsLandingFilterState,
              rows: landingAggregationRows ?? [],
              teamAbbrev: rows[0]?.teamAbbrev ?? null,
            });

            if (!aggregationRow) {
              return null;
            }

            return (
              buildLandingApiResultFromAggregationRows({
                state: cloneStateWithLargePageSize(
                  parsedState as PlayerStatsLandingFilterState
                ),
                rows: [aggregationRow],
              }).rows[0] ?? null
            ) as Record<string, unknown> | null;
          })()
        : (() => {
            const aggregationRow = findDetailAggregationRowForPlayer({
              seasonId: rows[0]?.seasonId ?? 0,
              rows: detailAggregationRows ?? [],
            });

            if (!aggregationRow) {
              return null;
            }

            return (
              buildDetailApiResultFromAggregationRows({
                playerId: args.playerId,
                state: cloneStateWithLargePageSize(
                  parsedState as PlayerStatsDetailFilterState
                ),
                rows: [aggregationRow],
              }).rows[0] ?? null
            ) as Record<string, unknown> | null;
          })();

    return {
      groupingKey: groupKey,
      includedGameIds: dedupedRows.map((row) => row.gameId),
      includedGames: dedupedRows.map((row) => ({
        gameId: row.gameId,
        gameDate: row.gameDate,
        seasonId: row.seasonId,
        teamId: row.teamId,
        teamAbbrev: row.teamAbbrev,
        opponentTeamId: row.opponentTeamId,
        isHome: row.isHome,
        rowMode: row.mode,
        rowStrength: row.strength,
        toiSeconds: row.metrics.toiSeconds ?? null,
      })),
      summedToiSeconds: dedupedRows.reduce(
        (total, row) => total + (row.metrics.toiSeconds ?? 0),
        0
      ),
      rawNumeratorTotals: buildRawNumeratorTotals(parsedState.primary.statMode, dedupedRows),
      derivedValues: pickDerivedRateValues(rebuiltFinalRowPayload),
      rebuiltFinalRowPayload,
    };
  });

  const output = {
    input: args,
    normalizedState: {
      surface: parsedState.surface,
      primary: parsedState.primary,
      expandable: parsedState.expandable,
      view: parsedState.view,
    },
    eligibleGameCount: games.length,
    eligibleGameIds: games.map((game) => game.id),
    summaryRowCountForPlayer: playerSummaryRows.length,
    scopedSummaryRowCountForPlayer: scopedRows.length,
    verificationBlocks,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Unable to verify player underlying query."
  );
  process.exit(1);
});
