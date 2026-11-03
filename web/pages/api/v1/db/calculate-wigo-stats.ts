// API endpoint for calculating WIGO statistics
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import { normalizeDependencyError } from "lib/cron/normalizeDependencyError";
import adminOnly from "utils/adminOnlyMiddleware";
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server"; // Supabase client instance
import { getCurrentSeason } from "lib/NHL/server"; // NHL season helper function
import { Database } from "lib/supabase/database-generated.types"; // Database schema types
import { SupabaseClient } from "@supabase/supabase-js";

// Database table type definitions
type WgoSkaterTotals =
  Database["public"]["Tables"]["wgo_skater_stats_totals"]["Row"];
type NstIndCounts =
  Database["public"]["Tables"]["nst_seasonal_individual_counts"]["Row"];
type NstOnIceCounts =
  Database["public"]["Tables"]["nst_seasonal_on_ice_counts"]["Row"];
type WgoGamelog = Database["public"]["Tables"]["wgo_skater_stats"]["Row"];
type NstIndGamelogCounts =
  Database["public"]["Tables"]["nst_gamelog_as_counts"]["Row"];
type NstOiGamelogCounts =
  Database["public"]["Tables"]["nst_gamelog_as_counts_oi"]["Row"];

type WigoRecentData = Database["public"]["Tables"]["wigo_recent"]["Row"];
type WigoCareerData = Database["public"]["Tables"]["wigo_career"]["Row"];

// Column subset types for specific data selections
type SelectedNstIndCounts = Pick<
  NstIndCounts,
  "season" | "strength" | "toi" | "ixg" | "icf" | "ihdcf" | "iscfs" | "gp"
>;
type SelectedNstOnIceCounts = Pick<
  NstOnIceCounts,
  | "season"
  | "strength"
  | "toi"
  | "gf"
  | "sf"
  | "off_zone_starts"
  | "def_zone_starts"
  | "gp"
>;
type SelectedWgoGamelog = Pick<
  WgoGamelog,
  | "game_id"
  | "games_played"
  | "date"
  | "season_id"
  | "goals"
  | "assists"
  | "points"
  | "total_primary_assists"
  | "shots"
  | "pp_goals"
  | "pp_assists"
  | "pp_points"
  | "hits"
  | "blocked_shots"
  | "penalty_minutes"
  | "pp_toi_pct_per_game"
  | "pp_toi"
>;
type SelectedNstIndGamelog = Pick<
  NstIndGamelogCounts,
  "date_scraped" | "season" | "toi" | "ixg" | "icf" | "iscfs" | "hdcf" // Note: Using hdcf from gamelog
>;
type SelectedNstOiGamelog = Pick<
  NstOiGamelogCounts,
  "date_scraped" | "season" | "gf" | "sf" | "off_zone_starts" | "def_zone_starts"
>;

// Aggregated data interfaces for seasonal and game data
interface AggregatedSeasonData {
  season: number;
  gp: number;
  wgo_g: number;
  wgo_a: number;
  wgo_pts: number;
  wgo_a1: number;
  wgo_sog: number;
  wgo_ppg: number;
  wgo_ppa: number;
  wgo_ppp: number;
  wgo_hit: number;
  wgo_blk: number;
  wgo_pim: number;
  wgo_pp_toi_pct: number | null;
  wgo_pp_toi: number | null;
  wgo_gp: number;
  wgo_toi: number | null; // Minutes, from WGO toi_per_game (seconds) x games
  has_wgo: boolean;
  has_nst_ind: boolean;
  has_nst_oi: boolean;
  toi_all: number;
  ixg_all: number;
  icf_all: number;
  ihdcf_all: number; // From NST Seasonal ihdcf
  iscfs_all: number; // From NST Seasonal iscfs
  gf_all: number;
  sf_all: number;
  off_zs_all: number;
  def_zs_all: number;
}

interface CombinedGameData {
  date: string;
  wgo_g: number | null;
  wgo_a: number | null;
  wgo_pts: number | null;
  wgo_a1: number | null;
  wgo_sog: number | null;
  wgo_ppg: number | null;
  wgo_ppa: number | null;
  wgo_ppp: number | null;
  wgo_hit: number | null;
  wgo_blk: number | null;
  wgo_pim: number | null;
  wgo_pp_toi_pct: number | null;
  wgo_pp_toi: number | null; // Seconds
  nst_toi_all: number | null; // Seconds in NST game logs
  nst_ixg: number | null;
  nst_icf: number | null;
  nst_ihdcf: number | null; // From gamelog hdcf
  nst_iscfs: number | null; // From gamelog iscfs
  nst_oi_gf: number | null;
  nst_oi_sf: number | null;
  nst_oi_off_zs: number | null;
  nst_oi_def_zs: number | null;
}

// Helper functions for calculations
const safeDivide = (
  numerator?: number | null,
  denominator?: number | null
): number | null => {
  if (numerator == null || denominator == null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};
const calculatePer60 = (
  count?: number | null,
  toiMinutes?: number | null
): number | null => {
  const toiSixtyMinUnits = safeDivide(toiMinutes, 60);
  return safeDivide(count, toiSixtyMinUnits);
};
const calculatePer60FromSeconds = (
  count?: number | null,
  toiSeconds?: number | null
): number | null => {
  const toiMinutes = safeDivide(toiSeconds, 60);
  const toiSixtyMinUnits = safeDivide(toiMinutes, 60);
  return safeDivide(count, toiSixtyMinUnits);
};
const safeAverage = (values: (number | null | undefined)[]): number | null => {
  const validValues = values.filter((v): v is number => v != null);
  if (validValues.length === 0) {
    return null;
  }
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
};

// Pagination helper for fetching player IDs
const PAGE_SIZE = 1000;
// Stop short of the 240 s platform limit so the final flush and the audit row
// always happen; a killed run records nothing (B-01).
const RUN_BUDGET_MS = 200_000;
// Only skaters with a totals row this season or last can change a WiGO row.
// Walking every non-goalie in `players` (3,906) outran the platform limit and
// starved the highest ids every night.
async function fetchActivePlayerIds(
  client: SupabaseClient<Database>,
  seasonIds: number[]
): Promise<number[]> {
  let allPlayerIds: number[] = [];
  let keepFetching = true;
  let page = 0;
  while (keepFetching) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from("wgo_skater_stats_totals")
      .select("player_id")
      .in("season", seasonIds.map(String))
      // Range pages are only disjoint and complete under a stable order.
      .order("player_id", { ascending: true })
      .order("season", { ascending: true })
      .range(from, to);
    if (error) {
      throw new Error(
        `Error fetching player IDs from wgo_skater_stats_totals: ${error.message}`
      );
    }
    if (data && data.length > 0) {
      allPlayerIds = allPlayerIds.concat(
        data.map((p) => p.player_id).filter((id): id is number => id != null)
      );
    }
    if (!data || data.length < PAGE_SIZE) {
      keepFetching = false;
    } else {
      page++;
    }
  }
  const uniqueIds = [...new Set(allPlayerIds)];
  console.log(
    `Found ${uniqueIds.length} skaters with a totals row in ${seasonIds.join(" or ")}.`
  );
  return uniqueIds;
}
// --- END PAGINATION HELPER ---

// --- Main Handler ---
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  console.log(
    "Starting player stats update (v9 - Separate Recent Table - Full Code)..."
  );

  try {
    // 1. Get Current Season Info
    const currentSeasonInfo = await getCurrentSeason();
    const currentSeasonId = currentSeasonInfo.seasonId;
    const lastSeasonId = currentSeasonInfo.lastSeasonId;
    const currentYearStart = parseInt(
      currentSeasonId.toString().substring(0, 4)
    );
    const ya3Seasons = [
      (currentYearStart - 1) * 10000 + (currentYearStart - 1 + 1),
      (currentYearStart - 2) * 10000 + (currentYearStart - 2 + 1),
      (currentYearStart - 3) * 10000 + (currentYearStart - 3 + 1)
    ];
    console.log(
      `Current Season: ${currentSeasonId}, Last Season: ${lastSeasonId}, 3YA Seasons: ${ya3Seasons.join(
        ", "
      )}`
    );

    // 2. Get Player IDs
    const uniquePlayerIds = await fetchActivePlayerIds(supabase, [
      currentSeasonId,
      lastSeasonId
    ]);
    if (!uniquePlayerIds || uniquePlayerIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No skaters with a totals row this season or last."
      });
    }
    console.log(
      `Obtained ${uniquePlayerIds.length} unique player IDs to process.`
    );

    let processedCount = 0;
    const rejectedPlayerIds: number[] = [];
    const writeErrors: string[] = [];
    // Define batch arrays with non-partial types
    const allCareerUpsertData: WigoCareerData[] = [];
    const allRecentUpsertData: WigoRecentData[] = [];
    const UPSERT_BATCH_SIZE = 200;
    let rowsUpserted = 0;
    let firstNotReachedIndex: number | null = null;

    // 3. Process Each Player
    for (const [playerIndex, playerId] of uniquePlayerIds.entries()) {
      if (Date.now() - startTime > RUN_BUDGET_MS) {
        firstNotReachedIndex = playerIndex;
        break;
      }
      // --- Fetch Seasonal Data ---
      const wgoSelect =
        "season, games_played, goals, assists, points, total_primary_assists, shots, pp_goals, pp_assists, pp_points, hits, blocked_shots, penalty_minutes, pp_toi_pct_per_game, pp_toi, toi_per_game";
      const nstIndSelect = "season, strength, toi, ixg, icf, ihdcf, iscfs, gp";
      const nstOnIceSelect =
        "season, strength, toi, gf, sf, off_zone_starts, def_zone_starts, gp";
      const [wgoTotalsRes, nstIndCountsRes, nstOnIceCountsRes] =
        await Promise.all([
          supabase
            .from("wgo_skater_stats_totals")
            .select(wgoSelect)
            .eq("player_id", playerId),
          supabase
            .from("nst_seasonal_individual_counts")
            .select(nstIndSelect)
            .eq("player_id", playerId)
            .eq("strength", "all"),
          supabase
            .from("nst_seasonal_on_ice_counts")
            .select(nstOnIceSelect)
            .eq("player_id", playerId)
            .eq("strength", "all")
        ]);

      for (const [table, result] of [
        ["wgo_skater_stats_totals", wgoTotalsRes],
        ["nst_seasonal_individual_counts", nstIndCountsRes],
        ["nst_seasonal_on_ice_counts", nstOnIceCountsRes]
      ] as const) {
        if (result.error) {
          throw new Error(`Failed to fetch ${table} for player ${playerId}: ${result.error.message}`);
        }
      }

      // --- Fetch Game Log Data (Last 20) ---
      const wgoGamelogSelect =
        "game_id, games_played, date, season_id, goals, assists, points, total_primary_assists, shots, pp_goals, pp_assists, pp_points, hits, blocked_shots, penalty_minutes, pp_toi_pct_per_game, pp_toi";
      const nstIndGamelogSelect = "date_scraped, season, toi, ixg, icf, iscfs, hdcf";
      const nstOiGamelogSelect =
        "date_scraped, season, gf, sf, off_zone_starts, def_zone_starts";
      const wgoGamelogRes = await supabase
        .from("wgo_skater_stats")
        .select(wgoGamelogSelect)
        .eq("player_id", playerId)
        .eq("games_played", 1)
        .order("date", { ascending: false })
        .order("game_id", { ascending: false })
        .limit(20);
      if (wgoGamelogRes.error) {
        throw new Error(`Failed to fetch wgo_skater_stats for player ${playerId}: ${wgoGamelogRes.error.message}`);
      }
      const wgoLogs = (wgoGamelogRes.data || []) as SelectedWgoGamelog[];
      const gameIds = new Set<number>();
      const recentSeasons = new Set<number>();
      const invalidFrame = wgoLogs.some(game => {
        const seasonStart = Math.floor((game.season_id ?? 0) / 10000);
        if (
          game.game_id == null || game.season_id == null ||
          !Number.isSafeInteger(game.game_id) ||
          !new RegExp(`^${seasonStart}02\\d{4}$`).test(String(game.game_id)) ||
          !Number.isSafeInteger(game.season_id) ||
          game.season_id !== seasonStart * 10000 + seasonStart + 1 ||
          game.games_played !== 1 ||
          gameIds.has(game.game_id)
        ) return true;
        gameIds.add(game.game_id);
        recentSeasons.add(game.season_id);
        return false;
      });
      // Withhold every write for this player only; the run still reports failure.
      if (invalidFrame) {
        rejectedPlayerIds.push(playerId);
        continue;
      }

      // Keep the existing cross-season NHL window; NST must match its exact dates
      // and seasons, without unrelated postseason rows consuming a separate limit.
      const recentDates = wgoLogs.map(game => game.date);
      const [nstIndGamelogRes, nstOiGamelogRes] = wgoLogs.length > 0
        ? await Promise.all([
          supabase
            .from("nst_gamelog_as_counts")
            .select(nstIndGamelogSelect)
            .eq("player_id", playerId)
            .in("season", [...recentSeasons])
            .in("date_scraped", recentDates),
          supabase
            .from("nst_gamelog_as_counts_oi")
            .select(nstOiGamelogSelect)
            .eq("player_id", playerId)
            .in("season", [...recentSeasons])
            .in("date_scraped", recentDates)
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
      for (const [table, result] of [
        ["nst_gamelog_as_counts", nstIndGamelogRes],
        ["nst_gamelog_as_counts_oi", nstOiGamelogRes]
      ] as const) {
        if (result.error) {
          throw new Error(`Failed to fetch ${table} for player ${playerId}: ${result.error.message}`);
        }
      }

      // --- Combine Game Log Data ---
      const combinedGames: CombinedGameData[] = [];
      const nstIndLogs = (nstIndGamelogRes.data ||
        []) as SelectedNstIndGamelog[];
      const nstOiLogs = (nstOiGamelogRes.data || []) as SelectedNstOiGamelog[];
      const nstIndMap = new Map(
        nstIndLogs.filter(log => Number.isInteger(log.season) && log.season > 0).map((log) => [`${log.season}:${log.date_scraped}`, log])
      );
      const nstOiMap = new Map(nstOiLogs.filter(log => Number.isInteger(log.season) && log.season > 0).map((log) => [`${log.season}:${log.date_scraped}`, log]));

      for (const wgoGame of wgoLogs) {
        const gameDate = wgoGame.date;
        const gameKey = `${wgoGame.season_id}:${gameDate}`;
        const nstIndGame = nstIndMap.get(gameKey);
        const nstOiGame = nstOiMap.get(gameKey);
        combinedGames.push({
          date: gameDate,
          wgo_g: wgoGame.goals ?? null,
          wgo_a: wgoGame.assists ?? null,
          wgo_pts: wgoGame.points ?? null,
          wgo_a1: wgoGame.total_primary_assists ?? null,
          wgo_sog: wgoGame.shots ?? null,
          wgo_ppg: wgoGame.pp_goals ?? null,
          wgo_ppa: wgoGame.pp_assists ?? null,
          wgo_ppp: wgoGame.pp_points ?? null,
          wgo_hit: wgoGame.hits ?? null,
          wgo_blk: wgoGame.blocked_shots ?? null,
          wgo_pim: wgoGame.penalty_minutes ?? null,
          wgo_pp_toi_pct: wgoGame.pp_toi_pct_per_game,
          wgo_pp_toi: wgoGame.pp_toi,
          // FIX: Use nullish coalescing operator ??
          nst_toi_all: nstIndGame?.toi ?? null,
          nst_ixg: nstIndGame?.ixg ?? null,
          nst_icf: nstIndGame?.icf ?? null,
          nst_ihdcf: nstIndGame?.hdcf ?? null, // Use hdcf from gamelog here
          nst_iscfs: nstIndGame?.iscfs ?? null,
          nst_oi_gf: nstOiGame?.gf ?? null,
          nst_oi_sf: nstOiGame?.sf ?? null,
          nst_oi_off_zs: nstOiGame?.off_zone_starts ?? null,
          nst_oi_def_zs: nstOiGame?.def_zone_starts ?? null
        });
      }
      // --- End Combine Game Log ---

      // --- Seasonal Data Aggregation ---
      const wgoTotals = (wgoTotalsRes.data || []) as WgoSkaterTotals[];
      const nstIndCounts = (nstIndCountsRes.data ||
        []) as SelectedNstIndCounts[];
      const nstOnIceCounts = (nstOnIceCountsRes.data ||
        []) as SelectedNstOnIceCounts[];

      // Skip check: only skip if NO data at all is available
      if (
        wgoTotals.length === 0 &&
        nstIndCounts.length === 0 &&
        nstOnIceCounts.length === 0 &&
        combinedGames.length === 0
      ) {
        continue;
      }

      const aggregatedDataBySeason: { [season: number]: AggregatedSeasonData } =
        {};
      const initSeasonData = (seasonKey: number): AggregatedSeasonData => ({
        season: seasonKey,
        gp: 0,
        wgo_g: 0,
        wgo_a: 0,
        wgo_pts: 0,
        wgo_a1: 0,
        wgo_sog: 0,
        wgo_ppg: 0,
        wgo_ppa: 0,
        wgo_ppp: 0,
        wgo_hit: 0,
        wgo_blk: 0,
        wgo_pim: 0,
        wgo_pp_toi_pct: null,
        wgo_pp_toi: null,
        wgo_gp: 0,
        wgo_toi: null,
        has_wgo: false,
        has_nst_ind: false,
        has_nst_oi: false,
        toi_all: 0,
        ixg_all: 0,
        icf_all: 0,
        ihdcf_all: 0,
        iscfs_all: 0,
        gf_all: 0,
        sf_all: 0,
        off_zs_all: 0,
        def_zs_all: 0
      });
      const processNstRecord = (
        record: SelectedNstIndCounts | SelectedNstOnIceCounts,
        seasonKey: number,
        isIndividualRecord: boolean // Flag to identify the source table type
      ) => {
        if (record.strength !== "all") return;
        if (!aggregatedDataBySeason[seasonKey]) {
          aggregatedDataBySeason[seasonKey] = initSeasonData(seasonKey);
        }
        const seasonData = aggregatedDataBySeason[seasonKey];

        // Always try to get the most accurate GP
        seasonData.gp = Math.max(seasonData.gp, record.gp ?? 0);
        // --- Only add TOI if it's from the individual counts record ---
        if (isIndividualRecord) seasonData.has_nst_ind = true;
        else seasonData.has_nst_oi = true;
        if (isIndividualRecord && "toi" in record) {
          const toi = record.toi ?? 0; // toi is in minutes here
          seasonData.toi_all += toi; // Add TOI (minutes) only once per season
        }
        // -------------------------------------------------------------

        if ("ixg" in record) seasonData.ixg_all += record.ixg ?? 0;
        if ("icf" in record) seasonData.icf_all += record.icf ?? 0;
        if ("ihdcf" in record) seasonData.ihdcf_all += record.ihdcf ?? 0;
        if ("iscfs" in record) seasonData.iscfs_all += record.iscfs ?? 0;
        if ("gf" in record) seasonData.gf_all += record.gf ?? 0;
        if ("sf" in record) seasonData.sf_all += record.sf ?? 0;
        if ("off_zone_starts" in record)
          seasonData.off_zs_all += record.off_zone_starts ?? 0;
        if ("def_zone_starts" in record)
          seasonData.def_zs_all += record.def_zone_starts ?? 0;
      };
      // A traded player can hold a stale pre-trade row (`N.J`) beside the
      // cumulative one (`N.J, WPG`). Summing them inflates TOI and counts, so
      // keep only the highest-GP row per season (B-04, C-22).
      const onePerSeason = <T extends { season: number; gp: number | null }>(
        records: T[]
      ): T[] => {
        const bySeason = new Map<number, T>();
        for (const rec of records) {
          const kept = bySeason.get(rec.season);
          if (!kept || (rec.gp ?? 0) > (kept.gp ?? 0)) bySeason.set(rec.season, rec);
        }
        return [...bySeason.values()];
      };
      // **** Pass the flag when calling processNstRecord ****
      onePerSeason(nstIndCounts).forEach((rec) => processNstRecord(rec, rec.season, true)); // Pass true for individual records
      onePerSeason(nstOnIceCounts).forEach((rec) => processNstRecord(rec, rec.season, false)); // Pass false for on-ice records

      wgoTotals.forEach((rec) => {
        const seasonKey = parseInt(rec.season);
        if (isNaN(seasonKey)) return;
        if (!aggregatedDataBySeason[seasonKey]) {
          // If only WGO data exists, GP might come from here
          aggregatedDataBySeason[seasonKey] = initSeasonData(seasonKey);
          aggregatedDataBySeason[seasonKey].gp = rec.games_played ?? 0; // Capture GP if only WGO exists
        }

        const seasonData = aggregatedDataBySeason[seasonKey];
        seasonData.gp = Math.max(seasonData.gp, rec.games_played ?? 0);
        seasonData.wgo_g = rec.goals ?? 0;
        seasonData.wgo_a = rec.assists ?? 0;
        seasonData.wgo_pts = rec.points ?? 0;
        seasonData.wgo_a1 = rec.total_primary_assists ?? 0;
        seasonData.wgo_sog = rec.shots ?? 0;
        seasonData.wgo_ppg = rec.pp_goals ?? 0;
        seasonData.wgo_ppa = rec.pp_assists ?? 0;
        seasonData.wgo_ppp = rec.pp_points ?? 0;
        seasonData.wgo_hit = rec.hits ?? 0;
        seasonData.wgo_blk = rec.blocked_shots ?? 0;
        seasonData.wgo_pim = rec.penalty_minutes ?? 0;
        seasonData.wgo_pp_toi_pct = rec.pp_toi_pct_per_game;
        seasonData.wgo_pp_toi = rec.pp_toi;
        seasonData.has_wgo = true;
        seasonData.wgo_gp = rec.games_played ?? 0;
        seasonData.wgo_toi =
          rec.toi_per_game != null && rec.games_played != null
            ? (rec.toi_per_game * rec.games_played) / 60
            : null;
      });
      const playerSeasons = Object.values(aggregatedDataBySeason).sort(
        (a, b) => a.season - b.season
      );
      // --- End Seasonal Aggregation ---

      // --- Initialize Career and Recent Stats Objects ---
      // Initialize with required fields
      const careerStats: Partial<WigoCareerData> = { player_id: playerId };
      const recentStats: Partial<WigoRecentData> = { player_id: playerId };

      // --- Calculate STD / LY / 3YA / CA for careerStats ---
      // One builder for every period; a single season is the one-season case.
      // Each metric's numerator and denominator come from the same seasons,
      // and a source absent from every season gives null, not 0 (C-21, C-31).
      // ATOI and per-60s of WGO counts use WGO ice time, falling back to NST
      // only for a season without it; NST-only stats stay on NST.
      const writePeriod = (
        prefix: "std" | "ly" | "ya3" | "ca",
        seasons: AggregatedSeasonData[]
      ) => {
        const set = (metric: string, value: number | null) => {
          (careerStats as any)[`${prefix}_${metric}`] = value;
        };
        const sum = (
          rows: AggregatedSeasonData[],
          pick: (season: AggregatedSeasonData) => number
        ) => rows.reduce((acc, season) => acc + pick(season), 0);
        const perSeason = (
          rows: AggregatedSeasonData[],
          pick: (season: AggregatedSeasonData) => number
        ) => safeDivide(sum(rows, pick), rows.length);
        const toiMinutes = (season: AggregatedSeasonData) =>
          season.wgo_toi ?? (season.has_nst_ind ? season.toi_all : null);
        const toiGp = (season: AggregatedSeasonData) =>
          season.wgo_toi != null ? season.wgo_gp : season.gp;

        const wgo = seasons.filter((season) => season.has_wgo);
        const timed = seasons.filter((season) => toiMinutes(season) != null);
        const timedWgo = wgo.filter((season) => toiMinutes(season) != null);
        const pp = wgo.filter((season) => season.wgo_pp_toi != null);
        const nstInd = seasons.filter((season) => season.has_nst_ind);
        const nstOi = seasons.filter((season) => season.has_nst_oi);
        const wgoOi = wgo.filter((season) => season.has_nst_oi);
        const timedToi = sum(timedWgo, (season) => toiMinutes(season) ?? 0);
        const nstToi = sum(nstInd, (season) => season.toi_all);
        const ppToi = sum(pp, (season) => season.wgo_pp_toi ?? 0);

        set("gp", perSeason(seasons, (season) => season.gp));
        set(
          "atoi",
          safeDivide(
            sum(timed, (season) => toiMinutes(season) ?? 0),
            sum(timed, toiGp)
          )
        );
        set(
          "pptoi",
          safeDivide(ppToi, sum(pp, (season) => season.gp))
        );
        set(
          "pp_pct",
          safeAverage(wgo.map((season) => season.wgo_pp_toi_pct))
        );
        const wgoCounts = [
          ["g", "wgo_g"],
          ["a", "wgo_a"],
          ["pts", "wgo_pts"],
          ["sog", "wgo_sog"],
          ["ppg", "wgo_ppg"],
          ["ppa", "wgo_ppa"],
          ["ppp", "wgo_ppp"],
          ["hit", "wgo_hit"],
          ["blk", "wgo_blk"],
          ["pim", "wgo_pim"]
        ] as const;
        for (const [metric, field] of wgoCounts) {
          set(metric, wgo.length > 0 ? perSeason(wgo, (season) => season[field]) : null);
        }
        set(
          "pts1_pct",
          safeDivide(
            sum(wgo, (season) => season.wgo_g + season.wgo_a1),
            sum(wgo, (season) => season.wgo_pts)
          )
        );
        set(
          "s_pct",
          safeDivide(
            sum(wgo, (season) => season.wgo_g),
            sum(wgo, (season) => season.wgo_sog)
          )
        );
        set("ixg", nstInd.length > 0 ? perSeason(nstInd, (season) => season.ixg_all) : null);
        set("icf", nstInd.length > 0 ? perSeason(nstInd, (season) => season.icf_all) : null);
        set(
          "ipp",
          safeDivide(
            sum(wgoOi, (season) => season.wgo_pts),
            sum(wgoOi, (season) => season.gf_all)
          )
        );
        set(
          "oi_sh_pct",
          safeDivide(
            sum(nstOi, (season) => season.gf_all),
            sum(nstOi, (season) => season.sf_all)
          )
        );
        set(
          "ozs_pct",
          safeDivide(
            sum(nstOi, (season) => season.off_zs_all),
            sum(nstOi, (season) => season.off_zs_all + season.def_zs_all)
          )
        );
        const wgoRates = [
          ["g", (season: AggregatedSeasonData) => season.wgo_g],
          ["a", (season: AggregatedSeasonData) => season.wgo_a],
          ["pts", (season: AggregatedSeasonData) => season.wgo_pts],
          ["pts1", (season: AggregatedSeasonData) => season.wgo_g + season.wgo_a1],
          ["sog", (season: AggregatedSeasonData) => season.wgo_sog],
          ["hit", (season: AggregatedSeasonData) => season.wgo_hit],
          ["blk", (season: AggregatedSeasonData) => season.wgo_blk],
          ["pim", (season: AggregatedSeasonData) => season.wgo_pim]
        ] as const;
        for (const [metric, pick] of wgoRates) {
          set(`${metric}_per_60`, calculatePer60(sum(timedWgo, pick), timedToi));
        }
        const nstRates = [
          ["ixg", "ixg_all"],
          ["icf", "icf_all"],
          ["ihdcf", "ihdcf_all"],
          ["iscf", "iscfs_all"]
        ] as const;
        for (const [metric, field] of nstRates) {
          set(
            `${metric}_per_60`,
            calculatePer60(sum(nstInd, (season) => season[field]), nstToi)
          );
        }
        const ppRates = [
          ["ppg", "wgo_ppg"],
          ["ppa", "wgo_ppa"],
          ["ppp", "wgo_ppp"]
        ] as const;
        for (const [metric, field] of ppRates) {
          set(
            `${metric}_per_60`,
            calculatePer60FromSeconds(sum(pp, (season) => season[field]), ppToi)
          );
        }
      };

      const stdData = playerSeasons.find((s) => s.season === currentSeasonId);
      if (stdData) writePeriod("std", [stdData]);
      const lyData = playerSeasons.find((s) => s.season === lastSeasonId);
      if (lyData) writePeriod("ly", [lyData]);
      const ya3RelevantSeasons = playerSeasons.filter((s) =>
        ya3Seasons.includes(s.season)
      );
      careerStats.ya3_seasons_used = ya3RelevantSeasons.length;
      if (ya3RelevantSeasons.length > 0) writePeriod("ya3", ya3RelevantSeasons);
      const caRelevantSeasons = playerSeasons.filter(
        (s) => s.season !== currentSeasonId
      );
      careerStats.ca_seasons_used = caRelevantSeasons.length;
      if (caRelevantSeasons.length > 0) writePeriod("ca", caRelevantSeasons);
      // --- End Seasonal Calcs ---

      // --- Calculate L5, L10, L20 for recentStats ---
      const gameIntervals = [5, 10, 20];
      for (const interval of gameIntervals) {
        const gamesInInterval = combinedGames.slice(0, interval);
        const numGames = gamesInInterval.length;
        const prefix = `l${interval}_` as const;

        // FIX: Cast recentStats to any for dynamic assignment
        (recentStats as any)[`${prefix}gp`] = numGames;

        if (numGames > 0) {
          const completeTotalToi = gamesInInterval.every(game =>
            typeof game.nst_toi_all === "number" && Number.isFinite(game.nst_toi_all) && game.nst_toi_all >= 0
          );
          const completePpToi = gamesInInterval.every(game =>
            typeof game.wgo_pp_toi === "number" && Number.isFinite(game.wgo_pp_toi) && game.wgo_pp_toi >= 0
          );
          const totals = gamesInInterval.reduce(
            (acc, game) => {
              // nst_toi_all is per-game ice time in seconds
              acc.nst_toi_all += game.nst_toi_all ?? 0;
              acc.gp += 1;
              acc.wgo_g += game.wgo_g ?? 0;
              acc.wgo_a += game.wgo_a ?? 0;
              acc.wgo_pts += game.wgo_pts ?? 0;
              acc.wgo_a1 += game.wgo_a1 ?? 0;
              acc.wgo_sog += game.wgo_sog ?? 0;
              acc.wgo_ppg += game.wgo_ppg ?? 0;
              acc.wgo_ppa += game.wgo_ppa ?? 0;
              acc.wgo_ppp += game.wgo_ppp ?? 0;
              acc.wgo_hit += game.wgo_hit ?? 0;
              acc.wgo_blk += game.wgo_blk ?? 0;
              acc.wgo_pim += game.wgo_pim ?? 0;
              acc.wgo_pp_toi_pct_values.push(game.wgo_pp_toi_pct);
              acc.wgo_pp_toi += game.wgo_pp_toi ?? 0;
              acc.nst_ixg += game.nst_ixg ?? 0;
              acc.nst_oi_gf += game.nst_oi_gf ?? 0;
              acc.nst_oi_sf += game.nst_oi_sf ?? 0;
              acc.nst_oi_off_zs += game.nst_oi_off_zs ?? 0;
              acc.nst_oi_def_zs += game.nst_oi_def_zs ?? 0;
              acc.nst_icf += game.nst_icf ?? 0;
              acc.nst_ihdcf += game.nst_ihdcf ?? 0;
              acc.nst_iscfs += game.nst_iscfs ?? 0;
              return acc;
            },
            {
              nst_toi_all: 0,
              gp: 0,
              wgo_g: 0,
              wgo_a: 0,
              wgo_pts: 0,
              wgo_a1: 0,
              wgo_sog: 0,
              wgo_ppg: 0,
              wgo_ppa: 0,
              wgo_ppp: 0,
              wgo_hit: 0,
              wgo_blk: 0,
              wgo_pim: 0,
              wgo_pp_toi_pct_values: [] as (number | null)[],
              wgo_pp_toi: 0,
              nst_ixg: 0,
              nst_oi_gf: 0,
              nst_oi_sf: 0,
              nst_oi_off_zs: 0,
              nst_oi_def_zs: 0,
              nst_icf: 0,
              nst_ihdcf: 0,
              nst_iscfs: 0
            }
          );

          // For recent stats, nst_toi_all is in seconds, so we need to convert to minutes
          (recentStats as any)[`${prefix}atoi`] = safeDivide(
            totals.nst_toi_all / 60, // Convert seconds to minutes
            totals.gp
          );
          (recentStats as any)[`${prefix}pptoi`] = safeDivide(
            totals.wgo_pp_toi,
            totals.gp
          );
          (recentStats as any)[`${prefix}pp_pct`] = safeAverage(
            totals.wgo_pp_toi_pct_values
          );
          (recentStats as any)[`${prefix}g`] = totals.wgo_g;
          (recentStats as any)[`${prefix}a`] = totals.wgo_a;
          (recentStats as any)[`${prefix}pts`] = totals.wgo_pts;
          (recentStats as any)[`${prefix}pts1_pct`] = safeDivide(
            totals.wgo_g + totals.wgo_a1,
            totals.wgo_pts
          );
          (recentStats as any)[`${prefix}sog`] = totals.wgo_sog;
          (recentStats as any)[`${prefix}s_pct`] = safeDivide(
            totals.wgo_g,
            totals.wgo_sog
          );
          (recentStats as any)[`${prefix}ixg`] = totals.nst_ixg;
          (recentStats as any)[`${prefix}ipp`] = safeDivide(
            totals.wgo_pts,
            totals.nst_oi_gf
          );
          (recentStats as any)[`${prefix}oi_sh_pct`] = safeDivide(
            totals.nst_oi_gf,
            totals.nst_oi_sf
          );
          (recentStats as any)[`${prefix}ozs_pct`] = safeDivide(
            totals.nst_oi_off_zs,
            totals.nst_oi_off_zs + totals.nst_oi_def_zs
          );
          (recentStats as any)[`${prefix}icf`] = totals.nst_icf;
          (recentStats as any)[`${prefix}ppg`] = totals.wgo_ppg;
          (recentStats as any)[`${prefix}ppa`] = totals.wgo_ppa;
          (recentStats as any)[`${prefix}ppp`] = totals.wgo_ppp;
          (recentStats as any)[`${prefix}hit`] = totals.wgo_hit;
          (recentStats as any)[`${prefix}blk`] = totals.wgo_blk;
          (recentStats as any)[`${prefix}pim`] = totals.wgo_pim;
          (recentStats as any)[`${prefix}g_per_60`] = calculatePer60FromSeconds(
            totals.wgo_g,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}a_per_60`] = calculatePer60FromSeconds(
            totals.wgo_a,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pts_per_60`] = calculatePer60FromSeconds(
            totals.wgo_pts,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pts1_per_60`] = calculatePer60FromSeconds(
            totals.wgo_g + totals.wgo_a1,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}sog_per_60`] = calculatePer60FromSeconds(
            totals.wgo_sog,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ixg_per_60`] = calculatePer60FromSeconds(
            totals.nst_ixg,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}icf_per_60`] = calculatePer60FromSeconds(
            totals.nst_icf,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ihdcf_per_60`] = calculatePer60FromSeconds(
            totals.nst_ihdcf,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}iscf_per_60`] = calculatePer60FromSeconds(
            totals.nst_iscfs,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ppg_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppg, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}ppa_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppa, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}ppp_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppp, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}hit_per_60`] = calculatePer60FromSeconds(
            totals.wgo_hit,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}blk_per_60`] = calculatePer60FromSeconds(
            totals.wgo_blk,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pim_per_60`] = calculatePer60FromSeconds(
            totals.wgo_pim,
            totals.nst_toi_all
          );
          if (!completeTotalToi) {
            for (const metric of ["atoi", "g_per_60", "a_per_60", "pts_per_60", "pts1_per_60", "sog_per_60", "ixg_per_60", "icf_per_60", "ihdcf_per_60", "iscf_per_60", "hit_per_60", "blk_per_60", "pim_per_60"]) {
              (recentStats as any)[`${prefix}${metric}`] = null;
            }
          }
          if (!completePpToi) {
            for (const metric of ["pptoi", "ppg_per_60", "ppa_per_60", "ppp_per_60"]) {
              (recentStats as any)[`${prefix}${metric}`] = null;
            }
          }
          const metricCoverage: Array<{ fields: Array<keyof CombinedGameData>; metrics: string[] }> = [
            { fields: ["wgo_g"], metrics: ["g", "g_per_60", "pts1_per_60", "pts1_pct", "s_pct"] },
            { fields: ["wgo_a"], metrics: ["a", "a_per_60"] },
            { fields: ["wgo_pts"], metrics: ["pts", "pts_per_60", "pts1_pct", "ipp"] },
            { fields: ["wgo_a1"], metrics: ["pts1_per_60", "pts1_pct"] },
            { fields: ["wgo_sog"], metrics: ["sog", "sog_per_60", "s_pct"] },
            { fields: ["wgo_ppg"], metrics: ["ppg", "ppg_per_60"] },
            { fields: ["wgo_ppa"], metrics: ["ppa", "ppa_per_60"] },
            { fields: ["wgo_ppp"], metrics: ["ppp", "ppp_per_60"] },
            { fields: ["wgo_hit"], metrics: ["hit", "hit_per_60"] },
            { fields: ["wgo_blk"], metrics: ["blk", "blk_per_60"] },
            { fields: ["wgo_pim"], metrics: ["pim", "pim_per_60"] },
            { fields: ["wgo_pp_toi_pct"], metrics: ["pp_pct"] },
            { fields: ["nst_ixg"], metrics: ["ixg", "ixg_per_60"] },
            { fields: ["nst_icf"], metrics: ["icf", "icf_per_60"] },
            { fields: ["nst_ihdcf"], metrics: ["ihdcf_per_60"] },
            { fields: ["nst_iscfs"], metrics: ["iscf_per_60"] },
            { fields: ["nst_oi_gf"], metrics: ["ipp"] },
            { fields: ["nst_oi_gf", "nst_oi_sf"], metrics: ["oi_sh_pct"] },
            { fields: ["nst_oi_off_zs", "nst_oi_def_zs"], metrics: ["ozs_pct"] },
          ];
          for (const { fields, metrics } of metricCoverage) {
            if (!gamesInInterval.every(game => fields.every(field => typeof game[field] === "number" && Number.isFinite(game[field])))) {
              for (const metric of metrics) (recentStats as any)[`${prefix}${metric}`] = null;
            }
          }
        } else {
          // Set all L* fields for this interval to null
          const metricsToNull = [
            "atoi",
            "pptoi",
            "pp_pct",
            "g",
            "a",
            "pts",
            "pts1_pct",
            "sog",
            "s_pct",
            "ixg",
            "ipp",
            "oi_sh_pct",
            "ozs_pct",
            "icf",
            "ppg",
            "ppa",
            "ppp",
            "hit",
            "blk",
            "pim",
            "g_per_60",
            "a_per_60",
            "pts_per_60",
            "pts1_per_60",
            "sog_per_60",
            "ixg_per_60",
            "icf_per_60",
            "ihdcf_per_60",
            "iscf_per_60",
            "ppg_per_60",
            "ppa_per_60",
            "ppp_per_60",
            "hit_per_60",
            "blk_per_60",
            "pim_per_60"
          ];
          metricsToNull.forEach((metric) => {
            (recentStats as any)[`${prefix}${metric}`] = null; // Use any cast for dynamic assignment
          });
        }
      }
      // --- End L5/L10/L20 Calcs ---

      // Set last updated times
      const nowISO = new Date().toISOString();
      let addCareerData = Object.keys(careerStats).length > 1;
      let addRecentData = Object.keys(recentStats).length > 1;

      if (addCareerData) {
        careerStats.last_updated = nowISO;
        // FIX: Assert type before pushing
        allCareerUpsertData.push(careerStats as WigoCareerData);
      }
      if (addRecentData) {
        recentStats.last_updated = nowISO;
        // FIX: Assert type before pushing
        allRecentUpsertData.push(recentStats as WigoRecentData);
      }

      processedCount++;

      // --- Batch Upsert Logic ---
      if (
        allCareerUpsertData.length >= UPSERT_BATCH_SIZE ||
        allRecentUpsertData.length >= UPSERT_BATCH_SIZE
      ) {
        console.log(
          `Upserting batches (${allCareerUpsertData.length} career, ${allRecentUpsertData.length} recent) | Processed: ${processedCount}/${uniquePlayerIds.length}`
        );
        const upsertPromises = [];
        const currentCareerBatch = [...allCareerUpsertData];
        const currentRecentBatch = [...allRecentUpsertData];
        allCareerUpsertData.length = 0;
        allRecentUpsertData.length = 0;

        if (currentCareerBatch.length > 0) {
          // FIX: Pass correctly typed array to upsert
          upsertPromises.push(
            supabase
              .from("wigo_career")
              .upsert(currentCareerBatch, { onConflict: "player_id" })
          );
        }
        if (currentRecentBatch.length > 0) {
          // FIX: Pass correctly typed array to upsert
          upsertPromises.push(
            supabase
              .from("wigo_recent")
              .upsert(currentRecentBatch, { onConflict: "player_id" })
          );
        }

        if (upsertPromises.length > 0) {
          const results = await Promise.all(upsertPromises);
          results.forEach((result, index) => {
            if (result.error) {
              const tableName =
                index === 0 && currentCareerBatch.length > 0
                  ? "wigo_career"
                  : "wigo_recent";
              console.error(
                `Error upserting ${tableName} batch: ${result.error.message}`
              );
              writeErrors.push(`${tableName}: ${result.error.message}`);
            } else {
              rowsUpserted +=
                index === 0 && currentCareerBatch.length > 0
                  ? currentCareerBatch.length
                  : currentRecentBatch.length;
            }
          });
        }
      }
      // --- End Batch Upsert ---
    } // End player loop

    // --- Final Upsert Logic ---
    if (allCareerUpsertData.length > 0 || allRecentUpsertData.length > 0) {
      console.log(
        `Upserting final batches (${allCareerUpsertData.length} career, ${allRecentUpsertData.length} recent)...`
      );
      const upsertPromises = [];
      const finalCareerBatch = [...allCareerUpsertData];
      const finalRecentBatch = [...allRecentUpsertData];

      if (finalCareerBatch.length > 0) {
        // FIX: Pass correctly typed array to upsert
        upsertPromises.push(
          supabase
            .from("wigo_career")
            .upsert(finalCareerBatch, { onConflict: "player_id" })
        );
      }
      if (finalRecentBatch.length > 0) {
        // FIX: Pass correctly typed array to upsert
        upsertPromises.push(
          supabase
            .from("wigo_recent")
            .upsert(finalRecentBatch, { onConflict: "player_id" })
        );
      }

      if (upsertPromises.length > 0) {
        const results = await Promise.all(upsertPromises);
        results.forEach((result, index) => {
          if (result.error) {
            const tableName =
              index === 0 && finalCareerBatch.length > 0
                ? "wigo_career"
                : "wigo_recent";
            console.error(
              `Error upserting final ${tableName} batch: ${result.error.message}`
            );
            writeErrors.push(`${tableName}: ${result.error.message}`);
          } else {
            const tableName =
              index === 0 && finalCareerBatch.length > 0
                ? "wigo_career"
                : "wigo_recent";
            rowsUpserted +=
              tableName === "wigo_career"
                ? finalCareerBatch.length
                : finalRecentBatch.length;
            console.log(`Final ${tableName} batch upsert successful.`);
          }
        });
      }
    }
    // --- End Final Upsert ---

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Finished player stats update in ${durationSec}s.`);
    // Counts come before the id list so the audit preview keeps them.
    const runCounts = {
      playersListed: uniquePlayerIds.length,
      playersProcessed: processedCount,
      rowsUpserted,
      rejectedCount: rejectedPlayerIds.length
    };
    // A rejected upsert must fail the run; earlier batches may already be written.
    if (writeErrors.length > 0) {
      return res.status(500).json({
        success: false,
        error: `WiGO upsert failed for ${writeErrors.length} batch(es): ${writeErrors.slice(0, 5).join("; ")}`,
        ...runCounts,
        writeErrors,
        rejectedPlayerIds,
        message: `Processed ${processedCount} of ${uniquePlayerIds.length} players; some rows may not have been written.`,
        duration: `${durationSec} s`
      });
    }
    if (firstNotReachedIndex != null) {
      const notReachedCount = uniquePlayerIds.length - firstNotReachedIndex;
      return res.status(207).json({
        success: false,
        error: `Stopped at the ${RUN_BUDGET_MS / 1000} s run budget; ${notReachedCount} player(s) not reached, from id ${uniquePlayerIds[firstNotReachedIndex]}.`,
        ...runCounts,
        notReachedCount,
        firstNotReachedPlayerId: uniquePlayerIds[firstNotReachedIndex],
        rejectedPlayerIds,
        message: `Processed ${processedCount} of ${uniquePlayerIds.length} players before the run budget; rows written so far were flushed.`,
        duration: `${durationSec} s`
      });
    }
    if (rejectedPlayerIds.length > 0) {
      return res.status(207).json({
        success: false,
        error: `Invalid or duplicate regular-season NHL appearance for ${rejectedPlayerIds.length} player(s): ${rejectedPlayerIds.slice(0, 10).join(", ")}.`,
        ...runCounts,
        rejectedPlayerIds,
        message: `Processed ${processedCount} of ${uniquePlayerIds.length} players; rejected players were not written.`,
        duration: `${durationSec} s`
      });
    }
    return res.status(200).json({
      success: true,
      ...runCounts,
      message: `Successfully processed ${processedCount} of ${uniquePlayerIds.length} players.`,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("Critical error during player stats update:", error);
    const dependencyError = normalizeDependencyError(error);
    return res.status(500).json({
      success: false,
      message: dependencyError.message,
      duration: `${durationSec} s`,
      dependencyError
    });
  }
}

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any)));
