/** Synthetic league for the FORGE H1–H10 producer proofs. It is fixture evidence only: no real outcomes, and nothing
 * here is a forecast of a real game. Team ids are the 32 NHL ids in Astra's receipts. Larkin, Dach and
 * Montembeault keep their real NHL ids on DET 17 / MTL 8 so the trade proof reads like the audit. */
import { Category, Instant, ScheduleGame, SourceReference } from "./contracts";
import { MembershipEvidence } from "./denominator";
import { contentHash } from "./hash.server";
import { H10GameLog } from "./h10Features";
import { H10GoalieLog } from "./h10Goalies";

export const H10_TEAMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 52, 54, 55, 68];
export const H10_SEASON = 20262027;
export const LARKIN = 8477946, DACH = 8481523, MONTEMBEAULT = 8478470, DET = 17, MTL = 8;
const HOUR = 3600000, DAY = 24 * HOUR;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const iso = (ms: number) => new Date(ms).toISOString();
export const syntheticSource = (id: string, at: Instant, payload: unknown, source = "fixture"): SourceReference =>
  ({ id, revision: contentHash(payload).slice(0, 16), sha256: contentHash(payload), source, use: "approved", observedAt: at, publishedAt: null, firstReceivedAt: at });

export interface H10League { teams: number[]; roster: Array<{ playerId: number; teamId: number; position: "F" | "D" | "G" }>; schedule: ScheduleGame[]; logs: H10GameLog[]; goalieLogs: H10GoalieLog[]; evidence: MembershipEvidence[]; rosterAt: Instant }

/** `teams` clubs; every club plays once a day from `pastDays` before `anchor` to `futureDays` after it. Each team has 25
 * players (2–3 goalies at full scale, 731 skaters and 73 goalies over 32 teams). */
export function syntheticLeague(options: { anchor: number; teams?: number; pastDays?: number; futureDays?: number; seed?: number }): H10League {
  const count = options.teams ?? 32, teams = count === 32 ? [...H10_TEAMS] : [DET, MTL, ...H10_TEAMS.filter(t => t !== DET && t !== MTL)].slice(0, count), past = options.pastDays ?? 20, future = options.futureDays ?? 14, random = rng(options.seed ?? 20261123);
  if (teams.length % 2 || !teams.includes(DET) || !teams.includes(MTL)) throw new Error("league must have an even number of clubs including DET and MTL");
  const roster: H10League["roster"] = [];
  let next = 8490000;
  teams.forEach((teamId, index) => {
    const goalies = teams.length === 32 ? (index < 9 ? 3 : 2) : 2, skaters = teams.length === 32 ? (index < 27 ? 23 : 22) : 23;
    for (let i = 0; i < skaters; i++) roster.push({ playerId: next++, teamId, position: i < 15 ? "F" : "D" });
    for (let i = 0; i < goalies; i++) roster.push({ playerId: next++, teamId, position: "G" });
  });
  // Real ids for the trade proof, replacing synthetic slots on their original clubs.
  const swap = (teamId: number, position: "F" | "G", playerId: number) => { const slot = roster.find(p => p.teamId === teamId && p.position === position && p.playerId >= 8490000); slot!.playerId = playerId; };
  swap(DET, "F", LARKIN); swap(MTL, "F", DACH); swap(MTL, "G", MONTEMBEAULT);
  const rosterAt = iso(options.anchor - 2 * DAY);
  const evidence: MembershipEvidence[] = roster.map(p => ({ playerId: p.playerId, teamId: p.teamId, position: p.position, status: "roster", effectiveAt: rosterAt,
    revision: `roster:${p.teamId}:${rosterAt}`, source: syntheticSource(`roster:${p.teamId}`, rosterAt, { teamId: p.teamId, at: rosterAt }), kind: "roster_snapshot", transactionType: null, supersedesRevision: null }));
  const schedule: ScheduleGame[] = [], logs: H10GameLog[] = [], goalieLogs: H10GoalieLog[] = [];
  const scheduleAt = iso(options.anchor - (past + 2) * DAY);
  const skill = new Map(roster.map(p => [p.playerId, 0.3 + random()]));
  let gameNo = 1;
  for (let d = -past; d < future; d++) {
    const start = options.anchor + d * DAY + 6 * HOUR; // every future game starts at least 6 h after the anchor
    // Round-robin pairing that rotates daily, so a club meets a different opponent most nights.
    const order = [teams[0], ...teams.slice(1).map((_, i, rest) => rest[(i + ((d % rest.length) + rest.length)) % rest.length])];
    for (let i = 0; i < order.length / 2; i++) {
      const a = order[i], b = order[order.length - 1 - i], home = (d + i) % 2 === 0 ? a : b, away = home === a ? b : a;
      const gameId = 2026020000 + gameNo++, startAt = iso(start + (i % 3) * 30 * 60000);
      schedule.push({ gameId, seasonId: H10_SEASON, gameType: "regular", homeTeamId: home, awayTeamId: away, sourceGameDate: startAt.slice(0, 10), scheduledStartAt: startAt,
        actualStartAt: d < 0 ? startAt : null, status: d < 0 ? "final" : "scheduled", revision: "schedule-1", source: syntheticSource("nhl-schedule", scheduleAt, { gameId }), noPlayConfirmed: false, replacementGameId: null });
      if (d >= 0) continue;
      const receivedAt = iso(Date.parse(startAt) + 4 * HOUR);
      for (const [teamId, opponentId] of [[home, away], [away, home]]) {
        // The first 18 skaters dress every game; the rest never do (sparse-history players, kept in the denominator).
        const dressed = roster.filter(p => p.teamId === teamId && p.position !== "G").slice(0, 18);
        for (const p of dressed) {
          const s = skill.get(p.playerId)!, r = () => random();
          const G = r() < 0.11 * s ? 1 : 0, A = r() < 0.18 * s ? 1 + (r() < 0.15 ? 1 : 0) : 0, PPP = G + A > 0 && r() < 0.3 ? 1 : 0;
          const values: Record<Category, number> = { G, A, PPP, SOG: Math.floor(r() * 5 * s), HIT: Math.floor(r() * 3), BLK: Math.floor(r() * (p.position === "D" ? 3 : 1.5)), PIM: r() < 0.12 ? 2 : 0 };
          logs.push({ playerId: p.playerId, gameId, seasonId: H10_SEASON, teamId, opponentId, home: teamId === home, gameStartAt: startAt, values,
            source: syntheticSource(`wgo-skater:${p.playerId}:${gameId}`, receivedAt, values) });
        }
      }
      // Each club's starter (rotating through its goalies) faces the opponent's shots and goals from the lines above.
      const line = (teamId: number) => logs.filter(l => l.gameId === gameId && l.teamId === teamId);
      const goals = (teamId: number) => line(teamId).reduce((s, l) => s + (l.values.G ?? 0), 0), shots = (teamId: number) => line(teamId).reduce((s, l) => s + (l.values.SOG ?? 0), 0);
      for (const [teamId, opponentId] of [[home, away], [away, home]]) {
        const goalies = roster.filter(p => p.teamId === teamId && p.position === "G"), starter = goalies[((d % goalies.length) + goalies.length) % goalies.length];
        const against = Math.max(shots(opponentId), goals(opponentId)), allowed = goals(opponentId), scored = goals(teamId);
        const values = { SAVES: against - allowed, SHOTS_AGAINST: against, GOALS_ALLOWED: allowed, WIN: scored > allowed || scored === allowed && teamId === home ? 1 : 0, SHUTOUT: allowed === 0 ? 1 : 0 };
        goalieLogs.push({ playerId: starter.playerId, gameId, seasonId: H10_SEASON, teamId, opponentId, home: teamId === home, gameStartAt: startAt, started: true, values,
          source: syntheticSource(`wgo-goalie:${starter.playerId}:${gameId}`, receivedAt, values) });
      }
    }
  }
  return { teams, roster, schedule, logs, goalieLogs, evidence, rosterAt };
}

/** The 2026-11-22 trade as official transactions: Larkin DET→MTL, Dach and Montembeault MTL→DET. */
export function syntheticTrade(effectiveAt: Instant, receivedAt: Instant): MembershipEvidence[] {
  return ([[LARKIN, MTL, "F"], [DACH, DET, "F"], [MONTEMBEAULT, DET, "G"]] as const).map(([playerId, teamId, position]) => ({
    playerId, teamId, position, status: "roster", effectiveAt, revision: `trade:${playerId}:${effectiveAt}`,
    source: syntheticSource("nhl-transactions", receivedAt, { playerId, teamId, effectiveAt }), kind: "official_transaction", transactionType: "trade", supersedesRevision: null }));
}

/** Minimal public tables with the production column names the reader SQL uses (baseline schema plus
 * 20261107192933 official_seen_at, 20261113180000 game state columns and 20260919005608 original_tweet_id). */
export const H10_PUBLIC_TABLES = `
create type "NHL_Position_Code" as enum ('C','L','R','D','G');
create table public.teams (id smallint primary key, created_at timestamptz not null default now(), name text not null, abbreviation character(3) not null);
create table public.players (id bigint primary key, "fullName" text not null, position "NHL_Position_Code" not null);
create table public.games (id bigint primary key, date date not null, "seasonId" bigint not null, "startTime" timestamptz not null, type smallint, created_at timestamptz not null default now(),
  "homeTeamId" smallint not null, "awayTeamId" smallint not null, game_state text, game_schedule_state text, game_state_observed_at timestamptz);
create table public.rosters ("playerId" bigint not null, "seasonId" bigint not null, created_at timestamptz not null default now(), "teamId" smallint not null, "sweaterNumber" smallint not null default 0,
  is_current boolean not null default true, ended_at timestamptz, official_seen_at timestamptz);
create table public.wgo_skater_stats (id serial primary key, player_id integer not null, date date not null, season_id integer, game_id bigint, team_abbrev text, opponent_team_abbrev text, home_road character(1),
  goals integer, assists integer, pp_points integer, shots integer, hits integer, blocked_shots integer, penalty_minutes integer, games_played integer default 1,
  toi_per_game double precision default 900);
create table public.wgo_goalie_stats (goalie_id integer not null, goalie_name text not null, date date not null, games_played integer, games_started integer, wins integer, saves integer,
  goals_against integer, shots_against integer, shutouts integer, season_id integer, team_abbreviation text, time_on_ice double precision default 3600);
create table public.forge_roster_events (event_id bigint generated by default as identity primary key, created_at timestamptz not null default now(), effective_from timestamptz not null default now(),
  event_type text not null, player_id bigint, team_id integer, confidence numeric not null default 1, payload jsonb not null default '{}', source_text text, updated_at timestamptz not null default now());
create table public.news_feed_items (id uuid primary key default gen_random_uuid(), source_review_item_id uuid, source_tweet_id text, source_url text, tweet_url text, source_label text,
  source_account text, team_id bigint, team_abbreviation text, headline text not null, blurb text not null default '', category text not null, subcategory text,
  card_status text not null default 'draft', observed_at timestamptz, published_at timestamptz, metadata jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), original_tweet_id text unique);
create table public.news_feed_item_players (id uuid primary key default gen_random_uuid(), news_item_id uuid not null references public.news_feed_items(id), player_id integer,
  player_name text not null, team_id integer, role text not null default 'subject', created_at timestamptz not null default now(), updated_at timestamptz not null default now());`;

/** Loads a synthetic league into the minimal public tables (club abbreviations T01…); rosters are officially seen
 * two hours before `cutoff`. */
export async function seedH10Public(admin: { query: (text: string, values?: unknown[]) => Promise<unknown> }, league: H10League, cutoff: number) {
  await admin.query(H10_PUBLIC_TABLES);
    const abbrev = (id: number) => `T${String(id).padStart(2, "0")}`;
  for (const id of league.teams) await admin.query("insert into public.teams (id, name, abbreviation) values ($1, $2, $3)", [id, `Team ${id}`, abbrev(id)]);
  const seen = new Date(cutoff - 2 * 3600000).toISOString(), created = new Date(cutoff - 3 * 86400000).toISOString();
  for (const p of league.roster) {
    await admin.query("insert into public.players (id, \"fullName\", position) values ($1, $2, $3)", [p.playerId, `P${p.playerId}`, p.position === "F" ? "C" : p.position]);
    await admin.query("insert into public.rosters (\"playerId\", \"seasonId\", \"teamId\", official_seen_at) values ($1, $2, $3, $4)", [p.playerId, H10_SEASON, p.teamId, seen]);
  }
  for (const g of league.schedule) await admin.query("insert into public.games (id, date, \"seasonId\", \"startTime\", type, created_at, \"homeTeamId\", \"awayTeamId\", game_state, game_schedule_state) values ($1,$2,$3,$4,2,$5,$6,$7,$8,'OK')",
    [g.gameId, g.sourceGameDate, H10_SEASON, g.scheduledStartAt, created, g.homeTeamId, g.awayTeamId, g.status === "final" ? "OFF" : "FUT"]);
  for (const l of league.logs) await admin.query("insert into public.wgo_skater_stats (player_id, date, season_id, game_id, team_abbrev, opponent_team_abbrev, home_road, goals, assists, pp_points, shots, hits, blocked_shots, penalty_minutes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    [l.playerId, l.gameStartAt.slice(0, 10), H10_SEASON, l.gameId, abbrev(l.teamId), abbrev(l.opponentId), l.home ? "H" : "R", l.values.G, l.values.A, l.values.PPP, l.values.SOG, l.values.HIT, l.values.BLK, l.values.PIM]);
  for (const g of league.goalieLogs) await admin.query("insert into public.wgo_goalie_stats (goalie_id, goalie_name, date, games_played, games_started, wins, saves, goals_against, shots_against, shutouts, season_id, team_abbreviation) values ($1,$2,$3,1,1,$4,$5,$6,$7,$8,$9,$10)",
    [g.playerId, `G${g.playerId}`, g.gameStartAt.slice(0, 10), g.values.WIN, g.values.SAVES, g.values.GOALS_ALLOWED, g.values.SHOTS_AGAINST, g.values.SHUTOUT, H10_SEASON, abbrev(g.teamId)]);
}
