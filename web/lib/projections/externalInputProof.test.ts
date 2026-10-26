import { describe, expect, it, vi } from "vitest";
import { buildForgeInputProvenance, FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT, FORGE_ROLLING_HISTORY_INPUT_CONTRACT } from "./calibrationEligibility";
import { capturedReadReceipt } from "./inputCapture";
import { externalInputProofByRun, loadExternalInputProof, snapshotProvesExternalInputExclusion, verifiedRunAttribution } from "./externalInputProof";
import { provenSnapshotRow, proofDb, stampedRunRow, unprovenSnapshotRow, verifiedReleaseRunRow } from "./externalInputProof.fixtures";
import { VERIFIED_FORGE_PRODUCER_CLOSURES } from "./verifiedForgeReleases";

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
      + "rolling_player_history_contract:metrics->input_provenance->>rolling_player_history_contract,"
      + "producer_identity:metrics->producer_identity");
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
      expect(verifiedRunAttribution(verifiedReleaseRunRow("run", patch))).toBeNull();
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

  describe("stamped runs: the verified producer closure that executed them", () => {
    const VERIFIED = VERIFIED_FORGE_PRODUCER_CLOSURES[0].closureSha256, CHANGED = "1".repeat(64);
    const admitted = async (row: Record<string, unknown>, snapshots: Array<Record<string, unknown>> = []) =>
      (await loadExternalInputProof(proofDb(snapshots, [row]).db as never, [row.run_id as string])).get(row.run_id as string);

    it("admits the next release, an unlisted SHA, when it ships the unchanged verified closure", async () => {
      expect(await admitted(stampedRunRow("next-release", [VERIFIED]))).toEqual({
        rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT, external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
        basis: "verified_producer_closure", releaseSha: "82490cd4591758f145cbcfeab6137719c84c57e9", closureSha256: VERIFIED });
    });

    it.each([
      ["a changed (unverified) closure", [CHANGED], {}],
      ["an unknown closure (built without one)", [null], {}],
      ["a mixed resume", [VERIFIED, CHANGED], { invocations: "2" }],
      ["a resume of the same closure (each invocation may be another release)", [VERIFIED, VERIFIED], { invocations: "2" }],
      ["a two-invocation stamp on a one-invocation run", [VERIFIED, CHANGED], {}],
      ["a resume that began before stamping", [null, VERIFIED], { invocations: "2" }],
      ["a failed run", [VERIFIED], { status: "failed" }],
      ["a local run", [VERIFIED], { git_sha: "local:unknown" }],
    ])("denies %s", async (_label, closures, overrides) => {
      expect(await admitted(stampedRunRow("run", closures as Array<string | null>, overrides))).toBeUndefined();
    });

    it.each([
      ["an unlisted closure relabelled with the verified legacy SHA", { git_sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34" }, [CHANGED]],
      ["an unknown closure relabelled with the verified legacy SHA", { git_sha: "538100d41ee87e721d2764b694f7bac8c2f2bb34" }, [null]],
    ])("never lets a SHA stand in for the stamp: %s", async (_label, overrides, closures) => {
      expect(await admitted(stampedRunRow("run", closures, overrides))).toBeUndefined();
    });

    it.each([
      ["a malformed stamp", { version: "forge-producer-closure-v1", invocations: ["not-a-hash"] }],
      ["an unknown stamp version", { version: "forge-producer-closure-v0", invocations: ["0".repeat(64)] }],
      ["a bare hash in place of the stamp", "0".repeat(64)],
    ])("denies %s, even on the verified legacy SHA", async (_label, producer_identity) => {
      expect(await admitted(verifiedReleaseRunRow("run", { producer_identity }))).toBeUndefined();
    });

    it("denies a post-stamping release that carries no stamp", async () => {
      expect(await admitted(verifiedReleaseRunRow("run", { git_sha: "82490cd4591758f145cbcfeab6137719c84c57e9" }))).toBeUndefined();
    });

    it("denies contradictory capture even when the run is stamped with the verified closure", async () => {
      expect(await admitted(stampedRunRow("captured", [VERIFIED]), [unprovenSnapshotRow("captured")])).toBeUndefined();
    });

    it("fails closed when the attribution read fails", async () => {
      const error = { message: "permission denied" };
      const db = { from: (table: string) => { const chain: any = { select: () => chain, eq: () => chain,
        in: async () => table === "forge_runs" ? { data: null, error } : { data: [], error: null } }; return chain; } };
      await expect(loadExternalInputProof(db as never, ["run"])).rejects.toBe(error);
    });
  });

  it("surfaces a failed proof read instead of reporting a run proven", async () => {
    const error = { message: "permission denied" };
    const db = { from: vi.fn(() => { const chain: any = { select: () => chain, eq: () => chain,
      in: () => Promise.resolve({ data: null, error }) }; return chain; }) };
    await expect(loadExternalInputProof(db as never, ["run"])).rejects.toBe(error);
  });
});
