// lib/supabase/calculateSKO.js

const path = "./../../.env.local";
require("dotenv").config({ path: path });

const { createClient } = require("@supabase/supabase-js");
const fetch = require("node-fetch");

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

// Define the sKO calculation
function calculateSKO(playerStats) {
  if (!playerStats) return null;

  const {
    shooting_percentage,
    ixs_pct,
    ipp,
    on_ice_shooting_pct,
    sog_per_60,
    iscf_per_60,
    ihdcf_per_60,
    total_primary_assists,
    total_secondary_assists,
    pp_toi_pct_per_game,
    zone_start_pct,
    ixg,
  } = playerStats;

  const weights = {
    shootingPctWeight: 0.2,
    ippWeight: 0.15,
    onIceShootingPctWeight: 0.1,
    shotsPer60Weight: 0.2,
    iscfPer60Weight: 0.1,
    ihdcfPer60Weight: 0.1,
    assistRatioWeight: 0.05,
    ppTimeOnIceWeight: 0.1,
    zoneStartPctWeight: -0.1,
    ixgWeight: 0.05, // Example weight for ixg
  };

  const totalAssists =
    (total_primary_assists || 0) + (total_secondary_assists || 0);
  const assistRatio =
    totalAssists > 0 ? (total_primary_assists || 0) / totalAssists : 0;

  const sko =
    ((shooting_percentage / (ixs_pct || 1)) * weights.shootingPctWeight || 0) +
    ((ipp / 100) * weights.ippWeight || 0) +
    ((on_ice_shooting_pct / 100) * weights.onIceShootingPctWeight || 0) +
    (sog_per_60 * weights.shotsPer60Weight || 0) +
    (iscf_per_60 * weights.iscfPer60Weight || 0) +
    (ihdcf_per_60 * weights.ihdcfPer60Weight || 0) +
    (assistRatio * weights.assistRatioWeight || 0) +
    ((pp_toi_pct_per_game / 100) * weights.ppTimeOnIceWeight || 0) +
    ((zone_start_pct / 100) * weights.zoneStartPctWeight || 0) +
    ((ixg || 0) * weights.ixgWeight || 0);

  return sko;
}

// Function to calculate Exponential Moving Average (EMA)
function calculateEMA(previousEMA, currentValue, alpha = 0.3) {
  if (previousEMA === null || previousEMA === undefined) return currentValue;
  return alpha * currentValue + (1 - alpha) * previousEMA;
}

// Bayesian Updating function
function calculateBayesianUpdate(prior, observation, variance) {
  const precisionPrior = 1 / prior.variance;
  const precisionObservation = 1 / variance;

  const updatedMean =
    (precisionPrior * prior.mean + precisionObservation * observation) /
    (precisionPrior + precisionObservation);

  const updatedVariance = 1 / (precisionPrior + precisionObservation);

  return { mean: updatedMean, variance: updatedVariance };
}

// Main function to calculate and upsert sKO scores
async function calculateAndUpsertSKO() {
  const windowSizes = [1, 2, 3, 4, 5, 10]; // Define desired window sizes

  const { data: players, error: playersError } = await supabase
    .from("sko_skater_stats")
    .select("player_id")
    .distinct();

  if (playersError) {
    console.error("Error fetching distinct player IDs:", playersError);
    return;
  }

  for (const player of players) {
    const playerId = player.player_id;

    for (const windowSize of windowSizes) {
      const { data: gameStats, error: gameError } = await supabase
        .from("sko_skater_stats")
        .select("*")
        .eq("player_id", playerId)
        .order("date", { ascending: true })
        .limit(windowSize);

      if (gameError) {
        console.error(
          `Error fetching game stats for player ID ${playerId} with window size ${windowSize}:`,
          gameError
        );
        continue;
      }

      if (gameStats.length < windowSize) {
        console.warn(
          `Not enough data to calculate ${windowSize}-game sKO for player ID ${playerId}.`
        );
        continue;
      }

      let emaSko = null;
      let priorSko = { mean: 50, variance: 10 }; // Example prior; adjust as needed

      for (const game of gameStats) {
        const playerStatsForGame = {
          shooting_percentage: game.shooting_percentage,
          ixs_pct: game.ixs_pct,
          ipp: game.ipp,
          on_ice_shooting_pct: game.on_ice_shooting_pct,
          sog_per_60: game.sog_per_60,
          iscf_per_60: game.iscf_per_60,
          ihdcf_per_60: game.ihdcf_per_60,
          total_primary_assists: game.total_primary_assists,
          total_secondary_assists: game.total_secondary_assists,
          pp_toi_pct_per_game: game.pp_toi_pct_per_game,
          zone_start_pct: game.zone_start_pct,
          ixg: game.ixg,
        };

        const skoForGame = calculateSKO(playerStatsForGame);
        emaSko = calculateEMA(emaSko, skoForGame);

        // Bayesian Update
        const observationVariance = 5; // Example variance; adjust based on data
        priorSko = calculateBayesianUpdate(
          priorSko,
          skoForGame,
          observationVariance
        );
      }

      // Upsert the calculated sKO into the sko_trends table
      const { error: upsertError } = await supabase.from("sko_trends").upsert(
        {
          player_id: playerId,
          date: gameStats[gameStats.length - 1].date, // Latest game date in the window
          window_size: windowSize,
          ema_sko: emaSko,
          bayesian_sko: priorSko.mean,
        },
        {
          onConflict: ["player_id", "date", "window_size"],
        }
      );

      if (upsertError) {
        console.error(
          `Error upserting sKO for player ID ${playerId} with window size ${windowSize}:`,
          upsertError
        );
      } else {
        console.log(
          `Successfully upserted sKO for player ID ${playerId} with window size ${windowSize}`
        );
      }
    }
  }
}

// Run the main function
calculateAndUpsertSKO();
