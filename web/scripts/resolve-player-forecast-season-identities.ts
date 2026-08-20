import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import {
  FANTASY_PROJECTION_SEASON_ID,
} from "../lib/fantasy-projections/contracts";
import {
  fetchOfficialNhlPlayerEvidence,
  persistSeasonIdentityResolution,
  planSeasonIdentityResolution,
  type SeasonIdentityRegistryCandidate,
  type SeasonPlayerPoolReview,
} from "../lib/fantasy-projections/identityResolution";
import { getServiceRoleClient } from "../lib/supabase/server";

type ReviewRow = {
  id: string;
  season_id: number;
  nhl_player_id: number | null;
  raw_player_name: string;
  team_id: number | null;
  position: string | null;
  issue_code: string;
  resolution_status: string;
  supersedes_id: string | null;
};

function option(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
}

function assertLocalOnly(): void {
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Identity batch resolution is restricted to local Supabase.");
  }
}

function outputPath(): string {
  const output = path.resolve(
    option("output") ?? "/private/tmp/fhfh-season-identity-resolution-plan.json",
  );
  const repository = path.resolve(__dirname, "../..");
  if (output === repository || output.startsWith(`${repository}${path.sep}`)) {
    throw new Error("Identity batch receipts must be written outside the repository.");
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

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await callback(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function review(row: ReviewRow): SeasonPlayerPoolReview {
  return {
    id: row.id,
    seasonId: Number(row.season_id),
    nhlPlayerId: row.nhl_player_id == null ? null : Number(row.nhl_player_id),
    rawPlayerName: row.raw_player_name,
    teamId: row.team_id == null ? null : Number(row.team_id),
    position: row.position,
    issueCode: row.issue_code,
  };
}

function editorUserId(): string {
  const configured = (process.env.PLAYER_FORECAST_EDITOR_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requested = option("editor-user-id") ?? configured[0] ?? "";
  if (
    configured.length !== 1 ||
    requested !== configured[0] ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requested)
  ) {
    throw new Error(
      "Applying the identity plan requires exactly one PLAYER_FORECAST_EDITOR_USER_IDS UUID and a matching --editor-user-id when supplied.",
    );
  }
  return requested;
}

async function main(): Promise<void> {
  assertLocalOnly();
  const apply = process.argv.includes("--apply");
  if (
    apply &&
    process.env.PLAYER_FORECAST_IDENTITY_BATCH_CONFIRM !== "local-only"
  ) {
    throw new Error(
      "Set PLAYER_FORECAST_IDENTITY_BATCH_CONFIRM=local-only before applying identity decisions.",
    );
  }

  const client = getServiceRoleClient() as any;
  const [reviewRows, identityRows] = await Promise.all([
    selectAll(
      client,
      "player_forecast_season_player_pool_review",
      "id,season_id,nhl_player_id,raw_player_name,team_id,position,issue_code,resolution_status,supersedes_id",
      (query) => query.eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("created_at"),
    ),
    selectAll(
      client,
      "fhfh_player_identities",
      "id,nhl_player_id,canonical_name,birth_date,canonical_position,verification_status,merged_into_id",
      (query) => query.order("id"),
    ),
  ]);
  const superseded = new Set(
    (reviewRows as ReviewRow[]).map((row) => row.supersedes_id).filter(Boolean),
  );
  const pending = (reviewRows as ReviewRow[])
    .filter(
      (row) =>
        row.resolution_status === "pending" &&
        !superseded.has(row.id) &&
        row.issue_code === "official_roster_identity_unmapped",
    )
    .map(review);
  const identities: SeasonIdentityRegistryCandidate[] = identityRows.map((row) => ({
    fhfhPlayerId: Number(row.id),
    nhlPlayerId: row.nhl_player_id == null ? null : Number(row.nhl_player_id),
    canonicalName: String(row.canonical_name),
    birthDate: row.birth_date == null ? null : String(row.birth_date),
    position: row.canonical_position == null ? null : String(row.canonical_position),
    verificationStatus: String(row.verification_status),
    mergedIntoId: row.merged_into_id == null ? null : Number(row.merged_into_id),
  }));

  const decisions = await mapWithConcurrency(pending, 12, async (pendingReview) => {
    if (pendingReview.nhlPlayerId == null) {
      return {
        review: pendingReview,
        officialPlayer: null,
        plan: {
          action: "manual_review" as const,
          fhfhPlayerId: null,
          lifecycleStatus: null,
          reason: "The staged review does not contain an NHL player ID.",
        },
      };
    }
    try {
      const officialPlayer = await fetchOfficialNhlPlayerEvidence(
        pendingReview.nhlPlayerId,
      );
      return {
        review: pendingReview,
        officialPlayer,
        plan: planSeasonIdentityResolution({
          review: pendingReview,
          officialPlayer,
          identities,
        }),
      };
    } catch (error) {
      return {
        review: pendingReview,
        officialPlayer: null,
        plan: {
          action: "manual_review" as const,
          fhfhPlayerId: null,
          lifecycleStatus: null,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  const generatedAt = new Date().toISOString();
  const planBody = {
    schemaVersion: "player-forecast-season-identity-batch-plan-v1",
    seasonId: FANTASY_PROJECTION_SEASON_ID,
    generatedAt,
    source: "official_nhl_roster_plus_player_landing",
    statusSemantics: "new identities default to active_prospect; active-NHL status requires separate evidence",
    decisions,
  };
  const plan = { ...planBody, planChecksum: sha256(planBody) };
  const destination = outputPath();
  fs.writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`);

  const summary = decisions.reduce(
    (counts, decision) => {
      counts[decision.plan.action] += 1;
      return counts;
    },
    { map_existing: 0, create_new: 0, manual_review: 0 },
  );
  const result: Record<string, unknown> = {
    success: true,
    applied: false,
    output: destination,
    planChecksum: plan.planChecksum,
    pendingReviews: pending.length,
    ...summary,
  };

  if (apply) {
    const editorId = editorUserId();
    const automatic = decisions.filter(
      (decision) =>
        decision.officialPlayer && decision.plan.action !== "manual_review",
    );
    const applied = await mapWithConcurrency(automatic, 4, async (decision) =>
      persistSeasonIdentityResolution({
        supabase: client,
        editorUserId: editorId,
        reviewId: decision.review.id,
        action: decision.plan.action as "map_existing" | "create_new",
        reason: `Automated local identity batch ${plan.planChecksum}: ${decision.plan.reason}`,
        fhfhPlayerId: decision.plan.fhfhPlayerId,
        lifecycleStatus: decision.plan.lifecycleStatus,
        officialPlayer: decision.officialPlayer,
      }),
    );
    const receiptBody = {
      schemaVersion: "player-forecast-season-identity-batch-receipt-v1",
      seasonId: FANTASY_PROJECTION_SEASON_ID,
      appliedAt: new Date().toISOString(),
      planChecksum: plan.planChecksum,
      applied,
      manualReviewIds: decisions
        .filter((decision) => decision.plan.action === "manual_review")
        .map((decision) => decision.review.id),
    };
    const receipt = { ...receiptBody, receiptChecksum: sha256(receiptBody) };
    const receiptPath = destination.replace(/\.json$/i, "-receipt.json");
    fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    Object.assign(result, {
      applied: true,
      appliedCount: applied.length,
      receipt: receiptPath,
      receiptChecksum: receipt.receiptChecksum,
    });
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
