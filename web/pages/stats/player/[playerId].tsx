import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import Layout from "components/Layout";
import { PlayerStatsChart } from "components/PlayerStats/PlayerStatsChart";
import { PlayerStatsTable } from "components/PlayerStats/PlayerStatsTable";
import { PlayerStatsSummary } from "components/PlayerStats/PlayerStatsSummary";
import { PlayerPerformanceHeatmap } from "components/PlayerStats/PlayerPerformanceHeatmap";
import { PlayerRadarChart } from "components/PlayerStats/PlayerRadarChart";
import { PlayerContextualStats } from "components/PlayerStats/PlayerContextualStats";
import { PlayerAdvancedStats } from "components/PlayerStats/PlayerAdvancedStats";
import styles from "components/PlayerStats/PlayerStats.module.scss";

// Import types from the shared types file
import {
  PlayerInfo,
  GameLogEntry,
  SkaterSeasonTotals,
  GoalieSeasonTotals,
  SeasonTotals,
  POSITION_STAT_CONFIGS,
  StatsTab,
  TimeFrame
} from "components/PlayerStats/types";
import {
  formatPercent,
  formatTOI,
  formatSeason,
  formatDate
} from "utils/stats/formatters";
import { fetchAllGameLogRows } from "utils/stats/nhlStatsFetch";

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

// Simple mock for getCurrentSeason - replace with actual implementation
function getCurrentSeason() {
  return { seasonId: 20242025 };
}

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

  // Safely convert season to appropriate type
  const seasonValue = Array.isArray(season) ? season[0] : season;

  // Use SSR data for now - can integrate hook later
  const gameLog = ssrGameLog;
  const playoffGameLog = ssrPlayoffGameLog;

  const [activeTab, setActiveTab] = useState<StatsTab>("overview");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("season");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [showPlayoffData, setShowPlayoffData] = useState<boolean>(false);
  const [showRollingAverage, setShowRollingAverage] = useState<boolean>(false);

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
    if (selectedStats.length === 0 && positionConfig) {
      setSelectedStats([...positionConfig.primary]); // Spread to create mutable array
    }
  }, [positionConfig, selectedStats.length]);

  // Filter game log based on timeframe
  const filteredGameLog = useMemo(() => {
    if (timeFrame === "season") return gameLog;
    const games =
      timeFrame === "last10" ? 10 : timeFrame === "last20" ? 20 : 30;
    return gameLog.slice(-games);
  }, [gameLog, timeFrame]);

  // Calculate rolling averages and trends
  const processedGameLog = useMemo(() => {
    return filteredGameLog.map((game: GameLogEntry, index: number) => {
      const rollingWindow = filteredGameLog.slice(
        Math.max(0, index - 4),
        index + 1
      );
      const rollingStats: { [key: string]: number } = {};

      selectedStats.forEach((stat) => {
        const values = rollingWindow.map(
          (g: GameLogEntry) => Number(g[stat]) || 0
        );
        rollingStats[`${stat}_5game_avg`] =
          values.reduce((a: number, b: number) => a + b, 0) / values.length;
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
    <Layout>
      <NextSeo
        title={`${player.fullName} Stats - ${process.env.NEXT_PUBLIC_SITE_NAME}`}
        description={`Detailed hockey statistics for ${player.fullName}`}
      />

      <div className={styles.playerStatsPageContainer}>
        {/* Player Header */}
        <div className={styles.playerHeader}>
          <div className={styles.playerImageContainer}>
            {player.image_url && (
              <img
                src={player.image_url}
                alt={player.fullName}
                width={120}
                height={120}
                style={{ borderRadius: "50%" }}
              />
            )}
          </div>
          <div className={styles.playerInfo}>
            <h1 className={styles.playerName}>{player.fullName}</h1>
            <div className={styles.playerDetails}>
              #{player.sweater_number || "-"} | {player.position}
              {player.team_id && ` | Team ID: ${player.team_id}`}
              <br />
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

        {/* Tab Navigation */}
        <div className={styles.tabNavigation}>
          {(
            [
              "overview",
              "advanced",
              "trends",
              "calendar",
              "gamelog"
            ] as StatsTab[]
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabButton} ${activeTab === tab ? styles.active : ""}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className={styles.contentArea}>
          {activeTab === "overview" && (
            <>
              {/* Controls for Overview */}
              <div className={styles.controlsSection}>
                <div className={styles.controlsGrid}>
                  {/* Time Frame Selector */}
                  <div className={styles.timeframeSelector}>
                    <h4 className={styles.controlHeader}>Time Period</h4>
                    <div className={styles.timeframeButtons}>
                      {(
                        ["season", "last10", "last20", "last30"] as TimeFrame[]
                      ).map((frame) => (
                        <button
                          key={frame}
                          onClick={() => setTimeFrame(frame)}
                          className={`${styles.timeframeButton} ${timeFrame === frame ? styles.active : ""}`}
                        >
                          {frame === "season"
                            ? "Full Season"
                            : frame === "last10"
                              ? "Last 10"
                              : frame === "last20"
                                ? "Last 20"
                                : "Last 30"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stat Selector */}
                  <div className={styles.statSelector}>
                    <h4 className={styles.controlHeader}>Statistics</h4>
                    <div className={styles.statCategories}>
                      <div className={styles.statCategory}>
                        <h4>Primary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.primary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={styles.statCategory}>
                        <h4>Secondary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.secondary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      {positionConfig.advanced && (
                        <div className={styles.statCategory}>
                          <h4>Advanced</h4>
                          <div className={styles.statCheckboxContainer}>
                            {positionConfig.advanced.map((stat: string) => (
                              <label key={stat} className={styles.statCheckbox}>
                                <input
                                  type="checkbox"
                                  checked={selectedStats.includes(stat)}
                                  onChange={() => handleStatToggle(stat)}
                                />
                                {stat.replace(/_/g, " ").toUpperCase()}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.overviewGrid}>
                <div className={styles.leftColumn}>
                  <div className={styles.radarSection}>
                    <PlayerRadarChart
                      player={player}
                      gameLog={filteredGameLog}
                      playoffGameLog={playoffGameLog}
                      selectedStats={selectedStats}
                      isGoalie={isGoalie}
                      showPlayoffData={showPlayoffData}
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
                      player={player}
                      gameLog={filteredGameLog}
                      playoffGameLog={playoffGameLog}
                      selectedStats={selectedStats}
                      selectedStat={selectedStats[0] || "points"}
                      isGoalie={isGoalie}
                      playerId={Number(playerId)}
                      playerTeamId={player.team_id}
                      seasonId={seasonValue}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "advanced" && (
            <PlayerAdvancedStats
              player={player}
              gameLog={filteredGameLog}
              playoffGameLog={playoffGameLog}
              selectedStats={
                positionConfig.advanced || positionConfig.secondary
              }
              isGoalie={isGoalie}
              showPlayoffData={showPlayoffData}
              seasonTotals={seasonTotals}
              playerId={Number(playerId)}
              seasonId={seasonValue}
            />
          )}

          {activeTab === "trends" && (
            <>
              {/* Controls for Trends */}
              <div className={styles.controlsSection}>
                <div className={styles.controlsGrid}>
                  {/* Time Frame Selector */}
                  <div className={styles.timeframeSelector}>
                    <h4 className={styles.controlHeader}>Time Period</h4>
                    <div className={styles.timeframeButtons}>
                      {(
                        ["season", "last10", "last20", "last30"] as TimeFrame[]
                      ).map((frame) => (
                        <button
                          key={frame}
                          onClick={() => setTimeFrame(frame)}
                          className={`${styles.timeframeButton} ${timeFrame === frame ? styles.active : ""}`}
                        >
                          {frame === "season"
                            ? "Full Season"
                            : frame === "last10"
                              ? "Last 10"
                              : frame === "last20"
                                ? "Last 20"
                                : "Last 30"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stat Selector */}
                  <div className={styles.statSelector}>
                    <h4 className={styles.controlHeader}>Statistics</h4>
                    <div className={styles.statCategories}>
                      <div className={styles.statCategory}>
                        <h4>Primary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.primary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={styles.statCategory}>
                        <h4>Secondary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.secondary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      {positionConfig.advanced && (
                        <div className={styles.statCategory}>
                          <h4>Advanced</h4>
                          <div className={styles.statCheckboxContainer}>
                            {positionConfig.advanced.map((stat: string) => (
                              <label key={stat} className={styles.statCheckbox}>
                                <input
                                  type="checkbox"
                                  checked={selectedStats.includes(stat)}
                                  onChange={() => handleStatToggle(stat)}
                                />
                                {stat.replace(/_/g, " ").toUpperCase()}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <PlayerStatsChart
                gameLog={processedGameLog}
                playoffGameLog={playoffGameLog}
                selectedStats={selectedStats}
                showRollingAverage={showRollingAverage}
                title="Performance Trends"
                showPlayoffData={showPlayoffData}
              />
              <PlayerStatsSummary
                gameLog={filteredGameLog}
                playoffGameLog={playoffGameLog}
                selectedStats={selectedStats}
                isGoalie={isGoalie}
                showPlayoffData={showPlayoffData}
              />
            </>
          )}

          {activeTab === "calendar" && (
            <>
              {/* Controls for Calendar */}
              <div className={styles.controlsSection}>
                <div className={styles.controlsGrid}>
                  {/* Time Frame Selector */}
                  <div className={styles.timeframeSelector}>
                    <h4 className={styles.controlHeader}>Time Period</h4>
                    <div className={styles.timeframeButtons}>
                      {(
                        ["season", "last10", "last20", "last30"] as TimeFrame[]
                      ).map((frame) => (
                        <button
                          key={frame}
                          onClick={() => setTimeFrame(frame)}
                          className={`${styles.timeframeButton} ${timeFrame === frame ? styles.active : ""}`}
                        >
                          {frame === "season"
                            ? "Full Season"
                            : frame === "last10"
                              ? "Last 10"
                              : frame === "last20"
                                ? "Last 20"
                                : "Last 30"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stat Selector */}
                  <div className={styles.statSelector}>
                    <h4 className={styles.controlHeader}>Statistics</h4>
                    <div className={styles.statCategories}>
                      <div className={styles.statCategory}>
                        <h4>Primary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.primary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={styles.statCategory}>
                        <h4>Secondary</h4>
                        <div className={styles.statCheckboxContainer}>
                          {positionConfig.secondary.map((stat: string) => (
                            <label key={stat} className={styles.statCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedStats.includes(stat)}
                                onChange={() => handleStatToggle(stat)}
                              />
                              {stat.replace(/_/g, " ").toUpperCase()}
                            </label>
                          ))}
                        </div>
                      </div>

                      {positionConfig.advanced && (
                        <div className={styles.statCategory}>
                          <h4>Advanced</h4>
                          <div className={styles.statCheckboxContainer}>
                            {positionConfig.advanced.map((stat: string) => (
                              <label key={stat} className={styles.statCheckbox}>
                                <input
                                  type="checkbox"
                                  checked={selectedStats.includes(stat)}
                                  onChange={() => handleStatToggle(stat)}
                                />
                                {stat.replace(/_/g, " ").toUpperCase()}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <PlayerPerformanceHeatmap
                player={player}
                gameLog={filteredGameLog}
                playoffGameLog={playoffGameLog}
                selectedStats={selectedStats}
                selectedStat={selectedStats[0] || "points"}
                isGoalie={isGoalie}
                playerId={Number(playerId)}
                playerTeamId={player.team_id}
                seasonId={seasonValue}
              />
            </>
          )}

          {activeTab === "gamelog" && (
            <div className={styles.gameLogTab}>
              <h2>Game Log</h2>
              <PlayerStatsTable
                gameLog={filteredGameLog}
                playoffGameLog={playoffGameLog}
                selectedStats={selectedStats}
                isGoalie={isGoalie}
                showPlayoffData={showPlayoffData}
                playerId={Number(playerId)}
                seasonId={seasonValue}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
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
  const currentSeason = getCurrentSeason();
  const currentSeasonString = String(currentSeason.seasonId); // e.g., "20242025"
  const currentSeasonId = currentSeason.seasonId; // number

  if (isGoalie) {
    // Goalie: fetch from wgo_goalie_stats_totals
    const { data, error } = await supabase
      .from("wgo_goalie_stats_totals")
      .select(
        `season_id, games_played, wins, losses, ot_losses, goals_against_avg, save_pct, shutouts, saves`
      )
      .eq("goalie_id", playerIdNum)
      .order("season_id", { ascending: false });

    if (data) {
      seasonTotals = data.map((item) => ({
        season: String(item.season_id),
        season_id: item.season_id,
        games_played: item.games_played,
        wins: item.wins,
        losses: item.losses,
        ot_losses: item.ot_losses,
        goals_against_avg: item.goals_against_avg,
        save_pct: item.save_pct,
        shutouts: item.shutouts,
        saves: item.saves
      })) as GoalieSeasonTotals[];

      mostRecentSeason =
        seasonTotals.length > 0
          ? ((seasonTotals[0] as GoalieSeasonTotals).season_id ?? null)
          : null;
    }
  } else {
    // Skater: fetch from wgo_skater_stats_totals
    const { data, error } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `season, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
      )
      .eq("player_id", playerIdNum)
      .order("season", { ascending: false });

    if (data) {
      seasonTotals = data.map((item) => ({
        season: String(item.season), // Use season column directly
        season_id: Number(item.season), // Convert season to number for consistency with goalie data
        games_played: item.games_played,
        goals: item.goals,
        assists: item.assists,
        points: item.points,
        plus_minus: item.plus_minus,
        shots: item.shots,
        shooting_percentage: item.shooting_percentage,
        pp_points: item.pp_points,
        gw_goals: item.gw_goals,
        fow_percentage: item.fow_percentage,
        toi_per_game: item.toi_per_game,
        blocked_shots: item.blocked_shots,
        hits: item.hits,
        takeaways: item.takeaways,
        giveaways: item.giveaways,
        sat_pct: item.sat_pct,
        zone_start_pct: item.zone_start_pct
      })) as SkaterSeasonTotals[];

      mostRecentSeason =
        seasonTotals.length > 0
          ? (Number((seasonTotals[0] as SkaterSeasonTotals).season) ?? null)
          : null;
    } else {
      seasonTotals = [];
    }
  }

  // Determine selected season for game log
  let selectedSeason = season
    ? String(season)
    : isGoalie
      ? seasonTotals.length > 0
        ? (seasonTotals[0] as GoalieSeasonTotals).season_id
        : currentSeasonId
      : seasonTotals.length > 0
        ? Number((seasonTotals[0] as SkaterSeasonTotals).season)
        : currentSeasonId;

  // Use current season as fallback if no season is found
  if (!selectedSeason) {
    selectedSeason = currentSeasonId;
  }

  // Ensure selectedSeason is a number for the query
  if (typeof selectedSeason === "string") {
    selectedSeason = Number(selectedSeason);
  }

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

  if (isGoalie && selectedSeason) {
    // Regular season goalie stats
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_goalie_stats",
      "goalie_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
    );

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
  } else if (selectedSeason) {
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

    // ADDED: Fetch playoff skater stats
    playoffGameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_skater_stats_playoffs",
      "player_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
    );

    // Mark playoff games explicitly
    playoffGameLog = playoffGameLog.map((game: any) => ({
      ...game,
      isPlayoff: true
    }));

    // ADDED: NST advanced stats and merge with WGO data
    if (gameLog && gameLog.length > 0) {
      try {
        console.log(
          "[SSR] Fetching NST data for player:",
          playerIdNum,
          "season:",
          selectedSeason
        );

        // FIXED: Use the rates table for individual per-60 stats (has actual values)
        const { data: nstRatesData } = await supabase
          .from("nst_gamelog_as_rates")
          .select("*")
          .eq("player_id", playerIdNum)
          .eq("season", selectedSeason)
          .order("date_scraped", { ascending: true });

        // FIXED: Use the on-ice table for possession percentages (has actual values)
        const { data: nstCountsOiData } = await supabase
          .from("nst_gamelog_as_counts_oi")
          .select("*")
          .eq("player_id", playerIdNum)
          .eq("season", selectedSeason)
          .order("date_scraped", { ascending: true });

        // ADDED: Also get basic counts for raw stats
        const { data: nstCountsData } = await supabase
          .from("nst_gamelog_as_counts")
          .select("*")
          .eq("player_id", playerIdNum)
          .eq("season", selectedSeason)
          .order("date_scraped", { ascending: true });

        console.log("[SSR] NST data fetched:", {
          ratesLength: nstRatesData?.length || 0,
          countsOiLength: nstCountsOiData?.length || 0,
          countsLength: nstCountsData?.length || 0
        });

        // Create lookup maps for NST data by date
        const nstRatesMap = new Map<string, any>();
        const nstCountsOiMap = new Map<string, any>();
        const nstCountsMap = new Map<string, any>();

        nstRatesData?.forEach((game: any) => {
          nstRatesMap.set(game.date_scraped, game);
        });

        nstCountsOiData?.forEach((game: any) => {
          nstCountsOiMap.set(game.date_scraped, game);
        });

        nstCountsData?.forEach((game: any) => {
          nstCountsMap.set(game.date_scraped, game);
        });

        // Merge WGO and NST data for each game
        gameLog = gameLog.map((wgoGame: any) => {
          const nstRates: any = nstRatesMap.get(wgoGame.date) || {};
          const nstCountsOi: any = nstCountsOiMap.get(wgoGame.date) || {};
          const nstCounts: any = nstCountsMap.get(wgoGame.date) || {};

          // Calculate zone usage percentages if we have the raw counts
          let def_zone_start_pct = null;
          let neu_zone_start_pct = null;

          if (
            nstCountsOi.off_zone_starts &&
            nstCountsOi.neu_zone_starts &&
            nstCountsOi.def_zone_starts
          ) {
            const totalStarts =
              nstCountsOi.off_zone_starts +
              nstCountsOi.neu_zone_starts +
              nstCountsOi.def_zone_starts;
            if (totalStarts > 0) {
              def_zone_start_pct =
                (nstCountsOi.def_zone_starts / totalStarts) * 100;
              neu_zone_start_pct =
                (nstCountsOi.neu_zone_starts / totalStarts) * 100;
            }
          }

          return {
            ...wgoGame,

            // NST Possession Percentages (from on-ice table - has actual values!)
            cf_pct: nstCountsOi.cf_pct || null,
            ff_pct: nstCountsOi.ff_pct || null,
            sf_pct: nstCountsOi.sf_pct || null,
            gf_pct: nstCountsOi.gf_pct || null,
            xgf_pct: nstCountsOi.xgf_pct || null,
            scf_pct: nstCountsOi.scf_pct || null,
            hdcf_pct: nstCountsOi.hdcf_pct || null,
            mdcf_pct: nstCountsOi.mdcf_pct || null,
            ldcf_pct: nstCountsOi.ldcf_pct || null,

            // NST Individual Production Per 60 (from rates table - has actual values!)
            ixg_per_60: nstRates.ixg_per_60 || null,
            icf_per_60: nstRates.icf_per_60 || null,
            iff_per_60: nstRates.iff_per_60 || null,
            iscfs_per_60: nstRates.iscfs_per_60 || null,
            hdcf_per_60: nstRates.hdcf_per_60 || null,
            shots_per_60: nstRates.shots_per_60 || null,
            goals_per_60: nstRates.goals_per_60 || null,
            total_assists_per_60: nstRates.total_assists_per_60 || null,
            total_points_per_60: nstRates.total_points_per_60 || null,
            rush_attempts_per_60: nstRates.rush_attempts_per_60 || null,
            rebounds_created_per_60: nstRates.rebounds_created_per_60 || null,

            // NST Defensive Per 60 (from rates table)
            hdca_per_60: nstRates.hdca_per_60 || null,
            sca_per_60: nstRates.sca_per_60 || null,
            shots_blocked_per_60: nstRates.shots_blocked_per_60 || null,
            xga_per_60: nstRates.xga_per_60 || null,
            ga_per_60: nstRates.ga_per_60 || null,

            // NST Zone Usage Percentages (from on-ice table)
            off_zone_start_pct: nstCountsOi.off_zone_start_pct || null,
            def_zone_start_pct: def_zone_start_pct,
            neu_zone_start_pct: neu_zone_start_pct,
            off_zone_faceoff_pct: nstCountsOi.off_zone_faceoff_pct || null,

            // NST On-Ice Impact (from on-ice table - has actual values!)
            on_ice_sh_pct: nstCountsOi.on_ice_sh_pct || null,
            on_ice_sv_pct: nstCountsOi.on_ice_sv_pct || null,
            pdo: nstCountsOi.pdo || null,

            // NST Discipline Per 60 (from rates table)
            pim_per_60: nstRates.pim_per_60 || null,
            total_penalties_per_60: nstRates.total_penalties_per_60 || null,
            penalties_drawn_per_60: nstRates.penalties_drawn_per_60 || null,
            giveaways_per_60: nstRates.giveaways_per_60 || null,
            takeaways_per_60: nstRates.takeaways_per_60 || null,
            hits_per_60: nstRates.hits_per_60 || null,

            // NST Raw Counts (for reference, from basic counts table)
            ixg: nstCounts.ixg || null,
            icf: nstCounts.icf || null,
            iff: nstCounts.iff || null,
            hdcf: nstCounts.hdcf || null,
            hdca: nstCounts.hdca || null,
            rush_attempts: nstCounts.rush_attempts || null,
            rebounds_created: nstCounts.rebounds_created || null,

            // NST On-Ice Raw Counts (from on-ice table)
            cf: nstCountsOi.cf || null,
            ca: nstCountsOi.ca || null,
            ff: nstCountsOi.ff || null,
            fa: nstCountsOi.fa || null,
            sf: nstCountsOi.sf || null,
            sa: nstCountsOi.sa || null,
            gf: nstCountsOi.gf || null,
            ga: nstCountsOi.ga || null,
            xgf: nstCountsOi.xgf || null,
            xga: nstCountsOi.xga || null,
            scf: nstCountsOi.scf || null,
            sca: nstCountsOi.sca || null
          };
        });

        // Also merge NST data with playoff games
        playoffGameLog = playoffGameLog.map((wgoGame: any) => {
          const nstRates: any = nstRatesMap.get(wgoGame.date) || {};
          const nstCountsOi: any = nstCountsOiMap.get(wgoGame.date) || {};
          const nstCounts: any = nstCountsMap.get(wgoGame.date) || {};

          // Calculate zone usage percentages if we have the raw counts
          let def_zone_start_pct = null;
          let neu_zone_start_pct = null;

          if (
            nstCountsOi.off_zone_starts &&
            nstCountsOi.neu_zone_starts &&
            nstCountsOi.def_zone_starts
          ) {
            const totalStarts =
              nstCountsOi.off_zone_starts +
              nstCountsOi.neu_zone_starts +
              nstCountsOi.def_zone_starts;
            if (totalStarts > 0) {
              def_zone_start_pct =
                (nstCountsOi.def_zone_starts / totalStarts) * 100;
              neu_zone_start_pct =
                (nstCountsOi.neu_zone_starts / totalStarts) * 100;
            }
          }

          return {
            ...wgoGame,

            // NST Possession Percentages
            cf_pct: nstCountsOi.cf_pct || null,
            ff_pct: nstCountsOi.ff_pct || null,
            sf_pct: nstCountsOi.sf_pct || null,
            gf_pct: nstCountsOi.gf_pct || null,
            xgf_pct: nstCountsOi.xgf_pct || null,
            scf_pct: nstCountsOi.scf_pct || null,
            hdcf_pct: nstCountsOi.hdcf_pct || null,
            mdcf_pct: nstCountsOi.mdcf_pct || null,
            ldcf_pct: nstCountsOi.ldcf_pct || null,

            // NST Individual Production Per 60
            ixg_per_60: nstRates.ixg_per_60 || null,
            icf_per_60: nstRates.icf_per_60 || null,
            iff_per_60: nstRates.iff_per_60 || null,
            iscfs_per_60: nstRates.iscfs_per_60 || null,
            hdcf_per_60: nstRates.hdcf_per_60 || null,
            shots_per_60: nstRates.shots_per_60 || null,
            goals_per_60: nstRates.goals_per_60 || null,
            total_assists_per_60: nstRates.total_assists_per_60 || null,
            total_points_per_60: nstRates.total_points_per_60 || null,
            rush_attempts_per_60: nstRates.rush_attempts_per_60 || null,
            rebounds_created_per_60: nstRates.rebounds_created_per_60 || null,

            // NST Defensive Per 60
            hdca_per_60: nstRates.hdca_per_60 || null,
            sca_per_60: nstRates.sca_per_60 || null,
            shots_blocked_per_60: nstRates.shots_blocked_per_60 || null,
            xga_per_60: nstRates.xga_per_60 || null,
            ga_per_60: nstRates.ga_per_60 || null,

            // NST Zone Usage Percentages
            off_zone_start_pct: nstCountsOi.off_zone_start_pct || null,
            def_zone_start_pct: def_zone_start_pct,
            neu_zone_start_pct: neu_zone_start_pct,
            off_zone_faceoff_pct: nstCountsOi.off_zone_faceoff_pct || null,

            // NST On-Ice Impact
            on_ice_sh_pct: nstCountsOi.on_ice_sh_pct || null,
            on_ice_sv_pct: nstCountsOi.on_ice_sv_pct || null,
            pdo: nstCountsOi.pdo || null,

            // NST Discipline Per 60
            pim_per_60: nstRates.pim_per_60 || null,
            total_penalties_per_60: nstRates.total_penalties_per_60 || null,
            penalties_drawn_per_60: nstRates.penalties_drawn_per_60 || null,
            giveaways_per_60: nstRates.giveaways_per_60 || null,
            takeaways_per_60: nstRates.takeaways_per_60 || null,
            hits_per_60: nstRates.hits_per_60 || null,

            // NST Raw Counts
            ixg: nstCounts.ixg || null,
            icf: nstCounts.icf || null,
            iff: nstCounts.iff || null,
            hdcf: nstCounts.hdcf || null,
            hdca: nstCounts.hdca || null,
            rush_attempts: nstCounts.rush_attempts || null,
            rebounds_created: nstCounts.rebounds_created || null,

            // NST On-Ice Raw Counts
            cf: nstCountsOi.cf || null,
            ca: nstCountsOi.ca || null,
            ff: nstCountsOi.ff || null,
            fa: nstCountsOi.fa || null,
            sf: nstCountsOi.sf || null,
            sa: nstCountsOi.sa || null,
            gf: nstCountsOi.gf || null,
            ga: nstCountsOi.ga || null,
            xgf: nstCountsOi.xgf || null,
            xga: nstCountsOi.xga || null,
            scf: nstCountsOi.scf || null,
            sca: nstCountsOi.sca || null
          };
        });

        console.log(
          "[SSR] Merged game log with NST data. Sample stats from first game:",
          {
            cf_pct: gameLog[0]?.cf_pct,
            ixg_per_60: gameLog[0]?.ixg_per_60,
            hdcf_pct: gameLog[0]?.hdcf_pct,
            pdo: gameLog[0]?.pdo,
            shots_per_60: gameLog[0]?.shots_per_60
          }
        );
        console.log("[SSR] Playoff games fetched and merged:", {
          playoffGameCount: playoffGameLog.length,
          firstPlayoffGame: playoffGameLog[0] || null
        });
      } catch (nstError) {
        console.warn("[SSR] Error fetching NST data:", nstError);
        // Continue with WGO data only if NST fetch fails
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
      playoffGameLog,
      mostRecentSeason: selectedSeason,
      usedGameLogFallback,
      availableSeasons: isGoalie
        ? seasonTotals.map((s) => (s as GoalieSeasonTotals).season_id)
        : seasonTotals.map((s) => (s as SkaterSeasonTotals).season_id)
    }
  };
}
