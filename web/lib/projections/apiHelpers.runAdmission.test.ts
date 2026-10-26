import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), not: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: lookup.from } }));

import { requireLatestExternalInputProvenRunId, requireLatestSucceededRunId } from "./apiHelpers";
import { provenSnapshotRow, unprovenSnapshotRow } from "./externalInputProof.fixtures";
import {
  FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
  FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
} from "./calibrationEligibility";
import { runHorizonFilter } from "./releasedRunFence";

// The unguarded lookup stays as run-projection-accuracy uses it (its own eligibility check follows); skater consumers
// use requireLatestExternalInputProvenRunId below.
describe("released legacy FORGE run lookup (separate from native admission)", () => {
  beforeEach(() => {
    for (const mock of Object.values(lookup)) mock.mockReset();
    for (const method of ["from", "select", "eq", "not", "or", "order", "limit"] as const) {
      lookup[method].mockReturnValue(lookup);
    }
  });

  it("admits the latest succeeded run with external fantasy exclusion provenance", async () => {
    lookup.maybeSingle.mockResolvedValue({ data: { run_id: "native-run", metrics: {
      input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT },
    } }, error: null });
    expect(await requireLatestSucceededRunId("2026-10-13")).toBe("native-run");
    expect(lookup.from).toHaveBeenCalledWith("forge_runs");
    expect(lookup.select).toHaveBeenCalledWith("run_id");
    expect(lookup.eq.mock.calls).toEqual([["as_of_date", "2026-10-13"], ["status", "succeeded"]]);
    expect(lookup.not.mock.calls).toEqual([["git_sha", "is", null], ["git_sha", "like", "local:*"]]);
    expect(lookup.or.mock.calls).toEqual([[runHorizonFilter(1)]]);
    expect(lookup.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(lookup.limit).toHaveBeenCalledWith(1);
    expect(lookup.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, true, [], {}, "comparison_reference", "blended_v0"])(
    "retains released legacy run lookup without requiring native-only provenance: %j",
    async contract => {
      lookup.maybeSingle.mockResolvedValue({ data: { run_id: "legacy-run", metrics: { input_provenance: {
        rolling_player_history_contract: FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
        external_fantasy_input_contract: contract,
      } } }, error: null });
      await expect(requireLatestSucceededRunId("2026-10-13")).resolves.toBe("legacy-run");
      expect(lookup.maybeSingle).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, null, [], {}, { input_provenance: null }])(
    "does not reinterpret absent legacy metrics as native qualification: %j",
    async metrics => {
      lookup.maybeSingle.mockResolvedValue({ data: { run_id: "legacy-run", metrics }, error: null });
      await expect(requireLatestSucceededRunId("2026-10-13")).resolves.toBe("legacy-run");
    },
  );

  it.each([null, {}])("preserves 404 for a missing run identity: %j", async data => {
    lookup.maybeSingle.mockResolvedValue({ data, error: null });
    await expect(requireLatestSucceededRunId("2026-10-13")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("preserves the database error rather than translating it into admission or fallback", async () => {
    const error = { code: "42501", message: "permission denied" };
    lookup.maybeSingle.mockResolvedValue({ data: null, error });
    await expect(requireLatestSucceededRunId("2026-10-13")).rejects.toBe(error);
  });
});

describe("latest FORGE run with external-input exclusion proof", () => {
  let runs: string[] = [];
  let snapshots: Array<Record<string, unknown>> = [];
  const runQuery = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn() };
  const snapshotIds: string[][] = [];
  beforeEach(() => {
    lookup.from.mockReset();
    snapshotIds.length = 0;
    for (const mock of Object.values(runQuery)) mock.mockReset().mockReturnValue(runQuery);
    runQuery.limit.mockImplementation(async () => ({ data: runs.map(run_id => ({ run_id })), error: null }));
    lookup.from.mockImplementation((table: string) => {
      if (table === "forge_runs") return runQuery;
      const chain: any = { select: () => chain, eq: () => chain, in: async (_column: string, ids: string[]) => {
        snapshotIds.push(ids);
        return { data: snapshots.filter(row => ids.includes(row.entity_key as string)), error: null };
      } };
      return chain;
    });
  });

  it("returns the newest run whose snapshot proves exclusion, with the same released h1 fences", async () => {
    runs = ["clean-run"]; snapshots = [provenSnapshotRow("clean-run")];
    expect(await requireLatestExternalInputProvenRunId("2026-10-26")).toBe("clean-run");
    expect(runQuery.eq.mock.calls).toEqual([["as_of_date", "2026-10-26"], ["status", "succeeded"]]);
    expect(runQuery.not.mock.calls).toEqual([["git_sha", "is", null], ["git_sha", "like", "local:*"]]);
    expect(runQuery.or.mock.calls).toEqual([[runHorizonFilter(1)]]);
    expect(runQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(snapshotIds).toEqual([["clean-run"]]);
  });

  it("refuses an unproven legacy run with a 404 that names the reason", async () => {
    runs = ["legacy-run", "uncaptured-run"]; snapshots = [unprovenSnapshotRow("legacy-run")];
    await expect(requireLatestExternalInputProvenRunId("2026-10-26")).rejects.toMatchObject({ statusCode: 404,
      details: { reason: "external_input_provenance_unproven", withheldRuns: 2 } });
  });

  it("skips newer unproven runs for an older proven run of the same date", async () => {
    runs = ["legacy-run", "uncaptured-run", "clean-run"]; snapshots = [unprovenSnapshotRow("legacy-run"), provenSnapshotRow("clean-run")];
    expect(await requireLatestExternalInputProvenRunId("2026-10-26")).toBe("clean-run");
  });

  it("keeps 404 for a date with no run, without a proof read", async () => {
    runs = [];
    await expect(requireLatestExternalInputProvenRunId("2026-10-26")).rejects.toMatchObject({ statusCode: 404 });
    expect(snapshotIds).toEqual([]);
  });
});
