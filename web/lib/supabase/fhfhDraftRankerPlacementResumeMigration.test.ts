import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715034601_enforce_single_active_draft_placement.sql",
  ),
  "utf8",
);

describe("Draft Ranker single active placement migration", () => {
  it("enforces one resumable active session per ranking", () => {
    expect(migration).toContain(
      "create unique index draft_placement_one_active_per_ranking",
    );
    expect(migration).toMatch(
      /on public\.draft_ranker_placement_sessions \(ranking_id\)[\s\S]*where status = 'active'/u,
    );
  });

  it("expires elapsed sessions before checking the active invariant", () => {
    expect(migration).toMatch(
      /set status = 'expired', completed_at = statement_timestamp\(\)[\s\S]*status = 'active'[\s\S]*expires_at <= statement_timestamp\(\)/u,
    );
    expect(migration).toContain(
      "Multiple active placement sessions must be resolved before enforcing ranking uniqueness",
    );
  });

  it("returns the existing ranking-level session instead of inserting another", () => {
    expect(migration).toMatch(
      /where session\.ranking_id = p_ranking_id[\s\S]*session\.status = 'active'/u,
    );
    expect(migration).toContain("'code', 'active_placement_exists'");
    expect(migration).toContain("'sessionId', v_active_session");
    expect(migration).toContain("'playerId', v_active_player");
  });

  it("serializes starts on the owner ranking and preserves service-only invoker access", () => {
    expect(migration).toMatch(
      /where ranking\.id = p_ranking_id[\s\S]*ranking\.user_id = p_user_id[\s\S]*for update/u,
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toMatch(
      /revoke all on function public\.begin_draft_ranker_placement[\s\S]*from public, anon, authenticated/u,
    );
    expect(migration).toMatch(
      /grant execute on function public\.begin_draft_ranker_placement[\s\S]*to service_role/u,
    );
  });
});
