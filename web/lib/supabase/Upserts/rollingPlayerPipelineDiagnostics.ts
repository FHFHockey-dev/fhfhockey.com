type StrengthState = "all" | "ev" | "pp" | "pk";

type DateLikeRow = {
  date_scraped: string;
};

type WgoLikeRow = {
  date: string;
  game_id: number | null;
  pp_toi?: number | null;
};

type PpLikeRow = {
  gameId: number;
};

type CoverageSample = {
  missingCountsDates: string[];
  missingRatesDates: string[];
  missingCountsOiDates: string[];
  missingPpGameIds: number[];
  unknownGameIds: number[];
};

export type CoverageSummary = {
  warnings: string[];
  sample: CoverageSample;
  counts: {
    expectedDates: number;
    countsRows: number;
    ratesRows: number;
    countsOiRows: number;
    ppExpectedGames: number;
    ppRows: number;
    unknownGameIds: number;
  };
};

type CoverageParams = {
  playerId: number;
  strength: StrengthState;
  wgoRows: WgoLikeRow[];
  countsRows: DateLikeRow[];
  ratesRows: DateLikeRow[];
  countsOiRows: DateLikeRow[];
  ppRows: PpLikeRow[];
  knownGameIds: Set<number>;
};

const MAX_SAMPLES = 3;

function uniqueSortedDates(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function uniqueSortedNumbers(values: Iterable<number>): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function diffDates(expected: string[], actual: Set<string>): string[] {
  return expected.filter((value) => !actual.has(value));
}

function diffNumbers(expected: number[], actual: Set<number>): number[] {
  return expected.filter((value) => !actual.has(value));
}

function formatDateGap(label: string, values: string[]): string | null {
  if (!values.length) return null;
  const sample = values.slice(0, MAX_SAMPLES).join(", ");
  return `${label}:${values.length} sample:[${sample}]`;
}

function formatNumberGap(label: string, values: number[]): string | null {
  if (!values.length) return null;
  const sample = values.slice(0, MAX_SAMPLES).join(", ");
  return `${label}:${values.length} sample:[${sample}]`;
}

export function summarizeCoverage(params: CoverageParams): CoverageSummary {
  const {
    playerId,
    strength,
    wgoRows,
    countsRows,
    ratesRows,
    countsOiRows,
    ppRows,
    knownGameIds
  } = params;

  const countsDates = new Set(countsRows.map((row) => row.date_scraped));
  const ratesDates = new Set(ratesRows.map((row) => row.date_scraped));
  const countsOiDates = new Set(countsOiRows.map((row) => row.date_scraped));
  const ppGameIds = new Set(ppRows.map((row) => row.gameId));

  const allWgoDates = uniqueSortedDates(wgoRows.map((row) => row.date));
  const activeSplitDates = uniqueSortedDates([
    ...countsRows.map((row) => row.date_scraped),
    ...ratesRows.map((row) => row.date_scraped),
    ...countsOiRows.map((row) => row.date_scraped)
  ]);
  const expectedDates = strength === "all" ? allWgoDates : activeSplitDates;

  const missingCountsDates = diffDates(expectedDates, countsDates);
  const missingRatesDates = diffDates(expectedDates, ratesDates);
  const missingCountsOiDates = diffDates(expectedDates, countsOiDates);

  const ppExpectedGameIds =
    strength === "all" || strength === "pp"
      ? uniqueSortedNumbers(
          wgoRows
            .filter((row) => {
              const ppToi = Number(row.pp_toi ?? 0);
              return Number.isFinite(ppToi) && ppToi > 0;
            })
            .map((row) => row.game_id)
            .filter((gameId): gameId is number => typeof gameId === "number")
        )
      : [];
  const missingPpGameIds = diffNumbers(ppExpectedGameIds, ppGameIds);

  const unknownGameIds = uniqueSortedNumbers(
    wgoRows
      .map((row) => row.game_id)
      .filter(
        (gameId): gameId is number =>
          typeof gameId === "number" && !knownGameIds.has(gameId)
      )
  );

  const warningParts = [
    formatDateGap("missingCountsDates", missingCountsDates),
    formatDateGap("missingRatesDates", missingRatesDates),
    formatDateGap("missingCountsOiDates", missingCountsOiDates),
    formatNumberGap("missingPpGameIds", missingPpGameIds),
    formatNumberGap("unknownGameIds", unknownGameIds)
  ].filter((value): value is string => Boolean(value));

  const warnings =
    warningParts.length > 0
      ? [
          `[fetchRollingPlayerAverages] coverage player:${playerId} strength:${strength} expectedDates:${expectedDates.length} counts:${countsRows.length} rates:${ratesRows.length} countsOi:${countsOiRows.length} ppRows:${ppRows.length} ${warningParts.join(
            " "
          )}`
        ]
      : [];

  return {
    warnings,
    sample: {
      missingCountsDates: missingCountsDates.slice(0, MAX_SAMPLES),
      missingRatesDates: missingRatesDates.slice(0, MAX_SAMPLES),
      missingCountsOiDates: missingCountsOiDates.slice(0, MAX_SAMPLES),
      missingPpGameIds: missingPpGameIds.slice(0, MAX_SAMPLES),
      unknownGameIds: unknownGameIds.slice(0, MAX_SAMPLES)
    },
    counts: {
      expectedDates: expectedDates.length,
      countsRows: countsRows.length,
      ratesRows: ratesRows.length,
      countsOiRows: countsOiRows.length,
      ppExpectedGames: ppExpectedGameIds.length,
      ppRows: ppRows.length,
      unknownGameIds: unknownGameIds.length
    }
  };
}

type SuspiciousMetricSpec = {
  min: number;
  max: number;
};

const SUSPICIOUS_METRIC_BOUNDS: Record<string, SuspiciousMetricSpec> = {
  gp_pct: { min: 0, max: 1 },
  shooting_pct: { min: 0, max: 100 },
  primary_points_pct: { min: 0, max: 1 },
  expected_sh_pct: { min: 0, max: 1 },
  ipp: { min: 0, max: 100 },
  oz_start_pct: { min: 0, max: 100 },
  pp_share_pct: { min: 0, max: 1 },
  on_ice_sh_pct: { min: 0, max: 100 },
  pdo: { min: 0, max: 2 },
  cf_pct: { min: 0, max: 100 },
  ff_pct: { min: 0, max: 100 }
};

export function summarizeSuspiciousOutputs(params: {
  playerId: number;
  strength: StrengthState;
  rows: Record<string, unknown>[];
}): { warnings: string[]; issueCount: number } {
  const { playerId, strength, rows } = params;
  const matches: string[] = [];

  for (const row of rows) {
    const gameDate =
      typeof row.game_date === "string" ? row.game_date : "<unknown-date>";
    for (const [metricKey, bounds] of Object.entries(SUSPICIOUS_METRIC_BOUNDS)) {
      for (const [fieldKey, rawValue] of Object.entries(row)) {
        if (!fieldKey.startsWith(`${metricKey}_`)) continue;
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
        if (rawValue < bounds.min || rawValue > bounds.max) {
          matches.push(`${gameDate}:${fieldKey}=${rawValue}`);
        }
      }
    }
  }

  if (!matches.length) {
    return { warnings: [], issueCount: 0 };
  }

  const sample = matches.slice(0, MAX_SAMPLES).join(", ");
  return {
    warnings: [
      `[fetchRollingPlayerAverages] suspicious-output player:${playerId} strength:${strength} issues:${matches.length} sample:[${sample}]`
    ],
    issueCount: matches.length
  };
}
