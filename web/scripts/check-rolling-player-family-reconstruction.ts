import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { recomputePlayerRowsForValidation } from "../lib/supabase/Upserts/fetchRollingPlayerAverages";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type StrengthState = "all" | "ev" | "pp" | "pk";

type ValidationCase = {
  label: string;
  playerId: number;
  season: number;
};

type RollingRow = Record<string, unknown> & {
  game_date: string;
  strength_state: StrengthState;
};

type FamilyDefinition = {
  key: string;
  label: string;
  includeField: (field: string) => boolean;
};

type FamilyComparison = {
  family: string;
  comparedRows: number;
  missingStoredRows: number;
  missingRecomputedRows: number;
  comparedFields: number;
  mismatchCount: number;
  mismatchesSample: string[];
  status: "MATCH" | "MISMATCH" | "NO_FIELDS";
};

type PlayerComparisonResult = {
  playerId: number;
  label: string;
  season: number;
  statuses: Record<string, "MATCH" | "MISMATCH" | "NO_FIELDS">;
  comparisons: FamilyComparison[];
};

const READY_VALIDATION_CASES: ValidationCase[] = [
  {
    label: "Brent Burns",
    playerId: 8470613,
    season: 20252026
  },
  {
    label: "Jesper Bratt",
    playerId: 8479407,
    season: 20252026
  }
];

const FAMILY_DEFINITIONS: FamilyDefinition[] = [
  {
    key: "availability",
    label: "Availability / legacy GP compatibility",
    includeField: (field) =>
      field === "games_played" ||
      field === "team_games_played" ||
      /^gp_pct_/.test(field) ||
      /^(season|three_year|career)_availability_pct$/.test(field) ||
      /^availability_pct_last(3|5|10|20)_team_games$/.test(field) ||
      /^(season|three_year|career)_(games_played|team_games_available)$/.test(field) ||
      /^games_played_last(3|5|10|20)_team_games$/.test(field) ||
      /^team_games_available_last(3|5|10|20)$/.test(field)
  },
  {
    key: "participation",
    label: "Split-strength participation",
    includeField: (field) =>
      /^(season|three_year|career)_participation_pct$/.test(field) ||
      /^participation_pct_last(3|5|10|20)_team_games$/.test(field) ||
      /^(season|three_year|career)_participation_games$/.test(field) ||
      /^participation_games_last(3|5|10|20)_team_games$/.test(field)
  },
  {
    key: "toi",
    label: "TOI",
    includeField: (field) => /^toi_seconds_/.test(field)
  },
  {
    key: "additive_counts",
    label: "Additive counts",
    includeField: (field) =>
      /^(goals|assists|shots|hits|blocks|pp_points|points)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "opportunity_counts",
    label: "Opportunity counts",
    includeField: (field) =>
      /^(ixg|iscf|ihdcf)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      ) && !/^ixg_per_60_/.test(field)
  },
  {
    key: "weighted_per60",
    label: "Weighted /60",
    includeField: (field) =>
      /^(sog|ixg|hits|blocks)_per_60_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "finishing_ratios",
    label: "Finishing ratios",
    includeField: (field) =>
      /^(shooting_pct|primary_points_pct|expected_sh_pct)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "on_ice_context",
    label: "On-ice context",
    includeField: (field) =>
      /^(ipp|on_ice_sh_pct|pdo)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "zone_usage",
    label: "Zone / usage",
    includeField: (field) =>
      /^(oz_start_pct|pp_share_pct)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "territorial",
    label: "Territorial",
    includeField: (field) =>
      /^(cf|ca|ff|fa)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      ) ||
      /^(cf_pct|ff_pct)_(total|avg|all|last3|last5|last10|last20|season|3ya|career)/.test(
        field
      )
  },
  {
    key: "historical_baselines",
    label: "Historical baselines",
    includeField: (field) => /_avg_(season|3ya|career)$/.test(field)
  }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);
const NUMERIC_TOLERANCE = 0.000001;

function parseArgs() {
  const argv = process.argv.slice(2);
  const playerIdIndex = argv.findIndex((value) => value === "--playerId");
  const seasonIndex = argv.findIndex((value) => value === "--season");

  const playerId =
    playerIdIndex >= 0 && argv[playerIdIndex + 1]
      ? Number(argv[playerIdIndex + 1])
      : undefined;
  const season =
    seasonIndex >= 0 && argv[seasonIndex + 1]
      ? Number(argv[seasonIndex + 1])
      : undefined;

  return { playerId, season };
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

function compareFamily(args: {
  family: FamilyDefinition;
  recomputedRows: RollingRow[];
  storedRows: RollingRow[];
}): FamilyComparison {
  const recomputedByKey = new Map(args.recomputedRows.map((row) => [rowKey(row), row]));
  const storedByKey = new Map(args.storedRows.map((row) => [rowKey(row), row]));
  const allKeys = Array.from(
    new Set([...recomputedByKey.keys(), ...storedByKey.keys()])
  ).sort();

  const mismatches: string[] = [];
  let comparedRows = 0;
  let missingStoredRows = 0;
  let missingRecomputedRows = 0;
  let comparedFields = 0;

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
    const fields = Object.keys(recomputed).filter(args.family.includeField);
    for (const field of fields) {
      comparedFields += 1;
      if (!valuesMatch(recomputed[field], stored[field])) {
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

  return {
    family: args.family.key,
    comparedRows,
    missingStoredRows,
    missingRecomputedRows,
    comparedFields,
    mismatchCount: mismatches.length,
    mismatchesSample: mismatches,
    status:
      comparedFields === 0
        ? "NO_FIELDS"
        : mismatches.length > 0 || missingStoredRows > 0 || missingRecomputedRows > 0
          ? "MISMATCH"
          : "MATCH"
  };
}

async function comparePlayer(validationCase: ValidationCase): Promise<PlayerComparisonResult> {
  const [{ rows: recomputedRows }, storedRows] = await Promise.all([
    recomputePlayerRowsForValidation({
      playerId: validationCase.playerId,
      season: validationCase.season,
      skipDiagnostics: true
    }),
    fetchStoredRows(validationCase.playerId, validationCase.season)
  ]);

  const recomputed = recomputedRows.map((row) => ({
    ...row,
    game_date: String(row.game_date),
    strength_state: row.strength_state as StrengthState
  })) as RollingRow[];

  const comparisons = FAMILY_DEFINITIONS.map((family) =>
    compareFamily({
      family,
      recomputedRows: recomputed,
      storedRows
    })
  );

  return {
    playerId: validationCase.playerId,
    label: validationCase.label,
    season: validationCase.season,
    statuses: Object.fromEntries(
      comparisons.map((comparison) => [comparison.family, comparison.status])
    ),
    comparisons
  };
}

async function main() {
  const { playerId, season } = parseArgs();
  const cases =
    playerId && season
      ? READY_VALIDATION_CASES.filter(
          (validationCase) =>
            validationCase.playerId === playerId && validationCase.season === season
        )
      : READY_VALIDATION_CASES;

  if (!cases.length) {
    throw new Error("No validation cases matched the provided filters.");
  }

  const results = await Promise.all(cases.map((validationCase) => comparePlayer(validationCase)));

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cases,
        familyKeys: FAMILY_DEFINITIONS.map((family) => family.key),
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[rolling-player-family-reconstruction] Failed:", error);
  process.exitCode = 1;
});
