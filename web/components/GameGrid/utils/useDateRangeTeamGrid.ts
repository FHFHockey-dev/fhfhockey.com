import { useEffect, useMemo, useState } from "react";
import { addDays, eachDayOfInterval, format, parseISO, startOfWeek } from "date-fns";

import { getSchedule } from "lib/NHL/client";
import { DAYS, GameData, WeekData } from "lib/NHL/types";
import { isRegularScheduleGame } from "./helper";

export type TeamDateGames = Record<number, Record<string, GameData>>;

/**
 * Per-team counts over the selected dates. Only regular-season games that are
 * not postponed or cancelled count toward off-nights, back-to-backs and
 * home/away (BC W1-12 A), the same definition as the weekly grid.
 */
export function summarizeTeamDateRange(
  dates: readonly string[],
  gamesByDate: Record<string, GameData>,
  dateMetaByDate: Record<string, { regularSeasonGames: number }>,
  sourceIdSet: ReadonlySet<number>
) {
  const off = dates.reduce((acc, d) => {
    const g = gamesByDate[d];
    const meta = dateMetaByDate[d];
    if (isRegularScheduleGame(g) && (meta?.regularSeasonGames ?? 0) <= 8) return acc + 1;
    return acc;
  }, 0);
  let b2b = 0;
  for (let i = 0; i < dates.length - 1; i++) {
    const a = gamesByDate[dates[i]];
    const b = gamesByDate[dates[i + 1]];
    if (isRegularScheduleGame(a) && isRegularScheduleGame(b)) b2b++;
  }
  let home = 0;
  let away = 0;
  dates.forEach((d) => {
    const g = gamesByDate[d];
    if (!isRegularScheduleGame(g)) return;
    if (sourceIdSet.has(g.homeTeam.id)) home++;
    if (sourceIdSet.has(g.awayTeam.id)) away++;
  });
  return { off, b2b, home, away };
}

export type DateMeta = {
  regularSeasonGames: number;
  isOffNight: boolean;
  isHeavyNight: boolean;
};

type DateRangeTeamGridState = {
  dates: string[];
  teamDateGames: TeamDateGames;
  dateMetaByDate: Record<string, DateMeta>;
  loading: boolean;
  error: string | null;
};

const OFF_NIGHT_THRESHOLD_GAMES = 8;
const HEAVY_NIGHT_THRESHOLD_GAMES = 9;

export default function useDateRangeTeamGrid(
  start?: string,
  end?: string
): DateRangeTeamGridState {
  const [state, setState] = useState<DateRangeTeamGridState>({
    dates: [],
    teamDateGames: {},
    dateMetaByDate: {},
    loading: false,
    error: null
  });

  const normalized = useMemo(() => {
    if (!start || !end) return null;
    try {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return null;
      }
      return { startDate, endDate };
    } catch {
      return null;
    }
  }, [start, end]);

  useEffect(() => {
    let ignore = false;
    if (!normalized) {
      setState((prev) => ({ ...prev, loading: false, error: null }));
      return;
    }

    const { startDate, endDate } = normalized;
    if (startDate > endDate) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Start date must be before end date."
      }));
      return;
    }

    const dateList = eachDayOfInterval({ start: startDate, end: endDate }).map((d) =>
      format(d, "yyyy-MM-dd")
    );

    const startMonday = startOfWeek(startDate, { weekStartsOn: 1 });
    const endMonday = startOfWeek(endDate, { weekStartsOn: 1 });
    const mondays: Date[] = [];
    for (let cursor = startMonday; cursor <= endMonday; cursor = addDays(cursor, 7)) {
      mondays.push(cursor);
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      dates: dateList
    }));

    (async () => {
      try {
        const responses = await Promise.all(
          mondays.map((monday) =>
            getSchedule(format(monday, "yyyy-MM-dd"), { includeOdds: false })
          )
        );

        const teamDateGames: TeamDateGames = {};
        const dateMetaByDate: Record<string, DateMeta> = {};

        responses.forEach((schedule, idx) => {
          const monday = mondays[idx];

          DAYS.forEach((dayAbbrev, dayIndex) => {
            const date = format(addDays(monday, dayIndex), "yyyy-MM-dd");
            if (date < dateList[0] || date > dateList[dateList.length - 1]) return;

            const regularGameIds = new Set<number>();

            Object.values(schedule.data as Record<number, WeekData>).forEach((weekData) => {
              const game = weekData[dayAbbrev];
              if (isRegularScheduleGame(game)) {
                regularGameIds.add(game.id);
              }
            });

            const regularSeasonGames = regularGameIds.size;
            dateMetaByDate[date] = {
              regularSeasonGames,
              isOffNight: regularSeasonGames <= OFF_NIGHT_THRESHOLD_GAMES,
              isHeavyNight: regularSeasonGames >= HEAVY_NIGHT_THRESHOLD_GAMES
            };
          });

          Object.entries(schedule.data).forEach(([teamIdStr, weekData]) => {
            const teamId = Number(teamIdStr);
            if (!teamDateGames[teamId]) teamDateGames[teamId] = {};

            DAYS.forEach((dayAbbrev, dayIndex) => {
              const date = format(addDays(monday, dayIndex), "yyyy-MM-dd");
              if (date < dateList[0] || date > dateList[dateList.length - 1]) return;

              const game = (weekData as WeekData)[dayAbbrev];
              if (game?.id) {
                teamDateGames[teamId][date] = game;
              }
            });
          });
        });

        if (!ignore) {
          setState({
            dates: dateList,
            teamDateGames,
            dateMetaByDate,
            loading: false,
            error: null
          });
        }
      } catch (err: any) {
        if (!ignore) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err?.message ?? "Failed to load schedule."
          }));
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [normalized]);

  return state;
}

