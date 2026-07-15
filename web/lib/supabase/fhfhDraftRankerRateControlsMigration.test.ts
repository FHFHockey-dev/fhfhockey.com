import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715050418_add_draft_ranker_pairwise_rate_controls.sql",
  ),
  "utf8",
);

describe("Draft Ranker pairwise rate-controls migration", () => {
  it("stores distributed decisions without IP addresses or request secrets", () => {
    expect(migrationSql).toContain("draft_ranker_pairwise_rate_events");
    expect(migrationSql).toContain("draft_pair_rate_operation_unique");
    expect(migrationSql).not.toMatch(
      /\bip_address\b|\buser_agent\b|authorization_header/i,
    );
    expect(migrationSql).toContain("on delete cascade");
  });

  it("serializes quotas and makes retries payload-safe", () => {
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("operation_payload_hash");
    expect(migrationSql).toContain("idempotency_conflict");
    expect(migrationSql).toContain("idempotentReplay");
  });

  it("hard-limits queues and response bursts with retry metadata", () => {
    expect(migrationSql).toContain("queue_hour_limit");
    expect(migrationSql).toContain("queue_day_limit");
    expect(migrationSql).toContain("response_minute_limit");
    expect(migrationSql).toContain("response_hour_limit");
    expect(migrationSql).toContain("retryAfterSeconds");
  });

  it("suppresses only community evidence for soft moderation decisions", () => {
    expect(migrationSql).toContain("community_collection_disabled");
    expect(migrationSql).toContain("automated_burst");
    expect(migrationSql).toContain("repeated_pair_targeting");
    expect(migrationSql).toContain("community_eligible = coalesce");
    expect(migrationSql).toContain("communityIneligibleReason");
    expect(migrationSql).toContain(
      "submit_draft_ranker_pair_comparison_guarded",
    );
  });

  it("keeps the operational table and invoker functions service-only", () => {
    expect(migrationSql).toContain("enable row level security");
    expect(migrationSql).toContain("draft_pair_rate_no_client_access");
    expect(migrationSql.match(/security invoker/g)).toHaveLength(3);
    expect(migrationSql).not.toContain("security definer");
    expect(
      migrationSql.match(/from public, anon, authenticated;/g),
    ).toHaveLength(4);
    expect(
      migrationSql.match(/grant execute on function[\s\S]*?to service_role;/g),
    ).toHaveLength(3);
  });

  it("documents a rollback that preserves personal ranking evidence", () => {
    expect(migrationSql).toContain(
      "Existing prompts, comparisons, preferences",
    );
    expect(migrationSql).toContain("personal order");
  });
});
