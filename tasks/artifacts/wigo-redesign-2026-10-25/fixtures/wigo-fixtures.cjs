// Fictional-data PostgREST emulator for WiGO layout evidence. Every Supabase REST/RPC request the page makes is
// answered from deterministic, schema-shaped fictional rows; every other non-loopback request is aborted and logged.
// These numbers are layout fixtures only: they are not internally consistent stats and prove nothing about accuracy.
const fs = require("node:fs");
const path = require("node:path");

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "schema.json"), "utf8"));
const SUBJECT_ID = 9900001;
const TEAM_ID = 23; // VAN
const SEASON = 20252026;
const SEASONS = [20212022, 20222023, 20232024, 20242025, 20252026];
const PEOPLE = [
  [SUBJECT_ID, "Alex", "Fictional", "C"],
  [9900002, "Jordan", "Placeholder", "L"],
  [9900003, "Casey", "Samplesson", "D"],
  [9900004, "Riley", "Fixture", "R"],
  [9900005, "Morgan", "Testerov", "C"],
];

const TEAMS = [[1,"NJD"],[2,"NYI"],[3,"NYR"],[4,"PHI"],[5,"PIT"],[6,"BOS"],[7,"BUF"],[8,"MTL"],[9,"OTT"],[10,"TOR"],[12,"CAR"],[13,"FLA"],[14,"TBL"],[15,"WSH"],[16,"CHI"],[17,"DET"],[18,"NSH"],[19,"STL"],[20,"CGY"],[21,"COL"],[22,"EDM"],[23,"VAN"],[24,"ANA"],[25,"DAL"],[26,"LAK"],[28,"SJS"],[29,"CBJ"],[30,"MIN"],[52,"WPG"],[54,"VGK"],[55,"SEA"],[68,"UTA"]];
// Circle-method round robin: every team plays once on each of 82 fixture dates, so team tables are complete.
const LEAGUE_GAMES = [];
for (let d = 0; d < 82; d++) {
  const order = [TEAMS[0], ...TEAMS.slice(1).map((_, i) => TEAMS[1 + ((i + d) % 31)])];
  for (let k = 0; k < 16; k++) {
    const [a, b] = [order[k], order[31 - k]];
    LEAGUE_GAMES.push({ id: 990000001 + LEAGUE_GAMES.length, date: null, d, home: d % 2 ? a : b, away: d % 2 ? b : a });
  }
}

const hash = text => {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};
const dateFor = index => new Date(Date.UTC(2025, 9, 8) + Math.round(index * 2.2) * 86400000).toISOString().slice(0, 10);
const isDateColumn = column => /^(date|game_date|date_scraped|gameDate|startTime)$/.test(column);
const entityColumns = ["player_id", "playerId", "team_id", "teamId", "id", "goalie_id"];

function value(table, column, type, row) {
  const r = hash(`${table}.${column}.${row.__i}.${row.__entity}`);
  if (column in row) return row[column];
  if (isDateColumn(column)) return row.__date ?? dateFor(row.__i);
  if (/season/i.test(column)) return /string/.test(type) ? String(row.__season) : row.__season;
  if (/^(player_id|playerId|goalie_id)$/.test(column)) return row.__entity;
  if (/^game_?id$|^gameId$/i.test(column)) return 990000001 + row.__i;
  if (/^(team_id|teamId|current_team_id)$/.test(column)) return row.__team ?? TEAM_ID;
  if (/opponent.*id|_team_id$/.test(column)) return 1 + Math.floor(r * 32);
  if (type.includes("boolean")) return false;
  if (type.includes("Json")) return {};
  if (!type.includes("number")) {
    if (/abbrev/.test(column)) return "VAN";
    if (/team.*name|team_full/.test(column)) return "Vancouver Canucks";
    if (/position/i.test(column)) return row.__position ?? "C";
    if (/first/i.test(column)) return row.__first ?? "Sam";
    if (/last/i.test(column)) return row.__last ?? "Sample";
    if (/full|name/i.test(column)) return `${row.__first ?? "Sam"} ${row.__last ?? "Sample"}`;
    if (/image|url|headshot/.test(column)) return null;
    if (/birth_?date|birthDate/i.test(column)) return "1998-04-12";
    if (/shoots|catches/.test(column)) return "L";
    if (/home_road|homeRoad/i.test(column)) return r > 0.5 ? "H" : "R";
    if (/date|_at$/.test(column)) return row.__date ?? dateFor(row.__i);
    return "fixture";
  }
  const window = row.__games ?? 1;
  if (/(^|_)gp$|games_played|^numgames$|^count$/.test(column)) {
    const prefix = column.match(/^(l5|l10|l20)_/);
    return prefix ? Number(prefix[1].slice(1)) : row.__games ?? 76;
  }
  if (/height/i.test(column)) return 185;
  if (/weight/i.test(column)) return 88;
  if (/sweater|number/.test(column)) return 17;
  if (/(^|_)ipp$/.test(column)) return Number((0.5 + r * 0.4).toFixed(3));
  if (/pct|percentage|_percent|^sh_|shooting/.test(column)) return Number((0.25 + r * 0.5).toFixed(3));
  if (/atoi/.test(column)) return Number((15 + r * 7).toFixed(2));
  if (/pp.*toi|toi.*pp/.test(column)) return Math.round(90 + r * 180) * (window > 1 && !/per_game|pct/.test(column) ? window : 1);
  if (/toi/.test(column)) return Math.round(1000 + r * 400) * (window > 1 && !/per_game|per_gp|avg/.test(column) ? window : 1);
  if (/per_60|_60$|per60/.test(column)) return Number((0.4 + r * 3).toFixed(2));
  if (/per_game|per_gp|^avg/.test(column)) return Number((r * 1.2).toFixed(2));
  if (/rank/.test(column)) return 1 + Math.floor(r * 400);
  if (/x?g[af]$|xg|cf$|ca$|ff$|fa$|sf$|sa$|scf|sca|hdcf|hdca/.test(column)) return Number(((5 + r * 20) * window / 10).toFixed(2));
  if (/game_score/.test(column)) return Number((r * 3 - 0.5).toFixed(2));
  if (/plus_minus|plusminus/.test(column)) return Math.round((r - 0.5) * 4);
  return Math.round(r * 3 * window);
}

function baseRows(table, filters) {
  const columns = schema[table] ?? {};
  const names = Object.keys(columns);
  const eq = Object.fromEntries(filters.filter(f => f.op === "eq").map(f => [f.column, f.value]));
  const entityColumn = entityColumns.find(column => column in eq && names.includes(column));
  const seasonColumn = ["season", "season_id", "seasonId", "season_id_int"].find(column => names.includes(column)) ?? names.find(column => /season/i.test(column));
  const dated = names.some(isDateColumn);
  const teamTable = /team/.test(table) && !names.includes("player_id");
  const rows = [];
  const push = extra => rows.push({ __i: rows.length, __season: SEASON, ...extra });
  if (table === "players") {
    for (const [id, first, last, position] of PEOPLE)
      push({ __entity: id, id, firstName: first, lastName: last, fullName: `${first} ${last}`, position, sweater_number: 17, team_id: TEAM_ID, birthDate: "1998-04-12", heightInCentimeters: 185, weightInKilograms: 88, image_url: null, __first: first, __last: last, __position: position });
    return rows;
  }
  if (table === "games") {
    for (const g of LEAGUE_GAMES)
      push({ __entity: g.id, id: g.id, date: dateFor(g.d), seasonId: SEASON, type: 2, homeTeamId: g.home[0], awayTeamId: g.away[0], startTime: `${dateFor(g.d)}T23:00:00Z` });
    return rows;
  }
  if (table === "nst_team_5v5") {
    for (const g of LEAGUE_GAMES) for (const [id, abbrev] of [g.home, g.away]) {
      const r = k => hash(`${k}${g.id}${id}`);
      push({ __entity: id, __team: id, team_abbreviation: abbrev, date: dateFor(g.d), gp: 1, xgf: Number((1.6 + r("xgf") * 1.6).toFixed(2)), xga: Number((1.6 + r("xga") * 1.6).toFixed(2)), gf: Math.floor(r("gf") * 4) });
    }
    return rows;
  }
  if (table === "wgo_team_stats") {
    for (const g of LEAGUE_GAMES) for (const [id] of [g.home, g.away]) {
      const r = k => hash(`${k}${g.id}${id}`);
      const opp = 1 + Math.floor(r("o") * 4), sh = 1 + Math.floor(r("s") * 4);
      push({ __entity: id, __team: id, team_id: id, game_id: g.id, date: dateFor(g.d), season_id: SEASON, pp_opportunities: opp, power_play_goals_for: Math.floor(r("p") * (opp + 1) * 0.5), times_shorthanded: sh, pp_goals_against: Math.floor(r("k") * (sh + 1) * 0.4) });
    }
    return rows;
  }
  const entity = entityColumn ? Number(eq[entityColumn]) : null;
  const season = seasonColumn && eq[seasonColumn] ? Number(eq[seasonColumn]) : SEASON;
  if (entity && dated) {
    for (let i = 0; i < 76; i++) push({ __entity: entity, __season: season, __team: teamTable ? entity : TEAM_ID, games_played: 1, game_type: 2, __pergame: true });
  } else if (entity && table.startsWith("wigo_")) {
    push({ __entity: entity, __season: season, __games: 76 });
  } else if (entity) {
    for (const s of seasonColumn && eq[seasonColumn] ? [season] : SEASONS) push({ __entity: entity, __season: s, __games: s === SEASON ? 76 : 80 });
  } else if (teamTable && dated) {
    for (let d = 0; d < 30; d++) for (let t = 1; t <= 32; t++) push({ __entity: t, __team: t, __date: dateFor(d * 2), __season: season });
  } else if (teamTable) {
    for (let t = 1; t <= 32; t++) push({ __entity: t, __team: t, __season: season, __games: 76 });
  } else {
    for (let p = 0; p < 420; p++) push({ __entity: p === 0 ? SUBJECT_ID : 9910000 + p, __season: season, __games: 20 + (p % 60) });
  }
  return rows;
}

function materialize(table, rows, select) {
  const columns = schema[table] ?? {};
  const wanted = !select || select.trim() === "*" ? Object.keys(columns) : select.split(",").map(c => c.trim().split(":").pop().split("::")[0]).filter(c => c && !c.includes("("));
  return rows.map(row => Object.fromEntries(wanted.map(column => [column, value(table, column, columns[column] ?? "number", row)])));
}

function parseFilters(params) {
  const filters = [];
  for (const [column, raw] of params) {
    if (["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"].includes(column)) continue;
    const match = raw.match(/^(not\.)?(\w+)\.(.*)$/);
    if (match) filters.push({ column, negate: !!match[1], op: match[2], value: match[3] });
  }
  return filters;
}

function applyFilters(table, rows, filters) {
  const columns = schema[table] ?? {};
  const test = (v, f) => {
    if (v === undefined) return true;
    switch (f.op) {
      case "eq": return String(v) === f.value;
      case "neq": return String(v) !== f.value;
      case "gt": return v > (typeof v === "number" ? Number(f.value) : f.value);
      case "gte": return v >= (typeof v === "number" ? Number(f.value) : f.value);
      case "lt": return v < (typeof v === "number" ? Number(f.value) : f.value);
      case "lte": return v <= (typeof v === "number" ? Number(f.value) : f.value);
      case "in": return f.value.replace(/^\(|\)$/g, "").split(",").map(s => s.replace(/"/g, "")).includes(String(v));
      case "is": return f.value === "null" ? v === null : true;
      case "ilike": case "like": return new RegExp(f.value.replace(/[%*]/g, ".*"), "i").test(String(v));
      default: return true;
    }
  };
  return rows.filter(row => filters.every(f => f.negate !== test(f.column in columns || f.column in row ? value(table, f.column, columns[f.column] ?? "number", row) : undefined, f)));
}

function rpc(name, body) {
  if (name === "get_skater_game_scores_for_season")
    return Array.from({ length: 76 }, (_, i) => ({ game_date: dateFor(i), game_score: Number((hash(`gs${i}`) * 3 - 0.4).toFixed(2)) }));
  if (name === "get_skaters_avg_stats")
    return Array.from({ length: 420 }, (_, p) => {
      const id = p === 0 ? SUBJECT_ID : 9910000 + p;
      const r = k => Number((hash(`${k}${p}`) * (k === "avgplusminus" ? 1 : 2)).toFixed(3));
      return { id, avggoals: r("avggoals") / 3, avgassists: r("avgassists") / 2, avgplusminus: r("avgplusminus") - 0.5, avgpim: r("avgpim") / 2, avghits: r("avghits") * 1.5, avgblockedshots: r("avgblockedshots"), avgpowerplaypoints: r("avgpowerplaypoints") / 4, avgshots: r("avgshots") * 2, numgames: 20 + (p % 60) };
    });
  return [];
}

async function installWigoFixtures(page, log = () => {}, options = {}) {
  if (options.longName) PEOPLE[0] = [SUBJECT_ID, "Jean-Christophe", "Beauvillier-Johnson", "D"];
  else PEOPLE[0] = [SUBJECT_ID, "Alex", "Fictional", "C"];
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (url.pathname.includes("/rest/v1/")) {
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,HEAD", "access-control-expose-headers": "content-range" } });
      if (!["GET", "HEAD", "POST"].includes(request.method()) || (request.method() === "POST" && !url.pathname.includes("/rpc/"))) {
        log({ kind: "blocked-write", method: request.method(), path: url.pathname });
        return route.abort();
      }
      const target = url.pathname.split("/rest/v1/")[1];
      let body;
      if (target.startsWith("rpc/")) {
        body = rpc(target.slice(4), request.postDataJSON?.());
      } else {
        const params = [...url.searchParams.entries()];
        const filters = parseFilters(params);
        let rows = applyFilters(target, baseRows(target, filters), filters);
        const order = url.searchParams.get("order");
        if (order) {
          const [column, direction] = order.split(",")[0].split(".");
          rows.sort((a, b) => {
            const x = a[column] ?? value(target, column, schema[target]?.[column] ?? "number", a);
            const y = b[column] ?? value(target, column, schema[target]?.[column] ?? "number", b);
            return (x > y ? 1 : x < y ? -1 : 0) * (direction === "desc" ? -1 : 1);
          });
        }
        const range = request.headers()["range"]?.match(/(\d+)-(\d+)/);
        const offset = Number(url.searchParams.get("offset") ?? range?.[1] ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? (range ? Number(range[2]) - Number(range[1]) + 1 : 1000));
        const total = rows.length;
        rows = rows.slice(offset, offset + Math.min(limit, 1000));
        body = materialize(target, rows, url.searchParams.get("select"));
        const single = /vnd\.pgrst\.object/.test(request.headers()["accept"] ?? "");
        if (single && body.length > 1) body = [body.find((row, index) => rows[index].__season === SEASON) ?? body[0]];
        log({ kind: "rest", table: target, rows: body.length, total });
        return route.fulfill({
          status: single && body.length !== 1 ? 406 : 200,
          headers: { "content-type": "application/json", "content-range": `${offset}-${offset + body.length - 1}/${total}`, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" },
          body: JSON.stringify(single ? body[0] ?? { code: "PGRST116", message: "fixture: no row" } : body),
        });
      }
      log({ kind: "rpc", name: target, rows: body.length });
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    }
    if (loopback && url.pathname === "/api/v1/season")
      return route.fulfill({ json: { seasonId: SEASON, regularSeasonStartDate: "2025-10-07", regularSeasonEndDate: "2026-04-16", seasonEndDate: "2026-06-20", numberOfGames: 82, lastSeasonId: 20242025, lastRegularSeasonStartDate: "2024-10-04", lastRegularSeasonEndDate: "2025-04-17", lastSeasonEndDate: "2025-06-17", lastNumberOfGames: 82 } });
    if (loopback && url.pathname === "/api/cors" && /club-schedule-season/.test(url.searchParams.get("url") ?? ""))
      return route.fulfill({ json: { games: Array.from({ length: 82 }, (_, i) => {
        const home = i % 2 === 1, opp = { id: 1 + (i % 22), abbrev: ["BOS", "MTL", "TOR", "EDM", "CGY", "SEA", "LAK", "ANA", "SJS", "VGK", "COL", "DAL", "MIN", "WPG", "CHI", "STL", "NSH", "UTA", "NJD", "NYR", "PHI", "PIT"][i % 22] };
        const own = { id: TEAM_ID, abbrev: "VAN" }, played = i < 76;
        const a = Math.floor(hash(`sa${i}`) * 5), b = Math.floor(hash(`sb${i}`) * 5);
        return { id: 990000001 + i, season: SEASON, gameType: 2, gameScheduleState: "OK", gameDate: dateFor(i), startTimeUTC: `${dateFor(i)}T23:00:00Z`, gameState: played ? "OFF" : "FUT",
          homeTeam: { ...(home ? own : opp), ...(played ? { score: a } : {}) }, awayTeam: { ...(home ? opp : own), ...(played ? { score: a === b ? b + 1 : b } : {}) },
          gameOutcome: played ? { lastPeriodType: i % 9 === 0 ? "OT" : "REG" } : undefined };
      }) } });
    if (loopback && url.pathname.startsWith("/api/")) log({ kind: "local-api", path: url.pathname + url.search });
    if (loopback) return route.continue();
    // Public font CSS/files only, so typography matches production; never data.
    if (request.method() === "GET" && ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) return route.continue();
    log({ kind: "deny", target: `${url.origin}${url.pathname}` });
    return route.abort();
  });
}

module.exports = { installWigoFixtures, SUBJECT_ID };
