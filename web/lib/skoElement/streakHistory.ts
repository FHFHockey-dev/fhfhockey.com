import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { csvParse } from "d3";

export interface StreakGame {
  id: string; date: string; team: string; opponent: string; segment: string; points: number;
  recent: number | null; reference: number | null; state: string; breach: string;
  confirmation: string; exit: string; episode: string; startUnknown: boolean; boundary: string;
}
export interface StreakPlayer { id: string; name: string; season: string }
interface PlayerHistory extends StreakPlayer { games: StreakGame[] }
let cache: { mtime: number; players: PlayerHistory[] } | undefined;
const value = (raw: string | undefined) => raw?.trim() && Number.isFinite(Number(raw)) ? Number(raw) : null;

/** Development server only. The parent research export owns identity and episode rules. */
export async function readStreakHistory() {
  const file = path.resolve(process.cwd(), "../tasks/artifacts/sko-streak-indicators-2026-11-18/parent-v1/games.csv.gz");
  const { mtimeMs } = await stat(file);
  if (cache?.mtime === mtimeMs) return cache.players;
  const rows = csvParse(gunzipSync(Uint8Array.from(await readFile(file))).toString("utf8"));
  const bySeason = new Map<string, PlayerHistory>();
  for (const row of rows) {
    const key = row.player_id + "/" + row.season_id;
    let player = bySeason.get(key);
    if (!player) {
      player = { id: row.player_id, name: row.player_name, season: row.season_id, games: [] };
      bySeason.set(key, player);
    }
    const points = value(row.points);
    if (points === null) throw new Error("Played appearance is missing its points value");
    player.games.push({
      id: row.game_id, date: row.date, team: row.team, opponent: row.opponent, segment: row.segment, points,
      recent: value(row.recent), reference: value(row.reference), state: row.state, breach: row.breach,
      confirmation: row.confirmation, exit: row.exit, episode: row.episode_id,
      startUnknown: /^(true|1)$/i.test(row.start_unknown), boundary: row.boundary_reason,
    });
  }
  const players = [...bySeason.values()].sort((a, b) => a.name.localeCompare(b.name) || a.season.localeCompare(b.season));
  cache = { mtime: mtimeMs, players };
  return players;
}
