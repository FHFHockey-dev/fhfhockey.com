import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260815023132_espn_fantasy_private_beta.sql",
  ),
  "utf8",
);

const tables = [
  "external_league_state_snapshots",
  "espn_draft_sessions",
  "espn_draft_picks",
] as const;

const serviceRpcs = [
  "commit_espn_connection_secure",
  "apply_espn_settings_secure",
  "disconnect_espn_account_secure",
  "delete_espn_league_secure",
  "claim_espn_draft_poll",
  "claim_espn_sync_lease",
  "apply_espn_draft_snapshot",
  "record_espn_draft_poll_failure",
] as const;

describe("ESPN Fantasy private-beta migration", () => {
  it("stores one current minimized snapshot and owner-scoped draft state", () => {
    for (const table of tables) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }
    expect(migrationSql).toContain("unique (external_league_id)");
    expect(migrationSql).toContain(
      "Latest normalized provider league state; no raw provider payload history.",
    );
    expect(migrationSql).toContain("normalized_state jsonb not null");
    expect(migrationSql).toContain("sync_cursor jsonb not null");
    expect(migrationSql).toContain(
      "constraint espn_draft_picks_pkey primary key (session_id, pick_number)",
    );
    expect(migrationSql).toContain("external_pick_key text not null");
    expect(migrationSql).toContain("is_keeper boolean not null");
    expect(migrationSql).toContain("bid_amount numeric(10, 2)");
    expect(migrationSql).toContain("is_correction boolean not null");
    expect(migrationSql).toContain("mapping_status text not null");
  });

  it("cascades provider cleanup while preserving copied user settings", () => {
    expect(migrationSql).toContain(
      "references public.external_leagues(id, user_id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "references public.connected_accounts(id, user_id) on delete cascade",
    );
    expect(migrationSql).toContain(
      "references public.espn_draft_sessions(id, user_id) on delete cascade",
    );
    expect(migrationSql).toMatch(
      /create function public\.disconnect_espn_account_secure[\s\S]*?update public\.user_settings[\s\S]*?'source_type', 'manual'[\s\S]*?delete from public\.connected_accounts/,
    );
    expect(migrationSql).not.toMatch(
      /create function public\.disconnect_espn_account_secure[\s\S]*?delete from public\.user_settings[\s\S]*?\$function\$/,
    );
  });

  it("forces owner-read RLS with explicit grants and service-only mutation", () => {
    for (const table of tables) {
      expect(migrationSql).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migrationSql).toContain(
        `alter table public.${table} force row level security;`,
      );
      expect(migrationSql).toContain(
        `grant select on table public.${table} to authenticated;`,
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant select, insert, update, delete\\s+on table public\\.${table} to service_role;`,
        ),
      );
      expect(migrationSql).not.toMatch(
        new RegExp(
          `grant[^;]*(?:insert|update|delete)[^;]*public\\.${table}[^;]*to authenticated`,
          "i",
        ),
      );
    }
    expect(
      migrationSql.match(/using \(\(select auth\.uid\(\)\) = user_id\);/g),
    ).toHaveLength(3);
  });

  it("uses Vault token RPCs and exposes sanitized service-role-only transactions", () => {
    expect(migrationSql).toContain("perform public.upsert_connected_account_tokens_secure(");
    expect(migrationSql).toContain("'espn_session_cookies_v1'");
    expect(migrationSql).toContain("'credential_fields'");

    for (const rpc of serviceRpcs) {
      expect(migrationSql).toContain(`create function public.${rpc}(`);
      expect(migrationSql).toMatch(
        new RegExp(
          `revoke all on function public\\.${rpc}\\([\\s\\S]*?\\) from public, anon, authenticated(?:, service_role)?;`,
        ),
      );
      expect(migrationSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${rpc}\\([\\s\\S]*?\\) to service_role;`,
        ),
      );
    }
  });

  it("upgrades a manual-only ESPN card without counting fallback leagues toward the beta cap", () => {
    expect(migrationSql).toMatch(
      /account\.provider = 'espn'[\s\S]*?account\.provider_user_id is null[\s\S]*?for update;/,
    );
    expect(migrationSql).toContain("'api_linked', true");
    expect(migrationSql).toContain("'credentials_stored', true");
    expect(migrationSql).toContain("'[\"manual_import\",\"api\"]'::jsonb");
    expect(migrationSql).toContain(
      "league.league_metadata @> '{\"api_sync_enabled\":true}'::jsonb",
    );
  });

  it("bounds leases and reconciles corrected and removed picks transactionally", () => {
    expect(migrationSql).toContain("p_lease_seconds < 5 or p_lease_seconds > 120");
    expect(migrationSql).toContain("p_lease_seconds < 30 or p_lease_seconds > 600");
    expect(migrationSql).toContain("provider_sync_runs_espn_active_lease_idx");
    expect(migrationSql).toContain("ESPN_DRAFT_POLL_LEASE_LOST");
    expect(migrationSql).toContain(
      "revision = public.espn_draft_picks.revision + 1",
    );
    expect(migrationSql).toContain("set is_active = false");
    expect(migrationSql).toContain(
      "where current_pick.pick_number = existing.pick_number",
    );
    expect(migrationSql).not.toMatch(/delete from public\.espn_draft_picks/i);
  });

  it("publishes only draft state for authenticated Realtime reads", () => {
    const publicationTables = Array.from(
      migrationSql.matchAll(
        /alter publication supabase_realtime\s+add table public\.([a-z_]+);/g,
      ),
      (match) => match[1],
    );
    expect(publicationTables).toEqual([
      "espn_draft_sessions",
      "espn_draft_picks",
    ]);
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
