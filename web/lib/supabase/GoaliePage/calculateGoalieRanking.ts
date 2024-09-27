// lib/supabase/GoaliePage/calculateGoalieRankings.ts

import {
  GoalieWithWeeks,
  GoalieRanking,
  NumericStatKey,
  WeekRanking,
  Averages,
} from "./types";
import { calculateRanking } from "./calculateRanking";

export function calculateGoalieRankings(
  goalies: GoalieWithWeeks[],
  averagesByWeek: { [weekId: number]: Averages },
  selectedStats: NumericStatKey[]
): GoalieRanking[] {
  const rankingPoints: { [key in WeekRanking]: number } = {
    "Elite Week": 20,
    "Quality Week": 10,
    Week: 5,
    "Bad Week": 3,
    "Really Bad Week": 1,
  };

  const goalieRankings: GoalieRanking[] = goalies.map((goalie) => {
    let totalPoints = 0;
    const weekCounts: { [key in WeekRanking]: number } = {
      "Elite Week": 0,
      "Quality Week": 0,
      Week: 0,
      "Bad Week": 0,
      "Really Bad Week": 0,
    };

    goalie.weeks.forEach((weekStat) => {
      const weekId = weekStat.weekId;
      const averages = averagesByWeek[weekId];
      const { ranking } = calculateRanking(weekStat, averages, selectedStats);

      weekCounts[ranking] += 1;
      totalPoints += rankingPoints[ranking];
    });

    // Calculate percentages
    const totalWeeks = Object.values(weekCounts).reduce(
      (acc, count) => acc + count,
      0
    );
    const acceptableWeeks =
      weekCounts["Elite Week"] +
      weekCounts["Quality Week"] +
      weekCounts["Week"];
    const goodWeeks = weekCounts["Elite Week"] + weekCounts["Quality Week"];
    const badWeeks = weekCounts["Bad Week"] + weekCounts["Really Bad Week"];

    const percentAcceptableWeeks =
      totalWeeks > 0 ? (acceptableWeeks / totalWeeks) * 100 : 0;
    const percentGoodWeeks =
      totalWeeks > 0 ? (goodWeeks / totalWeeks) * 100 : 0;

    return {
      playerId: goalie.playerId,
      goalieFullName: goalie.goalieFullName,
      team: goalie.team,
      totalPoints,
      weekCounts,
      percentAcceptableWeeks, // Assign calculated value
      percentGoodWeeks, // Assign calculated value
    };
  });

  // Sort goalies by totalPoints descending
  goalieRankings.sort((a, b) => b.totalPoints - a.totalPoints);

  return goalieRankings;
}
