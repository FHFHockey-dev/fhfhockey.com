import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { format, nextMonday, parseISO } from "date-fns";
import { WeekData } from "lib/NHL/types";

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

        if (
          !schedule ||
          !schedule.data ||
          !Array.isArray(schedule.numGamesPerDay) ||
          !nextWeekSchedule ||
          !nextWeekSchedule.data ||
          !Array.isArray(nextWeekSchedule.numGamesPerDay)
        ) {
          throw new Error("Schedule payload was missing expected shape.");
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
    })().catch((error) => {
      console.error("Error fetching schedule:", error);
      if (!ignore) {
        setScheduleArray([]);
        setNumGamesPerDay([]);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
      setLoading(false);
    };
  }, [start, extended]);

  return [scheduleArray, numGamesPerDay, loading];
}
