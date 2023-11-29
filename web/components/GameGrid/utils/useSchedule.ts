import { useEffect, useState } from "react";
import { WeekData } from "pages/api/v1/schedule/[startDate]";
import { useTeams } from "../contexts/GameGridContext";
import { getSchedule } from "lib/NHL/client";

export type ScheduleArray = (WeekData & { teamId: number })[];

export default function useSchedule(
  start: string
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
      if (!ignore) {
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
  }, [start, allTeams]);

  return [scheduleArray, numGamesPerDay, loading];
}
