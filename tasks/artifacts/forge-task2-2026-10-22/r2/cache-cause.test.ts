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
it("isolates the persistent league-save cache as the cold/warm receipt delta", async () => {
  const inputs = input();
  const first = await qualifyNativePlayersOffline(inputs, asOf);
  const second = await qualifyNativePlayersOffline(inputs, asOf);
  const third = await qualifyNativePlayersOffline(inputs, asOf);
  const isLeagueRead = (ops: any[]) => ops[0]?.args[0] === "forge_goalie_game" &&
    ops[1]?.args[0] === "game_date,shots_against,goals_allowed";
  const leagueReads = first.runtimeRequests.filter(isLeagueRead);
  expect(leagueReads).toHaveLength(1);
  expect(second.runtimeRequests.filter(isLeagueRead)).toHaveLength(0);
  expect(second.runtimeRequests).toEqual(first.runtimeRequests.filter(ops => !isLeagueRead(ops)));
  expect(first.codeFiles).toEqual(second.codeFiles);
  expect(first.result.outputHash).toBe(second.result.outputHash);
  expect(first.result.categoryCoverage).toEqual(second.result.categoryCoverage);
  expect(first.result.boundary.inMemoryReads).toBe(second.result.boundary.inMemoryReads + 1);
  // Diagnostic decomposition only; the unmodified public regression still must pass for acceptance.
  const comparableFirst = { ...first.result, calculationQueryHash: second.result.calculationQueryHash,
    boundary: { ...first.result.boundary, inMemoryReads: second.result.boundary.inMemoryReads } };
  expect(comparableFirst).toEqual(second.result);
  expect(third.resultHash).toBe(second.resultHash);
  expect(third.runtimeRequests).toEqual(second.runtimeRequests);
  writeFileSync(process.env.DIAG_OUTPUT!, JSON.stringify({ first: { resultHash: first.resultHash,
    outputHash: first.result.outputHash, codeHash: first.codeHash, inMemoryReads: first.result.boundary.inMemoryReads },
    second: { resultHash: second.resultHash, outputHash: second.result.outputHash, codeHash: second.codeHash,
    inMemoryReads: second.result.boundary.inMemoryReads }, third: { resultHash: third.resultHash,
    inMemoryReads: third.result.boundary.inMemoryReads }, singleMissingRead: leagueReads[0],
    allOtherReceiptResultFieldsIdentical: true, sourceBytesChanged: false }, null, 2));
});
