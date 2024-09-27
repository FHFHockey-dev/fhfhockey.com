// web/components/GameLogTable.tsx

import React from "react";
import { CombinedGameLog } from "lib/supabase/utils/types";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

interface GameLogTableProps {
  gameLogs: CombinedGameLog[];
}

const GameLogTable: React.FC<GameLogTableProps> = ({ gameLogs }) => {
  return (
    <TableContainer component={Paper}>
      <Table aria-label="game log table">
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Goals</TableCell>
            <TableCell>A1</TableCell>
            <TableCell>A2</TableCell>
            <TableCell>Shots</TableCell>
            <TableCell>BLK</TableCell>
            <TableCell>PD</TableCell>
            <TableCell>PT</TableCell>
            <TableCell>FOW</TableCell>
            <TableCell>FOL</TableCell>
            <TableCell>CF</TableCell>
            <TableCell>CA</TableCell>
            <TableCell>GF</TableCell>
            <TableCell>GA</TableCell>
            <TableCell>GameScore</TableCell>
            <TableCell>Predicted GameScore</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {gameLogs.map((game) => (
            <TableRow key={game.date}>
              <TableCell>{game.date}</TableCell>
              <TableCell>{game.goals}</TableCell>
              <TableCell>{game.total_primary_assists}</TableCell>
              <TableCell>{game.total_secondary_assists}</TableCell>
              <TableCell>{game.shots}</TableCell>
              <TableCell>{game.blocked_shots}</TableCell>
              <TableCell>{game.penalties_drawn}</TableCell>
              <TableCell>{game.penalties}</TableCell>
              <TableCell>{game.total_fow}</TableCell>
              <TableCell>{game.total_fol}</TableCell>
              <TableCell>{game.usat_for}</TableCell>
              <TableCell>{game.usat_against}</TableCell>
              <TableCell>
                {game.es_goals_for + game.pp_goals_for + game.sh_goals_for}
              </TableCell>
              <TableCell>
                {game.es_goals_against +
                  game.pp_goals_against +
                  game.sh_goals_against}
              </TableCell>
              <TableCell>{game.gameScore?.toFixed(2)}</TableCell>
              <TableCell>{game.predictedGameScore?.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default GameLogTable;
