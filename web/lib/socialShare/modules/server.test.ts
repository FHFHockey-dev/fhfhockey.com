import { describe, expect, it, vi } from "vitest";
import { loadPostSnapshot } from "./server";
import { SharePostRequestError } from "./contract";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));
const now = () => new Date("2026-10-31T16:00:00Z");
/** Exact-count PostgREST fake: one page per table, or a failing table. */
const client = (tables: Record<string, unknown[] | "fail">) => ({
  from: (table: string) => {
    const result = () => tables[table] === "fail" ? { data: null, error: new Error("nope"), count: null } : { data: tables[table], error: null, count: (tables[table] as unknown[]).length };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "order", "in"]) builder[method] = () => builder;
    builder.range = () => Promise.resolve(result());
    return builder;
  },
});

describe("post snapshots", () => {
  it("refuses unknown posts and invalid settings before reading", async () => {
    const from = vi.fn();
    await expect(loadPostSnapshot("nope", {}, { from }, now)).rejects.toMatchObject({ status: 404 });
    await expect(loadPostSnapshot("../x", {}, { from }, now)).rejects.toBeInstanceOf(SharePostRequestError);
    await expect(loadPostSnapshot("team-games", { days: "31" }, { from }, now)).rejects.toMatchObject({ status: 400 });
    expect(from).not.toHaveBeenCalled();
  });
  it("turns a failed source into a missing snapshot with no data and no expiry", async () => {
    const snapshot = await loadPostSnapshot("team-games", {}, client({ wgo_team_stats: "fail", games: [] }), now);
    expect(snapshot).toMatchObject({ state: "missing", data: null, expiresAt: null, fixture: false, post: "team-games", generatedAt: "2026-10-31T16:00:00.000Z" });
    expect(snapshot.reasons[0]).toMatch(/could not be read/);
  });
  it("stamps a real edition with its expiry", async () => {
    const snapshot = await loadPostSnapshot("team-games", { days: "3" }, client({ wgo_team_stats: [{ team_id: 1, game_id: 10, date: "2026-10-30" }, { team_id: 2, game_id: 10, date: "2026-10-30" }], games: [{ id: 10, date: "2026-10-30" }] }), now);
    expect(snapshot).toMatchObject({ state: "ready", expiresAt: "2026-10-31T16:15:00.000Z", settings: { days: 3 }, fixture: false, pageNotes: [] });
    expect(snapshot.evidence.coverage).toEqual({ observed: 2, expected: 2, missing: 0, unit: "team games" });
  });
});
