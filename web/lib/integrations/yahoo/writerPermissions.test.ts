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
});
