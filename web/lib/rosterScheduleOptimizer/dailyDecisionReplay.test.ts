// @vitest-environment node
// Offline replay of one fixed matchup week through forecast admission, roster
// planning, goalie-minimum coverage and candidate ranking. Every input is a
// synthetic fixture; nothing reads Supabase, Yahoo or the network.
import { describe, expect, it } from "vitest";
import { parseYahooBoardSettings } from "lib/integrations/yahoo/liveDraft";
import { publicPlanningForecasts } from "lib/projections/consumerRevisionAdmission";
import { buildSkaterModeledHeadTotals } from "lib/projections/modeledHeadTotals";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "lib/projections/calibrationEligibility";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "lib/projections/issuedContext";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { normalizePlanningGames } from "lib/rosterScheduleData/planningInputs";
import { candidatePlanMetrics, candidatePlanForSort } from "./candidatePlanMetrics";
import { candidateHorizonPoints, evaluatePlan } from "./planning";
import { nextLocalMidnight, zonedMidnight } from "./planningDates";
import type { ForecastDiscoveryExclusion, GameForecast, PlanIntent, PlanningGame, PlanningPlayer, PlanningSnapshot } from "./planningTypes";

// --- Fixture: issued FORGE goalie revision (same shape as rosterScheduleData/planning.test.ts) ---
const SEASON = 20262027;
const GOALIE_GAME = 2026020001;
const GOALIE_START = "2026-10-10T23:00:00Z";
const membershipCreatedAt = ["2026-09-01T00:00:00Z"];
const goalieRosterRevision = forgeRosterRevision({ canonicalId: 7, nhlId: 847001, seasonId: SEASON, teamId: 1, membershipCreatedAt });
const scheduleRows = [{ id: 1, source_game_id: GOALIE_GAME, source_season_id: SEASON, game_date: "2026-10-10", start_time: GOALIE_START,
  team_abbreviation: "TOR", opponent_abbreviation: "MTL", home_away: "home", game_status: "FUT", schedule_status: "OK", is_countable: true, game_type: 2 }];
const shift = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 3600000).toISOString();

function goalieRevision(publishedAt: string, startingProbability: number): ForgeGameRevision {
  const observedAt = shift(publishedAt, -1);
  const scheduleRow = (teamId: number, team: string, opponent: string, opponentTeamId: number) => ({
    gameKey: "nhl", season: "2026", sourceSeasonId: SEASON, teamId, opponentTeamId, teamAbbreviation: team, opponentAbbreviation: opponent,
    startTime: GOALIE_START, gameStatus: "FUT", scheduleStatus: "OK", sourceUpdatedAt: null, fetchedAt: observedAt,
    revision: forgeScheduleRevision({ source_game_id: GOALIE_GAME, start_time: GOALIE_START, team_abbreviation: team,
      opponent_abbreviation: opponent, game_status: "FUT", schedule_status: "OK" }) });
  const issuedContext: ForgeIssuedContextV1 = { version: "forge-issued-context-v1",
    game: { id: GOALIE_GAME, date: "2026-10-10", seasonId: SEASON, startTime: GOALIE_START, homeTeamId: 1, awayTeamId: 2 },
    schedule: [scheduleRow(1, "TOR", "MTL", 2), scheduleRow(2, "MTL", "TOR", 1)],
    roster: [{ canonicalId: 7, nhlId: 847001, seasonId: SEASON, teamId: 1, membershipCreatedAt,
      identityUpdatedAt: membershipCreatedAt[0], revision: goalieRosterRevision }], observedAt };
  return { id: `issued-${publishedAt}`, run_id: "run-1", game_id: GOALIE_GAME, decision_as_of: publishedAt, published_at: publishedAt,
    payload: { players: [], teams: [], codeVersion: "v1",
      goalies: [{ game_id: GOALIE_GAME, team_id: 1, horizon_games: 1, as_of_date: "2026-10-10", run_id: "run-1",
        uncertainty: { daily_board_candidates: [{ playerId: 847001, startingProbability, conditional: { SAVES_GOALIE: 30 } }] } }],
      inputProvenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
        capturedReads: { version: "forge-captured-reads-v1", hash: "a".repeat(64), readCount: 2,
          firstReceivedAt: observedAt, lastReceivedAt: shift(observedAt, 1 / 60) },
        issuedContexts: [issuedContext] } as ForgeGameRevision["payload"]["inputProvenance"] } };
}

// --- Fixture: league, matchup week, rosters, schedule ---
// Yahoo week 2 runs Monday 2026-10-05 through Sunday 2026-10-11 (Yahoo's end_date is inclusive).
const YAHOO_WEEK = { week: 2, start_date: "2026-10-05", end_date: "2026-10-11" };
const TZ = "UTC";
// Same derivations as loadYahooPlanningSnapshot: both period ends are exclusive.
const ACQUISITION_END = nextLocalMidnight(YAHOO_WEEK.end_date, TZ);
const GOALIE_PERIOD_END = new Date(Date.parse(`${YAHOO_WEEK.end_date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const skater = (id: string, team: string, availability: PlanningPlayer["availability"]): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`, name: id, teamAbbreviation: team,
  eligiblePositions: ["C"], playerClass: "skater", availability, eligibilityVerified: true, ownership: null, canDrop: true,
  holdValue: null, reserveEligibility: [] });
const goalie = (id: string, team: string, availability: PlanningPlayer["availability"]): PlanningPlayer => ({
  ...skater(id, team, availability), eligiblePositions: ["G"], playerClass: "goalie" });
const game = (team: string, date: string, hour = 20): PlanningGame => ({ id: `${team}-${date}`, scheduleRevision: `schedule-${team}-${date}`,
  date, startsAt: `${date}T${hour}:00:00Z`, teamAbbreviation: team, opponent: "OPP", home: true, status: "scheduled" });

const intent: PlanIntent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk",
  goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };

function issuedForecast(data: PlanningSnapshot, playerId: string, gameId: string, stats: GameForecast["stats"], issuedAt: string): GameForecast {
  const member = data.players.find(row => row.id === playerId)!;
  const match = data.games.find(row => row.id === gameId)!;
  // consumerRevisionAdmission expiry: the earlier of publication + 36 h and game start.
  const expiresAt = new Date(Math.min(Date.parse(issuedAt) + 36 * 3600000, Date.parse(match.startsAt!))).toISOString();
  return { playerId, gameId, stats, conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: "fixture-inputs",
    cutoffAt: issuedAt, issuedAt, expiresAt, modelVersion: "fixture-v1", revisionId: `r-${playerId}-${gameId}`,
    issuedContext: { version: "forge-issued-context-v1", playerId, gameId, nhlPlayerId: member.nhlId!, teamId: member.nhlTeamId!,
      seasonId: SEASON, scheduledAt: match.startsAt!, scheduleRevision: match.scheduleRevision!, rosterRevision: member.rosterRevision!,
      observedAt: issuedAt, scheduleSourceUpdatedAt: issuedAt, scheduleFetchedAt: issuedAt, identityUpdatedAt: issuedAt,
      membershipCreatedAt },
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
    startProbability: null, confirmedStart: false, limitations: [] };
}

const ISSUED = "2026-10-09T20:00:00Z";
const AS_OF = "2026-10-10T12:00:00Z";

/** League and week as the Yahoo loader would build them, with fixed forecasts. */
function replayWeek(yahooSettings: unknown = { min_games_played: "3" }, credited: number | null = 1): PlanningSnapshot {
  const ownGoalie: PlanningPlayer = { ...goalie("7", "TOR", "rostered"), nhlId: 847001, nhlTeamId: 1, rosterRevision: goalieRosterRevision };
  const players = [
    skater("a", "AAA", "rostered"), skater("b", "BBB", "rostered"), ownGoalie,
    skater("x", "XXX", "free_agent"), skater("y", "YYY", "free_agent"), skater("z", "ZZZ", "free_agent"),
    goalie("g2", "GGG", "free_agent"),
  ];
  const games = [
    ...normalizePlanningGames(scheduleRows),
    game("AAA", "2026-10-10"), game("AAA", "2026-10-11"), game("BBB", "2026-10-11"),
    game("XXX", "2026-10-10"), game("XXX", "2026-10-11", 23), game("XXX", "2026-10-12"),
    game("YYY", "2026-10-11"), game("ZZZ", "2026-10-10"), game("ZZZ", "2026-10-11"), game("GGG", "2026-10-11"),
  ];
  const minimum = parseYahooBoardSettings(yahooSettings).minimumGoalieStarts;
  const data: PlanningSnapshot = {
    id: "replay-week-2", context: { provider: "yahoo", seasonId: SEASON, leagueId: "fixture-league", teamId: "fixture-team",
      startDate: "2026-10-10", endDate: YAHOO_WEEK.end_date, timeZone: TZ, asOf: AS_OF },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }, { playerId: "7", position: "active" }],
    games, forecasts: [],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, G: 1, BN: 1 },
      // The Yahoo loader leaves timing unknown; the manager confirms same-day adds here.
      acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: `yahoo-week-${YAHOO_WEEK.week}`, start: zonedMidnight(YAHOO_WEEK.start_date, TZ), end: ACQUISITION_END,
        remaining: 2, source: "provider", timeZone: TZ }],
      scoring: { mode: "points", weights: { GOALS: 1, SAVES_GOALIE: 0.25 }, categories: [] },
      goalieMinimum: { required: minimum, credited, counts: "starts", penalty: "none",
        periodStart: YAHOO_WEEK.start_date, periodEnd: GOALIE_PERIOD_END }, unsupported: [] },
    // Yahoo reports every scoring stat for the week so far; nothing is banked yet.
    lockedAssignments: [], realized: { GOALS: 0, SAVES_GOALIE: 0 }, opponent: null,
    evidence: { schedule: { source: "fixture schedule", asOf: AS_OF, seasonId: SEASON, completeness: "complete", limitations: [] } },
  };
  // The owned goalie's forecast comes through the real admission boundary.
  const admitted = publicPlanningForecasts([goalieRevision("2026-10-10T10:00:00Z", 0.5)], [ownGoalie],
    normalizePlanningGames(scheduleRows), new Date(AS_OF));
  const goals: Array<[string, string, number]> = [
    ["a", "AAA-2026-10-10", 1], ["a", "AAA-2026-10-11", 1], ["b", "BBB-2026-10-11", 0.5],
    ["x", "XXX-2026-10-10", 1.5], ["x", "XXX-2026-10-11", 1.5], ["x", "XXX-2026-10-12", 100],
    ["y", "YYY-2026-10-11", 1.75],
    // z has scheduled games but no issued forecast at all.
  ];
  data.forecasts = [...admitted,
    ...goals.map(([playerId, gameId, value]) => issuedForecast(data, playerId, gameId, { GOALS: value }, ISSUED)),
    { ...issuedForecast(data, "g2", "GGG-2026-10-11", { SAVES_GOALIE: 4 }, ISSUED), startProbability: 0.9 }];
  return data;
}

describe("RSO daily decision replay (offline fixture)", () => {
  it("admits the issued goalie forecast and drops it once expired", () => {
    const games = normalizePlanningGames(scheduleRows);
    const player = replayWeek().players.find(row => row.id === "7")!;
    const [forecast] = publicPlanningForecasts([goalieRevision("2026-10-10T10:00:00Z", 0.5)], [player], games, new Date(AS_OF));
    // Unconditional expectation = conditional saves x start probability.
    expect(forecast).toMatchObject({ playerId: "7", stats: { SAVES_GOALIE: 15 }, startProbability: 0.5,
      expiresAt: new Date(GOALIE_START).toISOString() });

    // At game start the forecast has expired.
    const atStart: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([goalieRevision("2026-10-10T10:00:00Z", 0.5)], [player], games,
      new Date(GOALIE_START), {}, atStart)).toEqual([]);
    expect(atStart).toContainEqual({ gameId: String(GOALIE_GAME), reasons: ["stale_source"] });

    // Published 37 h before start: it expires 36 h after publication, before the game.
    const early = goalieRevision(shift(GOALIE_START, -37), 0.5);
    expect(publicPlanningForecasts([early], [player], games, new Date(shift(GOALIE_START, -2)))).toHaveLength(1);
    const late: ForecastDiscoveryExclusion[] = [];
    expect(publicPlanningForecasts([early], [player], games, new Date(shift(GOALIE_START, -0.5)), {}, late)).toEqual([]);
    expect(late).toContainEqual({ gameId: String(GOALIE_GAME), reasons: ["stale_source"] });
  });

  it("plans the hand-computed no-move week", () => {
    const data = replayWeek();
    const before = JSON.stringify(data);
    const baseline = evaluatePlan(data, intent, "outcome");
    // 10-10: C=a (1), G=7 (15 saves x 0.25 = 3.75). 10-11: C=a (1) beats b (0.5).
    expect(baseline).toMatchObject({ legal: true, comparisonEligible: true, projectedValue: 5.75,
      scheduledGames: 4, activeGames: 3, benchGames: 1 });
    expect(baseline.assignments.map(row => `${row.date}:${row.slotId}:${row.playerId}`).sort()).toEqual([
      "2026-10-10:C#1:a", "2026-10-10:G#1:7", "2026-10-11:C#1:a"]);
    expect(baseline.recommendation?.exclusions).toContainEqual(expect.objectContaining({ playerId: "b", gameId: "BBB-2026-10-11" }));
    expect(JSON.stringify(data)).toBe(before);
  });

  it("keeps zero, unknown and short-of-minimum goalie requirements distinct", () => {
    const goalieFor = (settings: unknown, credited: number | null) => {
      const data = replayWeek(settings, credited);
      return { goalie: evaluatePlan(data, intent, "outcome").goalie,
        boost: candidatePlanMetrics(data, intent, { maxCandidates: 1 }).goalieBoost };
    };
    // Yahoo reports an explicit zero: the league has no goalie minimum.
    const zero = goalieFor({ min_games_played: "0" }, null);
    expect(zero.goalie).toMatchObject({ required: 0, minimumSatisfied: true, risk: false, expectedStarts: 0.5 });
    expect(zero.boost).toBe(false);
    // Absent key: the requirement is unknown, never treated as zero or as satisfied.
    const unknown = goalieFor({}, null);
    expect(unknown.goalie).toMatchObject({ required: null, minimumSatisfied: null, risk: false, expectedStarts: 0.5 });
    expect(unknown.goalie.minimumSatisfied).not.toBe(zero.goalie.minimumSatisfied);
    expect(unknown.boost).toBe(false);
    // Required 3, credited 1, expected 0.5 start: projected 1.5 falls short.
    const short = goalieFor({ min_games_played: "3" }, 1);
    expect(short.goalie).toMatchObject({ required: 3, credited: 1, minimumSatisfied: false, risk: true,
      expectedStarts: 0.5, projected: 1.5 });
    expect(short.boost).toBe(true);
    // Required 3 with unknown credited progress: projection is unknown, still at risk.
    const unknownProgress = goalieFor({ min_games_played: "3" }, null);
    expect(unknownProgress.goalie).toMatchObject({ required: 3, credited: null, minimumSatisfied: false, risk: true, projected: null });
    expect(unknownProgress.boost).toBe(true);
    // Already credited: satisfied, no risk and no boost.
    const met = goalieFor({ min_games_played: "3" }, 3);
    expect(met.goalie).toMatchObject({ required: 3, minimumSatisfied: true, risk: false });
    expect(met.boost).toBe(false);
  });

  it("treats the matchup end as exclusive", () => {
    expect(GOALIE_PERIOD_END).toBe("2026-10-12");
    expect(ACQUISITION_END).toBe("2026-10-12T00:00:00.000Z");
    const data = replayWeek();
    // x's 100-goal game on Monday 10-12 belongs to the next matchup week.
    expect(candidateHorizonPoints(data).get("x")).toBe(3);
    const week = evaluatePlan(data, intent, "outcome");
    expect(week.goalie).toMatchObject({ projected: 1.5, risk: true });
    expect(week.limitations).not.toContain("Goalie minimum progress applies to an unverified or narrower period; coverage cannot be confirmed for this range.");
    // Planning through 10-12 runs past the exclusive period end, so week progress cannot be confirmed.
    const spill = replayWeek();
    spill.context.endDate = "2026-10-12";
    const spilled = evaluatePlan(spill, intent, "outcome");
    expect(spilled.goalie.projected).toBeNull();
    expect(spilled.limitations).toContain("Goalie minimum progress applies to an unverified or narrower period; coverage cannot be confirmed for this range.");
    expect(candidateHorizonPoints(spill).get("x")).toBe(103);
  });

  it("keeps a missing forecast unknown, never zero", () => {
    const data = replayWeek();
    const horizon = candidateHorizonPoints(data);
    expect(horizon.get("z")).toBeNull();
    // Same contract as the shared modeled-head reader: a missing head is unknown.
    expect(buildSkaterModeledHeadTotals({ proj_goals_es: 0.4, proj_goals_pp: null }).goals).toBeNull();
    expect(buildSkaterModeledHeadTotals({ proj_goals_es: 0.4, proj_goals_pp: 0 }).goals).toBe(0.4);
    // Starting z leaves the plan's points unknown rather than adding 0.
    const metrics = candidatePlanMetrics(data, intent);
    const zPlans = metrics.candidates.find(row => row.playerId === "z")!.plans;
    expect(zPlans.length).toBeGreaterThan(0);
    expect(zPlans.every(plan => plan.netPoints === null)).toBe(true);
    expect(new Map(metrics.activePoints).get("z")).toBeNull();
    // An explicit zero forecast is known and different.
    const zeroed = replayWeek();
    zeroed.forecasts.push(issuedForecast(zeroed, "z", "ZZZ-2026-10-10", { GOALS: 0 }, ISSUED),
      issuedForecast(zeroed, "z", "ZZZ-2026-10-11", { GOALS: 0 }, ISSUED));
    expect(candidateHorizonPoints(zeroed).get("z")).toBe(0);
  });

  it("drops an expired forecast from planning instead of keeping its value", () => {
    const data = replayWeek();
    expect(candidateHorizonPoints(data).get("x")).toBe(3);
    // Issued 10-09 20:00Z, so x's 10-11 forecast expires at 10-11 08:00Z, before its 23:00Z game.
    data.context.startDate = "2026-10-11";
    data.context.asOf = "2026-10-11T09:00:00Z";
    expect(candidateHorizonPoints(data).get("x")).toBeNull();
    expect(candidateHorizonPoints({ ...data, context: { ...data.context, asOf: "2026-10-11T07:00:00Z" } }).get("x")).toBe(1.5);
  });

  it("ranks candidates stably by the hand-computed net points", () => {
    const data = replayWeek();
    const metrics = candidatePlanMetrics(data, intent);
    // Horizon points: x = 1.5 + 1.5, y = 1.75, g2 = 4 saves x 0.25, z unknown (last).
    const horizon = candidateHorizonPoints(data);
    expect(["x", "y", "g2", "z"].map(id => horizon.get(id))).toEqual([3, 1.75, 1, null]);
    expect(metrics.search.complete).toBe(true);
    expect(metrics.baseline).toMatchObject({ activeGames: 3, projectedPoints: 5.75 });
    // Best single swap for x: x starts at C on both days (3) + goalie 3.75 = 6.75, net +1.
    // For y: a (1) on 10-10, y (1.75) on 10-11, goalie 3.75 = 6.5, net +0.75.
    // For g2: a 10-11 goalie start worth 1 (4 x 0.25), net +1 point, +1 game and +0.9 expected starts.
    const best = (id: string) => candidatePlanForSort(metrics.candidates.find(row => row.playerId === id)!.plans, "points");
    expect(best("x")).toMatchObject({ netPoints: 1, netAGP: 0 });
    // Dropping a or b ties exactly (x outscores both at C). Exact ties are pruned to the
    // lexically first step ID, so drop a is shown even though b contributes less.
    // Dropping the goalie 7 (3 - 5.75 = -2.75, one fewer active game) is dominated and pruned.
    const xPlans = metrics.candidates.find(row => row.playerId === "x")!.plans;
    expect(xPlans.map(plan => [plan.steps.map(step => step.dropPlayerId).join(), plan.netPoints, plan.netAGP]))
      .toEqual([["a", 1, 0]]);
    expect(best("y")).toMatchObject({ netPoints: 0.75, netAGP: 0 });
    expect(best("g2")).toMatchObject({ netPoints: 1, netAGP: 1 });
    expect(best("g2").netGoalieStarts).toBeCloseTo(0.9, 12);
    // Goalie 7 has no game after Saturday, so dropping it at Sunday's reset ties dropping b
    // for y and g2. The step-ID tie-break ("drop:7" < "drop:b") picks the goalie drop.
    const shown = (id: string) => best(id).steps.map(step => `${step.dropPlayerId}@${step.effectiveAt}`);
    expect(shown("y")).toEqual(["7@2026-10-11T00:00:00.000Z"]);
    expect(shown("g2")).toEqual(["7@2026-10-11T00:00:00.000Z"]);
    expect(best("z").netPoints).toBeNull();

    const ranked = (rows: typeof metrics) => [...rows.activePoints].sort(([leftId, left], [rightId, right]) =>
      (right ?? -Infinity) - (left ?? -Infinity) || leftId.localeCompare(rightId)).map(([id]) => id);
    expect(ranked(metrics)).toEqual(["g2", "x", "y", "z"]);
    // Input order does not change the decision.
    const reversed = replayWeek();
    reversed.players.reverse(); reversed.games.reverse(); reversed.forecasts.reverse(); reversed.roster.reverse();
    const again = candidatePlanMetrics(reversed, intent);
    expect(again.activePoints).toEqual(metrics.activePoints);
    expect(again.candidates.map(row => candidatePlanForSort(row.plans, "points")))
      .toEqual(metrics.candidates.map(row => candidatePlanForSort(row.plans, "points")));
  });

  it("reserves a bounded slot for a goalie only when the minimum is short", () => {
    const selected = (settings: unknown, credited: number | null) => candidatePlanMetrics(replayWeek(settings, credited), intent,
      { maxCandidates: 1 }).candidates.map(row => row.playerId);
    // Without a short minimum, the top horizon-points candidate wins the single slot.
    expect(selected({ min_games_played: "0" }, null)).toEqual(["x"]);
    expect(selected({}, null)).toEqual(["x"]);
    expect(selected({ min_games_played: "3" }, 3)).toEqual(["x"]);
    // Short of the minimum, the leading goalie takes the reserved slot.
    expect(selected({ min_games_played: "3" }, 1)).toEqual(["g2"]);
  });
});
