// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\useFourWeekSchedule.ts

import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { addDays, format, parseISO, startOfISOWeek } from "date-fns";
import {
  DAYS,
  GameData,
  ScheduleData,
  WeekData,
  ExtendedWeekData
} from "lib/NHL/types";
import {
  createExtendedWeekData, // Ensure this is imported
  getRegularGamesPerDay,
  isRegularScheduleGame
} from "./helper";
import { getTeamScheduleSummary } from "./scheduleSummary";

export type ScheduleArray = ExtendedWeekData[];

export type FourWeekCalendar = {
  start: string;
  end: string;
  knownDays: number;
  expectedDays: number;
  error: string | null;
};

/** Rebuild membership from actual dates and canonical identities, not stale weekday slots. */
export function normalizeCalendarWeek(schedule: ScheduleData, start: string) {
  const dates = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(start), i), "yyyy-MM-dd"));
  const covered = new Set((schedule.coveredDates ?? []).filter((date) => dates.includes(date)));
  const games = new Map<number, GameData>();
  let valid = true;
  Object.values(schedule.data).forEach((row) => Object.values(row).forEach((game) => {
    if (!game || game.gameType !== 2) return;
    if (!Number.isFinite(game.id) || game.id <= 0 || !game.gameDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(game.gameDate) || Number.isNaN(parseISO(game.gameDate).getTime()) ||
        !Number.isFinite(game.homeTeam.id) || !Number.isFinite(game.awayTeam.id) ||
        game.homeTeam.id <= 0 || game.awayTeam.id <= 0 || game.homeTeam.id === game.awayTeam.id) {
      valid = false;
      return;
    }
    if (!isRegularScheduleGame(game) || !dates.includes(game.gameDate) || !covered.has(game.gameDate)) return;
    const previous = games.get(game.id);
    if (previous && (previous.gameDate !== game.gameDate ||
        previous.homeTeam.id !== game.homeTeam.id || previous.awayTeam.id !== game.awayTeam.id)) {
      valid = false;
      return;
    }
    games.set(game.id, game);
  }));
  const data: Record<number, WeekData> = {};
  if (valid) games.forEach((game) => {
    const day = DAYS[dates.indexOf(game.gameDate!)];
    [game.homeTeam.id, game.awayTeam.id].forEach((teamId) => {
      data[teamId] ??= {};
      if (data[teamId][day] && data[teamId][day]!.id !== game.id) valid = false;
      data[teamId][day] = game;
    });
  });
  return { data: valid ? data : {}, coverage: { known: valid ? covered.size : 0, expected: 7 } };
}

/**
 * Custom hook to fetch and manage schedule data for four weeks.
 *
 * @param start - The start date in 'yyyy-MM-dd' format.
 * @returns A tuple containing the schedule array, number of games per day, and loading state.
 */
export default function useFourWeekSchedule(start: string): [ScheduleArray, number[], boolean, FourWeekCalendar] {
  const [loading, setLoading] = useState(false);
  const [scheduleArray, setScheduleArray] = useState<ScheduleArray>([]);
  const [numGamesPerDay, setNumGamesPerDay] = useState<number[]>([]);
  const [calendar, setCalendar] = useState<FourWeekCalendar>({ start: "", end: "", knownDays: 0, expectedDays: 28, error: null });
  const [loadedStart, setLoadedStart] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        let currentStart = format(startOfISOWeek(parseISO(start)), "yyyy-MM-dd");
        const calendarStart = currentStart;
        const weeksToFetch = 4; // Total of four weeks
        const aggregatedSchedule: ScheduleArray = [];
        let aggregatedNumGamesPerDay: number[] = [];
        let knownDays = 0;
        const gameDates = new Map<number, string>();

        // Fetch the set of season-active teams once (avoid retired teams)
        const seasonTeams = await getTeams();
        // Safety: prefer highest id per abbreviation (e.g., UTA 68 over 59)
        const preferredByAbbr = new Map<string, number>();
        seasonTeams.forEach((t) => {
          const prev = preferredByAbbr.get(t.abbreviation);
          if (prev === undefined || t.id > prev) preferredByAbbr.set(t.abbreviation, t.id);
        });

        for (let week = 1; week <= weeksToFetch; week++) {
          const schedule = await getSchedule(currentStart);
          if (
            !schedule ||
            !schedule.data ||
            !Array.isArray(schedule.numGamesPerDay)
          ) {
            throw new Error("Schedule payload was missing expected shape.");
          }

          const normalized = normalizeCalendarWeek(schedule, currentStart);
          knownDays += normalized.coverage.known;
          Object.values(normalized.data).forEach((row) => Object.values(row).forEach((game) => {
            if (!game) return;
            const previousDate = gameDates.get(game.id);
            if (previousDate && previousDate !== game.gameDate) throw new Error("Schedule game identity had conflicting dates.");
            gameDates.set(game.id, game.gameDate!);
          }));
          const regularNumGamesPerDay = getRegularGamesPerDay(Object.values(normalized.data), DAYS);

          // Ensure all season-active teams are included, even if they have no games this week
          const paddedTeams: Record<number, WeekData> = { ...normalized.data };
          seasonTeams.forEach((team) => {
            const preferredId = preferredByAbbr.get(team.abbreviation);
            if (team.id !== preferredId) return; // skip non-preferred duplicate
            if (!paddedTeams[team.id]) {
              paddedTeams[team.id] = {};
            }
          });

          // Aggregate the schedule data
          const result = Object.entries(paddedTeams).map(
            ([teamId, weekData]) => {
              // Calculate totalGamesPlayed, totalOffNights, and weekScore for each team
              const { totalGamesPlayed, totalOffNights, weekScore } = getTeamScheduleSummary(
                { ...weekData, teamId: Number(teamId) }, regularNumGamesPerDay, [], DAYS
              );

              // **Use Helper Function to Create ExtendedWeekData**
              const extendedWeekData = createExtendedWeekData(
                Number(teamId),
                week,
                weekData,
                totalGamesPlayed,
                totalOffNights,
                weekScore
              );

              return { ...extendedWeekData, scheduleCoverage: normalized.coverage };
            }
          );

          aggregatedSchedule.push(...result);
          aggregatedNumGamesPerDay = [
            ...aggregatedNumGamesPerDay,
            ...regularNumGamesPerDay
          ];

          // Prepare for next week
          currentStart = format(
            addDays(parseISO(currentStart), 7),
            "yyyy-MM-dd"
          );
        }

        // Filter out teams that have zero games across the entire 4-week span
        const totalGamesByTeam = new Map<number, number>();
        for (const row of aggregatedSchedule) {
          totalGamesByTeam.set(
            row.teamId,
            (totalGamesByTeam.get(row.teamId) ?? 0) + (row.totalGamesPlayed ?? 0)
          );
        }
        const filteredAggregated = aggregatedSchedule.filter(
          (row) => (totalGamesByTeam.get(row.teamId) ?? 0) > 0 || knownDays < 28
        );

        if (!ignore) {
          setScheduleArray(filteredAggregated);
          setNumGamesPerDay(aggregatedNumGamesPerDay);
          setLoading(false);
          setCalendar({ start: calendarStart, end: format(addDays(parseISO(calendarStart), 27), "yyyy-MM-dd"), knownDays, expectedDays: 28, error: null });
          setLoadedStart(start);
        }
      } catch (error) {
        console.error("Error fetching schedules:", error);
        if (!ignore) {
          setScheduleArray([]);
          setNumGamesPerDay([]);
          setLoading(false);
          setCalendar({ start: "", end: "", knownDays: 0, expectedDays: 28, error: "Four-week schedule is temporarily unavailable." });
          setLoadedStart(start);
        }
      }
    })();

    return () => {
      ignore = true;
      setLoading(false);
    };
  }, [start]);

  if (loadedStart !== start) {
    let pendingStart = "";
    let pendingEnd = "";
    try {
      pendingStart = format(startOfISOWeek(parseISO(start)), "yyyy-MM-dd");
      pendingEnd = format(addDays(parseISO(pendingStart), 27), "yyyy-MM-dd");
    } catch { /* The effect reports invalid dates through calendar.error. */ }
    return [[], [], true, { start: pendingStart, end: pendingEnd, knownDays: 0, expectedDays: 28, error: null }];
  }
  return [scheduleArray, numGamesPerDay, loading, calendar];
}
