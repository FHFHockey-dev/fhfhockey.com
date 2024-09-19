// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\SkoDashboard\PlayerCard.tsx

import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

interface PlayerCardProps {
  playerName: string;
  skoScore: number;
  // Add other relevant props as needed
}

const PlayerCard: React.FC<PlayerCardProps> = ({ playerName, skoScore }) => {
  return (
    <Card sx={{ minWidth: 275, mb: 2 }}>
      <CardContent>
        <Typography variant="h6" component="div">
          {playerName}
        </Typography>
        <Typography color="text.secondary">sKO Score: {skoScore}</Typography>
        {/* Add more player details here */}
      </CardContent>
    </Card>
  );
};

export default PlayerCard;
