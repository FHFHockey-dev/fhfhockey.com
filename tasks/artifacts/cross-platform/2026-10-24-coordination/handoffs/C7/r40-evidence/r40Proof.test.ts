// C7 R40 controls (reviewer-only; not in the repo).
import { describe, expect, it } from "vitest";
import { externalInputProofByRun, loadExternalInputProof, runAttributedToVerifiedRelease } from "../externalInputProof";
import { proofDb, provenSnapshotRow, unprovenSnapshotRow, verifiedReleaseRunRow } from "../externalInputProof.fixtures";

describe("C7 R40", () => {
  it.each([["number 1", 1], ["'01'", "01"], ["' 1'", " 1"], ["'1.0'", "1.0"], ["'0'", "0"], ["undefined", undefined]])
  ("rejects invocations %s", (_label, invocations) => {
    expect(runAttributedToVerifiedRelease(verifiedReleaseRunRow("run", { invocations }))).toBeNull();
  });
  it.each([["'succeeded '", "succeeded "], ["'SUCCEEDED'", "SUCCEEDED"], ["undefined", undefined]])("rejects status %s", (_label, status) => {
    expect(runAttributedToVerifiedRelease(verifiedReleaseRunRow("run", { status }))).toBeNull();
  });
  it("rejects an attribution row for another run id", () => {
    expect(externalInputProofByRun([], ["run"], [verifiedReleaseRunRow("other")]).has("run")).toBe(false);
  });
  it("a snapshot recorded for another run id still counts as capture for its entity key and denies the SHA fallback", () => {
    const foreign = { ...provenSnapshotRow("run"), snapshot_run_id: "someone-else" };
    expect(externalInputProofByRun([foreign], ["run"], [verifiedReleaseRunRow("run")]).has("run")).toBe(false);
  });
  it("a mix of one proving and one non-proving snapshot denies, even with a verified release", () => {
    expect(externalInputProofByRun([provenSnapshotRow("run"), unprovenSnapshotRow("run")], ["run"], [verifiedReleaseRunRow("run")]).has("run")).toBe(false);
  });
  it("an attribution read error throws (callers treat it as unproven)", async () => {
    const { db } = proofDb([], []);
    const failing = { from(table: string) { const chain = (db as any).from(table); if (table !== "forge_runs") return chain;
      return { select: () => ({ in: () => Promise.resolve({ data: null, error: new Error("synthetic forge_runs failure") }) }) }; } };
    await expect(loadExternalInputProof(failing as never, ["run"])).rejects.toThrow("synthetic forge_runs failure");
  });
  it("the attribution read selects only metrics paths, never the metrics' exclusion claim", async () => {
    const { db, reads } = proofDb([], [verifiedReleaseRunRow("run")]);
    const proof = await loadExternalInputProof(db as never, ["run"]);
    expect(proof.get("run")).toMatchObject({ basis: "verified_release", releaseSha: "538100d41ee87e721d2764b694f7bac8c2f2bb34" });
    const runRead = reads.find(read => read.table === "forge_runs")!;
    expect(runRead.columns).not.toMatch(/external_fantasy/);
  });
});
