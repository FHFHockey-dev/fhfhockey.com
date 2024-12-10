// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\skoCharts.tsx
// web/pages/skoCharts.tsx

import React, { useEffect, useState } from "react";
import supabase from "lib/supabase";
import {
  PerGameStatSummaries,
  CharacteristicResult,
  Player,
  CombinedGameLog
} from "lib/supabase/utils/types";
import {
  computeStatSummaries,
  computeCharacteristicResults
} from "lib/supabase/utils/statistics";
import { calculateGameScore } from "lib/supabase/utils/calculations";
import {
  fetchGameLogs,
  fetchMostRecentSeason
} from "lib/supabase/utils/dataFetching";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
  Box
} from "@mui/material";
import LineChart from "components/SkoLineChart/LineChart";
import GameScoreChart from "components/GameScoreChart/GameScoreChart";
import GameLogTable from "components/GameScoreChart/GameLogTable";

interface ChartDataPoint {
  date: Date;
  sumOfZScores: number;
}

const SkoCharts: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [statSummaries, setStatSummaries] =
    useState<PerGameStatSummaries | null>(null);
  const [characteristicResults, setCharacteristicResults] = useState<
    CharacteristicResult[] | null
  >(null);
  const [thresholds, setThresholds] = useState<{
    T1: number;
    T2: number;
  } | null>(null);
  const [combinedGameLogs, setCombinedGameLogs] = useState<CombinedGameLog[]>(
    []
  );

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoadingPlayers(true);
      setError(null);
      let allPlayers: Player[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      try {
        while (hasMore) {
          const { data, error } = await supabase
            .from("sko_skater_years")
            .select("player_id, player_name")
            .order("player_name", { ascending: true })
            .limit(PAGE_SIZE)
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            throw error;
          }

          if (data && data.length > 0) {
            allPlayers = allPlayers.concat(data as Player[]);
            offset += PAGE_SIZE;
          } else {
            hasMore = false;
          }
        }

        // Deduplicate players by player_id
        const uniquePlayersMap = new Map<number, string>();
        allPlayers.forEach((player) => {
          if (!uniquePlayersMap.has(player.player_id)) {
            uniquePlayersMap.set(player.player_id, player.player_name);
          }
        });

        const uniquePlayers: Player[] = Array.from(
          uniquePlayersMap.entries()
        ).map(([player_id, player_name]) => ({ player_id, player_name }));

        setPlayers(uniquePlayers);
      } catch (err) {
        setError("Error fetching players.");
        console.error("Supabase Error:", err);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, []);

  useEffect(() => {
    if (selectedPlayer) {
      const fetchPlayerData = async () => {
        setLoadingStats(true);
        setError(null);
        setCombinedGameLogs([]);
        setChartData([]);
        setThresholds(null);

        try {
          // Fetch most recent season
          const mostRecentSeason = await fetchMostRecentSeason(
            selectedPlayer.player_id
          );
          if (!mostRecentSeason) {
            setError("Error fetching player's most recent season.");
            return;
          }

          // Fetch and combine game logs
          const { combinedGameLogs: fetchedLogs, error: logsError } =
            await fetchGameLogs(selectedPlayer.player_id, mostRecentSeason);

          if (logsError || !fetchedLogs) {
            setError(logsError || "Error fetching game logs.");
            return;
          }

          // Compute statistical summaries
          const statSummaries = computeStatSummaries(fetchedLogs);
          // Compute characteristic results
          const {
            results: characteristicResults,
            T1,
            T2
          } = computeCharacteristicResults(fetchedLogs, statSummaries);
          setThresholds({ T1, T2 });

          // Map characteristic results to game logs
          const characteristicMap = new Map<string, number>();
          characteristicResults.forEach((res) => {
            characteristicMap.set(
              res.gameDate,
              res.sumOfWeightedSquaredZScores
            );
          });

          // Calculate gameScore and integrate CV
          const processedGameLogs = fetchedLogs.map((game, index) => {
            // Calculate gameScore
            const gameScore = calculateGameScore(game);

            // Get CV
            const CV = characteristicMap.get(game.date) ?? null;

            // Calculate 10-game rolling average of CV
            const startIdx = Math.max(0, index - 9);
            const rollingWindow = characteristicResults.slice(
              startIdx,
              index + 1
            );
            const rollingCV =
              rollingWindow.reduce(
                (acc, res) => acc + res.sumOfWeightedSquaredZScores,
                0
              ) / rollingWindow.length;

            // Calculate confidenceMultiplier based on rollingCV
            let confidenceMultiplier = 1; // Default
            if (rollingCV <= T1) {
              confidenceMultiplier = 1;
            } else if (rollingCV <= T2) {
              confidenceMultiplier = 0.9; // Adjust as needed
            } else {
              confidenceMultiplier = 0.8; // Adjust as needed
            }

            // Predicted gameScore
            const predictedGameScore = gameScore * confidenceMultiplier;

            return {
              ...game,
              gameScore,
              CV,
              rollingCV,
              confidenceMultiplier,
              predictedGameScore
            };
          });

          setCombinedGameLogs(processedGameLogs);

          // Prepare data for the chart
          const data = characteristicResults.map((result) => ({
            date: new Date(result.gameDate),
            sumOfZScores: result.sumOfWeightedSquaredZScores
          }));

          setChartData(data);
        } catch (err) {
          setError("Error fetching player data.");
          console.error("Fetch Player Data Error:", err);
        } finally {
          setLoadingStats(false);
        }
      };

      fetchPlayerData();
    }
  }, [selectedPlayer]);

  return (
    <Box sx={{ padding: "20px" }}>
      <Typography variant="h4" gutterBottom>
        Player Performance Chart
      </Typography>
      {error && (
        <Typography variant="body1" color="error" gutterBottom>
          {error}
        </Typography>
      )}

      <Autocomplete
        options={players}
        getOptionLabel={(option) => option.player_name}
        onChange={(event, newValue) => {
          setSelectedPlayer(newValue);
        }}
        value={selectedPlayer}
        loading={loadingPlayers}
        isOptionEqualToValue={(option, value) =>
          option.player_id === value.player_id
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search Player"
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loadingPlayers ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
        // Ensure unique key with player_id
        renderOption={(props, option) => (
          <li {...props} key={option.player_id}>
            {option.player_name}
          </li>
        )}
        sx={{ marginBottom: "20px", width: 300 }}
      />

      {loadingStats && (
        <Typography variant="body1" gutterBottom>
          Loading player statistics...
        </Typography>
      )}

      {selectedPlayer && !loadingStats && error && (
        <Typography variant="body1" color="error">
          {error}
        </Typography>
      )}

      {chartData.length > 0 && (
        <Box sx={{ marginTop: "40px" }}>
          <Typography variant="h5" gutterBottom>
            Performance Over Time - {selectedPlayer?.player_name}
          </Typography>

          {/* Render LineChart */}
          <LineChart data={chartData} thresholds={thresholds ?? undefined} />
        </Box>
      )}
      {/* New GameScore Chart and Game Log Table */}
      {combinedGameLogs.length > 0 && (
        <Box sx={{ marginTop: "40px" }}>
          <Typography variant="h5" gutterBottom>
            GameScore Predictions - {selectedPlayer?.player_name}
          </Typography>

          {/* Render GameScore LineChart */}
          <GameScoreChart data={combinedGameLogs} />

          {/* Render Game Log Table */}
          <GameLogTable gameLogs={combinedGameLogs} />
        </Box>
      )}
    </Box>
  );
};

export default SkoCharts;
