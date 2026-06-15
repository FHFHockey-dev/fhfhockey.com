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
type ComparisonEntity = "skaters" | "goalies" | "teams";
type ComparisonPayload =
  | PlayerMatrixResponse
  | GoalieMatrixResponse
  | TeamMatrixResponse;
type ComparisonRow =
  | PlayerMatrixResponse["rows"][number]
  | GoalieMatrixResponse["rows"][number]
  | TeamMatrixResponse["rows"][number];

type ComparisonSource = {
  endpoint: string;
  sourceTables: string[];
  snapshotDate: string | null;
  latestAvailableSnapshotDate: string | null;
  generatedAt: string;
};

export type ContextualRankingComparisonResponse = {
  success: true;
  version: "contextual_ranking_comparison_v1";
  status: "available" | "partial" | "unavailable";
  request: {
    entity: ComparisonEntity;
    season: number;
    window: string | null;
    metric: string;
    subjectCount: number;
  };
  source: ComparisonSource | null;
  metricColumns: Array<{
    metricKey: string;
    label: string;
    lowerIsBetter: boolean;
    source: string;
  }>;
  subjects: Array<{
    key: string;
    label: string;
    status: "available" | "unavailable";
    row: ComparisonRow | null;
    reason: string | null;
    caveats: string[];
  }>;
  caveats: string[];
};

function first(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function entityParam(query: NextApiRequest["query"]): ComparisonEntity {
  const entity = (first(query.entity) ?? "skaters").trim().toLowerCase();
  if (entity === "goalies" || entity === "teams") return entity;
  return "skaters";
}

function parseIntegerList(
  value: QueryValue,
  key: string,
  options: { minItems?: number; maxItems?: number } = {},
) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const parts = values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (options.minItems != null && parts.length < options.minItems) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must include at least ${options.minItems} ids`,
    });
  }
  if (options.maxItems != null && parts.length > options.maxItems) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must include ${options.maxItems} or fewer ids`,
    });
  }

  const ids = parts.map((part) => Number(part));
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be a comma-separated list of positive integer ids",
    });
  }
  return Array.from(new Set(ids));
}

function parseTeamList(value: QueryValue) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const teams = values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  if (teams.length < 1) {
    throw new ContextualRankingsQueryError("Missing required query param: teams", {
      teams: "required",
    });
  }
  if (teams.length > 6) {
    throw new ContextualRankingsQueryError("Invalid query param: teams", {
      teams: "must include 6 or fewer teams",
    });
  }
  return Array.from(new Set(teams));
}

async function scanPages<TPayload extends { meta: { pageCount: number } }>(
  buildPage: (page: number) => Promise<TPayload>,
  collectRows: (payload: TPayload) => ComparisonRow[],
  allFound: (rows: ComparisonRow[]) => boolean,
) {
  let sourcePayload: TPayload | null = null;
  const foundRows: ComparisonRow[] = [];
  const maxPages = 100;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await buildPage(page);
    sourcePayload = sourcePayload ?? payload;
    foundRows.push(...collectRows(payload));
    if (allFound(foundRows) || page >= payload.meta.pageCount) {
      return { rows: foundRows, sourcePayload };
    }
  }
  return { rows: foundRows, sourcePayload };
}

function playerSource(payload: PlayerMatrixResponse): ComparisonSource {
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

function goalieSource(payload: GoalieMatrixResponse): ComparisonSource {
  return {
    endpoint: "/api/v1/contextual-rankings/goalies",
    sourceTables: payload.meta.sourceTables,
    snapshotDate: payload.meta.snapshotDate,
    latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    generatedAt: payload.meta.generatedAt,
  };
}

function teamSource(payload: TeamMatrixResponse): ComparisonSource {
  return {
    endpoint: "/api/v1/contextual-rankings/teams",
    sourceTables: payload.meta.sourceTables,
    snapshotDate: payload.meta.snapshotDate,
    latestAvailableSnapshotDate: payload.meta.latestAvailableSnapshotDate,
    generatedAt: payload.meta.generatedAt,
  };
}

function statusFor(subjects: ContextualRankingComparisonResponse["subjects"]) {
  const available = subjects.filter((subject) => subject.status === "available").length;
  if (available === subjects.length && available > 0) return "available" as const;
  if (available > 0) return "partial" as const;
  return "unavailable" as const;
}

function metricColumns(payload: ComparisonPayload | null) {
  if (!payload) return [];
  if ("sourceTable" in payload.meta) {
    return payload.meta.metricColumns.map((column) => ({
      metricKey: column.metricKey,
      label: column.shortLabel,
      lowerIsBetter: column.lowerIsBetter,
      source: column.denominatorDescription ?? column.denominatorKey ?? "matrix metric",
    }));
  }
  return payload.meta.metricColumns.map((column) => {
    const goalieOrTeamColumn = column as
      | GoalieMatrixResponse["meta"]["metricColumns"][number]
      | TeamMatrixResponse["meta"]["metricColumns"][number];
    return {
      metricKey: goalieOrTeamColumn.metricKey,
      label: goalieOrTeamColumn.label,
      lowerIsBetter: goalieOrTeamColumn.lowerIsBetter,
      source: goalieOrTeamColumn.source,
    };
  });
}

function playerSubject(row: PlayerMatrixResponse["rows"][number] | null, id: number) {
  return {
    key: String(id),
    label: row?.entity.name ?? `Skater ${id}`,
    status: row ? "available" as const : "unavailable" as const,
    row,
    reason: row ? null : "Selected skater is unavailable for the requested filter context.",
    caveats: row?.warnings ?? [],
  };
}

function goalieSubject(row: GoalieMatrixResponse["rows"][number] | null, id: number) {
  return {
    key: String(id),
    label: row?.entity.name ?? `Goalie ${id}`,
    status: row ? "available" as const : "unavailable" as const,
    row,
    reason: row ? null : "Selected goalie is unavailable for the requested filter context.",
    caveats: row?.warnings ?? [],
  };
}

function teamSubject(row: TeamMatrixResponse["rows"][number] | null, team: string) {
  return {
    key: team,
    label: row?.team.name ?? row?.team.abbreviation ?? team,
    status: row ? "available" as const : "unavailable" as const,
    row,
    reason: row ? null : "Selected team is unavailable for the requested filter context.",
    caveats: row?.warnings ?? [],
  };
}

export async function buildContextualRankingComparisonSurface(
  query: NextApiRequest["query"],
): Promise<ContextualRankingComparisonResponse> {
  const entity = entityParam(query);

  if (entity === "goalies") {
    const goalieIds = parseIntegerList(query.goalie_ids ?? query.entity_ids, "goalie_ids", {
      minItems: 1,
      maxItems: 6,
    });
    const request = parseGoalieMatrixRequest({
      ...query,
      metric: query.metric ?? query.goalie_metric,
      page_size: "50",
    });
    const wanted = new Set(goalieIds);
    const result = await scanPages(
      (page) => buildGoalieMatrixSurface({ ...request, page, pageSize: 50 }),
      (payload) => payload.rows.filter((row) => wanted.has(row.entity.id)),
      (rows) => new Set(rows.map((row) => (row as GoalieMatrixResponse["rows"][number]).entity.id)).size >= wanted.size,
    );
    const rowsById = new Map(
      result.rows.map((row) => [
        (row as GoalieMatrixResponse["rows"][number]).entity.id,
        row as GoalieMatrixResponse["rows"][number],
      ]),
    );
    const subjects = goalieIds.map((id) => goalieSubject(rowsById.get(id) ?? null, id));
    const sourcePayload = result.sourcePayload as GoalieMatrixResponse | null;
    return {
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: statusFor(subjects),
      request: {
        entity,
        season: request.season,
        window: request.window,
        metric: request.metric,
        subjectCount: subjects.length,
      },
      source: sourcePayload ? goalieSource(sourcePayload) : null,
      metricColumns: metricColumns(sourcePayload),
      subjects,
      caveats: sourcePayload?.meta.sourceWarnings ?? [],
    };
  }

  if (entity === "teams") {
    const teams = parseTeamList(query.teams ?? query.team_abbreviations);
    const request = parseTeamMatrixRequest({
      ...query,
      metric: query.metric ?? query.team_metric,
      page_size: "50",
    });
    const wanted = new Set(teams);
    const result = await scanPages(
      (page) => buildTeamMatrixSurface({ ...request, page, pageSize: 50 }),
      (payload) =>
        payload.rows.filter((row) =>
          wanted.has(row.team.abbreviation.toUpperCase()),
        ),
      (rows) =>
        new Set(
          rows.map((row) =>
            (row as TeamMatrixResponse["rows"][number]).team.abbreviation.toUpperCase(),
          ),
        ).size >= wanted.size,
    );
    const rowsByTeam = new Map(
      result.rows.map((row) => [
        (row as TeamMatrixResponse["rows"][number]).team.abbreviation.toUpperCase(),
        row as TeamMatrixResponse["rows"][number],
      ]),
    );
    const subjects = teams.map((team) => teamSubject(rowsByTeam.get(team) ?? null, team));
    const sourcePayload = result.sourcePayload as TeamMatrixResponse | null;
    return {
      success: true,
      version: "contextual_ranking_comparison_v1",
      status: statusFor(subjects),
      request: {
        entity,
        season: request.season,
        window: null,
        metric: request.metric,
        subjectCount: subjects.length,
      },
      source: sourcePayload ? teamSource(sourcePayload) : null,
      metricColumns: metricColumns(sourcePayload),
      subjects,
      caveats: sourcePayload?.meta.sourceWarnings ?? [],
    };
  }

  const playerIds = parseIntegerList(query.player_ids ?? query.entity_ids, "player_ids", {
    minItems: 1,
    maxItems: 6,
  });
  const request = parsePlayerMatrixRequest({
    ...query,
    entity: "skaters",
    page_size: "50",
  });
  const wanted = new Set(playerIds);
  const result = await scanPages(
    (page) => buildPlayerMatrixSurface({ ...request, page, pageSize: 50 }),
    (payload) => payload.rows.filter((row) => wanted.has(row.entity.id)),
    (rows) =>
      new Set(
        rows.map((row) => (row as PlayerMatrixResponse["rows"][number]).entity.id),
      ).size >= wanted.size,
  );
  const rowsById = new Map(
    result.rows.map((row) => [
      (row as PlayerMatrixResponse["rows"][number]).entity.id,
      row as PlayerMatrixResponse["rows"][number],
    ]),
  );
  const subjects = playerIds.map((id) => playerSubject(rowsById.get(id) ?? null, id));
  const sourcePayload = result.sourcePayload as PlayerMatrixResponse | null;
  return {
    success: true,
    version: "contextual_ranking_comparison_v1",
    status: statusFor(subjects),
    request: {
      entity,
      season: request.season,
      window: request.window,
      metric: request.sortMetric,
      subjectCount: subjects.length,
    },
    source: sourcePayload ? playerSource(sourcePayload) : null,
    metricColumns: metricColumns(sourcePayload),
    subjects,
    caveats: sourcePayload?.meta.unavailableMetrics.map(
      (metric) => `${metric.label}: ${metric.reason}`,
    ) ?? [],
  };
}
