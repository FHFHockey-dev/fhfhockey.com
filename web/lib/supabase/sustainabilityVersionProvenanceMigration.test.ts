import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260725223034_add_sustainability_version_provenance.sql",
  ),
  "utf8",
)

describe("Sustainability version provenance migration", () => {
  it("preserves legacy history and stamps canonical score/prior rows", () => {
    expect(migrationSql).toContain("components ->> 'modelVersion'")
    expect(migrationSql).toContain("components ->> 'configHash'")
    expect(migrationSql).toContain("'legacy_unversioned'")
    expect(migrationSql).toMatch(
      /alter table public\.sustainability_scores[\s\S]+model_version text[\s\S]+config_hash text/,
    )
    expect(migrationSql).toMatch(
      /alter table public\.sustainability_player_priors[\s\S]+model_version text[\s\S]+config_hash text/,
    )
  })

  it("keeps configuration activation transactional and service-only", () => {
    expect(migrationSql).toContain(
      "create or replace function public.activate_sustainability_config",
    )
    expect(migrationSql).toContain("security invoker")
    expect(migrationSql).toContain("set search_path = pg_catalog")
    expect(migrationSql).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(migrationSql).toContain("config revision must advance exactly once")
    expect(migrationSql).toMatch(
      /revoke all on function public\.activate_sustainability_config[\s\S]+from public, anon, authenticated/,
    )
    expect(migrationSql).toMatch(
      /grant execute on function public\.activate_sustainability_config[\s\S]+to service_role/,
    )
  })

  it("bootstraps the legacy revision only for a data-free baseline replay", () => {
    expect(migrationSql).toContain("'legacy_draft_v1'")
    expect(migrationSql).toContain("'legacy_unversioned'")
    expect(migrationSql).toMatch(
      /insert into public\.model_sustainability_config[\s\S]+select\s+1,[\s\S]+where not exists \(\s+select 1\s+from public\.model_sustainability_config\s+\);/,
    )
  })

  it("queues a bounded canonical v2 upgrade without rewriting old rows", () => {
    expect(migrationSql).toContain(
      "create table if not exists public.sustainability_recompute_queue",
    )
    expect(migrationSql).toContain(
      "alter table public.sustainability_recompute_queue force row level security",
    )
    expect(migrationSql).toContain(
      "create or replace function public.claim_sustainability_recompute_queue",
    )
    expect(migrationSql).toContain("for update skip locked")
    expect(migrationSql).toContain(
      "create or replace function public.advance_sustainability_recompute_queue",
    )
    expect(migrationSql).toContain("next_attempt_at")
    expect(migrationSql).toContain(
      "create or replace function public.finalize_sustainability_score_snapshot",
    )
    expect(migrationSql).toContain("ntile(5)")
    expect(migrationSql).toContain("percentile_cont(0.80)")
    expect(migrationSql).toMatch(
      /revoke all on function public\.finalize_sustainability_score_snapshot[\s\S]+from public, anon, authenticated/,
    )
    expect(migrationSql).toMatch(
      /grant execute on function public\.finalize_sustainability_score_snapshot[\s\S]+to service_role/,
    )
    expect(migrationSql).toContain("'sustainability_score_v2'")
    expect(migrationSql).toContain("'fnv1a_91691726'")
    expect(migrationSql).not.toMatch(
      /delete\s+from\s+public\.(sustainability_scores|sustainability_player_priors)/i,
    )
  })

  it("persists canonical distributions and bounded score quintiles service-only", () => {
    expect(migrationSql).toContain(
      "create table if not exists public.sustainability_distribution_snapshots",
    )
    expect(migrationSql).toContain("sustainability_quintile smallint")
    expect(migrationSql).toContain(
      "sustainability_quintile between 0 and 4",
    )
    expect(migrationSql).toMatch(
      /revoke all on table public\.sustainability_distribution_snapshots[\s\S]+from public, anon, authenticated/,
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update on table public\.sustainability_distribution_snapshots[\s\S]+to service_role/,
    )
  })
})
