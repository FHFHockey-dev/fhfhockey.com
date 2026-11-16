#!/usr/bin/env node
// FORGE qualification readback checker. Offline only: it reads local JSON files and writes a report, nothing else.
//
// Inputs (normalized evidence; see ../QUALIFICATION-PLAN.md §4 for how each is extracted):
//   --issued <file>        originally issued rows, one per player/game/target (the immutable record)
//   --rso <file>           RSO readback rows (current planning read response, normalized)
//   --start-chart <file>   Start Chart readback rows (API response, normalized)
//   --settlement <file>    optional settled outcomes
//   --scope <file>         the predeclared scope (../scope.json): pinned identity plus the hashed protocol
//   --allow-draft-scope    accept a scope whose identity is not pinned yet (fixtures and dry runs only)
//   --sealed <from>..<to>  dates whose outcomes must not be present or scored (default: the scope's, else Release C 2026-10-23..2026-10-30)
//   --tolerance <n>        absolute value tolerance (default 0.0001: RSO rounds to 4 decimals)
//   --out <file>           report path (default: stdout)
// Exit code: 0 pass, 1 findings, 2 bad input.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/** Identity fields a readback must carry unchanged from the issued row, when the consumer exposes them. */
export const IDENTITY_FIELDS = ["revisionId", "target", "method", "codeVersion", "configurationHash", "artifactHash", "cutoffAt",
  "participationRevisionId", "scheduleRevision", "horizon", "catalogHeadId", "sourcePayloadHash"];
/** Fields every issued row needs before it can be qualified at all. */
export const REQUIRED_ISSUED = ["revisionId", "playerId", "gameId", "target", "method", "codeVersion", "configurationHash", "artifactHash",
  "cutoffAt", "issuedAt", "scheduledAt", "gameDate", "horizon", "participationRevisionId", "value"];
export const DEFAULT_SEALED = { from: "2026-10-23", to: "2026-10-30" };

const key = row => `${row.playerId}|${row.gameId}|${row.target}`;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
/** sha256 of key-sorted JSON: the same canonical form as the repo's projectionInputHash / playerForecastSourcePayloadHash. */
export const canonicalHash = value => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const SCOPE_IDENTITY_FIELDS = ["target", "method", "codeVersion", "configurationHash", "artifactHash", "horizon"];

/** Validates a predeclared scope. Returns { scope, problems }: the protocol must hash to `protocolHash`, and a pinned
 * scope must name every identity field. Its unpinned draft is accepted only when `allowDraft` is set. */
export function readScope(scope, { allowDraft = false } = {}) {
  const problems = [];
  if (scope?.version !== "forge-qual-scope-v1") problems.push("scope_version");
  if (!scope?.protocol || canonicalHash(scope.protocol) !== scope.protocolHash) problems.push("protocol_hash_mismatch");
  const unpinned = SCOPE_IDENTITY_FIELDS.filter(field => scope?.identity?.[field] === null || scope?.identity?.[field] === undefined);
  if (scope?.status !== "pinned" || unpinned.length) {
    if (!allowDraft) problems.push(`identity_unpinned:${unpinned.join(",") || scope?.status}`);
  }
  return { scope, problems };
}
const time = value => (typeof value === "string" ? Date.parse(value) : NaN);
const finite = value => typeof value === "number" && Number.isFinite(value);

/** Pure: returns { findings, summary }. Never throws on bad rows; each problem is a finding. */
export function checkReadbacks({ issued, consumers, settlement = null, scope = null, sealed = scope?.protocol?.sealed ?? DEFAULT_SEALED, tolerance = 0.0001 }) {
  const identity = scope?.identity ?? null, allowedRsoUses = scope?.protocol?.claim?.rsoUses ?? null;
  const findings = [];
  const add = (code, detail) => findings.push({ code, ...detail });
  const inSealed = date => typeof date === "string" && date >= sealed.from && date <= sealed.to;
  const issuedByKey = new Map();

  for (const row of issued) {
    const missing = REQUIRED_ISSUED.filter(field => row[field] === undefined || row[field] === null || row[field] === "");
    if (missing.length) { add("issued_incomplete", { key: key(row), missing }); continue; }
    if (issuedByKey.has(key(row))) { add("issued_duplicate", { key: key(row) }); continue; }
    // A field the scope leaves unpinned (null) is not compared; readScope refuses such a scope outside dry runs.
    if (identity) for (const field of SCOPE_IDENTITY_FIELDS)
      if (identity[field] !== undefined && identity[field] !== null && row[field] !== identity[field])
        add("issued_out_of_scope", { key: key(row), field, issued: row[field], scope: identity[field] });
    // Chronology of issuance: inputs cut off no later than issue, issue strictly before puck drop.
    if (!(time(row.cutoffAt) <= time(row.issuedAt))) add("cutoff_after_issue", { key: key(row), cutoffAt: row.cutoffAt, issuedAt: row.issuedAt });
    if (!(time(row.issuedAt) < time(row.scheduledAt))) add("issued_after_puck_drop", { key: key(row), issuedAt: row.issuedAt, scheduledAt: row.scheduledAt });
    issuedByKey.set(key(row), row);
  }

  const coverage = {};
  for (const [consumer, rows] of Object.entries(consumers)) {
    const seen = new Map();
    for (const row of rows) {
      const k = key(row);
      if (seen.has(k)) { add("readback_duplicate", { consumer, key: k }); continue; }
      seen.set(k, row);
      const source = issuedByKey.get(k);
      // A consumer value that was never issued is invented, whatever it says about itself.
      if (!source) { add("readback_unissued", { consumer, key: k, revisionId: row.revisionId ?? null }); continue; }
      for (const field of IDENTITY_FIELDS) if (row[field] !== undefined && row[field] !== source[field])
        add("identity_mismatch", { consumer, key: k, field, issued: source[field], readback: row[field] });
      if (row.revisionId === undefined) add("readback_unbound", { consumer, key: k, reason: "no revisionId" });
      for (const [part, value] of Object.entries(source.value)) {
        if (!(part in (row.value ?? {}))) continue;
        const got = row.value[part];
        if (value === null || got === null ? value !== got : !(finite(got) && Math.abs(got - value) <= tolerance))
          add("value_mismatch", { consumer, key: k, part, issued: value, readback: got });
      }
      if (!Object.keys(row.value ?? {}).some(part => part in source.value)) add("readback_no_value", { consumer, key: k });
      // A consumer may never allow a use the claim does not cover (before any review, RSO allows none).
      if (allowedRsoUses && consumer === "rso" && row.allowedUses) for (const [use, allowed] of Object.entries(row.allowedUses))
        if (allowed === true && !allowedRsoUses.includes(use)) add("use_beyond_scope", { consumer, key: k, use });
      if (row.observedAt !== undefined && !(time(row.observedAt) >= time(source.issuedAt)))
        add("readback_before_issue", { consumer, key: k, observedAt: row.observedAt, issuedAt: source.issuedAt });
    }
    let matched = 0;
    for (const k of issuedByKey.keys()) if (seen.has(k)) matched++; else add("readback_missing", { consumer, key: k });
    coverage[consumer] = { issued: issuedByKey.size, matched, readbacks: rows.length };
  }

  let settled = 0, sealedRows = 0;
  if (settlement) {
    const outcomes = new Map();
    for (const row of settlement) {
      if (inSealed(row.gameDate)) { add("sealed_outcome_present", { key: key(row), gameDate: row.gameDate }); continue; }
      outcomes.set(key(row), row);
    }
    for (const [k, row] of issuedByKey) {
      if (inSealed(row.gameDate)) { sealedRows++; continue; }
      const outcome = outcomes.get(k);
      if (!outcome) continue;
      // An outcome counts only when recorded after the game started and after the forecast was issued.
      if (!(time(outcome.recordedAt) > time(row.scheduledAt))) { add("settlement_before_game", { key: k, recordedAt: outcome.recordedAt }); continue; }
      if (!finite(outcome.actual)) { add("settlement_not_numeric", { key: k }); continue; }
      settled++;
    }
  } else for (const row of issuedByKey.values()) if (inSealed(row.gameDate)) sealedRows++;

  const codes = {};
  for (const finding of findings) codes[finding.code] = (codes[finding.code] ?? 0) + 1;
  return { findings, summary: { pass: findings.length === 0, issued: issuedByKey.size, coverage, settled, sealedRows,
    sealed, tolerance, findingCodes: codes } };
}

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
  const read = path => JSON.parse(readFileSync(path, "utf8"));
  if (!args.issued || (!args.rso && !args["start-chart"])) { console.error("need --issued and at least one of --rso / --start-chart"); process.exit(2); }
  let scope = null;
  if (args.scope) {
    const { scope: parsed, problems } = readScope(read(args.scope), { allowDraft: args["allow-draft-scope"] === "true" });
    if (problems.length) { console.error(`scope refused: ${problems.join("; ")}`); process.exit(2); }
    scope = parsed;
  }
  let sealed = scope?.protocol?.sealed ?? DEFAULT_SEALED;
  if (args.sealed) {
    const [from, to] = args.sealed.split("..");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? "")) { console.error("--sealed is YYYY-MM-DD..YYYY-MM-DD"); process.exit(2); }
    sealed = { from, to };
  }
  const consumers = {};
  if (args.rso) consumers.rso = read(args.rso);
  if (args["start-chart"]) consumers.start_chart = read(args["start-chart"]);
  const report = checkReadbacks({ issued: read(args.issued), consumers, settlement: args.settlement ? read(args.settlement) : null,
    scope, sealed, tolerance: args.tolerance ? Number(args.tolerance) : 0.0001 });
  report.summary.scopeHash = scope ? canonicalHash(scope) : null;
  report.summary.protocolHash = scope?.protocolHash ?? null;
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) writeFileSync(args.out, text); else process.stdout.write(text);
  process.exit(report.summary.pass ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
