import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import Link from "next/link";
import { PlayerStatsChart } from "components/PlayerStats/PlayerStatsChart";
import { PlayerStatsTable } from "components/PlayerStats/PlayerStatsTable";
import { PlayerStatsSummary } from "components/PlayerStats/PlayerStatsSummary";
import { PlayerPerformanceHeatmap } from "components/PlayerStats/PlayerPerformanceHeatmap";
import { PlayerRadarChart } from "components/PlayerStats/PlayerRadarChart";
import { PlayerContextualStats } from "components/PlayerStats/PlayerContextualStats";
import { PlayerAdvancedStats } from "components/PlayerStats/PlayerAdvancedStats";
import {
  PlayerLineupDeploymentGrid,
  PlayerLineupDeploymentTally
} from "components/PlayerStats/PlayerLineupDeploymentGrid";
import styles from "components/PlayerStats/PlayerStats.module.scss";
import shell from "components/PlayerStats/PlayerPageShell.module.scss";
import { PlayerIdentityBar } from "components/PlayerStats/PlayerIdentityBar";
import { PlayerSummaryStrip } from "components/PlayerStats/PlayerSummaryStrip";
import {
  PlayerStatControls,
  TIME_FRAME_LABELS
} from "components/PlayerStats/PlayerStatControls";

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
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";
import {
  fetchTeamBoxScoreDates,
  resolveSeasonTeamId
} from "components/PlayerStats/boxScoreCoverage";
import {
  leagueDateKey,
  rollingAverage,
  seasonDateWindow,
  sortGameLogAscending,
  windowGameLog,
  windowStartDate
} from "components/PlayerStats/playerStatsContract";
import {
  indexNstRowsByDate,
  mergeNstGameRow
} from "components/PlayerStats/nstGameLogMerge";

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
  // Team schedule rows without an appearance (past absences and future games);
  // null when the schedule could not be determined.
  missedGames?: MissedGame[] | null;
  lineupDeploymentTallies?: PlayerLineupDeploymentTally[];
  // League-local date the schedule was classified against (YYYY-MM-DD).
  asOfDate?: string;
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
  missedGames = null,
  lineupDeploymentTallies = [],
  asOfDate: ssrAsOfDate
}: PlayerStatsPageProps) {
  const router = useRouter();
  const { playerId } = router.query;

  // One season context for every tab: the season the server loaded. Fallback
  // logs belong to another season, so their schedule context is unknown.
  const seasonId = mostRecentSeason ?? null;
  const logSeasonId = usedGameLogFallback ? null : seasonId;
  const scheduleGames = usedGameLogFallback ? null : missedGames;
  const asOfDate = ssrAsOfDate ?? leagueDateKey();

  // Providers return newest first; every tab works on ascending logs.
  const gameLog = useMemo(() => sortGameLogAscending(ssrGameLog), [ssrGameLog]);
  const playoffGameLog = useMemo(
    () => sortGameLogAscending(ssrPlayoffGameLog),
    [ssrPlayoffGameLog]
  );

  const [activeTab, setActiveTab] = useState<StatsTab>("overview");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("season");
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [showPlayoffData, setShowPlayoffData] = useState<boolean>(false);
  const [showRollingAverage, setShowRollingAverage] = useState<boolean>(false);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "FHFHockey";
  const teamInfo = player?.team_id ? getTeamInfoById(player.team_id) : null;
  const teamAbbreviation = player?.team_id
    ? getTeamAbbreviationById(player.team_id)
    : null;
  const teamLabel = teamInfo
    ? `${teamInfo.name}${teamAbbreviation ? ` (${teamAbbreviation})` : ""}`
    : teamAbbreviation;

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
  }, [player]);

  // Initialize selected stats based on position
  React.useEffect(() => {
    if (selectedStats.length === 0 && positionConfig) {
      setSelectedStats([...positionConfig.primary]); // Spread to create mutable array
    }
  }, [positionConfig, selectedStats.length]);

  // Filter game log based on timeframe
  const filteredGameLog = useMemo(
    () => windowGameLog(gameLog, timeFrame),
    [gameLog, timeFrame]
  );
  const windowStart = windowStartDate(filteredGameLog, timeFrame);

  // Calculate rolling averages and trends
  // 5-game rolling averages over present values; empty windows are gaps.
  const processedGameLog = useMemo(() => {
    const rolling = Object.fromEntries(
      selectedStats.map((stat) => [stat, rollingAverage(filteredGameLog, stat)])
    );
    return filteredGameLog.map((game: GameLogEntry, index: number) => ({
      ...game,
      ...Object.fromEntries(
        selectedStats.map((stat) => [`${stat}_5game_avg`, rolling[stat][index]])
      )
    }));
  }, [filteredGameLog, selectedStats]);

  const statGroups = [
    { label: "Primary", stats: positionConfig.primary },
    { label: "Secondary", stats: positionConfig.secondary },
    ...(positionConfig.advanced
      ? [{ label: "Advanced", stats: positionConfig.advanced }]
      : [])
  ];
  const windowLabel =
    timeFrame === "custom" ? "Custom" : TIME_FRAME_LABELS[timeFrame];
  const seasonText = String(seasonId ?? "");
  const scopeLabel = usedGameLogFallback
    ? "Most recent games (no logs for the selected season)"
    : /^\d{8}$/.test(seasonText)
      ? `${seasonText.slice(0, 4)}-${seasonText.slice(6)} regular season`
      : "Season unavailable";

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
        title={`${player.fullName} Stats - ${siteName}`}
        description={`Detailed hockey statistics for ${player.fullName}`}
      />

      <main className={shell.workspace}>
        <PlayerIdentityBar
          player={player}
          teamLabel={teamLabel}
          scopeLabel={scopeLabel}
        />

        <nav className={shell.viewSwitch} aria-label="Player statistics views">
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
              type="button"
              onClick={() => setActiveTab(tab)}
              className={shell.viewButton}
              aria-pressed={activeTab === tab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab !== "advanced" && activeTab !== "gamelog" && (
          <PlayerStatControls
            timeFrame={timeFrame}
            onTimeFrameChange={setTimeFrame}
            groups={statGroups}
            selectedStats={selectedStats}
            onToggleStat={handleStatToggle}
          />
        )}

        {/* Content Area */}
        <div className={styles.contentArea}>
          {activeTab === "overview" && (
            <>
              <PlayerSummaryStrip
                gameLog={filteredGameLog}
                isGoalie={isGoalie}
                windowLabel={windowLabel}
              />

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
                      seasonId={mostRecentSeason}
                      timeFrame={timeFrame}
                      usedGameLogFallback={usedGameLogFallback}
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
                      seasonId={seasonId}
                      missedGames={scheduleGames}
                      asOfDate={asOfDate}
                      windowStartDate={windowStart}
                    />
                  </div>
                  {!isGoalie && lineupDeploymentTallies.length > 0 && (
                    <div className={styles.deploymentPanel}>
                      <PlayerLineupDeploymentGrid
                        rows={lineupDeploymentTallies}
                        positions={player.position ? [player.position] : undefined}
                      />
                    </div>
                  )}
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
                      seasonId={logSeasonId}
                      missedGames={scheduleGames}
                      asOfDate={asOfDate}
                      windowStartDate={windowStart}
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
              seasonGameLog={gameLog}
              playoffGameLog={playoffGameLog}
              selectedStats={
                positionConfig.advanced || positionConfig.secondary
              }
              isGoalie={isGoalie}
              showPlayoffData={showPlayoffData}
              seasonTotals={seasonTotals}
              playerId={Number(playerId)}
              seasonId={seasonId}
              timeFrame={timeFrame}
              usedGameLogFallback={usedGameLogFallback}
              missedGames={scheduleGames}
              asOfDate={asOfDate}
              windowStartDate={windowStart}
            />
          )}

          {activeTab === "trends" && (
            <>

              <PlayerStatsChart
                gameLog={processedGameLog}
                seasonGameLog={gameLog}
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

              <PlayerPerformanceHeatmap
                player={player}
                gameLog={filteredGameLog}
                playoffGameLog={playoffGameLog}
                selectedStats={selectedStats}
                selectedStat={selectedStats[0] || "points"}
                isGoalie={isGoalie}
                playerId={Number(playerId)}
                playerTeamId={player.team_id}
                seasonId={logSeasonId}
                missedGames={scheduleGames}
                asOfDate={asOfDate}
                windowStartDate={windowStart}
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
                playerTeamId={player.team_id}
                seasonId={seasonId}
                missedGames={scheduleGames}
                asOfDate={asOfDate}
                windowStartDate={windowStart}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/**
 * Team regular-season/playoff games the player has no appearance for, split by
 * the league-local as-of date: earlier games are absences, games on or after it
 * are flagged isFuture. Appearances come from the already-loaded game logs
 * (skater or goalie tables). Returns null when the schedule is unavailable so
 * the page reports availability as unknown instead of 100%.
 */
// Provider table and team column that prove a box score was loaded.
type BoxScoreSource = {
  table: "wgo_skater_stats" | "wgo_goalie_stats";
  playoffTable: "wgo_skater_stats_playoffs" | null;
  teamColumn: "team_abbrev" | "team_abbreviation";
};

/**
 * Dates (from `dates`) on which the provider has at least one row for the
 * team. Unknown coverage (no abbreviation, query error) returns null, so the
 * caller treats those games as unconfirmed rather than missed.
 */
async function fetchBoxScoreCoverage(
  table: string,
  teamColumn: string,
  teamAbbrev: string | undefined,
  dates: string[]
): Promise<Set<string> | null> {
  try {
    return await fetchTeamBoxScoreDates(supabase, table, teamColumn, teamAbbrev, dates);
  } catch (error) {
    console.warn(`[SSR] Box score coverage unavailable for ${table}:`, error);
    return null;
  }
}

async function fetchMissedGames(
  seasonId: number | undefined,
  seasonWindow: { start: string; end: string } | null,
  teamId: number | undefined,
  playedDates: Set<string>,
  asOfDate: string,
  includePlayoffs: boolean,
  source: BoxScoreSource
): Promise<MissedGame[] | null> {
  if (!seasonId || !seasonWindow || !teamId) return null;

  try {
    const { data: teamGames, error: teamGamesError } = await supabase
      .from("games")
      .select("id, date, seasonId, type, homeTeamId, awayTeamId")
      .eq("seasonId", seasonId)
      .gte("date", seasonWindow.start)
      .lte("date", seasonWindow.end)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .order("date", { ascending: true });

    if (teamGamesError) {
      console.error("[SSR] Error fetching team games:", teamGamesError.message);
      return null;
    }
    if (!teamGames || teamGames.length === 0) return null;

    const scheduleGames: MissedGame[] = [];
    for (const teamGame of teamGames) {
      const isPlayoff = teamGame.type === 3;
      if (teamGame.type !== 2 && !(includePlayoffs && isPlayoff)) continue;
      const gameDate = String(teamGame.date).slice(0, 10);
      if (playedDates.has(gameDate)) continue;
      scheduleGames.push({
        date: gameDate,
        gameId: teamGame.id,
        homeTeamId: teamGame.homeTeamId,
        awayTeamId: teamGame.awayTeamId,
        isPlayoff,
        seasonId: teamGame.seasonId,
        isFuture: gameDate >= asOfDate
      });
    }

    // A past game only counts as missed when the box score for the player's
    // team has been loaded; otherwise the absent row is an ingestion gap.
    const teamAbbrev = getTeamAbbreviationById(teamId);
    const pastDates = (playoff: boolean) =>
      scheduleGames
        .filter((game) => !game.isFuture && game.isPlayoff === playoff)
        .map((game) => game.date);
    const [regularCoverage, playoffCoverage] = await Promise.all([
      fetchBoxScoreCoverage(
        source.table,
        source.teamColumn,
        teamAbbrev,
        pastDates(false)
      ),
      source.playoffTable
        ? fetchBoxScoreCoverage(
            source.playoffTable,
            source.teamColumn,
            teamAbbrev,
            pastDates(true)
          )
        : Promise.resolve(new Set<string>())
    ]);
    for (const game of scheduleGames) {
      if (game.isFuture) continue;
      const coverage = game.isPlayoff ? playoffCoverage : regularCoverage;
      if (!coverage || !coverage.has(game.date)) game.isUnconfirmed = true;
    }
    return scheduleGames;
  } catch (error) {
    console.error("[SSR] Error fetching missed games:", error);
    return null;
  }
}

/** Skater playoff games in the selected season's playoff year. */
async function fetchSkaterPlayoffLog(
  playerId: number,
  seasonId: number
): Promise<GameLogEntry[]> {
  try {
    // For season 20242025 the playoff year is 2025.
    const playoffYear = seasonId ? Math.floor(seasonId % 10000) : null;
    let playoffQuery = supabase
      .from("wgo_skater_stats_playoffs")
      .select(
        `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, total_fow, total_fol, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
      )
      .eq("player_id", playerId)
      .order("date", { ascending: true });

    if (playoffYear && playoffYear >= 2020) {
      playoffQuery = playoffQuery
        .gte("date", `${playoffYear}-01-01`)
        .lt("date", `${playoffYear + 1}-01-01`);
    }

    const { data: playoffData, error: playoffError } = await playoffQuery;
    if (playoffError) {
      console.warn("[SSR] Error fetching playoff data:", playoffError.message);
      return [];
    }
    return (playoffData ?? []).map((game: any) => ({
      ...game,
      isPlayoff: true
    })) as GameLogEntry[];
  } catch (error) {
    console.error("[SSR] Error in playoff data fetching:", error);
    return [];
  }
}

// ...existing code...

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { playerId, season } = context.query;
  if (typeof playerId !== "string" || !/^[1-9]\d*$/.test(playerId)) {
    return { notFound: true };
  }
  const playerIdNum = Number(playerId);
  if (!Number.isSafeInteger(playerIdNum)) return { notFound: true };

  // Fetch player info
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(
      `id, fullName, image_url, team_id, sweater_number, position, birthDate, birthCity, birthCountry, heightInCentimeters, weightInKilograms`
    )
    .eq("id", playerIdNum)
    .maybeSingle();

  if (playerError) throw playerError;
  if (!player) return { notFound: true };

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

  // Season reads are bounded by the season's dates as well as season_id:
  // provider rows can carry a wrong season_id (e.g. 2010-2017 rows labelled
  // 20242025).
  const { data: seasonRow, error: seasonRowError } = await supabase
    .from("seasons")
    .select("id, startDate, endDate")
    .eq("id", Number(selectedSeason))
    .maybeSingle();
  if (seasonRowError) {
    console.warn("[SSR] Error fetching season dates:", seasonRowError.message);
  }
  const seasonWindow = seasonDateWindow(selectedSeason, seasonRow);

  const fetchSeasonLogRows = async (
    table: "wgo_skater_stats" | "wgo_goalie_stats",
    idField: "player_id" | "goalie_id",
    selectFields: string
  ): Promise<GameLogEntry[]> => {
    if (!seasonWindow) return [];
    try {
      return await fetchAllSupabasePages<GameLogEntry>(
        ({ from, to }) =>
          (supabase as any)
            .from(table)
            .select(selectFields)
            .eq(idField, playerIdNum)
            .eq("season_id", selectedSeason)
            .gte("date", seasonWindow.start)
            .lte("date", seasonWindow.end)
            .order("date", { ascending: false })
            .range(from, to)
      );
    } catch (error) {
      console.error(`Error fetching data from ${table}:`, error);
      return [];
    }
  };

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
    gameLog = await fetchSeasonLogRows(
      "wgo_goalie_stats",
      "goalie_id",
      `date, team_abbreviation, games_played, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
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
    // The game log, the four NST tables and the playoff log are independent
    // once the season is known; start them together.
    const nstGamelog = (
      table:
        | "nst_gamelog_as_counts"
        | "nst_gamelog_as_counts_oi"
        | "nst_gamelog_as_rates"
        | "nst_gamelog_as_rates_oi"
    ) =>
      supabase
        .from(table)
        .select("*")
        .eq("player_id", playerIdNum)
        .eq("season", selectedSeason as number)
        .order("date_scraped", { ascending: true });
    const nstReads = Promise.all([
      nstGamelog("nst_gamelog_as_counts"),
      nstGamelog("nst_gamelog_as_counts_oi"),
      nstGamelog("nst_gamelog_as_rates"),
      nstGamelog("nst_gamelog_as_rates_oi")
    ]);
    nstReads.catch(() => undefined); // awaited below; avoid an unhandled rejection meanwhile
    const playoffRead = fetchSkaterPlayoffLog(playerIdNum, selectedSeason as number);

    // Regular season skater stats
    gameLog = await fetchSeasonLogRows(
      "wgo_skater_stats",
      "player_id",
      `date, team_abbrev, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, total_fow, total_fol, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
    );

    // Fetch NST advanced stats for skaters
    try {
      console.log(
        `[SSR] Fetching NST data for player ${playerIdNum} in season ${selectedSeason}`
      );

      const [
        { data: nstCounts, error: nstCountsError },
        { data: nstCountsOi, error: nstCountsOiError },
        { data: nstRates, error: nstRatesError },
        { data: nstRatesOi, error: nstRatesOiError }
      ] = await nstReads;

      if (nstCountsError) {
        console.warn(
          "[SSR] Error fetching NST counts:",
          nstCountsError.message
        );
      } else {
        nstCountsData = nstCounts || [];
        console.log(`[SSR] Fetched ${nstCountsData.length} NST counts records`);
      }

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

      if (nstRatesError) {
        console.warn("[SSR] Error fetching NST rates:", nstRatesError.message);
      } else {
        nstRatesData = nstRates || [];
        console.log(`[SSR] Fetched ${nstRatesData.length} NST rates records`);
      }

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

      // Join NST rows by date; the merge carries source-matched NST counts and
      // TOI seconds so windows pool rates by TOI and shares by denominators.
      const nstCountsMap = indexNstRowsByDate(nstCountsData);
      const nstCountsOiMap = indexNstRowsByDate(nstCountsOiData);
      const nstRatesMap = indexNstRowsByDate(nstRatesData);
      const nstRatesOiMap = indexNstRowsByDate(nstRatesOiData);

      gameLog = gameLog.map((wgoGame) => {
        const date = String(wgoGame.date).slice(0, 10);
        return mergeNstGameRow(wgoGame, {
          counts: nstCountsMap.get(date),
          countsOi: nstCountsOiMap.get(date),
          rates: nstRatesMap.get(date),
          ratesOi: nstRatesOiMap.get(date)
        }) as GameLogEntry;
      });

      console.log(
        `[SSR] Successfully merged NST data with ${gameLog.length} WGO games`
      );
    } catch (nstError) {
      console.warn("[SSR] Error fetching NST data:", nstError);
      // Continue with WGO data only if NST fetch fails
    }

    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_skater_stats")
        .select(
          `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, total_fow, total_fol, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
        )
        .eq("player_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData as GameLogEntry[];
        usedGameLogFallback = true;
      }
    }

    playoffGameLog = await playoffRead;
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

  // Team schedule rows without an appearance, classified as of today in the
  // league's time zone. Fallback logs come from another season, so skip them.
  const asOfDate = leagueDateKey();
  const playedDates = new Set(
    [...gameLog, ...playoffGameLog]
      .filter((game) => Number(game.games_played) > 0)
      .map((game) => String(game.date).slice(0, 10))
  );
  // Missed games and deployment tallies are independent reads.
  const fetchDeploymentTallies = async (): Promise<PlayerLineupDeploymentTally[]> => {
    if (isGoalie || !selectedSeason) return [];
    const { data: deploymentRows, error: deploymentError } = await (supabase as any)
      .from("player_lineup_deployment_tallies")
      .select(
        "deployment_group,deployment_code,deployment_label,games,total_games,share"
      )
      .eq("player_id", playerIdNum)
      .eq("season_id", selectedSeason)
      .eq("game_type", 2)
      .order("deployment_group", { ascending: true })
      .order("deployment_code", { ascending: true });

    if (deploymentError) {
      console.warn(
        "[SSR] Error fetching lineup deployment tallies:",
        deploymentError.message
      );
      return [];
    }
    return (deploymentRows ?? []) as PlayerLineupDeploymentTally[];
  };

  // A past season spent with another team is judged against that team's
  // schedule, not the current team's (which would list every game as missed).
  const seasonTeamId = resolveSeasonTeamId(
    player.team_id,
    player.team_id ? getTeamAbbreviationById(player.team_id) : undefined,
    gameLog
      .filter((game) => Number(game.games_played) > 0)
      .map((game) => {
        const row = game as { team_abbrev?: string; team_abbreviation?: string };
        return isGoalie ? row.team_abbreviation : row.team_abbrev;
      })
  );
  const [missedGamesData, lineupDeploymentTallies] = await Promise.all([
    usedGameLogFallback
      ? Promise.resolve(null)
      : fetchMissedGames(
          Number(selectedSeason),
          seasonWindow,
          seasonTeamId ?? undefined,
          playedDates,
          asOfDate,
          !isGoalie,
          isGoalie
            ? {
                table: "wgo_goalie_stats",
                playoffTable: null,
                teamColumn: "team_abbreviation"
              }
            : {
                table: "wgo_skater_stats",
                playoffTable: "wgo_skater_stats_playoffs",
                teamColumn: "team_abbrev"
              }
        ),
    fetchDeploymentTallies()
  ]);

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
      missedGames: missedGamesData,
      asOfDate,
      lineupDeploymentTallies
    }
  };
}
