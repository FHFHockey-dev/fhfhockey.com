import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

import supabase from "lib/supabase";
import SkaterList from "components/SkaterPage/SkaterList";
import Spinner from "components/Spinner/Spinner";
import type {
  SkaterGameRow,
  SkaterWeek,
  YahooSkaterRow
} from "components/SkaterPage/skaterTypes";

import styles from "./variance.module.scss";

const SKATER_SELECT_FIELDS = [
  "player_id",
  "player_name",
  "team_abbrev",
  "current_team_abbreviation",
  "position_code",
  "date",
  "season_id",
  "games_played",
  "points",
  "points_per_game",
  "goals",
  "assists",
  "shots",
  "shooting_percentage",
  "plus_minus",
  "pp_points",
  "pp_goals",
  "pp_assists",
  "pp_toi",
  "pp_toi_per_game",
  "sh_points",
  "sh_goals",
  "sh_assists",
  "hits",
  "blocked_shots",
  "penalty_minutes",
  "toi_per_game",
  "individual_sat_for_per_60"
].join(",");

const YAHOO_SKATER_SELECT_FIELDS = [
  "player_id",
  "season",
  "player_name",
  "full_name",
  "percent_ownership",
  "ownership_timeline",
  "draft_analysis",
  "average_draft_pick",
  "average_draft_round",
  "average_draft_cost",
  "percent_drafted"
].join(",");

const INITIAL_PAGE_SIZE = 200;
const PAGE_SIZE = 200;

type PagedSkaterRowsResult = {
  rows: SkaterGameRow[];
  hasMore: boolean;
};

type YahooNhlPlayerMapRow = {
  nhl_player_id: string | null;
  yahoo_player_id: string | null;
};

const normalizeIntegerLike = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : Math.trunc(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue)) {
    return Math.trunc(numericValue);
  }

  const digitGroups = normalized.match(/-?\d+/g);
  if (!digitGroups || digitGroups.length === 0) {
    return null;
  }

  const parsed = Number(digitGroups[digitGroups.length - 1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

async function fetchLatestSeasonId() {
  const { data: totalsData, error: totalsError } = await supabase
    .from("wgo_skater_stats_totals")
    .select("season")
    .not("season", "is", null)
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!totalsError) {
    const parsedSeasonId = Number(totalsData?.season);
    if (Number.isFinite(parsedSeasonId)) {
      return parsedSeasonId;
    }
  }

  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select("season_id")
    .not("season_id", "is", null)
    .order("season_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw totalsError ?? error;
  }

  return typeof data?.season_id === "number" ? data.season_id : null;
}

async function fetchSeasonSkaterRowsPage(
  seasonId: number,
  page: number,
  pageSize = PAGE_SIZE
): Promise<PagedSkaterRowsResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from("wgo_skater_stats")
    .select(SKATER_SELECT_FIELDS)
    .eq("season_id", seasonId)
    .gt("games_played", 0)
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as SkaterGameRow[];
  return {
    rows,
    hasMore: rows.length === pageSize
  };
}

function getYahooSeasonFromNhlSeasonId(seasonId: number) {
  return Number.parseInt(String(seasonId).slice(0, 4), 10);
}

function getYahooSeasonStringFromNhlSeasonId(seasonId: number) {
  return String(seasonId).slice(0, 4);
}

async function fetchYahooSkaterRowsForNhlPlayerIds(
  seasonId: number,
  nhlPlayerIds: number[]
) {
  const uniqueNhlPlayerIds = Array.from(new Set(nhlPlayerIds)).filter(
    (playerId) => Number.isFinite(playerId)
  );

  if (uniqueNhlPlayerIds.length === 0) {
    return [] as YahooSkaterRow[];
  }

  const { data: mappingData, error: mappingError } = await supabase
    .from("yahoo_nhl_player_map_mat")
    .select("nhl_player_id, yahoo_player_id")
    .in("nhl_player_id", uniqueNhlPlayerIds.map(String));

  if (mappingError) {
    throw mappingError;
  }

  const yahooSeason = getYahooSeasonFromNhlSeasonId(seasonId);
  const yahooToNhlMap = new Map<string, number>();
  const yahooLookupIds = new Set<string>(uniqueNhlPlayerIds.map(String));

  ((mappingData ?? []) as unknown as YahooNhlPlayerMapRow[]).forEach((row) => {
    if (!row.yahoo_player_id || !row.nhl_player_id) {
      return;
    }

    const normalizedNhlId = normalizeIntegerLike(row.nhl_player_id);
    if (normalizedNhlId === null) {
      return;
    }

    yahooLookupIds.add(row.yahoo_player_id);
    yahooToNhlMap.set(row.yahoo_player_id, normalizedNhlId);
  });

  const { data, error } = await supabase
    .from("yahoo_players")
    .select(YAHOO_SKATER_SELECT_FIELDS)
    .eq("season", yahooSeason)
    .in("player_id", Array.from(yahooLookupIds));

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as YahooSkaterRow[]).reduce<YahooSkaterRow[]>(
    (normalizedRows, row) => {
      const normalizedNhlId =
        (row.player_id != null
          ? yahooToNhlMap.get(String(row.player_id))
          : undefined) ?? normalizeIntegerLike(row.player_id);

      if (normalizedNhlId === null) {
        return normalizedRows;
      }

      normalizedRows.push({
        ...row,
        player_id: normalizedNhlId
      });

      return normalizedRows;
    },
    []
  );
}

const mergeYahooRows = (
  currentRows: YahooSkaterRow[],
  nextRows: YahooSkaterRow[]
) => {
  const mergedByPlayerId = new Map<number, YahooSkaterRow>();

  [...currentRows, ...nextRows].forEach((row) => {
    const normalizedPlayerId = normalizeIntegerLike(row.player_id);
    if (normalizedPlayerId === null) {
      return;
    }

    mergedByPlayerId.set(normalizedPlayerId, {
      ...row,
      player_id: normalizedPlayerId
    });
  });

  return Array.from(mergedByPlayerId.values());
};

async function fetchYahooMatchupWeeks(seasonId: number) {
  const yahooSeason = getYahooSeasonStringFromNhlSeasonId(seasonId);
  const { data, error } = await supabase
    .from("yahoo_matchup_weeks")
    .select("season, week, start_date, end_date")
    .eq("season", yahooSeason)
    .order("week", { ascending: true });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      season: string | number | null;
      week: number | null;
      start_date: string | null;
      end_date: string | null;
    }>
  )
    .filter(
      (week) =>
        week.week !== null && week.start_date !== null && week.end_date !== null
    )
    .map(
      (week): SkaterWeek => ({
        key: `${week.season ?? yahooSeason}:${week.week}`,
        season: week.season,
        weekNumber: week.week,
        startDate: week.start_date as string,
        endDate: week.end_date as string
      })
    );
}

export default function VarianceSkatersPage() {
  const [gameRows, setGameRows] = useState<SkaterGameRow[]>([]);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [yahooRows, setYahooRows] = useState<YahooSkaterRow[]>([]);
  const [matchupWeeks, setMatchupWeeks] = useState<SkaterWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadedPlayerIds = new Set<number>();

    const collectNewPlayerIds = (rows: SkaterGameRow[]) => {
      const nextPlayerIds: number[] = [];

      rows.forEach((row) => {
        if (
          typeof row.player_id !== "number" ||
          !Number.isFinite(row.player_id)
        ) {
          return;
        }

        if (!loadedPlayerIds.has(row.player_id)) {
          loadedPlayerIds.add(row.player_id);
          nextPlayerIds.push(row.player_id);
        }
      });

      return nextPlayerIds;
    };

    const loadYahooRowsForPlayers = async (
      nextSeasonId: number,
      playerIds: number[]
    ) => {
      if (playerIds.length === 0) {
        return [] as YahooSkaterRow[];
      }

      try {
        return await fetchYahooSkaterRowsForNhlPlayerIds(
          nextSeasonId,
          playerIds
        );
      } catch (yahooError) {
        console.warn("Yahoo skater context is unavailable:", yahooError);
        return [] as YahooSkaterRow[];
      }
    };

    const loadRemainingRows = async (
      nextSeasonId: number,
      startPage: number
    ) => {
      setLoadingMore(true);

      try {
        let page = startPage;

        while (!cancelled) {
          const nextPage = await fetchSeasonSkaterRowsPage(nextSeasonId, page);
          const nextPlayerIds = collectNewPlayerIds(nextPage.rows);
          const nextYahooRows = await loadYahooRowsForPlayers(
            nextSeasonId,
            nextPlayerIds
          );

          if (cancelled) {
            return;
          }

          if (nextPage.rows.length === 0) {
            setHasMoreRows(false);
            return;
          }

          setGameRows((currentRows) => [...currentRows, ...nextPage.rows]);
          if (nextYahooRows.length > 0) {
            setYahooRows((currentRows) =>
              mergeYahooRows(currentRows, nextYahooRows)
            );
          }
          setHasMoreRows(nextPage.hasMore);

          if (!nextPage.hasMore) {
            return;
          }

          page += 1;
        }
      } finally {
        if (!cancelled) {
          setLoadingMore(false);
        }
      }
    };

    const loadRows = async () => {
      setLoading(true);
      setLoadingMore(false);
      setHasMoreRows(false);
      setError(null);
      setGameRows([]);
      setYahooRows([]);
      setMatchupWeeks([]);

      try {
        const latestSeasonId = await fetchLatestSeasonId();

        if (!latestSeasonId) {
          throw new Error("No skater season is available.");
        }

        const [firstPage, nextMatchupWeeks] = await Promise.all([
          fetchSeasonSkaterRowsPage(latestSeasonId, 0, INITIAL_PAGE_SIZE),
          fetchYahooMatchupWeeks(latestSeasonId).catch((weekError) => {
            console.warn("Yahoo matchup weeks are unavailable:", weekError);
            return [] as SkaterWeek[];
          })
        ]);

        const nextYahooRows = await loadYahooRowsForPlayers(
          latestSeasonId,
          collectNewPlayerIds(firstPage.rows)
        );

        if (!cancelled) {
          setSeasonId(latestSeasonId);
          setYahooRows(nextYahooRows);
          setMatchupWeeks(nextMatchupWeeks);
          setGameRows(firstPage.rows);
          setHasMoreRows(firstPage.hasMore);
          setLoading(false);

          if (firstPage.hasMore) {
            void loadRemainingRows(latestSeasonId, 1);
          }
        }
      } catch (loadError) {
        console.error("Error loading skater variance rows:", loadError);
        if (!cancelled) {
          setError("Skater variance data is unavailable.");
          setGameRows([]);
          setYahooRows([]);
          setMatchupWeeks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRows();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Head>
        <title>Variance Skaters | FHFHockey</title>
        <meta
          name="description"
          content="Skater variance leaderboard with ownership and ADP valuation."
        />
      </Head>

      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Variance</p>
          <h1 className={styles.title}>Skaters</h1>
          <p className={styles.description}>
            Weekly fantasy-point variance, peer-bucket value, and standard
            skater metrics from existing game rows.
          </p>
          <Link className={styles.backLink} href="/variance">
            Back to Variance
          </Link>
        </header>

        {loading ? (
          <div className={styles.loadingState}>
            <Spinner center />
            <p className={styles.statusText}>Loading first skater batch...</p>
          </div>
        ) : error ? (
          <p className={styles.statusText}>{error}</p>
        ) : (
          <>
            <SkaterList
              seasonId={seasonId}
              gameRows={gameRows}
              yahooRows={yahooRows}
              matchupWeeks={matchupWeeks}
            />
            {loadingMore || hasMoreRows ? (
              <div className={styles.bottomLoadingState}>
                <Spinner size="small" />
                <p className={styles.statusText}>
                  Loading more skater rows in the background...{" "}
                  {gameRows.length} rows loaded.
                </p>
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
