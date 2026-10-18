import React, { createElement, useSyncExternalStore } from 'react';
import { DAYS, GameData, Team } from 'lib/NHL/types';
import { addDays, format, parseISO } from 'date-fns';

// Real NHL week Mon 2025-03-17 .. Sun 2025-03-23 (Frozen Tools export), shifted onto the fixture week.
const WEEK: Record<string, string[]> = {"ANA":["","@DAL","","@NSH","","","CAR"],"BOS":["BUF","","","@VGK","","@S.J","@L.A"],"BUF":["@BOS","","","@UTA","","@MIN","@WPG"],"CAR":["","","","@S.J","","@L.A","@ANA"],"CBJ":["N.J","","","FLA","@PIT","",""],"CGY":["@TOR","@NYR","","@N.J","","@NYI",""],"CHI":["","SEA","","L.A","","@STL","PHI"],"COL":["","","@TOR","@OTT","","@MTL",""],"DAL":["","ANA","","T.B","","PHI",""],"DET":["","@WSH","","","","@VGK",""],"EDM":["","UTA","","WPG","","SEA",""],"FLA":["","","","@CBJ","","@WSH","PIT"],"L.A":["@MIN","","","@CHI","","CAR","BOS"],"MIN":["L.A","","SEA","","","BUF",""],"MTL":["","OTT","","@NYI","","COL",""],"N.J":["@CBJ","","","CGY","","OTT",""],"NSH":["","STL","","ANA","","TOR","@STL"],"NYI":["","@PIT","","MTL","","CGY",""],"NYR":["","CGY","","TOR","","VAN",""],"OTT":["","@MTL","","COL","","@N.J",""],"PHI":["@T.B","","","@WSH","","@DAL","@CHI"],"PIT":["","NYI","","","CBJ","","@FLA"],"S.J":["","","","CAR","","BOS",""],"SEA":["","@CHI","@MIN","","","@EDM",""],"STL":["","@NSH","","VAN","","CHI","NSH"],"T.B":["PHI","","","@DAL","","@UTA","@VGK"],"TOR":["CGY","","COL","@NYR","","@NSH",""],"UTA":["","@EDM","","BUF","","T.B",""],"VAN":["","WPG","","@STL","","@NYR",""],"VGK":["","","","BOS","","DET","T.B"],"WPG":["","@VAN","","@EDM","","","BUF"],"WSH":["","DET","","PHI","","FLA",""]};
const ABBR = Object.keys(WEEK).sort();
const idOf = (a: string) => ABBR.indexOf(a) + 1;
export const teams: Record<number, Team> = Object.fromEntries(ABBR.map((abbreviation) => [idOf(abbreviation), { id: idOf(abbreviation), name: 'Team ' + abbreviation, abbreviation,
  logo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" rx="8" fill="%232d9cdb"/%3E%3C/svg%3E' }]));
export const useTeamsMap = () => teams;
export const useCurrentSeason = () => ({ seasonId: 20262027 });
const summaries = Object.keys(teams).map((id) => ({ teamId: Number(id), gamesPlayed: 2, pointPct: .5 }));
export const useTeamSummary = () => ({ teamSummaries: summaries, loading: false, error: null });
export const useMatchupWeek = () => ({ weekNumber: 1 });
const query = { startDate: '2026-10-19', endDate: '2026-10-25' };
const router = { isReady: true, query, replace: () => {}, push: () => {} };
export const useRouter = () => router;
export function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) { return createElement('a', { ...props, href }, children); }
export function Image({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) { return createElement('img', { src, alt, width: width ?? 32, height: height ?? 32 }); }
let state = 'ready';
const listeners = new Set<() => void>();
export function setFixtureState(next: string) { state = next; listeners.forEach((listener) => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshots = new Map();
export function useSchedule(start: string, extended: boolean) {
  const status = useSyncExternalStore(subscribe, () => state);
  const key = start + '/' + extended + '/' + status;
  if (!snapshots.has(key)) {
    const dates = Array.from({ length: extended ? 10 : 7 }, (_, index) => format(addDays(parseISO(start), index), 'yyyy-MM-dd'));
    const rows = ABBR.map((abbreviation) => {
      const row: Record<string, unknown> = { teamId: idOf(abbreviation) };
      if (status === 'empty') return row;
      WEEK[abbreviation].forEach((cell, day) => {
        if (!cell) return;
        const self = idOf(abbreviation), opponent = idOf(cell.replace('@', ''));
        const [home, away] = cell.startsWith('@') ? [opponent, self] : [self, opponent];
        const postponed = status === 'postponed' && day === 3 && home === idOf('S.J');
        const game: GameData & { startTimeUTC: string } = { id: 2026020000 + day * 100 + Math.min(home, away), season: 20262027, gameType: 2,
          gameDate: dates[day], startTimeUTC: dates[day] + 'T23:00:00Z', gameState: 'FUT', ...(postponed ? { gameScheduleState: 'PPD' } : {}),
          homeTeam: { ...teams[home] }, awayTeam: { ...teams[away] } };
        row[DAYS[day]] = game;
      });
      return row;
    });
    const coveredDates = status === 'partial' ? dates.filter((_, i) => i !== 3) : dates;
    snapshots.set(key, [rows, DAYS.map(() => 0), false, { coveredDates, coverage: { known: coveredDates.length, expected: dates.length }, error: null,
      retrievedAtByDate: Object.fromEntries(dates.map(date => [date, '2026-10-18T15:59:00Z'])) }]);
  }
  return snapshots.get(key);
}
const fourWeeks = [[], [], false, { start: '2026-10-19', end: '2026-11-15', knownDays: 0, expectedDays: 28, error: null }];
export const useFourWeekSchedule = () => fourWeeks;
const metrics = { entries: [], metricsByTeamId: {}, coverageByTeamId: {}, leagueAverages: {}, leagueCoverage: {}, metricColumns: [], statsLoading: false, statsError: null, sourceLabel: 'Fixture: observed metrics unavailable.' };
export const useOpponentMetricsData = () => metrics;
