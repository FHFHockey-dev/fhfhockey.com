import * as cheerio from "cheerio";
import dotenv from "dotenv";

import { fetchNstText } from "lib/nst/client";
import { teamNameToAbbreviationMap } from "lib/teamsInfo";
import {
  computeCtpi,
  computeTrendMetrics,
  type CtpiScore,
  type TeamGameRow,
} from "lib/trends/ctpi";
import {
  computeRecentTeamFormCandidateMetrics,
  computeRecentTeamFormCandidateV2,
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
  type RecentTeamFormCandidateScore,
} from "lib/trends/recentTeamFormV2";

dotenv.config({ path: ".env.local", quiet: true });

const DATASETS = [
  { key: "allCounts", situation: "all", rate: "n" },
  { key: "allRates", situation: "all", rate: "y" },
  { key: "powerPlayCounts", situation: "pp", rate: "n" },
  { key: "penaltyKillCounts", situation: "pk", rate: "n" },
] as const;

const HISTORICAL_TEAM_NAMES: Record<string, string> = {
  "Arizona Coyotes": "ARI",
  "Utah Hockey Club": "UTA",
};

type DatasetKey = (typeof DATASETS)[number]["key"];

type ProviderRow = {
  seasonId: number;
  team: string;
  date: string;
  toiSeconds: number | null;
  gf: number | null;
  ga: number | null;
  xgf: number | null;
  xga: number | null;
  xgfPer60: number | null;
  xgaPer60: number | null;
  hdcfPer60: number | null;
  hdcaPer60: number | null;
  gfPer60: number | null;
  caPer60: number | null;
  pdo: number | null;
};

type AuditGameRow = TeamGameRow & {
  seasonId: number;
  gf: number | null;
  ga: number | null;
  xgf: number | null;
  xgaCount: number | null;
};

type ValidationSample = {
  seasonId: number;
  team: string;
  date: string;
  legacyScore: number;
  candidateScore: number;
  offense: number | null;
  defense: number | null;
  goaltending: number | null;
  specialTeams: number | null;
  recentGoalDifferential: number | null;
  recentExpectedGoalDifferential: number | null;
  recentXgfPer60: number | null;
  recentNegativeXgaPer60: number | null;
  recentGsaxPer60: number | null;
  recentSpecialTeamsNet: number | null;
  next1GoalDifferential: number | null;
  next3GoalDifferential: number | null;
  next5GoalDifferential: number | null;
  next10GoalDifferential: number | null;
  next1ExpectedGoalDifferential: number | null;
  next3ExpectedGoalDifferential: number | null;
  next5ExpectedGoalDifferential: number | null;
  next10ExpectedGoalDifferential: number | null;
};

type SeasonData = {
  seasonId: number;
  rows: AuditGameRow[];
  coverage: {
    teamGames: number;
    teams: number;
    dates: number;
    datasetRows: Record<DatasetKey, number>;
    missingAllCounts: number;
    missingPowerPlayCounts: number;
    missingPenaltyKillCounts: number;
    formulaFieldMissingRows: Record<string, number>;
    completeFormulaRows: number;
  };
};

type SampleBuildResult = {
  samples: ValidationSample[];
  candidateEligibility: {
    potentialSamples: number;
    scoredSamples: number;
    readySamples: number;
    partialSamples: number;
    unavailableSamples: number;
    confidence: ReturnType<typeof summarize>;
    warnings: Record<string, number>;
    unavailableExamples: Array<{
      team: string;
      date: string;
      warnings: string[];
      missingMetrics: string[];
      unavailableLeagueMetrics: string[];
      missingComponents: string[];
    }>;
  };
};

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((value) => value.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

function finite(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function timeToSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+:\d{2}$/.test(value.trim())) {
    return null;
  }
  const [minutes, seconds] = value.trim().split(":").map(Number);
  return minutes * 60 + seconds;
}

function mean(values: Array<number | null | undefined>): number | null {
  const observed = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  return observed.length > 0
    ? observed.reduce((total, value) => total + value, 0) / observed.length
    : null;
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
    min: observed.length > 0 ? Math.min(...observed) : null,
    p05: quantile(observed, 0.05),
    median: quantile(observed, 0.5),
    p95: quantile(observed, 0.95),
    max: observed.length > 0 ? Math.max(...observed) : null,
    mean: mean(observed),
  };
}

function pearson(
  rows: ValidationSample[],
  left: keyof ValidationSample,
  right: keyof ValidationSample,
) {
  const pairs = rows.flatMap((row) => {
    const leftValue = row[left];
    const rightValue = row[right];
    return typeof leftValue === "number" &&
      Number.isFinite(leftValue) &&
      typeof rightValue === "number" &&
      Number.isFinite(rightValue)
      ? [[leftValue, rightValue] as const]
      : [];
  });
  if (pairs.length < 2) {
    return { samples: pairs.length, correlation: null, ci95: [null, null] };
  }
  const leftMean = mean(pairs.map(([value]) => value)) as number;
  const rightMean = mean(pairs.map(([, value]) => value)) as number;
  const numerator = pairs.reduce(
    (total, [leftValue, rightValue]) =>
      total + (leftValue - leftMean) * (rightValue - rightMean),
    0,
  );
  const leftScale = Math.sqrt(
    pairs.reduce((total, [value]) => total + (value - leftMean) ** 2, 0),
  );
  const rightScale = Math.sqrt(
    pairs.reduce((total, [, value]) => total + (value - rightMean) ** 2, 0),
  );
  const correlation =
    leftScale > 0 && rightScale > 0
      ? numerator / (leftScale * rightScale)
      : null;
  if (correlation == null || pairs.length <= 3) {
    return { samples: pairs.length, correlation, ci95: [null, null] };
  }
  const bounded = Math.max(-0.999999, Math.min(0.999999, correlation));
  const fisher = Math.atanh(bounded);
  const margin = 1.96 / Math.sqrt(pairs.length - 3);
  return {
    samples: pairs.length,
    correlation,
    ci95: [Math.tanh(fisher - margin), Math.tanh(fisher + margin)],
  };
}

function parseProviderTable(
  html: string,
  seasonId: number,
): { rows: ProviderRow[]; unknownTeams: string[] } {
  const $ = cheerio.load(html);
  const table = $("#teams");
  const bodyRows = table.find("tbody tr");
  if (table.length === 0 || bodyRows.length === 0) {
    throw new Error(`NST games table is empty for season ${seasonId}.`);
  }
  const headers = table
    .find("thead tr")
    .last()
    .find("th")
    .map((_, element) =>
      $(element).text().replace(/\s+/g, " ").trim().toLowerCase(),
    )
    .get();
  const unknownTeams = new Set<string>();
  const rows: ProviderRow[] = [];

  bodyRows.each((_, element) => {
    const values = $(element)
      .find("td")
      .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
      .get();
    const record = Object.fromEntries(
      headers.flatMap((header, index) =>
        header ? ([[header, values[index] ?? ""]] as const) : [],
      ),
    );
    const date = /^\d{4}-\d{2}-\d{2}/.exec(record.game ?? "")?.[0] ?? null;
    const teamName = record.team ?? "";
    const team =
      teamNameToAbbreviationMap[teamName] ?? HISTORICAL_TEAM_NAMES[teamName];
    if (!team) {
      if (teamName) unknownTeams.add(teamName);
      return;
    }
    if (!date) return;
    rows.push({
      seasonId,
      team,
      date,
      toiSeconds: timeToSeconds(record.toi),
      gf: finite(record.gf),
      ga: finite(record.ga),
      xgf: finite(record.xgf),
      xga: finite(record.xga),
      xgfPer60: finite(record["xgf/60"]),
      xgaPer60: finite(record["xga/60"]),
      hdcfPer60: finite(record["hdcf/60"]),
      hdcaPer60: finite(record["hdca/60"]),
      gfPer60: finite(record["gf/60"]),
      caPer60: finite(record["ca/60"]),
      pdo: finite(record.pdo),
    });
  });

  return { rows, unknownTeams: Array.from(unknownTeams).sort() };
}

function rowKey(row: Pick<ProviderRow, "team" | "date">): string {
  return `${row.team}|${row.date}`;
}

async function fetchDataset(
  seasonId: number,
  situation: string,
  rate: string,
): Promise<{ rows: ProviderRow[]; unknownTeams: string[] }> {
  const { text } = await fetchNstText({
    path: "games.php",
    query: {
      fromseason: seasonId,
      thruseason: seasonId,
      stype: 2,
      sit: situation,
      loc: "B",
      team: "All",
      rate,
    },
    timeoutMs: 60_000,
    retries: 1,
  });
  return parseProviderTable(text, seasonId);
}

async function fetchSeasonData(seasonId: number): Promise<SeasonData> {
  const datasets = {} as Record<DatasetKey, ProviderRow[]>;
  const unknownTeams = new Set<string>();
  for (const dataset of DATASETS) {
    const result = await fetchDataset(
      seasonId,
      dataset.situation,
      dataset.rate,
    );
    datasets[dataset.key] = result.rows;
    result.unknownTeams.forEach((team) => unknownTeams.add(team));
  }
  if (unknownTeams.size > 0) {
    throw new Error(
      `Unmapped NST teams for ${seasonId}: ${Array.from(unknownTeams).join(", ")}`,
    );
  }

  const allCounts = new Map(
    datasets.allCounts.map((row) => [rowKey(row), row] as const),
  );
  const powerPlayCounts = new Map(
    datasets.powerPlayCounts.map((row) => [rowKey(row), row] as const),
  );
  const penaltyKillCounts = new Map(
    datasets.penaltyKillCounts.map((row) => [rowKey(row), row] as const),
  );
  const rows = datasets.allRates.map((rateRow): AuditGameRow => {
    const key = rowKey(rateRow);
    const countRow = allCounts.get(key);
    const powerPlayRow = powerPlayCounts.get(key);
    const penaltyKillRow = penaltyKillCounts.get(key);
    return {
      seasonId,
      team: rateRow.team,
      date: rateRow.date,
      gp: 1,
      xgf_per_60: rateRow.xgfPer60,
      hdcf_per_60: rateRow.hdcfPer60,
      gf_per_60: rateRow.gfPer60,
      xga_per_60: rateRow.xgaPer60,
      hdca_per_60: rateRow.hdcaPer60,
      ca_per_60: rateRow.caPer60,
      goals_against: countRow?.ga ?? null,
      xga: countRow?.xga ?? null,
      powerPlayToi: powerPlayRow?.toiSeconds ?? null,
      pp_xgf: powerPlayRow?.xgf ?? null,
      toi_shorthanded: penaltyKillRow?.toiSeconds ?? null,
      pk_xga: penaltyKillRow?.xga ?? null,
      pdo: rateRow.pdo,
      toi_all_seconds: countRow?.toiSeconds ?? null,
      gf: countRow?.gf ?? null,
      ga: countRow?.ga ?? null,
      xgf: countRow?.xgf ?? null,
      xgaCount: countRow?.xga ?? null,
    };
  });
  const completeFormulaRows = rows.filter(
    (row) =>
      row.xgf_per_60 != null &&
      row.hdcf_per_60 != null &&
      row.gf_per_60 != null &&
      row.xga_per_60 != null &&
      row.hdca_per_60 != null &&
      row.ca_per_60 != null &&
      row.goals_against != null &&
      row.xga != null &&
      row.toi_all_seconds != null &&
      row.pp_xgf != null &&
      row.powerPlayToi != null &&
      row.pk_xga != null &&
      row.toi_shorthanded != null &&
      row.pdo != null,
  ).length;
  const formulaFieldMissingRows = Object.fromEntries(
    [
      "xgf_per_60",
      "hdcf_per_60",
      "gf_per_60",
      "xga_per_60",
      "hdca_per_60",
      "ca_per_60",
      "goals_against",
      "xga",
      "toi_all_seconds",
      "pp_xgf",
      "powerPlayToi",
      "pk_xga",
      "toi_shorthanded",
      "pdo",
    ].map((field) => [
      field,
      rows.filter((row) => row[field as keyof AuditGameRow] == null).length,
    ]),
  );

  return {
    seasonId,
    rows,
    coverage: {
      teamGames: rows.length,
      teams: new Set(rows.map((row) => row.team)).size,
      dates: new Set(rows.map((row) => row.date)).size,
      datasetRows: Object.fromEntries(
        DATASETS.map((dataset) => [dataset.key, datasets[dataset.key].length]),
      ) as Record<DatasetKey, number>,
      missingAllCounts: rows.filter((row) => !allCounts.has(rowKey(row)))
        .length,
      missingPowerPlayCounts: rows.filter(
        (row) => !powerPlayCounts.has(rowKey(row)),
      ).length,
      missingPenaltyKillCounts: rows.filter(
        (row) => !penaltyKillCounts.has(rowKey(row)),
      ).length,
      formulaFieldMissingRows,
      completeFormulaRows,
    },
  };
}

type ScoreSnapshot = {
  legacy: Map<string, CtpiScore>;
  candidate: Map<string, RecentTeamFormCandidateScore>;
};

function scoresBeforeDate(rows: AuditGameRow[], date: string): ScoreSnapshot {
  const byTeam = new Map<string, AuditGameRow[]>();
  for (const row of rows) {
    if (row.date >= date) continue;
    const teamRows = byTeam.get(row.team) ?? [];
    teamRows.push(row);
    byTeam.set(row.team, teamRows);
  }
  const eligibleTeamRows = Array.from(byTeam.values()).filter(
    (teamRows) => teamRows.length >= 10,
  );
  const legacyMetrics = eligibleTeamRows
    .map((teamRows) => computeTrendMetrics(teamRows))
    .filter((row) => row.recent_game_count === 10);
  const candidateMetrics = eligibleTeamRows.map((teamRows) =>
    computeRecentTeamFormCandidateMetrics(teamRows),
  );
  return {
    legacy: new Map(
      computeCtpi(legacyMetrics).map((score) => [score.team, score]),
    ),
    candidate: new Map(
      computeRecentTeamFormCandidateV2(candidateMetrics).map((score) => [
        score.team,
        score,
      ]),
    ),
  };
}

function perGameGsax(row: AuditGameRow): number | null {
  return row.xga != null &&
    row.goals_against != null &&
    row.toi_all_seconds != null &&
    row.toi_all_seconds > 0
    ? ((row.xga - row.goals_against) * 3600) / row.toi_all_seconds
    : null;
}

function specialTeamsNet(row: AuditGameRow): number | null {
  const pp =
    row.pp_xgf != null && row.powerPlayToi != null && row.powerPlayToi > 0
      ? (row.pp_xgf * 3600) / row.powerPlayToi
      : null;
  const pk =
    row.pk_xga != null && row.toi_shorthanded != null && row.toi_shorthanded > 0
      ? (row.pk_xga * 3600) / row.toi_shorthanded
      : null;
  return pp != null && pk != null ? pp - pk : null;
}

function buildSamples(season: SeasonData): SampleBuildResult {
  const rowsByTeam = new Map<string, AuditGameRow[]>();
  for (const row of season.rows) {
    const rows = rowsByTeam.get(row.team) ?? [];
    rows.push(row);
    rowsByTeam.set(row.team, rows);
  }
  for (const rows of rowsByTeam.values()) {
    rows.sort((left, right) => left.date.localeCompare(right.date));
  }
  const scoreCache = new Map<string, ScoreSnapshot>();
  const samples: ValidationSample[] = [];
  const statusCounts = { ready: 0, partial: 0, unavailable: 0 };
  const confidenceValues: number[] = [];
  const warningCounts = new Map<string, number>();
  const unavailableExamples: SampleBuildResult["candidateEligibility"]["unavailableExamples"] =
    [];
  let potentialSamples = 0;

  for (const [team, rows] of rowsByTeam) {
    for (let index = 10; index < rows.length; index += 1) {
      potentialSamples += 1;
      const game = rows[index];
      let scores = scoreCache.get(game.date);
      if (!scores) {
        scores = scoresBeforeDate(season.rows, game.date);
        scoreCache.set(game.date, scores);
      }
      const legacyScore = scores.legacy.get(team);
      const candidateScore = scores.candidate.get(team);
      if (candidateScore) {
        statusCounts[candidateScore.status] += 1;
        confidenceValues.push(candidateScore.confidence.value);
        candidateScore.warnings.forEach((warning) =>
          warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1),
        );
        if (
          candidateScore.status === "unavailable" &&
          unavailableExamples.length < 10
        ) {
          unavailableExamples.push({
            team,
            date: game.date,
            warnings: candidateScore.warnings,
            missingMetrics: candidateScore.missingMetrics,
            unavailableLeagueMetrics: candidateScore.unavailableLeagueMetrics,
            missingComponents: candidateScore.missingComponents,
          });
        }
      } else {
        statusCounts.unavailable += 1;
      }
      if (
        !legacyScore ||
        !candidateScore ||
        candidateScore.ctpi_0_to_100 == null
      ) {
        continue;
      }
      const priorTen = rows.slice(index - 10, index);
      const sample: ValidationSample = {
        seasonId: season.seasonId,
        team,
        date: game.date,
        legacyScore: legacyScore.ctpi_0_to_100,
        candidateScore: candidateScore.ctpi_0_to_100,
        offense: candidateScore.components.offense,
        defense: candidateScore.components.defense,
        goaltending: candidateScore.components.goaltending,
        specialTeams: candidateScore.components.specialTeams,
        recentGoalDifferential: mean(
          priorTen.map((row) =>
            row.gf != null && row.ga != null ? row.gf - row.ga : null,
          ),
        ),
        recentExpectedGoalDifferential: mean(
          priorTen.map((row) =>
            row.xgf != null && row.xgaCount != null
              ? row.xgf - row.xgaCount
              : null,
          ),
        ),
        recentXgfPer60: mean(priorTen.map((row) => row.xgf_per_60)),
        recentNegativeXgaPer60: mean(
          priorTen.map((row) =>
            row.xga_per_60 == null ? null : -row.xga_per_60,
          ),
        ),
        recentGsaxPer60: mean(priorTen.map(perGameGsax)),
        recentSpecialTeamsNet: mean(priorTen.map(specialTeamsNet)),
        next1GoalDifferential: null,
        next3GoalDifferential: null,
        next5GoalDifferential: null,
        next10GoalDifferential: null,
        next1ExpectedGoalDifferential: null,
        next3ExpectedGoalDifferential: null,
        next5ExpectedGoalDifferential: null,
        next10ExpectedGoalDifferential: null,
      };
      for (const horizon of [1, 3, 5, 10] as const) {
        const future = rows.slice(index, index + horizon);
        if (future.length !== horizon) continue;
        sample[`next${horizon}GoalDifferential`] = mean(
          future.map((row) =>
            row.gf != null && row.ga != null ? row.gf - row.ga : null,
          ),
        );
        sample[`next${horizon}ExpectedGoalDifferential`] = mean(
          future.map((row) =>
            row.xgf != null && row.xgaCount != null
              ? row.xgf - row.xgaCount
              : null,
          ),
        );
      }
      samples.push(sample);
    }
  }
  return {
    samples,
    candidateEligibility: {
      potentialSamples,
      scoredSamples: samples.length,
      readySamples: statusCounts.ready,
      partialSamples: statusCounts.partial,
      unavailableSamples: statusCounts.unavailable,
      confidence: summarize(confidenceValues),
      warnings: Object.fromEntries(
        Array.from(warningCounts.entries()).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      unavailableExamples,
    },
  };
}

function correlationSummary(samples: ValidationSample[]) {
  const concurrent = {
    legacyScoreVsRecentXgDifferential: pearson(
      samples,
      "legacyScore",
      "recentExpectedGoalDifferential",
    ),
    candidateScoreVsRecentXgDifferential: pearson(
      samples,
      "candidateScore",
      "recentExpectedGoalDifferential",
    ),
    candidateScoreVsRecentGoalDifferential: pearson(
      samples,
      "candidateScore",
      "recentGoalDifferential",
    ),
    offenseVsRecentXgfPer60: pearson(samples, "offense", "recentXgfPer60"),
    defenseVsRecentNegativeXgaPer60: pearson(
      samples,
      "defense",
      "recentNegativeXgaPer60",
    ),
    goaltendingVsRecentGsaxPer60: pearson(
      samples,
      "goaltending",
      "recentGsaxPer60",
    ),
    specialTeamsVsRecentNet: pearson(
      samples,
      "specialTeams",
      "recentSpecialTeamsNet",
    ),
  };
  const forward: Record<string, unknown> = {};
  for (const horizon of [1, 3, 5, 10] as const) {
    for (const outcome of [
      "GoalDifferential",
      "ExpectedGoalDifferential",
    ] as const) {
      const outcomeKey = `next${horizon}${outcome}` as keyof ValidationSample;
      forward[`${horizon}game${outcome}`] = {
        legacyScore: pearson(samples, "legacyScore", outcomeKey),
        candidateScore: pearson(samples, "candidateScore", outcomeKey),
        recentGoalDifferential: pearson(
          samples,
          "recentGoalDifferential",
          outcomeKey,
        ),
        recentExpectedGoalDifferential: pearson(
          samples,
          "recentExpectedGoalDifferential",
          outcomeKey,
        ),
      };
    }
  }
  return { concurrent, forward };
}

function scoreBands(samples: ValidationSample[]) {
  const definitions = [
    { label: "under_35", min: -Infinity, max: 35 },
    { label: "35_to_45", min: 35, max: 45 },
    { label: "45_to_55", min: 45, max: 55 },
    { label: "55_to_65", min: 55, max: 65 },
    { label: "65_and_over", min: 65, max: Infinity },
  ];
  const bands = definitions.map((definition) => {
    const rows = samples.filter(
      (row) =>
        row.candidateScore >= definition.min &&
        row.candidateScore < definition.max,
    );
    return {
      band: definition.label,
      samples: rows.length,
      meanScore: mean(rows.map((row) => row.candidateScore)),
      recentExpectedGoalDifferential: mean(
        rows.map((row) => row.recentExpectedGoalDifferential),
      ),
      next5ExpectedGoalDifferential: mean(
        rows.map((row) => row.next5ExpectedGoalDifferential),
      ),
    };
  });
  const observedRecent = bands
    .map((band) => band.recentExpectedGoalDifferential)
    .filter((value): value is number => value != null);
  const observedForward = bands
    .map((band) => band.next5ExpectedGoalDifferential)
    .filter((value): value is number => value != null);
  const nondecreasing = (values: number[]) =>
    values.every((value, index) => index === 0 || value >= values[index - 1]);
  return {
    bands,
    recentXgMonotonic: nondecreasing(observedRecent),
    next5XgMonotonic: nondecreasing(observedForward),
  };
}

function rankStability(season: SeasonData) {
  const dates = Array.from(new Set(season.rows.map((row) => row.date))).sort();
  const snapshots = dates.flatMap((date) => {
    const scores = Array.from(
      scoresBeforeDate(season.rows, date).candidate.values(),
    ).filter(
      (
        score,
      ): score is RecentTeamFormCandidateScore & {
        ctpi_0_to_100: number;
      } => score.ctpi_0_to_100 != null,
    );
    if (scores.length < 2) return [];
    const ranked = scores
      .map((score) => ({ team: score.team, score: score.ctpi_0_to_100 }))
      .sort(
        (left, right) =>
          right.score - left.score || left.team.localeCompare(right.team),
      );
    return [
      {
        date,
        ranks: new Map(ranked.map((row, index) => [row.team, index + 1])),
      },
    ];
  });
  const correlations: number[] = [];
  const absoluteRankChanges: number[] = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1].ranks;
    const current = snapshots[index].ranks;
    const common = Array.from(current.keys()).filter((team) =>
      previous.has(team),
    );
    if (common.length < 2) continue;
    const pseudoSamples = common.map(
      (team): ValidationSample =>
        ({
          legacyScore: previous.get(team) as number,
          candidateScore: current.get(team) as number,
        }) as ValidationSample,
    );
    const correlation = pearson(
      pseudoSamples,
      "legacyScore",
      "candidateScore",
    ).correlation;
    if (correlation != null) correlations.push(correlation);
    common.forEach((team) =>
      absoluteRankChanges.push(
        Math.abs(
          (current.get(team) as number) - (previous.get(team) as number),
        ),
      ),
    );
  }
  return {
    snapshotDates: snapshots.length,
    consecutiveComparisons: correlations.length,
    spearman: summarize(correlations),
    absoluteRankChange: summarize(absoluteRankChanges),
  };
}

function validationSummary(samples: ValidationSample[]) {
  return {
    samples: samples.length,
    scoreDistribution: summarize(samples.map((row) => row.candidateScore)),
    outOfRangeScores: samples.filter(
      (row) => row.candidateScore <= 0 || row.candidateScore >= 100,
    ).length,
    ...correlationSummary(samples),
    scoreBands: scoreBands(samples),
  };
}

async function main() {
  const seasons = (parseArg("seasons") ?? "20222023,20232024,20242025")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value));
  if (seasons.length < 2 || new Set(seasons).size !== seasons.length) {
    throw new Error("--seasons must contain at least two distinct season ids.");
  }
  const holdoutSeason = Number(
    parseArg("holdout-season") ?? seasons[seasons.length - 1],
  );
  if (!seasons.includes(holdoutSeason)) {
    throw new Error("--holdout-season must be included in --seasons.");
  }

  const seasonData: SeasonData[] = [];
  for (const season of seasons) {
    process.stderr.write(`Reading NST team-game rows for ${season}...\n`);
    seasonData.push(await fetchSeasonData(season));
  }
  const samplesBySeason = new Map(
    seasonData.map(
      (season) => [season.seasonId, buildSamples(season)] as const,
    ),
  );
  const developmentSamples = seasonData
    .filter((season) => season.seasonId !== holdoutSeason)
    .flatMap((season) => samplesBySeason.get(season.seasonId)?.samples ?? []);
  const holdoutSamples = samplesBySeason.get(holdoutSeason)?.samples ?? [];

  const output = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    source: "Natural Stat Trick season game logs (one row per team-game)",
    formulaRegistration: {
      target:
        "descriptive league-relative recent team performance; not a game prediction",
      legacyCorrected:
        "existing component and top-level weights on corrected one-game inputs",
      candidate: {
        formulaVersion: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
        inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
        description:
          "pre-specified no-PDO component weights, explicit missingness renormalization, confidence, and a bounded logistic display transform",
        activeOrPersisted: false,
      },
      fittingPerformed: false,
      selectionPerformed: false,
    },
    split: {
      developmentSeasons: seasons.filter((season) => season !== holdoutSeason),
      holdoutSeason,
      holdoutWasNotUsedToFitOrSelectWeights: true,
    },
    coverage: seasonData.map((season) => ({
      seasonId: season.seasonId,
      ...season.coverage,
      candidateEligibility: samplesBySeason.get(season.seasonId)
        ?.candidateEligibility ?? {
        potentialSamples: 0,
        scoredSamples: 0,
        readySamples: 0,
        partialSamples: 0,
        unavailableSamples: 0,
        confidence: summarize([]),
        warnings: {},
        unavailableExamples: [],
      },
    })),
    development: validationSummary(developmentSamples),
    holdout: validationSummary(holdoutSamples),
    bySeason: Object.fromEntries(
      seasonData.map((season) => [
        season.seasonId,
        {
          ...validationSummary(
            samplesBySeason.get(season.seasonId)?.samples ?? [],
          ),
          rankStability: rankStability(season),
        },
      ]),
    ),
    limitations: [
      "Confidence intervals use Fisher's transform and do not correct for repeated observations from the same team.",
      "Forward association is diagnostic only; it is not the product target and does not control opponent, venue, rest, travel, or roster changes.",
      "The audit does not fit or select replacement weights and performs no database write, migration, backfill, model promotion, or deployment.",
    ],
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
