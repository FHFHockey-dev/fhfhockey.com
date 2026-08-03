import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  dedupeYahooPlayerPayloads,
  extractYahooPercentOwned,
  prepareYahooPlayerAtomicPayload,
} from "./playerWriter";

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

  it("keeps the normalized ownership reader staged behind migration application", () => {
    const migration = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260725235646_add_normalized_yahoo_ownership_reader.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create view public.yahoo_players_with_normalized_history",
    );
    expect(migration).toContain("with (security_invoker = true)");
    expect(migration).toContain(
      "from public.yahoo_player_ownership_history as history",
    );
    expect(migration).toContain(
      "where history.player_key = players.player_key",
    );
    expect(migration).toContain(
      "grant select on public.yahoo_players_with_normalized_history",
    );
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)/i);

    for (const relativePath of [
      "web/components/PlayerPickupTable/PlayerPickupTable.tsx",
      "web/lib/draft-ranker/discoveryServer.ts",
      "web/lib/sync/syncYahooPlayersToSheet.ts",
      "web/pages/api/v1/start-chart.ts",
      "web/pages/api/v1/transactions/ownership-snapshots.ts",
      "web/pages/api/v1/transactions/ownership-trends.ts",
      "web/pages/variance/skaters.tsx",
    ]) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(source).toContain('.from("yahoo_players_with_normalized_history")');
      expect(source).toContain("normalized_ownership_timeline");
    }
  });

  it("keeps the hardened Yahoo map reader staged behind migration application", () => {
    const migration = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260726000603_harden_yahoo_read_surfaces.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("alter column player_id set not null");
    expect(migration).toContain(
      "create unique index yahoo_names_player_id_key",
    );
    expect(migration).toContain("create view public.yahoo_nhl_player_map_read");
    expect(migration).toContain("with (security_invoker = true)");
    expect(migration).toContain("from public.yahoo_nhl_player_map as mapping");
    expect(migration).toContain("create policy public_read");
    expect(migration).toContain(
      "drop index if exists public.yahoo_players_player_key_key",
    );
    expect(migration).toContain(
      "yahoo_player_ownership_history_player_key_date_unique",
    );
    expect(migration).toContain(
      "drop index if exists public.ypo_hist_player_date",
    );
    expect(migration).toContain("relation.relname in (");
    expect(migration).toContain("or not relation.relrowsecurity");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toMatch(
      /grant select on table[\s\S]*public\.yahoo_nhl_player_map_mat[\s\S]*to anon, authenticated/,
    );
    expect(migration).not.toMatch(
      /grant\s+(insert|update|delete|truncate|trigger|references|all)/i,
    );

    for (const relativePath of [
      "web/components/PlayerPickupTable/PlayerPickupTable.tsx",
      "web/hooks/useProcessedProjectionsData.tsx",
      "web/pages/api/v1/start-chart.ts",
      "web/pages/api/v1/transactions/ownership-snapshots.ts",
      "web/pages/api/v1/transactions/ownership-trends.ts",
      "web/pages/variance/skaters.tsx",
    ]) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(source).toContain('.from("yahoo_nhl_player_map_read")');
      expect(source).not.toContain('.from("yahoo_nhl_player_map_mat")');
    }
  });

  it("reconciles complete player-key snapshots atomically and service-only", () => {
    const sql = readFileSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260725220704_reconcile_yahoo_player_key_snapshots.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      "create or replace function public.replace_yahoo_player_keys_snapshot",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("Yahoo snapshot must contain players.");
    expect(sql).toContain("Yahoo snapshot player rows are invalid.");
    expect(sql).toContain("and not exists");
    expect(sql).toContain("is_active = false");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/exception\s+when\s+others/i);
  });

  it("keeps the active route on explicit omission semantics and the atomic writer", () => {
    const source = readFileSync(
      path.join(repoRoot, "web/pages/api/v1/db/update-yahoo-players.ts"),
      "utf8",
    );
    const writer = readFileSync(
      path.join(repoRoot, "web/lib/integrations/yahoo/playerWriter.ts"),
      "utf8",
    );

    expect(writer).toContain('"upsert_yahoo_players_atomic"');
    expect(source).not.toContain('"upsert_yahoo_players_v3"');
    expect(writer).not.toContain('"upsert_yahoo_players_v3"');
    expect(source).toContain("prepareYahooPlayerAtomicPayload");
    expect(source).toContain("persistYahooPlayerPayloadBatch");
    expect(source).toContain("ownershipOmitted");
    expect(source).toContain("draftHistoryUpserted");
    expect(source).toContain("fetchCompleteYahooPlayerKeySnapshot");
    expect(source).toContain('"replace_yahoo_player_keys_snapshot"');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).not.toContain("currentOwnershipValue");
    expect(source).not.toContain('from("yahoo_players")');
    expect(writer).not.toContain('"upsert_yahoo_players_atomic" as any');
  });

  it("keeps generated RPC typing aligned with Production", () => {
    const generatedTypes = readFileSync(
      path.join(repoRoot, "web/lib/supabase/database-generated.types.ts"),
      "utf8",
    );

    expect(generatedTypes).toContain("upsert_yahoo_players_atomic: {");
    expect(generatedTypes).toContain("replace_yahoo_player_keys_snapshot: {");
    expect(generatedTypes).toContain("Args: { players_data: Json[] }");
    expect(generatedTypes).toContain("Returns: Json");
  });

  it("normalizes Yahoo response shapes and preserves genuine zero ownership", () => {
    expect(extractYahooPercentOwned([{ value: "0" }])).toBe(0);
    expect(extractYahooPercentOwned({ Value: "37.5" })).toBe(37.5);
    expect(extractYahooPercentOwned("12")).toBe(12);
    expect(extractYahooPercentOwned(null)).toBeNull();

    const observed = prepareYahooPlayerAtomicPayload(
      {
        player_key: "465.p.1",
        name: { full: "Observed Player" },
        percent_owned: [{ value: "0" }],
        draft_analysis: { average_pick: "12.5" },
      },
      "2026-07-25",
      "465",
      2025,
    );
    const omitted = prepareYahooPlayerAtomicPayload(
      { player_key: "465.p.2", name: { full: "Omitted Player" } },
      "2026-07-25",
      "465",
      2025,
    );

    expect(observed).toMatchObject({
      average_draft_pick: 12.5,
      percent_ownership: 0,
      snapshot_status: "observed",
    });
    expect(omitted).toMatchObject({
      percent_ownership: null,
      snapshot_status: "omitted",
    });
  });

  it("deduplicates only exact canonical player keys and keeps the last row", () => {
    const first = prepareYahooPlayerAtomicPayload(
      { player_key: "465.p.1", percent_owned: 10 },
      "2026-07-25",
    );
    const replacement = prepareYahooPlayerAtomicPayload(
      { player_key: "465.p.1", percent_owned: 20 },
      "2026-07-25",
    );
    const otherSeason = prepareYahooPlayerAtomicPayload(
      { player_key: "475.p.1", percent_owned: 30 },
      "2026-07-25",
    );

    expect(
      dedupeYahooPlayerPayloads([first, replacement, otherSeason]).map(
        ({ player_key, percent_ownership }) => ({
          player_key,
          percent_ownership,
        }),
      ),
    ).toEqual([
      { player_key: "465.p.1", percent_ownership: 20 },
      { player_key: "475.p.1", percent_ownership: 30 },
    ]);
  });

  it("keeps the Python maintenance writer opt-in and on the canonical contract", () => {
    const source = readFileSync(
      path.join(repoRoot, "web/lib/supabase/Upserts/Yahoo/yahooAPI.py"),
      "utf8",
    );

    expect(source).toContain(
      'os.getenv("YAHOO_PLAYER_MAINTENANCE_WRITE_ENABLED") != "1"',
    );
    expect(source).toContain('"upsert_yahoo_players_atomic"');
    expect(source).toContain('"snapshot_status": "observed"');
    expect(source).toContain('"current_date": current_date');
    expect(source).not.toContain("upsert_players_batch");
    expect(source).not.toContain('.table("yahoo_players").upsert');
    expect(source).not.toContain('ENV_FILE = "/Users/');
    expect(source.indexOf("supabase: Client = create_client")).toBeGreaterThan(
      source.indexOf("def main"),
    );
  });

  it("keeps legacy Yahoo metadata and player-key scripts opt-in and environment-owned", () => {
    for (const relativePath of [
      "web/lib/supabase/Upserts/Yahoo/yahooAPIgameIds.py",
      "web/lib/supabase/Upserts/Yahoo/yahooApiPlayerKeys.py",
    ]) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");

      expect(source).toContain(
        'LEGACY_WRITER_FLAG = "YAHOO_LEGACY_PYTHON_WRITER_ENABLED"',
      );
      expect(source).toContain(
        'if os.getenv(LEGACY_WRITER_FLAG) != "1":',
      );
      expect(source).not.toContain("/Users/tim/");
      expect(source).not.toMatch(/GAME_ID\s*=\s*["']465["']/);
      expect(source).not.toMatch(/LEAGUE_ID\s*=\s*["']858["']/);
      expect(source).not.toContain("save_access_token_data_to_env_file(");
      expect(source.indexOf("create_client(")).toBeGreaterThan(
        source.indexOf("def main"),
      );
      expect(source.indexOf("YahooFantasySportsQuery(")).toBeGreaterThan(
        source.indexOf("def main"),
      );
    }
  });
});
