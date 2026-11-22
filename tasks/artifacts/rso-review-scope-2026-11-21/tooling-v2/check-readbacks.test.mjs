// Offline self-tests for the v2 checker: node --test check-readbacks.test.mjs (no network, no DB, synthetic fixtures only).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FINDING_CLASS, SURFACE_PATHS, canonicalHash, checkReadbacks, expectedArtifactHash, readScope } from "./check-readbacks.mjs";
import { deriveBaseSeedHex, deriveStreamSeedHex } from "./metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, "check-readbacks.mjs");
const fixture = name => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const real = () => JSON.parse(readFileSync(join(here, "..", "SCOPE-AMENDED.json"), "utf8"));
const clean = () => ({ issued: fixture("issued.json"), rso: fixture("rso.json"), settlement: fixture("settlement.json"),
  baseline: fixture("baseline.json"), scope: fixture("scope.json") });
const exercised = new Set();
/** Runs the checker and records every finding code it produced, for the coverage test at the end. */
const run = input => { const report = checkReadbacks(input); for (const f of report.findings) exercised.add(f.code); return report; };
const codes = report => Object.keys(report.summary.findingCodes).sort();
const OTHER64 = "e".repeat(64);
// Fixture order: SHOTS_ON_GOAL for players 8470001..8470004, then GOALS for the same four. Index 2 is 8470003 (assumed_out,
// game 2026120102, starts 02:00Z); index 0 is 8470001 (confirmed_playing, game 2026120101, starts 00:00Z).

// ------------------------------------------------------------ scope reading

test("the real amended scope: hash matches, refused while awaiting identity, accepted as a draft", () => {
  const scope = real();
  assert.equal(canonicalHash(scope.protocol), "2acaff686c4953f60d17a17cfe0c59af76beb043e82a9a384b3a2824fb871469");
  assert.deepEqual(readScope(scope, { allowDraft: true }).problems, []);
  // PENDING placeholders count as unpinned, not as pinned values.
  assert.deepEqual(readScope(scope).problems, ["identity_unpinned:modelMode,codeVersion,configurationHash,artifactHash,servedValueSurfaceSha256"]);
  // The fixture declares the same protocol with a fictional pin.
  assert.equal(fixture("scope.json").protocolHash, scope.protocolHash);
  assert.deepEqual(fixture("scope.json").protocol, scope.protocol);
  assert.deepEqual(readScope(fixture("scope.json")).problems, []);
});

test("amended_awaiting_identity is unpinned even with literal values; a PENDING value is unpinned even when pinned", () => {
  const awaiting = fixture("scope.json"); awaiting.status = "amended_awaiting_identity";
  assert.deepEqual(readScope(awaiting).problems, ["identity_unpinned:amended_awaiting_identity"]);
  const pending = fixture("scope.json"); pending.identity.configurationHash = "PENDING: later";
  assert.deepEqual(readScope(pending).problems, ["identity_unpinned:configurationHash"]);
});

test("a pinned identity must be the v2 64-hex closure with its implied artifact hash and literal values", () => {
  const sha40 = fixture("scope.json"); sha40.identity.codeVersion = "a".repeat(40);
  assert.deepEqual(readScope(sha40).problems, ["pinned_code_version_not_closure", "pinned_artifact_hash_mismatch"]);
  const artifact = fixture("scope.json"); artifact.identity.artifactHash = OTHER64;
  assert.deepEqual(readScope(artifact).problems, ["pinned_artifact_hash_mismatch"]);
  const v1 = fixture("scope.json"); v1.identity.modelIdentityVersion = "forge-model-identity-v1";
  assert.deepEqual(readScope(v1).problems, ["pinned_model_identity_not_v2"]);
  const prose = real(); Object.assign(prose.identity, fixture("scope.json").identity, { participationLineage: real().identity.participationLineage }); prose.status = "pinned";
  assert.deepEqual(readScope(prose).problems, ["pinned_participation_lineage_not_literal"]);
  // The B7 surface is a { path: sha256 } map of exactly its three files, sorted by path; a combined hash is refused.
  const pin = fixture("scope.json").identity.servedValueSurfaceSha256;
  for (const bad of [OTHER64, {}, { ...pin, "web/lib/projections/extra.ts": OTHER64 },
    Object.fromEntries(Object.entries(pin).slice(1)), Object.fromEntries(Object.entries(pin).reverse()),
    { ...pin, [SURFACE_PATHS[0]]: "abc" }]) {
    const surface = fixture("scope.json"); surface.identity.servedValueSurfaceSha256 = bad;
    assert.deepEqual(readScope(surface).problems, ["pinned_surface_map_invalid"], JSON.stringify(bad));
  }
  assert.deepEqual(Object.keys(pin), SURFACE_PATHS);
  const targets = fixture("scope.json"); targets.identity.targets = ["SHOTS_ON_GOAL"];
  assert.deepEqual(readScope(targets).problems, ["pinned_targets_differ_from_protocol"]);
});

test("the scope version, protocol hash and bootstrap seed are all checked", () => {
  const v1 = fixture("scope.json"); v1.version = "forge-qual-scope-v1";
  assert.deepEqual(readScope(v1).problems, ["scope_version"]);
  const edited = fixture("scope.json"); edited.protocol.targets.GOALS.absBiasMax = 0.2;
  assert.deepEqual(readScope(edited).problems, ["protocol_hash_mismatch"]);
  const seed = fixture("scope.json"); seed.protocol.bootstrap.seed.baseSeedHex = "0000000000000000";
  seed.protocolHash = canonicalHash(seed.protocol);
  assert.deepEqual(readScope(seed).problems, ["bootstrap_seed_mismatch"]);
});

// ------------------------------------------------------------ integrity: clean, overlay value, identity

test("the clean fixture passes: every row served, matched, settled and scored", () => {
  const report = run(clean());
  assert.deepEqual(report.findings, []);
  assert.equal(report.summary.pass, true);
  assert.deepEqual(report.summary.integrity, { servedRows: 8, valueChecked: 8, valueMatched: 8, integrityShare: 1, identityMismatch: 0,
    readbackUnissued: 0, startGroups: 2, reads: 2 });
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.settledScored, 4);
  assert.equal(report.summary.counts.ASSISTS.served, 0);
  assert.deepEqual(report.summary.releasePinsSeen, ["fixture0".repeat(5)]);
  assert.equal(report.summary.scopeEnded, null);
});

test("overlay value: frozen line x 1 for _playing, x 0 for _out; RSO's 4-decimal rounding passes", () => {
  const input = clean();
  input.rso[2].value.unconditionalMean = 2.1; // assumed_out served the line instead of 0
  input.rso[0].value.unconditionalMean = 0; // confirmed_playing served 0
  const report = run(input);
  assert.deepEqual(report.findings.map(f => [f.code, f.key, f.expected]), [["value_mismatch", "8470001|2026120101|SHOTS_ON_GOAL", 2.8],
    ["value_mismatch", "8470003|2026120102|SHOTS_ON_GOAL", 0]]);
  assert.equal(report.summary.integrity.integrityShare, 6 / 8);
  const rounded = clean(); rounded.issued[0].value.conditionalMean = 2.80004;
  assert.equal(run(rounded).summary.pass, true);
  rounded.issued[0].value.conditionalMean = 2.8002;
  assert.deepEqual(codes(run(rounded)), ["value_mismatch"]);
});

test("an unknown line stays unknown: a null line served as 0 fails, served as null is counted and not scored", () => {
  const input = clean();
  input.issued[1].value.conditionalMean = null;
  input.rso[1].value.unconditionalMean = null;
  const report = run(input);
  assert.equal(report.summary.pass, true);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.nullValue, 1);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.settledScored, 3);
  input.rso[1].value.unconditionalMean = 0;
  assert.deepEqual(codes(run(input)), ["value_mismatch"]);
});

test("identity_v1_or_missing: a v1, absent or 40-hex identity on issued rows, a missing or 40-hex producer closure on readbacks", () => {
  const input = clean();
  input.issued[0].modelIdentity.version = "forge-model-identity-v1";
  input.issued[1].modelIdentity = {};
  input.issued[3].modelIdentity.codeVersion = "a".repeat(40);
  delete input.rso[4].producerCodeVersion;
  input.rso[5].producerCodeVersion = "f".repeat(40);
  const report = run(input);
  assert.deepEqual(report.findings.filter(f => f.code === "identity_v1_or_missing").map(f => [f.source, f.key.split("|")[0], f.key.split("|")[2]]),
    [["issued", "8470001", "SHOTS_ON_GOAL"], ["issued", "8470002", "SHOTS_ON_GOAL"], ["issued", "8470004", "SHOTS_ON_GOAL"],
      ["rso", "8470001", "GOALS"], ["rso", "8470002", "GOALS"]]);
  // The release pin is recorded, never compared: a different deploy SHA alone is no finding.
  const pin = clean(); for (const row of pin.rso) row.releasePin = "b".repeat(40);
  assert.equal(run(pin).summary.pass, true);
});

test("a rejected issued row does not cascade into readback_unissued; integrityShare is over every served row", () => {
  const input = clean();
  input.issued[0].modelIdentity.version = "forge-model-identity-v1";
  input.rso[1].basis = "probably_playing";
  const report = run(input);
  assert.deepEqual(codes(report), ["identity_v1_or_missing", "readback_incomplete"]);
  assert.equal(report.summary.integrity.servedRows, 7);
  assert.equal(report.summary.integrity.valueChecked, 6);
  assert.equal(report.summary.integrity.integrityShare, 6 / 7);
});

test("artifact_hash_mismatch: artifactHash must be sha256({codeVersion, configurationHash})", () => {
  const input = clean();
  input.issued[0].modelIdentity.artifactHash = OTHER64;
  input.rso[4].artifactHash = OTHER64;
  const report = run(input);
  assert.deepEqual(report.findings.filter(f => f.code === "artifact_hash_mismatch").map(f => f.source), ["issued", "rso"]);
  assert.equal(expectedArtifactHash("c0de".repeat(16), "0c0f".repeat(16)), fixture("scope.json").identity.artifactHash);
});

test("identity_changed: a producer closure, configuration, artifact or participation method other than the pin ends the scope", () => {
  const input = clean();
  const codeVersion = OTHER64, configurationHash = input.scope.identity.configurationHash;
  Object.assign(input.scope.identity, { codeVersion, artifactHash: expectedArtifactHash(codeVersion, configurationHash) });
  const report = run(input);
  assert.deepEqual(codes(report), ["identity_changed"]);
  assert.equal(report.findings.filter(f => f.source === "issued").length, 16); // codeVersion and artifactHash, 8 rows
  assert.deepEqual(report.summary.scopeEnded, { reasons: ["identity_changed"] });
  const method = clean(); method.rso[0].participationLineage = "forge-rso-participation-overlay-v2:skater@fixture-rev-2026120101";
  assert.deepEqual(run(method).findings.map(f => [f.code, f.field]), [["identity_changed", "participationMethod"]]);
});

test("surface_changed: any B7 path added, removed or with another sha256 than the pin ends the scope", () => {
  const input = clean(), pin = input.scope.identity.servedValueSurfaceSha256;
  input.rso[3].servedValueSurfaceSha256 = { ...pin, [SURFACE_PATHS[1]]: OTHER64 };
  input.rso[5].servedValueSurfaceSha256 = { ...pin, "web/lib/projections/extra.ts": OTHER64 };
  input.rso[6].servedValueSurfaceSha256 = Object.fromEntries(Object.entries(pin).slice(1));
  // Key order on a readback does not matter: equality is path by path.
  input.rso[7].servedValueSurfaceSha256 = Object.fromEntries(Object.entries(pin).reverse());
  const report = run(input);
  assert.deepEqual(codes(report), ["surface_changed"]);
  assert.deepEqual(report.findings.map(f => [f.key.split("|")[0], f.added, f.removed, f.changed]), [
    ["8470004", [], [], [SURFACE_PATHS[1]]], ["8470002", ["web/lib/projections/extra.ts"], [], []], ["8470003", [], [SURFACE_PATHS[0]], []]]);
  assert.deepEqual(report.summary.scopeEnded, { reasons: ["surface_changed"] });
  assert.equal(report.summary.findingClasses.reset, 3);
  // A combined string or a malformed map is not a recorded surface.
  const combined = clean(); combined.rso[0].servedValueSurfaceSha256 = OTHER64;
  assert.deepEqual(run(combined).findings.map(f => [f.code, f.invalid]), [["readback_incomplete", ["servedValueSurfaceSha256"]]]);
});

test("lineage_without_issuance: the overlay lineage must end @<this row's revisionId>", () => {
  const input = clean();
  input.rso[0].participationLineage = "forge-rso-participation-overlay-v1:skater";
  input.rso[1].participationLineage = "forge-rso-participation-overlay-v1:skater@fixture-rev-2026120102";
  assert.deepEqual(run(input).findings.map(f => [f.code, f.key.split("|")[0]]),
    [["lineage_without_issuance", "8470001"], ["lineage_without_issuance", "8470002"]]);
});

test("identity_mismatch and readback_out_of_scope: readback identity must equal its issued row and the pinned conditioning", () => {
  const input = clean();
  input.rso[0].cutoffAt = "2026-12-01T16:00:00Z";
  input.rso[1].conditioning = "issued_participation";
  input.rso[2].component = "forge-skater";
  const report = run(input);
  assert.deepEqual(report.findings.map(f => [f.code, f.field]), [["identity_mismatch", "cutoffAt"], ["readback_out_of_scope", "conditioning"],
    ["readback_out_of_scope", "component"]]);
  assert.equal(report.summary.integrity.identityMismatch, 1);
});

test("issued rows: empty, incomplete, invalid ids, duplicate, out of scope", () => {
  assert.deepEqual(codes(run({ ...clean(), issued: [], rso: [], settlement: [] })), ["issued_empty"]);
  const input = clean();
  delete input.issued[0].acknowledgedAt;
  input.issued[1].playerId = "fixture-player";
  input.issued.push(structuredClone(input.issued[3]));
  input.issued[4].method = "fixture-other";
  input.issued[5].target = "FACEOFFS";
  const report = run(input);
  assert.deepEqual(report.findings.filter(f => f.code === "issued_incomplete").map(f => [f.missing, f.invalid]),
    [[["acknowledgedAt"], []], [[], ["playerId"]]]);
  assert.ok(codes(report).includes("issued_duplicate"));
  assert.deepEqual(report.findings.filter(f => f.code === "issued_out_of_scope").map(f => f.field), ["method", "target"]);
});

test("issuance chronology: cutoff after issue, or issue at or after puck drop, fails", () => {
  const input = clean();
  input.issued[0].cutoffAt = "2026-12-01T23:00:00Z";
  input.rso[0].cutoffAt = "2026-12-01T23:00:00Z";
  input.issued[1].issuedAt = "2026-12-02T00:00:00Z";
  const report = run(input);
  assert.ok(codes(report).includes("cutoff_after_issue"));
  assert.ok(codes(report).includes("issued_after_puck_drop"));
});

// ------------------------------------------------------------ readback coverage, timing and groups (B5, B6)

test("readbacks: duplicate, unissued, missing, and a start group with no read", () => {
  const input = clean();
  input.rso.push(structuredClone(input.rso[0]));
  input.rso.push({ ...structuredClone(input.rso[0]), playerId: 8479999 });
  const report = run(input);
  assert.deepEqual(codes(report), ["readback_duplicate", "readback_unissued"]);
  assert.equal(report.summary.integrity.readbackUnissued, 1);
  const gone = clean();
  gone.rso = gone.rso.filter(row => row.gameId !== 2026120102);
  const missing = run(gone);
  assert.equal(missing.summary.findingCodes.readback_missing, 4);
  assert.deepEqual(missing.findings.filter(f => f.code === "readback_group_missing").map(f => f.startGroup), ["2026-12-02T02:00:00Z"]);
});

test("withheld rows are counted per reason and never scored or missing; an unknown reason has no value", () => {
  const input = clean();
  input.rso[2] = { playerId: 8470003, gameId: 2026120102, target: "SHOTS_ON_GOAL", readId: "read-0200Z", startGroup: "2026-12-02T02:00:00Z",
    observedAt: "2026-12-02T01:30:00Z", withheld: "stale_source" };
  const report = run(input);
  assert.equal(report.summary.pass, true);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.withheld.stale_source, 1);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.served, 3);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.settledScored, 3);
  input.rso[2].withheld = "felt_like_it";
  assert.deepEqual(codes(run(input)), ["readback_no_value"]);
});

test("readback_incomplete and readback_no_value: served rows carry basis, lineage, changes, surface and a value", () => {
  const input = clean();
  delete input.rso[0].basis;
  input.rso[1].basis = "probably_playing";
  input.rso[2].overlayChanges = "none";
  delete input.rso[3].servedValueSurfaceSha256;
  input.rso[4].value = {};
  const report = run(input);
  assert.deepEqual(report.findings.filter(f => f.code === "readback_incomplete").map(f => f.missing ?? f.invalid),
    [["basis"], ["basis"], ["overlayChanges"], ["servedValueSurfaceSha256"]]);
  assert.ok(codes(report).includes("readback_no_value"));
});

test("use_beyond_scope: RSO may allow only totals and comparison", () => {
  const input = clean();
  input.rso[1].allowedUses = { assignment: true, totals: true, comparison: true, conditionalTieBreak: false };
  assert.deepEqual(run(input).findings.map(f => [f.code, f.use]), [["use_beyond_scope", "assignment"]]);
});

test("per-start T-30 window: [start - 30 min, start), after the game's own T-60 acknowledgement", () => {
  const window = (observedAt, issued = {}) => {
    const input = clean();
    Object.assign(input.issued[0], issued);
    for (const row of input.rso) if (row.readId === "read-0000Z") row.observedAt = observedAt; // the whole read moves
    const report = run(input);
    return report.findings.filter(f => f.code === "readback_outside_window").map(f => f.reason)[0] ?? (report.summary.pass ? "ok" : codes(report).join());
  };
  assert.equal(window("2026-12-01T23:30:00Z"), "ok");
  assert.equal(window("2026-12-01T23:30:00.000000Z"), "ok");
  assert.equal(window("2026-12-01T23:29:59.999999Z"), "before_t_minus_30");
  assert.equal(window("2026-12-01T23:59:59.999999Z"), "ok");
  assert.equal(window("2026-12-02T00:00:00Z"), "at_or_after_start");
  assert.equal(window("2026-12-01T23:30:00Z", { acknowledgedAt: "2026-12-01T23:30:00Z" }), "not_after_acknowledgement");
  assert.equal(window("2026-12-01T23:30:00Z", { acknowledgedAt: "not-a-time" }), "no_acknowledgement");
});

test("readback clocks: a missing or invalid capture time, or a read before issue, fails", () => {
  for (const observedAt of [undefined, "not-a-time", "2026-12-01T23:30:00", "2026-11-31T23:30:00Z"]) {
    const input = clean(); input.rso[0].observedAt = observedAt;
    assert.ok(codes(run(input)).includes("readback_capture_time_missing_or_invalid"), String(observedAt));
  }
  const early = clean(); early.issued[0].issuedAt = "2026-12-01T23:40:00Z";
  assert.ok(codes(run(early)).includes("readback_before_issue"));
});

test("readback_group_inconsistent: a start group other than the game's start, or one read with two times", () => {
  const input = clean();
  input.rso[0].startGroup = "2026-12-02T02:00:00Z";
  const report = run(input);
  // The moved row also disagrees with the rest of its read.
  assert.deepEqual(codes(report), ["readback_group_inconsistent"]);
  assert.deepEqual([...new Set(report.findings.map(f => f.reason))], ["start group differs from the game's scheduled start",
    "rows of one read disagree on start group or time"]);
  const split = clean(); split.rso[1].observedAt = "2026-12-01T23:31:00Z";
  assert.deepEqual(run(split).findings.map(f => [f.code, f.reason]), [["readback_group_inconsistent", "rows of one read disagree on start group or time"]]);
});

test("the sealed window: issued rows, readbacks and outcomes inside it fail and are never scored", () => {
  const input = clean();
  input.issued[0].gameDate = "2026-10-27";
  input.settlement[1].gameDate = "2026-10-27";
  const report = run(input);
  // The sealed outcome is dropped, so the served row it belonged to has no settlement.
  assert.deepEqual(codes(report), ["sealed_issued_present", "sealed_outcome_present", "sealed_readback_present", "settlement_missing"]);
  assert.equal(report.summary.sealedRows, 1);
  assert.equal(report.summary.counts.SHOTS_ON_GOAL.settledScored, 2);
});

// ------------------------------------------------------------ settlement and baseline (target-class findings)

test("a served row of a settled game needs an explicit settlement row, even when he did not dress", () => {
  const input = clean();
  input.settlement.splice(2, 1); // 8470003 did not dress: actual 0, dressed false must still be supplied
  const report = run(input);
  assert.deepEqual(report.findings.map(f => [f.code, f.class, f.target]), [["settlement_missing", "target", "SHOTS_ON_GOAL"]]);
  // A game with no settlement rows yet is pending, not missing.
  const pending = clean(); pending.settlement = pending.settlement.filter(row => row.gameId !== 2026120102);
  const waiting = run(pending);
  assert.equal(waiting.summary.pass, true);
  assert.equal(waiting.summary.counts.SHOTS_ON_GOAL.unsettled, 2);
});

test("settlement rules: recorded after puck drop, numeric, one row per version, a version 2 repair only after version 1", () => {
  const input = clean();
  input.settlement[0].recordedAt = "2026-12-01T23:00:00Z";
  input.settlement[1].actual = null;
  input.settlement.push({ ...input.settlement[3] });
  input.settlement[5] = { ...input.settlement[5], settlementVersion: 2 };
  input.settlement[6].settlementVersion = 2;
  input.settlement.push({ ...input.settlement[6], settlementVersion: 1, recordedAt: "2026-12-02T18:00:00Z" });
  const report = run(input);
  assert.deepEqual(report.findings.map(f => [f.code, f.key.split("|")[0], f.target]), [
    ["settlement_duplicate", "8470004", "SHOTS_ON_GOAL"], ["settlement_repair_invalid", "8470002", "GOALS"],
    ["settlement_repair_invalid", "8470003", "GOALS"], ["settlement_before_game", "8470001", "SHOTS_ON_GOAL"],
    ["settlement_not_numeric", "8470002", "SHOTS_ON_GOAL"]]);
  assert.ok(report.findings.every(f => f.class === "target"));
});

test("baseline: a missing entry or one not at the revision cutoff is a target-class finding", () => {
  const input = clean();
  input.baseline.players = input.baseline.players.filter(p => !(p.playerId === 8470004 && p.target === "GOALS"));
  input.baseline.players[0].cutoffAt = "2026-12-01T14:00:00Z";
  // 8470002 has 3 GP: without the D group rate there is no baseline.
  input.baseline.groups = input.baseline.groups.filter(g => !(g.positionGroup === "D" && g.target === "SHOTS_ON_GOAL"));
  const report = run(input);
  assert.deepEqual(report.findings.map(f => [f.code, f.key.split("|")[0], f.target]), [["baseline_invalid", "8470001", "SHOTS_ON_GOAL"],
    ["baseline_missing", "8470002", "SHOTS_ON_GOAL"], ["baseline_missing", "8470004", "GOALS"]]);
});

// ------------------------------------------------------------ looks (B4), metrics, determinism

const TARGETS = ["GOALS", "ASSISTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS"];
const BASE = { GOALS: 0.2, ASSISTS: 0.3, PP_POINTS: 0.1, SHOTS_ON_GOAL: 2, HITS: 1.5, BLOCKED_SHOTS: 1 };
/** A synthetic season: 2 games a slate at 00:00Z and 01:00Z, 4 teams of 3 skaters, every target. FORGE is close to the
 * outcome; the baseline rate is 3x the base (poor). `inflate` multiplies a target's issued line (harm). */
function synthetic({ slates = 16, inflate = {} } = {}) {
  const scope = fixture("scope.json"), id = scope.identity;
  const issued = [], rso = [], settlement = [], baseline = { players: [], groups: [] };
  for (let s = 0; s < slates; s++) {
    const day = new Date(Date.UTC(2026, 11, 1 + s)), date = day.toISOString().slice(0, 10), next = new Date(day.getTime() + 864e5).toISOString().slice(0, 10);
    for (const [g, teams] of [[0, [0, 1]], [1, [2, 3]]]) {
      const gameId = 2026130000 + s * 10 + g, start = `${next}T0${g}:00:00Z`, at = minutes => new Date(Date.parse(start) + minutes * 6e4).toISOString();
      const revisionId = `syn-rev-${gameId}`, cutoffAt = at(-480), readId = `syn-read-${date}-${g}`;
      for (const team of teams) for (let j = 0; j < 3; j++) {
        const playerId = 8480000 + team * 10 + j, out = team === 3 && j === 2 && s % 2 === 0;
        for (const target of TARGETS) {
          const line = BASE[target] * (1 + 0.5 * ((playerId + s) % 3)), shift = j === 0 ? 0.25 : j === 1 ? -0.25 : 0;
          const issuedLine = line * (inflate[target] ?? 1), actual = out ? 0 : line + shift * BASE[target];
          issued.push({ revisionId, playerId, gameId, target, method: id.modelMode, modelIdentity: { version: "forge-model-identity-v2",
            artifact: "no_fitted_artifact", codeVersion: id.codeVersion, configurationHash: id.configurationHash, artifactHash: id.artifactHash },
          cutoffAt, issuedAt: at(-65), acknowledgedAt: at(-59), scheduledAt: start, gameDate: date, horizon: 1, value: { conditionalMean: issuedLine } });
          rso.push({ playerId, gameId, target, revisionId, readId, startGroup: start, observedAt: at(-30), basis: out ? "assumed_out" : "assumed_playing",
            participationLineage: `${id.participationLineage}@${revisionId}`, conditioning: id.conditioning, overlayChanges: [],
            producerCodeVersion: id.codeVersion, servedValueSurfaceSha256: id.servedValueSurfaceSha256, value: { unconditionalMean: out ? 0 : issuedLine } });
          settlement.push({ playerId, gameId, target, gameDate: date, actual, dressed: !out, recordedAt: `${next}T17:00:00Z`, settlementVersion: 1 });
          baseline.players.push({ playerId, gameId, target, cutoffAt, gamesPlayed: team === 0 && j === 2 ? 2 : 10 + s,
            seasonTotal: 3 * BASE[target] * (10 + s), positionGroup: j === 2 ? "D" : "F" });
        }
      }
      for (const target of TARGETS) for (const positionGroup of ["F", "D"])
        baseline.groups.push({ gameId, positionGroup, target, cutoffAt, gamesPlayed: 100, seasonTotal: 300 * BASE[target] });
    }
  }
  // Test-only minimums so 16 slates can reach a final look (12 rows a slate a target); the protocol itself is unchanged.
  const testScope = structuredClone(scope);
  for (const target of TARGETS) testScope.protocol.targets[target].minSettledRows = 100;
  return { issued, rso, settlement, baseline, scope: testScope };
}
const FAST = 400;

test("look 1: a target with harmful bias stops; the others continue; look 1 never declares success", () => {
  const input = synthetic({ inflate: { HITS: 2.5 } });
  const report = run({ ...input, look: "1", replicates: FAST });
  assert.equal(report.summary.pass, true);
  assert.deepEqual(report.look.slate, { slate: 7, date: "2026-12-07", reached: true });
  assert.equal(report.look.neverDeclaresSuccess, true);
  assert.deepEqual(Object.fromEntries(Object.entries(report.look.targets).map(([t, r]) => [t, r.status])),
    { GOALS: "continue", ASSISTS: "continue", PP_POINTS: "continue", SHOTS_ON_GOAL: "continue", HITS: "stop_harm", BLOCKED_SHOTS: "continue" });
  assert.deepEqual(report.look.targets.HITS.reasons, ["abs_bias", "delta_mse_lower95"]);
  assert.equal(report.look.targets.GOALS.rows, 84); // 7 slates x 12 rows
  // Basis strata and the basis-vs-dressed table are recorded per target.
  assert.deepEqual(report.look.targets.GOALS.basisVsDressed.assumed_out, { dressed: 0, notDressed: 4, unknown: 0 });
  assert.equal(report.look.targets.GOALS.byBasis.assumed_out.n, 4);
});

test("final look: slate 14, every gate per target, the look-1 stop carried; seeds re-derive from the protocol", () => {
  const input = synthetic({ inflate: { HITS: 2.5 } });
  const report = run({ ...input, look: "final", replicates: FAST });
  assert.deepEqual(report.look.slate, { slate: 14, date: "2026-12-14", reached: true, short: [] });
  const status = Object.fromEntries(Object.entries(report.look.targets).map(([t, r]) => [t, r.status]));
  assert.deepEqual(status, { GOALS: "pass", ASSISTS: "pass", PP_POINTS: "pass", SHOTS_ON_GOAL: "pass", HITS: "stopped_at_look1", BLOCKED_SHOTS: "pass" });
  const sog = report.look.targets.SHOTS_ON_GOAL;
  assert.equal(sog.rows, 168);
  assert.ok(sog.bootstrap.deltaMseRel.upper < 0.03);
  const base = deriveBaseSeedHex(fixture("scope.json").protocol.bootstrap.seed.preBootstrapProtocolHash);
  assert.equal(sog.streamSeedHex, deriveStreamSeedHex(base, "SHOTS_ON_GOAL", "final"));
});

test("final look gates: a biased target fails; integrity, reset and data findings decide before the metrics", () => {
  const biased = run({ ...synthetic({ inflate: { SHOTS_ON_GOAL: 1.08 } }), look: "final", replicates: FAST });
  assert.equal(biased.look.targets.SHOTS_ON_GOAL.status, "fail");
  assert.ok(biased.look.targets.SHOTS_ON_GOAL.failedGates.includes("abs_bias"));
  const statuses = report => Object.values(report.look.targets).map(t => t.status);
  const PER_SLATE = 72; // 2 games x 6 skaters x 6 targets
  // An integrity failure in slates 1-7 stops every target at look 1, and the final look carries the stop.
  const early = synthetic(); early.rso[0].value.unconditionalMean += 1;
  const stopped = run({ ...early, look: "final", replicates: FAST });
  assert.equal(stopped.look.lookOne.GOALS.status, "stop_integrity");
  assert.ok(statuses(stopped).every(status => status === "stopped_at_look1"));
  // One in slate 12 fails every target at the final look; one after the final slate (16) is outside the evaluated population.
  const late = synthetic(); late.rso[11 * PER_SLATE].value.unconditionalMean += 1;
  const failed = run({ ...late, look: "final", replicates: FAST });
  assert.equal(failed.look.lookOne.GOALS.status, "continue");
  assert.ok(statuses(failed).every(status => status === "fail_integrity"));
  const after = synthetic(); after.rso.at(-1).value.unconditionalMean += 1;
  assert.equal(run({ ...after, look: "final", replicates: FAST }).look.targets.GOALS.status, "pass");
  // A reset inside the looked-at slates ends the scope.
  const reset = synthetic(), surfacePin = reset.scope.identity.servedValueSurfaceSha256;
  reset.rso[9 * PER_SLATE].servedValueSurfaceSha256 = { ...surfacePin, [SURFACE_PATHS[2]]: OTHER64 };
  assert.ok(statuses(run({ ...reset, look: "final", replicates: FAST })).every(status => status === "scope_ended"));
  // Target-class findings and unsettled rows keep only that target from passing.
  const data = synthetic(); data.baseline.players = data.baseline.players.filter((p, i) => !(i === 5 && p.target === "BLOCKED_SHOTS"));
  const partial = run({ ...data, look: "final", replicates: FAST });
  assert.equal(partial.look.targets.BLOCKED_SHOTS.status, "inconclusive_data");
  assert.equal(partial.look.targets.GOALS.status, "pass");
  // A game in slate 4 with no settlement yet is pending, not a finding, but no target can pass over it.
  const pending = synthetic(); pending.settlement = pending.settlement.filter(row => row.gameId !== 2026130030);
  const unsettled = run({ ...pending, look: "final", replicates: FAST });
  assert.equal(unsettled.summary.pass, true);
  assert.equal(unsettled.look.targets.HITS.unsettled, 6);
  assert.ok(statuses(unsettled).every(status => status === "inconclusive_data"));
  assert.equal(unsettled.look.dryRun, false);
});

test("final look: a target short of its minimum at slate 28 ends inconclusive; fewer slates is not reached", () => {
  const input = synthetic({ slates: 28 });
  input.scope.protocol.targets.HITS.minSettledRows = 1000;
  const report = run({ ...input, look: "final", replicates: 200 });
  assert.deepEqual(report.look.slate, { slate: 28, date: "2026-12-28", reached: true, short: ["HITS"] });
  assert.equal(report.look.targets.HITS.status, "inconclusive_short");
  assert.equal(report.look.targets.GOALS.status, "pass");
  const early = run({ ...synthetic({ slates: 10 }), look: "final", replicates: 50 });
  assert.equal(early.look.slate.reached, false);
  assert.equal(early.look.targets, null);
});

test("a version-2 repair is scored in place of version 1 without overwriting it", () => {
  const repaired = synthetic(), replaced = synthetic();
  repaired.settlement.push({ ...repaired.settlement[0], actual: 9, settlementVersion: 2, recordedAt: "2026-12-03T17:00:00Z" });
  replaced.settlement[0].actual = 9;
  const a = run({ ...repaired, look: "1", replicates: 50 }), b = run({ ...replaced, look: "1", replicates: 50 });
  assert.equal(a.summary.pass, true);
  assert.deepEqual(a.look, b.look);
  assert.notDeepEqual(a.look, run({ ...synthetic(), look: "1", replicates: 50 }).look);
});

test("determinism: the same inputs give an identical report, and input order changes nothing", () => {
  const input = synthetic({ inflate: { HITS: 2.5 } });
  const once = JSON.stringify(run({ ...input, look: "final", replicates: FAST }));
  assert.equal(JSON.stringify(run({ ...synthetic({ inflate: { HITS: 2.5 } }), look: "final", replicates: FAST })), once);
  const shuffle = rows => rows.map((row, i) => [(i * 7919) % 104729, row]).sort(([a], [b]) => a - b).map(([, row]) => row);
  const shuffled = { ...input, issued: shuffle(input.issued), rso: shuffle(input.rso), settlement: shuffle(input.settlement),
    baseline: { players: shuffle(input.baseline.players), groups: shuffle(input.baseline.groups) } };
  const reordered = run({ ...shuffled, look: "final", replicates: FAST });
  assert.equal(JSON.stringify(reordered.look), JSON.stringify(JSON.parse(once).look));
  assert.equal(JSON.stringify(reordered.summary), JSON.stringify(JSON.parse(once).summary));
});

// ------------------------------------------------------------ CLI

const fixtureArgs = () => { const dir = join(here, "fixtures");
  return ["--issued", join(dir, "issued.json"), "--rso", join(dir, "rso.json"), "--settlement", join(dir, "settlement.json"),
    "--baseline", join(dir, "baseline.json"), "--scope", join(dir, "scope.json")]; };
const cli = (args, options = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", ...options });

test("the CLI exits 0 on the clean fixture, 1 with findings, and records the protocol and bootstrap", () => {
  const good = cli(fixtureArgs());
  assert.equal(good.status, 0, good.stderr);
  const report = JSON.parse(good.stdout);
  assert.equal(report.summary.protocolHash, "2acaff686c4953f60d17a17cfe0c59af76beb043e82a9a384b3a2824fb871469");
  assert.deepEqual(report.summary.bootstrap, { version: "forge-qual-bootstrap-v1", replicates: 10000, baseSeedHex: "7f8b18a3b1d413c5" });
  const dir = mkdtempSync(join(tmpdir(), "forge-qual-v2-"));
  try {
    const bad = join(dir, "rso.json");
    writeFileSync(bad, JSON.stringify(fixture("rso.json").slice(1)));
    const args = fixtureArgs(); args[3] = bad;
    assert.equal(cli(args).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the CLI refuses Start Chart, a draft scope without the flag, a narrowed seal or tolerance, and a look without its inputs", () => {
  assert.equal(cli([...fixtureArgs(), "--start-chart", "x.json"]).status, 2);
  const draft = fixtureArgs(); draft[draft.length - 1] = join(here, "..", "SCOPE-AMENDED.json");
  assert.equal(cli(draft).status, 2);
  // A dry run against the draft compares no prose or PENDING pin: the clean fixture passes, and the status is recorded.
  const allowed = cli([...draft, "--allow-draft-scope", "true"]);
  assert.equal(allowed.status, 0, allowed.stdout.slice(0, 400));
  const dry = JSON.parse(allowed.stdout);
  assert.equal(dry.summary.protocolHash, real().protocolHash);
  assert.equal(dry.summary.scopeStatus, "amended_awaiting_identity");
  assert.deepEqual(dry.summary.findingCodes, {});
  assert.equal(JSON.parse(cli([...draft, "--allow-draft-scope", "true", "--look", "1"]).stdout).look.dryRun, true);
  assert.equal(cli([...fixtureArgs(), "--tolerance", "0.01"]).status, 2);
  assert.equal(cli([...fixtureArgs(), "--tolerance", "0.0001"]).status, 0);
  assert.equal(cli([...fixtureArgs(), "--sealed", "2026-10-23..2026-10-24"]).status, 2);
  assert.equal(cli([...fixtureArgs().slice(0, 6), "--scope", join(here, "fixtures", "scope.json"), "--look", "1"]).status, 2);
  assert.equal(cli([...fixtureArgs(), "--look", "2"]).status, 2);
});

test("the CLI with the protocol's 10,000 replicates gives byte-identical reports, through a symlink too", () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-qual-v2-look-"));
  try {
    const input = synthetic({ slates: 8 }), paths = {};
    for (const name of ["issued", "rso", "settlement", "baseline"]) { paths[name] = join(dir, `${name}.json`); writeFileSync(paths[name], JSON.stringify(input[name])); }
    const args = ["--issued", paths.issued, "--rso", paths.rso, "--settlement", paths.settlement, "--baseline", paths.baseline,
      "--scope", join(here, "fixtures", "scope.json"), "--look", "1"];
    const first = cli(args), second = cli(args);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, second.stdout);
    const report = JSON.parse(first.stdout);
    assert.equal(report.look.targets.GOALS.bootstrap.replicates, 10000);
    assert.equal(report.look.targets.GOALS.status, "continue");
    const alias = join(dir, "checker alias.mjs");
    symlinkSync(CLI, alias);
    assert.equal(spawnSync(process.execPath, [alias, ...args], { encoding: "utf8" }).stdout, first.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------ coverage of every finding

test("every finding the checker can emit is exercised above", () => {
  assert.deepEqual([...Object.keys(FINDING_CLASS)].filter(code => !exercised.has(code)).sort(), []);
  assert.deepEqual([...exercised].filter(code => !(code in FINDING_CLASS)).sort(), []);
});
