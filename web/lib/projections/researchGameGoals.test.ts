import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectionInputHash } from "./inputCapture";
import { RESEARCH_GOAL_CELLS } from "./researchGoalBaseline";
import { evaluateResearchGoalChronologicalFolds, forecastResearchGameGoals, latestObservedResearchRoster,
  researchGoalCellSummary, researchRosterFromOfficialRevision,
  type ResearchGoalForecastScope, type ResearchGoalTeamGame } from "./researchGameGoals";

const cell = "REG:both_present:equal_skaters";
const cells = (overrides: Record<string, number> = {}) => ({ ...Object.fromEntries(RESEARCH_GOAL_CELLS.map(key => [key, 0])), ...overrides });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const scope: ResearchGoalForecastScope = { gameId: 99, seasonId: 20262027, phase: 2, homeTeamId: 6, awayTeamId: 68,
  startAt: "2026-10-08T23:00:00Z", abilityCutoffAt: "2026-10-08T01:00:00Z", featureCutoffAt: "2026-10-08T01:00:00Z",
  asOf: "2026-10-08T01:00:01Z", pGamePlayed: null };
function game(gameId: number, teamId: number, day: number, goals: Record<string, number>, against: Record<string, number> = {}): ResearchGoalTeamGame {
  const total = Object.values(goals).reduce((a, b) => a + b, 0), conceded = Object.values(against).reduce((a, b) => a + b, 0);
  return { gameId, teamId, opponentId: teamId === 6 ? 68 : 6, seasonId: 20262027, phase: 2,
    startedAt: `2026-10-0${day}T23:00:00Z`, availableAt: "2026-10-07T22:00:00Z", pbpRevisionId: `pbp-${gameId}`, boxscoreRevisionId: `box-${gameId}`,
    goalsFor: total, goalsAgainst: conceded, goalsForByCell: cells(goals), goalsAgainstByScoringCell: cells(against), players: [
      { playerId: teamId * 100 + 1, position: "C", toiSeconds: 1200, officialGoals: total, goalsByCell: cells(goals) },
      { playerId: teamId * 100 + 2, position: "D", toiSeconds: 1000, officialGoals: 0, goalsByCell: cells() },
      { playerId: teamId * 100 + 3, position: "G", toiSeconds: 3600, officialGoals: 0, goalsByCell: cells() },
      { playerId: teamId * 100 + 4, position: "G", toiSeconds: 0, officialGoals: 0, goalsByCell: cells() },
    ] };
}
const history = () => [game(11, 6, 1, { [cell]: 3 }, { [cell]: 2 }), game(12, 6, 3, { "OT:both_present:equal_skaters": 1 }, { [cell]: 2 }),
  game(21, 68, 2, { [cell]: 4 }, { [cell]: 1 }), game(22, 68, 4, { [cell]: 2 }, { [cell]: 3 })];
const rosters = (games: ResearchGoalTeamGame[] = history()) => [6, 68].map(teamId => latestObservedResearchRoster(games.filter(game => game.teamId === teamId)));
const forecast = (change: Partial<Parameters<typeof forecastResearchGameGoals>[0]> = {}) => forecastResearchGameGoals({ scope, history: history(), rosters: rosters(), ...change });

describe("research GOALS played-game accounting", () => {
  it("compares all three models on the same per-game basis and reconciles all 24 cells", () => {
    const result = forecast();
    expect(result.acceptanceEligible).toBe(false);
    expect(result.fullGameContractEligible).toBe(false);
    expect(result.models.map(row => row.model)).toEqual(["empirical", "smoothed", "opponent_blended"]);
    expect(result.models[0].teams.map(team => team.goalMeanGivenGamePlayed)).toEqual([2, 3]);
    expect(result.models[2].teams.map(team => team.goalMeanGivenGamePlayed)).toEqual([2, 2.5]);
    for (const model of result.models) for (const team of model.teams) {
      expect(team.players).toHaveLength(4);
      expect(team.unconditionalGoalsMean).toBeNull();
      expect(team.allSuppliedRosterPlayersRepresented).toBe(true);
      expect(Object.values(team.accounting.cellErrors).every(error => Math.abs(error) < 1e-10)).toBe(true);
      expect(team.players.reduce((a, p) => a + p.goalMeanGivenGamePlayed, team.residual.goalMeanGivenGamePlayed)).toBeCloseTo(team.goalMeanGivenGamePlayed);
      for (const player of team.players) {
        expect(player.participation.confirmed).toBe(false);
        expect(player.participation.statisticalCreditProbability).toBeNull();
        expect(player.participation.dressingProbability).toBeNull();
        expect(player.unconditionalGoalsMean).toBeNull();
        if (player.participation.positiveToiProbability > 0)
          expect(player.participation.positiveToiProbability * player.conditionalGoalsPerPlayingAppearance!).toBeCloseTo(player.goalMeanGivenGamePlayed);
        else expect(player.conditionalGoalsPerPlayingAppearance).toBeNull();
      }
    }
  });

  it("recovers the empirical n/N × G/n identity and measured goalie zeros", () => {
    const team = forecast().models[0].teams[0];
    expect(team.players.find(player => player.playerId === 601)).toMatchObject({ observedPositiveToiAppearances: 2,
      observedGoals: 4, goalMeanGivenGamePlayed: 2, conditionalGoalsPerPlayingAppearance: 2 });
    expect(team.players.find(player => player.playerId === 603)).toMatchObject({ observedGoals: 0, conditionalGoalsPerPlayingAppearance: 0 });
    expect(team.players.find(player => player.playerId === 604)).toMatchObject({ observedPositiveToiAppearances: 0, coldStart: true,
      conditionalGoalsPerPlayingAppearance: null, goalMeanGivenGamePlayed: 0 });
    expect(team.residual.goalMeanGivenGamePlayed).toBe(0);
  });

  it("counts zero-TOI listings as absence and gives cold starts an explicit role-pool research prior", () => {
    const population = rosters(); population[0].players.push({ playerId: 699, position: "C" });
    const result = forecast({ rosters: population });
    const empiric = result.models[0].teams[0].players.find(player => player.playerId === 699)!;
    const smooth = result.models[1].teams[0].players.find(player => player.playerId === 699)!;
    expect(empiric.participation.positiveToiProbability).toBe(0);
    expect(smooth.participation.initialProbability).toBeCloseTo(0.5 / 3);
    expect(smooth.participation.positiveToiProbability).toBeGreaterThan(0);
    expect(smooth.goalMeanGivenGamePlayed).toBeGreaterThan(0);
    expect(smooth.coldStart).toBe(true);
    expect(smooth.conditionalStatisticalCreditGoalMeanBounds.exactMean).toBeNull();
    expect(result.models[1].teams[0].residual.expectedPositiveToiAppearances.skater).toBeCloseTo(0.5 / 3);
  });

  it("reconciles listed plus named-unassigned expected physical appearances to observed role counts", () => {
    for (const model of forecast().models) for (const team of model.teams) {
      expect(team.expectedPositiveToiAppearances.skaters + team.residual.expectedPositiveToiAppearances.skater).toBeCloseTo(2);
      expect(team.expectedPositiveToiAppearances.goalies + team.residual.expectedPositiveToiAppearances.goalie).toBeCloseTo(1);
      expect(team.players.every(player => player.participation.positiveToiProbability >= 0 && player.participation.positiveToiProbability <= 1)).toBe(true);
    }
  });

  it("uses identical participation and raw cell ability in smoothed and opponent-blended variants", () => {
    const models = forecast().models;
    for (let team = 0; team < 2; team++) {
      expect(models[1].teams[team].players.map(player => player.participation)).toEqual(models[2].teams[team].players.map(player => player.participation));
      expect(models[1].teams[team].players.map(player => player.uncalibratedConditionalCellMeans))
        .toEqual(models[2].teams[team].players.map(player => player.uncalibratedConditionalCellMeans));
    }
  });

  it("supports an all-zero observed GOALS sample without turning zero into unknown", () => {
    const sample = [game(11, 6, 1, {}), game(21, 68, 2, {})];
    const result = forecast({ history: sample, rosters: rosters(sample) });
    expect(result.models.every(model => model.teams.every(team => team.goalMeanGivenGamePlayed === 0
      && team.residual.goalMeanGivenGamePlayed === 0 && team.players.every(player => player.goalMeanGivenGamePlayed === 0)))).toBe(true);
  });

  it("moves omitted scorers to a named residual without losing or double counting their goals", () => {
    const population = rosters(); population[0].players = population[0].players.filter(player => player.playerId !== 601);
    const team = forecast({ rosters: population }).models[0].teams[0];
    expect(team.players.every(player => player.playerId !== 601)).toBe(true);
    expect(team.residual.knownOutsideRosterPlayerIds).toContain(601);
    expect(team.residual.goalMeanGivenGamePlayed).toBe(2);
    expect(team.residual.expectedPositiveToiAppearances.skater).toBe(1);
  });

  it("leaves unseen cell allocations with the residual while preserving a supported opponent budget", () => {
    const sample = history();
    sample[2].goalsAgainstByScoringCell = cells({ "REG:both_present:fewer_skaters": 1 });
    const team = forecast({ history: sample }).models[2].teams[0];
    expect(team.cellSummary.ordinaryRegulationPK).toBeCloseTo(0.25);
    expect(team.residual.cellMeansGivenGamePlayed["REG:both_present:fewer_skaters"]).toBeCloseTo(0.25);
    expect(team.residual.includesUnsupportedPlayerCellAllocation).toContain("REG:both_present:fewer_skaters");
    expect(team.unsupportedExposureRates.regulationPKGoalsPerMinute).toBeNull();
  });

  it.each([0, 0.4, 1])("integrates explicit pGamePlayed=%s exactly once across players, residual and team", pGamePlayed => {
    for (const model of forecast({ scope: { ...scope, pGamePlayed } }).models) for (const team of model.teams) {
      expect(team.unconditionalGoalsMean).toBeCloseTo(pGamePlayed * team.goalMeanGivenGamePlayed);
      expect(team.players.reduce((a, p) => a + p.unconditionalGoalsMean!, team.residual.unconditionalGoalsMean!)).toBeCloseTo(team.unconditionalGoalsMean!);
      for (const player of team.players) expect(player.unconditionalGoalsMean).toBeCloseTo(pGamePlayed * player.goalMeanGivenGamePlayed);
    }
  });

  it("keeps ordinary regulation strengths, OT, own net absence and empty-net scoring distinct", () => {
    const summary = researchGoalCellSummary(cells({ [cell]: 2, "REG:both_present:more_skaters": 3, "REG:both_present:fewer_skaters": 1,
      "REG:attacking_absent:more_skaters": 4, "OT:defending_absent:fewer_skaters": 5, "REG:both_absent:equal_skaters": 6 }));
    expect(summary).toMatchObject({ ordinaryRegulationES: 2, ordinaryRegulationPP: 3, ordinaryRegulationPK: 1,
      regulationNetAbsent: 10, overtimeAllNetStates: 5, emptyNetForAllPeriods: 11, ownNetAbsentAllPeriods: 10, totalOfficialPlayGoals: 21,
      shootoutPlayerGoalsIncluded: false });
    expect(summary.ordinaryRegulationES + summary.ordinaryRegulationPP + summary.ordinaryRegulationPK
      + summary.regulationNetAbsent + summary.overtimeAllNetStates).toBe(summary.totalOfficialPlayGoals);
  });

  it("produces deterministic results from identical inputs", () => expect(projectionInputHash(forecast())).toBe(projectionInputHash(forecast())));
});

describe("invalid accounting and information cutoffs", () => {
  it.each(["missing_cell", "credit_mismatch", "zero_toi_goal", "shootout_cell", "duplicate_player", "nonfinite_toi", "minutes_as_seconds"])("rejects %s", problem => {
    const sample = history(), first = sample[0], player = first.players[0];
    if (problem === "missing_cell") delete player.goalsByCell[cell];
    if (problem === "credit_mismatch") player.officialGoals++;
    if (problem === "zero_toi_goal") player.toiSeconds = 0;
    if (problem === "shootout_cell") player.goalsByCell["SO:both_present:equal_skaters"] = 1;
    if (problem === "duplicate_player") first.players[1].playerId = player.playerId;
    if (problem === "nonfinite_toi") player.toiSeconds = Infinity;
    // The boundary cannot infer whether a numeric 20 means 20 seconds or 20 minutes.
    // A nonnumeric minute:second string is rejected; the official adapter performs conversion.
    if (problem === "minutes_as_seconds") (player as any).toiSeconds = "20:00";
    expect(() => forecast({ history: sample })).toThrow();
  });

  it.each(["receipt_at_cutoff", "started_at_cutoff", "wrong_season", "target_game", "duplicate_game"])("rejects %s training", problem => {
    const sample = history();
    if (problem === "receipt_at_cutoff") sample[0].availableAt = scope.abilityCutoffAt;
    if (problem === "started_at_cutoff") { sample[0].startedAt = scope.abilityCutoffAt; sample[0].availableAt = scope.asOf; }
    if (problem === "wrong_season") sample[0].seasonId = 20252026;
    if (problem === "target_game") sample[0].gameId = scope.gameId;
    if (problem === "duplicate_game") sample.push(clone(sample[0]));
    expect(() => forecast({ history: sample })).toThrow();
  });

  it("rejects roster receipt at cutoff, duplicate roster IDs and mismatched team/season", () => {
    const population = rosters(); population[0].availableAt = scope.featureCutoffAt;
    expect(() => forecast({ rosters: population })).toThrow();
    population[0].availableAt = "2026-10-07T22:00:00Z"; population[0].players.push(clone(population[0].players[0]));
    expect(() => forecast({ rosters: population })).toThrow();
    expect(() => forecast({ rosters: [rosters()[0], { ...rosters()[1], seasonId: 20252026 }] })).toThrow();
    expect(() => forecast({ rosters: [rosters()[0], rosters()[0]] })).toThrow();
    const shared = rosters(); shared[1].players[0].playerId = shared[0].players[0].playerId;
    expect(() => forecast({ rosters: shared })).toThrow();
  });

  it("rejects conflicting opposite game identities or duplicated players across teams", () => {
    const sample = history(), opposite = game(11, 68, 1, { [cell]: 2 }, { [cell]: 3 });
    expect(() => forecast({ history: [...sample, opposite] })).not.toThrow();
    const wrongGoals = clone(opposite); wrongGoals.goalsAgainstByScoringCell = cells({ "OT:both_present:equal_skaters": 3 });
    expect(() => forecast({ history: [...sample, wrongGoals] })).toThrow("Opposite retained team-game");
    const samePlayer = clone(opposite); samePlayer.players[0].playerId = sample[0].players[0].playerId;
    expect(() => forecast({ history: [...sample, samePlayer] })).toThrow("Opposite retained team-game");
  });

  it("rejects a cutoff after asOf, post-start generation and invalid game occurrence assumptions", () => {
    expect(() => forecast({ scope: { ...scope, featureCutoffAt: scope.startAt } })).toThrow();
    expect(() => forecast({ scope: { ...scope, asOf: scope.startAt } })).toThrow();
    expect(() => forecast({ scope: { ...scope, pGamePlayed: 1.1 } })).toThrow();
  });
});

describe("public roster adapter", () => {
  const input = { teamId: 6, teamAbbrev: "BOS", seasonId: 20262027, featureCutoffAt: scope.featureCutoffAt };
  function identityBox() {
    const payload = { id: 11, season: 20262027, gameType: 2, homeTeam: { id: 6, abbrev: "BOS" }, awayTeam: { id: 68, abbrev: "UTA" } };
    const url = "https://api-web.nhle.com/v1/gamecenter/11/boxscore", bodyUtf8 = JSON.stringify(payload);
    return { kind: "official_boxscore", httpStatus: 200, gameId: 11, url, revisionId: "box-11", bodyUtf8,
      rawBytesHash: createHash("sha256").update(bodyUtf8).digest("hex"), payload,
      provenance: { revisionId: "box-11", payloadHash: projectionInputHash(payload), source: url,
        firstReceivedAt: "2026-10-07T21:00:00Z", verifiedAt: "2026-10-07T21:00:01Z", publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null } };
  }
  function source() {
    const url = "https://api-web.nhle.com/v1/roster/BOS/current";
    const payload = { forwards: [{ id: 601, positionCode: "C" }], defensemen: [{ id: 602, positionCode: "D" }], goalies: [{ id: 603, positionCode: "G" }] };
    const bodyUtf8 = JSON.stringify(payload);
    return { kind: "official_current_team_roster", teamId: 6, teamAbbrev: "BOS", seasonId: 20262027, url,
      requestedAt: "2026-10-07T22:00:00Z", httpStatus: 200, revisionId: "roster-6", bodyUtf8, rawBytesHash: createHash("sha256").update(bodyUtf8).digest("hex"), payload,
      provenance: { revisionId: "roster-6", payloadHash: projectionInputHash(payload), source: url, firstReceivedAt: "2026-10-07T22:00:01Z",
        verifiedAt: "2026-10-07T22:00:02Z", publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null } };
  }
  it("retains exact NHL IDs, source revision and availability without claiming future membership", () => {
    const roster = researchRosterFromOfficialRevision(source(), input, identityBox());
    expect(roster).toMatchObject({ basis: "official_current_snapshot", revisionId: "roster-6", availableAt: "2026-10-07T22:00:02.000Z" });
    expect(roster.players.map(player => player.playerId)).toEqual([601, 602, 603]);
  });
  it.each(["raw_hash", "payload_hash", "wrong_url", "wrong_team", "late_receipt", "missing_group", "wrong_role"])("rejects %s", problem => {
    const revision = source();
    if (problem === "raw_hash") revision.rawBytesHash = "0".repeat(64);
    if (problem === "payload_hash") revision.provenance.payloadHash = "0".repeat(64);
    if (problem === "wrong_url") revision.url = "https://example.com/roster";
    if (problem === "wrong_team") revision.teamId = 68;
    if (problem === "late_receipt") revision.provenance.verifiedAt = scope.featureCutoffAt;
    if (["missing_group", "wrong_role"].includes(problem)) {
      if (problem === "missing_group") delete (revision.payload as any).goalies;
      else revision.payload.goalies[0].positionCode = "C";
      revision.bodyUtf8 = JSON.stringify(revision.payload); revision.rawBytesHash = createHash("sha256").update(revision.bodyUtf8).digest("hex");
      revision.provenance.payloadHash = projectionInputHash(revision.payload);
    }
    expect(() => researchRosterFromOfficialRevision(revision, input, identityBox())).toThrow();
  });
  it("rejects internally consistent swapped team-ID/abbreviation pairs against independent BOX identity", () => {
    const revision = source(); revision.teamAbbrev = "UTA";
    revision.url = revision.provenance.source = "https://api-web.nhle.com/v1/roster/UTA/current";
    expect(() => researchRosterFromOfficialRevision(revision, { ...input, teamAbbrev: "UTA" }, identityBox()))
      .toThrow("Public roster team ID/abbreviation differs");
    const other = source(); other.teamId = 68;
    expect(() => researchRosterFromOfficialRevision(other, { ...input, teamId: 68 }, identityBox()))
      .toThrow("Public roster team ID/abbreviation differs");
  });
  it("rejects unverified or cutoff-ineligible independent identity bytes", () => {
    const identity = identityBox(); identity.rawBytesHash = "0".repeat(64);
    expect(() => researchRosterFromOfficialRevision(source(), input, identity)).toThrow();
    const late = identityBox(); late.provenance.verifiedAt = input.featureCutoffAt;
    expect(() => researchRosterFromOfficialRevision(source(), input, late)).toThrow();
  });
});

describe("chronological empirical diagnostics", () => {
  it("rejects duplicate team-game records instead of training on the held-out outcome", () => {
    const sample = history();
    expect(() => evaluateResearchGoalChronologicalFolds({ history: [...sample, clone(sample[0])], focalTeamIds: [6, 68] }))
      .toThrow("Duplicate team-game");
  });
  it("rejects different games with tied starts before asserting strictly earlier training", () => {
    const sample = history(); sample[1].startedAt = sample[0].startedAt;
    expect(() => evaluateResearchGoalChronologicalFolds({ history: sample, focalTeamIds: [6, 68] }))
      .toThrow("strictly before held-out game");
  });
  it("uses only prior games and prior roster populations, and preserves actual late-receipt limits", () => {
    const sample = history();
    const result = evaluateResearchGoalChronologicalFolds({ history: sample, focalTeamIds: [6, 68] });
    expect(result.sameFoldSummaries.map(row => row.folds)).toEqual([2, 2]);
    expect(result.historicalForecastBacktestEligible).toBe(false);
    expect(result.folds.every(fold => !fold.trainingGameIds.includes(fold.gameId) && !fold.heldOutOutcomesUsedAsFeatures
      && !fold.forecastAcceptanceEvidence && !fold.historicalPregameAvailabilityProved)).toBe(true);
    const prior = result.folds.filter(fold => fold.gameId === 12);
    const changed = clone(sample); changed[1] = game(12, 6, 3, { [cell]: 40 });
    const modified = evaluateResearchGoalChronologicalFolds({ history: changed, focalTeamIds: [6, 68] }).folds.filter(fold => fold.gameId === 12);
    expect(modified.map(fold => fold.prediction)).toEqual(prior.map(fold => fold.prediction));
  });
  it("counts newly observed held-out scorers against the residual rather than adding them to the feature roster", () => {
    const sample = history(); sample[1].players[0].playerId = 699;
    const result = evaluateResearchGoalChronologicalFolds({ history: sample, focalTeamIds: [6] });
    expect(result.folds.every(fold => !fold.prediction.players.some(player => player.playerId === 699) && fold.actualResidualGoals === 1)).toBe(true);
  });
});
