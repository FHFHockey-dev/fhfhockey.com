import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260813015112_yahoo_live_draft_companion.sql",
  ),
  "utf8",
);

const draftTables = ["yahoo_draft_sessions", "yahoo_draft_picks"] as const;
const serviceRpcs = [
  "claim_yahoo_draft_poll",
  "apply_yahoo_draft_snapshot",
  "record_yahoo_draft_poll_failure",
] as const;

describe("Yahoo live-draft companion migration", () => {
  it("creates owner-scoped sessions and authoritative pick slots", () => {
    for (const table of draftTables) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }

    expect(migrationSql).toContain(
      "constraint yahoo_draft_sessions_owner_key unique (id, user_id)",
    );
    expect(migrationSql).toContain("unique (user_id, yahoo_league_key)");
    expect(migrationSql).toContain(
      "references public.connected_accounts(id, user_id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "references public.external_leagues(id, user_id) on delete cascade",
    );
    expect(migrationSql.match(/references public\.external_teams\(id, user_id\) on delete cascade/g)).toHaveLength(2);
    expect(migrationSql).toContain(
      "references public.draft_rankings(id, user_id, target_season_id)",
    );
    expect(migrationSql).toContain(
      "references public.yahoo_draft_sessions(id, user_id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "references public.fhfh_player_identities(id) on delete set null",
    );
    expect(migrationSql).toContain(
      "target_season_id bigint not null references public.seasons(id) on delete restrict",
    );
    expect(migrationSql).toContain(
      "constraint provider_sync_runs_owner_key unique (id, user_id)",
    );
    expect(migrationSql).toContain(
      "references public.provider_sync_runs(id, user_id) on delete restrict",
    );
    expect(migrationSql).toContain(
      "normalized_settings jsonb not null default '{}'::jsonb",
    );
    expect(migrationSql).toContain(
      "diagnostics jsonb not null default '{}'::jsonb",
    );
    expect(migrationSql).toContain(
      "constraint yahoo_draft_picks_pkey primary key (session_id, pick_number)",
    );
  });

  it("exposes owner reads only and forces RLS on both Realtime tables", () => {
    for (const table of draftTables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migrationSql).toContain(
        `alter table public.${table} force row level security;`,
      );
      expect(migrationSql).toContain(
        `grant select on table public.${table} to authenticated;`,
      );
      expect(migrationSql).not.toMatch(
        new RegExp(
          `grant[^;]*(?:insert|update|delete)[^;]*public\\.${table}[^;]*to authenticated`,
          "i",
        ),
      );
    }

    expect(migrationSql.match(/using \(\(select auth\.uid\(\)\) = user_id\);/g)).toHaveLength(2);
    expect(migrationSql).not.toMatch(/create policy[^;]+for (?:insert|update|delete)/i);
  });

  it("publishes only the two companion tables added by this migration", () => {
    const publicationTables = Array.from(
      migrationSql.matchAll(
        /alter publication supabase_realtime\s+add table public\.([a-z_]+);/g,
      ),
      (match) => match[1],
    );

    expect(publicationTables).toEqual([
      "yahoo_draft_sessions",
      "yahoo_draft_picks",
    ]);
    expect(migrationSql).toContain(
      "YAHOO_DRAFT_REALTIME_PUBLICATION_MISSING",
    );
  });

  it("keeps every polling RPC service-role-only and invoker-secured", () => {
    for (const rpc of serviceRpcs) {
      expect(migrationSql).toContain(`create function public.${rpc}(`);
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on function public\\.${rpc}\\([\\s\\S]*?\\) from public, anon, authenticated, service_role;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${rpc}\\([\\s\\S]*?\\) to service_role;`,
        ),
      );
    }

    expect(migrationSql).not.toContain("security definer");
    expect(migrationSql.match(/security invoker/g)).toHaveLength(4);
    expect(migrationSql.match(/set search_path = ''/g)).toHaveLength(4);
  });

  it("claims one due poll with a bounded expiring lease", () => {
    expect(migrationSql).toContain("p_lease_seconds integer default 30");
    expect(migrationSql).toContain("p_lease_seconds < 5");
    expect(migrationSql).toContain("p_lease_seconds > 120");
    expect(migrationSql).toContain("session.next_poll_at <= p_claimed_at");
    expect(migrationSql).toContain(
      "session.poll_lease_expires_at <= p_claimed_at",
    );
    expect(migrationSql).toContain(
      "poll_lease_token = pg_catalog.gen_random_uuid()",
    );
    expect(migrationSql.match(/YAHOO_DRAFT_POLL_LEASE_LOST/g)).toHaveLength(2);
  });

  it("treats changed full snapshots as authoritative without version churn", () => {
    expect(migrationSql).toContain(
      "snapshot_changed := locked_session.snapshot_hash is distinct from p_snapshot_hash;",
    );
    expect(migrationSql).toContain("if snapshot_changed then");
    expect(migrationSql).toContain(
      "next_snapshot_version := locked_session.snapshot_version + 1;",
    );
    expect(migrationSql).toMatch(/set\s+is_active = false/);
    expect(migrationSql).toContain(
      "revision = public.yahoo_draft_picks.revision + 1",
    );
    expect(migrationSql).toContain("revision = existing.revision + 1");
    expect(migrationSql).toContain(
      "Monotonic material-state revision; pure re-observation does not increment it.",
    );
    expect(migrationSql).toContain("pick_in_round integer not null");
    expect(migrationSql).toContain("mapping_status text not null");
    expect(migrationSql).toContain("is_correction boolean not null default false");
    expect(migrationSql).toContain(
      "where current_pick.pick_number = existing.pick_number",
    );
    expect(migrationSql).not.toMatch(/delete from public\.yahoo_draft_picks/i);
    expect(migrationSql).toContain("'changed', snapshot_changed");
    expect(migrationSql).toContain("'deactivatedPickCount'");
  });

  it("indexes every owner foreign key and polling path", () => {
    for (const indexName of [
      "yahoo_draft_sessions_account_owner_idx",
      "yahoo_draft_sessions_league_owner_idx",
      "yahoo_draft_sessions_team_owner_idx",
      "yahoo_draft_sessions_ranking_owner_idx",
      "yahoo_draft_sessions_target_season_idx",
      "yahoo_draft_sessions_sync_run_idx",
      "yahoo_draft_sessions_user_status_idx",
      "yahoo_draft_sessions_poll_due_idx",
      "yahoo_draft_picks_session_owner_idx",
      "yahoo_draft_picks_user_session_idx",
      "yahoo_draft_picks_team_owner_idx",
      "yahoo_draft_picks_player_idx",
    ]) {
      expect(migrationSql).toContain(`create index ${indexName}`);
    }
  });

  it("keeps every migration identifier within PostgreSQL's limit", () => {
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
});
