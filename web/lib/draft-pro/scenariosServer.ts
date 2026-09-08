import serviceRoleClient from "lib/supabase/server";
import { parseRosterScheduleReadFilter, readRosterSchedule, type ScheduleReadClient } from "lib/rosterScheduleData";
import { assertDustScheduleRowsMatchResolution, normalizeDustProjectionSeason, resolveDustScheduleSeason, type DustScheduleSeasonMetadata } from "./dustSeason";
import { evaluateDraftProDust, type DraftProDustInput, type DraftProDustResult } from "./dust";
import { readPrivateImportRows } from "./privateImportTransport";
import { scenarioFingerprint, type ScenarioDustResult, type ScenarioInput, type ScenarioPlayer } from "./scenarios";

type Client = typeof serviceRoleClient;
type MetadataClient = { from(table: "roster_optimizer_team_games"): { select(columns: string): { eq(column: "source_season_id", value: number): { order(column: "id", options: { ascending: boolean }): { range(from: number, to: number): PromiseLike<{ data: DustScheduleSeasonMetadata[] | null; error: { message: string } | null }> } } } } };
export type RosterDustRequest = Readonly<{ roster: readonly ScenarioPlayer[]; candidates: readonly ScenarioPlayer[]; source: ScenarioInput["source"] }>;

async function seasonMapping(client: MetadataClient, season: string, gameKey?: string) {
  const sourceSeasonId = Number(season); const rows: DustScheduleSeasonMetadata[] = [];
  if (!/^\d{8}$/.test(season) || !Number.isSafeInteger(sourceSeasonId)) return resolveDustScheduleSeason(season, [], gameKey);
  for (let page = 0; page < 10; page += 1) { const { data, error } = await client.from("roster_optimizer_team_games").select("id,game_key,season,source_season_id").eq("source_season_id", sourceSeasonId).order("id", { ascending: true }).range(page * 1_000, (page + 1) * 1_000 - 1); if (error) throw error; rows.push(...(data ?? [])); if ((data?.length ?? 0) < 1_000) return resolveDustScheduleSeason(season, rows, gameKey); }
  throw new Error("The persisted schedule mapping exceeded the bounded metadata read limit.");
}
function optimizerPlayer(player: ScenarioPlayer) { return { id: player.id, name: player.name, teamAbbreviation: player.teamAbbreviation, eligiblePositions: player.eligiblePositions, value: player.rankValue, status: player.status, available: player.available, projectionSeason: player.projectionSeason }; }

/** Resolves the W06 persisted schedule and evaluates a real roster with any supplied candidates. */
export async function evaluateRosterDust({ roster, candidates, source }: RosterDustRequest, client: Client = serviceRoleClient, now = new Date()): Promise<ScenarioDustResult> {
  try {
    const schedule = source.schedule; const resolution = await seasonMapping(client as unknown as MetadataClient, schedule.season, schedule.gameKey);
    const filter = parseRosterScheduleReadFilter({ gameKey: resolution.gameKey, startWeek: String(schedule.startWeek), endWeek: String(schedule.endWeek) });
    const games = await readRosterSchedule(client as unknown as ScheduleReadClient, filter); assertDustScheduleRowsMatchResolution(games, resolution);
    const fetched = games.map((game) => game.fetched_at).filter((value): value is string => Boolean(value)).sort(); const canonicalSeason = String(resolution.sourceSeasonId);
    return evaluateDraftProDust({ season: canonicalSeason, lineupMode: schedule.lineupMode, inputOrigin: source.projection.origin === "saved_private_import" ? "private_import" : "draft", privateImportAccountSaved: source.projection.origin === "saved_private_import" ? true : undefined, roster: normalizeDustProjectionSeason(roster.map(optimizerPlayer), schedule.season, canonicalSeason), candidates: normalizeDustProjectionSeason(candidates.map(optimizerPlayer), schedule.season, canonicalSeason), rosterSlots: schedule.rosterSlots, schedule: { season: canonicalSeason, freshness: { oldestFetchedAt: games.length && fetched.length === games.length ? fetched[0] ?? null : null, latestFetchedAt: fetched.at(-1) ?? null }, games: games.map((game) => ({ gameId: String(game.source_game_id), date: game.game_date, teamAbbreviation: game.team_abbreviation, yahooWeek: game.week, status: "scheduled" as const, season: canonicalSeason })) } } satisfies DraftProDustInput, now);
  } catch (cause) {
    return { state: "schedule_unavailable", freshness: { oldestFetchedAt: null, latestFetchedAt: null }, window: { startWeek: source.schedule.startWeek, endWeek: source.schedule.endWeek, startDate: null, endDate: null }, baseline: null, insights: [], diagnostics: [cause instanceof Error ? cause.message : "Schedule analysis is unavailable."] };
  }
}

/** Scenario compatibility wrapper: evaluates the same roster with its two A/B candidates. */
export async function evaluateScenarioDust(input: ScenarioInput, client: Client = serviceRoleClient, now = new Date()) { return evaluateRosterDust({ roster: input.roster, candidates: [input.candidateA, input.candidateB], source: input.source }, client, now); }

export async function validateAnalysisReferences(userId: string, source: ScenarioInput["source"], draftId: string | null, client: Client = serviceRoleClient, readRows: typeof readPrivateImportRows = readPrivateImportRows) {
  if (draftId) { const { data, error } = await client.from("draft_pro_drafts").select("id").eq("id", draftId).eq("user_id", userId).maybeSingle(); if (error) throw error; if (!data) return "draft_not_found" as const; }
  if (source.projection.origin === "saved_private_import") {
    const imports = source.projection.privateImports ?? []; if (!imports.length || !draftId) return "private_import_not_saved" as const;
    const importIds = imports.map((item) => item.id); const { data, error } = await client.from("draft_pro_private_imports").select("id").in("id", importIds).eq("user_id", userId).eq("draft_id", draftId).is("deleted_at", null); if (error) throw error;
    const owned = new Set((data ?? []).map((row) => row.id)); if (owned.size !== new Set(importIds).size || importIds.some((id) => !owned.has(id))) return "private_import_not_saved" as const;
    for (const item of imports) { const rows = await readRows({ userId, draftId, importId: item.id }); if (scenarioFingerprint(rows) !== item.contentFingerprint) return "private_import_not_saved" as const; }
  }
  return null;
}

/** Scenario compatibility wrapper for the shared analysis ownership checks. */
export async function validateScenarioReferences(userId: string, input: ScenarioInput, draftId: string | null, client: Client = serviceRoleClient, readRows: typeof readPrivateImportRows = readPrivateImportRows) { return validateAnalysisReferences(userId, input.source, draftId, client, readRows); }
