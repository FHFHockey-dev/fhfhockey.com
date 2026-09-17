import serviceRoleClient from "lib/supabase/server";
import { getScheduleDaily } from "lib/NHL/server/scheduleDaily";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import { loadForgeGameRevisions } from "lib/projections/gameRevisions";
import { boardGoalieForecast, boardSkaterForecast, boardSkaterStatsFromProjection, BOARD_CATEGORIES, scoreBoardStats, type BoardForecast } from "lib/projections/starterBoardScoring";
import { optimizeToday, rankTodayStreams, type TodayPlayer, type TodayStream } from "lib/projections/starterBoardPersonalization";
import { assertYahooLeagueGameContext, resolveYahooGameContext } from "./gameContext";
import { parseYahooBoardSettings, YahooLiveDraftError } from "./liveDraft";
import { fetchYahooBoardResource, fetchYahooDraftResource } from "./providerClient";

type Row = Record<string, any>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

/** Yahoo's standard JSON represents one entity as an array of field objects. */
export function yahooFields(value: unknown): Row {
  return Array.isArray(value) ? Object.assign({}, ...value.map(yahooFields)) : object(value);
}
export function yahooValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key)) return (value as Row)[key];
  for (const child of Object.values(value)) {
    const result = yahooValue(child, key);
    if (result !== undefined) return result;
  }
  return undefined;
}
export function yahooBoardPlayers(payload: unknown): Row[] {
  const result: Row[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const row = object(value);
    if (row.player !== undefined) { result.push(yahooFields(row.player)); return; }
    if (row.player_key) { result.push(row); return; }
    for (const child of Object.values(value)) visit(child);
  };
  visit(yahooValue(payload, "players"));
  const keys = result.map((row) => row.player_key);
  if (keys.some((key) => typeof key !== "string") || new Set(keys).size !== keys.length) throw new Error("Ambiguous Yahoo roster identities");
  return result;
}
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : null;
const truth = (value: unknown) => value === true || value === 1 || value === "1";
const falsity = (value: unknown) => value === false || value === 0 || value === "0";
const teamAbbreviation = (value: unknown) => {
  const raw = text(value)?.trim().toUpperCase() ?? "";
  const aliases: Record<string, string> = { LA: "LAK", NJ: "NJD", SJ: "SJS", TB: "TBL", WAS: "WSH", MON: "MTL" };
  return aliases[raw] ?? raw;
};
const providerFresh = (result: Awaited<ReturnType<typeof fetchYahooBoardResource>>, now: Date) => {
  const age = result.transport.ageSeconds;
  const responseAt = Date.parse(result.transport.responseDate ?? "");
  return (age === null || (age >= 0 && age <= 60)) && Number.isFinite(responseAt) && Math.abs(now.getTime() - responseAt) <= 120_000;
};
async function readTodaySchedule(date: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try { return await getScheduleDaily(date, controller.signal); }
  catch { return null; }
  finally { clearTimeout(timer); }
}

export async function loadYahooStarterBoard(args: { userId: string; teamId?: string; category?: string; now?: Date; client?: typeof serviceRoleClient }) {
  const db = args.client ?? serviceRoleClient;
  const now = args.now ?? new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [teamsResult, settingsResult, context] = await Promise.all([
    db.from("external_teams").select("id,external_team_key,external_league_id,connected_account_id,team_name,team_metadata")
      .eq("user_id", args.userId).eq("provider", "yahoo"),
    db.from("user_settings").select("active_context").eq("user_id", args.userId).maybeSingle(),
    resolveYahooGameContext(db),
  ]);
  if (teamsResult.error || settingsResult.error) throw new Error("Yahoo account settings unavailable");
  const teams = (teamsResult.data ?? []).filter((team) => object(team.team_metadata).is_owned === true
    && team.external_team_key.startsWith(`${context.gameKey}.l.`));
  const active = object(settingsResult.data?.active_context);
  const selectedId = args.teamId ?? (active.provider === "yahoo" ? active.external_team_id : null);
  const selected = teams.find((team) => team.id === selectedId) ?? (!selectedId && teams.length === 1 ? teams[0] : undefined);
  const choices = teams.map((team) => ({ id: team.id, name: team.team_name, leagueId: team.external_league_id }));
  if (!selected) {
    if (args.teamId) throw new YahooLiveDraftError("This team is unavailable to your account.", 404, "team_unavailable");
    return { date, status: "team_selection_required", teams: choices, limitations: ["Select an authorized Yahoo team."] };
  }
  const { data: league, error: leagueError } = await db.from("external_leagues")
    .select("external_league_key,connected_account_id,league_name").eq("id", selected.external_league_id)
    .eq("user_id", args.userId).eq("provider", "yahoo").single();
  if (leagueError || !league || league.connected_account_id !== selected.connected_account_id) throw new YahooLiveDraftError("League access unavailable.", 404, "league_unavailable");
  assertYahooLeagueGameContext(league.external_league_key, context);
  const provider = { client: db, userId: args.userId, connectedAccountId: selected.connected_account_id,
    context, leagueKey: league.external_league_key, now };
  const [rosterResult, leagueResult, revisions, schedule] = await Promise.all([
    fetchYahooBoardResource({ ...provider, resource: { type: "roster", teamKey: selected.external_team_key, date } }),
    fetchYahooDraftResource({ ...provider, resource: "settings" }),
    loadForgeGameRevisions(date),
    readTodaySchedule(date),
  ]);
  const rosterPayload = yahooFields(yahooValue(rosterResult.payload, "roster"));
  if (text(rosterPayload.date) !== date || text(rosterPayload.coverage_type) !== "date"
    || text(yahooValue(rosterResult.payload, "team_key")) !== selected.external_team_key) throw new Error("Yahoo roster date or team did not match");
  if (!truth(yahooValue(rosterResult.payload, "is_owned_by_current_login"))) {
    throw new YahooLiveDraftError("Yahoo did not verify current ownership of this team.", 409, "team_ownership_unverified");
  }
  if (text(yahooValue(leagueResult.payload, "league_key")) !== league.external_league_key) throw new Error("Yahoo settings league did not match");
  const rosterRows = yahooBoardPlayers(rosterResult.payload);
  if (rosterRows.some((row) => !new RegExp(`^${context.gameKey}\\.p\\.\\d+$`).test(row.player_key))) throw new Error("Yahoo roster player scope did not match");
  const rosterCount = Number(yahooFields(rosterPayload.players).count);
  if (!Number.isInteger(rosterCount) || rosterCount > 100 || rosterCount !== rosterRows.length) throw new Error("Incomplete Yahoo roster response");
  const settings = parseYahooBoardSettings(leagueResult.payload);
  // Yahoo NHL can omit roster_type. Explicit Daily-Today/Daily-Tomorrow
  // transaction settings still establish daily lineup editing, but neither
  // missing settings nor an explicit weekly roster establishes that permission.
  const dailyLineupEdits = settings.rosterType === "date" || (settings.rosterType === null
    && ["intraday", "tomorrow"].includes(settings.weeklyDeadline ?? ""));
  const limitations: string[] = [];
  const mode = settings.leagueType;
  const weights = settings.scoringCategories;
  const category = mode === "categories" ? args.category ?? null : null;
  if (!settings.scoringTypeRecognized || settings.unsupportedStatIds.length || settings.unsupportedRosterSlots.length) limitations.push("Yahoo scoring or roster rules include unsupported settings.");
  const scoringKeys = mode === "points" ? Object.keys(weights) : Object.keys(settings.categoryWeights);
  if (!scoringKeys.length) limitations.push("League scoring settings are incomplete.");
  if (mode === "points" && scoringKeys.some((key) => !(BOARD_CATEGORIES as readonly string[]).includes(key))) limitations.push("The league uses scoring categories absent from these projections.");
  if (mode === "categories" && (!category || !scoringKeys.includes(category) || !(BOARD_CATEGORIES as readonly string[]).includes(category))) limitations.push("Select a supported individual league category.");
  if ((settings.minimumGoalieStarts ?? 0) > 0) limitations.push("Weekly minimum goalie starts are not included in this today-only calculation.");
  const fresh = [rosterResult, leagueResult].every((result) => providerFresh(result, now));
  if (!fresh) limitations.push("Yahoo roster or settings freshness could not be verified.");
  // Current Yahoo help distinguishes acquisition timing from lineup locks.
  // https://help.yahoo.com/kb/fantasy-hockey/sln6775.html
  const acquisitionTiming = fresh && dailyLineupEdits && settings.weeklyDeadline === "intraday" ? "same_day"
    : fresh && dailyLineupEdits && settings.weeklyDeadline === "tomorrow" ? "next_day" : "unverified";
  const acquisitionLimitations = [acquisitionTiming === "next_day"
    ? "This league applies new acquisitions on the following day; they cannot improve today's lineup."
    : acquisitionTiming === "same_day"
      ? "Same-day acquisitions are enabled, but league acquisition limits and the remaining allowance are unverified."
      : "The league's acquisition timing and remaining allowance could not be verified."];
  // A missing forecast is not evidence of an off day. Require the complete
  // official day plus fresh Yahoo team metadata before assigning a known zero.
  const days = Array.isArray(schedule?.gameWeek) ? schedule.gameWeek.filter((day) => day.date === date) : [];
  const day = days.length === 1 ? days[0] : null;
  const scheduleVerified = Boolean(day && Array.isArray(day.games) && Number.isInteger((day as any).numberOfGames)
    && (day as any).numberOfGames === day.games.length && new Set(day.games.map((game) => game.id)).size === day.games.length
    && day.games.every((game) => Number.isSafeInteger(game.id) && [game.homeTeam, game.awayTeam]
      .every((team) => Number.isSafeInteger(team?.id) && activeTeamAbbreviations.has(teamAbbreviation(team?.abbrev)))));
  const scheduledTeams = new Set(scheduleVerified ? day!.games.flatMap((game) => [teamAbbreviation(game.homeTeam.abbrev), teamAbbreviation(game.awayTeam.abbrev)]) : []);
  const scheduleFetchedAt = scheduleVerified ? new Date().toISOString() : null;
  const officialGames = new Map(scheduleVerified ? day!.games.map((game) => [game.id, game] as const) : []);
  const forecasts = new Map<number, { forecast: BoardForecast; gameId: number }>();
  for (const revision of revisions) {
    for (const row of revision.payload.players) forecasts.set(row.player_id, {
      forecast: boardSkaterForecast(boardSkaterStatsFromProjection(row), row.uncertainty), gameId: revision.game_id,
    });
    for (const row of revision.payload.goalies) for (const candidate of row.uncertainty?.daily_board_candidates ?? []) {
      const forecast = boardGoalieForecast(candidate);
      if (forecast) forecasts.set(candidate.playerId, { forecast, gameId: revision.game_id });
    }
  }
  // Resolve both directions uniquely; never substitute a name match for an ID.
  const ids = [...forecasts.keys()];
  const rosterYahooIds = rosterRows.map((row) => String(row.player_key).split(".p.")[1]);
  const mappingResults = await Promise.all([
    ids.length ? db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id").in("nhl_player_id", ids.map(String)) : { data: [], error: null },
    rosterYahooIds.length ? db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id").in("yahoo_player_id", rosterYahooIds) : { data: [], error: null },
  ]);
  if (mappingResults.some((result) => result.error)) throw new Error("Yahoo player identities unavailable");
  const mappingRows = mappingResults.flatMap((result) => result.data ?? []);
  const forecastIds = new Set(ids.map(String));
  const reverseIds = [...new Set(mappingRows.map((row) => row.nhl_player_id)
    .filter((id): id is string => id !== null && !forecastIds.has(id)))];
  if (reverseIds.length) {
    const reverse = await db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id").in("nhl_player_id", reverseIds);
    if (reverse.error) throw new Error("Yahoo player identities unavailable");
    mappingRows.push(...(reverse.data ?? []));
  }
  const yahooToNhl = new Map<string, Set<number>>(), nhlToYahoo = new Map<number, Set<string>>();
  for (const row of mappingRows) {
    const nhl = Number(row.nhl_player_id), yahoo = text(row.yahoo_player_id);
    if (!Number.isSafeInteger(nhl) || !yahoo || !/^\d+$/.test(yahoo)) continue;
    const key = `${context.gameKey}.p.${yahoo}`;
    yahooToNhl.set(key, new Set([...(yahooToNhl.get(key) ?? []), nhl]));
    nhlToYahoo.set(nhl, new Set([...(nhlToYahoo.get(nhl) ?? []), key]));
  }
  const unique = new Map([...yahooToNhl].flatMap(([key, values]) => {
    const [nhl] = values;
    return values.size === 1 && nhlToYahoo.get(nhl)?.size === 1 ? [[key, nhl] as const] : [];
  }));
  const valueFor = (key: string) => {
    const prediction = forecasts.get(unique.get(key) ?? -1);
    const stats = prediction?.forecast.expected;
    if (!stats) return null;
    if (mode === "categories") return category && typeof stats[category] === "number" ? stats[category]! * (category === "GOALS_AGAINST_GOALIE" ? -1 : 1) : null;
    const goalie = prediction?.forecast.nonStartAssumption !== undefined;
    return scoreBoardStats(stats, Object.fromEntries(Object.entries(weights).filter(([key]) => key.endsWith("_GOALIE") === goalie))).points;
  };
  const normalize = (row: Row, owned: boolean, playerFresh = fresh): TodayPlayer => {
    const id = String(row.player_key), prediction = forecasts.get(unique.get(id) ?? -1);
    const team = teamAbbreviation(row.editorial_team_abbr);
    const scheduled = prediction ? officialGames.get(prediction.gameId) : undefined;
    const game = scheduled && [scheduled.homeTeam, scheduled.awayTeam].some((side) => teamAbbreviation(side.abbrev) === team)
      ? scheduled : undefined;
    const start = Date.parse(game?.startTimeUTC ?? "");
    const confirmedSchedule = game?.gameScheduleState === "OK" && Number.isFinite(start);
    const pregame = confirmedSchedule && ["FUT", "PRE"].includes(game?.gameState ?? "") && start > now.getTime();
    const started = Boolean(game && (["LIVE", "CRIT", "FINAL", "OFF"].includes(game.gameState ?? "")
      || (confirmedSchedule && start <= now.getTime())));
    const noGame = owned && fresh && unique.has(id) && !prediction && scheduleVerified
      && activeTeamAbbreviations.has(team) && !scheduledTeams.has(team);
    const scheduleStatus = noGame ? "no_game" : confirmedSchedule ? "scheduled" : "unknown";
    const selectedPosition = owned ? text(yahooFields(row.selected_position).position) : "BN";
    const positions: string[] = [];
    const collect = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const position = text(object(value).position);
      if (position) positions.push(position);
      else for (const child of Object.values(value)) collect(child);
    };
    collect(row.eligible_positions);
    // Daily lineup edits and the effective date of acquisitions are separate.
    // A player-level flag cannot override a team-wide lock or a started game.
    const lock = falsity(row.is_editable) || falsity(rosterPayload.is_editable) || started ? "locked"
      : fresh && playerFresh && truth(rosterPayload.is_editable) && dailyLineupEdits
        && (row.is_editable === undefined || truth(row.is_editable)) && (noGame || pregame) ? "unlocked" : "unknown";
    return { id, eligiblePositions: [...new Set(positions)], selectedPosition, lock,
      scheduleStatus, value: noGame ? 0 : valueFor(id), valueBasis: noGame ? "no_game" : prediction?.forecast.expected ? "unconditional" : prediction?.forecast.conditional ? "conditional" : "missing",
      identityVerified: unique.has(id), canDrop: falsity(row.is_undroppable) ? true : truth(row.is_undroppable) ? false : null };
  };
  const roster = rosterRows.map((row) => normalize(row, true));
  if (!scheduleVerified && roster.some((player) => player.scheduleStatus === "unknown")) limitations.push("The complete official schedule could not be verified; missing projections do not establish an off day.");
  const aliases: Record<string, string> = { bench: "BN", utility: "Util", FWD: "F" };
  const slots = Object.entries(settings.rosterConfig).flatMap(([key, count]) => Array.from({ length: Math.min(count, 40) }, (_, index) => ({ id: `${key}:${index}`, position: aliases[key] ?? key })));
  if (!slots.length) limitations.push("No supported roster slots were supplied.");
  // Discover league-available players first so rostered stars cannot exhaust the
  // shortlist. The first page bounds whether three more parallel reads are needed.
  const streamingLimitations: string[] = [];
  let availabilityFetchedAt: string | null = null;
  let pagesAttempted = 0, capReached = false;
  const availableRows = new Map<string, { row: Row; fresh: boolean }>();
  const duplicateKeys = new Set<string>();
  const candidateNames = new Map<string, string>();
  const readPage = async (start: number) => {
    pagesAttempted++;
    const result = await fetchYahooBoardResource({ ...provider, resource: { type: "available_players", start } });
    if (text(yahooValue(result.payload, "league_key")) !== league.external_league_key) throw new Error("Availability league mismatch");
    const rows = yahooBoardPlayers(result.payload);
    const count = Number(yahooFields(yahooValue(result.payload, "players")).count);
    if (!Number.isInteger(count) || count < 0 || count > 25 || count !== rows.length
      || rows.some((row) => !new RegExp(`^${context.gameKey}\\.p\\.\\d+$`).test(row.player_key))) throw new Error("Incomplete or mismatched availability page");
    return { rows, fresh: providerFresh(result, now), responseDate: result.transport.responseDate, start };
  };
  const acceptPage = (page: Awaited<ReturnType<typeof readPage>>) => {
    if (!page.fresh) streamingLimitations.push("Yahoo availability freshness could not be verified.");
    if (page.responseDate && Number.isFinite(Date.parse(page.responseDate))
      && (!availabilityFetchedAt || Date.parse(page.responseDate) < Date.parse(availabilityFetchedAt))) availabilityFetchedAt = page.responseDate;
    for (const row of page.rows) {
      if (availableRows.has(row.player_key)) duplicateKeys.add(row.player_key);
      else availableRows.set(row.player_key, { row, fresh: page.fresh });
    }
  };
  if (forecasts.size) {
    try {
      const first = await readPage(0);
      acceptPage(first);
      if (first.rows.length === 25) {
        const pages = await Promise.allSettled([25, 50, 75].map(readPage));
        for (const page of pages) {
          if (page.status === "fulfilled") {
            acceptPage(page.value);
            if (page.value.start === 75 && page.value.rows.length === 25) capReached = true;
          } else streamingLimitations.push("Part of Yahoo's available-player shortlist could not be refreshed.");
        }
      }
    } catch { streamingLimitations.push("League availability could not be refreshed."); }
  }
  if (duplicateKeys.size) streamingLimitations.push("Yahoo's available-player list changed between pages; repeated players have unknown availability.");
  if (capReached) streamingLimitations.push("Only the first 100 Yahoo-ranked available players were checked; other streaming options may exist.");
  const unmapped = [...availableRows.keys()].filter((key) => !unique.has(key)).length;
  if (unmapped) streamingLimitations.push(`${unmapped} available players could not be uniquely matched to the captured player identities.`);
  const candidates: TodayStream[] = [...availableRows.entries()].flatMap(([key, entry]) => {
    if (roster.some((player) => player.id === key) || !forecasts.has(unique.get(key) ?? -1)) return [];
    const { row } = entry;
    candidateNames.set(key, text(yahooFields(row.name).full) ?? "Unresolved player");
    const type = entry.fresh && !duplicateKeys.has(key) ? text(yahooFields(row.ownership).ownership_type) : null;
    return [{ ...normalize(row, false, entry.fresh && !duplicateKeys.has(key)), availability: type === "freeagents" ? "free_agent" as const : type === "waivers" ? "waivers" as const
      : type === "team" ? "rostered" as const : "unknown" as const,
      usableToday: acquisitionTiming === "next_day" ? false : null, acquisitionLimitations }];
  });
  const capacity = slots.length - roster.filter((player) => !["IR", "IR+", "IR-LT", "NA"].includes(player.selectedPosition ?? "")).length;
  const lineup = optimizeToday({ slots, roster, limitations });
  return { date, status: lineup.status, teams: choices, teamId: selected.id, teamName: selected.team_name, leagueName: league.league_name,
    mode, category, categoryOptions: scoringKeys, settingsFetchedAt: leagueResult.transport.responseDate,
    rosterFetchedAt: rosterResult.transport.responseDate, availabilityFetchedAt, lineup,
    scheduleFetchedAt,
    acquisitionRules: { timing: acquisitionTiming, transactionLimits: "unverified" as const,
      settingsFetchedAt: leagueResult.transport.responseDate },
    roster: rosterRows.map((row, index) => ({ ...roster[index], name: text(yahooFields(row.name).full) ?? String(row.player_key) })),
    streaming: rankTodayStreams({ slots, roster, limitations, candidates, openRosterSpots: Math.max(0, capacity) })
      .map((row) => ({ ...row, name: candidateNames.get(row.playerId) ?? "Unresolved player" })),
    streamingScope: "first_100_yahoo_available_players",
    streamingCoverage: { playersChecked: availableRows.size, pagesAttempted, matchedToday: candidates.length, limit: 100, capReached },
    comparisonScope: mode === "categories" ? "today_individual_category" : "today_expected_points",
    limitations: [...new Set([...lineup.limitations, ...limitations, ...streamingLimitations,
      ...acquisitionLimitations])],
    revisionIds: revisions.map((revision) => revision.id),
  };
}
