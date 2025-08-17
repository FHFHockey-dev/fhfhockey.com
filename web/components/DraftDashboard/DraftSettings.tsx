// components/DraftDashboard/DraftSettings.tsx

import React from "react";
import type { DraftSettings as DraftSettingsType } from "./DraftDashboard";
import styles from "./DraftSettings.module.scss";

type LeagueType = "points" | "categories";

interface DraftSettingsProps {
  settings: DraftSettingsType;
  onSettingsChange: (newSettings: Partial<DraftSettingsType>) => void;
  isSnakeDraft: boolean;
  onSnakeDraftChange: (isSnake: boolean) => void;
  myTeamId: string;
  onMyTeamIdChange: (teamId: string) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  draftHistory: any[];
  draftedPlayers: any[];
  currentPick: number;
  customTeamNames?: Record<string, string>;
  goalieScoringCategories?: Record<string, number>;
  onGoalieScoringChange?: (values: Record<string, number>) => void;
  onOpenSummary?: () => void;
}

const CAT_KEYS = [
  "GOALS",
  "ASSISTS",
  "PP_POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS"
] as const;

type CatKey = (typeof CAT_KEYS)[number];

const SKATER_LABELS: Record<CatKey, string> = {
  GOALS: "G",
  ASSISTS: "A",
  PP_POINTS: "PPP",
  SHOTS_ON_GOAL: "SOG",
  HITS: "HIT",
  BLOCKED_SHOTS: "BLK"
};

const GOALIE_LABELS: Record<string, string> = {
  WINS_GOALIE: "W",
  SAVES_GOALIE: "SV",
  SHUTOUTS_GOALIE: "SHO",
  GOALS_AGAINST_GOALIE: "GAA",
  SAVE_PERCENTAGE: "SV%",
  GOALS_AGAINST_AVERAGE: "GAA"
};

function getShortLabel(statKey: string): string {
  if ((SKATER_LABELS as any)[statKey]) return (SKATER_LABELS as any)[statKey];
  if (GOALIE_LABELS[statKey]) return GOALIE_LABELS[statKey];
  switch (statKey) {
    case "GOALS":
      return "G";
    case "ASSISTS":
      return "A";
    case "PP_POINTS":
      return "PPP";
    case "SHOTS_ON_GOAL":
      return "SOG";
    case "HITS":
      return "HIT";
    case "BLOCKED_SHOTS":
      return "BLK";
    default:
      return statKey;
  }
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
  customTeamNames = {},
  goalieScoringCategories,
  onGoalieScoringChange,
  onOpenSummary
}) => {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("draftSettings.collapsed");
    return v === "true";
  });
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("draftSettings.collapsed", String(collapsed));
  }, [collapsed]);

  const handleTeamCountChange = (count: number) => {
    const newDraftOrder = Array.from(
      { length: count },
      (_, i) => `Team ${i + 1}`
    );
    onSettingsChange({
      teamCount: count,
      draftOrder: newDraftOrder
    });

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

  const leagueType: LeagueType = settings.leagueType || "points";
  const weights = settings.categoryWeights || ({} as Record<string, number>);
  const getWeight = (k: CatKey) =>
    typeof weights[k] === "number" ? weights[k] : 1;

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        <h1 className={styles.title}>
          Fantasy Hockey{" "}
          <span className={styles.titleAccent}>Draft Companion Dashboard</span>
        </h1>
        <div className={styles.headerActions}>
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
          <button
            type="button"
            className={styles.summaryButton}
            onClick={() => onOpenSummary && onOpenSummary()}
            disabled={!draftedPlayers.length}
            aria-label="Open Draft Summary"
            title="Open Draft Summary"
          >
            Open Draft Summary
          </button>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand settings" : "Collapse settings"}
            title={collapsed ? "Expand settings" : "Collapse settings"}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.settingsGrid}>
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
            <div className={styles.settingRow}>
              <label className={styles.label}>League Type:</label>
              <select
                value={leagueType}
                onChange={(e) =>
                  onSettingsChange({ leagueType: e.target.value as LeagueType })
                }
                className={styles.select}
              >
                <option value="points">Points</option>
                <option value="categories">Categories</option>
              </select>
            </div>
          </div>

          <div className={styles.settingsGroup}>
            <h3 className={styles.groupTitle}>
              Roster Spots
              <span className={styles.rosterTotal}>
                {totalRosterSpots} Roster Spots
              </span>
            </h3>
            <div className={styles.rosterGrid}>
              {Object.entries(settings.rosterConfig).map(
                ([position, count]) => (
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
                        handleRosterConfigChange(
                          position,
                          Number(e.target.value)
                        )
                      }
                      className={styles.numberInput}
                    />
                  </div>
                )
              )}
            </div>
          </div>

          <div
            className={`${styles.settingsGroup} ${styles.settingsGroupScoring}`}
          >
            <h3 className={styles.groupTitle}>
              {leagueType === "categories"
                ? "Category Weights"
                : "Scoring Categories"}
            </h3>
            {leagueType === "categories" ? (
              <div className={styles.scoringGrid}>
                {CAT_KEYS.map((k) => (
                  <div key={k} className={styles.scoringSetting}>
                    <label className={styles.statLabel}>
                      {SKATER_LABELS[k]}:
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={getWeight(k)}
                      onChange={(e) =>
                        onSettingsChange({
                          categoryWeights: {
                            ...settings.categoryWeights,
                            [k]: parseFloat(e.target.value)
                          }
                        })
                      }
                      className={styles.rangeInput}
                    />
                    <div className={styles.weightLabel}>
                      {getWeight(k).toFixed(1)}x
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className={styles.scoringSubgroup}>
                  <h4 className={styles.subgroupTitle}>Skater Scoring</h4>
                  <div className={styles.scoringGrid}>
                    {Object.entries(settings.scoringCategories)
                      .slice(0, 6)
                      .map(([stat, points]) => (
                        <div key={stat} className={styles.scoringSetting}>
                          <label className={styles.statLabel}>
                            {getShortLabel(stat)}:
                          </label>
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
                {goalieScoringCategories && onGoalieScoringChange && (
                  <div className={styles.scoringSubgroup}>
                    <h4 className={styles.subgroupTitle}>Goalie Scoring</h4>
                    <div className={styles.scoringGrid}>
                      {Object.entries(goalieScoringCategories).map(
                        ([stat, points]) => (
                          <div key={stat} className={styles.scoringSetting}>
                            <label className={styles.statLabel}>
                              {getShortLabel(stat)}:
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={points}
                              onChange={(e) =>
                                onGoalieScoringChange({
                                  ...goalieScoringCategories,
                                  [stat]: Number(e.target.value)
                                })
                              }
                              className={styles.pointsInput}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

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
      )}
    </div>
  );
};

export default DraftSettings;
