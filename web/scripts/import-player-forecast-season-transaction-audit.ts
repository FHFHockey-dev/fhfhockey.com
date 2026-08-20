import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { FANTASY_PROJECTION_SEASON_ID } from "../lib/fantasy-projections/contracts";
import { checksumCanonicalJson } from "../lib/fantasy-projections/evaluator";
import { refreshSeasonRosterIntegrity } from "../lib/fantasy-projections/rosterReconciliation";
import { getServiceRoleClient } from "../lib/supabase/server";

const WINDOW_START = "2026-06-16T00:00:00Z";
const EVENT_TYPES = new Set([
  "membership",
  "signing",
  "trade",
  "waiver",
  "release",
  "affiliate_assignment",
  "injury",
]);
const ROSTER_STATUSES = new Set([
  "active_nhl",
  "injured_nhl",
  "affiliate",
  "prospect_reserve",
  "unsigned",
  "unresolved",
]);

type Source = { url: string; capturedAt: string; sourceHash: string };
type Transaction = {
  nhlPlayerId: number;
  playerName: string;
  eventType: string;
  organizationTeamId: number | null;
  rosterStatus: string;
  observedAt: string;
  availableAt: string;
  effectiveAt?: string | null;
  sourceUrl: string;
  sourceHash: string;
};
type Manifest = {
  schemaVersion: string;
  seasonId: number;
  windowStart: string;
  cutoffAt: string;
  complete: boolean;
  sources: Source[];
  transactions: Transaction[];
};

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`Pass ${prefix}<value>.`);
  return value;
}

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_TRANSACTION_AUDIT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_TRANSACTION_AUDIT_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Transaction-audit import is restricted to local Supabase.");
  }
}

function officialNhlUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "nhl.com" || hostname.endsWith(".nhl.com");
  } catch {
    return false;
  }
}

function validTimestamp(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateManifest(raw: unknown): Manifest {
  const manifest = raw as Manifest;
  if (
    !manifest ||
    manifest.schemaVersion !== "player-forecast-season-transaction-audit-v1" ||
    Number(manifest.seasonId) !== FANTASY_PROJECTION_SEASON_ID ||
    manifest.windowStart !== WINDOW_START ||
    manifest.complete !== true ||
    !validTimestamp(manifest.cutoffAt) ||
    Date.parse(manifest.cutoffAt) < Date.parse(WINDOW_START) ||
    Date.parse(manifest.cutoffAt) > Date.now() ||
    !Array.isArray(manifest.sources) ||
    manifest.sources.length === 0 ||
    !Array.isArray(manifest.transactions)
  ) {
    throw new Error("Transaction audit manifest header is invalid or incomplete.");
  }
  const sourceUrls = new Set<string>();
  for (const source of manifest.sources) {
    if (
      !officialNhlUrl(source.url) ||
      !validTimestamp(source.capturedAt) ||
      Date.parse(source.capturedAt) < Date.parse(WINDOW_START) ||
      Date.parse(source.capturedAt) > Date.parse(manifest.cutoffAt) ||
      !/^[0-9a-f]{64}$/.test(source.sourceHash)
    ) {
      throw new Error("Every transaction-audit source must be an immutable official NHL capture.");
    }
    sourceUrls.add(source.url);
  }
  for (const transaction of manifest.transactions) {
    if (
      !Number.isInteger(transaction.nhlPlayerId) ||
      transaction.nhlPlayerId <= 0 ||
      !String(transaction.playerName ?? "").trim() ||
      !EVENT_TYPES.has(transaction.eventType) ||
      !ROSTER_STATUSES.has(transaction.rosterStatus) ||
      (transaction.organizationTeamId != null &&
        (!Number.isInteger(transaction.organizationTeamId) || transaction.organizationTeamId <= 0)) ||
      !validTimestamp(transaction.observedAt) ||
      !validTimestamp(transaction.availableAt) ||
      Date.parse(transaction.observedAt) > Date.parse(transaction.availableAt) ||
      Date.parse(transaction.observedAt) < Date.parse(WINDOW_START) ||
      Date.parse(transaction.availableAt) > Date.parse(manifest.cutoffAt) ||
      !sourceUrls.has(transaction.sourceUrl) ||
      !/^[0-9a-f]{64}$/.test(transaction.sourceHash) ||
      (transaction.effectiveAt != null && !validTimestamp(transaction.effectiveAt))
    ) {
      throw new Error(`Invalid official transaction row for NHL ${transaction.nhlPlayerId}.`);
    }
  }
  return manifest;
}

async function main(): Promise<void> {
  assertLocalOnly();
  const manifestPath = path.resolve(argument("manifest"));
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  const client = getServiceRoleClient() as any;
  const nhlPlayerIds = Array.from(new Set(manifest.transactions.map((row) => row.nhlPlayerId)));
  const { data: identities, error: identityError } = nhlPlayerIds.length
    ? await client
        .from("fhfh_player_identities")
        .select("id,nhl_player_id")
        .in("nhl_player_id", nhlPlayerIds)
    : { data: [], error: null };
  if (identityError) throw identityError;
  const identityByNhl = new Map<number, number>(
    (identities ?? []).map((row: any) => [Number(row.nhl_player_id), Number(row.id)] as const),
  );
  const unmapped = nhlPlayerIds.filter((nhlPlayerId) => !identityByNhl.has(nhlPlayerId));
  if (unmapped.length) {
    throw new Error(`Transaction audit contains unmapped NHL identities: ${unmapped.join(", ")}.`);
  }
  const { data: existing, error: existingError } = await client
    .rpc("latest_player_forecast_season_roster_observations", {
      p_season_id: FANTASY_PROJECTION_SEASON_ID,
    });
  if (existingError) throw existingError;
  const previousByPlayer = new Map<number, string>();
  for (const row of existing ?? []) {
    if (row.observation_kind === "official_transaction" && row.fhfh_player_id != null) {
      previousByPlayer.set(Number(row.fhfh_player_id), String(row.id));
    }
  }
  let importedTransactions = 0;
  for (const transaction of [...manifest.transactions].sort(
    (left, right) => Date.parse(left.availableAt) - Date.parse(right.availableAt),
  )) {
    const playerId = identityByNhl.get(transaction.nhlPlayerId)!;
    const idempotency = {
      nhlPlayerId: transaction.nhlPlayerId,
      eventType: transaction.eventType,
      organizationTeamId: transaction.organizationTeamId,
      rosterStatus: transaction.rosterStatus,
      effectiveAt: transaction.effectiveAt ?? null,
      sourceHash: transaction.sourceHash,
    };
    const sourceKey = `official-transaction-audit:${sha256(idempotency)}`;
    const { data: existingObservation, error: lookupError } = await client
      .from("player_forecast_season_roster_observations")
      .select("id")
      .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
      .eq("observation_kind", "official_transaction")
      .eq("source_key", sourceKey)
      .eq("source_hash", transaction.sourceHash)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existingObservation) {
      previousByPlayer.set(playerId, String(existingObservation.id));
      continue;
    }
    const { data: inserted, error: insertError } = await client
      .from("player_forecast_season_roster_observations")
      .insert({
        season_id: FANTASY_PROJECTION_SEASON_ID,
        fhfh_player_id: playerId,
        nhl_player_id: transaction.nhlPlayerId,
        raw_player_name: transaction.playerName.trim(),
        observation_kind: "official_transaction",
        event_type: transaction.eventType,
        organization_team_id: transaction.organizationTeamId,
        roster_status: transaction.rosterStatus,
        source_key: sourceKey,
        source_url: transaction.sourceUrl,
        source_hash: transaction.sourceHash,
        observed_at: transaction.observedAt,
        available_at: transaction.availableAt,
        effective_at: transaction.effectiveAt ?? null,
        confidence: 1,
        evidence: { auditManifest: manifestPath, sourceManifestChecksum: checksumCanonicalJson(manifest.sources) },
        supersedes_id: previousByPlayer.get(playerId) ?? null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    previousByPlayer.set(playerId, String(inserted.id));
    importedTransactions += 1;
  }
  const sourceManifestChecksum = checksumCanonicalJson(manifest.sources);
  const reconciliation = await refreshSeasonRosterIntegrity({
    supabase: client,
    landingBatchSize: 250,
    verifiedTransactionCoverage: {
      windowStart: WINDOW_START,
      cutoffAt: manifest.cutoffAt,
      sourceManifestChecksum,
      sourceCount: manifest.sources.length,
    },
  });
  process.stdout.write(`${JSON.stringify({
    success: true,
    manifestPath,
    sourceManifestChecksum,
    importedTransactions,
    reconciliation,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
