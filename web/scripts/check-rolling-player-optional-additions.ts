import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { recomputePlayerRowsForValidation } from "../lib/supabase/Upserts/fetchRollingPlayerAverages";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type StrengthState = "all" | "ev" | "pp" | "pk";
type ComparisonStatus = "PASS" | "FAIL" | "NO_FIELDS";

type ValidationCase = {
  label: string;
  playerId: number;
  season: number;
};

type RollingRow = Record<string, unknown> & {
  game_date: string;
  strength_state: StrengthState;
  game_id?: number | null;
};

type OptionalFamilyDefinition = {
  key: string;
  label: string;
  type: "recomputed" | "builder_context";
  includeField?: (field: string) => boolean;
};

type FamilyCaseResult = {
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

type FamilyResult = {
  key: string;
  label: string;
  status: ComparisonStatus;
  caseResults: FamilyCaseResult[];
};

type PpContextRow = {
  gameId: number;
  playerId: number;
  pp_share_of_team: number | null;
  pp_unit_usage_index: number | null;
  pp_unit_relative_toi: number | null;
  pp_vs_unit_avg: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);
const NUMERIC_TOLERANCE = 0.000001;

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

const OPTIONAL_FAMILIES: OptionalFamilyDefinition[] = [
  {
    key: "on_ice_sv_pct",
    label: "Optional `on_ice_sv_pct` ratio family",
    type: "recomputed",
    includeField: (field) =>
      /^on_ice_sv_pct_(total|avg)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      ) ||
      /^on_ice_sv_pct_(all|last3|last5|last10|last20|season|3ya|career)$/.test(field)
  },
  {
    key: "zone_start_support",
    label: "Optional raw zone-start support families",
    type: "recomputed",
    includeField: (field) =>
      /^(oz_starts|dz_starts|nz_starts)_(total|avg)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      )
  },
  {
    key: "on_ice_raw_counts",
    label: "Optional raw on-ice goal and shot count families",
    type: "recomputed",
    includeField: (field) =>
      /^(oi_gf|oi_ga|oi_sf|oi_sa)_(total|avg)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      )
  },
  {
    key: "weighted_per60_optionals",
    label: "Optional weighted `/60` families",
    type: "recomputed",
    includeField: (field) =>
      /^(goals|assists|primary_assists|secondary_assists)_per_60_(total|avg)_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      ) ||
      /^(goals|assists|primary_assists|secondary_assists)_per_60_(all|last3|last5|last10|last20|season|3ya|career)$/.test(
        field
      ) ||
      /^(goals_per_60_goals|goals_per_60_toi_seconds|assists_per_60_assists|assists_per_60_toi_seconds|primary_assists_per_60_primary_assists|primary_assists_per_60_toi_seconds|secondary_assists_per_60_secondary_assists|secondary_assists_per_60_toi_seconds)_(season|3ya|career)$/.test(
        field
      )
  },
  {
    key: "pp_context_optionals",
    label: "Optional PP-role context fields",
    type: "builder_context"
  }
];

function rowKey(row: { game_date: string; strength_state: string }) {
  return `${row.game_date}|${row.strength_state}`;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
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
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`[${label}] ${error.message}`);
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
        .order("strength_state", { ascending: true })
  });
}

async function fetchPpContextRows(
  playerId: number,
  gameIds: number[]
): Promise<PpContextRow[]> {
  if (!gameIds.length) return [];
  const rows: PpContextRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("powerPlayCombinations")
      .select(
        "gameId,playerId,pp_share_of_team,pp_unit_usage_index,pp_unit_relative_toi,pp_vs_unit_avg"
      )
      .eq("playerId", playerId)
      .in("gameId", chunk);
    if (error) {
      throw new Error(
        `[powerPlayCombinations player:${playerId} chunk:${index / chunkSize}] ${error.message}`
      );
    }
    rows.push(...((data ?? []) as PpContextRow[]));
  }

  return rows;
}

async function withSilencedInfoLogs<T>(operation: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  console.info = () => undefined;
  try {
    return await operation();
  } finally {
    console.info = originalInfo;
  }
}

function compareFamilyRows(args: {
  validationCase: ValidationCase;
  family: OptionalFamilyDefinition;
  storedRows: RollingRow[];
  recomputedRows: RollingRow[];
}): FamilyCaseResult {
  const includeField = args.family.includeField;
  if (!includeField) {
    return {
      playerId: args.validationCase.playerId,
      label: args.validationCase.label,
      season: args.validationCase.season,
      comparedRows: 0,
      missingStoredRows: 0,
      missingRecomputedRows: 0,
      comparedFields: 0,
      mismatchCount: 0,
      mismatchesSample: [],
      status: "NO_FIELDS"
    };
  }

  const storedByKey = new Map(args.storedRows.map((row) => [rowKey(row), row]));
  const recomputedByKey = new Map(
    args.recomputedRows.map((row) => [rowKey(row), row])
  );
  const keys = new Set([...storedByKey.keys(), ...recomputedByKey.keys()]);
  const comparedFields = new Set<string>();
  const mismatches: string[] = [];
  let comparedRows = 0;
  let missingStoredRows = 0;
  let missingRecomputedRows = 0;
  let mismatchCount = 0;

  for (const key of keys) {
    const stored = storedByKey.get(key);
    const recomputed = recomputedByKey.get(key);
    if (!stored) {
      missingStoredRows += 1;
      continue;
    }
    if (!recomputed) {
      missingRecomputedRows += 1;
      continue;
    }

    const fields = new Set(
      Object.keys(stored)
        .concat(Object.keys(recomputed))
        .filter(includeField)
    );
    if (!fields.size) continue;
    comparedRows += 1;
    for (const field of fields) {
      comparedFields.add(field);
      if (!valuesMatch(stored[field], recomputed[field])) {
        mismatchCount += 1;
        if (mismatches.length < 10) {
          mismatches.push(
            `${key}:${field}:stored=${String(stored[field])} recomputed=${String(
              recomputed[field]
            )}`
          );
        }
      }
    }
  }

  return {
    playerId: args.validationCase.playerId,
    label: args.validationCase.label,
    season: args.validationCase.season,
    comparedRows,
    missingStoredRows,
    missingRecomputedRows,
    comparedFields: comparedFields.size,
    mismatchCount,
    mismatchesSample: mismatches,
    status:
      comparedFields.size === 0
        ? "NO_FIELDS"
        : mismatchCount > 0 || missingStoredRows > 0 || missingRecomputedRows > 0
          ? "FAIL"
          : "PASS"
  };
}

function comparePpContextRows(args: {
  validationCase: ValidationCase;
  storedRows: RollingRow[];
  builderRows: PpContextRow[];
}): FamilyCaseResult {
  const builderByGameId = new Map(args.builderRows.map((row) => [row.gameId, row]));
  const mismatches: string[] = [];
  let comparedRows = 0;
  let mismatchCount = 0;

  for (const row of args.storedRows) {
    if ((row.strength_state !== "all" && row.strength_state !== "pp") || row.game_id == null) {
      continue;
    }

    const builder = builderByGameId.get(Number(row.game_id));
    if (!builder) {
      if (
        row.pp_share_of_team == null &&
        row.pp_unit_usage_index == null &&
        row.pp_unit_relative_toi == null &&
        row.pp_vs_unit_avg == null
      ) {
        continue;
      }
      mismatchCount += 1;
      if (mismatches.length < 10) {
        mismatches.push(`${rowKey(row)}:missing builder row`);
      }
      comparedRows += 1;
      continue;
    }

    comparedRows += 1;
    const fields: Array<keyof PpContextRow> = [
      "pp_share_of_team",
      "pp_unit_usage_index",
      "pp_unit_relative_toi",
      "pp_vs_unit_avg"
    ];

    for (const field of fields) {
      if (!valuesMatch(row[field], builder[field])) {
        mismatchCount += 1;
        if (mismatches.length < 10) {
          mismatches.push(
            `${rowKey(row)}:${field}:stored=${String(row[field])} builder=${String(
              builder[field]
            )}`
          );
        }
      }
    }
  }

  return {
    playerId: args.validationCase.playerId,
    label: args.validationCase.label,
    season: args.validationCase.season,
    comparedRows,
    missingStoredRows: 0,
    missingRecomputedRows: 0,
    comparedFields: comparedRows > 0 ? 4 : 0,
    mismatchCount,
    mismatchesSample: mismatches,
    status: comparedRows === 0 ? "NO_FIELDS" : mismatchCount > 0 ? "FAIL" : "PASS"
  };
}

async function run() {
  const familyResults: FamilyResult[] = [];

  for (const family of OPTIONAL_FAMILIES) {
    const caseResults: FamilyCaseResult[] = [];
    for (const validationCase of READY_VALIDATION_CASES) {
      const storedRows = await fetchStoredRows(
        validationCase.playerId,
        validationCase.season
      );

      if (family.type === "builder_context") {
        const gameIds = Array.from(
          new Set(
            storedRows
              .map((row) => row.game_id)
              .filter((value): value is number => typeof value === "number")
          )
        );
        const builderRows = await fetchPpContextRows(validationCase.playerId, gameIds);
        caseResults.push(
          comparePpContextRows({
            validationCase,
            storedRows,
            builderRows
          })
        );
        continue;
      }

      const recomputedResult = await withSilencedInfoLogs(() =>
        recomputePlayerRowsForValidation({
          playerId: validationCase.playerId,
          season: validationCase.season,
          skipDiagnostics: true
        })
      );
      const recomputedRows = recomputedResult.rows as RollingRow[];

      caseResults.push(
        compareFamilyRows({
          validationCase,
          family,
          storedRows,
          recomputedRows
        })
      );
    }

    const status = caseResults.some((result) => result.status === "FAIL")
      ? "FAIL"
      : caseResults.every((result) => result.status === "NO_FIELDS")
        ? "NO_FIELDS"
        : "PASS";

    familyResults.push({
      key: family.key,
      label: family.label,
      status,
      caseResults
    });
  }

  console.log(JSON.stringify({ date: new Date().toISOString(), results: familyResults }, null, 2));

  const failed = familyResults.some((result) => result.status === "FAIL");
  process.exitCode = failed ? 1 : 0;
}

run().catch((error) => {
  console.error("[rolling-player-optional-additions] Validation failed:", error);
  process.exitCode = 1;
});
