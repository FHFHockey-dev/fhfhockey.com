// API endpoint for calculating WIGO statistics
import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase"; // Supabase client instance
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
  | "date"
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
  "date_scraped" | "toi" | "ixg" | "icf" | "iscfs" | "hdcf" // Note: Using hdcf from gamelog
>;
type SelectedNstOiGamelog = Pick<
  NstOiGamelogCounts,
  "date_scraped" | "gf" | "sf" | "off_zone_starts" | "def_zone_starts"
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
  wgo_pp_toi: number | null; // Seconds
  nst_toi_all: number | null; // Minutes
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
async function fetchAllPlayerIds(
  client: SupabaseClient<Database>
): Promise<number[]> {
  console.log(
    "Fetching relevant player IDs from 'players' table with pagination..."
  );
  let allPlayerIds: number[] = [];
  let keepFetching = true;
  let page = 0;
  while (keepFetching) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await client
      .from("players")
      .select("id", { count: "exact", head: false })
      .neq("position", "G")
      .range(from, to);
    if (error) {
      console.error(`Error fetching player IDs page ${page}:`, error.message);
      throw new Error(
        `Error fetching player IDs from players table: ${error.message}`
      );
    }
    if (data && data.length > 0) {
      const playerIdsFromPage = data
        .map((p) => p.id)
        .filter((id): id is number => id != null);
      allPlayerIds = allPlayerIds.concat(playerIdsFromPage);
    }
    const totalCount = count ?? Infinity;
    if (!data || data.length < PAGE_SIZE || allPlayerIds.length >= totalCount) {
      keepFetching = false;
    } else {
      page++;
    }
  }
  const uniqueIds = [...new Set(allPlayerIds)];
  console.log(
    `Workspaceed ${allPlayerIds.length} player ID rows from 'players', found ${uniqueIds.length} unique non-goalie IDs.`
  );
  return uniqueIds;
}
// --- END PAGINATION HELPER ---

// --- Main Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    const uniquePlayerIds = await fetchAllPlayerIds(supabase);
    if (!uniquePlayerIds || uniquePlayerIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No relevant player IDs found from 'players' table."
      });
    }
    console.log(
      `Obtained ${uniquePlayerIds.length} unique player IDs to process.`
    );

    let processedCount = 0;
    // Define batch arrays with non-partial types
    const allCareerUpsertData: WigoCareerData[] = [];
    const allRecentUpsertData: WigoRecentData[] = [];
    const UPSERT_BATCH_SIZE = 200;

    // 3. Process Each Player
    for (const playerId of uniquePlayerIds) {
      // --- Fetch Seasonal Data ---
      const wgoSelect =
        "season, games_played, goals, assists, points, total_primary_assists, shots, pp_goals, pp_assists, pp_points, hits, blocked_shots, penalty_minutes, pp_toi_pct_per_game, pp_toi";
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

      // --- Fetch Game Log Data (Last 20) ---
      const wgoGamelogSelect =
        "date, goals, assists, points, total_primary_assists, shots, pp_goals, pp_assists, pp_points, hits, blocked_shots, penalty_minutes, pp_toi_pct_per_game, pp_toi";
      const nstIndGamelogSelect = "date_scraped, toi, ixg, icf, iscfs, hdcf";
      const nstOiGamelogSelect =
        "date_scraped, gf, sf, off_zone_starts, def_zone_starts";
      const [wgoGamelogRes, nstIndGamelogRes, nstOiGamelogRes] =
        await Promise.all([
          supabase
            .from("wgo_skater_stats")
            .select(wgoGamelogSelect)
            .eq("player_id", playerId)
            .order("date", { ascending: false })
            .limit(20),
          supabase
            .from("nst_gamelog_as_counts")
            .select(nstIndGamelogSelect)
            .eq("player_id", playerId)
            .order("date_scraped", { ascending: false })
            .limit(20),
          supabase
            .from("nst_gamelog_as_counts_oi")
            .select(nstOiGamelogSelect)
            .eq("player_id", playerId)
            .order("date_scraped", { ascending: false })
            .limit(20)
        ]);

      // --- Combine Game Log Data ---
      const combinedGames: CombinedGameData[] = [];
      const wgoLogs = (wgoGamelogRes.data || []) as SelectedWgoGamelog[];
      const nstIndLogs = (nstIndGamelogRes.data ||
        []) as SelectedNstIndGamelog[];
      const nstOiLogs = (nstOiGamelogRes.data || []) as SelectedNstOiGamelog[];
      const nstIndMap = new Map(
        nstIndLogs.map((log) => [log.date_scraped, log])
      );
      const nstOiMap = new Map(nstOiLogs.map((log) => [log.date_scraped, log]));

      for (const wgoGame of wgoLogs) {
        const gameDate = wgoGame.date;
        const nstIndGame = nstIndMap.get(gameDate);
        const nstOiGame = nstOiMap.get(gameDate);
        combinedGames.push({
          date: gameDate,
          wgo_g: wgoGame.goals ?? 0,
          wgo_a: wgoGame.assists ?? 0,
          wgo_pts: wgoGame.points ?? 0,
          wgo_a1: wgoGame.total_primary_assists ?? 0,
          wgo_sog: wgoGame.shots ?? 0,
          wgo_ppg: wgoGame.pp_goals ?? 0,
          wgo_ppa: wgoGame.pp_assists ?? 0,
          wgo_ppp: wgoGame.pp_points ?? 0,
          wgo_hit: wgoGame.hits ?? 0,
          wgo_blk: wgoGame.blocked_shots ?? 0,
          wgo_pim: wgoGame.penalty_minutes ?? 0,
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
      // **** Pass the flag when calling processNstRecord ****
      nstIndCounts.forEach((rec) => processNstRecord(rec, rec.season, true)); // Pass true for individual records
      nstOnIceCounts.forEach((rec) => processNstRecord(rec, rec.season, false)); // Pass false for on-ice records

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
      // [ STD Logic ]
      const stdData = playerSeasons.find((s) => s.season === currentSeasonId);
      if (stdData) {
        const ppToiMinutesStd = safeDivide(stdData.wgo_pp_toi, 60);
        careerStats.std_gp = stdData.gp;
        careerStats.std_atoi = safeDivide(stdData.toi_all, stdData.gp);
        careerStats.std_pptoi = ppToiMinutesStd;
        careerStats.std_pp_pct = stdData.wgo_pp_toi_pct;
        careerStats.std_g = stdData.wgo_g;
        careerStats.std_a = stdData.wgo_a;
        careerStats.std_pts = stdData.wgo_pts;
        careerStats.std_pts1_pct = safeDivide(
          stdData.wgo_g + stdData.wgo_a1,
          stdData.wgo_pts
        );
        careerStats.std_sog = stdData.wgo_sog;
        careerStats.std_s_pct = safeDivide(stdData.wgo_g, stdData.wgo_sog);
        careerStats.std_ixg = stdData.ixg_all;
        careerStats.std_ipp = safeDivide(stdData.wgo_pts, stdData.gf_all);
        careerStats.std_oi_sh_pct = safeDivide(stdData.gf_all, stdData.sf_all);
        careerStats.std_ozs_pct = safeDivide(
          stdData.off_zs_all,
          stdData.off_zs_all + stdData.def_zs_all
        );
        careerStats.std_icf = stdData.icf_all;
        careerStats.std_ppg = stdData.wgo_ppg;
        careerStats.std_ppa = stdData.wgo_ppa;
        careerStats.std_ppp = stdData.wgo_ppp;
        careerStats.std_hit = stdData.wgo_hit;
        careerStats.std_blk = stdData.wgo_blk;
        careerStats.std_pim = stdData.wgo_pim;
        careerStats.std_g_per_60 = calculatePer60(
          stdData.wgo_g,
          stdData.toi_all
        );
        careerStats.std_a_per_60 = calculatePer60(
          stdData.wgo_a,
          stdData.toi_all
        );
        careerStats.std_pts_per_60 = calculatePer60(
          stdData.wgo_pts,
          stdData.toi_all
        );
        careerStats.std_pts1_per_60 = calculatePer60(
          stdData.wgo_g + stdData.wgo_a1,
          stdData.toi_all
        );
        careerStats.std_sog_per_60 = calculatePer60(
          stdData.wgo_sog,
          stdData.toi_all
        );
        careerStats.std_ixg_per_60 = calculatePer60(
          stdData.ixg_all,
          stdData.toi_all
        );
        careerStats.std_icf_per_60 = calculatePer60(
          stdData.icf_all,
          stdData.toi_all
        );
        careerStats.std_ihdcf_per_60 = calculatePer60(
          stdData.ihdcf_all,
          stdData.toi_all
        );
        careerStats.std_iscf_per_60 = calculatePer60(
          stdData.iscfs_all,
          stdData.toi_all
        );
        careerStats.std_ppg_per_60 = calculatePer60FromSeconds(
          stdData.wgo_ppg,
          stdData.wgo_pp_toi
        );
        careerStats.std_ppa_per_60 = calculatePer60FromSeconds(
          stdData.wgo_ppa,
          stdData.wgo_pp_toi
        );
        careerStats.std_ppp_per_60 = calculatePer60FromSeconds(
          stdData.wgo_ppp,
          stdData.wgo_pp_toi
        );
        careerStats.std_hit_per_60 = calculatePer60(
          stdData.wgo_hit,
          stdData.toi_all
        );
        careerStats.std_blk_per_60 = calculatePer60(
          stdData.wgo_blk,
          stdData.toi_all
        );
        careerStats.std_pim_per_60 = calculatePer60(
          stdData.wgo_pim,
          stdData.toi_all
        );
      }
      // [ LY Logic ]
      const lyData = playerSeasons.find((s) => s.season === lastSeasonId);
      if (lyData) {
        const ppToiMinutesLy = safeDivide(lyData.wgo_pp_toi, 60);
        careerStats.ly_gp = lyData.gp;
        careerStats.ly_atoi = safeDivide(lyData.toi_all, lyData.gp);
        careerStats.ly_pptoi = ppToiMinutesLy;
        careerStats.ly_pp_pct = lyData.wgo_pp_toi_pct;
        careerStats.ly_g = lyData.wgo_g;
        careerStats.ly_a = lyData.wgo_a;
        careerStats.ly_pts = lyData.wgo_pts;
        careerStats.ly_pts1_pct = safeDivide(
          lyData.wgo_g + lyData.wgo_a1,
          lyData.wgo_pts
        );
        careerStats.ly_sog = lyData.wgo_sog;
        careerStats.ly_s_pct = safeDivide(lyData.wgo_g, lyData.wgo_sog);
        careerStats.ly_ixg = lyData.ixg_all;
        careerStats.ly_ipp = safeDivide(lyData.wgo_pts, lyData.gf_all);
        careerStats.ly_oi_sh_pct = safeDivide(lyData.gf_all, lyData.sf_all);
        careerStats.ly_ozs_pct = safeDivide(
          lyData.off_zs_all,
          lyData.off_zs_all + lyData.def_zs_all
        );
        careerStats.ly_icf = lyData.icf_all;
        careerStats.ly_ppg = lyData.wgo_ppg;
        careerStats.ly_ppa = lyData.wgo_ppa;
        careerStats.ly_ppp = lyData.wgo_ppp;
        careerStats.ly_hit = lyData.wgo_hit;
        careerStats.ly_blk = lyData.wgo_blk;
        careerStats.ly_pim = lyData.wgo_pim;
        careerStats.ly_g_per_60 = calculatePer60(lyData.wgo_g, lyData.toi_all);
        careerStats.ly_a_per_60 = calculatePer60(lyData.wgo_a, lyData.toi_all);
        careerStats.ly_pts_per_60 = calculatePer60(
          lyData.wgo_pts,
          lyData.toi_all
        );
        careerStats.ly_pts1_per_60 = calculatePer60(
          lyData.wgo_g + lyData.wgo_a1,
          lyData.toi_all
        );
        careerStats.ly_sog_per_60 = calculatePer60(
          lyData.wgo_sog,
          lyData.toi_all
        );
        careerStats.ly_ixg_per_60 = calculatePer60(
          lyData.ixg_all,
          lyData.toi_all
        );
        careerStats.ly_icf_per_60 = calculatePer60(
          lyData.icf_all,
          lyData.toi_all
        );
        careerStats.ly_ihdcf_per_60 = calculatePer60(
          lyData.ihdcf_all,
          lyData.toi_all
        );
        careerStats.ly_iscf_per_60 = calculatePer60(
          lyData.iscfs_all,
          lyData.toi_all
        );
        careerStats.ly_ppg_per_60 = calculatePer60FromSeconds(
          lyData.wgo_ppg,
          lyData.wgo_pp_toi
        );
        careerStats.ly_ppa_per_60 = calculatePer60FromSeconds(
          lyData.wgo_ppa,
          lyData.wgo_pp_toi
        );
        careerStats.ly_ppp_per_60 = calculatePer60FromSeconds(
          lyData.wgo_ppp,
          lyData.wgo_pp_toi
        );
        careerStats.ly_hit_per_60 = calculatePer60(
          lyData.wgo_hit,
          lyData.toi_all
        );
        careerStats.ly_blk_per_60 = calculatePer60(
          lyData.wgo_blk,
          lyData.toi_all
        );
        careerStats.ly_pim_per_60 = calculatePer60(
          lyData.wgo_pim,
          lyData.toi_all
        );
      }
      // [ 3YA Logic ]
      const ya3RelevantSeasons = playerSeasons.filter((s) =>
        ya3Seasons.includes(s.season)
      );
      careerStats.ya3_seasons_used = ya3RelevantSeasons.length;
      if (ya3RelevantSeasons.length > 0) {
        const numSeasons = ya3RelevantSeasons.length;
        const totals = ya3RelevantSeasons.reduce(
          (acc, season) => {
            acc.gp += season.gp;
            acc.toi_all += season.toi_all;
            acc.wgo_pp_toi += season.wgo_pp_toi ?? 0;
            acc.wgo_g += season.wgo_g;
            acc.wgo_a += season.wgo_a;
            acc.wgo_pts += season.wgo_pts;
            acc.wgo_a1 += season.wgo_a1;
            acc.wgo_sog += season.wgo_sog;
            acc.ixg_all += season.ixg_all;
            acc.gf_all += season.gf_all;
            acc.sf_all += season.sf_all;
            acc.off_zs_all += season.off_zs_all;
            acc.def_zs_all += season.def_zs_all;
            acc.icf_all += season.icf_all;
            acc.ihdcf_all += season.ihdcf_all;
            acc.iscfs_all += season.iscfs_all;
            acc.wgo_ppg += season.wgo_ppg;
            acc.wgo_ppa += season.wgo_ppa;
            acc.wgo_ppp += season.wgo_ppp;
            acc.wgo_hit += season.wgo_hit;
            acc.wgo_blk += season.wgo_blk;
            acc.wgo_pim += season.wgo_pim;
            if (season.wgo_pp_toi_pct != null) {
              acc.pp_toi_pct_values.push(season.wgo_pp_toi_pct);
            }
            return acc;
          },
          {
            gp: 0,
            toi_all: 0,
            wgo_pp_toi: 0,
            wgo_g: 0,
            wgo_a: 0,
            wgo_pts: 0,
            wgo_a1: 0,
            wgo_sog: 0,
            ixg_all: 0,
            gf_all: 0,
            sf_all: 0,
            off_zs_all: 0,
            def_zs_all: 0,
            icf_all: 0,
            ihdcf_all: 0,
            iscfs_all: 0,
            wgo_ppg: 0,
            wgo_ppa: 0,
            wgo_ppp: 0,
            wgo_hit: 0,
            wgo_blk: 0,
            wgo_pim: 0,
            pp_toi_pct_values: [] as number[]
          }
        );
        const totalPpToiMinutesYa3 = safeDivide(totals.wgo_pp_toi, 60);
        careerStats.ya3_gp = safeDivide(totals.gp, numSeasons);
        careerStats.ya3_atoi = safeDivide(totals.toi_all, totals.gp);
        careerStats.ya3_pptoi = safeDivide(totalPpToiMinutesYa3, numSeasons);
        careerStats.ya3_pp_pct = safeAverage(totals.pp_toi_pct_values);
        careerStats.ya3_g = safeDivide(totals.wgo_g, numSeasons);
        careerStats.ya3_a = safeDivide(totals.wgo_a, numSeasons);
        careerStats.ya3_pts = safeDivide(totals.wgo_pts, numSeasons);
        careerStats.ya3_pts1_pct = safeDivide(
          totals.wgo_g + totals.wgo_a1,
          totals.wgo_pts
        );
        careerStats.ya3_sog = safeDivide(totals.wgo_sog, numSeasons);
        careerStats.ya3_s_pct = safeDivide(totals.wgo_g, totals.wgo_sog);
        careerStats.ya3_ixg = safeDivide(totals.ixg_all, numSeasons);
        careerStats.ya3_ipp = safeDivide(totals.wgo_pts, totals.gf_all);
        careerStats.ya3_oi_sh_pct = safeDivide(totals.gf_all, totals.sf_all);
        careerStats.ya3_ozs_pct = safeDivide(
          totals.off_zs_all,
          totals.off_zs_all + totals.def_zs_all
        );
        careerStats.ya3_icf = safeDivide(totals.icf_all, numSeasons);
        careerStats.ya3_ppg = safeDivide(totals.wgo_ppg, numSeasons);
        careerStats.ya3_ppa = safeDivide(totals.wgo_ppa, numSeasons);
        careerStats.ya3_ppp = safeDivide(totals.wgo_ppp, numSeasons);
        careerStats.ya3_hit = safeDivide(totals.wgo_hit, numSeasons);
        careerStats.ya3_blk = safeDivide(totals.wgo_blk, numSeasons);
        careerStats.ya3_pim = safeDivide(totals.wgo_pim, numSeasons);
        careerStats.ya3_g_per_60 = calculatePer60(totals.wgo_g, totals.toi_all);
        careerStats.ya3_a_per_60 = calculatePer60(totals.wgo_a, totals.toi_all);
        careerStats.ya3_pts_per_60 = calculatePer60(
          totals.wgo_pts,
          totals.toi_all
        );
        careerStats.ya3_pts1_per_60 = calculatePer60(
          totals.wgo_g + totals.wgo_a1,
          totals.toi_all
        );
        careerStats.ya3_sog_per_60 = calculatePer60(
          totals.wgo_sog,
          totals.toi_all
        );
        careerStats.ya3_ixg_per_60 = calculatePer60(
          totals.ixg_all,
          totals.toi_all
        );
        careerStats.ya3_icf_per_60 = calculatePer60(
          totals.icf_all,
          totals.toi_all
        );
        careerStats.ya3_ihdcf_per_60 = calculatePer60(
          totals.ihdcf_all,
          totals.toi_all
        );
        careerStats.ya3_iscf_per_60 = calculatePer60(
          totals.iscfs_all,
          totals.toi_all
        );
        careerStats.ya3_ppg_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppg,
          totals.wgo_pp_toi
        );
        careerStats.ya3_ppa_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppa,
          totals.wgo_pp_toi
        );
        careerStats.ya3_ppp_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppp,
          totals.wgo_pp_toi
        );
        careerStats.ya3_hit_per_60 = calculatePer60(
          totals.wgo_hit,
          totals.toi_all
        );
        careerStats.ya3_blk_per_60 = calculatePer60(
          totals.wgo_blk,
          totals.toi_all
        );
        careerStats.ya3_pim_per_60 = calculatePer60(
          totals.wgo_pim,
          totals.toi_all
        );
      }
      // [ CA Logic ]
      const caRelevantSeasons = playerSeasons.filter(
        (s) => s.season !== currentSeasonId
      );
      careerStats.ca_seasons_used = caRelevantSeasons.length;
      if (caRelevantSeasons.length > 0) {
        const numSeasons = caRelevantSeasons.length;
        const totals = caRelevantSeasons.reduce(
          (acc, season) => {
            acc.gp += season.gp;
            acc.toi_all += season.toi_all;
            acc.wgo_pp_toi += season.wgo_pp_toi ?? 0;
            acc.wgo_g += season.wgo_g;
            acc.wgo_a += season.wgo_a;
            acc.wgo_pts += season.wgo_pts;
            acc.wgo_a1 += season.wgo_a1;
            acc.wgo_sog += season.wgo_sog;
            acc.ixg_all += season.ixg_all;
            acc.gf_all += season.gf_all;
            acc.sf_all += season.sf_all;
            acc.off_zs_all += season.off_zs_all;
            acc.def_zs_all += season.def_zs_all;
            acc.icf_all += season.icf_all;
            acc.ihdcf_all += season.ihdcf_all;
            acc.iscfs_all += season.iscfs_all;
            acc.wgo_ppg += season.wgo_ppg;
            acc.wgo_ppa += season.wgo_ppa;
            acc.wgo_ppp += season.wgo_ppp;
            acc.wgo_hit += season.wgo_hit;
            acc.wgo_blk += season.wgo_blk;
            acc.wgo_pim += season.wgo_pim;
            if (season.wgo_pp_toi_pct != null) {
              acc.pp_toi_pct_values.push(season.wgo_pp_toi_pct);
            }
            return acc;
          },
          {
            gp: 0,
            toi_all: 0,
            wgo_pp_toi: 0,
            wgo_g: 0,
            wgo_a: 0,
            wgo_pts: 0,
            wgo_a1: 0,
            wgo_sog: 0,
            ixg_all: 0,
            gf_all: 0,
            sf_all: 0,
            off_zs_all: 0,
            def_zs_all: 0,
            icf_all: 0,
            ihdcf_all: 0,
            iscfs_all: 0,
            wgo_ppg: 0,
            wgo_ppa: 0,
            wgo_ppp: 0,
            wgo_hit: 0,
            wgo_blk: 0,
            wgo_pim: 0,
            pp_toi_pct_values: [] as number[]
          }
        );
        const totalPpToiMinutesCa = safeDivide(totals.wgo_pp_toi, 60);
        careerStats.ca_gp = safeDivide(totals.gp, numSeasons);
        careerStats.ca_atoi = safeDivide(totals.toi_all, totals.gp);
        careerStats.ca_pptoi = safeDivide(totalPpToiMinutesCa, numSeasons);
        careerStats.ca_pp_pct = safeAverage(totals.pp_toi_pct_values);
        careerStats.ca_g = safeDivide(totals.wgo_g, numSeasons);
        careerStats.ca_a = safeDivide(totals.wgo_a, numSeasons);
        careerStats.ca_pts = safeDivide(totals.wgo_pts, numSeasons);
        careerStats.ca_pts1_pct = safeDivide(
          totals.wgo_g + totals.wgo_a1,
          totals.wgo_pts
        );
        careerStats.ca_sog = safeDivide(totals.wgo_sog, numSeasons);
        careerStats.ca_s_pct = safeDivide(totals.wgo_g, totals.wgo_sog);
        careerStats.ca_ixg = safeDivide(totals.ixg_all, numSeasons);
        careerStats.ca_ipp = safeDivide(totals.wgo_pts, totals.gf_all);
        careerStats.ca_oi_sh_pct = safeDivide(totals.gf_all, totals.sf_all);
        careerStats.ca_ozs_pct = safeDivide(
          totals.off_zs_all,
          totals.off_zs_all + totals.def_zs_all
        );
        careerStats.ca_icf = safeDivide(totals.icf_all, numSeasons);
        careerStats.ca_ppg = safeDivide(totals.wgo_ppg, numSeasons);
        careerStats.ca_ppa = safeDivide(totals.wgo_ppa, numSeasons);
        careerStats.ca_ppp = safeDivide(totals.wgo_ppp, numSeasons);
        careerStats.ca_hit = safeDivide(totals.wgo_hit, numSeasons);
        careerStats.ca_blk = safeDivide(totals.wgo_blk, numSeasons);
        careerStats.ca_pim = safeDivide(totals.wgo_pim, numSeasons);
        careerStats.ca_g_per_60 = calculatePer60(totals.wgo_g, totals.toi_all);
        careerStats.ca_a_per_60 = calculatePer60(totals.wgo_a, totals.toi_all);
        careerStats.ca_pts_per_60 = calculatePer60(
          totals.wgo_pts,
          totals.toi_all
        );
        careerStats.ca_pts1_per_60 = calculatePer60(
          totals.wgo_g + totals.wgo_a1,
          totals.toi_all
        );
        careerStats.ca_sog_per_60 = calculatePer60(
          totals.wgo_sog,
          totals.toi_all
        );
        careerStats.ca_ixg_per_60 = calculatePer60(
          totals.ixg_all,
          totals.toi_all
        );
        careerStats.ca_icf_per_60 = calculatePer60(
          totals.icf_all,
          totals.toi_all
        );
        careerStats.ca_ihdcf_per_60 = calculatePer60(
          totals.ihdcf_all,
          totals.toi_all
        );
        careerStats.ca_iscf_per_60 = calculatePer60(
          totals.iscfs_all,
          totals.toi_all
        );
        careerStats.ca_ppg_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppg,
          totals.wgo_pp_toi
        );
        careerStats.ca_ppa_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppa,
          totals.wgo_pp_toi
        );
        careerStats.ca_ppp_per_60 = calculatePer60FromSeconds(
          totals.wgo_ppp,
          totals.wgo_pp_toi
        );
        careerStats.ca_hit_per_60 = calculatePer60(
          totals.wgo_hit,
          totals.toi_all
        );
        careerStats.ca_blk_per_60 = calculatePer60(
          totals.wgo_blk,
          totals.toi_all
        );
        careerStats.ca_pim_per_60 = calculatePer60(
          totals.wgo_pim,
          totals.toi_all
        );
      }
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
          const totals = gamesInInterval.reduce(
            (acc, game) => {
              // nst_toi_all is already per game in minutes
              acc.nst_toi_all += game.nst_toi_all ?? 0;
              acc.gp += 1;
              acc.wgo_g += game.wgo_g;
              acc.wgo_a += game.wgo_a;
              acc.wgo_pts += game.wgo_pts;
              acc.wgo_a1 += game.wgo_a1;
              acc.wgo_sog += game.wgo_sog;
              acc.wgo_ppg += game.wgo_ppg;
              acc.wgo_ppa += game.wgo_ppa;
              acc.wgo_ppp += game.wgo_ppp;
              acc.wgo_hit += game.wgo_hit;
              acc.wgo_blk += game.wgo_blk;
              acc.wgo_pim += game.wgo_pim;
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
          (recentStats as any)[`${prefix}g_per_60`] = calculatePer60(
            totals.wgo_g,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}a_per_60`] = calculatePer60(
            totals.wgo_a,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pts_per_60`] = calculatePer60(
            totals.wgo_pts,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pts1_per_60`] = calculatePer60(
            totals.wgo_g + totals.wgo_a1,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}sog_per_60`] = calculatePer60(
            totals.wgo_sog,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ixg_per_60`] = calculatePer60(
            totals.nst_ixg,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}icf_per_60`] = calculatePer60(
            totals.nst_icf,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ihdcf_per_60`] = calculatePer60(
            totals.nst_ihdcf,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}iscf_per_60`] = calculatePer60(
            totals.nst_iscfs,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}ppg_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppg, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}ppa_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppa, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}ppp_per_60`] =
            calculatePer60FromSeconds(totals.wgo_ppp, totals.wgo_pp_toi);
          (recentStats as any)[`${prefix}hit_per_60`] = calculatePer60(
            totals.wgo_hit,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}blk_per_60`] = calculatePer60(
            totals.wgo_blk,
            totals.nst_toi_all
          );
          (recentStats as any)[`${prefix}pim_per_60`] = calculatePer60(
            totals.wgo_pim,
            totals.nst_toi_all
          );
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
          } else {
            const tableName =
              index === 0 && finalCareerBatch.length > 0
                ? "wigo_career"
                : "wigo_recent";
            console.log(`Final ${tableName} batch upsert successful.`);
          }
        });
      }
    }
    // --- End Final Upsert ---

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Finished player stats update in ${durationSec}s.`);
    return res.status(200).json({
      success: true,
      message: `Successfully processed ${processedCount} of ${uniquePlayerIds.length} players.`,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("Critical error during player stats update:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An unknown critical error occurred",
      duration: `${durationSec} s`
    });
  }
}
