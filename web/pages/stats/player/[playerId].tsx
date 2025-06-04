import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React, { useState, useMemo } from "react";
import styles from "styles/PlayerStats.module.scss";
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
import { PlayerPerformanceHeatmap } from "components/PlayerStats/PlayerPerformanceHeatmap";
import { PlayerRadarChart } from "components/PlayerStats/PlayerRadarChart";
import { PlayerContextualStats } from "components/PlayerStats/PlayerContextualStats";
import useCurrentSeason from "hooks/useCurrentSeason";

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

interface GameLogEntry {
  date: string;
  games_played: number;
  [key: string]: any; // Allow for dynamic stat properties
}

interface PlayerStatsPageProps {
  player: PlayerInfo | null;
  gameLog: GameLogEntry[];
  seasonTotals: any[];
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
      "sat_pct",
      "zone_start_pct",
      "individual_sat_for_per_60",
      "on_ice_shooting_pct"
    ]
  },
  // Wingers
  LW: {
    primary: ["points", "goals", "assists", "shots", "shooting_percentage"],
    secondary: ["pp_points", "hits", "takeaways", "toi_per_game"],
    advanced: [
      "sat_pct",
      "zone_start_pct",
      "individual_sat_for_per_60",
      "on_ice_shooting_pct"
    ]
  },
  RW: {
    primary: ["points", "goals", "assists", "shots", "shooting_percentage"],
    secondary: ["pp_points", "hits", "takeaways", "toi_per_game"],
    advanced: [
      "sat_pct",
      "zone_start_pct",
      "individual_sat_for_per_60",
      "on_ice_shooting_pct"
    ]
  },
  // Defensemen
  D: {
    primary: ["points", "assists", "blocked_shots", "hits", "toi_per_game"],
    secondary: ["goals", "pp_points", "plus_minus", "takeaways", "giveaways"],
    advanced: ["sat_pct", "zone_start_pct", "sat_relative", "usat_pct"]
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
  giveaways: "Giveaways"
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
  gameLog,
  seasonTotals,
  isGoalie,
  availableSeasons,
  mostRecentSeason,
  usedGameLogFallback = false
}: PlayerStatsPageProps) {
  const [selectedView, setSelectedView] = useState<
    "overview" | "gamelog" | "trends" | "advanced" | "season-stats"
  >("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState<
    "season" | "l10" | "l20"
  >("season");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);

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
          <div className={styles.timeframeSelector}>
            <label>Timeframe:</label>
            {(["season", "l10", "l20"] as const).map((timeframe) => (
              <button
                key={timeframe}
                className={`${styles.timeframeButton} ${selectedTimeframe === timeframe ? styles.active : ""}`}
                onClick={() => setSelectedTimeframe(timeframe)}
              >
                {timeframe === "season" ? "Season" : timeframe.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.statSelector}>
            <label>Stats to Display:</label>
            <div className={styles.statCategories}>
              <div className={styles.statCategory}>
                <h4>Primary</h4>
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
              <div className={styles.statCategory}>
                <h4>Secondary</h4>
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
                  seasonTotals={seasonTotals}
                  isGoalie={isGoalie}
                />
              </div>
            </div>
            <div className={styles.rightColumn}>
              <div className={styles.calendarSection}>
                <PlayerPerformanceHeatmap
                  gameLog={filteredGameLog}
                  selectedStats={selectedStats}
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
                        <th>PP Pts</th>
                        <th>GWG</th>
                        <th>FO%</th>
                        <th>TOI/GP</th>
                        <th>Blocks</th>
                        <th>Hits</th>
                        <th>Takeaways</th>
                        <th>Giveaways</th>
                        <th>Corsi%</th>
                        <th>Zone Start%</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {seasonTotals.map((row: any, idx: number) => (
                    <tr key={idx}>
                      <td>
                        {formatSeason(isGoalie ? row.season_id : row.season)}
                      </td>
                      <td>{row.games_played ?? "-"}</td>
                      {isGoalie ? (
                        <>
                          <td>{row.wins ?? "-"}</td>
                          <td>{row.losses ?? "-"}</td>
                          <td>{row.ot_losses ?? "-"}</td>
                          <td>{row.goals_against_avg ?? "-"}</td>
                          <td>{formatPercent(row.save_pct)}</td>
                          <td>{row.shutouts ?? "-"}</td>
                        </>
                      ) : (
                        <>
                          <td>{row.goals ?? "-"}</td>
                          <td>{row.assists ?? "-"}</td>
                          <td>{row.points ?? "-"}</td>
                          <td>{row.plus_minus ?? "-"}</td>
                          <td>{row.shots ?? "-"}</td>
                          <td>{formatPercent(row.shooting_percentage)}</td>
                          <td>{row.pp_points ?? "-"}</td>
                          <td>{row.gw_goals ?? "-"}</td>
                          <td>{formatPercent(row.fow_percentage)}</td>
                          <td>{formatTOI(row.toi_per_game)}</td>
                          <td>{row.blocked_shots ?? "-"}</td>
                          <td>{row.hits ?? "-"}</td>
                          <td>{row.takeaways ?? "-"}</td>
                          <td>{row.giveaways ?? "-"}</td>
                          <td>{formatPercent(row.sat_pct)}</td>
                          <td>{formatPercent(row.zone_start_pct)}</td>
                        </>
                      )}
                    </tr>
                  ))}
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

            <div className={styles.playerStatsTableContainer}>
              <table className={styles.playerStatsTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>GP</th>
                    {isGoalie ? (
                      <>
                        <th>GS</th>
                        <th>W</th>
                        <th>L</th>
                        <th>OTL</th>
                        <th>SV%</th>
                        <th>GAA</th>
                        <th>SO</th>
                        <th>Saves</th>
                        <th>SA</th>
                        <th>GA</th>
                      </>
                    ) : (
                      <>
                        <th>G</th>
                        <th>A</th>
                        <th>P</th>
                        <th>+/-</th>
                        <th>SOG</th>
                        <th>SH%</th>
                        <th>PP Pts</th>
                        <th>GWG</th>
                        <th>FO%</th>
                        <th>TOI</th>
                        <th>Blocks</th>
                        <th>Hits</th>
                        <th>Takeaways</th>
                        <th>Giveaways</th>
                        <th>Corsi%</th>
                        <th>Zone Start%</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {gameLog.length === 0 ? (
                    <tr>
                      <td colSpan={isGoalie ? 13 : 18}>
                        No games found for this season.
                      </td>
                    </tr>
                  ) : (
                    gameLog.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(row.date)}</td>
                        <td>{row.games_played ?? "-"}</td>
                        {isGoalie ? (
                          <>
                            <td>{row.games_started ?? "-"}</td>
                            <td>{row.wins ?? "-"}</td>
                            <td>{row.losses ?? "-"}</td>
                            <td>{row.ot_losses ?? "-"}</td>
                            <td>{formatPercent(row.save_pct)}</td>
                            <td>{row.goals_against_avg ?? "-"}</td>
                            <td>{row.shutouts ?? "-"}</td>
                            <td>{row.saves ?? "-"}</td>
                            <td>{row.shots_against ?? "-"}</td>
                            <td>{row.goals_against ?? "-"}</td>
                          </>
                        ) : (
                          <>
                            <td>{row.goals ?? "-"}</td>
                            <td>{row.assists ?? "-"}</td>
                            <td>{row.points ?? "-"}</td>
                            <td>{row.plus_minus ?? "-"}</td>
                            <td>{row.shots ?? "-"}</td>
                            <td>{formatPercent(row.shooting_percentage)}</td>
                            <td>{row.pp_points ?? "-"}</td>
                            <td>{row.gw_goals ?? "-"}</td>
                            <td>{formatPercent(row.fow_percentage)}</td>
                            <td>{formatTOI(row.toi_per_game)}</td>
                            <td>{row.blocked_shots ?? "-"}</td>
                            <td>{row.hits ?? "-"}</td>
                            <td>{row.takeaways ?? "-"}</td>
                            <td>{row.giveaways ?? "-"}</td>
                            <td>{formatPercent(row.sat_pct)}</td>
                            <td>{formatPercent(row.zone_start_pct)}</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
              />
            </div>
          </div>
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
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }

  // Determine if player is a goalie
  const isGoalie =
    player.position && player.position.toUpperCase().startsWith("G");

  let seasonTotals: any[] = [];
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
    seasonTotals = data || [];
    mostRecentSeason =
      seasonTotals.length > 0 ? seasonTotals[0].season_id : null;
  } else {
    // Skater: fetch from wgo_skater_stats_totals
    const { data, error } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `season, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
      )
      .eq("player_id", playerIdNum)
      .order("season", { ascending: false });
    seasonTotals = data || [];
    mostRecentSeason = seasonTotals.length > 0 ? seasonTotals[0].season : null;
  }

  // Determine selected season for game log
  let selectedSeason = season
    ? String(season)
    : isGoalie
      ? seasonTotals.length > 0
        ? seasonTotals[0].season_id
        : null
      : seasonTotals.length > 0
        ? seasonTotals[0].season
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
  let gameLog: any[] = [];
  let usedGameLogFallback = false;
  if (isGoalie) {
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_goalie_stats",
      "goalie_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, opponent_abbr, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
    );
    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_goalie_stats")
        .select(
          `date, opponent_abbr, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
        )
        .eq("goalie_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData;
        usedGameLogFallback = true;
      }
    }
  } else {
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_skater_stats",
      "player_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
    );
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
        gameLog = fallbackData;
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
      mostRecentSeason: selectedSeason,
      usedGameLogFallback,
      availableSeasons: isGoalie
        ? seasonTotals.map((s) => s.season_id)
        : seasonTotals.map((s) => s.season)
    }
  };
}
