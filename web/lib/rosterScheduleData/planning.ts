import type { SupabaseClient } from "@supabase/supabase-js";
import { playerForecastSourcePayloadHash } from "lib/player-forecasts/sourceSnapshot";
import { loadApprovedContributionBundle } from "lib/player-forecasts/contributionStore";
import { calendarLeadDay, forecastCalendarPolicy, validForecastCalendarPolicy, type ForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { boardGoalieForecast, boardSkaterForecast, completeBoardSkaterStatsFromProjection } from "lib/projections/starterBoardScoring";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "lib/projections/issuedContext";
import { acceptedNewsSupersedes, loadAcceptedForecastNews } from "lib/projections/acceptedNews";
import { planningScheduleStatus } from "./normalize";
import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { starterBoardCanaryGameIds, starterBoardFlags } from "lib/projections/starterBoardFlags";
import type { ForecastDiscoveryExclusion, ForecastExclusionReason, ForecastManifest, GameForecast, PlanningData, PlanningGame, PlanningIssuedContext, PlanningPlayer, SourceEvidence, StatLine } from "lib/rosterScheduleOptimizer/planningTypes";

export type PlanningDataQuery = { seasonId: number; startDate: string; endDate: string; timeZone?: string };
export function parsePlanningDataQuery(query: Record<string, unknown>): PlanningDataQuery {
  const seasonId = Number(query.seasonId);
  const season = String(seasonId);
  const startDate = typeof query.startDate === "string" ? query.startDate : "";
  const endDate = typeof query.endDate === "string" ? query.endDate : "";
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !validDate(startDate) || !validDate(endDate) || startDate > endDate
    || Date.parse(endDate) - Date.parse(startDate) > 366 * 86400000) {
    throw new Error("Provide a valid NHL season and a date range of at most 367 days.");
  }
  const timeZone = typeof query.timeZone === "string" ? query.timeZone : undefined;
  if (timeZone) { try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new Error("Provide a valid league time zone."); } }
  return { seasonId, startDate, endDate, ...(timeZone ? { timeZone } : {}) };
}

type Row = Record<string, any>;
const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const validCapturedTime = (value: unknown, observedAt: string) => value === null
  || typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(observedAt);
const position = (value: string) => ({ L: "LW", R: "RW" }[value] ?? value);
function evidence(source: string, asOf: string | null, seasonId: number | null, limitations: string[] = []): SourceEvidence {
  return { source, asOf, seasonId, completeness: limitations.length ? "partial" : "complete", limitations };
}

export function normalizePlanningGames(rows: Row[], timeZone?: string): PlanningGame[] {
  const result = new Map<string, PlanningGame>();
  for (const row of rows) {
    const id = String(row.source_game_id);
    const key = `${id}:${row.team_abbreviation}`;
    // Yahoo week mapping is not a prerequisite for a manual/custom-date NHL schedule.
    if (row.game_type !== 2 || !row.team_abbreviation || !row.game_date) continue;
    const status = String(row.game_status ?? "").toUpperCase();
    const schedule = String(row.schedule_status ?? "").toUpperCase();
    const planningStatus = planningScheduleStatus(status, schedule);
    if (!planningStatus) throw new Error("Planning schedule status could not be verified.");
    const instant = Date.parse(row.start_time ?? "");
    const date = timeZone && Number.isFinite(instant)
      ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant)) : row.game_date;
    result.set(key, {
      scheduleRevision: playerForecastSourcePayloadHash({ id, start: row.start_time, team: row.team_abbreviation, opponent: row.opponent_abbreviation, status, schedule }),
      id, date, startsAt: Number.isFinite(instant) ? new Date(instant).toISOString() : null,
      teamAbbreviation: row.team_abbreviation, opponent: row.opponent_abbreviation ?? "?", home: row.home_away === "home",
      status: planningStatus,
    });
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id) || a.teamAbbreviation.localeCompare(b.teamAbbreviation));
}

/** Whitelist issued, selected FORGE outputs. Research/admin payloads never leave this boundary. */
export function publicPlanningForecasts(revisions: ForgeGameRevision[], players: PlanningPlayer[], games: PlanningGame[], now: Date,
  exclusions: Record<string, number> = {}, exclusionRows: ForecastDiscoveryExclusion[] = [], expectedSeasonId?: number,
  calendarPolicy: ForecastCalendarPolicy = forecastCalendarPolicy()): GameForecast[] {
  const excluded = (reason: ForecastExclusionReason, gameId: string, playerId?: string, targetKey?: string) => {
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, ...(playerId ? { playerId } : {}),
      ...(targetKey ? { targetKey } : {}), reasons: [reason] });
  };
  const byNhl = new Map(players.filter((player) => player.nhlId !== null).map((player) => [player.nhlId, player]));
  const nhlCounts = new Map<number, number>();
  for (const player of players) if (player.nhlId !== null) nhlCounts.set(player.nhlId, (nhlCounts.get(player.nhlId) ?? 0) + 1);
  const gamesById = new Map<string, PlanningGame[]>();
  for (const game of games) gamesById.set(game.id, [...(gamesById.get(game.id) ?? []), game]);
  const forecasts = new Map<string, GameForecast>();
  for (const revision of revisions) {
    const gameId = String(revision.game_id);
    if (!gamesById.has(gameId)) { excluded("game_mismatch", gameId); continue; }
    if (!Number.isFinite(Date.parse(revision.published_at)) || Date.parse(revision.published_at) > now.getTime()) { excluded("future_input", gameId); continue; }
    const cutoffAt = revision.payload.inputCutoff ?? revision.decision_as_of;
    const currentGames = gamesById.get(gameId)!;
    if (new Set(currentGames.map(game => game.startsAt)).size !== 1) { excluded("game_mismatch", gameId); continue; }
    const lead = calendarLeadDay(currentGames[0].startsAt ?? "", now.toISOString());
    if (!validForecastCalendarPolicy(calendarPolicy) || !Number.isFinite(lead) || lead >= calendarPolicy.calendarDays) {
      excluded("outside_horizon", gameId); continue;
    }
    const expiresAt = new Date(Math.min(Date.parse(revision.published_at) + 36 * 3600000, Date.parse(currentGames[0].startsAt ?? "") || Infinity)).toISOString();
    if (!Number.isFinite(Date.parse(cutoffAt)) || Date.parse(cutoffAt) > Date.parse(revision.published_at)) { excluded("invalid_cutoff", gameId); continue; }
    if (Date.parse(expiresAt) <= now.getTime()) { excluded("stale_source", gameId); continue; }
    const provenance = revision.payload.inputProvenance;
    const receipt = provenance?.capturedReads;
    if (!receipt || receipt.version !== "forge-captured-reads-v1" || !/^[a-f0-9]{64}$/.test(receipt.hash)
      || !Number.isSafeInteger(receipt.readCount) || receipt.readCount < 1
      || !Number.isFinite(Date.parse(receipt.firstReceivedAt)) || !Number.isFinite(Date.parse(receipt.lastReceivedAt))
      || Date.parse(receipt.firstReceivedAt) > Date.parse(receipt.lastReceivedAt)
      || Date.parse(receipt.lastReceivedAt) > Date.parse(revision.published_at)) {
      excluded("identity_conflict", gameId); continue;
    }
    const candidates = Array.isArray(provenance?.issuedContexts) ? provenance.issuedContexts.filter((row): row is ForgeIssuedContextV1 =>
      row?.game?.id === revision.game_id && row?.version === "forge-issued-context-v1") : [];
    if (candidates.length !== 1) { excluded("identity_conflict", gameId); continue; }
    const issued = candidates[0];
    if (!Number.isSafeInteger(issued.game.seasonId) || expectedSeasonId !== undefined && issued.game.seasonId !== expectedSeasonId
      || !Number.isFinite(Date.parse(issued.observedAt)) || Date.parse(issued.observedAt) > Date.parse(revision.published_at)
      || !Number.isFinite(Date.parse(issued.game.startTime))
      || new Date(issued.game.startTime).toISOString() !== currentGames[0].startsAt
      || !Array.isArray(issued.schedule) || issued.schedule.length !== 2
      || !Array.isArray(issued.roster) || issued.roster.some(row => !row)
      || !Number.isSafeInteger(issued.game.homeTeamId) || !Number.isSafeInteger(issued.game.awayTeamId)
      || issued.game.homeTeamId === issued.game.awayTeamId
      || issued.schedule.some(row => !row || row.sourceSeasonId !== issued.game.seasonId
        || !Number.isFinite(Date.parse(row.startTime)) || Date.parse(row.startTime) !== Date.parse(issued.game.startTime)
        || ![issued.game.homeTeamId, issued.game.awayTeamId].includes(row.teamId)
        || row.opponentTeamId !== (row.teamId === issued.game.homeTeamId ? issued.game.awayTeamId : issued.game.homeTeamId)
        || !row.teamAbbreviation || !row.revision
        || !validCapturedTime(row.sourceUpdatedAt, issued.observedAt)
        || !validCapturedTime(row.fetchedAt, issued.observedAt)
        || row.revision !== forgeScheduleRevision({ source_game_id: issued.game.id, start_time: row.startTime,
          team_abbreviation: row.teamAbbreviation, opponent_abbreviation: row.opponentAbbreviation,
          game_status: row.gameStatus, schedule_status: row.scheduleStatus }))
      || new Set(issued.schedule.map(row => row.teamId)).size !== 2) { excluded("identity_conflict", gameId); continue; }
    const emit = (nhlId: number, teamId: number, rowGameId: number, stats: Record<string, number | null> | null, startProbability: number | null, confirmedStart: boolean, limitations: string[], conditionalStats?: StatLine | null, appearanceProbability?: number | null, missingReason: ForecastExclusionReason = "unsupported_conditioning") => {
      const player = byNhl.get(nhlId);
      const currentGame = currentGames.find(game => game.teamAbbreviation === player?.teamAbbreviation);
      if (!player || nhlCounts.get(nhlId) !== 1 || player.nhlTeamId !== teamId || String(rowGameId) !== gameId || !currentGame) { excluded("identity_conflict", gameId, player?.id); return; }
      const schedule = issued.schedule.find(row => row.teamId === teamId);
      const roster = issued.roster?.filter(row => row.nhlId === nhlId);
      if (!schedule || schedule.revision !== currentGame.scheduleRevision
        || schedule.teamAbbreviation !== player.teamAbbreviation || schedule.opponentAbbreviation !== currentGame.opponent
        || roster?.length !== 1 || String(roster[0].canonicalId) !== player.id
        || roster[0].seasonId !== issued.game.seasonId || roster[0].teamId !== teamId
        || !Array.isArray(roster[0].membershipCreatedAt)
        || !roster[0].membershipCreatedAt.length
        || roster[0].membershipCreatedAt.some(value => typeof value !== "string" || !validCapturedTime(value, issued.observedAt))
        || !validCapturedTime(roster[0].identityUpdatedAt, issued.observedAt)
        || roster[0].revision !== player.rosterRevision
        || roster[0].revision !== forgeRosterRevision(roster[0])) { excluded("identity_conflict", gameId, player.id); return; }
      if (!stats) { excluded(missingReason, gameId, player.id); return; }
      const safeStats = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, numberOrNull(value)]));
      for (const [targetKey, value] of Object.entries(safeStats)) if (value === null) excluded("missing_target", gameId, player.id, targetKey);
      if (!Object.values(safeStats).some((value) => value !== null)) { excluded("no_usable_target", gameId, player.id); return; }
      const issuedContext: PlanningIssuedContext = { version: "forge-issued-context-v1", playerId: player.id,
        gameId, nhlPlayerId: nhlId, seasonId: issued.game.seasonId, teamId,
        scheduledAt: new Date(issued.game.startTime).toISOString(), scheduleRevision: schedule.revision, rosterRevision: roster[0].revision,
        observedAt: issued.observedAt, scheduleSourceUpdatedAt: schedule.sourceUpdatedAt,
        scheduleFetchedAt: schedule.fetchedAt, identityUpdatedAt: roster[0].identityUpdatedAt,
        membershipCreatedAt: [...roster[0].membershipCreatedAt] };
      const output: GameForecast = {
        sourceKind: "detailed", cutoffAt, expiresAt, sourceWatermark: `forge-captured-reads-v1:${receipt.hash}`,
        issuedContext,
        allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false },
        ...(conditionalStats ? { conditionalStats: Object.fromEntries(Object.entries(conditionalStats).map(([key, value]) => [key, numberOrNull(value)])) } : {}),
        appearanceProbability: appearanceProbability ?? null,
        playerId: player.id, gameId, stats: safeStats, conditioning: "unconditional", startProbability, confirmedStart,
        revisionId: revision.id, issuedAt: revision.published_at,
        modelVersion: revision.payload.codeVersion ?? null,
        limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...limitations],
      };
      const key = `${player.id}:${gameId}`, previous = forecasts.get(key);
      if (!previous || previous.issuedAt < output.issuedAt) forecasts.set(key, output);
    };
    for (const row of revision.payload.players ?? []) {
      const stats = completeBoardSkaterStatsFromProjection(row);
      const prediction = boardSkaterForecast(stats, row.uncertainty);
      // The shared skater model can be conditional-only. Do not assume participation = 1.
      emit(row.player_id, row.team_id, row.game_id, prediction.expected, null, false, prediction.conflicts,
        prediction.conditional, prediction.participationProbability,
        prediction.conditioning === "conditional_playing" ? "missing_participation" : "unsupported_conditioning");
    }
    for (const row of revision.payload.goalies ?? []) {
      const candidates = row.uncertainty?.daily_board_candidates ?? [];
      const probabilities = candidates.map((candidate: Row) => numberOrNull(candidate.startingProbability));
      const mass = probabilities.reduce((sum: number, value: number | null) => sum + (value ?? 0), 0);
      if (mass > 1.000001 || probabilities.some((value: number | null) => value === null || value < 0 || value > 1)) {
        excluded("unsupported_conditioning", gameId); continue;
      }
      for (const candidate of candidates) {
        const prediction = boardGoalieForecast(candidate);
        emit(candidate.playerId, row.team_id, row.game_id, prediction?.expected ?? null, prediction?.participationProbability ?? null,
          prediction?.probabilityStatus === "confirmed_evidence" && prediction.participationProbability === 1,
          ["Goalie start assignments share one team-game; no guaranteed future starts.", "Non-start relief contribution is unavailable."], prediction?.conditional);
      }
    }
  }
  return [...forecasts.values()];
}

class PlanningReadDeadlineError extends Error {
  constructor() { super("Planning read deadline exceeded"); }
}

async function withinDeadline<T>(deadline: number, work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const remaining = deadline - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new PlanningReadDeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new PlanningReadDeadlineError()); }, remaining);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}

async function pages(build: () => any, deadline: number, maximum = 15000,
  key: (row: Row) => unknown = row => row.id): Promise<Row[]> {
  return withinDeadline(deadline, async signal => {
    const rows: Row[] = [], seen = new Set<string>();
    let count: number | null = null;
    do {
      if (signal.aborted) throw new PlanningReadDeadlineError();
      const result = await build().range(rows.length, rows.length + 999).abortSignal(signal);
      if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count)
        || result.count < 0 || result.count > maximum || count !== null && count !== result.count
        || result.data.length > result.count - rows.length || !result.data.length && result.count > rows.length) {
        throw new Error("Planning source read is incomplete");
      }
      count = result.count;
      for (const row of result.data) {
        const value = key(row), parts = Array.isArray(value) ? value : [value];
        if (parts.some(part => part === undefined || part === null || part === "")) throw new Error("Planning source identity is missing");
        const identity = JSON.stringify(value);
        if (seen.has(identity)) throw new Error("Planning source read contains duplicate rows");
        seen.add(identity);
        rows.push(row);
      }
    } while (rows.length < count!);
    return rows;
  });
}

export async function loadPlanningData(db: SupabaseClient<any>, query: PlanningDataQuery, options: { now?: Date; forecastsEnabled?: boolean; deadlineMs?: number } = {}): Promise<PlanningData> {
  const now = options.now ?? new Date();
  const deadline = Math.min(options.deadlineMs ?? Infinity, Date.now() + 20000);
  const inputDeadline = Math.min(deadline, Date.now() + 8000);
  const calendarPolicy = forecastCalendarPolicy(Number(process.env.STARTER_BOARD_CALENDAR_HORIZON_DAYS ?? 14));
  const offsetDate = (value: string, days: number) => new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const [scheduleRows, identities, teams, rosters, weeks, baseline] = await Promise.all([
    pages(() => db.from("roster_optimizer_team_games")
      .select("id,source_game_id,source_season_id,game_type,game_date,start_time,game_status,schedule_status,is_countable,team_abbreviation,opponent_abbreviation,home_away,fetched_at", { count: "exact" })
      .eq("source_season_id", query.seasonId).gte("game_date", offsetDate(query.startDate, -1)).lte("game_date", offsetDate(query.endDate, 1))
      .order("source_game_id").order("team_abbreviation").order("fetched_at").order("id"), inputDeadline),
    pages(() => db.from("fhfh_player_identities")
      .select("id,nhl_player_id,canonical_name,canonical_position,current_nhl_team_id,updated_at", { count: "exact" })
      .eq("verification_status", "verified").eq("lifecycle_status", "active_nhl").is("merged_into_id", null).not("nhl_player_id", "is", null).order("id"), inputDeadline),
    pages(() => db.from("teams").select("id,abbreviation", { count: "exact" }).order("id"), inputDeadline, 500),
    pages(() => db.from("rosters").select("playerId,teamId,created_at", { count: "exact" }).eq("seasonId", query.seasonId).eq("is_current", true)
      .order("playerId").order("teamId").order("created_at"), inputDeadline, 15000, row => [row.playerId, row.teamId, row.created_at]),
    pages(() => db.from("yahoo_matchup_weeks").select("id,game_key,week,start_date,end_date", { count: "exact" })
      .eq("season", String(query.seasonId).slice(0, 4)).order("week").order("id"), inputDeadline, 500).catch(() => []),
    withinDeadline(inputDeadline, signal => loadApprovedContributionBundle(db, query.seasonId, now, { signal }))
      .catch(() => ({ sources: [], manifests: [], checksum: null, limitations: ["baseline_read_unavailable"] })),
  ]);
  const teamNames = new Map(teams.map((row: Row) => [row.id, row.abbreviation as string]));
  const rosterTeams = new Map<number, Set<number>>();
  for (const row of rosters) rosterTeams.set(row.playerId, new Set([...(rosterTeams.get(row.playerId) ?? []), row.teamId]));
  const uniqueNhl = new Map<number, number>();
  for (const row of identities) uniqueNhl.set(row.nhl_player_id, (uniqueNhl.get(row.nhl_player_id) ?? 0) + 1);
  const players: PlanningPlayer[] = identities.filter((row) => uniqueNhl.get(row.nhl_player_id) === 1).map((row) => {
    const current = rosterTeams.get(row.nhl_player_id);
    const teamId = current?.size === 1 ? [...current][0] : null;
    return {
      ...(teamId !== null ? { nhlTeamId: teamId, rosterRevision: playerForecastSourcePayloadHash({ playerId: row.id, nhlId: row.nhl_player_id, seasonId: query.seasonId, teamId,
        membership: rosters.filter(roster => roster.playerId === row.nhl_player_id).map(roster => roster.created_at).sort() }) } : {}),
      id: String(row.id), nhlId: row.nhl_player_id, name: row.canonical_name,
      teamAbbreviation: teamId === null ? null : teamNames.get(teamId) ?? null,
      eligibilityVerified: false,
      eligiblePositions: row.canonical_position ? [position(row.canonical_position)] : [],
      playerClass: row.canonical_position === "G" ? "goalie" : "skater", availability: "unknown", ownership: null,
      canDrop: null, holdValue: null, reserveEligibility: [],
    };
  });
  const games = normalizePlanningGames(scheduleRows, query.timeZone).filter(game => game.date >= query.startDate && game.date <= query.endDate);
  // Padding supports league-local dates; unrelated padding must not stale the returned game scope.
  const gameKeys = new Set(games.map(game => `${game.id}:${game.teamAbbreviation}`));
  const scopedScheduleRows = scheduleRows.filter(row => row.game_type === 2 && gameKeys.has(`${row.source_game_id}:${row.team_abbreviation}`));
  const timestamps = scopedScheduleRows.map(row => row.fetched_at).filter((value): value is string => typeof value === "string"
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()).sort((a, b) => Date.parse(a) - Date.parse(b));
  const scheduleProblems = !games.length ? ["No countable schedule games were found for this range."] : [];
  if (timestamps.length !== scopedScheduleRows.length || !timestamps[0] || now.getTime() - Date.parse(timestamps[0]) > 36 * 3600000) scheduleProblems.push("Schedule coverage may be stale or incomplete. Reloading this reader does not update the upstream cache.");
  const identityProblems = players.some((player) => !player.teamAbbreviation) ? ["Some canonical players lack unique current-season NHL roster membership; review their team before planning."] : [];
  if (uniqueNhl.size !== identities.length) identityProblems.push("Conflicting NHL identity mappings were excluded from the search catalog.");
  const sources: PlanningData["evidence"] = {
    schedule: evidence("roster_optimizer_team_games", timestamps[0] ?? null, query.seasonId, scheduleProblems),
    identities: evidence("fhfh_player_identities + current-season rosters", identities.map((row) => row.updated_at).filter(Boolean).sort()[0] ?? null, query.seasonId, identityProblems),
    availability: { source: "not_supplied", asOf: null, seasonId: query.seasonId, completeness: "unknown", limitations: ["League availability is unknown until verified by the manager or provider."] },
  };
  const revisions: ForgeGameRevision[] = [];
  const exclusionCounts: Record<string, number> = {};
  const exclusionRows: ForecastDiscoveryExclusion[] = [];
  const scheduledGameIds = [...new Set(games.filter(game => game.status === "scheduled").map(game => game.id))];
  const recordGameExclusion = (gameId: string, reason: ForecastExclusionReason) => {
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
    if (exclusionRows.length < 15000) exclusionRows.push({ gameId, reasons: [reason] });
  };
  const forecastProblems: string[] = [];
  let canary: number[] | null = null;
  let rolloutValid = true;
  try { canary = starterBoardCanaryGameIds(); }
  catch { rolloutValid = false; forecastProblems.push("Shared forecast rollout configuration could not be verified; schedule planning remains available."); }
  const selectedGameIds = new Set(scheduledGameIds.filter(id => canary === null || canary.includes(Number(id))));
  const discoveryUnavailable = new Set<string>();
  if (rolloutValid && (options.forecastsEnabled ?? starterBoardFlags().serving)) {
    // Revision slates retain the NHL source date even when the league-local date differs.
    for (const id of scheduledGameIds) if (!selectedGameIds.has(id)) recordGameExclusion(id, "canary_excluded");
    if (canary !== null) forecastProblems.push("Only games enabled by the shared forecast rollout are served.");
    const dates = [...new Set(scheduleRows.filter(row => selectedGameIds.has(String(row.source_game_id))).map(row => String(row.game_date)))];
    // Bounded concurrency, with no update/pipeline side effects.
    const discoveryDeadline = Math.min(deadline, Date.now() + 8000);
    for (let index = 0; index < dates.length; index += 4) {
      if (Date.now() >= discoveryDeadline) {
        forecastProblems.push("Forecast discovery reached its time budget; uncovered dates remain schedule-only.");
        for (const date of dates.slice(index)) for (const row of scheduleRows.filter(row => String(row.game_date) === date)) {
          const id = String(row.source_game_id);
          if (selectedGameIds.has(id)) { discoveryUnavailable.add(id); recordGameExclusion(id, "discovery_timeout"); }
        }
        break;
      }
      const results = await Promise.allSettled(dates.slice(index, index + 4).map(async (date) => {
        const response = await withinDeadline(discoveryDeadline, signal => db.rpc("read_forge_game_revisions", { p_slate_date: date }).abortSignal(signal));
        if (response.error) throw response.error;
        if (!Array.isArray(response.data)) throw new Error("Issued revision read is incomplete");
        return response.data as ForgeGameRevision[];
      }));
      for (const [offset, result] of results.entries()) {
        if (result.status === "fulfilled") revisions.push(...result.value.filter(revision => selectedGameIds.has(String(revision.game_id))));
        else {
          forecastProblems.push("Some issued game forecasts could not be read.");
          const date = dates[index + offset];
          for (const row of scheduleRows.filter(row => String(row.game_date) === date)) {
            const id = String(row.source_game_id);
            if (selectedGameIds.has(id)) { discoveryUnavailable.add(id); recordGameExclusion(id,
              result.reason instanceof PlanningReadDeadlineError ? "discovery_timeout" : "discovery_failed"); }
          }
        }
      }
    }
  } else {
    forecastProblems.push("Shared game-forecast serving is not enabled; schedule planning remains available.");
    for (const id of scheduledGameIds) recordGameExclusion(id, "serving_disabled");
  }
  let acceptedNewsRevision: string | null = null;
  let currentRevisions = revisions;
  if (revisions.length) {
    try {
      const newsDeadline = Math.min(deadline, Date.now() + 2000);
      const news = await withinDeadline(newsDeadline, () => loadAcceptedForecastNews(db, revisions.map(row => row.game_id), now.toISOString(), newsDeadline));
      acceptedNewsRevision = news.revisionHash;
      currentRevisions = revisions.filter(revision => {
        const acceptedAt = news.latestAcceptedAt.get(revision.game_id);
        if (!acceptedAt || !acceptedNewsSupersedes(acceptedAt, revision.payload.inputCutoff ?? revision.decision_as_of)) return true;
        recordGameExclusion(String(revision.game_id), "stale_source");
        return false;
      });
      if (currentRevisions.length !== revisions.length) forecastProblems.push("New accepted evidence supersedes some issued forecasts; affected decisions remain unresolved until refresh.");
    } catch {
      currentRevisions = [];
      for (const id of new Set(revisions.map(row => String(row.game_id)))) recordGameExclusion(id, "incomplete_refresh");
      forecastProblems.push("Accepted evidence freshness could not be verified; issued forecasts are temporarily unavailable.");
    }
  }
  const forecasts = publicPlanningForecasts(currentRevisions, players, games, now, exclusionCounts, exclusionRows, query.seasonId, calendarPolicy);
  if (rolloutValid && (options.forecastsEnabled ?? starterBoardFlags().serving)) {
    const issued = new Set(revisions.map(revision => String(revision.game_id)));
    for (const id of selectedGameIds) if (!issued.has(id) && !discoveryUnavailable.has(id)) recordGameExclusion(id, "no_issued_revision");
  }
  if (scheduleProblems.length) for (const id of scheduledGameIds) recordGameExclusion(id, "incomplete_refresh");
  exclusionRows.sort((a, b) => a.gameId.localeCompare(b.gameId) || (a.playerId ?? "").localeCompare(b.playerId ?? "")
    || (a.targetKey ?? "").localeCompare(b.targetKey ?? "") || a.reasons[0].localeCompare(b.reasons[0]));
  const scheduleRevision = playerForecastSourcePayloadHash(games.map(game => game.scheduleRevision).sort());
  const rosterRevision = playerForecastSourcePayloadHash(players.map(player => [player.id, player.rosterRevision]).sort());
  const manifestContent = { seasonId: query.seasonId, calendarPolicy, acceptedNewsRevision, scheduleRevision, rosterRevision,
    issuedRevisionIds: [...new Set(forecasts.map(row => row.revisionId))].sort(), baselineChecksum: baseline.checksum,
    exclusions: exclusionRows };
  const forecastManifest: ForecastManifest = { ...manifestContent, version: "planning-forecasts-v1", id: playerForecastSourcePayloadHash(manifestContent), asOf: now.toISOString(),
    requiredOpportunities: players.reduce((sum, player) => sum + games.filter(game => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled").length, 0),
    forecastedOpportunities: forecasts.length, exclusionCounts, exclusions: exclusionRows };
  sources.baselines = evidence("Approved contribution rate bundles", baseline.manifests.map(manifest => manifest.issuedAt).sort()[0] ?? null, query.seasonId, baseline.limitations);
  forecastProblems.push("Only issued unconditional game forecasts are used. Conditional-only, missing, or out-of-horizon statistics are unknown, not zero.");
  sources.forecasts = evidence("selected FORGE game revisions", forecasts.map((row) => row.issuedAt).sort()[0] ?? null, query.seasonId, [...new Set(forecastProblems)]);

  // Ownership is platform-wide context, never league availability. This season-scoped view may be absent/stale.
  try {
    const ownershipDeadline = Math.min(deadline, Date.now() + 2000);
    const ownership = await pages(() => db.from("yahoo_player_ownership_daily").select("player_key,player_id,ownership_pct,ownership_date,updated_at", { count: "exact" })
      .eq("season_id", query.seasonId).gte("ownership_date", new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10))
      .order("ownership_date", { ascending: false }).order("player_key"), ownershipDeadline, 25000, row => [row.ownership_date, row.player_key]);
    const mapping = await pages(() => db.from("yahoo_nhl_player_map_read").select("nhl_player_id,yahoo_player_id", { count: "exact" })
      .order("nhl_player_id").order("yahoo_player_id"), ownershipDeadline, 25000, row => [row.nhl_player_id, row.yahoo_player_id]);
    const nhlByYahoo = new Map<string, Set<number>>();
    for (const row of mapping) nhlByYahoo.set(String(row.yahoo_player_id), new Set([...(nhlByYahoo.get(String(row.yahoo_player_id)) ?? []), Number(row.nhl_player_id)]));
    const latest = new Map<number, Row>();
    for (const row of ownership) {
      const matches = nhlByYahoo.get(String(row.player_id));
      if (matches?.size !== 1) continue;
      const nhl = [...matches][0];
      if (!latest.has(nhl)) latest.set(nhl, row);
    }
    for (const player of players) {
      const row = player.nhlId === null ? null : latest.get(player.nhlId);
      const value = numberOrNull(row?.ownership_pct);
      if (value !== null && value >= 0 && value <= 100 && Date.parse(`${row!.ownership_date}T00:00:00Z`) >= now.getTime() - 3 * 86400000) player.ownership = value;
    }
    sources.ownership = evidence("Yahoo daily ownership", ownership[0]?.updated_at ?? null, query.seasonId, ["Ownership is not league availability; missing or older than three days is unknown."]);
  } catch { sources.ownership = evidence("Yahoo daily ownership", null, query.seasonId, ["Ownership could not be verified."]); }
  let recentFormStage: "games" | "stats" | "processing" = "games";
  try {
    const formDeadline = Math.min(deadline, Date.now() + 2000);
    const start = new Date(now.getTime() - 21 * 86400000).toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString().slice(0, 10);
    const historyGames = await pages(() => db.from("games").select("id,date", { count: "exact" })
      .eq("seasonId", query.seasonId).eq("type", 2).gte("date", start).lte("date", cutoff)
      .order("date", { ascending: false }).order("id", { ascending: false }), formDeadline, 500);
    const gameDates = new Map<number, string>(historyGames.filter(row => Number.isSafeInteger(Number(row.id)) && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
      .map(row => [Number(row.id), row.date]));
    const gameIds = [...gameDates.keys()];
    recentFormStage = "stats";
    const recent: Row[] = [];
    for (let index = 0; index < gameIds.length; index += 100) {
      const batch = gameIds.slice(index, index + 100);
      recent.push(...await pages(() => db.from("skatersGameStats").select("playerId,gameId,points", { count: "exact" }).in("gameId", batch)
        .order("gameId", { ascending: false }).order("playerId"), formDeadline, 25000 - recent.length, row => [row.gameId, row.playerId]));
    }
    recentFormStage = "processing";
    const byPlayer = new Map<number, Row[]>();
    for (const row of recent) if (gameDates.has(Number(row.gameId))) {
      const playerId = Number(row.playerId);
      byPlayer.set(playerId, [...(byPlayer.get(playerId) ?? []), row]);
    }
    for (const samples of byPlayer.values()) samples.sort((a, b) => gameDates.get(Number(b.gameId))!.localeCompare(gameDates.get(Number(a.gameId))!)
      || Number(b.gameId) - Number(a.gameId));
    for (const player of players) {
      const samples = player.nhlId === null ? [] : byPlayer.get(player.nhlId) ?? [];
      if (samples.length < 3 || samples.slice(0, 5).some(row => numberOrNull(row.points) === null)) continue;
      const lastThree = samples.slice(0, 3).reduce((sum, row) => sum + row.points, 0);
      const lastFive = samples.slice(0, 5).reduce((sum, row) => sum + row.points, 0);
      const hot = lastThree >= 6, cold = samples.length >= 5 && lastFive === 0;
      player.form = { label: hot ? "Scoring hot" : cold ? "Scoring cold" : "Recent scoring", games: hot ? 3 : Math.min(samples.length, 5), points: hot ? lastThree : lastFive, includedInForecast: null };
    }
    sources.form = evidence("Recent regular-season box scores", null, query.seasonId, ["Recent scoring uses available game logs before the previous day; projection incorporation is unknown and no form bonus is added."]);
  } catch { sources.form = evidence("Recent box scores", null, query.seasonId, [`recent_form_${recentFormStage}_query_failed`]); }
  const weekRows = weeks;
  const matchupWeeks = new Set(weekRows.map((row: Row) => row.game_key)).size === 1 ? weekRows
    .filter((row: Row) => Number.isInteger(row.week) && row.week > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date) && row.start_date <= row.end_date)
    .map((row: Row) => ({ gameKey: String(row.game_key), week: row.week, startDate: row.start_date, endDate: row.end_date })) : [];
  sources.matchupWeeks = evidence("Yahoo matchup weeks", null, query.seasonId, matchupWeeks.length ? [] : ["Matchup week presets are unavailable for this season; use custom dates."]);
  return { players, games, forecasts, baselineSources: baseline.sources, forecastManifest, evidence: sources, matchupWeeks };
}
