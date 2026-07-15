export const placementRoughRanges = [
  "top_50",
  "51_100",
  "101_150",
  "151_200",
  "201_250",
  "outside_250",
  "unsure",
] as const;

export type PlacementRoughRange = (typeof placementRoughRanges)[number];
export type PlacementOutcome =
  | "target_over_anchor"
  | "anchor_over_target"
  | "too_close"
  | "skip";
export type PlacementAnchorMode =
  | "narrow"
  | "validate_above"
  | "validate_below"
  | "validate_cutoff"
  | "contradiction_retry";

export type PlacementEntry = { playerId: number; rank: number };
export type PlacementAnchor = {
  sequence: number;
  playerId: number;
  rank: number;
  mode: PlacementAnchorMode;
  intervalLow: number;
  intervalHigh: number;
  expectedOutcome?: Exclude<PlacementOutcome, "skip" | "too_close">;
  retryOfSequence?: number;
};
export type PlacementAnswer = {
  sequence: number;
  anchorPlayerId: number;
  anchorRank: number;
  mode: PlacementAnchorMode;
  outcome: PlacementOutcome;
  contradiction: boolean;
};

export type PlacementEngineState = {
  roughRange: PlacementRoughRange;
  intervalLow: number;
  intervalHigh: number;
  plausibleLow: number | null;
  plausibleHigh: number | null;
  questionCount: number;
  contradictionCount: number;
  issuedAnchors: PlacementAnchor[];
  answers: PlacementAnswer[];
  suggestedRank: number | null;
  ready: boolean;
  confidence: "developing" | "moderate" | "strong";
  completionReason: string | null;
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function initialPlacementInterval(
  roughRange: PlacementRoughRange,
  entryCount: number,
): [number, number] {
  const maxRank = Math.max(1, entryCount + 1);
  const bounds: Record<PlacementRoughRange, [number, number]> = {
    top_50: [1, 50],
    "51_100": [51, 100],
    "101_150": [101, 150],
    "151_200": [151, 200],
    "201_250": [201, 250],
    outside_250: [251, maxRank],
    unsure: [1, maxRank],
  };
  const [requestedLow, requestedHigh] = bounds[roughRange];
  const low = clamp(requestedLow, 1, maxRank);
  const high = clamp(Math.max(requestedLow, requestedHigh), low, maxRank);
  return [low, high];
}

function entryAt(entries: PlacementEntry[], rank: number) {
  return entries.find((entry) => entry.rank === rank) ?? null;
}

function completedRanks(state: PlacementEngineState): Set<number> {
  return new Set(
    state.answers
      .filter((answer) => answer.outcome !== "skip")
      .map((answer) => answer.anchorRank),
  );
}

function issueAnchor(
  state: PlacementEngineState,
  entry: PlacementEntry,
  mode: PlacementAnchorMode,
  expectedOutcome?: PlacementAnchor["expectedOutcome"],
  retryOfSequence?: number,
): PlacementEngineState {
  const anchor: PlacementAnchor = {
    sequence: state.issuedAnchors.length + 1,
    playerId: entry.playerId,
    rank: entry.rank,
    mode,
    intervalLow: state.intervalLow,
    intervalHigh: state.intervalHigh,
    expectedOutcome,
    retryOfSequence,
  };
  return { ...state, issuedAnchors: [...state.issuedAnchors, anchor] };
}

function finish(
  state: PlacementEngineState,
  reason: string,
  broaden = false,
): PlacementEngineState {
  const suggestedRank = clamp(
    Math.floor((state.intervalLow + state.intervalHigh) / 2),
    state.intervalLow,
    state.intervalHigh,
  );
  const baseWidth = suggestedRank <= 100 ? 4 : suggestedRank <= 200 ? 7 : 10;
  const plausibleLow = broaden
    ? Math.max(1, suggestedRank - baseWidth)
    : state.intervalLow;
  const plausibleHigh = broaden
    ? suggestedRank + baseWidth
    : state.intervalHigh;
  const confidence =
    state.contradictionCount > 0
      ? "developing"
      : state.questionCount >= 5
        ? "strong"
        : "moderate";
  return {
    ...state,
    plausibleLow,
    plausibleHigh,
    suggestedRank,
    ready: true,
    confidence,
    completionReason: reason,
  };
}

function nextRequiredValidation(
  state: PlacementEngineState,
  entries: PlacementEntry[],
): {
  entry: PlacementEntry;
  mode: PlacementAnchorMode;
  expectedOutcome: PlacementAnchor["expectedOutcome"];
} | null {
  const suggested = Math.floor((state.intervalLow + state.intervalHigh) / 2);
  const completed = completedRanks(state);
  const requirements: Array<{
    rank: number;
    mode: PlacementAnchorMode;
    expectedOutcome: PlacementAnchor["expectedOutcome"];
  }> = [];

  if (suggested > 1) {
    requirements.push({
      rank: suggested - 1,
      mode: "validate_above",
      expectedOutcome: "anchor_over_target",
    });
  }
  requirements.push({
    rank: suggested,
    mode: "validate_below",
    expectedOutcome: "target_over_anchor",
  });

  if (state.intervalLow <= 255 && state.intervalHigh >= 245) {
    for (const rank of [250, 251]) {
      requirements.push({
        rank,
        mode: "validate_cutoff",
        expectedOutcome:
          suggested <= rank ? "target_over_anchor" : "anchor_over_target",
      });
    }
  }

  for (const requirement of requirements) {
    if (completed.has(requirement.rank)) continue;
    const entry = entryAt(entries, requirement.rank);
    if (entry) return { entry, ...requirement };
  }
  return null;
}

function nextNarrowAnchor(
  state: PlacementEngineState,
  entries: PlacementEntry[],
): PlacementEntry | null {
  const high = Math.min(
    state.intervalHigh,
    entries.length ? Math.max(...entries.map((entry) => entry.rank)) : 0,
  );
  if (high < state.intervalLow) return null;
  const midpoint = Math.floor((state.intervalLow + high) / 2);
  const skippedSequences = new Set(
    state.answers
      .filter((answer) => answer.outcome === "skip")
      .map((answer) => answer.sequence),
  );
  const previouslyIssuedRanks = new Set(
    state.issuedAnchors
      .filter((anchor) => !skippedSequences.has(anchor.sequence))
      .map((anchor) => anchor.rank),
  );
  const candidates = entries
    .filter(
      (entry) =>
        entry.rank >= state.intervalLow &&
        entry.rank <= high &&
        !previouslyIssuedRanks.has(entry.rank),
    )
    .sort(
      (left, right) =>
        Math.abs(left.rank - midpoint) - Math.abs(right.rank - midpoint) ||
        left.rank - right.rank,
    );
  return candidates[0] ?? null;
}

export function issueNextPlacementAnchor(
  state: PlacementEngineState,
  entries: PlacementEntry[],
): PlacementEngineState {
  if (state.ready) return state;
  const hardCap = state.contradictionCount > 0 ? 16 : 12;
  if (state.questionCount >= hardCap) {
    return finish(state, "comparison_cap", state.contradictionCount > 0);
  }

  if (state.intervalHigh - state.intervalLow <= 1) {
    const validation = nextRequiredValidation(state, entries);
    if (!validation) return finish(state, "validated_interval");
    return issueAnchor(
      state,
      validation.entry,
      validation.mode,
      validation.expectedOutcome,
    );
  }

  const anchor = nextNarrowAnchor(state, entries);
  return anchor
    ? issueAnchor(state, anchor, "narrow")
    : finish(state, "anchor_exhausted", state.contradictionCount > 0);
}

export function startPlacementEngine(
  roughRange: PlacementRoughRange,
  entries: PlacementEntry[],
): PlacementEngineState {
  const [intervalLow, intervalHigh] = initialPlacementInterval(
    roughRange,
    entries.length,
  );
  return issueNextPlacementAnchor(
    {
      roughRange,
      intervalLow,
      intervalHigh,
      plausibleLow: null,
      plausibleHigh: null,
      questionCount: 0,
      contradictionCount: 0,
      issuedAnchors: [],
      answers: [],
      suggestedRank: null,
      ready: false,
      confidence: "developing",
      completionReason: null,
    },
    entries,
  );
}

export function answerPlacementEngine(
  state: PlacementEngineState,
  entries: PlacementEntry[],
  outcome: PlacementOutcome,
): PlacementEngineState {
  if (state.ready)
    throw new Error("Placement is already ready for confirmation.");
  const anchor = state.issuedAnchors[state.issuedAnchors.length - 1];
  if (
    !anchor ||
    state.answers.some((answer) => answer.sequence === anchor.sequence)
  ) {
    throw new Error("Placement has no unanswered anchor.");
  }

  const contradiction = Boolean(
    anchor.expectedOutcome &&
    outcome !== "skip" &&
    outcome !== "too_close" &&
    outcome !== anchor.expectedOutcome,
  );
  let next: PlacementEngineState = {
    ...state,
    questionCount: state.questionCount + 1,
    contradictionCount: state.contradictionCount + (contradiction ? 1 : 0),
    answers: [
      ...state.answers,
      {
        sequence: anchor.sequence,
        anchorPlayerId: anchor.playerId,
        anchorRank: anchor.rank,
        mode: anchor.mode,
        outcome,
        contradiction,
      },
    ],
  };

  if (contradiction) {
    if (anchor.mode !== "contradiction_retry") {
      return issueAnchor(
        next,
        { playerId: anchor.playerId, rank: anchor.rank },
        "contradiction_retry",
        anchor.expectedOutcome,
        anchor.sequence,
      );
    }
    return finish(next, "unresolved_contradiction", true);
  }

  if (anchor.mode === "narrow") {
    if (outcome === "target_over_anchor") {
      next = {
        ...next,
        intervalHigh: Math.min(next.intervalHigh, anchor.rank),
      };
    } else if (outcome === "anchor_over_target") {
      next = {
        ...next,
        intervalLow: Math.max(next.intervalLow, anchor.rank + 1),
      };
    } else if (outcome === "too_close") {
      next = {
        ...next,
        intervalLow: Math.max(next.intervalLow, anchor.rank),
        intervalHigh: Math.min(next.intervalHigh, anchor.rank + 1),
      };
    }
  }

  return issueNextPlacementAnchor(next, entries);
}
