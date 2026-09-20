import React, { useState } from "react";
import GameScoreLineChart from "./GameScoreLineChart";
import { CHART_COLORS } from "styles/wigoColors";
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
  const [resetKey, setResetKey] = useState(0);
  return (
    <WigoSectionCard title="Game Score" toolbar={<><span className="wigo-trend-legend"><span style={{ color: CHART_COLORS.BAR_PRIMARY }}>▮Score</span> · <span style={{ color: CHART_COLORS.LINE_PRIMARY }}>━5-GM</span> · <span style={{ color: CHART_COLORS.PP_TOI }}>━10-GM</span></span><button type="button" title="Drag to zoom; Shift+drag to pan; Reset restores all games" onClick={() => setResetKey(key => key + 1)}>Reset</button><details className="wigo-chart-help"><summary aria-label="Game Score model help">ⓘ</summary><p>Per-game score: 0.75×goals + 0.70×primary assists + 0.55×secondary assists + 0.075×shots + 0.05×blocks + 0.15×(penalties drawn − taken) + 0.01×(faceoffs won − lost) + 0.05×(shot attempts for − against) + 0.15×(on-ice goals for − against). Rolling means require five or ten consecutive games played with available scores; missing scores remain gaps.</p></details></>}>
      <GameScoreLineChart playerId={playerId} seasonId={seasonId} resetKey={resetKey} />
    </WigoSectionCard>
  );
};

export default GameScoreSection;
