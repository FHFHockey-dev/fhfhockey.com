import React from "react";
import { PlayerStatsChart } from "./PlayerStatsChart";
import { PlayerRadarChart } from "./PlayerRadarChart";
import { PlayerContextualStats } from "./PlayerContextualStats";
import { PlayerStatsTable } from "./PlayerStatsTable";
import { GameLogEntry } from "./types";
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
  seasonId
}: PlayerAdvancedStatsProps) {
  return (
    <div className={styles.contentArea}>
      <div className={styles.insightsGrid}>
        <div className={`${styles.insightCard} ${styles.neutral}`}>
          <div className={styles.insightLabel}>Advanced Statistics</div>
          <div className={styles.insightValue}>Enhanced Analytics</div>
          <div className={styles.insightDescription}>
            <strong>NST Data:</strong> Possession metrics (CF%, xGF%, HDCF%),
            zone entries, and individual impact measurements.
            <br />
            <strong>Key Metrics:</strong> Per-60 minute rates that normalize for
            ice time and provide deeper insights beyond traditional stats.
          </div>
        </div>
      </div>

      <div className={styles.advancedGrid}>
        <div className={styles.advancedTable}>
          <PlayerStatsTable
            gameLog={gameLog}
            playoffGameLog={playoffGameLog}
            selectedStats={selectedStats}
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
            selectedStats={selectedStats}
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
            selectedStats={selectedStats}
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
          />
        </div>
      </div>
    </div>
  );
}
