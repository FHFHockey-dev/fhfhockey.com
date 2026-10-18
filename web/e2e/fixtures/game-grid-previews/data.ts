import React, { createElement, useSyncExternalStore } from 'react';
import { DAYS, GameData, Team } from 'lib/NHL/types';
import { addDays, format, parseISO } from 'date-fns';
import { REAL_WEEK_32 } from './real-week-32';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" rx="8" fill="%232d9cdb"/%3E%3C/svg%3E';
// `?teams=32` replays a real 32-team week; the default 24-team fixture is unchanged.
const real32 = typeof location !== 'undefined' && new URLSearchParams(location.search).get('teams') === '32';
const realAbbreviations = Object.keys(REAL_WEEK_32).sort();
export const teams: Record<number, Team> = real32
  ? Object.fromEntries(realAbbreviations.map((abbreviation, index) => [index + 1, { id: index + 1, name: `Real Week ${abbreviation}`, abbreviation, logo }]))
  : Object.fromEntries(Array.from({ length: 24 }, (_, index) => {
    const id = index + 1;
    return [id, { id, name: `Fixture Team ${String(id).padStart(2, '0')}`, abbreviation: `F${id}`, logo }];
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
    const rows = real32 ? realWeekRows(dates, status) : Object.values(teams).map((team) => {
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
    const retrievedAt = status === 'stale' ? '2026-09-30T12:00:00Z' : '2026-10-07T15:59:00Z';
    snapshots.set(key, [rows, DAYS.map(() => 0), false, { coveredDates, coverage: { known: coveredDates.length, expected: dates.length }, error: null, retrievedAtByDate: Object.fromEntries(dates.map(date => [date, retrievedAt])) }]);
  }
  return snapshots.get(key);
}
/** Real matchups on the fixture week; `postponed` marks S.J vs CAR (Thursday) PPD. */
function realWeekRows(dates: string[], status: string) {
  const idOf = (abbreviation: string) => realAbbreviations.indexOf(abbreviation) + 1;
  return realAbbreviations.map((abbreviation) => {
    const row: Record<string, unknown> = { teamId: idOf(abbreviation) };
    if (status === 'empty') return row;
    REAL_WEEK_32[abbreviation].split(',').forEach((cell, day) => {
      if (!cell) return;
      const self = idOf(abbreviation), opponent = idOf(cell.replace('@', ''));
      const [home, away] = cell.startsWith('@') ? [opponent, self] : [self, opponent];
      row[DAYS[day]] = { id: 2026020000 + day * 100 + Math.min(home, away), season: 20262027, gameType: 2,
        gameDate: dates[day], startTimeUTC: dates[day] + 'T23:00:00Z', gameState: 'FUT',
        ...(status === 'postponed' && day === 3 && home === idOf('S.J') ? { gameScheduleState: 'PPD' } : {}),
        homeTeam: { ...teams[home] }, awayTeam: { ...teams[away] } };
    });
    return row;
  });
}
const fourWeeks = [[], [], false, { start: '2026-10-05', end: '2026-11-01', knownDays: 0, expectedDays: 28, error: null }];
export const useFourWeekSchedule = () => fourWeeks;
const metrics = { entries: [], metricsByTeamId: {}, coverageByTeamId: {}, leagueAverages: {}, leagueCoverage: {}, metricColumns: [], statsLoading: false, statsError: null, sourceLabel: 'Fixture: observed metrics unavailable.' };
export const useOpponentMetricsData = () => metrics;
