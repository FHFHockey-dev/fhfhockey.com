import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715011329_create_draft_ranker_ownership_foundation.sql",
  ),
  "utf8",
);
const indexMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715011557_add_draft_ranker_foreign_key_indexes.sql",
  ),
  "utf8",
);

const ownedTables = [
  "draft_rankings",
  "draft_ranking_entries",
  "draft_ranking_events",
  "draft_ranking_seed_runs",
  "draft_ranking_watchlist",
  "draft_ranker_contribution_preferences",
  "draft_ranker_pair_prompts",
  "draft_ranker_pair_comparisons",
  "draft_ranker_pair_preferences",
  "draft_ranker_placement_sessions",
] as const;

describe("draft-ranker ownership foundation migration", () => {
  it("creates the ten approved owner/evidence tables additively", () => {
    for (const table of ownedTables) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }

    expect(migrationSql).not.toMatch(/\b(?:drop|truncate)\s+table\b/i);
    expect(migrationSql).not.toContain("community_draft_rankings");
  });

  it("pins account ownership and account-deletion cascades", () => {
    expect(migrationSql).toContain(
      "user_id uuid not null references auth.users(id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "constraint draft_rankings_owner_key unique (id, user_id)",
    );
    expect(migrationSql.match(/references public\.draft_rankings\(id, user_id\) on delete cascade/g)).toHaveLength(5);
    expect(migrationSql.match(/references public\.draft_rankings\(id, user_id, target_season_id\) on delete cascade/g)).toHaveLength(3);
  });

  it("uses sparse continuous ordering and a derived cutoff", () => {
    expect(migrationSql).toContain("order_key bigint not null");
    expect(migrationSql).toContain(
      "constraint draft_entries_order_unique unique (ranking_id, order_key)",
    );
    expect(migrationSql).not.toMatch(/\b(?:is_top_250|top_250|candidate_rank)\b/i);
  });

  it("enforces canonical, season-consistent prompt and comparison evidence", () => {
    expect(migrationSql.match(/check \(low_player_id < high_player_id\)/g)).toHaveLength(3);
    expect(migrationSql).toContain("outcome in ('low', 'high', 'too_close', 'skip')");
    expect(migrationSql).toContain(
      "constraint draft_pair_comps_operation_unique unique (user_id, client_operation_id)",
    );
    expect(migrationSql).toContain(
      "references public.draft_rankings(id, user_id, target_season_id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "references public.draft_ranker_pair_prompts (",
    );
    expect(migrationSql).toContain(
      "references public.draft_ranker_pair_comparisons (",
    );
  });

  it("enables owner RLS and denies every anonymous table privilege", () => {
    for (const table of ownedTables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migrationSql).toContain(
        `revoke all on public.${table} from anon, authenticated;`,
      );
      expect(migrationSql).toContain(
        `grant all on public.${table} to service_role;`,
      );
    }

    expect(migrationSql.match(/\(\(select auth\.uid\(\)\) = user_id\)/g)).toHaveLength(26);
    expect(migrationSql).not.toMatch(/grant\s+\w+(?:,\s*\w+)*\s+on\s+public\.[^;]+\s+to\s+anon/i);
  });

  it("keeps every direct browser table mutation behind the API or a reviewed RPC", () => {
    for (const table of ownedTables) {
      expect(migrationSql).toContain(
        `grant select on public.${table} to authenticated;`,
      );
      expect(migrationSql).not.toMatch(
        new RegExp(
          `grant[^;]*(?:insert|update|delete)[^;]*on public\\.${table}[^;]*to authenticated`,
          "i",
        ),
      );
    }
  });

  it("introduces no privileged or publicly executable function", () => {
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).toContain("set search_path = pg_catalog, public");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toContain(
      "revoke all on function public.set_draft_ranker_updated_at() from public, anon, authenticated;",
    );
  });

  it("keeps every migration-defined identifier within PostgreSQL's limit", () => {
    const identifiers = Array.from(
      migrationSql.matchAll(
        /(?:constraint|index|policy|trigger|function)\s+(?:public\.)?([a-z][a-z0-9_]*)/gi,
      ),
      (match) => match[1],
    );

    expect(identifiers.length).toBeGreaterThan(0);
    for (const identifier of identifiers) {
      expect(identifier.length, identifier).toBeLessThanOrEqual(63);
    }
  });

  it("covers every foreign key reported by the post-apply advisor", () => {
    expect(indexMigrationSql.match(/create index /g)).toHaveLength(20);
    for (const indexName of [
      "draft_rankings_target_season_fk",
      "draft_entries_ranking_owner_fk",
      "draft_events_ranking_owner_fk",
      "draft_seed_runs_source_season_fk",
      "draft_seed_runs_ranking_owner_fk",
      "draft_watchlist_ranking_owner_fk",
      "draft_pair_prompts_ranking_owner_fk",
      "draft_pair_prompts_low_player_fk",
      "draft_pair_prompts_high_player_fk",
      "draft_pair_comps_prompt_fk",
      "draft_pair_comps_ranking_owner_fk",
      "draft_pair_comps_low_player_fk",
      "draft_pair_comps_high_player_fk",
      "draft_pair_prefs_comparison_fk",
      "draft_pair_prefs_ranking_owner_fk",
      "draft_pair_prefs_low_player_fk",
      "draft_pair_prefs_high_player_fk",
      "draft_pair_prefs_preferred_player_fk",
      "draft_placement_ranking_owner_fk",
      "draft_placement_player_fk",
    ]) {
      expect(indexMigrationSql).toContain(`create index ${indexName}`);
      expect(indexName.length, indexName).toBeLessThanOrEqual(63);
    }
  });
});
