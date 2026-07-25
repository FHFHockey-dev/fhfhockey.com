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

  it("queues a bounded canonical v2 upgrade without rewriting old rows", () => {
    expect(migrationSql).toContain(
      "create table if not exists public.sustainability_recompute_queue",
    )
    expect(migrationSql).toContain(
      "alter table public.sustainability_recompute_queue force row level security",
    )
    expect(migrationSql).toContain("'sustainability_score_v2'")
    expect(migrationSql).toContain("'fnv1a_91691726'")
    expect(migrationSql).not.toMatch(
      /delete\s+from\s+public\.(sustainability_scores|sustainability_player_priors)/i,
    )
  })
})
