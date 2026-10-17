/** FORGE v2 daily `means` stage (tasks/prd-forge-daily-pipeline.md, v2 decisions): fresh native mean inputs from
 * bounded original NHL receipts. Pure and offline: capture planning, assembly through the existing assembler,
 * 2026-10-16 policy assignment and the materialization-request pieces. Fetching lives in
 * scripts/native-means-capture.ts. Nothing here reads a network or database, and an unknown never becomes zero. */
import { createHash } from "node:crypto";
import { timestampMicros } from "../projections/evidenceTime";
import { assembleCurrentRosterNativeInputs, type CurrentRosterNativeScope } from "./currentRosterNativeInputs";
import { finalBoxscoreForGame, parseTimeOnIceSeconds, rawPlayerForOutput } from "./settlement";
import { baselineAppearanceFromBoxscore, baselineHistoricalSourceLimitations, baselineHistoricalSources,
  verifyBaselineHistoricalSources } from "./baselineSourceLineage";
import { buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { CURRENT_APPEARANCE_POLICY, PRIOR_APPEARANCE_POLICY_VERSION, priorAppearanceDefinitionHash,
  type BaselineAppearanceInput } from "./baselineRates";
import { buildNativeGoalieShutoutRates, buildNativeGoalieSummaryWinRates, buildNativeGoalieVolumeRates, buildNativeGoalieWinRates,
  NATIVE_GOALIE_SHUTOUT_POLICY, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION,
  NATIVE_GOALIE_VOLUME_POLICY_VERSION, NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieShutoutDefinitionHash,
  nativeGoalieSummaryWinDefinitionHash } from "./goalieBaselineRates";
import { nativeGoalieSummaryUrl, type NativeGoalieShutoutSummary } from "./nativeGoalieOutcomes";
import { deriveNativePowerPlayPoints, type NativePowerPlayPointsInput } from "./nativePowerPlayPoints";
import type { NativeMaterializationParent, NativeMaterializationRequest } from "./nativeInputMaterialization";
import type { HttpReceipt } from "./nativeDailyPipeline";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";

export type NativeMeansUniverseRow = CurrentRosterNativeScope["roster"][number];
export type NativeMeansGame = Omit<CurrentRosterNativeScope["games"][number], "endpoints">;
export type NativeMeansObservation = NonNullable<NativeMaterializationRequest["additionalNativeObservations"]>[number];
export type NativeMeansSummaryScope = NativeGoalieShutoutSummary["scope"];
type Cached = { receipt: HttpReceipt; body: any };

export const NATIVE_MEANS_BOUNDS = Object.freeze({
  appearances: CURRENT_APPEARANCE_POLICY.maximumAppearances, clubGames: 20, maxClubGames: 40, scheduleWeeks: 18,
  priorAppearances: 20, priorCandidates: 40, summaryDays: NATIVE_GOALIE_SHUTOUT_POLICY.summaryMaximumDays, universe: 100,
  assemblerRoster: 50, assemblerGames: 60, cacheReceipts: 5000 });
/** Mean original body sizes on the retained 2026-10-16 receipts, rounded up; estimates only. */
export const NATIVE_MEANS_BODY_BYTES = Object.freeze({ schedule: 95000, boxscore: 14000, landing: 14000, goalie_summary: 2500,
  prior_boxscore: 14000, prior_landing: 14000 });
const GOALIE_TARGETS = ["WINS_GOALIE", "SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "SHUTOUTS_GOALIE"];
const VOLUME_TARGETS = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"];
const FINAL_STATES = new Set(["OFF", "FINAL"]);
const DAY_MS = 86400000, HOUR_MICROS = BigInt(3600) * BigInt(1000000);

const fail = (reason: string): never => { throw new Error(reason); };
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const order = (a: bigint, b: bigint) => a < b ? -1 : a > b ? 1 : 0;
const realDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const dayDiff = (later: string, earlier: string) => Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS);
const nyDate = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const validSeason = (seasonId: unknown): seasonId is number => Number.isSafeInteger(seasonId) && /^\d{8}$/.test(String(seasonId))
  && Math.floor(Number(seasonId) / 10000) + 1 === Number(seasonId) % 10000;
const byStartDesc = (a: NativeMeansGame, b: NativeMeansGame) => order(micros(b.startTime), micros(a.startTime)) || b.id - a.id;
const message = (error: unknown) => error instanceof Error ? error.message : "unknown";

const WEB = "https://api-web.nhle.com/v1";
export const nativeMeansScheduleUrl = (date: string) => `${WEB}/schedule/${date}`;
export const nativeMeansGameUrl = (gameId: number, endpoint: "boxscore" | "landing") => `${WEB}/gamecenter/${gameId}/${endpoint}`;
const SCHEDULE_URL = /^https:\/\/api-web\.nhle\.com\/v1\/schedule\/(\d{4}-\d{2}-\d{2})$/;
const GAME_URL = /^https:\/\/api-web\.nhle\.com\/v1\/gamecenter\/(\d{4}02\d{4})\/(boxscore|landing)$/;
const SUMMARY_URL = new RegExp("^https://api\\.nhle\\.com/stats/rest/en/goalie/summary\\?isAggregate=false&isGame=true&start=0&limit=50"
  + "&factCayenneExp=gamesPlayed%3E%3D1&cayenneExp=playerId%3D([1-9]\\d*)%20and%20seasonId%3D(\\d{8})%20and%20gameDate%3E%3D%22"
  + "(\\d{4}-\\d{2}-\\d{2})%22%20and%20gameDate%3C%3D%22(\\d{4}-\\d{2}-\\d{2})%22%20and%20gameTypeId%3D2$");

/** Exact allowlist: weekly schedules, regular-season gamecenter boxscores/landings and the bounded per-game goalie
 * summary in the one form the existing shutout/summary-win validators accept (`nativeGoalieSummaryUrl`). */
export function nativeMeansUrlKind(url: unknown): "schedule" | "boxscore" | "landing" | "goalie_summary" | null {
  if (typeof url !== "string") return null;
  const schedule = SCHEDULE_URL.exec(url);
  if (schedule) return realDate(schedule[1]) ? "schedule" : null;
  const game = GAME_URL.exec(url);
  if (game) return game[2] as "boxscore" | "landing";
  const summary = SUMMARY_URL.exec(url);
  if (!summary) return null;
  try {
    return nativeGoalieSummaryUrl({ nhlPlayerId: Number(summary[1]), seasonId: Number(summary[2]), startDate: summary[3],
      endDate: summary[4], approvedGameIds: [1] }) === url ? "goalie_summary" : null;
  } catch { return null; }
}

/** Authenticated original receipts by URL (oldest first) that were available at `ceilingAt`. Other stages' originals
 * (club rosters) are ignored; a recognised receipt with bad bytes is fatal. */
function indexReceipts(receipts: HttpReceipt[], ceilingAt: string) {
  if (!Array.isArray(receipts) || receipts.length > NATIVE_MEANS_BOUNDS.cacheReceipts) fail("invalid_receipt_cache");
  const ceiling = micros(ceilingAt), byUrl = new Map<string, Cached[]>();
  for (const receipt of receipts) {
    if (!nativeMeansUrlKind(receipt?.url)) continue;
    if (typeof receipt.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024
      || !/^[a-f0-9]{64}$/.test(receipt.bodySha256) || sha(receipt.rawBody) !== receipt.bodySha256
      || timestampMicros(receipt.capturedAt) === null) fail("invalid_cached_receipt");
    if (micros(receipt.capturedAt) > ceiling) continue;
    let body: any;
    try { body = JSON.parse(receipt.rawBody); } catch { fail("invalid_cached_receipt"); }
    const list = byUrl.get(receipt.url) ?? [];
    if (!list.some(entry => entry.receipt.bodySha256 === receipt.bodySha256 && entry.receipt.capturedAt === receipt.capturedAt)) list.push({ receipt, body });
    byUrl.set(receipt.url, list);
  }
  for (const list of byUrl.values()) list.sort((a, b) => order(micros(a.receipt.capturedAt), micros(b.receipt.capturedAt))
    || a.receipt.bodySha256.localeCompare(b.receipt.bodySha256));
  return byUrl;
}
/** Earliest final capture: final games are immutable, so later runs keep reusing the same original. */
const finalBody = (cache: Map<string, Cached[]>, gameId: number, endpoint: "boxscore" | "landing") =>
  cache.get(nativeMeansGameUrl(gameId, endpoint))?.find(entry => entry.body?.id === gameId && FINAL_STATES.has(String(entry.body?.gameState)));
function positiveMinutes(body: any, nhlPlayerId: number) {
  for (const side of ["homeTeam", "awayTeam"]) for (const group of ["forwards", "defense", "goalies"]) {
    for (const row of body?.playerByGameStats?.[side]?.[group] ?? []) if (row?.playerId === nhlPlayerId) return (parseTimeOnIceSeconds(row.toi) ?? 0) > 0;
  }
  return false;
}

type ScheduledGame = NativeMeansGame & { gameType: unknown; gameState: string; scheduleState: string };
function scheduleGames(entry: Cached, requestDate: string): ScheduledGame[] {
  const days = entry.body?.gameWeek;
  if (!Array.isArray(days) || days.length > 7 || days.some((day: any) => !realDate(day?.date) || day.date < requestDate
    || day.date > addDays(requestDate, 6) || !Array.isArray(day.games ?? []))) fail("schedule_shape");
  return days.flatMap((day: any) => (day.games ?? []).map((game: any): ScheduledGame => {
    if (!id(game?.id) || !id(game.homeTeam?.id) || !id(game.awayTeam?.id) || timestampMicros(game.startTimeUTC) === null) fail("schedule_shape");
    return { id: game.id, seasonId: game.season, date: day.date, type: 2, startTime: game.startTimeUTC, homeTeamId: game.homeTeam.id,
      awayTeamId: game.awayTeam.id, gameType: game.gameType, gameState: String(game.gameState ?? ""), scheduleState: String(game.gameScheduleState ?? "") };
  }));
}
/** Newest receipt that saw every regular game of its week started before `asOf` either final, still within twelve
 * hours of its start, or at least twelve hours after its start. Anything older is stale and re-requested. */
function usableWeek(list: Cached[] | undefined, start: string, asOf: bigint) {
  for (const entry of [...(list ?? [])].reverse()) {
    const captured = micros(entry.receipt.capturedAt), games = scheduleGames(entry, start);
    if (games.every(game => game.gameType !== 2 || micros(game.startTime) >= asOf || FINAL_STATES.has(game.gameState)
      || captured >= micros(game.startTime) + BigInt(12) * HOUR_MICROS || asOf < micros(game.startTime) + BigInt(12) * HOUR_MICROS)) return { entry, games };
  }
  return null;
}
/** Newest-first weekly grid dates from `anchor`, back to the anchor or the week cap. */
function scheduleWeeks(anchor: string, asOfDate: string, cap: number) {
  const weeks: string[] = [];
  let start = addDays(anchor, 7 * Math.floor(dayDiff(asOfDate, anchor) / 7));
  for (; start >= anchor && weeks.length < cap; start = addDays(start, -7)) weeks.push(start);
  return { weeks, reachedAnchor: start < anchor };
}
/** Earliest summary captured once every approved game's final boxscore had been captured. */
function summaryReceipt(cache: Map<string, Cached[]>, scope: NativeMeansSummaryScope) {
  const settledAt = scope.approvedGameIds.reduce((latest, gameId) => {
    const entry = finalBody(cache, gameId, "boxscore"), at = entry ? micros(entry.receipt.capturedAt) : BigInt(0);
    return at > latest ? at : latest; }, BigInt(0));
  return cache.get(nativeGoalieSummaryUrl(scope))?.find(entry => micros(entry.receipt.capturedAt) >= settledAt)?.receipt;
}

export type NativeMeansRequestKind = keyof typeof NATIVE_MEANS_BODY_BYTES;
export type NativeMeansRequest = { url: string; kind: NativeMeansRequestKind; reason: string; estimatedBytes: number };
export type NativeMeansPlanInput = {
  seasonId: number;
  /** Planning instant: receipts captured after it are unavailable, and history games started before it. */
  asOf: string;
  /** Optional earlier exclusive history end (replays of a past scope); defaults to `asOf`. */
  historyBefore?: string;
  /** First weekly-grid date of the season's regular-season schedule (YYYY-MM-DD). */
  scheduleAnchor: string;
  universe: NativeMeansUniverseRow[];
  /** Already-captured immutable originals (any previous run, the retained 2026-10-16 receipts, other stages' captures). */
  cache: HttpReceipt[];
  /** Games that may not enter history (empty by default; replays pass a historical reservation). */
  excludedGameIds?: number[];
  /** Explicit approved prior-season regular-season game IDs per skater, used only when no current appearance is verified. */
  priorSeasonGames?: Record<string, number[]>;
};

/** Pure capture plan. Re-run it after each collection round: it converges once every needed original is cached.
 * Per universe club it selects the latest regular-season final games before `asOf`, extending (to an explicit cap)
 * until each player's latest positive-minute appearances are covered; then goalie summaries and, for skaters without a
 * current appearance, explicitly supplied prior-season games. Explicitly excluded games are never planned. */
export function planNativeMeansCapture(input: NativeMeansPlanInput) {
  const bounds = NATIVE_MEANS_BOUNDS, seasonId = input.seasonId;
  const historyEnd = input.historyBefore ?? input.asOf, asOf = micros(historyEnd), asOfDate = nyDate(historyEnd);
  const universe = input.universe;
  if (!validSeason(seasonId) || !realDate(input.scheduleAnchor) || input.scheduleAnchor > asOfDate
    || input.scheduleAnchor < `${String(seasonId).slice(0, 4)}-07-01` || !Array.isArray(universe) || !universe.length
    || universe.length > bounds.universe || new Set(universe.map(row => row.playerId)).size !== universe.length
    || new Set(universe.map(row => row.nhlPlayerId)).size !== universe.length
    || universe.some(row => ![row.playerId, row.nhlPlayerId, row.teamId].every(id) || !row.rosterRevision?.trim()
      || !["skater", "goalie"].includes(row.playerClass))
    || (input.excludedGameIds ?? []).some(value => !id(value)) || asOf > micros(input.asOf)) fail("invalid_means_plan_input");
  const cache = indexReceipts(input.cache, input.asOf);
  const excluded = new Set(input.excludedGameIds ?? []);
  const clubs = [...new Set(universe.map(row => row.teamId))].sort((a, b) => a - b), clubSet = new Set(clubs);
  const requests: NativeMeansRequest[] = [], requested = new Set<string>();
  const request = (url: string, kind: NativeMeansRequestKind, reason: string) => {
    if (!nativeMeansUrlKind(url)) fail("planned_url_outside_allowlist");
    if (!requested.has(url)) { requested.add(url); requests.push({ url, kind, reason, estimatedBytes: NATIVE_MEANS_BODY_BYTES[kind] }); }
  };

  // 1. Weekly schedules, newest first. A missing/stale week leaves clubs short of the lookback undetermined.
  const { weeks, reachedAnchor } = scheduleWeeks(input.scheduleAnchor, asOfDate, bounds.scheduleWeeks);
  const weekRows: Array<{ start: string; status: "usable" | "requested" | "not_needed"; capturedAt?: string; bodySha256?: string }> = [];
  const clubGames = new Map(clubs.map(teamId => [teamId, [] as NativeMeansGame[]])), seen = new Map<number, string>();
  const excludedGames = new Map<number, string>(), undetermined = new Set<number>();
  let gap = false, lookbackReached = false;
  for (const start of weeks) {
    if (clubs.every(teamId => clubGames.get(teamId)!.length >= bounds.maxClubGames)) { lookbackReached = true; weekRows.push({ start, status: "not_needed" }); continue; }
    const url = nativeMeansScheduleUrl(start), usable = usableWeek(cache.get(url), start, asOf);
    if (!usable) {
      request(url, "schedule", cache.has(url) ? "stale_schedule_week" : "missing_schedule_week");
      weekRows.push({ start, status: "requested" });
      if (!gap) for (const teamId of clubs) if (clubGames.get(teamId)!.length < bounds.maxClubGames) undetermined.add(teamId);
      gap = true;
      continue;
    }
    weekRows.push({ start, status: "usable", capturedAt: usable.entry.receipt.capturedAt, bodySha256: usable.entry.receipt.bodySha256 });
    for (const game of usable.games.sort(byStartDesc)) {
      if (game.gameType !== 2 || !(clubSet.has(game.homeTeamId) || clubSet.has(game.awayTeamId)) || micros(game.startTime) >= asOf) continue;
      const identity = hash([game.id, game.date, game.startTime, game.homeTeamId, game.awayTeamId]);
      if (seen.has(game.id)) { if (seen.get(game.id) !== identity) fail("schedule_source_conflict"); continue; }
      seen.set(game.id, identity);
      if (game.seasonId !== seasonId) fail("schedule_season_conflict");
      if (excluded.has(game.id)) { excludedGames.set(game.id, "excluded"); continue; }
      if (game.scheduleState !== "OK") { excludedGames.set(game.id, `schedule_state:${game.scheduleState || "missing"}`); continue; }
      if (!FINAL_STATES.has(game.gameState)) { excludedGames.set(game.id, "not_final_at_schedule_capture"); continue; }
      const descriptor: NativeMeansGame = { id: game.id, seasonId, date: game.date, type: 2, startTime: game.startTime,
        homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId };
      for (const teamId of [game.homeTeamId, game.awayTeamId]) if (clubSet.has(teamId)) clubGames.get(teamId)!.push(descriptor);
    }
  }
  const scheduleComplete = !gap && !lookbackReached && reachedAnchor;

  // 2. Club windows: latest games, extended by the largest per-player appearance deficit up to the cap.
  const byClub = new Map(clubs.map(teamId => [teamId, universe.filter(row => row.teamId === teamId)]));
  const clubRows = clubs.map(teamId => {
    const all = clubGames.get(teamId)!.sort(byStartDesc), limit = Math.min(bounds.maxClubGames, all.length);
    if (undetermined.has(teamId)) return { teamId, status: "pending_schedule" as const, window: 0, eligibleGames: all.length, capped: false, seasonComplete: false, selected: [] as NativeMeansGame[] };
    let window = Math.min(bounds.clubGames, limit), status: "settled" | "pending_boxscores" = "settled";
    for (;;) {
      const selected = all.slice(0, window);
      if (selected.some(game => !finalBody(cache, game.id, "boxscore"))) { status = "pending_boxscores"; break; }
      const deficit = Math.max(0, ...byClub.get(teamId)!.map(player => bounds.appearances
        - selected.filter(game => positiveMinutes(finalBody(cache, game.id, "boxscore")!.body, player.nhlPlayerId)).length));
      const next = Math.min(limit, window + deficit);
      if (next === window) break;
      window = next;
    }
    const selected = all.slice(0, window);
    for (const game of selected) for (const endpoint of ["boxscore", "landing"] as const) {
      if (!finalBody(cache, game.id, endpoint)) request(nativeMeansGameUrl(game.id, endpoint), endpoint, `club_window:${teamId}`);
    }
    return { teamId, status, window, eligibleGames: all.length, capped: all.length > window && window === bounds.maxClubGames,
      seasonComplete: scheduleComplete && window === all.length, selected };
  });
  const club = new Map(clubRows.map(row => [row.teamId, row]));

  // 3. Players, goalie summaries and prior-season sources once their club window is settled.
  const players: Array<{ playerId: number; playerClass: string; teamId: number; status: "settled" | "pending"; selectedGames: number;
    verifiedAppearances: number | null; reasons: string[] }> = [];
  const summaries: Array<{ playerId: number; status: "cached" | "requested" | "skipped"; reason?: string; scope?: NativeMeansSummaryScope; url?: string;
    capturedAt?: string; bodySha256?: string; trimmedGameIds?: number[] }> = [];
  const prior: Array<{ playerId: number; status: "cached" | "requested" | "not_supplied" | "not_eligible"; reason?: string; gameIds: number[] }> = [];
  const assembly = { games: new Map<number, NativeMeansGame>(), playerGames: {} as Record<number, number[]>,
    summaries: {} as Record<number, NativeMeansSummaryScope>, priorGames: {} as Record<number, number[]>, notes: {} as Record<number, string[]> };
  const priorStart = String(seasonId - 10001).slice(0, 4);
  for (const player of [...universe].sort((a, b) => a.playerId - b.playerId)) {
    const row = club.get(player.teamId)!, reasons: string[] = [];
    if (row.status !== "settled") {
      reasons.push(row.status === "pending_schedule" ? "club_schedule_pending" : "club_boxscores_pending");
      players.push({ playerId: player.playerId, playerClass: player.playerClass, teamId: player.teamId, status: "pending", selectedGames: row.selected.length, verifiedAppearances: null, reasons });
      assembly.notes[player.playerId] = reasons;
      continue;
    }
    const appearances = row.selected.filter(game => positiveMinutes(finalBody(cache, game.id, "boxscore")!.body, player.nhlPlayerId));
    if (row.capped && appearances.length < bounds.appearances) reasons.push(`lookback_capped_at_${bounds.maxClubGames}_club_games`);
    if (!row.selected.length) reasons.push("no_eligible_club_games");
    for (const game of row.selected) assembly.games.set(game.id, game);
    assembly.playerGames[player.playerId] = row.selected.map(game => game.id).sort((a, b) => a - b);
    if (player.playerClass === "goalie" && appearances.length) {
      // One single-page summary per goalie, its range within the policy day limit.
      const ascending = [...row.selected].sort((a, b) => -byStartDesc(a, b)), endDate = ascending.at(-1)!.date;
      const floor = addDays(endDate, -(bounds.summaryDays - 1));
      const approved = ascending.filter(game => game.date >= floor), trimmed = ascending.filter(game => game.date < floor).map(game => game.id);
      const latest = appearances.slice(0, bounds.appearances);
      if (latest.some(game => game.date < floor)) {
        summaries.push({ playerId: player.playerId, status: "skipped", reason: "summary_range_exceeds_day_limit", trimmedGameIds: trimmed });
      } else {
        const scope: NativeMeansSummaryScope = { nhlPlayerId: player.nhlPlayerId, seasonId, startDate: approved[0].date, endDate,
          approvedGameIds: approved.map(game => game.id).sort((a, b) => a - b) };
        const url = nativeGoalieSummaryUrl(scope), cached = summaryReceipt(cache, scope);
        if (!cached) request(url, "goalie_summary", `goalie:${player.playerId}`);
        summaries.push({ playerId: player.playerId, status: cached ? "cached" : "requested", scope, url, capturedAt: cached?.capturedAt,
          bodySha256: cached?.bodySha256, trimmedGameIds: trimmed });
        assembly.summaries[player.playerId] = scope;
      }
    }
    if (player.playerClass === "skater" && !appearances.length && row.selected.length) {
      const supplied = input.priorSeasonGames?.[String(player.playerId)];
      if (!row.seasonComplete) {
        prior.push({ playerId: player.playerId, status: "not_eligible", reason: "current_season_history_not_complete", gameIds: [] });
        reasons.push("prior_not_eligible:current_season_history_not_complete");
      } else if (!supplied) {
        prior.push({ playerId: player.playerId, status: "not_supplied", reason: "prior_season_games_not_supplied", gameIds: [] });
        reasons.push("prior_season_games_not_supplied");
      }
      else {
        if (!Array.isArray(supplied) || supplied.some(value => !id(value) || !new RegExp(`^${priorStart}02\\d{4}$`).test(String(value)))
          || new Set(supplied).size !== supplied.length) fail("invalid_prior_season_games");
        const candidates = [...supplied].sort((a, b) => b - a).slice(0, bounds.priorCandidates);
        let window = Math.min(bounds.priorAppearances, candidates.length);
        for (;;) {
          const selected = candidates.slice(0, window);
          if (selected.some(gameId => !finalBody(cache, gameId, "boxscore"))) break;
          const deficit = bounds.priorAppearances - selected.filter(gameId => positiveMinutes(finalBody(cache, gameId, "boxscore")!.body, player.nhlPlayerId)).length;
          const next = Math.min(candidates.length, window + Math.max(0, deficit));
          if (next === window) break;
          window = next;
        }
        const gameIds = candidates.slice(0, window).sort((a, b) => a - b);
        for (const gameId of gameIds) for (const endpoint of ["boxscore", "landing"] as const) {
          if (!finalBody(cache, gameId, endpoint)) request(nativeMeansGameUrl(gameId, endpoint), endpoint === "boxscore" ? "prior_boxscore" : "prior_landing", `prior:${player.playerId}`);
        }
        const complete = gameIds.every(gameId => finalBody(cache, gameId, "boxscore") && finalBody(cache, gameId, "landing"));
        prior.push({ playerId: player.playerId, status: complete ? "cached" : "requested", gameIds });
        assembly.priorGames[player.playerId] = gameIds;
      }
    }
    players.push({ playerId: player.playerId, playerClass: player.playerClass, teamId: player.teamId, status: "settled",
      selectedGames: row.selected.length, verifiedAppearances: appearances.length, reasons });
    assembly.notes[player.playerId] = reasons;
  }
  const byKind: Record<string, { requests: number; bytes: number }> = {};
  for (const value of requests) {
    const totals = byKind[value.kind] ?? (byKind[value.kind] = { requests: 0, bytes: 0 });
    totals.requests++; totals.bytes += value.estimatedBytes;
  }
  const used = new Set<string>([...weekRows.flatMap(row => row.status === "usable" ? [nativeMeansScheduleUrl(row.start)] : []),
    ...[...assembly.games.keys(), ...Object.values(assembly.priorGames).flat()].flatMap(gameId => (["boxscore", "landing"] as const)
      .filter(endpoint => finalBody(cache, gameId, endpoint)).map(endpoint => nativeMeansGameUrl(gameId, endpoint))),
    ...summaries.flatMap(row => row.status === "cached" ? [row.url!] : [])]);
  return {
    version: "native-means-capture-plan-v1" as const, seasonId, asOf: input.asOf, historyBefore: historyEnd, scheduleAnchor: input.scheduleAnchor,
    status: requests.length ? "requests_pending" as const : "complete" as const, requests,
    estimate: { requests: requests.length, bytes: requests.reduce((sum, value) => sum + value.estimatedBytes, 0), byKind },
    schedule: { weeks: weekRows, complete: scheduleComplete, lookbackReached },
    excludedGames: [...excludedGames].map(([gameId, reason]) => ({ gameId, reason })).sort((a, b) => a.gameId - b.gameId),
    clubs: clubRows.map(({ selected, ...row }) => ({ ...row, selectedGameIds: selected.map(game => game.id).sort((a, b) => a - b) })),
    players, summaries, prior, cachedOriginalsUsed: used.size,
    assembly: { games: [...assembly.games.values()].sort((a, b) => a.id - b.id), playerGames: assembly.playerGames,
      summaries: assembly.summaries, priorGames: assembly.priorGames, notes: assembly.notes },
    inputHash: hash({ seasonId, asOf: input.asOf, historyBefore: historyEnd, anchor: input.scheduleAnchor, universe, excluded: [...excluded].sort((a, b) => a - b),
      prior: input.priorSeasonGames ?? {}, cache: [...cache.values()].flat().map(entry => [entry.receipt.url, entry.receipt.bodySha256, entry.receipt.capturedAt]).sort() }),
    networkRequests: 0, databaseWrites: 0,
  };
}
export type NativeMeansCapturePlan = ReturnType<typeof planNativeMeansCapture>;

export type NativeMeansAssemblyInput = {
  seasonId: number; cutoffAt: string; universe: NativeMeansUniverseRow[];
  /** Current-season regular-season game descriptors (plan.assembly.games). */
  games: NativeMeansGame[];
  /** Explicit current-season game IDs per player; players sharing a set are assembled together. */
  playerGames: Record<string, number[]>;
  receipts: HttpReceipt[];
  summaries?: Record<string, NativeMeansSummaryScope>;
  priorGames?: Record<string, number[]>;
  notes?: Record<string, string[]>;
};
type Snapshot = { targets: Array<{ targetKey: string }> };
const supported = (snapshot: Snapshot | null) => new Set(snapshot?.targets.map(target => target.targetKey) ?? []);

/** Build one immutable native observation envelope, as the assembler does. */
const envelope = (seasonId: number, cutoffAt: string, datasetKey: string, payload: Record<string, any>): NativeMeansObservation => ({
  provider: "fhfh", entity_kind: "player", entity_key: `${seasonId}:${payload.playerId}`, available_at: cutoffAt,
  dataset_key: datasetKey, payload_hash: hash(payload), payload });
const rowFor = (receipt: HttpReceipt, endpoint: "boxscore" | "landing", body: any) => ({ id: `http:${receipt.bodySha256}`, endpoint,
  game_id: body.id, season_id: body.season, payload_hash: receipt.bodySha256, fetched_at: receipt.capturedAt, payload: body, httpReceipt: structuredClone(receipt) });

/** Prior-appearance observation from explicitly supplied prior-season original boxscores (and landings for PPP). */
function priorObservation(player: NativeMeansUniverseRow, gameIds: number[], cache: Map<string, Cached[]>, seasonId: number, cutoffAt: string) {
  const appearances: BaselineAppearanceInput[] = [], landings: NativePowerPlayPointsInput["landing"][] = [], games: any[] = [], reasons: string[] = [];
  for (const gameId of [...gameIds].sort((a, b) => a - b)) {
    const box = finalBody(cache, gameId, "boxscore");
    if (!box) { reasons.push(`missing_prior_boxscore:${gameId}`); continue; }
    const body = box.body, game = { id: body.id, date: body.gameDate, seasonId: body.season, type: body.gameType, startTime: body.startTimeUTC,
      homeTeamId: body.homeTeam?.id, awayTeamId: body.awayTeam?.id };
    if (game.seasonId !== seasonId - 10001 || game.type !== 2) fail("prior_game_outside_previous_regular_season");
    const rawRow = rowFor(box.receipt, "boxscore", body), final = finalBoxscoreForGame(rawRow, game) ?? fail("prior_boxscore_not_final");
    const home = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.homeTeamId }, final) ?? fail("prior_boxscore_identity_conflict");
    const away = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: game.awayTeamId }, final) ?? fail("prior_boxscore_identity_conflict");
    const own = home.skater ? home : away.skater ? away : null;
    if (!own) { reasons.push(`absent_from_prior_game:${gameId}`); continue; }
    const teamId = own.side === "homeTeam" ? game.homeTeamId : game.awayTeamId;
    const appearance = baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: player.nhlPlayerId, teamId, cutoffAt, population: "skater" });
    if (!appearance) { reasons.push(`observed_zero_minutes:${gameId}`); continue; }
    appearances.push(appearance); games.push({ game, teamId });
    const landing = finalBody(cache, gameId, "landing");
    if (!landing) { reasons.push(`missing_prior_landing:${gameId}`); continue; }
    const receipt = { rawRow: rowFor(landing.receipt, "landing", landing.body), contentHash: hash(landing.body) };
    try { deriveNativePowerPlayPoints({ appearance, landing: receipt, nhlPlayerId: player.nhlPlayerId, cutoffAt }); landings.push(receipt); }
    catch { reasons.push(`unsupported_prior_landing_ppp:${gameId}`); }
  }
  if (!appearances.length) return { observation: null, reasons: [...reasons, "no_verified_prior_season_appearances"] };
  const historicalSources = baselineHistoricalSources(games.map(({ game }) => ({ gameId: game.id, playerId: player.nhlPlayerId, games: game })),
    games.map(({ game, teamId }) => ({ game_id: game.id, player_id: player.nhlPlayerId, team_id: teamId, season_id: game.seasonId,
      game_date: game.date, source_play_by_play_hash: null, parser_version: null })), [],
    { nhlIds: [player.nhlPlayerId], seasonId, upperDate: cutoffAt.slice(0, 10) }, player.nhlPlayerId);
  const limitations = [...baselineHistoricalSourceLimitations(historicalSources),
    "History is limited to explicitly approved games; current-club discovery cannot certify complete player or traded-player history.",
    "Prior-season history is limited to the explicitly supplied prior-season games; their roster membership comes from each original final boxscore, without play-by-play normalization lineage.",
    "No current-season positive-minute appearance was verified in the selected current-club games. No injury, role or participation inference."];
  const payload = { basis: "captured_current" as const, capturedAt: cutoffAt, playerId: player.playerId, nhlPlayerId: player.nhlPlayerId,
    teamId: player.teamId, rosterRevision: player.rosterRevision, projections: [], limitations, policyVersion: PRIOR_APPEARANCE_POLICY_VERSION,
    definitionHash: priorAppearanceDefinitionHash(seasonId), appearances, historicalSources,
    ...(landings.length === appearances.length ? { derivedPowerPlayPoints: { version: "native-power-play-points-inputs-v1" as const, landings } } : {}) };
  verifyBaselineHistoricalSources(payload.historicalSources, payload.appearances, player.nhlPlayerId, seasonId, cutoffAt, limitations);
  return { observation: envelope(seasonId, cutoffAt, "baseline-inputs-v1", payload), reasons };
}

/** Assemble fresh native observations through the unchanged assembler (batched within its bounds), assign the
 * 2026-10-16 policies, and emit the materialization-request pieces and a per-player/per-target coverage report. */
export function assembleNativeDailyMeans(input: NativeMeansAssemblyInput, now = new Date()) {
  const { seasonId, cutoffAt, universe } = input, bounds = NATIVE_MEANS_BOUNDS;
  if (!validSeason(seasonId) || timestampMicros(cutoffAt) === null || !Array.isArray(universe) || !universe.length || universe.length > bounds.universe
    || new Set(universe.map(row => row.playerId)).size !== universe.length || new Set(universe.map(row => row.nhlPlayerId)).size !== universe.length
    || !Array.isArray(input.games) || new Set(input.games.map(game => game.id)).size !== input.games.length) fail("invalid_means_assembly_input");
  const games = new Map(input.games.map(game => [game.id, game]));
  const cache = indexReceipts(input.receipts, cutoffAt);
  const candidates: Record<number, Partial<Record<string, NativeMeansObservation>>> = {}, notes: Record<number, string[]> = {};
  const assembled = new Map<number, any>();
  const groups = new Map<string, NativeMeansUniverseRow[]>();
  for (const player of universe) {
    const ids = [...new Set(input.playerGames[String(player.playerId)] ?? [])].sort((a, b) => a - b);
    notes[player.playerId] = [...(input.notes?.[String(player.playerId)] ?? [])];
    candidates[player.playerId] = {};
    if (ids.some(gameId => !games.has(gameId))) fail("player_game_without_descriptor");
    if (ids.length > bounds.assemblerGames) fail("player_game_scope_exceeds_assembler_bound");
    if (!ids.length) { notes[player.playerId].push("no_selected_current_season_games"); continue; }
    const key = JSON.stringify(ids);
    groups.set(key, [...(groups.get(key) ?? []), player]);
  }
  let assemblerCalls = 0;
  for (const [key, members] of groups) {
    const scope = (JSON.parse(key) as number[]).map(gameId => ({ ...games.get(gameId)!, endpoints: ["boxscore", "landing"] as Array<"boxscore" | "landing"> }));
    const receipts = scope.flatMap(game => (["boxscore", "landing"] as const).flatMap(endpoint => {
      const entry = finalBody(cache, game.id, endpoint); return entry ? [entry.receipt] : []; }));
    for (let index = 0; index < members.length; index += bounds.assemblerRoster) {
      const roster = members.slice(index, index + bounds.assemblerRoster);
      const result = assembleCurrentRosterNativeInputs({ seasonId, cutoffAt, roster, games: scope, receipts }, now);
      assemblerCalls++;
      for (const row of result.coverage) assembled.set(row.playerId, row);
      for (const row of [...result.skaters, ...result.goalieWins, ...result.goalieVolume]) candidates[row.payload.playerId][row.payload.policyVersion as string] = row;
    }
  }
  const calc = (row: NativeMeansObservation) => ({ ...row.payload, seasonId, cutoffAt: row.payload.capturedAt, sourceWatermark: row.payload_hash } as any);
  const attempt = <T>(build: () => T): { value: T | null; error: string | null } => {
    try { return { value: build(), error: null }; } catch (error) { return { value: null, error: message(error) }; }
  };
  const selected: NativeMeansObservation[] = [], coverage: any[] = [];
  for (const player of [...universe].sort((a, b) => a.playerId - b.playerId)) {
    const own = candidates[player.playerId], row = assembled.get(player.playerId), reasons = notes[player.playerId];
    const gameReasons = (row?.games ?? []).flatMap((game: any) => game.reasons.map((reason: string) => `${reason}@${game.gameId}`));
    const targets: Array<{ targetKey: string; status: "supported" | "missing"; policyVersion: string | null; reason: string | null }> = [];
    const choose = (observation: NativeMeansObservation, snapshot: Snapshot, keys: string[]) => {
      selected.push(observation);
      for (const targetKey of keys) if (supported(snapshot).has(targetKey) && !targets.some(target => target.targetKey === targetKey)) {
        targets.push({ targetKey, status: "supported", policyVersion: observation.payload.policyVersion, reason: null });
      }
    };
    const missing = (keys: string[], reason: string) => {
      for (const targetKey of keys) if (!targets.some(target => target.targetKey === targetKey)) targets.push({ targetKey, status: "missing", policyVersion: null, reason });
    };
    if (player.playerClass === "skater") {
      let observation = Object.values(own).find(value => value!.payload.policyVersion === CURRENT_APPEARANCE_POLICY.version) ?? null;
      if (!observation && input.priorGames?.[String(player.playerId)]) {
        const built = attempt(() => priorObservation(player, input.priorGames![String(player.playerId)], cache, seasonId, cutoffAt));
        if (built.error) reasons.push(`prior_appearance_invalid:${built.error}`);
        else { reasons.push(...built.value!.reasons); observation = built.value!.observation; }
      }
      if (observation) {
        const snapshot = attempt(() => buildNativeSkaterBaselineSnapshot(calc(observation!)));
        if (snapshot.error) reasons.push(`${observation.payload.policyVersion}_invalid:${snapshot.error}`);
        else choose(observation, snapshot.value!, CURRENT_APPEARANCE_POLICY.targets);
        for (const targetKey of CURRENT_APPEARANCE_POLICY.targets) {
          const evidence = gameReasons.filter((reason: string) => targetKey === "PP_POINTS" ? /landing/.test(reason) : reason.startsWith(`missing_target:${targetKey}@`));
          missing([targetKey], snapshot.error ? "observation_invalid" : evidence.length ? evidence.join(",") : "no_valid_selected_target_values");
        }
      } else missing(CURRENT_APPEARANCE_POLICY.targets, reasons.find(reason => /prior|no_selected|pending/.test(reason))
        ?? (row ? (row.verifiedAppearances ? "observation_not_emitted" : "no_verified_appearances_in_selected_games") : "not_assembled"));
    } else {
      const volume = own[NATIVE_GOALIE_VOLUME_POLICY_VERSION], win = own[NATIVE_GOALIE_WIN_POLICY_VERSION];
      if (!volume || !win) missing(GOALIE_TARGETS, reasons.find(reason => /no_selected|pending/.test(reason))
        ?? (row ? "no_verified_appearances_in_selected_games" : "not_assembled"));
      else {
        const volumeSnapshot = attempt(() => buildNativeGoalieVolumeRates(calc(volume)));
        if (volumeSnapshot.value?.targets.length) choose(volume, volumeSnapshot.value, VOLUME_TARGETS);
        missing(VOLUME_TARGETS, volumeSnapshot.error ? `volume_invalid:${volumeSnapshot.error}` : "volume_not_supported");
        const scope = input.summaries?.[String(player.playerId)];
        const receipt = scope ? summaryReceipt(cache, scope) : undefined;
        const usable = scope && receipt ? { scope, receipts: [receipt] } : null;
        const winSnapshot = attempt(() => buildNativeGoalieWinRates(calc(win)));
        if (winSnapshot.value && supported(winSnapshot.value).has("WINS_GOALIE")) choose(win, winSnapshot.value, ["WINS_GOALIE"]);
        else if (winSnapshot.error) missing(["WINS_GOALIE"], `win_invalid:${winSnapshot.error}`);
        else if (!usable) missing(["WINS_GOALIE"], `win_decision_missing:${scope ? "summary_not_usable" : "summary_not_planned"}`);
        else {
          // Win held for a missing decision: the official summary is used only when it closes every gap.
          const payload = { ...volume.payload, policyVersion: NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION,
            definitionHash: nativeGoalieSummaryWinDefinitionHash(seasonId), winSummary: usable };
          const observation = envelope(seasonId, volume.available_at, volume.dataset_key, payload);
          const snapshot = attempt(() => buildNativeGoalieSummaryWinRates(calc(observation)));
          if (snapshot.value && supported(snapshot.value).has("WINS_GOALIE")) choose(observation, snapshot.value, ["WINS_GOALIE"]);
          else missing(["WINS_GOALIE"], snapshot.error ? `summary_win_invalid:${snapshot.error}` : "win_decision_missing:summary_does_not_close_gap");
        }
        if (!usable) missing(["SHUTOUTS_GOALIE"], scope ? "summary_receipt_missing" : "summary_not_planned");
        else {
          const payload = { ...volume.payload, policyVersion: NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
            definitionHash: nativeGoalieShutoutDefinitionHash(seasonId), shutoutSummary: usable };
          const observation = envelope(seasonId, volume.available_at, volume.dataset_key, payload);
          const snapshot = attempt(() => buildNativeGoalieShutoutRates(calc(observation)));
          if (snapshot.value && supported(snapshot.value).has("SHUTOUTS_GOALIE")) choose(observation, snapshot.value, ["SHUTOUTS_GOALIE"]);
          else missing(["SHUTOUTS_GOALIE"], snapshot.error ? `shutout_invalid:${snapshot.error}` : "shutout_credit_missing_or_ambiguous");
        }
      }
    }
    const targetOrder: string[] = player.playerClass === "skater" ? CURRENT_APPEARANCE_POLICY.targets : GOALIE_TARGETS;
    coverage.push({ playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, playerClass: player.playerClass, teamId: player.teamId,
      selectedGames: (input.playerGames[String(player.playerId)] ?? []).length, verifiedAppearances: row?.verifiedAppearances ?? null,
      selectedPolicies: selected.filter(value => value.payload.playerId === player.playerId).map(value => value.payload.policyVersion),
      targets: targets.sort((a, b) => targetOrder.indexOf(a.targetKey) - targetOrder.indexOf(b.targetKey)), reasons,
      seasonAppearanceAbsence: "unverified", games: row?.games ?? [] });
  }
  const pieces = nativeMeansMaterializationPieces(selected);
  return { version: "native-daily-means-v1" as const, seasonId, cutoffAt, assembledAt: now.toISOString(), ...pieces, coverage,
    stats: { assemblerCalls, groups: groups.size, selected: selected.length, parents: pieces.parents.length,
      observationBytes: Buffer.byteLength(JSON.stringify(pieces.additionalNativeObservations)), parentBytes: Buffer.byteLength(JSON.stringify(pieces.parents)) },
    networkRequests: 0, databaseWrites: 0, forecastIssued: false, publicUsesApproved: false };
}
export type NativeDailyMeans = ReturnType<typeof assembleNativeDailyMeans>;

/** Selection, additional observations and every original (plus content-hash) parent their payloads reference,
 * shaped as `NativeMaterializationRequest`. Mirrors the materializer's binding check before handing over. */
export function nativeMeansMaterializationPieces(observations: NativeMeansObservation[]) {
  if (new Set(observations.map(value => `${value.payload.playerId}:${value.payload.policyVersion}`)).size !== observations.length) fail("ambiguous_native_selection");
  const parents = new Map<string, NativeMaterializationParent>();
  const original = (receipt: HttpReceipt) => parents.set(receipt.bodySha256, { id: `http:${receipt.bodySha256}`, hash: receipt.bodySha256,
    availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt, original: { url: receipt.url, rawBody: receipt.rawBody, bodySha256: receipt.bodySha256 } });
  const content = (row: any, contentHash: string) => {
    if (!row?.httpReceipt) fail("observation_without_original_http_receipt");
    original(row.httpReceipt);
    if (contentHash !== row.httpReceipt.bodySha256 && !parents.has(contentHash)) parents.set(contentHash, { id: `http:${row.httpReceipt.bodySha256}`, hash: contentHash,
      availableAt: row.httpReceipt.capturedAt, capturedAt: row.httpReceipt.capturedAt, derived: { payload: row.payload, parentHashes: [row.httpReceipt.bodySha256] } });
  };
  for (const { payload } of observations) {
    for (const appearance of payload.appearances ?? []) content(appearance.finalBoxscore.rawRow, appearance.finalBoxscore.contentHash);
    for (const landing of payload.derivedPowerPlayPoints?.landings ?? []) content(landing.rawRow, landing.contentHash);
    for (const receipt of [...(payload.shutoutSummary?.receipts ?? []), ...(payload.winSummary?.receipts ?? [])]) original(receipt);
  }
  // Same rule as the materializer: every content/body hash inside an additional observation must be a parent.
  const bind = (value: any): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["contentHash", "bodySha256"].includes(key) && typeof child === "string" && !parents.has(child)) fail("unbound_original_hash");
      if (child && typeof child === "object") bind(child);
    }
  };
  for (const observation of observations) bind(observation.payload);
  const sortedParents = [...parents.values()].sort((a, b) => a.hash.localeCompare(b.hash));
  return {
    nativeSelection: observations.map(value => ({ playerId: value.payload.playerId as number, policyVersion: value.payload.policyVersion as string, inputHash: value.payload_hash }))
      .sort((a, b) => a.playerId - b.playerId || a.policyVersion.localeCompare(b.policyVersion)),
    additionalNativeObservations: [...observations].sort((a, b) => a.payload.playerId - b.payload.playerId
      || a.payload.policyVersion.localeCompare(b.payload.policyVersion)),
    parents: sortedParents,
    requiredParents: sortedParents.map(parent => ({ id: parent.id, hash: parent.hash, availableAt: parent.availableAt, capturedAt: parent.capturedAt,
      url: parent.original?.url ?? null })),
  };
}

/** Union of parent sets by hash for one materialization request. An identical hash must carry identical content;
 * when two derived parents share a hash with different ids the first set wins, so pass participation parents first
 * (their evidence ids are checked exactly; native observations bind by hash only). */
export function mergeNativeMaterializationParents(...sets: NativeMaterializationParent[][]) {
  const merged = new Map<string, NativeMaterializationParent>();
  for (const parent of sets.flat()) {
    const existing = merged.get(parent.hash);
    if (!existing) { merged.set(parent.hash, parent); continue; }
    const body = (value: NativeMaterializationParent) => hash({ original: value.original ?? null, derived: value.derived ?? null,
      availableAt: value.availableAt, capturedAt: value.capturedAt });
    if (body(existing) !== body(parent) || (existing.original && existing.id !== parent.id)) fail("parent_hash_conflict");
  }
  const parents = [...merged.values()];
  return { parents, requiredParents: parents.map(parent => ({ id: parent.id, hash: parent.hash, availableAt: parent.availableAt,
    capturedAt: parent.capturedAt, url: parent.original?.url ?? null })) };
}
