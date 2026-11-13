// components/GameGrid/VerticalMatchupCell.tsx
import React from "react";
import Image from "next/legacy/image";
import Tooltip from "./PDHC/Tooltip";
import PoissonHeatmap from "./PDHC/PoissonHeatMap";
import { calculateBlendedWinOdds, formatWinOdds, GAME_GRID_WIN_ODDS } from "./utils/calcWinOdds";
import { useTeam } from "./contexts/GameGridContext";
import styles from "./GameGrid.module.scss"; // Or create a dedicated module if desired

type VerticalMatchupCellProps = {
  gameData: {
    id: number;
    season: number;
    homeTeam: {
      id: number;
      score?: number;
      winOdds?: number | null;
      apiWinOdds?: number | null;
    };
    awayTeam: {
      id: number;
      score?: number;
      winOdds?: number | null;
      apiWinOdds?: number | null;
    };
  };
  teamId: number;
};

export default function VerticalMatchupCell({
  gameData,
  teamId
}: VerticalMatchupCellProps) {
  const home = gameData.homeTeam.id === teamId;
  const opponent = home ? gameData.awayTeam : gameData.homeTeam;
  const opponentTeam = useTeam(opponent.id);

  if (!opponentTeam) return <div>-</div>;

  const hasResult =
    gameData.homeTeam.score !== undefined &&
    gameData.awayTeam.score !== undefined;
  // Win odds are read through the withheld path (decision 64), never from the raw payload.
  const us = home ? gameData.homeTeam : gameData.awayTeam;
  const blendedWinOdds = hasResult ? null : calculateBlendedWinOdds(us.winOdds, us.apiWinOdds);
  const oddsTitle = !hasResult && blendedWinOdds === null && GAME_GRID_WIN_ODDS.status === "unavailable"
    ? GAME_GRID_WIN_ODDS.message : undefined;
  const displayValue = hasResult
    ? `${gameData.homeTeam.score}-${gameData.awayTeam.score}`
    : blendedWinOdds !== null ? formatWinOdds(blendedWinOdds)
    : oddsTitle ? "Odds n/a" : "-";
  const cellLabel = `${home ? "Home game vs" : "Away game at"} ${opponentTeam.name}. ${
    oddsTitle ? `${displayValue}: ${oddsTitle}` : displayValue}. Open game details.`;

  const tooltipContent = (
    <div>
      <PoissonHeatmap
        homeTeamId={home ? gameData.homeTeam.id : opponent.id}
        awayTeamId={home ? opponent.id : gameData.homeTeam.id}
        gameId={gameData.id}
      />
    </div>
  );

  return (
    <Tooltip content={tooltipContent} label={cellLabel}>
      <div
        title={oddsTitle}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}
      >
        {/* <div>{displayValue}</div> */}
        <div>
          <Image
            className={styles.verticalTeamLogo}
            src={opponentTeam.logo}
            alt={`${opponentTeam.name} logo`}
            width={30}
            height={30}
            objectFit="contain"
            style={{ filter: "drop-shadow(0 0 1px white)" }}
          />
        </div>
      </div>
    </Tooltip>
  );
}
