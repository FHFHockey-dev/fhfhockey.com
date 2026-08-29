import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { FANTASY_PROJECTION_SEASON_ID } from "../lib/fantasy-projections/contracts";
import {
  captureOfficialNhlTransactionAudit,
  findOfficialRosterAuditEvidence,
  OFFICIAL_TRANSACTION_AUDIT_WINDOW_START,
} from "../lib/fantasy-projections/transactionAudit";
import { getServiceRoleClient } from "../lib/supabase/server";

const WINDOW_START = OFFICIAL_TRANSACTION_AUDIT_WINDOW_START;

function option(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
}

function assertLocalOnly(): void {
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Transaction-audit generation is restricted to local Supabase.");
  }
}

function outputPath(): string {
  const output = path.resolve(
    option("output") ?? "/private/tmp/fhfh-2026-27-official-transactions.json",
  );
  const repository = path.resolve(__dirname, "../..");
  if (output === repository || output.startsWith(`${repository}${path.sep}`)) {
    throw new Error("Transaction-audit manifests must be written outside the repository.");
  }
  return output;
}

async function selectAll(
  client: any,
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await configure(
      client.from(table).select(columns).range(start, start + 999),
    );
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function rpcAll(
  client: any,
  functionName: string,
  parameters: Record<string, unknown>,
): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client
      .rpc(functionName, parameters)
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const client = getServiceRoleClient() as any;
  const officialAudit = await captureOfficialNhlTransactionAudit();
  const [conflictResult, identities, teams, observations, captures] =
    await Promise.all([
      client
        .from("player_forecast_season_roster_conflicts")
        .select(
          "id,fhfh_player_id,nhl_player_id,conflict_type,supersedes_id,player_forecast_season_roster_conflict_resolutions(id)",
        )
        .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
        .order("detected_at", { ascending: false })
        .limit(2000),
      selectAll(
        client,
        "fhfh_player_identities",
        "id,nhl_player_id,canonical_name",
        (query) => query.order("id"),
      ),
      selectAll(
        client,
        "teams",
        "id,name,abbreviation",
        (query) => query.order("id"),
      ),
      rpcAll(client, "latest_player_forecast_season_roster_observations", {
        p_season_id: FANTASY_PROJECTION_SEASON_ID,
      }),
      Promise.resolve(officialAudit.captures),
    ]);
  if (conflictResult.error) throw conflictResult.error;

  const superseded = new Set(
    (conflictResult.data ?? [])
      .map((row: any) => row.supersedes_id)
      .filter(Boolean),
  );
  const open = (conflictResult.data ?? []).filter(
    (row: any) =>
      !superseded.has(row.id) &&
      (row.player_forecast_season_roster_conflict_resolutions ?? []).length === 0,
  );
  const identityById = new Map<number, any>(
    identities.map((row: any) => [Number(row.id), row]),
  );
  const teamById = new Map<number, any>(
    teams.map((row: any) => [Number(row.id), row]),
  );
  const landingByPlayer = new Map<number, any>();
  for (const observation of observations) {
    if (
      observation.observation_kind === "player_landing" &&
      observation.fhfh_player_id != null &&
      !landingByPlayer.has(Number(observation.fhfh_player_id))
    ) {
      landingByPlayer.set(Number(observation.fhfh_player_id), observation);
    }
  }

  const capturedAt = officialAudit.capturedAt;
  const unmatched: string[] = [];
  const transactions = open.flatMap((conflict: any) => {
    const playerId = Number(conflict.fhfh_player_id);
    const identity = identityById.get(playerId);
    const landing = landingByPlayer.get(playerId);
    const team = landing ? teamById.get(Number(landing.organization_team_id)) : null;
    if (!identity || !landing || !team || conflict.conflict_type !== "single_source") {
      unmatched.push(identity?.canonical_name ?? `conflict ${conflict.id}`);
      return [];
    }
    const evidence = findOfficialRosterAuditEvidence({
      playerName: String(identity.canonical_name),
      teamName: String(team.name),
      teamAbbreviation: String(team.abbreviation),
      captures,
    });
    if (!evidence) {
      unmatched.push(String(identity.canonical_name));
      return [];
    }
    return [{
      nhlPlayerId: Number(identity.nhl_player_id ?? conflict.nhl_player_id),
      playerName: String(identity.canonical_name),
      eventType: evidence.eventType,
      organizationTeamId: Number(team.id),
      rosterStatus: "unresolved",
      observedAt: capturedAt,
      availableAt: capturedAt,
      effectiveAt: null,
      sourceUrl: evidence.sourceUrl,
      sourceHash: evidence.sourceHash,
    }];
  });
  if (unmatched.length) {
    throw new Error(
      `Official tracker corroboration is missing for: ${unmatched.sort().join(", ")}.`,
    );
  }

  const manifest = {
    schemaVersion: "player-forecast-season-transaction-audit-v1",
    seasonId: FANTASY_PROJECTION_SEASON_ID,
    windowStart: WINDOW_START,
    cutoffAt: capturedAt,
    complete: true,
    sources: captures.map((capture) => ({
      url: capture.url,
      capturedAt,
      sourceHash: capture.sourceHash,
    })),
    transactions,
  };
  const destination = outputPath();
  fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    success: true,
    output: destination,
    sourceCount: manifest.sources.length,
    transactionCount: manifest.transactions.length,
    conflictCount: open.length,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
