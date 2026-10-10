import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { addDays, format, parseISO } from "date-fns";
import { DAYS, EXTENDED_DAYS, WeekData, GameData, Team, ScheduleData } from "lib/NHL/types";
import { isRegularScheduleGame, getRegularGamesPerDay } from "./helper";
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
export type SelectedScheduleCoverage = {
  coveredDates: string[];
  coverage: { known: number; expected: number };
  retrievedAtByDate?: Record<string, string>;
  error: string | null;
};

export default function useSchedule(
  start: string,
  extended = false
): [ScheduleArray, number[], boolean, SelectedScheduleCoverage] {
  const [loading, setLoading] = useState(false);
  const [scheduleArray, setScheduleArray] = useState<ScheduleArray>([]);
  const [numGamesPerDay, setNumGamesPerDay] = useState<number[]>([]);
  const key = `${start}/${extended ? 10 : 7}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [calendar, setCalendar] = useState<SelectedScheduleCoverage>({
    coveredDates: [], coverage: { known: 0, expected: extended ? 10 : 7 }, error: null
  });

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
      const nextMon = format(addDays(parseISO(start), 7), "yyyy-MM-dd");
      const nextWeekSchedule = extended ? await getSchedule(nextMon) : null;

      if (!ignore) {
        if (
          !schedule ||
          !schedule.data ||
          !Array.isArray(schedule.numGamesPerDay) ||
          (extended && (!nextWeekSchedule?.data || !Array.isArray(nextWeekSchedule.numGamesPerDay)))
        ) {
          throw new Error("Schedule payload was missing expected shape.");
        }

        const days = extended ? EXTENDED_DAYS : DAYS;
        const dates = days.map((_, i) => format(addDays(parseISO(start), i), "yyyy-MM-dd"));
        const windows = nextWeekSchedule ? [schedule, nextWeekSchedule] : [schedule];
        const coveredDates = [...new Set(windows.flatMap((window) => window.coveredDates ?? []))]
          .filter((date) => dates.includes(date));
        const retrievedAtByDate: Record<string, string> = {};
        windows.forEach((window) => {
          if (!window.retrievedAt || !Number.isFinite(Date.parse(window.retrievedAt))) return;
          (window.coveredDates ?? []).filter((date) => dates.includes(date)).forEach((date) => {
            retrievedAtByDate[date] = window.retrievedAt!;
          });
        });
        const uniqueGames = new Map<number, GameData>();
        windows.forEach((window) => Object.values(window.data).forEach((row) => Object.values(row).forEach((game) => {
          if (!game) return;
          if (!Number.isFinite(game.id) || game.id <= 0 || !game.gameDate ||
              !/^\d{4}-\d{2}-\d{2}$/.test(game.gameDate) || Number.isNaN(parseISO(game.gameDate).getTime()) ||
              !Number.isFinite(game.homeTeam.id) || !Number.isFinite(game.awayTeam.id) ||
              game.homeTeam.id <= 0 || game.awayTeam.id <= 0 || game.homeTeam.id === game.awayTeam.id) {
            throw new Error("Schedule game identity or date is incomplete.");
          }
          if (!dates.includes(game.gameDate)) return;
          const previous = uniqueGames.get(game.id);
          if (previous && isRegularScheduleGame(previous) && !isRegularScheduleGame(game)) return;
          if (previous && isRegularScheduleGame(previous) && isRegularScheduleGame(game) &&
              (previous.gameDate !== game.gameDate || previous.homeTeam.id !== game.homeTeam.id || previous.awayTeam.id !== game.awayTeam.id)) {
            throw new Error("Schedule game identity had conflicting dates or teams.");
          }
          uniqueGames.set(game.id, game);
        })));
        const paddedTeams: Record<number, WeekData> = {};
        uniqueGames.forEach((game) => {
          const day = days[dates.indexOf(game.gameDate!)];
          [game.homeTeam.id, game.awayTeam.id].forEach((teamId) => {
            paddedTeams[teamId] ??= {};
            if (paddedTeams[teamId][day] && paddedTeams[teamId][day]!.id !== game.id) {
              throw new Error("Schedule has conflicting games for one team and date.");
            }
            paddedTeams[teamId][day] = game;
          });
        });

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
        setNumGamesPerDay(getRegularGamesPerDay(result, days));
        setCalendar({ coveredDates, retrievedAtByDate, coverage: { known: coveredDates.length, expected: days.length }, error: null });
        setLoadedKey(key);
        setLoading(false);
      }
    })().catch((error) => {
      console.error("Error fetching schedule:", error);
      if (!ignore) {
        setScheduleArray([]);
        setNumGamesPerDay([]);
        setCalendar({ coveredDates: [], coverage: { known: 0, expected: extended ? 10 : 7 }, error: error instanceof Error ? error.message : "Schedule unavailable." });
        setLoadedKey(key);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [start, extended, key]);

  const current = loadedKey === key;
  return [current ? scheduleArray : [], current ? numGamesPerDay : [], !current || loading,
    current ? calendar : { coveredDates: [], coverage: { known: 0, expected: extended ? 10 : 7 }, error: null }];
}
