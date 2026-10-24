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


import { writeFileSync } from "node:fs";
it("retains both receipts for causal comparison", async () => {
  const inputs = input();
  const first = await qualifyNativePlayersOffline(inputs, asOf);
  const second = await qualifyNativePlayersOffline(inputs, asOf);
  writeFileSync(process.env.DIAG_OUTPUT!, JSON.stringify({first,second},null,2));
  expect(first.resultHash).toBe(second.resultHash);
});
