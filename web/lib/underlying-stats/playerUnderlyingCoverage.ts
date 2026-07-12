export type PlayerUnderlyingCoverageStatus =
  | "complete"
  | "stale-roster"
  | "stale-summary"
  | "unknown-reference";

export type PlayerUnderlyingCoverageDiagnostic = {
  status: PlayerUnderlyingCoverageStatus;
  expectedGameIds: number[];
  rosterGameIds: number[];
  summaryGameIds: number[];
  missingRosterGameIds: number[];
  missingSummaryGameIds: number[];
  formulaReviewReady: boolean;
  guidance: string;
};

function normalizedIds(values: readonly number[]): number[] {
  return [...new Set(values.filter(Number.isFinite).map(Math.trunc))].sort(
    (left, right) => left - right,
  );
}

export function classifyPlayerUnderlyingCoverage(args: {
  expectedGameIds: readonly number[];
  rosterGameIds: readonly number[];
  summaryGameIds: readonly number[];
  referenceAvailable?: boolean;
}): PlayerUnderlyingCoverageDiagnostic {
  const expectedGameIds = normalizedIds(args.expectedGameIds);
  const expectedSet = new Set(expectedGameIds);
  const rosterGameIds = normalizedIds(args.rosterGameIds).filter((gameId) =>
    expectedSet.has(gameId),
  );
  const summaryGameIds = normalizedIds(args.summaryGameIds).filter((gameId) =>
    expectedSet.has(gameId),
  );
  const rosterSet = new Set(rosterGameIds);
  const summarySet = new Set(summaryGameIds);
  const missingRosterGameIds = expectedGameIds.filter(
    (gameId) => !rosterSet.has(gameId),
  );
  const missingSummaryGameIds = expectedGameIds.filter(
    (gameId) => !summarySet.has(gameId),
  );

  if (args.referenceAvailable === false) {
    return {
      status: "unknown-reference",
      expectedGameIds,
      rosterGameIds,
      summaryGameIds,
      missingRosterGameIds,
      missingSummaryGameIds,
      formulaReviewReady: false,
      guidance:
        "The independent NHL game-log reference was unavailable. Verify expected appearances before diagnosing formulas.",
    };
  }

  if (missingRosterGameIds.length > 0) {
    return {
      status: "stale-roster",
      expectedGameIds,
      rosterGameIds,
      summaryGameIds,
      missingRosterGameIds,
      missingSummaryGameIds,
      formulaReviewReady: false,
      guidance:
        "Expected NHL appearances are missing from normalized roster coverage. Refresh raw game data before reviewing aggregation math.",
    };
  }

  if (missingSummaryGameIds.length > 0) {
    return {
      status: "stale-summary",
      expectedGameIds,
      rosterGameIds,
      summaryGameIds,
      missingRosterGameIds,
      missingSummaryGameIds,
      formulaReviewReady: false,
      guidance:
        "Roster coverage is present, but one or more expected appearances lack matching summary rows. Refresh summaries before reviewing formulas.",
    };
  }

  return {
    status: "complete",
    expectedGameIds,
    rosterGameIds,
    summaryGameIds,
    missingRosterGameIds,
    missingSummaryGameIds,
    formulaReviewReady: true,
    guidance:
      "Expected appearances, normalized roster rows, and query summary rows agree. Formula-layer review is now appropriate if the final values still look wrong.",
  };
}
