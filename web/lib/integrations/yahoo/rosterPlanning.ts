import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { INFERRED_ACQUISITION_TIMING_KEY, INFERRED_ACQUISITION_TIMING_SOURCE } from "lib/rosterScheduleOptimizer/providerRules";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import { normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { nextLocalMidnight, zonedMidnight } from "lib/rosterScheduleOptimizer/planningDates";
import type { AcquisitionEvidence, LeagueRules, PastLineup, PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot, ProviderCapabilities, RosterEntry, ScoringCategory, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { assertYahooLeagueGameContext, resolveYahooGameContext } from "./gameContext";
import { parseYahooBoardSettings, YAHOO_STAT_KEY_BY_ID, YahooLiveDraftError } from "./liveDraft";
import { fetchYahooBoardResource, fetchYahooDraftResource, fetchYahooPlanningResource, type YahooProviderJsonResult } from "./providerClient";
import { yahooBoardPlayers, yahooFields, yahooInferredAcquisitionTiming, yahooValue } from "./starterBoard";
import { cacheKey, currentTodayRoster, todayRosterCache, YAHOO_DISCOVERY_TTL_MS, YAHOO_LEAGUE_FACTS_TTL_MS, YAHOO_SETTINGS_TTL_MS, yahooOwnershipSignature, yahooReadCache, yahooSettingsCache } from "./planningCache";
import { legacyYahooIdentities, loadVerifiedYahooIdentityMap, rsoYahooDietEnabled } from "./yahooIdentity";

type Row = Record<string, any>;
const text = (value: unknown): string | null => typeof value === "string" || typeof value === "number" ? String(value) : null;
const numeric = (value: unknown): number | null => value === null || value === undefined || value === "" || value === "-" || !Number.isFinite(Number(value)) ? null : Number(value);
const yes = (value: unknown) => value === true || value === 1 || value === "1";
const no = (value: unknown) => value === false || value === 0 || value === "0";
/** A recorded lineup for an elapsed day never changes, so a warm instance reuses it instead of asking Yahoo again. */
const pastRosterCache = new Map<string, Row[]>();
const PAST_ROSTER_CACHE_LIMIT = 500;
/** RSO Yahoo diet caches (flag RSO_YAHOO_DIET): keyed by principal, judged for freshness at their own read time. */
const leagueFactsCache = yahooReadCache<{ result: YahooProviderJsonResult; signature: string | null }>();
type DiscoveryScan = { rows: Row[]; pagesAttempted: number; pagesChecked: number; pagesAccepted: number; rowsAccepted: number;
  repeatedRows: number; elapsed: number; stop: string; complete: boolean; limitations: string[]; signature: string };
const discoveryCache = yahooReadCache<DiscoveryScan>();
/** Private elapsed-day lineups (D4 migration, not yet applied): player keys and slots only. */
const PAST_LINEUP_TABLE = "rso_yahoo_past_lineups";

/** The per-game WGO column behind each points-league stat Yahoo scores per game; ratio stats can't be scored per game. */
const SKATER_POINT_COLUMNS: Readonly<Record<string, string>> = { GOALS: "goals", ASSISTS: "assists", POINTS: "points",
  PLUS_MINUS: "plus_minus", PENALTY_MINUTES: "penalty_minutes", PP_GOALS: "pp_goals", PP_ASSISTS: "pp_assists", PP_POINTS: "pp_points",
  SH_GOALS: "sh_goals", SH_ASSISTS: "sh_assists", SH_POINTS: "sh_points", GAME_WINNING_GOALS: "gw_goals", SHOTS_ON_GOAL: "shots",
  FACEOFFS_WON: "total_fow", FACEOFFS_LOST: "total_fol", HITS: "hits", BLOCKED_SHOTS: "blocked_shots" };
const GOALIE_POINT_COLUMNS: Readonly<Record<string, string>> = { WINS_GOALIE: "wins", LOSSES_GOALIE: "losses",
  GOALS_AGAINST_GOALIE: "goals_against", SHOTS_AGAINST_GOALIE: "shots_against", SAVES_GOALIE: "saves", SHUTOUTS_GOALIE: "shutouts",
  GAMES_STARTED: "games_started" };
const isGoalieStat = (key: string) => key.endsWith("_GOALIE") || ["GAMES_STARTED", "GOALS_AGAINST_AVERAGE", "SAVE_PERCENTAGE"].includes(key);

/**
 * Each recorded player's actual fantasy points that night, from the NHL game stats in `wgo_skater_stats` /
 * `wgo_goalie_stats` and the league's own weights (points leagues only). A player who sat out a landed game scores 0;
 * no game is null, and so is a game not final yet, one whose stats haven't landed, or a league weight that can't be
 * scored per game. Yahoo's own total can differ after its stat corrections.
 */
export async function yahooPastLineupPoints(db: SupabaseClient<any>, args: {
  pastLineups: PastLineup[]; players: PlanningPlayer[]; games: PlanningGame[]; scoring: LeagueRules["scoring"];
}): Promise<PastLineup[]> {
  if (args.scoring.mode !== "points" || !args.pastLineups.length) return args.pastLineups;
  const weights = Object.entries(args.scoring.weights).filter(([, weight]) => Number.isFinite(weight) && weight !== 0);
  const tiers = {
    skater: { weights: weights.filter(([key]) => !isGoalieStat(key)), columns: SKATER_POINT_COLUMNS, table: "wgo_skater_stats", id: "player_id" },
    goalie: { weights: weights.filter(([key]) => isGoalieStat(key)), columns: GOALIE_POINT_COLUMNS, table: "wgo_goalie_stats", id: "goalie_id" },
  } as const;
  const byId = new Map(args.players.map(player => [player.id, player]));
  const gameOf = (player: PlanningPlayer, date: string) => args.games.find(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation);
  const gameIds = new Set<number>();
  for (const day of args.pastLineups) for (const entry of day.entries) {
    const player = entry.playerId ? byId.get(entry.playerId) : undefined, game = player ? gameOf(player, day.date) : undefined;
    if (game?.status === "final" && Number.isSafeInteger(Number(game.id))) gameIds.add(Number(game.id));
  }
  const rowsFor = new Map<"skater" | "goalie", Row[] | null>();
  for (const [playerClass, tier] of Object.entries(tiers) as Array<["skater" | "goalie", (typeof tiers)["skater" | "goalie"]]>) {
    if (!gameIds.size || !tier.weights.every(([key]) => key in tier.columns)) { rowsFor.set(playerClass, null); continue; }
    const columns = [...new Set(tier.weights.map(([key]) => tier.columns[key]))];
    const rows: Row[] = [];
    let failed = false;
    for (let offset = 0; ; offset += 1000) {
      const page = await db.from(tier.table).select([tier.id, "game_id", ...columns].join(",")).in("game_id", [...gameIds])
        .order("game_id").order(tier.id).range(offset, offset + 999);
      if (page.error) { failed = true; break; }
      rows.push(...(page.data ?? []) as Row[]);
      if ((page.data?.length ?? 0) < 1000) break;
    }
    rowsFor.set(playerClass, failed ? null : rows);
  }
  const pointsOf = (player: PlanningPlayer | undefined, date: string): number | null => {
    if (!player || player.nhlId === null || !player.teamAbbreviation) return null;
    const game = gameOf(player, date);
    if (game?.status !== "final") return null;
    const tier = tiers[player.playerClass], rows = rowsFor.get(player.playerClass);
    if (!rows) return null;
    const gameRows = rows.filter(row => Number(row.game_id) === Number(game.id));
    if (!gameRows.length) return null;
    const own = gameRows.find(row => Number(row[tier.id]) === player.nhlId);
    if (!own) return 0;
    let total = 0;
    for (const [key, weight] of tier.weights) {
      const raw = own[tier.columns[key]];
      if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      total += value * weight;
    }
    return Math.round(total * 100) / 100;
  };
  return args.pastLineups.map(day => ({ ...day, entries: day.entries.map(entry =>
    ({ ...entry, points: pointsOf(entry.playerId ? byId.get(entry.playerId) : undefined, day.date) })) }));
}

/**
 * Goalie appearances Yahoo has already credited toward this matchup's minimum: a goalie it recorded in an active G slot
 * on an elapsed day who played in his team's game that day (`wgo_goalie_stats.games_played`). 0 before the first day
 * ends. Null (unknown) unless every elapsed day's lineup was read and every such game is final with its goalie rows
 * landed, so a partial read never undercounts.
 */
export async function yahooCreditedGoalieAppearances(db: SupabaseClient<any>, args: {
  periodStart?: string | null; today: string; pastLineups: PastLineup[]; slots: ReadonlyArray<{ id: string; type: string }>;
  players: PlanningPlayer[]; games: PlanningGame[];
}): Promise<number | null> {
  if (!args.periodStart || !/^\d{4}-\d{2}-\d{2}$/.test(args.periodStart)) return null;
  const goalieSlots = new Set(args.slots.filter(slot => slot.type === "G").map(slot => slot.id));
  const checks: Array<{ gameId: number; nhlId: number }> = [];
  for (let time = Date.parse(`${args.periodStart}T12:00:00Z`); ; time += 86400000) {
    const day = new Date(time).toISOString().slice(0, 10);
    if (day >= args.today) break;
    const lineup = args.pastLineups.find(row => row.date === day);
    if (!lineup) return null;
    for (const entry of lineup.entries) {
      if (!entry.slotId || !goalieSlots.has(entry.slotId)) continue;
      const player = args.players.find(row => row.id === entry.playerId);
      if (!player || player.nhlId === null || !player.teamAbbreviation) return null;
      const game = args.games.find(row => row.date === day && row.teamAbbreviation === player.teamAbbreviation);
      if (!game || game.status === "cancelled" || game.status === "postponed") continue;
      if (game.status !== "final" || !Number.isSafeInteger(Number(game.id))) return null;
      checks.push({ gameId: Number(game.id), nhlId: player.nhlId });
    }
  }
  if (!checks.length) return 0;
  const { data, error } = await db.from("wgo_goalie_stats").select("goalie_id,game_id,games_played")
    .in("game_id", [...new Set(checks.map(check => check.gameId))]);
  if (error) return null;
  const rows = (data ?? []) as Array<{ goalie_id: number | null; game_id: number | null; games_played: number | null }>;
  let credited = 0;
  for (const check of checks) {
    const gameRows = rows.filter(row => Number(row.game_id) === check.gameId);
    // No goalie rows yet for a final game: the WGO load hasn't landed, so progress stays unknown.
    if (!gameRows.length) return null;
    if (gameRows.some(row => Number(row.goalie_id) === check.nhlId && Number(row.games_played) > 0)) credited += 1;
  }
  return credited;
}

export function yahooPlanningEditable(rosterEditable: unknown, playerEditable: unknown, fresh: boolean, started: boolean, daily: boolean) {
  return fresh && yes(rosterEditable) && yes(playerEditable) && !started && daily;
}

/** Standard JSON nests collections under numeric keys and represents an empty one as []. */
export function yahooPlanningPlayers(payload: unknown): Row[] {
  const collection = yahooValue(payload, "players");
  const rows = yahooBoardPlayers(payload);
  const count = Array.isArray(collection) && collection.length === 0 ? 0 : numeric(yahooFields(collection).count);
  if (count !== rows.length) throw new YahooLiveDraftError("Yahoo returned an incomplete player list. Try refreshing again; your selected plan is preserved.", 502, "yahoo_player_collection_incomplete");
  return rows;
}

function eligibility(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const row = node as Row;
  if (typeof row.position === "string") return [row.position];
  return Object.values(node).flatMap(eligibility);
}

/** Yahoo's own injury designation for a player row; other statuses (e.g. NA, SUSP) are not injuries. */
const YAHOO_INJURY_STATUSES = new Set(["IR", "IR-LT", "IR-NR", "O", "DTD", "INJ"]);
export function yahooInjury(row: Record<string, unknown>): PlanningPlayer["injury"] {
  const status = typeof row.status === "string" ? row.status.trim().toUpperCase() : "";
  if (!YAHOO_INJURY_STATUSES.has(status)) return null;
  const label = typeof row.status_full === "string" && row.status_full.trim() ? row.status_full.trim() : status;
  const note = typeof row.injury_note === "string" && row.injury_note.trim() ? row.injury_note.trim() : null;
  return { status, label, note };
}
/** Yahoo's daily goalie mark ("Starting" / "Not Starting"): a roster player's `starting_status` for the roster's own
 * date. Yahoo omits it until it knows (e.g. tomorrow's roster), so absent or any other date stays null (unknown). */
export function yahooStartingStatus(row: Record<string, unknown>, date: string, observedAt: string | null): PlanningPlayer["startingStatus"] {
  const status = yahooFields(row.starting_status);
  const read = Date.parse(observedAt ?? "");
  if (text(status.coverage_type) !== "date" || text(status.date) !== date || !Number.isFinite(read)
    || !(yes(status.is_starting) || no(status.is_starting))) return null;
  return { source: "yahoo", date, isStarting: yes(status.is_starting), observedAt: new Date(read).toISOString() };
}
export function yahooPlanningCategories(keys: string[]): ScoringCategory[] {
  return keys.map((key) => key === "SAVE_PERCENTAGE"
    ? { key, direction: "higher", numerator: "SAVES_GOALIE", denominator: "SHOTS_AGAINST_GOALIE" }
    : key === "GOALS_AGAINST_AVERAGE"
      ? { key, direction: "lower", numerator: "GOALS_AGAINST_GOALIE", denominator: "GOALIE_MINUTES", multiplier: 60 }
      : key === "SHOOTING_PERCENTAGE"
        ? { key, direction: "higher", numerator: "GOALS", denominator: "SHOTS_ON_GOAL" }
        : { key, direction: ["GOALS_AGAINST_GOALIE", "LOSSES_GOALIE"].includes(key) ? "lower" : "higher" });
}

export function yahooPlanningStats(payload: unknown): StatLine {
  const result: StatLine = {};
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const row = yahooFields(value);
    if (row.stat_id !== undefined) {
      const key = YAHOO_STAT_KEY_BY_ID[String(row.stat_id)];
      if (key) result[key] = numeric(row.value);
      return;
    }
    Object.values(value).forEach(visit);
  };
  visit(payload);
  return result;
}

/** Preserve team boundaries; flattening the league's players loses opponent identity. */
export function yahooPlanningTeams(payload: unknown): Row[] {
  const rows: Row[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const row = value as Row;
    if (row.team) { rows.push(yahooFields(row.team)); return; }
    Object.values(value).forEach(visit);
  };
  visit(payload);
  return rows;
}

function providerFresh(result: YahooProviderJsonResult, now: Date) {
  const at = Date.parse(result.transport.responseDate ?? "");
  return Number.isFinite(at) && Math.abs(now.getTime() - at) <= 120000
    && (result.transport.ageSeconds === null || result.transport.ageSeconds >= 0 && result.transport.ageSeconds <= 60);
}

/** Official team.roster_adds is a weekly counter, separate from season moves.
 * A positive max_weekly_adds is the weekly add limit; zero or absent stays unknown, never unlimited. */
export function yahooPlanningAcquisitions(args: {
  settings: YahooProviderJsonResult; league: YahooProviderJsonResult | null; team: YahooProviderJsonResult | null;
  weeks: PlanningData["matchupWeeks"]; gameKey: string; leagueKey: string; teamKey: string;
  startDate: string; endDate: string; now: Date; leagueReadAt?: Date; teamReadAt?: Date;
}): AcquisitionEvidence {
  const league = yahooFields(yahooValue(args.league?.payload, "league") ?? args.league?.payload);
  const teams = args.team ? yahooPlanningTeams(args.team.payload) : [];
  const team = teams.length === 1 ? teams[0] : {};
  const counter = yahooFields(team.roster_adds);
  const settings = yahooFields(yahooValue(args.settings.payload, "settings") ?? args.settings.payload);
  const integer = (value: unknown): number | null => (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value.trim()))
    && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const scalar = (value: unknown): string | number | boolean | null => typeof value === "string" ? value.slice(0, 100)
    : typeof value === "number" && Number.isFinite(value) || typeof value === "boolean" ? value as number | boolean : null;
  const positive = (value: unknown) => { const number = integer(value); return number !== null && number > 0 ? number : null; };
  const week = positive(league.current_week);
  const coverageWeek = positive(counter.coverage_value);
  const calendar = (args.weeks ?? []).filter(row => row.gameKey === args.gameKey && row.week === week);
  const period = calendar.length === 1 ? calendar[0] : null;
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  const datesValid = period && validDate(period.startDate) && validDate(period.endDate) && period.startDate <= period.endDate;
  const containsHorizon = Boolean(datesValid && args.startDate >= period!.startDate && args.endDate <= period!.endDate
    && args.startDate <= args.endDate && validDate(args.startDate) && validDate(args.endDate));
  const limitations: string[] = [];
  const fresh = args.league && args.team && providerFresh(args.league, args.leagueReadAt ?? args.now) && providerFresh(args.team, args.teamReadAt ?? args.now);
  const scope = league.league_key === args.leagueKey && team.team_key === args.teamKey && yes(team.is_owned_by_current_login);
  const counterValid = fresh && scope && counter.coverage_type === "week" && week !== null && week === coverageWeek && containsHorizon;
  const used = counterValid ? integer(counter.value) : null;
  const limit = positive(settings.max_weekly_adds);
  const remaining = used !== null && limit !== null && used <= limit ? limit - used : null;
  if (!fresh) limitations.push("Yahoo weekly acquisition counter or league freshness is unverified.");
  if (!scope) limitations.push("Yahoo weekly acquisition counter ownership or league scope is unverified.");
  if (counter.coverage_type !== "week" || week === null || week !== coverageWeek) limitations.push("Yahoo acquisition counter does not match the league's current week.");
  if (!containsHorizon) limitations.push("Selected dates are not contained in one verified current Yahoo game week; its counter cannot describe this horizon.");
  if (used === null) limitations.push("Weekly acquisitions used are unknown; season moves and transaction logs are not substitutes.");
  if (limit === null) limitations.push("Yahoo did not report a positive weekly add limit. Remaining allowance is unknown; zero is not assumed to mean unlimited.");
  else if (used !== null && used > limit) limitations.push("Yahoo weekly adds used exceed the reported weekly limit; remaining allowance is unknown.");
  return { source: "Yahoo team roster_adds and league current_week", fetchedAt: args.now.toISOString(),
    asOf: args.team?.transport.responseDate ?? null,
    counter: { present: Object.prototype.hasOwnProperty.call(team, "roster_adds"), coverageType: text(counter.coverage_type),
      coverageWeek, reportedValue: scalar(counter.value), used },
    limit: { present: Object.prototype.hasOwnProperty.call(settings, "max_weekly_adds"), reportedValue: scalar(settings.max_weekly_adds), verified: limit !== null },
    period: { week, startDate: datesValid ? period!.startDate : null, endDate: datesValid ? period!.endDate : null, containsHorizon },
    remaining, limitations };
}

/** Retry one timed-out required read; rate limits and access errors are never retried. */
export async function readRequiredPlanningResource<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (!(error instanceof YahooLiveDraftError) || error.code !== "yahoo_api_timeout") throw error;
    return read();
  }
}

export async function loadYahooPlanningSnapshot(args: {
  db: SupabaseClient<any>; userId: string; teamId: string; startDate: string; endDate: string; timeZone?: string; now?: Date;
  /** "manual" (Refresh provider) bypasses every diet cache; timed upkeep is "auto". */
  refresh?: "auto" | "manual";
}): Promise<{ snapshot: PlanningSnapshot; capabilities: ProviderCapabilities; code?: string; retryAfterSeconds?: number | null; yahooDiet?: true }> {
  const { db, userId } = args;
  const now = args.now ?? new Date();
  const { data: team, error: teamError } = await db.from("external_teams").select("*")
    .eq("id", args.teamId).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (teamError || !team || yahooFields(team.team_metadata).is_owned !== true) throw new YahooLiveDraftError("Choose an owned Yahoo team from your account.", 404, "team_unavailable");
  const { data: league, error: leagueError } = await db.from("external_leagues").select("*")
    .eq("id", team.external_league_id).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (leagueError || !league || league.connected_account_id !== team.connected_account_id) throw new YahooLiveDraftError("League is not available to this account.", 404, "league_unavailable");
  const gameContext = await resolveYahooGameContext(db);
  assertYahooLeagueGameContext(league.external_league_key, gameContext);
  const query = parsePlanningDataQuery({ seasonId: gameContext.targetSeasonId, startDate: args.startDate, endDate: args.endDate });
  const provider = { client: db, userId, connectedAccountId: team.connected_account_id, context: gameContext, leagueKey: league.external_league_key, format: "standard_json" as const, now };
  const diet = rsoYahooDietEnabled(), reuse = diet && args.refresh !== "manual";
  let yahooReads = 0;
  const counted = <T>(read: () => Promise<T>) => () => { yahooReads++; return read(); };
  let refreshError: YahooLiveDraftError | undefined;
  let retryAfterSeconds: number | null = null;
  const optionalFailure = (error: unknown) => {
    if (error instanceof YahooLiveDraftError) {
      if (error.retryAfterSeconds !== null && Number.isFinite(error.retryAfterSeconds) && error.retryAfterSeconds >= 0) retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, error.retryAfterSeconds);
      const authorizationFailed = (code: string) => code === "yahoo_reauth_required" || code === "yahoo_access_denied";
      if (!refreshError || authorizationFailed(error.code)
        || (!authorizationFailed(refreshError.code) && error.code === "yahoo_rate_limited")) refreshError = error;
    }
    return null;
  };
  const settingsKey = cacheKey(userId, league.external_league_key);
  const cachedSettings = reuse ? yahooSettingsCache.get(settingsKey, YAHOO_SETTINGS_TTL_MS, now.getTime()) : null;
  const settingsResponse = cachedSettings?.value ?? await readRequiredPlanningResource(counted(() => fetchYahooDraftResource({ ...provider, resource: "settings" })));
  const settingsReadAt = cachedSettings ? new Date(cachedSettings.readAt) : now;
  if (text(yahooValue(settingsResponse.payload, "league_key")) !== league.external_league_key) throw new Error("Yahoo settings league mismatch");
  if (diet && !cachedSettings) yahooSettingsCache.set(settingsKey, settingsResponse, now.getTime());
  const providerTimeZone = text(yahooValue(settingsResponse.payload, "time_zone"));
  const timeZone = providerTimeZone ?? args.timeZone ?? "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone }).format(now); } catch { throw new YahooLiveDraftError("Choose a valid league time zone.", 400, "invalid_time_zone"); }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // Elapsed days of the selected matchup (league-local), read as Yahoo recorded them; a combined matchup has at most 13.
  const pastDates: string[] = [];
  for (let time = Date.parse(`${query.startDate}T12:00:00Z`); pastDates.length < 13; time += 86400000) {
    const day = new Date(time).toISOString().slice(0, 10);
    if (day >= today || day > query.endDate) break;
    pastDates.push(day);
  }
  // D4: stored elapsed-day lineups are read before Yahoo; a missing table or failed read just falls back to Yahoo.
  const storedPast = new Map<string, Row[]>();
  if (diet && pastDates.length) {
    const stored = await db.from(PAST_LINEUP_TABLE).select("lineup_date,entries").eq("user_id", userId).eq("external_team_id", team.id)
      .eq("season_id", query.seasonId).in("lineup_date", pastDates).then(value => value, () => ({ data: null, error: true }));
    if (!stored.error) for (const row of (stored.data ?? []) as Row[]) {
      const entries = Array.isArray(row.entries) ? row.entries : [];
      if (entries.every((entry: Row) => typeof entry?.player_key === "string" && typeof entry?.position === "string"))
        storedPast.set(String(row.lineup_date), entries.map((entry: Row) => ({ player_key: entry.player_key, selected_position: { position: entry.position } })));
    }
  }
  const pastRosterReads = Promise.all(pastDates.map(async date => {
    const key = `${userId}|${team.external_team_key}|${date}`;
    const cached = pastRosterCache.get(key) ?? storedPast.get(date);
    if (cached) return { date, rows: cached };
    try {
      const response = await counted(() => fetchYahooBoardResource({ ...provider, resource: { type: "roster", teamKey: team.external_team_key, date } }))();
      const payload = yahooFields(yahooValue(response.payload, "roster"));
      if (text(yahooValue(response.payload, "team_key")) !== team.external_team_key || text(payload.date) !== date
        || text(payload.coverage_type) !== "date" || !yes(yahooValue(response.payload, "is_owned_by_current_login"))) return { date, rows: null };
      const rows = yahooPlanningPlayers(response.payload);
      if (pastRosterCache.size >= PAST_ROSTER_CACHE_LIMIT) pastRosterCache.delete(pastRosterCache.keys().next().value!);
      pastRosterCache.set(key, rows);
      if (diet) await db.from(PAST_LINEUP_TABLE).upsert({ user_id: userId, external_team_id: team.id, season_id: query.seasonId, lineup_date: date,
        entries: rows.map(row => ({ player_key: String(row.player_key), position: text(yahooFields(row.selected_position).position) ?? "BN" })) },
      { onConflict: "user_id,external_team_id,lineup_date" }).then(() => undefined, () => undefined);
      return { date, rows };
    } catch (error) { optionalFailure(error); return { date, rows: null }; }
  }));
  const rosterKey = cacheKey(userId, team.external_team_key, today);
  const cachedRoster = reuse ? currentTodayRoster(rosterKey, now.getTime()) : null;
  const factKey = (resource: string) => cacheKey(userId, league.external_league_key, team.external_team_key, resource);
  const cachedFact = (resource: string) => reuse ? leagueFactsCache.get(factKey(resource), YAHOO_LEAGUE_FACTS_TTL_MS, now.getTime()) : null;
  const [cachedScoreboard, cachedLeague, cachedTeam] = ["scoreboard", "league", "team"].map(cachedFact);
  const [data, rosterResponse, scoreboardResult, leagueRosterResult, leagueFetched, teamFetched] = await Promise.all([
    loadPlanningData(db, { ...query, timeZone }, { now, forgeDailyBridge: true, consumer: "rso" }),
    cachedRoster ?? readRequiredPlanningResource(counted(() => fetchYahooBoardResource({ ...provider, resource: { type: "roster", teamKey: team.external_team_key, date: today } }))),
    cachedScoreboard?.value.result ?? counted(() => fetchYahooPlanningResource({ ...provider, resource: { type: "scoreboard" } }))().then(value => value, optionalFailure),
    counted(() => fetchYahooBoardResource({ ...provider, resource: { type: "league_rosters" } }))().then(value => value, optionalFailure),
    cachedLeague?.value.result ?? counted(() => fetchYahooPlanningResource({ ...provider, resource: { type: "league" } }))().then(value => value, optionalFailure),
    cachedTeam ? null : counted(() => fetchYahooPlanningResource({ ...provider, resource: { type: "team", teamKey: team.external_team_key } }))().then(value => value, optionalFailure),
  ]);
  const scoreboardReadAt = cachedScoreboard ? new Date(cachedScoreboard.readAt) : now;
  const leagueResult = leagueFetched, leagueReadAt = cachedLeague ? new Date(cachedLeague.readAt) : now;
  // Who owns whom, from this read. Any change re-reads the weekly counter and rescans availability.
  let ownershipSignature: string | null = null;
  if (diet && leagueRosterResult && providerFresh(leagueRosterResult, now)
    && text(yahooValue(leagueRosterResult.payload, "league_key")) === league.external_league_key) {
    try { ownershipSignature = yahooOwnershipSignature(yahooPlanningTeams(leagueRosterResult.payload)
      .map(row => ({ teamKey: String(row.team_key), playerKeys: yahooBoardPlayers(row).map(player => String(player.player_key)) }))); }
    catch { ownershipSignature = null; }
  }
  const cachedTeamCurrent = cachedTeam && ownershipSignature !== null && cachedTeam.value.signature === ownershipSignature ? cachedTeam : null;
  const teamResult = cachedTeamCurrent ? cachedTeamCurrent.value.result : cachedTeam
    ? await counted(() => fetchYahooPlanningResource({ ...provider, resource: { type: "team", teamKey: team.external_team_key } }))().then(value => value, optionalFailure)
    : teamFetched;
  const teamReadAt = cachedTeamCurrent ? new Date(cachedTeamCurrent.readAt) : now;
  if (diet) {
    if (!cachedScoreboard && scoreboardResult && providerFresh(scoreboardResult, now)) leagueFactsCache.set(factKey("scoreboard"), { result: scoreboardResult, signature: null }, now.getTime());
    if (!cachedLeague && leagueResult && providerFresh(leagueResult, now)) leagueFactsCache.set(factKey("league"), { result: leagueResult, signature: null }, now.getTime());
    if (!cachedTeamCurrent && teamResult && ownershipSignature !== null && providerFresh(teamResult, now)) leagueFactsCache.set(factKey("team"), { result: teamResult, signature: ownershipSignature }, now.getTime());
  }
  const acquisitionEvidence = yahooPlanningAcquisitions({ settings: settingsResponse, league: leagueResult, team: teamResult,
    weeks: data.matchupWeeks, gameKey: gameContext.gameKey, leagueKey: league.external_league_key, teamKey: team.external_team_key,
    startDate: query.startDate, endDate: query.endDate, now, leagueReadAt, teamReadAt });
  const rosterPayload = yahooFields(yahooValue(rosterResponse.payload, "roster"));
  if (text(yahooValue(rosterResponse.payload, "team_key")) !== team.external_team_key
    || text(rosterPayload.date) !== today || text(rosterPayload.coverage_type) !== "date"
    || !yes(yahooValue(rosterResponse.payload, "is_owned_by_current_login"))) throw new Error("Yahoo did not verify roster date, scope and ownership");
  const ownRows = yahooPlanningPlayers(rosterResponse.payload);
  if (diet && !cachedRoster) todayRosterCache.set(rosterKey, rosterResponse, now.getTime());
  if (!ownRows.length) throw new YahooLiveDraftError(
    text(yahooValue(settingsResponse.payload, "draft_status")) === "predraft"
      ? "Yahoo reports this league is still pre-draft. Select your drafted league from My team; league names are shown beside each team."
      : "Yahoo returned an empty roster for this team today. Check the selected league and team, then refresh after Yahoo makes the roster available.",
    409, "yahoo_roster_empty",
  );
  const fresh = providerFresh(settingsResponse, settingsReadAt) && providerFresh(rosterResponse, now);
  const limitations: string[] = [];
  limitations.push(...acquisitionEvidence.limitations);
  if (cachedSettings) limitations.push(`League settings were read from Yahoo at ${settingsReadAt.toISOString()} and are reused for up to 6 hours; Refresh provider reads them again.`);
  if (cachedTeamCurrent || cachedLeague) limitations.push(`Yahoo's weekly add counter and current week were read at ${(cachedTeamCurrent ? teamReadAt : leagueReadAt).toISOString()}; they refresh every 30 minutes, when league rosters change, or on Refresh provider.`);
  if (!fresh) limitations.push("Yahoo roster/settings freshness could not be verified; affected lock and availability claims remain unknown.");
  // Yahoo league settings carry no time zone; the client reviews a supplied zone with the manager.
  if (!providerTimeZone && !args.timeZone) limitations.push("League time zone is unknown; UTC is a display fallback and timing requires verification.");
  // D8: the flag resolves identities through verified fhfh_player_external_identities; otherwise the legacy map.
  let identities: Map<string, string>;
  if (diet) identities = await loadVerifiedYahooIdentityMap(db, gameContext);
  else {
    const mapping: Row[] = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id")
        .order("yahoo_player_id").order("nhl_player_id").range(offset, offset + 999);
      if (page.error) throw page.error;
      mapping.push(...page.data ?? []);
      if ((page.data?.length ?? 0) < 1000) break;
    }
    // The mapping view contains full keys from multiple Yahoo seasons; only this game's unique pairs resolve.
    identities = legacyYahooIdentities(mapping, gameContext.gameKey, data.players);
  }
  const byId = new Map(data.players.map(player => [player.id, player]));
  const resolve = (row: Row) => {
    const id = identities.get(String(row.player_key ?? ""));
    return id === undefined ? undefined : byId.get(id);
  };
  const roster: RosterEntry[] = [];
  const positions = new Map<string, string>();
  const unavailableIds = new Set<string>();
  const leagueTeams = leagueRosterResult && providerFresh(leagueRosterResult, now)
    && text(yahooValue(leagueRosterResult.payload, "league_key")) === league.external_league_key ? yahooPlanningTeams(leagueRosterResult.payload) : [];
  for (const leagueTeam of leagueTeams) for (const row of yahooBoardPlayers(leagueTeam)) {
    const player = resolve(row); if (player) unavailableIds.add(player.id);
  }
  for (const row of ownRows) {
    const player = resolve(row);
    if (!player) { limitations.push(`Roster player ${text(yahooFields(row.name).full) ?? row.player_key} has no unique canonical identity; review required.`); continue; }
    unavailableIds.add(player.id);
    const selected = text(yahooFields(row.selected_position).position) ?? "BN";
    positions.set(player.id, selected);
    const reportedEligibility = eligibility(row.eligible_positions);
    const explicitPositions = reportedEligibility.filter(value => !["BN", "IR", "IR+", "NA"].includes(value));
    if (explicitPositions.length) player.eligiblePositions = [...new Set(explicitPositions)];
    player.eligibilityVerified = fresh && explicitPositions.length > 0;
    player.providerId = String(row.player_key);
    player.canDrop = fresh && no(row.is_undroppable) ? true : yes(row.is_undroppable) ? false : null;
    player.injury = yahooInjury(row);
    if (player.playerClass === "goalie") player.startingStatus = fresh ? yahooStartingStatus(row, today, rosterResponse.transport.responseDate) : null;
    // Use explicit league eligibility, never infer it from injury status text.
    player.reserveEligibility = fresh ? reportedEligibility.filter((value): value is "IR" | "IR+" | "NA" => ["IR", "IR+", "NA"].includes(value)) : [];
    roster.push({ playerId: player.id, position: ["IR", "IR+", "NA"].includes(selected) ? selected as RosterEntry["position"] : selected === "BN" ? "bench" : "active" });
  }
  const settings = parseYahooBoardSettings(settingsResponse.payload);
  const daily = settings.rosterType === "date" || settings.rosterType === null && ["intraday", "tomorrow"].includes(settings.weeklyDeadline ?? "");
  const mode = daily ? "daily" : settings.rosterType === "week" ? "weekly" : "unsupported";
  const unsupported: string[] = [];
  if (!settings.scoringTypeRecognized || settings.unsupportedStatIds.length || settings.unsupportedRosterSlots.length) unsupported.push("Some league scoring or roster rules are unsupported.");
  if (!providerTimeZone && !args.timeZone) unsupported.push("Verify the league time zone before time-sensitive planning.");
  if (mode === "weekly") unsupported.push("Supply verified weekly lineup windows; the roster response alone does not establish their exact locks.");
  if (ownRows.length !== roster.length) unsupported.push("Resolve missing roster identities before accepting a complete plan.");
  if (!roster.length) unsupported.push("The connected roster is empty; review the team selection or import the roster manually.");
  // The remaining weekly allowance applies only inside the verified current Yahoo week that
  // contains the whole horizon. Planned actions are at or after now and within those dates, so
  // league-local midnight boundaries stand in for Yahoo's unreported reset instant.
  const { remaining, period: week } = acquisitionEvidence;
  const periods: LeagueRules["periods"] = remaining !== null && week.week !== null && week.startDate && week.endDate && week.containsHorizon
    ? [{ id: `yahoo-week-${week.week}`, start: zonedMidnight(week.startDate, timeZone), end: nextLocalMidnight(week.endDate, timeZone),
      remaining, source: "provider", ...(timeZone === "UTC" || timeZone.includes("/") ? { timeZone } : {}) }] : [];
  // The goalie minimum covers the current matchup week from yahoo_matchup_weeks, including
  // combined two-week matchups; the rule's period end is exclusive.
  const goaliePeriod = week.startDate && week.endDate ? { periodStart: week.startDate,
    periodEnd: new Date(Date.parse(`${week.endDate}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) } : { periodStart: null, periodEnd: null };
  const reserveSlots = Object.fromEntries(Object.entries(settings.excludedInjurySlots ?? {})
    .filter(([slot]) => ["IR", "IR+", "NA"].includes(slot.trim().toUpperCase())));
  // D6: same-day or next-day adds inferred from Yahoo's weekly deadline (as Start Chart does); the manager can override.
  const inferredTiming = diet && fresh ? yahooInferredAcquisitionTiming(settings) : null;
  const rules: LeagueRules = {
    // Restore supported reserve capacities that the draft parser excludes.
    lineupMode: mode, rosterSlots: { ...settings.rosterConfig, ...reserveSlots },
    // Without the diet flag, a lineup deadline does not establish when a transaction becomes effective.
    acquisitionTiming: inferredTiming ?? "unknown",
    acquisitionCost: periods.length ? 1 : null, periods, scoring: { mode: settings.leagueType, weights: { ...settings.scoringCategories }, categories: yahooPlanningCategories(Object.keys(settings.categoryWeights)) },
    goalieMinimum: { required: settings.minimumGoalieStarts, credited: null, counts: "unknown", penalty: "unknown", ...goaliePeriod }, unsupported,
  };
  const slots = expandActiveSlots(rules.rosterSlots).activeSlots;
  const usedSlots = new Set<string>();
  const lockedAssignments: PlanningSnapshot["lockedAssignments"] = [];
  for (const row of ownRows) {
    const player = resolve(row); if (!player) continue;
    const game = data.games.find(entry => entry.date === today && entry.teamAbbreviation === player.teamAbbreviation);
    const started = game && (game.startsAt === null || Date.parse(game.startsAt) <= now.getTime());
    if (yahooPlanningEditable(rosterPayload.is_editable, row.is_editable, fresh, Boolean(started), daily)) continue;
    const selected = positions.get(player.id)?.toUpperCase();
    const slot = slots.find(entry => entry.type === selected && !usedSlots.has(entry.id));
    if (slot) usedSlots.add(slot.id);
    lockedAssignments.push({ date: today, playerId: player.id, slotId: slot?.id ?? null });
  }
  const pastLineups: PastLineup[] = [];
  for (const { date, rows } of await pastRosterReads) {
    if (!rows) { limitations.push(`Yahoo's recorded lineup for ${date} could not be read; that day shows no lineup.`); continue; }
    const usedPast = new Set<string>();
    pastLineups.push({ date, source: "yahoo", entries: rows.map(row => {
      const player = resolve(row);
      const position = text(yahooFields(row.selected_position).position) ?? "BN";
      const slot = slots.find(entry => entry.type === position.toUpperCase() && !usedPast.has(entry.id));
      if (slot) usedPast.add(slot.id);
      return { playerId: player?.id ?? null, name: player?.name ?? text(yahooFields(row.name).full) ?? String(row.player_key), position, slotId: slot?.id ?? null };
    }) });
  }
  // Appearances already credited this matchup, from the lineups Yahoo recorded on its elapsed days.
  if ((rules.goalieMinimum.required ?? 0) > 0) rules.goalieMinimum.credited = await yahooCreditedGoalieAppearances(db, {
    periodStart: rules.goalieMinimum.periodStart, today, pastLineups, slots, players: data.players, games: data.games });
  const scoredPastLineups = await yahooPastLineupPoints(db, { pastLineups, players: data.players, games: data.games, scoring: rules.scoring });
  const unverifiedRules = [...(periods.length ? [] : ["remaining acquisitions, reset periods and counting rules"]),
    ...(rules.goalieMinimum.required === 0 || rules.goalieMinimum.credited !== null ? [] : ["goalie minimum progress"])];
  if (unverifiedRules.length) limitations.push(`Verify ${unverifiedRules.join(" and ")}; these are not inferred from season transaction totals.`);
  // capabilities.rules stays false: name every rule fact the planner still treats as unknown.
  const inferredTimingNote = inferredTiming && `Add timing is inferred from Yahoo's weekly deadline (${inferredTiming === "same_day" ? "same-day" : "next-day"}); change it in League rules if your league differs.`;
  if (inferredTimingNote) limitations.push(inferredTimingNote);
  const unreportedRules = [inferredTiming ? "whether the add timing inferred from Yahoo's weekly deadline is right" : "when an add takes effect (same-day or next-day)", "waiver mode and FAAB budget",
    ...(periods.length ? ["the exact weekly add reset time (league-local midnight is assumed)"] : []),
    ...(rules.goalieMinimum.required === null ? ["whether the league has a goalie minimum"]
      : rules.goalieMinimum.required > 0 ? ["how the goalie minimum counts (starts or appearances) and its penalty"] : [])];
  limitations.push(`Yahoo does not report these league rules; confirm them in League rules: ${unreportedRules.join("; ")}.`);
  let pagesChecked = 0, availabilityComplete = false;
  let pagesAttempted = 0, pagesAccepted = 0, rowsAccepted = 0, repeatedRows = 0;
  let availabilityStop = "page limit";
  let candidates = new Map<string, Row>();
  const availabilityStarted = Date.now();
  let availabilityElapsed = 0, availabilityAsOf = now.toISOString();
  let repeatedPageIdentity = false;
  // D2: a complete scan is reused for 15 minutes unless league rosters changed; Refresh provider always rescans.
  const scanKey = cacheKey(userId, league.external_league_key);
  const cachedScan = reuse && ownershipSignature !== null ? discoveryCache.get(scanKey, YAHOO_DISCOVERY_TTL_MS, now.getTime()) : null;
  const scan = cachedScan && cachedScan.value.signature === ownershipSignature ? cachedScan : null;
  const scanLimitations: string[] = [];
  if (scan) {
    ({ pagesAttempted, pagesChecked, pagesAccepted, rowsAccepted, repeatedRows, complete: availabilityComplete, stop: availabilityStop } = scan.value);
    availabilityElapsed = scan.value.elapsed; availabilityAsOf = new Date(scan.readAt).toISOString();
    candidates = new Map(scan.value.rows.map(row => [String(row.player_key), row]));
    scanLimitations.push(...scan.value.limitations,
      `League availability was scanned at ${availabilityAsOf}; it rescans every 15 minutes, when league rosters change, or on Refresh provider.`);
  } else {
  // Read all pages within a disclosed bound, independent of forecast availability. The first
  // page is read alone to surface limits or scope problems; later pages are fetched three at a
  // time but accepted strictly in order, so a failure or the end of the list stops at that page.
  read: for (let start = 0; start <= 2000;) {
    if ((retryAfterSeconds ?? 0) > 0 || refreshError?.code === "yahoo_rate_limited" || refreshError?.code === "yahoo_reauth_required" || refreshError?.code === "yahoo_access_denied") { availabilityStop = "provider backoff or access restriction"; break; }
    if (Date.now() - availabilityStarted >= 8000) { availabilityStop = "time budget"; scanLimitations.push("Availability discovery reached its time budget; remaining players are unknown."); break; }
    const batch = (start ? [start, start + 25, start + 50] : [0]).filter(page => page <= 2000);
    pagesAttempted += batch.length;
    const settled = await Promise.allSettled(batch.map(page => counted(() => fetchYahooPlanningResource({ ...provider, resource: { type: "available_page", start: page } }))()));
    pagesChecked += settled.filter(outcome => outcome.status === "fulfilled").length;
    start = batch[batch.length - 1] + 25;
    for (const outcome of settled) {
      let pageFailure = "request failure";
      try {
        if (outcome.status === "rejected") throw outcome.reason;
        const result = outcome.value;
        const pageFresh = providerFresh(result, now), pageScoped = text(yahooValue(result.payload, "league_key")) === league.external_league_key;
        if (!pageFresh || !pageScoped) {
          pageFailure = pageScoped ? "unverified freshness" : pageFresh ? "league scope mismatch" : "unverified scope and freshness";
          throw new Error("Unverified availability scope/freshness");
        }
        pageFailure = "invalid player collection";
        const rows = yahooPlanningPlayers(result.payload);
        if (rows.length > 25) throw new Error("Incomplete availability page");
        pagesAccepted++; rowsAccepted += rows.length;
        for (const row of rows) {
          if (candidates.has(row.player_key)) { repeatedRows++; repeatedPageIdentity = true; candidates.set(row.player_key, { ...row, ownership: null }); scanLimitations.push("Availability pages changed while reading; repeated identities remain unknown."); }
          else candidates.set(row.player_key, row);
        }
        if (rows.length < 25) { availabilityComplete = !repeatedPageIdentity; availabilityStop = repeatedPageIdentity ? "end of list with repeated identities" : "end of list"; break read; }
      } catch (error) { availabilityStop = pageFailure; optionalFailure(error); scanLimitations.push("Availability coverage is partial; unverified players remain unknown."); break read; }
    }
  }
  availabilityElapsed = Math.max(0, Date.now() - availabilityStarted);
  if (diet && availabilityComplete && ownershipSignature !== null) discoveryCache.set(scanKey, { rows: [...candidates.values()], pagesAttempted, pagesChecked,
    pagesAccepted, rowsAccepted, repeatedRows, elapsed: availabilityElapsed, stop: availabilityStop, complete: true, limitations: [...scanLimitations], signature: ownershipSignature }, now.getTime());
  }
  limitations.push(...scanLimitations);
  if (!availabilityComplete) limitations.push("Available-player discovery did not reach the end of the provider list.");
  let catalogMatches = 0, rosteredMatches = 0;
  for (const row of candidates.values()) {
    const player = resolve(row); if (!player) continue;
    catalogMatches++;
    if (unavailableIds.has(player.id)) { rosteredMatches++; continue; }
    const ownership = yahooFields(row.ownership);
    player.availability = ownership.ownership_type === "freeagents" ? "free_agent" : ownership.ownership_type === "waivers" ? "waivers" : "unknown";
    player.injury = yahooInjury(row);
    const waiver = numeric(ownership.waiver_date);
    // Unrepresentable timestamps stay unknown instead of aborting the roster read.
    player.waiverClearsAt = waiver === null ? null : new Date(waiver * 1000).toJSON();
    player.providerId = String(row.player_key);
    const positions = eligibility(row.eligible_positions).filter(value => !["BN", "IR", "IR+", "NA"].includes(value));
    if (positions.length) player.eligiblePositions = [...new Set(positions)];
    player.eligibilityVerified = positions.length > 0;
  }
  for (const player of data.players) if (unavailableIds.has(player.id)) player.availability = "rostered";
  // Request-local counts only. These summaries do not enter the saved snapshot or change player facts.
  let bothKnown = 0, eligibilityOnly = 0, availabilityOnly = 0, neitherKnown = 0;
  for (const player of data.players) {
    if (unavailableIds.has(player.id)) continue;
    const normalized = normalizeEligibility(player.eligiblePositions);
    const eligible = player.eligibilityVerified === true && normalized.valid && normalized.playerClass === player.playerClass;
    const available = player.availability === "free_agent" || player.availability === "waivers";
    if (eligible && available) bothKnown++;
    else if (eligible) eligibilityOnly++;
    else if (available) availabilityOnly++;
    else neitherKnown++;
  }
  const discoverySummary = [...(diet ? [`Yahoo reads this snapshot: ${yahooReads} (RSO_YAHOO_DIET on; ${scan ? "availability scan reused" : "availability scanned"}).`] : []),
    `Yahoo availability read: ${pagesAttempted} pages attempted, ${pagesChecked} returned, ${pagesAccepted} accepted; ${rowsAccepted} accepted rows, ${candidates.size} unique, ${repeatedRows} repeats. ${availabilityElapsed} ms elapsed; 8000 ms budget checked between page batches. Stopped: ${availabilityStop}.`,
    `Yahoo availability matches: ${catalogMatches} unique catalog matches, ${candidates.size - catalogMatches} unmatched; ${rosteredMatches} rostered/excluded, ${catalogMatches - rosteredMatches} candidate matches.`,
    `Yahoo provider catalog before search: ${bothKnown + eligibilityOnly + availabilityOnly + neitherKnown} candidates; ${bothKnown} both known, ${eligibilityOnly} eligibility only, ${availabilityOnly} availability only, ${neitherKnown} neither known. Eligibility means usable verified positions; availability means free agent or waivers. Discovery ${availabilityComplete ? "complete" : "partial"}; unseen players remain unknown.`,
  ];
  let realized: StatLine = {}, opponent: PlanningSnapshot["opponent"] = null;
  if (scoreboardResult && providerFresh(scoreboardResult, scoreboardReadAt)
    && text(yahooValue(scoreboardResult.payload, "league_key")) === league.external_league_key) {
    const scoreboardTeams = yahooPlanningTeams(scoreboardResult.payload);
    const ours = scoreboardTeams.find(row => row.team_key === team.external_team_key);
    // Matchup-local pair, not an arbitrary other league team.
    const findMatchup = (node: unknown): Row | null => {
      if (!node || typeof node !== "object") return null;
      const row = node as Row;
      if (row.matchup && yahooPlanningTeams(row.matchup).some(entry => entry.team_key === team.external_team_key)) return yahooFields(row.matchup);
      for (const value of Object.values(node)) { const match = findMatchup(value); if (match) return match; }
      return null;
    };
    const matchup = findMatchup(scoreboardResult.payload);
    if (matchup && query.startDate === text(matchup.week_start) && query.endDate === text(matchup.week_end) && ours) {
      realized = yahooPlanningStats(yahooValue(ours, "team_stats"));
      const other = yahooPlanningTeams(matchup).find(row => row.team_key !== team.external_team_key);
      const otherRoster = leagueTeams.find(row => row.team_key === other?.team_key);
      if (other) opponent = { roster: otherRoster ? yahooBoardPlayers(otherRoster).flatMap(row => { const player = resolve(row); return player ? [{ playerId: player.id, position: "active" as const }] : []; }) : [], realized: yahooPlanningStats(yahooValue(other, "team_stats")), remaining: null };
    } else limitations.push("Current scoreboard does not cover the exact selected matchup; historical totals were not mixed into this horizon.");
  } else limitations.push("Current matchup scoreboard is unavailable.");
  const observedAt = rosterResponse.transport.responseDate;
  const snapshot: PlanningSnapshot = {
    id: `yahoo:${team.id}:${now.toISOString()}`, context: { provider: "yahoo", seasonId: query.seasonId, leagueId: league.id, teamId: team.id, startDate: query.startDate, endDate: query.endDate, timeZone, asOf: now.toISOString() },
    ...data, roster, rules, lockedAssignments, pastLineups: scoredPastLineups, realized, opponent, acquisitionEvidence,
    evidence: { ...data.evidence,
      ...(inferredTimingNote ? { [INFERRED_ACQUISITION_TIMING_KEY]: { source: INFERRED_ACQUISITION_TIMING_SOURCE, asOf: settingsReadAt.toISOString(),
        seasonId: query.seasonId, completeness: "partial" as const, limitations: [inferredTimingNote] } } : {}),
      roster: { source: "Yahoo authorized current roster", asOf: observedAt, seasonId: query.seasonId, completeness: fresh && roster.length === ownRows.length && roster.length > 0 ? "complete" : "partial", limitations },
      availability: { source: `Yahoo league ownership (${pagesChecked} pages)`, asOf: availabilityAsOf, seasonId: query.seasonId, completeness: availabilityComplete ? "complete" : "partial", limitations: availabilityComplete ? [] : ["Only individually verified availability may be actionable."] },
    },
  };
  return { snapshot, capabilities: { roster: fresh && ownRows.length === roster.length && roster.length > 0, availability: availabilityComplete, rules: false, matchup: opponent !== null, acquisitions: periods.length > 0, limitations, diagnostics: discoverySummary },
    ...(refreshError ? { code: refreshError.code, retryAfterSeconds } : {}), ...(diet ? { yahooDiet: true as const } : {}) };
}
