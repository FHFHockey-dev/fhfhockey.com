import { describe, expect, it, vi } from "vitest";

import {
  GOALIE_B2B_SAVE_PCT_ADJUSTMENT,
  GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT,
  STARTER_DECISION_SHARE,
  goalieConditionalWinProbability,
  goalieRestSavePctAdjustment,
  goalieWinPopulations,
  marketTeamWinProbability,
  posteriorSavePct,
  shutoutProbability,
  teamWinProbability,
} from "./goalieOutcomes";
import { blendSeasonLeagueSavePct, LEAGUE_SAVE_PCT_CARRYOVER_SHOTS } from "./leagueSavePct";
import { OVERTIME_RULE, finalWinProbabilitiesFromRegulation } from "lib/game-predictions/overtimeRule";
import { summarizeGameMarketRows, type MarketPriceContextRow } from "../queries/market-queries";

vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("no database in unit tests"); } } }));

describe("goalie win populations", () => {
  it("keeps the team win per game apart from each goalie's unconditional credited W", () => {
    const { goalies, startWeightedTeamWin, startProbabilityMass } = goalieWinPopulations([
      { goalieId: 1, startProbability: 0.7, teamWinIfStarts: 0.55 },
      { goalieId: 2, startProbability: 0.3, teamWinIfStarts: 0.5 },
    ]);
    expect(startProbabilityMass).toBeCloseTo(1, 12);
    expect(startWeightedTeamWin).toBeCloseTo(0.535, 12);
    const [starter, backup] = goalies;
    expect(starter.creditedWinIfStarts).toBeCloseTo(0.55 * STARTER_DECISION_SHARE, 12);
    expect(starter.starterWin).toBeCloseTo(0.7 * 0.55 * STARTER_DECISION_SHARE, 12);
    // Two candidates: all relief wins when the other starts go to this goalie.
    expect(starter.reliefWin).toBeCloseTo(0.3 * 0.5 * (1 - STARTER_DECISION_SHARE), 12);
    expect(backup.reliefWin).toBeCloseTo(0.7 * 0.55 * (1 - STARTER_DECISION_SHARE), 12);
    // Every team win is credited to exactly one goalie.
    expect(starter.unconditionalWin + backup.unconditionalWin).toBeCloseTo(startWeightedTeamWin!, 12);
  });

  it("splits relief among three candidates by start probability and handles a sure starter", () => {
    const three = goalieWinPopulations([
      { goalieId: 1, startProbability: 0.6, teamWinIfStarts: 0.5 },
      { goalieId: 2, startProbability: 0.3, teamWinIfStarts: 0.5 },
      { goalieId: 3, startProbability: 0.1, teamWinIfStarts: 0.5 },
    ]);
    expect(three.goalies.reduce((sum, g) => sum + g.unconditionalWin, 0)).toBeCloseTo(0.5, 12);
    expect(three.goalies[1].reliefWin).toBeGreaterThan(three.goalies[2].reliefWin);
    const sure = goalieWinPopulations([{ goalieId: 1, startProbability: 1, teamWinIfStarts: 0.6 }]);
    expect(sure.goalies[0]).toMatchObject({ reliefWin: 0 });
    expect(sure.goalies[0].unconditionalWin).toBeCloseTo(0.6 * STARTER_DECISION_SHARE, 12);
  });
});

describe("goalie outcome math", () => {
  it.each([[3, 3], [3.4, 2.6], [2.1, 3.9], [0, 0], [0, 2.5], [4.5, 1.2]])(
    "pairs the two teams' win probabilities to exactly 1 (%s vs %s)", (a, b) => {
      expect(teamWinProbability(a, b) + teamWinProbability(b, a)).toBeCloseTo(1, 12);
    });

  it("is even for equal teams and increasing in a team's own expected goals", () => {
    expect(teamWinProbability(3, 3)).toBeCloseTo(0.5, 12);
    expect(teamWinProbability(3.3, 3)).toBeGreaterThan(teamWinProbability(3, 3));
    expect(teamWinProbability(3, 3.3)).toBeLessThan(0.5);
    expect(() => teamWinProbability(Number.NaN, 3)).toThrow();
  });

  // Astra AF-03 / decision 45: a frozen regulation distribution for unequal teams (lambda 4 vs 2,
  // shrink 0.75 -> 3.75 vs 2.25, tie x1.33). The old f/(f+a) OT split gave .7380469927; the
  // complement and monotonicity checks above pass under both splits, this one does not.
  it("splits a regulation tie for unequal teams by the shared 50/50 overtime rule", () => {
    const frozen = { homeRegulationWin: 0.6215835796, awayRegulationWin: 0.1920749595, regulationTie: 0.1863414609 };
    expect(OVERTIME_RULE.homeShareOfTie).toBe(0.5); // a home edge would need this consumer to pass the side
    const shared = finalWinProbabilitiesFromRegulation(frozen)!;
    expect(teamWinProbability(4, 2)).toBeCloseTo(0.71475431, 8);
    expect(teamWinProbability(4, 2)).toBeCloseTo(shared.home, 9);
    expect(teamWinProbability(2, 4)).toBeCloseTo(shared.away, 9);
    expect(Math.abs(teamWinProbability(4, 2) - 0.7380469927)).toBeGreaterThan(0.02);
  });

  const quote = (book: string, team: string, price: number, observedAt: string | null = "2026-10-10T17:00:00.000Z",
    expiresAt: string | null = "2026-10-10T17:15:00.000Z") => ({ sportsbook_key: book, outcome_key: `team:${team}`,
    line_value: null, price_american: price, source_observed_at: observedAt, freshness_expires_at: expiresAt });
  const h2hOf = (quotes: ReturnType<typeof quote>[]) => ({ marketType: "h2h", sourceRank: 1, sourceNames: ["synthetic"],
    sportsbookKeys: Array.from(new Set(quotes.map((q) => q.sportsbook_key))), observedAt: null, freshnessExpiresAt: null,
    outcomes: [], quotes });

  it("de-vigs each book's two-way moneyline and takes the median across books", () => {
    const one = h2hOf([quote("dk", "AAA", -150), quote("dk", "BBB", 130)]);
    const home = marketTeamWinProbability(one, "AAA", "BBB")!;
    const away = marketTeamWinProbability(one, "BBB", "AAA")!;
    expect(home).toBeCloseTo(0.6 / (0.6 + 100 / 230), 10);
    expect(home + away).toBeCloseTo(1, 12);
    expect(marketTeamWinProbability(one, "AAA", "CCC")).toBeNull();
    const fd = 0.5 / (0.5 + 0.5);
    const two = h2hOf([quote("dk", "AAA", -150), quote("dk", "BBB", 130), quote("fd", "AAA", -110), quote("fd", "BBB", -110)]);
    expect(marketTeamWinProbability(two, "AAA", "BBB")).toBeCloseTo((home + fd) / 2, 10);
    expect(marketTeamWinProbability(two, "AAA", "BBB")! + marketTeamWinProbability(two, "BBB", "AAA")!).toBeCloseTo(1, 12);
  });

  // Astra AF-04: disjoint books, mixed ages, missing timestamps and average-only summaries never pair.
  it("rejects unmatched, mixed-age and untimestamped moneyline quotes", () => {
    expect(marketTeamWinProbability(h2hOf([quote("dk", "AAA", -150), quote("fd", "BBB", 130)]), "AAA", "BBB")).toBeNull();
    expect(marketTeamWinProbability(h2hOf([quote("dk", "AAA", -150),
      quote("dk", "BBB", 130, "2026-10-10T16:00:00.000Z", "2026-10-10T17:15:00.000Z")]), "AAA", "BBB")).toBeNull();
    expect(marketTeamWinProbability(h2hOf([quote("dk", "AAA", -150, null), quote("dk", "BBB", 130, null)]), "AAA", "BBB"))
      .toBeNull();
    expect(marketTeamWinProbability(h2hOf([quote("dk", "AAA", -150, undefined, null), quote("dk", "BBB", 130, undefined, null)]),
      "AAA", "BBB")).toBeNull();
    expect(marketTeamWinProbability(h2hOf([quote("dk", "AAA", -150), quote("dk", "AAA", -140), quote("dk", "BBB", 130)]),
      "AAA", "BBB")).toBeNull();
    const averagesOnly = { ...h2hOf([]), quotes: undefined, outcomes: [
      { outcomeKey: "team:AAA", averageLineValue: null, averagePriceAmerican: -150, averageImpliedProbability: null, sportsbookCount: 1 },
      { outcomeKey: "team:BBB", averageLineValue: null, averagePriceAmerican: 130, averageImpliedProbability: null, sportsbookCount: 1 }] };
    expect(marketTeamWinProbability(averagesOnly, "AAA", "BBB")).toBeNull();
  });

  it("reads only fresh, complete same-book pairs from stored rows", () => {
    const now = "2026-10-10T17:05:00.000Z";
    const row = (book: string, team: string, price: number, observedAt: string | null, expiresAt: string | null):
      MarketPriceContextRow => ({ snapshot_date: "2026-10-10", game_id: 1, market_type: "h2h", sportsbook_key: book,
      outcome_key: `team:${team}`, line_value: null, price_american: price, implied_probability: null, source_rank: 1,
      source_observed_at: observedAt, freshness_expires_at: expiresAt, provenance: { provider: "synthetic" }, metadata: {} });
    const fresh = ["2026-10-10T17:00:00.000Z", "2026-10-10T17:15:00.000Z"] as const;
    const expired = ["2026-10-10T09:00:00.000Z", "2026-10-10T09:15:00.000Z"] as const;
    const read = (rows: MarketPriceContextRow[]) => marketTeamWinProbability(summarizeGameMarketRows(rows, now).h2h, "AAA", "BBB");
    // Astra's probe: two expired offers from disjoint books once read as .5.
    expect(read([row("dk", "AAA", -110, ...expired), row("fd", "BBB", -110, ...expired)])).toBeNull();
    // Fresh disjoint books.
    expect(read([row("dk", "AAA", -150, ...fresh), row("fd", "BBB", 130, ...fresh)])).toBeNull();
    // Mixed age inside one book: the expired side drops out, leaving an incomplete pair.
    expect(read([row("dk", "AAA", -150, ...fresh), row("dk", "BBB", 130, ...expired)])).toBeNull();
    // Untimestamped rows.
    expect(read([row("dk", "AAA", -150, null, null), row("dk", "BBB", 130, null, null)])).toBeNull();
    // A complete fresh pair is read even beside a stale book.
    expect(read([row("dk", "AAA", -150, ...fresh), row("dk", "BBB", 130, ...fresh),
      row("fd", "AAA", 200, ...expired), row("fd", "BBB", -240, ...expired)])).toBeCloseTo(0.6 / (0.6 + 100 / 230), 10);
  });

  it("moves the team win probability by the starter's goals-per-shot ratio", () => {
    const args = { teamWinProbability: 0.55, lambdaFor: 3, lambdaAgainst: 3 };
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 1 })).toBe(0.55);
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 0.9 })).toBeGreaterThan(0.55);
    expect(goalieConditionalWinProbability({ ...args, goalsAgainstRatio: 1.1 })).toBeLessThan(0.55);
  });

  it("shrinks save % with the beta prior and falls back to the prior mean without evidence", () => {
    expect(posteriorSavePct({ shots: 0, goals: 0, priorMean: 0.9 })).toBe(0.9);
    expect(posteriorSavePct({ shots: 1000, goals: 80, priorMean: 0.9, priorShots: 1000 })).toBeCloseTo(0.91, 12);
  });

  it("uses the fitted B2B and heavy-workload adjustments", () => {
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: true, startsLast14Days: 6 })).toBe(GOALIE_B2B_SAVE_PCT_ADJUSTMENT);
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: false, startsLast14Days: 5 })).toBe(GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT);
    expect(goalieRestSavePctAdjustment({ isGoalieBackToBack: false, startsLast14Days: 4 })).toBe(0);
  });

  it("reduces the shots mixture to e^-GA for Poisson shots and adds zeros for overdispersed shots", () => {
    const poisson = shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, nbSize: Infinity, fullGameProbability: 1 });
    expect(poisson).toBeCloseTo(Math.exp(-30 * 0.095), 10);
    expect(shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, fullGameProbability: 1 })).toBeGreaterThan(poisson);
    expect(shutoutProbability({ expectedShotsAgainst: 30, savePct: 0.905, nbSize: Infinity, fullGameProbability: 0.9 }))
      .toBeCloseTo(0.9 * poisson, 10);
    expect(shutoutProbability({ expectedShotsAgainst: 0, savePct: 0.9, fullGameProbability: 0.93 })).toBe(0.93);
  });

  it("blends the season-to-date league save % with last season's mean", () => {
    const early = blendSeasonLeagueSavePct({ currentShots: 0, currentGoals: 0, previousShots: 70000, previousGoals: 7000 });
    expect(early.savePct).toBeCloseTo(0.9, 12);
    const mid = blendSeasonLeagueSavePct({ currentShots: LEAGUE_SAVE_PCT_CARRYOVER_SHOTS, currentGoals: 2200,
      previousShots: 70000, previousGoals: 7000 });
    expect(mid.savePct).toBeCloseTo((0.89 + 0.9) / 2, 12);
  });
});
