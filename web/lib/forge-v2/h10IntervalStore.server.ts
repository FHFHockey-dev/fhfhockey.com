/**
 * Storage and scheduling for the H1–H10 interval editions (migration 20261124000000; arithmetic in h10Intervals.ts).
 * After a run's skater and goalie forecasts are published, each published vintage naming that run's denominator gets
 * one immutable edition. The calibration is computed once per night at the nightly cutoff and stored as an
 * `evaluation` record (`forge-h10-interval-calibration:<date>`), so every edition names the calibration it used.
 * Resumable under the route's time budget; before the migration is applied the phase reports itself skipped and
 * writes nothing.
 */
import { CATEGORIES, Component, Instant, ScheduleGame } from "./contracts";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { H10GameLog, H10RateState, buildH10Model, buildH10Training } from "./h10Features";
import { GOALIE_CATEGORIES, GoalieRateState, H10GoalieLog, buildGoalieTraining, goalieModelVersion } from "./h10Goalies";
import { IntervalCalibration, IntervalClass, IssuedVintage, KernelPrediction, KernelTable, buildIntervalEdition, calibrationAt, editionGaps, goalieKernelTable, predictKernel, skaterKernelTable } from "./h10Intervals";

export const INTERVAL_TABLE = "forge_v2_private.forge_h10_interval_editions";
const BATCH = 250;

export interface IntervalPhaseInput {
  db: SqlConnection;
  /** The run's frozen denominator: its sha names the vintages, its keys bound the read. */
  denominator: { denominatorSha256: string; keys: ReadonlyArray<{ playerId: number; gameId: number; playerClass: string }> };
  /** Eastern date of the nightly run and its cutoff: the calibration is fitted there once per night. */
  date: string; calibrationAsOf: Instant;
  logs: readonly H10GameLog[]; goalieLogs: readonly H10GoalieLog[]; schedule: readonly ScheduleGame[]; seasonId: number; maximumTrainingExamples: number;
  clock: () => string; stopAfterMs?: number;
}
export interface IntervalPhaseReport {
  complete: boolean; skipped?: string; calibrationId?: string; calibrationMs?: number;
  pending: number; written: number; editionsWithGap: number; gaps: Record<string, number>; ms: number;
}

async function storedCalibration(input: IntervalPhaseInput): Promise<{ id: string; value: IntervalCalibration; ms: number }> {
  const scope = `forge-h10-interval-calibration:${input.date}`;
  const { rows } = await input.db.query<{ id: string; payload: string }>(`select id, payload from forge_v2_private.forge_v2_records where kind = 'evaluation' and scope_key = $1 order by ordinal limit 1`, [scope]);
  if (rows[0]) return { id: rows[0].id, value: JSON.parse(rows[0].payload) as IntervalCalibration, ms: 0 };
  const started = Date.now();
  const value = calibrationAt({ logs: input.logs, goalieLogs: input.goalieLogs, schedule: input.schedule, seasonId: input.seasonId, asOf: input.calibrationAsOf, maximumTrainingExamples: input.maximumTrainingExamples });
  const id = `${scope}:${value.version}`;
  await new PostgresHistoryStore(input.db).appendRecord(id, "evaluation", scope, value);
  return { id, value, ms: Date.now() - started };
}

interface Pending { cls: IntervalClass; vintage: IssuedVintage; opponentId: number; home: boolean }
/** Published vintages naming the denominator that have no edition yet (read through the (player, game) index). */
async function pendingVintages(input: IntervalPhaseInput): Promise<Pending[]> {
  const source = JSON.stringify([{ id: `forge-h10-denominator:${input.denominator.denominatorSha256}` }]), out: Pending[] = [];
  for (const cls of ["skater", "goalie"] as const) {
    const keys = input.denominator.keys.filter(k => (k.playerClass === "goalie") === (cls === "goalie"));
    if (!keys.length) continue;
    const [V, R] = cls === "goalie" ? ["forge_v2_goalie_vintages", "forge_v2_goalie_publication_receipts"] : ["forge_v2_vintages", "forge_v2_publication_receipts"];
    const { rows } = await input.db.query<{ id: string; output_hash: string; payload: string }>(
      `select v.id, v.output_hash, v.payload from forge_v2_private.${V} v
       join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
       join forge_v2_private.${R} r on r.vintage_id = v.id and r.output_hash = v.output_hash
       where v.payload::jsonb->'sourceManifest' @> $3::jsonb and not exists (select 1 from ${INTERVAL_TABLE} e where e.vintage_id = v.id)
       order by v.issuance_sequence`, [keys.map(k => k.playerId), keys.map(k => k.gameId), source]);
    for (const row of rows) {
      const p = JSON.parse(row.payload) as { playerId: number; gameId: number; teamId: number; opponentId: number; home: boolean; horizon: number; targetVersion: string; conditioning: string;
        inputCutoffAt: Instant; modelVersion: string; featureVersion: string; means: Record<string, Component<number>> };
      out.push({ cls, opponentId: p.opponentId, home: p.home, vintage: { id: row.id, outputHash: row.output_hash, playerId: p.playerId, gameId: p.gameId, teamId: p.teamId, horizon: p.horizon,
        targetVersion: p.targetVersion, conditioning: p.conditioning, inputCutoffAt: p.inputCutoffAt, modelVersion: p.modelVersion, featureVersion: p.featureVersion, means: p.means } });
    }
  }
  return out;
}

/** The kernel model and rate state as issued at one cutoff (rebuilt from the same logs; the version must match). */
type Rebuilt = { version: string | null; table: KernelTable | null; features: (v: Pending) => Record<string, Component<number>> };
function rebuild(input: IntervalPhaseInput, cls: IntervalClass, cutoff: Instant): Rebuilt {
  if (cls === "skater") {
    const model = buildH10Model(buildH10Training(input.logs, input.seasonId, cutoff, input.maximumTrainingExamples).training, cutoff), state = H10RateState.from(input.logs, input.seasonId, cutoff);
    return { version: model?.version ?? null, table: model ? skaterKernelTable(model) : null, features: v => state.features(v.vintage.playerId, v.opponentId, v.home) };
  }
  const training = buildGoalieTraining(input.logs, input.goalieLogs, input.seasonId, cutoff, input.maximumTrainingExamples).training;
  const state = GoalieRateState.from(input.logs, input.goalieLogs, input.seasonId, cutoff);
  return { version: goalieModelVersion(training), table: goalieKernelTable(training), features: v => state.features(v.vintage.playerId, v.vintage.teamId, v.opponentId, v.home) };
}

export async function runIntervalPhase(input: IntervalPhaseInput): Promise<IntervalPhaseReport> {
  const started = Date.now(), report: IntervalPhaseReport = { complete: false, pending: 0, written: 0, editionsWithGap: 0, gaps: {}, ms: 0 };
  if (!(await input.db.query<{ ok: boolean }>(`select to_regclass('${INTERVAL_TABLE}') is not null as ok`)).rows[0]?.ok) return { ...report, complete: true, skipped: "interval_table_not_migrated" };
  // The nightly calibration replays ten cutoffs (about 25 s on a full night): start it only inside the budget.
  if (input.stopAfterMs !== undefined && Date.now() > input.stopAfterMs) { report.ms = Date.now() - started; return report; }
  const calibration = await storedCalibration(input);
  report.calibrationId = calibration.id; report.calibrationMs = calibration.ms;
  const pending = await pendingVintages(input);
  report.pending = pending.length;
  const models = new Map<string, Rebuilt>();
  for (let i = 0; i < pending.length; i += BATCH) {
    if (input.stopAfterMs !== undefined && Date.now() > input.stopAfterMs) { report.ms = Date.now() - started; return report; }
    const editions = pending.slice(i, i + BATCH).map(item => {
      const key = `${item.cls}:${item.vintage.inputCutoffAt}`;
      if (!models.has(key)) models.set(key, rebuild(input, item.cls, item.vintage.inputCutoffAt));
      const m = models.get(key)!;
      const prediction: KernelPrediction | null = m.table ? predictKernel(m.table, { features: m.features(item), gameId: item.vintage.gameId, cutoff: item.vintage.inputCutoffAt }) : null;
      return buildIntervalEdition({ cls: item.cls, vintage: item.vintage, prediction, modelVersion: m.version, calibration: { id: calibration.id, value: calibration.value }, generatedAt: input.clock() });
    });
    await input.db.query(`insert into ${INTERVAL_TABLE} (id, vintage_id, player_class, player_id, game_id, payload)
      select * from unnest($1::text[], $2::text[], $3::text[], $4::bigint[], $5::bigint[], $6::text[]) on conflict do nothing`,
      [editions.map(e => e.id), editions.map(e => e.vintageId), editions.map(e => e.playerClass), editions.map(e => e.playerId), editions.map(e => e.gameId), editions.map(e => JSON.stringify(e))]);
    report.written += editions.length;
    for (const e of editions) {
      const gaps = editionGaps(e);
      if (gaps.length) report.editionsWithGap += 1;
      for (const g of gaps) report.gaps[g.reason] = (report.gaps[g.reason] ?? 0) + 1;
    }
  }
  report.complete = true; report.ms = Date.now() - started;
  return report;
}

/** Read-only coverage of a run's editions: keys and category bands available, and open gaps by reason. */
export async function intervalCoverage(db: SqlConnection, denominator: IntervalPhaseInput["denominator"]) {
  const source = `forge-h10-denominator:${denominator.denominatorSha256}`, result: Record<string, unknown> = {};
  for (const cls of ["skater", "goalie"] as const) {
    const keys = denominator.keys.filter(k => (k.playerClass === "goalie") === (cls === "goalie"));
    const { rows } = await db.query<{ payload: string }>(`select e.payload from ${INTERVAL_TABLE} e
      join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = e.player_id and t.game_id = e.game_id where e.player_class = $3`,
      [keys.map(k => k.playerId), keys.map(k => k.gameId), cls]);
    const editions = rows.map(r => JSON.parse(r.payload) as { vintageId: string; categories: Record<string, { intervals: { state: string; reason?: string } }> });
    const vintages = new Set((await db.query<{ id: string }>(`select v.id from forge_v2_private.${cls === "goalie" ? "forge_v2_goalie_vintages" : "forge_v2_vintages"} v
      join unnest($1::bigint[], $2::bigint[]) as t(player_id, game_id) on t.player_id = v.player_id and t.game_id = v.game_id
      where v.payload::jsonb->'sourceManifest' @> $3::jsonb`, [keys.map(k => k.playerId), keys.map(k => k.gameId), JSON.stringify([{ id: source }])])).rows.map(r => r.id));
    const mine = editions.filter(e => vintages.has(e.vintageId)), categories = cls === "goalie" ? GOALIE_CATEGORIES : CATEGORIES, gaps: Record<string, number> = {};
    let bands = 0;
    for (const e of mine) for (const c of categories) {
      const cell = e.categories[c];
      const reason = cell?.intervals.state === "available" ? null : cell?.intervals.reason ?? "missing_category";
      if (reason === null) bands += 1; else gaps[reason] = (gaps[reason] ?? 0) + 1;
    }
    result[cls] = { keys: keys.length, vintages: vintages.size, editions: mine.length, keysWithoutEdition: keys.length - mine.length, categoryBands: bands, categoryBandsExpected: keys.length * categories.length, gaps };
  }
  return result;
}
