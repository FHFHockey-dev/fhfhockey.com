import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260715070405_add_draft_ranker_ordering_repair.sql",
  ),
  "utf8",
);

describe("DR-071 ordering repair migration", () => {
  it("is service-only, invoker-safe, and fixed-search-path", () => {
    expect(sql).toContain(
      "create or replace function public.repair_draft_ranking_ordering",
    );
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).not.toContain("security definer");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("requires exact confirmation, payload idempotency, and a locked version", () => {
    expect(sql).toContain("p_confirmation <> 'NORMALIZE_ORDERING'");
    expect(sql).toContain("operationPayloadHash");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("stale_ranking_version");
  });

  it("normalizes deterministically and writes immutable before/after evidence", () => {
    expect(sql).toContain("row_number() over");
    expect(sql).toContain("::bigint * 1024");
    expect(sql).toContain("insert into public.draft_ranking_events");
    expect(sql).toContain("'admin_repair'");
    expect(sql).toContain("normalize_ordering_noop");
  });
});
