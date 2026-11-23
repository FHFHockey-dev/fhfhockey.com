import { describe, expect, it } from "vitest";
import { canonicalJson } from "./identity";
import { H10_SEASON, syntheticLeague } from "./h10Fixtures";
import { assertGoalieVintage, buildGoalieTraining, GOALIE_CONDITIONING, GOALIE_RECIPE, GOALIE_TARGET_VERSION, GoalieRateState, goalieKernelMeans, GoalieVintage } from "./h10Goalies";
import { available, instant, unavailable } from "./contracts";

describe("H10 goalie if-starts (synthetic fixture)", () => {
  const anchor = Date.UTC(2026, 10, 23, 15), asOf = new Date(anchor - 5 * 60000).toISOString();
  const league = syntheticLeague({ anchor, teams: 6, pastDays: 30 });

  it("trains on starts with features from rows received by each start's own cutoff (no leakage)", () => {
    const { training, available: count, skipped } = buildGoalieTraining(league.logs, league.goalieLogs, H10_SEASON, asOf, 100000);
    expect(count).toBeGreaterThan(GOALIE_RECIPE.minimumSupport);
    expect(skipped.inconsistentValues).toBe(0);
    for (const example of training.filter((_, i) => i % 17 === 0)) {
      const start = league.goalieLogs.find(g => g.playerId === example.playerId && g.gameId === example.gameId)!;
      const rebuilt = GoalieRateState.from(league.logs, league.goalieLogs, H10_SEASON, example.inputCutoffAt).features(start.playerId, start.teamId, start.opponentId, start.home);
      expect(canonicalJson(example.features)).toBe(canonicalJson(rebuilt));
      expect(instant(example.outcomeAvailableAt)).toBeGreaterThan(instant(example.inputCutoffAt));
    }
  });

  it("forecasts saves, shots against, goals allowed, win and shutout with SV + GA = SA and probabilities in [0, 1]", () => {
    const { training } = buildGoalieTraining(league.logs, league.goalieLogs, H10_SEASON, asOf, 2000);
    const state = GoalieRateState.from(league.logs, league.goalieLogs, H10_SEASON, asOf), goalie = league.roster.find(p => p.position === "G")!;
    const a = goalieKernelMeans(training, state.features(goalie.playerId, goalie.teamId, league.teams.find(t => t !== goalie.teamId)!, true), 1, asOf);
    const b = goalieKernelMeans(training, state.features(goalie.playerId, goalie.teamId, league.teams.find(t => t !== goalie.teamId)!, false), 1, asOf);
    for (const m of [a.means, b.means]) {
      const v = Object.fromEntries(Object.entries(m).map(([k, c]) => [k, (c as { value: number }).value]));
      expect(Math.abs(v.SHOTS_AGAINST - v.SAVES - v.GOALS_ALLOWED)).toBeLessThan(1e-9);
      expect(v.WIN).toBeGreaterThanOrEqual(0); expect(v.WIN).toBeLessThanOrEqual(1); expect(v.SHUTOUT).toBeLessThanOrEqual(1);
    }
    expect(canonicalJson(a.means)).not.toBe(canonicalJson(b.means)); // venue matters
    expect(goalieKernelMeans(training.slice(0, GOALIE_RECIPE.minimumSupport - 1), state.features(goalie.playerId, goalie.teamId, 2, true), 1, asOf).means.SAVES)
      .toEqual(unavailable("sparse_goalie_start_history"));
  });

  it("rejects a goalie vintage whose saves and goals allowed do not add up to shots against", () => {
    const v = { id: "g1", issuanceKey: "k", sequence: 1, playerId: 8478470, gameId: 2026020400, seasonId: H10_SEASON, targetVersion: GOALIE_TARGET_VERSION, conditioning: GOALIE_CONDITIONING,
      teamId: 17, opponentId: 8, home: true, horizon: 1, scheduleRevision: "s", affiliationRevision: "a", sourceGameDate: "2026-11-24", scheduledStartAt: "2026-11-25T00:00:00.000Z",
      inputCutoffAt: asOf, generatedAt: asOf, means: { SAVES: available(25), SHOTS_AGAINST: available(28), GOALS_ALLOWED: available(3), WIN: available(0.5), SHUTOUT: available(0.05) },
      startProbability: unavailable("start_probability_not_modelled"), modelVersion: "m", featureVersion: "f", codeVersion: "c", cohort: "x",
      sourceManifest: [{ id: "s", revision: "r", sha256: "a".repeat(64), source: "fixture", use: "approved", observedAt: asOf, publishedAt: null, firstReceivedAt: asOf }],
      trigger: "daily", predecessorId: null, evidenceClass: "fixture", limitations: [] } as GoalieVintage;
    expect(() => assertGoalieVintage(v)).not.toThrow();
    expect(() => assertGoalieVintage({ ...v, means: { ...v.means, GOALS_ALLOWED: available(4) } })).toThrow("Saves plus goals allowed");
    expect(() => assertGoalieVintage({ ...v, means: { ...v.means, WIN: available(1.2) } })).toThrow("Invalid goalie value WIN");
  });
});
