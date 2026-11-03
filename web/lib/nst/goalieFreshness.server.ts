import type { SupabaseClient } from "@supabase/supabase-js";
import { readReportSource, reportRowIdentity } from "lib/cron/reportSource";
import { completedGoalieDate, goalieDateMillis, GOALIE_DATASETS } from "./goalieCatchup";
import { assessGoalieFreshness, type GoalieFreshness, type GoalieCheckpointProgress } from "./goalieFreshness";

type Season = { id: number; startDate: string; regularSeasonEndDate: string };
type Game = { id: number; date: string };
type WgoRow = { goalie_id: number; date: string; season_id: number; games_played: number | null };
type NstRow = { player_id: number; date_scraped: string; season: number; hd_shots_against: number | null };

export async function readGoalieCheckpointProgress(client: SupabaseClient, season: number, deadlineAt: number): Promise<GoalieCheckpointProgress> {
  const unknown: GoalieCheckpointProgress = { status: "unknown", pending: null, held: null, inFlight: null,
    noProgressWindows: null, lastCommitAt: null, datasets: [] };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const remaining = Math.min(5_000, deadlineAt - Date.now());
    if (remaining <= 0) return unknown;
    const query = client.rpc("nst_goalie_progress_v1", { p_season: season }).abortSignal(controller.signal);
    const response = await Promise.race([query, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Progress read timed out.")); }, remaining);
    })]);
    const value = response.data;
    const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
    if (response.error || !value || value.version !== 1 || typeof value.enabled !== "boolean" || value.configurationKnown !== true ||
        typeof value.reviewRequired !== "boolean" || ![value.pending, value.held, value.inFlight, value.noProgressWindows].every(count) ||
        value.noProgressWindows > 2 || !Array.isArray(value.datasets) || value.datasets.length > 10 ||
        new Set(value.datasets.map((d: any) => d.dataset)).size !== value.datasets.length ||
        value.datasets.some((d: any) => !GOALIE_DATASETS.includes(d.dataset) || ![d.pending, d.held, d.inFlight, d.complete].every(count)) ||
        (value.lastCommitAt !== null && !Number.isFinite(Date.parse(value.lastCommitAt)))) return unknown;
    for (const field of ["pending", "held", "inFlight"] as const) {
      if (value.datasets.reduce((sum: number, d: any) => sum + d[field], 0) !== value[field]) return unknown;
    }
    return { status: value.reviewRequired || value.noProgressWindows >= 2 ? "critical" : !value.enabled ? "disabled"
      : value.pending > 0 || value.inFlight > 0 ? "warning" : "healthy", pending: value.pending, held: value.held,
      inFlight: value.inFlight, noProgressWindows: value.noProgressWindows, lastCommitAt: value.lastCommitAt, datasets: value.datasets };
  } catch { return unknown; }
  finally { clearTimeout(timer); }
}

/** Read-only report adapter. Reads at most two season pages plus four pages
 * per game/WGO/NST source (including verification passes), inside one15s budget.
 * Matching row images do not establish a transactional database snapshot. */
export async function readGoalieFreshness(input: {
  client: SupabaseClient;
  now: Date;
  season: { state: "in_season"; seasonId: number } | { state: "off_season" | "unknown" };
  sourceDeadlineAt: number;
  writerAuditPresent: boolean;
}): Promise<GoalieFreshness> {
  const cutoff = completedGoalieDate(input.now);
  const unavailable = (reason: string, status: "unknown" | "not_due" = "unknown"): GoalieFreshness => ({
    status, checkedAt: input.now.toISOString(), cutoffDate: cutoff, expected: null, matched: null,
    missing: [], oldestGap: null, latestExpectedDate: null, latestCompleteDate: null, perDate: [], warnings: [reason]
  });
  if (input.season.state === "off_season") return unavailable("Seasonal goalie freshness check is paused.", "not_due");
  if (input.season.state !== "in_season") return unavailable("Current goalie season is unknown.");
  const seasonId = input.season.seasonId;
  const deadlineAt = Math.min(input.sourceDeadlineAt, Date.now() + 15_000);
  if (deadlineAt <= Date.now()) return unavailable("Goalie freshness read budget is exhausted.");
  const options = { deadlineAt, requestTimeoutMs: 5_000, countMode: "per-pass" as const };
  const progress = readGoalieCheckpointProgress(input.client, seasonId, deadlineAt);
  const withProgress = async (result: GoalieFreshness): Promise<GoalieFreshness> => {
    const checkpoint = await progress;
    result.checkpoint = checkpoint;
    if (checkpoint.status === "critical") result.status = "critical";
    else if (checkpoint.status === "warning" && ["healthy", "not_due"].includes(result.status)) result.status = "warning";
    else if (checkpoint.status === "unknown" && ["healthy", "not_due"].includes(result.status)) result.status = "unknown";
    if (checkpoint.status === "unknown") result.warnings.push("Durable goalie progress is unavailable; missing receipts are not proof of no progress.");
    if (checkpoint.status === "disabled") result.warnings.push("Automatic goalie catch-up is disabled.");
    if ((checkpoint.held ?? 0) > 0) result.warnings.push(`${checkpoint.held} goalie dataset units require review.`);
    if ((checkpoint.noProgressWindows ?? 0) >= 2) result.warnings.push("Queued goalie work made no acknowledged progress in the two latest closed worker windows.");
    return result;
  };
  try {
    const seasons = await readReportSource<Season>((from, to, signal, query) => input.client
      .from("seasons").select("id,startDate,regularSeasonEndDate", { count: query.count })
      .eq("id", seasonId).order("id").range(from, to).abortSignal(signal),
    reportRowIdentity, 1, 2, 15_000, options);
    if (!seasons.complete || seasons.rows.length !== 1) return withProgress(unavailable("Season bounds could not be completely read."));
    const season = seasons.rows[0];
    const endDate = [cutoff, season.regularSeasonEndDate].sort()[0];
    const end = goalieDateMillis(endDate);
    const start = Math.max(goalieDateMillis(season.startDate), end - 13 * 86_400_000);
    if (start > end) return withProgress(unavailable("No completed regular-season dates are due.", "not_due"));
    const startDate = new Date(start).toISOString().slice(0, 10);
    const [games, wgo, nst] = await Promise.all([
      readReportSource<Game>((from, to, signal, query) => input.client
        .from("games").select("id,date", { count: query.count }).eq("seasonId", seasonId).eq("type", 2)
        .gte("date", startDate).lte("date", endDate).order("date").order("id")
        .range(from, to).abortSignal(signal), reportRowIdentity, 500, 4, 15_000, options),
      readReportSource<WgoRow>((from, to, signal, query) => input.client
        .from("wgo_goalie_stats").select("goalie_id,date,season_id,games_played", { count: query.count })
        .eq("season_id", seasonId).gte("date", startDate).lte("date", endDate)
        .order("date").order("goalie_id").range(from, to).abortSignal(signal),
      reportRowIdentity, 500, 4, 15_000, options),
      readReportSource<NstRow>((from, to, signal, query) => input.client
        .from("nst_gamelog_goalie_all_counts").select("player_id,date_scraped,season,hd_shots_against", { count: query.count })
        .eq("season", seasonId).gte("date_scraped", startDate).lte("date_scraped", endDate)
        .order("date_scraped").order("player_id").range(from, to).abortSignal(signal),
      reportRowIdentity, 500, 4, 15_000, options)
    ]);
    if (![games, wgo, nst].every(source => source.complete)) {
      return withProgress(unavailable("Game calendar, WGO or NST reads are incomplete; goalie coverage is unknown."));
    }
    if (wgo.rows.some(row => !Number.isSafeInteger(row.games_played) || row.games_played! < 0)) {
      return withProgress(unavailable("WGO appearance counts are missing or invalid."));
    }
    const appearances = wgo.rows.filter(row => row.games_played! > 0);
    const scheduledByDate = new Map<string, number>();
    for (const game of games.rows) scheduledByDate.set(game.date, (scheduledByDate.get(game.date) ?? 0) + 1);
    // At least one goalie for each team is needed before WGO can support a
    // comparison. This catches stale/empty dates, not every upstream omission.
    if ([...scheduledByDate].some(([date, count]) =>
      new Set(appearances.filter(row => row.date === date).map(row => row.goalie_id)).size < 2 * count)) {
      return withProgress(unavailable("WGO appearances do not yet cover the scheduled completed-date slate."));
    }
    const result = assessGoalieFreshness({ now: input.now, season: String(seasonId),
      seasonStartDate: season.startDate, regularSeasonEndDate: season.regularSeasonEndDate,
      finalGameDates: [...scheduledByDate.keys()],
      expected: appearances.map(row => ({ season: String(row.season_id), goalieId: row.goalie_id, date: row.date })),
      observed: nst.rows.map(row => ({ season: String(row.season), goalieId: row.player_id, date: row.date_scraped, hdShotsAgainst: row.hd_shots_against })),
      calendarComplete: true, wgoComplete: true, nstComplete: true,
      noProgressWindows: (await progress).noProgressWindows ?? 0, writerAuditPresent: input.writerAuditPresent, writerAuditExpected: true });
    result.warnings.push("Coverage compares retained WGO appearances with NST; upstream completeness and game finality are not independently verified.");
    return withProgress(result);
  } catch {
    return withProgress(unavailable("Goalie freshness source could not be read or validated."));
  }
}
