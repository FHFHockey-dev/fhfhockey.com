import { describe, expect, it } from "vitest";

import {
  buildSkaterModeledHeadTotals,
  hasKnownModeledHeadTotals,
  resolveSkaterPkBasis,
  SKATER_PK_BASIS_NOTES,
  sumModeledHeads,
} from "./modeledHeadTotals";

const accounting = (esDefinition: string) => ({
  model: { skater_selection: { strength_accounting: { version: "forge-skater-strength-buckets-v1",
    es_definition: esDefinition } } },
});
const line = {
  proj_goals_es: 0.2, proj_goals_pp: 0.1, proj_goals_pk: 0.02,
  proj_assists_es: 0.3, proj_assists_pp: 0.15, proj_assists_pk: 0.01,
  proj_shots_es: 2, proj_shots_pp: 0.5, proj_shots_pk: 0.2,
};

describe("modeled-head totals (A-08, AF-05 version-aware PK admission)", () => {
  it("sums ES, PP and PK only when all three heads are known", () => {
    expect(sumModeledHeads(0.4, 0.2, 0)).toBeCloseTo(0.6, 6);
    expect(sumModeledHeads(0.4, 0.2, 0.05)).toBeCloseTo(0.65, 6);
    expect(sumModeledHeads(0.4, 0.2, null)).toBeNull();
    expect(sumModeledHeads(0.4, 0.2, undefined)).toBeNull();
    expect(sumModeledHeads(0.4, null, 0)).toBeNull();
    expect(sumModeledHeads(null, 0.2, 0)).toBeNull();
  });

  it("withholds totals for an all-situations row missing its PK head (ES .2, PP .1, PK null)", () => {
    const totals = buildSkaterModeledHeadTotals({
      ...line,
      proj_goals_pk: null,
      proj_assists_pk: null,
      proj_shots_pk: null,
      uncertainty: accounting("even_strength"),
    });

    expect(totals).toMatchObject({ goals: null, assists: null, points: null, shots: null, pkBasis: "pk_head" });
    // PP points need only the PP heads.
    expect(totals.ppPoints).toBeCloseTo(0.25, 6);
    expect(hasKnownModeledHeadTotals(totals)).toBe(false);
  });

  it("treats a row that carries any PK head as all-situations: one missing PK head withholds its totals", () => {
    const totals = buildSkaterModeledHeadTotals({ ...line, proj_goals_pk: null });

    expect(totals.pkBasis).toBe("pk_head");
    expect(totals.goals).toBeNull();
    expect(totals.points).toBeNull();
    expect(totals.assists).toBeCloseTo(0.46, 6);
    expect(totals.shots).toBeCloseTo(2.7, 6);
    expect(totals.ppPoints).toBeCloseTo(0.25, 6);
    expect(hasKnownModeledHeadTotals(totals)).toBe(false);
  });

  it("labels rows with no PK bucket (ES holds all non-PP time) instead of withholding them", () => {
    const noPk = { ...line, proj_goals_pk: null, proj_assists_pk: null, proj_shots_pk: null };
    // Unknown team PK exposure on the current writer, a legacy row, a reserve line with no PK columns.
    const reserve = { proj_goals_es: 0.2, proj_goals_pp: 0.1, proj_assists_es: 0.3, proj_assists_pp: 0.15,
      proj_shots_es: 2, proj_shots_pp: 0.5 };
    for (const row of [{ ...noPk, uncertainty: accounting("all_non_pp_time") }, noPk, reserve]) {
      const totals = buildSkaterModeledHeadTotals(row);
      expect(totals.pkBasis).toBe("pk_unmodelled");
      expect(totals.goals).toBeCloseTo(0.3, 6);
      expect(totals.assists).toBeCloseTo(0.45, 6);
      expect(totals.points).toBeCloseTo(0.75, 6);
      expect(totals.shots).toBeCloseTo(2.5, 6);
      expect(totals.ppPoints).toBeCloseTo(0.25, 6);
    }
    expect(SKATER_PK_BASIS_NOTES.pk_unmodelled).toMatch(/Penalty kill not modelled/);
    // A withheld ES or PP head is still unknown, never a partial sum.
    expect(buildSkaterModeledHeadTotals({ ...reserve, proj_goals_pp: null })).toMatchObject({
      goals: null, points: null, ppPoints: null });
  });

  it("follows the strength-accounting marker over head presence", () => {
    expect(resolveSkaterPkBasis({ ...line, uncertainty: accounting("all_non_pp_time") })).toBe("pk_unmodelled");
    expect(resolveSkaterPkBasis({ proj_goals_pk: null, uncertainty: accounting("even_strength") })).toBe("pk_head");
    expect(resolveSkaterPkBasis({ ...line, uncertainty: { model: {} } })).toBe("pk_head");
    expect(resolveSkaterPkBasis({ proj_goals_es: 0.2 })).toBe("pk_unmodelled");
  });

  it("keeps a fully known all-situations row's totals", () => {
    const totals = buildSkaterModeledHeadTotals({ ...line, uncertainty: accounting("even_strength") });

    expect(totals.goals).toBeCloseTo(0.32, 6);
    expect(totals.assists).toBeCloseTo(0.46, 6);
    expect(totals.points).toBeCloseTo(0.78, 6);
    expect(totals.ppPoints).toBeCloseTo(0.25, 6);
    expect(totals.shots).toBeCloseTo(2.7, 6);
    expect(totals.pkBasis).toBe("pk_head");
    expect(hasKnownModeledHeadTotals(totals)).toBe(true);
  });
});
