import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../supabase/migrations/20260721013821_enforce_shift_relationship_positions.sql",
  ),
  "utf8",
).toLowerCase();

describe("shift relationship position migration", () => {
  it("wraps the additive constraint in one bounded transaction", () => {
    expect(migration.trimStart()).toContain("begin;");
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("set lock_timeout = '5s'");
    expect(migration).toContain("set statement_timeout = '60s'");
  });

  it("enforces complete canonical position metadata on relationship-column writes", () => {
    expect(migration).toContain(
      "function public.enforce_shift_relationship_position_complete_v1()",
    );
    expect(migration).toContain("new.shifts is not null");
    expect(migration).toContain("new.display_position is null");
    expect(migration).toContain(
      "new.display_position !~ '^(c|lw|rw|d|g)(,(c|lw|rw|d|g))*$'",
    );
    expect(migration).toContain("new.primary_position is null");
    expect(migration).toContain(
      "new.primary_position not in ('c', 'lw', 'rw', 'd', 'g')",
    );
    expect(migration).toContain("new.player_type is null");
    expect(migration).toContain("new.player_type not in ('f', 'd', 'g')");
    expect(migration).toContain("new.player_type is distinct from case");
    expect(migration).toContain(
      "string_to_array(new.display_position, ',')",
    );
    expect(migration).toContain("count(distinct displayed.position)");
    expect(migration).toContain(
      "before insert or update of\n  shifts,\n  display_position,\n  primary_position,\n  player_type",
    );
  });

  it("preserves unrelated legacy updates and exposes no callable helper", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.enforce_shift_relationship_position_complete_v1()",
    );
    expect(migration).not.toContain("alter table public.shift_charts");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("update public.shift_charts");
  });
});
