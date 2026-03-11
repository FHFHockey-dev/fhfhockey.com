import { ROLLING_METRIC_SCALE_CONTRACTS } from "./rollingMetricScaleContract";

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
  unit?: number | null;
};

type LineLikeRow = {
  gameId: number;
};

type CoverageSample = {
  missingCountsDates: string[];
  missingRatesDates: string[];
  missingCountsOiDates: string[];
  missingPpGameIds: number[];
  missingPpShareGameIds: number[];
  missingPpUnitGameIds: number[];
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
    ppUnitMissingGames: number;
    unknownGameIds: number;
  };
};

export type SourceTailFreshnessSummary = {
  warnings: string[];
  blockers: {
    countsTailLag: number;
    ratesTailLag: number;
    countsOiTailLag: number;
    ppTailLag: number;
    lineTailLag: number;
  };
  latest: {
    wgoDate: string | null;
    countsDate: string | null;
    ratesDate: string | null;
    countsOiDate: string | null;
    expectedPpGameId: number | null;
    ppGameId: number | null;
    expectedLineGameId: number | null;
    lineGameId: number | null;
  };
};

type PairCompletenessSummary = {
  complete: number;
  partial: number;
  absent: number;
  invalid: number;
};

type WindowComponentCompletenessSummary = PairCompletenessSummary & {
  valuePresentWithoutComponents: number;
};

type ScopeKey = "season" | "3ya" | "career" | "last3" | "last5" | "last10" | "last20";

export type DerivedWindowDiagnosticsSummary = {
  gpWindows: Record<ScopeKey, PairCompletenessSummary>;
  ratioWindows: Record<
    "primary_points_pct" | "ipp" | "on_ice_sh_pct" | "pp_share_pct" | "pdo",
    Record<"last3" | "last5" | "last10" | "last20", WindowComponentCompletenessSummary>
  >;
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

type SourceTailFreshnessParams = {
  playerId: number;
  strength: StrengthState;
  wgoRows: WgoLikeRow[];
  countsRows: DateLikeRow[];
  ratesRows: DateLikeRow[];
  countsOiRows: DateLikeRow[];
  ppRows: PpLikeRow[];
  lineRows: LineLikeRow[];
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
  const missingPpUnitGameIds =
    strength === "all" || strength === "pp"
      ? uniqueSortedNumbers(
          ppRows
            .filter(
              (row) =>
                ppExpectedGameIds.includes(row.gameId) &&
                (row.unit == null ||
                  !Number.isFinite(Number(row.unit)) ||
                  Number(row.unit) <= 0)
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
    formatNumberGap("missingPpUnitGameIds", missingPpUnitGameIds),
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
      missingPpUnitGameIds: missingPpUnitGameIds.slice(0, MAX_SAMPLES),
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
      ppUnitMissingGames: missingPpUnitGameIds.length,
      unknownGameIds: unknownGameIds.length
    }
  };
}

function getLatestDate(rows: DateLikeRow[]): string | null {
  if (!rows.length) return null;
  return rows.reduce<string | null>(
    (latest, row) =>
      latest == null || row.date_scraped > latest ? row.date_scraped : latest,
    null
  );
}

function countDatesAfter(rows: WgoLikeRow[], latestDate: string | null): number {
  if (!latestDate) return rows.length;
  return rows.filter((row) => row.date > latestDate).length;
}

function countNumbersAfter(values: number[], latest: number | null): number {
  if (latest == null) return values.length;
  return values.filter((value) => value > latest).length;
}

export function summarizeSourceTailFreshness(
  params: SourceTailFreshnessParams
): SourceTailFreshnessSummary {
  const latestWgoDate =
    params.wgoRows.length > 0 ? params.wgoRows[params.wgoRows.length - 1]?.date ?? null : null;
  const latestCountsDate = getLatestDate(params.countsRows);
  const latestRatesDate = getLatestDate(params.ratesRows);
  const latestCountsOiDate = getLatestDate(params.countsOiRows);

  const countsTailLag = countDatesAfter(params.wgoRows, latestCountsDate);
  const ratesTailLag = countDatesAfter(params.wgoRows, latestRatesDate);
  const countsOiTailLag = countDatesAfter(params.wgoRows, latestCountsOiDate);

  const expectedPpGameIds = uniqueSortedNumbers(
    params.wgoRows
      .filter((row) => {
        const ppToi = Number(row.pp_toi ?? 0);
        return Number.isFinite(ppToi) && ppToi > 0;
      })
      .map((row) => row.game_id)
      .filter((gameId): gameId is number => typeof gameId === "number")
  );
  const latestPpGameId = params.ppRows.reduce<number | null>(
    (latest, row) => (latest == null || row.gameId > latest ? row.gameId : latest),
    null
  );
  const ppTailLag =
    params.strength === "all" || params.strength === "pp"
      ? countNumbersAfter(expectedPpGameIds, latestPpGameId)
      : 0;

  const expectedLineGameIds = uniqueSortedNumbers(
    params.wgoRows
      .map((row) => row.game_id)
      .filter((gameId): gameId is number => typeof gameId === "number")
  );
  const latestLineGameId = params.lineRows.reduce<number | null>(
    (latest, row) => (latest == null || row.gameId > latest ? row.gameId : latest),
    null
  );
  const lineTailLag = countNumbersAfter(expectedLineGameIds, latestLineGameId);

  const warningParts = [
    countsTailLag > 0
      ? `countsTailLag:${countsTailLag} latestCountsDate:${latestCountsDate ?? "none"}`
      : null,
    ratesTailLag > 0
      ? `ratesTailLag:${ratesTailLag} latestRatesDate:${latestRatesDate ?? "none"}`
      : null,
    countsOiTailLag > 0
      ? `countsOiTailLag:${countsOiTailLag} latestCountsOiDate:${latestCountsOiDate ?? "none"}`
      : null,
    ppTailLag > 0
      ? `ppTailLag:${ppTailLag} latestPpGameId:${latestPpGameId ?? "none"} expectedPpGameId:${
          expectedPpGameIds.at(-1) ?? "none"
        }`
      : null,
    lineTailLag > 0
      ? `lineTailLag:${lineTailLag} latestLineGameId:${latestLineGameId ?? "none"} expectedLineGameId:${
          expectedLineGameIds.at(-1) ?? "none"
        }`
      : null
  ].filter((value): value is string => Boolean(value));

  const warnings =
    warningParts.length > 0
      ? [
          `[fetchRollingPlayerAverages] source-tail player:${params.playerId} strength:${params.strength} latestWgoDate:${
            latestWgoDate ?? "none"
          } ${warningParts.join(" ")}`
        ]
      : [];

  return {
    warnings,
    blockers: {
      countsTailLag,
      ratesTailLag,
      countsOiTailLag,
      ppTailLag,
      lineTailLag
    },
    latest: {
      wgoDate: latestWgoDate,
      countsDate: latestCountsDate,
      ratesDate: latestRatesDate,
      countsOiDate: latestCountsOiDate,
      expectedPpGameId: expectedPpGameIds.at(-1) ?? null,
      ppGameId: latestPpGameId,
      expectedLineGameId: expectedLineGameIds.at(-1) ?? null,
      lineGameId: latestLineGameId
    }
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function createPairSummary(): PairCompletenessSummary {
  return {
    complete: 0,
    partial: 0,
    absent: 0,
    invalid: 0
  };
}

function createWindowComponentSummary(): WindowComponentCompletenessSummary {
  return {
    ...createPairSummary(),
    valuePresentWithoutComponents: 0
  };
}

function updatePairSummary(args: {
  summary: PairCompletenessSummary;
  numerator: unknown;
  denominator: unknown;
}): void {
  const numeratorValue = isFiniteNumber(args.numerator) ? args.numerator : null;
  const denominatorValue = isFiniteNumber(args.denominator)
    ? args.denominator
    : null;
  const numeratorPresent = numeratorValue != null;
  const denominatorPresent = denominatorValue != null;

  if (!numeratorPresent && !denominatorPresent) {
    args.summary.absent += 1;
    return;
  }
  if (!numeratorPresent || !denominatorPresent) {
    args.summary.partial += 1;
    return;
  }

  args.summary.complete += 1;
  if (numeratorValue > denominatorValue) {
    args.summary.invalid += 1;
  }
}

function updateWindowComponentSummary(args: {
  summary: WindowComponentCompletenessSummary;
  value: unknown;
  numerators: unknown[];
  denominators: unknown[];
}): void {
  const valuePresent = isFiniteNumber(args.value);
  const components = [...args.numerators, ...args.denominators];
  const presentCount = components.filter(isFiniteNumber).length;

  if (presentCount === 0) {
    args.summary.absent += 1;
    if (valuePresent) args.summary.valuePresentWithoutComponents += 1;
    return;
  }

  if (presentCount !== components.length) {
    args.summary.partial += 1;
    if (valuePresent) args.summary.valuePresentWithoutComponents += 1;
    return;
  }

  args.summary.complete += 1;
  const numeratorTotal = args.numerators.reduce<number>(
    (sum, value) => sum + (isFiniteNumber(value) ? Number(value) : 0),
    0
  );
  const denominatorTotal = args.denominators.reduce<number>(
    (sum, value) => sum + (isFiniteNumber(value) ? Number(value) : 0),
    0
  );
  if (numeratorTotal > denominatorTotal) {
    args.summary.invalid += 1;
  }
}

export function summarizeDerivedWindowDiagnostics(params: {
  rows: Record<string, unknown>[];
}): DerivedWindowDiagnosticsSummary {
  const gpWindows: DerivedWindowDiagnosticsSummary["gpWindows"] = {
    season: createPairSummary(),
    "3ya": createPairSummary(),
    career: createPairSummary(),
    last3: createPairSummary(),
    last5: createPairSummary(),
    last10: createPairSummary(),
    last20: createPairSummary()
  };

  const ratioWindows: DerivedWindowDiagnosticsSummary["ratioWindows"] = {
    primary_points_pct: {
      last3: createWindowComponentSummary(),
      last5: createWindowComponentSummary(),
      last10: createWindowComponentSummary(),
      last20: createWindowComponentSummary()
    },
    ipp: {
      last3: createWindowComponentSummary(),
      last5: createWindowComponentSummary(),
      last10: createWindowComponentSummary(),
      last20: createWindowComponentSummary()
    },
    on_ice_sh_pct: {
      last3: createWindowComponentSummary(),
      last5: createWindowComponentSummary(),
      last10: createWindowComponentSummary(),
      last20: createWindowComponentSummary()
    },
    pp_share_pct: {
      last3: createWindowComponentSummary(),
      last5: createWindowComponentSummary(),
      last10: createWindowComponentSummary(),
      last20: createWindowComponentSummary()
    },
    pdo: {
      last3: createWindowComponentSummary(),
      last5: createWindowComponentSummary(),
      last10: createWindowComponentSummary(),
      last20: createWindowComponentSummary()
    }
  };

  for (const row of params.rows) {
    updatePairSummary({
      summary: gpWindows.season,
      numerator: row.season_games_played,
      denominator: row.season_team_games_available
    });
    updatePairSummary({
      summary: gpWindows["3ya"],
      numerator: row.three_year_games_played,
      denominator: row.three_year_team_games_available
    });
    updatePairSummary({
      summary: gpWindows.career,
      numerator: row.career_games_played,
      denominator: row.career_team_games_available
    });

    ([3, 5, 10, 20] as const).forEach((size) => {
      const scopeKey = `last${size}` as const;
      updatePairSummary({
        summary: gpWindows[scopeKey],
        numerator: row[`games_played_last${size}_team_games`],
        denominator: row[`team_games_available_last${size}`]
      });

      updateWindowComponentSummary({
        summary: ratioWindows.primary_points_pct[scopeKey],
        value: row[`primary_points_pct_${scopeKey}`],
        numerators: [row[`primary_points_pct_primary_points_last${size}`]],
        denominators: [row[`primary_points_pct_points_last${size}`]]
      });
      updateWindowComponentSummary({
        summary: ratioWindows.ipp[scopeKey],
        value: row[`ipp_${scopeKey}`],
        numerators: [row[`ipp_points_last${size}`]],
        denominators: [row[`ipp_on_ice_goals_for_last${size}`]]
      });
      updateWindowComponentSummary({
        summary: ratioWindows.on_ice_sh_pct[scopeKey],
        value: row[`on_ice_sh_pct_${scopeKey}`],
        numerators: [row[`on_ice_sh_pct_goals_for_last${size}`]],
        denominators: [row[`on_ice_sh_pct_shots_for_last${size}`]]
      });
      updateWindowComponentSummary({
        summary: ratioWindows.pp_share_pct[scopeKey],
        value: row[`pp_share_pct_${scopeKey}`],
        numerators: [row[`pp_share_pct_player_pp_toi_last${size}`]],
        denominators: [row[`pp_share_pct_team_pp_toi_last${size}`]]
      });
      updateWindowComponentSummary({
        summary: ratioWindows.pdo[scopeKey],
        value: row[`pdo_${scopeKey}`],
        numerators: [
          row[`pdo_goals_for_last${size}`],
          row[`pdo_goals_against_last${size}`]
        ],
        denominators: [
          row[`pdo_shots_for_last${size}`],
          row[`pdo_shots_against_last${size}`]
        ]
      });
    });
  }

  return {
    gpWindows,
    ratioWindows
  };
}

type SuspiciousMetricSpec = {
  min: number;
  max: number;
};

const SUSPICIOUS_METRIC_BOUNDS: Record<string, SuspiciousMetricSpec> =
  ROLLING_METRIC_SCALE_CONTRACTS;
const LEGACY_LAST_N_SUFFIXES = ["3", "5", "10", "20"] as const;

function isScaledMetricSnapshotField(metricKey: string, fieldKey: string): boolean {
  if (metricKey === "availability_pct") {
    return (
      fieldKey === "season_availability_pct" ||
      fieldKey === "three_year_availability_pct" ||
      fieldKey === "career_availability_pct" ||
      LEGACY_LAST_N_SUFFIXES.some(
        (size) => fieldKey === `availability_pct_last${size}_team_games`
      )
    );
  }

  if (metricKey === "gp_pct") {
    const explicitLegacyFields = new Set([
      "gp_pct_total_all",
      "gp_pct_avg_all",
      "gp_pct_avg_season",
      "gp_pct_avg_3ya",
      "gp_pct_avg_career"
    ]);
    if (explicitLegacyFields.has(fieldKey)) {
      return true;
    }
    return LEGACY_LAST_N_SUFFIXES.some(
      (size) =>
        fieldKey === `gp_pct_total_last${size}` ||
        fieldKey === `gp_pct_avg_last${size}`
    );
  }

  const canonicalScopes = new Set([
    `${metricKey}_all`,
    `${metricKey}_last3`,
    `${metricKey}_last5`,
    `${metricKey}_last10`,
    `${metricKey}_last20`,
    `${metricKey}_season`,
    `${metricKey}_3ya`,
    `${metricKey}_career`
  ]);
  if (canonicalScopes.has(fieldKey)) {
    return true;
  }

  const explicitLegacyFields = new Set([
    `${metricKey}_total_all`,
    `${metricKey}_avg_all`,
    `${metricKey}_avg_season`,
    `${metricKey}_avg_3ya`,
    `${metricKey}_avg_career`
  ]);
  if (explicitLegacyFields.has(fieldKey)) {
    return true;
  }

  return LEGACY_LAST_N_SUFFIXES.some(
    (size) =>
      fieldKey === `${metricKey}_total_last${size}` ||
      fieldKey === `${metricKey}_avg_last${size}`
  );
}

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
        if (!isScaledMetricSnapshotField(metricKey, fieldKey)) continue;
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
