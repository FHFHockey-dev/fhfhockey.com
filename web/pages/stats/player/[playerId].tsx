import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React, { useState, useMemo } from "react";
import styles from "components/PlayerStats/PlayerStats.module.scss";
import { getCurrentSeason } from "lib/NHL/server";
import {
  formatPercent,
  formatTOI,
  formatSeason,
  formatDate
} from "utils/stats/formatters";
import { fetchAllGameLogRows } from "utils/stats/nhlStatsFetch";
import { PlayerStatsTable } from "components/PlayerStats/PlayerStatsTable";
import { PlayerStatsChart } from "components/PlayerStats/PlayerStatsChart";
import { PlayerStatsSummary } from "components/PlayerStats/PlayerStatsSummary";
import { PlayerStatsAdvancedNote } from "components/PlayerStats/PlayerStatsAdvancedNote";
import { PlayerPerformanceHeatmap } from "components/PlayerStats/PlayerPerformanceHeatmap";
import { PlayerRadarChart } from "components/PlayerStats/PlayerRadarChart";
import { PlayerContextualStats } from "components/PlayerStats/PlayerContextualStats";
import { usePlayerStats } from "hooks/usePlayerStats";
import { useRouter } from "next/router";

// Base interface for common game log properties
export interface BaseGameLogEntry {
  date: string;
  games_played: number | null; // Changed from number
  isPlayoff?: boolean;
  // Add index signature to allow string-based property access for dynamic stats
  [key: string]: any;
}

// Skater-specific game log entry
export interface SkaterGameLogEntry extends BaseGameLogEntry {
  goals: number | null;
  assists: number | null;
  points: number | null;
  plus_minus: number | null;
  shots: number | null;
  shooting_percentage: number | null;
  pp_points: number | null;
  gw_goals: number | null;
  fow_percentage: number | null;
  toi_per_game: number | null;
  blocked_shots: number | null;
  hits: number | null;
  takeaways: number | null;
  giveaways: number | null;
  sat_pct: number | null;
  zone_start_pct: number | null;
  // Advanced stats
  individual_sat_for_per_60: number | null;
  on_ice_shooting_pct: number | null;
  sat_relative: number | null;
  usat_pct: number | null;
}

// Goalie-specific game log entry
export interface GoalieGameLogEntry extends BaseGameLogEntry {
  games_started: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  save_pct: number | null;
  goals_against_avg: number | null;
  shutouts: number | null;
  saves: number | null;
  shots_against: number | null;
  goals_against: number | null;
  time_on_ice: string | null;
  quality_start: number | null;
  // Advanced stats
  goals_saved_above_average: number | null;
  high_danger_save_pct: number | null;
  medium_danger_save_pct: number | null;
}

// Union type for game log entries
export type GameLogEntry = SkaterGameLogEntry | GoalieGameLogEntry;

// Season totals interfaces
interface SkaterSeasonTotals {
  season: string | number;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  plus_minus: number | null;
  shots: number | null;
  shooting_percentage: number | null;
  pp_points: number | null;
  gw_goals: number | null;
  fow_percentage: number | null;
  toi_per_game: number | null;
  blocked_shots: number | null;
  hits: number | null;
  takeaways: number | null;
  giveaways: number | null;
  sat_pct: number | null;
  zone_start_pct: number | null;
}

interface GoalieSeasonTotals {
  season_id: string | number;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  goals_against_avg: number | null;
  save_pct: number | null;
  shutouts: number | null;
}

export type SeasonTotals = SkaterSeasonTotals | GoalieSeasonTotals;

interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
  team_id?: number;
  sweater_number?: number;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  heightInCentimeters?: number;
  weightInKilograms?: number;
  image_url?: string;
}

interface PlayerStatsPageProps {
  player: PlayerInfo | null;
  gameLog: GameLogEntry[];
  playoffGameLog: GameLogEntry[];
  seasonTotals: SeasonTotals[];
  isGoalie: boolean;
  availableSeasons: (string | number)[];
  mostRecentSeason?: string | number | null;
  usedGameLogFallback?: boolean;
}

// Position-specific stat configurations
const POSITION_STAT_CONFIGS = {
  // Centers
  C: {
    primary: ["points", "goals", "assists", "fow_percentage", "toi_per_game"],
    secondary: [
      "shots",
      "shooting_percentage",
      "pp_points",
      "hits",
      "blocked_shots"
    ],
    advanced: [
      // Possession & Shot Metrics
      "cf_pct",
      "ff_pct",
      "sf_pct",
      "xgf_pct",
      "hdcf_pct",
      // Individual Production
      "ixg_per_60",
      "icf_per_60",
      "shots_per_60",
      "goals_per_60",
      "total_points_per_60",
      // Zone Usage
      "off_zone_start_pct",
      "off_zone_faceoff_pct",
      // On-Ice Impact
      "on_ice_sh_pct",
      "on_ice_sv_pct",
      "pdo"
    ]
  },
  // Wingers
  LW: {
    primary: ["points", "goals", "assists", "shots", "shooting_percentage"],
    secondary: ["pp_points", "hits", "takeaways", "toi_per_game"],
    advanced: [
      // Possession & Shot Metrics
      "cf_pct",
      "ff_pct",
      "sf_pct",
      "xgf_pct",
      "hdcf_pct",
      // Individual Production
      "ixg_per_60",
      "icf_per_60",
      "shots_per_60",
      "goals_per_60",
      "rush_attempts_per_60",
      // Zone Usage
      "off_zone_start_pct",
      // On-Ice Impact
      "on_ice_sh_pct",
      "pdo"
    ]
  },
  RW: {
    primary: ["points", "goals", "assists", "shots", "shooting_percentage"],
    secondary: ["pp_points", "hits", "takeaways", "toi_per_game"],
    advanced: [
      // Possession & Shot Metrics
      "cf_pct",
      "ff_pct",
      "sf_pct",
      "xgf_pct",
      "hdcf_pct",
      // Individual Production
      "ixg_per_60",
      "icf_per_60",
      "shots_per_60",
      "goals_per_60",
      "rush_attempts_per_60",
      // Zone Usage
      "off_zone_start_pct",
      // On-Ice Impact
      "on_ice_sh_pct",
      "pdo"
    ]
  },
  // Defensemen
  D: {
    primary: ["points", "assists", "blocked_shots", "hits", "toi_per_game"],
    secondary: ["goals", "pp_points", "plus_minus", "takeaways", "giveaways"],
    advanced: [
      // Defensive Metrics
      "hdca_per_60",
      "sca_per_60",
      "shots_blocked_per_60",
      "xga_per_60",
      // Possession & Transition
      "cf_pct",
      "ff_pct",
      "sf_pct",
      "xgf_pct",
      // Individual Contributions
      "icf_per_60",
      "total_points_per_60",
      // Zone Usage & Deployment
      "def_zone_start_pct",
      "off_zone_start_pct",
      // On-Ice Impact
      "on_ice_sv_pct",
      "pdo"
    ]
  },
  // Goalies
  G: {
    primary: ["save_pct", "goals_against_avg", "wins", "saves", "shutouts"],
    secondary: [
      "games_started",
      "time_on_ice",
      "shots_against",
      "quality_start"
    ],
    advanced: [
      "goals_saved_above_average",
      "high_danger_save_pct",
      "medium_danger_save_pct"
    ]
  }
};

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  // Basic Stats
  points: "Points",
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shooting_percentage: "SH%",
  fow_percentage: "FO%",
  toi_per_game: "TOI/GP",
  pp_points: "PP Pts",
  hits: "Hits",
  blocked_shots: "Blocks",
  sat_pct: "Corsi%",
  zone_start_pct: "ZS%",
  save_pct: "SV%",
  goals_against_avg: "GAA",
  wins: "Wins",
  saves: "Saves",
  shutouts: "SO",
  plus_minus: "+/-",
  gw_goals: "GWG",
  takeaways: "Takeaways",
  giveaways: "Giveaways",

  // NST Advanced Stats - Possession Metrics
  cf_pct: "CF%",
  ff_pct: "FF%",
  sf_pct: "SF%",
  gf_pct: "GF%",
  xgf_pct: "xGF%",
  scf_pct: "SCF%",
  hdcf_pct: "HDCF%",
  mdcf_pct: "MDCF%",
  ldcf_pct: "LDCF%",

  // NST Advanced Stats - Per 60 Individual
  ixg_per_60: "ixG/60",
  icf_per_60: "iCF/60",
  iff_per_60: "iFF/60",
  iscfs_per_60: "iSCF/60",
  hdcf_per_60: "HDCF/60",
  shots_per_60: "SOG/60",
  goals_per_60: "G/60",
  total_assists_per_60: "A/60",
  total_points_per_60: "P/60",
  rush_attempts_per_60: "Rush/60",
  rebounds_created_per_60: "Reb/60",

  // NST Advanced Stats - Per 60 On-Ice Against
  hdca_per_60: "HDCA/60",
  sca_per_60: "SCA/60",
  shots_blocked_per_60: "BLK/60",
  xga_per_60: "xGA/60",
  ga_per_60: "GA/60",

  // NST Advanced Stats - Zone Usage
  off_zone_start_pct: "OZ Start%",
  def_zone_start_pct: "DZ Start%",
  neu_zone_start_pct: "NZ Start%",
  off_zone_faceoff_pct: "OZ FO%",

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: "oiSH%",
  on_ice_sv_pct: "oiSV%",
  pdo: "PDO",

  // NST Advanced Stats - Penalties
  pim_per_60: "PIM/60",
  total_penalties_per_60: "Pen/60",
  penalties_drawn_per_60: "PenD/60",

  // NST Advanced Stats - Discipline
  giveaways_per_60: "GV/60",
  takeaways_per_60: "TK/60",
  hits_per_60: "HIT/60"
};

function splitLabel(label: string) {
  const words = label.trim().split(" ");
  if (words.length === 1) return label;
  return (
    <>
      {words[0]}{" "}
      <span className={styles.spanColorBlue}>{words.slice(1).join(" ")}</span>
    </>
  );
}

export default function PlayerStatsPage({
  player,
  gameLog: ssrGameLog,
  playoffGameLog: ssrPlayoffGameLog,
  seasonTotals,
  isGoalie,
  availableSeasons,
  mostRecentSeason,
  usedGameLogFallback = false
}: PlayerStatsPageProps) {
  const router = useRouter();
  const { playerId, season } = router.query;

  // Use the hook to get advanced stats data
  const {
    gameLog: hookGameLog,
    seasonTotals: hookSeasonTotals,
    playerInfo: hookPlayerInfo,
    isGoalie: hookIsGoalie,
    isLoading: hookIsLoading,
    error: hookError
  } = usePlayerStats(
    typeof playerId === "string" ? playerId : undefined,
    typeof season === "string" ? season : mostRecentSeason?.toString()
  );

  // Use hook data if available and not loading, otherwise fall back to SSR data
  const gameLog =
    !hookIsLoading && hookGameLog.length > 0 ? hookGameLog : ssrGameLog;
  const playoffGameLog = ssrPlayoffGameLog; // Keep SSR playoff data for now

  const [selectedView, setSelectedView] = useState<
    "overview" | "gamelog" | "trends" | "advanced" | "season-stats"
  >("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<
    "season" | "l10" | "l20"
  >("season");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [showPlayoffData, setShowPlayoffData] = useState<boolean>(false);

  // Debug logging for advanced stats
  React.useEffect(() => {
    if (hookGameLog.length > 0) {
      console.log("[DEBUG] Hook game log sample:", hookGameLog[0]);
      console.log(
        "[DEBUG] Available advanced stats in hook data:",
        Object.keys(hookGameLog[0]).filter(
          (key) =>
            key.includes("_per_60") ||
            key.includes("_pct") ||
            key.includes("cf_") ||
            key.includes("ff_") ||
            key.includes("xg")
        )
      );
    }
    if (ssrGameLog.length > 0) {
      console.log("[DEBUG] SSR game log sample:", ssrGameLog[0]);
      console.log(
        "[DEBUG] Available stats in SSR data:",
        Object.keys(ssrGameLog[0])
      );
    }
  }, [hookGameLog, ssrGameLog]);

  // Get position-specific stat configuration
  const positionConfig = useMemo(() => {
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

  // Initialize selected stats based on position
  React.useEffect(() => {
    if (selectedStats.length === 0) {
      setSelectedStats(positionConfig.primary);
    }
  }, [positionConfig.primary, selectedStats.length]);

  // Filter game log based on timeframe
  const filteredGameLog = useMemo(() => {
    if (selectedTimeframe === "season") return gameLog;
    const games = selectedTimeframe === "l10" ? 10 : 20;
    return gameLog.slice(-games);
  }, [gameLog, selectedTimeframe]);

  // Calculate rolling averages and trends
  const processedGameLog = useMemo(() => {
    return filteredGameLog.map((game, index) => {
      const rollingWindow = filteredGameLog.slice(
        Math.max(0, index - 4),
        index + 1
      );
      const rollingStats: { [key: string]: number } = {};

      selectedStats.forEach((stat) => {
        const values = rollingWindow.map((g) => Number(g[stat]) || 0);
        rollingStats[`${stat}_5game_avg`] =
          values.reduce((a, b) => a + b, 0) / values.length;
      });

      return {
        ...game,
        ...rollingStats
      };
    });
  }, [filteredGameLog, selectedStats]);

  const handleStatToggle = (stat: string) => {
    setSelectedStats((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  if (!player) {
    return (
      <div className={styles.playerStatsPageContainer}>
        <div className={styles.playerStatsSearchBar}>
          <PlayerSearchBar />
        </div>
        <div style={{ color: "#c00", fontWeight: 700, fontSize: 20 }}>
          Player not found.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.playerStatsPageContainer}>
      <div className={styles.playerStatsSearchBar}>
        <PlayerSearchBar />
      </div>

      {/* Player Header */}
      <div className={styles.playerHeader}>
        <div className={styles.playerImageContainer}>
          {player.image_url && (
            <img
              src={player.image_url}
              alt={player.fullName}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                objectFit: "cover",
                background: "#222"
              }}
            />
          )}
        </div>
        <div className={styles.playerInfo}>
          <h1 className={styles.playerName}>{splitLabel(player.fullName)}</h1>
          <div className={styles.playerDetails}>
            <div style={{ color: "#888", fontWeight: 600, marginBottom: 8 }}>
              #{player.sweater_number || "-"} | {player.position}
              {player.team_id && ` | Team ID: ${player.team_id}`}
            </div>
            <div style={{ fontSize: 15 }}>
              {player.birthDate && <span>Born: {player.birthDate}</span>}
              {player.birthCity && ` | ${player.birthCity}`}
              {player.birthCountry && `, ${player.birthCountry}`}
              <br />
              {player.heightInCentimeters && (
                <span>Height: {player.heightInCentimeters} cm</span>
              )}
              {player.weightInKilograms && (
                <span> | Weight: {player.weightInKilograms} kg</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabNavigation}>
        {(
          ["overview", "season-stats", "gamelog", "trends", "advanced"] as const
        ).map((tab) => (
          <button
            key={tab}
            className={`${styles.tabButton} ${selectedView === tab ? styles.active : ""}`}
            onClick={() => setSelectedView(tab)}
          >
            {tab === "season-stats"
              ? "Season Stats"
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Timeframe and Stat Selectors (only show for certain views) */}
      {(selectedView === "overview" ||
        selectedView === "gamelog" ||
        selectedView === "trends") && (
        <div className={styles.controlsSection}>
          <div className={styles.controlsGrid}>
            <div className={styles.timeframeSelector}>
              <h3 className={styles.controlHeader}>Timeframe</h3>
              <div className={styles.timeframeButtons}>
                {(["season", "l10", "l20"] as const).map((timeframe) => (
                  <button
                    key={timeframe}
                    className={`${styles.timeframeButton} ${selectedTimeframe === timeframe ? styles.active : ""}`}
                    onClick={() => setSelectedTimeframe(timeframe)}
                  >
                    {timeframe === "season"
                      ? "Season"
                      : timeframe.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.statSelector}>
              <h3 className={styles.controlHeader}>Stats to Display</h3>
              <div className={styles.statCategories}>
                <div className={styles.statCategory}>
                  <h4>Primary</h4>
                  <div className={styles.statCheckboxContainer}>
                    {positionConfig.primary.map((stat) => (
                      <label key={stat} className={styles.statCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedStats.includes(stat)}
                          onChange={() => handleStatToggle(stat)}
                        />
                        {STAT_DISPLAY_NAMES[stat] || stat}
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.statCategory}>
                  <h4>Secondary</h4>
                  <div className={styles.statCheckboxContainer}>
                    {positionConfig.secondary.map((stat) => (
                      <label key={stat} className={styles.statCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedStats.includes(stat)}
                          onChange={() => handleStatToggle(stat)}
                        />
                        {STAT_DISPLAY_NAMES[stat] || stat}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Season Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          margin: "1rem 0"
        }}
      >
        <label htmlFor="season-select" style={{ fontWeight: 600 }}>
          Season:
        </label>
        <select
          id="season-select"
          value={mostRecentSeason ?? ""}
          onChange={(e) => {
            const params = new URLSearchParams(window.location.search);
            params.set("season", e.target.value);
            window.location.search = params.toString();
          }}
        >
          {availableSeasons.map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </div>

      {/* Content Area */}
      <div className={styles.contentArea}>
        {selectedView === "overview" && (
          <div className={styles.overviewGrid}>
            <div className={styles.leftColumn}>
              <div className={styles.radarSection}>
                <PlayerRadarChart
                  player={player}
                  gameLog={filteredGameLog}
                  selectedStats={selectedStats}
                  isGoalie={isGoalie}
                />
              </div>
              <div className={styles.insightsSection}>
                <PlayerContextualStats
                  player={player}
                  gameLog={filteredGameLog}
                  playoffGameLog={playoffGameLog}
                  seasonTotals={seasonTotals}
                  isGoalie={isGoalie}
                />
              </div>
            </div>
            <div className={styles.rightColumn}>
              <div className={styles.calendarSection}>
                <PlayerPerformanceHeatmap
                  gameLog={filteredGameLog}
                  playoffGameLog={playoffGameLog}
                  selectedStats={selectedStats}
                  playerId={player.id}
                  playerTeamId={player.team_id}
                  seasonId={mostRecentSeason}
                />
              </div>
            </div>
          </div>
        )}

        {selectedView === "season-stats" && (
          <>
            <h3 className={styles.tableLabel}>
              {splitLabel(isGoalie ? "Goalie Season Stats" : "Season Stats")}
            </h3>
            <div className={styles.playerStatsTableContainer}>
              <table className={styles.playerStatsTable}>
                <thead>
                  <tr>
                    <th>Season</th>
                    <th>GP</th>
                    {isGoalie ? (
                      <>
                        <th>W</th>
                        <th>L</th>
                        <th>OTL</th>
                        <th>GAA</th>
                        <th>SV%</th>
                        <th>SO</th>
                      </>
                    ) : (
                      <>
                        <th>G</th>
                        <th>A</th>
                        <th>P</th>
                        <th>+/-</th>
                        <th>SOG</th>
                        <th>SH%</th>
                        <th>PPP</th>
                        <th>GWG</th>
                        <th>FO%</th>
                        <th>TOI</th>
                        <th>HIT</th>
                        <th>BLK</th>
                        <th>TK</th>
                        <th>GV</th>
                        <th>CF%</th>
                        <th>ZS%</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {seasonTotals.map((row: SeasonTotals, idx: number) => {
                    const isGoalieRow = "season_id" in row;
                    return (
                      <tr key={idx}>
                        <td>
                          {isGoalieRow
                            ? (row as GoalieSeasonTotals).season_id
                            : (row as SkaterSeasonTotals).season}
                        </td>
                        <td>{row.games_played || 0}</td>
                        {isGoalie ? (
                          <>
                            <td>{(row as GoalieSeasonTotals).wins || 0}</td>
                            <td>{(row as GoalieSeasonTotals).losses || 0}</td>
                            <td>
                              {(row as GoalieSeasonTotals).ot_losses || 0}
                            </td>
                            <td>
                              {formatPercent(
                                (row as GoalieSeasonTotals).goals_against_avg
                              )}
                            </td>
                            <td>
                              {formatPercent(
                                (row as GoalieSeasonTotals).save_pct
                              )}
                            </td>
                            <td>{(row as GoalieSeasonTotals).shutouts || 0}</td>
                          </>
                        ) : (
                          <>
                            <td>{(row as SkaterSeasonTotals).goals || 0}</td>
                            <td>{(row as SkaterSeasonTotals).assists || 0}</td>
                            <td>{(row as SkaterSeasonTotals).points || 0}</td>
                            <td>
                              {(row as SkaterSeasonTotals).plus_minus || 0}
                            </td>
                            <td>{(row as SkaterSeasonTotals).shots || 0}</td>
                            <td>
                              {formatPercent(
                                (row as SkaterSeasonTotals).shooting_percentage
                              )}
                            </td>
                            <td>
                              {(row as SkaterSeasonTotals).pp_points || 0}
                            </td>
                            <td>{(row as SkaterSeasonTotals).gw_goals || 0}</td>
                            <td>
                              {formatPercent(
                                (row as SkaterSeasonTotals).fow_percentage
                              )}
                            </td>
                            <td>
                              {formatTOI(
                                (row as SkaterSeasonTotals).toi_per_game
                              )}
                            </td>
                            <td>{(row as SkaterSeasonTotals).hits || 0}</td>
                            <td>
                              {(row as SkaterSeasonTotals).blocked_shots || 0}
                            </td>
                            <td>
                              {(row as SkaterSeasonTotals).takeaways || 0}
                            </td>
                            <td>
                              {(row as SkaterSeasonTotals).giveaways || 0}
                            </td>
                            <td>
                              {formatPercent(
                                (row as SkaterSeasonTotals).sat_pct
                              )}
                            </td>
                            <td>
                              {formatPercent(
                                (row as SkaterSeasonTotals).zone_start_pct
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedView === "gamelog" && (
          <>
            <h3 className={styles.tableLabel}>
              {splitLabel("Game Log")}{" "}
              {mostRecentSeason ? (
                <span style={{ fontWeight: 400, fontSize: "1rem" }}>
                  ({mostRecentSeason})
                </span>
              ) : (
                ""
              )}
            </h3>
            {usedGameLogFallback && (
              <div style={{ color: "#e6b800", marginBottom: 8 }}>
                No games found for this season. Showing most recent 10 games for
                this player instead.
              </div>
            )}

            <PlayerStatsTable
              gameLog={gameLog}
              playoffGameLog={playoffGameLog}
              selectedStats={["date", "games_played", ...selectedStats]}
              isGoalie={isGoalie}
              playerId={player.id}
              playerTeamId={player.team_id}
              seasonId={mostRecentSeason}
            />

            {gameLog.length === 0 && (
              <div style={{ color: "#c00", marginTop: 16 }}>
                <b>DEBUG:</b> No game log rows found.
                <br />
                playerIdNum: {player ? player.id : "N/A"}
                <br />
                selectedSeason: {mostRecentSeason}
              </div>
            )}
          </>
        )}

        {selectedView === "trends" && (
          <PlayerStatsChart
            gameLog={processedGameLog}
            selectedStats={selectedStats}
            showRollingAverage={true}
          />
        )}

        {selectedView === "advanced" && (
          <>
            {/* Shared Summary Section */}
            <PlayerStatsSummary
              gameLog={filteredGameLog}
              playoffGameLog={playoffGameLog}
              selectedStats={positionConfig.advanced}
              isGoalie={isGoalie}
              showPlayoffData={showPlayoffData}
            />

            {/* Shared Advanced Note */}
            <PlayerStatsAdvancedNote showAdvanced={true} />

            <div className={styles.advancedGrid}>
              <PlayerStatsChart
                gameLog={filteredGameLog}
                selectedStats={positionConfig.advanced}
                title="Advanced Metrics"
              />
              <div className={styles.advancedTable}>
                <PlayerStatsTable
                  gameLog={filteredGameLog}
                  selectedStats={positionConfig.advanced}
                  isGoalie={isGoalie}
                  showAdvanced={true}
                  playerId={player.id}
                  playerTeamId={player.team_id}
                  seasonId={mostRecentSeason}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { playerId, season } = context.query;
  if (!playerId || Array.isArray(playerId)) {
    return {
      props: {
        player: null,
        seasonTotals: [],
        isGoalie: false,
        gameLog: [],
        playoffGameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }
  // Convert playerId to number for Supabase query
  const playerIdNum = Number(playerId);
  if (isNaN(playerIdNum)) {
    return {
      props: {
        player: null,
        seasonTotals: [],
        isGoalie: false,
        gameLog: [],
        playoffGameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }
  // Fetch player info
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(
      `id, fullName, image_url, team_id, sweater_number, position, birthDate, birthCity, birthCountry, heightInCentimeters, weightInKilograms`
    )
    .eq("id", playerIdNum)
    .single();

  if (playerError || !player) {
    return {
      props: {
        player: null,
        seasonTotals: [],
        isGoalie: false,
        gameLog: [],
        playoffGameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }

  // Determine if player is a goalie
  const isGoalie =
    player.position && player.position.toUpperCase().startsWith("G");

  let seasonTotals: SeasonTotals[] = [];
  let mostRecentSeason: string | number | null = null;
  // Fetch current season info for game log
  const currentSeason = await getCurrentSeason();
  const currentSeasonString = String(currentSeason.seasonId); // e.g., "20242025"
  const currentSeasonId = currentSeason.seasonId; // number

  if (isGoalie) {
    // Goalie: fetch from wgo_goalie_stats_totals
    const { data, error } = await supabase
      .from("wgo_goalie_stats_totals")
      .select(
        `season_id, games_played, wins, losses, ot_losses, goals_against_avg, save_pct, shutouts`
      )
      .eq("goalie_id", playerIdNum)
      .order("season_id", { ascending: false });
    seasonTotals = (data as GoalieSeasonTotals[]) || [];
    mostRecentSeason =
      seasonTotals.length > 0
        ? (seasonTotals[0] as GoalieSeasonTotals).season_id
        : null;
  } else {
    // Skater: fetch from wgo_skater_stats_totals
    const { data, error } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `season, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
      )
      .eq("player_id", playerIdNum)
      .order("season", { ascending: false });
    seasonTotals = (data as SkaterSeasonTotals[]) || [];
    mostRecentSeason =
      seasonTotals.length > 0
        ? (seasonTotals[0] as SkaterSeasonTotals).season
        : null;
  }

  // Determine selected season for game log
  let selectedSeason = season
    ? String(season)
    : isGoalie
      ? seasonTotals.length > 0
        ? (seasonTotals[0] as GoalieSeasonTotals).season_id
        : null
      : seasonTotals.length > 0
        ? (seasonTotals[0] as SkaterSeasonTotals).season
        : null;
  if (!selectedSeason)
    selectedSeason = isGoalie ? currentSeasonId : currentSeasonString;

  // Ensure selectedSeason is a number for the query
  if (selectedSeason) selectedSeason = Number(selectedSeason);

  // Debug logging for types
  console.log(
    "[PlayerStatsPage][DEBUG] typeof playerIdNum:",
    typeof playerIdNum,
    "typeof selectedSeason:",
    typeof selectedSeason
  );

  // Fetch all game log rows for selected season
  let gameLog: GameLogEntry[] = [];
  let playoffGameLog: GameLogEntry[] = [];
  let usedGameLogFallback = false;

  if (isGoalie) {
    // Regular season goalie stats - remove opponent_abbr as it doesn't exist
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_goalie_stats",
      "goalie_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
    );

    // Playoff goalie stats - need to check if wgo_goalie_stats_playoffs table exists
    // For now, we'll skip playoff goalies since the table wasn't provided in the schema

    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_goalie_stats")
        .select(
          `date, games_played, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
        )
        .eq("goalie_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData as GameLogEntry[];
        usedGameLogFallback = true;
      }
    }
  } else {
    // Regular season skater stats
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_skater_stats",
      "player_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
    );

    // Playoff skater stats from wgo_skater_stats_playoffs
    try {
      const { data: playoffData, error: playoffError } = await supabase
        .from("wgo_skater_stats_playoffs")
        .select(
          `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
        )
        .eq("player_id", playerIdNum)
        .order("date", { ascending: false });

      if (playoffError) {
        console.error("Error fetching playoff data:", playoffError.message);
        playoffGameLog = [];
      } else if (playoffData) {
        playoffGameLog = playoffData.map((game) => ({
          ...game,
          isPlayoff: true
        })) as GameLogEntry[]; // <-- Add this type assertion
      }
    } catch (error) {
      console.error(
        "An unexpected error occurred while fetching playoff data:",
        error
      );
      playoffGameLog = [];
    }

    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_skater_stats")
        .select(
          `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
        )
        .eq("player_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData as GameLogEntry[];
        usedGameLogFallback = true;
      }
    }
  }

  // Debug logging
  console.log(
    "[PlayerStatsPage][DEBUG] playerIdNum:",
    playerIdNum,
    "selectedSeason:",
    selectedSeason,
    "gameLog.length:",
    gameLog.length
  );
  if (gameLog.length > 0) {
    console.log("[PlayerStatsPage][DEBUG] First row:", gameLog[0]);
  }

  return {
    props: {
      player,
      seasonTotals,
      isGoalie,
      gameLog,
      playoffGameLog, // Use the actual playoff data instead of empty array
      mostRecentSeason: selectedSeason,
      usedGameLogFallback,
      availableSeasons: isGoalie
        ? seasonTotals.map((s) => (s as GoalieSeasonTotals).season_id)
        : seasonTotals.map((s) => (s as SkaterSeasonTotals).season)
    }
  };
}
