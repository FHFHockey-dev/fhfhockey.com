// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\SkoDashboard\TopBottonPlayers.tsx

import React, { useEffect, useState } from "react";
import {
  Grid,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import supabase from "lib/supabase";

// Define a type for player data
interface PlayerSko {
  player_id: number;
  player_name: string;
  ema_sko: number;
}

const TopBottomPlayers: React.FC = () => {
  const [topPlayers, setTopPlayers] = useState<PlayerSko[]>([]);
  const [bottomPlayers, setBottomPlayers] = useState<PlayerSko[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopBottomPlayers = async () => {
      try {
        // Fetch top 10 players by sKO
        const { data: topData, error: topError } = await supabase
          .from("sko_skater_stats")
          .select("player_id, player_name, ema_sko") // Replace 'ema_sko' with your sKO field
          .order("ema_sko", { ascending: false })
          .limit(10);

        if (topError) throw topError;

        // Fetch bottom 10 players by sKO
        const { data: bottomData, error: bottomError } = await supabase
          .from("sko_skater_stats")
          .select("player_id, player_name, ema_sko") // Replace 'ema_sko' with your sKO field
          .order("ema_sko", { ascending: true })
          .limit(10);

        if (bottomError) throw bottomError;

        setTopPlayers(topData as PlayerSko[]);
        setBottomPlayers(bottomData as PlayerSko[]);
      } catch (error) {
        console.error("Error fetching top/bottom players:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopBottomPlayers();
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Grid container spacing={4}>
      {/* Top 10 Players */}
      <Grid item xs={12} md={6}>
        <Typography variant="h6" gutterBottom>
          Top 10 Most Sustainable Players
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small" aria-label="Top 10 Players">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Player Name</TableCell>
                <TableCell>sKO Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topPlayers.map((player, index) => (
                <TableRow key={player.player_id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{player.player_name}</TableCell>
                  <TableCell>{player.ema_sko.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>

      {/* Bottom 10 Players */}
      <Grid item xs={12} md={6}>
        <Typography variant="h6" gutterBottom>
          Bottom 10 Most Sustainable Players
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small" aria-label="Bottom 10 Players">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Player Name</TableCell>
                <TableCell>sKO Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bottomPlayers.map((player, index) => (
                <TableRow key={player.player_id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{player.player_name}</TableCell>
                  <TableCell>{player.ema_sko.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
};

export default TopBottomPlayers;
