import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { recomputePlayerRowsForValidation } from "../lib/supabase/Upserts/fetchRollingPlayerAverages";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type StrengthState = "all" | "ev" | "pp" | "pk";
type ComparisonStatus = "PASS" | "FAIL" | "BLOCKED" | "NO_FIELDS";

type ValidationCase = {
  label: string;
  playerId: number;
  season: number;
};

type RollingRow = Record<string, unknown> & {
  game_date: string;
  strength_state: StrengthState;
};

type DisputedMetricCheck = {
  key: string;
  label: string;
  cases: ValidationCase[];
  blockedReason?: string;
  strengths?: StrengthState[];
  includeField: (field: string) => boolean;
};

type CheckCaseResult = {
  playerId: number;
  label: string;
  season: number;
  comparedRows: number;
  missingStoredRows: number;
  missingRecomputedRows: number;
  comparedFields: number;
  mismatchCount: number;
  mismatchesSample: string[];
  status: ComparisonStatus;
};

type CheckResult = {
  key: string;
  label: string;
  status: ComparisonStatus;
  blockedReason?: string;
  caseResults: CheckCaseResult[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

const COREY_PERRY: ValidationCase = {
  label: "Corey Perry",
  playerId: 8470621,
  season: 20252026
};

const BRENT_BURNS: ValidationCase = {
  label: "Brent Burns",
  playerId: 8470613,
  season: 20252026
};

const JESPER_BRATT: ValidationCase = {
  label: "Jesper Bratt",
  playerId: 8479407,
  season: 20252026
};

const SETH_JONES: ValidationCase = {
  label: "Seth Jones",
  playerId: 8477495,
  season: 20252026
};

const NUMERIC_TOLERANCE = 0.000001;

const DISPUTED_METRIC_CHECKS: DisputedMetricCheck[] = [
  {
    key: "gp_pct_avg_season_replacement",
    label: "`gp_pct_avg_season` replacement field(s)",
    cases: [COREY_PERRY],
    strengths: ["all"],
    includeField: (field) =>
      field === "season_availability_pct" ||
      field === "season_games_played" ||
      field === "season_team_games_available" ||
      field === "gp_pct_avg_season"
  },
  {
    key: "gp_pct_total_all",
    label: "`gp_pct_total_all`",
    cases: [COREY_PERRY],
    strengths: ["all"],
    includeField: (field) => field === "gp_pct_total_all"
  },
  {
    key: "rolling_gp_replacement_fields",
    label: "rolling GP replacement field(s)",
    cases: [COREY_PERRY],
    strengths: ["all"],
    includeField: (field) =>
      /^availability_pct_last(3|5|10|20)_team_games$/.test(field) ||
      /^games_played_last(3|5|10|20)_team_games$/.test(field) ||
      /^team_games_available_last(3|5|10|20)$/.test(field)
  },
  {
    key: "gp_pct_avg_3ya",
    label: "`gp_pct_avg_3ya`",
    cases: [COREY_PERRY],
    strengths: ["all"],
    includeField: (field) =>
      field === "gp_pct_avg_3ya" ||
      field === "three_year_availability_pct" ||
      field === "three_year_games_played" ||
      field === "three_year_team_games_available"
  },
  {
    key: "gp_pct_avg_career",
    label: "`gp_pct_avg_career`",
    cases: [COREY_PERRY],
    strengths: ["all"],
    includeField: (field) =>
      field === "gp_pct_avg_career" ||
      field === "career_availability_pct" ||
      field === "career_games_played" ||
      field === "career_team_games_available"
  },
  {
    key: "shooting_pct_total_lastn",
    label: "`shooting_pct_total_lastN`",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all"],
    includeField: (field) =>
      /^shooting_pct_(total_last(3|5|10|20)|last(3|5|10|20))$/.test(field)
  },
  {
    key: "primary_points_pct_total_lastn",
    label: "`primary_points_pct_total_lastN`",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all"],
    includeField: (field) =>
      /^primary_points_pct_(total_last(3|5|10|20)|last(3|5|10|20))$/.test(field)
  },
  {
    key: "expected_sh_pct_total_lastn",
    label: "`expected_sh_pct_total_lastN`",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all"],
    includeField: (field) =>
      /^expected_sh_pct_(total_last(3|5|10|20)|last(3|5|10|20))$/.test(field)
  },
  {
    key: "ipp_total_lastn",
    label: "`ipp_total_lastN`",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all"],
    includeField: (field) => /^ipp_(total_last(3|5|10|20)|last(3|5|10|20))$/.test(field)
  },
  {
    key: "pp_share_pct_total_lastn",
    label: "`pp_share_pct_total_lastN`",
    cases: [JESPER_BRATT],
    strengths: ["all", "pp"],
    includeField: (field) =>
      /^pp_share_pct_(total_last(3|5|10|20)|last(3|5|10|20))$/.test(field) ||
      /^pp_share_pct_(player_pp_toi|team_pp_toi)_last(3|5|10|20)$/.test(field)
  },
  {
    key: "ixg_per_60",
    label: "`ixg_per_60`",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all", "ev", "pp", "pk"],
    includeField: (field) =>
      /^ixg_per_60_(total|avg)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      ) ||
      /^ixg_per_60_(all|last3|last5|last10|last20|season|3ya|career)$/.test(field) ||
      /^ixg_per_60_ixg_(season|3ya|career)$/.test(field) ||
      /^ixg_per_60_toi_seconds_(season|3ya|career)$/.test(field)
  },
  {
    key: "renamed_ratio_aliases",
    label: "renamed ratio-family aliases",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all"],
    includeField: (field) =>
      /^(shooting_pct|primary_points_pct|expected_sh_pct|ipp|on_ice_sh_pct|oz_start_pct|pp_share_pct|cf_pct|ff_pct|pdo)_(total_last(3|5|10|20)|last(3|5|10|20)|avg_(season|3ya|career)|(season|3ya|career))$/.test(
        field
      )
  },
  {
    key: "renamed_weighted_per60_aliases",
    label: "renamed weighted `/60` aliases",
    cases: [BRENT_BURNS, JESPER_BRATT],
    strengths: ["all", "ev", "pp", "pk"],
    includeField: (field) =>
      /^(sog|ixg|hits|blocks)_per_60_(total_last(3|5|10|20)|last(3|5|10|20)|avg_(season|3ya|career)|(season|3ya|career)|total_all|all)$/.test(
        field
      )
  },
  {
    key: "new_support_fields",
    label: "new numerator / denominator support fields",
    cases: [BRENT_BURNS, JESPER_BRATT, COREY_PERRY],
    strengths: ["all"],
    includeField: (field) =>
      /^(primary_points_pct_primary_points|primary_points_pct_points|ipp_points|ipp_on_ice_goals_for|on_ice_sh_pct_goals_for|on_ice_sh_pct_shots_for|pdo_goals_for|pdo_shots_for|pdo_goals_against|pdo_shots_against|oz_start_pct_off_zone_starts|oz_start_pct_def_zone_starts|oz_start_pct_neutral_zone_starts|pp_share_pct_player_pp_toi|pp_share_pct_team_pp_toi)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      ) ||
      /^(shooting_pct_goals|shooting_pct_shots|expected_sh_pct_ixg|expected_sh_pct_shots|cf_pct_cf|cf_pct_ca|ff_pct_ff|ff_pct_fa|sog_per_60_shots|sog_per_60_toi_seconds|ixg_per_60_ixg|ixg_per_60_toi_seconds|hits_per_60_hits|hits_per_60_toi_seconds|blocks_per_60_blocks|blocks_per_60_toi_seconds)_(season|3ya|career)$/.test(
        field
      )
  },
  {
    key: "blocked_proxy_pk_tail",
    label: "blocked incomplete-tail proxy case",
    cases: [SETH_JONES],
    blockedReason:
      "Seth Jones remains intentionally blocked for PK-sensitive disputed-metric validation because PK NST source tails still stop at 2025-12-30 while WGO is at 2026-01-02.",
    includeField: () => false
  }
];

function rowKey(row: { game_date: string; strength_state: string }) {
  return `${row.game_date}|${row.strength_state}`;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function valuesMatch(left: unknown, right: unknown): boolean {
  if (left == null && right == null) return true;
  const leftNum = normalizeNumber(left);
  const rightNum = normalizeNumber(right);
  if (leftNum != null || rightNum != null) {
    if (leftNum == null || rightNum == null) return false;
    return Math.abs(leftNum - rightNum) <= NUMERIC_TOLERANCE;
  }
  return left === right;
}

async function fetchAllRows<T extends Record<string, unknown>>(options: {
  label: string;
  table: string;
  select: string;
  applyFilters?: (query: any) => any;
  pageSize?: number;
}): Promise<T[]> {
  const { label, table, select, applyFilters, pageSize = 1000 } = options;
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (applyFilters) {
      query = applyFilters(query);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`[${label}] ${error.message}`);
    }
    const chunk = (data ?? []) as unknown as T[];
    if (!chunk.length) break;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchStoredRows(playerId: number, season: number): Promise<RollingRow[]> {
  return fetchAllRows<RollingRow>({
    label: `rolling_player_game_metrics player:${playerId} season:${season}`,
    table: "rolling_player_game_metrics",
    select: "*",
    applyFilters: (query) =>
      query
        .eq("player_id", playerId)
        .eq("season", season)
        .order("game_date", { ascending: true })
  });
}

async function getRowsForCase(validationCase: ValidationCase) {
  const [{ rows: recomputedRows }, storedRows] = await Promise.all([
    recomputePlayerRowsForValidation({
      playerId: validationCase.playerId,
      season: validationCase.season,
      skipDiagnostics: true
    }),
    fetchStoredRows(validationCase.playerId, validationCase.season)
  ]);

  return {
    recomputedRows: recomputedRows.map((row) => ({
      ...row,
      game_date: String(row.game_date),
      strength_state: row.strength_state as StrengthState
    })) as RollingRow[],
    storedRows
  };
}

function filterRowsByStrength(rows: RollingRow[], strengths?: StrengthState[]) {
  if (!strengths?.length) return rows;
  const allowed = new Set(strengths);
  return rows.filter((row) => allowed.has(row.strength_state));
}

function compareCheckForCase(args: {
  check: DisputedMetricCheck;
  recomputedRows: RollingRow[];
  storedRows: RollingRow[];
  validationCase: ValidationCase;
}): CheckCaseResult {
  const recomputedRows = filterRowsByStrength(args.recomputedRows, args.check.strengths);
  const storedRows = filterRowsByStrength(args.storedRows, args.check.strengths);
  const recomputedByKey = new Map(recomputedRows.map((row) => [rowKey(row), row]));
  const storedByKey = new Map(storedRows.map((row) => [rowKey(row), row]));
  const allKeys = Array.from(
    new Set([...recomputedByKey.keys(), ...storedByKey.keys()])
  ).sort();

  const mismatches: string[] = [];
  let comparedRows = 0;
  let missingStoredRows = 0;
  let missingRecomputedRows = 0;
  let comparedFields = 0;
  let mismatchCount = 0;

  for (const key of allKeys) {
    const recomputed = recomputedByKey.get(key);
    const stored = storedByKey.get(key);

    if (!recomputed) {
      missingRecomputedRows += 1;
      continue;
    }
    if (!stored) {
      missingStoredRows += 1;
      continue;
    }

    comparedRows += 1;
    const fields = Object.keys(recomputed).filter(args.check.includeField);
    for (const field of fields) {
      comparedFields += 1;
      if (!valuesMatch(recomputed[field], stored[field])) {
        mismatchCount += 1;
        if (mismatches.length < 10) {
          mismatches.push(
            `${key}:${field} recomputed=${String(recomputed[field])} stored=${String(
              stored[field]
            )}`
          );
        }
      }
    }
  }

  let status: ComparisonStatus = "PASS";
  if (comparedFields === 0) {
    status = "NO_FIELDS";
  } else if (mismatchCount > 0 || missingStoredRows > 0 || missingRecomputedRows > 0) {
    status = "FAIL";
  }

  return {
    playerId: args.validationCase.playerId,
    label: args.validationCase.label,
    season: args.validationCase.season,
    comparedRows,
    missingStoredRows,
    missingRecomputedRows,
    comparedFields,
    mismatchCount,
    mismatchesSample: mismatches,
    status
  };
}

async function main() {
  const uniqueCases = new Map<number, ValidationCase>();
  for (const check of DISPUTED_METRIC_CHECKS) {
    for (const validationCase of check.cases) {
      uniqueCases.set(validationCase.playerId, validationCase);
    }
  }

  const caseRows = new Map<
    number,
    Awaited<ReturnType<typeof getRowsForCase>>
  >();

  for (const validationCase of uniqueCases.values()) {
    if (validationCase.playerId === SETH_JONES.playerId) {
      continue;
    }
    caseRows.set(validationCase.playerId, await getRowsForCase(validationCase));
  }

  const results: CheckResult[] = [];

  for (const check of DISPUTED_METRIC_CHECKS) {
    if (check.blockedReason) {
      results.push({
        key: check.key,
        label: check.label,
        status: "BLOCKED",
        blockedReason: check.blockedReason,
        caseResults: check.cases.map((validationCase) => ({
          playerId: validationCase.playerId,
          label: validationCase.label,
          season: validationCase.season,
          comparedRows: 0,
          missingStoredRows: 0,
          missingRecomputedRows: 0,
          comparedFields: 0,
          mismatchCount: 0,
          mismatchesSample: [],
          status: "BLOCKED"
        }))
      });
      continue;
    }

    const caseResults = check.cases.map((validationCase) =>
      compareCheckForCase({
        check,
        validationCase,
        ...caseRows.get(validationCase.playerId)!
      })
    );

    let status: ComparisonStatus = "PASS";
    if (caseResults.every((result) => result.status === "NO_FIELDS")) {
      status = "NO_FIELDS";
    } else if (caseResults.some((result) => result.status === "FAIL")) {
      status = "FAIL";
    }

    results.push({
      key: check.key,
      label: check.label,
      status,
      caseResults
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[rolling-player-disputed-metrics] Failed:", error);
  process.exitCode = 1;
});
