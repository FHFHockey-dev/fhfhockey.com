// lib/supabase/calculateSko.js

const path = "./../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const { fetchYearlyData, fetchGameStats } = require("./utils/dataFetching");
const { mean, stdDev } = require("./utils/statisticalCalculations");
const {
  calculateRollingAverage,
  calculateEMA,
} = require("./utils/movingAverages");

const {
  bayesianUpdate,
  calculateProbability,
} = require("./utils/bayesianInference");

const {
  calculateSkoScore,
  assessSustainability,
  calculatePeriodSkoScore,
} = require("./utils/skoScore");
const { performPCA } = require("./utils/pcaAnalysis");

// Constants
const {
  ROLLING_WINDOW_SIZE,
  EMA_ALPHA,
  SIGNIFICANCE_LEVEL,
  SURVEY_RANKINGS,
  STAT_VARIANCES,
} = require("./utils/config");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Public Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize a map to keep track of recent games and Bayesian parameters per player
const playerGameQueues = {};
const playerBayesianParams = {};

/**
 * Assigns weights based on survey rankings.
 * Lower ranking number means higher importance.
 * @param {object} surveyRankings - Object with stat names as keys and average ranking as values.
 * @returns {object} - Object with stat names as keys and assigned weights as values.
 */
function assignWeights(surveyRankings) {
  const maxRank = Math.max(...Object.values(surveyRankings));
  const weights = {};

  Object.entries(surveyRankings).forEach(([stat, rank]) => {
    // Assign higher weights to lower ranks (more important)
    weights[stat] = maxRank - rank + 1; // Example: rank 1 -> weight maxRank, rank maxRank -> weight 1
  });

  return weights;
}

/**
 * Maps a game date to its corresponding season.
 * Assumes the season starts in September and ends in June.
 * For example, a game on 2023-10-11 belongs to the 20232024 season.
 * @param {string} date - The game date in YYYY-MM-DD format.
 * @returns {number} - The season in the format YYYYYYYY (e.g., 20232024).
 */
function getSeasonFromDate(date) {
  const gameDate = new Date(date);
  const year = gameDate.getFullYear();
  const month = gameDate.getMonth() + 1; // Months are 0-indexed

  if (month >= 9) {
    // Season starts in September
    return parseInt(`${year}${year + 1}`);
  } else {
    // Season started in the previous year
    return parseInt(`${year - 1}${year}`);
  }
}

/**
 * Main function to calculate and upsert Sko scores.
 */
async function calculateAndUpsertSkoScores() {
  try {
    // Assign weights based on survey rankings
    const statWeights = assignWeights(SURVEY_RANKINGS);
    console.log(`Assigned Stat Weights: ${JSON.stringify(statWeights)}`);

    // Fetch data from Supabase with pagination
    const yearlyData = await fetchYearlyData();
    const gameStatsData = await fetchGameStats();

    console.log(`Fetched ${yearlyData.length} yearly records.`);
    console.log(`Fetched ${gameStatsData.length} game stats records.`);

    // Perform PCA on all game stats before processing games
    const allGameStatsMatrix = gameStatsData.map((game) => [
      game.shooting_percentage || 0,
      game.ipp || 0,
      game.on_ice_shooting_pct || 0,
      game.a1_a2_percentage || 0,
      game.sog_per_60 || 0,
      game.pp_percentage || 0,
      // Add other relevant stats here if needed
    ]);

    const pcaResult = performPCA(allGameStatsMatrix, 2); // Retain top 2 components

    console.log("PCA completed. Top 2 principal components retained.");

    // Organize yearly data by player_id and sort seasons descending
    const playerYearlyMap = {};
    yearlyData.forEach((record) => {
      if (!playerYearlyMap[record.player_id]) {
        playerYearlyMap[record.player_id] = [];
      }
      playerYearlyMap[record.player_id].push(record);
    });

    // Sort each player's seasons in descending order
    Object.keys(playerYearlyMap).forEach((playerId) => {
      playerYearlyMap[playerId].sort((a, b) => b.season - a.season);
    });

    // Initialize an array to hold all upsert records for bulk upsert
    const upsertRecords = [];

    // Iterate over each game to calculate and upsert Sko scores
    for (let index = 0; index < gameStatsData.length; index++) {
      const game = gameStatsData[index];
      const playerId = game.player_id;
      const playerSeasons = playerYearlyMap[playerId];

      if (!playerSeasons || playerSeasons.length === 0) {
        console.warn(
          `No historical data found for player ID ${playerId}. Skipping game on ${game.date}.`
        );
        continue;
      }

      // Determine the season for the current game
      const gameSeason = getSeasonFromDate(game.date);

      // Filter seasons up to the game season
      const relevantSeasons = playerSeasons.filter(
        (season) => season.season <= gameSeason
      );

      if (relevantSeasons.length === 0) {
        console.warn(
          `No seasons found for player ID ${playerId} up to game season ${gameSeason}. Skipping.`
        );
        continue;
      }

      // Calculate for 3-year, 2-year, and 1-year (last year) periods
      const periods = {
        three: relevantSeasons.slice(0, 3),
        two: relevantSeasons.slice(0, 2),
        last: relevantSeasons.slice(0, 1),
      };

      const perGameAverages = {};
      const stdDevs = {};

      for (const [key, seasons] of Object.entries(periods)) {
        if (seasons.length === 0) {
          console.log(
            `Player ID ${playerId} has less than ${
              key === "three" ? 3 : key === "two" ? 2 : 1
            } seasons. Skipping ${key}-year average.`
          );
          perGameAverages[key] = null;
          stdDevs[key] = null;
          continue;
        }

        // Sum counting stats
        const countingSums = {
          goals: 0,
          assists: 0,
          points: 0,
          shots: 0,
          time_on_ice: 0,
          es_goals_for: 0,
          pp_goals_for: 0,
          sh_goals_for: 0,
          total_primary_assists: 0,
          total_secondary_assists: 0,
          sog_per_60: 0,
        };

        seasons.forEach((season) => {
          countingSums.goals += season.goals || 0;
          countingSums.assists += season.assists || 0;
          countingSums.points += season.points || 0;
          countingSums.shots += season.shots || 0;
          countingSums.time_on_ice += season.time_on_ice || 0;
          countingSums.es_goals_for += season.es_goals_for || 0;
          countingSums.pp_goals_for += season.pp_goals_for || 0;
          countingSums.sh_goals_for += season.sh_goals_for || 0;
          countingSums.total_primary_assists +=
            season.total_primary_assists || 0;
          countingSums.total_secondary_assists +=
            season.total_secondary_assists || 0;
          countingSums.sog_per_60 += season.sog_per_60 || 0;
        });

        // Total games played over the seasons
        const totalGamesPlayed = seasons.reduce(
          (sum, season) => sum + (season.games_played || 0),
          0
        );

        if (totalGamesPlayed === 0) {
          console.warn(
            `Player ID ${playerId} has zero games played in the ${key}-year period. Skipping ${key}-year average.`
          );
          perGameAverages[key] = null;
          stdDevs[key] = null;
          continue;
        }

        // Calculate per-game rates
        const perGameRates = {};
        const countingStats = [
          "goals",
          "assists",
          "points",
          "shots",
          "time_on_ice",
          "es_goals_for",
          "pp_goals_for",
          "sh_goals_for",
          "total_primary_assists",
          "total_secondary_assists",
          "sog_per_60",
        ];

        countingStats.forEach((stat) => {
          perGameRates[stat] = countingSums[stat] / totalGamesPlayed;
        });

        // Average rate stats
        const rateAverages = {
          shooting_percentage: mean(
            seasons.map((season) => season.shooting_percentage || 0)
          ),
          on_ice_shooting_pct: mean(
            seasons.map((season) => season.on_ice_shooting_pct || 0)
          ),
          zone_start_pct: mean(
            seasons.map((season) => season.zone_start_pct || 0)
          ),
          pp_toi_pct_per_game: mean(
            seasons.map((season) => season.pp_toi_pct_per_game || 0)
          ),
          ipp: mean(seasons.map((season) => season.ipp || 0)),
        };

        // Combine per-game counting rates and rate stats
        const combinedAverages = {
          ...perGameRates,
          ...rateAverages,
        };

        // Calculate standard deviations for per-game counting rates
        const countingValues = {};
        countingStats.forEach((stat) => {
          countingValues[stat] = seasons.map((season) => {
            if (stat === "sog_per_60") {
              return season.sog_per_60 || 0;
            }
            const games = season.games_played || 1;
            return (season[stat] || 0) / games;
          });
        });

        const countingStd = {};
        countingStats.forEach((stat) => {
          countingStd[stat] = stdDev(countingValues[stat]);
        });

        // Calculate standard deviations for rate stats
        const rateStats = [
          "shooting_percentage",
          "on_ice_shooting_pct",
          "zone_start_pct",
          "pp_toi_pct_per_game",
          "ipp",
        ];

        const rateValues = {};
        rateStats.forEach((stat) => {
          rateValues[stat] = seasons.map((season) => season[stat] || 0);
        });

        const rateStd = {};
        rateStats.forEach((stat) => {
          rateStd[stat] = stdDev(rateValues[stat]);
        });

        // Combine counting and rate standard deviations
        const combinedStd = {
          ...countingStd,
          ...rateStd,
        };

        perGameAverages[key] = combinedAverages;
        stdDevs[key] = combinedStd;
      }

      // Calculate Weighted Per-Game Averages
      // Weighted = (last year *3 + last 2 years *2 + last 3 years *1) /6
      let weightedPerGame = null;
      let weightedStdDev = null;
      if (
        periods.three.length >= 1 &&
        periods.two.length >= 1 &&
        periods.last.length >= 1
      ) {
        const lastYear = perGameAverages.last;
        const twoYear = perGameAverages.two;
        const threeYear = perGameAverages.three;

        if (lastYear && twoYear && threeYear) {
          const weightedAverages = {};
          Object.keys(lastYear).forEach((stat) => {
            weightedAverages[stat] =
              ((lastYear[stat] || 0) * 3 +
                (twoYear[stat] || 0) * 2 +
                (threeYear[stat] || 0) * 1) /
              6;
          });

          // Calculate standard deviations for weighted per-game rates
          // For simplicity, we'll average the standard deviations
          const weightedStd = {};
          Object.keys(weightedAverages).forEach((stat) => {
            weightedStd[stat] =
              ((stdDevs.last[stat] || 0) * 3 +
                (stdDevs.two[stat] || 0) * 2 +
                (stdDevs.three[stat] || 0) * 1) /
              6;
          });

          weightedPerGame = weightedAverages;
          weightedStdDev = weightedStd;
        }
      }

      // Initialize player game queue and Bayesian parameters if not present
      if (!playerGameQueues[playerId]) {
        playerGameQueues[playerId] = [];
      }
      if (!playerBayesianParams[playerId]) {
        playerBayesianParams[playerId] = {};
        // Initialize Bayesian parameters with historical averages
        Object.keys(statWeights).forEach((stat) => {
          playerBayesianParams[playerId][stat] = {
            mean: perGameAverages.last[stat] || 0,
            variance: Math.pow(stdDevs.last[stat] || 1, 2),
          };
        });
      }

      // Maintain the game queue
      const gameQueue = playerGameQueues[playerId];
      gameQueue.push(game);
      if (gameQueue.length > ROLLING_WINDOW_SIZE) {
        gameQueue.shift(); // Remove the oldest game
      }

      // Calculate rolling averages for desired stats
      const rollingAverages = {};
      [
        "shooting_percentage",
        "ipp",
        "on_ice_shooting_pct",
        "a1_a2_percentage",
        "sog_per_60",
        "pp_percentage",
      ].forEach((stat) => {
        rollingAverages[stat] = calculateRollingAverage(gameQueue, stat);
      });

      // Prepare game stats for comparison
      const totalAssists =
        (game.total_primary_assists || 0) + (game.total_secondary_assists || 0);
      const a1_a2_percentage =
        game.total_primary_assists != null &&
        game.total_secondary_assists != null &&
        totalAssists > 0
          ? (game.total_primary_assists / totalAssists) * 100
          : 0; // Prevent NaN

      const gameStatsPrepared = {
        shooting_percentage: game.shooting_percentage || 0,
        ipp: game.ipp || 0,
        on_ice_shooting_pct: game.on_ice_shooting_pct || 0,
        zone_start_pct: game.zone_start_pct || 0,
        pp_toi_pct_per_game: game.pp_toi_pct_per_game || 0,
        sog_per_60: game.sog_per_60 || 0,
        a1_a2_percentage: a1_a2_percentage,
        pp_percentage: game.pp_percentage || 0, // Ensure PP% is included
        goals: game.goals || 0, // Counting Stat
        assists: game.assists || 0, // Counting Stat
        points: game.points || 0, // Counting Stat
        shots: game.shots || 0, // Counting Stat
        time_on_ice: game.time_on_ice || 0, // Counting Stat
        es_goals_for: game.es_goals_for || 0, // Counting Stat
        pp_goals_for: game.pp_goals_for || 0, // Counting Stat
        sh_goals_for: game.sh_goals_for || 0, // Counting Stat
        total_primary_assists: game.total_primary_assists || 0, // Counting Stat
        total_secondary_assists: game.total_secondary_assists || 0, // Counting Stat
        // sog_per_60 is already included above
      };

      // Retrieve PCA score for the current game
      const pcaScore = pcaResult.transformedData[index][0]; // First principal component
      gameStatsPrepared.pca_score = pcaScore;

      // Debug Logging: Game Stats
      console.log(
        `\nProcessing Game - Player ID: ${playerId}, Date: ${game.date}`
      );
      console.log(`Game Stats: ${JSON.stringify(gameStatsPrepared)}`);
      console.log(`PCA Score (Component 1): ${pcaScore}`);

      // Bayesian Inference Update
      Object.keys(statWeights).forEach((stat) => {
        const prior = playerBayesianParams[playerId][stat];
        const observation = gameStatsPrepared[stat] || 0;
        const observationVariance = STAT_VARIANCES[stat] || 1; // Use predefined variance
        const updated = bayesianUpdate(prior, observation, observationVariance);
        playerBayesianParams[playerId][stat] = updated;
      });

      // Calculate z-scores based on Bayesian posterior means
      const zScoresBayesian = {};
      Object.keys(statWeights).forEach((stat) => {
        const posteriorMean = playerBayesianParams[playerId][stat].mean;
        const posteriorStdDev = Math.sqrt(
          playerBayesianParams[playerId][stat].variance
        );
        zScoresBayesian[stat] =
          posteriorStdDev === 0
            ? 0
            : (gameStatsPrepared[stat] - posteriorMean) / posteriorStdDev;
      });

      // Incorporate PCA score into z-scores (optional)
      zScoresBayesian.pca_score = pcaScore; // Treat PCA score as an additional stat

      // Calculate Sko score using Bayesian z-scores
      const skoScoreBayesian = calculateSkoScore(zScoresBayesian, statWeights);

      // Calculate p-values for sustainability assessment
      const pValues = {};
      Object.keys(zScoresBayesian).forEach((stat) => {
        pValues[stat] = calculateProbability(zScoresBayesian[stat]);
      });

      // Aggregate p-values (average p-value)
      const averagePValue =
        Object.values(pValues).reduce((acc, val) => acc + val, 0) /
        Object.values(pValues).length;

      // Assess sustainability based on Sko score and p-value
      const sustainabilityAssessment = assessSustainability(
        skoScoreBayesian,
        averagePValue,
        SIGNIFICANCE_LEVEL
      );

      // Debug Logging: Sko Scores and Assessment
      console.log(
        `Sko Scores Breakdown (Bayesian): ${JSON.stringify(zScoresBayesian)}`
      );
      console.log(`Aggregated Sko Score (Bayesian): ${skoScoreBayesian}`);
      console.log(`Average p-value: ${averagePValue.toFixed(4)}`);
      console.log(`Sustainability Assessment: ${sustainabilityAssessment}`);

      // Calculate separate Sko scores
      const skoScoreThreeYear = calculatePeriodSkoScore(
        gameStatsPrepared,
        perGameAverages,
        stdDevs,
        "three",
        statWeights
      );
      const skoScoreTwoYear = calculatePeriodSkoScore(
        gameStatsPrepared,
        perGameAverages,
        stdDevs,
        "two",
        statWeights
      );
      const skoScoreLastYear = calculatePeriodSkoScore(
        gameStatsPrepared,
        perGameAverages,
        stdDevs,
        "last",
        statWeights
      );
      const skoScoreWeighted = calculatePeriodSkoScore(
        gameStatsPrepared,
        perGameAverages,
        stdDevs,
        "weight",
        statWeights
      );

      // Collect upsert record
      upsertRecords.push({
        player_id: playerId,
        player_name: game.player_name,
        date: game.date,
        sko_score: skoScoreBayesian,
        sko_v_three: skoScoreThreeYear,
        sko_v_two: skoScoreTwoYear,
        sko_v_weight: skoScoreWeighted,
        sko_v_last: skoScoreLastYear,
        sustainability: sustainabilityAssessment,
        z_scores: zScoresBayesian,
        p_values: pValues,
      });
    }

    // Perform bulk upsert
    if (upsertRecords.length > 0) {
      try {
        const { error: bulkUpsertError } = await supabase
          .from("sko_trends")
          .upsert(upsertRecords, {
            onConflict: ["player_id", "date"],
          });

        if (bulkUpsertError) {
          console.error(`Bulk upsert error: ${bulkUpsertError.message}`);
        } else {
          console.log(
            `Successfully upserted ${upsertRecords.length} sko scores.`
          );
        }
      } catch (error) {
        console.error(`Supabase bulk upsert error:`, error);
      }
    }

    console.log("All Sko scores have been processed and upserted.");
  } catch (error) {
    console.error("Unexpected error in calculateAndUpsertSkoScores:", error);
  }
}

// Execute the main function
calculateAndUpsertSkoScores();

// Export the main function if needed elsewhere
module.exports = {
  calculateAndUpsertSkoScores,
};
