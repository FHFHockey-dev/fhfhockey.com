import { describe, expect, it, vi } from "vitest";
import { buildForgeInputProvenance, FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, FORGE_ROLLING_HISTORY_INPUT_CONTRACT } from "./calibrationEligibility";
import { capturedReadReceipt } from "./inputCapture";
import { externalInputProofByRun, loadExternalInputProof, snapshotProvesExternalInputExclusion } from "./externalInputProof";
import { provenSnapshotRow, proofDb } from "./externalInputProof.fixtures";

describe("FORGE external-input exclusion proof", () => {
  it("accepts the snapshot the live writer stores for a clean captured run", () => {
    // The writer's own builders: the claim from buildForgeInputProvenance and the receipt from capturedReadReceipt.
    const provenance = { ...buildForgeInputProvenance({ externalFantasyInputsExcluded: true }),
      capturedReads: capturedReadReceipt([{ request: [{ method: "from", args: ["skatersGameStats"] }], result: { data: [] },
        receivedAt: "2026-10-26T14:00:00.000Z" } as never]) };
    const row = { entity_key: "run-1", available_at: "2026-10-26T14:00:01.000+00:00", snapshot_version: "forge-inputs-v1",
      snapshot_run_id: "run-1", rolling_player_history_contract: provenance.rolling_player_history_contract,
      external_fantasy_input_contract: provenance.external_fantasy_input_contract, captured_reads: provenance.capturedReads };
    expect(snapshotProvesExternalInputExclusion(row)).toBe(true);
    expect(externalInputProofByRun([row], ["run-1"]).get("run-1")).toEqual({
      rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
      external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT });
  });

  it.each([
    ["the unlabelled snapshot of a pre-7007a0527 (possibly blended) run", { external_fantasy_input_contract: null }],
    ["an unknown contract", { external_fantasy_input_contract: "blended_v0" }],
    ["no captured-read receipt", { captured_reads: null }],
    ["an empty receipt", { captured_reads: { ...provenSnapshotRow("r").captured_reads, readCount: 0 } }],
    ["a malformed receipt hash", { captured_reads: { ...provenSnapshotRow("r").captured_reads, hash: "abc" } }],
    ["reads received after the snapshot", { captured_reads: { ...provenSnapshotRow("r").captured_reads, lastReceivedAt: "2026-10-27T00:00:00Z" } }],
    ["another run's payload", { snapshot_run_id: "other" }],
    ["an unknown snapshot version", { snapshot_version: "forge-inputs-v0" }],
  ])("refuses %s", (_label, patch) => {
    const row = { ...provenSnapshotRow("r"), ...patch };
    expect(snapshotProvesExternalInputExclusion(row)).toBe(false);
    expect(externalInputProofByRun([row], ["r"]).has("r")).toBe(false);
  });

  it("treats a run with no snapshot, or with any unproven snapshot, as unproven", () => {
    const rows = [provenSnapshotRow("clean"), provenSnapshotRow("mixed"), { ...provenSnapshotRow("mixed"), external_fantasy_input_contract: null }];
    expect([...externalInputProofByRun(rows, ["clean", "mixed", "uncaptured"]).keys()]).toEqual(["clean"]);
  });

  it("reads only the small proof projection of each run's snapshot, in short chunks", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `run-${index}`);
    const { db, reads } = proofDb(ids.filter((_, index) => index % 2 === 0).map(provenSnapshotRow));
    const proof = await loadExternalInputProof(db as never, [...ids, ids[0]]);
    expect(proof.size).toBe(103);
    expect(reads.map(read => read.ids.length)).toEqual([100, 100, 5]);
    expect(reads[0]).toMatchObject({ table: "player_forecast_source_observations",
      eq: [["provider", "forge"], ["dataset_key", "forge-run-inputs-v1"]] });
    expect(reads[0].columns.split(",")).not.toContain("payload");
    expect(reads[0].columns).not.toMatch(/payload->>?reads/);
    expect(await loadExternalInputProof(db as never, [])).toEqual(new Map());
    expect(reads).toHaveLength(3);
  });

  it("surfaces a failed proof read instead of reporting a run proven", async () => {
    const error = { message: "permission denied" };
    const db = { from: vi.fn(() => { const chain: any = { select: () => chain, eq: () => chain,
      in: () => Promise.resolve({ data: null, error }) }; return chain; }) };
    await expect(loadExternalInputProof(db as never, ["run"])).rejects.toBe(error);
  });
});
