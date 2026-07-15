import { fetchAllSupabasePages } from "lib/supabase/pagination";

export type ProjectionCrosscheckSource = {
  id: string;
  tableName: string;
  primaryPlayerIdKey: string;
  originalPlayerNameKey: string;
};

export type ProjectionCrosscheckMissing = {
  player_id: number;
  name: string | null;
  sourceIds: string[];
};

type ProjectionCrosscheckPageFetcher = (args: {
  tableName: string;
  selectColumns: string;
  idKey: string;
  from: number;
  to: number;
}) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;

export async function findMissingProjectionPlayers(
  sources: ProjectionCrosscheckSource[],
  uiPlayerIds: ReadonlySet<string>,
  fetchPage: ProjectionCrosscheckPageFetcher,
  options?: { pageSize?: number },
): Promise<ProjectionCrosscheckMissing[]> {
  const tableToSources = new Map<string, ProjectionCrosscheckSource[]>();
  for (const source of sources) {
    const tableSources = tableToSources.get(source.tableName) ?? [];
    tableSources.push(source);
    tableToSources.set(source.tableName, tableSources);
  }

  const missing = new Map<
    number,
    { name: string | null; sourceIds: Set<string> }
  >();

  for (const [tableName, tableSources] of tableToSources) {
    const idKey = tableSources[0].primaryPlayerIdKey;
    const nameKeys = Array.from(
      new Set(tableSources.map((source) => source.originalPlayerNameKey)),
    );
    const selectColumns = [idKey, ...nameKeys].join(",");
    const rows = await fetchAllSupabasePages<Record<string, unknown>>(
      ({ from, to }) =>
        fetchPage({ tableName, selectColumns, idKey, from, to }),
      { pageSize: options?.pageSize },
    );

    for (const row of rows) {
      const playerId = Number(row[idKey]);
      if (!Number.isFinite(playerId) || uiPlayerIds.has(String(playerId))) {
        continue;
      }
      const playerName = nameKeys
        .map((nameKey) => row[nameKey])
        .find((value): value is string => typeof value === "string" && !!value);
      const existing = missing.get(playerId) ?? {
        name: null,
        sourceIds: new Set<string>(),
      };
      existing.name ||= playerName ?? null;
      tableSources.forEach((source) => existing.sourceIds.add(source.id));
      missing.set(playerId, existing);
    }
  }

  return Array.from(missing, ([player_id, value]) => ({
    player_id,
    name: value.name,
    sourceIds: Array.from(value.sourceIds).sort(),
  })).sort((left, right) => left.player_id - right.player_id);
}
