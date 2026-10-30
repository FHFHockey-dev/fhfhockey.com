// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { NextApiRequest, NextApiResponse } from "next";
import { issuedLifecycleFixture } from "./fixtureHarness.server";
import { createForgeReadHandler, PreparedForgeReadRepository } from "./api.server";
import { DEFAULT_SCORING, targetKey } from "./identity";
import { FIXTURE_TARGET } from "./fixtures";
import { EvaluationRevision, SelectionRevision } from "./evaluation";
import { preparePlayerReadContext } from "./preparation.server";
import { CalibrationPayload, JointDistribution, evaluatePinnedIntervals } from "./uncertainty";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

it("issues H10 to H1 through queue, prepares immutable corrections and serves the API without fabricated publications", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-integrated-")); roots.push(root);
  const env = await issuedLifecycleFixture(root);
  expect(env.store.issued.size).toBeGreaterThan(10);
  expect(env.context.games[0].finalVintageId).toBe(env.last.vintage.id);
  expect(env.gapContext.games[0].events.some(row => row.kind === "missing_refresh")).toBe(true);
  expect(env.gapContext.games[0].freshness.state).toBe("stale");
  const records = [...env.store.ledger.values()].filter(row => row.kind === "evaluation");
  const selections = records.flatMap(row => { const item = row.payload as { type: string; value: SelectionRevision }; return item.type === "selection" ? [item.value] : []; });
  const h8 = selections.filter(row => row.selection.series === "primary_horizon" && row.selection.horizon === 8).at(-1)!;
  expect(h8.selection).toMatchObject({ state: "missing", reason: "no_publication_in_first_episode", vintageId: null });
  const grades = records.flatMap(row => { const item = row.payload as { type: string; value: EvaluationRevision }; return item.type === "grade" ? [item.value] : []; });
  const finalGrades = grades.filter(row => row.selection.series === "locked_final" && row.profile.id === DEFAULT_SCORING.id && row.valueKind === "PIM" && row.outcomeId !== null);
  expect(finalGrades.map(row => row.actual)).toEqual([{ state: "available", value: 2 }, { state: "available", value: 4 }]);
  expect(finalGrades[1].predecessorId).toBe(finalGrades[0].id);
  const beforeRetry = env.store.ledger.size;
  expect((await env.materialize(env.context.asOf)).id).toBe(env.context.id);
  expect(env.store.ledger.size).toBe(beforeRetry);
  // Replaying an old immutable context after a newer correction never advances the current head.
  const replayed = await env.materialize(env.originalContext.asOf);
  expect(replayed.id).toBe(env.originalContext.id);
  expect(env.store.ledger.size).toBe(beforeRetry);
  await env.materialize(env.context.asOf);
  const handler = createForgeReadHandler({ enabled: true, repository: env.repository });
  let status = 0, body: unknown;
  const res = { setHeader() {}, status(code: number) { status = code; return res; }, json(value: unknown) { body = value; return res; } };
  await handler({ method: "GET", query: { operation: "score", playerId: String(FIXTURE_TARGET.playerId), weights: JSON.stringify(env.profiles[1].weights) } } as unknown as NextApiRequest, res as unknown as NextApiResponse);
  expect(status).toBe(200);
  expect(body).toMatchObject({ scoringLabel: "re-scored under selected profile", accountability: { profileId: env.profiles[1].id, uniqueTargets: 1, observationUnit: "checkpoint_observation" } });
  const view = await env.repository.player(FIXTURE_TARGET.playerId, env.profiles[1]);
  expect(view!.games[0].actual.value).toEqual({ state: "available", value: -2 });
  expect(view!.accountability.strata!.some(row => row.paired.some(b => b.paired > 0))).toBe(true);
  expect(view!.accountability.strata!.some(row => row.corrections > 0)).toBe(true);
  expect(view!.accountability.strata!.some(row => row.dimensions.valueKind === "PIM" && row.intervals.every(band => band.count > 0))).toBe(true);
  expect(view!.games[0].latestRevision!.qualified).toBe(false);
  expect(view!.games[0].events.some(row => row.reason.includes("lock_passed"))).toBe(true);
  expect(JSON.stringify(body)).not.toContain("sourceManifest");
  // A preparation limit refuses a partial read instead of silently producing incomplete history.
  await expect(preparePlayerReadContext({ store: env.store, artifacts: env.artifacts, player: env.context.player, targets: [FIXTURE_TARGET], asOf: "2026-01-13T04:00:00.000Z", evidenceClass: "fixture", profiles: [DEFAULT_SCORING], qualifications: [], excluded: [], previous: env.context, maximumRecordsPerKind: 1, maximumPublicationsPerGame: 1, visibility: "local_fixture" })).rejects.toThrow(/bound_exceeded/);
  expect((await env.store.records(targetKey(FIXTURE_TARGET), "history_event", 0, 200)).length).toBeGreaterThan(0);
  const original = [...env.store.issued.values()][0].vintage;
  if (original.distribution.state !== "available" || original.calibration.state !== "available") throw new Error("Fixture pins unavailable");
  const distribution = original.distribution.value, calibration = original.calibration.value;
  const reproduce = async () => {
    const joint = await env.artifacts.read(distribution), fitted = await env.artifacts.read(calibration);
    if (joint.state !== "available" || fitted.state !== "available") return [];
    return env.profiles.map(profile => evaluatePinnedIntervals(original, profile, { reference: joint.reference, payload: JSON.parse(joint.bytes) as JointDistribution }, { reference: fitted.reference, payload: JSON.parse(fitted.bytes) as CalibrationPayload }, "fixture-only"));
  };
  const bands = await reproduce(); expect(bands.every(band => band.state === "available")).toBe(true);
  await env.artifacts.archive(distribution); await env.artifacts.archive(calibration);
  expect(await reproduce()).toEqual(bands);
  await env.artifacts.restore(distribution); await env.artifacts.restore(calibration);
  await writeFile(join(root, "online", "content", `${distribution.sha256}.json`), "{}");
  const missing = await env.materialize("2026-01-13T04:00:00.000Z");
  expect(missing.accountability.strata!.some(row => (row.artifactFailures ?? 0) > 0)).toBe(true);
  expect((await env.store.records(targetKey(FIXTURE_TARGET), "integrity_incident")).length).toBeGreaterThan(0);
  await rm(join(root, "online", "content", `${distribution.sha256}.json`)); await env.artifacts.restore(distribution);
  const restored = await env.materialize("2026-01-14T04:00:00.000Z");
  expect(restored.accountability.strata!.some(row => row.dimensions.horizon === 10 && row.intervals.every(band => band.count > 0))).toBe(true);
  expect(await reproduce()).toEqual(bands);
  // Exceptional appearance corrections use the same actually issued vintages and API projection.
  let priorOutcome = restored.games[0].outcome!;
  for (const [index, appearance] of (["dressed_unused", "nonappearance", "ambiguous", "game_not_played", "official_appearance"] as const).entries()) {
    const at = `2026-01-${15 + index}T04:00:00.000Z`;
    const outcome = { ...priorOutcome, id: `appearance-branch:${appearance}`, predecessorId: priorOutcome.id, appearance, recordedAt: at, reason: "synthetic_appearance_correction_branch" };
    await env.store.appendRecord(outcome.id, "outcome", targetKey(outcome), outcome, priorOutcome.id);
    const branch = await env.materialize(at);
    const repository = new PreparedForgeReadRepository({ players: async () => [branch.player], read: async () => branch, readGame: async () => branch }, env.store.asPostgresStore(), env.artifacts);
    const projected = await repository.player(FIXTURE_TARGET.playerId, DEFAULT_SCORING);
    expect(projected!.games[0].actual.appearance).toBe(appearance);
    expect(projected!.games[0].actual.value.state).toBe(appearance === "official_appearance" ? "available" : "unavailable");
    expect(projected!.games[0].lockedFinal.vintageId).toBe(env.last.vintage.id);
    const finalGrade = [...env.store.ledger.values()].flatMap(row => {
      const item = row.payload as { type?: string; value?: EvaluationRevision };
      return row.kind === "evaluation" && item.type === "grade" && item.value?.selection.series === "locked_final" && item.value.outcomeId === outcome.id && item.value.profile.id === DEFAULT_SCORING.id && item.value.valueKind === "PIM" ? [item.value] : [];
    }).at(-1)!;
    expect(finalGrade.participationActual.state).toBe(["ambiguous", "game_not_played"].includes(appearance) ? "unavailable" : "available");
    priorOutcome = outcome;
  }
}, 20000);
