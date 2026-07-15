import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715061931_create_draft_ranker_community_snapshots.sql",
  ),
  "utf8",
);
const indexSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715062048_add_draft_ranker_community_foreign_key_indexes.sql",
  ),
  "utf8",
);

describe("DR-061 Community Ranking snapshot migrations", () => {
  it("creates aggregate snapshots plus a separate service-only moderation list", () => {
    for (const table of [
      "draft_ranker_community_refresh_runs",
      "draft_ranker_community_snapshots",
      "draft_ranker_community_player_results",
      "draft_ranker_community_moderation_exclusions",
    ]) {
      expect(migrationSql).toContain(`create table public.${table}`);
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migrationSql).toContain(
        `revoke all on public.${table} from public, anon, authenticated`,
      );
      expect(migrationSql).toContain(
        `grant all on public.${table} to service_role`,
      );
    }
    const resultTable = migrationSql.slice(
      migrationSql.indexOf(
        "create table public.draft_ranker_community_player_results",
      ),
      migrationSql.indexOf(
        "create table public.draft_ranker_community_moderation_exclusions",
      ),
    );
    expect(resultTable).not.toContain("user_id");
  });

  it("pins evidence states, conservative admission, prior state, and history metadata", () => {
    expect(migrationSql).toContain(
      "evidence_state in ('market_seeded', 'building', 'emerging', 'established')",
    );
    expect(migrationSql).toContain(
      "prior_state in ('market_ranked', 'previously_undrafted')",
    );
    expect(migrationSql).toContain("stability_buffer_ranks integer not null");
    expect(migrationSql).toContain("conservative_rank integer not null");
    expect(migrationSql).toContain("previous_public_rank integer null");
    expect(migrationSql).toContain("rank_delta integer null");
    expect(migrationSql).toContain("model_version text not null");
  });

  it("publishes atomically, idempotently, and only through a service-role invoker RPC", () => {
    expect(migrationSql).toContain(
      "create or replace function public.replace_draft_ranker_community_snapshot",
    );
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toContain("set search_path = pg_catalog, public");
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("idempotency_conflict");
    expect(migrationSql).toContain("sourceReplay");
    expect(migrationSql).toContain("from public, anon, authenticated");
    expect(migrationSql).toContain("to service_role");
  });

  it("covers every advisor-reported Community foreign key", () => {
    for (const index of [
      "draft_community_results_snapshot_season_fk",
      "draft_community_exclusions_user_fk",
      "draft_community_exclusions_comparison_fk",
      "draft_community_exclusions_low_player_fk",
      "draft_community_exclusions_high_player_fk",
    ]) {
      expect(indexSql).toContain(`create index ${index}`);
    }
  });

  it("documents a kill-switch rollback that preserves personal evidence", () => {
    expect(migrationSql).toContain("disable COMMUNITY_DRAFT_RANKINGS_ENABLED");
    expect(migrationSql).toContain("Raw personal rankings and comparisons are");
    expect(migrationSql).toContain("publish a corrected");
  });
});
