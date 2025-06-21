import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
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
  TimeFrame,
  MissedGame
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
  availableSeasonsFormatted: {
    value: string | number;
    label: string;
    displayName: string;
  }[]; // Add this
  mostRecentSeason?: string | number | null;
  usedGameLogFallback?: boolean;
  missedGames?: MissedGame[];
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
  availableSeasonsFormatted, // Add this prop
  mostRecentSeason,
  usedGameLogFallback = false,
  missedGames = []
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
    if (pos === "L" || pos === "R") {
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
    <>
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
                      playerId={Number(playerId)}
                      seasonId={seasonValue}
                      missedGames={missedGames}
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
                      missedGames={missedGames}
                      availableSeasonsFormatted={availableSeasonsFormatted} // Pass the formatted seasons
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
                availableSeasonsFormatted={availableSeasonsFormatted} // Pass the formatted seasons here too
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
    </>
  );
}

// Add this function before the main component export
async function fetchMissedGames(
  playerId: number,
  seasonId: string | number | undefined,
  teamId: number | undefined
): Promise<MissedGame[]> {
  if (!playerId || !seasonId || !teamId) {
    console.log("[SSR] Missing required data for missed games:", {
      playerId,
      seasonId,
      teamId
    });
    return [];
  }

  try {
    // Convert seasonId to number if it's a string
    const seasonIdNum =
      typeof seasonId === "string" ? Number(seasonId) : seasonId;

    console.log(
      `[SSR] Fetching missed games for player ${playerId}, team ${teamId}, season ${seasonIdNum}`
    );

    // Extract playoff year from season ID (e.g., 20242025 -> 2025)
    const playoffYear = Math.floor(seasonIdNum % 10000);

    // Get current date
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); // Set to end of today for accurate comparison

    // Get all team games for the season (both past and future)
    const { data: teamGames, error: teamGamesError } = await supabase
      .from("games")
      .select("id, date, seasonId, type, homeTeamId, awayTeamId")
      .eq("seasonId", seasonIdNum)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .order("date", { ascending: true });

    if (teamGamesError) {
      console.error("[SSR] Error fetching team games:", teamGamesError.message);
      return [];
    }

    if (!teamGames || teamGames.length === 0) {
      console.log("[SSR] No team games found for season");
      return [];
    }

    console.log(
      `[SSR] Found ${teamGames.length} total team games for season ${seasonIdNum}`
    );

    // Fetch player's actual games from database tables
    const playerGameDates = new Set<string>();

    // Fetch regular season games from wgo_skater_stats
    const { data: regularSeasonGames, error: regularError } = await supabase
      .from("wgo_skater_stats")
      .select("date, games_played")
      .eq("player_id", playerId)
      .eq("season_id", seasonIdNum)
      .gt("games_played", 0);

    if (regularError) {
      console.warn(
        "[SSR] Error fetching regular season games:",
        regularError.message
      );
    } else if (regularSeasonGames) {
      regularSeasonGames.forEach((game) => {
        playerGameDates.add(game.date);
      });
      console.log(
        `[SSR] Player played ${regularSeasonGames.length} regular season games`
      );
    }

    // Fetch playoff games from wgo_skater_stats_playoffs (filter by year)
    const { data: playoffGames, error: playoffError } = await supabase
      .from("wgo_skater_stats_playoffs")
      .select("date, games_played")
      .eq("player_id", playerId)
      .gte("date", `${playoffYear}-01-01`)
      .lt("date", `${playoffYear + 1}-01-01`)
      .gt("games_played", 0);

    if (playoffError) {
      console.warn("[SSR] Error fetching playoff games:", playoffError.message);
    } else if (playoffGames) {
      playoffGames.forEach((game) => {
        playerGameDates.add(game.date);
      });
      console.log(`[SSR] Player played ${playoffGames.length} playoff games`);
    }

    console.log(
      `[SSR] Total unique dates player played: ${playerGameDates.size}`
    );
    console.log(`[SSR] Player game dates:`, Array.from(playerGameDates).sort());

    // For each team game, check if player has a corresponding game log entry
    const missedGames: MissedGame[] = [];
    const futureGames: MissedGame[] = [];

    for (const teamGame of teamGames) {
      const gameDate = teamGame.date;
      const gameDateObj = new Date(gameDate);
      const isPlayoff = teamGame.type === 3;
      const isRegularSeason = teamGame.type === 2;

      // Only check regular season (type 2) and playoff (type 3) games
      if (!isRegularSeason && !isPlayoff) {
        continue;
      }

      // Check if this is a future game
      const isFutureGame = gameDateObj > currentDate;

      // Check if player played on this date (only for past games)
      if (!isFutureGame && !playerGameDates.has(gameDate)) {
        // Player missed this past game
        missedGames.push({
          date: gameDate,
          gameId: teamGame.id,
          homeTeamId: teamGame.homeTeamId,
          awayTeamId: teamGame.awayTeamId,
          isPlayoff: isPlayoff,
          seasonId: teamGame.seasonId
        });

        console.log(
          `[SSR] Missed game found: ${gameDate} (${isPlayoff ? "playoff" : "regular season"})`
        );
      } else if (isFutureGame) {
        // This is a future scheduled game
        futureGames.push({
          date: gameDate,
          gameId: teamGame.id,
          homeTeamId: teamGame.homeTeamId,
          awayTeamId: teamGame.awayTeamId,
          isPlayoff: isPlayoff,
          seasonId: teamGame.seasonId,
          isFuture: true // Add flag to distinguish future games
        });

        console.log(
          `[SSR] Future scheduled game found: ${gameDate} (${isPlayoff ? "playoff" : "regular season"})`
        );
      }
    }

    // Combine missed games and future games
    const allMissedGames = [...missedGames, ...futureGames];

    console.log(`[SSR] Total games found:`, {
      missedPast: missedGames.length,
      futureScheduled: futureGames.length,
      total: allMissedGames.length
    });

    console.log(`[SSR] Breakdown:`, {
      missedRegular: missedGames.filter((g) => !g.isPlayoff).length,
      missedPlayoff: missedGames.filter((g) => g.isPlayoff).length,
      futureRegular: futureGames.filter((g) => !g.isPlayoff).length,
      futurePlayoff: futureGames.filter((g) => g.isPlayoff).length
    });

    return allMissedGames;
  } catch (error) {
    console.error("[SSR] Error fetching missed games:", error);
    return [];
  }
}

// ...existing code...

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

  // NST advanced stats data
  let nstCountsData: any[] = [];
  let nstCountsOiData: any[] = [];
  let nstRatesData: any[] = [];
  let nstRatesOiData: any[] = [];

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

    // Fetch NST advanced stats for skaters
    try {
      console.log(
        `[SSR] Fetching NST data for player ${playerIdNum} in season ${selectedSeason}`
      );

      // Fetch NST individual advanced stats (counts)
      const { data: nstCounts, error: nstCountsError } = await supabase
        .from("nst_gamelog_as_counts")
        .select("*")
        .eq("player_id", playerIdNum)
        .eq("season", selectedSeason)
        .order("date_scraped", { ascending: true });

      if (nstCountsError) {
        console.warn(
          "[SSR] Error fetching NST counts:",
          nstCountsError.message
        );
      } else {
        nstCountsData = nstCounts || [];
        console.log(`[SSR] Fetched ${nstCountsData.length} NST counts records`);
      }

      // Fetch NST on-ice advanced stats (counts)
      const { data: nstCountsOi, error: nstCountsOiError } = await supabase
        .from("nst_gamelog_as_counts_oi")
        .select("*")
        .eq("player_id", playerIdNum)
        .eq("season", selectedSeason)
        .order("date_scraped", { ascending: true });

      if (nstCountsOiError) {
        console.warn(
          "[SSR] Error fetching NST counts OI:",
          nstCountsOiError.message
        );
      } else {
        nstCountsOiData = nstCountsOi || [];
        console.log(
          `[SSR] Fetched ${nstCountsOiData.length} NST counts OI records`
        );
      }

      // Fetch NST individual rates (per 60)
      const { data: nstRates, error: nstRatesError } = await supabase
        .from("nst_gamelog_as_rates")
        .select("*")
        .eq("player_id", playerIdNum)
        .eq("season", selectedSeason)
        .order("date_scraped", { ascending: true });

      if (nstRatesError) {
        console.warn("[SSR] Error fetching NST rates:", nstRatesError.message);
      } else {
        nstRatesData = nstRates || [];
        console.log(`[SSR] Fetched ${nstRatesData.length} NST rates records`);
      }

      // Fetch NST on-ice rates (per 60)
      const { data: nstRatesOi, error: nstRatesOiError } = await supabase
        .from("nst_gamelog_as_rates_oi")
        .select("*")
        .eq("player_id", playerIdNum)
        .eq("season", selectedSeason)
        .order("date_scraped", { ascending: true });

      if (nstRatesOiError) {
        console.warn(
          "[SSR] Error fetching NST rates OI:",
          nstRatesOiError.message
        );
      } else {
        nstRatesOiData = nstRatesOi || [];
        console.log(
          `[SSR] Fetched ${nstRatesOiData.length} NST rates OI records`
        );
      }

      // Create lookup maps for NST data by date
      const nstCountsMap = new Map();
      const nstCountsOiMap = new Map();
      const nstRatesMap = new Map();
      const nstRatesOiMap = new Map();

      nstCountsData.forEach((game: any) => {
        nstCountsMap.set(game.date_scraped, game);
      });

      nstCountsOiData.forEach((game: any) => {
        nstCountsOiMap.set(game.date_scraped, game);
      });

      nstRatesData.forEach((game: any) => {
        nstRatesMap.set(game.date_scraped, game);
      });

      nstRatesOiData.forEach((game: any) => {
        nstRatesOiMap.set(game.date_scraped, game);
      });

      console.log("[SSR] NST lookup maps created. Sizes:", {
        counts: nstCountsMap.size,
        countsOi: nstCountsOiMap.size,
        rates: nstRatesMap.size,
        ratesOi: nstRatesOiMap.size
      });

      // Merge NST data with WGO game log
      gameLog = gameLog.map((wgoGame: any) => {
        const nstCounts = nstCountsMap.get(wgoGame.date) || {};
        const nstCountsOi = nstCountsOiMap.get(wgoGame.date) || {};
        const nstRates = nstRatesMap.get(wgoGame.date) || {};
        const nstRatesOi = nstRatesOiMap.get(wgoGame.date) || {};

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
          // NST Individual Advanced Stats - Possession Percentages (from counts)
          cf_pct: nstCountsOi.cf_pct || null,
          ff_pct: nstCountsOi.ff_pct || null,
          sf_pct: nstCountsOi.sf_pct || null,
          gf_pct: nstCountsOi.gf_pct || null,
          xgf_pct: nstCountsOi.xgf_pct || null,
          scf_pct: nstCountsOi.scf_pct || null,
          hdcf_pct: nstCountsOi.hdcf_pct || null,
          mdcf_pct: nstCountsOi.mdcf_pct || null,
          ldcf_pct: nstCountsOi.ldcf_pct || null,

          // NST On-Ice Possession Percentages (from counts_oi)
          on_ice_cf_pct: nstCountsOi.cf_pct || null,
          on_ice_ff_pct: nstCountsOi.ff_pct || null,
          on_ice_sf_pct: nstCountsOi.sf_pct || null,
          on_ice_gf_pct: nstCountsOi.gf_pct || null,
          on_ice_xgf_pct: nstCountsOi.xgf_pct || null,
          on_ice_scf_pct: nstCountsOi.scf_pct || null,
          on_ice_hdcf_pct: nstCountsOi.hdcf_pct || null,

          // NST Individual Production Per 60 (from rates)
          goals_per_60: nstRates.goals_per_60 || null,
          total_assists_per_60: nstRates.total_assists_per_60 || null,
          first_assists_per_60: nstRates.first_assists_per_60 || null,
          second_assists_per_60: nstRates.second_assists_per_60 || null,
          total_points_per_60: nstRates.total_points_per_60 || null,
          shots_per_60: nstRates.shots_per_60 || null,
          ixg_per_60: nstRates.ixg_per_60 || null,
          icf_per_60: nstRates.icf_per_60 || null,
          iff_per_60: nstRates.iff_per_60 || null,
          iscfs_per_60: nstRates.iscfs_per_60 || null,
          hdcf_per_60: nstRates.hdcf_per_60 || null,
          rush_attempts_per_60: nstRates.rush_attempts_per_60 || null,
          rebounds_created_per_60: nstRates.rebounds_created_per_60 || null,

          // NST Defensive Per 60 (from rates)
          hdca_per_60: nstRates.hdca_per_60 || null,
          sca_per_60: nstRates.sca_per_60 || null,
          shots_blocked_per_60: nstRates.shots_blocked_per_60 || null,
          xga_per_60: nstRates.xga_per_60 || null,
          ga_per_60: nstRates.ga_per_60 || null,

          // NST Discipline Per 60 (from rates)
          pim_per_60: nstRates.pim_per_60 || null,
          total_penalties_per_60: nstRates.total_penalties_per_60 || null,
          penalties_drawn_per_60: nstRates.penalties_drawn_per_60 || null,
          penalty_differential_per_60:
            nstRates.penalty_differential_per_60 || null,
          giveaways_per_60: nstRates.giveaways_per_60 || null,
          takeaways_per_60: nstRates.takeaways_per_60 || null,
          hits_per_60: nstRates.hits_per_60 || null,

          // NST On-Ice Rates Per 60 (from rates_oi)
          on_ice_goals_per_60: nstRatesOi.gf_per_60 || null,
          on_ice_goals_against_per_60: nstRatesOi.ga_per_60 || null,
          on_ice_shots_per_60: nstRatesOi.sf_per_60 || null,
          on_ice_shots_against_per_60: nstRatesOi.sa_per_60 || null,
          on_ice_cf_per_60: nstRatesOi.cf_per_60 || null,
          on_ice_ca_per_60: nstRatesOi.ca_per_60 || null,
          on_ice_ff_per_60: nstRatesOi.ff_per_60 || null,
          on_ice_fa_per_60: nstRatesOi.fa_per_60 || null,
          on_ice_xgf_per_60: nstRatesOi.xgf_per_60 || null,
          on_ice_xga_per_60: nstRatesOi.xga_per_60 || null,

          // NST Zone Usage Percentages (from counts_oi)
          off_zone_start_pct: nstCountsOi.off_zone_start_pct || null,
          def_zone_start_pct: def_zone_start_pct,
          neu_zone_start_pct: neu_zone_start_pct,
          off_zone_faceoff_pct: nstCountsOi.off_zone_faceoff_pct || null,

          // NST On-Ice Impact (from counts_oi)
          on_ice_sh_pct: nstCountsOi.on_ice_sh_pct || null,
          on_ice_sv_pct: nstCountsOi.on_ice_sv_pct || null,
          pdo: nstCountsOi.pdo || null,

          // NST Raw Counts (from counts)
          ixg: nstCounts.ixg || null,
          icf: nstCounts.icf || null,
          iff: nstCounts.iff || null,
          hdcf: nstCounts.hdcf || null,
          hdca: nstCounts.hdca || null,
          rush_attempts: nstCounts.rush_attempts || null,
          rebounds_created: nstCounts.rebounds_created || null,

          // NST On-Ice Raw Counts (from counts_oi)
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
        `[SSR] Successfully merged NST data with ${gameLog.length} WGO games`
      );
    } catch (nstError) {
      console.warn("[SSR] Error fetching NST data:", nstError);
      // Continue with WGO data only if NST fetch fails
    }

    // Fetch missed games data for server-side rendering
    let missedGames: any[] = [];
    try {
      console.log(
        `[SSR] Fetching missed games for player ${playerIdNum} in season ${selectedSeason}`
      );

      // Fetch all team games for the season
      const { data: teamGames, error: teamGamesError } = await supabase
        .from("games")
        .select("id, date, seasonId, type, homeTeamId, awayTeamId")
        .eq("seasonId", selectedSeason)
        .or(`homeTeamId.eq.${player.team_id},awayTeamId.eq.${player.team_id}`)
        .order("date", { ascending: true });

      if (teamGamesError) {
        console.warn(
          "[SSR] Error fetching team games:",
          teamGamesError.message
        );
      } else if (teamGames && teamGames.length > 0) {
        console.log(`[SSR] Found ${teamGames.length} team games`);

        // Create sets of dates when player actually played
        const playerGameDates = new Set<string>();

        // Add regular season game dates
        gameLog.forEach((game) => {
          if (game.games_played && game.games_played > 0) {
            playerGameDates.add(game.date);
          }
        });

        console.log(
          `[SSR] Player played on ${playerGameDates.size} dates in regular season`
        );

        // Get current date to only count missed games before today
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        // For each team game, check if player has a corresponding game log entry
        for (const teamGame of teamGames) {
          const gameDate = teamGame.date;
          const gameDateObj = new Date(gameDate);
          gameDateObj.setHours(0, 0, 0, 0); // Set to start of day
          const isRegularSeason = teamGame.type === 2;

          // Only check regular season (type 2) games before today's date
          if (!isRegularSeason || gameDateObj >= currentDate) {
            continue;
          }

          // Check if player played on this date
          if (!playerGameDates.has(gameDate)) {
            // Player missed this game
            missedGames.push({
              date: gameDate,
              gameId: teamGame.id,
              homeTeamId: teamGame.homeTeamId,
              awayTeamId: teamGame.awayTeamId,
              isPlayoff: false, // Regular season only for now
              seasonId: teamGame.seasonId
            });
          }
        }

        console.log(
          `[SSR] Found ${missedGames.length} missed regular season games`
        );
      }
    } catch (missedGamesError) {
      console.warn("[SSR] Error fetching missed games:", missedGamesError);
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

    // FIXED: Fetch playoff skater stats using year-based filtering
    if (!isGoalie && playerIdNum) {
      try {
        console.log(
          `[SSR] Fetching playoff data for player ${playerIdNum} in season ${selectedSeason}`
        );

        // Extract the playoff year from the season ID
        // For season 20242025, playoff year is 2025
        // For season 20232024, playoff year is 2024
        const playoffYear = selectedSeason
          ? Math.floor(selectedSeason % 10000)
          : null;

        console.log(
          `[SSR] Playoff year calculated: ${playoffYear} from season ${selectedSeason}`
        );

        let playoffQuery = supabase
          .from("wgo_skater_stats_playoffs")
          .select(
            `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
          )
          .eq("player_id", playerIdNum)
          .order("date", { ascending: true });

        // Filter by playoff year if we have a valid season
        if (playoffYear && playoffYear >= 2020) {
          // Filter for dates that start with the playoff year (e.g., "2025-")
          playoffQuery = playoffQuery
            .gte("date", `${playoffYear}-01-01`)
            .lt("date", `${playoffYear + 1}-01-01`);
        }

        const { data: playoffData, error: playoffError } = await playoffQuery;

        if (playoffError) {
          console.warn(
            "[SSR] Error fetching playoff data:",
            playoffError.message
          );
        } else if (playoffData && playoffData.length > 0) {
          playoffGameLog = playoffData.map((game: any) => ({
            ...game,
            isPlayoff: true
          }));
          console.log(
            `[SSR] Found ${playoffGameLog.length} playoff games for player ${playerIdNum} in year ${playoffYear}`
          );
          console.log(
            `[SSR] Date range: ${playoffData[0].date} to ${playoffData[playoffData.length - 1].date}`
          );
        } else {
          console.log(
            `[SSR] No playoff data found for player ${playerIdNum} in year ${playoffYear}`
          );

          // Fallback: try to get any playoff data for this player to see what's available
          const { data: allPlayoffData } = await supabase
            .from("wgo_skater_stats_playoffs")
            .select("date, goals, assists, points")
            .eq("player_id", playerIdNum)
            .order("date", { ascending: false })
            .limit(3);

          if (allPlayoffData && allPlayoffData.length > 0) {
            console.log(
              "[SSR] Available playoff data for this player:",
              allPlayoffData.map((g) => ({
                date: g.date,
                points: g.points
              }))
            );
          }
        }
      } catch (error) {
        console.error("[SSR] Error in playoff data fetching:", error);
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

  // Fetch missed games data
  const missedGamesData = await fetchMissedGames(
    Number(playerId),
    selectedSeason,
    player.team_id ?? undefined
  );

  console.log(`[SSR] Final missed games data:`, {
    count: missedGamesData.length,
    games: missedGamesData
  });

  // Calculate available seasons from season totals data
  const availableSeasons = seasonTotals.map((season) => {
    const seasonId = isGoalie
      ? (season as GoalieSeasonTotals).season_id
      : (season as SkaterSeasonTotals).season_id;
    const seasonStr = String(seasonId);

    // Convert season ID like 20242025 to display format like "2024-25"
    const startYear = seasonStr.slice(0, 4);
    const endYear = seasonStr.slice(6, 8);

    return {
      value: seasonId,
      label: `${startYear}-${endYear}`,
      displayName: `${startYear}-${endYear} Season`
    };
  });

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
        : seasonTotals.map((s) => (s as SkaterSeasonTotals).season_id),
      availableSeasonsFormatted: availableSeasons, // Add formatted seasons for the heatmap
      missedGames: missedGamesData || []
    }
  };
}
