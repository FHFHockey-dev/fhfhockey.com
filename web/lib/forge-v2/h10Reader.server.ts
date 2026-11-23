/**
 * Read-only inputs for the hosted FORGE H1–H10 shadow run. Four bounded SELECTs against existing public tables, and no
 * NST or other external request. The same SQL text is listed in the hosted packet for the read approval.
 * Clock rules (see `H10_INPUT_LIMITATIONS`):
 *  - Roster rows are dated by `official_seen_at` (the nightly official refresh, `update-players`). A row never seen,
 *    or unseen for more than 36 h, is marked not approved, so it is listed as unverified and never issued.
 *  - Games are dated by `game_state_observed_at`, falling back to `created_at`. That is a last-observed stamp, so the
 *    nightly cutoff is the freeze time (the first call after 04:00 ET), not a fixed 04:00.
 *  - `wgo_skater_stats` has no ingestion timestamp. A line's receipt clock is inferred as the first daily WGO skater
 *    job (07:30 UTC, `update-all-wgo-skaters`) after the game's declared end (start + 3.5 h).
 */
import { Category, Instant, ScheduleGame, SourceReference, instant } from "./contracts";
import { MembershipEvidence } from "./denominator";
import { contentHash } from "./hash.server";
import { SqlConnection } from "./history.server";
import { H10GameLog } from "./h10Features";
import { H10GoalieLog } from "./h10Goalies";

export const H10_SQL = {
  games: `select g.id::text as id, g."seasonId"::text as season_id, g.type, g."homeTeamId" as home_team_id, g."awayTeamId" as away_team_id, g.date::text as date,
  g."startTime" as start_time, g.game_schedule_state, g.game_state, coalesce(g.game_state_observed_at, g.created_at) as observed_at
from public.games g where g."seasonId" = $1 and g.type = 2 order by g.id limit 1500`,
  rosters: `select r."playerId"::text as player_id, r."teamId" as team_id, r.official_seen_at, p.position::text as position
from public.rosters r join public.players p on p.id = r."playerId"
where r."seasonId" = $1 and r.is_current order by r."playerId" limit 3000`,
  logs: `select w.player_id, w.game_id::text as game_id, w.season_id, t.id as team_id, o.id as opponent_id, w.home_road, w.goals, w.assists, w.pp_points, w.shots, w.hits,
  w.blocked_shots, w.penalty_minutes, g."startTime" as start_time
from public.wgo_skater_stats w
join public.teams t on t.abbreviation = w.team_abbrev
join public.teams o on o.abbreviation = w.opponent_team_abbrev
join public.games g on g.id = w.game_id
where w.season_id = $1 and w.date >= $2::date and w.game_id is not null order by w.game_id, w.player_id limit 40000`,
  goalieLogs: `select s.goalie_id as player_id, s.date::text as date, s.season_id, t.id as team_id, s.games_played, s.games_started, s.wins, s.saves,
  s.goals_against, s.shots_against, s.shutouts
from public.wgo_goalie_stats s join public.teams t on t.abbreviation = s.team_abbreviation
where s.season_id = $1 and s.date >= $2::date order by s.date, s.goalie_id limit 5000`,
  rosterEvents: `select e.event_id::text as event_id, e.player_id::text as player_id, e.team_id, e.event_type, e.effective_from, e.created_at
from public.forge_roster_events e where e.created_at > $1 and e.player_id is not null order by e.event_id limit 500`,
} as const;

export const H10_INPUT_LIMITATIONS = [
  "log_receipt_clock_inferred_next_wgo_ingest_after_game_end",
  "roster_clock_is_official_seen_at",
  "schedule_clock_is_state_observed_or_created_at",
  "no_official_transactions_feed",
] as const;

export interface H10InputRows {
  games: Array<{ id: string; season_id: string; type: number; home_team_id: number; away_team_id: number; date: string; start_time: Date | string; game_schedule_state: string | null; game_state: string | null; observed_at: Date | string }>;
  rosters: Array<{ player_id: string; team_id: number; official_seen_at: Date | string | null; position: string }>;
  logs: Array<{ player_id: number; game_id: string; season_id: number; team_id: number; opponent_id: number; home_road: string | null; goals: number | null; assists: number | null; pp_points: number | null;
    shots: number | null; hits: number | null; blocked_shots: number | null; penalty_minutes: number | null; start_time: Date | string }>;
  /** wgo_goalie_stats rows (one per goalie per game date); optional for reads made before goalie support. */
  goalieLogs?: Array<{ player_id: number; date: string; season_id: number; team_id: number; games_played: number | null; games_started: number | null; wins: number | null;
    saves: number | null; goals_against: number | null; shots_against: number | null; shutouts: number | null }>;
}

export async function readH10Rows(db: SqlConnection, seasonId: number, logsFrom: string): Promise<H10InputRows> {
  const games = (await db.query(H10_SQL.games, [seasonId])).rows as H10InputRows["games"];
  const rosters = (await db.query(H10_SQL.rosters, [seasonId])).rows as H10InputRows["rosters"];
  const logs = (await db.query(H10_SQL.logs, [seasonId, logsFrom])).rows as H10InputRows["logs"];
  const goalieLogs = (await db.query(H10_SQL.goalieLogs, [seasonId, logsFrom])).rows as NonNullable<H10InputRows["goalieLogs"]>;
  for (const [name, rows, limit] of [["games", games, 1500], ["rosters", rosters, 3000], ["logs", logs, 40000], ["goalie_logs", goalieLogs, 5000]] as const) if (rows.length >= limit) throw new Error(`h10_${name}_read_limit_reached`);
  return { games, rosters, logs, goalieLogs };
}

const at = (value: Date | string) => new Date(value).toISOString();
const source = (name: string, id: string, received: Instant, payload: unknown, use: SourceReference["use"] = "approved"): SourceReference =>
  ({ id, revision: contentHash(payload).slice(0, 16), sha256: contentHash(payload), source: name, use, observedAt: received, publishedAt: null, firstReceivedAt: received });
const STATE: Record<string, ScheduleGame["status"]> = { FUT: "scheduled", PRE: "scheduled", LIVE: "in_progress", CRIT: "in_progress", OVER: "final", FINAL: "final", OFF: "final" };

/** Pure mapping from rows to dated evidence. Rows that cannot be dated or mapped are counted, never guessed. */
/** First daily ingest run (UTC minute of day) at or after the game's declared end. */
export function inferredLogReceipt(start: Instant, ingestUtcMinute: number, gameHours: number): Instant {
  const end = instant(start) + gameHours * 3600000, day = Math.floor(end / 86400000) * 86400000;
  const run = day + ingestUtcMinute * 60000;
  return new Date(run >= end ? run : run + 86400000).toISOString();
}

export function h10InputsFromRows(rows: H10InputRows, options: { asOf: Instant; seasonId: number; logIngestUtcMinute: number; gameHours: number; rosterMaxAgeHours: number }) {
  const cutoff = instant(options.asOf), dropped: Record<string, number> = {};
  const drop = (reason: string, count = 1) => { if (count > 0) dropped[reason] = (dropped[reason] ?? 0) + count; };
  const schedule: ScheduleGame[] = [];
  for (const g of rows.games) {
    const status: ScheduleGame["status"] = g.game_schedule_state === "PPD" ? "postponed" : g.game_schedule_state === "CNCL" ? "cancelled" : g.game_schedule_state === "SUSP" ? "suspended" : STATE[g.game_state ?? "FUT"] ?? "scheduled";
    const start = g.game_schedule_state === "TBD" || g.game_schedule_state === "PPD" ? null : at(g.start_time);
    const payload = { id: g.id, start, status, home: g.home_team_id, away: g.away_team_id };
    schedule.push({ gameId: Number(g.id), seasonId: Number(g.season_id), gameType: "regular", homeTeamId: g.home_team_id, awayTeamId: g.away_team_id, sourceGameDate: g.date,
      scheduledStartAt: start, actualStartAt: null, status, revision: contentHash(payload).slice(0, 16), source: source("public.games", `games:${g.id}`, at(g.observed_at), payload),
      noPlayConfirmed: false, replacementGameId: null });
  }
  const evidence: MembershipEvidence[] = [];
  for (const r of rows.rosters) {
    // A row the official refresh never listed is kept as unverified evidence (listed, never issued), not dropped.
    const seen = r.official_seen_at ? at(r.official_seen_at) : options.asOf;
    const stale = !r.official_seen_at || cutoff - instant(seen) > options.rosterMaxAgeHours * 3600000;
    if (!r.official_seen_at) drop("roster_never_officially_seen_listed_unverified");
    const position = r.position === "G" ? "G" : r.position === "D" ? "D" : ["C", "L", "R"].includes(r.position) ? "F" : "unknown";
    const payload = { player: r.player_id, team: r.team_id, seen };
    evidence.push({ playerId: Number(r.player_id), teamId: r.team_id, position, status: "roster", effectiveAt: seen, revision: `rosters:${r.team_id}:${seen}`,
      source: source("public.rosters", `rosters:${r.player_id}`, seen, payload, stale ? "unknown" : "approved"), kind: "roster_snapshot", transactionType: null, supersedesRevision: null });
  }
  // Club abbreviations are not unique across seasons (UTA names both Utah HC, 59, and Utah Mammoth, 68), so the
  // abbreviation join returns one copy per club. Only the copy whose club and opponent played the game is kept; a
  // player/game still listed more than once is dropped whole, never picked.
  const clubs = new Map(rows.games.map(g => [g.id, [g.home_team_id, g.away_team_id]]));
  const played = rows.logs.filter(l => {
    const pair = clubs.get(l.game_id);
    const ok = !!pair && l.team_id !== l.opponent_id && pair.includes(l.team_id) && pair.includes(l.opponent_id);
    if (!ok) drop(pair ? "log_club_not_in_game" : "log_game_not_in_schedule");
    return ok;
  });
  const copies = new Map<string, number>();
  for (const l of played) copies.set(`${l.player_id}:${l.game_id}`, (copies.get(`${l.player_id}:${l.game_id}`) ?? 0) + 1);
  const logs: H10GameLog[] = [];
  for (const l of played) {
    if (copies.get(`${l.player_id}:${l.game_id}`)! > 1) { drop("log_player_game_listed_twice"); continue; }
    if (l.home_road !== "H" && l.home_road !== "R") { drop("log_home_road_unknown"); continue; }
    const values: Record<Category, number | null> = { G: l.goals, A: l.assists, PPP: l.pp_points, SOG: l.shots, HIT: l.hits, BLK: l.blocked_shots, PIM: l.penalty_minutes };
    const start = at(l.start_time), received = inferredLogReceipt(start, options.logIngestUtcMinute, options.gameHours);
    if (instant(received) > cutoff) { drop("log_not_received_by_cutoff"); continue; }
    logs.push({ playerId: l.player_id, gameId: Number(l.game_id), seasonId: l.season_id, teamId: l.team_id, opponentId: l.opponent_id, home: l.home_road === "H", gameStartAt: start, values,
      source: source("public.wgo_skater_stats", `wgo:${l.player_id}:${l.game_id}`, received, values) });
  }
  // Goalie lines carry a club and a date, not a game id: map them through the schedule. A club with two games on the
  // date is ambiguous and never mapped. The abbreviation join lists a line once per club sharing the abbreviation, so
  // the copy whose club had no game that date is dropped as an alias; a goalie/date left with no club or with more
  // than one is dropped whole.
  const byTeamDate = new Map<string, Array<H10InputRows["games"][number]>>();
  for (const g of rows.games) for (const team of [g.home_team_id, g.away_team_id]) byTeamDate.set(`${team}:${g.date}`, [...byTeamDate.get(`${team}:${g.date}`) ?? [], g]);
  const goalieGroups = new Map<string, NonNullable<H10InputRows["goalieLogs"]>>();
  for (const r of rows.goalieLogs ?? []) goalieGroups.set(`${r.player_id}:${r.date}`, [...goalieGroups.get(`${r.player_id}:${r.date}`) ?? [], r]);
  const goalieLogs: H10GoalieLog[] = [];
  for (const group of goalieGroups.values()) {
    const matched = group.filter(r => (byTeamDate.get(`${r.team_id}:${r.date}`)?.length ?? 0) > 0);
    if (matched.length === 0) { drop("goalie_line_without_game", group.length); continue; }
    drop("goalie_line_alias_club_without_game", group.length - matched.length);
    if (matched.length > 1) { drop("goalie_line_several_clubs_played", matched.length); continue; }
    const r = matched[0], candidates = byTeamDate.get(`${r.team_id}:${r.date}`)!;
    if (candidates.length > 1) { drop("goalie_line_club_several_games_on_date"); continue; }
    const g = candidates[0];
    if (r.games_played !== 1) { drop("goalie_line_not_one_game"); continue; }
    const start = at(g.start_time), received = inferredLogReceipt(start, options.logIngestUtcMinute, options.gameHours);
    if (instant(received) > cutoff) { drop("log_not_received_by_cutoff"); continue; }
    const values = { SAVES: r.saves, SHOTS_AGAINST: r.shots_against, GOALS_ALLOWED: r.goals_against, WIN: r.wins, SHUTOUT: r.shutouts };
    goalieLogs.push({ playerId: r.player_id, gameId: Number(g.id), seasonId: r.season_id, teamId: r.team_id, opponentId: g.home_team_id === r.team_id ? g.away_team_id : g.home_team_id,
      home: g.home_team_id === r.team_id, gameStartAt: start, started: r.games_started === 1, values, source: source("public.wgo_goalie_stats", `wgo-goalie:${r.player_id}:${g.id}`, received, values) });
  }
  return { schedule, evidence, logs, goalieLogs, dropped, limitations: [...H10_INPUT_LIMITATIONS] };
}
