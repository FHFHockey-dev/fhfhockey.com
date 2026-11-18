/** Offline replay. From web/: NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only
 * --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/blsh/retainedWindowReplay.ts
 * --private writes six identified player-game observations to a new private directory outside the checkout.
 * Reads the November 1 capture/contexts, its later field comparisons, the October displays and the saved arm-C smoke.
 */
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { retrospectivePlayer } from "../../components/blshTrade/retrospective";
import { createCurrentProcessEvidenceGate } from "../../lib/buyLowSellHigh/currentProcessEvidence.server";
import type { CurrentInputRequest } from "../../lib/buyLowSellHigh/currentInput";
import { FHFH_WEIGHTS, outcomes, PRODUCTION_TRACKS } from "../../lib/buyLowSellHigh/productionReference";
import { parseCurrentResearchSnapshot } from "../../lib/buyLowSellHigh/researchSnapshot";
import { CURRENT_SNAPSHOT_SHA256, readCurrentBlshSnapshot } from "../../lib/buyLowSellHigh/researchSnapshot.server";
import { retainedBlshEvidence } from "../../lib/player-cards/retainedBlsh";

const pins = {
  request: "c6d1d13dc7327baa54742c3eb7efe0a1e5d96c6ef6ffefc66de23f4092c12ba2",
  contexts: "7336bfc30cc56ce18c28af5527e4072baaeaeb99f63f3f32321185e194b29325",
  officialComparisons: "1552e2a043f549a34b178131f9ecc8ab50b01f7b481473dee37e98b15469a262",
  mapperV3: "daf447b70fd8e08dc88a2e17162e0c1dd04863275cd7e23dbd923acca34e4485",
  armCSmoke: "066833aba6fdbaac1c53eca1b66dba6279efea7400c459eef7cc196aef5e0a91",
};
const sum = (values: (number | null | undefined)[]) => values.every((v): v is number => typeof v === "number" && Number.isFinite(v))
  ? values.reduce((s, n) => s + n, 0) : null;
function pinned(path: string, pin: string) {
  const bytes = readFileSync(path);
  assert.equal(createHash("sha256").update(Uint8Array.from(bytes)).digest("hex"), pin, "retained bytes changed");
  return bytes;
}
type Context = { playerId: number; sourceIds: number[]; dates: string[]; seconds: number;
  metrics: { key: string; total: number | null; perAppearance: number | null; per60: number | null }[]; supportScore: null; buySellLabel: null };
type Official = { playerId: number; gameId: number; sourceId: number; date: string; exposureState: string;
  fields: Record<string, { state: string; official: number | null }>; tracks: Record<"fantasyPoints" | "rawPoints", { corroboratedForThisRow: boolean }> };
type SmokeExample = { playerId: number; value: number; aValue: number;
  comparisons: { unit: string; window: number[]; reference: number[] }[];
  reference: { dates: string[]; sourceIds: number; missingSeasons: number[]; baseline: { before: string; games: number } } };

function replay(privateDetail: boolean) {
  const local = join(homedir(), "Documents/Codex");
  const base = join(local, "2026-10-27/task-3/current-refresh-reader-20261101-01");
  const request = pinned(join(base, "live-read-01/capture/CURRENT-REQUEST.json"), pins.request);
  const contexts = JSON.parse(pinned(join(base, "production-context-02/CONTEXTS.json"), pins.contexts).toString()) as {
    captureSHA256: string; profiles: Context[];
  };
  assert.equal(contexts.captureSHA256, pins.request);
  const sidecar = JSON.parse(pinned(join(process.cwd(), "../tasks/artifacts/blsh-ppp-later-composition-2026-11-07/candidate-01/ROWS.json"), pins.officialComparisons).toString()) as Official[];
  const official = new Map(sidecar.map(r => [r.sourceId, r]));
  const sorted = [...contexts.profiles].sort((a, b) => a.playerId - b.playerId);
  const selected = [5, 1].map(length => sorted.find(p => p.sourceIds.length === length)!);
  const playerIds = new Set(selected.map(p => p.playerId));
  // Keep every captured appearance of each selected player. The original file is
  // hash-verified above. This two-player projection is exclusively a closed-policy replay.
  const projected: CurrentInputRequest = JSON.parse(request.toString());
  const inSample = (row: { player_id: number }) => playerIds.has(row.player_id);
  assert(projected.wgo && projected.individual && projected.onIce && projected.calendar);
  projected.wgo.rows = projected.wgo.rows.filter(inSample);
  projected.individual.rows = projected.individual.rows.filter(inSample);
  projected.onIce.rows = projected.onIce.rows.filter(inSample);
  const gameIds = new Set(projected.wgo.rows.map(row => row.game_id));
  projected.calendar.rows = projected.calendar.rows.filter(row => gameIds.has(row.id));
  const projection = new TextEncoder().encode(JSON.stringify(projected));
  const projectionSHA256 = createHash("sha256").update(projection).digest("hex");
  const gate = createCurrentProcessEvidenceGate()(projection, "2026-11-18T00:00:00Z");
  const records = new Map(gate.records.map(r => [r.record.id, r]));
  const snapshots = [readCurrentBlshSnapshot(), parseCurrentResearchSnapshot(JSON.parse(pinned(
    join(local, "2026-11-07/blsh-v3-integration/2026-10-28.arm-a.mapper-v3.candidate.json"), pins.mapperV3).toString()))];
  const smoke: SmokeExample = JSON.parse(pinned(join(homedir(), "Documents/Claude/2026-11-04/blsh-baseline/arm-c-smoke.json"),
    pins.armCSmoke).toString()).C_weighted_personal_baseline.example;
  const example = selected[0];
  assert.equal(smoke.playerId, example.playerId);
  const old = snapshots[0].profiles.find(p => p.playerId === example.playerId)!;
  const priorFP = old.tracks.find(t => t.track === "fantasy_points")!;
  const perAppearance = smoke.comparisons.find(c => c.unit === "per_game")!;
  assert.equal(smoke.reference.baseline.before, old.evidence.window.dates[0]);
  assert.equal(smoke.reference.dates.at(-1), "2026-10-16");
  assert.equal(perAppearance.window[0], priorFP.observed / old.evidence.window.games);
  const datedArmComparison = { eventThrough: snapshots[0].eventThroughDate, firstEvent: smoke.reference.baseline.before,
    lastReferenceEvent: smoke.reference.dates.at(-1), referenceGames: smoke.reference.baseline.games,
    missingSeasons: smoke.reference.missingSeasons, recordedFPPerAppearance: perAppearance.window[0],
    weightedPersonalFPPerAppearance: perAppearance.reference[0], armCNoOverlayIndex: smoke.value, pairedArmANoOverlayIndex: smoke.aValue,
    repairedArmARuntimeIndex: old.score.value, custody: "saved exploratory smoke; individual reference IDs summarized as a count" };
  const details = [];
  const summaries = [];
  for (const ctx of selected) {
    const length = ctx.sourceIds.length;
    const window = gate.capturedWindows.find(w => w.playerId === ctx.playerId)!;
    assert.deepEqual(window.sourceIds, ctx.sourceIds);
    assert.deepEqual(window.dates, ctx.dates);
    const rows = window.sourceIds.map(id => records.get(id)!);
    const seconds = sum(rows.map(r => r.record.toi_per_game));
    assert.equal(seconds, ctx.seconds);
    assert(seconds !== null && seconds > 0);
    const games = rows.map(({ record, tracks, identityAndExposure, individual, onIce }) => {
      const box = official.get(record.id)!;
      assert(box.playerId === record.player_id && box.gameId === record.game_id && box.date === record.date, "official row identity mismatch");
      assert(identityAndExposure.qualified);
      return { playerId: record.player_id, sourceId: record.id, gameId: record.game_id, date: record.date,
        wgoSeconds: record.toi_per_game, wgoCounts: Object.fromEntries(Object.keys(FHFH_WEIGHTS).map(k => [k, record.counts[k as keyof typeof FHFH_WEIGHTS]])),
        official: { fields: box.fields, exposure: box.exposureState, tracks: box.tracks },
        outcomes: outcomes(record.counts).map((m, i) => [tracks.fantasyPoints, tracks.rawPoints, tracks.wigoGameScore][i].qualified ? m.value : null),
        nativeStoredIndividual: individual.observed.map(r => ({ sourceId: r.id, storedTOI: r.toi, ixG: r.ixg })),
        nativeStoredOnIce: onIce.observed.map(r => ({ sourceId: r.id, storedTOI: r.toi, xGF: r.xgf, xGA: r.xga })),
        nativeReasons: { individual: individual.reasons, onIce: onIce.reasons } };
    });
    const totals = PRODUCTION_TRACKS.map((track, i) => {
      const total = sum(games.map(g => g.outcomes[i]));
      const metric = ctx.metrics.find(m => m.key === ["fantasyPoints", "rawPoints", "wigoGameScore"][i])!;
      assert(total !== null && metric.total !== null && Math.abs(total - metric.total) < 1e-9);
      const perAppearance = total / length, per60 = total * 3600 / seconds;
      assert(metric.perAppearance !== null && Math.abs(perAppearance - metric.perAppearance) < 1e-9);
      assert(metric.per60 !== null && Math.abs(per60 - metric.per60) < 1e-9);
      return { track, total, perAppearance, per60 };
    });
    const historical = snapshots.map((s, i) => {
      const p = s.profiles.find(p => p.playerId === ctx.playerId);
      if (!p) return { mapper: s.mapperVersion, state: "absent" };
      const adapted = retrospectivePlayer(String(p.playerId), p);
      const card = i === 0 && p.team ? retainedBlshEvidence({ id: p.playerId, team: p.team }, s.seasonId, {
        profile: p, metadata: s, snapshotSHA256: CURRENT_SNAPSHOT_SHA256, reviewReference: "Immutable October 28 retained research snapshot",
      }) : null;
      return { mapper: s.mapperVersion, arm: s.referencePolicy.arm, runtime: i === 0, through: s.eventThroughDate,
        windowDates: p.evidence.window.dates, windowSeconds: p.evidence.window.seconds, list: p.score.list, savedIndex: p.score.value,
        savedFHFH: p.tracks.find(t => t.track === "fantasy_points")?.observed ?? null,
        recordedPerGame: adapted.recordedPerGame, referencePerGame: adapted.referencePerGame, retainedCardStatus: card?.status ?? null };
    });
    details.push({ selected: length, games });
    summaries.push({ selected: length, dates: window.dates, seconds, totals,
      FHFHOperands: Object.fromEntries(Object.keys(FHFH_WEIGHTS).map(k => [k, sum(games.map(g => g.wgoCounts[k]))])),
      countAndExposureMatched: games.filter(g => g.official.tracks.fantasyPoints.corroboratedForThisRow).length,
      storedIndividual: games.reduce((n, g) => n + g.nativeStoredIndividual.length, 0),
      storedOnIce: games.reduce((n, g) => n + g.nativeStoredOnIce.length, 0),
      processQualified: window.sourceObservations, processReasons: [...new Set(games.flatMap(g => [...g.nativeReasons.individual, ...g.nativeReasons.onIce]))],
      currentUseQualified: window.currentUseQualified, latestEventAgeDays: window.recency.latestEventAgeDays, windowReasons: window.reasons,
      currentScore: gate.score, retainedScore: ctx.supportScore, retainedLabel: ctx.buySellLabel, historical });
  }
  let privatePath: string | null = null;
  if (privateDetail) {
    const parent = join(local, "2026-11-18/blsh-retained-window-replays");
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    privatePath = join(mkdtempSync(join(parent, "trace-")), "observations.json");
    writeFileSync(privatePath, JSON.stringify({ pins, closedPolicyProjectionSHA256: projectionSHA256, asOfUTC: gate.sourceRequestAsOfUTC,
      evaluatedAtUTC: gate.asOfUTC, gamesByWindow: details,
      october: { playerId: smoke.playerId, runtimeWgoSourceIds: old.evidence.window.sourceIds, savedArmCReferenceIdCount: smoke.reference.sourceIds, datedArmComparison } }, null, 2),
      { flag: "wx", mode: 0o600 });
  }
  return { pins: { ...pins, runtime: CURRENT_SNAPSHOT_SHA256 }, asOfUTC: gate.sourceRequestAsOfUTC, evaluatedAtUTC: gate.asOfUTC,
    rule: "Two-player closed-policy projection: lowest retained player ID with five source IDs and lowest with one",
    projectionSHA256, summaries, datedArmComparison, privatePath };
}

if (require.main === module) {
  assert(process.argv.slice(2).every(arg => arg === "--private"), "unknown option");
  process.stdout.write(JSON.stringify(replay(process.argv.includes("--private")), null, 2) + "\n");
}
