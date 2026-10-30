import type { NextApiRequest, NextApiResponse } from "next";
import { CATEGORIES, Component, HistoryEvent, LockEpoch, Opportunity, OutcomeRevision, PublicAccountability, PublicGameView, PublicPlayerView, PublicRevision, PublishedVintage, QualificationManifest, ScoringProfile, available, assertSource, assertTarget, instant, unavailable } from "./contracts";
import { canonicalJson, DEFAULT_SCORING, scoreMeans, targetKey } from "./identity";
import { contentHash } from "./hash.server";
import { FileArtifactStore } from "./artifacts.server";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { QualificationEvidence, assessQualification, qualifiedMeans, qualifiedParticipation } from "./qualification";
import { CalibrationArtifact, JointDistribution, reproduceIntervals } from "./uncertainty";
import { publicationEligibility } from "./evaluation";
import { ForgeReadRepository, Methodology, executeRead, parseReadRequest } from "./api";

export interface GameReadContext {
  opportunity: Opportunity;
  epochs: LockEpoch[];
  latestVintageId: string | null;
  finalVintageId: string | null;
  outcome: OutcomeRevision | null;
  events: HistoryEvent[];
  freshness: PublicGameView["freshness"];
}
export interface PreparedPlayerContext {
  id: string;
  player: { id: number; name: string };
  publicApproved: boolean;
  asOf: string;
  games: GameReadContext[];
  excluded: PublicPlayerView["excluded"];
  qualifications: Array<{ manifest: QualificationManifest; evidence: QualificationEvidence[] }>;
  accountability: PublicAccountability;
}
export interface ContextReader {
  players(query: string): Promise<Array<{ id: number; name: string }>>;
  read(playerId: number, contextId?: string): Promise<PreparedPlayerContext | null>;
  readGame(playerId: number, gameId: number, contextId?: string): Promise<PreparedPlayerContext | null>;
}

/** Only the offline preparation lane writes read_context records; this reader has no writes. */
export class PostgresContextReader implements ContextReader {
  constructor(private readonly db: SqlConnection) {}
  async players(query: string): Promise<Array<{ id: number; name: string }>> {
    const { rows } = await this.db.query<{ id: string; name: string }>(`select (payload::jsonb->'player'->>'id') as id,payload::jsonb->'player'->>'name' as name from
      (select distinct on (scope_key) payload from forge_v2_private.forge_v2_records where kind='read_context' order by scope_key,ordinal desc) latest
      where payload::jsonb->>'publicApproved'='true' and strpos(lower(payload::jsonb->'player'->>'name'),lower($1))>0 order by name,id limit 25`, [query]);
    return rows.map(row => ({ id: Number(row.id), name: row.name }));
  }
  async read(playerId: number, contextId?: string): Promise<PreparedPlayerContext | null> {
    return this.lookup(playerId, contextId);
  }
  async readGame(playerId: number, gameId: number, contextId?: string): Promise<PreparedPlayerContext | null> {
    return this.lookup(playerId, contextId, gameId);
  }
  private async lookup(playerId: number, contextId?: string, gameId?: number): Promise<PreparedPlayerContext | null> {
    const values: unknown[] = [`player:${playerId}`];
    const filters = [];
    if (contextId) { values.push(contextId); filters.push(`and id=$${values.length}`); }
    if (gameId) { values.push(JSON.stringify([{ opportunity: { gameId } }])); filters.push(`and payload::jsonb->'games' @> $${values.length}::jsonb`); }
    const { rows } = await this.db.query<{ payload: string; content_hash: string }>(`select payload,content_hash from forge_v2_private.forge_v2_records where kind='read_context' and scope_key=$1 ${filters.join(" ")} order by ordinal desc limit 1`, values);
    if (!rows[0]) return null;
    if (Buffer.byteLength(rows[0].payload) > 2 * 1024 * 1024) throw new Error("Prepared context exceeds capacity");
    const context = JSON.parse(rows[0].payload) as PreparedPlayerContext;
    if (contentHash(context) !== rows[0].content_hash || context.player.id !== playerId || contextId && context.id !== contextId) throw new Error("Prepared context identity mismatch");
    return context;
  }
}

function qualification(context: PreparedPlayerContext, row: PublishedVintage) {
  return context.qualifications.find(q => q.manifest.id === row.vintage.qualificationId) ?? { manifest: null, evidence: [] };
}

function publicNumber(value: Component<number>): Component<number> {
  return value.state === "available" && Number.isFinite(value.value) ? available(value.value) : unavailable(value.state === "unavailable" ? value.reason : "invalid_number");
}

export async function projectRevision(row: PublishedVintage, context: PreparedPlayerContext, game: GameReadContext, profile: ScoringProfile, artifacts: FileArtifactStore): Promise<PublicRevision> {
  const { vintage: v, receipt } = row;
  if (targetKey(v) !== targetKey(game.opportunity)) throw new Error("History target mismatch");
  if (instant(receipt.confirmedAt) > instant(context.asOf)) throw new Error("Publication exceeds prepared read cutoff");
  const q = qualification(context, row), means = qualifiedMeans(v, q.manifest, q.evidence, profile);
  let intervals: PublicRevision["intervals"] = unavailable("uncertainty_not_qualified");
  let artifactState: PublicRevision["artifactState"] = "unavailable";
  if (assessQualification(v, q.manifest, q.evidence, profile).state === "available" && v.distribution.state === "available" && v.calibration.state === "available") {
    const [joint, calibration] = await Promise.all([artifacts.read(v.distribution.value), artifacts.read(v.calibration.value)]);
    if (joint.state === "available" && calibration.state === "available") {
      intervals = reproduceIntervals(v, profile, q.manifest, q.evidence,
        { reference: joint.reference, payload: JSON.parse(joint.bytes) as JointDistribution },
        { reference: calibration.reference, payload: JSON.parse(calibration.bytes) as CalibrationArtifact });
      artifactState = joint.location === "archived" || calibration.location === "archived" ? "archived" : "online";
    } else intervals = unavailable(joint.state === "unavailable" ? joint.reason : calibration.state === "unavailable" ? calibration.reason : "artifact_unavailable");
  }
  return {
    id: v.id, sequence: v.sequence, publishedAt: receipt.confirmedAt, inputCutoffAt: v.inputCutoffAt, horizon: v.horizon, teamId: v.teamId,
    modelVersion: v.modelVersion, trigger: v.trigger, evidenceClass: v.evidenceClass, value: scoreMeans(means, profile), qualified: assessQualification(v, q.manifest, q.evidence, profile).state === "available",
    issuedValue: scoreMeans(qualifiedMeans(v, q.manifest, q.evidence, v.scoring), v.scoring), issuedProfileId: v.scoring.id,
    means: Object.fromEntries(CATEGORIES.map(c => [c, publicNumber(means[c])])) as typeof means, participation: publicNumber(qualifiedParticipation(v, q.manifest, q.evidence)), intervals, intervalVintageId: v.id,
    eligiblePregame: publicationEligibility(row, game.epochs, context.asOf) === null, artifactState,
    limitations: [...v.limitations, ...(intervals.state === "unavailable" ? [intervals.reason] : [])],
  };
}

function assertContext(context: PreparedPlayerContext): void {
  instant(context.asOf);
  if (!context.id || !context.player.name || context.player.name.length > 200 || !context.publicApproved || context.games.length > 10 || new Set(context.games.map(g => g.opportunity.gameId)).size !== context.games.length) throw new Error("Invalid prepared player context");
  for (const game of context.games) {
    assertTarget(game.opportunity);
    if (game.opportunity.playerId !== context.player.id || game.epochs.length > 100 || game.events.length > 10000) throw new Error("Prepared scope capacity exceeded");
    if (instant(game.opportunity.observedAt) > instant(context.asOf) || game.epochs.some(e => e.gameId !== game.opportunity.gameId || instant(e.adoptedAt) > instant(context.asOf)) || game.events.some(e => targetKey(e) !== targetKey(game.opportunity) || instant(e.at) > instant(context.asOf))) throw new Error("Prepared observation scope or clock mismatch");
    if (game.outcome) {
      if (targetKey(game.outcome) !== targetKey(game.opportunity) || instant(game.outcome.recordedAt) > instant(context.asOf)) throw new Error("Prepared outcome scope or clock mismatch");
      assertSource(game.outcome.source, context.asOf);
    }
  }
}
interface PageCursor { contextId: string; profileId: string; playerId: number; gameId: number; revisions: string | null; revisionDone: boolean; eventOffset: number }

/** All reads are bounded projections of prepared records. No inference, fitting or acquisition. */
export class PreparedForgeReadRepository implements ForgeReadRepository {
  constructor(private readonly contexts: ContextReader, private readonly store: PostgresHistoryStore, private readonly artifacts: FileArtifactStore) {}
  async players(query: string) { return this.contexts.players(query); }
  async player(playerId: number, profile: ScoringProfile): Promise<PublicPlayerView | null> {
    const context = await this.contexts.read(playerId);
    if (!context?.publicApproved) return null;
    assertContext(context);
    const games: PublicGameView[] = [];
    for (const game of context.games) games.push(await this.gameView(context, game, profile));
    return { player: { id: context.player.id, name: context.player.name }, games, excluded: context.excluded.map(x => ({ gameId: x.gameId, reason: x.reason })), profile,
      scoringLabel: profile.id === DEFAULT_SCORING.id ? "as issued" : "re-scored under selected profile", methodology: "Conditional on official appearance; participation is separate. Revision shading is not probability.", accountability: this.publicAccountability(context.accountability, profile) };
  }
  private publicAccountability(value: PublicAccountability, profile: ScoringProfile): PublicAccountability {
    const metric = (number: Component<number>) => profile.id === DEFAULT_SCORING.id ? publicNumber(number) : unavailable("profile_metrics_unavailable");
    return { requested: value.requested, forecastCount: value.forecastCount, outcomeCount: value.outcomeCount, abstentions: value.abstentions, mae: metric(value.mae), rmse: metric(value.rmse), bias: metric(value.bias), evidenceClass: value.evidenceClass, limitations: [...value.limitations, ...(profile.id === DEFAULT_SCORING.id ? [] : ["Metrics have not been prepared for the selected scoring profile"])] };
  }
  async accountability(playerId: number, profile: ScoringProfile) {
    const context = await this.contexts.read(playerId);
    return context?.publicApproved ? this.publicAccountability(context.accountability, profile) : null;
  }
  async methodology(): Promise<Methodology> { return { version: "forge-v2-methodology-v1", publicEnabled: false, qualification: "No qualified release is registered", categories: [...CATEGORIES], horizons: "Next ten distinct scheduled regular-season games", conditioning: "Official appearance, conditional on game occurring", limitations: ["Scientific qualification and separate public release remain required"] }; }

  async history(playerId: number, gameId: number, profile: ScoringProfile, cursor?: string): Promise<PublicGameView | null> {
    let page: PageCursor | undefined;
    if (cursor) {
      if (cursor.length > 24576 || !/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error("Invalid history cursor");
      page = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as PageCursor;
      if (page.playerId !== playerId || page.gameId !== gameId || page.profileId !== profile.id || !page.contextId || !Number.isSafeInteger(page.eventOffset) || page.eventOffset < 0 || typeof page.revisionDone !== "boolean") throw new Error("History cursor scope mismatch");
    }
    const context = await this.contexts.readGame(playerId, gameId, page?.contextId);
    if (!context?.publicApproved) return null;
    assertContext(context);
    const game = context.games.find(g => g.opportunity.gameId === gameId);
    return game ? this.gameView(context, game, profile, page) : null;
  }

  private async gameView(context: PreparedPlayerContext, game: GameReadContext, profile: ScoringProfile, cursor?: PageCursor): Promise<PublicGameView> {
    const page = cursor?.revisionDone ? { revisions: [], nextCursor: null } : await this.store.history(context.player.id, game.opportunity.gameId, 100, cursor?.revisions ?? undefined);
    const revisions: PublicRevision[] = [];
    for (const row of page.revisions) if (instant(row.receipt.confirmedAt) <= instant(context.asOf)) revisions.push(await projectRevision(row, context, game, profile, this.artifacts));
    // Overview/current markers are explicit; they do not silently replace a page of history.
    const current = game.latestVintageId ? await this.store.get(game.latestVintageId) : null;
    revisions.sort((a, b) => instant(a.publishedAt) - instant(b.publishedAt) || a.sequence - b.sequence || a.id.localeCompare(b.id));
    const selected = game.finalVintageId ? await this.store.get(game.finalVintageId) : null;
    const epoch = [...game.epochs].sort((a, b) => instant(a.adoptedAt) - instant(b.adoptedAt)).at(-1);
    const lockAt = epoch?.lockAt ?? game.opportunity.scheduledStartAt;
    const pending = instant(context.asOf) < instant(lockAt) && !epoch?.playBegun;
    const finalValid = selected && publicationEligibility(selected, game.epochs, context.asOf) === null && targetKey(selected.vintage) === targetKey(game.opportunity);
    const finalValue = finalValid ? (await projectRevision(selected, context, game, profile, this.artifacts)).value : unavailable(pending ? "lock_pending" : "final_unavailable");
    const q = current ? qualification(context, current) : { manifest: null, evidence: [] };
    const decision = current ? assessQualification(current.vintage, q.manifest, q.evidence, profile) : unavailable("no_forecast");
    const eventOffset = cursor?.eventOffset ?? 0, events = game.events.slice(eventOffset, eventOffset + 100);
    const hasMore = page.nextCursor !== null || eventOffset + events.length < game.events.length;
    const nextCursor = hasMore ? Buffer.from(canonicalJson({ contextId: context.id, profileId: profile.id, playerId: context.player.id, gameId: game.opportunity.gameId, revisions: page.nextCursor, revisionDone: page.nextCursor === null, eventOffset: eventOffset + events.length })).toString("base64url") : null;
    const outcome = game.outcome;
    const actual: Component<number> = outcome && targetKey(outcome) === targetKey(game.opportunity) && outcome.appearance === "official_appearance" && outcome.status !== "pending" && outcome.source.use === "approved"
      ? scoreMeans(outcome.values, profile) : unavailable(outcome?.appearance ?? "outcome_pending");
    const o = game.opportunity;
    return { profileId: profile.id, opportunity: { id: o.id, playerId: o.playerId, gameId: o.gameId, seasonId: o.seasonId, targetVersion: o.targetVersion, conditioning: o.conditioning, teamId: o.teamId, opponentId: o.opponentId, home: o.home, horizon: o.horizon, observedAt: o.observedAt, scheduleRevision: o.scheduleRevision, affiliationRevision: o.affiliationRevision, scheduledStartAt: o.scheduledStartAt, sourceGameDate: o.sourceGameDate }, latestRevision: current ? await projectRevision(current, context, game, profile, this.artifacts) : null,
      lockedFinalRevision: finalValid ? await projectRevision(selected, context, game, profile, this.artifacts) : null,
      revisions, events: events.map(e => ({ id: e.id, playerId: e.playerId, gameId: e.gameId, seasonId: e.seasonId, targetVersion: e.targetVersion, conditioning: e.conditioning, at: e.at, kind: e.kind, reason: e.reason, vintageId: e.vintageId, predecessorId: e.predecessorId })), nextCursor,
      lockedFinal: { state: pending ? "pending" : finalValid ? "selected" : "unavailable", vintageId: finalValid ? selected.vintage.id : null, value: finalValue, lockAt, timingStatus: epoch?.timingStatus ?? "provisional", reason: finalValue.state === "unavailable" ? finalValue.reason : null },
      actual: { revisionId: outcome?.id ?? null, appearance: outcome?.appearance ?? "pending", value: actual, status: outcome?.status ?? "pending" },
      freshness: { state: game.freshness.state, asOf: game.freshness.asOf, reason: game.freshness.reason }, qualification: { state: decision.state === "available" ? "qualified" : "unqualified", reason: decision.state === "unavailable" ? decision.reason : decision.value.scope, supportedHorizons: decision.state === "available" ? [...q.manifest!.horizons] : [], supportedCategories: decision.state === "available" ? [...q.manifest!.categories] : [] } };
  }
}

/** The production wrapper always supplies enabled:false until a separately reviewed release. */
export function createForgeReadHandler(options: { enabled: boolean; repository: ForgeReadRepository | null }) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!options.enabled) return res.status(404).json({ error: "not_available" });
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "method_not_allowed" }); }
    let request;
    try { request = parseReadRequest(req.query); } catch { return res.status(400).json({ error: "invalid_request" }); }
    if (!options.repository) return res.status(503).json({ error: "prepared_data_unavailable" });
    try {
      const result = await executeRead(options.repository, request);
      if (result === null) return res.status(404).json({ error: "not_available" });
      const bytes = canonicalJson(result);
      if (Buffer.byteLength(bytes) > 1024 * 1024) return res.status(503).json({ error: "response_capacity_exceeded" });
      res.setHeader("ETag", `"${contentHash({ request, result })}"`);
      return res.status(200).json(result);
    } catch { return res.status(503).json({ error: "prepared_data_unavailable" }); }
  };
}
