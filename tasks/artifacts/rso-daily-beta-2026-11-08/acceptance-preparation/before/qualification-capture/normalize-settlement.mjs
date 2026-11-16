// Offline E3 adapter for saved forge_player_game_strength rows. No database, network or file writes.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import timestampParser from "./timestamp-parser.cjs";

const clock = timestampParser.timestampMicros;
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const positiveId = value => ["number", "string"].includes(typeof value)
  && /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value));
const rowKey = (player, game) => `${Number(player)}|${Number(game)}`;
const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function normalizeSettlement({ capture, issued, outcomes }) {
  requireValue(day(capture?.date) && capture.date > "2026-10-30", "settlement_date_outside_prospective_scope");
  const capturedAt = clock(capture.observedAt);
  requireValue(capturedAt !== null, "settlement_capture_time_invalid");
  requireValue(Number.isSafeInteger(capture.settlementVersion) && capture.settlementVersion > 0, "settlement_version_required");
  requireValue(Array.isArray(capture.gameIds) && capture.gameIds.length > 0 && capture.gameIds.length <= 16
    && capture.gameIds.every(id => Number.isSafeInteger(id) && id > 0)
    && new Set(capture.gameIds).size === capture.gameIds.length, "settlement_game_scope_invalid");
  const nextDate = new Date(Date.parse(capture.date) + 86400000).toISOString().slice(0, 10);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(capture.observedAt)).map(part => [part.type, part.value]));
  const observedDate = `${parts.year}-${parts.month}-${parts.day}`;
  requireValue(observedDate > nextDate || observedDate === nextDate && Number(parts.hour) >= 12,
    "settlement_before_declared_read_window");
  // Defensive local input limits, not an authorization or database query budget.
  requireValue(Array.isArray(issued) && issued.length > 0 && issued.length <= 10000, "issued_population_invalid");
  requireValue(Array.isArray(outcomes) && outcomes.length <= 10000, "settlement_population_invalid");
  const games = new Set(capture.gameIds), issuedKeys = new Set(), source = new Map();
  for (const row of outcomes) {
    requireValue(row && positiveId(row.player_id) && positiveId(row.game_id)
      && games.has(Number(row.game_id)), "settlement_source_identity_outside_scope");
    const key = rowKey(row.player_id, row.game_id);
    requireValue(!source.has(key), "duplicate_settlement_source");
    for (const field of ["shots_es", "shots_pp", "shots_pk"])
      requireValue(row[field] == null || Number.isSafeInteger(row[field]) && row[field] >= 0, "settlement_shots_invalid");
    const updatedAt = clock(row.updated_at);
    requireValue(row.updated_at == null || updatedAt !== null, "settlement_source_clock_invalid");
    requireValue(row.updated_at == null || updatedAt <= capturedAt, "settlement_source_from_future");
    source.set(key, row);
  }
  const rows = issued.map(row => {
    requireValue(row && positiveId(row.playerId) && positiveId(row.gameId) && games.has(Number(row.gameId))
      && row.gameDate === capture.date && row.target === "SHOTS_ON_GOAL" && row.horizon === 1, "issued_identity_outside_settlement_scope");
    const issuedAt = clock(row.issuedAt), scheduledAt = clock(row.scheduledAt);
    requireValue(issuedAt !== null && scheduledAt !== null && issuedAt < scheduledAt, "issued_chronology_invalid");
    const key = rowKey(row.playerId, row.gameId);
    requireValue(!issuedKeys.has(key), "duplicate_issued_identity");
    issuedKeys.add(key);
    const found = source.get(key);
    const components = found ? [found.shots_es, found.shots_pp, found.shots_pk] : [];
    const reason = !found ? "source_row_missing" : found.updated_at == null ? "source_clock_missing"
      : clock(found.updated_at) <= scheduledAt ? "source_record_not_after_puck_drop"
      : components.some(value => value == null) ? "strength_component_missing" : null;
    const actual = reason ? null : components.reduce((sum, value) => sum + value, 0);
    requireValue(actual === null || Number.isSafeInteger(actual), "settlement_total_invalid");
    return { playerId: String(Number(row.playerId)), gameId: String(Number(row.gameId)), target: row.target,
      gameDate: row.gameDate, actual, recordedAt: found?.updated_at ?? null, observedAt: capture.observedAt,
      settlementVersion: capture.settlementVersion, settlementStatus: reason ? "unknown" : "observed", exclusionReason: reason };
  });
  return { rows, audit: { version: "rso-settlement-normalization-v1", date: capture.date, observedAt: capture.observedAt,
    issuedRows: rows.length, sourceRows: outcomes.length, observedRows: rows.filter(row => row.actual !== null).length,
    unknownRows: rows.filter(row => row.actual === null).length,
    unissuedSourceRows: [...source.keys()].filter(key => !issuedKeys.has(key)).length,
    settlementVersion: capture.settlementVersion, readWindowFloorOnly: true,
    doesNotEstablishFinalGameStatus: true, nonDresserZeroInferred: false, qualificationGranted: false } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [captureFile, issuedFile, outcomeFile] = process.argv.slice(2);
    requireValue(captureFile && issuedFile && outcomeFile, "usage: normalize-settlement.mjs capture.json issued.json strength.json");
    const read = file => JSON.parse(readFileSync(file, "utf8"));
    const { rows, audit } = normalizeSettlement({ capture: read(captureFile), issued: read(issuedFile), outcomes: read(outcomeFile) });
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    process.stderr.write(JSON.stringify(audit, null, 2) + "\n");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
