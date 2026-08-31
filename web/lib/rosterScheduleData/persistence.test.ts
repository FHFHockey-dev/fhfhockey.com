import { describe, expect, it, vi } from "vitest";

import { ROSTER_SCHEDULE_UPSERT_CONFLICT } from "./constants";
import {
  deleteRosterScheduleRows,
  findStaleRosterScheduleRowIds,
  summarizeRosterScheduleChanges,
  upsertRosterScheduleRows,
} from "./persistence";
import type { RosterOptimizerTeamGameUpsert } from "./types";

const row = {
  game_key: "477",
  source_game_id: 1,
  team_id: 3,
} as RosterOptimizerTeamGameUpsert;

describe("upsertRosterScheduleRows", () => {
  it("uses the stable source game/team/context conflict target in chunks", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) };

    await expect(
      upsertRosterScheduleRows({
        client,
        rows: [row, { ...row, team_id: 4 }, { ...row, source_game_id: 2 }],
        chunkSize: 2,
      }),
    ).resolves.toBe(3);

    expect(client.from).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      [row, { ...row, team_id: 4 }],
      { onConflict: ROSTER_SCHEDULE_UPSERT_CONFLICT },
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      [{ ...row, source_game_id: 2 }],
      { onConflict: ROSTER_SCHEDULE_UPSERT_CONFLICT },
    );
  });

  it("classifies a repeat sync as unchanged and a reschedule by stable identity", () => {
    const existing = {
      ...row,
      game_date: "2026-10-05",
      game_status: "FUT",
      is_countable: true,
      mapping_status: "mapped",
      schedule_status: "OK",
      week: 1,
    } as RosterOptimizerTeamGameUpsert;

    expect(
      summarizeRosterScheduleChanges({
        existing: [existing],
        incoming: [{ ...existing }],
      }),
    ).toEqual({
      newRows: 0,
      rescheduledRows: 0,
      rescheduledSourceGameIds: [],
      statusChangedRows: 0,
      unchangedRows: 1,
    });

    expect(
      summarizeRosterScheduleChanges({
        existing: [existing],
        incoming: [
          { ...existing, game_date: "2026-10-12", week: 2 },
        ],
      }),
    ).toEqual({
      newRows: 0,
      rescheduledRows: 1,
      rescheduledSourceGameIds: [1],
      statusChangedRows: 0,
      unchangedRows: 0,
    });
  });

  it("identifies and deletes only rows absent from a complete full refresh", async () => {
    const incoming = { ...row, team_id: 3 };
    const staleIds = findStaleRosterScheduleRowIds({
      existing: [
        { ...incoming, id: 10 },
        { ...row, id: 11, team_id: 4 },
      ],
      incoming: [incoming],
    });
    expect(staleIds).toEqual([11]);

    const deleteIn = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ delete: vi.fn(() => ({ in: deleteIn })) })),
    };
    await expect(
      deleteRosterScheduleRows({ client, rowIds: staleIds }),
    ).resolves.toBe(1);
    expect(deleteIn).toHaveBeenCalledWith("id", [11]);
  });
});
