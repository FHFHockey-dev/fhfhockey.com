// calculateAverages.js

function calculateAverages(goalies) {
  const total = goalies.reduce(
    (acc, goalie) => {
      acc.goalsAllowed += goalie.goalsAgainst;
      acc.minutesPlayed += goalie.timeOnIce; // Currently in seconds
      acc.gamesPlayed += goalie.gamesPlayed;
      acc.gamesStarted += goalie.gamesStarted;
      acc.wins += goalie.wins;
      acc.losses += goalie.losses;
      acc.otLosses += goalie.otLosses;
      acc.saves += goalie.saves;
      acc.shotsAgainst += goalie.shotsAgainst;
      acc.shutouts += goalie.shutouts;
      return acc;
    },
    {
      goalsAllowed: 0,
      minutesPlayed: 0, // Will convert to minutes later
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      shutouts: 0,
    }
  );

  const numGoalies = goalies.length;

  // Convert total time from seconds to minutes
  const totalMinutesPlayed = total.minutesPlayed / 60;
  // Calculate league averages
  const leagueAverages = {
    gamesPlayed: total.gamesPlayed / numGoalies,
    gamesStarted: total.gamesStarted / numGoalies,
    wins: total.wins / numGoalies,
    losses: total.losses / numGoalies,
    otLosses: total.otLosses / numGoalies,
    saves: total.saves / numGoalies,
    shotsAgainst: total.shotsAgainst / numGoalies,
    goalsAgainst: total.goalsAllowed / numGoalies,
    shutouts: total.shutouts / numGoalies,
    // Correct GAA Calculation
    goalsAgainstAverage:
      totalMinutesPlayed > 0
        ? (total.goalsAllowed * 60) / totalMinutesPlayed
        : 0,
    // Calculate Save Percentage
    savePct: total.shotsAgainst > 0 ? total.saves / total.shotsAgainst : 0,
    // Calculate Time on Ice average in minutes
    timeOnIce: totalMinutesPlayed / numGoalies,
  };

  return leagueAverages;
}

module.exports = {
  calculateAverages,
};
