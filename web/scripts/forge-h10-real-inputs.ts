/**
 * Real-data inputs for the local H1–H10 scripts: the TJ-approved bounded reads (CSV, manifest-verified) and the
 * public NHL observations saved beside them. Shared by the G2 dry run and the archive rehearsal.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { H10InputRows } from "../lib/forge-v2/h10Reader.server";

export function verified(dir: string) {
  const manifest = new Map(readFileSync(join(dir, "MANIFEST.sha256"), "utf8").trim().split("\n").map(line => { const [h, p] = line.split(/\s+/); return [p.replace(/^\.\//, ""), h] as const; }));
  return (name: string) => {
    const bytes = new Uint8Array(readFileSync(join(dir, name)));
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.get(name)) throw new Error(`${name} fails MANIFEST.sha256`);
    return Buffer.from(bytes).toString("utf8");
  };
}
export const csv = (text: string) => {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const keys = head.split(",");
  return lines.map(line => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v === "" ? null : v])) as Record<string, string | null>);
};
/** Postgres text timestamps ("2026-09-29 21:00:00+00", with optional fractional seconds) as ISO instants. */
export const ts = (v: string | null) => v === null ? null : new Date(v.replace(" ", "T").replace(/\+00$/, "Z")).toISOString();
export const num = (v: string | null) => v === null ? null : Number(v);


/** The approved reads as reader rows (q1–q3 and goalie read #2). */
export function realRows(packet: string) {
  const read = verified(join(packet, "read-results-20261123")), goalieRead = verified(join(packet, "read-results-goalies-20261123"));
  const rows: H10InputRows = {
    games: csv(read("q1.csv")).map(r => ({ id: r.id!, season_id: r.season_id!, type: Number(r.type), home_team_id: Number(r.home_team_id), away_team_id: Number(r.away_team_id), date: r.date!,
      start_time: ts(r.start_time)!, game_schedule_state: r.game_schedule_state, game_state: r.game_state, observed_at: ts(r.observed_at)! })),
    rosters: csv(read("q2.csv")).map(r => ({ player_id: r.player_id!, team_id: Number(r.team_id), official_seen_at: ts(r.official_seen_at), position: r.position! })),
    logs: csv(read("q3.csv")).map(r => ({ player_id: Number(r.player_id), game_id: r.game_id!, season_id: Number(r.season_id), team_id: Number(r.team_id), opponent_id: Number(r.opponent_id), home_road: r.home_road,
      goals: num(r.goals), assists: num(r.assists), pp_points: num(r.pp_points), shots: num(r.shots), hits: num(r.hits), blocked_shots: num(r.blocked_shots), penalty_minutes: num(r.penalty_minutes), start_time: ts(r.start_time)! })),
    // Read #2 (approved 2026-11-23): the route's goalie-line SELECT, run once by Chef.
    goalieLogs: csv(goalieRead("g1.csv")).map(r => ({ player_id: Number(r.player_id), date: r.date!, season_id: Number(r.season_id), team_id: Number(r.team_id),
      games_played: num(r.games_played), games_started: num(r.games_started), wins: num(r.wins), saves: num(r.saves), goals_against: num(r.goals_against), shots_against: num(r.shots_against), shutouts: num(r.shutouts) })),
  };
  return rows;
}
