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
  pp_share_of_team?: number | null;
};

type CoverageSample = {
  missingCountsDates: string[];
  missingRatesDates: string[];
  missingCountsOiDates: string[];
  missingPpGameIds: number[];
  missingPpShareGameIds: number[];
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
    ppShareMissingGames: number;
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
  const missingPpShareGameIds =
    strength === "all" || strength === "pp"
      ? uniqueSortedNumbers(
          ppRows
            .filter(
              (row) =>
                ppExpectedGameIds.includes(row.gameId) &&
                (row.pp_share_of_team == null ||
                  !Number.isFinite(Number(row.pp_share_of_team)))
            )
            .map((row) => row.gameId)
        )
      : [];

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
    formatNumberGap("missingPpShareGameIds", missingPpShareGameIds),
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
      missingPpShareGameIds: missingPpShareGameIds.slice(0, MAX_SAMPLES),
      unknownGameIds: unknownGameIds.slice(0, MAX_SAMPLES)
    },
    counts: {
      expectedDates: expectedDates.length,
      countsRows: countsRows.length,
      ratesRows: ratesRows.length,
      countsOiRows: countsOiRows.length,
      ppExpectedGames: ppExpectedGameIds.length,
      ppRows: ppRows.length,
      ppShareMissingGames: missingPpShareGameIds.length,
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
  const toFiniteNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const pushRatioMismatch = (
    gameDate: string,
    ratioField: string,
    ratioValue: number | null,
    numeratorField: string,
    denominatorField: string,
    numeratorValue: number | null,
    denominatorValue: number | null
  ) => {
    if (
      ratioValue == null ||
      numeratorValue == null ||
      denominatorValue == null ||
      denominatorValue <= 0
    ) {
      return;
    }

    if (numeratorValue > denominatorValue) {
      matches.push(
        `${gameDate}:${numeratorField}=${numeratorValue}>${denominatorField}=${denominatorValue}`
      );
      return;
    }

    const expected = Number(Math.min(1, numeratorValue / denominatorValue).toFixed(6));
    if (Math.abs(expected - ratioValue) > 0.000001) {
      matches.push(
        `${gameDate}:${ratioField}=${ratioValue} expected:${expected} from ${numeratorField}/${denominatorField}`
      );
    }
  };

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

    pushRatioMismatch(
      gameDate,
      "gp_pct_total_all",
      toFiniteNumber(row.gp_pct_total_all),
      "games_played",
      "team_games_played",
      toFiniteNumber(row.games_played),
      toFiniteNumber(row.team_games_played)
    );

    pushRatioMismatch(
      gameDate,
      "season_availability_pct",
      toFiniteNumber(row.season_availability_pct),
      "season_games_played",
      "season_team_games_available",
      toFiniteNumber(row.season_games_played),
      toFiniteNumber(row.season_team_games_available)
    );
    pushRatioMismatch(
      gameDate,
      "three_year_availability_pct",
      toFiniteNumber(row.three_year_availability_pct),
      "three_year_games_played",
      "three_year_team_games_available",
      toFiniteNumber(row.three_year_games_played),
      toFiniteNumber(row.three_year_team_games_available)
    );
    pushRatioMismatch(
      gameDate,
      "career_availability_pct",
      toFiniteNumber(row.career_availability_pct),
      "career_games_played",
      "career_team_games_available",
      toFiniteNumber(row.career_games_played),
      toFiniteNumber(row.career_team_games_available)
    );

    (["3", "5", "10", "20"] as const).forEach((size) => {
      pushRatioMismatch(
        gameDate,
        `gp_pct_total_last${size}`,
        toFiniteNumber(row[`gp_pct_total_last${size}`]),
        `games_played_last${size}_team_games`,
        `team_games_available_last${size}`,
        toFiniteNumber(row[`games_played_last${size}_team_games`]),
        toFiniteNumber(row[`team_games_available_last${size}`])
      );
      pushRatioMismatch(
        gameDate,
        `availability_pct_last${size}_team_games`,
        toFiniteNumber(row[`availability_pct_last${size}_team_games`]),
        `games_played_last${size}_team_games`,
        `team_games_available_last${size}`,
        toFiniteNumber(row[`games_played_last${size}_team_games`]),
        toFiniteNumber(row[`team_games_available_last${size}`])
      );
    });
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
