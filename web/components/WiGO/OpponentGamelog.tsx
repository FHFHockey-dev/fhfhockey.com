// components/WiGO/OpponentGamelog.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseISO, format, isToday, isTomorrow } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz"; // For timezone handling
import Fetch from "lib/cors-fetch";

import { getTeamAbbreviationById } from "lib/teamsInfo";
import styles from "./OpponentGameLog.module.scss";

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

const OpponentGamelog: React.FC<OpponentGamelogProps> = ({
  teamId,
  seasonId,
  highlightColor = "#07aae2"
}) => {
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
      typeof seasonId === "number"
  });

  // Data processing logic remains the same
  const { gamesToShow, nextGameIndexOverall } = useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return { gamesToShow: [], nextGameIndexOverall: -1 };
    }

    let nextGameIdx = schedule.findIndex(
      (game) => game.gameState !== "FINAL" && game.gameState !== "OFF"
    );

    if (nextGameIdx === -1) {
      nextGameIdx = schedule.length > 0 ? schedule.length - 1 : 0;
    }

    const startIndex = Math.max(0, nextGameIdx - 5);
    const endIndex = Math.min(schedule.length, nextGameIdx + 5);

    const gamesSlice = schedule.slice(startIndex, endIndex);

    return { gamesToShow: gamesSlice, nextGameIndexOverall: nextGameIdx };
  }, [schedule]);

  // Opponent display logic remains the same
  const getOpponentDisplay = (game: ApiGame, currentTeamId: number): string => {
    const isHome = game.homeTeam.id === currentTeamId;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    return `${isHome ? "vs." : "@"} ${opponent.abbrev}`;
  };

  // --- Updated formatting functions using date-fns ---

  const getResultDisplay = (game: ApiGame, currentTeamId: number): string => {
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
        const fallbackDate = parseISO(game.startTimeUTC);
        return format(fallbackDate, "h:mm a"); // Format in UTC as fallback
      }
    }
  };

  const formatDate = (startTimeUTC: string): string => {
    try {
      // Convert UTC ISO string to a Date object representing the *local* time
      const gameDateLocal = toZonedTime(startTimeUTC, localTimeZone);

      if (isToday(gameDateLocal)) return "Today";
      if (isTomorrow(gameDateLocal)) return "Tomorrow";
      return format(gameDateLocal, "EEE, MMM d"); // e.g., Mon, Sep 23
    } catch (err) {
      console.error("Error formatting date:", err, startTimeUTC, localTimeZone);
      // Fallback if parsing/conversion fails
      const fallbackDate = parseISO(startTimeUTC);
      return format(fallbackDate, "yyyy-MM-dd"); // Basic fallback
    }
  };

  // ---- Rendering (mostly the same) ----
  if (!teamId) {
    return (
      <div className={styles.opponentLogContainer}>
        Select a player to see their schedule.
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className={styles.opponentLogContainer}>Loading season info...</div>
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
      <table className={styles.scheduleTable}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {gamesToShow.map((game) => {
            const isNextGame = schedule.indexOf(game) === nextGameIndexOverall;
            const rowStyle = isNextGame
              ? { backgroundColor: highlightColor, color: "#fff" }
              : {};

            return (
              <tr key={game.id} style={rowStyle}>
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
