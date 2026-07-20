import { describe, expect, it } from "vitest";

import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "../relationshipMaterialization";
import { PROJECTION_DERIVED_ALGORITHM_VERSION } from "./projectionDerivedPersistence";
import {
  selectPendingProjectionDerivedDates,
  type ProjectionDerivedQueueRow,
} from "./projectionDerivedQueue";

const inputFingerprint = "a".repeat(64);

function row(
  gameId: number,
  date: string,
  overrides: Partial<ProjectionDerivedQueueRow> = {},
): ProjectionDerivedQueueRow {
  return {
    game_id: gameId,
    input_status: "complete",
    input_fingerprint: inputFingerprint,
    relationship_status: "complete",
    relationship_input_fingerprint: inputFingerprint,
    relationship_algorithm_version: SHIFT_RELATIONSHIP_ALGORITHM_VERSION,
    derived_status: "pending",
    derived_input_fingerprint: null,
    derived_algorithm_version: null,
    games: { id: gameId, date },
    ...overrides,
  };
}

describe("projection derived scheduled queue", () => {
  it("selects oldest relationship-ready dates deterministically and bounds unique dates", () => {
    expect(
      selectPendingProjectionDerivedDates({
        rows: [
          row(30, "2026-03-12"),
          row(11, "2026-03-10"),
          row(12, "2026-03-10"),
          row(20, "2026-03-11"),
        ],
        maxDates: 2,
      }),
    ).toEqual(["2026-03-10", "2026-03-11"]);
  });

  it("waits for the current relationship generation and requeues stale derived algorithms", () => {
    expect(
      selectPendingProjectionDerivedDates({
        rows: [
          row(10, "2026-03-10", {
            relationship_status: "pending",
            relationship_input_fingerprint: null,
            relationship_algorithm_version: null,
          }),
          row(20, "2026-03-11", {
            derived_status: "complete",
            derived_input_fingerprint: inputFingerprint,
            derived_algorithm_version: "projection-derived-old",
          }),
          row(30, "2026-03-12", {
            derived_status: "complete",
            derived_input_fingerprint: inputFingerprint,
            derived_algorithm_version: PROJECTION_DERIVED_ALGORITHM_VERSION,
          }),
        ],
        maxDates: 3,
      }),
    ).toEqual(["2026-03-11"]);
  });

  it("fails closed on duplicate or malformed queue evidence", () => {
    expect(() =>
      selectPendingProjectionDerivedDates({
        rows: [row(10, "2026-03-10"), row(10, "2026-03-10")],
        maxDates: 3,
      }),
    ).toThrow("Invalid projection derived queue row");
  });
});
