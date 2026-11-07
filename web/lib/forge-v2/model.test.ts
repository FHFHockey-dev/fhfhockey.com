import { describe, expect, it } from "vitest";
import { CATEGORIES, CategoryMeans, available, unavailable } from "./contracts";
import { FIXTURE_TARGET, fixtureSource } from "./fixtures";
import { CandidateModel, FitProtocol, ModelContext, ModelExample, buildBaselines, fitCandidate, partitionExamples, predictConditional } from "./model";
import { participationLabel, predictParticipation, fitParticipation } from "./participation";
import { predictJoint, scoreJoint } from "./uncertainty";
import { DEFAULT_SCORING } from "./identity";
import { contentHash } from "./hash.server";
import { buildPriorBaselines, type PriorBaselineInput, type PriorObservation } from "./researchBaselines";
import type { PinnedInput } from "./researchCapture";

const date = (day: number) => `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`;
function row(index: number, overrides: Partial<ModelExample> = {}): ModelExample {
  return { ...FIXTURE_TARGET, id: `row-${index}`, gameId: 2099020000 + index, inputCutoffAt: date(index + 1), gameStartAt: date(index + 2), outcomeAvailableAt: date(index + 3), appearance: "official_appearance", features: { opponent: available(index) }, values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PPP" ? 0 : index)])) as CategoryMeans, sources: [fixtureSource()], outcomeSource: fixtureSource({ firstReceivedAt: date(index + 3), observedAt: date(index + 3), publishedAt: date(index + 3) }), ...overrides };
}
const context: ModelContext = { ...FIXTURE_TARGET, gameId: 2099020999, inputCutoffAt: date(31), features: { opponent: available(0) }, sources: [fixtureSource()], limitations: ["role_change", "recent_trade"] };
const recipe = { id: "kernel-1", featureNames: ["opponent"], bandwidth: 2, minimumSupport: 1 };
const model = (training = [row(0), row(1), row(2)]): CandidateModel => ({ algorithm: "official-appearance-kernel-means-v1", version: "development-v1", recipe, training, evidence: "development_only", protocolId: "protocol", fittedAt: date(10), availableAt: date(11), dependencyAvailableAt: date(5), selection: { kind: "development_mse", protocolHash: "a".repeat(64), developmentDataHash: "b".repeat(64) } });
const protocol = (rows: ModelExample[]): FitProtocol => ({ id: "protocol", registeredAt: "2025-12-01T12:00:00.000Z", independentlyReviewed: true, admissibleIds: rows.map(r => r.id), admissibleHashes: Object.fromEntries(rows.map(r => [r.id, contentHash(r)])), trainEndAt: date(8), developmentEndAt: date(15), calibrationEndAt: date(29), fitAt: date(30), availableAt: date(31), recipes: [recipe, { ...recipe, id: "kernel-2", bandwidth: 3 }] });

describe("prior-only B0/B1/B2 point baselines", () => {
  const pin = <T,>(id: string, value: T, receivedAt: string): PinnedInput<T> => ({ value,
    source: fixtureSource({ id, observedAt: receivedAt, firstReceivedAt: receivedAt, publishedAt: null, sha256: contentHash(value) }) });
  const counts = (shots: number) => ({ G: 1, A: 1, PPP: 0, SOG: shots, HIT: 1, BLK: 1, PIM: 2 });
  const observation = (playerId: number, day: number, shots: number): PinnedInput<PriorObservation> => pin(`prior-${playerId}`, {
    playerId, gameId: 100 + playerId, seasonId: 20252026, kind: "skater", gameType: "regular", gameStartAt: date(day), finalAt: date(day + 1),
    appeared: true, counts: counts(shots), strengths: { ES: { minutes: 10, counts: counts(shots) },
      PP: { minutes: 0, counts: Object.fromEntries(CATEGORIES.map(c => [c, 0])) }, SH: { minutes: 0, counts: Object.fromEntries(CATEGORIES.map(c => [c, 0])) } },
  }, date(day + 1));
  const input = (): PriorBaselineInput => ({ playerId: 1, kind: "skater", cutoffAt: date(31), targetGameIds: [999],
    protocol: { id: "predeclared-fixture", registeredAt: date(1), previousSeasonId: 20252026, admissibleSeasonIds: [20252026],
      halfLifeDays: 10, priorAppearances: 2, priorMinutes: 20, evidenceClass: "fixture" },
    admission: { intendedUse: "local_fixture", approvals: [{ source: "fixture", evidenceId: "fixture-only", approvedAt: date(1), intendedUse: "local_fixture" }] },
    history: [observation(1, 1, 2), observation(2, 21, 4)],
    exposure: pin("predicted-exposure", { expectedGames: 2, expectedMinutes: { ES: 40, PP: 0, SH: 0 } }, date(30)) });

  it("matches analytic shrinkage, temporal weighting and strength-rate exposure without duplicate participation", () => {
    const result = buildPriorBaselines(input()), [b0, b1, b2] = result.baselines;
    expect(b0.conditionalPerAppearance.SOG).toBeCloseTo(10 / 3);
    expect(b0.expected.SOG).toBeCloseTo(20 / 3);
    expect(b1.expected.SOG).toBeCloseTo((0.125 * 2 + 2 * 4) / (0.125 + 2) * 2);
    expect(b2.expected.SOG).toBeCloseTo((0.125 * 2 + 20 * 0.4) / (0.125 * 10 + 20) * 40);
    expect(b2.conditionalPerAppearance.SOG).toBeNull();
    expect(result.promotion).toBe("none");
  });
  it("uses pooled support for rookies, retaining absent categories and unknown exposure", () => {
    const value = input(); value.playerId = 99;
    expect(buildPriorBaselines(value).baselines[0].conditionalPerAppearance.SOG).toBe(3);
    for (const p of value.history) { p.value.counts.HIT = null; p.source.sha256 = contentHash(p.value); }
    value.exposure.value.expectedGames = null; value.exposure.source.sha256 = contentHash(value.exposure.value);
    const result = buildPriorBaselines(value);
    expect(result.baselines[0].conditionalPerAppearance.HIT).toBeNull();
    expect(result.baselines[0].expected.SOG).toBeNull();
  });
  it("fails closed on future source/model protocol, immature, overlapping and unadmitted history", () => {
    const future = input(); future.history[0].source.firstReceivedAt = "2026-02-02T12:00:00Z";
    expect(() => buildPriorBaselines(future)).toThrow(/cutoff/);
    const immature = input(); immature.history[0].value.finalAt = date(31); immature.history[0].source.sha256 = contentHash(immature.history[0].value);
    expect(() => buildPriorBaselines(immature)).toThrow(/immature/);
    const overlap = input(); overlap.targetGameIds = [101]; expect(() => buildPriorBaselines(overlap)).toThrow(/immature/);
    const holdout = input(); holdout.protocol.admissibleSeasonIds = []; expect(() => buildPriorBaselines(holdout)).toThrow(/protocol/);
    const late = input(); late.protocol.registeredAt = "2026-02-02T12:00:00Z"; expect(() => buildPriorBaselines(late)).toThrow(/protocol/);
  });
  it("keeps known DNP and unknown participation in accounting without making either zero ability", () => {
    const value = input(), dnp = observation(3, 10, 0); dnp.value.appeared = false;
    dnp.value.counts = Object.fromEntries(CATEGORIES.map(c => [c, 0])); dnp.value.strengths = {}; dnp.source.sha256 = contentHash(dnp.value);
    const unknown = observation(4, 11, 0); unknown.value.appeared = null; unknown.source.sha256 = contentHash(unknown.value);
    value.history.push(dnp, unknown);
    const result = buildPriorBaselines(value);
    expect(result).toMatchObject({ supplied: 4, knownNonappearances: 1, unknownParticipation: 1 });
    expect(result.baselines[0].conditionalPerAppearance.SOG).toBeCloseTo(10 / 3);
  });
  it("rejects contradictory source totals and leaves unsupported strength exposure unknown", () => {
    const value = input(); value.history[0].value.strengths.ES!.counts.SOG = 99; value.history[0].source.sha256 = contentHash(value.history[0].value);
    expect(() => buildPriorBaselines(value)).toThrow(/strength_totals/);
    const missing = input(); missing.exposure.value.expectedMinutes.PP = null; missing.exposure.source.sha256 = contentHash(missing.exposure.value);
    expect(buildPriorBaselines(missing).baselines[2].expected.SOG).toBeNull();
    const wrongStrength = input(); wrongStrength.history[0].value.strengths.ES!.counts.PPP = 1;
    wrongStrength.history[0].source.sha256 = contentHash(wrongStrength.history[0].value);
    expect(() => buildPriorBaselines(wrongStrength)).toThrow(/strength_points/);
  });
  it("keeps goalie shot accounting coherent and separates appearance counts from minutes", () => {
    const value = input(); value.kind = "goalie";
    for (const pin of value.history) {
      pin.value.kind = "goalie"; pin.value.counts = { SV: 20, GA: 2, SA: 22, W: 1, SO: 0 };
      pin.value.strengths = { ALL: { minutes: 60, counts: { ...pin.value.counts } } }; pin.source.sha256 = contentHash(pin.value);
    }
    value.exposure.value = { expectedGames: 0.5, expectedMinutes: { ALL: 30 } }; value.exposure.source.sha256 = contentHash(value.exposure.value);
    for (const b of buildPriorBaselines(value).baselines) {
      expect(b.expected.SA).toBeCloseTo(b.expected.SV! + b.expected.GA!);
      expect(b.expected.W).toBeCloseTo(0.5);
    }
    value.history[0].value.counts.SA = 21; value.history[0].source.sha256 = contentHash(value.history[0].value);
    expect(() => buildPriorBaselines(value)).toThrow(/prior_shots/);
  });
});

describe("conditional game-specific candidate mechanics", () => {
  it("is deterministic for ten distinct contexts and preserves limitations", () => {
    const outputs = Array.from({ length: 10 }, (_, i) => predictConditional(model(), { ...context, gameId: context.gameId + i, features: { opponent: available(i) } }));
    expect(new Set(outputs.map(o => JSON.stringify(o.means.G))).size).toBe(10);
    expect(contentHash(outputs[0])).toBe(contentHash(predictConditional(model(), context)));
    expect(outputs[0].limitations).toEqual(["role_change", "recent_trade", "development_only"]);
    expect(outputs[0].means.PPP).toEqual(available(0));
  });
  it("preserves cold starts, missing heads and unavailable target context", () => {
    expect(Object.values(predictConditional(model([]), context).means).every(m => m.state === "unavailable")).toBe(true);
    const missing = row(0, { values: Object.fromEntries(CATEGORIES.map(c => [c, unavailable("not_observed")])) as CategoryMeans });
    expect(Object.values(predictConditional(model([missing]), context).means).every(m => m.state === "unavailable")).toBe(true);
    expect(predictConditional(model(), { ...context, features: {} }).means.G.state).toBe("unavailable");
    expect(predictConditional(model(), { ...context, sources: [fixtureSource({ firstReceivedAt: "2026-02-01T00:00:00.000Z" })] }).means.G.state).toBe("unavailable");
  });
  it("fits only registered chronological recipes and refuses protected or duplicate targets", () => {
    const rows = [row(0), row(1), row(8)];
    const fitted = fitCandidate(rows, protocol(rows));
    expect(fitted.state).toBe("available");
    if (fitted.state === "available") { expect(fitted.value.trials).toHaveLength(2); expect(fitted.value.model.evidence).toBe("development_only"); }
    expect(() => fitCandidate(rows, { ...protocol(rows), independentlyReviewed: false })).toThrow();
    expect(() => partitionExamples([...rows, { ...rows[0], id: "another-vintage" }], protocol(rows))).toThrow(/Repeated target/);
    const final = row(28, { gameStartAt: "2026-02-01T00:00:00.000Z", outcomeAvailableAt: "2026-02-02T00:00:00.000Z", outcomeSource: fixtureSource() });
    expect(() => partitionExamples([final], { ...protocol([final]), fitAt: "2026-03-01T00:00:00.000Z", availableAt: "2026-03-01T00:00:01.000Z" })).toThrow(/Protected/);
  });
  it("keeps recipe replay distinct from selected-model historical availability", () => {
    const rows = [row(0), row(1), row(8)];
    const fitted = fitCandidate(rows, protocol(rows));
    expect(fitted.state).toBe("available");
    if (fitted.state !== "available") return;
    expect(fitted.value.trials.every(t => t.evaluation === "predeclared_recipe_replay")).toBe(true);
    expect(fitted.value.model.fittedAt).toBe(date(30));
    expect(fitted.value.model.availableAt).toBe(date(31));
    expect(predictConditional(fitted.value.model, { ...rows[2], limitations: [] }).means.G).toEqual(unavailable("model_not_available_at_cutoff"));
    expect(predictConditional(fitted.value.model, { ...context, inputCutoffAt: date(30) }).means.G.state).toBe("unavailable");
    expect(predictConditional(fitted.value.model, context).means.G.state).toBe("available");
  });
  it("retains full-vector dependence in a fitted empirical joint", () => {
    const joint = predictJoint(model(), context, [...CATEGORIES]);
    expect(joint.state).toBe("available");
    if (joint.state === "available") {
      expect(joint.value.outcomes.every(o => o.values.G === o.values.A && o.values.PPP! <= o.values.G! + o.values.A!)).toBe(true);
      expect(scoreJoint(joint.value, DEFAULT_SCORING).state).toBe("available");
    }
  });
});

describe("matched official-appearance baselines and participation", () => {
  it("uses five official credits including zero counts, excluding dressing and late outcomes", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(i));
    rows.push(row(7, { appearance: "dressed_unused" }), row(8, { outcomeAvailableAt: "2026-02-01T00:00:00.000Z" }));
    const baseline = buildBaselines(rows, context);
    expect(baseline.appearances).toBe(5);
    expect(baseline.lastFive.G).toEqual(available(2));
    expect(baseline.seasonRate.G).toEqual(available(2));
    expect(buildBaselines(rows.slice(0, 4), context).lastFive.G.state).toBe("unavailable");
    rows[0].values.PIM = unavailable("missing_pim");
    expect(buildBaselines(rows, context).lastFive.PIM.state).toBe("unavailable");
    expect(buildBaselines(rows, context).lastFive.G.state).toBe("available");
  });
  it("separates game occurrence, dressing and official appearance without a minutes threshold", () => {
    expect(participationLabel("official_appearance")).toEqual(available(1));
    expect(participationLabel("dressed_unused")).toEqual(available(0));
    expect(participationLabel("nonappearance")).toEqual(available(0));
    expect(participationLabel("game_not_played").state).toBe("unavailable");
    expect(participationLabel("ambiguous").state).toBe("unavailable");
    expect(predictParticipation(null, context).probability.state).toBe("unavailable");
  });
  it("fits chronological calibration bins but keeps percentage estimates private", () => {
    const rows = [row(0), row(1, { appearance: "dressed_unused" }), row(16), row(17, { appearance: "nonappearance" })];
    const fitted = fitParticipation(rows, { ...protocol(rows), participationCalibration: { recipeId: recipe.id, binCount: 1, minimumBinSupport: 2 } });
    expect(fitted.state).toBe("available");
    if (fitted.state === "available") {
      const predicted = predictParticipation(fitted.value, context);
      expect(predicted.probability).toEqual(available(0.5));
      expect(predicted.qualificationId).toBeNull();
      expect(predictParticipation(fitted.value, { ...context, sources: [] }).probability.state).toBe("unavailable");
      expect(fitted.value.fittedAt).toBe(date(30));
      expect(fitted.value.availableAt).toBe(date(31));
      expect(predictParticipation(fitted.value, { ...rows[2], limitations: [] }).probability).toEqual(unavailable("participation_model_not_available_at_cutoff"));
      expect(predictParticipation(fitted.value, { ...context, inputCutoffAt: date(30) }).probability).toEqual(unavailable("participation_model_not_available_at_cutoff"));
    }
  });
});
