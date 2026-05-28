import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";
import {
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
const SOURCE_ROW_LIMIT = 10000;

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

async function fetchOptionalRows<T>(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  label: string,
  notes: string[],
  mapper: (row: Record<string, unknown>) => T
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    notes.push(`${label} unavailable: ${error.message}`);
    return [];
  }
  return (data ?? []).map((row) => mapper(row as Record<string, unknown>));
}

async function fetchTeams(): Promise<TeamIdentityInput[]> {
  return fetchRequiredRows(
    supabase.from("teams").select("id, abbreviation, name").limit(200),
    "teams",
    (row) => ({
      id: asNumber(row.id),
      abbreviation: asString(row.abbreviation),
      name: asString(row.name) || asString(row.abbreviation) || `Team ${row.id}`,
    })
  );
}

async function fetchPlayers(): Promise<PlayerIdentityInput[]> {
  return fetchRequiredRows(
    supabase.from("players").select("id, fullName, team_id, position").limit(2000),
    "players",
    (row) => ({
      id: asNumber(row.id),
      fullName: asString(row.fullName) || `Player ${row.id}`,
      team_id: asNullableNumber(row.team_id),
      position: asNullableString(row.position),
    })
  );
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
  const notes = [
    "Dedicated xG lab surface; production player, goalie, and team drill-ins are not wired to this endpoint yet.",
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
        notes,
      });
    }

    const [teams, players] = await Promise.all([fetchTeams(), fetchPlayers()]);
    let sourceRows = 0;
    let supplementalRows = 0;
    let rows: XgExplorerResponse["rows"];

    if (scope === "players") {
      const xgQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_player_rolling_aggregates")
          .select(
            "player_id, team_id, as_of_game_date, as_of_game_id, games_count, ixg, goals, shot_attempts"
          )
          .order("as_of_game_date", { ascending: false })
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion, windowGames }
      );
      const createdQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_player_created_xg_rolling_aggregates")
          .select(
            "player_id, team_id, as_of_game_date, as_of_game_id, games_count, created_xg, shot_assist_created_xg, transition_created_xg, shot_assist_events, transition_events"
          )
          .order("as_of_game_date", { ascending: false })
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion, windowGames }
      );
      const transitionQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_transition_game_aggregates")
          .select(
            "entity_type, entity_id, controlled_entries, controlled_exits, failed_exits_against, entry_assists, transition_created_shots, transition_created_xg"
          )
          .eq("entity_type", "player")
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion }
      );
      let reboundQuery = (supabase as any)
        .from("nhl_xg_rebound_control_player_game_aggregates")
        .select("player_id, expected_rebounds_created, actual_rebounds_created")
        .limit(SOURCE_ROW_LIMIT);
      reboundQuery = filterBaseQuery(reboundQuery, {
        featureVersion,
        seasonId,
        reboundModelVersion,
      });

      const [xgRows, createdRows, transitionRows, reboundRows] = await Promise.all([
        fetchRequiredRows<PlayerXgRollingInput>(xgQuery, "player rolling xG", (row) => ({
          player_id: asNumber(row.player_id),
          team_id: asNullableNumber(row.team_id),
          as_of_game_date: asNullableString(row.as_of_game_date),
          as_of_game_id: asNumber(row.as_of_game_id),
          games_count: asNumber(row.games_count),
          ixg: asNumber(row.ixg),
          goals: asNumber(row.goals),
          shot_attempts: asNumber(row.shot_attempts),
        })),
        fetchOptionalRows<CreatedXgRollingInput>(createdQuery, "created xG", notes, (row) => ({
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
        })),
        fetchOptionalRows<TransitionAggregateInput>(
          transitionQuery,
          "transition aggregates",
          notes,
          (row) => ({
            entity_type: "player",
            entity_id: asNumber(row.entity_id),
            controlled_entries: asNumber(row.controlled_entries),
            controlled_exits: asNumber(row.controlled_exits),
            failed_exits_against: asNumber(row.failed_exits_against),
            entry_assists: asNumber(row.entry_assists),
            transition_created_shots: asNumber(row.transition_created_shots),
            transition_created_xg: asNumber(row.transition_created_xg),
          })
        ),
        fetchOptionalRows<ReboundPlayerInput>(
          reboundQuery,
          "player rebound control",
          notes,
          (row) => ({
            player_id: asNumber(row.player_id),
            expected_rebounds_created: asNumber(row.expected_rebounds_created),
            actual_rebounds_created: asNumber(row.actual_rebounds_created),
          })
        ),
      ]);
      sourceRows = xgRows.length;
      supplementalRows = createdRows.length + transitionRows.length + reboundRows.length;
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
      const xgQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_team_rolling_aggregates")
          .select(
            "team_id, as_of_game_date, as_of_game_id, games_count, xg_for, xg_against, goals_for, goals_against"
          )
          .order("as_of_game_date", { ascending: false })
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion, windowGames }
      );
      const transitionQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_transition_game_aggregates")
          .select(
            "entity_type, entity_id, controlled_entries, controlled_exits, failed_exits_against, entry_assists, transition_created_xg"
          )
          .eq("entity_type", "team")
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion }
      );
      let reboundQuery = (supabase as any)
        .from("nhl_xg_rebound_control_team_game_aggregates")
        .select("team_id, expected_rebounds_for, expected_rebounds_against")
        .limit(SOURCE_ROW_LIMIT);
      reboundQuery = filterBaseQuery(reboundQuery, {
        featureVersion,
        seasonId,
        reboundModelVersion,
      });

      const [xgRows, transitionRows, reboundRows] = await Promise.all([
        fetchRequiredRows<TeamXgRollingInput>(xgQuery, "team rolling xG", (row) => ({
          team_id: asNumber(row.team_id),
          as_of_game_date: asNullableString(row.as_of_game_date),
          as_of_game_id: asNumber(row.as_of_game_id),
          games_count: asNumber(row.games_count),
          xg_for: asNumber(row.xg_for),
          xg_against: asNumber(row.xg_against),
          goals_for: asNumber(row.goals_for),
          goals_against: asNumber(row.goals_against),
        })),
        fetchOptionalRows<TransitionAggregateInput>(
          transitionQuery,
          "transition aggregates",
          notes,
          (row) => ({
            entity_type: "team",
            entity_id: asNumber(row.entity_id),
            controlled_entries: asNumber(row.controlled_entries),
            controlled_exits: asNumber(row.controlled_exits),
            failed_exits_against: asNumber(row.failed_exits_against),
            entry_assists: asNumber(row.entry_assists),
            transition_created_xg: asNumber(row.transition_created_xg),
          })
        ),
        fetchOptionalRows<ReboundTeamInput>(reboundQuery, "team rebound control", notes, (row) => ({
          team_id: asNumber(row.team_id),
          expected_rebounds_for: asNumber(row.expected_rebounds_for),
          expected_rebounds_against: asNumber(row.expected_rebounds_against),
        })),
      ]);
      sourceRows = xgRows.length;
      supplementalRows = transitionRows.length + reboundRows.length;
      rows = buildTeamXgExplorerRows({ xgRows, transitionRows, reboundRows, teams, limit });
    } else {
      const xgQuery = filterBaseQuery(
        (supabase as any)
          .from("nhl_xg_goalie_rolling_aggregates")
          .select(
            "goalie_player_id, team_id, as_of_game_date, as_of_game_id, games_count, xg_against, goals_against, shots_against, goals_saved_above_expected"
          )
          .order("as_of_game_date", { ascending: false })
          .limit(SOURCE_ROW_LIMIT),
        { featureVersion, seasonId, modelVersion, windowGames }
      );
      let reboundQuery = (supabase as any)
        .from("nhl_xg_rebound_control_goalie_game_aggregates")
        .select(
          "goalie_player_id, expected_rebounds_allowed, actual_rebounds_allowed, rebound_control_saved_above_expected, actual_goalie_freezes, actual_covered_pucks"
        )
        .limit(SOURCE_ROW_LIMIT);
      reboundQuery = filterBaseQuery(reboundQuery, {
        featureVersion,
        seasonId,
        reboundModelVersion,
      });

      const [xgRows, reboundRows] = await Promise.all([
        fetchRequiredRows<GoalieXgRollingInput>(xgQuery, "goalie rolling xG", (row) => ({
          goalie_player_id: asNumber(row.goalie_player_id),
          team_id: asNullableNumber(row.team_id),
          as_of_game_date: asNullableString(row.as_of_game_date),
          as_of_game_id: asNumber(row.as_of_game_id),
          games_count: asNumber(row.games_count),
          xg_against: asNumber(row.xg_against),
          goals_against: asNumber(row.goals_against),
          shots_against: asNumber(row.shots_against),
          goals_saved_above_expected: asNumber(row.goals_saved_above_expected),
        })),
        fetchOptionalRows<ReboundGoalieInput>(
          reboundQuery,
          "goalie rebound control",
          notes,
          (row) => ({
            goalie_player_id: asNumber(row.goalie_player_id),
            expected_rebounds_allowed: asNumber(row.expected_rebounds_allowed),
            actual_rebounds_allowed: asNumber(row.actual_rebounds_allowed),
            rebound_control_saved_above_expected: asNumber(
              row.rebound_control_saved_above_expected
            ),
            actual_goalie_freezes: asNumber(row.actual_goalie_freezes),
            actual_covered_pucks: asNumber(row.actual_covered_pucks),
          })
        ),
      ]);
      sourceRows = xgRows.length;
      supplementalRows = reboundRows.length;
      rows = buildGoalieXgExplorerRows({ xgRows, reboundRows, players, teams, limit });
    }

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
