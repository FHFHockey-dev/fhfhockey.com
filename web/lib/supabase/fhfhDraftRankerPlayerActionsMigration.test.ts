import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715025809_add_draft_ranker_player_actions.sql",
  ),
  "utf8",
);
const indexMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715030450_add_draft_ranker_player_preference_fk_index.sql",
  ),
  "utf8",
);

describe("Draft Ranker player actions migration", () => {
  it("keeps watchlist state separate from discovery dispositions", () => {
    expect(migrationSql).toContain(
      "create table public.draft_ranker_player_preferences",
    );
    expect(migrationSql).toContain("'dismissed', 'not_relevant'");
    expect(migrationSql).toContain("comparison_requested_at");
    expect(migrationSql).toContain("draft_ranking_watchlist");
  });

  it("enforces owner, ranking, and canonical-player relationships", () => {
    expect(migrationSql).toContain(
      "references public.fhfh_player_identities(id) on delete restrict",
    );
    expect(migrationSql).toContain(
      "references public.draft_rankings(id, user_id) on delete cascade",
    );
    expect(migrationSql).toContain("primary key (ranking_id, fhfh_player_id)");
    expect(indexMigrationSql).toContain(
      "on public.draft_ranker_player_preferences (ranking_id, user_id)",
    );
  });

  it("supports every approved launch action transactionally", () => {
    for (const action of [
      "watch",
      "unwatch",
      "dismiss",
      "not_relevant",
      "restore",
      "compare_now",
    ]) {
      expect(migrationSql).toContain(`'${action}'`);
    }
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain("operation_payload_conflict");
    expect(migrationSql).toContain("idempotentReplay");
    expect(migrationSql).toContain("insert into public.draft_ranking_events");
  });

  it("only permits verified launch-eligible identities", () => {
    expect(migrationSql).toContain("identity.verification_status = 'verified'");
    for (const status of ["active_nhl", "active_prospect", "unsigned_relevant"]) {
      expect(migrationSql).toContain(`'${status}'`);
    }
  });

  it("keeps browser writes behind the service-only invoker RPC", () => {
    expect(migrationSql).toContain("security invoker");
    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql).toMatch(
      /revoke all on public\.draft_ranker_player_preferences from anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant select on public\.draft_ranker_player_preferences to authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /revoke all on function public\.apply_draft_ranker_player_action\([\s\S]+?from public, anon, authenticated;/i,
    );
    expect(migrationSql).toMatch(
      /grant execute on function public\.apply_draft_ranker_player_action\([\s\S]+?to service_role;/i,
    );
  });
});
