import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V4_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  reconcileProjectionValues,
} from "./contracts";
import {
  aggregateSeasonGames,
  evaluatePortableSeasonGame,
  mergeAdvancedSeasonArtifact,
  normalQuantile,
  participationMixtureQuantile,
  type AdvancedSeasonArtifact,
  type PortablePlayerPrior,
  type PortableSeasonArtifact,
  type SeasonGameContext,
} from "./evaluator";
import {
  aggregateExpectations,
  buildRuntimeNewcomerPrior,
  nhlScheduleDay,
  teamDeployment,
} from "./seasonJobs";

const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "season-evaluator-parity-v2.json");

type ParityFixture = {
  description: string;
  artifact: PortableSeasonArtifact;
  cases: Array<{ fhfhPlayerId: number; game: SeasonGameContext; expected?: unknown }>;
  aggregates: Array<{
    fhfhPlayerId: number;
    gameIds: number[];
    actuals: Record<string, number>;
    expected?: unknown;
  }>;
};

function loadFixture(): ParityFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as ParityFixture;
}

const fixture = loadFixture();
const artifact = fixture.artifact;

function evaluate(playerId: number, gameId: number) {
  const testCase = fixture.cases.find(
    (entry) => entry.fhfhPlayerId === playerId && entry.game.gameId === gameId,
  );
  if (!testCase) throw new Error(`fixture case ${playerId}:${gameId} missing`);
  return evaluatePortableSeasonGame(artifact, playerId, testCase.game);
}

describe("season evaluator v2 golden vectors (TS/Python parity fixture)", () => {
  it("matches the stored golden vectors that the Python twin also reproduces", () => {
    const evaluations = fixture.cases.map((entry) =>
      evaluatePortableSeasonGame(artifact, entry.fhfhPlayerId, entry.game),
    );
    const aggregates = fixture.aggregates.map((entry) =>
      aggregateSeasonGames(
        entry.gameIds.map((gameId) => evaluate(entry.fhfhPlayerId, gameId)),
        { actuals: entry.actuals },
      ),
    );
    if (process.env.WRITE_SEASON_PARITY === "1") {
      const next: ParityFixture = {
        ...fixture,
        cases: fixture.cases.map((entry, index) => ({ ...entry, expected: evaluations[index] })),
        aggregates: fixture.aggregates.map((entry, index) => ({
          ...entry,
          expected: aggregates[index],
        })),
      };
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(next, null, 1)}\n`);
      return;
    }
    expect(evaluations).toEqual(fixture.cases.map((entry) => entry.expected));
    expect(aggregates).toEqual(fixture.aggregates.map((entry) => entry.expected));
  });
});

describe("goalie outcome treatment (W3-5 F1, decision 121)", () => {
  it("keeps complementary .5 wins at .5 under pace 1.2 and a home win effect", () => {
    const first = evaluate(20, 2026020001);
    const second = evaluate(21, 2026020001);
    for (const evaluation of [first, second]) {
      expect(evaluation.conditionalMeans.WINS_GOALIE).toBe(0.5);
      expect(evaluation.conditionalMeans.LOSSES_GOALIE).toBe(0.3);
      expect(evaluation.conditionalMeans.OTL_GOALIE).toBe(0.2);
      expect(evaluation.outcomeTreatment).toBe(
        "goalie-outcomes-prior-rate-no-game-context-v1",
      );
    }
    // Two complementary goalies, each appearing in half the games, share one
    // team decision: their unconditional wins add to .5, not 1.2 × .5.
    expect(first.unconditionalMeans.WINS_GOALIE + second.unconditionalMeans.WINS_GOALIE).toBe(0.5);
    // W + L + OTL per appearance stays exactly 1 (no-decision mass 0 here).
    const conditional = first.conditionalMeans;
    expect(conditional.WINS_GOALIE + conditional.LOSSES_GOALIE + conditional.OTL_GOALIE).toBeCloseTo(1, 12);
    // Shots/goals against still carry pace and opponent offense.
    expect(first.conditionalMeans.SHOTS_AGAINST_GOALIE).toBeCloseTo(28 * 1.2 * 1.05, 9);
  });

  it("reconciles incoherent heads to appearances and starts with telemetry (W2-8 D12, PR9)", () => {
    const evaluation = evaluate(30, 2026020001);
    const means = evaluation.unconditionalMeans;
    expect(means.GOALS_AGAINST_GOALIE).toBeLessThanOrEqual(means.SHOTS_AGAINST_GOALIE);
    expect(means.SHOTS_AGAINST_GOALIE).toBeCloseTo(
      means.SAVES_GOALIE + means.GOALS_AGAINST_GOALIE,
      9,
    );
    expect(means.WINS_GOALIE + means.LOSSES_GOALIE + means.OTL_GOALIE).toBeCloseTo(
      means.GAMES_PLAYED,
      9,
    );
    expect(means.SHUTOUTS_GOALIE).toBeLessThanOrEqual(means.GAMES_STARTED);
    expect(means.QUALITY_STARTS_GOALIE).toBeLessThanOrEqual(means.GAMES_STARTED);
    expect(new Set(evaluation.reconciliationClamps.map((clamp) => clamp.rule))).toEqual(
      new Set([
        "goals_against_capped_at_shots_against",
        "decisions_scaled_to_appearances",
        "shutouts_capped_at_starts",
        "quality_starts_capped_at_starts",
      ]),
    );
  });
});

describe("explicit moments (W3-5 F2/F3, W2-8 PR8)", () => {
  it("gives GP and GS Bernoulli variances p(1 − p)", () => {
    const goalie = evaluate(20, 2026020001);
    expect(goalie.variances.GAMES_PLAYED).toBeCloseTo(0.5 * 0.5, 12);
    expect(goalie.variances.GAMES_STARTED).toBeCloseTo(0.45 * 0.55, 12);
    const skater = evaluate(10, 2026020001);
    expect(skater.variances.GAMES_PLAYED).toBeCloseTo(0.8 * 0.2, 12);
  });

  it("applies the multiplier once in the missing-variance fallback and flags it", () => {
    const skater = evaluate(10, 2026020001);
    // SOG: pace sqrt(1.2 × 1.2) = 1.2, opponent defense 1, no context effect.
    const conditionalMean = 3.1 * 1.2;
    expect(skater.conditionalMeans.SHOTS_ON_GOAL).toBeCloseTo(conditionalMean, 9);
    const p = 0.8;
    expect(skater.variances.SHOTS_ON_GOAL).toBeCloseTo(
      p * conditionalMean + p * (1 - p) * conditionalMean ** 2,
      9,
    );
    expect(skater.momentFlags).toContain("variance_poisson_fallback:SHOTS_ON_GOAL");
  });

  it("keeps a declared target with no rate unknown instead of 0", () => {
    const skater = evaluate(10, 2026020001);
    expect(skater.missingTargets).toEqual(["TAKEAWAYS"]);
    expect("TAKEAWAYS" in skater.unconditionalMeans).toBe(false);
    expect("TAKEAWAYS" in skater.variances).toBe(false);
    const aggregate = aggregateSeasonGames([skater, evaluate(10, 2026020002)]);
    expect(aggregate.missingTargets).toContain("TAKEAWAYS");
    expect("TAKEAWAYS" in aggregate.means).toBe(false);
  });

  it("reports an EV head replaced by total minus components (W3-5 F5)", () => {
    const skater = evaluate(10, 2026020001);
    const evClamp = skater.reconciliationClamps.find(
      (clamp) => clamp.target === "EV_GOALS" && clamp.rule === "ev_derived_from_total",
    );
    expect(evClamp).toBeDefined();
    const means = skater.unconditionalMeans;
    expect(means.EV_GOALS).toBeCloseTo(
      means.GOALS - means.PP_GOALS - means.SH_GOALS - means.EMPTY_NET_GOALS,
      9,
    );
  });
});

describe("undefined ratios stay unknown (W2-8 D11, BC W1-8 A)", () => {
  it("emits no SV%, GAA or win% for an empty goalie line", () => {
    const empty = reconcileProjectionValues({}, "goalie");
    for (const key of [
      "SAVES_GOALIE",
      "SAVE_PERCENTAGE",
      "GOALS_AGAINST_AVERAGE",
      "WIN_PERCENTAGE_GOALIE",
      "START_PERCENTAGE_GOALIE",
    ]) {
      expect(key in empty).toBe(false);
    }
    const skater = reconcileProjectionValues({ GOALS: 0, SHOTS_ON_GOAL: 0, GAMES_PLAYED: 0 }, "forward");
    expect("SHOOTING_PERCENTAGE" in skater).toBe(false);
    expect("POINTS_PER_GAME" in skater).toBe(false);
    expect("POINTS" in skater).toBe(false); // assists unknown, so points unknown
  });
});

describe("participation atom (C17)", () => {
  it("matches the analytic mixture quantile", () => {
    // 20% non-participation atom at 0, conditional N(2, 1).
    expect(participationMixtureQuantile(0.1, 0.8, 2, 1, false)).toBe(0);
    expect(participationMixtureQuantile(0.9, 0.8, 2, 1, false)).toBeCloseTo(
      2 + normalQuantile(0.875),
      12,
    );
    expect(normalQuantile(0.875)).toBeCloseTo(1.1503493803760083, 8);
    // Bernoulli GP: P(play) .8 → p10 0, p50 1, p90 1.
    expect(participationMixtureQuantile(0.1, 0.8, 1, 0, false)).toBe(0);
    expect(participationMixtureQuantile(0.5, 0.8, 1, 0, false)).toBe(1);
  });

  it("puts p10 at 0 when non-participation mass is at least 10%", () => {
    const skater = evaluate(10, 2026020001);
    expect(skater.quantiles.p10.GOALS).toBe(0);
    expect(skater.quantiles.p10.GAMES_PLAYED).toBe(0);
    expect(skater.quantiles.p50.GAMES_PLAYED).toBe(1);
    // Full participation keeps mean ± z·sd for a normal conditional.
    const full = evaluate(11, 2026020001);
    const mean = full.unconditionalMeans.TOTAL_TOI;
    const sd = Math.sqrt(full.variances.TOTAL_TOI);
    expect(full.quantiles.p90.TOTAL_TOI).toBeCloseTo(mean + 1.2815515655446004 * sd, 6);
  });
});

describe("joint season aggregate with actuals (W3-5 F4/PR1, rule 26)", () => {
  it("forms saves per draw instead of SA-low minus GA-high", () => {
    const goalieAggregate = aggregateSeasonGames(
      [evaluate(20, 2026020001), evaluate(20, 2026020002)],
      { actuals: fixture.aggregates[2].actuals },
    );
    const { p10, p90 } = goalieAggregate.quantiles;
    expect(p10.SAVES_GOALIE).toBeGreaterThan(p10.SHOTS_AGAINST_GOALIE - p90.GOALS_AGAINST_GOALIE);
    expect(p10.GAMES_PLAYED).toBeGreaterThanOrEqual(4);
    expect(goalieAggregate.means.SHOTS_AGAINST_GOALIE).toBeCloseTo(
      110 + evaluate(20, 2026020001).unconditionalMeans.SHOTS_AGAINST_GOALIE +
        evaluate(20, 2026020002).unconditionalMeans.SHOTS_AGAINST_GOALIE,
      9,
    );
    expect(goalieAggregate.dependence).toEqual({
      crossGame: "independent_games_assumption",
      withinGameTargets: "one_factor_gaussian",
      factorLoading: 0.65,
      primitiveCorrelation: 0.4225,
    });
  });

  it("adds actual points once to the joint POINTS distribution", () => {
    const games = [evaluate(10, 2026020001), evaluate(10, 2026020002)];
    const withActuals = aggregateSeasonGames(games, { actuals: fixture.aggregates[0].actuals });
    const without = aggregateSeasonGames(games);
    expect(withActuals.means.POINTS).toBeCloseTo(without.means.POINTS + 6, 9);
    // Same draws, constant offset: each joint quantile shifts by exactly 6.
    expect(withActuals.quantiles.p50.POINTS).toBeCloseTo(without.quantiles.p50.POINTS + 6, 9);
    expect(withActuals.quantiles.p10.POINTS).toBeCloseTo(without.quantiles.p10.POINTS + 6, 9);
  });
});

describe("unknown actuals (W2-7 D9)", () => {
  it("makes the season total unknown instead of adding 0", () => {
    const aggregate = aggregateSeasonGames([evaluate(11, 2026020001)], {
      actuals: { GOALS: null, SHOTS_ON_GOAL: 5 },
    });
    expect(aggregate.missingTargets).toContain("GOALS");
    expect("GOALS" in aggregate.means).toBe(false);
    expect("POINTS" in aggregate.means).toBe(false);
    expect(aggregate.means.SHOTS_ON_GOAL).toBeCloseTo(
      5 + evaluate(11, 2026020001).unconditionalMeans.SHOTS_ON_GOAL,
      9,
    );
  });
});

describe("advanced v5 merge moments (W3-5 PR2, C17)", () => {
  const base: PortableSeasonArtifact = {
    ...artifact,
    contractVersion: FANTASY_PROJECTION_V4_CONTRACT_VERSION,
    contractChecksum: FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
    players: { "10": { ...artifact.players["10"], primitiveTargets: undefined } },
  };
  const advanced: AdvancedSeasonArtifact = {
    schemaVersion: "player-forecast-season-advanced-artifact-v1",
    seasonId: 20262027,
    contractVersion: FANTASY_PROJECTION_V5_CONTRACT_VERSION,
    contractChecksum: FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
    artifactVersion: "l15-advanced",
    featureSchemaVersion: "l15-advanced",
    trainingCutoffAt: "2026-08-31T23:59:59Z",
    codeVersion: "l15-advanced",
    baseV4ArtifactChecksum: "unused",
    players: { "10": { fhfhPlayerId: 10, population: "forward", rates: { SHOT_ATTEMPTS: 4 } } },
    teams: {},
    targetPolicies: {
      forward: {
        SHOT_ATTEMPTS: { baselineRate: 3, residual80PerGame: 2 },
        EXPECTED_GOALS: { fallback: true },
      },
    },
  };
  const merged = mergeAdvancedSeasonArtifact(base, advanced);
  const game = fixture.cases[0].game;
  const evaluation = evaluatePortableSeasonGame(merged, 10, game);

  it("gives expected-assist aliases exactly their source moments", () => {
    for (const [alias, source] of [
      ["EXPECTED_PRIMARY_ASSISTS", "PRIMARY_ASSISTS"],
      ["EXPECTED_SECONDARY_ASSISTS", "SECONDARY_ASSISTS"],
    ] as const) {
      expect(evaluation.conditionalMeans[alias]).toBe(evaluation.conditionalMeans[source]);
      expect(evaluation.unconditionalMeans[alias]).toBe(evaluation.unconditionalMeans[source]);
      expect(evaluation.variances[alias]).toBe(evaluation.variances[source]);
    }
  });

  it("converts the 80% absolute residual to a variance with z(0.9)", () => {
    const p = 0.8;
    const conditionalVariance = Math.max(4, (2 / 1.2815515655446004) ** 2);
    expect(evaluation.variances.SHOT_ATTEMPTS).toBeCloseTo(
      p * conditionalVariance + p * (1 - p) * 16,
      9,
    );
  });

  it("leaves an advanced target with no rate and no baseline unknown", () => {
    expect(evaluation.missingTargets).toContain("EXPECTED_GOALS");
    expect("EXPECTED_GOALS" in evaluation.unconditionalMeans).toBe(false);
    expect(merged.players["10"].fallbackFlags).toContain(
      "advanced_v5_expected_goals_fallback",
    );
  });
});

describe("season page labels (decisions 122, 123)", () => {
  const forward = (id: number, toi: number, play: number): PortablePlayerPrior => ({
    fhfhPlayerId: id,
    population: "forward",
    position: "C",
    teamId: 1,
    playProbability: play,
    conditionalRates: { TOTAL_TOI: toi },
    conditionalVariances: {},
    ratings: {},
    deployment: {},
  });

  it("orders by expected ice time with id ties and withholds PP/PK units", () => {
    const players = [forward(3, 1000, 1), forward(1, 1300, 0), forward(2, 1000, 1)];
    const deployment = teamDeployment(players);
    expect(deployment.basis).toBe("projected_ice_time_order");
    expect((deployment.forwardLines as number[][])[0]).toEqual([2, 3, 1]);
    expect(teamDeployment([...players].reverse()).forwardLines).toEqual(deployment.forwardLines);
    expect(deployment.powerPlayUnits).toBeNull();
    expect(deployment.penaltyKillUnits).toBeNull();
  });

  it("labels the newcomer line a population prior with no role odds", () => {
    const cohortArtifact: PortableSeasonArtifact = {
      ...artifact,
      players: {
        "1": { ...forward(1, 900, 0.5), poolStatus: "active_prospect", conditionalRates: { TOTAL_TOI: 900, SH_GOALS: 0.01 } },
        "2": { ...forward(2, 800, 0.4), poolStatus: "active_prospect", conditionalRates: { TOTAL_TOI: 800, SH_GOALS: 0.02 } },
      },
    };
    cohortArtifact.players["1"].primitiveTargets = ["TOTAL_TOI", "SH_GOALS", "TAKEAWAYS"];
    const prior = buildRuntimeNewcomerPrior({
      artifact: cohortArtifact,
      fhfhPlayerId: 99,
      playerName: "New Skater",
      position: "C",
      teamId: 1,
      poolStatus: "active_prospect",
      rosterStatus: "active_nhl",
      rosterConfidence: 1,
    });
    expect(prior.rookieProfile?.priorLabel).toBe("population prior");
    expect(prior.fallbackFlags).toContain("population_prior");
    expect(prior.deployment.roleProbabilities).toBeUndefined();
    expect(prior.deployment.mostLikelyRole).toBeUndefined();
    expect("TAKEAWAYS" in prior.conditionalRates).toBe(false);
  });
});

describe("rest days use the NHL schedule date (W2-7 D4b, rule 19)", () => {
  it("dates a late Pacific puck drop on its Eastern schedule day, not the UTC day", () => {
    const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;
    // 7:30 pm PT on Oct 9 is 02:30Z on Oct 10.
    expect(nhlScheduleDay({ scheduled_start_at: "2026-10-10T02:30:00Z" })).toBe(day("2026-10-09"));
    expect(nhlScheduleDay({ scheduled_start_at: "2026-10-10T23:00:00Z" })).toBe(day("2026-10-10"));
    // Schedule's own date wins when present.
    expect(nhlScheduleDay({ game_date: "2026-10-09", scheduled_start_at: "2026-10-10T04:00:00Z" })).toBe(day("2026-10-09"));
  });
});

describe("aggregate expectations keep unknown means null (rule 5)", () => {
  it("writes null expected games/starts when the season GP/GS total is unknown", () => {
    const goalieGames = [evaluate(20, 2026020001), evaluate(20, 2026020002)];
    const unknown = aggregateSeasonGames(goalieGames, {
      actuals: { GAMES_PLAYED: null, GAMES_STARTED: null },
    });
    expect("GAMES_PLAYED" in unknown.means).toBe(false);
    const row = aggregateExpectations(unknown.means, "goalie");
    // Before: means.GAMES_PLAYED ?? 0 and means.GAMES_STARTED ?? 0.
    expect(row.expected_games).toBeNull();
    expect(row.expected_starts).toBeNull();
    const known = aggregateExpectations(aggregateSeasonGames(goalieGames).means, "goalie");
    expect(known.expected_games).toBeCloseTo(1, 9);
    expect(known.expected_starts).toBeCloseTo(0.9, 9);
    expect(aggregateExpectations({ GAMES_PLAYED: 3 }, "forward").expected_starts).toBeNull();
  });
});
