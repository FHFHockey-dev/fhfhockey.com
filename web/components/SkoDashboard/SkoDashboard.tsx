// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\SkoDashboard\SkoDashboard.tsx

import React, { useEffect, useState } from "react";
import supabase from "lib/supabase";
import {
  Container,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import TopBottomPlayers from "./TopBottonPlayers"; // Ensure correct filename
import StockChart from "./StockChart";
import {
  calculateBayesianUpdate,
  calculateEMA,
  calculateRollingAverage,
} from "../../utils/analytics";

// Define the structure of your data
interface SkoSkaterStat {
  player_id: number;
  player_name: string;
  date: string;
  position_code: string;
  games_played: number;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  shooting_percentage: number | null;
  time_on_ice: number | null; // in seconds
  on_ice_shooting_pct: number | null;
  zone_start_pct: number | null;
  pp_toi_pct_per_game: number | null;
  es_goals_for: number | null;
  pp_goals_for: number | null;
  sh_goals_for: number | null;
  total_primary_assists: number | null;
  total_secondary_assists: number | null;
  ipp: number | null;
  sog_per_60: number | null;
  iscf_per_60: number | null;
  ihdcf_per_60: number | null;
  ixg: number | null;
  ixs_pct: number | null;
}

interface SkoScore {
  player_id: number;
  player_name: string;
  date: string;
  sko: number;
}

interface EnhancedSkoScore extends SkoScore {
  ema_sko: number;
  rolling_avg_sko: number;
  bayesian_sko: number;
}

const SkoDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);

  const [stats, setStats] = useState<SkoSkaterStat[]>([]);
  const [skoScores, setSkoScores] = useState<SkoScore[]>([]);
  const [enhancedSkoScores, setEnhancedSkoScores] = useState<
    EnhancedSkoScore[]
  >([]);

  useEffect(() => {
    // Fetch data from Supabase
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("sko_skater_stats")
          .select(
            "player_id, player_name, date, position_code, games_played, goals, assists, points, shots, shooting_percentage, time_on_ice, on_ice_shooting_pct, zone_start_pct, pp_toi_pct_per_game, es_goals_for, pp_goals_for, sh_goals_for, total_primary_assists, total_secondary_assists, ipp, sog_per_60, iscf_per_60, ihdcf_per_60, ixg, ixs_pct"
          ) // Select specific fields to match SkoSkaterStat
          .order("date", { ascending: true });

        if (error) throw error;

        setStats(data as SkoSkaterStat[]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (stats.length === 0) return;

    // Calculate sKO scores for each game
    const calculateSkoScores = () => {
      const scores: SkoScore[] = stats.map((game) => {
        // Define your sKO calculation algorithm here
        // Example (you need to replace this with your actual formula):

        let sko = 0;

        if (game.shooting_percentage !== null) {
          sko += game.shooting_percentage * 10; // Weight for shooting percentage
        }

        if (game.ipp !== null) {
          sko += game.ipp * 20; // Weight for Individual Points Percentage
        }

        if (game.sog_per_60 !== null) {
          sko += game.sog_per_60 * 5; // Weight for Shots on Goal per 60 Minutes
        }

        // Add more factors as needed based on your data

        return {
          player_id: game.player_id,
          player_name: game.player_name,
          date: game.date,
          sko: sko,
        };
      });

      setSkoScores(scores);
    };

    calculateSkoScores();
  }, [stats]);

  useEffect(() => {
    if (skoScores.length === 0) return;

    // Calculate EMA, Rolling Average, and Bayesian sKO
    const calculateEnhancedScores = () => {
      const skoValues = skoScores.map((score) => score.sko);

      // Define window sizes
      const emaWindow = 10; // Example window size for EMA
      const rollingWindow = 5; // Example window size for Rolling Average

      const emaSko = calculateEMA(skoValues, emaWindow);
      const rollingAvgSko = calculateRollingAverage(skoValues, rollingWindow);

      // Initialize Bayesian prior
      let prior: { mean: number; variance: number } = {
        mean: 50,
        variance: 10,
      }; // Adjust based on your data

      const bayesianSko: number[] = [];

      skoValues.forEach((sko, index) => {
        // Define observation variance
        const observationVariance = 5; // Adjust based on your data

        const updated = calculateBayesianUpdate(
          prior,
          sko,
          observationVariance
        );
        bayesianSko.push(updated.mean);
        prior = updated; // Update prior for next iteration
      });

      const enhancedScores: EnhancedSkoScore[] = skoScores.map(
        (score, index) => ({
          ...score,
          ema_sko: emaSko[index],
          rolling_avg_sko: rollingAvgSko[index],
          bayesian_sko: bayesianSko[index],
        })
      );

      setEnhancedSkoScores(enhancedScores);
    };

    calculateEnhancedScores();
  }, [skoScores]);

  if (loading) {
    return (
      <Container>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        sKO Dashboard
      </Typography>

      <Grid container spacing={4}>
        {/* sKO Scores Table */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            sKO Scores per Game
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small" aria-label="sKO Scores Table">
              <TableHead>
                <TableRow>
                  <TableCell>Player Name</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Games Played</TableCell>
                  <TableCell>Goals</TableCell>
                  <TableCell>Assists</TableCell>
                  <TableCell>Points</TableCell>
                  <TableCell>Shots</TableCell>
                  <TableCell>sKO Score</TableCell>
                  <TableCell>EMA sKO</TableCell>
                  <TableCell>Rolling Avg sKO</TableCell>
                  <TableCell>Bayesian sKO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {enhancedSkoScores.map((row, index) => {
                  const game = stats.find(
                    (stat) =>
                      stat.player_id === row.player_id && stat.date === row.date
                  );

                  if (!game) return null;

                  return (
                    <TableRow key={`${row.player_id}-${row.date}`}>
                      <TableCell>{row.player_name}</TableCell>
                      <TableCell>
                        {format(parseISO(row.date), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell>{game.position_code}</TableCell>
                      <TableCell>{game.games_played}</TableCell>
                      <TableCell>{game.goals}</TableCell>
                      <TableCell>{game.assists}</TableCell>
                      <TableCell>{game.points}</TableCell>
                      <TableCell>{game.shots}</TableCell>
                      <TableCell>{row.sko.toFixed(2)}</TableCell>
                      <TableCell>{row.ema_sko.toFixed(2)}</TableCell>
                      <TableCell>{row.rolling_avg_sko.toFixed(2)}</TableCell>
                      <TableCell>{row.bayesian_sko.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* Top and Bottom 10 Players */}
        <Grid item xs={12}>
          <TopBottomPlayers />
        </Grid>

        {/* Stock Chart */}
        <Grid item xs={12}>
          <StockChart />
        </Grid>
      </Grid>
    </Container>
  );
};

export default SkoDashboard;
