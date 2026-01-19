import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import supabase from "lib/supabase/server";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";
import {
  computeAccuracyScore,
  computeGoalieFantasyPoints,
  computeSkaterFantasyPoints
} from "lib/projections/accuracy/fantasyPoints";

type AccuracyResultRow = {
  as_of_date: string;
  actual_date: string;
  game_id: number | null;
  player_id: number;
  player_type: "skater" | "goalie";
  team_id: number | null;
  opponent_team_id: number | null;
  predicted_fp: number;
  actual_fp: number;
  error_abs: number;
  error_sq: number;
  accuracy: number;
  source_run_id: string;
  created_at: string;
};

type AggregateStats = {
  accuracy_avg: number;
  mae: number;
  rmse: number;
  count: number;
  accuracy_sum: number;
  error_abs_sum: number;
  error_sq_sum: number;
};

type StatAggregate = {
  count: number;
  error_abs_sum: number;
  error_sq_sum: number;
};

type StatAggregateRow = {
  date: string;
  scope: "skater" | "goalie";
  stat_key: string;
  mae: number;
  rmse: number;
  player_count: number;
  error_abs_sum: number;
  error_sq_sum: number;
  updated_at: string;
};

const DEFAULT_OFFSET_DAYS = 1;
const DEFAULT_RANGE_BUDGET_MS = 240_000;
const BATCH_SIZE = 800;

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseNumber(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDateParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDateOnly(d);
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return out;
  for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDateOnly(d));
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function computeAggregate(rows: AccuracyResultRow[]): AggregateStats {
  const count = rows.length;
  if (count === 0) {
    return {
      accuracy_avg: 0,
      mae: 0,
      rmse: 0,
      count: 0,
      accuracy_sum: 0,
      error_abs_sum: 0,
      error_sq_sum: 0
    };
  }
  const accuracy_sum = rows.reduce((acc, r) => acc + r.accuracy, 0);
  const error_abs_sum = rows.reduce((acc, r) => acc + r.error_abs, 0);
  const error_sq_sum = rows.reduce((acc, r) => acc + r.error_sq, 0);
  return {
    accuracy_avg: accuracy_sum / count,
    mae: error_abs_sum / count,
    rmse: Math.sqrt(error_sq_sum / count),
    count,
    accuracy_sum,
    error_abs_sum,
    error_sq_sum
  };
}

function updateStatAggregate(
  map: Map<string, StatAggregate>,
  key: string,
  predicted: number,
  actual: number
) {
  const pred = Number.isFinite(predicted) ? predicted : 0;
  const act = Number.isFinite(actual) ? actual : 0;
  const errorAbs = Math.abs(pred - act);
  const errorSq = Math.pow(pred - act, 2);
  const existing = map.get(key) ?? { count: 0, error_abs_sum: 0, error_sq_sum: 0 };
  existing.count += 1;
  existing.error_abs_sum += errorAbs;
  existing.error_sq_sum += errorSq;
  map.set(key, existing);
}

function finalizeStatAggregates(
  map: Map<string, StatAggregate>,
  date: string,
  scope: "skater" | "goalie"
): StatAggregateRow[] {
  return Array.from(map.entries()).map(([statKey, agg]) => {
    const mae = agg.count > 0 ? agg.error_abs_sum / agg.count : 0;
    const rmse = agg.count > 0 ? Math.sqrt(agg.error_sq_sum / agg.count) : 0;
    return {
      date,
      scope,
      stat_key: statKey,
      mae,
      rmse,
      player_count: agg.count,
      error_abs_sum: agg.error_abs_sum,
      error_sq_sum: agg.error_sq_sum,
      updated_at: new Date().toISOString()
    };
  });
}

async function fetchGameDates(gameIds: number[]): Promise<Map<number, string>> {
  if (!supabase || gameIds.length === 0) return new Map();
  const dateByGameId = new Map<number, string>();
  for (const batch of chunk(gameIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,date")
      .in("id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = (row as any).id as number;
      const date = (row as any).date as string;
      if (id != null && date) dateByGameId.set(id, date);
    }
  }
  return dateByGameId;
}

async function fetchSkaterActualsByPlayerDate(opts: {
  actualDate: string;
  playerIds: number[];
}): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!supabase || opts.playerIds.length === 0) return map;
  for (const batch of chunk(opts.playerIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("wgo_skater_stats")
      .select("game_id,player_id,goals,assists,pp_points,shots,hits,blocked_shots,date")
      .eq("date", opts.actualDate)
      .in("player_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const gameId = (row as any).game_id as number | null;
      const playerId = (row as any).player_id as number | null;
      if (gameId == null || playerId == null) continue;
      map.set(`${gameId}:${playerId}`, row);
    }
  }
  return map;
}

async function fetchGoalieActualsByDate(
  actualDate: string,
  goalieIds: number[]
): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!supabase || goalieIds.length === 0) return map;
  for (const batch of chunk(goalieIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("goalie_stats_unified")
      .select("player_id,goals_against,saves,wins,shutouts,date")
      .eq("date", actualDate)
      .in("player_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const playerId = (row as any).player_id as number | null;
      if (playerId == null) continue;
      map.set(playerId, row);
    }
  }
  return map;
}

async function fetchGoalieActualsFallbackByDate(
  actualDate: string,
  goalieIds: number[]
): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!supabase || goalieIds.length === 0) return map;
  for (const batch of chunk(goalieIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("forge_goalie_game")
      .select("goalie_id,goals_allowed,saves,game_date")
      .eq("game_date", actualDate)
      .in("goalie_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const goalieId = (row as any).goalie_id as number | null;
      if (goalieId == null) continue;
      map.set(goalieId, row);
    }
  }
  return map;
}

async function fetchGoalieActualCount(actualDate: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("goalie_stats_unified")
    .select("player_id", { count: "exact", head: true })
    .eq("date", actualDate);
  if (error) throw error;
  return count ?? 0;
}

async function fetchLatestRunningTotals(scope: string, actualDate: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("forge_projection_accuracy_daily")
    .select(
      "running_accuracy_sum,running_error_abs_sum,running_error_sq_sum,running_player_count"
    )
    .eq("scope", scope)
    .lt("date", actualDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

async function runAccuracyForDate(
  actualDate: string,
  offsetDays: number
): Promise<{
  asOfDate: string;
  actualDate: string;
  runId: string;
  skaterRows: number;
  goalieRows: number;
  totalRows: number;
  goalieMatchDiagnostics: {
    goalieProjectionCount: number;
    goalieActualCount: number;
    goalieMatchedByPlayer: number;
    goalieActualFallbackCount: number;
  };
  durationMs: string;
}> {
  const startedAt = Date.now();
  const projectionDate = addDays(actualDate, -offsetDays);
  const runId = await requireLatestSucceededRunId(projectionDate);
  const { data: projections, error: projErr } = await supabase
    .from("forge_player_projections")
    .select(
      "game_id,player_id,team_id,opponent_team_id,proj_goals_es,proj_goals_pp,proj_goals_pk,proj_assists_es,proj_assists_pp,proj_assists_pk,proj_shots_es,proj_shots_pp,proj_shots_pk,proj_hits,proj_blocks"
    )
    .eq("run_id", runId)
    .eq("as_of_date", projectionDate)
    .eq("horizon_games", 1);
  if (projErr) throw projErr;

  const playerProjections = (projections ?? []) as any[];
  const gameIds = Array.from(
    new Set(
      playerProjections
        .map((p) => Number(p.game_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const gameDatesById = await fetchGameDates(gameIds);
  const validGameIds = new Set(
    Array.from(gameDatesById.entries())
      .filter(([, date]) => date === actualDate)
      .map(([id]) => id)
  );
  const projectedPlayerIds = Array.from(
    new Set(
      playerProjections
        .map((p) => Number(p.player_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const skaterActuals = await fetchSkaterActualsByPlayerDate({
    actualDate,
    playerIds: projectedPlayerIds
  });

  const skaterResults: AccuracyResultRow[] = [];
  const skaterStatAggregates = new Map<string, StatAggregate>();
  for (const row of playerProjections) {
    const gameId = Number(row.game_id);
    if (!validGameIds.has(gameId)) continue;
    const playerId = Number(row.player_id);
    if (!Number.isFinite(playerId)) continue;

    const actual = skaterActuals.get(`${gameId}:${playerId}`);
    if (!actual) continue;

    const predictedGoals =
      (row.proj_goals_es ?? 0) +
      (row.proj_goals_pp ?? 0) +
      (row.proj_goals_pk ?? 0);
    const predictedAssists =
      (row.proj_assists_es ?? 0) +
      (row.proj_assists_pp ?? 0) +
      (row.proj_assists_pk ?? 0);
    const predictedShots =
      (row.proj_shots_es ?? 0) +
      (row.proj_shots_pp ?? 0) +
      (row.proj_shots_pk ?? 0);
    const predictedHits = row.proj_hits ?? 0;
    const predictedBlocks = row.proj_blocks ?? 0;

    updateStatAggregate(
      skaterStatAggregates,
      "goals",
      predictedGoals,
      actual.goals ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "assists",
      predictedAssists,
      actual.assists ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "shots",
      predictedShots,
      actual.shots ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "hits",
      predictedHits,
      actual.hits ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "blocks",
      predictedBlocks,
      actual.blocked_shots ?? 0
    );

    const predicted = computeSkaterFantasyPoints({
      goals: predictedGoals,
      assists: predictedAssists,
      ppPoints: (row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0),
      shots: predictedShots,
      hits: predictedHits,
      blockedShots: predictedBlocks
    });

    const actualFp = computeSkaterFantasyPoints({
      goals: actual.goals ?? 0,
      assists: actual.assists ?? 0,
      ppPoints: actual.pp_points ?? 0,
      shots: actual.shots ?? 0,
      hits: actual.hits ?? 0,
      blockedShots: actual.blocked_shots ?? 0
    });

    const errorAbs = Math.abs(predicted - actualFp);
    const errorSq = Math.pow(predicted - actualFp, 2);
    skaterResults.push({
      as_of_date: projectionDate,
      actual_date: actualDate,
      game_id: gameId,
      player_id: playerId,
      player_type: "skater",
      team_id: row.team_id ?? null,
      opponent_team_id: row.opponent_team_id ?? null,
      predicted_fp: predicted,
      actual_fp: actualFp,
      error_abs: errorAbs,
      error_sq: errorSq,
      accuracy: computeAccuracyScore(predicted, actualFp),
      source_run_id: runId,
      created_at: new Date().toISOString()
    });
  }

  const { data: goalieProjections, error: goalieErr } = await supabase
    .from("forge_goalie_projections")
    .select(
      "game_id,goalie_id,team_id,opponent_team_id,starter_probability,proj_saves,proj_goals_allowed,proj_win_prob,proj_shutout_prob"
    )
    .eq("run_id", runId)
    .eq("as_of_date", projectionDate)
    .eq("horizon_games", 1);
  if (goalieErr) throw goalieErr;

  const goalieProjectionRows = (goalieProjections ?? []) as any[];
  const goalieIds = Array.from(
    new Set(
      goalieProjectionRows
        .map((g) => Number(g.goalie_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const goalieActuals = await fetchGoalieActualsByDate(actualDate, goalieIds);
  const goalieActualsFallback = await fetchGoalieActualsFallbackByDate(
    actualDate,
    goalieIds
  );
  const goalieResults: AccuracyResultRow[] = [];
  const goalieStatAggregates = new Map<string, StatAggregate>();
  const goalieActualCount = await fetchGoalieActualCount(actualDate);

  for (const row of goalieProjectionRows) {
    const playerId = Number(row.goalie_id);
    if (!Number.isFinite(playerId)) continue;
    const actual =
      goalieActuals.get(playerId) ??
      (goalieActualsFallback.has(playerId)
        ? {
            saves: goalieActualsFallback.get(playerId)?.saves ?? 0,
            goals_against: goalieActualsFallback.get(playerId)?.goals_allowed ?? 0,
            wins: 0,
            shutouts: 0
          }
        : null);
    if (!actual) continue;

    const projectedWins = row.proj_win_prob ?? 0;
    const projectedShutouts = row.proj_shutout_prob ?? 0;
    const projectedSaves = row.proj_saves ?? 0;
    const projectedGoalsAgainst = row.proj_goals_allowed ?? 0;

    updateStatAggregate(
      goalieStatAggregates,
      "saves",
      projectedSaves,
      actual.saves ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "goals_against",
      projectedGoalsAgainst,
      actual.goals_against ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "wins",
      projectedWins,
      actual.wins ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "shutouts",
      projectedShutouts,
      actual.shutouts ?? 0
    );

    const predicted = computeGoalieFantasyPoints({
      saves: projectedSaves,
      goalsAgainst: projectedGoalsAgainst,
      wins: projectedWins,
      shutouts: projectedShutouts
    });

    const actualFp = computeGoalieFantasyPoints({
      saves: actual.saves ?? 0,
      goalsAgainst: actual.goals_against ?? 0,
      wins: actual.wins ?? 0,
      shutouts: actual.shutouts ?? 0
    });

    const errorAbs = Math.abs(predicted - actualFp);
    const errorSq = Math.pow(predicted - actualFp, 2);
    goalieResults.push({
      as_of_date: projectionDate,
      actual_date: actualDate,
      game_id: row.game_id ?? null,
      player_id: playerId,
      player_type: "goalie",
      team_id: row.team_id ?? null,
      opponent_team_id: row.opponent_team_id ?? null,
      predicted_fp: predicted,
      actual_fp: actualFp,
      error_abs: errorAbs,
      error_sq: errorSq,
      accuracy: computeAccuracyScore(predicted, actualFp),
      source_run_id: runId,
      created_at: new Date().toISOString()
    });
  }

  const allResults = [...skaterResults, ...goalieResults];
  if (allResults.length > 0) {
    for (const batch of chunk(allResults, BATCH_SIZE)) {
      const { error } = await supabase
        .from("forge_projection_results")
        .upsert(batch, {
          onConflict: "as_of_date,actual_date,player_id,game_id,player_type"
        });
      if (error) throw error;
    }
  }

  const overallAgg = computeAggregate(allResults);
  const skaterAgg = computeAggregate(skaterResults);
  const goalieAgg = computeAggregate(goalieResults);

  const dailyRows = [
    { scope: "overall", agg: overallAgg },
    { scope: "skater", agg: skaterAgg },
    { scope: "goalie", agg: goalieAgg }
  ];

  const dailyUpserts = [];
  for (const { scope, agg } of dailyRows) {
    const prev = await fetchLatestRunningTotals(scope, actualDate);
    const runningAccuracySum = (prev?.running_accuracy_sum ?? 0) + agg.accuracy_sum;
    const runningErrorAbsSum =
      (prev?.running_error_abs_sum ?? 0) + agg.error_abs_sum;
    const runningErrorSqSum =
      (prev?.running_error_sq_sum ?? 0) + agg.error_sq_sum;
    const runningPlayerCount = (prev?.running_player_count ?? 0) + agg.count;

    dailyUpserts.push({
      date: actualDate,
      scope,
      accuracy_avg: agg.accuracy_avg,
      mae: agg.mae,
      rmse: agg.rmse,
      player_count: agg.count,
      accuracy_sum: agg.accuracy_sum,
      error_abs_sum: agg.error_abs_sum,
      error_sq_sum: agg.error_sq_sum,
      running_accuracy_sum: runningAccuracySum,
      running_error_abs_sum: runningErrorAbsSum,
      running_error_sq_sum: runningErrorSqSum,
      running_player_count: runningPlayerCount,
      running_accuracy_avg:
        runningPlayerCount > 0 ? runningAccuracySum / runningPlayerCount : 0,
      running_mae:
        runningPlayerCount > 0 ? runningErrorAbsSum / runningPlayerCount : 0,
      running_rmse:
        runningPlayerCount > 0
          ? Math.sqrt(runningErrorSqSum / runningPlayerCount)
          : 0,
      updated_at: new Date().toISOString()
    });
  }

  if (dailyUpserts.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_daily")
      .upsert(dailyUpserts, { onConflict: "date,scope" });
    if (error) throw error;
  }

  const perPlayerByKey = new Map<
    string,
    { rows: AccuracyResultRow[]; player_id: number; player_type: string }
  >();
  for (const r of allResults) {
    const key = `${r.player_type}:${r.player_id}`;
    const existing = perPlayerByKey.get(key) ?? {
      rows: [],
      player_id: r.player_id,
      player_type: r.player_type
    };
    existing.rows.push(r);
    perPlayerByKey.set(key, existing);
  }

  const playerUpserts = Array.from(perPlayerByKey.values()).map((entry) => {
    const agg = computeAggregate(entry.rows);
    return {
      date: actualDate,
      player_id: entry.player_id,
      player_type: entry.player_type,
      accuracy_avg: agg.accuracy_avg,
      mae: agg.mae,
      rmse: agg.rmse,
      games_count: agg.count,
      updated_at: new Date().toISOString()
    };
  });

  if (playerUpserts.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_player")
      .upsert(playerUpserts, { onConflict: "date,player_id,player_type" });
    if (error) throw error;
  }

  const statDailyRows = [
    ...finalizeStatAggregates(skaterStatAggregates, actualDate, "skater"),
    ...finalizeStatAggregates(goalieStatAggregates, actualDate, "goalie")
  ];
  if (statDailyRows.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_stat_daily")
      .upsert(statDailyRows, { onConflict: "date,scope,stat_key" });
    if (error) throw error;
  }

  const goalieMatchedByPlayer = goalieProjectionRows.filter((row) => {
    const goalieId = Number(row.goalie_id);
    return goalieActuals.has(goalieId) || goalieActualsFallback.has(goalieId);
  }).length;

  return {
    asOfDate: projectionDate,
    actualDate,
    runId,
    skaterRows: skaterResults.length,
    goalieRows: goalieResults.length,
    totalRows: allResults.length,
    goalieMatchDiagnostics: {
      goalieProjectionCount: goalieProjectionRows.length,
      goalieActualCount,
      goalieMatchedByPlayer,
      goalieActualFallbackCount: goalieActualsFallback.size
    },
    durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
  };
}

export default withCronJobAudit(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startedAt = Date.now();
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Supabase server client not available" });
  }

  try {
    const requestedDate = parseDateParam(req.query.date);
    const offsetDays =
      parseNumber(req.query.projectionOffsetDays) ?? DEFAULT_OFFSET_DAYS;
    const startDateParam =
      parseDateParam(req.query.startDate) ??
      parseDateParam(req.query.endDate) ??
      parseDateParam(req.query.endPoint);
    const endDateParam =
      parseDateParam(req.query.endDate) ??
      parseDateParam(req.query.endPoint) ??
      parseDateParam(req.query.startDate);
    const rangeDates =
      startDateParam && endDateParam
        ? buildDateRange(startDateParam, endDateParam)
        : [];

    if (
      (startDateParam || endDateParam) &&
      (rangeDates.length === 0 ||
        (startDateParam && endDateParam && startDateParam > endDateParam))
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid startDate/endDate range",
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
      });
    }

    if (rangeDates.length > 0) {
      const maxDurationMs =
        parseNumber(req.query.maxDurationMs) ?? DEFAULT_RANGE_BUDGET_MS;
      const budgetMs = Number.isFinite(maxDurationMs)
        ? maxDurationMs
        : DEFAULT_RANGE_BUDGET_MS;
      const deadlineMs = Date.now() + budgetMs;
      const results = [];
      for (const date of rangeDates) {
        if (Date.now() > deadlineMs) {
          return res.status(200).json({
            success: false,
            error: "Timed out",
            processedDates: results.map((r) => r.actualDate),
            results,
            durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
          });
        }
        results.push(await runAccuracyForDate(date, offsetDays));
      }
      return res.status(200).json({
        success: true,
        processedDates: results.map((r) => r.actualDate),
        results,
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
      });
    }

    const actualDate = requestedDate ?? addDays(isoDateOnly(new Date()), -1);
    const result = await runAccuracyForDate(actualDate, offsetDays);
    return res.status(200).json({
      success: true,
      asOfDate: result.asOfDate,
      actualDate: result.actualDate,
      runId: result.runId,
      skaterRows: result.skaterRows,
      goalieRows: result.goalieRows,
      totalRows: result.totalRows,
      goalieMatchDiagnostics: result.goalieMatchDiagnostics,
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: (e as any)?.message ?? String(e),
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
    });
  }
}, { jobName: "run-projection-accuracy" });
