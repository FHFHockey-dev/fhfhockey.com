export type DraftOrderMode = "standard" | "snake" | "custom";

export type DraftOrderPattern = {
  mode: DraftOrderMode;
  reversedRounds: number[];
};

export const DEFAULT_DRAFT_ORDER_PATTERN: DraftOrderPattern = {
  mode: "snake",
  reversedRounds: [],
};

export function normalizeReversedRounds(value: unknown, roundCount: number) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((round) => Number(round))
    .filter(
      (round) =>
        Number.isInteger(round) && round >= 1 && round <= Math.max(0, roundCount),
    );
  return Array.from(new Set(normalized)).sort((left, right) => left - right);
}

export function normalizeDraftOrderPattern(
  value: Partial<DraftOrderPattern> | null | undefined,
  roundCount: number,
  legacyIsSnakeDraft = true,
): DraftOrderPattern {
  const mode: DraftOrderMode =
    value?.mode === "standard" ||
    value?.mode === "snake" ||
    value?.mode === "custom"
      ? value.mode
      : legacyIsSnakeDraft
        ? "snake"
        : "standard";
  return {
    mode,
    reversedRounds:
      mode === "custom"
        ? normalizeReversedRounds(value?.reversedRounds, roundCount)
        : [],
  };
}

export function draftOrderPatternFromSnake(
  isSnakeDraft: boolean,
): DraftOrderPattern {
  return {
    mode: isSnakeDraft ? "snake" : "standard",
    reversedRounds: [],
  };
}

export function isRoundReversed(
  pattern: DraftOrderPattern,
  round: number,
) {
  if (pattern.mode === "snake") return round % 2 === 0;
  if (pattern.mode === "custom") {
    return pattern.reversedRounds.includes(round);
  }
  return false;
}

export function pickInRoundForTeamIndex({
  teamIndex,
  teamCount,
  round,
  pattern,
}: {
  teamIndex: number;
  teamCount: number;
  round: number;
  pattern: DraftOrderPattern;
}) {
  return isRoundReversed(pattern, round)
    ? teamCount - teamIndex
    : teamIndex + 1;
}

export function originalPickOwnerForPattern(
  draftOrder: string[],
  round: number,
  pickInRound: number,
  pattern: DraftOrderPattern,
) {
  const index = isRoundReversed(pattern, round)
    ? draftOrder.length - pickInRound
    : pickInRound - 1;
  return draftOrder[index];
}
