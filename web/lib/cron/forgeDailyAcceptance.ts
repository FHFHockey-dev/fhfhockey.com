/** Daily FORGE natural-run acceptance (strict): a pure evaluation of read-only evidence for one scheduled run.
 * Every check needs explicit, date-matched, attributable evidence. Missing, null, ambiguous or vacuous evidence fails:
 * an empty expected slate, an absent schedule day, a partial stage set, a selected_games recovery run, a run from
 * outside the scheduled window, reader rows from another run, or an NST row without explicit zero counts never passes.
 * Port of tasks/artifacts/daily-offday-release-2026-11-21/acceptance/summarize.py (same rules and cases). */

export type DailyAcceptanceKind = "control" | "offday";

/** Stage rows a complete daily_incremental run writes (every fully complete daily scope on record has exactly these). */
export const DAILY_ACCEPTANCE_EXPECTED_STAGES: ReadonlySet<string> = new Set([
  "core_entity_freshness", "upstream_skater_sources", "contextual_builders", "rolling_player_recompute",
  "projection_input_ingest", "projection_relationship_build", "projection_derived_build", "projection_execution",
  "projection_execution:goalie", "downstream_projection_consumers", "monitoring"]);
/** The Vercel cron fires the pipeline from 10:05 UTC; the acceptance checkpoint is 11:15 UTC. */
export const DAILY_ACCEPTANCE_WINDOW = { start: "09:55:00", end: "11:15:00" } as const;
const BRIDGE_PREFIX = "forge-daily-bridge-v1:";

type Json = Record<string, unknown>;
export type DailyAcceptanceEvidence = {
  scheduleRun: unknown; scheduleSource: unknown;
  pipeline: unknown; nst: unknown; runs: unknown; playerRowKeys: unknown;
  startChart: unknown; dailyRso: unknown; startChartHttp: number | null; dailyRsoHttp: number | null;
};
export type DailyAcceptanceResult = { checks: Record<string, boolean>; facts: Json; pass: boolean };

const isInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isObj = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const time = (value: unknown) => {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The one gameWeek entry dated `date`, with an explicit integer count equal to its explicit, unique games list. */
export function scheduleDayGameIds(schedule: unknown, date: string): number[] | null {
  if (!isObj(schedule) || !Array.isArray(schedule.gameWeek)) return null;
  const days = schedule.gameWeek.filter(day => isObj(day) && day.date === date) as Json[];
  if (days.length !== 1) return null;
  const count = days[0].numberOfGames, games = days[0].games;
  if (!isInt(count) || !Array.isArray(games) || count !== games.length) return null;
  const ids = games.map(game => (isObj(game) ? game.id : undefined));
  if (ids.some(id => !isInt(id)) || new Set(ids).size !== count) return null;
  return (ids as number[]).slice().sort((a, b) => a - b);
}

export function evaluateDailyAcceptance(ev: DailyAcceptanceEvidence, runDate: string, sourceDate: string,
  kind: DailyAcceptanceKind): DailyAcceptanceResult {
  const checks: Record<string, boolean> = {}, facts: Json = {};
  const start = Date.parse(`${runDate}T${DAILY_ACCEPTANCE_WINDOW.start}Z`), end = Date.parse(`${runDate}T${DAILY_ACCEPTANCE_WINDOW.end}Z`);
  if (kind !== "control" && kind !== "offday") return { checks: { known_kind: false }, facts, pass: false };

  // 1. Official schedules, date-matched and explicit.
  const expected = scheduleDayGameIds(ev.scheduleRun, runDate), source = scheduleDayGameIds(ev.scheduleSource, sourceDate);
  Object.assign(facts, { expectedGameIds: expected, sourceGameIds: source });
  checks.run_schedule_explicit_nonempty = !!expected && expected.length > 0;
  checks.source_schedule_matches_kind = source !== null && (kind === "offday" ? source.length === 0 : source.length > 0);

  // 2. Complete stage evidence for exactly this scope.
  const scope = `daily_incremental:${runDate}`, stages = new Map<string, unknown[]>();
  for (const row of Array.isArray(ev.pipeline) ? ev.pipeline : []) {
    if (isObj(row) && row.scope === scope && typeof row.stage === "string") stages.set(row.stage, [...(stages.get(row.stage) ?? []), row.status]);
  }
  facts.pipelineStages = Object.fromEntries(stages);
  checks.pipeline_stages_complete = stages.size === DAILY_ACCEPTANCE_EXPECTED_STAGES.size
    && [...DAILY_ACCEPTANCE_EXPECTED_STAGES].every(stage => { const s = stages.get(stage); return !!s && s.length === 1 && s[0] === "complete"; });

  // 3. One attributable scheduled full-slate run (never a selected_games recovery, never a guess).
  const scheduled = (Array.isArray(ev.runs) ? ev.runs : []).filter((run): run is Json => {
    if (!isObj(run) || typeof run.run_id !== "string" || !isObj(run.scope) || run.scope.mode !== "full_slate") return false;
    const created = time(run.created_at);
    return created !== null && created >= start && created < end;
  });
  facts.scheduledRuns = scheduled.map(run => run.run_id);
  const run = scheduled.length === 1 ? scheduled[0] : null, runId = run ? (run.run_id as string) : null;
  facts.runId = runId;
  checks.one_scheduled_full_slate_run = run !== null;
  checks.scheduled_run_succeeded = !!run && run.status === "succeeded";

  // 4. Every expected game under that exact run: writer rows, Start Chart, Daily RSO.
  const want = new Set(expected ?? []);
  const covers = (have: Set<number>) => want.size > 0 && [...want].every(id => have.has(id));
  const missing = (have: Set<number>) => [...want].filter(id => !have.has(id)).sort((a, b) => a - b);
  const writer = new Set<number>();
  for (const key of Array.isArray(ev.playerRowKeys) ? ev.playerRowKeys : []) {
    if (isObj(key) && runId && key.run_id === runId && isInt(key.game_id)) writer.add(key.game_id);
  }
  facts.writerMissing = missing(writer);
  checks.writer_rows_cover_expected = covers(writer);

  const sc = isObj(ev.startChart) ? ev.startChart : {};
  const scGames = new Set<number>();
  for (const player of Array.isArray(sc.players) ? sc.players : []) {
    if (isObj(player) && runId && typeof player.row_key === "string" && player.row_key.startsWith(`${runId}:`) && isInt(player.game_id)) scGames.add(player.game_id);
  }
  facts.startChartMissing = missing(scGames);
  checks.start_chart_http_200 = ev.startChartHttp === 200;
  checks.start_chart_selects_run = !!runId && sc.projectionRunId === runId;
  checks.start_chart_covers_expected_under_run = covers(scGames);

  const bridge = isObj(ev.dailyRso) && isObj(ev.dailyRso.bridgeForecasts) ? ev.dailyRso.bridgeForecasts : {};
  const bridgeRuns = (Array.isArray(bridge.runs) ? bridge.runs : []).map(entry => (Array.isArray(entry) ? entry[0] : null));
  const target = runId ? `${BRIDGE_PREFIX}${runId}` : null, rsoGames = new Set<number>();
  for (const row of Array.isArray(bridge.rows) ? bridge.rows : []) {
    if (Array.isArray(row) && row.length > 2 && isInt(row[2]) && row[2] >= 0 && row[2] < bridgeRuns.length
      && bridgeRuns[row[2]] === target && /^\d+$/.test(String(row[1]))) rsoGames.add(Number(row[1]));
  }
  facts.dailyRsoMissing = missing(rsoGames);
  checks.daily_rso_http_200 = ev.dailyRsoHttp === 200;
  checks.daily_rso_covers_expected_under_run = !!target && bridgeRuns.includes(target) && covers(rsoGames);

  // 5. Off-day: an attributable NST audit row that verified the source date with explicit zero requests.
  if (kind === "offday") {
    const inWindow = (Array.isArray(ev.nst) ? ev.nst : []).filter((row): row is Json => {
      const at = isObj(row) ? time(row.run_time) : null;
      return at !== null && at >= start && at < end;
    });
    const verified = inWindow.filter(row => row.status === "success" && row.state === "skipped_no_completed_games"
      && Array.isArray(row.verifiedOffDates) && row.verifiedOffDates.includes(sourceDate)
      && Array.isArray(row.missingScheduleDates) && row.missingScheduleDates.length === 0);
    facts.nstRows = inWindow;
    checks.nst_verified_off_day = verified.length >= 1;
    checks.nst_zero_requests_explicit = inWindow.length > 0 && inWindow.every(row => row.planned === 0 && row.networkAttempts === 0);
  }
  const values = Object.values(checks);
  return { checks, facts, pass: values.length > 0 && values.every(Boolean) };
}
