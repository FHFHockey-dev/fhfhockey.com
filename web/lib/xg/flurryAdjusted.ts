export type FlurryPrediction = {
  gameId: number;
  eventId: number;
  rawXg: number;
  flurrySequenceId: string | null;
  flurryShotIndex: number | null;
};

export type FlurryAdjustedPrediction = FlurryPrediction & {
  flurryAdjustedXg: number;
  priorNonScoringProbability: number;
};

function probability(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

export function buildFlurryAdjustedPredictions(
  rows: FlurryPrediction[],
): FlurryAdjustedPrediction[] {
  const ordered = [...rows].sort((left, right) => {
    if (left.gameId !== right.gameId) return left.gameId - right.gameId;
    const sequence = (left.flurrySequenceId ?? "").localeCompare(right.flurrySequenceId ?? "");
    if (sequence !== 0) return sequence;
    const index = (left.flurryShotIndex ?? 0) - (right.flurryShotIndex ?? 0);
    return index !== 0 ? index : left.eventId - right.eventId;
  });
  const survivalBySequence = new Map<string, number>();

  return ordered.map((row) => {
    const rawXg = probability(row.rawXg);
    if (!row.flurrySequenceId) {
      return { ...row, rawXg, flurryAdjustedXg: rawXg, priorNonScoringProbability: 1 };
    }
    const key = `${row.gameId}:${row.flurrySequenceId}`;
    const survival = survivalBySequence.get(key) ?? 1;
    const adjusted = rawXg * survival;
    survivalBySequence.set(key, survival * (1 - rawXg));
    return {
      ...row,
      rawXg,
      flurryAdjustedXg: round(adjusted),
      priorNonScoringProbability: round(survival),
    };
  });
}

export function summarizeFlurryAdjustedXg(rows: FlurryAdjustedPrediction[]) {
  const rawXg = rows.reduce((sum, row) => sum + row.rawXg, 0);
  const flurryAdjustedXg = rows.reduce((sum, row) => sum + row.flurryAdjustedXg, 0);
  return {
    shots: rows.length,
    rawXg: round(rawXg),
    flurryAdjustedXg: round(flurryAdjustedXg),
    adjustment: round(flurryAdjustedXg - rawXg),
    rawPreserved: rows.every((row) => row.flurryAdjustedXg <= row.rawXg + 1e-6),
  };
}
