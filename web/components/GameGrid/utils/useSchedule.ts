import { useEffect, useState } from "react";
import { useTeams } from "../contexts/GameGridContext";
import { getSchedule } from "lib/NHL/client";
import { format, nextMonday } from "date-fns";
import { WeekData } from "lib/NHL/types";

export type ScheduleArray = (WeekData & { teamId: number })[];

export default function useSchedule(
  start: string,
  extended = false
): [ScheduleArray, number[], boolean] {
  const [loading, setLoading] = useState(false);
  const [scheduleArray, setScheduleArray] = useState<ScheduleArray>([]);
  const [numGamesPerDay, setNumGamesPerDay] = useState<number[]>([]);
  const allTeams = useTeams();

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      const schedule = await getSchedule(start);
      const nextMon = format(nextMonday(new Date(start)), "yyyy-MM-dd");
      const nextWeekSchedule = await getSchedule(nextMon);

      if (!ignore) {
        if (extended) {
          schedule.numGamesPerDay = [
            ...schedule.numGamesPerDay,
            ...nextWeekSchedule.numGamesPerDay.slice(0, 3),
          ];
          Object.entries(nextWeekSchedule.data).forEach(([id, weekData]) => {
            schedule.data[Number(id)].nMON = weekData.MON;
            schedule.data[Number(id)].nTUE = weekData.TUE;
            schedule.data[Number(id)].nWED = weekData.WED;
          });
        }
        const paddedTeams = { ...schedule.data };

        // add other teams even they are not playing
        Object.keys(allTeams).forEach((id) => {
          const exist = paddedTeams[Number(id)] !== undefined;
          if (!exist) {
            paddedTeams[Number(id)] = {};
          }
        });

        const result = Object.entries(paddedTeams).map(
          ([teamId, weekData]) => ({
            teamId: Number(teamId),
            ...weekData,
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
  }, [start, allTeams, extended]);

  return [scheduleArray, numGamesPerDay, loading];
}
