import { describe, expect, it, vi } from "vitest";
import { buildForgeInputProvenance, FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, FORGE_ROLLING_HISTORY_INPUT_CONTRACT } from "./calibrationEligibility";
import { capturedReadReceipt } from "./inputCapture";
import { externalInputProofByRun, loadExternalInputProof, runAttributedToVerifiedRelease, snapshotProvesExternalInputExclusion } from "./externalInputProof";
import { provenSnapshotRow, proofDb, unprovenSnapshotRow, verifiedReleaseRunRow } from "./externalInputProof.fixtures";

const RELEASE = "538100d41ee87e721d2764b694f7bac8c2f2bb34";

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
      external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, basis: "captured_snapshot" });
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
    // Snapshots for every id; attribution only for the 102 without one.
    expect(reads.map(read => [read.table, read.ids.length])).toEqual([["player_forecast_source_observations", 100],
      ["player_forecast_source_observations", 100], ["player_forecast_source_observations", 5], ["forge_runs", 100], ["forge_runs", 2]]);
    expect(reads[0]).toMatchObject({ eq: [["provider", "forge"], ["dataset_key", "forge-run-inputs-v1"]] });
    expect(reads[0].columns.split(",")).not.toContain("payload");
    expect(reads[0].columns).not.toMatch(/payload->>?reads/);
    expect(reads[3].columns).toBe("run_id,git_sha,status,invocations:metrics->resume->>invocations,"
      + "rolling_player_history_contract:metrics->input_provenance->>rolling_player_history_contract");
    expect(await loadExternalInputProof(db as never, [])).toEqual(new Map());
    expect(reads).toHaveLength(5);
  });

  describe("runs without a snapshot: the exact verified release that did all of the work", () => {
    it("accepts a single-invocation succeeded run of the allowlisted full SHA", async () => {
      const { db } = proofDb([], [verifiedReleaseRunRow("released-run")]);
      expect((await loadExternalInputProof(db as never, ["released-run"])).get("released-run")).toEqual({
        rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
        external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, basis: "verified_release", releaseSha: RELEASE });
    });

    it.each([
      ["an unlisted newer release", { git_sha: "3795abb43" + "0".repeat(31) }],
      ["the pre-removal release bd337d97a", { git_sha: "bd337d97aefd959832b3466037d163f320a23d99" }],
      ["a short SHA", { git_sha: "538100d41" }],
      ["a prefix of the SHA", { git_sha: RELEASE.slice(0, 39) }],
      ["the SHA with a suffix", { git_sha: `${RELEASE}0` }],
      ["an upper-case SHA", { git_sha: RELEASE.toUpperCase() }],
      ["a local SHA", { git_sha: `local:${RELEASE}` }],
      ["local:unknown", { git_sha: "local:unknown" }],
      ["a null SHA", { git_sha: null }],
      ["a resumed run (another invocation may be another release)", { invocations: "2" }],
      ["a run with no resume record", { invocations: null }],
      ["an unfinished run", { status: "running" }],
      ["a failed run", { status: "failed" }],
    ])("rejects %s", async (_label, patch) => {
      const { db } = proofDb([], [verifiedReleaseRunRow("run", patch)]);
      expect((await loadExternalInputProof(db as never, ["run"])).has("run")).toBe(false);
      expect(runAttributedToVerifiedRelease(verifiedReleaseRunRow("run", patch))).toBeNull();
    });

    it("never lets the release override a snapshot that does not prove exclusion, and still accepts captured proof", async () => {
      const { db, reads } = proofDb([unprovenSnapshotRow("captured-blended"), provenSnapshotRow("captured-clean")],
        [verifiedReleaseRunRow("captured-blended"), verifiedReleaseRunRow("captured-clean")]);
      const proof = await loadExternalInputProof(db as never, ["captured-blended", "captured-clean"]);
      expect([...proof.keys()]).toEqual(["captured-clean"]);
      expect(proof.get("captured-clean")?.basis).toBe("captured_snapshot");
      expect(reads.some(read => read.table === "forge_runs")).toBe(false);
    });

    it("rejects a run id that matches more than one attribution row", () => {
      expect(externalInputProofByRun([], ["run"], [verifiedReleaseRunRow("run"), verifiedReleaseRunRow("run")]).has("run")).toBe(false);
    });
  });

  it("surfaces a failed proof read instead of reporting a run proven", async () => {
    const error = { message: "permission denied" };
    const db = { from: vi.fn(() => { const chain: any = { select: () => chain, eq: () => chain,
      in: () => Promise.resolve({ data: null, error }) }; return chain; }) };
    await expect(loadExternalInputProof(db as never, ["run"])).rejects.toBe(error);
  });
});
