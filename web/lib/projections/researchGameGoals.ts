import { createHash } from "node:crypto";
import { z } from "zod";
import { availableBefore, provenanceSchema } from "../forecast-diagnostics/pairedInputs";
import { projectionInputHash } from "./inputCapture";
import type { auditNativeGoalLedger } from "./nativeGoalLedgerAudit";
import { RESEARCH_GOAL_CELLS, type evaluateRetainedResearchGoals } from "./researchGoalBaseline";

export const RESEARCH_GAME_GOALS_VERSION = "research-recent-window-game-goals-v1";
export const RESEARCH_GAME_GOALS_PARAMETERS = {
  participationAlpha: 0.5, participationBeta: 0.5, conditionalPriorAppearances: 1,
  residualPriorAppearancesPerRole: 0.5, ownWeight: 0.5, opponentWeight: 0.5,
} as const;
export const RESEARCH_GAME_GOALS_MODELS = ["empirical", "smoothed", "opponent_blended"] as const;
type Model = typeof RESEARCH_GAME_GOALS_MODELS[number];
type Cells = Record<string, number>;
const id = z.number().int().positive().safe(), count = z.number().int().nonnegative().safe();
const instant = z.string().datetime({ offset: true });
const position = z.enum(["C", "L", "R", "D", "G"]);
const cellsSchema = z.record(count).superRefine((cells, ctx) => {
  if (Object.keys(cells).length !== RESEARCH_GOAL_CELLS.length || RESEARCH_GOAL_CELLS.some(cell => !(cell in cells)))
    ctx.addIssue({ code: "custom", message: "All 24 disjoint official-play goal cells are required" });
});
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const zeroCells = (): Cells => Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, 0]));
const addCells = (rows: readonly Cells[]): Cells => Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, sum(rows.map(row => row[cell]))]));
const scaleCells = (cells: Cells, multiplier: number): Cells => Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, cells[cell] * multiplier]));
const role = (value: string) => value === "G" ? "goalie" : "skater";
const seconds = (value: unknown) => typeof value === "string" && /^\d{1,3}:[0-5]\d$/.test(value)
  ? sum(value.split(":").map(Number).map((part, i) => part * (i === 0 ? 60 : 1))) : null;

const playerObservationSchema = z.object({ playerId: id, position, toiSeconds: z.number().finite().nonnegative().max(3900),
  officialGoals: count, goalsByCell: cellsSchema }).strict().superRefine((row, ctx) => {
  if (sum(Object.values(row.goalsByCell)) !== row.officialGoals || row.toiSeconds === 0 && row.officialGoals !== 0)
    ctx.addIssue({ code: "custom", message: "Player GOALS, positive-TOI appearances and disjoint cells must reconcile" });
});
const historySchema = z.object({ gameId: id, teamId: id, opponentId: id, seasonId: id, phase: z.literal(2),
  startedAt: instant, availableAt: instant, pbpRevisionId: z.string().min(1), boxscoreRevisionId: z.string().min(1),
  goalsFor: count, goalsAgainst: count, goalsForByCell: cellsSchema, goalsAgainstByScoringCell: cellsSchema,
  players: z.array(playerObservationSchema).min(1).max(100),
}).strict().superRefine((row, ctx) => {
  if (row.teamId === row.opponentId || new Set(row.players.map(player => player.playerId)).size !== row.players.length
    || sum(row.players.map(player => player.officialGoals)) !== row.goalsFor
    || sum(Object.values(row.goalsForByCell)) !== row.goalsFor || sum(Object.values(row.goalsAgainstByScoringCell)) !== row.goalsAgainst
    || RESEARCH_GOAL_CELLS.some(cell => sum(row.players.map(player => player.goalsByCell[cell])) !== row.goalsForByCell[cell])
    || Date.parse(row.availableAt) <= Date.parse(row.startedAt))
    ctx.addIssue({ code: "custom", message: "Team/player goal credit, cells, identities or availability do not reconcile" });
});
export type ResearchGoalTeamGame = z.infer<typeof historySchema>;
const rosterSchema = z.object({ teamId: id, seasonId: id, revisionId: z.string().min(1), availableAt: instant,
  basis: z.enum(["official_current_snapshot", "latest_observed_box_population"]),
  players: z.array(z.object({ playerId: id, position }).strict()).min(1).max(100),
}).strict().superRefine((row, ctx) => {
  if (new Set(row.players.map(player => player.playerId)).size !== row.players.length)
    ctx.addIssue({ code: "custom", message: "Duplicate research roster player" });
});
export type ResearchGoalRoster = z.infer<typeof rosterSchema>;

/** BOX/PBP replay is required before this adapter; no player-season coverage claim is used. */
export function researchGoalHistoryFromReplay(input: {
  evaluation: ReturnType<typeof evaluateRetainedResearchGoals>; ledger: ReturnType<typeof auditNativeGoalLedger>;
  boxscoreRevisions: any[];
}): ResearchGoalTeamGame[] {
  if (input.evaluation.teams.some(team => !team.historicalAccounting.reconciled)) throw new Error("Unreconciled retained GOALS population");
  return input.ledger.games.flatMap(game => {
    const source = input.boxscoreRevisions.find(row => row.gameId === game.gameId);
    if (!source) throw new Error("Missing official BOX population");
    const box = source.payload;
    const verified = provenanceSchema.parse(source.provenance);
    const availableAt = new Date(Math.max(...[verified, game.provenance].flatMap(row => [Date.parse(row.firstReceivedAt),
      Date.parse(row.verifiedAt), row.publishedAt === null ? -Infinity : Date.parse(row.publishedAt)]))).toISOString();
    return game.teams.map(team => {
      const ownGoals = game.events.filter(event => event.kind === "goal" && event.teamId === team.teamId);
      const againstGoals = game.events.filter(event => event.kind === "goal" && event.teamId !== team.teamId);
      const eventsToCells = (events: typeof ownGoals) => {
        const cells = zeroCells();
        events.forEach(event => {
          const cell = `${event.period}:${event.netState}:${event.skaterRelation}`;
          if (!(cell in cells)) throw new Error("Unproved official goal state");
          cells[cell]++;
        });
        return cells;
      };
      const ownRoster = game.roster.filter(player => player.teamId === team.teamId);
      const side = box.homeTeam.id === team.teamId ? "homeTeam" : "awayTeam";
      const stats = box.playerByGameStats[side];
      const rows = [stats.forwards, stats.defense, stats.goalies].flat();
      if (rows.length !== ownRoster.length || rows.some(row => !ownRoster.some(player => player.playerId === row.playerId)))
        throw new Error("BOX/PBP roster differs in research history");
      const skaterCredits = sum(rows.filter(row => row.position !== "G").map(row => count.parse(row.goals)));
      const players = ownRoster.map(player => {
        const row = rows.find(row => row.playerId === player.playerId);
        if (row.position !== player.positionCode || seconds(row.toi) === null) throw new Error("Unproved official position or TOI seconds");
        const goalsByCell = eventsToCells(ownGoals.filter(goal => goal.playerId === player.playerId));
        const officialGoals = row.goals ?? (player.positionCode === "G" && skaterCredits === ownGoals.length && sum(Object.values(goalsByCell)) === 0 ? 0 : null);
        return { playerId: player.playerId, position: row.position, toiSeconds: seconds(row.toi), officialGoals, goalsByCell };
      });
      return historySchema.parse({ gameId: game.gameId, teamId: team.teamId, opponentId: game.teams.find(other => other.teamId !== team.teamId)!.teamId,
        seasonId: input.ledger.scope.seasonId, phase: 2, startedAt: game.startAt, availableAt, pbpRevisionId: game.revisionId,
        boxscoreRevisionId: source.revisionId, goalsFor: team.observedOfficialPlayGoals, goalsAgainst: againstGoals.length,
        goalsForByCell: eventsToCells(ownGoals), goalsAgainstByScoringCell: eventsToCells(againstGoals), players });
    });
  }).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.teamId - b.teamId);
}

export function researchRosterFromOfficialRevision(source: any, input: {
  teamId: number; teamAbbrev: string; seasonId: number; featureCutoffAt: string;
}, teamIdentityBoxscore: any): ResearchGoalRoster {
  const identityProvenance = provenanceSchema.parse(teamIdentityBoxscore?.provenance);
  const box = teamIdentityBoxscore.payload;
  const expectedTeam = [box?.homeTeam, box?.awayTeam].find(team => team?.id === input.teamId);
  if (teamIdentityBoxscore.kind !== "official_boxscore" || teamIdentityBoxscore.httpStatus !== 200
    || teamIdentityBoxscore.gameId !== box?.id || box?.season !== input.seasonId || box?.gameType !== 2
    || teamIdentityBoxscore.url !== `https://api-web.nhle.com/v1/gamecenter/${box?.id}/boxscore`
    || teamIdentityBoxscore.url !== identityProvenance.source || teamIdentityBoxscore.revisionId !== identityProvenance.revisionId
    || typeof teamIdentityBoxscore.bodyUtf8 !== "string"
    || createHash("sha256").update(teamIdentityBoxscore.bodyUtf8).digest("hex") !== teamIdentityBoxscore.rawBytesHash
    || projectionInputHash(JSON.parse(teamIdentityBoxscore.bodyUtf8)) !== projectionInputHash(box)
    || projectionInputHash(box) !== identityProvenance.payloadHash || !availableBefore(identityProvenance, input.featureCutoffAt)
    || !expectedTeam || !/^[A-Z]{2,4}$/.test(expectedTeam.abbrev) || expectedTeam.abbrev !== input.teamAbbrev)
    throw new Error("Public roster team ID/abbreviation differs from verified current-season BOX identity");
  const provenance = provenanceSchema.parse(source?.provenance);
  const url = `https://api-web.nhle.com/v1/roster/${expectedTeam.abbrev}/current`;
  if (source.kind !== "official_current_team_roster" || source.httpStatus !== 200 || source.teamId !== input.teamId
    || source.teamAbbrev !== input.teamAbbrev || source.seasonId !== input.seasonId || source.url !== url || provenance.source !== url
    || source.revisionId !== provenance.revisionId || typeof source.bodyUtf8 !== "string"
    || createHash("sha256").update(source.bodyUtf8).digest("hex") !== source.rawBytesHash
    || projectionInputHash(JSON.parse(source.bodyUtf8)) !== projectionInputHash(source.payload) || projectionInputHash(source.payload) !== provenance.payloadHash
    || !Number.isFinite(Date.parse(source.requestedAt)) || Date.parse(source.requestedAt) > Date.parse(provenance.firstReceivedAt)
    || !availableBefore(provenance, input.featureCutoffAt)) throw new Error("Unverified or cutoff-ineligible public roster source");
  const players = ["forwards", "defensemen", "goalies"].flatMap(group => {
    if (!Array.isArray(source.payload[group])) throw new Error("Incomplete official roster response");
    return source.payload[group].map((row: any) => {
      const pos = position.parse(row.positionCode);
      if ((group === "goalies") !== (pos === "G") || group === "defensemen" && pos !== "D"
        || group === "forwards" && !["C", "L", "R"].includes(pos)) throw new Error("Official roster position/group conflict");
      return { playerId: id.parse(row.id), position: pos };
    });
  });
  return rosterSchema.parse({ teamId: input.teamId, seasonId: input.seasonId, revisionId: source.revisionId,
    availableAt: new Date(Math.max(Date.parse(provenance.firstReceivedAt), Date.parse(provenance.verifiedAt),
      provenance.publishedAt === null ? -Infinity : Date.parse(provenance.publishedAt))).toISOString(), basis: "official_current_snapshot", players });
}

export function latestObservedResearchRoster(games: readonly ResearchGoalTeamGame[]): ResearchGoalRoster {
  if (!games.length) throw new Error("No observed roster for research proxy");
  const latest = [...games].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  return rosterSchema.parse({ teamId: latest.teamId, seasonId: latest.seasonId, revisionId: latest.boxscoreRevisionId,
    availableAt: latest.availableAt, basis: "latest_observed_box_population",
    players: latest.players.map(({ playerId, position }) => ({ playerId, position })) });
}

/** These groups partition means; empty-net-for and own-extra-attacker are different. */
export function researchGoalCellSummary(cells: Cells) {
  const selected = (predicate: (cell: string) => boolean) => sum(RESEARCH_GOAL_CELLS.filter(predicate).map(cell => cells[cell]));
  return { ordinaryRegulationES: cells["REG:both_present:equal_skaters"], ordinaryRegulationPP: cells["REG:both_present:more_skaters"],
    ordinaryRegulationPK: cells["REG:both_present:fewer_skaters"],
    regulationNetAbsent: selected(cell => cell.startsWith("REG:") && !cell.includes(":both_present:")),
    overtimeAllNetStates: selected(cell => cell.startsWith("OT:")),
    emptyNetForAllPeriods: selected(cell => cell.includes(":defending_absent:") || cell.includes(":both_absent:")),
    ownNetAbsentAllPeriods: selected(cell => cell.includes(":attacking_absent:") || cell.includes(":both_absent:")),
    totalOfficialPlayGoals: sum(Object.values(cells)), shootoutPlayerGoalsIncluded: false };
}

function calibratedAppearanceProbabilities(probabilities: number[], expectedCount: number) {
  if (expectedCount <= 0) return probabilities.map(() => 0);
  if (expectedCount >= probabilities.length) return probabilities.map(() => 1);
  const shifted = (offset: number) => probabilities.map(p => 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + offset))));
  let low = -40, high = 40;
  for (let i = 0; i < 70; i++) {
    const middle = (low + high) / 2;
    if (sum(shifted(middle)) < expectedCount) low = middle; else high = middle;
  }
  return shifted((low + high) / 2);
}

function teamKernel(input: {
  teamId: number; roster: ResearchGoalRoster; history: ResearchGoalTeamGame[]; opponentHistory: ResearchGoalTeamGame[]; model: Model;
  pGamePlayed: number | null;
}) {
  const { history, roster, model } = input, N = history.length;
  const observations = roster.players.map(player => {
    const rows = history.flatMap(game => game.players.filter(row => row.playerId === player.playerId && row.toiSeconds > 0));
    if (rows.some(row => role(row.position) !== role(player.position))) throw new Error("Changing skater/goalie role is outside this research model");
    return { ...player, n: rows.length, goalCounts: addCells(rows.map(row => row.goalsByCell)) };
  });
  const pools = Object.fromEntries(["skater", "goalie"].map(population => {
    const appearances = history.flatMap(game => game.players.filter(player => role(player.position) === population && player.toiSeconds > 0));
    return [population, { n: appearances.length, means: appearances.length ? scaleCells(addCells(appearances.map(player => player.goalsByCell)), 1 / appearances.length) : zeroCells() }];
  }));
  const ownCells = scaleCells(addCells(history.map(game => game.goalsForByCell)), 1 / N);
  const budget = model === "opponent_blended" ? Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell,
    RESEARCH_GAME_GOALS_PARAMETERS.ownWeight * ownCells[cell] + RESEARCH_GAME_GOALS_PARAMETERS.opponentWeight
      * sum(input.opponentHistory.map(game => game.goalsAgainstByScoringCell[cell])) / input.opponentHistory.length])) : ownCells;
  const outside = history.flatMap(game => game.players.filter(player => !roster.players.some(member => member.playerId === player.playerId)));
  const appearanceBudgets = Object.fromEntries(["skater", "goalie"].map(population => {
    const listed = observations.filter(player => role(player.position) === population);
    const total = pools[population].n / N, outsideN = outside.filter(player => role(player.position) === population && player.toiSeconds > 0).length;
    const rawUnassigned = model === "empirical" ? outsideN / N : (outsideN + RESEARCH_GAME_GOALS_PARAMETERS.residualPriorAppearancesPerRole) / (N + 1);
    const unassigned = model === "empirical" ? rawUnassigned : Math.min(total, Math.max(rawUnassigned, total - listed.length));
    const initial = listed.map(player => (player.n + RESEARCH_GAME_GOALS_PARAMETERS.participationAlpha)
      / (N + RESEARCH_GAME_GOALS_PARAMETERS.participationAlpha + RESEARCH_GAME_GOALS_PARAMETERS.participationBeta));
    const calibrated = model === "empirical" ? listed.map(player => player.n / N) : calibratedAppearanceProbabilities(initial, total - unassigned);
    return [population, { total, outsideN, rawUnassigned, unassigned, probabilities: new Map(listed.map((player, index) => [player.playerId, calibrated[index]])) }];
  }));
  const raw = observations.map(player => {
    const initialP = model === "empirical" ? player.n / N
      : (player.n + RESEARCH_GAME_GOALS_PARAMETERS.participationAlpha) / (N + RESEARCH_GAME_GOALS_PARAMETERS.participationAlpha + RESEARCH_GAME_GOALS_PARAMETERS.participationBeta);
    const p = appearanceBudgets[role(player.position)].probabilities.get(player.playerId)!;
    const pool = pools[role(player.position)];
    if (!pool.n && model !== "empirical") throw new Error("No observed role pool for a cold-start research kernel");
    const conditional = model === "empirical" ? player.n ? scaleCells(player.goalCounts, 1 / player.n) : null
      : Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, (player.goalCounts[cell]
        + RESEARCH_GAME_GOALS_PARAMETERS.conditionalPriorAppearances * pool.means[cell]) / (player.n + RESEARCH_GAME_GOALS_PARAMETERS.conditionalPriorAppearances)]));
    return { ...player, p, initialP, conditional, weight: conditional ? scaleCells(conditional, p) : zeroCells() };
  });
  const knownOutside = scaleCells(addCells(outside.map(player => player.goalsByCell)), 1 / N);
  const residualWeight = model === "empirical" ? knownOutside : Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell,
    sum(["skater", "goalie"].map(population => {
      const observed = sum(outside.filter(player => role(player.position) === population).map(player => player.goalsByCell[cell]));
      const appearances = appearanceBudgets[population];
      return (observed + RESEARCH_GAME_GOALS_PARAMETERS.residualPriorAppearancesPerRole * pools[population].means[cell]) / (N + 1)
        + Math.max(0, appearances.unassigned - appearances.rawUnassigned) * pools[population].means[cell];
    }))]));
  const normalizers = Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell, sum(raw.map(player => player.weight[cell])) + residualWeight[cell]]));
  const allocate = (weights: Cells) => Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell,
    normalizers[cell] > 0 ? budget[cell] * weights[cell] / normalizers[cell] : 0]));
  const players = raw.map(player => {
    const cellMeans = allocate(player.weight), givenPlayed = sum(Object.values(cellMeans));
    const conditional = player.p > 0 ? scaleCells(cellMeans, 1 / player.p) : null;
    return { playerId: player.playerId, position: player.position, observedPositiveToiAppearances: player.n, observedGoals: sum(Object.values(player.goalCounts)),
      participation: { conditioning: "given_game_played", positiveToiProbability: player.p, initialProbability: player.initialP,
        estimator: model === "empirical" ? "n_over_N" : "beta_binomial_mean_with_common_logit_role_count_calibration",
        dressingProbability: null, statisticalCreditProbability: null, confirmed: false },
      goalMeanBasis: "given_game_played", goalMeanGivenGamePlayed: givenPlayed, cellMeansGivenGamePlayed: cellMeans,
      conditionalBasis: "given_positive_official_TOI_and_game_played", conditionalGoalsPerPlayingAppearance: conditional ? sum(Object.values(conditional)) : null,
      conditionalCellMeans: conditional, uncalibratedConditionalCellMeans: player.conditional,
      conditionalStatisticalCreditGoalMeanBounds: { lower: givenPlayed, upper: player.p > 0 ? givenPlayed / player.p : null,
        exactMean: null, reason: "pCredit lies between pPositiveTOI and 1; penalty-only credit probability is unmodeled" },
      unconditionalGoalsMean: input.pGamePlayed === null ? null : input.pGamePlayed * givenPlayed,
      coldStart: player.n === 0, unsupportedOtherCategoryHeads: true };
  }).sort((a, b) => a.playerId - b.playerId);
  const residualCells = allocate(residualWeight);
  RESEARCH_GOAL_CELLS.forEach(cell => { if (normalizers[cell] === 0) residualCells[cell] = budget[cell]; });
  const residual = { contributorId: `unassigned-goal-scorers:${input.teamId}`, reason: "historical contributors outside roster and unassigned future goal credit",
    knownOutsideRosterPlayerIds: [...new Set(outside.map(player => player.playerId))].sort((a, b) => a - b),
    expectedPositiveToiAppearances: Object.fromEntries(["skater", "goalie"].map(population => [population, appearanceBudgets[population].unassigned])),
    cellMeansGivenGamePlayed: residualCells, goalMeanGivenGamePlayed: sum(Object.values(residualCells)),
    unconditionalGoalsMean: input.pGamePlayed === null ? null : input.pGamePlayed * sum(Object.values(residualCells)),
    includesUnsupportedPlayerCellAllocation: RESEARCH_GOAL_CELLS.filter(cell => budget[cell] > 0 && normalizers[cell] === 0) };
  const teamMean = sum(Object.values(budget));
  const errors = Object.fromEntries(RESEARCH_GOAL_CELLS.map(cell => [cell,
    sum(players.map(player => player.cellMeansGivenGamePlayed[cell])) + residualCells[cell] - budget[cell]]));
  if (Object.values(errors).some(error => !Number.isFinite(error) || Math.abs(error) > 1e-10)) throw new Error("Research GOALS cell reconciliation failed");
  return { teamId: input.teamId, model, historyGameIds: history.map(game => game.gameId), opponentHistoryGameIds: input.opponentHistory.map(game => game.gameId),
    trainingPopulation: "selected_retained_recent_team_games", rosterBasis: roster.basis, rosterRevisionId: roster.revisionId,
    futureRosterMembershipProved: false, allSuppliedRosterPlayersRepresented: players.length === roster.players.length,
    expectedPositiveToiAppearances: { skaters: sum(players.filter(player => player.position !== "G").map(player => player.participation.positiveToiProbability)),
      goalies: sum(players.filter(player => player.position === "G").map(player => player.participation.positiveToiProbability)) },
    participationIsJointLineupModel: false, players, residual, cellMeansGivenGamePlayed: budget, cellSummary: researchGoalCellSummary(budget),
    goalMeanGivenGamePlayed: teamMean, unconditionalGoalsMean: input.pGamePlayed === null ? null : input.pGamePlayed * teamMean,
    accounting: { identity: "sum(pPositiveTOI * E[G|positiveTOI,played]) + namedResidual = E[teamG|played]", cellErrors: errors,
      physicalAppearanceBudget: Object.fromEntries(["skater", "goalie"].map(population => [population, appearanceBudgets[population].total])),
      completeUnderDeclaredResearchModel: true, observedOpponentGAMeansUseScorerPerspective: true },
    unsupportedExposureRates: { regulationPKGoalsPerMinute: null, overtimeGoalsPerOpportunity: null, emptyNetGoalsPerMinute: null },
    fullGameEligible: false };
}

const forecastScopeSchema = z.object({ gameId: id, seasonId: id, phase: z.literal(2), homeTeamId: id, awayTeamId: id,
  startAt: instant, abilityCutoffAt: instant, featureCutoffAt: instant, asOf: instant, pGamePlayed: z.number().finite().min(0).max(1).nullable() }).strict()
  .superRefine((row, ctx) => {
    if (row.homeTeamId === row.awayTeamId || Date.parse(row.abilityCutoffAt) > Date.parse(row.featureCutoffAt)
      || Date.parse(row.featureCutoffAt) > Date.parse(row.asOf) || Date.parse(row.asOf) >= Date.parse(row.startAt))
      ctx.addIssue({ code: "custom", message: "Invalid pregame cutoff or team scope" });
  });
export type ResearchGoalForecastScope = z.infer<typeof forecastScopeSchema>;

export function forecastResearchGameGoals(input: { scope: ResearchGoalForecastScope; history: ResearchGoalTeamGame[]; rosters: ResearchGoalRoster[] }) {
  const scope = forecastScopeSchema.parse(input.scope), history = input.history.map(game => historySchema.parse(game)), rosters = input.rosters.map(row => rosterSchema.parse(row));
  const teamIds = [scope.homeTeamId, scope.awayTeamId];
  if (rosters.length !== 2 || new Set(rosters.map(row => row.teamId)).size !== 2 || rosters.some(row => !teamIds.includes(row.teamId)
    || row.seasonId !== scope.seasonId || Date.parse(row.availableAt) >= Date.parse(scope.featureCutoffAt))
    || new Set(rosters.flatMap(row => row.players.map(player => player.playerId))).size !== sum(rosters.map(row => row.players.length))
    || new Set(history.map(row => `${row.teamId}:${row.gameId}`)).size !== history.length) throw new Error("Invalid roster or history population/cutoff");
  for (const game of history) {
    const opposite = history.find(other => other.gameId === game.gameId && other.teamId !== game.teamId);
    if (opposite && (opposite.teamId !== game.opponentId || opposite.opponentId !== game.teamId || opposite.seasonId !== game.seasonId
      || Date.parse(opposite.startedAt) !== Date.parse(game.startedAt) || opposite.goalsFor !== game.goalsAgainst || opposite.goalsAgainst !== game.goalsFor
      || projectionInputHash(opposite.goalsForByCell) !== projectionInputHash(game.goalsAgainstByScoringCell)
      || opposite.players.some(player => game.players.some(member => member.playerId === player.playerId))))
      throw new Error("Opposite retained team-game identities or scorer-perspective counts differ");
  }
  const selected = history.filter(row => teamIds.includes(row.teamId));
  if (selected.some(row => row.seasonId !== scope.seasonId || row.gameId === scope.gameId
    || Date.parse(row.startedAt) >= Date.parse(scope.abilityCutoffAt) || Date.parse(row.availableAt) >= Date.parse(scope.abilityCutoffAt)))
    throw new Error("Training evidence outside current regular-season ability cutoff");
  if (teamIds.some(teamId => !selected.some(game => game.teamId === teamId))) throw new Error("Both team histories are required for comparable GOALS models");
  const models = RESEARCH_GAME_GOALS_MODELS.map(model => ({ model, teams: teamIds.map(teamId => teamKernel({ teamId, model,
    roster: rosters.find(row => row.teamId === teamId)!, history: selected.filter(game => game.teamId === teamId),
    opponentHistory: selected.filter(game => game.teamId !== teamId), pGamePlayed: scope.pGamePlayed })) }));
  return { version: RESEARCH_GAME_GOALS_VERSION, category: "GOALS", researchOnly: true, scope, parameters: RESEARCH_GAME_GOALS_PARAMETERS,
    models, comparisonBasis: "same_game_rosters_training_inputs_cutoffs_cells_and_given_game_played_means",
    gameOccurrenceBasis: scope.pGamePlayed === null ? "unmodeled" : "explicit_research_assumption",
    conditioningAssumption: "credited GOALS require positive official TOI; observed zero-TOI rows have zero GOALS",
    provenanceBasis: "retained_replay_or_caller_supplied_mechanics_fixture", sourceInputHash: projectionInputHash({ scope, history, rosters }),
    acceptanceEligible: false, productionReplacement: false, fullGameContractEligible: false,
    limitations: ["Marginal appearance probabilities are modeled, never confirmations or a joint feasible lineup.",
      "Roster snapshots/proxies do not prove game-time membership; the named residual is a model assumption, not an observed future contributor.",
      "Cell means are goals per played game/appearance, not PK minutes, OT opportunities or empty-net exposure rates.",
      "Complete player-season history, statistical-credit participation, canonical FHFH mappings and non-GOALS heads remain unproved.",
      "Fixed priors and cell allocation are unfitted research choices; predictive acceptance requires prospective evaluation."] };
}

/** Chronological outcome exclusion only. Later receipts make these folds retrospective algorithm diagnostics. */
export function evaluateResearchGoalChronologicalFolds(input: { history: ResearchGoalTeamGame[]; focalTeamIds: number[] }) {
  const history = input.history.map(game => historySchema.parse(game));
  if (new Set(history.map(game => `${game.teamId}:${game.gameId}`)).size !== history.length)
    throw new Error("Duplicate team-game in chronological research diagnostics");
  const folds = input.focalTeamIds.flatMap(teamId => {
    const own = history.filter(game => game.teamId === teamId).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    return own.slice(1).flatMap((actual, index) => {
      const training = own.slice(0, index + 1), roster = latestObservedResearchRoster(training);
      if (training.some(game => Date.parse(game.startedAt) >= Date.parse(actual.startedAt)))
        throw new Error("Chronological training games must start strictly before held-out game");
      const opponentHistory = history.filter(game => game.teamId === actual.opponentId && Date.parse(game.startedAt) < Date.parse(actual.startedAt));
      return RESEARCH_GAME_GOALS_MODELS.filter(model => model !== "opponent_blended" || opponentHistory.length > 0).map(model => {
        const prediction = teamKernel({ teamId, history: training, roster, opponentHistory, model, pGamePlayed: null });
        const actualFor = (playerId: number) => actual.players.find(player => player.playerId === playerId);
        const residualActual = sum(actual.players.filter(player => !roster.players.some(row => row.playerId === player.playerId)).map(player => player.officialGoals));
        return { teamId, gameId: actual.gameId, model, trainingGameIds: training.map(game => game.gameId),
          prediction, actualGoals: actual.goalsFor, teamAbsoluteError: Math.abs(prediction.goalMeanGivenGamePlayed - actual.goalsFor),
          actualResidualGoals: residualActual, residualAbsoluteError: Math.abs(prediction.residual.goalMeanGivenGamePlayed - residualActual),
          meanPlayerAbsoluteError: sum(prediction.players.map(player => Math.abs(player.goalMeanGivenGamePlayed - (actualFor(player.playerId)?.officialGoals ?? 0)))) / prediction.players.length,
          appearanceBrierScore: sum(prediction.players.map(player => (player.participation.positiveToiProbability - (actualFor(player.playerId)?.toiSeconds ? 1 : 0)) ** 2)) / prediction.players.length,
          observedLateReceiptInputs: training.filter(game => Date.parse(game.availableAt) >= Date.parse(actual.startedAt)).map(game => game.gameId),
          historicalPregameAvailabilityProved: training.every(game => Date.parse(game.availableAt) < Date.parse(actual.startedAt))
            && opponentHistory.every(game => Date.parse(game.availableAt) < Date.parse(actual.startedAt)),
          heldOutOutcomesUsedAsFeatures: false, forecastAcceptanceEvidence: false };
      });
    });
  });
  const comparable = folds.filter(fold => fold.model !== "opponent_blended");
  return { kind: "retrospective_chronological_algorithm_diagnostics", folds,
    comparableModels: ["empirical", "smoothed"], sameFoldSummaries: ["empirical", "smoothed"].map(model => {
      const rows = comparable.filter(fold => fold.model === model);
      return { model, folds: rows.length, teamMAE: rows.length ? sum(rows.map(row => row.teamAbsoluteError)) / rows.length : null,
        meanPlayerMAE: rows.length ? sum(rows.map(row => row.meanPlayerAbsoluteError)) / rows.length : null,
        meanAppearanceBrier: rows.length ? sum(rows.map(row => row.appearanceBrierScore)) / rows.length : null };
    }), forecastLift: "not_established", historicalForecastBacktestEligible: false,
    limitation: "Retained receipt times are honored as late; chronological outcome exclusion alone cannot establish historical pregame knowability." };
}
