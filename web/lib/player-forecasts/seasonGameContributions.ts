import { checksumCanonicalJson, evaluatePortableSeasonGame, type PortableSeasonArtifact, type SeasonGameContext } from "../fantasy-projections/evaluator";
import { GOALIE_PRIMITIVE_TARGETS, SKATER_PRIMITIVE_TARGETS } from "../fantasy-projections/contracts";
import type { ContributionGame } from "./contributions";
import type { GameForecast } from "../rosterScheduleOptimizer/planningTypes";

export type SeasonGameBinding = ContributionGame & { opponentTeamId: number; isHome: boolean; observedAt: string };
const skaterTargets: Record<string, string[]> = { GOALS: ["GOALS"], ASSISTS: ["PRIMARY_ASSISTS", "SECONDARY_ASSISTS"],
  POINTS: ["GOALS", "PRIMARY_ASSISTS", "SECONDARY_ASSISTS"], PP_POINTS: ["PP_GOALS", "PP_ASSISTS"],
  SHOTS_ON_GOAL: ["SHOTS_ON_GOAL"], HITS: ["HITS"], BLOCKED_SHOTS: ["BLOCKED_SHOTS"],
  PENALTY_MINUTES: ["PENALTY_MINUTES"], TIME_ON_ICE_PER_GAME: ["TOTAL_TOI"] };
const goalieTargets: Record<string, string[]> = { SAVES_GOALIE: ["SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE"],
  GOALS_AGAINST_GOALIE: ["GOALS_AGAINST_GOALIE"], SHOTS_AGAINST_GOALIE: ["SHOTS_AGAINST_GOALIE"],
  WINS_GOALIE: ["WINS_GOALIE"], SHUTOUTS_GOALIE: ["SHUTOUTS_GOALIE"], GOALIE_MINUTES: ["TOTAL_TOI"] };
const probability = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

/** Offline producer reuse only. Candidates remain denied until existing native admission approves them.
 * Season count means are conditional on appearance (including goalie relief); pStart is separate. */
export function prepareSeasonGameContribution(artifact: PortableSeasonArtifact, binding: SeasonGameBinding,
  issuedAt: string, expiresAt: string, now = new Date()) {
  const prior = artifact.players[String(binding.playerId)];
  const clock = [artifact.trainingCutoffAt, binding.observedAt, issuedAt, expiresAt, binding.scheduledAt].map(Date.parse);
  if (!prior || prior.fhfhPlayerId !== binding.playerId || prior.nhlPlayerId !== binding.nhlPlayerId || prior.teamId !== binding.teamId || artifact.seasonId !== binding.seasonId
    || ![binding.playerId, binding.nhlPlayerId, binding.teamId, binding.gameId, binding.opponentTeamId].every(value => Number.isSafeInteger(value) && value > 0)
    || !binding.scheduleRevision?.trim() || !binding.rosterRevision?.trim() || typeof binding.isHome !== "boolean"
    || clock.some(value => !Number.isFinite(value)) || clock[0] > clock[1] || clock[1] > clock[2]
    || clock[2] > now.getTime() || clock[2] >= clock[3] || clock[3] > clock[4] || clock[3] <= now.getTime()) {
    throw new Error("Season preview requires exact artifact identity, original cutoff and pregame binding clocks.");
  }
  if (prior.population === "goalie") {
    const rates = prior.conditionalRates;
    if (Number.isFinite(rates.SHOTS_AGAINST_GOALIE) && Number.isFinite(rates.GOALS_AGAINST_GOALIE)
      && rates.GOALS_AGAINST_GOALIE > rates.SHOTS_AGAINST_GOALIE) {
      throw new Error("Original season goalie rates violate count consistency before evaluation.");
    }
  }
  const game: SeasonGameContext = { gameId: binding.gameId, teamId: binding.teamId, opponentTeamId: binding.opponentTeamId,
    scheduledStartAt: binding.scheduledAt, isHome: binding.isHome };
  const evaluation = evaluatePortableSeasonGame(artifact, binding.playerId, game);
  const targets = prior.population === "goalie" ? goalieTargets : skaterTargets;
  const primitives = new Set(prior.primitiveTargets ?? (prior.population === "goalie" ? GOALIE_PRIMITIVE_TARGETS : SKATER_PRIMITIVE_TARGETS));
  const conditionalStats: Record<string, number | null> = {}, stats: Record<string, number | null> = {};
  const missingTargets: Array<{ targetKey: string; reasons: string[] }> = [];
  const appearance = probability(prior.playProbability) ? prior.playProbability : null;
  const start = prior.population === "goalie" && probability(prior.startProbability) && appearance !== null
    && prior.startProbability <= appearance ? prior.startProbability : null;
  for (const [target, required] of Object.entries(targets)) {
    const supported = required.every(key => primitives.has(key) && typeof prior.conditionalRates[key] === "number"
      && Number.isFinite(prior.conditionalRates[key]) && prior.conditionalRates[key] >= 0);
    const key = target === "TIME_ON_ICE_PER_GAME" || target === "GOALIE_MINUTES" ? "TOTAL_TOI" : target;
    const divisor = key === "TOTAL_TOI" ? 60 : 1;
    const conditional = supported ? evaluation.conditionalMeans[key] : undefined;
    const expected = supported && appearance !== null ? evaluation.unconditionalMeans[key] : undefined;
    conditionalStats[target] = typeof conditional === "number" && Number.isFinite(conditional) ? conditional / divisor : null;
    stats[target] = typeof expected === "number" && Number.isFinite(expected) ? expected / divisor : null;
    if (stats[target] === null) missingTargets.push({ targetKey: target, reasons: [!supported ? "missing_artifact_target" : "unknown_appearance_probability"] });
  }
  if (prior.population === "goalie") {
    const saves = stats.SAVES_GOALIE, against = stats.GOALS_AGAINST_GOALIE, shots = stats.SHOTS_AGAINST_GOALIE;
    if (shots !== null && against !== null && against > shots
      || saves !== null && shots !== null && against !== null && Math.abs(saves + against - shots) > 1e-8
      || ["WINS_GOALIE", "SHUTOUTS_GOALIE"].some(target => conditionalStats[target] !== null && conditionalStats[target]! > 1)
      || conditionalStats.GOALIE_MINUTES !== null && conditionalStats.GOALIE_MINUTES > 65) {
      throw new Error("Season goalie primitives violate count, probability or minute consistency.");
    }
  }
  const artifactChecksum = checksumCanonicalJson(artifact);
  const revisionId = `season-game-preview:${checksumCanonicalJson({ artifactChecksum, binding, issuedAt, expiresAt })}`;
  const limitations = ["Unreleased seasonal producer preview; native admission and publication remain required.",
    `Original artifact training cutoff: ${artifact.trainingCutoffAt}; this is not a fresh native source capture.`,
    "Counts use appearance-conditional rates multiplied once by appearance probability; goalie pStart is separate and no relief minutes are invented."];
  const forecast: GameForecast = { playerId: String(binding.playerId), gameId: String(binding.gameId), stats, conditionalStats,
    conditioning: "unconditional", sourceKind: "detailed", sourceWatermark: artifactChecksum,
    appearanceProbability: appearance, startProbability: start, confirmedStart: false, revisionId,
    modelVersion: artifact.artifactVersion, issuedAt, cutoffAt: artifact.trainingCutoffAt, expiresAt,
    allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false }, limitations,
    issuedContext: { version: "forge-issued-context-v1", playerId: String(binding.playerId), gameId: String(binding.gameId),
      nhlPlayerId: binding.nhlPlayerId, seasonId: binding.seasonId, teamId: binding.teamId,
      scheduledAt: binding.scheduledAt, scheduleRevision: binding.scheduleRevision, rosterRevision: binding.rosterRevision,
      observedAt: binding.observedAt, scheduleFetchedAt: null, scheduleSourceUpdatedAt: null, identityUpdatedAt: null, membershipCreatedAt: [] } };
  return { forecast, artifactChecksum, componentHash: evaluation.componentHash, missingTargets,
    participation: { appearance, start, calibration: "unverified" as const }, released: false as const };
}
