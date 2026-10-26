import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningData, PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";
import type { PlanningDataQuery } from "lib/rosterScheduleData/planning";
import { applyProviderGoalieStarts } from "lib/rosterScheduleOptimizer/providerGoalieStarts";
import { assertYahooLeagueGameContext, resolveYahooGameContext } from "./gameContext";
import { YahooLiveDraftError } from "./liveDraft";
import { cacheKey, currentTodayRoster, todayRosterCache } from "./planningCache";
import { fetchYahooBoardResource } from "./providerClient";
import { yahooPlanningPlayers, yahooStartingStatus } from "./rosterPlanning";
import { yahooFields, yahooValue } from "./starterBoard";
import { loadVerifiedYahooIdentitiesForKeys, rsoYahooDietEnabled } from "./yahooIdentity";

/** A roster read this recent can still say that no rostered goalie plays today (TJ D5); it never supplies a mark. */
const GOALIE_SKIP_WINDOW_MS = 15 * 60_000;
const isGoalieRow = (row: Record<string, any>) => row.position_type === "G" || row.display_position === "G"
  || JSON.stringify(row.eligible_positions ?? null).includes('"G"');

const unavailable = () => new YahooLiveDraftError("Current Yahoo goalie confirmations could not be verified.", 503, "yahoo_confirmations_unavailable");
const teamAbbreviation = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return ({ LA: "LAK", NJ: "NJD", SJ: "SJS", TB: "TBL", WAS: "WSH", MON: "MTL" } as Record<string, string>)[raw] ?? raw;
};

/** One owned roster resource, no discovery/settings/availability fanout or timeout
 * retry. The provider client retains its existing single 401 token-refresh retry.
 * No saved player metadata participates in this server-side confirmation path. */
export async function loadYahooPlanningConfirmations(args: {
  db: SupabaseClient<any>; userId: string; teamId: string; leagueId: string;
  query: PlanningDataQuery; data: PlanningData; now: Date;
}): Promise<{ data: PlanningData; expiresAt: string | null }> {
  const { db, userId, query, now, data } = args;
  const { data: team, error: teamError } = await db.from("external_teams").select("*")
    .eq("id", args.teamId).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (teamError || !team || yahooFields(team.team_metadata).is_owned !== true || team.external_league_id !== args.leagueId)
    throw new YahooLiveDraftError("Choose an owned Yahoo team from your account.", 404, "team_unavailable");
  const { data: league, error: leagueError } = await db.from("external_leagues").select("*")
    .eq("id", args.leagueId).eq("user_id", userId).eq("provider", "yahoo").maybeSingle();
  if (leagueError || !league || league.connected_account_id !== team.connected_account_id)
    throw new YahooLiveDraftError("League is not available to this account.", 404, "league_unavailable");
  const context = await resolveYahooGameContext(db);
  assertYahooLeagueGameContext(league.external_league_key, context);
  if (context.targetSeasonId !== query.seasonId) throw unavailable();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: query.timeZone ?? "UTC" }).format(now);
  if (date < query.startDate || date > query.endDate) return { data, expiresAt: null };
  // RSO Yahoo diet (flag RSO_YAHOO_DIET): share the snapshot's current today-roster read, and skip Yahoo when a
  // recent read shows no rostered goalie whose team plays today (absent marks stay unknown, as when Yahoo omits them).
  const diet = rsoYahooDietEnabled(), rosterKey = cacheKey(userId, team.external_team_key, date);
  if (diet) {
    const recent = todayRosterCache.get(rosterKey, GOALIE_SKIP_WINDOW_MS, Date.now());
    const playing = new Set(data.games.filter(game => game.date === date).map(game => game.teamAbbreviation));
    let recentRows: Record<string, any>[] | null = null;
    try { recentRows = recent ? yahooPlanningPlayers(recent.value.payload) : null; } catch { recentRows = null; }
    if (recentRows && !recentRows.some(row => isGoalieRow(row) && playing.has(teamAbbreviation(row.editorial_team_abbr))))
      return { data, expiresAt: null };
  }
  const cached = diet ? currentTodayRoster(rosterKey, Date.now()) : null;
  const response = cached ?? await fetchYahooBoardResource({ client: db, userId, connectedAccountId: team.connected_account_id,
    context, leagueKey: league.external_league_key, format: "standard_json", now,
    resource: { type: "roster", teamKey: team.external_team_key, date } });
  const roster = yahooFields(yahooValue(response.payload, "roster"));
  const owned = yahooValue(response.payload, "is_owned_by_current_login");
  if (yahooValue(response.payload, "team_key") !== team.external_team_key || roster.coverage_type !== "date"
    || roster.date !== date || ![true, 1, "1"].includes(owned as never)) throw unavailable();
  const observed = Date.parse(response.transport.responseDate ?? ""), completed = Date.now(), age = response.transport.ageSeconds;
  if (!Number.isFinite(observed) || observed > completed || completed - observed > 120000
    || (age !== null && (!Number.isFinite(age) || age < 0 || age > 60))) throw unavailable();
  // Retain the existing two-minute freshness ceiling, conservatively charging
  // both provider cache age and transit/computation time against it.
  const expires = observed + 120000 - (age ?? 0) * 1000;
  if (expires <= completed) throw unavailable();
  const rows = yahooPlanningPlayers(response.payload);
  if (diet && !cached) todayRosterCache.set(rosterKey, response, observed);
  if (rows.length > 100) throw unavailable();
  const keys = rows.map(row => String(row.player_key ?? ""));
  if (new Set(keys).size !== keys.length || keys.some(key => !new RegExp(`^${context.gameKey}\\.p\\.\\d+$`).test(key))) throw unavailable();
  if (!keys.length) return { data, expiresAt: new Date(expires).toISOString() };
  if (diet) {
    // D8: two-way unique through verified fhfh_player_external_identities, straight to the catalog player id.
    const identities = await loadVerifiedYahooIdentitiesForKeys(db, context, keys);
    if (!identities) throw unavailable();
    const verifiedMarks: PlanningPlayer[] = [];
    for (const row of rows) {
      const id = identities.get(String(row.player_key)), catalog = id === undefined ? [] : data.players.filter(player => player.id === id);
      const player = catalog.length === 1 ? catalog[0] : undefined, status = yahooStartingStatus(row, date, response.transport.responseDate);
      const games = player && data.games.filter(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation);
      if (!player || player.playerClass !== "goalie" || !status || teamAbbreviation(row.editorial_team_abbr) !== player.teamAbbreviation || games?.length !== 1) continue;
      verifiedMarks.push({ ...player, startingStatus: status });
    }
    const forecasts = applyProviderGoalieStarts(data.forecasts, { marked: verifiedMarks, catalog: data.players, games: data.games,
      bridgeRevisionIds: new Set(data.forecastManifest?.rsoUsePolicy?.bridgeRevisionIds ?? []), now: completed });
    return { data: { ...data, forecasts }, expiresAt: new Date(expires).toISOString() };
  }
  // Two bounded identity reads check both directions. A second Yahoo ID for the
  // same NHL identity is ambiguous even if that other ID is absent from the roster.
  const first = await db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id")
    .in("yahoo_player_id", [...keys, ...keys.map(key => key.split(".p.")[1])]).limit(1001);
  if (first.error || !first.data || first.data.length > 1000) throw unavailable();
  const ids = [...new Set(first.data.map(row => Number(row.nhl_player_id)).filter(id => Number.isSafeInteger(id) && id > 0))];
  const reverse = ids.length ? await db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id")
    .in("nhl_player_id", ids).limit(1001) : { data: [], error: null };
  if (reverse.error || !reverse.data || reverse.data.length > 1000) throw unavailable();
  const byYahoo = new Map<string, Set<number>>(), byNhl = new Map<number, Set<string>>();
  for (const row of [...first.data, ...reverse.data]) {
    const id = Number(row.nhl_player_id), raw = String(row.yahoo_player_id ?? "");
    const key = /^\d+$/.test(raw) ? `${context.gameKey}.p.${raw}` : raw;
    if (!Number.isSafeInteger(id) || id <= 0 || !new RegExp(`^${context.gameKey}\\.p\\.\\d+$`).test(key)) continue;
    byYahoo.set(key, new Set([...(byYahoo.get(key) ?? []), id]));
    byNhl.set(id, new Set([...(byNhl.get(id) ?? []), key]));
  }
  const marked: PlanningPlayer[] = [];
  for (const row of rows) {
    const matches = byYahoo.get(String(row.player_key)), nhlId = matches?.size === 1 ? [...matches][0] : null;
    const catalog = data.players.filter(player => player.nhlId === nhlId);
    const player = catalog.length === 1 ? catalog[0] : undefined;
    const status = yahooStartingStatus(row, date, response.transport.responseDate);
    const games = player && data.games.filter(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation);
    if (!player || nhlId === null || byNhl.get(nhlId)?.size !== 1 || player.playerClass !== "goalie" || !status
      || teamAbbreviation(row.editorial_team_abbr) !== player.teamAbbreviation || games?.length !== 1) continue;
    marked.push({ ...player, startingStatus: status });
  }
  const forecasts = applyProviderGoalieStarts(data.forecasts, { marked, catalog: data.players, games: data.games,
    bridgeRevisionIds: new Set(data.forecastManifest?.rsoUsePolicy?.bridgeRevisionIds ?? []), now: completed });
  return { data: { ...data, forecasts }, expiresAt: new Date(expires).toISOString() };
}
