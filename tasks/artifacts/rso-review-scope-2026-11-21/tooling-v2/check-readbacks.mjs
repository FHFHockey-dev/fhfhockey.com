#!/usr/bin/env node
// FORGE qualification readback checker, v2 (forge-qual-scope-v2). Offline only: local inputs/report and the repository
// timestamp parser. Evolved from rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.mjs (v1, unchanged).
//
// Inputs (normalized evidence; see README.md):
//   --issued <file>        originally issued rows, one per player/game/target (frozen "if he plays" line)
//   --rso <file>           Detailed RSO readback rows, one read per scheduled start time at its T-30 (B6)
//   --settlement <file>    optional settled outcomes, per target, with `dressed`
//   --baseline <file>      optional season_rate inputs (B8): { players: [...], groups: [...] }
//   --scope <file>         the predeclared scope (SCOPE-AMENDED.json): pinned identity plus the hashed protocol
//   --allow-draft-scope    accept a scope whose identity is not pinned yet (fixtures and dry runs only)
//   --look 1|final         compute that look's per-target metrics and verdicts (needs --scope, --settlement, --baseline)
//   --sealed <from>..<to>  sealed dates (default: the scope's); cannot differ from a supplied scope
//   --tolerance <n>        absolute value tolerance (default: the scope's readback.tolerance, else 0.0001); cannot differ from a scope
//   --out <file>           report path (default: stdout)
// Exit code: 0 no findings, 1 findings, 2 bad input. Per-target verdicts are in report.look, not in the exit code.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOTSTRAP_VERSION, LOOK_IDS, clusteredBootstrap, deriveBaseSeedHex, deriveStreamSeedHex, lookPlan, seasonRateBaseline,
  seedFromHex, settledCounts, targetMetrics } from "./metrics.mjs";

// Works from the retained tooling or an isolated supplement, independent of the calling directory.
let repository = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(repository, "web/lib/projections/evidenceTime.ts"))) {
  const parent = dirname(repository);
  if (parent === repository) throw new Error("Run this checker inside the FHFH repository with web dependencies installed");
  repository = parent;
}
const require = createRequire(join(repository, "web/package.json"));
if (!require.extensions[".ts"]) require("ts-node").register({ project: join(repository, "web/tsconfig.json"),
  transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { timestampMicros: time } = require(join(repository, "web/lib/projections/evidenceTime.ts"));

export const CHECKER_VERSION = "forge-qual-checker-v2";
const HEX64 = /^[a-f0-9]{64}$/;
export const SCOPE_VERSION = "forge-qual-scope-v2";
export const MODEL_IDENTITY_VERSION = "forge-model-identity-v2";
export const PARTICIPATION_BASES = ["confirmed_playing", "confirmed_out", "assumed_playing", "assumed_out"];
export const WITHHELD_REASONS = ["stale_source", "incomplete_refresh", "missing_target"];
/** Scope identity fields (SCOPE-AMENDMENT v2 checker list). A null, absent or `PENDING…` value is unpinned. */
export const SCOPE_IDENTITY_FIELDS = ["targets", "component", "modelMode", "modelIdentityVersion", "codeVersion", "configurationHash",
  "artifactHash", "horizon", "conditioning", "participationLineage", "servedValueSurfaceSha256"];
/** B7's served-value surface: the files outside the producer closure that change the served value. The identity records
 * it as { path: sha256 } sorted by path (no combined re-hash) and compares it path by path. */
export const SURFACE_PATHS = ["web/lib/projections/consumerRevisionAdmission.ts", "web/lib/projections/rsoParticipationNotes.ts",
  "web/lib/projections/rsoParticipationOverlay.ts"];
const surfaceMap = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length > 0 && Object.values(value).every(hash => typeof hash === "string" && HEX64.test(hash));
/** Paths added, removed or with a different sha256 in `surface` relative to `pin`; null when they are equal. */
export function surfaceDifference(surface, pin) {
  const added = Object.keys(surface).filter(path => !Object.hasOwn(pin, path)).sort();
  const removed = Object.keys(pin).filter(path => !Object.hasOwn(surface, path)).sort();
  const changed = Object.keys(pin).filter(path => Object.hasOwn(surface, path) && surface[path] !== pin[path]).sort();
  return added.length || removed.length || changed.length ? { added, removed, changed } : null;
}
/** Fields every issued row needs before it can be qualified at all. */
export const REQUIRED_ISSUED = ["revisionId", "playerId", "gameId", "target", "method", "modelIdentity", "cutoffAt", "issuedAt",
  "acknowledgedAt", "scheduledAt", "gameDate", "horizon", "value"];
/** Fields every served (not withheld) RSO readback row needs. producerCodeVersion is checked apart (identity_v1_or_missing). */
export const REQUIRED_READBACK = ["revisionId", "readId", "startGroup", "observedAt", "basis", "participationLineage", "conditioning",
  "overlayChanges", "servedValueSurfaceSha256", "value"];
/** Readback fields that must equal the issued row's. */
export const IDENTITY_FIELDS = ["revisionId", "target", "cutoffAt", "configurationHash", "artifactHash"];

/** Finding classes. integrity: stops every target (look 1) or fails every target (final). reset: ends the scope.
 * target: a data problem that keeps only that target from passing. */
export const FINDING_CLASS = {
  issued_empty: "integrity", issued_incomplete: "integrity", issued_duplicate: "integrity", issued_out_of_scope: "integrity",
  cutoff_after_issue: "integrity", issued_after_puck_drop: "integrity", identity_v1_or_missing: "integrity",
  artifact_hash_mismatch: "integrity", sealed_issued_present: "integrity", sealed_readback_present: "integrity",
  sealed_outcome_present: "integrity", readback_duplicate: "integrity", readback_unissued: "integrity",
  readback_incomplete: "integrity", identity_mismatch: "integrity",
  readback_out_of_scope: "integrity", lineage_without_issuance: "integrity", value_mismatch: "integrity",
  readback_no_value: "integrity", use_beyond_scope: "integrity", readback_capture_time_missing_or_invalid: "integrity",
  readback_before_issue: "integrity", readback_outside_window: "integrity", readback_group_inconsistent: "integrity",
  readback_group_missing: "integrity", readback_missing: "integrity",
  identity_changed: "reset", surface_changed: "reset",
  settlement_missing: "target", settlement_before_game: "target", settlement_not_numeric: "target",
  settlement_duplicate: "target", settlement_repair_invalid: "target", baseline_missing: "target", baseline_invalid: "target",
};

const READ_LEAD_MICROS = 30n * 60n * 1_000_000n;
const key = row => `${row.playerId}|${row.gameId}|${row.target}`;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
/** sha256 of key-sorted JSON: the same canonical form as the repo's projectionInputHash / playerForecastSourcePayloadHash. */
export const canonicalHash = value => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
/** artifactHash = sha256({codeVersion, configurationHash}) (D3 as amended; forgeModelIdentity in run-forge-projections). */
export const expectedArtifactHash = (codeVersion, configurationHash) => canonicalHash({ codeVersion, configurationHash });
const finite = value => typeof value === "number" && Number.isFinite(value);
const unpinnedValue = value => value === null || value === undefined || (typeof value === "string" && value.startsWith("PENDING"));
const numericId = value => typeof value === "number" ? (Number.isSafeInteger(value) && value > 0 ? value : null)
  : typeof value === "string" && /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const participationMethod = lineage => typeof lineage === "string" ? lineage.split("@")[0] : null;

/** Validates a predeclared v2 scope. Returns { scope, problems }. The protocol must hash to `protocolHash`, and the bootstrap
 * seed must re-derive from the protocol's pre-bootstrap hash. Status `amended_awaiting_identity` (any status but `pinned`)
 * or a null/PENDING identity field is unpinned, accepted only with `allowDraft`. A pinned identity must carry the 64-hex
 * closure codeVersion, a 64-hex configuration hash, the artifact hash they imply, the B7 surface map (exactly its three
 * paths, sorted, each a 64-hex sha256) and literal v2 values. */
export function readScope(scope, { allowDraft = false } = {}) {
  const problems = [];
  if (scope?.version !== SCOPE_VERSION) problems.push("scope_version");
  if (!scope?.protocol || canonicalHash(scope.protocol) !== scope.protocolHash) problems.push("protocol_hash_mismatch");
  const seed = scope?.protocol?.bootstrap?.seed;
  if (scope?.protocol?.bootstrap?.version !== BOOTSTRAP_VERSION || !seed?.preBootstrapProtocolHash
    || deriveBaseSeedHex(seed.preBootstrapProtocolHash) !== seed.baseSeedHex) problems.push("bootstrap_seed_mismatch");
  const identity = scope?.identity ?? {};
  const unpinned = SCOPE_IDENTITY_FIELDS.filter(field => unpinnedValue(identity[field]));
  if (scope?.status !== "pinned" || unpinned.length) {
    if (!allowDraft) problems.push(`identity_unpinned:${unpinned.join(",") || scope?.status}`);
  } else {
    if (!HEX64.test(identity.codeVersion)) problems.push("pinned_code_version_not_closure");
    if (!HEX64.test(identity.configurationHash)) problems.push("pinned_configuration_hash_invalid");
    const surface = identity.servedValueSurfaceSha256;
    if (!surfaceMap(surface) || JSON.stringify(Object.keys(surface)) !== JSON.stringify(SURFACE_PATHS)) problems.push("pinned_surface_map_invalid");
    if (identity.artifactHash !== expectedArtifactHash(identity.codeVersion, identity.configurationHash)) problems.push("pinned_artifact_hash_mismatch");
    if (identity.modelIdentityVersion !== MODEL_IDENTITY_VERSION) problems.push("pinned_model_identity_not_v2");
    if (typeof identity.participationLineage !== "string" || !/^[a-z0-9-]+:[a-z]+$/.test(identity.participationLineage)) problems.push("pinned_participation_lineage_not_literal");
    const targets = Object.keys(scope?.protocol?.targets ?? {});
    if (!Array.isArray(identity.targets) || identity.targets.length !== targets.length || identity.targets.some(t => !targets.includes(t)))
      problems.push("pinned_targets_differ_from_protocol");
  }
  return { scope, problems };
}

/** Pins usable for comparison: literal values only. A null, PENDING or prose value (the draft's descriptive strings contain
 * whitespace) is not compared, so a dry run against the unpinned draft cannot report a reset. */
const literal = value => !unpinnedValue(value) && !(typeof value === "string" && /\s/.test(value));
const pinned = (identity, field) => identity && literal(identity[field]) ? identity[field] : undefined;

/**
 * Pure: returns { findings, summary, look? }. Never throws on bad rows; each problem is a finding.
 * `replicates`, `nextU64` and `index` are test seams for the bootstrap; the CLI always uses protocol.bootstrap.
 */
export function checkReadbacks({ issued, rso, settlement = null, baseline = null, scope = null, sealed = scope?.protocol?.sealed ?? null,
  tolerance = scope?.protocol?.readback?.tolerance ?? 0.0001, look = null, replicates = null, rng = null }) {
  const identity = scope?.identity ?? null, protocol = scope?.protocol ?? null;
  const allowedUses = protocol?.claim?.rso?.uses ?? null;
  const findings = [];
  const add = (code, detail) => findings.push({ code, class: FINDING_CLASS[code], ...detail });
  const inSealed = date => !!sealed && typeof date === "string" && date >= sealed.from && date <= sealed.to;
  const issuedByKey = new Map(), sealedKeys = new Set(), flagged = new Set(), rejectedKeys = new Set(), dateByKey = new Map();
  let sealedRows = 0;
  if (!Array.isArray(issued) || issued.length === 0) add("issued_empty", {});

  // ------------------------------------------------------------ issued rows
  for (const raw of issued ?? []) {
    if (inSealed(raw.gameDate)) { sealedRows++; sealedKeys.add(key(raw)); add("sealed_issued_present", { key: key(raw), gameDate: raw.gameDate }); continue; }
    const missing = REQUIRED_ISSUED.filter(field => raw[field] === undefined || raw[field] === null || raw[field] === "");
    const playerId = numericId(raw.playerId), gameId = numericId(raw.gameId);
    const invalid = [...(playerId === null && !missing.includes("playerId") ? ["playerId"] : []),
      ...(gameId === null && !missing.includes("gameId") ? ["gameId"] : []),
      ...(raw.value && typeof raw.value === "object" && !(raw.value.conditionalMean === null || finite(raw.value.conditionalMean)) ? ["value.conditionalMean"] : [])];
    dateByKey.set(key(raw), raw.gameDate);
    if (missing.length || invalid.length) { rejectedKeys.add(key(raw)); add("issued_incomplete", { key: key(raw), missing, invalid }); continue; }
    const row = { ...raw, playerId, gameId }, k = key(row);
    dateByKey.set(k, row.gameDate);
    const model = row.modelIdentity;
    if (typeof model !== "object" || model.version !== MODEL_IDENTITY_VERSION || !HEX64.test(model.codeVersion ?? "") || !HEX64.test(model.configurationHash ?? "")) {
      rejectedKeys.add(k); add("identity_v1_or_missing", { source: "issued", key: k, version: model?.version ?? null, codeVersion: model?.codeVersion ?? null }); continue;
    }
    if (model.artifactHash !== expectedArtifactHash(model.codeVersion, model.configurationHash)) {
      rejectedKeys.add(k); add("artifact_hash_mismatch", { source: "issued", key: k, artifactHash: model.artifactHash ?? null }); continue;
    }
    if (issuedByKey.has(k)) { add("issued_duplicate", { key: k }); continue; }
    for (const [field, value, pin] of [["codeVersion", model.codeVersion, pinned(identity, "codeVersion")],
      ["configurationHash", model.configurationHash, pinned(identity, "configurationHash")],
      ["artifactHash", model.artifactHash, pinned(identity, "artifactHash")]])
      if (pin !== undefined && value !== pin) { add("identity_changed", { source: "issued", key: k, field, value, pin }); flagged.add(k); }
    const targets = pinned(identity, "targets");
    if (targets !== undefined && !targets.includes(row.target)) { add("issued_out_of_scope", { key: k, field: "target", issued: row.target }); flagged.add(k); }
    for (const [field, value, pin] of [["method", row.method, pinned(identity, "modelMode")], ["horizon", row.horizon, pinned(identity, "horizon")]])
      if (pin !== undefined && value !== pin) { add("issued_out_of_scope", { key: k, field, issued: value, scope: pin }); flagged.add(k); }
    // Chronology of issuance: inputs cut off no later than issue, issue strictly before puck drop.
    const cutoffAt = time(row.cutoffAt), issuedAt = time(row.issuedAt), scheduledAt = time(row.scheduledAt);
    if (cutoffAt === null || issuedAt === null || cutoffAt > issuedAt) { add("cutoff_after_issue", { key: k, cutoffAt: row.cutoffAt, issuedAt: row.issuedAt }); flagged.add(k); }
    if (issuedAt === null || scheduledAt === null || issuedAt >= scheduledAt) { add("issued_after_puck_drop", { key: k, issuedAt: row.issuedAt, scheduledAt: row.scheduledAt }); flagged.add(k); }
    issuedByKey.set(k, row);
  }

  // ------------------------------------------------------------ RSO readbacks (B2: the only consumer)
  const served = new Map(), withheld = {}, reads = new Map(), groupsRead = new Set(), seen = new Set();
  let valueMatched = 0, valueChecked = 0;
  const releasePins = new Set();
  if (protocol?.readback?.consumers?.includes("rso") && !Array.isArray(rso)) add("readback_missing", { consumer: "rso", key: null, reason: "no RSO readback supplied" });
  for (const raw of rso ?? []) {
    const playerId = numericId(raw.playerId) ?? raw.playerId, gameId = numericId(raw.gameId) ?? raw.gameId;
    const row = { ...raw, playerId, gameId }, k = key(row);
    if (sealedKeys.has(k) || inSealed(row.gameDate)) { add("sealed_readback_present", { key: k }); continue; }
    if (seen.has(k)) { add("readback_duplicate", { key: k }); continue; }
    seen.add(k);
    const source = issuedByKey.get(k);
    // A consumer value that was never issued is invented, whatever it says about itself.
    // A readback of an issued row rejected above is not counted again; its issued finding already fails integrity.
    if (!source && rejectedKeys.has(k)) continue;
    if (!source) { add("readback_unissued", { key: k, revisionId: row.revisionId ?? null }); continue; }
    const bad = code => { flagged.add(k); return code; };
    if (typeof row.releasePin === "string") releasePins.add(row.releasePin);

    // Timing (B6): one read per scheduled start, at its T-30, after the game's own T-60 acknowledgement.
    const observedAt = time(row.observedAt);
    if (observedAt === null) add(bad("readback_capture_time_missing_or_invalid"), { key: k, observedAt: row.observedAt ?? null });
    else {
      const issuedAt = time(source.issuedAt), scheduledAt = time(source.scheduledAt), ackAt = time(source.acknowledgedAt);
      if (issuedAt === null || observedAt < issuedAt) add(bad("readback_before_issue"), { key: k, observedAt: row.observedAt, issuedAt: source.issuedAt });
      const reason = scheduledAt === null ? "no_schedule" : observedAt >= scheduledAt ? "at_or_after_start"
        : observedAt < scheduledAt - READ_LEAD_MICROS ? "before_t_minus_30"
        : ackAt === null ? "no_acknowledgement" : observedAt <= ackAt ? "not_after_acknowledgement" : null;
      if (reason) add(bad("readback_outside_window"), { key: k, reason, observedAt: row.observedAt, scheduledAt: source.scheduledAt, acknowledgedAt: source.acknowledgedAt });
    }
    const startGroup = time(row.startGroup);
    if (startGroup !== null && startGroup !== time(source.scheduledAt))
      add(bad("readback_group_inconsistent"), { key: k, reason: "start group differs from the game's scheduled start", startGroup: row.startGroup, scheduledAt: source.scheduledAt });
    if (row.readId !== undefined && row.readId !== null) {
      const read = reads.get(row.readId);
      if (!read) reads.set(row.readId, { startGroup, observedAt });
      else if (read.startGroup !== startGroup || read.observedAt !== observedAt)
        add(bad("readback_group_inconsistent"), { key: k, reason: "rows of one read disagree on start group or time", readId: row.readId });
    }
    if (startGroup !== null) groupsRead.add(startGroup);

    // Withheld rows (B5) are counted per reason, never scored.
    if (row.withheld !== undefined) {
      if (!WITHHELD_REASONS.includes(row.withheld)) add(bad("readback_no_value"), { key: k, reason: `unknown withheld reason ${row.withheld}` });
      withheld[row.target] ??= Object.fromEntries(WITHHELD_REASONS.map(reason => [reason, 0]));
      if (WITHHELD_REASONS.includes(row.withheld)) withheld[row.target][row.withheld]++;
      continue;
    }
    const missing = REQUIRED_READBACK.filter(field => row[field] === undefined || row[field] === null || row[field] === "");
    if (missing.length) add(bad("readback_incomplete"), { key: k, missing });
    if (row.basis !== undefined && !PARTICIPATION_BASES.includes(row.basis)) add(bad("readback_incomplete"), { key: k, invalid: ["basis"] });
    if (row.overlayChanges !== undefined && !Array.isArray(row.overlayChanges)) add(bad("readback_incomplete"), { key: k, invalid: ["overlayChanges"] });
    const surfaceRecorded = row.servedValueSurfaceSha256 !== undefined && row.servedValueSurfaceSha256 !== null && row.servedValueSurfaceSha256 !== "";
    if (surfaceRecorded && !surfaceMap(row.servedValueSurfaceSha256)) add(bad("readback_incomplete"), { key: k, invalid: ["servedValueSurfaceSha256"] });

    // Identity: the producer closure comes from producerCodeVersion (64-hex), never from the release pin.
    if (!HEX64.test(row.producerCodeVersion ?? "")) add(bad("identity_v1_or_missing"), { source: "rso", key: k, producerCodeVersion: row.producerCodeVersion ?? null });
    else if (row.producerCodeVersion !== source.modelIdentity.codeVersion)
      add(bad("identity_mismatch"), { key: k, field: "producerCodeVersion", issued: source.modelIdentity.codeVersion, readback: row.producerCodeVersion });
    const issuedIdentity = { ...source, configurationHash: source.modelIdentity.configurationHash, artifactHash: source.modelIdentity.artifactHash };
    for (const field of IDENTITY_FIELDS) if (row[field] !== undefined && row[field] !== issuedIdentity[field])
      add(bad("identity_mismatch"), { key: k, field, issued: issuedIdentity[field], readback: row[field] });
    if (row.configurationHash !== undefined && row.artifactHash !== undefined && HEX64.test(row.producerCodeVersion ?? "")
      && row.artifactHash !== expectedArtifactHash(row.producerCodeVersion, row.configurationHash))
      add(bad("artifact_hash_mismatch"), { source: "rso", key: k, artifactHash: row.artifactHash });
    // Reset rule: closure, configuration, artifact, participation method, or served-value surface differ from the pin.
    for (const [field, value, pin] of [["codeVersion", row.producerCodeVersion, pinned(identity, "codeVersion")],
      ["configurationHash", row.configurationHash, pinned(identity, "configurationHash")],
      ["artifactHash", row.artifactHash, pinned(identity, "artifactHash")],
      ["participationMethod", participationMethod(row.participationLineage), pinned(identity, "participationLineage")]])
      if (pin !== undefined && value !== undefined && value !== null && value !== pin)
        add(bad("identity_changed"), { source: "rso", key: k, field, value, pin, readId: row.readId ?? null });
    const surfacePin = pinned(identity, "servedValueSurfaceSha256");
    const surfaceDiff = surfacePin !== undefined && surfaceMap(surfacePin) && surfaceRecorded && surfaceMap(row.servedValueSurfaceSha256)
      ? surfaceDifference(row.servedValueSurfaceSha256, surfacePin) : null;
    if (surfaceDiff) add(bad("surface_changed"), { key: k, ...surfaceDiff, readId: row.readId ?? null });
    // The lineage must name its issuance: <method>@<this row's revisionId>.
    if (typeof row.participationLineage === "string") {
      const at = row.participationLineage.lastIndexOf("@");
      if (at < 0 || row.participationLineage.slice(at + 1) !== source.revisionId)
        add(bad("lineage_without_issuance"), { key: k, participationLineage: row.participationLineage, revisionId: source.revisionId });
    }
    for (const [field, pin] of [["conditioning", pinned(identity, "conditioning")], ["component", pinned(identity, "component")]])
      if (pin !== undefined && row[field] !== undefined && row[field] !== pin)
        add(bad("readback_out_of_scope"), { key: k, field, readback: row[field], scope: pin });
    // A consumer may never allow a use the claim does not cover.
    if (allowedUses && row.allowedUses) for (const [use, allowed] of Object.entries(row.allowedUses))
      if (allowed === true && !allowedUses.includes(use)) add(bad("use_beyond_scope"), { key: k, use });

    // Overlay integrity (A6/A8): served = frozen line x (basis ends _playing ? 1 : 0); an unknown line stays unknown.
    if (row.value && typeof row.value === "object") {
      if (!("unconditionalMean" in row.value)) add(bad("readback_no_value"), { key: k });
      else if (PARTICIPATION_BASES.includes(row.basis)) {
        const line = source.value.conditionalMean, playing = row.basis.endsWith("_playing");
        const expected = line === null || line === undefined ? null : playing ? line : 0, got = row.value.unconditionalMean;
        valueChecked++;
        if (expected === null || got === null ? expected !== got : !(finite(got) && Math.abs(got - expected) <= tolerance))
          add(bad("value_mismatch"), { key: k, basis: row.basis, line, expected, readback: got });
        else valueMatched++;
      }
    }
    served.set(k, row);
  }
  for (const [k, row] of issuedByKey) if (!seen.has(k)) { add("readback_missing", { consumer: "rso", key: k, gameDate: row.gameDate }); flagged.add(k); }
  const startGroups = new Map();
  for (const row of issuedByKey.values()) { const at = time(row.scheduledAt); if (at !== null && !startGroups.has(at)) startGroups.set(at, row); }
  for (const [at, row] of [...startGroups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    if (!groupsRead.has(at)) add("readback_group_missing", { startGroup: row.scheduledAt, gameDate: row.gameDate });

  // ------------------------------------------------------------ settlement (A11; per target, version-2 repairs)
  const outcomes = new Map(), settledGames = new Set(), settlementFlagged = new Set();
  const penaltyShotExcluded = {};
  if (settlement) {
    const byKey = new Map();
    for (const raw of settlement) {
      const row = { ...raw, playerId: numericId(raw.playerId) ?? raw.playerId, gameId: numericId(raw.gameId) ?? raw.gameId };
      if (inSealed(row.gameDate)) { add("sealed_outcome_present", { key: key(row), gameDate: row.gameDate }); continue; }
      settledGames.add(row.gameId);
      if (!byKey.has(key(row))) byKey.set(key(row), []);
      byKey.get(key(row)).push(row);
    }
    for (const [k, rows] of byKey) {
      const target = rows[0].target, gameDate = issuedByKey.get(k)?.gameDate ?? rows[0].gameDate;
      const versions = rows.map(row => row.settlementVersion ?? 1);
      if (new Set(versions).size !== versions.length) { settlementFlagged.add(k); add("settlement_duplicate", { key: k, target, gameDate }); continue; }
      const v1 = rows.find(row => (row.settlementVersion ?? 1) === 1), v2 = rows.find(row => row.settlementVersion === 2);
      if (versions.some(v => v !== 1 && v !== 2) || (v2 && !v1) || (v2 && v1 && !(time(v2.recordedAt) !== null && time(v1.recordedAt) !== null && time(v2.recordedAt) > time(v1.recordedAt)))) {
        settlementFlagged.add(k); add("settlement_repair_invalid", { key: k, target, gameDate, versions }); continue;
      }
      outcomes.set(k, v2 ?? v1);
    }
  }

  // ------------------------------------------------------------ scoring rows (served, clean, settled, with a baseline)
  const playerRates = new Map((baseline?.players ?? []).map(entry => [`${numericId(entry.playerId) ?? entry.playerId}|${numericId(entry.gameId) ?? entry.gameId}|${entry.target}`, entry]));
  const groupRates = new Map((baseline?.groups ?? []).map(entry => [`${numericId(entry.gameId) ?? entry.gameId}|${entry.positionGroup}|${entry.target}`, entry]));
  const scored = [], unsettled = {}, unsettledRows = [], nullValues = {};
  for (const [k, row] of served) {
    if (flagged.has(k)) continue;
    const source = issuedByKey.get(k), target = source.target, gameDate = source.gameDate;
    if (row.value.unconditionalMean === null) { nullValues[target] = (nullValues[target] ?? 0) + 1; continue; }
    if (!settlement || !settledGames.has(source.gameId)) { unsettled[target] = (unsettled[target] ?? 0) + 1; unsettledRows.push({ target, slate: gameDate }); continue; }
    const outcome = outcomes.get(k);
    // A skater who did not dress still needs an explicit row (actual 0, dressed false): skipping him would condition on dressing.
    if (!outcome) { if (!settlementFlagged.has(k)) add("settlement_missing", { key: k, target, gameDate }); continue; }
    const recordedAt = time(outcome.recordedAt), scheduledAt = time(source.scheduledAt), issuedAt = time(source.issuedAt);
    if (recordedAt === null || scheduledAt === null || recordedAt <= scheduledAt || issuedAt === null || recordedAt <= issuedAt) {
      add("settlement_before_game", { key: k, target, gameDate, recordedAt: outcome.recordedAt }); continue;
    }
    if (!finite(outcome.actual) || outcome.actual < 0) { add("settlement_not_numeric", { key: k, target, gameDate }); continue; }
    if (finite(outcome.penaltyShotExcluded)) penaltyShotExcluded[target] = (penaltyShotExcluded[target] ?? 0) + outcome.penaltyShotExcluded;
    const base = baseline ? seasonRateBaseline({ ...source, basis: row.basis }, playerRates, groupRates) : { error: "baseline_missing", reason: "no baseline input" };
    if (base.error) { add(base.error, { key: k, target, gameDate, reason: base.reason }); continue; }
    scored.push({ key: k, target, slate: gameDate, gameId: source.gameId, playerId: source.playerId, predicted: row.value.unconditionalMean,
      baseline: base.value, baselineSource: base.source, actual: outcome.actual, basis: row.basis,
      dressed: typeof outcome.dressed === "boolean" ? outcome.dressed : null });
  }

  // Each finding is dated by its row's slate (null: not tied to a slate, so it counts at every look).
  for (const finding of findings) finding.slateDate = finding.gameDate ?? dateByKey.get(finding.key) ?? null;
  const codes = {}, classes = { integrity: 0, reset: 0, target: 0 };
  for (const finding of findings) { codes[finding.code] = (codes[finding.code] ?? 0) + 1; classes[finding.class]++; }
  const targetKeys = Object.keys(protocol?.targets ?? {}).length ? Object.keys(protocol.targets) : [...new Set([...issuedByKey.values()].map(row => row.target))].sort();
  const slates = [...new Set([...issuedByKey.values()].map(row => row.gameDate))].sort();
  const perSlate = settledCounts(scored, slates, targetKeys);
  const servedByTarget = {};
  for (const k of served.keys()) { const t = issuedByKey.get(k).target; servedByTarget[t] = (servedByTarget[t] ?? 0) + 1; }
  const counts = Object.fromEntries(targetKeys.map(target => [target, { served: servedByTarget[target] ?? 0,
    withheld: withheld[target] ?? Object.fromEntries(WITHHELD_REASONS.map(reason => [reason, 0])),
    settledScored: perSlate[target].reduce((a, b) => a + b, 0), unsettled: unsettled[target] ?? 0, nullValue: nullValues[target] ?? 0,
    penaltyShotExcluded: penaltyShotExcluded[target] ?? 0, minSettledRows: protocol?.targets?.[target]?.minSettledRows ?? null }]));
  const scopeEnded = classes.reset > 0 ? { reasons: [...new Set(findings.filter(f => f.class === "reset").map(f => f.code))].sort() } : null;
  const summary = {
    checkerVersion: CHECKER_VERSION, scopeStatus: scope?.status ?? null, pass: findings.length === 0, issued: issuedByKey.size, sealedRows, sealed, tolerance,
    integrity: { servedRows: served.size, valueChecked, valueMatched, integrityShare: served.size ? valueMatched / served.size : null,
      identityMismatch: codes.identity_mismatch ?? 0, readbackUnissued: codes.readback_unissued ?? 0,
      startGroups: startGroups.size, reads: reads.size },
    counts, slates, scopeEnded, releasePinsSeen: [...releasePins].sort(), findingCodes: codes, findingClasses: classes,
  };
  const result = { findings, summary };
  if (look !== null) {
    result.look = evaluateLook({ look, scored, unsettledRows, slates, perSlate, targetKeys, findings, protocol, replicates, rng });
    // Verdicts against an unpinned (draft) scope are a dry run, never evidence.
    result.look.dryRun = scope?.status !== "pinned";
  }
  return result;
}

/** Per-target metrics and verdict for one look. Integrity findings stop/fail every target; a reset ends the scope;
 * target-class findings within the look's slates keep only that target from passing. */
function evaluateLook({ look, scored, unsettledRows, slates, perSlate, targetKeys, findings, protocol, replicates, rng }) {
  if (!protocol) throw new Error("a look needs the scope");
  const bootstrap = protocol.bootstrap, baseSeedHex = bootstrap.seed.baseSeedHex;
  const reps = replicates ?? bootstrap.replicates, quantiles = bootstrap.interval.quantiles;
  // Integrity and reset findings count at a look when their slate is in it (or they belong to no slate).
  const within = (finding, lastDate) => finding.slateDate === null || finding.slateDate <= lastDate;
  const integrityFailedBy = lastDate => findings.some(f => f.class === "integrity" && within(f, lastDate));
  const scopeEndedBy = lastDate => findings.some(f => f.class === "reset" && within(f, lastDate));
  const evaluate = (target, lookId, lastDate) => {
    const rows = scored.filter(row => row.target === target && row.slate <= lastDate);
    const seedHex = deriveStreamSeedHex(baseSeedHex, target, lookId);
    const metrics = targetMetrics(rows);
    const interval = clusteredBootstrap(rows, { replicates: reps, seed: seedFromHex(seedHex), nextU64: rng?.(target, lookId) ?? null, quantiles });
    const strata = {};
    for (const basis of PARTICIPATION_BASES) {
      const part = rows.filter(row => row.basis === basis);
      if (part.length) strata[basis] = targetMetrics(part);
    }
    const dressed = Object.fromEntries(PARTICIPATION_BASES.map(basis => [basis, { dressed: 0, notDressed: 0, unknown: 0 }]));
    for (const row of rows) dressed[row.basis][row.dressed === true ? "dressed" : row.dressed === false ? "notDressed" : "unknown"]++;
    const dataFindings = findings.filter(f => f.class === "target" && f.target === target && typeof f.gameDate === "string" && f.gameDate <= lastDate).length;
    const unsettled = unsettledRows.filter(row => row.target === target && row.slate <= lastDate).length;
    return { target, lookId, streamSeedHex: seedHex, rows: rows.length, metrics, bootstrap: interval, byBasis: strata, basisVsDressed: dressed,
      dataFindings, unsettled };
  };
  const lookOne = () => {
    const plan = lookPlan(slates, perSlate, protocol.targets);
    if (!plan.lookOne.reached) return { plan, targets: null };
    const targets = {};
    for (const target of targetKeys) {
      const result = evaluate(target, LOOK_IDS[1], plan.lookOne.date), harm = protocol.targets[target].lookOneHarm;
      const reasons = [];
      if (scopeEndedBy(plan.lookOne.date)) result.status = "scope_ended";
      else if (integrityFailedBy(plan.lookOne.date)) result.status = "stop_integrity";
      else {
        if (result.metrics.bias !== null && Math.abs(result.metrics.bias) > harm.absBiasAbove) reasons.push("abs_bias");
        if (!result.bootstrap.inconclusive && result.bootstrap.deltaMseRel.lower !== null && result.bootstrap.deltaMseRel.lower > harm.deltaMseRelLower95Above) reasons.push("delta_mse_lower95");
        result.status = reasons.length ? "stop_harm" : result.bootstrap.inconclusive || result.metrics.bias === null ? "inconclusive" : "continue";
      }
      result.reasons = reasons;
      targets[target] = result;
    }
    return { plan, targets };
  };
  const first = lookOne();
  if (look === "1" || look === 1) return { look: LOOK_IDS[1], slate: first.plan.lookOne, plan: first.plan, targets: first.targets,
    neverDeclaresSuccess: true };
  if (look !== "final") throw new Error(`look must be 1 or final, got ${look}`);
  const stopped = first.targets ? Object.values(first.targets).filter(t => t.status === "stop_harm" || t.status === "stop_integrity").map(t => t.target) : [];
  const plan = lookPlan(slates, perSlate, protocol.targets, { stoppedAtLookOne: stopped });
  if (!plan.final.reached) return { look: LOOK_IDS.final, slate: plan.final, plan, lookOne: summarizeLookOne(first), targets: null };
  const targets = {};
  for (const target of targetKeys) {
    const spec = protocol.targets[target];
    if (stopped.includes(target)) { targets[target] = { target, status: "stopped_at_look1", reasons: first.targets[target].reasons }; continue; }
    const result = evaluate(target, LOOK_IDS.final, plan.final.date), m = result.metrics, upper = result.bootstrap.deltaMseRel.upper;
    const failed = [];
    if (scopeEndedBy(plan.final.date)) result.status = "scope_ended";
    else if (integrityFailedBy(plan.final.date)) result.status = "fail_integrity";
    else if (plan.final.short.includes(target)) result.status = "inconclusive_short";
    else if (result.dataFindings || result.unsettled) result.status = "inconclusive_data";
    else if (result.bootstrap.inconclusive || m.bias === null || m.calibrationSlope === null || upper === null) result.status = "inconclusive";
    else {
      if (!(Math.abs(m.bias) <= spec.absBiasMax)) failed.push("abs_bias");
      if (!(m.calibrationSlope >= spec.calibrationSlope[0] && m.calibrationSlope <= spec.calibrationSlope[1])) failed.push("calibration_slope");
      if (!(upper < spec.deltaMseRelUpper95Max)) failed.push("delta_mse_upper95");
      if (result.rows < spec.minSettledRows) failed.push("min_settled_rows");
      result.status = failed.length ? "fail" : "pass";
    }
    result.failedGates = failed;
    targets[target] = result;
  }
  return { look: LOOK_IDS.final, slate: plan.final, plan, lookOne: summarizeLookOne(first), targets };
}
const summarizeLookOne = first => first.targets
  ? Object.fromEntries(Object.entries(first.targets).map(([target, t]) => [target, { status: t.status, reasons: t.reasons }])) : null;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!name?.startsWith("--") || argv[index + 1] === undefined) throw new Error(`bad argument ${name}`);
    args[name.slice(2)] = argv[index + 1];
  }
  return args;
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(String(error.message)); process.exit(2); }
  const fail = message => { console.error(message); process.exit(2); };
  const read = path => JSON.parse(readFileSync(path, "utf8"));
  if (args["start-chart"]) fail("--start-chart was removed in v2 (B2: RSO is the only claimed consumer)");
  if (!args.issued || !args.rso) fail("need --issued and --rso");
  if (args.look !== undefined && !["1", "final"].includes(args.look)) fail("--look is 1 or final");
  if (args.look !== undefined && (!args.scope || !args.settlement || !args.baseline)) fail("--look needs --scope, --settlement and --baseline");
  let scope = null;
  if (args.scope) {
    const { scope: parsed, problems } = readScope(read(args.scope), { allowDraft: args["allow-draft-scope"] === "true" });
    if (problems.length) fail(`scope refused: ${problems.join("; ")}`);
    scope = parsed;
  }
  let sealed = scope?.protocol?.sealed ?? null;
  if (args.sealed) {
    const [from, to] = args.sealed.split("..");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) fail("--sealed is YYYY-MM-DD..YYYY-MM-DD");
    if (scope && (from !== sealed.from || to !== sealed.to)) fail("--sealed cannot change the declared scope");
    sealed = { from, to };
  }
  if (!sealed) fail("need --scope or --sealed");
  const declaredTolerance = scope?.protocol?.readback?.tolerance;
  if (args.tolerance !== undefined && (!finite(Number(args.tolerance)) || (scope && Number(args.tolerance) !== declaredTolerance)))
    fail("--tolerance must be a number and cannot change the declared scope");
  const report = checkReadbacks({ issued: read(args.issued), rso: read(args.rso), settlement: args.settlement ? read(args.settlement) : null,
    baseline: args.baseline ? read(args.baseline) : null, scope, sealed,
    tolerance: args.tolerance ? Number(args.tolerance) : scope?.protocol?.readback?.tolerance ?? 0.0001, look: args.look ?? null });
  report.summary.scopeHash = scope ? canonicalHash(scope) : null;
  report.summary.protocolHash = scope?.protocolHash ?? null;
  report.summary.bootstrap = scope ? { version: scope.protocol.bootstrap.version, replicates: scope.protocol.bootstrap.replicates,
    baseSeedHex: scope.protocol.bootstrap.seed.baseSeedHex } : null;
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) writeFileSync(args.out, text); else process.stdout.write(text);
  process.exit(report.summary.pass ? 0 : 1);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
