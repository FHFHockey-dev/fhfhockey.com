import React, { createElement, useEffect, useState, useSyncExternalStore } from 'react';
import { DAYS, GameData, Team } from 'lib/NHL/types';
import { addDays, format, parseISO } from 'date-fns';
import { REAL_WEEK_32 } from './real-week-32';
import type { GoalieGridReader } from 'components/GameGrid/utils/useGoalieGameView';
import type { GoalieCandidate, GoalieProbability, GoalieSource } from 'components/GameGrid/utils/goalieGameView';
import type { GoalieWorkloadSnapshot } from 'components/GameGrid/utils/goalieWorkloadView';

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
// The actual Date Range hook reads this local schedule seam; no NHL/provider request is made.
export async function getSchedule(start: string) {
  const data = Object.fromEntries([1, 2].map(teamId => [teamId, Object.fromEntries([3, 6].map(day => {
    const date = format(addDays(parseISO(start), day), 'yyyy-MM-dd');
    return [DAYS[day], { id: Number(date.replaceAll('-', '')), season: 20262027, gameType: 2,
      gameDate: date, startTimeUTC: `${date}T23:00:00Z`, gameScheduleState: 'OK', gameState: 'FUT',
      homeTeam: teams[1], awayTeam: teams[2] }];
  }))]));
  return { data };
}
export const useCurrentSeason = () => ({ seasonId: 20262027 });
export function useCurrentSeasonQuery() {
  const ready = useFixtureDelay("season");
  return { data: ready ? { seasonId: 20262027 } : undefined, isPending: !ready, isError: false };
}
const summaries = Object.keys(teams).map((id) => ({ teamId: Number(id), gamesPlayed: 2, pointPct: .5 }));
export const useTeamSummary = () => ({ teamSummaries: summaries, loading: false, error: null });
export const useMatchupWeek = () => ({ weekNumber: 1 });
const query = { startDate: '2026-10-05', endDate: '2026-10-11', view: new URLSearchParams(location.search).get('view') ?? undefined };
const routerListeners = new Set<() => void>();
const router = { isReady: true, pathname: '/game-grid/[mode]', query,
  replace: (url: { query?: typeof query }) => {
    if (!url.query || JSON.stringify(url.query) === JSON.stringify(router.query)) return Promise.resolve(true);
    router.query = url.query;
    routerListeners.forEach(listener => listener());
    return Promise.resolve(true);
  }, push: () => Promise.resolve(true) };
export function useRouter() {
  useSyncExternalStore(listener => { routerListeners.add(listener); return () => { routerListeners.delete(listener); }; }, () => JSON.stringify(router.query));
  return router;
}
export const goalieWorkloadFixture: GoalieWorkloadSnapshot = {
  version: 'goalie-workload-view-v1', seasonId: 20262027, seasonStartsOn: '2026-10-01', source: 'Synthetic official-start fixture', revision: 'fixture-history-1',
  observedAt: '2026-10-07T15:59:00Z', dataThrough: '2026-10-06', basis: 'current_recorded_results',
  scheduleVerifiedThrough: '2026-10-07', scheduleComplete: true, appearancesComplete: true,
  games: Array.from({ length: 6 }, (_, i) => ({ gameId: 9001 + i, date: `2026-10-0${i + 1}`, team: teams[1].abbreviation,
    seasonId: 20262027, state: 'final', completedAt: `2026-10-0${i + 1}T23:00:00Z` })),
  appearances: Array.from({ length: 6 }, (_, i) => ({ gameId: 9001 + i, goalieId: i % 2 ? 847002 : 847001,
    name: i % 2 ? 'Ukko-Pekka Luukkonen' : 'Samuel Montembeault', date: `2026-10-0${i + 1}`, team: teams[1].abbreviation,
    opponent: teams[2].abbreviation, home: true, started: i === 5 ? null : true, wins: null, losses: null, otLosses: null,
    saves: null, shotsAgainst: null, goalsAgainst: null, toiSeconds: null, shutouts: null, qualityStart: null })),
};
// Synthetic presentation qualification only: never a model acceptance receipt.
export const readGoalieFixture: GoalieGridReader = async ({ games, contextKey }) => {
  if (params.has('goalie-error')) throw new Error('Fixture reader unavailable');
  await new Promise(resolve => setTimeout(resolve, 25));
  const source: GoalieSource = { source: 'Synthetic fixture', artifactId: 'fixture-only', revision: 'r1',
    observedAt: '2026-10-07T13:00:00Z', availableAt: '2026-10-07T13:01:00Z', cutoffAt: '2026-10-07T14:00:00Z',
    issuedAt: '2026-10-07T14:01:00Z', expiresAt: '2026-10-20T00:00:00Z' };
  return { version: 'goalie-grid-v1', contextKey, boards: [...new Map(games.map(g => [g.id, g])).values()].flatMap(game =>
    [game.homeTeam.id, game.awayTeam.id].map(teamId => {
      const selectionRevision = state === 'goalie-change' ? 'r2' : 'r1';
      const selectedPlayerId = state === 'goalie-change' ? 847002 : 847001;
      const candidates: GoalieCandidate[] = [847001, 847002, 847003].map((playerId, index) => {
        const metric = (target: GoalieProbability['target'], value: number): GoalieProbability => ({
          playerId, gameId: game.id, teamId, selectionRevision: 'r1', target, value,
          basis: 'individual_goalie_game', source, publishedAt: source.issuedAt,
          qualification: { status: params.has('goalie-unqualified') ? 'unqualified' : 'qualified', reportId: 'synthetic-not-scientific', artifactId: source.artifactId, population: 'pregame_as_issued_goalie_game' },
        });
        return { playerId, name: [params.has('goalie-long-name') ? 'Alexandre Gauthier-Desjardins' : 'Samuel Montembeault', 'Ukko-Pekka Luukkonen', 'Jeremy Swayman'][index],
          surname: [params.has('goalie-long-name') ? 'Gauthier-Desjardins' : 'Montembeault', 'Luukkonen', 'Swayman'][index], status: index === 0 ? 'confirmed' : 'projected', source,
          start: metric('official_starter', params.has('goalie-extremes') ? index === 0 ? 1 : 0 : [.7, .2, .05][index]),
          winIfStarting: metric('credited_win_if_starting', params.has('goalie-extremes') ? 1 : .57 - index * .1) };
      });
      return { gameId: game.id, seasonId: game.season, teamId,
        opponentId: teamId === game.homeTeam.id ? game.awayTeam.id : game.homeTeam.id,
        startsAt: game.startTimeUTC!, selectionRevision, selectedPlayerId, candidateCoverage: 'partial' as const, candidates };
    })) };
};
export function Link({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement('a', { ...props, href }, children);
}
export function Image({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) {
  return createElement('img', { src, alt, width: width ?? 32, height: height ?? 32 });
}
const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const readyReads = new Set<string>();
const timeline: { name: string; at: number }[] = [];
(window as any).__fixtureTimeline = timeline;
function useFixtureDelay(key: string, enabled = true) {
  const ms = Number(params.get(`${key}-delay`) ?? 0);
  const [ready, setReady] = useState(() => !ms || readyReads.has(key));
  useEffect(() => {
    if (!enabled || ready) return;
    timeline.push({ name: `${key}-start`, at: performance.now() });
    const timer = setTimeout(() => { readyReads.add(key); setReady(true); timeline.push({ name: `${key}-ready`, at: performance.now() }); }, ms);
    return () => clearTimeout(timer);
  }, [enabled, key, ms, ready]);
  return ready;
}
let state = 'ready';
const listeners = new Set<() => void>();
export function setFixtureState(next: string) { state = next; listeners.forEach((listener) => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshots = new Map();
export function useSchedule(start: string, extended: boolean) {
  const status = useSyncExternalStore(subscribe, () => state);
  const ready = useFixtureDelay("schedule");
  const [failOnce] = useState(() => params.has('schedule-error-once') && !sessionStorage.getItem('fixture-schedule-retried'));
  useEffect(() => { if (failOnce) sessionStorage.setItem('fixture-schedule-retried', '1'); }, [failOnce]);
  const key = `${start}/${extended}/${status}`;
  if (!snapshots.has(key)) {
    const dates = Array.from({ length: extended ? 10 : 7 }, (_, index) => format(addDays(parseISO(start), index), 'yyyy-MM-dd'));
    const rows = real32 ? realWeekRows(dates, status) : Object.values(teams).map((team) => {
      const opponent = team.id % 2 ? team.id + 1 : team.id - 1;
      const game = (day: number): GameData & { startTimeUTC: string } => ({
        id: Math.ceil(team.id / 2) * 100 + day, season: 20262027, gameType: 2,
        gameDate: dates[day], startTimeUTC: dates[day] + 'T23:00:00Z',
        gameScheduleState: 'OK', gameState: status === 'refreshed' && day === 3 ? 'LIVE' : 'FUT',
        homeTeam: { ...teams[Math.min(team.id, opponent)] }, awayTeam: { ...teams[Math.max(team.id, opponent)] },
      });
      return { teamId: team.id, ...(status === 'empty' ? {} : { THU: game(3), SUN: game(6), ...(team.id > 12 ? { SAT: game(5) } : {}), ...(extended ? { nMON: game(7) } : {}) }) };
    });
    const coveredDates = status === 'partial' ? dates.slice(0, 6) : dates;
    const retrievedAt = status === 'stale' ? '2026-09-30T12:00:00Z' : status === 'goalie-change' ? '2026-10-07T16:00:01Z' : '2026-10-07T15:59:00Z';
    snapshots.set(key, [rows, DAYS.map(() => 0), false, { coveredDates, coverage: { known: coveredDates.length, expected: dates.length }, error: null, retrievedAtByDate: Object.fromEntries(dates.map(date => [date, retrievedAt])) }]);
  }
  if (!ready) return [[], [], true, { coveredDates: [], coverage: { known: 0, expected: extended ? 10 : 7 }, error: null }];
  if ((params.has('schedule-error') || failOnce) && status !== 'recovered') return [[], [], false, { coveredDates: [], coverage: { known: 0, expected: extended ? 10 : 7 }, error: 'Fixture schedule error' }];
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
        gameDate: dates[day], startTimeUTC: dates[day] + 'T23:00:00Z', gameState: 'FUT', gameScheduleState: 'OK',
        ...(status === 'postponed' && day === 3 && home === idOf('S.J') ? { gameScheduleState: 'PPD' } : {}),
        homeTeam: { ...teams[home] }, awayTeam: { ...teams[away] } };
    });
    return row;
  });
}
const completeCalendar = typeof location !== 'undefined' && new URLSearchParams(location.search).has('complete-schedule');
const fourWeekSnapshots = new Map();
export function useFourWeekSchedule(start: string) {
  const delayedReady = useFixtureDelay("four-week");
  const [waiting, setWaiting] = useState(() => new URLSearchParams(location.search).has('slow-four-week'));
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaiting(false), 4000);
    return () => clearTimeout(timer);
  }, [waiting]);
  const selectedWindow = useSchedule(start, false);
  const window = snapshots.get(`${start}/false/${state}`) ?? selectedWindow;
  const key = `${start}/${state}`;
  if (!fourWeekSnapshots.has(key)) {
    const opportunityFixture = new URLSearchParams(location.search).has('opportunity');
    const covered = completeCalendar || opportunityFixture;
    const rows = [1, 2, 3, 4].flatMap((weekNumber) => window[0].map((row: Record<string, unknown>) => ({
      ...row, weekNumber, totalGamesPlayed: 0, totalOffNights: 0, weekScore: -100,
      scheduleCoverage: { known: covered && !(new URLSearchParams(location.search).has('gap') && row.teamId === 1 && weekNumber === 2) ? 7 : 0, expected: 7 },
      ...Object.fromEntries(DAYS.flatMap((day) => {
        const game = row[day] as GameData | undefined;
        if (!game) return [];
        const date = format(addDays(parseISO(game.gameDate!), 7 * (weekNumber - 1)), 'yyyy-MM-dd');
        return [[day, { ...game, id: game.id + weekNumber * 100000, gameDate: date,
          startTimeUTC: opportunityFixture && weekNumber === 4 && day === 'SUN' ? '2026-11-02T02:00:00Z' : date + 'T23:00:00Z' }]];
      })),
    })));
    fourWeekSnapshots.set(key, [rows, [], false, { start, end: format(addDays(parseISO(start), 27), 'yyyy-MM-dd'), knownDays: covered ? 28 : 0, expectedDays: 28, error: null }]);
  }
  // Deliberately return fresh empty rows, exercising the clock's loading guard.
  if (waiting || !delayedReady) return [[], [], true, { start, end: format(addDays(parseISO(start), 27), 'yyyy-MM-dd'), knownDays: 0, expectedDays: 28, error: null }];
  if (params.has('four-week-error')) return [[], [], false, { start, end: format(addDays(parseISO(start), 27), 'yyyy-MM-dd'), knownDays: 0, expectedDays: 28, error: 'Fixture four-week error' }];
  return fourWeekSnapshots.get(key);
}
export function useOpponentMetricsData(teamData: any[]) {
  const ready = useFixtureDelay("nst");
  const error = params.has("nst-error");
  const statsByAbbreviation = Object.fromEntries(Object.values(teams).map((team) => [team.abbreviation, { gp: 4, xgf: team.id, xga: 33 - team.id }]));
  const keys = ['avgXgf', 'avgXga', 'avgGoalFor', 'avgGoalAgainst', 'avgSf', 'avgSa', 'avgWinPct'];
  const labels = ['xGF', 'xGA', 'GF', 'GA', 'SF', 'SA', 'PTS%'];
  const entries = teamData.map((team) => ({ team,
    averages: Object.fromEntries(keys.map((key, index) => [key, team.totals.gamesPlayed ? index === 6 ? .5 : index === 0 ? team.teamId / 4 : (33 - team.teamId) / 4 : null])),
    coverage: Object.fromEntries(keys.map((key) => [key, { known: team.totals.gamesPlayed, expected: team.totals.gamesPlayed }])) }));
  return { entries: ready && !error ? entries : [], statsByAbbreviation: ready && !error ? statsByAbbreviation : {}, metricsByTeamId: Object.fromEntries(entries.map((e) => [e.team.teamId, e.averages])), coverageByTeamId: Object.fromEntries(entries.map((e) => [e.team.teamId, e.coverage])),
    leagueAverages: {}, leagueCoverage: {}, metricColumns: keys.map((key, index) => ({ key, label: labels[index] })), statsLoading: !ready, statsError: ready && error ? "Fixture opponent error" : null, sourceLabel: 'Fixture: provisional observations; freshness unknown.' };
}
