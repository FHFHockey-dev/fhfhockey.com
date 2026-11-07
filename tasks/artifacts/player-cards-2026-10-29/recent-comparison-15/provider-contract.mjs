// lib/player-cards/currentNhl.ts
var CURRENT_NHL_FORMATS = ["rates-opportunity", "results-milestones", "recent-previous"];
var CURRENT_NHL_FORMAT_LABELS = { "rates-opportunity": "Rates & Opportunity", "results-milestones": "Results & Milestones", "recent-previous": "Recent vs Previous" };
var CURRENT_NHL_DEFINITIONS = {
  atoi: { label: "Ice time / game", unit: "time", definition: "NHL game-log TOI seconds / appearances / 60" },
  shots60: { label: "Shots /60", unit: "rate", definition: "NHL shots on goal \xD7 3600 / NHL game-log TOI seconds" },
  goals60: { label: "Goals /60", unit: "rate", definition: "NHL goals \xD7 3600 / NHL game-log TOI seconds" },
  points60: { label: "Points /60", unit: "rate", definition: "NHL points \xD7 3600 / NHL game-log TOI seconds" },
  goals: { label: "Goals", unit: "count", definition: "Sum of NHL game-log goals in selected appearances" },
  assists: { label: "Assists", unit: "count", definition: "Sum of NHL game-log assists in selected appearances" },
  points: { label: "Points", unit: "count", definition: "Sum of NHL game-log points in selected appearances" },
  shots: { label: "Shots on goal", unit: "count", definition: "Sum of NHL game-log shots in selected appearances" },
  shootingPct: { label: "Shooting% \xB7 actual", unit: "percent", definition: "NHL goals / shots on goal \xD7 100; zero shots is undefined" }
};
var NHL_RANK_REASON = "Rank and percentile unavailable: no verified all-NHL same-definition population for this window.";
function parseCurrentNhlRequest(query) {
  if (![query.playerId, query.season, query.count].every((value) => typeof value === "string" || typeof value === "number") || !/^[1-9]\d{6}$/.test(String(query.playerId)) || !/^\d{8}$/.test(String(query.season)) || !["5", "10", "20"].includes(String(query.count))) throw new Error("Choose a valid NHL player ID, season and last 5, 10 or 20 appearances.");
  const season = Number(query.season), year = Math.floor(season / 1e4);
  if (year < 1917 || year > 2100 || season % 1e4 !== year + 1) throw new Error("Invalid NHL season.");
  return { playerId: Number(query.playerId), season, count: Number(query.count) };
}
var record = (v) => v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
var integer = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
var date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + "T00:00:00Z")) && (/* @__PURE__ */ new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) === v;
var name = (v) => typeof record(v).default === "string" ? String(record(v).default) : "";
function toi(v) {
  if (typeof v !== "string" || !/^\d{1,3}:[0-5]\d$/.test(v)) return null;
  const [minutes, seconds] = v.split(":").map(Number);
  return minutes * 60 + seconds;
}
function poolGames(rows, games) {
  const evidence = [];
  const totals = { goals: 0, assists: 0, points: 0, shots: 0, seconds: 0 };
  for (const row of rows) {
    const seconds = toi(row.toi);
    if (![row.goals, row.assists, row.points, row.shots].every(integer) || row.points !== Number(row.goals) + Number(row.assists) || Number(row.goals) > Number(row.shots) || seconds === null || seconds <= 0) return null;
    totals.goals += Number(row.goals);
    totals.assists += Number(row.assists);
    totals.points += Number(row.points);
    totals.shots += Number(row.shots);
    totals.seconds += seconds;
    const game = games.find((game2) => game2.id === row.gameId);
    evidence.push({ gameId: Number(row.gameId), providerDate: String(row.gameDate), utcStart: String(game.startTimeUTC), team: String(row.teamAbbrev), finalStatusAtObservation: String(game.gameState), toiSeconds: seconds, goals: Number(row.goals), assists: Number(row.assists), points: Number(row.points), shots: Number(row.shots) });
  }
  if (!rows.length) return null;
  return { games: evidence, toiSeconds: totals.seconds, values: { atoi: totals.seconds / rows.length / 60, shots60: totals.shots * 3600 / totals.seconds, goals60: totals.goals * 3600 / totals.seconds, points60: totals.points * 3600 / totals.seconds, goals: totals.goals, assists: totals.assists, points: totals.points, shots: totals.shots, shootingPct: totals.shots === 0 ? null : totals.goals / totals.shots * 100 } };
}
function buildCurrentNhlCard(request, input) {
  parseCurrentNhlRequest({ playerId: request.playerId, season: request.season, count: request.count });
  const identity = record(input.identity), history = record(input.history), schedule = record(input.schedule);
  const observed = Date.parse(input.observedAt), first = name(identity.firstName), last = name(identity.lastName);
  if (identity.playerId !== request.playerId || !first || !last || typeof identity.currentTeamAbbrev !== "string" || !/^[A-Z]{2,3}$/.test(identity.currentTeamAbbrev) || !Number.isFinite(observed)) throw new Error("NHL identity or observation time could not be verified.");
  const card = {
    id: "",
    source: input.source || "nhl-current",
    state: "unavailable",
    player: { id: request.playerId, name: `${first} ${last}`, team: identity.currentTeamAbbrev, position: String(identity.position || "Unknown") },
    request: { ...request },
    observedAt: new Date(observed).toISOString(),
    sample: { gp: null, toiSeconds: null, sourceDates: [], utcDates: [], gameIds: [] },
    values: Object.fromEntries(Object.keys(CURRENT_NHL_DEFINITIONS).map((id) => [id, null])),
    issues: [],
    rankReason: NHL_RANK_REASON,
    evidence: { version: "nhl-basic-skater-v1", sourcePaths: [`/v1/player/${request.playerId}/landing`, `/v1/player/${request.playerId}/game-log/${request.season}/2`, `/v1/club-schedule-season/${identity.currentTeamAbbrev}/${request.season}`], seasonGp: null, selectedGames: [], actualEndTimesSupplied: false },
    historyStatement: "Season game-log appearance count reconciled with NHL season totals; no career-history claim.",
    finalityStatement: "NHL FINAL/OFF at observation; actual game-end timestamps are not supplied. Current window only; no historical cutoff claim."
  };
  const fail = (message) => {
    card.issues.push(message);
    card.id = `nhl-${request.playerId}-${request.season}-${request.count}-${card.observedAt}-unavailable`;
    return card;
  };
  if (identity.position === "G") return fail("This format uses skater game logs. Goalie workload requires its separate qualified source contract.");
  if (history.seasonId !== request.season || history.gameTypeId !== 2 || !Array.isArray(history.gameLog) || history.gameLog.length > 100 || !Array.isArray(schedule.games) || schedule.games.length > 140) return fail("Season, regular-season game-log or schedule scope is unverified.");
  const rows = history.gameLog.map(record), ids = rows.map((row) => row.gameId);
  if (new Set(ids).size !== ids.length || rows.some((row) => !integer(row.gameId) || !new RegExp(`^${Math.floor(request.season / 1e4)}02\\d{4}$`).test(String(row.gameId)) || !date(row.gameDate))) return fail("Game-log identities or provider dates are inconsistent.");
  const seasonTotals = Array.isArray(identity.seasonTotals) ? identity.seasonTotals.map(record).filter((row) => row.season === request.season && row.gameTypeId === 2 && row.leagueAbbrev === "NHL") : [];
  if (seasonTotals.length !== 1 || !integer(seasonTotals[0].gamesPlayed) || seasonTotals[0].gamesPlayed !== rows.length) return fail("Complete season appearance count is unverified or does not match NHL season totals.");
  card.evidence.seasonGp = Number(seasonTotals[0].gamesPlayed);
  const games = schedule.games.map(record), starts = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const matches = games.filter((game2) => game2.id === row.gameId), game = matches[0], start = Date.parse(String(game?.startTimeUTC));
    if (matches.length !== 1 || game.season !== request.season || game.gameType !== 2 || game.gameDate !== row.gameDate || !["OFF", "FINAL"].includes(String(game.gameState)) || !Number.isFinite(start) || start > observed || ![record(game.homeTeam).abbrev, record(game.awayTeam).abbrev].includes(row.teamAbbrev)) return fail("An appearance lacks matching final-game identity in the captured team schedule. No schedule fan-out is performed.");
    starts.set(Number(row.gameId), start);
  }
  if (new Set(starts.values()).size !== starts.size) return fail("Appearance chronology is ambiguous: duplicate UTC game starts.");
  const ordered = [...rows].sort((a, b) => starts.get(Number(b.gameId)) - starts.get(Number(a.gameId)));
  const selected = ordered.slice(0, request.count);
  if (!selected.length) return fail("No reported regular-season appearances are available. Missing history is not a zero-value card.");
  const pooled = poolGames(selected, games);
  if (!pooled) return fail("A selected game has missing or inconsistent counts/exposure. Invalid rows are not pooled.");
  card.evidence.selectedGames = pooled.games;
  card.sample = { gp: selected.length, toiSeconds: pooled.toiSeconds, sourceDates: pooled.games.map((game) => game.providerDate), utcDates: pooled.games.map((game) => new Date(game.utcStart).toISOString().slice(0, 10)), gameIds: pooled.games.map((game) => game.gameId) };
  card.state = "ready";
  card.values = pooled.values;
  const preceding = ordered.slice(request.count, request.count * 2);
  if (preceding.length !== request.count) card.previous = { state: "unavailable", reason: `Needs ${request.count * 2} season appearances for two separate ${request.count}-game windows; captured ${rows.length}.` };
  else {
    const baseline = poolGames(preceding, games);
    card.previous = baseline ? { state: "ready", ...baseline } : { state: "unavailable", reason: "A preceding-window game has missing or inconsistent counts/exposure. Baseline withheld." };
  }
  if (selected.length < request.count) card.issues.push(`Known short season sample: ${selected.length}/${request.count} appearances.`);
  if (pooled.values.shots === 0) card.issues.push("Shooting percentage is undefined: zero shots on goal.");
  card.id = `nhl-${request.playerId}-${request.season}-${request.count}-${card.observedAt}-${card.sample.gameIds.join(".")}`;
  return card;
}
function currentNhlRows(format) {
  return format === "results-milestones" ? ["goals", "assists", "points", "shots", "shootingPct"] : ["atoi", "shots60", "goals60", "points60", "shootingPct"];
}
function formatCurrentNhl(id, value) {
  if (value === null) return "\u2014";
  const unit = CURRENT_NHL_DEFINITIONS[id].unit;
  if (unit === "time") {
    const seconds = Math.round(value * 60);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return unit === "count" ? String(value) : unit === "percent" ? `${value.toFixed(1)}%` : value.toFixed(2);
}
export {
  CURRENT_NHL_DEFINITIONS,
  CURRENT_NHL_FORMATS,
  CURRENT_NHL_FORMAT_LABELS,
  NHL_RANK_REASON,
  buildCurrentNhlCard,
  currentNhlRows,
  formatCurrentNhl,
  parseCurrentNhlRequest
};
