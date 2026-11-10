// Offline E1 binding preflight. Validates saved RPC bytes against saved metadata; grants no admission.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { canonicalHash } from "../qualification-readbacks/tooling/check-readbacks.mjs";
import { inspectIdentity } from "./inspect-identity.mjs";
import timestampParser from "./timestamp-parser.cjs";

const { timestampMicros } = timestampParser;
const validId = value => Number.isSafeInteger(value) && value > 0;
const sameClock = (a, b) => timestampMicros(a) !== null && timestampMicros(a) === timestampMicros(b);

export function inspectIssuedPacket({ capture, metadata, revisions }) {
  const findings = [], bindings = [];
  const add = (code, revisionId = null) => findings.push({ code, revisionId });
  if (typeof capture?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(capture.date)
    || !Number.isFinite(Date.parse(capture.date)) || new Date(capture.date).toISOString().slice(0, 10) !== capture.date)
    add("capture_date_invalid");
  const identity = inspectIdentity(metadata, capture?.date);
  if (!identity.pass) findings.push(...identity.findings.map(row => ({ ...row, stage: "metadata" })));
  const ids = capture?.gameIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 16 || !ids.every(validId)
    || new Set(ids).size !== ids.length) add("capture_game_scope_invalid");
  if (timestampMicros(capture?.observedAt) === null) add("capture_time_invalid");
  if (!Array.isArray(revisions) || revisions.length === 0 || revisions.length > 16) add("revision_population_invalid");
  if (findings.length) return { pass: false, findings, bindings, qualificationReady: false };
  const scope = new Set(ids), byGame = new Map(metadata.map(row => [row.gameId, row])), seen = new Set();
  if (metadata.length !== ids.length || metadata.some(row => !scope.has(row.gameId))) add("metadata_population_differs_from_capture");
  for (const revision of revisions) {
    const id = revision?.id, gameId = revision?.game_id, meta = byGame.get(gameId);
    if (!revision || !validId(gameId) || !scope.has(gameId) || seen.has(gameId)) {
      add("revision_game_scope_or_duplicate", id); continue;
    }
    seen.add(gameId);
    if (!meta || id !== meta.revisionId || revision.run_id !== meta.runId
      || !meta.snapshotId || revision.input_snapshot_id !== meta.snapshotId) {
      add("revision_metadata_binding_mismatch", id); continue;
    }
    const payload = revision.payload;
    if (revision.slate_date !== capture.date || payload?.modelMode !== meta.method || payload?.codeVersion !== meta.codeVersion
      || canonicalHash(payload?.inputProvenance?.modelIdentity ?? null) !== canonicalHash(meta.modelIdentity)) add("revision_model_or_date_mismatch", id);
    if (!sameClock(revision.published_at, meta.issuedAt)
      || !sameClock(payload?.inputCutoff ?? revision.decision_as_of, meta.cutoffAt)) add("revision_clock_mismatch", id);
    const observed = timestampMicros(capture.observedAt), issued = timestampMicros(revision.published_at), scheduled = timestampMicros(meta.scheduledAt);
    if (issued === null || scheduled === null || observed < issued || observed >= scheduled) add("capture_not_after_issue_and_pregame", id);
    const contexts = payload?.inputProvenance?.issuedContexts;
    const matching = Array.isArray(contexts) ? contexts.filter(row => row?.game?.id === gameId) : [];
    if (matching.length !== 1) { add("issued_context_missing_or_ambiguous", id); continue; }
    const context = matching[0], game = context.game;
    if (context.version !== "forge-issued-context-v1" || game.date !== capture.date || !sameClock(game.startTime, meta.scheduledAt)
      || !validId(game.seasonId) || !validId(game.homeTeamId) || !validId(game.awayTeamId) || game.homeTeamId === game.awayTeamId
      || !Array.isArray(context.roster)) { add("issued_context_invalid", id); continue; }
    if (!Array.isArray(payload.players) || payload.players.length === 0 || payload.players.length > 1500) {
      add("issued_skater_population_invalid", id); continue;
    }
    const playerIds = new Set();
    for (const row of payload.players) {
      const roster = context.roster.filter(member => member?.nhlId === row?.player_id);
      if (!row || !validId(row.player_id) || playerIds.has(row.player_id) || row.game_id !== gameId
        || ![game.homeTeamId, game.awayTeamId].includes(row.team_id) || row.horizon_games !== 1
        || row.as_of_date !== capture.date || row.run_id !== revision.run_id || roster.length !== 1
        || !validId(roster[0]?.canonicalId) || roster[0].teamId !== row.team_id || roster[0].seasonId !== game.seasonId) {
        add("issued_player_context_mismatch", id); continue;
      }
      playerIds.add(row.player_id);
    }
    bindings.push({ revisionId: id, runId: revision.run_id, gameId, snapshotId: revision.input_snapshot_id,
      codeVersion: meta.codeVersion, skaterRows: payload.players.length, revisionPayloadHash: canonicalHash(payload) });
  }
  for (const id of scope) if (!seen.has(id)) add("selected_revision_missing_for_capture_game");
  return { pass: findings.length === 0, findings, bindings, identity: identity.identity,
    qualificationReady: false, releaseAttribution: identity.releaseAttribution,
    originalScoringExtraction: "still_requires_issuing_code_and_retained_evidence",
    scheduledCaptureTiming: "only_issue_to_puck_drop_boundary_checked_not_T_minus_60",
    participationLineageManufactured: false, forecastValuesCalculated: false };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  try {
    const [file] = process.argv.slice(2);
    if (!file) throw new Error("usage: inspect-issued-packet.mjs saved-packet.json");
    const bytes = readFileSync(file);
    const result = { ...inspectIssuedPacket(JSON.parse(bytes.toString("utf8"))),
      packetSha256: createHash("sha256").update(bytes).digest("hex") };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
