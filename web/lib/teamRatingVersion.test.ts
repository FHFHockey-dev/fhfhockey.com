import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  TEAM_POWER_V4_VERSION,
  describeGoaltendingBasis,
  formatSourceMonthDay,
  goaltendingColumnLabel,
  seasonLabelForDate,
  summarizeGoaltendingBasis
} from "./teamRatingVersion";

const V3 = "team-power-v3-all-team-baseline-prior-after-norm-pooled-st";

describe("team power goaltending basis (Astra #434 P1)", () => {
  it("matches the writer's v4 calculation version string", () => {
    // Read as text: importing the API route would load its server dependencies.
    const writer = readFileSync(
      path.join(__dirname, "../pages/api/v1/db/update-team-power-ratings.ts"),
      "utf8"
    );
    const match = /TEAM_POWER_RATING_CALCULATION_VERSION\s*=\s*"([^"]+)"/.exec(writer);
    expect(match?.[1]).toBe(TEAM_POWER_V4_VERSION);
  });

  it("calls only a verified v4 row 5-on-5", () => {
    expect(describeGoaltendingBasis({ calculationVersion: TEAM_POWER_V4_VERSION })).toMatchObject({
      scope: "v4_5v5",
      is5v5: true,
      tag: "5v5"
    });
    for (const calculationVersion of [V3, "legacy_unversioned", null, undefined, "", "team-power-v4"]) {
      expect(describeGoaltendingBasis({ calculationVersion }).is5v5).toBe(false);
    }
  });

  it("labels v3, legacy carry and unverified rows accurately", () => {
    expect(describeGoaltendingBasis({ calculationVersion: V3 })).toMatchObject({
      scope: "v3_all_situations",
      note: "all situations, v3",
      tag: "all sit. · v3"
    });
    const legacy = describeGoaltendingBasis({
      calculationVersion: "legacy_unversioned",
      sourceThroughDate: "2026-08-29"
    });
    expect(legacy).toMatchObject({
      scope: "legacy_carry",
      note: "carried from 2025-26 · as of Aug 29",
      tag: "carried · Aug 29"
    });
    expect(legacy.detail).toContain("calculated through Aug 29, 2026");
    expect(
      describeGoaltendingBasis({ calculationVersion: "legacy_unversioned", sourceThroughDate: null })
    ).toMatchObject({ scope: "legacy_carry", note: "carried · source date unknown" });
    expect(describeGoaltendingBasis({})).toMatchObject({
      scope: "unverified",
      note: "version unverified"
    });
  });

  it("formats source dates without a time-zone shift", () => {
    expect(formatSourceMonthDay("2026-08-29")).toBe("Aug 29");
    expect(formatSourceMonthDay("2026-10-01T00:00:00Z")).toBe("Oct 1");
    expect(formatSourceMonthDay("bad")).toBeNull();
    expect(seasonLabelForDate("2026-08-29")).toBe("2025-26");
    expect(seasonLabelForDate("2026-09-29")).toBe("2026-27");
    expect(seasonLabelForDate("2000-01-15")).toBe("1999-00");
  });

  it("summarises a view as uniform, mixed or empty, ignoring rows without a value", () => {
    const v4 = { calculationVersion: TEAM_POWER_V4_VERSION, goalieRating: 101 };
    const v3 = { calculationVersion: V3, goalieRating: 99 };
    const legacy = (date: string) => ({
      calculationVersion: "legacy_unversioned",
      sourceThroughDate: date,
      goalieRating: 100
    });

    const allV4 = summarizeGoaltendingBasis([v4, v4, { ...v3, goalieRating: null }]);
    expect(allV4).toMatchObject({ kind: "uniform", basis: { scope: "v4_5v5" } });
    expect(goaltendingColumnLabel(allV4, "Goalie")).toMatchObject({
      label: "5v5 Goalie",
      qualifier: null,
      perRowTags: false
    });

    const allV3 = summarizeGoaltendingBasis([v3, v3]);
    expect(goaltendingColumnLabel(allV3, "Goalie")).toMatchObject({
      label: "Goalie",
      qualifier: { note: "all situations, v3" },
      perRowTags: false
    });

    for (const rows of [[v4, v3], [v4, legacy("2026-08-29")], [legacy("2026-08-29"), legacy("2026-07-01")]]) {
      const mixed = summarizeGoaltendingBasis(rows);
      expect(mixed).toEqual({ kind: "mixed" });
      expect(goaltendingColumnLabel(mixed, "Goalie")).toMatchObject({
        label: "Goalie",
        qualifier: null,
        perRowTags: true
      });
    }

    const empty = summarizeGoaltendingBasis([{ ...v4, goalieRating: null }]);
    expect(empty).toEqual({ kind: "empty" });
    expect(goaltendingColumnLabel(empty, "Goalie").label).toBe("Goalie");
  });
});
