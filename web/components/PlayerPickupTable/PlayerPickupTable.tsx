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

type RawDataFromDb = UnifiedPlayerData;

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
// NOTE: GP% is included here because it's needed for percentile calculations for both types.
// We will explicitly exclude it in the preset button logic later.
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
  { key: "percent_games", label: "GP%" } // GP% included for skaters calc
];

const goalieMetrics: MetricDefinition[] = [
  { key: "wins", label: "W" },
  { key: "saves", label: "SV" },
  { key: "shots_against", label: "SA" },
  { key: "shutouts", label: "SO" },
  { key: "quality_start", label: "QS" },
  { key: "goals_against_avg", label: "GAA" },
  { key: "save_pct", label: "SV%" },
  { key: "percent_games", label: "GP%" } // GP% included for goalies calc
];

// --- Define Metric Groups for Filter UI ---
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
const goalieQualityKeys: MetricKey[] = [
  "save_pct",
  "goals_against_avg",
  "quality_start"
  // Note: 'SO' is listed under Quantity in the diagram, adjust if needed
];
const goalieQuantityKeys: MetricKey[] = [
  "wins",
  "saves",
  "shots_against",
  "shutouts" // SO listed here as per diagram
];
const gamePlayedKey: MetricKey = "percent_games"; // Keep GP% separate for UI Grouping

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
    // Allow direct setting for presets
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
  setSelectedPositions, // Receive the setter function
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
  // --- NEW: Handler for clicking sub-group titles ---
  const handleSubGroupPresetClick = (
    keysToSelect: MetricKey[],
    playerType: "skater" | "goalie"
  ) => {
    // 1. Set Position Filters
    const skaterPositions = { C: true, LW: true, RW: true, D: true, G: false };
    const goaliePositions = {
      C: false,
      LW: false,
      RW: false,
      D: false,
      G: true
    };
    setSelectedPositions(
      playerType === "skater" ? skaterPositions : goaliePositions
    );

    // 2. Set Metric Filters (only select keys from the specific subgroup)
    const nextMetricsState = Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, false]) // Start all false
    ) as Record<MetricKey, boolean>;

    keysToSelect.forEach((key) => {
      if (key in nextMetricsState) {
        nextMetricsState[key] = true;
      }
    });
    setSelectedMetrics(nextMetricsState);
  };

  const handlePositionChange = (pos: string) => {
    setSelectedPositions((prev: Record<string, boolean>) => ({
      ...prev,
      [pos]: !prev[pos]
    }));
  };

  const handleMetricChange = (key: MetricKey) => {
    setSelectedMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- UPDATED handleSelectPreset ---
  const handleSelectPreset = (type: "all" | "skater" | "goalie" | "none") => {
    const nextMetricsState: Record<MetricKey, boolean> = Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, false])
    ) as Record<MetricKey, boolean>; // Start fresh with all metrics false

    // Use the original skater/goalie metric definitions for determining which metrics to select
    const skaterMetricKeys = new Set(skaterMetrics.map((m) => m.key));
    const goalieMetricKeys = new Set(goalieMetrics.map((m) => m.key));

    // --- Define Position States for Presets ---
    const skaterPositions = { C: true, LW: true, RW: true, D: true, G: false };
    const goaliePositions = {
      C: false,
      LW: false,
      RW: false,
      D: false,
      G: true
    };

    // Update Metric Selection based on type
    allPossibleMetrics.forEach((metric) => {
      switch (type) {
        case "all":
          nextMetricsState[metric.key] = true;
          break;
        case "none":
          nextMetricsState[metric.key] = false;
          break;
        case "skater":
          // Select metric IF it's a skater metric AND NOT percent_games
          nextMetricsState[metric.key] =
            skaterMetricKeys.has(metric.key) && metric.key !== "percent_games";
          break;
        case "goalie":
          // Select metric IF it's a goalie metric AND NOT percent_games
          nextMetricsState[metric.key] =
            goalieMetricKeys.has(metric.key) && metric.key !== "percent_games";
          break;
      }
    });
    setSelectedMetrics(nextMetricsState); // Update the selected metrics state

    // --- Update Position Selection based on type ---
    switch (type) {
      case "skater":
        setSelectedPositions(skaterPositions); // Show only skater positions
        break;
      case "goalie":
        setSelectedPositions(goaliePositions); // Show only goalie position
        break;
      case "all":
      case "none":
        setSelectedPositions(defaultPositions); // Reset to default positions
        break;
    }
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

  // Renders the inner checkboxes for a specific sub-group
  const renderCheckboxGroup = (metricKeys: MetricKey[]) => {
    const validMetrics = metricKeys
      .map((key) => getMetricDefinition(key))
      .filter((metric): metric is MetricDefinition => !!metric);

    if (validMetrics.length === 0) return null;

    return (
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
        data-interactive={isMobile ? true : undefined}
      >
        <span className={styles.titleContent}>
          <span className={styles.acronym}>BPA</span>
          <span>-</span>
          <span className={styles.acronym}>B</span>est
          <span className={styles.acronym}>P</span>layer
          <span className={styles.acronym}>A</span>vailable
        </span>
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
          {/* --- Ownership, Team, Position Filters --- */}
          {/* Conditionally render based on isMobile */}
          {isMobile ? (
            // Mobile Layout for Basic Filters
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
                  {Object.keys(defaultPositions).map(
                    (
                      pos // Use defaultPositions keys for rendering labels
                    ) => (
                      <label key={pos} className={styles.positionCheckbox}>
                        <input
                          type="checkbox"
                          // Use selectedPositions state for checked status
                          checked={selectedPositions[pos] ?? false}
                          onChange={() => handlePositionChange(pos)}
                        />{" "}
                        {pos}
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Desktop Layout for Basic Filters
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
                  {Object.keys(defaultPositions).map(
                    (
                      pos // Use defaultPositions keys for rendering labels
                    ) => (
                      <label key={pos} className={styles.positionCheckbox}>
                        <input
                          type="checkbox"
                          // Use selectedPositions state for checked status
                          checked={selectedPositions[pos] ?? false}
                          onChange={() => handlePositionChange(pos)}
                        />{" "}
                        {pos}
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
          <div className={styles.metricFilterContainer}>
            {/* Header: Label + Preset Buttons */}
            <div className={styles.metricFilterHeader}>
              <span className={styles.label}>Filter by Metrics:</span>
              <div className={styles.metricPresetButtons}>
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
            {/* GP% Group (Full Width) */}
            <div className={styles.gpGroupContainer}>
              {renderCheckboxGroup([gamePlayedKey])}
            </div>
            {/* Skaters and Goalies Row */}
            {/* Skaters and Goalies Row */}
            <div className={styles.skaterGoalieRow}>
              {/* Skaters Column */}
              <fieldset className={styles.skaterMetricsColumn}>
                <legend className={styles.columnLabel}>Skaters</legend>
                <div className={styles.skaterSubGroupsRow}>
                  <div className={styles.metricGroup}>
                    {" "}
                    {/* Points Group */}
                    <button
                      type="button" // Prevent form submission if wrapped in form
                      className={styles.metricGroupTitle}
                      onClick={() =>
                        handleSubGroupPresetClick(skaterPointKeys, "skater")
                      }
                    >
                      Points
                    </button>
                    {renderCheckboxGroup(skaterPointKeys)}
                  </div>
                  <div className={styles.metricGroup}>
                    {" "}
                    {/* Peripherals Group */}
                    <button
                      type="button"
                      className={styles.metricGroupTitle}
                      onClick={() =>
                        handleSubGroupPresetClick(
                          skaterPeripheralKeys,
                          "skater"
                        )
                      }
                    >
                      Peripherals
                    </button>
                    {renderCheckboxGroup(skaterPeripheralKeys)}
                  </div>
                </div>
              </fieldset>

              {/* Goalies Column */}
              <fieldset className={styles.goalieMetricsColumn}>
                <legend className={styles.columnLabel}>Goalies</legend>
                <div className={styles.goalieSubGroupsRow}>
                  <div className={styles.metricGroup}>
                    {" "}
                    {/* Quality Group */}
                    <button
                      type="button"
                      className={styles.metricGroupTitle}
                      onClick={() =>
                        handleSubGroupPresetClick(goalieQualityKeys, "goalie")
                      }
                    >
                      Quality
                    </button>
                    {renderCheckboxGroup(goalieQualityKeys)}
                  </div>
                  <div className={styles.metricGroup}>
                    {" "}
                    {/* Quantity Group */}
                    {/* UPDATED: Title is now a button */}
                    <button
                      type="button"
                      className={styles.metricGroupTitle}
                      onClick={() =>
                        handleSubGroupPresetClick(goalieQuantityKeys, "goalie")
                      }
                    >
                      Quantity
                    </button>
                    {renderCheckboxGroup(goalieQuantityKeys)}
                  </div>
                </div>
              </fieldset>
            </div>{" "}
          </div>{" "}
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

// --- DesktopTable, MobileTable, PaginationControls (No changes needed in these child components) ---
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
      scoreHeader = `Other Avg`; // Simpler header for single metric mode
    } else if (currentFilterMode === "multiple") {
      scoreHeader = "Selected Avg";
    } else if (currentFilterMode === "none") {
      scoreHeader = "Score (N/A)";
    }
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "15%" }} /> <col style={{ width: "5%" }} />
          <col style={{ width: "5%" }} /> <col style={{ width: "5%" }} />
          <col style={{ width: "5%" }} /> <col style={{ width: "5%" }} />
          <col style={{ width: "50%" }} /> <col style={{ width: "10%" }} />
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
                      src={`/teamLogos/${teamAbbr ?? "default"}.png`}
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
                          // Check if percentiles object and the specific key exist before accessing
                          player.percentiles?.percent_games
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
                        // Check if percentiles object and the specific key exist
                        const pctVal = player.percentiles?.[key];
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
                              style={getRankColorStyle(pctVal)} // Pass potentially undefined value
                            >
                              {pctVal !== undefined && pctVal !== null
                                ? `${pctVal.toFixed(0)}%`
                                : "0%"}{" "}
                              {/* Handle undefined/null */}
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
// ... (MobileTable component remains the same) ...
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
                // Safely access percentile value
                value: player.percentiles?.percent_games,
                displayValue:
                  player.percent_games !== null
                    ? `${(Math.min(player.percent_games, 1) * 100).toFixed(0)}%`
                    : "N/A"
              },
              // Add other relevant metrics (excluding GP% as it's already added)
              ...relevantMetrics
                .filter(({ key }) => key !== "percent_games")
                .map(({ key, label }): DetailItemData => {
                  // Safely access percentile value
                  const pctVal = player.percentiles?.[key];
                  return {
                    key: key,
                    label: label,
                    value: pctVal,
                    displayValue:
                      pctVal !== undefined && pctVal !== null
                        ? `${pctVal.toFixed(0)}%`
                        : "0%" // Handle undefined/null
                  };
                })
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
                        src={`/teamLogos/${teamAbbr ?? "default"}.png`}
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
    useState<Record<string, boolean>>(defaultPositions); // State for positions
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
    return Array.from(metricsMap.values()).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }, []);

  // --- Metric Filter State (Initialize with all true) ---
  const [selectedMetrics, setSelectedMetrics] = useState<
    Record<MetricKey, boolean>
  >(() => {
    return Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, true])
    ) as Record<MetricKey, boolean>;
  });

  // --- Data Fetching (useEffect - unchanged) ---
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      let allData: UnifiedPlayerData[] = [];
      let from = 0;
      const supabasePageSize = 1000;
      try {
        // Determine optional gameId override from URL (quick dev convenience)
        let gameId: string | null = null;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const override = params.get("gameId");
          if (override) gameId = override;
        }

        // If no override, try to infer latest game_id from yahoo_game_keys
        if (!gameId) {
          try {
            const { data: gameRow } = await supabase
              .from("yahoo_game_keys")
              .select("game_id")
              .eq("code", "nhl")
              .order("season", { ascending: false })
              .limit(1)
              .single();
            if (gameRow && gameRow.game_id) gameId = String(gameRow.game_id);
          } catch (e) {
            // non-fatal, continue without game filter
            console.warn("Could not read game_id from yahoo_game_keys:", e);
          }
        }

        // Query `yahoo_nhl_player_map_mat` with pagination
        while (true) {
          let builder = supabase
            .from("yahoo_nhl_player_map_mat")
            .select("*", { count: "exact" })
            .range(from, from + supabasePageSize - 1);

          // Note: yahoo_nhl_player_map_mat does not include game_id, so we do not filter by it here.

          const { data, error, count } = await builder;
          if (error) throw error;
          if (!data) break;

          // Map DB rows (which may include extra fields) into UnifiedPlayerData shape
          const mapped = (data as any[]).map((r) => ({
            nhl_player_id: r.nhl_player_id ? String(r.nhl_player_id) : "",
            nhl_player_name: r.nhl_player_name || "",
            nhl_team_abbreviation: r.nhl_team_abbreviation || r.normalized_team || null,
            yahoo_player_id: r.yahoo_player_id ? String(r.yahoo_player_id) : null,
            yahoo_player_name: r.yahoo_player_name || null,
            yahoo_team: r.yahoo_team || null,
            percent_ownership:
              typeof r.percent_ownership === "number"
                ? r.percent_ownership
                : r.percent_ownership != null
                  ? Number(r.percent_ownership)
                  : null,
            eligible_positions: r.eligible_positions || null,
            off_nights: r.off_nights ?? null,
            points:
              r.points != null
                ? typeof r.points === "number" ? r.points : Number(r.points)
                : null,
            goals:
              r.goals != null
                ? typeof r.goals === "number" ? r.goals : Number(r.goals)
                : null,
            assists:
              r.assists != null
                ? typeof r.assists === "number" ? r.assists : Number(r.assists)
                : null,
            shots:
              r.shots != null
                ? typeof r.shots === "number" ? r.shots : Number(r.shots)
                : null,
            pp_points:
              r.pp_points != null
                ? typeof r.pp_points === "number" ? r.pp_points : Number(r.pp_points)
                : null,
            blocked_shots:
              r.blocked_shots != null
                ? typeof r.blocked_shots === "number" ? r.blocked_shots : Number(r.blocked_shots)
                : null,
            hits:
              r.hits != null
                ? typeof r.hits === "number" ? r.hits : Number(r.hits)
                : null,
            total_fow:
              r.total_fow != null
                ? typeof r.total_fow === "number" ? r.total_fow : Number(r.total_fow)
                : null,
            penalty_minutes:
              r.penalty_minutes != null
                ? typeof r.penalty_minutes === "number" ? r.penalty_minutes : Number(r.penalty_minutes)
                : null,
            sh_points:
              r.sh_points != null
                ? typeof r.sh_points === "number" ? r.sh_points : Number(r.sh_points)
                : null,
            wins:
              r.wins != null
                ? typeof r.wins === "number" ? r.wins : Number(r.wins)
                : null,
            saves:
              r.saves != null
                ? typeof r.saves === "number" ? r.saves : Number(r.saves)
                : null,
            shots_against:
              r.shots_against != null
                ? typeof r.shots_against === "number" ? r.shots_against : Number(r.shots_against)
                : null,
            shutouts:
              r.shutouts != null
                ? typeof r.shutouts === "number" ? r.shutouts : Number(r.shutouts)
                : null,
            quality_start:
              r.quality_start != null
                ? typeof r.quality_start === "number" ? r.quality_start : Number(r.quality_start)
                : null,
            goals_against_avg:
              r.goals_against_avg != null
                ? typeof r.goals_against_avg === "number" ? r.goals_against_avg : Number(r.goals_against_avg)
                : null,
            save_pct:
              r.save_pct != null
                ? typeof r.save_pct === "number" ? r.save_pct : Number(r.save_pct)
                : null,
            player_type: r.player_type === "goalie" || r.player_type === "G" ? "goalie" : "skater",
            current_team_abbreviation: r.nhl_team_abbreviation || r.normalized_team || r.yahoo_team || null,
            percent_games:
              r.percent_games != null
                ? typeof r.percent_games === "number" ? r.percent_games : Number(r.percent_games)
                : null,
            status: r.status || null,
            injury_note: r.injury_note || null
          }));

          allData = allData.concat(mapped as UnifiedPlayerData[]);

          if (count !== null && allData.length >= count) break;
          if (data.length < supabasePageSize) break;
          from += supabasePageSize;
        }

        setPlayersData(allData);
      } catch (error) {
        console.error("Failed to load player data:", error);
        setPlayersData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // ---------------------------
  // Memoized Calculations (Unchanged logic, but dependencies ensure updates)
  // ---------------------------

  const getOffNightsForPlayer = useMemo(
    /* ... unchanged ... */
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

  // --- Filtered Players (Now depends on selectedPositions state) ---
  const filteredPlayers = useMemo(() => {
    const result = playersData.filter((player) => {
      // Ownership filter
      if (
        player.percent_ownership === null ||
        player.percent_ownership === 0 ||
        player.percent_ownership > ownershipThreshold
      )
        return false;

      // Team filter
      const playerTeamAbbr = normalizeTeamAbbreviation(
        player.current_team_abbreviation || player.yahoo_team,
        player.yahoo_team
      );
      if (teamFilter !== "ALL" && teamFilter !== playerTeamAbbr) return false;

      // --- Position Filter (Crucial Part) ---
      const hasEligiblePositions =
        player.eligible_positions && player.eligible_positions.length > 0;

      // Handle Goalies
      if (player.player_type === "goalie") {
        // Show goalie ONLY if the 'G' position filter is selected
        return selectedPositions["G"];
      }
      // Handle Skaters
      else {
        // Skater needs eligible positions defined
        if (!hasEligiblePositions) return false;
        // Show skater if ANY of their eligible positions match ANY selected non-G position filter
        return player.eligible_positions!.some(
          (pos) => pos !== "G" && selectedPositions[pos]
        );
      }
    });
    return result;
    // Dependency on selectedPositions is key here!
  }, [playersData, ownershipThreshold, teamFilter, selectedPositions]);

  // --- Compute Percentiles (Logic unchanged) ---
  const playersWithPercentiles: PlayerWithPercentiles[] = useMemo(() => {
    if (filteredPlayers.length === 0) return [];

    const skaters = filteredPlayers.filter((p) => p.player_type === "skater");
    const goalies = filteredPlayers.filter((p) => p.player_type === "goalie");

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
      validValues.sort((a, b) => a - b);
      const count = validValues.length;
      let numAbove = 0;
      let numEqual = 0;
      for (const v of validValues) {
        if (v > value) {
          numAbove++;
        } else if (v === value) {
          numEqual++;
        }
      }
      if (count === 1) return 50.0;
      return count > 0 ? ((numAbove + 0.5 * numEqual) / count) * 100 : 0;
    }

    function assignPercentiles(
      group: UnifiedPlayerData[],
      metrics: MetricDefinition[]
    ): PlayerWithPercentiles[] {
      if (group.length === 0) return [];
      const metricValuesMap: Map<MetricKey, (number | null)[]> = new Map();

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

        for (const { key } of metrics) {
          const rawVal = player[key as keyof UnifiedPlayerData] as
            | number
            | null;
          const allValues = metricValuesMap.get(key) || [];
          let pct = 0;

          if (key === "goals_against_avg") {
            pct = computeInvertedPercentile(allValues, rawVal);
          } else {
            pct = computePercentile(allValues, rawVal);
          }

          percentiles[key] = pct;
          if (rawVal !== null && rawVal !== undefined) {
            sum += pct;
            count++;
          }
        }

        const composite = count > 0 ? sum / count : 0;

        const finalPercentiles = metrics.reduce(
          (acc, { key }) => {
            acc[key] = percentiles[key] ?? 0;
            return acc;
          },
          {} as Record<MetricKey, number>
        );

        return {
          ...player,
          percentiles: finalPercentiles,
          composite
        };
      });
    }

    const skatersWithPct = assignPercentiles(skaters, skaterMetrics);
    const goaliesWithPct = assignPercentiles(goalies, goalieMetrics);

    // Combine and ensure `percentiles` is always an object
    const result = [...skatersWithPct, ...goaliesWithPct].map((player) => ({
      ...player,
      percentiles: player.percentiles || {} // Ensure percentiles object exists
    }));
    return result;
  }, [filteredPlayers]);

  // --- Calculate Display Scores (Logic unchanged, depends on playersWithPercentiles & selectedMetrics) ---
  const playersWithScores: PlayerWithScores[] = useMemo(() => {
    const activeMetricKeys = Object.entries(selectedMetrics)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => key as MetricKey);

    const numActiveMetrics = activeMetricKeys.length;
    const totalPossibleMetricsCount = allPossibleMetrics.length;

    let globalFilterMode: PlayerWithScores["filterMode"] = "multiple";
    if (numActiveMetrics === 0) globalFilterMode = "none";
    else if (numActiveMetrics === totalPossibleMetricsCount)
      globalFilterMode = "all";
    else if (numActiveMetrics === 1) globalFilterMode = "single";

    const result = playersWithPercentiles.map((player): PlayerWithScores => {
      const relevantMetricsForPlayer =
        player.player_type === "skater" ? skaterMetrics : goalieMetrics;
      const relevantMetricKeysForPlayer = new Set(
        relevantMetricsForPlayer.map((m) => m.key)
      );

      const applicableSelectedMetrics = activeMetricKeys.filter((key) =>
        relevantMetricKeysForPlayer.has(key)
      );
      const numApplicableSelected = applicableSelectedMetrics.length;

      let playerFilterMode = globalFilterMode;
      if (globalFilterMode === "all") {
        if (numApplicableSelected === relevantMetricsForPlayer.length)
          playerFilterMode = "all";
        else if (numApplicableSelected === 0) playerFilterMode = "none";
        else if (numApplicableSelected === 1) playerFilterMode = "single";
        else playerFilterMode = "multiple";
      } else if (globalFilterMode === "single") {
        playerFilterMode = numApplicableSelected === 1 ? "single" : "none";
      } else if (globalFilterMode === "multiple") {
        if (numApplicableSelected === 0) playerFilterMode = "none";
        else if (numApplicableSelected === 1) playerFilterMode = "single";
        else playerFilterMode = "multiple";
      }

      let displayScore = 0;
      let sortByValue = 0;

      switch (playerFilterMode) {
        case "all":
          displayScore = player.composite;
          sortByValue = player.composite;
          break;
        case "single":
          const singleMetricKey = applicableSelectedMetrics[0];
          let otherSum = 0;
          let otherCount = 0;
          relevantMetricsForPlayer.forEach(({ key }) => {
            // Safely access percentile value
            const pct = player.percentiles?.[key];
            if (key !== singleMetricKey && pct !== undefined && pct !== null) {
              otherSum += pct;
              otherCount++;
            }
          });
          displayScore = otherCount > 0 ? otherSum / otherCount : 0;
          // Safely access percentile value for sorting
          sortByValue = player.percentiles?.[singleMetricKey] ?? 0;
          break;
        case "multiple":
          let selectedSum = 0;
          let selectedCount = 0;
          applicableSelectedMetrics.forEach((key) => {
            // Safely access percentile value
            const pct = player.percentiles?.[key];
            if (pct !== undefined && pct !== null) {
              selectedSum += pct;
              selectedCount++;
            }
          });
          displayScore = selectedCount > 0 ? selectedSum / selectedCount : 0;
          sortByValue = displayScore;
          break;
        case "none":
        default:
          displayScore = 0;
          sortByValue = -1;
          break;
      }

      return {
        ...player,
        displayScore,
        sortByValue,
        filterMode: playerFilterMode,
        activeSelectedMetrics: applicableSelectedMetrics
      };
    });
    return result;
  }, [playersWithPercentiles, selectedMetrics, allPossibleMetrics]);

  // --- Sorted Players (Logic unchanged) ---
  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...playersWithScores];
    sortablePlayers.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortKey === "composite") {
        aValue = a.sortByValue;
        bValue = b.sortByValue;
      } else if (sortKey === "off_nights") {
        aValue = getOffNightsForPlayer(a);
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
        aValue = a.percent_games;
        bValue = b.percent_games;
      } else {
        aValue = a[sortKey as keyof PlayerWithScores];
        bValue = b[sortKey as keyof PlayerWithScores];
      }

      const isInvalidA =
        aValue === "N/A" || aValue === null || aValue === undefined;
      const isInvalidB =
        bValue === "N/A" || bValue === null || bValue === undefined;

      if (isInvalidA && isInvalidB) return 0;
      if (isInvalidA) return sortOrder === "desc" ? 1 : -1;
      if (isInvalidB) return sortOrder === "desc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === "asc" ? comparison : -comparison;
      } else {
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }
    });
    return sortablePlayers;
  }, [playersWithScores, sortKey, sortOrder, getOffNightsForPlayer]);

  // --- Pagination Calculation (Unchanged) ---
  const totalPages = Math.ceil(sortedPlayers.length / pageSize);
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPlayers.slice(startIndex, startIndex + pageSize);
  }, [sortedPlayers, currentPage, pageSize]);

  // --- Team Options Calculation (Unchanged) ---
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

  // --- Event Handlers (handleSort, toggleExpand, toggleMobileMinimize unchanged) ---
  const handleSort = (column: SortKey) => {
    setCurrentPage(1);
    if (sortKey === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortKey(column);
      setSortOrder("desc");
    }
  };

  const toggleExpand = (playerId: string) => {
    setExpanded((prev) => ({ ...prev, [playerId]: !prev[playerId] }));
  };

  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

  // --- resetFilters (Now resets selectedPositions too) ---
  const resetFilters = () => {
    setOwnershipThreshold(defaultOwnershipThreshold);
    setTeamFilter(defaultTeamFilter);
    setSelectedPositions(defaultPositions); // Reset positions to default
    // Reset metric filters to all true
    const initialMetrics = Object.fromEntries(
      allPossibleMetrics.map((metric) => [metric.key, true])
    ) as Record<MetricKey, boolean>;
    setSelectedMetrics(initialMetrics);
    // Reset sort order and pagination
    setCurrentPage(1);
    setSortKey("composite");
    setSortOrder("desc");
    setIsMobileMinimized(false);
  };

  // --- Effects (Unchanged) ---
  useEffect(() => {
    setCurrentPage(1);
    setExpanded({});
  }, [ownershipThreshold, teamFilter, selectedPositions, selectedMetrics]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (currentPage < 1 && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // --- Render Logic ---
  return (
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.containerMinimized
      )}
    >
      {/* Pass position state and setter to Filters */}
      <Filters
        ownershipThreshold={ownershipThreshold}
        setOwnershipThreshold={setOwnershipThreshold}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        selectedPositions={selectedPositions} // Pass state
        setSelectedPositions={setSelectedPositions} // Pass setter
        resetFilters={resetFilters}
        teamOptions={teamOptions}
        isMobile={isMobile}
        isMobileMinimized={isMobileMinimized}
        toggleMobileMinimize={toggleMobileMinimize}
        allPossibleMetrics={allPossibleMetrics}
        selectedMetrics={selectedMetrics}
        setSelectedMetrics={setSelectedMetrics}
      />

      {/* Table Content Area */}
      <div id="player-table-content" className={styles.collapsibleContent}>
        {loading ? (
          <div className={styles.message}>Loading players...</div>
        ) : paginatedPlayers.length === 0 ? (
          <div className={styles.message}>
            No players match the current filters.
          </div>
        ) : (
          <>
            {(!isMobile || !isMobileMinimized) && (
              <>
                {isMobile ? (
                  <MobileTable
                    // Use paginatedPlayers derived from filteredPlayers
                    players={paginatedPlayers}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    handleSort={handleSort}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    getOffNightsForPlayer={getOffNightsForPlayer}
                    selectedMetrics={selectedMetrics}
                  />
                ) : (
                  <DesktopTable
                    // Use paginatedPlayers derived from filteredPlayers
                    players={paginatedPlayers}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    handleSort={handleSort}
                    getOffNightsForPlayer={getOffNightsForPlayer}
                    selectedMetrics={selectedMetrics}
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
