// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import fixture from "./fixtures/native-player-offline-synthetic.json";
import { projectionInputHash } from "../lib/projections/inputCapture";
import { installOfflineFence, offlineTableAdapter, qualifyNativePlayersOffline, runOfflinePlayerQualification, type OfflinePlayerInputs } from "./qualify-native-players-offline";

const asOf = "2026-10-09T18:00:00.000Z";
const backend = vi.hoisted(() => ({ createClient: vi.fn(() => { throw new Error("Live DB client forbidden"); }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: backend.createClient }));
// The native runner's NHL import also imports these unused eager public clients.
vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("lib/supabase/client", () => ({ default: {} }));
vi.mock("lib/supabase", () => ({ default: {} }));
const input = () => {
  const inputs = JSON.parse(JSON.stringify(fixture)) as OfflinePlayerInputs;
  return inputs;
};
function updateRows(inputs: OfflinePlayerInputs, table: string, rows: any[]) {
  inputs.tables[table].rows = rows;
  inputs.tables[table].receipt.rowCount = rows.length;
  inputs.tables[table].receipt.rowsHash = projectionInputHash(rows);
}
// Admission is evaluated at receipt creation; keep it before the fixture game (2026-10-12T23:00Z) starts.
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-10T00:00:00.000Z") }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("released producer remains outside native admission", () => {
  it("reconstructs the released producer but does not grant native authority from its legacy provenance", async () => {
    const receipt = await qualifyNativePlayersOffline(input(), asOf);
    expect(receipt.result.blockers).toEqual([]);
    expect(receipt.result.calculation).toMatchObject({ gamesProcessed: 1, playerRows: 36, teamRows: 2, goalieRows: 2, timedOut: false });
    expect(receipt.result.boundary).toMatchObject({ networkCalls: 0, databaseCalls: 0, rpcCalls: 0, committedWrites: 0, forbiddenAttempts: [] });
    expect(receipt.result.qualificationEligible).toBe(false);
    expect(receipt.result.categoryCoverage.every(row => row.admission.acceptedByUnchangedConsumer === false)).toBe(true);
    expect(receipt.result.admission.exclusionCounts.use_not_approved).toBeGreaterThan(0);
    expect(backend.createClient).not.toHaveBeenCalled();
  });
});
