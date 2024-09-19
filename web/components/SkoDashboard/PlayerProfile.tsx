// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\SkoDashboard\PlayerProfile.tsx

import React, { useEffect, useState } from "react";
import supabase from "lib/supabase";
import {
  Container,
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
import { format, parseISO } from "date-fns";

interface PlayerProfileProps {
  playerId: number;
}

interface PlayerStat {
  // Define necessary fields
  date: string;
  sko: number;
  // Add more fields as needed
}

const PlayerProfile: React.FC<PlayerProfileProps> = ({ playerId }) => {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        const { data, error } = await supabase
          .from("sko_skater_stats")
          .select("*")
          .eq("player_id", playerId)
          .order("date", { ascending: true });

        if (error) throw error;

        // Calculate sKO scores if not already present
        const calculatedStats = data.map((game: any) => {
          let sko = 0;
          // Define your sKO calculation
          sko += (game.shooting_percentage || 0) * 10;
          sko += (game.ipp || 0) * 20;
          sko += (game.sog_per_60 || 0) * 5;
          // Add more calculations as needed
          return {
            date: game.date,
            sko: sko,
            // Add more fields as needed
          };
        });

        setStats(calculatedStats);
      } catch (error) {
        console.error("Error fetching player stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, [playerId]);

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Player Profile
      </Typography>
      <Typography variant="h6" gutterBottom>
        Player ID: {playerId}
      </Typography>
      {/* Add more player details here */}

      <Typography variant="h6" gutterBottom>
        sKO Scores Over Time
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small" aria-label="Player sKO Scores">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>sKO Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.map((stat, index) => (
              <TableRow key={index}>
                <TableCell>
                  {format(parseISO(stat.date), "yyyy-MM-dd")}
                </TableCell>
                <TableCell>{stat.sko.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add charts or additional stats as needed */}
    </Container>
  );
};

export default PlayerProfile;
