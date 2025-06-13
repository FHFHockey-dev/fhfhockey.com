import React from "react";
import { PlayerStatsChart } from "./PlayerStatsChart";
import { PlayerRadarChart } from "./PlayerRadarChart";
import { PlayerContextualStats } from "./PlayerContextualStats";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { PlayerStatsAdvancedNote } from "./PlayerStatsAdvancedNote";
import { GameLogEntry, POSITION_STAT_CONFIGS } from "./types";
import styles from "./PlayerStats.module.scss";

interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
  team_id?: number;
}

interface PlayerAdvancedStatsProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showPlayoffData?: boolean;
  seasonTotals?: any[];
  playerId?: string | number;
  seasonId?: string | number | null;
  missedGames?: any[]; // Add missedGames prop
}

export function PlayerAdvancedStats({
  player,
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showPlayoffData = false,
  seasonTotals = [],
  playerId,
  seasonId,
  missedGames = [] // Add missedGames to destructured props
}: PlayerAdvancedStatsProps) {
  // Get position-specific advanced stats
  const positionConfig = React.useMemo(() => {
    if (!player) return POSITION_STAT_CONFIGS.C;
    const pos = player.position?.toUpperCase();
    if (pos === "LW" || pos === "RW") {
      return POSITION_STAT_CONFIGS.LW; // Use same config for both wings
    }
    return (
      POSITION_STAT_CONFIGS[pos as keyof typeof POSITION_STAT_CONFIGS] ||
      POSITION_STAT_CONFIGS.C
    );
  }, [player?.position]);

  // Use advanced stats from position config
  const advancedStats = positionConfig.advanced || [];

  return (
    <div className={styles.contentArea}>
      <PlayerStatsAdvancedNote showAdvanced={true} />

      <div className={styles.advancedGrid}>
        <div className={styles.advancedTable}>
          <PlayerStatsTable
            gameLog={gameLog}
            playoffGameLog={playoffGameLog}
            selectedStats={advancedStats}
            isGoalie={isGoalie}
            showAdvanced={true}
            showPlayoffData={showPlayoffData}
            playerId={playerId}
            playerTeamId={player.team_id}
            seasonId={seasonId}
          />
        </div>

        <div className={styles.chartWrapper}>
          <PlayerStatsChart
            gameLog={gameLog}
            playoffGameLog={playoffGameLog}
            selectedStats={advancedStats}
            showRollingAverage={false}
            title="Advanced Metrics Trends"
            showPlayoffData={showPlayoffData}
          />
        </div>
      </div>

      <div className={styles.advancedGrid}>
        <div className={styles.chartWrapper}>
          <PlayerRadarChart
            player={player}
            gameLog={gameLog}
            playoffGameLog={playoffGameLog}
            selectedStats={advancedStats}
            isGoalie={isGoalie}
            showPlayoffData={showPlayoffData}
          />
        </div>

        <div className={styles.contextualContainer}>
          <PlayerContextualStats
            player={player}
            gameLog={gameLog}
            playoffGameLog={playoffGameLog || []}
            seasonTotals={seasonTotals}
            isGoalie={isGoalie}
            playerId={
              typeof playerId === "string" ? Number(playerId) : playerId
            } // Convert string to number
            seasonId={seasonId} // Pass seasonId to PlayerContextualStats
            missedGames={missedGames} // Pass missedGames to PlayerContextualStats
          />
        </div>
      </div>
    </div>
  );
}
