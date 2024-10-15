// components/GameGrid/utils/calculateRatings.test.ts

import { calculateAttackDefenseRatings } from "./calculateRatings";

const testCalculateRatings = async () => {
  try {
    const { teamRatings, leagueAverages } =
      await calculateAttackDefenseRatings();
    console.log("League Averages:", leagueAverages);
    console.log("Team Ratings:", teamRatings);
  } catch (error) {
    console.error("Error calculating ratings:", error);
  }
};

testCalculateRatings();
