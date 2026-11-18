/** October 28 single-target replay of the paired November 4 no-overlay research smoke.
 * From web/: NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options
 * '{"module":"commonjs","moduleResolution":"node"}' scripts/blsh/retainedArmCReplay.ts [--private | --private-reference]
 * --private-reference also emits the unaccepted raw arm-C reference packet and compares its exact single-player replay.
 * --private saves ordered source membership in a new owner-only directory outside the repository.
 */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { qualifyCurrentResearchInputs, type CurrentInputRequest } from "../../lib/buyLowSellHigh/currentInput";
import { createCurrentProcessEvidenceGate } from "../../lib/buyLowSellHigh/currentProcessEvidence.server";
import { assembleProfiles, devSlot, type Arm, type DevRow } from "../../lib/buyLowSellHigh/currentWindows";
import { toDisplayProfile } from "../../lib/buyLowSellHigh/displayProfile";
import { summarizeHistory } from "../../lib/buyLowSellHigh/productionReference";
import type { TrainingBlock } from "../../lib/buyLowSellHigh/supportGap";

import { ARM_C_REFERENCE_VERSION, assembleArmCReferenceInputs, selectArmCCurrentPrefix, type ArmCReferencePacket } from "../../lib/buyLowSellHigh/armCCandidate.server";

const documents = join(homedir(), "Documents");
const current = "Codex/2026-10-27/task-3/current-refresh-20261029-01";
const baseline = "Claude/2026-11-04/blsh-baseline";
const sources = {
  request: [current + "/CURRENT-REQUEST.json", "dcba14c2253d82bc70690d3c21112d926c1cdfc4f361024aa8a02f117e262465"],
  development: [current + "/dev-history-cache/dev-history.jsonl", "da32a473923e7b9940032c7ee22c1292e73798c7dc242a956a0244233d020106"],
  history2024: [baseline + "/history-20242025/db-history.jsonl", "3b4e6429d04caa97e63bc37e3ff570b84cd0cd19a00b6248e28d5440b5f5fb3a"],
  training: ["Codex/2026-10-25/task-2/support-conditioned-ranking-v1/run-guarded-v1/ORIGINAL-BLOCK-CATALOG.jsonl", "f60056cd5ab6b80688d130661d2efbaacfe31c001de7b690a634514900ded529"],
  smoke: [baseline + "/arm-c-smoke.json", "066833aba6fdbaac1c53eca1b66dba6279efea7400c459eef7cc196aef5e0a91"],
} as const;
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function read(source: keyof typeof sources) {
  const [path, pin] = sources[source], bytes = readFileSync(join(documents, path));
  assert.equal(digest(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)), pin, source + " SHA256 mismatch");
  return bytes.toString("utf8");
}

// Preserve source insertion order for floating-point prior fitting. Select each donor's
// true final 50 before checking position and measurements, just as the assembler does.
function historyForTarget(target: number, cutoff: string, trainingIds: Set<number>) {
  const groups = new Map<number, DevRow[]>();
  const covered = new Set<number>();
  for (const source of ["development", "history2024"] as const) {
    for (const line of read(source).split("\n")) {
      if (!line) continue;
      const row: DevRow = JSON.parse(line);
      covered.add(row.season_id);
      if (!groups.has(row.player_id)) groups.set(row.player_id, []);
      groups.get(row.player_id)!.push(row);
    }
  }
  assert.deepEqual([...covered].sort(), [20222023, 20232024, 20242025]);
  const trainingRows: DevRow[] = [];
  const history: DevRow[] = [], donors: { playerId: number; sourceIds: number[] }[] = [];
  for (const [id, rows] of groups) {
    if (trainingIds.size) trainingRows.push(...rows.filter(r => trainingIds.has(r.id)));
    if (id === target) {
      history.push(...rows.filter(r => r.date < cutoff && r.season_id >= 20232024));
      continue;
    }
    const last = rows.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).slice(-50);
    if (last.length !== 50 || !last.every(r => r.position_code === "D" && r.games_played === 1)) continue;
    const slots = last.map(devSlot);
    const [qualified] = summarizeHistory(id, "D", slots.map(s => s.tracks.map(v => v ?? NaN)),
      slots.map(s => s.seconds ?? NaN), slots.map(s => s.id), slots.map(s => s.date), "2026-07-01", true);
    if (!qualified) continue;
    history.push(...last);
    donors.push({ playerId: id, sourceIds: qualified.source_ids });
  }
  return { history, trainingRows, donors, covered: [...covered].sort() };
}

async function replay(privateDetail: boolean, emitReference: boolean) {
  const example = JSON.parse(read("smoke")).C_weighted_personal_baseline.example;
  const target: number = example.playerId, cutoff: string = example.reference.baseline.before;
  const originalRequest = read("request");
  const request: CurrentInputRequest = JSON.parse(originalRequest);
  assert(request.wgo && request.individual && request.onIce && request.calendar);
  request.wgo.rows = request.wgo.rows.filter(r => r.player_id === target);
  assert(request.wgo.rows.length > 0 && request.wgo.rows.every(r => r.player_name === "Brent Burns" && r.position_code === "D"));
  const games = new Set(request.wgo.rows.map(r => r.game_id));
  request.calendar.rows = request.calendar.rows.filter(r => games.has(r.id));
  request.individual.rows = request.individual.rows.filter(r => r.player_id === target);
  request.onIce.rows = request.onIce.rows.filter(r => r.player_id === target);
  const projected = JSON.stringify(request), currentInput = qualifyCurrentResearchInputs(request, null);
  const gated = createCurrentProcessEvidenceGate()(new TextEncoder().encode(projected), "2026-11-18T00:00:00Z");
  assert.equal(gated.capturedWindows.length, 1);
  assert.equal(gated.capturedWindows[0].currentUseQualified, false);
  assert.equal(gated.score, null);
  const blocks: TrainingBlock[] = read("training").split("\n").filter(Boolean).map(line => JSON.parse(line) as TrainingBlock)
    .filter(b => b.player_id !== target && b.position === "D" && b.qualified_process_exposure && b.dates.at(-1)! < cutoff);

  const trainingIds = new Set<number>(emitReference ? blocks.flatMap(b => b.source_ids) : []);
  const { history, trainingRows, donors, covered } = historyForTarget(target, cutoff, trainingIds);

  const run = async (arm: Arm) => {
    const profiles = await assembleProfiles({ arm, current: currentInput.records, history, blocks, coveredSeasons: covered,
      eventThroughDate: request.eventThroughDate, names: new Map([[target, "Brent Burns"]]) });
    assert.equal(profiles.length, 1);
    const profile = profiles[0];
    assert.equal(profile.playerId, target);
    assert.equal(profile.window.dates[0], cutoff);
    const mapped = toDisplayProfile(profile, null, request.eventThroughDate, "single_player");
    assert.equal(mapped.score.value, profile.result.value);
    return { profile, mapped };
  };
  const a = await run("A_development_reference"), c = await run("C_weighted_personal_baseline");
  assert.equal(a.profile.result.value, example.aValue, "paired historic A index");
  assert.equal(c.profile.result.value, example.value, "historic C index");
  assert.deepEqual(c.profile.comparisons, example.comparisons);
  const reference = c.profile.reference;
  assert.equal(reference.personalN, example.reference.personalN);
  assert.equal(reference.sourceIds.length, example.reference.sourceIds);
  assert.equal(new Set(reference.sourceIds).size, reference.sourceIds.length);
  assert.deepEqual([reference.dates[0], reference.dates.at(-1)], example.reference.dates);
  assert.deepEqual(reference.missingSeasons, example.reference.missingSeasons);
  assert.deepEqual(c.profile.window.sourceIds, a.profile.window.sourceIds);
  const pairs = (ids: number[], dates: string[]) => {
    assert.equal(ids.length, dates.length);
    return ids.map((sourceId, i) => ({ sourceId, date: dates[i] }));
  };
  const membership = { current: pairs(c.profile.window.sourceIds, c.profile.window.dates),
    armC: pairs(reference.sourceIds, reference.dates), armA: pairs(a.profile.reference.sourceIds, a.profile.reference.dates) };
  const membershipSHA256 = digest(JSON.stringify(membership.armC));
  // Cross-checked independently against the three input files in date/source-ID order.
  assert.equal(membershipSHA256, "a03d465844416530e9c40835904a99489f81798e1a777476a12856acd771c460", "dated reference membership changed");
  let privatePath: string | null = null;
  let referenceReceipt = null;
  if (privateDetail || emitReference) {
    const parent = join(documents, "Codex/2026-11-18/blsh-retained-window-replays");
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const directory = mkdtempSync(join(parent, "arm-c-"));
    privatePath = join(directory, "membership.json");
    writeFileSync(privatePath, JSON.stringify({ playerId: target, sources, membershipSHA256, membership, donors,
      trainingBlockSourceIds: blocks.map(b => b.source_ids) }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    if (emitReference) {
      const originalRows = new Map([...history, ...trainingRows].map(r => [r.id, r]));
      const packet: ArmCReferencePacket = { version: ARM_C_REFERENCE_VERSION, arm: "C_weighted_personal_baseline",
        policyId: "fhfh.blsh.arm-c.local-reference-proposal.v1", playerId: target, seasonId: request.seasonId, before: cutoff,
        coveredSeasons: covered, history: [...originalRows.values()], personalSourceIds: history.filter(r => r.player_id === target).map(r => r.id),
        productionDonors: donors, trainingBlocks: blocks, preWindowCurrentRequestSHA256: sources.request[1] };
      const bytes = new TextEncoder().encode(JSON.stringify(packet));
      assert(bytes.length <= 64 * 1024 * 1024);
      const saved = JSON.parse(new TextDecoder().decode(bytes)) as ArmCReferencePacket;
      const lastFive = currentInput.records.slice(-5);
      const prefix = selectArmCCurrentPrefix(saved.preWindowCurrentRequestSHA256, new Map([[sources.request[1], new TextEncoder().encode(originalRequest)]]),
        { playerId: target, seasonId: request.seasonId, before: cutoff, eventThroughDate: request.eventThroughDate, asOfUTC: request.asOfUTC });
      assert.deepEqual(prefix.records.map(r => r.raw.record.id), currentInput.records.slice(0, -5).map(r => r.raw.record.id));
      const roles = assembleArmCReferenceInputs(saved, new Set(currentInput.records.map(r => r.raw.record.id)), "D");
      const [rebuilt] = await assembleProfiles({ ...roles, arm: saved.arm, current: [...prefix.records, ...lastFive], coveredSeasons: saved.coveredSeasons,
        eventThroughDate: request.eventThroughDate, names: new Map([[target, "Brent Burns"]]) });
      assert.deepEqual(rebuilt, c.profile);
      const path = join(directory, "unaccepted-reference.json");
      writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
      referenceReceipt = { path, bytes: bytes.length, sha256: digest(bytes), rawRows: saved.history.length, historicalPersonalRows: saved.personalSourceIds.length,
        prefixRows: prefix.records.length, originalCurrentRequestRows: prefix.capture!.capturedWgoRows, originalCurrentRequestSHA256: sources.request[1],
        sameHistoricalProfile: true, accepted: false };
    }
  }
  return { inputs: Object.fromEntries(Object.entries(sources).map(([key, [, pin]]) => [key, pin])),
    projectionSHA256: digest(projected), sourceAsOfUTC: request.asOfUTC, recordedThrough: request.eventThroughDate,
    targetCount: 1, currentAppearances: currentInput.records.length, windowDates: c.profile.window.dates,
    cohort: { position: "D", productionDonors: donors.length, productionDonorGames: donors.length * 50,
      trainingBlocksPresented: blocks.length, fittedSupportDonors: c.profile.result.donorPlayers },
    armA: { noOverlayIndex: a.mapped.score.value, referenceCount: a.profile.reference.sourceIds.length },
    armC: { noOverlayIndex: c.mapped.score.value, referenceCount: reference.sourceIds.length, firstReference: reference.dates[0],
      lastReference: reference.dates.at(-1), membershipSHA256, missingSeasons: reference.missingSeasons,
      comparisons: c.profile.comparisons, historicalResearchList: c.profile.result.researchList, mappedList: c.mapped.score.list, mappedHeadline: c.mapped.score.headline },
    closedPolicy: { evaluatedAtUTC: gated.asOfUTC, currentUseQualified: gated.capturedWindows[0].currentUseQualified, score: gated.score },
    leagueRank: null, privatePath, referenceReceipt };
}

if (require.main === module) {
  assert(process.argv.length === 2 || process.argv.length === 3 && ["--private", "--private-reference"].includes(process.argv[2]), "usage: retainedArmCReplay.ts [--private | --private-reference]");
  void replay(process.argv[2] === "--private", process.argv[2] === "--private-reference").then(result => process.stdout.write(JSON.stringify(result, null, 2) + "\n"))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
