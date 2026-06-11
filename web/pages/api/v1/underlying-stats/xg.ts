import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import { DEFAULT_SUPABASE_PAGE_SIZE, fetchAllSupabasePages } from "lib/supabase/pagination";
import {
  buildXgExplorerCoverageReport,
  buildGoalieXgExplorerRows,
  buildPlayerXgExplorerRows,
  buildTeamXgExplorerRows,
  type CreatedXgRollingInput,
  type GoalieXgRollingInput,
  type PlayerIdentityInput,
  type PlayerXgRollingInput,
  type ReboundGoalieInput,
  type ReboundPlayerInput,
  type ReboundTeamInput,
  type TeamIdentityInput,
  type TeamXgRollingInput,
  type TransitionAggregateInput,
  type XgExplorerError,
  type XgExplorerResponse,
  type XgExplorerScope,
} from "lib/underlying-stats/xgExplorer";

const DEFAULT_FEATURE_VERSION = 1;
const DEFAULT_WINDOW_GAMES = 10;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SOURCE_ROW_LIMIT = 100000;
const MIN_PREVIEW_SOURCE_ROWS = 1000;
const MAX_PREVIEW_SOURCE_ROWS = 5000;

type QueryValue = string | string[] | undefined;

function firstQueryValue(value: QueryValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: QueryValue, fallback: number): number {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: QueryValue): number | null {
  const parsed = Number.parseInt(firstQueryValue(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLimit(value: QueryValue): number {
  return Math.min(Math.max(parseInteger(value, DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function parseScope(value: QueryValue): XgExplorerScope {
  const scope = firstQueryValue(value);
  return scope === "teams" || scope === "goalies" || scope === "players"
    ? scope
    : "players";
}

function inferCurrentSeasonId(now = new Date()): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  return startYear * 10000 + startYear + 1;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function previewRowLimit(displayLimit: number): number {
  return Math.min(MAX_PREVIEW_SOURCE_ROWS, Math.max(MIN_PREVIEW_SOURCE_ROWS, displayLimit * 50));
}

function filterBaseQuery<T extends { eq: (column: string, value: unknown) => T }>(
  query: T,
  args: {
    featureVersion: number;
    seasonId: number | null;
    modelVersion?: string | null;
    reboundModelVersion?: string | null;
    windowGames?: number | null;
  }
): T {
  let filtered = query.eq("feature_version", args.featureVersion);
  if (args.seasonId != null) filtered = filtered.eq("season_id", args.seasonId);
  if (args.modelVersion) filtered = filtered.eq("model_version", args.modelVersion);
  if (args.reboundModelVersion) {
    filtered = filtered.eq("rebound_model_version", args.reboundModelVersion);
  }
  if (args.windowGames != null) filtered = filtered.eq("window_games", args.windowGames);
  return filtered;
}

async function resolveLatestModelVersion(args: {
  table: string;
  dateColumn: string;
  featureVersion: number;
  seasonId: number | null;
  windowGames?: number | null;
  modelColumn: "model_version" | "rebound_model_version";
}): Promise<string | null> {
  let query = (supabase as any)
    .from(args.table)
    .select(args.modelColumn)
    .eq("feature_version", args.featureVersion)
    .order(args.dateColumn, { ascending: false, nullsFirst: false })
    .limit(1);

  if (args.seasonId != null) query = query.eq("season_id", args.seasonId);
  if (args.windowGames != null) query = query.eq("window_games", args.windowGames);

  const { data, error } = await query;
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : null;
  return asNullableString(row?.[args.modelColumn]);
}

async function fetchRequiredRows<T>(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  label: string,
  mapper: (row: Record<string, unknown>) => T
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return (data ?? []).map((row) => mapper(row as Record<string, unknown>));
}

async function fetchPagedRows<T>(
  queryFactory: () => any,
  label: string,
  mapper: (row: Record<string, unknown>) => T,
  options: {
    optional?: boolean;
    notes?: string[];
    maxRows?: number;
  } = {}
): Promise<T[]> {
  const maxRows = options.maxRows ?? SOURCE_ROW_LIMIT;
  const rows = await fetchAllSupabasePages<Record<string, unknown>>(
    ({ from, to }) => queryFactory().range(from, to),
    {
      pageSize: DEFAULT_SUPABASE_PAGE_SIZE,
      limit: maxRows,
    }
  ).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (options.optional) {
      options.notes?.push(`${label} unavailable: ${message}`);
      return [];
    }
    throw new Error(`${label}: ${message}`);
  });

  if (rows.length >= maxRows) {
    options.notes?.push(`${label} reached lab API row cap (${maxRows}).`);
  }

  return rows.map((row) => mapper(row));
}

async function fetchOptionalRowCount(
  queryFactory: () => PromiseLike<{
    count: number | null;
    error: { message?: string } | null;
  }>,
  label: string,
  notes: string[]
): Promise<number> {
  const { count, error } = await queryFactory();
  if (error) {
    notes.push(`${label} count unavailable: ${error.message ?? "unknown error"}`);
    return 0;
  }
  return count ?? 0;
}

async function fetchTeamsByIds(teamIds: number[]): Promise<TeamIdentityInput[]> {
  const ids = Array.from(new Set(teamIds.filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return [];

  const rows: TeamIdentityInput[] = [];
  for (const chunk of chunkRows(ids, 200)) {
    rows.push(
      ...(await fetchRequiredRows(
        supabase.from("teams").select("id, abbreviation, name").in("id", chunk),
        "teams",
        (row) => ({
          id: asNumber(row.id),
          abbreviation: asString(row.abbreviation),
          name: asString(row.name) || asString(row.abbreviation) || `Team ${row.id}`,
        })
      ))
    );
  }
  return rows;
}

async function fetchPlayersByIds(playerIds: number[]): Promise<PlayerIdentityInput[]> {
  const ids = Array.from(new Set(playerIds.filter((id) => Number.isFinite(id))));
  if (ids.length === 0) return [];

  const rows: PlayerIdentityInput[] = [];
  for (const chunk of chunkRows(ids, 200)) {
    rows.push(
      ...(await fetchRequiredRows(
        supabase.from("players").select("id, fullName, team_id, position").in("id", chunk),
        "players",
        (row) => ({
          id: asNumber(row.id),
          fullName: asString(row.fullName) || `Player ${row.id}`,
          team_id: asNullableNumber(row.team_id),
          position: asNullableString(row.position),
        })
      ))
    );
  }
  return rows;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<XgExplorerResponse | XgExplorerError>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const scope = parseScope(req.query.scope);
  const featureVersion = parseInteger(req.query.featureVersion, DEFAULT_FEATURE_VERSION);
  const windowGames = parseInteger(req.query.windowGames, DEFAULT_WINDOW_GAMES);
  const seasonId =
    parseOptionalInteger(req.query.seasonId) ?? inferCurrentSeasonId();
  const limit = parseLimit(req.query.limit);
  const previewRows = previewRowLimit(limit);
  const notes = [
    "Dedicated xG lab surface; production player, goalie, and team drill-ins are not wired to this endpoint yet.",
    `Interactive preview is bounded to ${previewRows} recent source rows; coverage counts are full-table counts for the selected filters.`,
  ];

  try {
    const coreTable =
      scope === "teams"
        ? "nhl_xg_team_rolling_aggregates"
        : scope === "goalies"
          ? "nhl_xg_goalie_rolling_aggregates"
          : "nhl_xg_player_rolling_aggregates";
    const modelVersion =
      asNullableString(firstQueryValue(req.query.modelVersion)) ??
      (await resolveLatestModelVersion({
        table: coreTable,
        dateColumn: "as_of_game_date",
        featureVersion,
        seasonId,
        windowGames,
        modelColumn: "model_version",
      }));
    const reboundModelVersion =
      asNullableString(firstQueryValue(req.query.reboundModelVersion)) ??
      (await resolveLatestModelVersion({
        table:
          scope === "teams"
            ? "nhl_xg_rebound_control_team_game_aggregates"
            : scope === "goalies"
              ? "nhl_xg_rebound_control_goalie_game_aggregates"
              : "nhl_xg_rebound_control_player_game_aggregates",
        dateColumn: "game_date",
        featureVersion,
        seasonId,
        modelColumn: "rebound_model_version",
      }));

    if (!modelVersion) {
      notes.push(
        `No rolling xG aggregate rows found for scope=${scope}, seasonId=${seasonId}, windowGames=${windowGames}. Run the xG aggregate refresh before validating populated output.`
      );
      res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
      return res.status(200).json({
        success: true,
        generatedAt: new Date().toISOString(),
        scope,
        modelVersion: null,
        reboundModelVersion,
        featureVersion,
        windowGames,
        seasonId,
        rows: [],
        counts: {
          rows: 0,
          sourceRows: 0,
          supplementalRows: 0,
        },
        coverage: buildXgExplorerCoverageReport({
          scope,
          sourceRows: 0,
          supplementalRows: 0,
        }),
        notes,
      });
    }

    let sourceRows = 0;
    let supplementalRows = 0;
    let createdRowCount: number | undefined;
    let transitionRowCount: number | undefined;
    let reboundRowCount: number | undefined;
    let rows: XgExplorerResponse["rows"];

    if (scope === "players") {
      const [xgRows, createdRows, transitionRows, reboundRows] = await Promise.all([
        fetchPagedRows<PlayerXgRollingInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_player_rolling_aggregates")
                .select(
                  "player_id, team_id, as_of_game_date, as_of_game_id, games_count, ixg, goals, shot_attempts"
                )
                .order("as_of_game_date", { ascending: false })
                .order("as_of_game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion, windowGames }
            ),
          "player rolling xG",
          (row) => ({
            player_id: asNumber(row.player_id),
            team_id: asNullableNumber(row.team_id),
            as_of_game_date: asNullableString(row.as_of_game_date),
            as_of_game_id: asNumber(row.as_of_game_id),
            games_count: asNumber(row.games_count),
            ixg: asNumber(row.ixg),
            goals: asNumber(row.goals),
            shot_attempts: asNumber(row.shot_attempts),
          }),
          { notes, maxRows: previewRows }
        ),
        fetchPagedRows<CreatedXgRollingInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_player_created_xg_rolling_aggregates")
                .select(
                  "player_id, team_id, as_of_game_date, as_of_game_id, games_count, created_xg, shot_assist_created_xg, transition_created_xg, shot_assist_events, transition_events"
                )
                .order("as_of_game_date", { ascending: false })
                .order("as_of_game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion, windowGames }
            ),
          "created xG",
          (row) => ({
            player_id: asNumber(row.player_id),
            team_id: asNullableNumber(row.team_id),
            as_of_game_date: asNullableString(row.as_of_game_date),
            as_of_game_id: asNumber(row.as_of_game_id),
            games_count: asNumber(row.games_count),
            created_xg: asNumber(row.created_xg),
            shot_assist_created_xg: asNumber(row.shot_assist_created_xg),
            transition_created_xg: asNumber(row.transition_created_xg),
            shot_assist_events: asNumber(row.shot_assist_events),
            transition_events: asNumber(row.transition_events),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
        fetchPagedRows<TransitionAggregateInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_transition_game_aggregates")
                .select(
                  "entity_type, entity_id, controlled_entries, controlled_exits, failed_exits_against, entry_assists, transition_created_shots, transition_created_xg"
                )
                .eq("entity_type", "player")
                .order("game_date", { ascending: false })
                .order("game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion }
            ),
          "transition aggregates",
          (row) => ({
            entity_type: "player",
            entity_id: asNumber(row.entity_id),
            controlled_entries: asNumber(row.controlled_entries),
            controlled_exits: asNumber(row.controlled_exits),
            failed_exits_against: asNumber(row.failed_exits_against),
            entry_assists: asNumber(row.entry_assists),
            transition_created_shots: asNumber(row.transition_created_shots),
            transition_created_xg: asNumber(row.transition_created_xg),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
        fetchPagedRows<ReboundPlayerInput>(
          () => {
            let query = (supabase as any)
              .from("nhl_xg_rebound_control_player_game_aggregates")
              .select("player_id, expected_rebounds_created, actual_rebounds_created")
              .order("game_date", { ascending: false })
              .order("game_id", { ascending: false });
            query = filterBaseQuery(query, {
              featureVersion,
              seasonId,
              reboundModelVersion,
            });
            return query;
          },
          "player rebound control",
          (row) => ({
            player_id: asNumber(row.player_id),
            expected_rebounds_created: asNumber(row.expected_rebounds_created),
            actual_rebounds_created: asNumber(row.actual_rebounds_created),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
      ]);
      const playerIds = [
        ...xgRows.map((row) => row.player_id),
        ...createdRows.map((row) => row.player_id),
        ...reboundRows.map((row) => row.player_id),
      ];
      const teamIds = [
        ...xgRows.map((row) => row.team_id).filter((id): id is number => id != null),
        ...createdRows.map((row) => row.team_id).filter((id): id is number => id != null),
      ];
      const [players, teams] = await Promise.all([
        fetchPlayersByIds(playerIds),
        fetchTeamsByIds(teamIds),
      ]);
      sourceRows = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_player_rolling_aggregates")
              .select("*", { count: "exact", head: true }),
            { featureVersion, seasonId, modelVersion, windowGames }
          ),
        "player rolling xG",
        notes
      );
      createdRowCount = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_player_created_xg_rolling_aggregates")
              .select("*", { count: "exact", head: true }),
            { featureVersion, seasonId, modelVersion, windowGames }
          ),
        "created xG",
        notes
      );
      transitionRowCount = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_transition_game_aggregates")
              .select("*", { count: "exact", head: true })
              .eq("entity_type", "player"),
            { featureVersion, seasonId, modelVersion }
          ),
        "transition aggregates",
        notes
      );
      reboundRowCount = reboundModelVersion
        ? await fetchOptionalRowCount(
            () =>
              filterBaseQuery(
                (supabase as any)
                  .from("nhl_xg_rebound_control_player_game_aggregates")
                  .select("*", { count: "exact", head: true }),
                { featureVersion, seasonId, reboundModelVersion }
              ),
            "player rebound control",
            notes
          )
        : 0;
      supplementalRows = createdRowCount + transitionRowCount + reboundRowCount;
      rows = buildPlayerXgExplorerRows({
        xgRows,
        createdRows,
        transitionRows,
        reboundRows,
        players,
        teams,
        limit,
      });
    } else if (scope === "teams") {
      const [xgRows, transitionRows, reboundRows] = await Promise.all([
        fetchPagedRows<TeamXgRollingInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_team_rolling_aggregates")
                .select(
                  "team_id, as_of_game_date, as_of_game_id, games_count, xg_for, xg_against, goals_for, goals_against"
                )
                .order("as_of_game_date", { ascending: false })
                .order("as_of_game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion, windowGames }
            ),
          "team rolling xG",
          (row) => ({
            team_id: asNumber(row.team_id),
            as_of_game_date: asNullableString(row.as_of_game_date),
            as_of_game_id: asNumber(row.as_of_game_id),
            games_count: asNumber(row.games_count),
            xg_for: asNumber(row.xg_for),
            xg_against: asNumber(row.xg_against),
            goals_for: asNumber(row.goals_for),
            goals_against: asNumber(row.goals_against),
          }),
          { notes, maxRows: previewRows }
        ),
        fetchPagedRows<TransitionAggregateInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_transition_game_aggregates")
                .select(
                  "entity_type, entity_id, controlled_entries, controlled_exits, failed_exits_against, entry_assists, transition_created_xg"
                )
                .eq("entity_type", "team")
                .order("game_date", { ascending: false })
                .order("game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion }
            ),
          "transition aggregates",
          (row) => ({
            entity_type: "team",
            entity_id: asNumber(row.entity_id),
            controlled_entries: asNumber(row.controlled_entries),
            controlled_exits: asNumber(row.controlled_exits),
            failed_exits_against: asNumber(row.failed_exits_against),
            entry_assists: asNumber(row.entry_assists),
            transition_created_xg: asNumber(row.transition_created_xg),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
        fetchPagedRows<ReboundTeamInput>(
          () => {
            let query = (supabase as any)
              .from("nhl_xg_rebound_control_team_game_aggregates")
              .select("team_id, expected_rebounds_for, expected_rebounds_against")
              .order("game_date", { ascending: false })
              .order("game_id", { ascending: false });
            query = filterBaseQuery(query, {
              featureVersion,
              seasonId,
              reboundModelVersion,
            });
            return query;
          },
          "team rebound control",
          (row) => ({
            team_id: asNumber(row.team_id),
            expected_rebounds_for: asNumber(row.expected_rebounds_for),
            expected_rebounds_against: asNumber(row.expected_rebounds_against),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
      ]);
      const teams = await fetchTeamsByIds([
        ...xgRows.map((row) => row.team_id),
        ...transitionRows.map((row) => row.entity_id),
        ...reboundRows.map((row) => row.team_id),
      ]);
      sourceRows = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_team_rolling_aggregates")
              .select("*", { count: "exact", head: true }),
            { featureVersion, seasonId, modelVersion, windowGames }
          ),
        "team rolling xG",
        notes
      );
      transitionRowCount = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_transition_game_aggregates")
              .select("*", { count: "exact", head: true })
              .eq("entity_type", "team"),
            { featureVersion, seasonId, modelVersion }
          ),
        "transition aggregates",
        notes
      );
      reboundRowCount = reboundModelVersion
        ? await fetchOptionalRowCount(
            () =>
              filterBaseQuery(
                (supabase as any)
                  .from("nhl_xg_rebound_control_team_game_aggregates")
                  .select("*", { count: "exact", head: true }),
                { featureVersion, seasonId, reboundModelVersion }
              ),
            "team rebound control",
            notes
          )
        : 0;
      supplementalRows = transitionRowCount + reboundRowCount;
      rows = buildTeamXgExplorerRows({ xgRows, transitionRows, reboundRows, teams, limit });
    } else {
      const [xgRows, reboundRows] = await Promise.all([
        fetchPagedRows<GoalieXgRollingInput>(
          () =>
            filterBaseQuery(
              (supabase as any)
                .from("nhl_xg_goalie_rolling_aggregates")
                .select(
                  "goalie_player_id, team_id, as_of_game_date, as_of_game_id, games_count, xg_against, goals_against, shots_against, goals_saved_above_expected"
                )
                .order("as_of_game_date", { ascending: false })
                .order("as_of_game_id", { ascending: false }),
              { featureVersion, seasonId, modelVersion, windowGames }
            ),
          "goalie rolling xG",
          (row) => ({
            goalie_player_id: asNumber(row.goalie_player_id),
            team_id: asNullableNumber(row.team_id),
            as_of_game_date: asNullableString(row.as_of_game_date),
            as_of_game_id: asNumber(row.as_of_game_id),
            games_count: asNumber(row.games_count),
            xg_against: asNumber(row.xg_against),
            goals_against: asNumber(row.goals_against),
            shots_against: asNumber(row.shots_against),
            goals_saved_above_expected: asNumber(row.goals_saved_above_expected),
          }),
          { notes, maxRows: previewRows }
        ),
        fetchPagedRows<ReboundGoalieInput>(
          () => {
            let query = (supabase as any)
              .from("nhl_xg_rebound_control_goalie_game_aggregates")
              .select(
                "goalie_player_id, expected_rebounds_allowed, actual_rebounds_allowed, rebound_control_saved_above_expected, actual_goalie_freezes, actual_covered_pucks"
              )
              .order("game_date", { ascending: false })
              .order("game_id", { ascending: false });
            query = filterBaseQuery(query, {
              featureVersion,
              seasonId,
              reboundModelVersion,
            });
            return query;
          },
          "goalie rebound control",
          (row) => ({
            goalie_player_id: asNumber(row.goalie_player_id),
            expected_rebounds_allowed: asNumber(row.expected_rebounds_allowed),
            actual_rebounds_allowed: asNumber(row.actual_rebounds_allowed),
            rebound_control_saved_above_expected: asNumber(
              row.rebound_control_saved_above_expected
            ),
            actual_goalie_freezes: asNumber(row.actual_goalie_freezes),
            actual_covered_pucks: asNumber(row.actual_covered_pucks),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
      ]);
      const goalieIds = [
        ...xgRows.map((row) => row.goalie_player_id),
        ...reboundRows.map((row) => row.goalie_player_id),
      ];
      const teamIds = xgRows.map((row) => row.team_id).filter((id): id is number => id != null);
      const [players, teams] = await Promise.all([
        fetchPlayersByIds(goalieIds),
        fetchTeamsByIds(teamIds),
      ]);
      sourceRows = await fetchOptionalRowCount(
        () =>
          filterBaseQuery(
            (supabase as any)
              .from("nhl_xg_goalie_rolling_aggregates")
              .select("*", { count: "exact", head: true }),
            { featureVersion, seasonId, modelVersion, windowGames }
          ),
        "goalie rolling xG",
        notes
      );
      reboundRowCount = reboundModelVersion
        ? await fetchOptionalRowCount(
            () =>
              filterBaseQuery(
                (supabase as any)
                  .from("nhl_xg_rebound_control_goalie_game_aggregates")
                  .select("*", { count: "exact", head: true }),
                { featureVersion, seasonId, reboundModelVersion }
              ),
            "goalie rebound control",
            notes
          )
        : 0;
      supplementalRows = reboundRowCount;
      rows = buildGoalieXgExplorerRows({ xgRows, reboundRows, players, teams, limit });
    }

    const coverage = buildXgExplorerCoverageReport({
      scope,
      sourceRows,
      supplementalRows,
      createdRows: createdRowCount,
      transitionRows: transitionRowCount,
      reboundRows: reboundRowCount,
    });
    notes.push(...coverage.warnings);

    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      scope,
      modelVersion,
      reboundModelVersion,
      featureVersion,
      windowGames,
      seasonId,
      rows,
      counts: {
        rows: rows.length,
        sourceRows,
        supplementalRows,
      },
      coverage,
      notes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load xG explorer data.";
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Unable to load xG explorer data.",
      issues: [message],
    });
  }
}

export default handler;
