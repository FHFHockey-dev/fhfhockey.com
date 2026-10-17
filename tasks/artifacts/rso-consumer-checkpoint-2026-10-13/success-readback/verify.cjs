"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tasks/artifacts/rso-consumer-checkpoint-2026-10-13/success-readback/verify.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_crypto = __toESM(require("node:crypto"));

// web/lib/player-forecasts/sourceSnapshot.ts
var import_crypto = __toESM(require("crypto"));
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}
function playerForecastSourcePayloadHash(payload) {
  return import_crypto.default.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

// web/lib/rosterScheduleData/normalize.ts
function planningScheduleStatus(gameStatus, scheduleStatus) {
  const game = gameStatus.trim().toUpperCase(), schedule = scheduleStatus.trim().toUpperCase();
  if (/CANCEL|^CNCL$/.test(schedule) || /CANCEL|^CNCL$/.test(game)) return "cancelled";
  if (/POST|^PPD$|^SUSPENDED$/.test(schedule) || /POST|^PPD$|^SUSPENDED$/.test(game)) return "postponed";
  if (["OFF", "FINAL", "FINAL_OT", "FINAL_SO", "OVER"].includes(game)) return "final";
  if (["LIVE", "CRIT"].includes(game)) return "live";
  return ["FUT", "PRE"].includes(game) && schedule === "OK" ? "scheduled" : null;
}

// web/lib/rosterScheduleData/planningInputs.ts
function normalizePlanningGames(rows2, timeZone2) {
  const result2 = /* @__PURE__ */ new Map();
  for (const row of rows2) {
    const id = String(row.source_game_id);
    const key = `${id}:${row.team_abbreviation}`;
    if (row.game_type !== 2 || !row.team_abbreviation || !row.game_date) continue;
    const status = String(row.game_status ?? "").toUpperCase();
    const schedule = String(row.schedule_status ?? "").toUpperCase();
    const planningStatus = planningScheduleStatus(status, schedule);
    if (!planningStatus) throw new Error("Planning schedule status could not be verified.");
    const instant = Date.parse(row.start_time ?? "");
    const date = timeZone2 && Number.isFinite(instant) ? new Intl.DateTimeFormat("en-CA", { timeZone: timeZone2, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant)) : row.game_date;
    result2.set(key, {
      scheduleRevision: playerForecastSourcePayloadHash({ id, start: row.start_time, team: row.team_abbreviation, opponent: row.opponent_abbreviation, status, schedule }),
      id,
      date,
      startsAt: Number.isFinite(instant) ? new Date(instant).toISOString() : null,
      teamAbbreviation: row.team_abbreviation,
      opponent: row.opponent_abbreviation ?? "?",
      home: row.home_away === "home",
      status: planningStatus
    });
  }
  return [...result2.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id) || a.teamAbbreviation.localeCompare(b.teamAbbreviation));
}

// tasks/artifacts/rso-consumer-checkpoint-2026-10-13/success-readback/verify.ts
var directory = process.argv[2];
var data = JSON.parse(import_node_fs.default.readFileSync(`${directory}/database-readback.json`, "utf8"));
var rows = data.rows;
var expectedIds = Array.from({ length: 57 }, (_, i) => 2026020084 + i);
var expectedHash = "cd6c7d7ea561a3aaafc9fd7a5289beda09572e4adf6767feefec9f5ce3731adf";
var assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
assert(rows.length === 114, "Expected 114 rows");
var ids = [...new Set(rows.map((r) => r.source_game_id))].sort((a, b) => a - b);
assert(JSON.stringify(ids) === JSON.stringify(expectedIds), "Exact game IDs mismatch");
for (const id of ids) {
  const sides = rows.filter((r) => r.source_game_id === id);
  const home = sides.find((r) => r.home_away === "home");
  const away = sides.find((r) => r.home_away === "away");
  assert(sides.length === 2 && home && away && home.team_id === away.opponent_team_id && away.team_id === home.opponent_team_id, "Reciprocal sides mismatch");
}
assert(rows.every((r) => r.game_key === "477" && r.season === "2026" && r.source_season_id === 20262027 && r.game_date >= "2026-10-11" && r.game_date <= "2026-10-19" && r.mapping_status === "mapped" && r.is_countable === true), "Stored bounds/mapping/countability mismatch");
var keys = ["yahoo_matchup_week_id", "game_key", "season", "week", "source_game_id", "source_season_id", "game_date", "start_time", "game_type", "game_status", "schedule_status", "mapping_status", "is_countable", "source_url", "source_updated_at", "source_metadata", "team_id", "team_abbreviation", "opponent_team_id", "opponent_abbreviation", "home_away"];
var metadataKeys = ["canonicalDateSource", "mappingReason", "venue", "venueUTCOffset", "easternUTCOffset", "syncMode"];
var content = rows.map((row) => Object.fromEntries(keys.map((key) => [
  key,
  ["start_time", "source_updated_at"].includes(key) ? row[key] === null ? null : new Date(row[key]).toISOString() : key === "source_metadata" ? Object.fromEntries(metadataKeys.map((k) => [k, row[key][k]])) : row[key]
])));
var hashed = { version: "rso-refresh-scope-v1", mode: "bounded", gameKey: "477", startDate: "2026-10-11", endDate: "2026-10-19", seasonId: 20262027, gameIds: expectedIds, maxSides: 114, rows: content };
var hash = import_node_crypto.default.createHash("sha256").update(JSON.stringify(hashed)).digest("hex");
assert(hash === expectedHash, "Stored normalized content hash mismatch");
var audit = data.audits.find((a) => a.status === "success" && a.rows_affected === 114);
var response = JSON.parse(audit.details.response);
assert(response.data.scope.scopeHash === hash && response.data.rowsDeleted === 0 && response.finalAudit.status === "persisted", "Success audit mismatch");
var timeZone = "America/Chicago";
var games = normalizePlanningGames(rows, timeZone).filter((g) => g.date >= "2026-10-12" && g.date <= "2026-10-18");
var gameIds = [...new Set(games.map((g) => g.id))];
var freshnessSeconds = (Date.parse(data.observedAt) - Date.parse(rows[0].fetched_at)) / 1e3;
assert(rows.every((r) => r.fetched_at === rows[0].fetched_at) && freshnessSeconds >= 0 && freshnessSeconds < 36 * 3600, "Freshness mismatch");
var byDate = {};
var byTeam = {};
for (const g of games) {
  byDate[g.date] = (byDate[g.date] ?? 0) + 1;
  byTeam[g.teamAbbreviation] = (byTeam[g.teamAbbreviation] ?? 0) + 1;
}
var result = { observedAt: data.observedAt, expectedRows: 114, actualRows: rows.length, exact57GameIdsMatch: true, reciprocalSides: true, allBoundsMatch: true, allMappedCountable: true, reconstructedStoredScopeHash: hash, scopeHashMatchesUserInspection: true, fetchedAt: rows[0].fetched_at, freshnessSeconds, reader36HourFreshnessPass: true, audit: { runTime: audit.run_time, status: audit.status, rowsAffected: audit.rows_affected, rowsDeleted: response.data.rowsDeleted, finalAudit: response.finalAudit }, consumerReplay: { source: "actual normalizePlanningGames on stored rows; no HTTP/provider/DB writes", timeZone, startDate: "2026-10-12", endDate: "2026-10-18", uniqueGames: gameIds.length, teamGameCells: games.length, byDate, byTeam, allStartTimesKnown: games.every((g) => g.startsAt !== null) }, changes: response.data.changes };
import_node_fs.default.writeFileSync(`${directory}/verification.json`, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
