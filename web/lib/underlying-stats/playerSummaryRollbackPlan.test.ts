import { describe, expect, it } from "vitest";

import {
  buildPlayerStatsSummaryPartitionSourceUrl,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
} from "./playerStatsLandingServer";
import {
  buildBackupFiles,
  buildRollbackRow,
  chooseRollbackAt,
  findChangedHeads,
  findReadbackMismatches,
  planRollback,
  PLAYER_SUMMARY_ENDPOINT,
  PLAYER_SUMMARY_PARTITION_PREFIX,
  selectPartitionHeads,
  sha256Hex,
  timestampMicros,
  verifyBackup,
  type BackupRow,
} from "./playerSummaryRollbackPlan";

const GAME = 2026020087;
const url = (strength: string, game = GAME) => `${PLAYER_SUMMARY_PARTITION_PREFIX}individual/${strength}/${game}`;

function row(id: number, sourceUrl: string, fetchedAt: string, hash = `h${id}`, game = GAME): BackupRow {
  return {
    id, game_id: game, endpoint: "landing", season_id: 20262027, game_date: "2026-10-12",
    source_url: sourceUrl, fetched_at: fetchedAt, payload_hash: hash,
    payload: { version: 1, generatedAt: fetchedAt, game: { id: game, seasonId: 20262027 }, rows: [{ id }] },
  };
}

describe("player summary rollback planning", () => {
  it("mirrors the summary writer's endpoint and partition source urls", () => {
    expect(PLAYER_SUMMARY_ENDPOINT).toBe(PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT);
    expect(PLAYER_SUMMARY_PARTITION_PREFIX).toBe(PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX);
    const sourceUrl = buildPlayerStatsSummaryPartitionSourceUrl({ gameId: GAME, mode: "onIce", strength: "fiveOnFive", scoreState: "leading" });
    expect(selectPartitionHeads([{ id: 1, game_id: GAME, source_url: sourceUrl, fetched_at: "2026-10-12T00:00:00Z", payload_hash: "x" }]).heads.size).toBe(1);
  });

  it("parses timestamptz strings to microseconds, keeping sub-millisecond digits", () => {
    expect(timestampMicros("2026-11-09T03:00:00.123456+00:00") - timestampMicros("2026-11-09T03:00:00.123Z")).toBe(456);
    expect(timestampMicros("2026-11-09 05:00:00+02")).toBe(timestampMicros("2026-11-09T03:00:00Z"));
    expect(() => timestampMicros("yesterday")).toThrow(/Unparseable/);
  });

  it("selects the reader's head: newest fetched_at, ties to the lowest id, and reports live ties", () => {
    const { heads, ties } = selectPartitionHeads([
      row(5, url("allStrengths"), "2026-10-12T01:00:00Z"),
      row(9, url("allStrengths"), "2026-11-09T01:00:00.000001+00:00"),
      row(7, url("fiveOnFive"), "2026-11-09T01:00:00Z"),
      row(6, url("fiveOnFive"), "2026-11-09T01:00:00+00:00"),
    ]);
    expect(heads.get(url("allStrengths"))!.id).toBe(9);
    expect(heads.get(url("fiveOnFive"))!.id).toBe(6);
    expect(ties).toEqual([url("fiveOnFive")]);
  });

  it("refuses rows outside the v2 partition prefix or from another game", () => {
    expect(() => selectPartitionHeads([row(1, "derived://underlying-player-summary/x/2026020087", "2026-10-12T00:00:00Z")])).toThrow(/not a v2 partition/);
    expect(() => selectPartitionHeads([row(1, url("allStrengths", 1), "2026-10-12T00:00:00Z")])).toThrow(/not a v2 partition/);
  });

  it("writes a backup whose sha256 and manifest verify, and rejects any tampering", () => {
    const rows = [row(2, url("fiveOnFive"), "2026-10-12T00:00:00Z"), row(1, url("allStrengths"), "2026-10-12T00:00:00Z")];
    const { rowsText, manifest } = buildBackupFiles({
      scope: { kind: "game_ids", gameIds: [GAME, 2026020088] }, gameIds: [GAME, 2026020088], rows, ties: [], createdAt: "2026-11-09T12:00:00.000Z",
    });
    expect(manifest.rowsSha256).toBe(sha256Hex(rowsText));
    expect(manifest.partitions.map((p) => p.id)).toEqual([1, 2]);
    expect(manifest.gamesWithoutPartitions).toEqual([2026020088]);
    expect(verifyBackup(manifest, rowsText).size).toBe(2);
    expect(() => verifyBackup(manifest, rowsText.replace('"id":1', '"id":3'))).toThrow(/byte length|sha256/);
    expect(() => verifyBackup({ ...manifest, partitionCount: 3 }, rowsText)).toThrow(/count/);
    const forged = rowsText.replace("h1", "h9");
    expect(() => verifyBackup({ ...manifest, rowsSha256: sha256Hex(forged) }, forged)).toThrow(/does not match manifest/);
    expect(() => buildBackupFiles({ scope: { kind: "game_ids", gameIds: [1] }, gameIds: [1], rows, ties: [], createdAt: "x" })).toThrow(/outside the scope/);
  });

  it("plans restores, skips unchanged and already-restored partitions, and lists rebuild-only partitions", () => {
    const backup = new Map([
      [url("allStrengths"), row(1, url("allStrengths"), "2026-10-12T00:00:00Z")],
      [url("fiveOnFive"), row(2, url("fiveOnFive"), "2026-10-12T00:00:00Z")],
      [url("powerPlay"), row(3, url("powerPlay"), "2026-10-12T00:00:00Z")],
    ]);
    const heads = new Map([
      [url("allStrengths"), row(11, url("allStrengths"), "2026-11-09T00:00:00Z")],
      [url("fiveOnFive"), row(2, url("fiveOnFive"), "2026-10-12T00:00:00Z")],
      [url("powerPlay"), row(13, url("powerPlay"), "2026-11-09T00:00:00Z")],
      [url("penaltyKill"), row(14, url("penaltyKill"), "2026-11-09T00:00:00Z")],
    ]);
    const plan = planRollback({ backup, currentHeads: heads, restoredIds: new Map([[url("powerPlay"), new Set([13])]]) });
    expect(plan.entries.map((e) => [e.source_url, e.action])).toEqual([
      [url("allStrengths"), "restore"], [url("fiveOnFive"), "unchanged"], [url("powerPlay"), "already_restored"],
    ]);
    expect(plan.newPartitions.map((p) => p.id)).toEqual([14]);
    expect(planRollback({ backup, currentHeads: heads, restoredIds: new Map([[url("powerPlay"), new Set([13])]]) }).planSha256).toBe(plan.planSha256);
    expect(planRollback({ backup, currentHeads: heads }).planSha256).not.toBe(plan.planSha256);
    heads.delete(url("fiveOnFive"));
    expect(() => planRollback({ backup, currentHeads: heads })).toThrow(/append-only/);
  });

  it("chooses a rollback time strictly after every head, even sub-millisecond or future ones", () => {
    expect(chooseRollbackAt(Date.parse("2026-11-09T12:00:00Z"), [{ fetched_at: "2026-11-09T01:00:00Z" }])).toBe("2026-11-09T12:00:00.000Z");
    const at = chooseRollbackAt(Date.parse("2026-11-09T12:00:00Z"), [{ fetched_at: "2026-11-09T12:00:05.123456+00:00" }]);
    expect(at).toBe("2026-11-09T12:00:05.124Z");
    expect(timestampMicros(at)).toBeGreaterThan(timestampMicros("2026-11-09T12:00:05.123456+00:00"));
  });

  it("builds a rollback row: same partition and content, new generatedAt, fetched_at and hash", () => {
    const backupRow = row(1, url("allStrengths"), "2026-10-12T00:00:00Z", "oldhash");
    const restored = buildRollbackRow(backupRow, "2026-11-09T12:00:00.000Z");
    expect(restored).toMatchObject({ game_id: GAME, endpoint: "landing", source_url: backupRow.source_url, fetched_at: "2026-11-09T12:00:00.000Z" });
    expect(restored.payload).toEqual({ ...backupRow.payload, generatedAt: "2026-11-09T12:00:00.000Z" });
    expect(restored.payload_hash).toBe(sha256Hex(JSON.stringify(restored.payload)));
    expect(restored.payload_hash).not.toBe("oldhash");
    expect(backupRow.payload.generatedAt).toBe("2026-10-12T00:00:00Z");
  });

  it("detects moved heads before a batch and wrong heads after it", () => {
    const backup = new Map([[url("allStrengths"), row(1, url("allStrengths"), "2026-10-12T00:00:00Z")]]);
    const heads = new Map([[url("allStrengths"), row(11, url("allStrengths"), "2026-11-09T00:00:00Z")]]);
    const plan = planRollback({ backup, currentHeads: heads });
    expect(findChangedHeads(plan.entries, heads)).toEqual([]);
    expect(findChangedHeads(plan.entries, new Map([[url("allStrengths"), row(12, url("allStrengths"), "2026-11-09T02:00:00Z")]]))).toEqual([url("allStrengths")]);
    const restored = buildRollbackRow(backup.get(url("allStrengths"))!, "2026-11-09T12:00:00.000Z");
    const good = { ...restored, id: 20 };
    expect(findReadbackMismatches([restored], new Map([[url("allStrengths"), { ...good, fetched_at: "2026-11-09T12:00:00+00:00" }]]))).toEqual([]);
    expect(findReadbackMismatches([restored], heads)).toEqual([url("allStrengths")]);
  });
});
