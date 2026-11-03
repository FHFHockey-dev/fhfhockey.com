// components/WiGO/OpponentGamelog.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz"; // For timezone handling
import Fetch from "lib/cors-fetch";

import { getTeamAbbreviationById } from "lib/teamsInfo";
import styles from "./OpponentGameLog.module.scss";
import { useSeasonPendingMessage } from "hooks/useCurrentSeason";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

// Define the structure of a game object from the API (same as before)
interface ApiGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string; // "YYYY-MM-DD"
  startTimeUTC: string; // ISO 8601 format
  gameState: "FINAL" | "LIVE" | "CRIT" | "FUT" | "OFF" | "PRE";
  gameScheduleState: string;
  awayTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  venue?: {
    default: string;
  };
  periodDescriptor?: {
    periodType?: string;
  };
  gameOutcome?: {
    lastPeriodType?: string;
  };
}

interface OpponentGamelogProps {
  teamId: number | null | undefined;
  seasonId?: number | null;
  highlightColor?: string;
  /** A player is selected; without a team that means no current team (A-05). */
  hasPlayer?: boolean;
}

// Helper to get user's local timezone
const getLocalTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    // Fallback if Intl API is not available or fails
    console.warn("Could not detect local timezone, falling back to UTC.");
    return "UTC";
  }
};

const LIVE_POLL_MS = 30_000;
const GAME_DAY_POLL_MS = 300_000;
const HOUR_MS = 3_600_000;

/**
 * Poll the schedule only around a game: every 30 s while one is live, every
 * 5 min when an unfinished game starts within 18 h or began within 6 h, and
 * not at all otherwise (S3: it polled every 5 min forever, D-05).
 */
export function getScheduleRefetchInterval(
  games: ApiGame[] | undefined,
  now: number = Date.now()
): number | false {
  if (!games?.length) return false;
  if (games.some((game) => ["LIVE", "CRIT"].includes(game.gameState))) {
    return LIVE_POLL_MS;
  }
  const gameDay = games.some((game) => {
    if (["OFF", "FINAL"].includes(game.gameState)) return false;
    if (["PPD", "CNCL", "CANCELLED"].includes(game.gameScheduleState)) return false;
    const start = Date.parse(game.startTimeUTC);
    return Number.isFinite(start) && start - now <= 18 * HOUR_MS && now - start <= 6 * HOUR_MS;
  });
  return gameDay ? GAME_DAY_POLL_MS : false;
}

const OpponentGamelog: React.FC<OpponentGamelogProps> = ({
  teamId,
  seasonId,
  highlightColor = "#07aae2",
  hasPlayer = false
}) => {
  const seasonPending = useSeasonPendingMessage();
  const [localTimeZone, setLocalTimeZone] = useState<string>("UTC"); // Initialize with UTC
  const teamAbbreviation = useMemo(
    () => (teamId ? getTeamAbbreviationById(teamId) : null),
    [teamId]
  );

  // Determine local timezone once on component mount
  useEffect(() => {
    setLocalTimeZone(getLocalTimeZone());
  }, []);

  const {
    data: schedule = [],
    isLoading,
    error
  } = useQuery<ApiGame[]>({
    queryKey: ["wigoTeamSchedule", teamAbbreviation, seasonId],
    queryFn: async () => {
      const url = `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbreviation}/${seasonId}`;
      const response = await Fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.games || [];
    },
    enabled:
      typeof teamId === "number" &&
      Boolean(teamAbbreviation) &&
      typeof seasonId === "number",
    ...WIGO_QUERY_DEFAULTS,
    refetchInterval: (query) => getScheduleRefetchInterval(query.state.data)
  });

  // Data processing logic remains the same
  const { gamesToShow, nextGameId } = useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return { gamesToShow: [], nextGameId: null };
    }

    // Include preseason, regular season and playoffs for the selected team.
    const games = [...new Map(schedule.filter(game =>
      game.season === seasonId && [1, 2, 3].includes(game.gameType) &&
      (game.homeTeam.id === teamId || game.awayTeam.id === teamId)
    ).map(game => [game.id, game])).values()].sort((a, b) =>
      (a.startTimeUTC || a.gameDate).localeCompare(b.startTimeUTC || b.gameDate) || a.id - b.id
    );
    const nextGameIdx = games.findIndex(game =>
      ["FUT", "PRE", "LIVE", "CRIT"].includes(game.gameState) &&
      !["PPD", "CNCL", "CANCELLED"].includes(game.gameScheduleState)
    );
    const anchor = nextGameIdx === -1 ? games.length - 1 : nextGameIdx;
    const gamesSlice = games.slice(Math.max(0, anchor - 5), Math.min(games.length, anchor + 5));

    return { gamesToShow: gamesSlice, nextGameId: nextGameIdx === -1 ? null : games[nextGameIdx].id };
  }, [schedule, teamId, seasonId]);

  // Opponent display logic remains the same
  const getOpponentDisplay = (game: ApiGame, currentTeamId: number): string => {
    const isHome = game.homeTeam.id === currentTeamId;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    return `${isHome ? "vs." : "@"} ${opponent.abbrev}`;
  };

  // --- Updated formatting functions using date-fns ---

  const getResultDisplay = (game: ApiGame, currentTeamId: number): string => {
    if (game.gameScheduleState === "PPD") return "Postponed";
    if (["CNCL", "CANCELLED"].includes(game.gameScheduleState)) return "Cancelled";
    if (["LIVE", "CRIT"].includes(game.gameState)) {
      const home = game.homeTeam.id === currentTeamId;
      const own = home ? game.homeTeam.score : game.awayTeam.score;
      const other = home ? game.awayTeam.score : game.homeTeam.score;
      return own != null && other != null ? `Live ${own}-${other}` : "Live";
    }
    if (game.gameState === "FINAL" || game.gameState === "OFF") {
      const isHome = game.homeTeam.id === currentTeamId;
      const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
      const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;

      if (typeof teamScore !== "number" || typeof opponentScore !== "number") {
        return "N/A";
      }

      let resultPrefix = "";
      if (teamScore > opponentScore) resultPrefix = "W";
      else if (teamScore < opponentScore) resultPrefix = "L";
      else resultPrefix = "T";

      const periodType = game.gameOutcome?.lastPeriodType;
      const suffix =
        periodType === "OT" || periodType === "SO" ? ` (${periodType})` : "";

      return `${resultPrefix} ${teamScore}-${opponentScore}${suffix}`;
    } else {
      // Future or Live game: show time in local timezone
      try {
        // startTimeUTC is like "2024-09-22T23:00:00Z"
        // We format it directly into the target timezone
        return formatInTimeZone(game.startTimeUTC, localTimeZone, "h:mm a"); // e.g., 7:00 PM
      } catch (err) {
        console.error(
          "Error formatting time:",
          err,
          game.startTimeUTC,
          localTimeZone
        );
        // Fallback if formatting fails
        return "Time TBD";
      }
    }
  };

  const formatDate = (startTimeUTC: string): string => {
    try {
      // Convert UTC ISO string to a Date object representing the *local* time
      const gameDateLocal = toZonedTime(startTimeUTC, localTimeZone);
      if (!Number.isFinite(gameDateLocal.getTime())) return "Date TBD";

      if (isToday(gameDateLocal)) return "Today";
      if (isTomorrow(gameDateLocal)) return "Tomorrow";
      return format(gameDateLocal, "EEE, MMM d"); // e.g., Mon, Sep 23
    } catch (err) {
      console.error("Error formatting date:", err, startTimeUTC, localTimeZone);
      // Fallback if parsing/conversion fails
      return "Date TBD";
    }
  };

  // ---- Rendering (mostly the same) ----
  if (!teamId) {
    return (
      <div className={`${styles.opponentLogContainer} ${styles.emptyPrompt}`}>
        {hasPlayer ? "No current team, so no team schedule." : "Select a player"}
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className={styles.opponentLogContainer}>{seasonPending}</div>
    );
  }

  if (!teamAbbreviation) {
    return (
      <div className={styles.opponentLogContainer}>
        Could not find team abbreviation.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.opponentLogContainer}>Loading schedule...</div>
    );
  }

  if (error) {
    return (
      <div className={styles.opponentLogContainer}>
        Failed to load game log.
      </div>
    );
  }

  if (gamesToShow.length === 0) {
    return (
      <div className={styles.opponentLogContainer}>
        No schedule data available for this team and season.
      </div>
    );
  }

  return (
    <div className={styles.opponentLogContainer}>
      <table className={styles.scheduleTable} aria-label={`${teamAbbreviation} team schedule; player participation is not guaranteed`}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {gamesToShow.map((game) => {
            const isNextGame = game.id === nextGameId;
            const rowStyle = isNextGame
              ? { backgroundColor: highlightColor, color: "#fff" }
              : {};

            return (
              <tr key={game.id} style={rowStyle} aria-current={isNextGame ? "true" : undefined}>
                {/* Pass startTimeUTC to formatDate now */}
                <td>{formatDate(game.startTimeUTC)}</td>
                <td>{getOpponentDisplay(game, teamId)}</td>
                <td>{getResultDisplay(game, teamId)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OpponentGamelog;
