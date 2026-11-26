/**
 * Goalie if-starts issuance for the FORGE H1–H10 shadow. Writes go to the proposed `forge_v2_goalie_vintages` and
 * `forge_v2_goalie_publication_receipts` tables (migration 20261123200000, not applied). The same idempotency rules as
 * the skater store apply: a UNIQUE issuance key, server-owned hash readback, a committed-readback receipt and
 * immutable rows. A retry with the same bytes is a no-op; different bytes fail closed.
 */
import { Instant, ScheduleGame, SourceReference, instant } from "./contracts";
import { FrozenDenominator, ForecastRow, measureCoverage } from "./denominator";
import { canonicalJson } from "./identity";
import { contentHash } from "./hash.server";
import { SqlConnection } from "./history.server";
import { easternDate, MaterialEvent } from "./refresh";
import { H10GameLog } from "./h10Features";
import { assertGoalieVintage, buildGoalieTraining, GOALIE_CATEGORIES, GOALIE_RECIPE, GOALIE_CONDITIONING, GOALIE_FEATURE_VERSION, GOALIE_TARGET_VERSION, GoalieRateState,
  goalieKernelMeans, goalieModelVersion, GoalieVintage, H10GoalieLog } from "./h10Goalies";
import { H10_DENOMINATOR_SOURCE, H10_FEATURE_SOURCE } from "./h10Features";

const V = "forge_v2_private.forge_v2_goalie_vintages", R = "forge_v2_private.forge_v2_goalie_publication_receipts";

export class PostgresGoalieStore {
  constructor(private readonly db: SqlConnection) {}
  async reserveSequence(): Promise<number> {
    const { rows } = await this.db.query<{ sequence: string }>("select nextval('forge_v2_private.forge_v2_issuance_sequence')::text as sequence");
    return Number(rows[0].sequence);
  }
  async getDraft(issuanceKey: string): Promise<GoalieVintage | null> {
    const { rows } = await this.db.query<{ payload: string; output_hash: string }>(`select payload, output_hash from ${V} where issuance_key = $1`, [issuanceKey]);
    if (!rows[0]) return null;
    const vintage = JSON.parse(rows[0].payload) as GoalieVintage;
    if (contentHash(vintage) !== rows[0].output_hash) throw new Error("Corrupt stored goalie draft");
    return vintage;
  }
  async publish(vintage: GoalieVintage): Promise<{ confirmedAt: Instant }> {
    assertGoalieVintage(vintage);
    const payload = canonicalJson(vintage), hash = contentHash(vintage);
    await this.db.query(`insert into ${V} (id, issuance_key, issuance_sequence, player_id, game_id, payload) values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
      [vintage.id, vintage.issuanceKey, vintage.sequence, vintage.playerId, vintage.gameId, payload]);
    const stored = await this.db.query<{ id: string; output_hash: string }>(`select id, output_hash from ${V} where issuance_key = $1`, [vintage.issuanceKey]);
    if (stored.rows[0]?.id !== vintage.id || stored.rows[0]?.output_hash !== hash) throw new Error("Idempotency conflict: issuance bytes changed");
    await this.db.query(`insert into ${R} (vintage_id, output_hash, confirmed_at, witness) values ($1, $2, clock_timestamp(), 'committed_readback') on conflict do nothing`, [vintage.id, hash]);
    const receipt = await this.db.query<{ confirmed_at: Date | string }>(`select r.confirmed_at from ${R} r join ${V} v on v.id = r.vintage_id and v.output_hash = r.output_hash where r.vintage_id = $1`, [vintage.id]);
    if (!receipt.rows[0]) throw new Error("Goalie publication acknowledgement unavailable");
    return { confirmedAt: new Date(receipt.rows[0].confirmed_at).toISOString() };
  }
}

export interface H10GoalieRunInput {
  db: SqlConnection; denominator: FrozenDenominator; schedule: readonly ScheduleGame[]; skaterLogs: readonly H10GameLog[]; goalieLogs: readonly H10GoalieLog[];
  clock: () => Instant; trigger: "daily" | { material: MaterialEvent[] }; stopAfterMs?: number; maximumKeys?: number;
  config: { evidenceClass: "fixture" | "prospective_shadow"; approvalEvidenceId: string; codeVersion: string; maximumTrainingExamples: number };
  evidence?: ReadonlyMap<number, Array<{ source: SourceReference }>>;
  /** Waits before each publish retry of the same vintage (default 1 s, then 4 s): three attempts in all. */
  retryDelaysMs?: readonly number[];
}
/** A publish error (a transient database fault) is retried within the call on the same vintage object, so a retry
 * republishes identical bytes: the vintage insert is first-write-wins with a byte readback, and the receipt is unique,
 * so there is never a second edition. After the last attempt the key is a named gap, `publish_failed:<error>`. */
export const GOALIE_PUBLISH_RETRY_DELAYS_MS = [1000, 4000] as const;

export async function runH10GoalieIssuance(input: H10GoalieRunInput) {
  const { denominator } = input, asOf = denominator.asOf!;
  if (input.config.evidenceClass === "prospective_shadow" && !input.config.approvalEvidenceId.trim()) throw new Error("goalie_shadow_requires_approval");
  const games = new Map(input.schedule.map(g => [g.gameId, g])), store = new PostgresGoalieStore(input.db), date = easternDate(asOf);
  const events = input.trigger === "daily" ? null : input.trigger.material;
  const keys = denominator.keys.filter(k => k.playerClass === "goalie" && (!events || events.some(e => e.affected.playerIds?.includes(k.playerId))));
  const { training, available, skipped } = buildGoalieTraining(input.skaterLogs, input.goalieLogs, denominator.seasonId, asOf, input.config.maximumTrainingExamples);
  const state = GoalieRateState.from(input.skaterLogs, input.goalieLogs, denominator.seasonId, asOf), modelVersion = goalieModelVersion(training);
  const denominatorPayload = { features: {}, denominatorSha256: denominator.denominatorSha256 };
  const source = (name: string, id: string, payload: unknown): SourceReference => { const sha256 = contentHash(payload); return { id, revision: sha256, sha256, source: name, use: "approved", observedAt: asOf, publishedAt: null, firstReceivedAt: asOf }; };
  const report = { keys: keys.length, published: 0, reused: 0, gaps: [] as Array<{ playerId: number; gameId: number; reason: string }>, numeric: 0, nonNumeric: 0,
    training: { examples: training.length, available, skipped, modelVersion }, complete: false };
  const delays = input.retryDelaysMs ?? GOALIE_PUBLISH_RETRY_DELAYS_MS;
  // Nightly: a retry wait that would cross the budget ends the phase instead (the next call republishes the stored draft).
  const DEADLINE = "deadline";
  const publish = async (vintage: GoalieVintage): Promise<string | null> => {
    for (let attempt = 0; ; attempt++) {
      try { await store.publish(vintage); return null; }
      catch (error) {
        if (attempt >= delays.length) return `publish_failed:${(error instanceof Error ? error.message : "unknown").slice(0, 60)}`;
        // The first key of a call always finishes its retries, so every call makes progress.
        if (!events && processed > 1 && input.stopAfterMs !== undefined && Date.now() + delays[attempt] > input.stopAfterMs) return DEADLINE;
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  };
  // Too few goalie starts to support the recipe: report every key as a gap and write nothing, so tonight's keys stay free.
  if (training.length < GOALIE_RECIPE.minimumSupport) {
    report.gaps = keys.map(k => ({ playerId: k.playerId, gameId: k.gameId, reason: "goalie_training_below_minimum_support" }));
    report.complete = true;
    return report;
  }
  let processed = 0;
  for (const key of [...keys].sort((a, b) => a.teamId - b.teamId || a.horizon - b.horizon || a.playerId - b.playerId)) {
    if (input.maximumKeys !== undefined && processed >= input.maximumKeys || input.stopAfterMs !== undefined && processed > 0 && Date.now() > input.stopAfterMs) return report;
    processed += 1;
    const game = games.get(key.gameId);
    if (!game || key.opponentId === null || key.home === null || !key.scheduledStartAt) { report.gaps.push({ playerId: key.playerId, gameId: key.gameId, reason: "schedule_fields_missing" }); continue; }
    if (instant(input.clock()) >= instant(key.scheduledStartAt)) { report.gaps.push({ playerId: key.playerId, gameId: key.gameId, reason: "issuance_lock_closed" }); continue; }
    const issuanceKey = events ? `goalie-material:${contentHash(events.map(e => e.id).sort()).slice(0, 16)}:${key.playerId}:${key.gameId}` : `goalie-daily:${date}:${key.playerId}:${key.gameId}`;
    const existing = await store.getDraft(issuanceKey);
    if (existing) {
      const failed = await publish(existing);
      if (failed === DEADLINE) return report;
      if (failed) report.gaps.push({ playerId: key.playerId, gameId: key.gameId, reason: failed }); else report.reused += 1;
      continue;
    }
    const features = state.features(key.playerId, key.teamId, key.opponentId, key.home);
    const { means, support } = goalieKernelMeans(training, features, key.gameId, asOf);
    const featurePayload = { features, lineage: { latestReceipt: state.latestReceipt?.sha256 ?? null, featureVersion: GOALIE_FEATURE_VERSION, support } };
    const prior = await input.db.query<{ id: string }>(`select v.id from ${V} v join ${R} r on r.vintage_id = v.id where v.player_id = $1 and v.game_id = $2 order by v.issuance_sequence desc limit 1`, [key.playerId, key.gameId]);
    const generatedAt = input.clock(), sequence = await store.reserveSequence();
    const vintage: GoalieVintage = {
      id: `goalie-vintage:${contentHash(issuanceKey)}`, issuanceKey, sequence, playerId: key.playerId, gameId: key.gameId, seasonId: key.seasonId,
      targetVersion: GOALIE_TARGET_VERSION, conditioning: GOALIE_CONDITIONING, teamId: key.teamId, opponentId: key.opponentId, home: key.home, horizon: key.horizon,
      scheduleRevision: key.scheduleRevision ?? "unknown", affiliationRevision: key.affiliationRevision ?? "unknown", sourceGameDate: game.sourceGameDate, scheduledStartAt: key.scheduledStartAt,
      inputCutoffAt: asOf, generatedAt, means, startProbability: { state: "unavailable", reason: "start_probability_not_modelled" },
      modelVersion, featureVersion: GOALIE_FEATURE_VERSION, codeVersion: input.config.codeVersion, cohort: "forge-h10-shadow-goalie",
      sourceManifest: [source(H10_DENOMINATOR_SOURCE, `forge-h10-denominator:${denominator.denominatorSha256}`, denominatorPayload),
        source(H10_FEATURE_SOURCE, `forge-h10-goalie-features:${key.playerId}:${key.gameId}`, featurePayload), ...(input.evidence?.get(key.playerId) ?? []).map(e => e.source)],
      trigger: events ? "material" : "daily", predecessorId: prior.rows[0]?.id ?? null, evidenceClass: input.config.evidenceClass,
      limitations: ["predeclared_recipe_unreviewed", "no_model_selection_performed", "if_starts_conditional_start_probability_not_modelled",
        input.config.evidenceClass === "prospective_shadow" ? "prospective_shadow_unqualified" : "fixture_only", ...(state.goalies.get(key.playerId)?.starts ?? 0) < 3 ? ["sparse_goalie_history_shrunk_to_prior"] : []],
    };
    const failed = await publish(vintage);
    if (failed === DEADLINE) return report;
    if (failed) { report.gaps.push({ playerId: key.playerId, gameId: key.gameId, reason: failed }); continue; }
    report.published += 1;
    if (GOALIE_CATEGORIES.every(c => means[c].state === "available")) report.numeric += 1; else report.nonNumeric += 1;
  }
  report.complete = true;
  return report;
}

/** Read-only goalie readback through the (player_id, game_id) index; rows naming one of the given denominators. */
export async function readbackH10Goalies(db: SqlConnection, denominator: FrozenDenominator): Promise<ForecastRow[]> {
  const keys = denominator.keys.filter(k => k.playerClass === "goalie");
  const { rows } = await db.query<{ payload: string; output_hash: string; receipt_hash: string | null; confirmed_at: Date | string | null }>(
    `select v.payload, v.output_hash, r.output_hash as receipt_hash, r.confirmed_at from ${V} v
     join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
     left join ${R} r on r.vintage_id = v.id`, [keys.map(k => k.playerId), keys.map(k => k.gameId)]);
  const latest = new Map<string, { v: GoalieVintage; at: string }>();
  for (const row of rows) {
    const v = JSON.parse(row.payload) as GoalieVintage;
    if (row.receipt_hash !== row.output_hash || !row.confirmed_at || !v.sourceManifest.some(s => s.id === `forge-h10-denominator:${denominator.denominatorSha256}`)) continue;
    const k = `${v.playerId}:${v.gameId}`, prior = latest.get(k);
    if (!prior || v.sequence > prior.v.sequence) latest.set(k, { v, at: new Date(row.confirmed_at).toISOString() });
  }
  return [...latest.values()].map(({ v, at }) => ({ playerId: v.playerId, gameId: v.gameId, teamId: v.teamId, issuedAt: at, runId: v.issuanceKey,
    values: Object.fromEntries(GOALIE_CATEGORIES.map(c => [c, v.means[c].state === "available" ? (v.means[c] as { value: number }).value : null])) }));
}

export const goalieCoverage = (denominator: FrozenDenominator, rows: ForecastRow[]) => measureCoverage(denominator, rows);
