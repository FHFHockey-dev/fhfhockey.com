import React, { useState, useEffect, useMemo } from "react";
import supabase from "lib/supabase"; // Assuming lib/supabase is configured
import styles from "./PlayerPickupTable.module.scss";
import Image from "next/image";
import clsx from "clsx";

// TO DO
// integrate week score, dynamic. if toggle turns off a day, update score
// add Line/PP "extension" look from lines

// ---------------------------
// Type Definitions
// ---------------------------
export type UnifiedPlayerData = {
  nhl_player_id: string;
  nhl_player_name: string;
  nhl_team_abbreviation: string | null;
  yahoo_player_id: string | null;
  yahoo_player_name: string | null;
  yahoo_team: string | null;
  percent_ownership: number | null;
  eligible_positions: string[] | null;
  off_nights: number | null;
  points: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  pp_points: number | null;
  blocked_shots: number | null;
  hits: number | null;
  total_fow: number | null;
  penalty_minutes: number | null;
  sh_points: number | null;
  wins: number | null;
  saves: number | null;
  shots_against: number | null;
  shutouts: number | null;
  quality_start: number | null;
  goals_against_avg: number | null;
  save_pct: number | null;
  player_type: "skater" | "goalie";
  current_team_abbreviation: string | null;
  percent_games: number | null;
  status: string | null;
  injury_note: string | null;
};

export interface PlayerWithPercentiles extends UnifiedPlayerData {
  percentiles: Record<MetricKey, number>;
  composite: number; // Original overall score based on all relevant metrics
}

export interface PlayerWithScores extends PlayerWithPercentiles {
  displayScore: number; // The score shown in the table (can be composite, selected avg, or other avg)
  sortByValue: number; // The value used when sorting by the 'Score' column
  filterMode: "all" | "single" | "multiple" | "none"; // What kind of filtering is active for this player
  activeSelectedMetrics: MetricKey[]; // Which metrics were actually used for the score calculation
}

export type MetricKey =
  | "points"
  | "goals"
  | "assists"
  | "shots"
  | "pp_points"
  | "blocked_shots"
  | "hits"
  | "total_fow"
  | "penalty_minutes"
  | "sh_points"
  | "wins"
  | "saves"
  | "shots_against"
  | "shutouts"
  | "quality_start"
  | "goals_against_avg"
  | "save_pct"
  | "percent_games";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
}

// --- NEW: Interface for Mobile Detail Items ---
interface DetailItemData {
  key: MetricKey;
  label: string;
  value: number | undefined | null;
  displayValue: string;
}

// --- Base Metric Definitions (Used for Percentile Calculation, Presets etc.) ---
const skaterMetrics: MetricDefinition[] = [
  { key: "points", label: "PTS" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "shots", label: "SOG" },
  { key: "pp_points", label: "PPP" },
  { key: "blocked_shots", label: "BLK" },
  { key: "hits", label: "HIT" },
  { key: "total_fow", label: "FOW" },
  { key: "penalty_minutes", label: "PIM" },
  { key: "sh_points", label: "SHP" },
  { key: "percent_games", label: "GP%" } // GP% included for skaters
];

const goalieMetrics: MetricDefinition[] = [
  { key: "wins", label: "W" },
  { key: "saves", label: "SV" },
  { key: "shots_against", label: "SA" },
  { key: "shutouts", label: "SO" },
  { key: "quality_start", label: "QS" },
  { key: "goals_against_avg", label: "GAA" },
  { key: "save_pct", label: "SV%" },
  { key: "percent_games", label: "GP%" } // GP% included for goalies
];

// --- NEW: Define Metric Groups for Filter UI ---
const skaterPointKeys: MetricKey[] = [
  "goals",
  "assists",
  "points",
  "pp_points",
  "sh_points"
];
const skaterPeripheralKeys: MetricKey[] = [
  "shots",
  "blocked_shots",
  "hits",
  "total_fow",
  "penalty_minutes"
];
const goalieStatKeys: MetricKey[] = [
  "wins",
  "saves",
  "shots_against",
  "save_pct",
  "quality_start",
  "goals_against_avg",
  "shutouts"
];
const gamePlayedKey: MetricKey = "percent_games"; // Keep GP% separate

// ---------------------------
// Default Filter Settings & Props
// ---------------------------
const defaultOwnershipThreshold = 50;
const defaultTeamFilter = "ALL";
const defaultPositions: Record<string, boolean> = {
  C: true,
  LW: true,
  RW: true,
  D: true,
  G: true
};
export type TeamWeekData = {
  teamAbbreviation: string;
  gamesPlayed: number;
  offNights: number;
  avgOpponentPointPct: number;
};
export type PlayerPickupTableProps = { teamWeekData?: TeamWeekData[] };

// ---------------------------
// Helper Functions & Hooks
// ---------------------------

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

function shortenName(fullName: string): string {
  if (!fullName) return "N/A";
  const parts = fullName.split(" ");
  if (parts.length <= 1) return fullName;
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

const playerNameMapping: Record<string, string> = {
  "Alex Wennberg": "Alexander Wennberg"
};
const normalizePlayerName = (name: string | null): string => {
  if (!name) return "N/A";
  const mappedName = playerNameMapping[name] || name;
  return shortenName(mappedName);
};

const normalizeTeamAbbreviation = (
  team: string | null,
  expectedTeam?: string | null
): string | null => {
  if (!team) return null;
  const mapping: Record<string, string> = {
    TB: "TBL",
    SJ: "SJS",
    NJ: "NJD",
    LA: "LAK"
  };
  const teamsArray = team.split(",").map((t) => t.trim());
  const mappedTeams = teamsArray.map((t) => mapping[t] || t);
  if (expectedTeam) {
    const expected = mapping[expectedTeam] || expectedTeam;
    const match = mappedTeams.find((t) => t === expected);
    if (match) return match;
  }
  return mappedTeams[0] || null;
};

function getRankColorStyle(
  percentile: number | undefined | null
): React.CSSProperties {
  if (percentile === undefined || percentile === null) {
    return { backgroundColor: `rgba(128, 128, 128, 0.45)` }; // Grey for undefined/null
  }
  const weight = Math.max(0, Math.min(100, percentile)) / 100;
  // Red to Green gradient
  const r = Math.round(255 * (1 - weight));
  const g = Math.round(255 * weight);
  return { backgroundColor: `rgba(${r}, ${g}, 0, 0.45)` };
}

// ---------------------------
// Child Components
// ---------------------------

// Filters Component
interface FiltersProps {
  ownershipThreshold: number;
  setOwnershipThreshold: (value: number) => void;
  teamFilter: string;
  setTeamFilter: (value: string) => void;
  selectedPositions: Record<string, boolean>;
  setSelectedPositions: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  resetFilters: () => void;
  teamOptions: string[];
  isMobile: boolean;
  isMobileMinimized: boolean;
  toggleMobileMinimize: () => void;
  // --- Props for Metric Filtering ---
  allPossibleMetrics: MetricDefinition[]; // Still needed for lookups and presets
  selectedMetrics: Record<MetricKey, boolean>;
  setSelectedMetrics: React.Dispatch<
    React.SetStateAction<Record<MetricKey, boolean>>
  >;
}

const Filters: React.FC<FiltersProps> = ({
  ownershipThreshold,
  setOwnershipThreshold,
  teamFilter,
  setTeamFilter,
  selectedPositions,
  setSelectedPositions,
  resetFilters,
  teamOptions,
  isMobile,
  isMobileMinimized,
  toggleMobileMinimize,
  // --- Destructure metric props ---
  allPossibleMetrics,
  selectedMetrics,
  setSelectedMetrics
}) => {
  const handlePositionChange = (pos: string) => {
    setSelectedPositions((prev: Record<string, boolean>) => ({
      ...prev,
      [pos]: !prev[pos]
    }));
  };

  const handleMetricChange = (key: MetricKey) => {
    setSelectedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectPreset = (type: "all" | "skater" | "goalie" | "none") => {
    const nextState: Record<MetricKey, boolean> = Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, false])
    ) as Record<MetricKey, boolean>; // Start fresh with all false

    // Use the original skater/goalie metric definitions for presets
    const skaterKeys = new Set(skaterMetrics.map((m) => m.key));
    const goalieKeys = new Set(goalieMetrics.map((m) => m.key));

    allPossibleMetrics.forEach((metric) => {
      switch (type) {
        case "all":
          nextState[metric.key] = true;
          break;
        case "none":
          nextState[metric.key] = false;
          break;
        case "skater":
          // Only select metrics defined in the base skaterMetrics array
          nextState[metric.key] = skaterKeys.has(metric.key);
          break;
        case "goalie":
          // Only select metrics defined in the base goalieMetrics array
          nextState[metric.key] = goalieKeys.has(metric.key);
          break;
      }
    });
    setSelectedMetrics(nextState);
  };

  // Determine active metrics count and states for disabling buttons
  const activeMetricKeys = useMemo(
    () =>
      Object.entries(selectedMetrics)
        .filter(([, isSelected]) => isSelected)
        .map(([key]) => key as MetricKey),
    [selectedMetrics]
  );

  const isAllSelected = activeMetricKeys.length === allPossibleMetrics.length;
  const isNoneSelected = activeMetricKeys.length === 0;

  // Helper to find metric definition (label) by key
  const getMetricDefinition = (
    key: MetricKey
  ): MetricDefinition | undefined => {
    return allPossibleMetrics.find((m) => m.key === key);
  };

  // Helper function to render a group of checkboxes
  const renderMetricGroup = (title: string, metricKeys: MetricKey[]) => {
    // Filter out any keys that might not be in allPossibleMetrics (optional safety check)
    const validMetrics = metricKeys
      .map((key) => getMetricDefinition(key))
      .filter((metric): metric is MetricDefinition => !!metric); // Type guard

    if (validMetrics.length === 0) return null; // Don't render empty groups

    return (
      <div className={styles.metricGroup} key={title}>
        {" "}
        {/* Add key for react lists */}
        <span className={styles.metricGroupTitle}>{title}</span>
        <div className={styles.metricGroupCheckboxes}>
          {validMetrics.map((metric) => (
            <label key={metric.key} className={styles.metricCheckbox}>
              <input
                type="checkbox"
                checked={selectedMetrics[metric.key] ?? false}
                onChange={() => handleMetricChange(metric.key)}
              />{" "}
              {metric.label}
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Handler for title click, only works on mobile
  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;

  return (
    <div
      className={clsx(
        styles.filters,
        isMobile && isMobileMinimized && styles.minimized
      )}
    >
      <div
        className={styles.filtersTitle}
        onClick={handleTitleClick}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? !isMobileMinimized : undefined}
        aria-controls={isMobile ? "player-table-content" : undefined}
      >
        <span className={styles.acronym}>BPA</span> -{" "}
        <span className={styles.acronym}>B</span>est{" "}
        <span className={styles.acronym}>P</span>layer{" "}
        <span className={styles.acronym}>A</span>vailable
        {isMobile && (
          <span
            className={clsx(
              styles.minimizeToggleIcon,
              isMobileMinimized && styles.minimized
            )}
            aria-hidden="true"
          >
            ▼
          </span>
        )}
      </div>

      {(!isMobile || !isMobileMinimized) && (
        <>
          {/* --- Ownership, Team, Position Filters (Unchanged) --- */}
          {isMobile ? (
            <div className={styles.filterContainerMobile}>
              <div className={styles.ownershipTeamContainer}>
                <div className={styles.filterRowMobileOwnership}>
                  <label className={styles.labelMobile}>
                    Own %: {ownershipThreshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ownershipThreshold}
                    onChange={(e) =>
                      setOwnershipThreshold(Number(e.target.value))
                    }
                    className={styles.sliderMobile}
                  />
                </div>
                <div className={styles.filterRowMobileTeam}>
                  <label className={styles.labelMobile}>Team:</label>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className={styles.selectMobile}
                  >
                    {teamOptions.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.filterRowMobile}>
                <span className={styles.labelMobile}>Positions:</span>
                <div className={styles.positionCheckboxGroup}>
                  {Object.keys(defaultPositions).map((pos) => (
                    <label key={pos} className={styles.positionCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedPositions[pos] ?? false}
                        onChange={() => handlePositionChange(pos)}
                      />{" "}
                      {pos}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.filterContainer}>
              <div className={styles.filterRow}>
                <label className={styles.label}>
                  Ownership %: {ownershipThreshold}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ownershipThreshold}
                  onChange={(e) =>
                    setOwnershipThreshold(Number(e.target.value))
                  }
                  className={styles.slider}
                />
              </div>
              <div className={styles.filterRow}>
                <label className={styles.label}>Team:</label>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className={styles.select}
                >
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.filterRow}>
                <span className={styles.label}>Positions:</span>
                <div className={styles.positionCheckboxGroup}>
                  {Object.keys(defaultPositions).map((pos) => (
                    <label key={pos} className={styles.positionCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedPositions[pos] ?? false}
                        onChange={() => handlePositionChange(pos)}
                      />{" "}
                      {pos}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* --- MODIFIED: Metric Filter Section --- */}
          <div className={styles.metricFilterContainer}>
            <div className={styles.metricFilterHeader}>
              <span className={styles.label}>Filter by Metrics:</span>
              <div className={styles.metricPresetButtons}>
                {/* Preset buttons remain the same */}
                <button
                  onClick={() => handleSelectPreset("all")}
                  disabled={isAllSelected}
                >
                  All
                </button>
                <button onClick={() => handleSelectPreset("skater")}>
                  Skaters
                </button>
                <button onClick={() => handleSelectPreset("goalie")}>
                  Goalies
                </button>
                <button
                  onClick={() => handleSelectPreset("none")}
                  disabled={isNoneSelected}
                >
                  None
                </button>
              </div>
            </div>

            {/* NEW: Container for all metric groups */}
            <div className={styles.metricGroupsWrapper}>
              {/* Render each group using the helper function */}
              {renderMetricGroup("Skater Points", skaterPointKeys)}
              {renderMetricGroup("Skater Peripherals", skaterPeripheralKeys)}
              {renderMetricGroup("Goalie Stats", goalieStatKeys)}
              {/* Render GP% group - Note: passes an array with one item */}
              {renderMetricGroup("Games Played %", [gamePlayedKey])}
            </div>

            {/* REMOVED: Original single checkbox group loop */}
            {/*
            <div className={styles.metricCheckboxGroup}>
              {allPossibleMetrics.map((metric) => (
                <label key={metric.key} className={styles.metricCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedMetrics[metric.key] ?? false}
                    onChange={() => handleMetricChange(metric.key)}
                  />{" "}
                  {metric.label}
                </label>
              ))}
            </div>
            */}
          </div>{" "}
          {/* End of metricFilterContainer */}
          {/* Reset button (Unchanged) */}
          <button className={styles.buttonReset} onClick={resetFilters}>
            Reset Filters
          </button>
        </>
      )}
    </div>
  );
};

// Table Components (Desktop & Mobile)
type SortKey = keyof PlayerWithScores | "composite"; // Allow 'composite' for the score column key
interface PlayerTableCommonProps {
  // Use PlayerWithScores here
  players: PlayerWithScores[];
  sortKey: SortKey;
  sortOrder: "asc" | "desc";
  handleSort: (column: SortKey) => void;
  getOffNightsForPlayer: (player: UnifiedPlayerData) => number | string;
  // Pass selectedMetrics for styling
  selectedMetrics: Record<MetricKey, boolean>;
}

interface DesktopTableProps extends PlayerTableCommonProps {}
const DesktopTable: React.FC<DesktopTableProps> = ({
  players,
  sortKey,
  sortOrder,
  handleSort,
  getOffNightsForPlayer,
  selectedMetrics // Receive selectedMetrics
}) => {
  // Determine header text based on the mode of the first player (or default)
  let scoreHeader = "Score";
  let currentFilterMode: PlayerWithScores["filterMode"] | null = null;
  if (players.length > 0) {
    currentFilterMode = players[0].filterMode; // Assume consistency for the page
    const firstPlayerActiveMetrics = players[0].activeSelectedMetrics;

    // Get *all* metric definitions for label lookup
    const allMetricDefs = [...skaterMetrics, ...goalieMetrics];

    if (currentFilterMode === "single" && firstPlayerActiveMetrics.length > 0) {
      // Find the label for the single metric
      const singleMetricDef = allMetricDefs.find(
        (m) => m.key === firstPlayerActiveMetrics[0]
      );
      scoreHeader = `Overall (excl. ${singleMetricDef?.label || "N/A"})`;
    } else if (currentFilterMode === "multiple") {
      scoreHeader = "Selected Avg";
    } else if (currentFilterMode === "none") {
      scoreHeader = "Score (N/A)";
    }
    // 'all' mode keeps the default "Score"
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "17%" }} /> <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} /> <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} /> <col style={{ width: "6%" }} />
          <col style={{ width: "47%" }} /> <col style={{ width: "6%" }} />
        </colgroup>
        <thead>
          <tr>
            <th onClick={() => handleSort("nhl_player_name")}>
              Name{" "}
              {sortKey === "nhl_player_name"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th onClick={() => handleSort("nhl_team_abbreviation")}>
              Team{" "}
              {sortKey === "nhl_team_abbreviation"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th onClick={() => handleSort("percent_ownership")}>
              Own %{" "}
              {sortKey === "percent_ownership"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th>Pos.</th>
            <th onClick={() => handleSort("off_nights")}>
              Off-Nights{" "}
              {sortKey === "off_nights"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            {/* Sorting GP% might need direct access to percentile or raw value */}
            <th onClick={() => handleSort("percent_games")}>
              GP%{" "}
              {sortKey === "percent_games"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th>Percentile Ranks</th>
            {/* Use dynamic header text, keep sort key as 'composite' for the score column */}
            <th onClick={() => handleSort("composite")}>
              {scoreHeader}{" "}
              {sortKey === "composite"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            // Use base metric definitions based on player type for display
            const relevantMetrics =
              player.player_type === "skater" ? skaterMetrics : goalieMetrics;
            const teamAbbr = normalizeTeamAbbreviation(
              player.current_team_abbreviation || player.yahoo_team,
              player.yahoo_team
            );

            // Determine styling based on filter mode and active selections for this player
            const isMetricSelected = (key: MetricKey) =>
              player.activeSelectedMetrics.includes(key);
            const isDimmed =
              player.filterMode === "single" ||
              player.filterMode === "multiple";

            return (
              <tr key={player.nhl_player_id}>
                <td>
                  <div className={styles.nameAndInjuryWrapper}>
                    <div className={styles.leftNamePart}>
                      <span className={styles.playerName}>
                        {normalizePlayerName(
                          player.yahoo_player_name || player.nhl_player_name
                        )}
                      </span>
                    </div>
                    {player.status &&
                      ["IR-LT", "IR", "O", "DTD", "IR-NR"].includes(
                        player.status
                      ) && (
                        <div className={styles.rightInjuryPart}>
                          <div className={styles.statusRightInjuryPart}>
                            {player.status}
                          </div>
                          <div className={styles.injuryNoteRightInjuryPart}>
                            {player.injury_note}
                          </div>
                          <div className={styles.imageContainer}>
                            <Image
                              src="/pictures/injured.png"
                              alt="Injured"
                              width={20}
                              height={20}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                </td>
                <td>
                  {teamAbbr ? (
                    <Image
                      src={`/teamLogos/${teamAbbr}.png`}
                      alt={teamAbbr}
                      width={30}
                      height={30}
                    />
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  {player.percent_ownership !== null
                    ? `${player.percent_ownership}%`
                    : "N/A"}
                </td>
                <td>
                  {player.eligible_positions?.join(", ") ||
                    (player.player_type === "goalie" ? "G" : "N/A")}
                </td>
                <td>{getOffNightsForPlayer(player)}</td>
                <td>
                  {player.percent_games !== null ? (
                    <div
                      className={clsx(
                        styles.percentileContainer,
                        // Apply selected style if GP% is *actively used* in the score
                        isMetricSelected("percent_games") && styles.selected,
                        // Apply dimmed style if other filters are active AND GP% is not one of them
                        isDimmed &&
                          !isMetricSelected("percent_games") &&
                          styles.dimmed
                      )}
                    >
                      <div
                        className={clsx(
                          styles.percentileLabel,
                          isMetricSelected("percent_games") &&
                            styles.selectedLabel // Specific style for selected label
                        )}
                      >
                        GP%
                      </div>
                      <div
                        className={clsx(
                          styles.percentileBox,
                          isMetricSelected("percent_games") &&
                            styles.selectedBox // Specific style for selected box
                        )}
                        style={getRankColorStyle(
                          player.percentiles.percent_games
                        )}
                      >
                        {(Math.min(player.percent_games, 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td>
                  <div className={styles.percentileFlexContainer}>
                    {/* Filter out GP% since it has its own column */}
                    {relevantMetrics
                      .filter(({ key }) => key !== "percent_games")
                      .map(({ key, label }) => {
                        const pctVal = player.percentiles[key];
                        const isSelected = isMetricSelected(key);

                        return (
                          <div
                            key={key}
                            className={clsx(
                              styles.percentileContainer,
                              isSelected && styles.selected,
                              isDimmed && !isSelected && styles.dimmed
                            )}
                          >
                            <div
                              className={clsx(
                                styles.percentileLabel,
                                isSelected && styles.selectedLabel
                              )}
                            >
                              {label}
                            </div>
                            <div
                              className={clsx(
                                styles.percentileBox,
                                isSelected && styles.selectedBox
                              )}
                              style={getRankColorStyle(pctVal)}
                            >
                              {pctVal !== undefined
                                ? `${pctVal.toFixed(0)}%`
                                : "0%"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </td>
                <td>{player.displayScore.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface MobileTableProps extends PlayerTableCommonProps {
  expanded: Record<string, boolean>;
  toggleExpand: (playerId: string) => void;
}
const MobileTable: React.FC<MobileTableProps> = ({
  players,
  sortKey,
  sortOrder,
  handleSort,
  expanded,
  toggleExpand,
  getOffNightsForPlayer,
  selectedMetrics // Receive selectedMetrics
}) => {
  const totalColumns = 7;

  // Determine header text for mobile score column (optional, could keep as "Score")
  let scoreHeaderMobile = "Score";
  if (players.length > 0) {
    const firstPlayerMode = players[0].filterMode;
    if (firstPlayerMode === "single") scoreHeaderMobile = "Other Avg";
    else if (firstPlayerMode === "multiple") scoreHeaderMobile = "Sel. Avg";
    else if (firstPlayerMode === "none") scoreHeaderMobile = "N/A";
  }

  return (
    <div className={styles.containerMobile}>
      <table className={styles.tableMobile}>
        <colgroup>
          <col style={{ width: "5%" }} /> <col style={{ width: "35%" }} />
          <col style={{ width: "10%" }} /> <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} /> <col style={{ width: "10%" }} />
          <col style={{ width: "15%" }} />
        </colgroup>
        <thead>
          <tr>
            <th></th> {/* Expand Button */}
            <th onClick={() => handleSort("nhl_player_name")}>
              Name{" "}
              {sortKey === "nhl_player_name"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th onClick={() => handleSort("nhl_team_abbreviation")}>
              Team{" "}
              {sortKey === "nhl_team_abbreviation"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th onClick={() => handleSort("percent_ownership")}>
              Own{" "}
              {sortKey === "percent_ownership"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th>Pos.</th>
            <th onClick={() => handleSort("off_nights")}>
              Offs{" "}
              {sortKey === "off_nights"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
            <th onClick={() => handleSort("composite")}>
              {scoreHeaderMobile}{" "}
              {sortKey === "composite"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            // Use base metric definitions based on player type
            const relevantMetrics =
              player.player_type === "skater" ? skaterMetrics : goalieMetrics;
            const teamAbbr = normalizeTeamAbbreviation(
              player.current_team_abbreviation || player.yahoo_team,
              player.yahoo_team
            );
            const isExpanded = expanded[player.nhl_player_id];

            // Determine styling based on filter mode and active selections for this player
            const isMetricSelected = (key: MetricKey) =>
              player.activeSelectedMetrics.includes(key);
            const isDimmed =
              player.filterMode === "single" ||
              player.filterMode === "multiple";

            // Prepare items for expanded view using DetailItemData interface
            // Include GP% first
            const allDetailItems: DetailItemData[] = [
              {
                key: "percent_games",
                label: "GP%",
                value: player.percentiles.percent_games,
                displayValue:
                  player.percent_games !== null
                    ? `${(Math.min(player.percent_games, 1) * 100).toFixed(0)}%`
                    : "N/A"
              },
              // Add other relevant metrics (excluding GP% as it's already added)
              ...relevantMetrics
                .filter(({ key }) => key !== "percent_games")
                .map(
                  ({ key, label }): DetailItemData => ({
                    key: key,
                    label: label,
                    value: player.percentiles[key],
                    displayValue:
                      player.percentiles[key] !== undefined
                        ? `${player.percentiles[key].toFixed(0)}%`
                        : "0%"
                  })
                )
            ];
            const midpoint = Math.ceil(allDetailItems.length / 2);
            const row1Items = allDetailItems.slice(0, midpoint);
            const row2Items = allDetailItems.slice(midpoint);

            return (
              <React.Fragment key={player.nhl_player_id}>
                <tr>
                  {" "}
                  {/* Main Row */}
                  <td>
                    {" "}
                    {/* Expand Button */}
                    <button
                      onClick={() => toggleExpand(player.nhl_player_id)}
                      className={styles.expandButton}
                      aria-expanded={isExpanded}
                      aria-controls={`details-${player.nhl_player_id}`}
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  </td>
                  <td>
                    {" "}
                    {/* Name */}
                    <div className={styles.nameAndInjuryWrapperMobile}>
                      <div className={styles.leftNamePartMobile}>
                        <span className={styles.playerName}>
                          {normalizePlayerName(
                            player.yahoo_player_name || player.nhl_player_name
                          )}
                        </span>
                      </div>
                      {player.status &&
                        ["IR-LT", "IR", "O", "DTD", "IR-NR"].includes(
                          player.status
                        ) && (
                          <div className={styles.rightInjuryPartMobile}>
                            <div className={styles.imageContainer}>
                              <Image
                                src="/pictures/injured.png"
                                alt="Injured"
                                width={18}
                                height={18}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </td>
                  <td>
                    {" "}
                    {/* Team */}
                    {teamAbbr ? (
                      <Image
                        src={`/teamLogos/${teamAbbr}.png`}
                        alt={teamAbbr}
                        width={25}
                        height={25}
                      />
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td>
                    {" "}
                    {/* Own% */}
                    {player.percent_ownership !== null
                      ? `${player.percent_ownership}%`
                      : "N/A"}
                  </td>
                  <td>
                    {" "}
                    {/* Pos */}
                    {player.eligible_positions?.join(", ") ||
                      (player.player_type === "goalie" ? "G" : "N/A")}
                  </td>
                  <td> {getOffNightsForPlayer(player)} </td>
                  <td> {player.displayScore.toFixed(1)} </td>{" "}
                  {/* Use displayScore */}
                </tr>
                {/* Expanded Row */}
                {isExpanded && (
                  <tr className={styles.expandedRow}>
                    <td
                      colSpan={totalColumns}
                      id={`details-${player.nhl_player_id}`}
                    >
                      <div className={styles.expandedDetails}>
                        {/* Row 1 Details */}
                        <div className={styles.detailRow}>
                          {row1Items.map((item) => {
                            const isSelected = isMetricSelected(item.key);
                            return (
                              <div
                                key={item.key}
                                className={clsx(
                                  styles.detailItem,
                                  isSelected && styles.selected,
                                  isDimmed && !isSelected && styles.dimmed
                                )}
                              >
                                <span
                                  className={clsx(
                                    styles.detailLabel,
                                    isSelected && styles.selectedLabel
                                  )}
                                >
                                  {item.label}:
                                </span>
                                <span
                                  className={clsx(
                                    styles.detailValue,
                                    isSelected && styles.selectedBox
                                  )}
                                  style={getRankColorStyle(item.value)}
                                >
                                  {item.displayValue}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Row 2 Details */}
                        {row2Items.length > 0 && (
                          <div className={styles.detailRow}>
                            {row2Items.map((item) => {
                              const isSelected = isMetricSelected(item.key);
                              return (
                                <div
                                  key={item.key}
                                  className={clsx(
                                    styles.detailItem,
                                    isSelected && styles.selected,
                                    isDimmed && !isSelected && styles.dimmed
                                  )}
                                >
                                  <span
                                    className={clsx(
                                      styles.detailLabel,
                                      isSelected && styles.selectedLabel
                                    )}
                                  >
                                    {item.label}:
                                  </span>
                                  <span
                                    className={clsx(
                                      styles.detailValue,
                                      isSelected && styles.selectedBox
                                    )}
                                    style={getRankColorStyle(item.value)}
                                  >
                                    {item.displayValue}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Pagination Component
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}
const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  setCurrentPage
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.pagination}>
      <button
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span>
        {" "}
        Page {currentPage} of {totalPages}{" "}
      </span>
      <button
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};

// ---------------------------
// Main Component
// ---------------------------
const PlayerPickupTable: React.FC<PlayerPickupTableProps> = ({
  teamWeekData
}) => {
  const isMobile = useIsMobile();

  // --- States ---
  const [ownershipThreshold, setOwnershipThreshold] = useState<number>(
    defaultOwnershipThreshold
  );
  const [teamFilter, setTeamFilter] = useState<string>(defaultTeamFilter);
  const [selectedPositions, setSelectedPositions] =
    useState<Record<string, boolean>>(defaultPositions);
  const [playersData, setPlayersData] = useState<UnifiedPlayerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pageSize = 25;
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);

  // --- Calculate all possible metrics once (for filter UI, presets, state init) ---
  const allPossibleMetrics = useMemo(() => {
    const metricsMap = new Map<MetricKey, MetricDefinition>();
    // Add all skater and goalie metrics, ensuring uniqueness
    [...skaterMetrics, ...goalieMetrics].forEach((m) => {
      metricsMap.set(m.key, m);
    });
    // Sort alphabetically by label, maybe keep GP% separate if needed later?
    // For now, simple sort is fine.
    return Array.from(metricsMap.values()).sort((a, b) => {
      // Simple alphabetical sort by label
      return a.label.localeCompare(b.label);
    });
  }, []); // Dependency array is empty as base metrics are constant

  // --- Metric Filter State (Initialize with all true) ---
  const [selectedMetrics, setSelectedMetrics] = useState<
    Record<MetricKey, boolean>
  >(() => {
    return Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, true])
    ) as Record<MetricKey, boolean>;
  });

  // --- Data Fetching (useEffect) ---
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      let allData: UnifiedPlayerData[] = [];
      let from = 0;
      const supabasePageSize = 1000;
      try {
        while (true) {
          const { data, error, count } = await supabase
            .from("yahoo_nhl_player_map_mat")
            .select("*", { count: "exact" })
            .range(from, from + supabasePageSize - 1);
          if (error) throw error;
          if (!data) break;
          allData = allData.concat(data);
          if (count !== null && allData.length >= count) break;
          if (data.length < supabasePageSize) break;
          from += supabasePageSize;
        }
        // console.log(`Workspaceed ${allData.length} players.`); // Keep for debugging if needed
        setPlayersData(allData);
      } catch (error) {
        console.error("Failed to load player data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // ---------------------------
  // Memoized Calculations
  // ---------------------------

  const getOffNightsForPlayer = useMemo(
    () =>
      (player: UnifiedPlayerData): number | string => {
        if (!teamWeekData || teamWeekData.length === 0) {
          return player.off_nights !== null ? player.off_nights : "N/A";
        }
        const teamAbbr = normalizeTeamAbbreviation(
          player.current_team_abbreviation || player.yahoo_team,
          player.yahoo_team
        );
        const teamData = teamWeekData.find(
          (team) => team.teamAbbreviation === teamAbbr
        );
        return teamData
          ? teamData.offNights
          : player.off_nights !== null
          ? player.off_nights
          : "N/A";
      },
    [teamWeekData]
  );

  // Filtered Players
  const filteredPlayers = useMemo(() => {
    const result = playersData.filter((player) => {
      // Basic filtering logic remains the same
      if (player.percent_ownership === null || player.percent_ownership === 0)
        return false;
      const hasEligiblePositions =
        player.eligible_positions && player.eligible_positions.length > 0;
      if (!hasEligiblePositions && player.player_type !== "goalie")
        return false;

      if (player.percent_ownership > ownershipThreshold) return false;

      const playerTeamAbbr = normalizeTeamAbbreviation(
        player.current_team_abbreviation || player.yahoo_team,
        player.yahoo_team
      );
      if (teamFilter !== "ALL" && teamFilter !== playerTeamAbbr) return false;

      const playerPositions = hasEligiblePositions
        ? player.eligible_positions!
        : player.player_type === "goalie"
        ? ["G"]
        : [];

      const positionMatch = playerPositions.some(
        (pos) => selectedPositions[pos]
      );

      // Refined position logic:
      // If 'G' is NOT selected, filter out goalies.
      if (!selectedPositions["G"] && player.player_type === "goalie") {
        return false;
      }
      // If 'G' IS selected AND the player is a goalie, allow unless other positions selected exclude them
      if (selectedPositions["G"] && player.player_type === "goalie") {
        // If ONLY 'G' is selected among filters, goalie is allowed.
        const onlyGSelected = Object.entries(selectedPositions).every(
          ([pos, selected]) => (pos === "G" ? selected : !selected)
        );
        if (onlyGSelected) {
          return true; // Only G selected, goalie allowed
        }
        // If G + other positions are selected, the goalie *must* also match one of the *other* selected positions
        // (This scenario is rare for goalies, but handles edge cases)
        if (positionMatch) {
          return true; // Goalie matches one of the selected non-G positions
        } else {
          return false; // G + others selected, but goalie doesn't match others
        }
      }
      // If player is NOT a goalie, they MUST match one of the selected non-G positions.
      if (player.player_type !== "goalie" && !positionMatch) {
        return false;
      }

      return true; // Player passed all filters
    });
    return result;
  }, [playersData, ownershipThreshold, teamFilter, selectedPositions]);

  // Compute Percentiles (Initial Calculation)
  const playersWithPercentiles: PlayerWithPercentiles[] = useMemo(() => {
    if (filteredPlayers.length === 0) return [];

    const skaters = filteredPlayers.filter((p) => p.player_type === "skater");
    const goalies = filteredPlayers.filter((p) => p.player_type === "goalie");

    // Percentile calculation functions (unchanged)
    function computePercentile(
      values: (number | null)[],
      value: number | null
    ): number {
      if (value === null || value === undefined) return 0;
      const validValues = values.filter(
        (v) => v !== null && v !== undefined
      ) as number[];
      if (validValues.length === 0) return 0;
      validValues.sort((a, b) => a - b);
      const count = validValues.length;
      let numBelow = 0;
      let numEqual = 0;
      for (const v of validValues) {
        if (v < value) numBelow++;
        else if (v === value) numEqual++;
        else break;
      }
      if (count === 1) return 50.0;
      return count > 0 ? ((numBelow + 0.5 * numEqual) / count) * 100 : 0;
    }
    function computeInvertedPercentile(
      values: (number | null)[],
      value: number | null
    ): number {
      if (value === null || value === undefined) return 0;
      const validValues = values.filter(
        (v) => v !== null && v !== undefined
      ) as number[];
      if (validValues.length === 0) return 0;
      validValues.sort((a, b) => a - b); // Sort ascending needed for logic below
      const count = validValues.length;
      let numAbove = 0;
      let numEqual = 0;
      // Iterate through sorted values to count how many are above or equal
      for (const v of validValues) {
        if (v > value) {
          numAbove++;
        } else if (v === value) {
          numEqual++;
        }
      }
      if (count === 1) return 50.0;
      // Percentile Rank = ((Number Above + 0.5 * Number Equal) / Total Count) * 100
      return count > 0 ? ((numAbove + 0.5 * numEqual) / count) * 100 : 0;
    }

    function assignPercentiles(
      group: UnifiedPlayerData[],
      // Use the base skaterMetrics/goalieMetrics definitions here for calculation
      metrics: MetricDefinition[]
    ): PlayerWithPercentiles[] {
      if (group.length === 0) return [];
      const metricValuesMap: Map<MetricKey, (number | null)[]> = new Map();

      // Populate map only with metrics relevant to this group (skater or goalie)
      metrics.forEach(({ key }) => {
        metricValuesMap.set(
          key,
          group.map((p) => p[key as keyof UnifiedPlayerData] as number | null)
        );
      });

      return group.map((player) => {
        const percentiles: Partial<Record<MetricKey, number>> = {};
        let sum = 0;
        let count = 0;

        // Calculate percentiles only for metrics relevant to this group
        for (const { key } of metrics) {
          const rawVal = player[key as keyof UnifiedPlayerData] as
            | number
            | null;
          const allValues = metricValuesMap.get(key) || [];
          let pct = 0;

          // Apply inverted calculation for GAA
          if (key === "goals_against_avg") {
            pct = computeInvertedPercentile(allValues, rawVal);
          } else {
            pct = computePercentile(allValues, rawVal);
          }

          percentiles[key] = pct;
          // Include all relevant metrics (including GP%) in the composite score calculation
          if (rawVal !== null && rawVal !== undefined) {
            sum += pct;
            count++;
          }
        }

        const composite = count > 0 ? sum / count : 0;

        // Ensure all keys defined for this type (skater/goalie) exist in the final percentiles object
        const finalPercentiles = metrics.reduce((acc, { key }) => {
          acc[key] = percentiles[key] ?? 0; // Default to 0 if somehow missing
          return acc;
        }, {} as Record<MetricKey, number>);

        return {
          ...player,
          percentiles: finalPercentiles,
          composite
        };
      });
    }

    // Use the base skater/goalie metrics lists for assigning percentiles
    const skatersWithPct = assignPercentiles(skaters, skaterMetrics);
    const goaliesWithPct = assignPercentiles(goalies, goalieMetrics);

    // Combine and ensure all players have a `percentiles` object, even if empty
    const result = [...skatersWithPct, ...goaliesWithPct].map((player) => ({
      ...player,
      percentiles: player.percentiles || {} // Ensure percentiles object exists
    }));

    return result;
  }, [filteredPlayers]); // Dependency remains filteredPlayers

  // Calculate Display Scores based on selected metrics
  const playersWithScores: PlayerWithScores[] = useMemo(() => {
    const activeMetricKeys = Object.entries(selectedMetrics)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => key as MetricKey);

    const numActiveMetrics = activeMetricKeys.length;
    // Use allPossibleMetrics derived earlier for total count
    const totalPossibleMetricsCount = allPossibleMetrics.length;

    // Determine Global Filter Mode
    let globalFilterMode: PlayerWithScores["filterMode"] = "multiple";
    if (numActiveMetrics === 0) globalFilterMode = "none";
    else if (numActiveMetrics === totalPossibleMetricsCount)
      globalFilterMode = "all";
    else if (numActiveMetrics === 1) globalFilterMode = "single";

    const result = playersWithPercentiles.map((player): PlayerWithScores => {
      // Determine relevant metrics for *this player* (skater or goalie) using base definitions
      const relevantMetricsForPlayer =
        player.player_type === "skater" ? skaterMetrics : goalieMetrics;
      const relevantMetricKeysForPlayer = new Set(
        relevantMetricsForPlayer.map((m) => m.key)
      );

      // Find which of the *globally selected* metrics apply to *this player*
      const applicableSelectedMetrics = activeMetricKeys.filter((key) =>
        relevantMetricKeysForPlayer.has(key)
      );
      const numApplicableSelected = applicableSelectedMetrics.length;

      // --- Determine Player-Specific Filter Mode ---
      // This adjusts the global mode based on how many *selected* metrics actually apply to the player type
      let playerFilterMode = globalFilterMode; // Start with global mode

      if (globalFilterMode === "all") {
        // If global is 'all', player mode depends on how many apply to them
        if (numApplicableSelected === relevantMetricsForPlayer.length)
          playerFilterMode = "all";
        else if (numApplicableSelected === 0) playerFilterMode = "none";
        else if (numApplicableSelected === 1) playerFilterMode = "single";
        else playerFilterMode = "multiple"; // Some, but not all, selected metrics apply
      } else if (globalFilterMode === "single") {
        // If global is 'single', player is only 'single' if that one metric applies to them
        playerFilterMode = numApplicableSelected === 1 ? "single" : "none";
      } else if (globalFilterMode === "multiple") {
        // If global is 'multiple', player mode depends on how many apply
        if (numApplicableSelected === 0) playerFilterMode = "none";
        else if (numApplicableSelected === 1) playerFilterMode = "single";
        else playerFilterMode = "multiple"; // More than one applicable selected metric
      }
      // If global is 'none', player mode is also 'none'.

      // --- Calculate Display Score and Sort Value ---
      let displayScore = 0;
      let sortByValue = 0; // Use composite score as the base for sorting the 'Score' column

      switch (playerFilterMode) {
        case "all":
          // When all relevant metrics are effectively selected (either globally or by coincidence)
          displayScore = player.composite; // Show the standard composite score
          sortByValue = player.composite; // Sort by composite
          break;

        case "single":
          // Only one relevant metric is selected for this player type
          const singleMetricKey = applicableSelectedMetrics[0];
          // Display Score: Average of *other* relevant percentiles (excluding the single selected one)
          let otherSum = 0;
          let otherCount = 0;
          relevantMetricsForPlayer.forEach(({ key }) => {
            if (key !== singleMetricKey) {
              const pct = player.percentiles[key];
              if (pct !== undefined && pct !== null) {
                otherSum += pct;
                otherCount++;
              }
            }
          });
          displayScore = otherCount > 0 ? otherSum / otherCount : 0;
          // Sort Value: Use the percentile of the *single selected metric* itself
          sortByValue = player.percentiles[singleMetricKey] ?? 0;
          break;

        case "multiple":
          // Multiple (but not all) relevant metrics are selected for this player type
          // Display Score: Average of *only the selected* relevant percentiles
          let selectedSum = 0;
          let selectedCount = 0;
          applicableSelectedMetrics.forEach((key) => {
            const pct = player.percentiles[key];
            if (pct !== undefined && pct !== null) {
              selectedSum += pct;
              selectedCount++;
            }
          });
          displayScore = selectedCount > 0 ? selectedSum / selectedCount : 0;
          // Sort Value: Use this calculated average of selected percentiles
          sortByValue = displayScore;
          break;

        case "none":
        default:
          // No relevant metrics selected for this player type
          displayScore = 0; // Show 0
          sortByValue = -1; // Sort these players to the bottom (or top if ascending)
          break;
      }

      return {
        ...player,
        displayScore,
        sortByValue, // This value determines sorting for the 'Score' column
        filterMode: playerFilterMode,
        activeSelectedMetrics: applicableSelectedMetrics // Store which metrics were actually used
      };
    });
    return result;
    // Dependencies: playersWithPercentiles, selectedMetrics, allPossibleMetrics (for total count)
  }, [playersWithPercentiles, selectedMetrics, allPossibleMetrics]);

  // Sorted Players
  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...playersWithScores];
    sortablePlayers.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Handle sorting based on the 'Score' column using 'sortByValue'
      if (sortKey === "composite") {
        aValue = a.sortByValue;
        bValue = b.sortByValue;
      } else if (sortKey === "off_nights") {
        aValue = getOffNightsForPlayer(a); // Keep handling 'N/A' etc.
        bValue = getOffNightsForPlayer(b);
      } else if (sortKey === "nhl_team_abbreviation") {
        aValue =
          normalizeTeamAbbreviation(
            a.current_team_abbreviation || a.yahoo_team,
            a.yahoo_team
          ) || "";
        bValue =
          normalizeTeamAbbreviation(
            b.current_team_abbreviation || b.yahoo_team,
            b.yahoo_team
          ) || "";
      } else if (sortKey === "nhl_player_name") {
        aValue = (a.yahoo_player_name || a.nhl_player_name || "").toLowerCase();
        bValue = (b.yahoo_player_name || b.nhl_player_name || "").toLowerCase();
      } else if (sortKey === "percent_games") {
        // Sort by raw GP% value or percentile? Let's use raw value for direct comparison
        aValue = a.percent_games;
        bValue = b.percent_games;
      } else {
        // Handle sorting by other direct properties (like own%)
        aValue = a[sortKey as keyof PlayerWithScores];
        bValue = b[sortKey as keyof PlayerWithScores];
      }

      // Handle null/undefined/'N/A' values for consistent sorting
      const isInvalidA =
        aValue === "N/A" || aValue === null || aValue === undefined;
      const isInvalidB =
        bValue === "N/A" || bValue === null || bValue === undefined;

      if (isInvalidA && isInvalidB) return 0; // Both invalid, treat as equal
      if (isInvalidA) return sortOrder === "desc" ? 1 : -1; // Push invalid A down in desc, up in asc
      if (isInvalidB) return sortOrder === "desc" ? -1 : 1; // Push invalid B down in desc, up in asc

      // Standard comparison for valid values
      if (typeof aValue === "string" && typeof bValue === "string") {
        // Case-insensitive string comparison
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        // Numeric comparison
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }
    });
    return sortablePlayers;
  }, [playersWithScores, sortKey, sortOrder, getOffNightsForPlayer]); // Dependency includes playersWithScores now

  const totalPages = Math.ceil(sortedPlayers.length / pageSize);
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPlayers.slice(startIndex, startIndex + pageSize);
  }, [sortedPlayers, currentPage, pageSize]);

  const teamOptions = useMemo(() => {
    const teamsSet = new Set<string>();
    playersData.forEach((p) => {
      const teamAbbr = normalizeTeamAbbreviation(
        p.current_team_abbreviation || p.yahoo_team
      );
      if (teamAbbr) teamsSet.add(teamAbbr);
    });
    return ["ALL", ...Array.from(teamsSet).sort()];
  }, [playersData]);

  // --- Event Handlers ---
  const handleSort = (column: SortKey) => {
    setCurrentPage(1); // Reset page on sort
    if (sortKey === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortKey(column);
      setSortOrder("desc"); // Default to descending on new column
    }
  };

  // --- CORRECTED Reset Function ---
  const resetFilters = () => {
    setOwnershipThreshold(defaultOwnershipThreshold);
    setTeamFilter(defaultTeamFilter);
    setSelectedPositions(defaultPositions);
    // Reset metric filters to all true using the derived allPossibleMetrics
    const initialMetrics = Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, true])
    ) as Record<MetricKey, boolean>;
    setSelectedMetrics(initialMetrics);
    // Reset sort order and pagination
    setCurrentPage(1);
    setSortKey("composite"); // Reset sort to default 'Score' column
    setSortOrder("desc");
    setIsMobileMinimized(false); // Ensure filters are visible on mobile
  };

  const toggleExpand = (playerId: string) => {
    setExpanded((prev) => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

  // --- Effects ---
  // Reset page and expanded rows when filters change
  useEffect(() => {
    setCurrentPage(1);
    setExpanded({});
  }, [ownershipThreshold, teamFilter, selectedPositions, selectedMetrics]);

  // Adjust current page if it becomes invalid due to filtering/pagination changes
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (currentPage < 1 && totalPages > 0) {
      // Ensure currentPage is at least 1
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // --- Render Logic ---
  return (
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.containerMinimized // Apply class if mobile & minimized
      )}
    >
      <Filters
        ownershipThreshold={ownershipThreshold}
        setOwnershipThreshold={setOwnershipThreshold}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        selectedPositions={selectedPositions}
        setSelectedPositions={setSelectedPositions}
        resetFilters={resetFilters}
        teamOptions={teamOptions}
        isMobile={isMobile}
        isMobileMinimized={isMobileMinimized}
        toggleMobileMinimize={toggleMobileMinimize}
        // Pass metric state and definitions down
        allPossibleMetrics={allPossibleMetrics}
        selectedMetrics={selectedMetrics}
        setSelectedMetrics={setSelectedMetrics}
      />

      {/* ID added for ARIA control by filter title */}
      <div id="player-table-content" className={styles.collapsibleContent}>
        {loading ? (
          <div className={styles.message}>Loading players...</div>
        ) : paginatedPlayers.length === 0 ? (
          <div className={styles.message}>
            No players match the current filters.
          </div>
        ) : (
          <>
            {/* Conditional rendering based on mobile state AND minimized state */}
            {(!isMobile || !isMobileMinimized) && (
              <>
                {isMobile ? (
                  <MobileTable
                    players={paginatedPlayers}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    handleSort={handleSort}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    getOffNightsForPlayer={getOffNightsForPlayer}
                    selectedMetrics={selectedMetrics} // Pass down for styling
                  />
                ) : (
                  <DesktopTable
                    players={paginatedPlayers}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    handleSort={handleSort}
                    getOffNightsForPlayer={getOffNightsForPlayer}
                    selectedMetrics={selectedMetrics} // Pass down for styling
                  />
                )}
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  setCurrentPage={setCurrentPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerPickupTable;
