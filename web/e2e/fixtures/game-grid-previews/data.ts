import React, { createElement, useSyncExternalStore } from 'react';
import { DAYS, GameData, Team } from 'lib/NHL/types';
import { addDays, format, parseISO } from 'date-fns';

export const teams: Record<number, Team> = Object.fromEntries(Array.from({ length: 24 }, (_, index) => {
  const id = index + 1;
  return [id, { id, name: `Fixture Team ${String(id).padStart(2, '0')}`, abbreviation: `F${id}`, logo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" rx="8" fill="%232d9cdb"/%3E%3C/svg%3E' }];
}));
export const useTeamsMap = () => teams;
export const useCurrentSeason = () => ({ seasonId: 20262027 });
const summaries = Object.keys(teams).map((id) => ({ teamId: Number(id), gamesPlayed: 2, pointPct: .5 }));
export const useTeamSummary = () => ({ teamSummaries: summaries, loading: false, error: null });
export const useMatchupWeek = () => ({ weekNumber: 1 });
const query = { startDate: '2026-10-05', endDate: '2026-10-11' };
const router = { isReady: true, query, replace: () => {}, push: () => {} };
export const useRouter = () => router;
export function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement('a', { ...props, href }, children);
}
export function Image({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) {
  return createElement('img', { src, alt, width: width ?? 32, height: height ?? 32 });
}
let state = 'ready';
const listeners = new Set<() => void>();
export function setFixtureState(next: string) { state = next; listeners.forEach((listener) => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshots = new Map();
export function useSchedule(start: string, extended: boolean) {
  const status = useSyncExternalStore(subscribe, () => state);
  const key = `${start}/${extended}/${status}`;
  if (!snapshots.has(key)) {
    const dates = Array.from({ length: extended ? 10 : 7 }, (_, index) => format(addDays(parseISO(start), index), 'yyyy-MM-dd'));
    const rows = Object.values(teams).map((team) => {
      const opponent = team.id % 2 ? team.id + 1 : team.id - 1;
      const game = (day: number): GameData & { startTimeUTC: string } => ({
        id: Math.ceil(team.id / 2) * 100 + day, season: 20262027, gameType: 2,
        gameDate: dates[day], startTimeUTC: dates[day] + 'T23:00:00Z',
        gameState: status === 'refreshed' && day === 3 ? 'LIVE' : 'FUT',
        homeTeam: { ...teams[Math.min(team.id, opponent)] }, awayTeam: { ...teams[Math.max(team.id, opponent)] },
      });
      return { teamId: team.id, ...(status === 'empty' ? {} : { THU: game(3), SUN: game(6), ...(team.id > 12 ? { SAT: game(5) } : {}), ...(extended ? { nMON: game(7) } : {}) }) };
    });
    const coveredDates = status === 'partial' ? dates.slice(0, 6) : dates;
    snapshots.set(key, [rows, DAYS.map(() => 0), false, { coveredDates, coverage: { known: coveredDates.length, expected: dates.length }, error: null }]);
  }
  return snapshots.get(key);
}
const fourWeeks = [[], [], false, { start: '2026-10-05', end: '2026-11-01', knownDays: 0, expectedDays: 28, error: null }];
export const useFourWeekSchedule = () => fourWeeks;
const metrics = { entries: [], metricsByTeamId: {}, coverageByTeamId: {}, leagueAverages: {}, leagueCoverage: {}, metricColumns: [], statsLoading: false, statsError: null, sourceLabel: 'Fixture: observed metrics unavailable.' };
export const useOpponentMetricsData = () => metrics;
