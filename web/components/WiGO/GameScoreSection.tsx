import React, { useState } from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import { WIGO_CHART_ROLES } from "styles/wigoColors";
import WigoSectionCard from "./WigoSectionCard";
import WigoHelp from "./WigoHelp";

interface GameScoreSectionProps {
  // Allow null/undefined to be passed down
  playerId: number | null | undefined;
  seasonId?: number | null;
}

const GameScoreSection: React.FC<GameScoreSectionProps> = ({
  playerId,
  seasonId
}) => {
  const [resetKey, setResetKey] = useState(0);
  return (
    <WigoSectionCard title="Game score" toolbar={<><span className="wigo-trend-legend"><span style={{ color: WIGO_CHART_ROLES.BAR }}>▮</span>Score · <span style={{ color: WIGO_CHART_ROLES.PRIMARY }}>━</span>5-GM · <span style={{ color: WIGO_CHART_ROLES.SECONDARY }}>━</span>10-GM</span><button type="button" aria-label="Reset" title="Drag to zoom; Shift+drag to pan; Reset restores all games" onClick={() => setResetKey(key => key + 1)}>↺</button><WigoHelp label="Game Score model help"><p>Per-game score: 0.75×goals + 0.70×primary assists + 0.55×secondary assists + 0.075×shots + 0.05×blocks + 0.15×(penalties drawn − taken) + 0.01×(faceoffs won − lost) + 0.05×(shot attempts for − against) + 0.15×(on-ice goals for − against). Unlike the published 5v5 model, the on-ice goal term counts all situations (even strength, power play and shorthanded), so power-play regulars score higher and penalty killers lower. Rolling means require five or ten consecutive games played with available scores; missing scores remain gaps.</p></WigoHelp></>}>
      <GameScoreLineChart playerId={playerId} seasonId={seasonId} resetKey={resetKey} />
    </WigoSectionCard>
  );
};

export default GameScoreSection;
