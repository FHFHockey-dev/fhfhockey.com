import { useEffect, useState } from "react";
import { getSchedule, getTeams } from "lib/NHL/client";
import { isRegularScheduleGame } from "components/GameGrid/utils/helper";
import type { GameData, Team } from "lib/NHL/types";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";

export type CanonicalSchedule = { games: GameData[]; teams: Team[]; complete: boolean; error: string | null; validUntil?: number };
type CachedWeek = { gameKey: string; week: number; startDate: string; endDate: string };
type CacheRead = { source: "cache"; weeks: CachedWeek[] };
const unknown = (error: string): CanonicalSchedule => ({ games: [], teams: [], complete: false, error });
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function validContextDates(dates: readonly string[]) {
  return dates.length > 0 && dates.length <= 28 && dates.every((date, index) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
    && (!index || date === shift(dates[index - 1], 1)));
}

/** Cached schedule metadata only; missing witnesses never trigger an NHL source request. */
export async function loadCachedCanonicalSchedule(dates: string[], seasonId: number, timeZone: string,
  weeks: CachedWeek[], now = Date.now()): Promise<CanonicalSchedule> {
  if (!validContextDates(dates)) return unknown("Choose a consecutive remaining range of up to 28 days for team schedule context.");
  const first = shift(dates[0], -1), last = shift(dates.at(-1)!, 1);
  const selectedWeeks = weeks.filter(week => week.startDate <= last && week.endDate >= first);
  const keys = new Set(selectedWeeks.map(week => week.gameKey));
  if (!selectedWeeks.length || keys.size !== 1 || !/^[A-Za-z0-9._-]{1,40}$/.test(selectedWeeks[0].gameKey)
    || selectedWeeks.some(week => !Number.isSafeInteger(week.week) || week.week < 1)
    || Math.max(...selectedWeeks.map(week => week.week)) - Math.min(...selectedWeeks.map(week => week.week)) > 5)
    return unknown("Cached matchup-week mapping is unavailable. Team schedule coverage remains unverified.");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    // The witnessed scope includes postponed/cancelled sides; a day witness lists them too.
    const params = new URLSearchParams({ gameKey: selectedWeeks[0].gameKey,
      startWeek: String(Math.min(...selectedWeeks.map(week => week.week))), endWeek: String(Math.max(...selectedWeeks.map(week => week.week))),
      scope: "witnessed" });
    const response = await fetch(`/api/v1/roster-schedule-optimizer/schedule?${params}`, { signal: controller.signal });
    const body = await response.json(), rows = body?.data?.games;
    if (!response.ok || body?.success !== true || body.data.version !== "roster-team-games.v1"
      || !Array.isArray(rows) || rows.length > 2000) return unknown("Cached NHL schedule metadata is unavailable.");
    const days = new Map<string, any[]>(), labels = new Map<number, Team>();
    let validUntil = Infinity;
    for (const row of rows) {
      if (typeof row.game_date !== "string" || !validContextDates([row.game_date]))
        return unknown("Cached schedule dates are unresolved.");
      if ((row.game_date < first || row.game_date > last)
        && !row.source_metadata?.scheduleCoverage?.emptyDates?.some((date: string) => date >= first && date <= last)) continue;
      if (row.source_season_id !== seasonId || row.game_key !== selectedWeeks[0].gameKey || row.game_type !== 2
        || !Number.isSafeInteger(row.source_game_id) || row.source_game_id <= 0
        || !Number.isSafeInteger(row.team_id) || !Number.isSafeInteger(row.opponent_team_id)
        || row.team_id <= 0 || row.opponent_team_id <= 0 || row.team_id === row.opponent_team_id
        || !/^[A-Z]{2,4}$/.test(row.team_abbreviation) || !/^[A-Z]{2,4}$/.test(row.opponent_abbreviation)
        || !["home", "away"].includes(row.home_away) || typeof row.is_countable !== "boolean" || !Number.isFinite(Date.parse(row.start_time))
        || !Number.isFinite(Date.parse(row.fetched_at)) || Date.parse(row.fetched_at) > now
        || now - Date.parse(row.fetched_at) >= 36 * 3600000)
        return unknown("Cached schedule identity, clocks or freshness are unresolved.");
      validUntil = Math.min(validUntil, Date.parse(row.fetched_at) + 36 * 3600000);
      const previous = labels.get(row.team_id);
      if (previous && previous.abbreviation !== row.team_abbreviation) return unknown("Cached team identities conflict.");
      labels.set(row.team_id, { id: row.team_id, abbreviation: row.team_abbreviation, name: row.team_abbreviation, logo: "" });
      days.set(row.game_date, [...(days.get(row.game_date) ?? []), row]);
    }
    const covered = new Set<string>(), empty = new Set<string>(), games = new Map<number, GameData>();
    for (const [date, sides] of days) {
      const witness = sides[0].source_metadata?.scheduleCoverage;
      if (witness?.version !== "nhl-source-days-v1" || witness.date !== date || !Array.isArray(witness.gameIds)
        || !witness.gameIds.length || witness.gameIds.length > 16 || new Set(witness.gameIds).size !== witness.gameIds.length
        || !Array.isArray(witness.emptyDates) || witness.emptyDates.length > 31
        || witness.emptyDates.some((value: unknown) => typeof value !== "string" || !validContextDates([value]))
        || sides.length !== witness.gameIds.length * 2
        || sides.some(row => row.fetched_at !== sides[0].fetched_at
          || JSON.stringify(row.source_metadata?.scheduleCoverage) !== JSON.stringify(witness))) continue;
      const pairs = witness.gameIds.map((id: number) => sides.filter(row => row.source_game_id === id));
      if (pairs.some((pair: any[]) => pair.length !== 2 || pair[0].team_id !== pair[1].opponent_team_id
        || pair[1].team_id !== pair[0].opponent_team_id || pair[0].team_abbreviation !== pair[1].opponent_abbreviation
        || pair[1].team_abbreviation !== pair[0].opponent_abbreviation || pair[0].home_away === pair[1].home_away
        || pair[0].start_time !== pair[1].start_time || pair[0].game_status !== pair[1].game_status
        || pair[0].schedule_status !== pair[1].schedule_status || pair[0].is_countable !== pair[1].is_countable)) continue;
      covered.add(date); for (const value of witness.emptyDates) empty.add(value);
      for (const pair of pairs) {
        if (!pair[0].is_countable) continue; // witnessed coverage only; never a playable game
        const home = pair.find((row: any) => row.home_away === "home"), away = pair.find((row: any) => row.home_away === "away");
        const game: GameData = { id: home.source_game_id, season: seasonId, gameType: 2,
          gameDate: localDate(home.start_time, timeZone), startTimeUTC: home.start_time,
          gameState: home.game_status, gameScheduleState: home.schedule_status,
          homeTeam: { id: home.team_id }, awayTeam: { id: away.team_id } };
        if (games.has(game.id)) return unknown("Cached schedule game identities conflict.");
        games.set(game.id, game);
      }
    }
    for (let date = first; date <= last; date = shift(date, 1)) {
      if (covered.has(date) && empty.has(date) || !covered.has(date) && !empty.has(date))
        return unknown("Cached schedule does not verify every remaining date and timezone boundary.");
    }
    return { games: [...games.values()].filter(game => dates.includes(game.gameDate!) && isRegularScheduleGame(game)),
      teams: [...labels.values()], complete: true, error: null, validUntil };
  } catch { return unknown("Cached NHL schedule could not be read. Its coverage remains unverified."); }
  finally { clearTimeout(timer); }
}

/** Same canonical NHL reader as Game Grid; no RSO, roster or forecast completeness predicate. */
export async function loadCanonicalSchedule(dates: string[], seasonId: number, timeZone: string): Promise<CanonicalSchedule> {
  if (!validContextDates(dates)) return unknown("Choose a consecutive range of up to 28 days for team schedule context.");
  const first = shift(dates[0], -1), last = shift(dates.at(-1)!, 1);
  const starts: string[] = [];
  for (let date = first; date <= last; date = shift(date, 7)) starts.push(date);
  const coverage = new Set<string>(), games = new Map<number, GameData>();
  try {
    // Calendar padding supports league-local conversion. At most five windows, concurrency two.
    for (let index = 0; index < starts.length; index += 2) {
      const windows = await Promise.all(starts.slice(index, index + 2).map(start => getSchedule(start)));
      for (const window of windows) {
        if (!Array.isArray(window.coveredDates) || !Array.isArray(window.numGamesPerDay) || window.numGamesPerDay.length !== 7)
          return unknown("Canonical NHL calendar coverage is unavailable.");
        const windowGames = new Map<number, GameData>();
        for (const row of Object.values(window.data ?? {})) for (const game of Object.values(row)) {
          if (!game) continue;
          if (!Number.isSafeInteger(game.id) || game.id <= 0 || !game.gameDate || !window.coveredDates.includes(game.gameDate)
            || !Number.isSafeInteger(game.homeTeam?.id) || !Number.isSafeInteger(game.awayTeam?.id)
            || game.homeTeam.id <= 0 || game.awayTeam.id <= 0 || game.homeTeam.id === game.awayTeam.id)
            return unknown("Canonical NHL game identity or calendar date is unresolved.");
          const previous = windowGames.get(game.id) ?? games.get(game.id);
          if (previous && JSON.stringify(previous) !== JSON.stringify(game)) return unknown("Canonical NHL schedule receipts conflict.");
          windowGames.set(game.id, game);
        }
        for (const date of window.coveredDates) {
          const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
          const count = window.numGamesPerDay[day];
          if (!Number.isInteger(count) || count < 0 || count > 16 || [...windowGames.values()].filter(game => game.gameDate === date).length !== count)
            return unknown("Canonical NHL calendar counts and game rows are incomplete.");
          coverage.add(date);
        }
        for (const [id, game] of windowGames) games.set(id, game);
      }
    }
    for (let date = first; date <= last; date = shift(date, 1)) if (!coverage.has(date))
      return unknown("Canonical NHL schedule does not cover every required date.");
    const selected: GameData[] = [];
    for (const game of games.values()) {
      if (!isRegularScheduleGame(game)) continue;
      const at = game.startTimeUTC && Number.isFinite(Date.parse(game.startTimeUTC)) ? game.startTimeUTC : null;
      if (!at && !["America/New_York", "US/Eastern"].includes(timeZone))
        return unknown("Game start times are needed to verify the selected league-local dates.");
      const date = at ? localDate(at, timeZone) : game.gameDate!;
      if (!dates.includes(date)) continue;
      if (game.season !== seasonId) return unknown("Canonical NHL schedule season does not match the selected season.");
      selected.push({ ...game, gameDate: date });
    }
    // Team labels are metadata, never a dependency on a manager's roster.
    const labels = await getTeams(seasonId).catch(() => []);
    const teams = Array.isArray(labels) ? labels : [];
    return { games: selected, teams, complete: true, error: null };
  } catch { return unknown("Canonical NHL schedule could not be read. Its coverage remains unverified."); }
}

const reads = new Map<string, { expires: number; promise: Promise<CanonicalSchedule> }>();
export function useCanonicalSchedule(dates: string[], seasonId: number, timeZone: string, enabled = true, cache?: CacheRead,
  refreshToken: string | number = 0) {
  const key = JSON.stringify([dates, seasonId, timeZone, cache, refreshToken]);
  const [state, setState] = useState<{ key: string; data: CanonicalSchedule } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const [selectedDates, selectedSeason, selectedZone, cached] = JSON.parse(key) as [string[], number, string, CacheRead | null];
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let read = reads.get(key);
    if (!read || read.expires <= Date.now()) {
      const promise = cached?.source === "cache"
        ? loadCachedCanonicalSchedule(selectedDates, selectedSeason, selectedZone, cached.weeks)
        : loadCanonicalSchedule(selectedDates, selectedSeason, selectedZone);
      read = { expires: Date.now() + 300000, promise }; reads.set(key, read);
      void promise.then(result => { if (!result.complete && reads.get(key)?.promise === promise) reads.delete(key); });
    }
    const selectedRead = read;
    void read.promise.then(data => {
      if (cancelled) return;
      const expire = () => {
        if (reads.get(key) === selectedRead) reads.delete(key);
        if (!cancelled) setState({ key, data: unknown("Cached schedule evidence expired. Refresh planning data to verify coverage again.") });
      };
      if (data.validUntil !== undefined) {
        selectedRead.expires = Math.min(selectedRead.expires, data.validUntil);
        const remaining = data.validUntil - Date.now();
        if (remaining <= 0) { expire(); return; }
        expiryTimer = setTimeout(expire, remaining);
      }
      setState({ key, data });
    });
    return () => { cancelled = true; clearTimeout(expiryTimer); };
  }, [key, enabled]);
  return !enabled ? unknown("Canonical schedule reader is paused.") : state?.key === key ? state.data : unknown("Reading canonical NHL calendar coverage…");
}
