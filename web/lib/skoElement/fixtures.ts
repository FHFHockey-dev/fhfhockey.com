/**
 * Unmistakably synthetic fixture bundle for the Sko Element and Buy Low/Sell High previews.
 * Fictional players, teams ("FX1".."FX4") and schedules. Not NHL data, not a FORGE issuance,
 * not advice. Controls switch between these supplied bundles; nothing is fitted or regenerated.
 */
import {
  GOALIE_TARGETS, HORIZON_OPTIONS,
  type ForgeForecastInput, type ForgePlayerExpectation, type HorizonGames, type InterpretationConfig,
  type InterpretationRecord, type ModelClass, type ObservedEvidence, type ObservedTeamGame, type RecentWindowGames,
} from "./contract";
import { interpretPlayer } from "./interpret";

export const FIXTURE_AS_OF = "2026-10-18T15:00:00.000Z";
export const FIXTURE_DISCLAIMER =
  "FIXTURE DATA: synthetic players, teams and schedules. Not NHL data, not a FORGE forecast and not advice.";

export const FIXTURE_CONFIG: InterpretationConfig = {
  configId: "sko-fixture-config",
  version: "0.1.0",
  status: "provisional_fixture",
  recentWindowTeamGames: 10,
  minAppearancesForRate: 5,
  maxEvidenceAgeHours: 96,
  opportunityRule: {
    ruleId: "fixture-opportunity-rule", version: "0.1.0", status: "provisional_fixture",
    minToiChangeMinutes: 1.5, minPpToiChangeMinutes: 1, minAppearancesEachBlock: 3,
  },
  ippReferences: {
    F: { value: 0.65, source: "fixture forward reference (illustrative)", status: "fixture_illustrative" },
    D: { value: 0.35, source: "fixture defense reference (illustrative)", status: "fixture_illustrative" },
  },
};

const SKATER_FORECAST_TARGETS = ["GOALS", "ASSISTS", "POINTS", "PP_POINTS", "SHOTS_ON_GOAL", "HITS", "BLOCKED_SHOTS", "PENALTY_MINUTES", "TIME_ON_ICE_PER_GAME"];
const FORECAST_READ_AS_OF = "2026-10-18T12:00:00.000Z";
const PRIOR_READ_AS_OF = "2026-10-04T12:00:00.000Z";
const FORECAST_EXPIRES_AT = "2026-10-19T12:00:00.000Z";

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type PlayerSpec = { id: string; name: string; team: string; modelClass: ModelClass; positions: string[] };

/** Builds a forge-game-expectations-v1 shaped player view with exact fictional schedules. */
function forecastFor(player: PlayerSpec, horizon: HorizonGames, perGame: Record<string, number>, options: {
  appearanceProbability: number; scheduledRemaining?: number; readAsOf?: string;
}): ForgeForecastInput {
  const goalie = player.modelClass === "G";
  const targets = goalie ? [...GOALIE_TARGETS] : SKATER_FORECAST_TARGETS;
  const count = Math.min(horizon, options.scheduledRemaining ?? 20);
  const p = options.appearanceProbability;
  const games = Array.from({ length: count }, (_, index) => {
    const date = addDays("2026-10-20", index * 2);
    const opponent = player.team === "FX1" ? "FX2" : "FX1";
    return {
      gameId: `${player.team}-2026-${String(index + 1).padStart(3, "0")}`, date, scheduledAt: `${date}T23:00:00.000Z`,
      team: player.team, opponent, homeTeam: index % 2 ? opponent : player.team, awayTeam: index % 2 ? player.team : opponent,
      scheduleRevision: "fixture-schedule-r1", rosterRevision: null,
      appearanceProbability: p, startProbability: goalie ? p : null,
      powerPlayRole: goalie
        ? { value: null, status: "not_applicable" as const, reason: "not_applicable" as const, source: null }
        : { value: null, status: "unavailable" as const, reason: "current_role_evidence_unavailable" as const, source: null },
      limitations: [],
      targets: Object.fromEntries(targets.map(target => {
        const expected = perGame[target] ?? null;
        return [target, {
          expected, conditional: expected === null ? null : expected / p, basis: "unconditional_game",
          unit: target === "GOALIE_MINUTES" || target === "TIME_ON_ICE_PER_GAME" ? "minutes" as const : "count" as const,
          allowedUses: { assignment: false, totals: true, comparison: true, conditionalTieBreak: true },
          sourceKind: "baseline" as const, sourceIds: ["fixture-source"], methodVersions: ["fixture"], sourceWatermarks: ["fixture"],
          cutoffAt: "2026-10-18T08:00:00.000Z", issuedAt: options.readAsOf ?? FORECAST_READ_AS_OF, expiresAt: FORECAST_EXPIRES_AT,
          sources: [], participation: null, participationRevisionId: null,
          reasons: expected === null ? ["missing_target"] : [], limitations: [],
        }];
      })),
    };
  });
  const complete = games.length === horizon;
  const totals: ForgePlayerExpectation["totals"] = Object.fromEntries(targets.map(target => {
    const values = games.flatMap(game => game.targets[target].expected === null ? [] : [game.targets[target].expected as number]);
    const coveredSum = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    return [target, {
      expected: complete && values.length === games.length ? coveredSum : null, coveredSum,
      coveredGames: values.length, requiredGames: games.length, unit: games[0]?.targets[target].unit ?? "count",
      reason: !complete ? "incomplete_horizon" : values.length !== games.length ? "incomplete_target" : null,
    }];
  }));
  const ratios: ForgePlayerExpectation["ratios"] = {};
  if (goalie) {
    const sv = totals.SAVES_GOALIE.expected, sa = totals.SHOTS_AGAINST_GOALIE.expected;
    const ga = totals.GOALS_AGAINST_GOALIE.expected, min = totals.GOALIE_MINUTES.expected;
    ratios.SAVE_PERCENTAGE = { value: sv !== null && sa ? sv / sa : null, numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE",
      interpretation: "ratio_of_expected_totals", reason: sv !== null && sa ? null : "incomplete_primitives" };
    ratios.GOALS_AGAINST_AVERAGE = { value: ga !== null && min ? 60 * ga / min : null, numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES",
      interpretation: "ratio_of_expected_totals", reason: ga !== null && min ? null : "incomplete_primitives" };
  }
  return {
    version: "forge-game-expectations-v1", readAsOf: options.readAsOf ?? FORECAST_READ_AS_OF,
    scope: { seasonId: 20262027, startDate: "2026-10-18", endDate: "2027-04-30", timeZone: "America/New_York", mode: "next_n", games: horizon },
    manifestId: options.readAsOf === PRIOR_READ_AS_OF ? "fixture-manifest-prior" : "fixture-manifest-current",
    baselineChecksum: "fixture-baseline", limitations: ["Fixture forecast: synthetic values, not a FORGE issuance."],
    player: {
      playerId: player.id, nhlPlayerId: null, teamId: null, name: player.name, team: player.team,
      playerClass: goalie ? "goalie" : "skater", positions: player.positions,
      scheduledOpportunities: games.length, requestedGames: horizon, horizonComplete: complete,
      expectedAppearances: complete ? games.length * p : null, expectedStarts: goalie && complete ? games.length * p : null,
      games, totals, ratios,
    },
  };
}

/** Per-game unconditional expectations from points and a few context rates. */
function skaterRates(points: number, extra: { ppp?: number; sog?: number; hit?: number; blk?: number; pim?: number; toi?: number; goalShare?: number }) {
  const goals = points * (extra.goalShare ?? 0.4);
  return {
    GOALS: goals, ASSISTS: points - goals, POINTS: points, PP_POINTS: extra.ppp ?? points * 0.3,
    SHOTS_ON_GOAL: extra.sog ?? 2.2, HITS: extra.hit ?? 1, BLOCKED_SHOTS: extra.blk ?? 0.6,
    PENALTY_MINUTES: extra.pim ?? 0.4, TIME_ON_ICE_PER_GAME: extra.toi ?? 16,
  };
}

type Line = { s?: ObservedTeamGame["status"]; toi: number; pp: number; g: number; a: number; sog?: number; hit?: number; blk?: number; pim?: number; ppp?: number; gf?: number };
const rep = (n: number, line: (index: number) => Line) => Array.from({ length: n }, (_, index) => line(index));

function evidenceFor(player: PlayerSpec, lines: Line[], options: { cutoff?: string; role?: ObservedEvidence["roleEvidence"]; goalie?: boolean } = {}): ObservedEvidence {
  const teamGames = lines.map((line, index): ObservedTeamGame => {
    const date = addDays("2026-09-25", index);
    const status = line.s ?? "appeared";
    const appeared = status === "appeared";
    return {
      gameId: `${player.team}-PRE-${String(index + 1).padStart(3, "0")}`, date, team: player.team, status,
      availableAt: `${addDays(date, 1)}T08:00:00.000Z`,
      toiMinutes: appeared ? line.toi : status === "confirmed_absent" ? 0 : null,
      ppToiMinutes: appeared ? line.pp : status === "confirmed_absent" ? 0 : null,
      stats: appeared && !options.goalie ? {
        GOALS: line.g, ASSISTS: line.a, POINTS: line.g + line.a, PP_POINTS: line.ppp ?? 0, SHOTS_ON_GOAL: line.sog ?? 2,
        HITS: line.hit ?? 1, BLOCKED_SHOTS: line.blk ?? 1, PENALTY_MINUTES: line.pim ?? 0,
      } : {},
      onIceGoalsFor: appeared && !options.goalie ? line.gf ?? line.g + line.a + 1 : null,
      ...(options.goalie && appeared ? { goalie: { saves: line.sog ?? 27, shotsAgainst: (line.sog ?? 27) + line.g, goalsAgainst: line.g, minutes: line.toi } } : {}),
    };
  });
  return {
    evidenceSnapshotId: `fixture-evidence-${player.id}`, playerId: player.id, modelClass: player.modelClass,
    eligibility: player.positions, strengthScope: "all_situations",
    sourceCutoffAt: options.cutoff ?? "2026-10-15T08:00:00.000Z", capturedAt: options.cutoff ?? "2026-10-15T08:00:00.000Z",
    retrospective: false, teamGames, roleEvidence: options.role,
  };
}

export type FixturePlayer = {
  key: string;
  scenario: string;
  evidence: ObservedEvidence;
  forecasts: Record<HorizonGames, ForgeForecastInput>;
  priorForecasts?: Record<HorizonGames, ForgeForecastInput>;
};

function byHorizon(build: (horizon: HorizonGames) => ForgeForecastInput) {
  return Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, build(horizon)])) as Record<HorizonGames, ForgeForecastInput>;
}

function skater(key: string, scenario: string, spec: PlayerSpec, lines: Line[], points: number, options: {
  extra?: Parameters<typeof skaterRates>[1]; p?: number; priorPoints?: number; scheduledRemaining?: number;
  cutoff?: string; role?: ObservedEvidence["roleEvidence"]; mutate?: (evidence: ObservedEvidence) => void;
} = {}): FixturePlayer {
  const evidence = evidenceFor(spec, lines, { cutoff: options.cutoff, role: options.role });
  options.mutate?.(evidence);
  const forecast = (horizon: HorizonGames, value: number, readAsOf?: string) => forecastFor(spec, horizon, skaterRates(value, options.extra ?? {}),
    { appearanceProbability: options.p ?? 0.95, scheduledRemaining: options.scheduledRemaining, readAsOf });
  return {
    key, scenario, evidence, forecasts: byHorizon(horizon => forecast(horizon, points)),
    ...(options.priorPoints !== undefined ? { priorForecasts: byHorizon(horizon => forecast(horizon, options.priorPoints!, PRIOR_READ_AS_OF)) } : {}),
  };
}

const alt = (index: number, a: number, b: number) => (index % 2 ? b : a);
const every = (index: number, n: number, value = 1) => (index % n === 0 ? value : 0);

export const FIXTURE_PLAYERS: FixturePlayer[] = [
  skater("f1", "Durable promotion: sourced PP1 role, recent run slightly above a raised expectation",
    { id: "fx-f1", name: "Fixture Forward One", team: "FX1", modelClass: "F", positions: ["C"] },
    [...rep(10, i => ({ toi: 13, pp: 0.5, g: every(i, 5), a: every(i, 4) })), ...rep(10, i => ({ toi: 18, pp: 3.2, g: every(i, 3), a: alt(i, 1, 0), ppp: every(i, 3) }))],
    0.75, { priorPoints: 0.45, extra: { toi: 17.5, ppp: 0.3 },
      role: [{ kind: "pp_unit", label: "PP1 (fixture lineup report)", effectiveAt: "2026-10-05T16:00:00.000Z", source: "fixture lineup source" }] }),
  skater("f2", "Temporary promotion: covering for an injured teammate; reversal scenario not supplied",
    { id: "fx-f2", name: "Fixture Forward Two", team: "FX2", modelClass: "F", positions: ["LW"] },
    [...rep(10, i => ({ toi: 12.5, pp: 0.3, g: every(i, 6), a: every(i, 5) })), ...rep(10, i => ({ toi: 17, pp: 2.5, g: every(i, 4), a: every(i, 2) }))],
    0.6, { priorPoints: 0.35, role: [{ kind: "injury_replacement", label: "Covering for injured fixture teammate", effectiveAt: "2026-10-05T16:00:00.000Z", source: "fixture injury note" }] }),
  skater("f3", "Demotion: minutes fell and production went cold; short schedule leaves only 14 games",
    { id: "fx-f3", name: "Fixture Forward Three", team: "FX3", modelClass: "F", positions: ["RW"] },
    [...rep(10, i => ({ toi: 17.5, pp: 2.8, g: every(i, 3), a: every(i, 2) })), ...rep(10, i => ({ toi: 12, pp: 0.2, g: 0, a: every(i, 5) }))],
    0.42, { priorPoints: 0.6, scheduledRemaining: 14 }),
  skater("f4", "Role switching: alternating top-six and bottom-six minutes in both blocks",
    { id: "fx-f4", name: "Fixture Forward Four", team: "FX1", modelClass: "F", positions: ["C", "LW"] },
    [...rep(10, i => ({ toi: alt(i, 18, 12), pp: alt(i, 2.5, 0), g: every(i, 4), a: alt(i, 1, 0) })), ...rep(10, i => ({ toi: alt(i, 12, 18.5), pp: alt(i, 0, 2.6), g: every(i, 3), a: alt(i, 0, 1) }))],
    0.5),
  skater("f5", "Finishing heater with a stable role: production well above expectation at unchanged minutes",
    { id: "fx-f5", name: "Fixture Forward Five", team: "FX2", modelClass: "F", positions: ["RW"] },
    [...rep(10, i => ({ toi: 16, pp: 2, g: every(i, 4), a: every(i, 3) })), ...rep(10, i => ({ toi: 16.2, pp: 2, g: alt(i, 1, 0) + every(i, 5), a: every(i, 2), sog: 3 }))],
    0.65, { priorPoints: 0.62 }),
  skater("f6", "Stable low production: level gap, low expected output (not a quality signal)",
    { id: "fx-f6", name: "Fixture Forward Six", team: "FX3", modelClass: "F", positions: ["LW"] },
    [...rep(10, i => ({ toi: 10.5, pp: 0, g: 0, a: every(i, 10), hit: 3 })), ...rep(10, i => ({ toi: 10.8, pp: 0, g: 0, a: every(i, 10), hit: 3 }))],
    0.1, { extra: { hit: 2.8, toi: 10.6, ppp: 0 } }),
  skater("f7", "Matched IPP (forward): same observed IPP as Fixture Defense One",
    { id: "fx-f7", name: "Fixture Forward Seven", team: "FX4", modelClass: "F", positions: ["C"] },
    [...rep(10, () => ({ toi: 15, pp: 1.5, g: 0, a: 0 })), ...rep(10, i => ({ toi: 15, pp: 1.5, g: every(i, 4), a: every(i, 3) }))],
    0.5),
  skater("d1", "Matched IPP (defense): same observed IPP, different class reference",
    { id: "fx-d1", name: "Fixture Defense One", team: "FX4", modelClass: "D", positions: ["D"] },
    [...rep(10, () => ({ toi: 21, pp: 1, g: 0, a: 0, blk: 2 })), ...rep(10, i => ({ toi: 21, pp: 1, g: 0, a: every(i, 4) + every(i, 3), blk: 2 }))],
    0.4, { extra: { blk: 1.8, toi: 21, goalShare: 0.2 } }),
  skater("d2", "Sparse sample: two appearances in the recent window, eight confirmed absences",
    { id: "fx-d2", name: "Fixture Defense Two", team: "FX1", modelClass: "D", positions: ["D"] },
    [...rep(10, i => ({ toi: 19, pp: 0.5, g: 0, a: every(i, 4) })), ...rep(10, i => (i < 8 ? { s: "confirmed_absent", toi: 0, pp: 0, g: 0, a: 0 } : { toi: 18, pp: 0.5, g: 1, a: 0 }))],
    0.25, { p: 0.85 }),
  skater("f8", "Partial participation: two recent team games have unknown participation",
    { id: "fx-f8", name: "Fixture Forward Eight", team: "FX2", modelClass: "F", positions: ["C"] },
    [...rep(10, i => ({ toi: 15, pp: 1, g: every(i, 3), a: every(i, 4) })), ...rep(10, i => (i === 3 || i === 7 ? { s: "unknown", toi: 0, pp: 0, g: 0, a: 0 } : { toi: 15, pp: 1, g: every(i, 3), a: every(i, 2) }))],
    0.5),
  skater("d3", "Stale evidence: observed source last updated 8 days before as-of",
    { id: "fx-d3", name: "Fixture Defense Three", team: "FX3", modelClass: "D", positions: ["D"] },
    [...rep(10, i => ({ toi: 20, pp: 2, g: 0, a: every(i, 2) })), ...rep(10, i => ({ toi: 20, pp: 2, g: 0, a: every(i, 2) }))],
    0.45, { cutoff: "2026-10-10T08:00:00.000Z" }),
  skater("f9", "Conflicting source rows: one game delivered twice with different goal counts",
    { id: "fx-f9", name: "Fixture Forward Nine", team: "FX4", modelClass: "F", positions: ["RW"] },
    [...rep(10, i => ({ toi: 14, pp: 1, g: every(i, 4), a: every(i, 3) })), ...rep(10, i => ({ toi: 14, pp: 1, g: every(i, 4), a: every(i, 3) }))],
    0.45, { mutate: evidence => {
      const last = evidence.teamGames.at(-1)!;
      evidence.teamGames.push({ ...last, availableAt: "2026-10-15T07:00:00.000Z", stats: { ...last.stats, GOALS: 2, POINTS: 2 } });
    } }),
];

const goalieSpec: PlayerSpec = { id: "fx-g1", name: "Fixture Goalie One", team: "FX2", modelClass: "G", positions: ["G"] };
FIXTURE_PLAYERS.push({
  key: "g1", scenario: "VuDu context: observed ratio primitives and FORGE ratio-of-expected-totals; gap pending the goalie adapter",
  evidence: evidenceFor(goalieSpec, [
    ...rep(10, i => (i % 3 === 2 ? { s: "confirmed_absent", toi: 0, pp: 0, g: 0, a: 0 } : { toi: 60, pp: 0, g: alt(i, 2, 3), a: 0, sog: 28 })),
    ...rep(10, i => (i % 3 === 2 ? { s: "confirmed_absent", toi: 0, pp: 0, g: 0, a: 0 } : { toi: 60, pp: 0, g: alt(i, 1, 2), a: 0, sog: 30 })),
  ], { goalie: true }),
  forecasts: byHorizon(horizon => forecastFor(goalieSpec, horizon, {
    SAVES_GOALIE: 18.2, SHOTS_AGAINST_GOALIE: 19.6, GOALS_AGAINST_GOALIE: 1.4, GOALIE_MINUTES: 39.6, WINS_GOALIE: 0.36, SHUTOUTS_GOALIE: 0.03,
  }, { appearanceProbability: 0.66 })),
});

/** Interpret every fixture player for one horizon and recent window. */
export function fixtureRecords(horizon: HorizonGames, recentWindow: RecentWindowGames = FIXTURE_CONFIG.recentWindowTeamGames): InterpretationRecord[] {
  const config = { ...FIXTURE_CONFIG, recentWindowTeamGames: recentWindow };
  return FIXTURE_PLAYERS.map(player => interpretPlayer({
    evidence: player.evidence, forecast: player.forecasts[horizon], priorForecast: player.priorForecasts?.[horizon],
    config, asOf: FIXTURE_AS_OF, horizon, fixture: true,
  }));
}
