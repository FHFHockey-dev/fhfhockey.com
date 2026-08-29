import { createHash } from "crypto";
import path from "path";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  calculateEwma,
  calculateFinalRating,
  calculateLeagueMetrics,
  calculateRawDistribution,
  calculateRawScores,
  calculateZScores,
  fetchGameLogs,
  type FinalRating,
  type TeamGame,
} from "lib/power-ratings";
import type { Database } from "lib/supabase/database-generated.types";
import { TEAM_RATINGS_TREND_LOOKBACK_DAYS } from "lib/teamRatingsTrend";

const DEFAULT_DATE = "2026-02-05";
const RATING_FIELDS = [
  "off_rating",
  "def_rating",
  "pace_rating",
  "xgf60",
  "gf60",
  "sf60",
  "xga60",
  "ga60",
  "sa60",
  "pace60",
  "finishing_rating",
  "goalie_rating",
  "danger_rating",
  "special_rating",
  "discipline_rating",
  "variance_flag",
] as const;

type PersistedRating = {
  team_abbreviation: string;
  date: string;
} & Record<(typeof RATING_FIELDS)[number], number | null>;

type CandidateRating = FinalRating & {
  pdo_ewma: number | null;
  pdo_observation_count: number;
  pdo_missing: boolean;
  pdo_z: number;
};

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "scripts/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
}

function parseDate(argv: string[]): string {
  const direct = argv.find((arg) => arg.startsWith("--date="));
  const index = argv.indexOf("--date");
  const date =
    direct?.slice("--date=".length) ??
    (index >= 0 ? argv[index + 1] : undefined) ??
    DEFAULT_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }
  return date;
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function buildMixedTeamGames(
  logs: Awaited<ReturnType<typeof fetchGameLogs>>,
): Map<string, TeamGame[]> {
  const grouped = new Map<string, TeamGame[]>();
  for (const log of logs) {
    const rows = grouped.get(log.team_abbreviation) ?? [];
    rows.push({ ...log, rn_desc: 0, gp_to_date: 0 });
    grouped.set(log.team_abbreviation, rows);
  }
  for (const [team, rows] of grouped) {
    const sorted = [...rows].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
    grouped.set(
      team,
      sorted.map((row, index) => ({
        ...row,
        rn_desc: index,
        gp_to_date: sorted.length - index,
      })),
    );
  }
  return grouped;
}

function numericEqual(left: number | null, right: number | null): boolean {
  if (left == null || right == null) return left === right;
  return Math.abs(Number(left) - Number(right)) <= 1e-9;
}

function stableHash(rows: PersistedRating[]): string {
  const payload = [...rows]
    .sort((left, right) =>
      left.team_abbreviation.localeCompare(right.team_abbreviation),
    )
    .map((row) =>
      JSON.stringify(
        Object.fromEntries([
          ["team", row.team_abbreviation],
          ["date", row.date],
          ...RATING_FIELDS.map((field) => [field, row[field]]),
        ]),
      ),
    )
    .join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

async function main(): Promise<void> {
  loadEnv();
  const targetDate = parseDate(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  const logStartDate = subtractDays(
    targetDate,
    TEAM_RATINGS_TREND_LOOKBACK_DAYS,
  );

  const [logs, persistedResult] = await Promise.all([
    fetchGameLogs(client, logStartDate, targetDate),
    client
      .from("team_power_ratings_daily")
      .select(`team_abbreviation,date,${RATING_FIELDS.join(",")}`)
      .eq("date", targetDate)
      .order("team_abbreviation", { ascending: true })
      .range(0, 99),
  ]);
  if (persistedResult.error) throw persistedResult.error;
  const persisted = (persistedResult.data ?? []) as unknown as PersistedRating[];

  const teamGames = buildMixedTeamGames(logs);
  const ewma = [...teamGames.values()].flatMap((games) => {
    const value = calculateEwma(games, targetDate);
    return value ? [value] : [];
  });
  const league = calculateLeagueMetrics(ewma);
  const zScores = ewma.map((row) => calculateZScores(row, league));
  const rawScores = zScores.map(calculateRawScores);
  const distribution = calculateRawDistribution(rawScores);
  const finalByTeam = new Map(
    rawScores.map((score) => [
      score.team_abbreviation,
      calculateFinalRating(score, distribution),
    ]),
  );
  const ewmaByTeam = new Map(ewma.map((row) => [row.team_abbreviation, row]));
  const zByTeam = new Map(zScores.map((row) => [row.team_abbreviation, row]));
  const candidate: CandidateRating[] = [...finalByTeam.entries()].map(
    ([team, rating]) => {
      const metric = ewmaByTeam.get(team)!;
      const z = zByTeam.get(team)!;
      return {
        ...rating,
        pdo_ewma: metric.pdo_ewma,
        pdo_observation_count: metric.pdo_observation_count,
        pdo_missing: z.pdo_missing,
        pdo_z: z.pdo_z,
      };
    },
  );
  const persistedByTeam = new Map(
    persisted.map((row) => [row.team_abbreviation, row]),
  );
  const changedByField = Object.fromEntries(
    RATING_FIELDS.map((field) => [field, 0]),
  ) as Record<(typeof RATING_FIELDS)[number], number>;
  let updates = 0;
  let inserts = 0;
  for (const row of candidate) {
    const existing = persistedByTeam.get(row.team_abbreviation);
    if (!existing) {
      inserts += 1;
      continue;
    }
    let changed = false;
    for (const field of RATING_FIELDS) {
      if (!numericEqual(existing[field], row[field])) {
        changedByField[field] += 1;
        changed = true;
      }
    }
    if (changed) updates += 1;
  }

  const candidateForHash = candidate.map((row) =>
    Object.fromEntries([
      ["team_abbreviation", row.team_abbreviation],
      ["date", row.date],
      ...RATING_FIELDS.map((field) => [field, row[field]]),
    ]),
  ) as PersistedRating[];
  const candidateTeams = new Set(candidate.map((row) => row.team_abbreviation));
  const comparablePersisted = persisted.filter((row) =>
    candidateTeams.has(row.team_abbreviation),
  );

  console.log(
    JSON.stringify(
      {
        audit: "team_power_bounded_repair_v1",
        persistenceApplied: false,
        targetDate,
        sourceWindow: {
          startDate: logStartDate,
          endDate: targetDate,
          rows: logs.length,
          allSituationRows: logs.filter((row) => row.data_mode === "all")
            .length,
          fiveOnFiveRows: logs.filter((row) => row.data_mode === "5v5").length,
        },
        coverage: {
          persistedTeams: persisted.length,
          recalculatedTeams: candidate.length,
          carryForwardTeams: persisted.filter(
            (row) => !candidateTeams.has(row.team_abbreviation),
          ).length,
        },
        pdo: {
          populatedTeams: candidate.filter((row) => !row.pdo_missing).length,
          missingTeams: candidate.filter((row) => row.pdo_missing).length,
          zeroObservationTeams: candidate.filter(
            (row) => row.pdo_observation_count === 0,
          ).length,
          neutralMissingTeams: candidate.filter(
            (row) =>
              row.pdo_missing && row.pdo_z === 0 && row.variance_flag === 0,
          ).length,
        },
        delta: {
          inserts,
          updates,
          unchanged: candidate.length - inserts - updates,
          carryForwardPreserved: persisted.length - comparablePersisted.length,
          changedByField,
        },
        receipts: {
          persistedComparablePayloadSha256: stableHash(comparablePersisted),
          candidatePayloadSha256: stableHash(candidateForHash),
        },
        repairBoundary:
          "Recompute only teams with an exact final source row on the approved date; preserve same-date carry-forward teams and all unrelated dates.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
