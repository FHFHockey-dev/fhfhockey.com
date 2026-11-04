import { describe, expect, it } from "vitest";
import { compareOpportunity, OPPORTUNITY_DEFAULTS, pooledCohort, summarizeOpportunityHistory, type OpportunityGame, type OpportunityWindow } from "./opportunity";

const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
};
/** Four-game cycle at 1000 s TOI and 100 s PP: G 2, A 2, PPP 1 (a PP goal), 10 shots per cycle.
 * G+A: 1 per game; PP rate 1/400 per s, non-PP rate 3/3600. FP: 3.25 per game; a PP point is worth 3.5. */
const CYCLE = [[1, 0, 1, 3], [0, 1, 0, 2], [0, 0, 0, 1], [1, 1, 0, 4]] as const;
const game = (i: number, over: Partial<OpportunityGame> = {}): OpportunityGame => {
  const [goals, assists, ppPoints, shots] = CYCLE[i % 4];
  const fp = 3 * goals + 2 * assists + ppPoints + 0.2 * shots;
  return { seconds: 1000, ppSeconds: 100, goals, assists, ppPoints, tracks: [fp, goals + assists, 0.3 * fp + 0.1 * (i % 3)], ...over };
};
const history40 = (over: Partial<OpportunityGame> = {}) => Array.from({ length: 40 }, (_, i) => game(i, over));
const sd = (xs: number[]) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); };
/** A 5-game window; `pts` is the G+A total, FP and GS follow a fixed ratio so only G+A is steered. */
const win = (toiPerGame: number, ppPerGame: number, pts: number, over: Partial<OpportunityWindow> = {}): OpportunityWindow =>
  ({ games: 5, seconds: 5 * toiPerGame, ppSeconds: 5 * ppPerGame, observed: [3.25 * pts, pts, 1.2 * pts], ...over });
const ga = (h = summarizeOpportunityHistory(history40()), w: OpportunityWindow) => compareOpportunity(h, w, { headlineTrack: 1 });

describe("summarizeOpportunityHistory", () => {
  it("splits G+A exactly and values an FP power-play point at 3 + goal share", () => {
    const h = summarizeOpportunityHistory(deepFreeze(history40()));
    expect(h.reason).toBeNull();
    expect(h.effectiveGames).toBe(40);
    expect(h.perGame[0]).toBeCloseTo(3.25, 12); expect(h.perGame[1]).toBeCloseTo(1, 12);
    expect(h.secondsPerGame).toBe(1000); expect(h.ppSecondsPerGame).toBe(100);
    expect(h.split.goalShare).toBeCloseTo(0.5, 12);
    expect(h.split.ppPointValue).toEqual([3.5, 1, null]);
    expect(h.split.ppRate[1]).toBeCloseTo(1 / 400, 12); expect(h.split.nonPpRate[1]).toBeCloseTo(3 / 3600, 12);
    expect(h.split.ppRate[0]).toBeCloseTo(3.5 / 400, 12); expect(h.split.nonPpRate[0]).toBeCloseTo(9.5 / 3600, 12);
    expect(h.split.ppRate[2]).toBeNull();
    expect(h.split.ppRateSource).toBe("personal");
    expect(h.perGameSD[1]).toBeCloseTo(sd(history40().map(g => g.tracks[1] as number)), 12);
  });

  it("separates confirmed zero history from too little history", () => {
    expect(summarizeOpportunityHistory([]).reason).toBe("no_personal_history");
    const short = summarizeOpportunityHistory(history40().slice(0, 12));
    expect(short.reason).toBe("insufficient_personal_history");
    expect(short.perGame[1]).toBeCloseTo(1, 12);
  });

  it("normalises weights to effective games, so uniform weights change nothing", () => {
    const plain = summarizeOpportunityHistory(history40()), doubled = summarizeOpportunityHistory(history40({ weight: 2 }));
    expect(doubled.effectiveGames).toBeCloseTo(40, 12);
    expect(doubled.split.ppRate[1]).toBeCloseTo(plain.split.ppRate[1]!, 12);
    expect(doubled.perGameSD[0]).toBeCloseTo(plain.perGameSD[0]!, 12);
    const weighted = summarizeOpportunityHistory(history40().map((g, i) => ({ ...g, weight: i < 20 ? 0.1 : 1 })));
    expect(weighted.effectiveGames).toBeLessThan(40);
    expect(() => summarizeOpportunityHistory([game(0, { weight: -1 })])).toThrow("weights");
  });

  it("shrinks the PP rate toward the cohort with pseudo-seconds, and needs a cohort when PP history is thin", () => {
    const cohort = { ppRate: [0.004, 0.0012] as [number, number], goalShare: 0.42 };
    const h = summarizeOpportunityHistory(history40(), { cohort });
    expect(h.split.ppRateSource).toBe("personal_shrunk_to_cohort");
    expect(h.split.ppRate[1]).toBeCloseTo((10 + 3600 * 0.0012) / (4000 + 3600), 12);
    const thin = history40({ ppSeconds: 10 }).map((g, i) => ({ ...g, ppPoints: 0, assists: i % 4 === 0 ? 0 : g.assists }));
    expect(summarizeOpportunityHistory(thin).split.reason).toBe("pp_rate_unsupported_without_cohort");
    expect(summarizeOpportunityHistory(thin, { cohort }).split.reason).toBeNull();
  });

  it("leaves a track unavailable, never zero, when a history game lacks it", () => {
    const h = summarizeOpportunityHistory(history40().map((g, i) => (i === 3 ? { ...g, tracks: [g.tracks[0], g.tracks[1], null] } : g)));
    expect(h.perGame[2]).toBeNull(); expect(h.trackReasons[2]).toBe("track_unavailable_in_history");
    const noPp = summarizeOpportunityHistory(history40().map((g, i) => (i === 5 ? { ...g, ppPoints: null } : g)));
    expect(noPp.split.reason).toBe("pp_split_inputs_unavailable"); expect(noPp.perGame[1]).toBeCloseTo(1, 12);
  });

  it("pools cohort PP rates", () => {
    const c = pooledCohort(history40())!;
    expect(c.goalShare).toBeCloseTo(0.5, 12);
    expect(c.ppRate[1]).toBeCloseTo(1 / 400, 12); expect(c.ppRate[0]).toBeCloseTo(3.5 / 400, 12);
    expect(pooledCohort([])).toBeNull();
  });
});

describe("compareOpportunity", () => {
  it("does not treat a promotion as sell-high when the new role explains the per-game gain", () => {
    // TOI 1000 -> 1100, PP 100 -> 300: split expectation 3/3600·4000 + 1500/400 = 7.083 G+A versus 5 per-game.
    const r = ga(undefined, win(1100, 300, 7));
    const t = r.tracks[1];
    expect(t.perGame.direction).toBe("sell_high_evidence");
    expect(t.adjusted.expected).toBeCloseTo(3 / 3600 * 4000 + 1500 / 400, 12);
    expect(t.adjusted.direction).toBe("balanced");
    expect(t.assessment).toMatchObject({ direction: "balanced", reason: "opportunity_explains_per_game_gap", conflict: true, opportunityShift: "increase", opportunityEffectSource: "split" });
    expect(t.assessment.text).toContain("not sell-high evidence");
    expect(r.headline).toBe(t.assessment);
  });

  it("allows a direction when production beats both comparisons", () => {
    const t = ga(undefined, win(1100, 300, 12)).tracks[1];
    expect(t.assessment).toMatchObject({ direction: "sell_high_evidence", reason: "comparisons_agree", conflict: false, qualified: false });
  });

  it("withholds when the comparisons point opposite ways, because that turns on role persistence", () => {
    const t = ga(undefined, win(1100, 300, 6)).tracks[1];
    expect([t.perGame.direction, t.adjusted.direction]).toEqual(["sell_high_evidence", "buy_low_evidence"]);
    expect(t.assessment).toMatchObject({ direction: "withheld", reason: "opposite_directions_role_persistence_unknown", conflict: true });
    expect(t.assessment.text).toContain("persists");
  });

  it("holds balanced when per-game output is at baseline but the bigger role implied more", () => {
    const t = ga(undefined, win(1100, 300, 5.5)).tracks[1];
    expect([t.perGame.direction, t.adjusted.direction]).toEqual(["balanced", "buy_low_evidence"]);
    expect(t.assessment).toMatchObject({ direction: "balanced", reason: "per_game_at_baseline_rates_shifted", conflict: true });
  });

  it("does not treat a demotion as buy-low when the smaller role explains the drop", () => {
    const t = ga(undefined, win(900, 0, 3.75)).tracks[1];
    expect(t.perGame.direction).toBe("buy_low_evidence");
    expect(t.adjusted.expected).toBeCloseTo(3 / 3600 * 4500, 12);
    expect(t.assessment).toMatchObject({ direction: "balanced", reason: "opportunity_explains_per_game_gap", opportunityShift: "decrease" });
  });

  it("qualifies a direction that the role change does not explain when (b) is inside the band", () => {
    // Stable role: z_a = 0.81/1.601 ≈ 0.506; (b) adds PP-rate uncertainty, so z_b = 0.81/1.649 ≈ 0.491.
    const t = ga(undefined, win(1000, 100, 5.81)).tracks[1];
    expect(t.perGame.z).toBeCloseTo(0.81 / (Math.sqrt(20 / 39) * Math.sqrt(5)), 10);
    expect(t.adjusted.scale).toBeCloseTo(Math.sqrt(5 * 20 / 39 + 500 ** 2 / 400 / 4000), 10);
    expect(t.adjusted.direction).toBe("balanced");
    expect(t.assessment).toMatchObject({ direction: "sell_high_evidence", reason: "adjusted_within_balanced_band", qualified: true, opportunityShift: "stable" });
  });

  it("keeps Game Score's adjusted comparison unavailable and withholds when ice time could explain its gap", () => {
    const r = compareOpportunity(summarizeOpportunityHistory(history40()), win(1300, 200, 1, { observed: [3.25, 1, 9] }), { headlineTrack: 2 });
    const t = r.tracks[2];
    expect(t.adjusted).toMatchObject({ available: false, reason: "no_strength_split_for_track", expected: null, gap: null });
    expect(t.perGame.direction).toBe("sell_high_evidence");
    expect(t.assessment).toMatchObject({ direction: "withheld", reason: "adjusted_unavailable_opportunity_may_explain", opportunityEffectSource: "toi_only" });
    expect(r.changes.pp.impact[2]).toBeNull();
    expect(r.changes.pp.text).toContain("not estimated");
  });

  it("keeps the per-game comparison when the window's PP time is missing", () => {
    const t = ga(undefined, win(1000, 100, 9, { ppSeconds: null })).tracks[1];
    expect(t.perGame.available).toBe(true);
    expect(t.adjusted).toMatchObject({ available: false, reason: "window_pp_toi_unavailable" });
    expect(t.assessment).toMatchObject({ direction: "sell_high_evidence", reason: "adjusted_unavailable_per_game_only", qualified: true });
  });

  it("supports a window without PP time even when the PP rate is unsupported", () => {
    const thin = history40({ ppSeconds: 10 });
    const h = summarizeOpportunityHistory(thin);
    expect(h.split.reason).toBe("pp_rate_unsupported_without_cohort");
    expect(ga(h, win(1000, 0, 5)).tracks[1].adjusted.available).toBe(true);
    expect(ga(h, win(1000, 50, 5)).tracks[1].adjusted).toMatchObject({ available: false, reason: "pp_rate_unsupported_without_cohort" });
  });

  it("marks every comparison unavailable without personal history, with distinct reasons", () => {
    const none = ga(summarizeOpportunityHistory([]), win(1000, 100, 5));
    expect(none.tracks[1].perGame.reason).toBe("no_personal_history");
    expect(none.tracks[1].assessment.direction).toBe("unavailable");
    const short = ga(summarizeOpportunityHistory(history40().slice(0, 8)), win(1000, 100, 5));
    expect(short.tracks[1].adjusted.reason).toBe("insufficient_personal_history");
    expect(none.changes.toi.text).toContain("baseline value missing");
  });

  it("reports TOI and PP changes whose impacts add up to the opportunity effect", () => {
    const r = compareOpportunity(summarizeOpportunityHistory(history40()), win(1100, 300, 7));
    expect(r.changes.toi).toMatchObject({ baseline: 1000, current: 1100, delta: 100, deltaPct: 10 });
    expect(r.changes.pp).toMatchObject({ baseline: 100, current: 300, delta: 200 });
    for (const t of [0, 1]) {
      const x = r.tracks[t];
      expect(r.changes.toi.impact[t]! + r.changes.pp.impact[t]!).toBeCloseTo(x.adjusted.expected! - x.perGame.expected!, 12);
      expect(x.assessment.opportunityEffect).toBeCloseTo(x.adjusted.expected! - x.perGame.expected!, 12);
    }
    expect(r.changes.toi.text).toMatch(/^Ice time is up 100 s per game \(\+10%\)/);
    expect(r.changes.pp.text).toContain("FP over these 5 games");
    expect(r.persistenceNote).toContain("not evidence");
    expect(r).toMatchObject({ retrospective: true, forecast: false, trusted: false, calibratedProbability: null, headlineTrack: OPPORTUNITY_DEFAULTS.headlineTrack });
  });

  it("is pure and rejects malformed windows", () => {
    const h = deepFreeze(summarizeOpportunityHistory(history40())), w = deepFreeze(win(1100, 300, 7));
    expect(compareOpportunity(h, w)).toEqual(compareOpportunity(h, w));
    expect(() => compareOpportunity(h, { ...w, observed: [1, 2] })).toThrow();
    expect(() => compareOpportunity(h, w, { headlineTrack: 3 })).toThrow();
    expect(compareOpportunity(h, { ...w, games: 0 }).tracks[0].perGame.reason).toBe("window_games_unavailable");
    expect(compareOpportunity(h, { ...w, observed: [null, 7, 8] }).tracks[0].perGame.reason).toBe("observed_production_unavailable");
  });
});
