// components/PlayerPickupTable/PlayerPickupTable.tsx

import React, { useState, useEffect, useMemo } from "react";
import supabase from "lib/supabase"; // Assuming lib/supabase is configured
import styles from "./PlayerPickupTable.module.scss";
import Image from "next/image";
import clsx from "clsx"; // <--- Make sure to install and import clsx

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
  composite: number;
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
  { key: "percent_games", label: "GP%" }
];

const goalieMetrics: MetricDefinition[] = [
  { key: "wins", label: "W" },
  { key: "saves", label: "SV" },
  { key: "shots_against", label: "SA" },
  { key: "shutouts", label: "SO" },
  { key: "quality_start", label: "QS" },
  { key: "goals_against_avg", label: "GAA" },
  { key: "save_pct", label: "SV%" },
  { key: "percent_games", label: "GP%" }
];

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

function getRankColorStyle(percentile: number): React.CSSProperties {
  if (percentile === undefined || percentile === null) {
    return { backgroundColor: `rgba(128, 128, 128, 0.45)` };
  }
  const weight = Math.max(0, Math.min(100, percentile)) / 100;
  const r = Math.round(255 * (1 - weight));
  const g = Math.round(255 * weight);
  return { backgroundColor: `rgba(${r}, ${g}, 0, 0.45)` };
}

// ---------------------------
// Child Components
// ---------------------------

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
  isMobileMinimized: boolean; // Prop to indicate minimized state
  toggleMobileMinimize: () => void; // Prop to toggle minimize state
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
  isMobileMinimized, // Destructure new props
  toggleMobileMinimize // Destructure new props
}) => {
  const handlePositionChange = (pos: string) => {
    setSelectedPositions((prev: Record<string, boolean>) => ({
      ...prev,
      [pos]: !prev[pos]
    }));
  };

  // Handler for title click, only works on mobile
  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;

  return (
    // Apply minimized class conditionally
    <div
      className={clsx(
        styles.filters,
        isMobile && isMobileMinimized && styles.minimized
      )}
    >
      <div
        className={styles.filtersTitle}
        onClick={handleTitleClick} // Add onClick for mobile toggle
        role={isMobile ? "button" : undefined} // Accessibility
        tabIndex={isMobile ? 0 : undefined} // Accessibility
        aria-expanded={isMobile ? !isMobileMinimized : undefined} // Accessibility
        aria-controls={isMobile ? "player-table-content" : undefined} // Accessibility (points to content ID)
      >
        <span className={styles.acronym}>BPA</span> -{" "}
        <span className={styles.acronym}>B</span>est{" "}
        <span className={styles.acronym}>P</span>layer{" "}
        <span className={styles.acronym}>A</span>vailable
        {/* Minimize/Maximize Icon (only on mobile) */}
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

      {/* Conditionally render filter controls based on mobile minimize state */}
      {(!isMobile || !isMobileMinimized) && (
        <>
          {isMobile ? (
            // --- Mobile Filter Controls ---
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
            // --- Desktop Filter Controls ---
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

          {/* Reset button is also part of the collapsible content */}
          <button className={styles.buttonReset} onClick={resetFilters}>
            Reset Filters
          </button>
        </>
      )}
    </div>
  );
};

// Table Components (Desktop & Mobile)
type SortKey = keyof PlayerWithPercentiles;
interface PlayerTableCommonProps {
  players: PlayerWithPercentiles[];
  sortKey: SortKey;
  sortOrder: "asc" | "desc";
  handleSort: (column: SortKey) => void;
  getOffNightsForPlayer: (player: UnifiedPlayerData) => number | string;
}
interface DesktopTableProps extends PlayerTableCommonProps {}
const DesktopTable: React.FC<DesktopTableProps> = ({
  players,
  sortKey,
  sortOrder,
  handleSort,
  getOffNightsForPlayer
}) => {
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          {" "}
          <col style={{ width: "18%" }} /> <col style={{ width: "6%" }} />{" "}
          <col style={{ width: "6%" }} /> <col style={{ width: "6%" }} />{" "}
          <col style={{ width: "6%" }} /> <col style={{ width: "6%" }} />{" "}
          <col style={{ width: "45%" }} /> <col style={{ width: "7%" }} />{" "}
        </colgroup>
        <thead>
          {" "}
          <tr>
            {" "}
            <th onClick={() => handleSort("nhl_player_name")}>
              {" "}
              Name{" "}
              {sortKey === "nhl_player_name"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}{" "}
            </th>{" "}
            <th onClick={() => handleSort("nhl_team_abbreviation")}>
              {" "}
              Team{" "}
              {sortKey === "nhl_team_abbreviation"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}{" "}
            </th>{" "}
            <th onClick={() => handleSort("percent_ownership")}>
              {" "}
              Own %{" "}
              {sortKey === "percent_ownership"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}{" "}
            </th>{" "}
            <th>Pos.</th>{" "}
            <th onClick={() => handleSort("off_nights")}>
              {" "}
              Off-Nights{" "}
              {sortKey === "off_nights"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}{" "}
            </th>{" "}
            <th onClick={() => handleSort("percent_games")}>GP%</th>{" "}
            <th>Percentile Ranks</th>{" "}
            <th onClick={() => handleSort("composite")}>
              {" "}
              Score{" "}
              {sortKey === "composite"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}{" "}
            </th>{" "}
          </tr>{" "}
        </thead>
        <tbody>
          {players.map((player) => {
            const relevantMetrics =
              player.player_type === "skater" ? skaterMetrics : goalieMetrics;
            const teamAbbr = normalizeTeamAbbreviation(
              player.current_team_abbreviation || player.yahoo_team,
              player.yahoo_team
            );
            return (
              <tr key={player.nhl_player_id}>
                <td>
                  {" "}
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
                  </div>{" "}
                </td>
                <td>
                  {" "}
                  {teamAbbr ? (
                    <Image
                      src={`/teamLogos/${teamAbbr}.png`}
                      alt={teamAbbr}
                      width={30}
                      height={30}
                    />
                  ) : (
                    "N/A"
                  )}{" "}
                </td>
                <td>
                  {" "}
                  {player.percent_ownership !== null
                    ? `${player.percent_ownership}%`
                    : "N/A"}{" "}
                </td>
                <td>
                  {" "}
                  {player.eligible_positions?.join(", ") ||
                    (player.player_type === "goalie" ? "G" : "N/A")}{" "}
                </td>
                <td>{getOffNightsForPlayer(player)}</td>
                <td>
                  {" "}
                  {player.percent_games !== null ? (
                    <div className={styles.percentileContainer}>
                      <div
                        className={styles.percentileBox}
                        style={getRankColorStyle(
                          player.percentiles.percent_games
                        )}
                      >
                        {(Math.min(player.percent_games, 1) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ) : (
                    "N/A"
                  )}{" "}
                </td>
                <td>
                  {" "}
                  <div className={styles.percentileFlexContainer}>
                    {relevantMetrics
                      .filter(({ key }) => key !== "percent_games")
                      .map(({ key, label }) => {
                        const pctVal = player.percentiles[key];
                        return (
                          <div key={key} className={styles.percentileContainer}>
                            <div className={styles.percentileLabel}>
                              {label}
                            </div>
                            <div
                              className={styles.percentileBox}
                              style={getRankColorStyle(pctVal)}
                            >
                              {pctVal !== undefined
                                ? `${pctVal.toFixed(0)}%`
                                : "0%"}
                            </div>
                          </div>
                        );
                      })}
                  </div>{" "}
                </td>
                <td>{player.composite.toFixed(1)}</td>
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
  getOffNightsForPlayer
}) => {
  const totalColumns = 7;
  return (
    <div className={styles.containerMobile}>
      <table className={styles.tableMobile}>
        <colgroup>
          {" "}
          <col style={{ width: "5%" }} /> <col style={{ width: "35%" }} />{" "}
          <col style={{ width: "10%" }} /> <col style={{ width: "10%" }} />{" "}
          <col style={{ width: "15%" }} /> <col style={{ width: "10%" }} />{" "}
          <col style={{ width: "15%" }} />{" "}
        </colgroup>
        <thead>
          {" "}
          <tr>
            {" "}
            <th></th>{" "}
            <th onClick={() => handleSort("nhl_player_name")}>
              Name{" "}
              {sortKey === "nhl_player_name"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>{" "}
            <th onClick={() => handleSort("nhl_team_abbreviation")}>
              Team{" "}
              {sortKey === "nhl_team_abbreviation"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>{" "}
            <th onClick={() => handleSort("percent_ownership")}>
              Own{" "}
              {sortKey === "percent_ownership"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>{" "}
            <th>Pos.</th>{" "}
            <th onClick={() => handleSort("off_nights")}>
              Offs{" "}
              {sortKey === "off_nights"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>{" "}
            <th onClick={() => handleSort("composite")}>
              Score{" "}
              {sortKey === "composite"
                ? sortOrder === "desc"
                  ? "▼"
                  : "▲"
                : ""}
            </th>{" "}
          </tr>{" "}
        </thead>
        <tbody>
          {players.map((player) => {
            const relevantMetrics =
              player.player_type === "skater" ? skaterMetrics : goalieMetrics;
            const teamAbbr = normalizeTeamAbbreviation(
              player.current_team_abbreviation || player.yahoo_team,
              player.yahoo_team
            );
            const isExpanded = expanded[player.nhl_player_id];
            const allDetailItems = [
              {
                key: "percent_games",
                label: "GP%",
                value: player.percentiles.percent_games,
                displayValue:
                  player.percent_games !== null
                    ? `${(Math.min(player.percent_games, 1) * 100).toFixed(0)}%`
                    : "N/A"
              },
              ...relevantMetrics
                .filter(({ key }) => key !== "percent_games")
                .map(({ key, label }) => ({
                  key: key,
                  label: label,
                  value: player.percentiles[key],
                  displayValue:
                    player.percentiles[key] !== undefined
                      ? `${player.percentiles[key].toFixed(0)}%`
                      : "0%"
                }))
            ];
            const midpoint = Math.ceil(allDetailItems.length / 2);
            const row1Items = allDetailItems.slice(0, midpoint);
            const row2Items = allDetailItems.slice(midpoint);
            return (
              <React.Fragment key={player.nhl_player_id}>
                <tr>
                  <td>
                    {" "}
                    <button
                      onClick={() => toggleExpand(player.nhl_player_id)}
                      className={styles.expandButton}
                      aria-expanded={isExpanded}
                      aria-controls={`details-${player.nhl_player_id}`}
                    >
                      {" "}
                      {isExpanded ? "−" : "+"}{" "}
                    </button>{" "}
                  </td>
                  <td>
                    {" "}
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
                    {teamAbbr ? (
                      <Image
                        src={`/teamLogos/${teamAbbr}.png`}
                        alt={teamAbbr}
                        width={25}
                        height={25}
                      />
                    ) : (
                      "N/A"
                    )}{" "}
                  </td>
                  <td>
                    {" "}
                    {player.percent_ownership !== null
                      ? `${player.percent_ownership}%`
                      : "N/A"}{" "}
                  </td>
                  <td>
                    {" "}
                    {player.eligible_positions?.join(", ") ||
                      (player.player_type === "goalie" ? "G" : "N/A")}{" "}
                  </td>
                  <td> {getOffNightsForPlayer(player)} </td>
                  <td> {player.composite.toFixed(1)} </td>
                </tr>
                {isExpanded && (
                  <tr className={styles.expandedRow}>
                    <td
                      colSpan={totalColumns}
                      id={`details-${player.nhl_player_id}`}
                    >
                      <div className={styles.expandedDetails}>
                        <div className={styles.detailRow}>
                          {" "}
                          {row1Items.map((item) => (
                            <div key={item.key} className={styles.detailItem}>
                              <span className={styles.detailLabel}>
                                {item.label}:
                              </span>
                              <span
                                className={styles.detailValue}
                                style={getRankColorStyle(item.value)}
                              >
                                {item.displayValue}
                              </span>
                            </div>
                          ))}{" "}
                        </div>
                        {row2Items.length > 0 && (
                          <div className={styles.detailRow}>
                            {" "}
                            {row2Items.map((item) => (
                              <div key={item.key} className={styles.detailItem}>
                                <span className={styles.detailLabel}>
                                  {item.label}:
                                </span>
                                <span
                                  className={styles.detailValue}
                                  style={getRankColorStyle(item.value)}
                                >
                                  {item.displayValue}
                                </span>
                              </div>
                            ))}{" "}
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
      {" "}
      <button
        onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
      >
        {" "}
        Previous{" "}
      </button>{" "}
      <span>
        {" "}
        Page {currentPage} of {totalPages}{" "}
      </span>{" "}
      <button
        onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
      >
        {" "}
        Next{" "}
      </button>{" "}
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
  const [isMobileMinimized, setIsMobileMinimized] = useState(false); // State for mobile minimize

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
        console.log(`Fetched ${allData.length} players.`);
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

  // Return off-nights for a given player, using teamWeekData if available.
  const getOffNightsForPlayer = (
    player: UnifiedPlayerData
  ): number | string => {
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
  };

  // Filtered Players
  const filteredPlayers = useMemo(() => {
    return playersData.filter((player) => {
      // Basic checks for required data
      if (player.percent_ownership === null || player.percent_ownership === 0)
        return false;
      if (
        !player.eligible_positions ||
        player.eligible_positions.length === 0
      ) {
        // If no eligible positions, check if it's a Goalie and G is selected
        if (player.player_type !== "goalie" || !selectedPositions["G"]) {
          return false;
        }
      }

      // Ownership Threshold Filter
      if (player.percent_ownership > ownershipThreshold) return false;

      // Team Filter
      const playerTeamAbbr = normalizeTeamAbbreviation(
        player.current_team_abbreviation || player.yahoo_team, // Prioritize current NHL team
        player.yahoo_team // Use Yahoo team as fallback/secondary check
      );
      if (teamFilter !== "ALL" && teamFilter !== playerTeamAbbr) return false;

      // Position Filter
      const playerPositions =
        player.eligible_positions ||
        (player.player_type === "goalie" ? ["G"] : []);
      const positionMatch = playerPositions.some(
        (pos) => selectedPositions[pos]
      );
      if (!positionMatch) return false;

      // Off-Nights check (ensure it's calculable) - Optional filter depending on requirements
      const offNightsValue = getOffNightsForPlayer(player);
      if (
        offNightsValue === "N/A" ||
        offNightsValue === undefined ||
        offNightsValue === ""
      ) {
        // Decide if players without off-night data should be excluded
        // return false; // Uncomment to exclude players without off-night data
      }

      return true; // Player passes all filters
    });
  }, [
    playersData,
    ownershipThreshold,
    teamFilter,
    selectedPositions,
    getOffNightsForPlayer
  ]); // Include getOffNightsForPlayer dependency

  // Compute Percentiles & Composite Score
  const playersWithPercentiles: PlayerWithPercentiles[] = useMemo(() => {
    if (filteredPlayers.length === 0) return [];

    const skaters = filteredPlayers.filter((p) => p.player_type === "skater");
    const goalies = filteredPlayers.filter((p) => p.player_type === "goalie");

    function computePercentile(
      values: (number | null)[],
      value: number | null
    ): number {
      if (value === null) return 0;
      const validValues = values.filter((v) => v !== null) as number[];
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
      return ((numBelow + 0.5 * numEqual) / count) * 100;
    }

    function assignPercentiles(
      group: UnifiedPlayerData[],
      metrics: MetricDefinition[]
    ): PlayerWithPercentiles[] {
      if (group.length === 0) return [];
      const metricValuesMap: Map<MetricKey, (number | null)[]> = new Map();
      for (const { key } of metrics) {
        metricValuesMap.set(
          key,
          group.map((p) => p[key as keyof UnifiedPlayerData] as number | null)
        );
      }
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
            // Inverted logic for GAA
            const validValues = allValues.filter((v) => v !== null) as number[];
            if (validValues.length > 0 && rawVal !== null) {
              validValues.sort((a, b) => a - b);
              const totalCount = validValues.length;
              let numAbove = 0;
              let numEqual = 0;
              for (const v of validValues) {
                if (v > rawVal) numAbove++;
                else if (v === rawVal) numEqual++;
              }
              pct = ((numAbove + 0.5 * numEqual) / totalCount) * 100;
            }
          } else {
            // Standard logic
            pct = computePercentile(allValues, rawVal);
          }
          percentiles[key] = pct;
          if (rawVal !== null) {
            // Only add valid percentiles to composite
            sum += pct;
            count++;
          }
        }
        const composite = count > 0 ? sum / count : 0;
        return {
          ...player,
          percentiles: metrics.reduce((acc, { key }) => {
            acc[key] = percentiles[key] ?? 0;
            return acc;
          }, {} as Record<MetricKey, number>),
          composite
        };
      });
    }

    const skatersWithPct = assignPercentiles(skaters, skaterMetrics);
    const goaliesWithPct = assignPercentiles(goalies, goalieMetrics);
    return [...skatersWithPct, ...goaliesWithPct];
  }, [filteredPlayers]);

  // Sorted Players
  const sortedPlayers = useMemo(() => {
    const sortablePlayers = [...playersWithPercentiles];
    sortablePlayers.sort((a, b) => {
      let aValue: any =
        sortKey === "off_nights" ? getOffNightsForPlayer(a) : a[sortKey];
      let bValue: any =
        sortKey === "off_nights" ? getOffNightsForPlayer(b) : b[sortKey];
      if (aValue === "N/A")
        aValue = sortOrder === "desc" ? -Infinity : Infinity;
      if (bValue === "N/A")
        bValue = sortOrder === "desc" ? -Infinity : Infinity;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (sortKey === "nhl_team_abbreviation") {
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
      }
      if (sortKey === "nhl_player_name") {
        aValue = (a.yahoo_player_name || a.nhl_player_name || "").toLowerCase();
        bValue = (b.yahoo_player_name || b.nhl_player_name || "").toLowerCase();
      }
      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return sortablePlayers;
  }, [playersWithPercentiles, sortKey, sortOrder, getOffNightsForPlayer]);

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
    setCurrentPage(1);
    if (sortKey === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortKey(column);
      setSortOrder("desc");
    }
  };
  const resetFilters = () => {
    setOwnershipThreshold(defaultOwnershipThreshold);
    setTeamFilter(defaultTeamFilter);
    setSelectedPositions(defaultPositions);
    setCurrentPage(1);
    setSortKey("composite");
    setSortOrder("desc");
    setIsMobileMinimized(false); // Expand on reset
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
  useEffect(() => {
    setCurrentPage(1);
  }, [ownershipThreshold, teamFilter, selectedPositions]);
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1 && totalPages > 0) {
      setCurrentPage(1);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // --- Render Logic ---
  return (
    // Add class to container when minimized on mobile
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.containerMinimized
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
        // Pass minimize state and handler
        isMobileMinimized={isMobileMinimized}
        toggleMobileMinimize={toggleMobileMinimize}
      />

      {/* Content that gets hidden */}
      <div id="player-table-content" className={styles.collapsibleContent}>
        {loading ? (
          <div className={styles.message}>Loading players...</div>
        ) : paginatedPlayers.length === 0 ? (
          <div className={styles.message}>
            No players match the current filters.
          </div>
        ) : (
          // Render table/pagination only if NOT (mobile AND minimized)
          <>
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
                  />
                ) : (
                  <DesktopTable
                    players={paginatedPlayers}
                    sortKey={sortKey}
                    sortOrder={sortOrder}
                    handleSort={handleSort}
                    getOffNightsForPlayer={getOffNightsForPlayer}
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
