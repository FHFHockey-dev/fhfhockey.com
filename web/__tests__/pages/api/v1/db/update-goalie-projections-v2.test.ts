import { describe, expect, it, vi } from "vitest";

import { upsertGoalieProjectionRows } from "pages/api/v1/db/update-goalie-projections-v2";

describe("update-goalie-projections-v2 persistence", () => {
  it("counts only successfully persisted chunks", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "database unavailable" } });
    const client = {
      from: vi.fn(() => ({ upsert }))
    } as any;

    const result = await upsertGoalieProjectionRows(
      client,
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      2
    );

    expect(result).toEqual({
      rowsUpserted: 2,
      failedRows: 1,
      failures: [
        {
          stage: "goalie_start_projections_upsert",
          batchIndex: 1,
          rows: 1,
          error: "database unavailable"
        }
      ]
    });
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      [{ id: 1 }, { id: 2 }],
      { onConflict: "game_id, player_id" }
    );
  });
});
