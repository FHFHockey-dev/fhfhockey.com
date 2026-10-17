import { describe, expect, it } from "vitest";

import {
  classifySustainabilitySourceAdvance,
  detectSustainabilitySourceAdvance,
  sourceDateFromComponents
} from "./incremental";

const WINDOW_CODES = ["l3", "l5", "l10", "l20"] as const;

type ScoreRow = {
  player_id: number;
  snapshot_date: string;
  window_code: string;
  sourceCutoffs: unknown;
};

function scoreRowsFor(
  playerIds: number[],
  snapshotDate: string,
  sourceDateFor: (playerId: number) => string
): ScoreRow[] {
  return playerIds.flatMap((playerId) =>
    WINDOW_CODES.map((windowCode) => ({
      player_id: playerId,
      snapshot_date: snapshotDate,
      window_code: windowCode,
      sourceCutoffs: {
        observed: { player_stats_unified: sourceDateFor(playerId) }
      }
    }))
  );
}

// Applies only the eq/in filters the detector uses; ordering and ranges are
// irrelevant for a single in-memory page.
function fakeClient(latestSourceDate: string | null, scoreRows: ScoreRow[]) {
  return {
    from(table: string) {
      const filters: Array<(row: ScoreRow) => boolean> = [];
      const builder: any = {
        select: () => builder,
        lte: () => builder,
        order: () => builder,
        limit: () => builder,
        range: () => builder,
        eq: (column: keyof ScoreRow, value: unknown) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in: (column: keyof ScoreRow, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        maybeSingle: async () => ({
          data: latestSourceDate ? { date: latestSourceDate } : null,
          error: null
        }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({
            data:
              table === "sustainability_scores"
                ? scoreRows.filter((row) => filters.every((keep) => keep(row)))
                : [],
            error: null
          })
      };
      return builder;
    }
  } as any;
}

describe("sustainability incremental source detection", () => {
  it("processes only a source date newer than the persisted source cutoff", () => {
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-22",
      latestProcessedSourceDate: "2026-03-21"
    })).toEqual({ shouldProcess: true, reason: "new_source_date" });
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-21",
      latestProcessedSourceDate: "2026-03-21"
    })).toEqual({ shouldProcess: false, reason: "source_already_processed" });
  });

  it("fails open into prerequisite validation when either cutoff is unavailable", () => {
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: null,
      latestProcessedSourceDate: "2026-03-21"
    }).shouldProcess).toBe(true);
    expect(classifySustainabilitySourceAdvance({
      latestSourceDate: "2026-03-21",
      latestProcessedSourceDate: null
    }).shouldProcess).toBe(true);
  });

  it("reads current provenance and retains the legacy key as compatibility", () => {
    expect(
      sourceDateFromComponents({
        sourceCutoffs: {
          observed: { player_stats_unified: "2026-04-16" }
        }
      })
    ).toBe("2026-04-16");
    expect(
      sourceDateFromComponents({
        sourceCutoffs: {
          observed: { player_stats_source_date: "2026-04-15" }
        }
      })
    ).toBe("2026-04-15");
  });

  it("processes a later offset batch after an earlier batch wrote the new cutoff", async () => {
    // Offset 0 (players 1-3) already wrote snapshot 2026-10-17 with the new
    // source date; offset 250 (players 4-6) has no rows for that snapshot.
    const client = fakeClient(
      "2026-10-16",
      scoreRowsFor([1, 2, 3], "2026-10-17", (playerId) =>
        playerId === 2 ? "2026-10-16" : "2026-10-14"
      )
    );

    const laterBatch = await detectSustainabilitySourceAdvance(client, {
      snapshotDate: "2026-10-17",
      playerIds: [4, 5, 6],
      windowCodes: WINDOW_CODES
    });
    expect(laterBatch).toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete",
      missing_batch_rows: 12
    });

    const rerun = await detectSustainabilitySourceAdvance(client, {
      snapshotDate: "2026-10-17",
      playerIds: [1, 2, 3],
      windowCodes: WINDOW_CODES
    });
    expect(rerun).toMatchObject({
      shouldProcess: false,
      reason: "source_already_processed",
      missing_batch_rows: 0,
      latest_processed_source_date: "2026-10-16"
    });
  });

  it("does not count another snapshot's rows or a stale batch as current", async () => {
    const rows = [
      ...scoreRowsFor([1, 2], "2026-10-16", () => "2026-10-16"),
      ...scoreRowsFor([3, 4], "2026-10-17", () => "2026-10-15")
    ];

    await expect(
      detectSustainabilitySourceAdvance(fakeClient("2026-10-16", rows), {
        snapshotDate: "2026-10-17",
        playerIds: [1, 2],
        windowCodes: WINDOW_CODES
      })
    ).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete"
    });
    await expect(
      detectSustainabilitySourceAdvance(fakeClient("2026-10-16", rows), {
        snapshotDate: "2026-10-17",
        playerIds: [3, 4],
        windowCodes: WINDOW_CODES
      })
    ).resolves.toMatchObject({
      shouldProcess: true,
      reason: "new_source_date"
    });
  });

  it("treats a batch missing one window as incomplete", async () => {
    const rows = scoreRowsFor([1], "2026-10-17", () => "2026-10-16").filter(
      (row) => row.window_code !== "l20"
    );

    await expect(
      detectSustainabilitySourceAdvance(fakeClient("2026-10-16", rows), {
        snapshotDate: "2026-10-17",
        playerIds: [1],
        windowCodes: WINDOW_CODES
      })
    ).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete",
      missing_batch_rows: 1
    });
  });
});
