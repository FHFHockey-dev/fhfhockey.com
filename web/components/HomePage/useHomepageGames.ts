import { useEffect, useMemo, useState } from "react";
import moment from "moment";

import Fetch from "lib/cors-fetch";

type UseHomepageGamesArgs = {
  initialGames: any[];
  nextGameDate: string;
};

export function useHomepageGames({
  initialGames,
  nextGameDate
}: UseHomepageGamesArgs) {
  const todayDate = moment().format("YYYY-MM-DD");
  const [currentDate, setCurrentDate] = useState(todayDate);
  const [games, setGames] = useState(
    currentDate === nextGameDate ? initialGames : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    currentDate === nextGameDate ? new Date().toISOString() : null
  );

  useEffect(() => {
    let cancelled = false;

    const fetchGamesForDate = async () => {
      try {
        if (!cancelled) {
          setLoading(true);
          setError(null);
        }
        const res = await fetch(`/api/v1/games?date=${currentDate}`);
        if (!res.ok) {
          throw new Error(`Slate request failed (${res.status}).`);
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          if (!cancelled) {
            setGames([]);
            setLastUpdatedAt(new Date().toISOString());
          }
          return;
        }

        const liveGamePromises = data
          .filter((game) => game.gameState === "LIVE")
          .map(async (game) => {
            const liveDataResponse = await Fetch(
              `https://api-web.nhle.com/v1/gamecenter/${game.id}/landing`
            );
            const liveData = await liveDataResponse.json();

            return {
              id: game.id,
              clock: liveData.clock || null,
              periodDescriptor: liveData.periodDescriptor || null
            };
          });

        const liveGamesData = await Promise.all(liveGamePromises);

        const updatedGames = data.map((game) => {
          const overlay = liveGamesData.find((liveGame) => liveGame.id === game.id);
          if (overlay) {
            return {
              ...game,
              clock:
                overlay.clock ||
                game.clock ||
                (typeof game.timeRemaining === "string" ||
                typeof game.inIntermission === "boolean"
                  ? {
                      timeRemaining: game.timeRemaining,
                      inIntermission: game.inIntermission
                    }
                  : null),
              periodDescriptor:
                overlay.periodDescriptor ||
                game.periodDescriptor ||
                (game.period || game.periodType
                  ? { number: game.period, periodType: game.periodType }
                  : null)
            };
          }

          const clockFromSchedule =
            typeof game.timeRemaining === "string" ||
            typeof game.inIntermission === "boolean"
              ? {
                  timeRemaining: game.timeRemaining,
                  inIntermission: game.inIntermission
                }
              : null;
          const periodDescriptorFromSchedule =
            game.periodDescriptor ||
            (game.period || game.periodType
              ? { number: game.period, periodType: game.periodType }
              : null);

          return {
            ...game,
            clock: game.clock || clockFromSchedule || null,
            periodDescriptor: periodDescriptorFromSchedule || null
          };
        });

        let gamesWithRecords = updatedGames;
        try {
          const standingsNowResp = await Fetch(
            "https://api-web.nhle.com/v1/standings/now"
          );
          const standingsNow = await standingsNowResp.json();
          const recordsByAbbrev: Record<string, string> = {};

          if (standingsNow && Array.isArray(standingsNow.standings)) {
            standingsNow.standings.forEach((row: any) => {
              const abbr = row?.teamAbbrev?.default;
              const wins = row?.wins ?? 0;
              const losses = row?.losses ?? 0;
              const otl = row?.otLosses ?? 0;
              if (abbr) recordsByAbbrev[abbr] = `${wins}-${losses}-${otl}`;
            });
          }

          gamesWithRecords = updatedGames.map((game: any) => {
            const homeAbbrev = game?.homeTeam?.abbrev;
            const awayAbbrev = game?.awayTeam?.abbrev;
            const homeRecord =
              typeof game?.homeTeam?.record === "string" && game.homeTeam.record
                ? game.homeTeam.record
                : homeAbbrev
                  ? recordsByAbbrev[homeAbbrev] || ""
                  : "";
            const awayRecord =
              typeof game?.awayTeam?.record === "string" && game.awayTeam.record
                ? game.awayTeam.record
                : awayAbbrev
                  ? recordsByAbbrev[awayAbbrev] || ""
                  : "";

            return {
              ...game,
              homeTeam: { ...game.homeTeam, record: homeRecord },
              awayTeam: { ...game.awayTeam, record: awayRecord }
            };
          });
        } catch (error) {
          console.warn("standings/now fetch failed; records may be missing", error);
        }

        if (!cancelled) {
          setGames(gamesWithRecords);
          setLastUpdatedAt(new Date().toISOString());
        }
      } catch (error) {
        console.error("Error fetching homepage games:", error);
        if (!cancelled) {
          setError(
            error instanceof Error ? error.message : "Unable to refresh the slate."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchGamesForDate();

    return () => {
      cancelled = true;
    };
  }, [currentDate]);

  const gamesHeaderText = useMemo(() => {
    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
    const tomorrow = moment().add(1, "days").format("YYYY-MM-DD");

    if (currentDate === today) return "Today's";
    if (currentDate === yesterday) return "Yesterday's";
    if (currentDate === tomorrow) return "Tomorrow's";
    return "Upcoming";
  }, [currentDate]);

  const changeDate = (days: number) => {
    setCurrentDate((prevDate) =>
      moment(prevDate).add(days, "days").format("YYYY-MM-DD")
    );
  };

  return {
    currentDate,
    games,
    gamesHeaderText,
    changeDate,
    loading,
    error,
    lastUpdatedAt
  };
}
