export type WgoDateFailureCategory =
  | "source_failure"
  | "transform_failure"
  | "write_failure"
  | "season_mapping_failure";

export type WgoDateOutcome = {
  date: string;
  status: "processed" | "skipped" | "failed";
  category:
    | "processed"
    | "expected_no_game"
    | WgoDateFailureCategory;
  reason: string;
  totalUpdates: number;
  rowsFetched: number;
};

export class WgoDateProcessingError extends Error {
  category: Exclude<WgoDateFailureCategory, "season_mapping_failure">;

  constructor(
    category: Exclude<WgoDateFailureCategory, "season_mapping_failure">,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "WgoDateProcessingError";
    this.category = category;
  }
}

export function createWgoDateOutcome(args: {
  date: string;
  totalUpdates: number;
  rowsFetched: number;
}): WgoDateOutcome {
  if (args.rowsFetched === 0) {
    return {
      ...args,
      status: "skipped",
      category: "expected_no_game",
      reason: "NHL Stats API returned no skater game rows for this date.",
    };
  }

  return {
    ...args,
    status: "processed",
    category: "processed",
    reason: "Skater game rows were fetched and processed.",
  };
}

export function createWgoDateFailure(
  date: string,
  error: unknown,
  fallbackCategory: WgoDateFailureCategory = "transform_failure",
): WgoDateOutcome {
  const category =
    error instanceof WgoDateProcessingError
      ? error.category
      : fallbackCategory;
  const reason =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown WGO skater processing failure.";

  return {
    date,
    status: "failed",
    category,
    reason,
    totalUpdates: 0,
    rowsFetched: 0,
  };
}

export function summarizeWgoDateOutcomes(outcomes: WgoDateOutcome[]) {
  const failed = outcomes.filter((outcome) => outcome.status === "failed");
  const skipped = outcomes.filter((outcome) => outcome.status === "skipped");

  return {
    failedDates: failed.map((outcome) => outcome.date),
    failedDatesCount: failed.length,
    failures: failed.slice(0, 10).map(({ date, category, reason }) => ({
      date,
      category,
      reason,
    })),
    skippedDates: skipped.map((outcome) => outcome.date),
    skippedDatesCount: skipped.length,
    skips: skipped.slice(0, 10).map(({ date, category, reason }) => ({
      date,
      category,
      reason,
    })),
  };
}
