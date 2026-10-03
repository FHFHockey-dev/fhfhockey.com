import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlanningData, parsePlanningDataQuery } from "lib/rosterScheduleData/planning";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import type { AcquisitionEvidence, LeagueRules, PlanningData, PlanningSnapshot, ProviderCapabilities, RosterEntry, ScoringCategory, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";
import { assertYahooLeagueGameContext, resolveYahooGameContext } from "./gameContext";
import { parseYahooBoardSettings, YAHOO_STAT_KEY_BY_ID, YahooLiveDraftError } from "./liveDraft";
import { fetchYahooBoardResource, fetchYahooDraftResource, fetchYahooPlanningResource, type YahooProviderJsonResult } from "./providerClient";
import { yahooBoardPlayers, yahooFields, yahooValue } from "./starterBoard";

type Row = Record<string, any>;
const text = (value: unknown): string | null => typeof value === "string" || typeof value === "number" ? String(value) : null;
const numeric = (value: unknown): number | null => value === null || value === undefined || value === "" || value === "-" || !Number.isFinite(Number(value)) ? null : Number(value);
const yes = (value: unknown) => value === true || value === 1 || value === "1";
const no = (value: unknown) => value === false || value === 0 || value === "0";

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
 * NHL max_weekly_adds encoding is not verified: retain presence/value, not a limit. */
export function yahooPlanningAcquisitions(args: {
  settings: YahooProviderJsonResult; league: YahooProviderJsonResult | null; team: YahooProviderJsonResult | null;
  weeks: PlanningData["matchupWeeks"]; gameKey: string; leagueKey: string; teamKey: string;
  startDate: string; endDate: string; now: Date;
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
  const fresh = args.league && args.team && providerFresh(args.league, args.now) && providerFresh(args.team, args.now);
  const scope = league.league_key === args.leagueKey && team.team_key === args.teamKey && yes(team.is_owned_by_current_login);
  const counterValid = fresh && scope && counter.coverage_type === "week" && week !== null && week === coverageWeek && containsHorizon;
  const used = counterValid ? integer(counter.value) : null;
  if (!fresh) limitations.push("Yahoo weekly acquisition counter or league freshness is unverified.");
  if (!scope) limitations.push("Yahoo weekly acquisition counter ownership or league scope is unverified.");
  if (counter.coverage_type !== "week" || week === null || week !== coverageWeek) limitations.push("Yahoo acquisition counter does not match the league's current week.");
  if (!containsHorizon) limitations.push("Selected dates are not contained in one verified current Yahoo game week; its counter cannot describe this horizon.");
  if (used === null) limitations.push("Weekly acquisitions used are unknown; season moves and transaction logs are not substitutes.");
  limitations.push("Yahoo NHL weekly-limit encoding and exact reset time are unverified. Remaining allowance is unknown; zero is not assumed to mean unlimited.");
  return { source: "Yahoo team roster_adds and league current_week", fetchedAt: args.now.toISOString(),
    asOf: args.team?.transport.responseDate ?? null,
    counter: { present: Object.prototype.hasOwnProperty.call(team, "roster_adds"), coverageType: text(counter.coverage_type),
      coverageWeek, reportedValue: scalar(counter.value), used },
    limit: { present: Object.prototype.hasOwnProperty.call(settings, "max_weekly_adds"), reportedValue: scalar(settings.max_weekly_adds), verified: false },
    period: { week, startDate: datesValid ? period!.startDate : null, endDate: datesValid ? period!.endDate : null, containsHorizon },
    remaining: null, limitations };
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
}): Promise<{ snapshot: PlanningSnapshot; capabilities: ProviderCapabilities }> {
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
  const settingsResponse = await readRequiredPlanningResource(() => fetchYahooDraftResource({ ...provider, resource: "settings" }));
  if (text(yahooValue(settingsResponse.payload, "league_key")) !== league.external_league_key) throw new Error("Yahoo settings league mismatch");
  const providerTimeZone = text(yahooValue(settingsResponse.payload, "time_zone"));
  const timeZone = providerTimeZone ?? args.timeZone ?? "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone }).format(now); } catch { throw new YahooLiveDraftError("Choose a valid league time zone.", 400, "invalid_time_zone"); }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [data, rosterResponse, scoreboardResult, leagueRosterResult, leagueResult, teamResult] = await Promise.all([
    loadPlanningData(db, { ...query, timeZone }, { now }),
    readRequiredPlanningResource(() => fetchYahooBoardResource({ ...provider, resource: { type: "roster", teamKey: team.external_team_key, date: today } })),
    fetchYahooPlanningResource({ ...provider, resource: { type: "scoreboard" } }).then(value => value, () => null),
    fetchYahooBoardResource({ ...provider, resource: { type: "league_rosters" } }).then(value => value, () => null),
    fetchYahooPlanningResource({ ...provider, resource: { type: "league" } }).then(value => value, () => null),
    fetchYahooPlanningResource({ ...provider, resource: { type: "team", teamKey: team.external_team_key } }).then(value => value, () => null),
  ]);
  const acquisitionEvidence = yahooPlanningAcquisitions({ settings: settingsResponse, league: leagueResult, team: teamResult,
    weeks: data.matchupWeeks, gameKey: gameContext.gameKey, leagueKey: league.external_league_key, teamKey: team.external_team_key,
    startDate: query.startDate, endDate: query.endDate, now });
  const rosterPayload = yahooFields(yahooValue(rosterResponse.payload, "roster"));
  if (text(yahooValue(rosterResponse.payload, "team_key")) !== team.external_team_key
    || text(rosterPayload.date) !== today || text(rosterPayload.coverage_type) !== "date"
    || !yes(yahooValue(rosterResponse.payload, "is_owned_by_current_login"))) throw new Error("Yahoo did not verify roster date, scope and ownership");
  const ownRows = yahooPlanningPlayers(rosterResponse.payload);
  if (!ownRows.length) throw new YahooLiveDraftError(
    text(yahooValue(settingsResponse.payload, "draft_status")) === "predraft"
      ? "Yahoo reports this league is still pre-draft. Select your drafted league from My team; league names are shown beside each team."
      : "Yahoo returned an empty roster for this team today. Check the selected league and team, then refresh after Yahoo makes the roster available.",
    409, "yahoo_roster_empty",
  );
  const fresh = providerFresh(settingsResponse, now) && providerFresh(rosterResponse, now);
  const limitations: string[] = [];
  limitations.push(...acquisitionEvidence.limitations);
  if (!fresh) limitations.push("Yahoo roster/settings freshness could not be verified; affected lock and availability claims remain unknown.");
  if (!providerTimeZone) limitations.push(args.timeZone ? "League time zone supplied by the manager; Yahoo did not verify it." : "League time zone is unknown; UTC is a display fallback and timing requires verification.");
  const mapping: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id")
      .order("yahoo_player_id").order("nhl_player_id").range(offset, offset + 999);
    if (page.error) throw page.error;
    mapping.push(...page.data ?? []);
    if ((page.data?.length ?? 0) < 1000) break;
  }
  const byNhl = new Map(data.players.map(player => [player.nhlId, player]));
  const byYahoo = new Map<string, Set<number>>(), reverse = new Map<number, Set<string>>();
  for (const row of mapping) {
    const nhl = Number(row.nhl_player_id), rawYahoo = String(row.yahoo_player_id ?? "");
    const yahoo = /^\d+$/.test(rawYahoo) ? `${gameContext.gameKey}.p.${rawYahoo}` : rawYahoo;
    // The mapping view contains full keys from multiple Yahoo seasons.
    if (!Number.isSafeInteger(nhl) || !/^\d+\.p\.\d+$/.test(yahoo) || !yahoo.startsWith(`${gameContext.gameKey}.p.`)) continue;
    byYahoo.set(yahoo, new Set([...(byYahoo.get(yahoo) ?? []), nhl]));
    reverse.set(nhl, new Set([...(reverse.get(nhl) ?? []), yahoo]));
  }
  const resolve = (row: Row) => {
    const key = String(row.player_key ?? "");
    if (!key.startsWith(`${gameContext.gameKey}.p.`)) return undefined;
    const matches = byYahoo.get(key);
    const nhl = matches?.size === 1 ? [...matches][0] : null;
    return nhl !== null && reverse.get(nhl)?.size === 1 ? byNhl.get(nhl) : undefined;
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
  const rules: LeagueRules = {
    lineupMode: mode, rosterSlots: settings.rosterConfig,
    // A lineup deadline does not establish when a transaction becomes effective.
    acquisitionTiming: "unknown",
    acquisitionCost: null, periods: [], scoring: { mode: settings.leagueType, weights: { ...settings.scoringCategories }, categories: yahooPlanningCategories(Object.keys(settings.categoryWeights)) },
    goalieMinimum: { required: settings.minimumGoalieStarts, credited: null, counts: "unknown", penalty: "unknown" }, unsupported,
  };
  limitations.push("Verify remaining acquisitions, reset periods, counting rules and goalie minimum progress; these are not inferred from season transaction totals.");
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
  let pagesChecked = 0, availabilityComplete = false;
  const candidates = new Map<string, Row>();
  const availabilityStarted = Date.now();
  let repeatedPageIdentity = false;
  // Read all pages within a disclosed bound, independent of forecast availability.
  for (let start = 0; start <= 2000; start += 25) {
    if (Date.now() - availabilityStarted >= 8000) { limitations.push("Availability discovery reached its time budget; remaining players are unknown."); break; }
    try {
      const result = await fetchYahooPlanningResource({ ...provider, resource: { type: "available_page", start } });
      pagesChecked++;
      if (!providerFresh(result, now) || text(yahooValue(result.payload, "league_key")) !== league.external_league_key) throw new Error("Unverified availability scope/freshness");
      const rows = yahooPlanningPlayers(result.payload);
      if (rows.length > 25) throw new Error("Incomplete availability page");
      for (const row of rows) {
        if (candidates.has(row.player_key)) { repeatedPageIdentity = true; candidates.set(row.player_key, { ...row, ownership: null }); limitations.push("Availability pages changed while reading; repeated identities remain unknown."); }
        else candidates.set(row.player_key, row);
      }
      if (rows.length < 25) { availabilityComplete = !repeatedPageIdentity; break; }
    } catch { limitations.push("Availability coverage is partial; unverified players remain unknown."); break; }
  }
  if (!availabilityComplete) limitations.push("Available-player discovery did not reach the end of the provider list.");
  for (const row of candidates.values()) {
    const player = resolve(row); if (!player || unavailableIds.has(player.id)) continue;
    const ownership = yahooFields(row.ownership);
    player.availability = ownership.ownership_type === "freeagents" ? "free_agent" : ownership.ownership_type === "waivers" ? "waivers" : "unknown";
    const waiver = numeric(ownership.waiver_date);
    player.waiverClearsAt = waiver === null ? null : new Date(waiver * 1000).toISOString();
    player.providerId = String(row.player_key);
    const positions = eligibility(row.eligible_positions).filter(value => !["BN", "IR", "IR+", "NA"].includes(value));
    if (positions.length) player.eligiblePositions = [...new Set(positions)];
    player.eligibilityVerified = positions.length > 0;
  }
  for (const player of data.players) if (unavailableIds.has(player.id)) player.availability = "rostered";
  let realized: StatLine = {}, opponent: PlanningSnapshot["opponent"] = null;
  if (scoreboardResult && providerFresh(scoreboardResult, now)
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
    ...data, roster, rules, lockedAssignments, realized, opponent, acquisitionEvidence,
    evidence: { ...data.evidence,
      roster: { source: "Yahoo authorized current roster", asOf: observedAt, seasonId: query.seasonId, completeness: fresh && roster.length === ownRows.length && roster.length > 0 ? "complete" : "partial", limitations },
      availability: { source: `Yahoo league ownership (${pagesChecked} pages)`, asOf: now.toISOString(), seasonId: query.seasonId, completeness: availabilityComplete ? "complete" : "partial", limitations: availabilityComplete ? [] : ["Only individually verified availability may be actionable."] },
    },
  };
  return { snapshot, capabilities: { roster: fresh && ownRows.length === roster.length && roster.length > 0, availability: availabilityComplete, rules: false, matchup: opponent !== null, acquisitions: false, limitations } };
}
