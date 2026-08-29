import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  computeCtpi,
  computeLegacyTrendMetricsForAuditOnly,
  computeTrendMetrics,
  type CtpiScore,
} from "lib/trends/ctpi";
import {
  buildRecentTeamFormCandidateSnapshot,
  planRecentTeamFormCandidateReplay,
  type PersistedRecentTeamFormSnapshotProvenance,
  type RecentTeamFormSourceRow,
} from "lib/trends/recentTeamFormV2Provenance";
import {
  materializeRecentTeamFormCandidateSnapshot,
  RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
  RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION,
} from "lib/trends/recentTeamFormV2Materialization";

dotenv.config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials for the read-only CTPI audit.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const PAGE_SIZE = 1000;

type SourceRow = {
  season_id: number;
  team_abbreviation: string;
  date: string;
  gp: number | null;
  xgf_per_60?: number | null;
  hdcf_per_60?: number | null;
  gf_per_60?: number | null;
  xga_per_60?: number | null;
  hdca_per_60?: number | null;
  ca_per_60?: number | null;
  cf_pct?: number | null;
  pdo?: number | null;
  gf?: number | null;
  ga?: number | null;
  xgf?: number | null;
  xga?: number | null;
  toi_seconds?: number | null;
  updated_at?: string | null;
};

type PersistedRow = {
  season_id: number;
  team: string;
  date: string;
  computed_at: string;
  ctpi_raw: number;
  ctpi_0_to_100: number;
  offense: number;
  defense: number;
  goaltending: number;
  special_teams: number;
  luck: number;
  payload: Record<string, unknown> | null;
};

type AuditGameRow = RecentTeamFormSourceRow & {
  gf: number | null;
  ga: number | null;
  xgf: number | null;
  xgaCount: number | null;
};

function latestTimestamp(
  ...values: Array<string | null | undefined>
): string | null {
  const timestamps = values
    .flatMap((value) => {
      if (!value) return [];
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? [] : [parsed.toISOString()];
    })
    .sort();
  return timestamps.at(-1) ?? null;
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

async function fetchAllPages<T>(
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await configure(
      supabase.from(table).select(columns),
    ).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return value == null || !Number.isFinite(parsed) ? null : parsed;
}

function mean(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function standardDeviation(values: number[]): number | null {
  const average = mean(values);
  if (average == null) return null;
  return Math.sqrt(
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
      values.length,
  );
}

function quantile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarize(values: Array<number | null | undefined>) {
  const observed = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  return {
    count: observed.length,
    nonzero: observed.filter((value) => Math.abs(value) > 1e-12).length,
    min: observed.length > 0 ? Math.min(...observed) : null,
    p01: quantile(observed, 0.01),
    median: quantile(observed, 0.5),
    p99: quantile(observed, 0.99),
    max: observed.length > 0 ? Math.max(...observed) : null,
    mean: mean(observed),
    standardDeviation: standardDeviation(observed),
  };
}

function pearson(
  rows: Array<Record<string, number | null>>,
  leftKey: string,
  rightKey: string,
): { samples: number; correlation: number | null } {
  const pairs = rows.flatMap((row) => {
    const left = row[leftKey];
    const right = row[rightKey];
    return left != null &&
      right != null &&
      Number.isFinite(left) &&
      Number.isFinite(right)
      ? [[left, right] as const]
      : [];
  });
  if (pairs.length < 2) return { samples: pairs.length, correlation: null };
  const leftMean = mean(pairs.map(([left]) => left)) as number;
  const rightMean = mean(pairs.map(([, right]) => right)) as number;
  const numerator = pairs.reduce(
    (total, [left, right]) => total + (left - leftMean) * (right - rightMean),
    0,
  );
  const leftScale = Math.sqrt(
    pairs.reduce((total, [left]) => total + (left - leftMean) ** 2, 0),
  );
  const rightScale = Math.sqrt(
    pairs.reduce((total, [, right]) => total + (right - rightMean) ** 2, 0),
  );
  return {
    samples: pairs.length,
    correlation:
      leftScale > 0 && rightScale > 0
        ? numerator / (leftScale * rightScale)
        : null,
  };
}

function rankByScore(scores: CtpiScore[]): Map<string, number> {
  const sorted = [...scores].sort(
    (left, right) =>
      right.ctpi_0_to_100 - left.ctpi_0_to_100 ||
      left.team.localeCompare(right.team),
  );
  return new Map(sorted.map((row, index) => [row.team, index + 1]));
}

function sourceKey(row: Pick<SourceRow, "team_abbreviation" | "date">): string {
  return `${row.team_abbreviation}|${row.date}`;
}

function assembleTeamRows(args: {
  rates: SourceRow[];
  counts: SourceRow[];
  pp: SourceRow[];
  pk: SourceRow[];
  exactGamesOnly: boolean;
  useCountGsax: boolean;
}): AuditGameRow[] {
  const eligible = (row: SourceRow) =>
    !args.exactGamesOnly || finite(row.gp) === 1;
  const counts = new Map(
    args.counts.filter(eligible).map((row) => [sourceKey(row), row] as const),
  );
  const pp = new Map(
    args.pp.filter(eligible).map((row) => [sourceKey(row), row] as const),
  );
  const pk = new Map(
    args.pk.filter(eligible).map((row) => [sourceKey(row), row] as const),
  );

  return args.rates.filter(eligible).map((row) => {
    const key = sourceKey(row);
    const countRow = counts.get(key);
    const ppRow = pp.get(key);
    const pkRow = pk.get(key);
    return {
      team: row.team_abbreviation,
      date: row.date,
      gp: row.gp,
      xgf_per_60: row.xgf_per_60,
      hdcf_per_60: row.hdcf_per_60,
      gf_per_60: row.gf_per_60,
      xga_per_60: row.xga_per_60,
      hdca_per_60: row.hdca_per_60,
      ca_per_60: row.ca_per_60,
      sat_pct: row.cf_pct,
      goals_against: args.useCountGsax ? countRow?.ga : row.ga,
      xga: args.useCountGsax ? countRow?.xga : row.xga,
      powerPlayToi: ppRow?.toi_seconds,
      pp_xgf: ppRow?.xgf,
      toi_shorthanded: pkRow?.toi_seconds,
      pk_xga: pkRow?.xga,
      pdo: row.pdo,
      toi_all_seconds: countRow?.toi_seconds,
      sourceUpdatedAt: latestTimestamp(
        row.updated_at,
        countRow?.updated_at,
        ppRow?.updated_at,
        pkRow?.updated_at,
      ),
      gf: countRow?.gf ?? null,
      ga: countRow?.ga ?? null,
      xgf: countRow?.xgf ?? null,
      xgaCount: countRow?.xga ?? null,
    };
  });
}

function scoreAsOf(
  rows: AuditGameRow[],
  date: string,
  useLegacyMixedGrain = false,
): CtpiScore[] {
  const byTeam = new Map<string, AuditGameRow[]>();
  for (const row of rows) {
    if (row.date > date) continue;
    const teamRows = byTeam.get(row.team) ?? [];
    teamRows.push(row);
    byTeam.set(row.team, teamRows);
  }
  return computeCtpi(
    Array.from(byTeam.values()).map((teamRows) =>
      useLegacyMixedGrain
        ? computeLegacyTrendMetricsForAuditOnly(teamRows)
        : computeTrendMetrics(teamRows),
    ),
  );
}

function latestPersistedBefore(
  rows: PersistedRow[],
  team: string,
  date: string,
): PersistedRow | null {
  let latest: PersistedRow | null = null;
  for (const row of rows) {
    if (row.team !== team || row.date >= date) continue;
    if (!latest || row.date > latest.date) latest = row;
  }
  return latest;
}

function buildForwardAssociation(
  gameRows: AuditGameRow[],
  persistedRows: PersistedRow[],
) {
  const gamesByTeam = new Map<string, AuditGameRow[]>();
  for (const row of gameRows) {
    const rows = gamesByTeam.get(row.team) ?? [];
    rows.push(row);
    gamesByTeam.set(row.team, rows);
  }
  for (const rows of gamesByTeam.values()) {
    rows.sort((left, right) => left.date.localeCompare(right.date));
  }

  const scoreCache = new Map<string, Map<string, CtpiScore>>();
  const scoreBefore = (date: string) => {
    const previousDate = new Date(`${date}T00:00:00Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const asOfDate = previousDate.toISOString().slice(0, 10);
    let scores = scoreCache.get(asOfDate);
    if (!scores) {
      scores = new Map(
        scoreAsOf(gameRows, asOfDate).map((score) => [score.team, score]),
      );
      scoreCache.set(asOfDate, scores);
    }
    return scores;
  };

  const samples: Array<Record<string, number | null>> = [];
  for (const [team, rows] of gamesByTeam) {
    for (let index = 10; index < rows.length; index += 1) {
      const score = scoreBefore(rows[index].date).get(team);
      if (!score) continue;
      const priorTen = rows.slice(index - 10, index);
      const sample: Record<string, number | null> = {
        correctedFull: score.ctpi_0_to_100,
        correctedNoLuck:
          50 +
          15 *
            (0.35 * score.offense +
              0.3 * score.defense +
              0.2 * score.goaltending +
              0.15 * score.specialTeams),
        persisted:
          latestPersistedBefore(persistedRows, team, rows[index].date)
            ?.ctpi_0_to_100 ?? null,
        last10GoalDifferential: mean(
          priorTen.flatMap((row) =>
            row.gf != null && row.ga != null ? [row.gf - row.ga] : [],
          ),
        ),
        last10ExpectedGoalDifferential: mean(
          priorTen.flatMap((row) =>
            row.xgf != null && row.xgaCount != null
              ? [row.xgf - row.xgaCount]
              : [],
          ),
        ),
      };
      for (const horizon of [1, 3, 5, 10]) {
        const future = rows.slice(index, index + horizon);
        sample[`next${horizon}GoalDifferential`] =
          future.length === horizon
            ? mean(
                future.flatMap((row) =>
                  row.gf != null && row.ga != null ? [row.gf - row.ga] : [],
                ),
              )
            : null;
        sample[`next${horizon}ExpectedGoalDifferential`] =
          future.length === horizon
            ? mean(
                future.flatMap((row) =>
                  row.xgf != null && row.xgaCount != null
                    ? [row.xgf - row.xgaCount]
                    : [],
                ),
              )
            : null;
      }
      samples.push(sample);
    }
  }

  const predictors = [
    "persisted",
    "correctedFull",
    "correctedNoLuck",
    "last10GoalDifferential",
    "last10ExpectedGoalDifferential",
  ];
  const results: Record<string, unknown> = {};
  for (const horizon of [1, 3, 5, 10]) {
    for (const outcome of ["GoalDifferential", "ExpectedGoalDifferential"]) {
      const outcomeKey = `next${horizon}${outcome}`;
      results[outcomeKey] = Object.fromEntries(
        predictors.map((predictor) => [
          predictor,
          pearson(samples, predictor, outcomeKey),
        ]),
      );
    }
  }
  return { evaluationRows: samples.length, correlations: results };
}

async function main() {
  const requestedSeason = Number(parseArg("season") ?? 20252026);
  const requestedDate = parseArg("date") ?? "2026-02-05";
  const auditGeneratedAt = new Date().toISOString();
  if (!Number.isSafeInteger(requestedSeason)) {
    throw new Error("--season must be an integer season id.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }

  const [persisted, rates, counts, pp, pk] = await Promise.all([
    fetchAllPages<PersistedRow>(
      "team_ctpi_daily",
      "season_id,team,date,computed_at,ctpi_raw,ctpi_0_to_100,offense,defense,goaltending,special_teams,luck,payload",
      (query) =>
        query
          .eq("season_id", requestedSeason)
          .order("date", { ascending: true })
          .order("team", { ascending: true }),
    ),
    fetchAllPages<SourceRow>(
      "nst_team_gamelogs_as_rates",
      "season_id,team_abbreviation,date,gp,xgf_per_60,hdcf_per_60,gf_per_60,xga_per_60,hdca_per_60,ca_per_60,cf_pct,pdo,ga,xga,toi_seconds,updated_at",
      (query) =>
        query
          .eq("season_id", requestedSeason)
          .order("date", { ascending: true })
          .order("team_abbreviation", { ascending: true }),
    ),
    fetchAllPages<SourceRow>(
      "nst_team_gamelogs_as_counts",
      "season_id,team_abbreviation,date,gp,gf,ga,xgf,xga,toi_seconds,updated_at",
      (query) =>
        query
          .eq("season_id", requestedSeason)
          .order("date", { ascending: true })
          .order("team_abbreviation", { ascending: true }),
    ),
    fetchAllPages<SourceRow>(
      "nst_team_gamelogs_pp_counts",
      "season_id,team_abbreviation,date,gp,xgf,toi_seconds,updated_at",
      (query) =>
        query
          .eq("season_id", requestedSeason)
          .order("date", { ascending: true })
          .order("team_abbreviation", { ascending: true }),
    ),
    fetchAllPages<SourceRow>(
      "nst_team_gamelogs_pk_counts",
      "season_id,team_abbreviation,date,gp,xga,toi_seconds,updated_at",
      (query) =>
        query
          .eq("season_id", requestedSeason)
          .order("date", { ascending: true })
          .order("team_abbreviation", { ascending: true }),
    ),
  ]);

  const legacyRows = assembleTeamRows({
    rates,
    counts,
    pp,
    pk,
    exactGamesOnly: false,
    useCountGsax: false,
  });
  const correctedRows = assembleTeamRows({
    rates,
    counts,
    pp,
    pk,
    exactGamesOnly: true,
    useCountGsax: true,
  });
  const candidateSnapshot = buildRecentTeamFormCandidateSnapshot(
    correctedRows,
    requestedDate,
  );
  const candidateMaterialization = materializeRecentTeamFormCandidateSnapshot({
    snapshot: candidateSnapshot,
    seasonId: requestedSeason,
    computedAt: auditGeneratedAt,
  });
  const candidateScoresByTeam = new Map(
    candidateSnapshot.scores.map((score) => [score.team, score] as const),
  );
  const exactMaterializedReadbacks = candidateMaterialization.rows.filter(
    (row) => {
      const score = candidateScoresByTeam.get(row.team);
      return (
        score != null &&
        row.ctpi_raw === score.ctpi_raw &&
        row.ctpi_0_to_100 === score.ctpi_0_to_100 &&
        row.offense === score.components.offense &&
        row.defense === score.components.defense &&
        row.goaltending === score.components.goaltending &&
        row.special_teams === score.components.specialTeams &&
        row.luck == null &&
        row.payload.sourceCutoffExclusive === requestedDate &&
        row.payload.sourceFingerprint ===
          candidateSnapshot.provenance.sourceFingerprint &&
        row.payload.publicationStatus ===
          RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS
      );
    },
  ).length;
  const persistedAtDate = persisted.filter((row) => row.date === requestedDate);
  const persistedCandidateProvenance = persistedAtDate.map(
    (row): PersistedRecentTeamFormSnapshotProvenance => {
      const payload = row.payload ?? {};
      const stringField = (key: string): string | null =>
        typeof payload[key] === "string" ? (payload[key] as string) : null;
      return {
        date: row.date,
        formulaVersion: stringField("formulaVersion"),
        inputVersion: stringField("inputVersion"),
        sourceCutoffExclusive: stringField("sourceCutoffExclusive"),
        sourceFingerprint: stringField("sourceFingerprint"),
        sourceUpdatedThrough: stringField("sourceUpdatedThrough"),
      };
    },
  );
  const candidateReplayPlan = planRecentTeamFormCandidateReplay({
    sourceRows: correctedRows,
    consumerDates: [requestedDate],
    persisted: persistedCandidateProvenance,
  });
  const persistedByTeam = new Map(
    persistedAtDate.map((row) => [row.team, row] as const),
  );
  const legacyScores = scoreAsOf(legacyRows, requestedDate, true);
  const correctedScores = scoreAsOf(correctedRows, requestedDate);
  const correctedRanks = rankByScore(correctedScores);
  const persistedRanks = rankByScore(
    persistedAtDate.map((row) => ({
      team: row.team,
      offense: row.offense,
      defense: row.defense,
      goaltending: row.goaltending,
      specialTeams: row.special_teams,
      luck: row.luck,
      ctpi_raw: row.ctpi_raw,
      ctpi_0_to_100: row.ctpi_0_to_100,
      z: {},
    })),
  );
  const reconciliation = correctedScores.map((score) => {
    const persistedRow = persistedByTeam.get(score.team);
    return {
      team: score.team,
      persisted: persistedRow?.ctpi_0_to_100 ?? null,
      correctedInputs: score.ctpi_0_to_100,
      absoluteDelta:
        persistedRow == null
          ? null
          : Math.abs(score.ctpi_0_to_100 - persistedRow.ctpi_0_to_100),
      persistedRank: persistedRanks.get(score.team) ?? null,
      correctedRank: correctedRanks.get(score.team) ?? null,
      absoluteRankShift:
        persistedRanks.has(score.team) && correctedRanks.has(score.team)
          ? Math.abs(
              (persistedRanks.get(score.team) as number) -
                (correctedRanks.get(score.team) as number),
            )
          : null,
    };
  });
  const legacyByTeam = new Map(
    legacyScores.map((score) => [score.team, score] as const),
  );
  const legacyReproductionDeltas = persistedAtDate.flatMap((row) => {
    const score = legacyByTeam.get(row.team);
    return score ? [Math.abs(score.ctpi_0_to_100 - row.ctpi_0_to_100)] : [];
  });

  const featureRows = persisted.flatMap((row) => {
    const payload = row.payload as { z?: Record<string, unknown> } | null;
    const z = payload?.z;
    return z
      ? [
          Object.fromEntries(
            Object.entries(z).map(([key, value]) => [key, finite(value)]),
          ) as Record<string, number | null>,
        ]
      : [];
  });
  const featurePairs = [
    ["xgf", "hdcf"],
    ["xgf", "gf"],
    ["hdcf", "gf"],
    ["xga", "hdca"],
    ["xga", "ca"],
    ["hdca", "ca"],
    ["pdo", "gf"],
    ["pdo", "gsax_last10"],
  ] as const;

  const sourceSummary = (rows: SourceRow[]) => ({
    rows: rows.length,
    exactGameRows: rows.filter((row) => finite(row.gp) === 1).length,
    aggregateRows: rows.filter((row) => (finite(row.gp) ?? 0) > 1).length,
    missingGpRows: rows.filter((row) => finite(row.gp) == null).length,
  });
  const sameDayLeakageKeys = new Set(
    rates
      .filter((row) => finite(row.gp) === 1)
      .map((row) => `${row.team_abbreviation}|${row.date}`),
  );
  const aggregateRowsByDate = new Map<string, number>();
  for (const row of rates) {
    if ((finite(row.gp) ?? 0) <= 1) continue;
    aggregateRowsByDate.set(
      row.date,
      (aggregateRowsByDate.get(row.date) ?? 0) + 1,
    );
  }

  const output = {
    generatedAt: auditGeneratedAt,
    readOnly: true,
    seasonId: requestedSeason,
    representativeDate: requestedDate,
    formulaContract: {
      recency: "linear weights 1.0 through 0.1 over the latest 10 source rows",
      offense: "0.50*z(xGF/60) + 0.30*z(HDCF/60) + 0.20*z(GF/60)",
      defense: "0.50*-z(xGA/60) + 0.30*-z(HDCA/60) + 0.20*-z(CA/60)",
      goaltending: "0.40*z(season GSAx/60) + 0.60*z(last-10 GSAx/60)",
      specialTeams: "0.55*z(PP xGF/60) + 0.45*-z(PK xGA/60)",
      luck: "z(PDO)",
      raw: "0.35*offense + 0.30*defense + 0.20*goaltending + 0.15*specialTeams + 0.10*luck",
      displayed: "50 + 15*raw (unclipped)",
      topLevelWeightTotal: 1.1,
    },
    coverage: {
      persisted: sourceSummary(
        persisted.map((row) => ({
          season_id: row.season_id,
          team_abbreviation: row.team,
          date: row.date,
          gp: null,
        })),
      ),
      allStrengthRates: sourceSummary(rates),
      allStrengthCounts: sourceSummary(counts),
      powerPlayCounts: sourceSummary(pp),
      penaltyKillCounts: sourceSummary(pk),
      seasonsObserved: Array.from(
        new Set(persisted.map((row) => row.season_id)),
      ).sort(),
      teamsObserved: new Set(persisted.map((row) => row.team)).size,
      persistedDates: new Set(persisted.map((row) => row.date)).size,
    },
    sourceIntegrity: {
      candidateStrictPregameSnapshot: {
        formulaVersion: candidateSnapshot.formulaVersion,
        inputVersion: candidateSnapshot.inputVersion,
        ...candidateSnapshot.provenance,
        scoredTeams: candidateSnapshot.scores.filter(
          (row) => row.ctpi_0_to_100 != null,
        ).length,
        unavailableTeams: candidateSnapshot.scores.filter(
          (row) => row.ctpi_0_to_100 == null,
        ).length,
      },
      candidateMaterialization: {
        publicationStatus: RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
        materializationContractVersion:
          RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION,
        persistenceApplied: false,
        schemaMigrationStatus: "staged_not_applied",
        ...candidateMaterialization.coverage,
        exactMaterializedReadbacks,
        allMaterializedRowsRoundTripExactly:
          exactMaterializedReadbacks === candidateMaterialization.rows.length,
        omitted: candidateMaterialization.omitted,
      },
      candidateReplayPlan: {
        replay: candidateReplayPlan.replay.map((row) => ({
          date: row.date,
          reasons: row.reasons,
        })),
        unchangedDates: candidateReplayPlan.unchangedDates,
      },
      aggregateRowsByDate: {
        datesWithAggregateRows: aggregateRowsByDate.size,
        datesWithAll32AggregateRows: Array.from(
          aggregateRowsByDate.values(),
        ).filter((count) => count === 32).length,
      },
      persistedTeamDatesExposedToSameDayResults: persisted.filter((row) =>
        sameDayLeakageKeys.has(`${row.team}|${row.date}`),
      ).length,
      rateRowsWithRawGa: rates.filter((row) => finite(row.ga) != null).length,
      rateRowsWithRawXga: rates.filter((row) => finite(row.xga) != null).length,
      countRowsWithRawGaAndXga: counts.filter(
        (row) => finite(row.ga) != null && finite(row.xga) != null,
      ).length,
      persistedRowsWithNonzeroGoaltending: persisted.filter(
        (row) => Math.abs(row.goaltending) > 1e-12,
      ).length,
    },
    persistedDistribution: {
      score: summarize(persisted.map((row) => row.ctpi_0_to_100)),
      offense: summarize(persisted.map((row) => row.offense)),
      defense: summarize(persisted.map((row) => row.defense)),
      goaltending: summarize(persisted.map((row) => row.goaltending)),
      specialTeams: summarize(persisted.map((row) => row.special_teams)),
      luck: summarize(persisted.map((row) => row.luck)),
      outOfRangeScores: persisted.filter(
        (row) => row.ctpi_0_to_100 < 0 || row.ctpi_0_to_100 > 100,
      ).length,
    },
    redundancy: Object.fromEntries(
      featurePairs.map(([left, right]) => [
        `${left}~${right}`,
        pearson(featureRows, left, right),
      ]),
    ),
    representativeReconciliation: {
      persistedTeams: persistedAtDate.length,
      legacyFormulaTeams: legacyScores.length,
      correctedInputTeams: correctedScores.length,
      legacyReproductionDelta: summarize(legacyReproductionDeltas),
      correctedVsPersistedAbsoluteScoreDelta: summarize(
        reconciliation.map((row) => row.absoluteDelta),
      ),
      correctedVsPersistedAbsoluteRankShift: summarize(
        reconciliation.map((row) => row.absoluteRankShift),
      ),
      largestChanges: reconciliation
        .filter((row) => row.absoluteDelta != null)
        .sort(
          (left, right) =>
            (right.absoluteDelta as number) - (left.absoluteDelta as number),
        )
        .slice(0, 10),
    },
    forwardAssociation: buildForwardAssociation(correctedRows, persisted),
    limitations: [
      "Only one persisted CTPI season is available, so multi-season and era stability cannot be established.",
      "Forward correlations are unadjusted descriptive diagnostics; they do not control opponent, venue, rest, roster changes, or repeated team observations.",
      "No formula weights are fitted or selected by this audit.",
    ],
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
