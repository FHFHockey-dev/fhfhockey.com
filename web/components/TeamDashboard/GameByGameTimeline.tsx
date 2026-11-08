import React, { useState, useEffect } from "react";
import supabase from "lib/supabase";
import { format, parseISO } from "date-fns";
import styles from "./GameByGameTimeline.module.scss";

interface GameData {
  date: string;
  opponent_team_id: number;
  opponent_abbrev: string;
  is_home: boolean;
  result: "W" | "L" | "OTL";
  decided?: "OT" | "SO";
  goals_for: number;
  goals_against: number;
  shots_for: number;
  shots_against: number;
  power_play_pct: number;
  penalty_kill_pct: number;
  faceoff_win_pct: number;
  game_id?: number;
}

interface GameByGameTimelineProps {
  teamId: string;
  teamAbbrev: string;
  seasonId: string;
  maxGames?: number;
}

function detailsIdForGame(game: GameData) {
  return `game-details-${game.game_id ?? `${game.date}-${game.opponent_team_id}`}`;
}

/**
 * Trends view: one bar per game (oldest → newest) for goal differential,
 * coloured by result like the game cards, with the running total in the title.
 */
function GoalDifferentialTrend({
  games,
  resultClass
}: {
  games: GameData[];
  resultClass: (result: string) => string;
}) {
  const ordered = [...games].reverse();
  const diffs = ordered.map((game) => game.goals_for - game.goals_against);
  const total = diffs.reduce((sum, diff) => sum + diff, 0);
  const scale = Math.max(3, ...diffs.map((diff) => Math.abs(diff)));
  const width = 320;
  const height = 132;
  const top = 16;
  const plot = height - top - 26; // room for value labels and dates
  const zeroY = top + plot / 2;
  const slot = width / Math.max(ordered.length, 1);
  const barWidth = Math.min(22, slot * 0.6);
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

  return (
    <figure className={styles.trend}>
      <figcaption className={styles.trendCaption}>
        Goal differential by game ·{" "}
        <strong>{signed(total)}</strong> over {ordered.length}
      </figcaption>
      <svg
        className={styles.trendChart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Goal differential, oldest to newest: ${ordered
          .map(
            (game, index) =>
              `${format(parseISO(game.date), "MMM d")} ${game.is_home ? "vs" : "at"} ${game.opponent_abbrev} ${signed(diffs[index])}`
          )
          .join(", ")}. Total ${signed(total)}.`}
      >
        <line
          className={styles.trendZero}
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
        />
        {ordered.map((game, index) => {
          const diff = diffs[index];
          const barHeight = Math.max((Math.abs(diff) / scale) * (plot / 2), diff === 0 ? 0 : 2);
          const x = index * slot + (slot - barWidth) / 2;
          const y = diff >= 0 ? zeroY - barHeight : zeroY;
          const labelY = diff >= 0 ? y - 4 : y + barHeight + 11;
          return (
            <g key={`${game.date}-${game.opponent_team_id}`} className={resultClass(game.result)}>
              <rect
                className={styles.trendBar}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
              />
              <text className={styles.trendValue} x={x + barWidth / 2} y={labelY}>
                {signed(diff)}
              </text>
              <text className={styles.trendDate} x={x + barWidth / 2} y={height - 4}>
                {format(parseISO(game.date), "M/d")}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function GameByGameTimeline({
  teamId,
  teamAbbrev,
  seasonId,
  maxGames = 10
}: GameByGameTimelineProps) {
  const [gameData, setGameData] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [selectedView, setSelectedView] = useState<"overview" | "trends">(
    "overview"
  );
  const [last10Record, setLast10Record] = useState<{
    wins: number;
    losses: number;
    otLosses: number;
  } | null>(null);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);

        // Fetch the most recent games from wgo_team_stats - get one extra to calculate differentials
        const { data: wgoData, error: wgoError } = await supabase
          .from("wgo_team_stats")
          .select(
            `
            date,
            game_id,
            goals_for,
            goals_against,
            wins,
            losses,
            ot_losses,
            wins_in_regulation,
            wins_in_shootout,
            shots_for_per_game,
            shots_against_per_game,
            power_play_pct,
            penalty_kill_pct,
            faceoff_win_pct,
            games_played
          `
          )
          .eq("team_id", parseInt(teamId))
          .eq("season_id", parseInt(seasonId))
          .order("date", { ascending: false })
          .limit(maxGames + 1); // Get one extra to calculate differentials

        if (wgoError) throw wgoError;

        // Add debugging logs
        console.log("WGO Data fetched:", {
          teamId: parseInt(teamId),
          seasonId: parseInt(seasonId),
          maxGames,
          rowsReturned: wgoData?.length || 0,
          firstRow: wgoData?.[0],
          lastRow: wgoData?.[wgoData?.length - 1]
        });

        // Calculate the last 10 games record by summing the raw values
        if (wgoData && wgoData.length >= 1) {
          // Take only the most recent maxGames (usually 10)
          const last10Games = wgoData.slice(
            0,
            Math.min(maxGames, wgoData.length)
          );

          // Simply sum up the wins, losses, and ot_losses columns
          const winsCount = last10Games.reduce(
            (sum, game) => sum + (game.wins || 0),
            0
          );
          const lossesCount = last10Games.reduce(
            (sum, game) => sum + (game.losses || 0),
            0
          );
          const otLossesCount = last10Games.reduce(
            (sum, game) => sum + (game.ot_losses || 0),
            0
          );

          console.log("Raw sum calculation:", {
            gamesProcessed: last10Games.length,
            winsCount,
            lossesCount,
            otLossesCount,
            totalGames: winsCount + lossesCount + otLossesCount,
            sampleData: last10Games.slice(0, 3).map((game) => ({
              date: game.date,
              wins: game.wins,
              losses: game.losses,
              ot_losses: game.ot_losses
            }))
          });

          setLast10Record({
            wins: winsCount,
            losses: lossesCount,
            otLosses: otLossesCount
          });
        } else {
          console.log("Insufficient data for record calculation:", {
            dataLength: wgoData?.length || 0
          });
        }

        // Fetch games table data for opponent info
        const gameIds =
          wgoData
            ?.map((game) => game.game_id)
            .filter((id): id is number => id !== null) || [];
        const { data: gamesData, error: gamesError } = await supabase
          .from("games")
          .select(
            `
            id,
            homeTeamId,
            awayTeamId,
            date
          `
          )
          .in("id", gameIds);

        if (gamesError) throw gamesError;

        // Fetch team info for opponent names
        const { data: teamsData, error: teamsError } = await supabase
          .from("teams")
          .select("id, abbreviation");

        if (teamsError) throw teamsError;

        // Process the data for individual game cards
        const processedGames: GameData[] = [];

        for (let i = 0; i < Math.min(wgoData?.length || 0, maxGames); i++) {
          const currentGame = wgoData[i];

          if (!currentGame) continue;

          // Find corresponding game data
          const gameInfo = gamesData?.find((g) => g.id === currentGame.game_id);
          if (!gameInfo) continue;

          // Determine opponent and home/away status
          const isHome = gameInfo.homeTeamId === parseInt(teamId);
          const opponentId = isHome ? gameInfo.awayTeamId : gameInfo.homeTeamId;
          const opponentInfo = teamsData?.find((t) => t.id === opponentId);

          // Determine result directly from the individual game data
          let result: "W" | "L" | "OTL";
          if (currentGame.wins === 1) {
            result = "W";
          } else if (currentGame.ot_losses === 1) {
            result = "OTL";
          } else if (currentGame.losses === 1) {
            result = "L";
          } else {
            // Fallback - this shouldn't happen in normal data
            result = "L";
          }

          // Shootout goals aren't in goals_for/against, so a tied score means a shootout.
          const tied = (currentGame.goals_for || 0) === (currentGame.goals_against || 0);
          let decided: GameData["decided"];
          if (result === "W") {
            if (currentGame.wins_in_shootout === 1 || tied) decided = "SO";
            else if (currentGame.wins_in_regulation === 0) decided = "OT";
          } else if (result === "OTL") {
            decided = tied ? "SO" : "OT";
          }
          // NHL convention: the shootout winner is credited one goal (5-5 → 6-5 SO).
          const shootoutGoal = decided === "SO" && tied ? 1 : 0;

          processedGames.push({
            date: currentGame.date,
            opponent_team_id: opponentId,
            opponent_abbrev: opponentInfo?.abbreviation || "UNK",
            is_home: isHome,
            result,
            decided,
            goals_for:
              (currentGame.goals_for || 0) + (result === "W" ? shootoutGoal : 0),
            goals_against:
              (currentGame.goals_against || 0) +
              (result === "OTL" ? shootoutGoal : 0),
            shots_for: Math.round(currentGame.shots_for_per_game || 0),
            shots_against: Math.round(currentGame.shots_against_per_game || 0),
            power_play_pct: currentGame.power_play_pct || 0,
            penalty_kill_pct: currentGame.penalty_kill_pct || 0,
            faceoff_win_pct: currentGame.faceoff_win_pct || 0,
            game_id: currentGame.game_id ?? undefined
          });
        }

        setGameData(processedGames);
      } catch (error) {
        console.error("Error fetching game timeline data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (teamId && seasonId) {
      fetchGameData();
    }
  }, [teamId, teamAbbrev, seasonId, maxGames]);

  const getResultClass = (result: string) => {
    switch (result) {
      case "W":
        return styles.win;
      case "L":
        return styles.loss;
      case "OTL":
        return styles.otLoss;
      default:
        return "";
    }
  };

  const getPerformanceScore = (game: GameData) => {
    let score = 0;

    // Goals differential (most important)
    const goalDiff = game.goals_for - game.goals_against;
    score += goalDiff * 2;

    // Shots differential
    const shotDiff = game.shots_for - game.shots_against;
    score += shotDiff * 0.1;

    // Special teams performance
    if (game.power_play_pct > 0.2) score += 1;
    if (game.penalty_kill_pct > 0.8) score += 1;
    if (game.faceoff_win_pct > 0.5) score += 0.5;

    return score;
  };

  const getPerformanceClass = (score: number) => {
    if (score >= 2) return styles.excellent;
    if (score >= 0) return styles.good;
    if (score >= -2) return styles.poor;
    return styles.terrible;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>Loading game timeline...</span>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHeader}>
        <h4>Last {maxGames} Games</h4>
        <span className={styles.timelineSubtitle}>
          {last10Record?.wins || 0}-{last10Record?.losses || 0}-
          {last10Record?.otLosses || 0}
        </span>
        <div
          aria-label="Timeline view"
          className={styles.viewTabs}
          role="group"
        >
          <button
            type="button"
            aria-pressed={selectedView === "overview"}
            className={`${styles.viewTab} ${selectedView === "overview" ? styles.active : ""}`}
            onClick={() => setSelectedView("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            aria-pressed={selectedView === "trends"}
            className={`${styles.viewTab} ${selectedView === "trends" ? styles.active : ""}`}
            onClick={() => setSelectedView("trends")}
          >
            Trends
          </button>
        </div>
      </div>

      {selectedView === "trends" && (
        <GoalDifferentialTrend
          games={gameData}
          resultClass={getResultClass}
        />
      )}

      <div className={styles.gameGrid} hidden={selectedView === "trends"}>
        {gameData.map((game, index) => {
          const performanceScore = getPerformanceScore(game);
          const isSelected = selectedGame?.date === game.date;
          const detailsId = detailsIdForGame(game);

          return (
            <button
              type="button"
              key={`${game.date}-${game.opponent_team_id}`}
              aria-controls={isSelected ? detailsId : undefined}
              aria-expanded={isSelected}
              aria-label={`${isSelected ? "Hide" : "Show"} details for ${format(parseISO(game.date), "MMMM d, yyyy")}, ${game.is_home ? "versus" : "at"} ${game.opponent_abbrev}, final score ${game.goals_for} to ${game.goals_against}${game.decided === "SO" ? " in a shootout" : game.decided === "OT" ? " in overtime" : ""}`}
              className={`${styles.gameCardAndBar} ${getResultClass(game.result)} ${isSelected ? styles.selected : ""}`}
              onClick={() => setSelectedGame(isSelected ? null : game)}
            >
              <span className={styles.gameCard}>
                <span className={styles.gameHeader}>
                  <span className={styles.gameResult}>{game.result}</span>
                  <span className={styles.gameDate}>
                    {format(parseISO(game.date), "M/d")}
                  </span>
                </span>
                <span className={styles.gameScore}>
                  {game.goals_for}-{game.goals_against}
                  {game.decided && (
                    <span className={styles.decidedTag}>{game.decided}</span>
                  )}
                </span>

                <span className={styles.gameMatchup}>
                  <span className={styles.homeAway}>
                    {game.is_home ? "vs" : "@"}
                  </span>
                  <span className={styles.opponent}>
                    {game.opponent_abbrev}
                  </span>
                </span>
              </span>
              <span
                className={`${styles.performanceBar} ${getPerformanceClass(performanceScore)}`}
              >
                <span
                  className={styles.performanceFill}
                  style={{
                    width: `${Math.min(Math.max(((performanceScore + 4) / 8) * 100, 10), 100)}%`
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {selectedGame && (
        <div
          aria-label={`Game details for ${selectedGame.opponent_abbrev}`}
          className={styles.gameDetails}
          id={detailsIdForGame(selectedGame)}
          role="region"
        >
          <div className={styles.detailsHeader}>
            <h5>
              {format(parseISO(selectedGame.date), "MMM d, yyyy")} -
              {selectedGame.is_home ? " vs " : " @ "}
              {selectedGame.opponent_abbrev}
            </h5>
            <button
              type="button"
              aria-label="Close game details"
              className={styles.closeButton}
              onClick={() => setSelectedGame(null)}
            >
              ×
            </button>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Final Score</span>
              <span
                className={`${styles.detailValue} ${getResultClass(selectedGame.result)}`}
              >
                {selectedGame.goals_for}-{selectedGame.goals_against}{" "}
                {selectedGame.result}
              </span>
            </div>

            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Shots</span>
              <span className={styles.detailValue}>
                {selectedGame.shots_for}-{selectedGame.shots_against}
              </span>
            </div>

            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Power Play</span>
              <span className={styles.detailValue}>
                {(selectedGame.power_play_pct * 100).toFixed(1)}%
              </span>
            </div>

            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Penalty Kill</span>
              <span className={styles.detailValue}>
                {(selectedGame.penalty_kill_pct * 100).toFixed(1)}%
              </span>
            </div>

            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Faceoffs</span>
              <span className={styles.detailValue}>
                {(selectedGame.faceoff_win_pct * 100).toFixed(1)}%
              </span>
            </div>

            <div className={styles.detailStat}>
              <span className={styles.detailLabel}>Performance</span>
              <span
                className={`${styles.detailValue} ${getPerformanceClass(getPerformanceScore(selectedGame))}`}
              >
                {getPerformanceScore(selectedGame) >= 2
                  ? "Excellent"
                  : getPerformanceScore(selectedGame) >= 0
                    ? "Good"
                    : getPerformanceScore(selectedGame) >= -2
                      ? "Poor"
                      : "Terrible"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
