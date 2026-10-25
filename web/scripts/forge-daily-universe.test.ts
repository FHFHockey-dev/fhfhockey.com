import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runForgeDailyUniverse } from "./forge-daily-universe";
import { syntheticDate, syntheticIdentityRow, syntheticReceipts, syntheticScope } from "../lib/player-forecasts/yahooUniverse.fixtures";

const write = (dir: string, name: string, value: unknown) => {
  const path = join(dir, name), body = JSON.stringify(value);
  writeFileSync(path, body);
  return [path, createHash("sha256").update(body).digest("hex")];
};

describe("forge-daily-universe CLI", () => {
  it("plans the capture offline, then builds the query and the universe from files only", async () => {
    const dir = mkdtempSync(join(tmpdir(), "forge-universe-"));
    const [allocation, allocationSha] = write(dir, "allocation.json", { version: "forge-daily-yahoo-universe-allocation-v1", ...syntheticScope,
      userId: "00000000-0000-4000-8000-000000000001", externalTeamId: "00000000-0000-4000-8000-000000000002" });
    const planned = await runForgeDailyUniverse(["capture", "--allocation", allocation, "--allocation-sha256", allocationSha, "--date", syntheticDate, "--out", join(dir, "capture")]);
    expect(planned).toMatchObject({ status: "plan_only", requests: 3, networkRequests: 0 });
    expect(existsSync(join(dir, "capture", "ledger.jsonl"))).toBe(false);
    const [capture, captureSha] = write(dir, "receipts.json", { scope: syntheticScope, date: syntheticDate, failures: [], attempted: 3,
      receipts: syntheticReceipts([{ key: "477.p.1", status: "IR", statusFull: "Injured Reserve" }], [{ key: "477.p.2" }]) });
    const query = await runForgeDailyUniverse(["query", "--capture", capture, "--capture-sha256", captureSha, "--date", syntheticDate, "--out", join(dir, "query")]);
    expect(query).toMatchObject({ status: "query_ready", keys: 2, networkRequests: 0 });
    expect(JSON.parse(readFileSync(join(dir, "query", "identity-query.json"), "utf8")).keys).toEqual(["477.p.1", "477.p.2"]);
    const [rows, rowsSha] = write(dir, "rows.json", [syntheticIdentityRow("477.p.1", 101, 8470001), syntheticIdentityRow("477.p.2", 102, 8470002)]);
    const [previous, previousSha] = write(dir, "previous.json", { universe: { players: [{ playerId: 101, nhlPlayerId: 8470001, teamId: 10 }] } });
    const resolved = await runForgeDailyUniverse(["resolve", "--capture", capture, "--capture-sha256", captureSha, "--identity-rows", rows,
      "--identity-rows-sha256", rowsSha, "--previous", previous, "--previous-sha256", previousSha, "--date", syntheticDate, "--out", join(dir, "resolve")]);
    expect(resolved).toMatchObject({ status: "complete", ownedComplete: true, proposedConflicts: 1, unchanged: false, networkRequests: 0, databaseWrites: 0 });
    const universe = JSON.parse(readFileSync(join(dir, "resolve", "universe.json"), "utf8"));
    expect(universe).toMatchObject({ change: { added: [102] }, injury: { knownConflicts: null }, identityRowsSha256: rowsSha });
    await expect(runForgeDailyUniverse(["resolve", "--capture", capture, "--capture-sha256", rowsSha, "--identity-rows", rows,
      "--identity-rows-sha256", rowsSha, "--date", syntheticDate, "--out", join(dir, "again")])).rejects.toThrow("file_changed_or_hash_mismatch");
    await expect(runForgeDailyUniverse(["query", "--capture", capture, "--capture-sha256", captureSha, "--date", "2026-10-21", "--out", join(dir, "q2")]))
      .rejects.toThrow("capture_incomplete");
  });
});
