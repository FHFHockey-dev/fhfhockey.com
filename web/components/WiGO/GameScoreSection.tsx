// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/GameScoreSection.tsx

import React from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import WigoSectionCard from "./WigoSectionCard";

interface GameScoreSectionProps {
  // Allow null/undefined to be passed down
  playerId: number | null | undefined;
  seasonId?: number | null;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({
  playerId,
  seasonId
}) => {
  return (
    <WigoSectionCard title="Game Score">
        <GameScoreLineChart playerId={playerId} seasonId={seasonId} />
    </WigoSectionCard>
  );
};

export default GameScoreSection;
