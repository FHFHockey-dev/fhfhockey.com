import { describe, expect, it } from "vitest";

import {
  buildStaleSourceFilter,
  classifySustainabilitySourceAdvance,
  detectSustainabilitySourceAdvance,
  sourceDateFromComponents
} from "./incremental";

const WINDOW_CODES = ["l3", "l5", "l10", "l20"] as const;
const SNAPSHOT = "2026-10-17";

type ScoreRow = {
  player_id: number;
  snapshot_date: string;
  window_code: string;
  sourceCutoffs: unknown;
  warnings?: unknown;
};
type StatRow = { player_id: number; date: string };
type WindowZRow = {
  player_id: number;
  snapshot_date: string;
  window_code: string;
  stat_code: string;
};

function scoreRowsFor(
  playerIds: number[],
  snapshotDate: string,
  sourceDateFor: (playerId: number, windowCode: string) => string | null
): ScoreRow[] {
  return playerIds.flatMap((playerId) =>
    WINDOW_CODES.map((windowCode) => ({
      player_id: playerId,
      snapshot_date: snapshotDate,
      window_code: windowCode,
      sourceCutoffs: {
        observed: { player_stats_unified: sourceDateFor(playerId, windowCode) }
      }
    }))
  );
}

function statRows(latestByPlayer: Record<number, string>): StatRow[] {
  return Object.entries(latestByPlayer).flatMap(([playerId, date]) => [
    { player_id: Number(playerId), date: "2026-10-01" },
    { player_id: Number(playerId), date }
  ]);
}

// Interprets the PostgREST filters the detector sends; ordering and ranges are
// irrelevant for a single in-memory page.
function matchesStaleFilter(filter: string, row: StatRow) {
  const groups = filter.matchAll(
    /and\(date\.gt\.([\d-]+),player_id\.in\.\(([\d,]+)\)\)|player_id\.in\.\(([\d,]+)\)/g
  );
  for (const [, cutoff, cutoffIds, nullIds] of groups) {
    const ids = (cutoffIds ?? nullIds).split(",").map(Number);
    if (ids.includes(row.player_id) && (!cutoff || row.date > cutoff)) {
      return true;
    }
  }
  return false;
}

function fakeClient(scoreRows: ScoreRow[], stats: StatRow[], windowZ: WindowZRow[] = []) {
  return {
    from(table: string) {
      let rows: any[] =
        table === "sustainability_scores"
          ? scoreRows
          : table === "sustainability_window_z"
            ? windowZ
            : stats;
      let limit = Infinity;
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: () => builder,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[column]));
          return builder;
        },
        lte: (column: string, value: string) => {
          rows = rows.filter((row) => row[column] <= value);
          return builder;
        },
        or: (filter: string) => {
          rows = rows.filter((row) => matchesStaleFilter(filter, row));
          return builder;
        },
        limit: (count: number) => {
          limit = count;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: rows.slice(0, limit), error: null })
      };
      return builder;
    }
  } as any;
}

function detect(client: unknown, playerIds: number[]) {
  return detectSustainabilitySourceAdvance(client as any, {
    snapshotDate: SNAPSHOT,
    playerIds,
    windowCodes: WINDOW_CODES
  });
}

describe("sustainability incremental source detection", () => {
  it("skips only a complete batch with no newer source rows", () => {
    expect(
      classifySustainabilitySourceAdvance({
        batchPlayers: 3,
        missingBatchRows: 0,
        hasStaleRows: false
      })
    ).toEqual({ shouldProcess: false, reason: "source_already_processed" });
    expect(
      classifySustainabilitySourceAdvance({
        batchPlayers: 3,
        missingBatchRows: 0,
        hasStaleRows: true
      })
    ).toEqual({ shouldProcess: true, reason: "new_source_date" });
    expect(
      classifySustainabilitySourceAdvance({
        batchPlayers: 0,
        missingBatchRows: 0,
        hasStaleRows: false
      })
    ).toEqual({ shouldProcess: true, reason: "empty_batch" });
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

  it("groups players by cutoff in the stale-source filter", () => {
    expect(
      buildStaleSourceFilter(
        new Map([
          [1, "2026-10-16"],
          [2, null],
          [3, "2026-10-16"]
        ])
      )
    ).toBe("and(date.gt.2026-10-16,player_id.in.(1,3)),player_id.in.(2)");
  });

  it("processes a later offset batch after an earlier batch wrote the new cutoff", async () => {
    // Offset 0 (players 1-3) already wrote the snapshot; offset 250 (4-6) has no rows.
    const stats = statRows({ 1: "2026-10-14", 2: "2026-10-16", 3: "2026-10-14", 4: "2026-10-16" });
    const client = fakeClient(
      scoreRowsFor([1, 2, 3], SNAPSHOT, (playerId) =>
        playerId === 2 ? "2026-10-16" : "2026-10-14"
      ),
      stats
    );

    await expect(detect(client, [4, 5, 6])).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete",
      missing_batch_rows: 12
    });
    await expect(detect(client, [1, 2, 3])).resolves.toMatchObject({
      shouldProcess: false,
      reason: "source_already_processed",
      missing_batch_rows: 0,
      stale_source_rows: false
    });
  });

  it("processes a batch with mixed cutoffs when any one player is stale", async () => {
    // Player 1 is current, player 3 legitimately last played 10-10, but player 2
    // gained a 10-15 game after its rows were built with 10-14.
    const stats = statRows({ 1: "2026-10-16", 2: "2026-10-15", 3: "2026-10-10" });
    const cutoffs: Record<number, string> = {
      1: "2026-10-16",
      2: "2026-10-14",
      3: "2026-10-10"
    };
    const rows = scoreRowsFor([1, 2, 3], SNAPSHOT, (playerId) => cutoffs[playerId]);

    await expect(detect(fakeClient(rows, stats), [1, 2, 3])).resolves.toMatchObject({
      shouldProcess: true,
      reason: "new_source_date",
      stale_source_rows: true
    });
    await expect(detect(fakeClient(rows, stats), [1, 3])).resolves.toMatchObject({
      shouldProcess: false,
      reason: "source_already_processed"
    });
  });

  it("uses a player's oldest window cutoff and treats a null cutoff as no source yet", async () => {
    const mixedWindows = scoreRowsFor([1], SNAPSHOT, (_, windowCode) =>
      windowCode === "l20" ? "2026-10-14" : "2026-10-16"
    );
    await expect(
      detect(fakeClient(mixedWindows, statRows({ 1: "2026-10-16" })), [1])
    ).resolves.toMatchObject({ shouldProcess: true, reason: "new_source_date" });

    const noSource = scoreRowsFor([2], SNAPSHOT, () => null);
    await expect(detect(fakeClient(noSource, []), [2])).resolves.toMatchObject({
      shouldProcess: false,
      reason: "source_already_processed"
    });
    await expect(
      detect(fakeClient(noSource, statRows({ 2: "2026-10-16" })), [2])
    ).resolves.toMatchObject({ shouldProcess: true, reason: "new_source_date" });
  });

  it("processes when batch membership changes between runs", async () => {
    // Baselines gained player 7, which now falls inside this batch.
    const rows = scoreRowsFor([1, 2], SNAPSHOT, () => "2026-10-16");
    const stats = statRows({ 1: "2026-10-16", 2: "2026-10-16", 7: "2026-10-16" });

    await expect(detect(fakeClient(rows, stats), [1, 2, 7])).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete",
      missing_batch_rows: 4
    });
  });

  it("does not count another snapshot's rows and treats a missing window as incomplete", async () => {
    const stats = statRows({ 1: "2026-10-16", 2: "2026-10-16" });
    const otherSnapshot = scoreRowsFor([1], "2026-10-16", () => "2026-10-16");
    await expect(detect(fakeClient(otherSnapshot, stats), [1])).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete"
    });

    const missingWindow = scoreRowsFor([2], SNAPSHOT, () => "2026-10-16").filter(
      (row) => row.window_code !== "l20"
    );
    await expect(detect(fakeClient(missingWindow, stats), [2])).resolves.toMatchObject({
      shouldProcess: true,
      reason: "snapshot_batch_incomplete",
      missing_batch_rows: 1
    });
  });

  it("skips a re-run of the same snapshot once every player is current", async () => {
    const stats = statRows({ 1: "2026-10-16", 2: "2026-10-12" });
    const rows = scoreRowsFor([1, 2], SNAPSHOT, (playerId) =>
      playerId === 1 ? "2026-10-16" : "2026-10-12"
    );
    const client = fakeClient(rows, stats);

    await expect(detect(client, [1, 2])).resolves.toMatchObject({
      shouldProcess: false,
      reason: "source_already_processed"
    });
    await expect(detect(client, [2, 1, 2])).resolves.toMatchObject({
      shouldProcess: false,
      batch_players: 2
    });
  });

  it("reprocesses rows built without window_z only once those inputs exist", async () => {
    // Rows written while sustainability_window_z was absent: luck z defaulted to
    // 0, warnings record it, and the source cutoff is current.
    const degraded = scoreRowsFor([1], SNAPSHOT, () => "2026-10-16").map((row) => ({
      ...row,
      warnings: [
        "missing_window_z_shp",
        "missing_window_z_oishp",
        "missing_window_z_ipp",
        "missing_window_z_ppshp"
      ]
    }));
    const stats = statRows({ 1: "2026-10-16" });
    const windowZ = (windowCode: string, stat_code: string, snapshot_date = SNAPSHOT) => ({
      player_id: 1,
      snapshot_date,
      window_code: windowCode,
      stat_code
    });

    await expect(
      detect(fakeClient(degraded, stats, [windowZ("l10", "shp")]), [1])
    ).resolves.toMatchObject({
      shouldProcess: true,
      reason: "luck_inputs_available",
      repairable_luck_rows: true
    });
    // Still absent, or present only for another snapshot: keep skipping.
    for (const rows of [[], [windowZ("l10", "shp", "2026-10-16")]]) {
      await expect(detect(fakeClient(degraded, stats, rows), [1])).resolves.toMatchObject({
        shouldProcess: false,
        reason: "source_already_processed",
        repairable_luck_rows: false
      });
    }
    // A rebuild that gained shp but still lacks ppshp does not loop on ppshp.
    const partial = degraded.map((row) => ({ ...row, warnings: ["missing_window_z_ppshp"] }));
    await expect(
      detect(fakeClient(partial, stats, [windowZ("l10", "shp")]), [1])
    ).resolves.toMatchObject({ shouldProcess: false, reason: "source_already_processed" });
  });
});
