import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { format, nextMonday, parseISO } from "date-fns";
import { WeekData, EXTENDED_DAY_ABBREVIATION } from "lib/NHL/types";
import supabase from "lib/supabase";

export type ScheduleArray = (WeekData & { teamId: number })[];

export default function useSchedule(
  start: string,
  extended = false
): [ScheduleArray, number[], boolean] {
  const [loading, setLoading] = useState(false);
  const [scheduleArray, setScheduleArray] = useState<ScheduleArray>([]);
  const [numGamesPerDay, setNumGamesPerDay] = useState<number[]>([]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      // Fetch schedule for the selected week
      const schedule = await getSchedule(start);
      // Fetch season-active teams (prevents padding with retired teams like ARI)
      const seasonTeams = await getTeams();
      // Safety: if API/DB has duplicate franchise entries with same abbreviation,
      // keep the higher teamId (e.g., prefer UTA 68 over legacy 59)
      const preferredByAbbr = new Map<string, number>();
      seasonTeams.forEach((t) => {
        const prev = preferredByAbbr.get(t.abbreviation);
        if (prev === undefined || t.id > prev) preferredByAbbr.set(t.abbreviation, t.id);
      });
      const nextMon = format(nextMonday(parseISO(start)), "yyyy-MM-dd");
      const nextWeekSchedule = await getSchedule(nextMon);

      if (!ignore) {
        if (extended) {
          schedule.numGamesPerDay = [
            ...schedule.numGamesPerDay,
            ...nextWeekSchedule.numGamesPerDay.slice(0, 3)
          ];
          Object.entries(nextWeekSchedule.data).forEach(([id, weekData]) => {
            const playedLastWeek = schedule.data[Number(id)] !== undefined;
            if (!playedLastWeek) {
              schedule.data[Number(id)] = {};
            }
            schedule.data[Number(id)].nMON = weekData.MON;
            schedule.data[Number(id)].nTUE = weekData.TUE;
            schedule.data[Number(id)].nWED = weekData.WED;
          });
        }

        // Explicitly type paddedTeams
        const paddedTeams: Record<number, WeekData> = { ...schedule.data };

        // Add other season-active teams even if they are not playing this week
        // This ensures bye weeks still appear, while excluding defunct teams
        seasonTeams.forEach((team) => {
          const preferredId = preferredByAbbr.get(team.abbreviation);
          if (team.id !== preferredId) return; // skip non-preferred duplicate
          if (paddedTeams[team.id] === undefined) {
            paddedTeams[team.id] = {};
          }
        });

        // Collect all game IDs
        const gameIds: number[] = [];
        for (const teamData of Object.values(paddedTeams) as WeekData[]) {
          for (const day of Object.keys(
            teamData
          ) as EXTENDED_DAY_ABBREVIATION[]) {
            const game = teamData[day];
            if (game && game.id) {
              gameIds.push(game.id);
            }
          }
        }

        // Fetch win odds from 'expected_goals' table
        const { data: oddsData, error } = await supabase
          .from("expected_goals")
          .select(
            "game_id, home_win_odds, away_win_odds, home_api_win_odds, away_api_win_odds"
          )
          .in("game_id", gameIds);

        if (error) {
          console.error("Error fetching win odds data:", error);
        }

        // Map odds data by game_id
        const oddsByGameId = (oddsData || []).reduce(
          (acc, item) => {
            acc[item.game_id] = item;
            return acc;
          },
          {} as Record<number, any>
        );

        // Assign win odds to each game
        for (const teamData of Object.values(paddedTeams) as WeekData[]) {
          for (const day of Object.keys(
            teamData
          ) as EXTENDED_DAY_ABBREVIATION[]) {
            const game = teamData[day];
            if (game && game.id) {
              const odds = oddsByGameId[game.id];
              if (odds) {
                game.homeTeam.winOdds = odds.home_win_odds;
                game.awayTeam.winOdds = odds.away_win_odds;
                game.homeTeam.apiWinOdds = odds.home_api_win_odds;
                game.awayTeam.apiWinOdds = odds.away_api_win_odds;
              } else {
                // Set default values if odds are missing
                game.homeTeam.winOdds = null;
                game.awayTeam.winOdds = null;
                game.homeTeam.apiWinOdds = null;
                game.awayTeam.apiWinOdds = null;
              }
            }
          }
        }

        const result = Object.entries(paddedTeams).map(
          ([teamId, weekData]) => ({
            teamId: Number(teamId),
            ...weekData
          })
        );

        setScheduleArray(result);
        setNumGamesPerDay(schedule.numGamesPerDay);
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      setLoading(false);
    };
  }, [start, extended]);

  return [scheduleArray, numGamesPerDay, loading];
}
