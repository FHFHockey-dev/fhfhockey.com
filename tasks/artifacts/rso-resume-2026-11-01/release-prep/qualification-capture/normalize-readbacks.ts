// Offline E2 adapter for saved public responses. No network, source admission or policy mutation.
import { decodePlanningDataTransport } from "lib/rosterScheduleData/planningDataTransport";
import { timestampMicros } from "lib/projections/evidenceTime";
import { readFileSync } from "node:fs";

type Capture = { date: string; observedAt: string; gameIds: number[] };
const target = "SHOTS_ON_GOAL";
const own = (value: any, key: string) => value != null && Object.prototype.hasOwnProperty.call(value, key);
function requireValue(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }
function scope(capture: Capture) {
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(capture.date) && Number.isFinite(Date.parse(capture.date))
    && new Date(capture.date).toISOString().slice(0, 10) === capture.date
    && capture.date > "2026-10-30", "capture_date_outside_prospective_scope");
  requireValue(timestampMicros(capture.observedAt) !== null, "capture_time_missing_or_invalid");
  requireValue(capture.gameIds.length > 0 && capture.gameIds.length <= 16
    && capture.gameIds.every(id => Number.isSafeInteger(id) && id > 0)
    && new Set(capture.gameIds).size === capture.gameIds.length, "capture_game_scope_invalid");
  return new Set(capture.gameIds.map(String));
}
function value(input: unknown) {
  requireValue(input === null || typeof input === "number" && Number.isFinite(input), "target_value_missing_or_invalid");
  return { unconditionalMean: input as number | null };
}
function complete(rows: any[]) {
  requireValue(rows.length > 0, "no_qualifying_readback_rows");
  const keys = rows.map(row => `${row.playerId}|${row.gameId}|${row.target}`);
  requireValue(new Set(keys).size === keys.length, "duplicate_readback_identity");
  return rows;
}

export function normalizeRsoReadback(body: any, capture: Capture) {
  const games = scope(capture);
  requireValue(body?.success === true, "rso_response_unsuccessful");
  requireValue(body.bridgeForecasts === undefined, "bridge_is_not_captured_revision_evidence");
  const data = decodePlanningDataTransport(body.data);
  requireValue(data.forecastManifest?.rsoUsePolicy
    && data.forecastManifest.rsoUsePolicy.bridgeRevisionIds.length === 0, "rso_issued_policy_missing");
  return complete(data.forecasts.filter(row => games.has(row.gameId) && own(row.stats, target)
    && row.rsoTargetBindings?.[target]?.component !== "forge-detailed-goalie").map(row => {
    const binding = row.rsoTargetBindings?.[target], context = row.issuedContext;
    requireValue(binding?.component === "forge-detailed-skater" && row.sourceKind === "detailed", "rso_detailed_binding_missing");
    requireValue(context && Number.isSafeInteger(context.nhlPlayerId) && context.nhlPlayerId > 0
      && context.playerId === row.playerId && String(context.gameId) === row.gameId, "rso_player_mapping_invalid");
    requireValue(data.games.some(game => game.id === row.gameId && game.date === capture.date), "rso_game_date_mismatch");
    requireValue(binding.codeVersion === row.modelVersion && binding.cutoffAt === row.cutoffAt, "rso_binding_identity_mismatch");
    requireValue(row.targetAllowedUses?.[target], "rso_target_permissions_missing");
    return { playerId: String(context.nhlPlayerId), gameId: row.gameId, target, revisionId: row.revisionId,
      method: binding.modelMode, codeVersion: binding.codeVersion, configurationHash: binding.configurationHash,
      artifactHash: binding.artifactHash, horizon: binding.horizonGames, cutoffAt: row.cutoffAt,
      value: value(row.stats[target]), allowedUses: { ...row.targetAllowedUses[target] },
      observedAt: capture.observedAt, gameDate: capture.date };
  }));
}

export function normalizeStartChartReadback(body: any, capture: Capture) {
  const games = scope(capture);
  requireValue(body?.publishedForecastsEnabled === true && body.contractVersion === 2, "start_chart_revision_serving_unavailable");
  requireValue(body.dateUsed === capture.date && body.resolvedDate === capture.date && body.fallbackApplied === false,
    "start_chart_date_fallback_or_mismatch");
  requireValue(Array.isArray(body.players) && Array.isArray(body.gameRevisions), "start_chart_response_incomplete");
  const revisions = new Map<string, any>();
  for (const revision of body.gameRevisions) if (games.has(String(revision.gameId))) {
    requireValue(!revisions.has(String(revision.gameId)), "start_chart_revision_join_ambiguous");
    requireValue(typeof revision.revisionId === "string" && revision.revisionId.length > 0
      && typeof revision.codeVersion === "string" && typeof revision.modelMode === "string", "start_chart_revision_identity_missing");
    revisions.set(String(revision.gameId), revision);
  }
  return complete(body.players.filter((row: any) => games.has(String(row.game_id))
    && own(row.forecast?.expected, target)).map((row: any) => {
    const revision = revisions.get(String(row.game_id));
    requireValue(revision, "start_chart_revision_join_missing");
    requireValue(Number.isSafeInteger(row.player_id) && row.player_id > 0, "start_chart_player_identity_invalid");
    requireValue(row.forecast.conditioning === "unconditional", "start_chart_conditional_value");
    const expected = value(row.forecast.expected[target]);
    requireValue(row.proj_shots === expected.unconditionalMean, "start_chart_display_value_mismatch");
    return { playerId: String(row.player_id), gameId: String(row.game_id), target, revisionId: revision.revisionId,
      method: revision.modelMode, codeVersion: revision.codeVersion, cutoffAt: revision.inputCutoff ?? revision.decisionAsOf,
      value: expected, observedAt: capture.observedAt, gameDate: capture.date };
  }));
}

if (require.main === module) {
  try {
    const [consumer, captureFile, responseFile] = process.argv.slice(2);
    requireValue((consumer === "rso" || consumer === "start-chart") && captureFile && responseFile,
      "usage: normalize-readbacks.ts rso|start-chart capture.json response.json");
    const capture = JSON.parse(readFileSync(captureFile, "utf8"));
    const body = JSON.parse(readFileSync(responseFile, "utf8"));
    const rows = consumer === "rso" ? normalizeRsoReadback(body, capture) : normalizeStartChartReadback(body, capture);
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  } catch (error) { console.error(error instanceof Error ? error.message : "normalization_failed"); process.exitCode = 1; }
}
