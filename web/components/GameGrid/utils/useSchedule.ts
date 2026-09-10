import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { format, nextMonday, parseISO } from "date-fns";
import { WeekData, GameData, Team, ScheduleData } from "lib/NHL/types";
import { shiftScheduleDate } from "lib/draftDashboard/scheduleMetrics";

const rangeWindows = new Map<string, { expires: number; promise: Promise<ScheduleData> }>();
function loadRangeWindow(start: string) {
  const existing = rangeWindows.get(start);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const promise = getSchedule(start, { includeOdds: false }).catch((error) => {
    rangeWindows.delete(start);
    throw error;
  });
  rangeWindows.set(start, { expires: Date.now() + 300_000, promise });
  return promise;
}

/** Date-aware multiweek companion; leaves the GameGrid tuple contract unchanged. */
export function useScheduleRange(start?: string, end?: string) {
  const key = start && end ? `${start}/${end}` : "";
  const [state, setState] = useState<{
    key: string; games: GameData[]; teams: Team[];
    status: "loading" | "ready" | "error"; error: string | null;
  }>({ key: "", games: [], teams: [], status: "loading", error: null });
  useEffect(() => {
    if (!start || !end) return;
    let ignore = false;
    setState({ key, games: [], teams: [], status: "loading", error: null });
    void (async () => {
      const first = shiftScheduleDate(start, -1);
      const starts: string[] = [];
      for (let date = first; date <= end; date = shiftScheduleDate(date, 7)) starts.push(date);
      const windows: ScheduleData[] = [];
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, starts.length) }, async () => {
        while (cursor < starts.length) {
          const date = starts[cursor++];
          windows.push(await loadRangeWindow(date));
        }
      }));
      const coverage = new Set(windows.flatMap((window) => window.coveredDates ?? []));
      for (let date = first; date <= end; date = shiftScheduleDate(date, 1)) {
        if (!coverage.has(date)) throw new Error("The NHL schedule does not yet cover this date range.");
      }
      const games = windows.flatMap((window) => Object.values(window.data).flatMap((team) =>
        Object.values(team).filter((game): game is GameData => Boolean(game))));
      if (games.some((game) => !game.gameDate)) throw new Error("Schedule dates are incomplete.");
      if (!games.some((game) => game.gameType === 2 && game.gameDate! >= start && game.gameDate! <= end)) {
        throw new Error("Regular-season schedule data is not yet available for this range.");
      }
      const teams = await getTeams();
      if (!ignore) setState({ key, games: [...new Map(games.map((game) => [game.id, game])).values()], teams, status: "ready", error: null });
    })().catch((error: unknown) => {
      if (!ignore) setState({ key, games: [], teams: [], status: "error", error: error instanceof Error ? error.message : "Schedule unavailable." });
    });
    return () => { ignore = true; };
  }, [start, end, key]);
  return state.key === key ? state : { ...state, games: [], teams: [], status: "loading" as const, error: null };
}

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
