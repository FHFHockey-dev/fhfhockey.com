// pages/api/v1/db/calculate-player-averages.ts

import { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase"; // Adjust path as needed
import { PostgrestError } from "@supabase/supabase-js"; // Import for type safety
import { Database } from "lib/supabase/database-generated.types";

type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// Helper function for safe division, returns null if denominator is zero
const safeDivide = (
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null => {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator === 0
  ) {
    return null;
  }
  return numerator / denominator;
};

// Helper function to safely sum, treating null/undefined as 0
const safeSum = (...values: (number | null | undefined)[]): number => {
  return values.reduce<number>((acc, val) => acc + (val ?? 0), 0);
};

// --- Define Base Field Names (non-prefixed) ---
type BaseFieldName =
  | "gp"
  | "toi"
  | "goals"
  | "total_assists"
  | "first_assists"
  | "second_assists"
  | "total_points"
  | "shots"
  | "ixg"
  | "icf"
  | "iff"
  | "iscfs"
  | "ihdcf"
  | "rebounds_created"
  | "pim"
  | "total_penalties"
  | "minor_penalties"
  | "major_penalties"
  | "misconduct_penalties"
  | "penalties_drawn"
  | "giveaways"
  | "takeaways"
  | "hits"
  | "hits_taken"
  | "shots_blocked"
  | "faceoffs_won"
  | "faceoffs_lost"
  | "cf"
  | "ca"
  | "ff"
  | "fa"
  | "sf"
  | "sa"
  | "gf"
  | "ga"
  | "xgf"
  | "xga"
  | "scf"
  | "sca"
  | "hdcf"
  | "hdca"
  | "hdgf"
  | "hdga"
  | "mdcf"
  | "mdca"
  | "mdgf"
  | "mdga"
  | "ldcf"
  | "ldca"
  | "ldgf"
  | "ldga"
  | "off_zone_starts"
  | "neu_zone_starts"
  | "def_zone_starts"
  | "on_the_fly_starts"
  | "off_zone_faceoffs"
  | "neu_zone_faceoffs"
  | "def_zone_faceoffs";

// Interface for aggregated data storage during processing
interface AggregatedCounts {
  seasons: Set<number>;
  teamSeasonGp: { season: number; team: string; gp: number }[];
  career_gp: number;
  three_year_gp: number;
  career_toi: number;
  three_year_toi: number;
  career_goals: number;
  three_year_goals: number;
  career_total_assists: number;
  three_year_total_assists: number;
  career_first_assists: number;
  three_year_first_assists: number;
  career_second_assists: number;
  three_year_second_assists: number;
  career_total_points: number;
  three_year_total_points: number;
  career_shots: number;
  three_year_shots: number;
  career_ixg: number;
  three_year_ixg: number;
  career_icf: number;
  three_year_icf: number;
  career_iff: number;
  three_year_iff: number;
  career_iscfs: number;
  three_year_iscfs: number;
  career_ihdcf: number;
  three_year_ihdcf: number;
  career_rebounds_created: number;
  three_year_rebounds_created: number;
  career_pim: number;
  three_year_pim: number;
  career_total_penalties: number;
  three_year_total_penalties: number;
  career_minor_penalties: number;
  three_year_minor_penalties: number;
  career_major_penalties: number;
  three_year_major_penalties: number;
  career_misconduct_penalties: number;
  three_year_misconduct_penalties: number;
  career_penalties_drawn: number;
  three_year_penalties_drawn: number;
  career_giveaways: number;
  three_year_giveaways: number;
  career_takeaways: number;
  three_year_takeaways: number;
  career_hits: number;
  three_year_hits: number;
  career_hits_taken: number;
  three_year_hits_taken: number;
  career_shots_blocked: number;
  three_year_shots_blocked: number;
  career_faceoffs_won: number;
  three_year_faceoffs_won: number;
  career_faceoffs_lost: number;
  three_year_faceoffs_lost: number;
  career_cf: number;
  three_year_cf: number;
  career_ca: number;
  three_year_ca: number;
  career_ff: number;
  three_year_ff: number;
  career_fa: number;
  three_year_fa: number;
  career_sf: number;
  three_year_sf: number;
  career_sa: number;
  three_year_sa: number;
  career_gf: number;
  three_year_gf: number;
  career_ga: number;
  three_year_ga: number;
  career_xgf: number;
  three_year_xgf: number;
  career_xga: number;
  three_year_xga: number;
  career_scf: number;
  three_year_scf: number;
  career_sca: number;
  three_year_sca: number;
  career_hdcf: number;
  three_year_hdcf: number;
  career_hdca: number;
  three_year_hdca: number;
  career_hdgf: number;
  three_year_hdgf: number;
  career_hdga: number;
  three_year_hdga: number;
  career_mdcf: number;
  three_year_mdcf: number;
  career_mdca: number;
  three_year_mdca: number;
  career_mdgf: number;
  three_year_mdgf: number;
  career_mdga: number;
  three_year_mdga: number;
  career_ldcf: number;
  three_year_ldcf: number;
  career_ldca: number;
  three_year_ldca: number;
  career_ldgf: number;
  three_year_ldgf: number;
  career_ldga: number;
  three_year_ldga: number;
  career_off_zone_starts: number;
  three_year_off_zone_starts: number;
  career_neu_zone_starts: number;
  three_year_neu_zone_starts: number;
  career_def_zone_starts: number;
  three_year_def_zone_starts: number;
  career_on_the_fly_starts: number;
  three_year_on_the_fly_starts: number;
  career_off_zone_faceoffs: number;
  three_year_off_zone_faceoffs: number;
  career_neu_zone_faceoffs: number;
  three_year_neu_zone_faceoffs: number;
  career_def_zone_faceoffs: number;
  three_year_def_zone_faceoffs: number;
}

// --- Define the FINAL output structure explicitly ---
interface CalculatedAverages {
  player_id: number;
  strength: string;
  num_seasons: number;
  updated_at: string;
  total_gp: number;
  total_toi: number;
  total_goals: number;
  total_total_assists: number;
  total_first_assists: number;
  total_second_assists: number;
  total_total_points: number;
  total_shots: number;
  total_ixg: number;
  total_icf: number;
  total_iff: number;
  total_iscfs: number;
  total_ihdcf: number;
  total_rebounds_created: number;
  total_pim: number;
  total_total_penalties: number;
  total_minor_penalties: number;
  total_major_penalties: number;
  total_misconduct_penalties: number;
  total_penalties_drawn: number;
  total_giveaways: number;
  total_takeaways: number;
  total_hits: number;
  total_hits_taken: number;
  total_shots_blocked: number;
  total_faceoffs_won: number;
  total_faceoffs_lost: number;
  total_cf: number;
  total_ca: number;
  total_ff: number;
  total_fa: number;
  total_sf: number;
  total_sa: number;
  total_gf: number;
  total_ga: number;
  total_xgf: number;
  total_xga: number;
  total_scf: number;
  total_sca: number;
  total_hdcf: number;
  total_hdca: number;
  total_hdgf: number;
  total_hdga: number;
  total_mdcf: number;
  total_mdca: number;
  total_mdgf: number;
  total_mdga: number;
  total_ldcf: number;
  total_ldca: number;
  total_ldgf: number;
  total_ldga: number;
  total_off_zone_starts: number;
  total_neu_zone_starts: number;
  total_def_zone_starts: number;
  total_on_the_fly_starts: number;
  total_off_zone_faceoffs: number;
  total_neu_zone_faceoffs: number;
  total_def_zone_faceoffs: number;
  avg_toi_per_gp: number | null;
  goals_per_60: number | null;
  total_assists_per_60: number | null;
  first_assists_per_60: number | null;
  second_assists_per_60: number | null;
  total_points_per_60: number | null;
  shots_per_60: number | null;
  ixg_per_60: number | null;
  icf_per_60: number | null;
  iff_per_60: number | null;
  iscfs_per_60: number | null;
  ihdcf_per_60: number | null;
  rebounds_created_per_60: number | null;
  pim_per_60: number | null;
  total_penalties_per_60: number | null;
  minor_penalties_per_60: number | null;
  major_penalties_per_60: number | null;
  misconduct_penalties_per_60: number | null;
  penalties_drawn_per_60: number | null;
  giveaways_per_60: number | null;
  takeaways_per_60: number | null;
  hits_per_60: number | null;
  hits_taken_per_60: number | null;
  shots_blocked_per_60: number | null;
  faceoffs_won_per_60: number | null;
  faceoffs_lost_per_60: number | null;
  sh_percentage: number | null;
  ipp: number | null;
  faceoffs_percentage: number | null;
  cf_per_60: number | null;
  ca_per_60: number | null;
  ff_per_60: number | null;
  fa_per_60: number | null;
  sf_per_60: number | null;
  sa_per_60: number | null;
  gf_per_60: number | null;
  ga_per_60: number | null;
  xgf_per_60: number | null;
  xga_per_60: number | null;
  scf_per_60: number | null;
  sca_per_60: number | null;
  hdcf_per_60: number | null;
  hdca_per_60: number | null;
  hdgf_per_60: number | null;
  hdga_per_60: number | null;
  mdcf_per_60: number | null;
  mdca_per_60: number | null;
  mdgf_per_60: number | null;
  mdga_per_60: number | null;
  ldcf_per_60: number | null;
  ldca_per_60: number | null;
  ldgf_per_60: number | null;
  ldga_per_60: number | null;
  off_zone_starts_per_60: number | null;
  neu_zone_starts_per_60: number | null;
  def_zone_starts_per_60: number | null;
  on_the_fly_starts_per_60: number | null;
  off_zone_faceoffs_per_60: number | null;
  neu_zone_faceoffs_per_60: number | null;
  def_zone_faceoffs_per_60: number | null;
  cf_pct: number | null;
  ff_pct: number | null;
  sf_pct: number | null;
  gf_pct: number | null;
  xgf_pct: number | null;
  scf_pct: number | null;
  hdcf_pct: number | null;
  hdgf_pct: number | null;
  mdcf_pct: number | null;
  mdgf_pct: number | null;
  ldcf_pct: number | null;
  ldgf_pct: number | null;
  on_ice_sh_pct: number | null;
  on_ice_sv_pct: number | null;
  pdo: number | null;
  off_zone_start_pct: number | null;
  off_zone_faceoff_pct: number | null;
  total_possible_gp: number | null;
  gp_percentage: number | null;
}

type CalculatedMetricsSubset = Omit<
  CalculatedAverages,
  "player_id" | "strength" | "updated_at"
> | null;

// --- *** NEW: Pagination Helper *** ---
const fetchAllPages = async <
  TableName extends keyof Database["public"]["Tables"]
>(
  tableName: TableName
): Promise<Database["public"]["Tables"][TableName]["Row"][]> => {
  const PAGE_SIZE = 1000; // Supabase default limit
  let allData: Database["public"]["Tables"][TableName]["Row"][] = []; // Use specific Row type
  let page = 0;
  let keepFetching = true;

  console.log(`Fetching all data from ${tableName}...`);

  while (keepFetching) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // No explicit : PostgrestResponse<T> needed, let TS infer from the specific table call
    // Pass the specific TableName literal to .from()
    const { data, error, count } = await supabase
      .from(tableName) // Use the specific TableName literal
      .select("*", { count: "exact" })
      .range(from, to);

    // Type checking for error
    const postgrestError = error as PostgrestError | null;
    if (postgrestError) {
      console.error(
        `Error fetching page ${page} from ${tableName}:`,
        postgrestError
      );
      throw new Error(
        `Failed to fetch data from ${tableName}: ${postgrestError.message}`
      );
    }

    const pageData = data as
      | Database["public"]["Tables"][TableName]["Row"][]
      | null; // Cast data

    if (pageData) {
      allData = allData.concat(pageData);
      console.log(
        `  Fetched ${pageData.length} rows from ${tableName} (Page ${
          page + 1
        }, Total: ${allData.length}${count ? `/${count}` : ""})`
      );
      if (pageData.length < PAGE_SIZE) {
        keepFetching = false; // Last page fetched
      } else {
        page++;
      }
    } else {
      keepFetching = false; // No data returned or error occurred (already handled)
    }
  }
  console.log(
    `Finished fetching ${allData.length} total rows from ${tableName}.`
  );
  return allData;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  console.log("Starting player average calculation...");

  const BATCH_SIZE = 500; // Upsert batch size
  const aggregationMap = new Map<string, AggregatedCounts>();

  // --- Define processRow function ---
  const processRow = (row: any, isThreeYear: boolean, isCareer: boolean) => {
    const key = `${row.player_id}-${row.strength}`;
    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        seasons: new Set(),
        teamSeasonGp: [],
        career_gp: 0,
        three_year_gp: 0,
        career_toi: 0,
        three_year_toi: 0,
        career_goals: 0,
        three_year_goals: 0,
        career_total_assists: 0,
        three_year_total_assists: 0,
        career_first_assists: 0,
        three_year_first_assists: 0,
        career_second_assists: 0,
        three_year_second_assists: 0,
        career_total_points: 0,
        three_year_total_points: 0,
        career_shots: 0,
        three_year_shots: 0,
        career_ixg: 0,
        three_year_ixg: 0,
        career_icf: 0,
        three_year_icf: 0,
        career_iff: 0,
        three_year_iff: 0,
        career_iscfs: 0,
        three_year_iscfs: 0,
        career_ihdcf: 0,
        three_year_ihdcf: 0,
        career_rebounds_created: 0,
        three_year_rebounds_created: 0,
        career_pim: 0,
        three_year_pim: 0,
        career_total_penalties: 0,
        three_year_total_penalties: 0,
        career_minor_penalties: 0,
        three_year_minor_penalties: 0,
        career_major_penalties: 0,
        three_year_major_penalties: 0,
        career_misconduct_penalties: 0,
        three_year_misconduct_penalties: 0,
        career_penalties_drawn: 0,
        three_year_penalties_drawn: 0,
        career_giveaways: 0,
        three_year_giveaways: 0,
        career_takeaways: 0,
        three_year_takeaways: 0,
        career_hits: 0,
        three_year_hits: 0,
        career_hits_taken: 0,
        three_year_hits_taken: 0,
        career_shots_blocked: 0,
        three_year_shots_blocked: 0,
        career_faceoffs_won: 0,
        three_year_faceoffs_won: 0,
        career_faceoffs_lost: 0,
        three_year_faceoffs_lost: 0,
        career_cf: 0,
        three_year_cf: 0,
        career_ca: 0,
        three_year_ca: 0,
        career_ff: 0,
        three_year_ff: 0,
        career_fa: 0,
        three_year_fa: 0,
        career_sf: 0,
        three_year_sf: 0,
        career_sa: 0,
        three_year_sa: 0,
        career_gf: 0,
        three_year_gf: 0,
        career_ga: 0,
        three_year_ga: 0,
        career_xgf: 0,
        three_year_xgf: 0,
        career_xga: 0,
        three_year_xga: 0,
        career_scf: 0,
        three_year_scf: 0,
        career_sca: 0,
        three_year_sca: 0,
        career_hdcf: 0,
        three_year_hdcf: 0,
        career_hdca: 0,
        three_year_hdca: 0,
        career_hdgf: 0,
        three_year_hdgf: 0,
        career_hdga: 0,
        three_year_hdga: 0,
        career_mdcf: 0,
        three_year_mdcf: 0,
        career_mdca: 0,
        three_year_mdca: 0,
        career_mdgf: 0,
        three_year_mdgf: 0,
        career_mdga: 0,
        three_year_mdga: 0,
        career_ldcf: 0,
        three_year_ldcf: 0,
        career_ldca: 0,
        three_year_ldca: 0,
        career_ldgf: 0,
        three_year_ldgf: 0,
        career_ldga: 0,
        three_year_ldga: 0,
        career_off_zone_starts: 0,
        three_year_off_zone_starts: 0,
        career_neu_zone_starts: 0,
        three_year_neu_zone_starts: 0,
        career_def_zone_starts: 0,
        three_year_def_zone_starts: 0,
        career_on_the_fly_starts: 0,
        three_year_on_the_fly_starts: 0,
        career_off_zone_faceoffs: 0,
        three_year_off_zone_faceoffs: 0,
        career_neu_zone_faceoffs: 0,
        three_year_neu_zone_faceoffs: 0,
        career_def_zone_faceoffs: 0,
        three_year_def_zone_faceoffs: 0
      });
    }
    const currentAgg = aggregationMap.get(key)!;
    currentAgg.seasons.add(row.season);
    if (
      row.gp !== undefined &&
      !currentAgg.teamSeasonGp.some((item) => item.season === row.season)
    ) {
      currentAgg.teamSeasonGp.push({
        season: row.season,
        team: row.team,
        gp: row.gp ?? 0
      });
    }
    const sumIfExists = (
      field: BaseFieldName,
      sourceField: keyof typeof row
    ) => {
      const value = row[sourceField];
      if (value !== null && value !== undefined) {
        const careerFieldName = `career_${field}` as keyof AggregatedCounts;
        const threeYearFieldName =
          `three_year_${field}` as keyof AggregatedCounts;
        if (isCareer && careerFieldName in currentAgg) {
          (currentAgg as any)[careerFieldName] = safeSum(
            (currentAgg as any)[careerFieldName],
            value
          );
        }
        if (isThreeYear && threeYearFieldName in currentAgg) {
          (currentAgg as any)[threeYearFieldName] = safeSum(
            (currentAgg as any)[threeYearFieldName],
            value
          );
        }
      }
    };
    sumIfExists("gp", "gp");
    sumIfExists("toi", "toi");
    sumIfExists("goals", "goals");
    sumIfExists("total_assists", "total_assists");
    sumIfExists("first_assists", "first_assists");
    sumIfExists("second_assists", "second_assists");
    sumIfExists("total_points", "total_points");
    sumIfExists("shots", "shots");
    sumIfExists("ixg", "ixg");
    sumIfExists("icf", "icf");
    sumIfExists("iff", "iff");
    sumIfExists("iscfs", "iscfs");
    sumIfExists("ihdcf", "ihdcf");
    sumIfExists("rebounds_created", "rebounds_created");
    sumIfExists("pim", "pim");
    sumIfExists("total_penalties", "total_penalties");
    sumIfExists("minor_penalties", "minor_penalties");
    sumIfExists("major_penalties", "major_penalties");
    sumIfExists("misconduct_penalties", "misconduct_penalties");
    sumIfExists("penalties_drawn", "penalties_drawn");
    sumIfExists("giveaways", "giveaways");
    sumIfExists("takeaways", "takeaways");
    sumIfExists("hits", "hits");
    sumIfExists("hits_taken", "hits_taken");
    sumIfExists("shots_blocked", "shots_blocked");
    sumIfExists("faceoffs_won", "faceoffs_won");
    sumIfExists("faceoffs_lost", "faceoffs_lost");
    sumIfExists("cf", "cf");
    sumIfExists("ca", "ca");
    sumIfExists("ff", "ff");
    sumIfExists("fa", "fa");
    sumIfExists("sf", "sf");
    sumIfExists("sa", "sa");
    sumIfExists("gf", "gf");
    sumIfExists("ga", "ga");
    sumIfExists("xgf", "xgf");
    sumIfExists("xga", "xga");
    sumIfExists("scf", "scf");
    sumIfExists("sca", "sca");
    sumIfExists("hdcf", "hdcf");
    sumIfExists("hdca", "hdca");
    sumIfExists("hdgf", "hdgf");
    sumIfExists("hdga", "hdga");
    sumIfExists("mdcf", "mdcf");
    sumIfExists("mdca", "mdca");
    sumIfExists("mdgf", "mdgf");
    sumIfExists("mdga", "mdga");
    sumIfExists("ldcf", "ldcf");
    sumIfExists("ldca", "ldca");
    sumIfExists("ldgf", "ldgf");
    sumIfExists("ldga", "ldga");
    sumIfExists("off_zone_starts", "off_zone_starts");
    sumIfExists("neu_zone_starts", "neu_zone_starts");
    sumIfExists("def_zone_starts", "def_zone_starts");
    sumIfExists("on_the_fly_starts", "on_the_fly_starts");
    sumIfExists("off_zone_faceoffs", "off_zone_faceoffs");
    sumIfExists("neu_zone_faceoffs", "neu_zone_faceoffs");
    sumIfExists("def_zone_faceoffs", "def_zone_faceoffs");
  };

  // --- Define calculateMetrics Function ---
  const calculateMetrics = (
    agg: AggregatedCounts,
    period: "career" | "three_year",
    relevantSeasons: Set<number>,
    teamAbbrToNameMap: Map<string | null, string>,
    teamSeasonGpMap: Map<number, Map<string, number>>
  ): CalculatedMetricsSubset => {
    const prefix = period === "career" ? "career_" : "three_year_";
    const gp = (agg as any)[prefix + "gp"];
    const toi = (agg as any)[prefix + "toi"];
    if (!toi || toi <= 0) return null;
    const contributingSeasons = agg.teamSeasonGp.filter((tsg) =>
      relevantSeasons.has(tsg.season)
    );
    const num_seasons = new Set(contributingSeasons.map((tsg) => tsg.season))
      .size;
    if (num_seasons === 0) return null;
    let total_possible_gp = 0;
    const countedTeamSeasons = new Set<string>();
    contributingSeasons.forEach((tsg) => {
      const teamFullName = teamAbbrToNameMap.get(tsg.team);
      const teamSeasonKey = `${tsg.season}-${teamFullName}`;
      if (teamFullName && !countedTeamSeasons.has(teamSeasonKey)) {
        const possibleGp = teamSeasonGpMap.get(tsg.season)?.get(teamFullName);
        if (possibleGp !== undefined) {
          total_possible_gp += possibleGp;
          countedTeamSeasons.add(teamSeasonKey);
        } else {
          console.warn(
            `Missing team_summary_years GP for: ${teamFullName} in season ${tsg.season}`
          );
        }
      } else if (!teamFullName) {
        console.warn(
          `Could not find full team name for abbreviation: ${tsg.team} in teamsinfo`
        );
      }
    });
    const val = (field: BaseFieldName): number =>
      (agg as any)[prefix + field] ?? 0;
    const total_goals = val("goals");
    const total_shots = val("shots");
    const total_total_points = val("total_points");
    const total_total_assists = val("total_assists");
    const total_first_assists = val("first_assists");
    const total_second_assists = val("second_assists");
    const total_ixg = val("ixg");
    const total_icf = val("icf");
    const total_iff = val("iff");
    const total_iscfs = val("iscfs");
    const total_ihdcf = val("ihdcf");
    const total_rebounds_created = val("rebounds_created");
    const total_pim = val("pim");
    const total_total_penalties = val("total_penalties");
    const total_minor_penalties = val("minor_penalties");
    const total_major_penalties = val("major_penalties");
    const total_misconduct_penalties = val("misconduct_penalties");
    const total_penalties_drawn = val("penalties_drawn");
    const total_giveaways = val("giveaways");
    const total_takeaways = val("takeaways");
    const total_hits = val("hits");
    const total_hits_taken = val("hits_taken");
    const total_shots_blocked = val("shots_blocked");
    const total_faceoffs_won = val("faceoffs_won");
    const total_faceoffs_lost = val("faceoffs_lost");
    const total_cf = val("cf");
    const total_ca = val("ca");
    const total_ff = val("ff");
    const total_fa = val("fa");
    const total_sf = val("sf");
    const total_sa = val("sa");
    const total_gf = val("gf");
    const total_ga = val("ga");
    const total_xgf = val("xgf");
    const total_xga = val("xga");
    const total_scf = val("scf");
    const total_sca = val("sca");
    const total_hdcf = val("hdcf");
    const total_hdca = val("hdca");
    const total_hdgf = val("hdgf");
    const total_hdga = val("hdga");
    const total_mdcf = val("mdcf");
    const total_mdca = val("mdca");
    const total_mdgf = val("mdgf");
    const total_mdga = val("mdga");
    const total_ldcf = val("ldcf");
    const total_ldca = val("ldca");
    const total_ldgf = val("ldgf");
    const total_ldga = val("ldga");
    const total_off_zone_starts = val("off_zone_starts");
    const total_neu_zone_starts = val("neu_zone_starts");
    const total_def_zone_starts = val("def_zone_starts");
    const total_on_the_fly_starts = val("on_the_fly_starts");
    const total_off_zone_faceoffs = val("off_zone_faceoffs");
    const total_neu_zone_faceoffs = val("neu_zone_faceoffs");
    const total_def_zone_faceoffs = val("def_zone_faceoffs");
    const on_ice_sh_pct = safeDivide(total_gf, total_sf);
    const ga_per_sa = safeDivide(total_ga, total_sa);
    const on_ice_sv_pct = ga_per_sa !== null ? 1.0 - ga_per_sa : null;
    return {
      num_seasons: num_seasons,
      total_gp: gp,
      total_toi: toi,
      total_goals,
      total_total_assists,
      total_first_assists,
      total_second_assists,
      total_total_points,
      total_shots,
      total_ixg,
      total_icf,
      total_iff,
      total_iscfs,
      total_ihdcf,
      total_rebounds_created,
      total_pim,
      total_total_penalties,
      total_minor_penalties,
      total_major_penalties,
      total_misconduct_penalties,
      total_penalties_drawn,
      total_giveaways,
      total_takeaways,
      total_hits,
      total_hits_taken,
      total_shots_blocked,
      total_faceoffs_won,
      total_faceoffs_lost,
      total_cf,
      total_ca,
      total_ff,
      total_fa,
      total_sf,
      total_sa,
      total_gf,
      total_ga,
      total_xgf,
      total_xga,
      total_scf,
      total_sca,
      total_hdcf,
      total_hdca,
      total_hdgf,
      total_hdga,
      total_mdcf,
      total_mdca,
      total_mdgf,
      total_mdga,
      total_ldcf,
      total_ldca,
      total_ldgf,
      total_ldga,
      total_off_zone_starts,
      total_neu_zone_starts,
      total_def_zone_starts,
      total_on_the_fly_starts,
      total_off_zone_faceoffs,
      total_neu_zone_faceoffs,
      total_def_zone_faceoffs,
      avg_toi_per_gp: safeDivide(toi, gp),
      goals_per_60: safeDivide(total_goals * 60, toi),
      total_assists_per_60: safeDivide(total_total_assists * 60, toi),
      first_assists_per_60: safeDivide(total_first_assists * 60, toi),
      second_assists_per_60: safeDivide(total_second_assists * 60, toi),
      total_points_per_60: safeDivide(total_total_points * 60, toi),
      shots_per_60: safeDivide(total_shots * 60, toi),
      ixg_per_60: safeDivide(total_ixg * 60, toi),
      icf_per_60: safeDivide(total_icf * 60, toi),
      iff_per_60: safeDivide(total_iff * 60, toi),
      iscfs_per_60: safeDivide(total_iscfs * 60, toi),
      ihdcf_per_60: safeDivide(total_ihdcf * 60, toi),
      rebounds_created_per_60: safeDivide(total_rebounds_created * 60, toi),
      pim_per_60: safeDivide(total_pim * 60, toi),
      total_penalties_per_60: safeDivide(total_total_penalties * 60, toi),
      minor_penalties_per_60: safeDivide(total_minor_penalties * 60, toi),
      major_penalties_per_60: safeDivide(total_major_penalties * 60, toi),
      misconduct_penalties_per_60: safeDivide(
        total_misconduct_penalties * 60,
        toi
      ),
      penalties_drawn_per_60: safeDivide(total_penalties_drawn * 60, toi),
      giveaways_per_60: safeDivide(total_giveaways * 60, toi),
      takeaways_per_60: safeDivide(total_takeaways * 60, toi),
      hits_per_60: safeDivide(total_hits * 60, toi),
      hits_taken_per_60: safeDivide(total_hits_taken * 60, toi),
      shots_blocked_per_60: safeDivide(total_shots_blocked * 60, toi),
      faceoffs_won_per_60: safeDivide(total_faceoffs_won * 60, toi),
      faceoffs_lost_per_60: safeDivide(total_faceoffs_lost * 60, toi),
      sh_percentage: safeDivide(total_goals, total_shots),
      ipp: safeDivide(total_total_points, total_gf),
      faceoffs_percentage: safeDivide(
        total_faceoffs_won,
        safeSum(total_faceoffs_won, total_faceoffs_lost)
      ),
      cf_per_60: safeDivide(total_cf * 60, toi),
      ca_per_60: safeDivide(total_ca * 60, toi),
      ff_per_60: safeDivide(total_ff * 60, toi),
      fa_per_60: safeDivide(total_fa * 60, toi),
      sf_per_60: safeDivide(total_sf * 60, toi),
      sa_per_60: safeDivide(total_sa * 60, toi),
      gf_per_60: safeDivide(total_gf * 60, toi),
      ga_per_60: safeDivide(total_ga * 60, toi),
      xgf_per_60: safeDivide(total_xgf * 60, toi),
      xga_per_60: safeDivide(total_xga * 60, toi),
      scf_per_60: safeDivide(total_scf * 60, toi),
      sca_per_60: safeDivide(total_sca * 60, toi),
      hdcf_per_60: safeDivide(total_hdcf * 60, toi),
      hdca_per_60: safeDivide(total_hdca * 60, toi),
      hdgf_per_60: safeDivide(total_hdgf * 60, toi),
      hdga_per_60: safeDivide(total_hdga * 60, toi),
      mdcf_per_60: safeDivide(total_mdcf * 60, toi),
      mdca_per_60: safeDivide(total_mdca * 60, toi),
      mdgf_per_60: safeDivide(total_mdgf * 60, toi),
      mdga_per_60: safeDivide(total_mdga * 60, toi),
      ldcf_per_60: safeDivide(total_ldcf * 60, toi),
      ldca_per_60: safeDivide(total_ldca * 60, toi),
      ldgf_per_60: safeDivide(total_ldgf * 60, toi),
      ldga_per_60: safeDivide(total_ldga * 60, toi),
      off_zone_starts_per_60: safeDivide(total_off_zone_starts * 60, toi),
      neu_zone_starts_per_60: safeDivide(total_neu_zone_starts * 60, toi),
      def_zone_starts_per_60: safeDivide(total_def_zone_starts * 60, toi),
      on_the_fly_starts_per_60: safeDivide(total_on_the_fly_starts * 60, toi),
      off_zone_faceoffs_per_60: safeDivide(total_off_zone_faceoffs * 60, toi),
      neu_zone_faceoffs_per_60: safeDivide(total_neu_zone_faceoffs * 60, toi),
      def_zone_faceoffs_per_60: safeDivide(total_def_zone_faceoffs * 60, toi),
      cf_pct: safeDivide(total_cf, safeSum(total_cf, total_ca)),
      ff_pct: safeDivide(total_ff, safeSum(total_ff, total_fa)),
      sf_pct: safeDivide(total_sf, safeSum(total_sf, total_sa)),
      gf_pct: safeDivide(total_gf, safeSum(total_gf, total_ga)),
      xgf_pct: safeDivide(total_xgf, safeSum(total_xgf, total_xga)),
      scf_pct: safeDivide(total_scf, safeSum(total_scf, total_sca)),
      hdcf_pct: safeDivide(total_hdcf, safeSum(total_hdcf, total_hdca)),
      hdgf_pct: safeDivide(total_hdgf, safeSum(total_hdgf, total_hdga)),
      mdcf_pct: safeDivide(total_mdcf, safeSum(total_mdcf, total_mdca)),
      mdgf_pct: safeDivide(total_mdgf, safeSum(total_mdgf, total_mdga)),
      ldcf_pct: safeDivide(total_ldcf, safeSum(total_ldcf, total_ldca)),
      ldgf_pct: safeDivide(total_ldgf, safeSum(total_ldgf, total_ldga)),
      on_ice_sh_pct: on_ice_sh_pct,
      on_ice_sv_pct: on_ice_sv_pct,
      pdo:
        on_ice_sh_pct !== null && on_ice_sv_pct !== null
          ? (on_ice_sh_pct + on_ice_sv_pct) * 1000
          : null,
      off_zone_start_pct: safeDivide(
        total_off_zone_starts,
        safeSum(
          // Denominator excludes Neutral Zone and On The Fly Starts
          total_off_zone_starts,
          total_def_zone_starts
        )
      ),
      off_zone_faceoff_pct: safeDivide(
        total_off_zone_faceoffs,
        safeSum(
          // Denominator excludes Neutral Zone Faceoffs
          total_off_zone_faceoffs,
          total_def_zone_faceoffs
        )
      ),

      // GP Percentage
      total_possible_gp: total_possible_gp > 0 ? total_possible_gp : null,
      gp_percentage: safeDivide(gp, total_possible_gp)
    };
  };

  // --- Main Handler Logic ---
  try {
    // 1. Fetch necessary data (using pagination for large tables)
    console.log("Fetching source data with pagination...");
    const [
      // Use fetchAllPages for the large counts tables
      individualCountsData,
      onIceCountsData,
      // Fetch smaller lookup tables directly (assuming they are < 1000 rows)
      { data: teamsInfoData, error: tiError },
      { data: teamSummaryYearsData, error: tsyError },
      { data: maxSeasonData, error: msError }
    ] = await Promise.all([
      fetchAllPages<any>("nst_seasonal_individual_counts"), // Fetch all pages
      fetchAllPages<any>("nst_seasonal_on_ice_counts"), // Fetch all pages
      supabase.from("teamsinfo").select("nst_abbr, name"),
      supabase
        .from("team_summary_years")
        .select("season_id, team_full_name, games_played"),
      supabase
        .from("nst_seasonal_individual_counts")
        .select("season")
        .order("season", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    // Error checking for lookup tables (fetchAllPages handles its own errors)
    if (tiError) throw new Error(`Teams Info Fetch Error: ${tiError.message}`);
    if (tsyError)
      throw new Error(`Team Summary Years Fetch Error: ${tsyError.message}`);
    if (msError && msError.code !== "PGRST116")
      throw new Error(`Max Season Fetch Error: ${msError.message}`); // Allow null from maybeSingle
    if (!teamsInfoData || !teamSummaryYearsData) {
      throw new Error(
        "Missing essential lookup data (teamsinfo, team_summary_years)."
      );
    }
    // Log total rows fetched via pagination
    console.log(
      `Total Fetched: ${individualCountsData.length} individual, ${onIceCountsData.length} on-ice rows.`
    );

    // Handle case where there's no data / no seasons yet
    if (!maxSeasonData?.season) {
      console.log("No season data found. Exiting calculation.");
      return res.status(200).json({
        success: true,
        message: "No season data available.",
        totalUpsertedThreeYear: 0,
        totalUpsertedCareer: 0,
        duration: `0.00 s`
      });
    }
    const currentSeason = maxSeasonData.season;
    console.log(
      `Current Season identified as: ${currentSeason}. Excluding from averages.`
    );

    // 2. Prepare Lookups
    const teamAbbrToNameMap = new Map(
      teamsInfoData.map((t) => [t.nst_abbr, t.name])
    );
    const teamSeasonGpMap = new Map<number, Map<string, number>>();
    teamSummaryYearsData.forEach((tsy) => {
      if (!teamSeasonGpMap.has(tsy.season_id)) {
        teamSeasonGpMap.set(tsy.season_id, new Map());
      }
      teamSeasonGpMap
        .get(tsy.season_id)!
        .set(tsy.team_full_name, tsy.games_played ?? 0);
    });

    // 3. Determine Relevant Seasons
    const allSeasons = [
      ...new Set(individualCountsData?.map((r) => r.season) ?? [])
    ]
      .filter((s) => s < currentSeason)
      .sort((a, b) => b - a);
    const threeYearSeasons = new Set(allSeasons.slice(0, 3));
    const careerSeasons = new Set(allSeasons);
    console.log(
      `Using seasons for 3-Year Avg: ${[...threeYearSeasons].join(", ")}`
    );
    console.log(
      `Using seasons for Career Avg: ${[...careerSeasons].join(", ")}`
    );
    if (careerSeasons.size === 0) {
      console.log("No past seasons found.");
      return res.status(200).json({
        success: true,
        message: "No past seasons found.",
        totalUpsertedThreeYear: 0,
        totalUpsertedCareer: 0,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)} s`
      });
    }

    // 4. Aggregate Data (Iterate over the full datasets)
    console.log("Aggregating data by player and strength...");
    (individualCountsData ?? []).forEach((row) => {
      if (careerSeasons.has(row.season)) {
        processRow(row, threeYearSeasons.has(row.season), true);
      }
    });
    (onIceCountsData ?? []).forEach((row) => {
      if (careerSeasons.has(row.season)) {
        const onIceOnlyRow = { ...row, gp: undefined, toi: undefined };
        processRow(onIceOnlyRow, threeYearSeasons.has(row.season), true);
      }
    });
    console.log(
      `Aggregated data for ${aggregationMap.size} player-strength combinations.`
    );

    // 5. Calculate Final Metrics and Prepare Upsert Data
    console.log("Calculating final metrics...");
    const threeYearUpsertData: CalculatedAverages[] = [];
    const careerUpsertData: CalculatedAverages[] = [];
    const nowISO = new Date().toISOString();
    for (const [key, agg] of aggregationMap.entries()) {
      const [playerIdStr, strength] = key.split("-");
      const player_id = parseInt(playerIdStr, 10);
      const threeYearMetrics = calculateMetrics(
        agg,
        "three_year",
        threeYearSeasons,
        teamAbbrToNameMap,
        teamSeasonGpMap
      );
      const careerMetrics = calculateMetrics(
        agg,
        "career",
        careerSeasons,
        teamAbbrToNameMap,
        teamSeasonGpMap
      );
      if (threeYearMetrics) {
        threeYearUpsertData.push({
          player_id,
          strength,
          updated_at: nowISO,
          ...threeYearMetrics
        });
      }
      if (careerMetrics) {
        careerUpsertData.push({
          player_id,
          strength,
          updated_at: nowISO,
          ...careerMetrics
        });
      }
    }
    console.log(
      `Prepared ${threeYearUpsertData.length} rows for 3-year averages and ${careerUpsertData.length} rows for career averages.`
    );

    // 6. Upsert Data in Batches
    console.log("Upserting data...");
    let totalUpsertedThreeYear = 0;
    let totalUpsertedCareer = 0;
    if (threeYearUpsertData.length > 0) {
      for (let i = 0; i < threeYearUpsertData.length; i += BATCH_SIZE) {
        const batch = threeYearUpsertData.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
          .from("wgo_avg_three_year")
          .upsert(batch, { onConflict: "player_id, strength" });
        if (error)
          throw new Error(`Error upserting 3-year batch: ${error.message}`);
        totalUpsertedThreeYear += batch.length;
      }
      console.log(
        `Upserted ${totalUpsertedThreeYear} rows to wgo_avg_three_year.`
      );
    } else {
      console.log("No 3-year average data to upsert.");
    }
    if (careerUpsertData.length > 0) {
      for (let i = 0; i < careerUpsertData.length; i += BATCH_SIZE) {
        const batch = careerUpsertData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("wgo_avg_career")
          .upsert(batch, { onConflict: "player_id, strength" });
        if (error)
          throw new Error(`Error upserting career batch: ${error.message}`);
        totalUpsertedCareer += batch.length;
      }
      console.log(`Upserted ${totalUpsertedCareer} rows to wgo_avg_career.`);
    } else {
      console.log("No career average data to upsert.");
    }

    // --- Final Response ---
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Player average calculation completed in ${durationSec} s.`);
    return res.status(200).json({
      success: true,
      message: `Successfully calculated and upserted player averages.`,
      totalUpsertedThreeYear,
      totalUpsertedCareer,
      duration: `${durationSec} s`
    });
  } catch (error: any) {
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error("Error calculating player averages:", error);
    console.error("Error details:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: error.message || "An unexpected error occurred.",
      duration: `${durationSec} s`,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack })
    });
  }
}
