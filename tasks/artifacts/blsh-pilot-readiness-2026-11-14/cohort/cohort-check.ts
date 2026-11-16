/* Bounded-cohort data-contract check. Read-only, offline, aggregate output only (no names, no player IDs).
 * Feeds a deterministic cohort (the 25 lowest player IDs whose retained production context lists five
 * source IDs) through the REAL qualifyCurrentInputs. Retained inputs are a stale Nov 1 capture: this
 * checks the contract's behavior, never current-use qualification.
 * Run from web/: node --require ./node_modules/ts-node/register/transpile-only <this> <CURRENT-REQUEST.json> <CONTEXTS.json>
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs") as typeof import("node:fs");
const { createHash } = require("node:crypto") as typeof import("node:crypto");
const { resolve } = require("node:path") as typeof import("node:path");
const ci = require(resolve(process.cwd(), "lib/buyLowSellHigh/currentInput.ts"));

const [requestPath, contextsPath] = process.argv.slice(2);
const COHORT = 25;
const sha = (p: string) => createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
const contexts = JSON.parse(fs.readFileSync(contextsPath, "utf8"));
const ALL = process.env.COHORT_POOL === "all"; // "all" = lowest IDs of every profile, not only five-ID ones
const five = contexts.profiles.filter((p: { sourceIds: number[] }) => p.sourceIds.length === 5)
  .map((p: { playerId: number }) => p.playerId).sort((a: number, b: number) => a - b);
const pool = ALL ? contexts.profiles.map((p: { playerId: number }) => p.playerId).sort((a: number, b: number) => a - b) : five;
const cohort = new Set<number>(pool.slice(0, COHORT));
const keep = <T extends { player_id: number }>(feed: { rows: T[] } | null) => feed && { ...feed, rows: feed.rows.filter(r => cohort.has(r.player_id)) };
const bounded = { ...request, wgo: keep(request.wgo), individual: keep(request.individual), onIce: keep(request.onIce) };
const out = ci.qualifyCurrentInputs(bounded);

const tally = (items: string[]) => items.reduce((m: Record<string, number>, k) => (m[k] = (m[k] ?? 0) + 1, m), {});
type Rec = { record: { id: number; player_id: number; date: string; games_played: number; counts: Record<string, number | null> };
  identityAndExposure: { qualified: boolean; reasons: string[] }; individual: { qualified: boolean; reasons: string[] };
  onIce: { qualified: boolean; reasons: string[] }; freshness: { state: string }; productionInputsComplete: boolean };
const records: Rec[] = out.records;

// Latest-five windows built only from identity-qualified records, compared with the retained context's selection.
const byPlayer = new Map<number, Rec[]>();
for (const r of records) if (r.identityAndExposure.qualified) byPlayer.set(r.record.player_id, [...(byPlayer.get(r.record.player_id) ?? []), r]);
let windowsComplete = 0, windowsShort = 0, contextAgrees = 0, contextDisagrees = 0;
for (const id of cohort) {
  const latest = (byPlayer.get(id) ?? []).sort((a, b) => a.record.date.localeCompare(b.record.date)).slice(-5);
  if (latest.length === 5 && latest.every(r => r.record.games_played === 1)) windowsComplete++; else windowsShort++;
  const ctx = contexts.profiles.find((p: { playerId: number }) => p.playerId === id).sourceIds.slice().sort((a: number, b: number) => a - b);
  const mine = latest.map(r => r.record.id).sort((a, b) => a - b);
  if (JSON.stringify(ctx) === JSON.stringify(mine)) contextAgrees++; else contextDisagrees++;
}
const incomplete = records.filter(r => !r.productionInputsComplete);
const inLatestFive = new Set<number>();
for (const id of cohort) for (const r of (byPlayer.get(id) ?? []).sort((a, b) => a.record.date.localeCompare(b.record.date)).slice(-5)) inLatestFive.add(r.record.id);
const productionIncomplete = { records: incomplete.length, insideLatestFive: incomplete.filter(r => inLatestFive.has(r.record.id)).length,
  reasons: tally(incomplete.flatMap(r => Object.values((r as unknown as { tracks: Record<string, { reasons: string[] }> }).tracks).flatMap(t => t.reasons))) };
const zeroShots = records.filter(r => r.record.counts.shots === 0).length;
const nullShots = records.filter(r => r.record.counts.shots == null).length;

const result = {
  inputs: { request: { sha256: sha(requestPath), eventThroughDate: request.eventThroughDate, asOfUTC: request.asOfUTC },
    contexts: { sha256: sha(contextsPath), profiles: contexts.profiles.length, withFiveSourceIds: five.length } },
  cohort: { rule: ALL ? `lowest ${COHORT} playerIds of all context profiles` : `lowest ${COHORT} playerIds with five context sourceIds (complete by construction)`, size: cohort.size,
    idListSHA256: createHash("sha256").update([...cohort].join(",")).digest("hex") },
  scope: { seasonId: out.seasonId, populationScope: out.populationScope, asOfKind: out.asOfKind,
    nativeStrengthScope: [request.individual?.strengthScope, request.onIce?.strengthScope] },
  records: out.records.length,
  identityQualified: records.filter(r => r.identityAndExposure.qualified).length,
  identityReasons: tally(records.flatMap(r => r.identityAndExposure.reasons)),
  productionComplete: records.filter(r => r.productionInputsComplete).length,
  nativeIndividualQualified: records.filter(r => r.individual.qualified).length,
  nativeIndividualReasons: tally(records.flatMap(r => r.individual.reasons)),
  nativeOnIceQualified: records.filter(r => r.onIce.qualified).length,
  nativeOnIceReasons: tally(records.flatMap(r => r.onIce.reasons)),
  freshnessAtFrozenAsOf: tally(records.map(r => r.freshness.state)),
  unmatchedNative: { individual: out.unmatched.individual.length, onIce: out.unmatched.onIce.length },
  windows: { completeFiveGP1: windowsComplete, short: windowsShort, contextSelectionAgrees: contextAgrees, contextSelectionDisagrees: contextDisagrees },
  productionIncomplete,
  zeroVsMissing: { measuredZeroShots: zeroShots, missingShots: nullShots },
  claims: { score: out.score, trusted: out.trusted, productionAdopted: out.productionAdopted, blockers: out.blockers },
};
process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
