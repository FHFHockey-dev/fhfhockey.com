import { describe, expect, it } from "vitest";
import { CATEGORIES, CategoryMeans, available, unavailable } from "./contracts";
import { FIXTURE_TARGET, fixtureSource } from "./fixtures";
import { CandidateModel, FitProtocol, ModelContext, ModelExample, buildBaselines, fitCandidate, partitionExamples, predictConditional } from "./model";
import { participationLabel, predictParticipation, fitParticipation } from "./participation";
import { predictJoint, scoreJoint } from "./uncertainty";
import { DEFAULT_SCORING } from "./identity";
import { contentHash } from "./hash.server";

const date = (day: number) => `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`;
function row(index: number, overrides: Partial<ModelExample> = {}): ModelExample {
  return { ...FIXTURE_TARGET, id: `row-${index}`, gameId: 2099020000 + index, inputCutoffAt: date(index + 1), gameStartAt: date(index + 2), outcomeAvailableAt: date(index + 3), appearance: "official_appearance", features: { opponent: available(index) }, values: Object.fromEntries(CATEGORIES.map(c => [c, available(c === "PPP" ? 0 : index)])) as CategoryMeans, sources: [fixtureSource()], outcomeSource: fixtureSource({ firstReceivedAt: date(index + 3), observedAt: date(index + 3), publishedAt: date(index + 3) }), ...overrides };
}
const context: ModelContext = { ...FIXTURE_TARGET, gameId: 2099020999, inputCutoffAt: date(31), features: { opponent: available(0) }, sources: [fixtureSource()], limitations: ["role_change", "recent_trade"] };
const recipe = { id: "kernel-1", featureNames: ["opponent"], bandwidth: 2, minimumSupport: 1 };
const model = (training = [row(0), row(1), row(2)]): CandidateModel => ({ algorithm: "official-appearance-kernel-means-v1", version: "development-v1", recipe, training, evidence: "development_only", protocolId: "protocol", fittedAt: date(10), availableAt: date(11), dependencyAvailableAt: date(5), selection: { kind: "development_mse", protocolHash: "a".repeat(64), developmentDataHash: "b".repeat(64) } });
const protocol = (rows: ModelExample[]): FitProtocol => ({ id: "protocol", registeredAt: "2025-12-01T12:00:00.000Z", independentlyReviewed: true, admissibleIds: rows.map(r => r.id), admissibleHashes: Object.fromEntries(rows.map(r => [r.id, contentHash(r)])), trainEndAt: date(8), developmentEndAt: date(15), calibrationEndAt: date(29), fitAt: date(30), availableAt: date(31), recipes: [recipe, { ...recipe, id: "kernel-2", bandwidth: 3 }] });

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
