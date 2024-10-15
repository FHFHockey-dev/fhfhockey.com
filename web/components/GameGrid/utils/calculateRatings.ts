// components/GameGrid/utils/calculateRatings.ts

import supabase from "lib/supabase";
import { poissonProbability } from "./poisson";
import { teamsInfo } from "lib/teamsInfo";

// Define the game situations
type GameSituation = "all" | "5v5" | "pp" | "pk";

// Define the structure of team stats fetched from Supabase
interface RawTeamStats {
  team_abbreviation: string;
  team_name: string;
  gp: number; // Games Played
  toi: string; // Time on Ice in "MM:SS" format
  w: number; // Wins
  l: number; // Losses
  otl: number; // Overtime Losses
  points: number; // Points
  cf: number; // Corsi For
  ca: number; // Corsi Against
  cf_pct: number; // Corsi For Percentage
  ff: number; // Fenwick For
  fa: number; // Fenwick Against
  ff_pct: number; // Fenwick For Percentage
  sf: number; // Shots For
  sa: number; // Shots Against
  sf_pct: number; // Shots For Percentage
  gf: number; // Goals For
  ga: number; // Goals Against
  gf_pct: number; // Goals For Percentage
  xgf: number; // Expected Goals For
  xga: number; // Expected Goals Against
  xgf_pct: number; // Expected Goals For Percentage
  scf: number; // Scoring Chances For
  sca: number; // Scoring Chances Against
  scf_pct: number; // Scoring Chances For Percentage
  hdcf: number; // High-Danger Chances For
  hdca: number; // High-Danger Chances Against
  hdcf_pct: number; // High-Danger Chances For Percentage
  hdsf: number; // High-Danger Shots For
  hdsa: number; // High-Danger Shots Against
  hdsf_pct: number; // High-Danger Shots For Percentage
  hdgf: number; // High-Danger Goals For
  hdga: number; // High-Danger Goals Against
  hdgf_pct: number; // High-Danger Goals For Percentage
  sh_pct: number; // Shooting Percentage
  sv_pct: number; // Save Percentage
  pdo: number; // PDO
}

// Define normalized per-minute stats
interface NormalizedTeamStats {
  teamAbbreviation: string;
  teamName: string;
  situation: GameSituation;
  perMinuteCF: number; // Corsi For per minute
  perMinuteCA: number; // Corsi Against per minute
  perMinuteFF: number; // Fenwick For per minute
  perMinuteFA: number; // Fenwick Against per minute
  perMinuteSF: number; // Shots For per minute
  perMinuteSA: number; // Shots Against per minute
  perMinuteGF: number; // Goals For per minute
  perMinuteGA: number; // Goals Against per minute
  perMinuteXGF: number; // Expected Goals For per minute
  perMinuteXGA: number; // Expected Goals Against per minute
  perMinuteSCF: number; // Scoring Chances For per minute
  perMinuteSCA: number; // Scoring Chances Against per minute
  perMinuteHDCF: number; // High-Danger Chances For per minute
  perMinuteHDCA: number; // High-Danger Chances Against per minute
  perMinuteHDGF: number; // High-Danger Goals For per minute
  perMinuteHDGA: number; // High-Danger Goals Against per minute
}

// Define league-wide per-minute averages
interface LeagueAverages {
  [situation: string]: {
    perMinuteCF: number;
    perMinuteCA: number;
    perMinuteFF: number;
    perMinuteFA: number;
    perMinuteSF: number;
    perMinuteSA: number;
    perMinuteGF: number;
    perMinuteGA: number;
    perMinuteXGF: number;
    perMinuteXGA: number;
    perMinuteSCF: number;
    perMinuteSCA: number;
    perMinuteHDCF: number;
    perMinuteHDCA: number;
    perMinuteHDGF: number;
    perMinuteHDGA: number;
  };
}

// Define team ratings relative to league averages
interface TeamRatings {
  [teamAbbreviation: string]: {
    [situation: string]: {
      attackRating: number; // e.g., perMinuteGF / leaguePerMinuteGF
      defenseRating: number; // e.g., perMinuteGA / leaguePerMinuteGA
      perMinuteCF: number; // Relative Corsi For
      perMinuteCA: number; // Relative Corsi Against
      perMinuteFF: number; // Relative Fenwick For
      perMinuteFA: number; // Relative Fenwick Against
      perMinuteSF: number; // Relative Shots For
      perMinuteSA: number; // Relative Shots Against
      perMinuteGF: number; // Relative Goals For
      perMinuteGA: number; // Relative Goals Against
      perMinuteXGF: number; // Relative Expected Goals For
      perMinuteXGA: number; // Relative Expected Goals Against
      perMinuteSCF: number; // Relative Scoring Chances For
      perMinuteSCA: number; // Relative Scoring Chances Against
      perMinuteHDCF: number; // Relative High-Danger Chances For
      perMinuteHDCA: number; // Relative High-Danger Chances Against
      perMinuteHDGF: number; // Relative High-Danger Goals For
      perMinuteHDGA: number; // Relative High-Danger Goals Against
    };
  };
}

/**
 * Converts Time on Ice (TOI) from "MM:SS" format to total seconds.
 * @param toi - Time on Ice as a string in "MM:SS" format.
 * @returns Total seconds as a number.
 */
const convertToSeconds = (toi: string): number => {
  if (!toi) return 0;
  const [minutes, seconds] = toi.split(":").map(Number);
  return minutes * 60 + seconds;
};

/**
 * Normalizes raw team stats to per-minute basis.
 * @param rawStats - Array of raw team stats from Supabase.
 * @param situation - Game situation corresponding to the stats.
 * @returns Array of normalized team stats.
 */
const normalizeStatsPerMinute = (
  rawStats: RawTeamStats[],
  situation: GameSituation
): NormalizedTeamStats[] => {
  return rawStats.map((team) => {
    const toiSeconds = convertToSeconds(team.toi);
    const toiMinutes = toiSeconds / 60;

    return {
      teamAbbreviation: team.team_abbreviation,
      teamName: team.team_name,
      situation,
      perMinuteCF: toiMinutes > 0 ? team.cf / toiMinutes : 0,
      perMinuteCA: toiMinutes > 0 ? team.ca / toiMinutes : 0,
      perMinuteFF: toiMinutes > 0 ? team.ff / toiMinutes : 0,
      perMinuteFA: toiMinutes > 0 ? team.fa / toiMinutes : 0,
      perMinuteSF: toiMinutes > 0 ? team.sf / toiMinutes : 0,
      perMinuteSA: toiMinutes > 0 ? team.sa / toiMinutes : 0,
      perMinuteGF: toiMinutes > 0 ? team.gf / toiMinutes : 0,
      perMinuteGA: toiMinutes > 0 ? team.ga / toiMinutes : 0,
      perMinuteXGF: toiMinutes > 0 ? team.xgf / toiMinutes : 0,
      perMinuteXGA: toiMinutes > 0 ? team.xga / toiMinutes : 0,
      perMinuteSCF: toiMinutes > 0 ? team.scf / toiMinutes : 0,
      perMinuteSCA: toiMinutes > 0 ? team.sca / toiMinutes : 0,
      perMinuteHDCF: toiMinutes > 0 ? team.hdcf / toiMinutes : 0,
      perMinuteHDCA: toiMinutes > 0 ? team.hdca / toiMinutes : 0,
      perMinuteHDGF: toiMinutes > 0 ? team.hdgf / toiMinutes : 0,
      perMinuteHDGA: toiMinutes > 0 ? team.hdga / toiMinutes : 0,
    };
  });
};

/**
 * Calculates attack and defense ratings for all teams across different game situations.
 * @returns An object containing team ratings and league averages.
 */
// components/GameGrid/utils/calculateRatings.ts

export const calculateAttackDefenseRatings = async (): Promise<{
  teamRatings: TeamRatings;
  leagueAverages: LeagueAverages;
}> => {
  console.log("Starting calculateAttackDefenseRatings...");

  // Define the game situations and corresponding tables
  const situations: { situation: GameSituation; tableName: string }[] = [
    { situation: "all", tableName: "nst_team_all" },
    { situation: "5v5", tableName: "nst_team_5v5" },
    { situation: "pp", tableName: "nst_team_pp" },
    { situation: "pk", tableName: "nst_team_pk" },
  ];

  // Initialize data holders
  const allNormalizedStats: NormalizedTeamStats[] = [];

  // Step 1 & 2: Fetch and normalize stats for each situation
  for (const { situation, tableName } of situations) {
    console.log(
      `Fetching data from table: ${tableName} for situation: ${situation}`
    );
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      throw new Error(
        `Error fetching data from ${tableName}: ${error.message}`
      );
    }

    if (!data || data.length === 0) {
      console.warn(`No data found in table ${tableName}.`);
      throw new Error(`No data found in table ${tableName}.`);
    }

    // Normalize stats per minute for the current situation
    const normalized = normalizeStatsPerMinute(
      data as RawTeamStats[],
      situation
    );
    console.log(`Normalized data for situation ${situation}:`, normalized);
    allNormalizedStats.push(...normalized);
  }

  // Step 3: Calculate league-wide per-minute averages for each situation and metric
  const leagueAverages: LeagueAverages = {};

  for (const { situation } of situations) {
    console.log(`Calculating league averages for situation: ${situation}`);
    const statsForSituation = allNormalizedStats.filter(
      (stat) => stat.situation === situation
    );

    const totalTeams = statsForSituation.length;

    if (totalTeams === 0) {
      console.warn(`No teams found for situation ${situation}.`);
      throw new Error(`No teams found for situation ${situation}.`);
    }

    // Initialize sum accumulator
    const sumStats = statsForSituation.reduce(
      (acc, team) => {
        acc.perMinuteCF += team.perMinuteCF;
        acc.perMinuteCA += team.perMinuteCA;
        acc.perMinuteFF += team.perMinuteFF;
        acc.perMinuteFA += team.perMinuteFA;
        acc.perMinuteSF += team.perMinuteSF;
        acc.perMinuteSA += team.perMinuteSA;
        acc.perMinuteGF += team.perMinuteGF;
        acc.perMinuteGA += team.perMinuteGA;
        acc.perMinuteXGF += team.perMinuteXGF;
        acc.perMinuteXGA += team.perMinuteXGA;
        acc.perMinuteSCF += team.perMinuteSCF;
        acc.perMinuteSCA += team.perMinuteSCA;
        acc.perMinuteHDCF += team.perMinuteHDCF;
        acc.perMinuteHDCA += team.perMinuteHDCA;
        acc.perMinuteHDGF += team.perMinuteHDGF;
        acc.perMinuteHDGA += team.perMinuteHDGA;
        // Sum other stats similarly
        return acc;
      },
      {
        perMinuteCF: 0,
        perMinuteCA: 0,
        perMinuteFF: 0,
        perMinuteFA: 0,
        perMinuteSF: 0,
        perMinuteSA: 0,
        perMinuteGF: 0,
        perMinuteGA: 0,
        perMinuteXGF: 0,
        perMinuteXGA: 0,
        perMinuteSCF: 0,
        perMinuteSCA: 0,
        perMinuteHDCF: 0,
        perMinuteHDCA: 0,
        perMinuteHDGF: 0,
        perMinuteHDGA: 0,
        // Initialize other stats
      }
    );

    // Calculate averages
    leagueAverages[situation] = {
      perMinuteCF: sumStats.perMinuteCF / totalTeams,
      perMinuteCA: sumStats.perMinuteCA / totalTeams,
      perMinuteFF: sumStats.perMinuteFF / totalTeams,
      perMinuteFA: sumStats.perMinuteFA / totalTeams,
      perMinuteSF: sumStats.perMinuteSF / totalTeams,
      perMinuteSA: sumStats.perMinuteSA / totalTeams,
      perMinuteGF: sumStats.perMinuteGF / totalTeams,
      perMinuteGA: sumStats.perMinuteGA / totalTeams,
      perMinuteXGF: sumStats.perMinuteXGF / totalTeams,
      perMinuteXGA: sumStats.perMinuteXGA / totalTeams,
      perMinuteSCF: sumStats.perMinuteSCF / totalTeams,
      perMinuteSCA: sumStats.perMinuteSCA / totalTeams,
      perMinuteHDCF: sumStats.perMinuteHDCF / totalTeams,
      perMinuteHDCA: sumStats.perMinuteHDCA / totalTeams,
      perMinuteHDGF: sumStats.perMinuteHDGF / totalTeams,
      perMinuteHDGA: sumStats.perMinuteHDGA / totalTeams,
      // Calculate other league averages similarly
    };

    console.log(`League averages for ${situation}:`, leagueAverages[situation]);
  }

  // Step 4: Calculate team ratings relative to league averages
  const teamRatings: TeamRatings = {};

  for (const teamStat of allNormalizedStats) {
    const { teamAbbreviation, situation } = teamStat;

    // Initialize team entry if not present
    if (!teamRatings[teamAbbreviation]) {
      teamRatings[teamAbbreviation] = {};
    }

    // Retrieve league averages for the current situation
    const leagueAvg = leagueAverages[situation];

    // Calculate relative ratings, ensuring no division by zero
    teamRatings[teamAbbreviation][situation] = {
      attackRating:
        leagueAvg.perMinuteGF > 0
          ? teamStat.perMinuteGF / leagueAvg.perMinuteGF
          : 0,
      defenseRating:
        leagueAvg.perMinuteGA > 0
          ? teamStat.perMinuteGA / leagueAvg.perMinuteGA
          : 0,
      perMinuteCF:
        leagueAvg.perMinuteCF > 0
          ? teamStat.perMinuteCF / leagueAvg.perMinuteCF
          : 0,
      perMinuteCA:
        leagueAvg.perMinuteCA > 0
          ? teamStat.perMinuteCA / leagueAvg.perMinuteCA
          : 0,
      perMinuteFF:
        leagueAvg.perMinuteFF > 0
          ? teamStat.perMinuteFF / leagueAvg.perMinuteFF
          : 0,
      perMinuteFA:
        leagueAvg.perMinuteFA > 0
          ? teamStat.perMinuteFA / leagueAvg.perMinuteFA
          : 0,
      perMinuteSF:
        leagueAvg.perMinuteSF > 0
          ? teamStat.perMinuteSF / leagueAvg.perMinuteSF
          : 0,
      perMinuteSA:
        leagueAvg.perMinuteSA > 0
          ? teamStat.perMinuteSA / leagueAvg.perMinuteSA
          : 0,
      perMinuteGF:
        leagueAvg.perMinuteGF > 0
          ? teamStat.perMinuteGF / leagueAvg.perMinuteGF
          : 0,
      perMinuteGA:
        leagueAvg.perMinuteGA > 0
          ? teamStat.perMinuteGA / leagueAvg.perMinuteGA
          : 0,
      perMinuteXGF:
        leagueAvg.perMinuteXGF > 0
          ? teamStat.perMinuteXGF / leagueAvg.perMinuteXGF
          : 0,
      perMinuteXGA:
        leagueAvg.perMinuteXGA > 0
          ? teamStat.perMinuteXGA / leagueAvg.perMinuteXGA
          : 0,
      perMinuteSCF:
        leagueAvg.perMinuteSCF > 0
          ? teamStat.perMinuteSCF / leagueAvg.perMinuteSCF
          : 0,
      perMinuteSCA:
        leagueAvg.perMinuteSCA > 0
          ? teamStat.perMinuteSCA / leagueAvg.perMinuteSCA
          : 0,
      perMinuteHDCF:
        leagueAvg.perMinuteHDCF > 0
          ? teamStat.perMinuteHDCF / leagueAvg.perMinuteHDCF
          : 0,
      perMinuteHDCA:
        leagueAvg.perMinuteHDCA > 0
          ? teamStat.perMinuteHDCA / leagueAvg.perMinuteHDCA
          : 0,
      perMinuteHDGF:
        leagueAvg.perMinuteHDGF > 0
          ? teamStat.perMinuteHDGF / leagueAvg.perMinuteHDGF
          : 0,
      perMinuteHDGA:
        leagueAvg.perMinuteHDGA > 0
          ? teamStat.perMinuteHDGA / leagueAvg.perMinuteHDGA
          : 0,
      // Ensure all properties are assigned
    };

    console.log(
      `Team Ratings for ${teamAbbreviation} in ${situation}:`,
      teamRatings[teamAbbreviation][situation]
    );
  }

  console.log("Completed calculateAttackDefenseRatings.");

  return { teamRatings, leagueAverages };
};
