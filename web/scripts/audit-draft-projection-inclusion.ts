import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";

loadEnv({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;
if (!url || !key) throw new Error("Missing public Supabase environment variables.");

const client = createClient(url, key, { auth: { persistSession: false } });
const pageSize = 1000;

async function run() {
  const evidence = [];
  for (const source of PROJECTION_SOURCES_CONFIG) {
    const rows: Record<string, unknown>[] = [];
    const selectColumns = Array.from(
      new Set([
        source.primaryPlayerIdKey,
        source.originalPlayerNameKey,
        source.teamKey,
        source.positionKey,
        ...source.statMappings.map((mapping) => mapping.dbColumnName)
      ].filter((column): column is string => !!column))
    );
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from(source.tableName as any)
        .select(selectColumns.join(","))
        .order(source.primaryPlayerIdKey, {
          ascending: true,
          nullsFirst: true
        })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`${source.id}: ${error.message}`);
      const page = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    const ids = rows
      .map((row) => Number(row[source.primaryPlayerIdKey]))
      .filter((playerId) => Number.isInteger(playerId) && playerId > 0);
    const uniqueIds = new Set(ids);
    const rowsById = new Map<number, Record<string, unknown>[]>();
    for (const row of rows) {
      const playerId = Number(row[source.primaryPlayerIdKey]);
      if (!Number.isInteger(playerId) || playerId <= 0) continue;
      const group = rowsById.get(playerId) ?? [];
      group.push(row);
      rowsById.set(playerId, group);
    }
    const duplicateGroups = Array.from(rowsById.entries()).filter(
      ([, group]) => group.length > 1
    );
    const conflictingGroups = duplicateGroups.filter(([, group]) => {
      const fingerprints = new Set(
        group.map((row) =>
          JSON.stringify(selectColumns.map((column) => row[column] ?? null))
        )
      );
      return fingerprints.size > 1;
    });
    evidence.push({
      id: source.id,
      playerType: source.playerType,
      table: source.tableName,
      rawRows: rows.length,
      validIdRows: ids.length,
      invalidIdRows: rows.length - ids.length,
      uniquePlayerIds: uniqueIds.size,
      duplicateIdRows: ids.length - uniqueIds.size,
      duplicatePlayerIds: duplicateGroups.length,
      conflictingDuplicatePlayerIds: conflictingGroups.length,
      conflictingDuplicateSamples: conflictingGroups
        .slice(0, 10)
        .map(([playerId, group]) => ({
          playerId,
          rows: group.length,
          teams: source.teamKey
            ? Array.from(
                new Set(group.map((row) => row[source.teamKey!] ?? null))
              )
            : [],
          gamesPlayed: (() => {
            const gamesColumn = source.statMappings.find(
              (mapping) => mapping.key === "GAMES_PLAYED"
            )?.dbColumnName;
            return gamesColumn
              ? Array.from(new Set(group.map((row) => row[gamesColumn] ?? null)))
              : [];
          })()
        }))
    });
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
