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
  type TeamIdentityInput,
  type TeamXgRollingInput,
  type XgExplorerError,
  type XgExplorerResponse,
  type XgExplorerScope,
} from "lib/underlying-stats/xgExplorer";
import { fetchActiveXgModel } from "lib/xg/modelRegistry";

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
    modelVersion: string;
    windowGames: number;
  }
): T {
  let filtered = query
    .eq("feature_version", args.featureVersion)
    .eq("model_version", args.modelVersion)
    .eq("window_games", args.windowGames);
  if (args.seasonId != null) filtered = filtered.eq("season_id", args.seasonId);
  return filtered;
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
  const windowGames = parseInteger(req.query.windowGames, DEFAULT_WINDOW_GAMES);
  const seasonId = parseOptionalInteger(req.query.seasonId) ?? inferCurrentSeasonId();
  const limit = parseLimit(req.query.limit);
  const previewRows = previewRowLimit(limit);
  const notes = [
    "Dedicated xG lab surface; production player, goalie, and team drill-ins are not wired to this endpoint yet.",
    `Interactive preview is bounded to ${previewRows} recent source rows.`,
    "Each row is one model, feature version, season, entity, window and cutoff game. Transition and rebound game totals are hidden until they are windowed to the same games.",
  ];
  const respond = (body: Omit<XgExplorerResponse, "success" | "generatedAt">) => {
    res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=300");
    return res.status(200).json({ success: true, generatedAt: new Date().toISOString(), ...body });
  };

  try {
    // The model is the approved registry pin (L14), never "latest by date" or a
    // query override (W3-1 D7; decisions 5, 6, 99).
    const selection = await fetchActiveXgModel({ supabase, predictionType: "shot_goal" });
    if (!selection.model) {
      notes.push(`In-house xG unavailable: no approved active model (${selection.reason}).`);
      return respond({
        scope,
        modelVersion: null,
        featureVersion: null,
        windowGames,
        seasonId,
        rows: [],
        counts: { rows: 0 },
        coverage: buildXgExplorerCoverageReport({ scope, rows: [] }),
        notes,
      });
    }
    const pin = {
      featureVersion: selection.model.featureVersion,
      modelVersion: selection.model.modelVersion,
      seasonId,
      windowGames,
    };
    const ordered = (table: string, columns: string) => () =>
      filterBaseQuery(
        (supabase as any)
          .from(table)
          .select(columns)
          .order("as_of_game_date", { ascending: false })
          .order("as_of_game_id", { ascending: false }),
        pin
      );

    let rows: XgExplorerResponse["rows"];

    if (scope === "players") {
      const [xgRows, createdRows] = await Promise.all([
        fetchPagedRows<PlayerXgRollingInput>(
          ordered(
            "nhl_xg_player_rolling_aggregates",
            "player_id, team_id, as_of_game_date, as_of_game_id, games_count, ixg, goals, shot_attempts"
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
          ordered(
            "nhl_xg_player_created_xg_rolling_aggregates",
            "player_id, team_id, as_of_game_date, as_of_game_id, games_count, created_xg, shot_assist_created_xg, transition_created_xg, shot_assist_events, transition_events"
          ),
          "created xG",
          (row) => ({
            player_id: asNumber(row.player_id),
            team_id: asNullableNumber(row.team_id),
            as_of_game_date: asNullableString(row.as_of_game_date),
            as_of_game_id: asNumber(row.as_of_game_id),
            games_count: asNumber(row.games_count),
            created_xg: asNullableNumber(row.created_xg),
            shot_assist_created_xg: asNullableNumber(row.shot_assist_created_xg),
            transition_created_xg: asNullableNumber(row.transition_created_xg),
            shot_assist_events: asNullableNumber(row.shot_assist_events),
            transition_events: asNullableNumber(row.transition_events),
          }),
          { optional: true, notes, maxRows: previewRows }
        ),
      ]);
      const [players, teams] = await Promise.all([
        fetchPlayersByIds(xgRows.map((row) => row.player_id)),
        fetchTeamsByIds(xgRows.map((row) => row.team_id).filter((id): id is number => id != null)),
      ]);
      rows = buildPlayerXgExplorerRows({ xgRows, createdRows, players, teams, limit });
    } else if (scope === "teams") {
      const xgRows = await fetchPagedRows<TeamXgRollingInput>(
        ordered(
          "nhl_xg_team_rolling_aggregates",
          "team_id, as_of_game_date, as_of_game_id, games_count, xg_for, xg_against, goals_for, goals_against"
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
      );
      const teams = await fetchTeamsByIds(xgRows.map((row) => row.team_id));
      rows = buildTeamXgExplorerRows({ xgRows, teams, limit });
    } else {
      const xgRows = await fetchPagedRows<GoalieXgRollingInput>(
        ordered(
          "nhl_xg_goalie_rolling_aggregates",
          "goalie_player_id, team_id, as_of_game_date, as_of_game_id, games_count, xg_against, goals_against, shots_against, goals_saved_above_expected"
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
      );
      const [players, teams] = await Promise.all([
        fetchPlayersByIds(xgRows.map((row) => row.goalie_player_id)),
        fetchTeamsByIds(xgRows.map((row) => row.team_id).filter((id): id is number => id != null)),
      ]);
      rows = buildGoalieXgExplorerRows({ xgRows, players, teams, limit });
    }

    const coverage = buildXgExplorerCoverageReport({ scope, rows });
    notes.push(...coverage.warnings);

    return respond({
      scope,
      modelVersion: pin.modelVersion,
      featureVersion: pin.featureVersion,
      windowGames,
      seasonId,
      rows,
      counts: { rows: rows.length },
      coverage,
      notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load xG explorer data.";
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({
      error: "Unable to load xG explorer data.",
      issues: [message],
    });
  }
}

export default handler;
