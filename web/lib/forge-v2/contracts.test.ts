import { describe, expect, it } from "vitest";
import { assertArtifact, assertComponent, assertHorizon, assertId, assertSource, assertVintage, instant, unavailable } from "./contracts";
import { canonicalJson, DEFAULT_SCORING, scoreMeans, scoringProfile } from "./identity";
import { contentHash } from "./hash.server";
import { FIXTURE_CASES, fixtureMeans, fixtureSource, fixtureVintage } from "./fixtures";

describe("FORGE v2 contracts (T1)", () => {
  it("pins deterministic output and canonical scoring identities", () => {
    expect(() => assertVintage(fixtureVintage())).not.toThrow();
    expect(contentHash(fixtureVintage())).toBe(contentHash(fixtureVintage()));
    expect(contentHash({ b: 2, a: 1 })).toBe(contentHash({ a: 1, b: 2 }));
    expect(scoringProfile({ PIM: -0, BLK: 0.25, HIT: 0.2, SOG: 0.2, PPP: 1, A: 2, G: 3 })).toEqual(DEFAULT_SCORING);
    expect(() => canonicalJson({ value: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
  });
  it("rejects invalid identities, clocks, horizons and provenance", () => {
    for (const id of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => assertId(id)).toThrow();
    for (const h of [0, 11, 1.5, NaN]) expect(() => assertHorizon(h)).toThrow();
    for (const value of ["2026-01-01", "2026-02-30T00:00:00Z", "2026-01-01T12:00:00-05:00", "no"]) expect(() => instant(value)).toThrow();
    expect(instant("2026-01-01T12:00:00Z")).toBe(instant("2026-01-01T12:00:00.000Z"));
    expect(() => assertSource(fixtureSource(), "2026-01-01T11:00:00Z")).toThrow(/cutoff/);
    expect(() => assertSource(fixtureSource({ use: "unknown" }))).toThrow(/approved/);
    expect(() => assertSource(fixtureSource({ publishedAt: "2026-01-02T12:00:00Z" }))).toThrow(/clock/);
    expect(() => assertVintage(fixtureVintage({ episodeId: "" }))).toThrow();
    expect(() => assertVintage(fixtureVintage({ generatedAt: "2025-12-31T12:00:00Z" }))).toThrow();
    expect(() => assertVintage(fixtureVintage({ means: fixtureMeans({ PPP: { state: "available", value: 4 } }) }))).toThrow(/PPP/);
  });
  it("retains unknowns and allows unavailable zero-weight categories", () => {
    expect(scoreMeans(FIXTURE_CASES.missingPim, DEFAULT_SCORING)).toEqual({ state: "available", value: 3.95 });
    const pim = scoringProfile({ ...DEFAULT_SCORING.weights, PIM: -1 });
    expect(scoreMeans(FIXTURE_CASES.missingPim, pim)).toEqual(unavailable("missing_contributing_category:PIM"));
    expect(scoreMeans(fixtureMeans(), pim)).toEqual({ state: "available", value: 3.45 });
    expect(() => scoringProfile({ ...DEFAULT_SCORING.weights, G: Infinity })).toThrow();
    expect(scoreMeans(fixtureMeans(), { ...DEFAULT_SCORING, id: "forged" }).state).toBe("unavailable");
    expect(() => assertComponent({ state: "available", value: 1.1 }, true)).toThrow();
  });
  it("preserves independent population and appearance fixtures without qualifying them", () => {
    expect(FIXTURE_CASES.injured.status).toBe("injury_reserve");
    expect(FIXTURE_CASES.penaltyOnly.values.PIM).toEqual({ state: "available", value: 2 });
    expect(FIXTURE_CASES.penaltyOnly.appearance).toBe("official_appearance");
    expect(FIXTURE_CASES.dressedUnused.appearance).toBe("dressed_unused");
    expect(fixtureVintage().qualificationId).toBeNull();
    expect(fixtureVintage().participation.probability.state).toBe("unavailable");
    expect(() => assertArtifact({} as never)).toThrow();
  });
});
