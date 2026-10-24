import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), not: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: lookup.from } }));

import { requireLatestSucceededRunId } from "./apiHelpers";
import {
  FORGE_ROLLING_HISTORY_INPUT_CONTRACT,
  FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT,
} from "./calibrationEligibility";
import { runHorizonFilter } from "./releasedRunFence";

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
