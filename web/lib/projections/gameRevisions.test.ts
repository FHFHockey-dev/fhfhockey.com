import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { rpc: db.rpc } }));

import { loadForgeGameRevisions } from "./gameRevisions";
import { withForgeEnv } from "./forgeEnvScope";

const daily = { revision_id: "daily-rev", run_id: "daily-run", game_id: 2026020358, payload: { inputProvenance: {} } };
const pregame = { revision_id: "pregame-rev", run_id: "claim-1", game_id: 2026020358,
  payload: { inputProvenance: { pregameObservationRequired: true } } };

describe("pregame publication revision fence", () => {
  beforeEach(() => {
    db.rpc.mockReset();
    db.rpc.mockResolvedValue({ data: [daily, pregame], error: null });
  });

  it("keeps a game-scoped pregame revision away from every reader outside its own scope", async () => {
    expect(await loadForgeGameRevisions("2026-11-19")).toEqual([daily]);
    expect(db.rpc).toHaveBeenCalledWith("read_forge_game_revisions", { p_slate_date: "2026-11-19" });
  });

  it("lets the game-scoped readback see its own revision beside the daily one", async () => {
    expect(await withForgeEnv({}, () => loadForgeGameRevisions("2026-11-19"))).toEqual([daily, pregame]);
  });

  it("still surfaces the database error", async () => {
    db.rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(loadForgeGameRevisions("2026-11-19")).rejects.toThrow("boom");
  });
});
