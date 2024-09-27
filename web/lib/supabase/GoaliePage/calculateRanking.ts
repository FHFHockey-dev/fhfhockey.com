// lib/supabase/GoaliePage/calculateRanking.ts

import {
  GoalieStat,
  Averages,
  NumericStatKey,
  WeekRanking,
  RankingResult,
} from "./types";

export function calculateRanking(
  goalie: GoalieStat,
  averages: Averages,
  selectedStats: NumericStatKey[]
): RankingResult {
  let points = 0;

  selectedStats.forEach((stat) => {
    if (stat === "savePct" || stat === "goalsAgainstAverage") {
      // For percentages, higher is better
      if (goalie[stat] > averages[stat]) {
        points += 1;
      }
    } else {
      // For other stats, higher is better
      if (goalie[stat] > averages[stat]) {
        points += 1;
      }
    }
  });

  let ranking: WeekRanking = "Really Bad Week";

  if (points >= selectedStats.length * 0.8) {
    ranking = "Elite Week";
  } else if (points >= selectedStats.length * 0.65) {
    ranking = "Quality Week";
  } else if (points >= selectedStats.length * 0.5) {
    ranking = "Week";
  } else if (points >= selectedStats.length * 0.35) {
    ranking = "Bad Week";
  }

  const percentage = (points / selectedStats.length) * 100;

  return {
    percentage,
    ranking,
  };
}
