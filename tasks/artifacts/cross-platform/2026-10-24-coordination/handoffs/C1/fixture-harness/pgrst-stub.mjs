// Fixture-only PostgREST stand-in for C1 screenshots. No network beyond 127.0.0.1.
import http from "node:http";
import fs from "node:fs";

const PORT = Number(process.env.STUB_PORT ?? 54399);
const LOG = process.env.STUB_LOG ?? new URL("./stub-requests.log", import.meta.url).pathname;
const SEASON = 20252026;

const teams = { 22: "Edmonton Oilers", 10: "Toronto Maple Leafs", 8: "Montreal Canadiens", 6: "Boston Bruins", 7: "Buffalo Sabres" };
const summaries = Object.entries(teams).flatMap(([id, name]) =>
  [SEASON, 20242025].map((season_id, i) => ({
    season_id, team_id: Number(id), team_full_name: name,
    games_played: 82 - i * 0, wins: 45 + i, losses: 28, ot_losses: 9 - i, points: 99 + i,
    goals_for: 280, goals_against: 250, goals_for_per_game: 3.41, goals_against_per_game: 3.05,
    shots_for_per_game: 31.2, shots_against_per_game: 28.4, faceoff_win_pct: 0.52,
    penalty_kill_pct: 0.79, power_play_pct: 0.25, regulation_and_ot_wins: 40, point_pct: 0.604
  }))
);

const pid = (team, n) => 8470000 + team * 100 + n;
// EDM: 12F/6D/2G. TOR: 13F/5D/2G (mixed line shape).
const lines = {
  22: { forwards: [...Array(12)].map((_, i) => pid(22, i)), defensemen: [...Array(6)].map((_, i) => pid(22, 20 + i)), goalies: [pid(22, 30), pid(22, 31)] },
  10: { forwards: [...Array(13)].map((_, i) => pid(10, i)), defensemen: [...Array(5)].map((_, i) => pid(10, 20 + i)), goalies: [pid(10, 30), pid(10, 31)] },
  // MTL: 11F/7D (the HEAD-era borrowed-slot case).
  8: { forwards: [...Array(11)].map((_, i) => pid(8, i)), defensemen: [...Array(7)].map((_, i) => pid(8, 20 + i)), goalies: [pid(8, 30), pid(8, 31)] },
  // BOS: 14F/4D; BUF: 10F/8D.
  6: { forwards: [...Array(14)].map((_, i) => pid(6, i)), defensemen: [...Array(4)].map((_, i) => pid(6, 20 + i)), goalies: [pid(6, 30), pid(6, 31)] },
  7: { forwards: [...Array(10)].map((_, i) => pid(7, i)), defensemen: [...Array(8)].map((_, i) => pid(7, 20 + i)), goalies: [pid(7, 30), pid(7, 31)] }
};
const posFor = (n) => (n >= 30 ? "G" : n >= 20 ? "D" : ["LW", "C", "RW"][n % 3]);
const players = Object.fromEntries(
  Object.keys(lines).flatMap((team) =>
    Object.values(lines[team]).flat().map((id) => {
      const n = (id - 8470000) % 100;
      const pos = posFor(n);
      return [String(id), { nhl_player_id: String(id), nhl_player_name: `Fixture ${teams[team].split(" ").pop()} ${n + 1}`, mapped_position: pos, eligible_positions: JSON.stringify([pos]) }];
    })
  )
);

// Regular-season games 2025020001..10 plus one playoff game per team.
const games = Object.keys(teams).flatMap((team) => [
  ...[...Array(10)].map((_, i) => ({ id: 2025020001 + i + Number(team) * 20, hometeamid: Number(team), awayteamid: 99, season: String(SEASON) })),
  { id: 2025030111 + Number(team), hometeamid: 99, awayteamid: Number(team), season: String(SEASON) }
]);
const TYPES = ["goal", "shot-on-goal", "missed-shot", "blocked-shot", "hit"];
function playsFor(gameId) {
  const g = games.find((x) => x.id === gameId);
  if (!g) return [];
  const out = [];
  let seed = gameId % 9973;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const owner = i % 2 ? g.hometeamid : g.awayteamid;
    out.push({ gameid: gameId, eventownerteamid: owner, typedesckey: TYPES[Math.floor(rnd() * TYPES.length)],
      xcoord: Math.round((rnd() * 2 - 1) * 89), ycoord: Math.round((rnd() * 2 - 1) * 40), hometeamdefendingside: "left" });
  }
  return out;
}

function inList(v) { return v?.startsWith("in.(") ? v.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, "")) : null; }

function rowsFor(table, q) {
  switch (table) {
    case "team_summary_years": {
      const id = Number((q.get("team_id") ?? "").replace("eq.", ""));
      return summaries.filter((r) => !id || r.team_id === id).sort((a, b) => b.season_id - a.season_id);
    }
    case "seasons":
      return [{ id: SEASON, startDate: "2025-10-07", regularSeasonEndDate: "2026-04-16", endDate: "2026-06-20", numberOfGames: 82 },
        { id: 20242025, startDate: "2024-10-04", regularSeasonEndDate: "2025-04-17", endDate: "2025-06-17", numberOfGames: 82 }];
    case "lineCombinations": {
      const id = Number((q.get("teamId") ?? "").replace("eq.", ""));
      return lines[id] ? [{ ...lines[id], gameId: 2025020010 + id * 20 }] : [];
    }
    case "yahoo_nhl_player_map": {
      const ids = inList(q.get("nhl_player_id")) ?? [];
      return ids.map((id) => players[id]).filter(Boolean);
    }
    case "pbp_games": {
      const m = (q.get("or") ?? "").match(/hometeamid\.eq\.(\d+)/);
      const id = m ? Number(m[1]) : 0;
      return games.filter((g) => g.hometeamid === id || g.awayteamid === id);
    }
    case "pbp_plays": {
      const ids = (inList(q.get("gameid")) ?? []).map(Number);
      const types = inList(q.get("typedesckey"));
      return ids.flatMap(playsFor).filter((p) => !types || types.includes(p.typedesckey));
    }
    default:
      return [];
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Expose-Headers": "Content-Range" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const m = url.pathname.match(/^\/rest\/v1\/([^/]+)/);
  const table = m ? decodeURIComponent(m[1]) : url.pathname;
  fs.appendFileSync(LOG, `${new Date().toISOString()} ${req.method} ${table} ${url.search}\n`);
  if (!m) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end("{}"); }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, cors); return res.end(); }
  let rows = rowsFor(table, url.searchParams);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.get("limit");
  rows = rows.slice(offset, limit == null ? undefined : offset + Number(limit));
  const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
  if (single && rows.length !== 1) { res.writeHead(406, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ code: "PGRST116", message: "fixture: no single row" })); }
  res.writeHead(200, { ...cors, "Content-Type": "application/json", "Content-Range": `${offset}-${offset + rows.length - 1}/*` });
  res.end(JSON.stringify(single ? rows[0] : rows));
}).listen(PORT, "127.0.0.1", () => console.log(`stub on ${PORT}, log ${LOG}`));
