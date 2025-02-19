// pages/api/v1/db/update-expected-goals/calculations.ts

import { poissonProbability } from "./utils";
import { Game, TeamScores, mapAbbreviationToId } from "./fetchData";

/**
 * Interface representing the structure of data to be upserted into Supabase.
 */
export interface CalculatedGameData {
  game_id: number;
  game_date: string;
  league_average_goals_for: number;
  home_team_id: number;
  away_team_id: number;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_expected_goals: number;
  away_expected_goals: number;
  home_win_odds: number;
  away_win_odds: number;
  home_api_win_odds?: number; // Made optional
  away_api_win_odds?: number; // Made optional
  updated_at: string; // ISO string
}

/**
 * Calculates expected goals for a team.
 */
export function calculateExpectedGoals(
  homeAttScore: number,
  awayDefScore: number,
  leagueAvgGoalsFor: number
): number {
  return homeAttScore * awayDefScore * leagueAvgGoalsFor;
}

/**
 * Generates a Poisson probability matrix for expected goals.
 */
export function generatePoissonProbabilityMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number = 10
): number[][] {
  const matrix: number[][] = [];
  let totalProb = 0;

  // Calculate probabilities
  for (let i = 0; i <= maxGoals; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGoals; j++) {
      const homeProb = poissonProbability(i, lambdaHome);
      const awayProb = poissonProbability(j, lambdaAway);
      matrix[i][j] = homeProb * awayProb;
      totalProb += matrix[i][j];
    }
  }

  // Normalize the matrix to ensure the sum of all probabilities equals 1
  if (Math.abs(totalProb - 1) > 1e-6) {
    for (let i = 0; i <= maxGoals; i++) {
      for (let j = 0; j <= maxGoals; j++) {
        matrix[i][j] /= totalProb;
      }
    }
  }

  return matrix;
}

/**
 * Calculates win odds based on the Poisson probability matrix.
 */
export function calculateWinOdds(
  matrix: number[][],
  maxGoals: number = 10
): { homeWinOdds: number; awayWinOdds: number } {
  let homeWinProb = 0;
  let awayWinProb = 0;
  let drawProb = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const prob = matrix[i][j];
      if (i > j) {
        homeWinProb += prob;
      } else if (i < j) {
        awayWinProb += prob;
      } else {
        drawProb += prob;
      }
    }
  }

  // Calculate odds with tie-breaker
  let homeWinOdds = (homeWinProb + drawProb / 2) * 100; // percentage
  let awayWinOdds = (awayWinProb + drawProb / 2) * 100; // percentage

  // Normalize to ensure the sum is 100%
  const total = homeWinOdds + awayWinOdds;
  homeWinOdds = parseFloat(((homeWinOdds / total) * 100).toFixed(2));
  awayWinOdds = parseFloat(((awayWinOdds / total) * 100).toFixed(2));

  return { homeWinOdds, awayWinOdds };
}

/**
 * Converts American odds to implied probability percentage.
 */
export function convertAmericanOddsToPercentage(odds: string): number {
  let oddsNum = Number(odds);
  if (isNaN(oddsNum)) {
    throw new Error(`Invalid odds value: ${odds}`);
  }

  if (oddsNum > 0) {
    return (100 / (oddsNum + 100)) * 100; // percentage
  } else {
    return (-oddsNum / (-oddsNum + 100)) * 100; // percentage
  }
}

/**
 * Performs all calculations for a list of games.
 */
export async function performCalculations(
  games: Game[],
  teamScores: TeamScores[],
  leagueAverages: number
): Promise<CalculatedGameData[]> {
  const teamScoreMap: { [abbrev: string]: TeamScores } = {};
  teamScores.forEach((team) => {
    teamScoreMap[team.team_abbreviation] = team;
  });

  const calculatedData: CalculatedGameData[] = [];

  for (const game of games) {
    const { id: game_id, gameDate, homeTeam, awayTeam } = game;

    const home_abbrev = homeTeam.abbrev;
    const away_abbrev = awayTeam.abbrev;

    const home_team_id = mapAbbreviationToId(home_abbrev);
    const away_team_id = mapAbbreviationToId(away_abbrev);

    if (home_team_id === undefined || away_team_id === undefined) {
      console.warn(
        `Team ID not found for game ${game_id}: ${home_abbrev} vs ${away_abbrev}`
      );
      continue; // skip this game
    }

    const home_team_scores = teamScoreMap[home_abbrev];
    const away_team_scores = teamScoreMap[away_abbrev];

    if (!home_team_scores || !away_team_scores) {
      console.warn(
        `Team scores not found for game ${game_id}: ${home_abbrev} vs ${away_abbrev}`
      );
      continue; // skip this game
    }

    // Calculate expected goals
    const home_expected_goals = calculateExpectedGoals(
      home_team_scores.att_score_all,
      away_team_scores.def_score_all,
      leagueAverages
    );

    const away_expected_goals = calculateExpectedGoals(
      away_team_scores.att_score_all,
      home_team_scores.def_score_all,
      leagueAverages
    );

    // Generate Poisson probability matrix
    const poissonMatrix = generatePoissonProbabilityMatrix(
      home_expected_goals,
      away_expected_goals
    );

    // Calculate win odds
    const { homeWinOdds, awayWinOdds } = calculateWinOdds(poissonMatrix);

    // Fetch API odds
    const homeOddsValues = Array.isArray(homeTeam.odds)
      ? homeTeam.odds.map((odd) => convertAmericanOddsToPercentage(odd.value))
      : [];
    const awayOddsValues = Array.isArray(awayTeam.odds)
      ? awayTeam.odds.map((odd) => convertAmericanOddsToPercentage(odd.value))
      : [];

    const home_api_win_odds =
      homeOddsValues.length > 0
        ? parseFloat(
            (
              homeOddsValues.reduce((a, b) => a + b, 0) / homeOddsValues.length
            ).toFixed(2)
          )
        : undefined; // Assign undefined when odds are missing
    const away_api_win_odds =
      awayOddsValues.length > 0
        ? parseFloat(
            (
              awayOddsValues.reduce((a, b) => a + b, 0) / awayOddsValues.length
            ).toFixed(2)
          )
        : undefined; // Assign undefined when odds are missing

    // Optional: Log if odds are missing
    if (!Array.isArray(homeTeam.odds) || homeTeam.odds.length === 0) {
    }

    if (!Array.isArray(awayTeam.odds) || awayTeam.odds.length === 0) {
    }

    const calculatedGame: CalculatedGameData = {
      game_id,
      game_date: gameDate,
      league_average_goals_for: leagueAverages,
      home_team_id,
      away_team_id,
      home_team_abbreviation: home_abbrev,
      away_team_abbreviation: away_abbrev,
      home_expected_goals: parseFloat(home_expected_goals.toFixed(2)),
      away_expected_goals: parseFloat(away_expected_goals.toFixed(2)),
      home_win_odds: parseFloat(homeWinOdds.toFixed(2)),
      away_win_odds: parseFloat(awayWinOdds.toFixed(2)),
      // Conditionally include odds fields only if they exist
      ...(home_api_win_odds !== undefined && {
        home_api_win_odds: parseFloat(home_api_win_odds.toFixed(2))
      }),
      ...(away_api_win_odds !== undefined && {
        away_api_win_odds: parseFloat(away_api_win_odds.toFixed(2))
      }),
      updated_at: new Date().toISOString()
    };

    calculatedData.push(calculatedGame);
  }

  return calculatedData;
}
