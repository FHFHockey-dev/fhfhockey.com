import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resolvePpUnitLabel } from "../lib/supabase/Upserts/rollingPlayerPpUnitContract";
import { resolveTrustedLineAssignment } from "../lib/supabase/Upserts/rollingPlayerLineContextContract";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type StrengthState = "all" | "ev" | "pp" | "pk";
type ComparisonStatus = "PASS" | "FAIL" | "NO_ROWS";

type ValidationCase = {
  label: string;
  playerId: number;
  season: number;
};

type RollingRow = {
  game_date: string;
  game_id: number | null;
  player_id: number;
  season: number;
  team_id: number | null;
  strength_state: StrengthState;
  pp_unit: number | null;
  line_combo_slot: number | null;
  line_combo_group: string | null;
};

type PpRow = {
  gameId: number;
  playerId: number;
  unit: number;
};

type LineRow = {
  gameId: number;
  teamId: number;
  forwards: number[];
  defensemen: number[];
  goalies: number[];
};

type ContextComparisonResult = {
  key: "pp_unit" | "line_combo_labels";
  label: string;
  status: ComparisonStatus;
  comparedRows: number;
  mismatches: number;
  mismatchesSample: string[];
  cases: Array<{
    playerId: number;
    label: string;
    season: number;
    comparedRows: number;
    mismatches: number;
    missingBuilderRows: number;
    status: ComparisonStatus;
  }>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VALIDATION_CASES: ValidationCase[] = [
  { label: "Corey Perry", playerId: 8470621, season: 20252026 },
  { label: "Brent Burns", playerId: 8470613, season: 20252026 },
  { label: "Jesper Bratt", playerId: 8479407, season: 20252026 },
  { label: "Seth Jones", playerId: 8477495, season: 20252026 }
];

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

async function fetchRollingRows(playerId: number, season: number): Promise<RollingRow[]> {
  return fetchAllRows<RollingRow>({
    label: `rolling_player_game_metrics player:${playerId} season:${season}`,
    table: "rolling_player_game_metrics",
    select:
      "game_date,game_id,player_id,season,team_id,strength_state,pp_unit,line_combo_slot,line_combo_group",
    applyFilters: (query) =>
      query
        .eq("player_id", playerId)
        .eq("season", season)
        .order("game_date", { ascending: true })
        .order("strength_state", { ascending: true })
  });
}

async function fetchPpRows(playerId: number, gameIds: number[]): Promise<PpRow[]> {
  if (!gameIds.length) return [];
  const rows: PpRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("powerPlayCombinations")
      .select("gameId,playerId,unit")
      .eq("playerId", playerId)
      .in("gameId", chunk);
    if (error) {
      throw new Error(
        `[powerPlayCombinations player:${playerId} chunk:${index / chunkSize}] ${error.message}`
      );
    }
    rows.push(...((data ?? []) as PpRow[]));
  }

  return rows;
}

async function fetchLineRows(gameIds: number[]): Promise<LineRow[]> {
  if (!gameIds.length) return [];
  const rows: LineRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("lineCombinations")
      .select("gameId,teamId,forwards,defensemen,goalies")
      .in("gameId", chunk);
    if (error) {
      throw new Error(
        `[lineCombinations chunk:${index / chunkSize}] ${error.message}`
      );
    }
    rows.push(...((data ?? []) as LineRow[]));
  }

  return rows;
}

function comparePpUnit(args: {
  validationCase: ValidationCase;
  rollingRows: RollingRow[];
  ppRows: PpRow[];
}) {
  const ppByGameId = new Map(args.ppRows.map((row) => [row.gameId, row]));
  const mismatches: string[] = [];
  let comparedRows = 0;
  let missingBuilderRows = 0;
  let mismatchCount = 0;

  for (const row of args.rollingRows) {
    if (row.game_id == null) continue;
    const builder = ppByGameId.get(row.game_id);
    const expected = resolvePpUnitLabel({
      originalGameId: row.game_id,
      unit: builder?.unit ?? null
    });

    if (!builder) {
      missingBuilderRows += 1;
    }

    comparedRows += 1;
    if ((row.pp_unit ?? null) !== expected) {
      mismatchCount += 1;
      if (mismatches.length < 10) {
        mismatches.push(
          `${row.game_date}|${row.strength_state}:stored=${String(
            row.pp_unit
          )} expected=${String(expected)}`
        );
      }
    }
  }

  return {
    playerId: args.validationCase.playerId,
    label: args.validationCase.label,
    season: args.validationCase.season,
    comparedRows,
    mismatches: mismatchCount,
    mismatchesSample: mismatches,
    missingBuilderRows,
    status:
      comparedRows === 0 ? "NO_ROWS" : mismatchCount > 0 ? "FAIL" : "PASS"
  } as const;
}

function compareLineLabels(args: {
  validationCase: ValidationCase;
  rollingRows: RollingRow[];
  lineRows: LineRow[];
}) {
  const lineByGameTeam = new Map(
    args.lineRows.map((row) => [`${row.gameId}|${row.teamId}`, row])
  );
  const mismatches: string[] = [];
  let comparedRows = 0;
  let missingBuilderRows = 0;
  let mismatchCount = 0;

  for (const row of args.rollingRows) {
    if (row.game_id == null || row.team_id == null) continue;
    const builder = lineByGameTeam.get(`${row.game_id}|${row.team_id}`);
    const expected = resolveTrustedLineAssignment({
      row: builder ?? null,
      playerId: args.validationCase.playerId
    });

    if (!builder) {
      missingBuilderRows += 1;
    }

    comparedRows += 1;
    const storedSlot = row.line_combo_slot ?? null;
    const storedGroup = row.line_combo_group ?? null;
    const expectedSlot = expected.lineCombo.slot ?? null;
    const expectedGroup = expected.lineCombo.positionGroup ?? null;
    if (storedSlot !== expectedSlot || storedGroup !== expectedGroup) {
      mismatchCount += 1;
      if (mismatches.length < 10) {
        mismatches.push(
          `${row.game_date}|${row.strength_state}:stored=(${String(
            storedSlot
          )},${String(storedGroup)}) expected=(${String(expectedSlot)},${String(
            expectedGroup
          )})`
        );
      }
    }
  }

  return {
    playerId: args.validationCase.playerId,
    label: args.validationCase.label,
    season: args.validationCase.season,
    comparedRows,
    mismatches: mismatchCount,
    mismatchesSample: mismatches,
    missingBuilderRows,
    status:
      comparedRows === 0 ? "NO_ROWS" : mismatchCount > 0 ? "FAIL" : "PASS"
  } as const;
}

async function main() {
  const ppCases = [];
  const lineCases = [];
  const ppMismatches: string[] = [];
  const lineMismatches: string[] = [];

  for (const validationCase of VALIDATION_CASES) {
    const rollingRows = await fetchRollingRows(
      validationCase.playerId,
      validationCase.season
    );
    const gameIds = Array.from(
      new Set(
        rollingRows
          .map((row) => row.game_id)
          .filter((gameId): gameId is number => typeof gameId === "number")
      )
    );
    const [ppRows, lineRows] = await Promise.all([
      fetchPpRows(validationCase.playerId, gameIds),
      fetchLineRows(gameIds)
    ]);

    const ppCase = comparePpUnit({ validationCase, rollingRows, ppRows });
    const lineCase = compareLineLabels({ validationCase, rollingRows, lineRows });

    ppCases.push(ppCase);
    lineCases.push(lineCase);

    if (ppCase.status === "FAIL") {
      ppMismatches.push(...ppCase.mismatchesSample ?? []);
    }
    if (lineCase.status === "FAIL") {
      lineMismatches.push(...lineCase.mismatchesSample ?? []);
    }
  }

  const results: ContextComparisonResult[] = [
    {
      key: "pp_unit",
      label: "`pp_unit`",
      status: ppCases.every((result) => result.status === "PASS")
        ? "PASS"
        : ppCases.every((result) => result.status === "NO_ROWS")
          ? "NO_ROWS"
          : "FAIL",
      comparedRows: ppCases.reduce((sum, result) => sum + result.comparedRows, 0),
      mismatches: ppCases.reduce((sum, result) => sum + result.mismatches, 0),
      mismatchesSample: ppMismatches.slice(0, 10),
      cases: ppCases
    },
    {
      key: "line_combo_labels",
      label: "`line_combo_slot` / `line_combo_group`",
      status: lineCases.every((result) => result.status === "PASS")
        ? "PASS"
        : lineCases.every((result) => result.status === "NO_ROWS")
          ? "NO_ROWS"
          : "FAIL",
      comparedRows: lineCases.reduce((sum, result) => sum + result.comparedRows, 0),
      mismatches: lineCases.reduce((sum, result) => sum + result.mismatches, 0),
      mismatchesSample: lineMismatches.slice(0, 10),
      cases: lineCases
    }
  ];

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        validationCases: VALIDATION_CASES,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[rolling-player-context-labels] Failed:", error);
  process.exitCode = 1;
});
