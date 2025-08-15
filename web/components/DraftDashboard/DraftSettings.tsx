// components/DraftDashboard/DraftSettings.tsx

import React from "react";
import { DraftSettings as DraftSettingsType } from "./DraftDashboard";
import styles from "./DraftSettings.module.scss";

interface DraftSettingsProps {
  settings: DraftSettingsType;
  onSettingsChange: (newSettings: Partial<DraftSettingsType>) => void;
  isSnakeDraft: boolean;
  onSnakeDraftChange: (isSnake: boolean) => void;
  myTeamId: string;
  onMyTeamIdChange: (teamId: string) => void;
  // Add undo/reset props
  undoLastPick: () => void;
  resetDraft: () => void;
  draftHistory: any[];
  draftedPlayers: any[];
  currentPick: number;
  // NEW: custom team names for labeling options
  customTeamNames?: Record<string, string>;
}

const DraftSettings: React.FC<DraftSettingsProps> = ({
  settings,
  onSettingsChange,
  isSnakeDraft,
  onSnakeDraftChange,
  myTeamId,
  onMyTeamIdChange,
  undoLastPick,
  resetDraft,
  draftHistory,
  draftedPlayers,
  currentPick,
  customTeamNames = {}
}) => {
  const handleTeamCountChange = (count: number) => {
    const newDraftOrder = Array.from(
      { length: count },
      (_, i) => `Team ${i + 1}`
    );
    onSettingsChange({
      teamCount: count,
      draftOrder: newDraftOrder
    });

    // Reset my team if it's no longer valid
    if (!newDraftOrder.includes(myTeamId)) {
      onMyTeamIdChange("Team 1");
    }
  };

  const handleRosterConfigChange = (position: string, count: number) => {
    onSettingsChange({
      rosterConfig: {
        ...settings.rosterConfig,
        [position]: count
      }
    });
  };

  const totalRosterSpots = Object.values(settings.rosterConfig).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        <h1 className={styles.title}>
          Fantasy Hockey{" "}
          <span className={styles.titleAccent}>Draft Dashboard</span>
        </h1>
        <div className={styles.draftTypeToggle}>
          <button
            className={`${styles.toggleButton} ${!isSnakeDraft ? styles.active : ""}`}
            onClick={() => onSnakeDraftChange(false)}
          >
            Standard
          </button>
          <button
            className={`${styles.toggleButton} ${isSnakeDraft ? styles.active : ""}`}
            onClick={() => onSnakeDraftChange(true)}
          >
            Snake
          </button>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        {/* League Configuration */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>League Setup</h3>
          <div className={styles.settingRow}>
            <label className={styles.label}>Teams:</label>
            <select
              value={settings.teamCount}
              onChange={(e) => handleTeamCountChange(Number(e.target.value))}
              className={styles.select}
            >
              {[8, 10, 12, 14, 16].map((count) => (
                <option key={count} value={count}>
                  {count} Teams
                </option>
              ))}
            </select>
          </div>
          <div className={styles.settingRow}>
            <label className={styles.label}>My Team:</label>
            <select
              value={myTeamId}
              onChange={(e) => onMyTeamIdChange(e.target.value)}
              className={styles.select}
            >
              {settings.draftOrder.map((teamId) => (
                <option key={teamId} value={teamId}>
                  {customTeamNames[teamId] || teamId}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Roster Configuration */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>
            Roster Spots
            <span className={styles.rosterTotal}>
              {totalRosterSpots} Roster Spots
            </span>
          </h3>
          <div className={styles.rosterGrid}>
            {Object.entries(settings.rosterConfig).map(([position, count]) => (
              <div key={position} className={styles.rosterSetting}>
                <label className={styles.positionLabel}>
                  {position.toUpperCase()}:
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={count}
                  onChange={(e) =>
                    handleRosterConfigChange(position, Number(e.target.value))
                  }
                  className={styles.numberInput}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Scoring Categories */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>Scoring Categories</h3>
          <div className={styles.scoringGrid}>
            {Object.entries(settings.scoringCategories)
              .slice(0, 6)
              .map(([stat, points]) => (
                <div key={stat} className={styles.scoringSetting}>
                  <label className={styles.statLabel}>{stat}:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={points}
                    onChange={(e) =>
                      onSettingsChange({
                        scoringCategories: {
                          ...settings.scoringCategories,
                          [stat]: Number(e.target.value)
                        }
                      })
                    }
                    className={styles.pointsInput}
                  />
                </div>
              ))}
            <button className={styles.expandButton}>
              +{Object.keys(settings.scoringCategories).length - 6} more
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>Quick Actions</h3>
          <div className={styles.actionButtons}>
            <button
              className={styles.actionButton}
              onClick={undoLastPick}
              disabled={draftHistory.length === 0}
              title={
                draftHistory.length > 0
                  ? `Undo Pick #${currentPick - 1}`
                  : "No picks to undo"
              }
            >
              Undo Last Pick
            </button>
            <button
              className={styles.actionButton}
              onClick={resetDraft}
              disabled={draftedPlayers.length === 0}
              title="Reset entire draft"
            >
              Reset Draft
            </button>
            <button className={styles.actionButton}>Import Settings</button>
            <button className={styles.actionButton}>Export Settings</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftSettings;
