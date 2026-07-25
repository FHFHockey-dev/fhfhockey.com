import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot =
  path.basename(process.cwd()) === "web"
    ? path.resolve(process.cwd(), "..")
    : process.cwd();

describe("Yahoo player writer permissions", () => {
  it("keeps every global player writer service-role-only", () => {
    const sql = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260723040553_restrict_legacy_yahoo_player_writers.sql",
      ),
      "utf8",
    );

    for (const signature of [
      "public.upsert_players_batch(jsonb[])",
      "public.upsert_players_batch(jsonb)",
      "public.upsert_yahoo_players_v3(jsonb[])",
    ]) {
      expect(sql).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`,
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`,
      );
    }
  });

  it("defines one fail-closed atomic latest and history writer", () => {
    const sql = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260723113533_make_yahoo_player_writer_atomic.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      "create or replace function public.upsert_yahoo_players_atomic(players_data jsonb[])",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toContain("insert into public.yahoo_players");
    expect(sql).toContain("insert into public.yahoo_player_ownership_history");
    expect(sql).toContain(
      "insert into public.yahoo_player_draft_analysis_history",
    );
    expect(sql).toContain("on conflict (player_key, ownership_date)");
    expect(sql).toContain("on conflict (player_key, captured_at)");
    expect(sql).toContain("ownership_omitted_count");
    expect(sql).not.toMatch(/exception\s+when\s+others/i);
    expect(sql).toContain(
      "revoke all on function public.upsert_yahoo_players_atomic(jsonb[])",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain(
      "grant execute on function public.upsert_yahoo_players_atomic(jsonb[])",
    );
    expect(sql).toContain("to service_role");
  });

  it("repairs the draft-history conflict target without weakening the writer", () => {
    const repair = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260725200808_fix_yahoo_player_writer_captured_at.sql",
      ),
      "utf8",
    );

    expect(repair).toContain("pg_get_functiondef(function_oid)");
    expect(repair).toContain("snapshot_captured_at timestamptz");
    expect(repair).toContain(
      "snapshot_captured_at := snapshot_date::timestamp at time zone",
    );
    expect(repair).toContain("execute definition");
    expect(repair).not.toContain("security definer");
    expect(repair).not.toContain("grant execute");
  });

  it("keeps the active route on explicit omission semantics and the atomic writer", () => {
    const source = readFileSync(
      path.join(repoRoot, "web/pages/api/v1/db/update-yahoo-players.ts"),
      "utf8",
    );

    expect(source).toContain('"upsert_yahoo_players_atomic"');
    expect(source).not.toContain('"upsert_yahoo_players_v3"');
    expect(source).toContain('snapshot_status: val == null ? "omitted"');
    expect(source).toContain("ownershipOmitted");
    expect(source).toContain("draftHistoryUpserted");
    expect(source).not.toContain("currentOwnershipValue");
    expect(source).not.toContain('from("yahoo_players")');
  });
});
