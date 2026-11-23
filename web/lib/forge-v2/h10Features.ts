/**
 * FORGE Full-NHL H1–H10 shadow inputs for the existing v2 kernel-means model (`official-appearance-kernel-means-v1`).
 * No new model: one predeclared recipe over five matchup features. The features are the player's season-to-date
 * points, shots and physical rates (shrunk to declared priors), the opponent's goals-against rate and the venue, so
 * each of a player's ten games gets its own forecast. The recipe is unreviewed; every vintage says so in its
 * limitations, and `fitCandidate` (which requires an independently reviewed protocol) is not used.
 */
import { CATEGORIES, CONDITIONING, Category, CategoryMeans, Component, HorizonEpisode, Instant, LockEpoch, Opportunity, SourceReference, TARGET_VERSION, available, instant, unavailable } from "./contracts";
import { normalizeSourceBatch } from "./data";
import { contentHash } from "./hash.server";
import { DEFAULT_SCORING } from "./identity";
import { CandidateModel, CandidateRecipe, MODEL_ALGORITHM, ModelExample } from "./model";
import { PreparedIssuance } from "./pipeline.server";

export const H10_FEATURE_VERSION = "forge-h10-matchup-features-v1";
export const H10_PROTOCOL_ID = "forge-h10-shadow-predeclared-unreviewed-v1";
export const H10_COHORT = "forge-h10-shadow-skater";
export const H10_INTENDED_USE = "forge_h10_prospective_shadow";
export const H10_FEATURE_SOURCE = "fhfh-forge-h10-feature-builder";
export const H10_DENOMINATOR_SOURCE = "fhfh-forge-h10-denominator";
/** Declared priors (per game) and scales; shrinkage weight in games. Changing any of these is a new recipe. */
export const H10_PRIORS = { points: 0.45, shots: 1.7, physical: 2.4, goalsAgainst: 3.1, shrinkGames: 8 } as const;
export const H10_RECIPE: CandidateRecipe = {
  id: "forge-h10-matchup-kernel-v1",
  featureNames: ["player_points_rate", "player_shots_rate", "player_physical_rate", "opponent_goals_against_rate", "home"],
  bandwidth: 0.6, minimumSupport: 25,
};
export const H10_LIMITATIONS = ["predeclared_recipe_unreviewed", "no_model_selection_performed", "participation_not_modelled"] as const;

/** One official skater game line (one appearance), with the receipt of that row. */
export interface H10GameLog {
  playerId: number; gameId: number; seasonId: number; teamId: number; opponentId: number; home: boolean;
  gameStartAt: Instant;
  values: Record<Category, number | null>;
  source: SourceReference;
}

interface Rates { games: number; points: number; shots: number; physical: number }
const shrink = (sum: number, games: number, prior: number) => (sum + H10_PRIORS.shrinkGames * prior) / (games + H10_PRIORS.shrinkGames);
function features(player: Rates | undefined, opponent: { games: number; against: number } | undefined, home: boolean): Record<string, Component<number>> {
  const p = player ?? { games: 0, points: 0, shots: 0, physical: 0 }, o = opponent ?? { games: 0, against: 0 };
  return {
    player_points_rate: available(shrink(p.points, p.games, H10_PRIORS.points) / 1),
    player_shots_rate: available(shrink(p.shots, p.games, H10_PRIORS.shots) / 3),
    player_physical_rate: available(shrink(p.physical, p.games, H10_PRIORS.physical) / 4),
    opponent_goals_against_rate: available(shrink(o.against, o.games, H10_PRIORS.goalsAgainst) / 3),
    home: available(home ? 1 : 0),
  };
}

/** Season-to-date state from logs received by `cutoff` for games that started before it. */
export class H10RateState {
  readonly players = new Map<number, Rates>();
  readonly teams = new Map<number, { games: number; against: number }>();
  latestReceipt: SourceReference | null = null;
  static from(logs: readonly H10GameLog[], seasonId: number, cutoff: Instant): H10RateState {
    const state = new H10RateState(), at = instant(cutoff);
    state.add(logs.filter(row => row.seasonId === seasonId && instant(row.gameStartAt) < at && instant(row.source.firstReceivedAt) <= at));
    return state;
  }
  private readonly counted = new Set<string>();
  add(rows: readonly H10GameLog[]): void {
    for (const row of rows) {
      const p = this.players.get(row.playerId) ?? { games: 0, points: 0, shots: 0, physical: 0 };
      const v = row.values;
      p.games += 1; p.points += (v.G ?? 0) + (v.A ?? 0); p.shots += v.SOG ?? 0; p.physical += (v.HIT ?? 0) + (v.BLK ?? 0);
      this.players.set(row.playerId, p);
      // The opponent's goals against: every scorer's goals in that game, with the game counted once per team.
      const t = this.teams.get(row.opponentId) ?? { games: 0, against: 0 }, gameKey = `${row.gameId}:${row.opponentId}`;
      if (!this.counted.has(gameKey)) { this.counted.add(gameKey); t.games += 1; }
      t.against += v.G ?? 0; this.teams.set(row.opponentId, t);
      if (!this.latestReceipt || instant(row.source.firstReceivedAt) > instant(this.latestReceipt.firstReceivedAt)
        || row.source.firstReceivedAt === this.latestReceipt.firstReceivedAt && row.source.id > this.latestReceipt.id) this.latestReceipt = row.source;
    }
  }
  features(playerId: number, opponentId: number, home: boolean) { return features(this.players.get(playerId), this.teams.get(opponentId), home); }
}

const valuesOf = (row: H10GameLog): CategoryMeans | null => {
  const means = {} as CategoryMeans;
  for (const c of CATEGORIES) {
    const value = row.values[c];
    if (value === null) means[c] = unavailable("source_category_missing");
    else if (!Number.isSafeInteger(value) || value < 0) return null;
    else means[c] = available(value);
  }
  if (means.PPP.state === "available" && means.G.state === "available" && means.A.state === "available" && means.PPP.value > means.G.value + means.A.value) return null;
  return means;
};

/** Chronological training examples: each game's features use only games before it, and its source is the latest
 * receipt consumed. Examples whose outcome arrived after `asOf`, or with no prior receipt, are skipped and counted. */
export function buildH10Training(logs: readonly H10GameLog[], seasonId: number, asOf: Instant, maximumExamples: number) {
  const cutoff = instant(asOf), state = new H10RateState(), examples: ModelExample[] = [];
  const skipped = { outcomeAfterCutoff: 0, noPriorReceipt: 0, invalidValues: 0 };
  const season = logs.filter(r => r.seasonId === seasonId && instant(r.gameStartAt) < cutoff);
  // Rows enter the rate state in receipt order, so an example's features use only rows received by its own cutoff.
  const byReceipt = season.filter(r => instant(r.source.firstReceivedAt) <= cutoff)
    .sort((a, b) => instant(a.source.firstReceivedAt) - instant(b.source.firstReceivedAt) || a.gameId - b.gameId || a.playerId - b.playerId);
  const byCutoff = [...season].sort((a, b) => instant(a.gameStartAt) - instant(b.gameStartAt) || a.gameId - b.gameId || a.playerId - b.playerId);
  let next = 0, pending: H10GameLog[] = [];
  const admit = (until: number) => {
    while (next < byReceipt.length && instant(byReceipt[next].source.firstReceivedAt) <= until) pending.push(byReceipt[next++]);
    // Whole games enter together, so a team's goals against counts each game once.
    if (pending.length) { state.add(pending); pending = []; }
  };
  for (const row of byCutoff) {
    if (instant(row.source.firstReceivedAt) > cutoff) { skipped.outcomeAfterCutoff += 1; continue; }
    const values = valuesOf(row);
    if (!values) { skipped.invalidValues += 1; continue; }
    const inputCutoffAt = new Date(instant(row.gameStartAt) - 3600000).toISOString();
    admit(instant(inputCutoffAt));
    const prior = state.latestReceipt;
    if (!prior) { skipped.noPriorReceipt += 1; continue; }
    examples.push({ playerId: row.playerId, gameId: row.gameId, seasonId, targetVersion: TARGET_VERSION, conditioning: CONDITIONING,
      id: `h10-example:${row.playerId}:${row.gameId}`, inputCutoffAt, gameStartAt: row.gameStartAt, outcomeAvailableAt: row.source.firstReceivedAt,
      appearance: "official_appearance", features: state.features(row.playerId, row.opponentId, row.home), values, sources: [prior], outcomeSource: row.source });
  }
  examples.sort((a, b) => instant(b.gameStartAt) - instant(a.gameStartAt) || a.id.localeCompare(b.id));
  const training = examples.slice(0, maximumExamples).sort((a, b) => a.id.localeCompare(b.id));
  return { training, available: examples.length, skipped };
}

/** The predeclared recipe over the capped training set, available at `asOf`. No selection is performed; the
 * selection fields record the recipe and an empty development set. */
export function buildH10Model(training: ModelExample[], asOf: Instant): CandidateModel | null {
  if (training.length < H10_RECIPE.minimumSupport) return null;
  const dependencyAvailableAt = new Date(Math.max(...training.map(row => instant(row.outcomeAvailableAt)))).toISOString();
  const trainingHash = contentHash(training);
  return { algorithm: MODEL_ALGORITHM, version: contentHash({ algorithm: MODEL_ALGORITHM, recipe: H10_RECIPE, trainingHash, protocolId: H10_PROTOCOL_ID }),
    recipe: H10_RECIPE, training, evidence: "development_only", protocolId: H10_PROTOCOL_ID, fittedAt: asOf, availableAt: asOf, dependencyAvailableAt,
    selection: { kind: "development_mse", protocolHash: contentHash(H10_RECIPE), developmentDataHash: contentHash([]) } };
}

export interface H10PrepareConfig {
  evidenceClass: "fixture" | "prospective_shadow";
  approvalEvidenceId: string;
  approvedAt: Instant;
  codeVersion: string;
  denominatorSha256: string;
}

/** One key's prepared issuance: the feature record and the denominator record are the accepted sources. */
export function prepareH10Issuance(input: { scope: Opportunity; episode: HorizonEpisode; lock: LockEpoch; asOf: Instant; state: H10RateState; model: CandidateModel | null;
  config: H10PrepareConfig; predecessorId: string | null; opportunityPredecessor: Opportunity | null;
  /** Evidence behind a material revision (roster move, roster event), carried as accepted sources with no features. */
  evidence?: ReadonlyArray<{ source: SourceReference; payload: { features: Record<string, never> } & Record<string, unknown> }> }): PreparedIssuance {
  const { scope, asOf, config } = input;
  const identity = { playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, teamId: scope.teamId, mappingRevision: "nhl-official-ids", verified: true };
  const featurePayload = { features: input.state.features(scope.playerId, scope.opponentId, scope.home), lineage: { latestLogReceipt: input.state.latestReceipt?.sha256 ?? null, featureVersion: H10_FEATURE_VERSION } };
  const denominatorPayload = { features: {}, denominatorSha256: config.denominatorSha256 };
  const source = (name: string, id: string, payload: object): SourceReference => {
    const sha256 = contentHash(payload);
    return { id, revision: sha256, sha256, source: name, use: "approved", observedAt: asOf, publishedAt: null, firstReceivedAt: asOf };
  };
  const records = [
    { identity, source: source(H10_DENOMINATOR_SOURCE, `forge-h10-denominator:${config.denominatorSha256}`, denominatorPayload), payload: denominatorPayload },
    { identity, source: source(H10_FEATURE_SOURCE, `forge-h10-features:${scope.playerId}:${scope.gameId}`, featurePayload), payload: featurePayload },
  ];
  for (const row of input.evidence ?? []) records.push({ identity, source: row.source, payload: row.payload as never });
  const approvals = [...new Set(records.map(row => row.source.source))].map(name => ({ source: name, evidenceId: config.approvalEvidenceId, approvedAt: config.approvedAt, intendedUse: H10_INTENDED_USE }));
  const accepted = normalizeSourceBatch({ complete: true, expectedCount: records.length, pages: [{ index: 0, records }] },
    { cutoffAt: asOf, maximumAgeMs: 7 * 86400000, maximumRecords: 50, maximumPages: 1, intendedUse: H10_INTENDED_USE, approvals },
    (payload: { features?: unknown }) => typeof payload?.features === "object" && payload.features !== null);
  const sources = accepted.state === "available" ? accepted.records.map(row => row.source) : records.map(row => row.source);
  const limitations = [...H10_LIMITATIONS, ...(input.state.players.get(scope.playerId)?.games ?? 0) < H10_PRIORS.shrinkGames ? ["sparse_player_history_shrunk_to_prior"] : []];
  return {
    accepted: accepted as PreparedIssuance["accepted"],
    context: { playerId: scope.playerId, gameId: scope.gameId, seasonId: scope.seasonId, targetVersion: scope.targetVersion, conditioning: scope.conditioning,
      inputCutoffAt: asOf, features: featurePayload.features, sources, limitations },
    episode: input.episode, lock: input.lock, model: input.model, participationModel: null, calibration: null, scoring: DEFAULT_SCORING,
    featureVersion: H10_FEATURE_VERSION, codeVersion: config.codeVersion, cohort: H10_COHORT, evidenceClass: config.evidenceClass,
    // Means-only vintages: the per-issuance joint artifact holds one outcome per training row and hashes the whole
    // model, which does not scale to every NHL player-game (see the hosted packet).
    shadow: { approvalEvidenceId: config.approvalEvidenceId, omitJointDistribution: true },
    predecessorId: input.predecessorId,
    ...(input.opportunityPredecessor ? { opportunityPredecessor: input.opportunityPredecessor } : {}),
  };
}
