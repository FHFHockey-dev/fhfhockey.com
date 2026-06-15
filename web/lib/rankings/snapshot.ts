import type { NextApiRequest } from "next";

import {
  buildGoalieMatrixSurface,
  parseGoalieMatrixRequest,
  type GoalieMatrixResponse,
} from "./goalieMatrix";
import {
  buildPlayerMatrixSurface,
  parsePlayerMatrixRequest,
  type PlayerMatrixResponse,
} from "./playerMatrix";
import { ContextualRankingsQueryError } from "./rankingTypes";
import {
  buildTeamMatrixSurface,
  parseTeamMatrixRequest,
  type TeamMatrixResponse,
} from "./teamMatrix";

type QueryValue = string | string[] | undefined;
type SnapshotEntity = "skaters" | "goalies" | "teams";
type SnapshotRow =
  | PlayerMatrixResponse["rows"][number]
  | GoalieMatrixResponse["rows"][number]
  | TeamMatrixResponse["rows"][number];

type SnapshotSource = {
  endpoint: string;
  sourceTables: string[];
  snapshotDate: string | null;
  latestAvailableSnapshotDate: string | null;
  generatedAt: string;
};

export type ContextualRankingSnapshotResponse =
  | {
      success: true;
      version: "contextual_ranking_snapshot_v1";
      status: "available";
      request: {
        entity: SnapshotEntity;
        season: number;
        window: string | null;
        selectedPlayerId: number | null;
        selectedGoalieId: number | null;
        selectedTeam: string | null;
      };
      row: SnapshotRow;
      source: SnapshotSource;
      caveats: string[];
    }
  | {
      success: true;
      version: "contextual_ranking_snapshot_v1";
      status: "unavailable";
      request: {
        entity: SnapshotEntity;
        season: number;
        window: string | null;
        selectedPlayerId: number | null;
        selectedGoalieId: number | null;
        selectedTeam: string | null;
      };
      row: null;
      source: SnapshotSource | null;
      caveats: string[];
      reason: string;
    };

function first(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function integerParam(value: QueryValue, key: string, required = false) {
  const raw = first(value);
  if (!raw) {
    if (required) {
      throw new ContextualRankingsQueryError(`Missing required query param: ${key}`, {
        [key]: "required",
      });
    }
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be an integer",
    });
  }
  return parsed;
}

function stringParam(value: QueryValue) {
  return (first(value) ?? "").trim();
}

function entityParam(query: NextApiRequest["query"]): SnapshotEntity {
  const entity = stringParam(query.entity).toLowerCase();
  if (entity === "goalies" || entity === "teams") return entity;
  return "skaters";
}

function baseRequest(args: {
  entity: SnapshotEntity;
  season: number;
  window: string | null;
  selectedPlayerId: number | null;
  selectedGoalieId: number | null;
  selectedTeam: string | null;
}) {
  return {
    entity: args.entity,
    season: args.season,
    window: args.window,
    selectedPlayerId: args.selectedPlayerId,
    selectedGoalieId: args.selectedGoalieId,
    selectedTeam: args.selectedTeam,
  };
}

function unavailable(args: {
  entity: SnapshotEntity;
  season: number;
  window: string | null;
  selectedPlayerId: number | null;
  selectedGoalieId: number | null;
  selectedTeam: string | null;
  source: SnapshotSource | null;
  reason: string;
  caveats?: string[];
}): ContextualRankingSnapshotResponse {
  return {
    success: true,
    version: "contextual_ranking_snapshot_v1",
    status: "unavailable",
    request: baseRequest(args),
    row: null,
    source: args.source,
    caveats: args.caveats ?? [],
    reason: args.reason,
  };
}

function available(args: {
  entity: SnapshotEntity;
  season: number;
  window: string | null;
  selectedPlayerId: number | null;
  selectedGoalieId: number | null;
  selectedTeam: string | null;
  source: SnapshotSource;
  row: SnapshotRow;
  caveats?: string[];
}): ContextualRankingSnapshotResponse {
  return {
    success: true,
    version: "contextual_ranking_snapshot_v1",
    status: "available",
    request: baseRequest(args),
    row: args.row,
    source: args.source,
    caveats: args.caveats ?? [],
  };
}

async function scanPages<TPayload extends { meta: { pageCount: number } }>(
  buildPage: (page: number) => Promise<TPayload>,
  findRow: (payload: TPayload) => SnapshotRow | null,
) {
  let sourcePayload: TPayload | null = null;
  const maxPages = 100;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await buildPage(page);
    sourcePayload = sourcePayload ?? payload;
    const row = findRow(payload);
    if (row) return { row, sourcePayload: payload };
    if (page >= payload.meta.pageCount) return { row: null, sourcePayload };
  }
  return { row: null, sourcePayload };
}

function playerSource(payload: PlayerMatrixResponse): SnapshotSource {
  return {
    endpoint: "/api/v1/contextual-rankings/matrix",
    sourceTables: payload.meta.sourceTables ?? [
      payload.meta.sourceTable,
      "skater_composite_ratings",
    ],
    snapshotDate: payload.meta.snapshotDate,
    latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    generatedAt: payload.meta.generatedAt,
  };
}

function goalieSource(payload: GoalieMatrixResponse): SnapshotSource {
  return {
    endpoint: "/api/v1/contextual-rankings/goalies",
    sourceTables: payload.meta.sourceTables,
    snapshotDate: payload.meta.snapshotDate,
    latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    generatedAt: payload.meta.generatedAt,
  };
}

function teamSource(payload: TeamMatrixResponse): SnapshotSource {
  return {
    endpoint: "/api/v1/contextual-rankings/teams",
    sourceTables: payload.meta.sourceTables,
    snapshotDate: payload.meta.snapshotDate,
    latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    generatedAt: payload.meta.generatedAt,
  };
}

export async function buildContextualRankingSnapshotSurface(
  query: NextApiRequest["query"],
): Promise<ContextualRankingSnapshotResponse> {
  const entity = entityParam(query);

  if (entity === "goalies") {
    const selectedGoalieId = integerParam(
      query.goalie_id ?? query.selected_goalie,
      "goalie_id",
      true,
    );
    const request = parseGoalieMatrixRequest({
      ...query,
      metric: query.metric ?? query.goalie_metric,
      page_size: "50",
    });
    const { row, sourcePayload } = await scanPages(
      (page) => buildGoalieMatrixSurface({ ...request, page, pageSize: 50 }),
      (payload) =>
        payload.rows.find((entry) => entry.entity.id === selectedGoalieId) ?? null,
    );
    const source = sourcePayload ? goalieSource(sourcePayload) : null;
    if (!row) {
      return unavailable({
        entity,
        season: request.season,
        window: request.window,
        selectedPlayerId: null,
        selectedGoalieId,
        selectedTeam: null,
        source,
        reason: "Selected goalie is unavailable for the requested filter context.",
        caveats: sourcePayload?.meta.sourceWarnings ?? [],
      });
    }
    return available({
      entity,
      season: request.season,
      window: request.window,
      selectedPlayerId: null,
      selectedGoalieId,
      selectedTeam: null,
      source: goalieSource(sourcePayload as GoalieMatrixResponse),
      row,
      caveats: (row as GoalieMatrixResponse["rows"][number]).warnings,
    });
  }

  if (entity === "teams") {
    const selectedTeam = stringParam(
      query.team_abbreviation ?? query.selected_team ?? query.team,
    ).toUpperCase();
    if (!selectedTeam) {
      throw new ContextualRankingsQueryError("Missing required query param: team", {
        team: "required",
      });
    }
    const request = parseTeamMatrixRequest({
      ...query,
      metric: query.metric ?? query.team_metric,
      page_size: "50",
    });
    const { row, sourcePayload } = await scanPages(
      (page) => buildTeamMatrixSurface({ ...request, page, pageSize: 50 }),
      (payload) =>
        payload.rows.find(
          (entry) => entry.team.abbreviation.toUpperCase() === selectedTeam,
        ) ?? null,
    );
    const source = sourcePayload ? teamSource(sourcePayload) : null;
    if (!row) {
      return unavailable({
        entity,
        season: request.season,
        window: null,
        selectedPlayerId: null,
        selectedGoalieId: null,
        selectedTeam,
        source,
        reason: "Selected team is unavailable for the requested filter context.",
        caveats: sourcePayload?.meta.sourceWarnings ?? [],
      });
    }
    return available({
      entity,
      season: request.season,
      window: null,
      selectedPlayerId: null,
      selectedGoalieId: null,
      selectedTeam,
      source: teamSource(sourcePayload as TeamMatrixResponse),
      row,
      caveats: (row as TeamMatrixResponse["rows"][number]).warnings,
    });
  }

  const selectedPlayerId = integerParam(
    query.player_id ?? query.selected_player,
    "player_id",
    true,
  );
  const request = parsePlayerMatrixRequest({
    ...query,
    entity: "skaters",
    selected_player: String(selectedPlayerId),
    page_size: "50",
  });
  const { row, sourcePayload } = await scanPages(
    (page) => buildPlayerMatrixSurface({ ...request, page, pageSize: 50 }),
    (payload) =>
      payload.rows.find((entry) => entry.entity.id === selectedPlayerId) ?? null,
  );
  const source = sourcePayload ? playerSource(sourcePayload) : null;
  if (!row) {
    return unavailable({
      entity,
      season: request.season,
      window: request.window,
      selectedPlayerId,
      selectedGoalieId: null,
      selectedTeam: null,
      source,
      reason: "Selected skater is unavailable for the requested filter context.",
      caveats: sourcePayload?.meta.unavailableMetrics.map(
        (metric) => `${metric.label}: ${metric.reason}`,
      ) ?? [],
    });
  }
  return available({
    entity,
    season: request.season,
    window: request.window,
    selectedPlayerId,
    selectedGoalieId: null,
    selectedTeam: null,
    source: playerSource(sourcePayload as PlayerMatrixResponse),
    row,
    caveats: (row as PlayerMatrixResponse["rows"][number]).warnings,
  });
}
