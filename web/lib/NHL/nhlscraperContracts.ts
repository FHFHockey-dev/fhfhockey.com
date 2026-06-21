import { createHash } from "crypto";

import contractsSnapshot from "lib/NHL/data/nhlscraper-contracts-0.6.1.json";

export const NHLSCRAPER_CONTRACTS_PACKAGE_VERSION = "0.6.1";
export const NHLSCRAPER_CONTRACTS_ROW_COUNT = 13112;

const SUPABASE_PAGE_SIZE = 1000;

export type NhlscraperContractSourceRow = {
  playerFullName: string;
  positionCode: string | null;
  teamTriCode: string | null;
  teamId: number | null;
  signedWithTriCode: string | null;
  signedWithTeamId: number | null;
  ageAtSigning: number | null;
  startSeasonId: number;
  endSeasonId: number;
  contractYears: number | null;
  contractValue: number | null;
  contractAAV: number | null;
  signingBonus: number | null;
  twoYearCash: number | null;
  threeYearCash: number | null;
  sourceFile: string | null;
};

export type ContractPlayerResolutionStatus =
  | "matched"
  | "unmatched"
  | "ambiguous"
  | "not_attempted";

export type ContractPlayerRow = {
  id: number;
  fullName: string;
  position: string | null;
  birthDate: string | null;
  team_id: number | null;
};

export type NhlPlayerContractDbRow = {
  contract_key: string;
  source: "nhlscraper";
  source_package_version: string;
  source_file: string | null;
  player_id: number | null;
  player_full_name: string;
  position_code: string | null;
  team_tri_code: string | null;
  team_id: number | null;
  signed_with_team_tri_code: string | null;
  signed_with_team_id: number | null;
  age_at_signing: number | null;
  start_season_id: number;
  end_season_id: number;
  contract_years: number | null;
  contract_value: number | null;
  contract_aav: number | null;
  signing_bonus: number | null;
  two_year_cash: number | null;
  three_year_cash: number | null;
  resolution_status: ContractPlayerResolutionStatus;
  resolution_candidate_count: number;
  raw_contract: NhlscraperContractSourceRow;
  provenance: Record<string, unknown>;
  updated_at: string;
};

type PlayerResolution = {
  playerId: number | null;
  status: ContractPlayerResolutionStatus;
  candidateCount: number;
};

const snapshotRows =
  contractsSnapshot as unknown as NhlscraperContractSourceRow[];

function normalizePersonKey(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function birthYear(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value.slice(0, 4), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function startYear(seasonId: number): number {
  return Math.floor(seasonId / 10000);
}

function allowedPositions(positionCode: string | null): string[] {
  switch (positionCode?.toUpperCase()) {
    case "C":
      return ["C"];
    case "D":
      return ["D"];
    case "G":
      return ["G"];
    case "LW":
    case "L":
      return ["L", "LW"];
    case "RW":
    case "R":
      return ["R", "RW"];
    case "F":
      return ["C", "L", "LW", "R", "RW", "F"];
    default:
      return [];
  }
}

function contractKey(row: NhlscraperContractSourceRow): string {
  const parts = [
    row.playerFullName,
    row.positionCode,
    row.teamTriCode,
    row.signedWithTriCode,
    row.ageAtSigning,
    row.startSeasonId,
    row.endSeasonId,
    row.contractYears,
    row.contractValue,
    row.contractAAV,
    row.signingBonus,
    row.twoYearCash,
    row.threeYearCash,
    row.sourceFile,
  ].map((value) => String(value ?? ""));

  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function buildPlayerNameIndex(players: ContractPlayerRow[]) {
  const index = new Map<string, ContractPlayerRow[]>();
  for (const player of players) {
    const key = normalizePersonKey(player.fullName);
    if (!key) continue;
    const existing = index.get(key);
    if (existing) existing.push(player);
    else index.set(key, [player]);
  }
  return index;
}

function resolvePlayer(
  row: NhlscraperContractSourceRow,
  playerIndex: Map<string, ContractPlayerRow[]>,
): PlayerResolution {
  const initialCandidates =
    playerIndex.get(normalizePersonKey(row.playerFullName)) ?? [];
  if (!initialCandidates.length) {
    return { playerId: null, status: "unmatched", candidateCount: 0 };
  }

  let candidates = initialCandidates;
  const positions = allowedPositions(row.positionCode);
  if (positions.length) {
    const positionMatches = candidates.filter((player) =>
      positions.includes(String(player.position ?? "").toUpperCase()),
    );
    if (positionMatches.length) candidates = positionMatches;
  }

  if (row.ageAtSigning != null) {
    const expectedYears = new Set([
      startYear(row.startSeasonId) - row.ageAtSigning - 1,
      startYear(row.startSeasonId) - row.ageAtSigning,
      startYear(row.startSeasonId) - row.ageAtSigning + 1,
    ]);
    const birthYearMatches = candidates.filter((player) => {
      const year = birthYear(player.birthDate);
      return year != null && expectedYears.has(year);
    });
    if (birthYearMatches.length) candidates = birthYearMatches;
  }

  if (candidates.length > 1) {
    const teamMatches = candidates.filter(
      (player) =>
        player.team_id != null &&
        (player.team_id === row.teamId || player.team_id === row.signedWithTeamId),
    );
    if (teamMatches.length) candidates = teamMatches;
  }

  if (candidates.length === 1) {
    return {
      playerId: candidates[0].id,
      status: "matched",
      candidateCount: initialCandidates.length,
    };
  }

  return {
    playerId: null,
    status: "ambiguous",
    candidateCount: candidates.length,
  };
}

export function getNhlscraperContractSourceRows(): NhlscraperContractSourceRow[] {
  return snapshotRows;
}

export function buildNhlscraperContractRows(args: {
  sourceRows?: NhlscraperContractSourceRow[];
  players?: ContractPlayerRow[];
  resolvePlayers?: boolean;
  now?: string;
}): NhlPlayerContractDbRow[] {
  const rows = args.sourceRows ?? snapshotRows;
  const playerIndex =
    args.resolvePlayers === false
      ? null
      : buildPlayerNameIndex(args.players ?? []);
  const updatedAt = args.now ?? new Date().toISOString();

  return rows.map((row) => {
    const resolution = playerIndex
      ? resolvePlayer(row, playerIndex)
      : {
          playerId: null,
          status: "not_attempted" as const,
          candidateCount: 0,
        };

    return {
      contract_key: contractKey(row),
      source: "nhlscraper",
      source_package_version: NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
      source_file: row.sourceFile,
      player_id: resolution.playerId,
      player_full_name: row.playerFullName,
      position_code: row.positionCode,
      team_tri_code: row.teamTriCode,
      team_id: row.teamId,
      signed_with_team_tri_code: row.signedWithTriCode,
      signed_with_team_id: row.signedWithTeamId,
      age_at_signing: row.ageAtSigning,
      start_season_id: row.startSeasonId,
      end_season_id: row.endSeasonId,
      contract_years: row.contractYears,
      contract_value: row.contractValue,
      contract_aav: row.contractAAV,
      signing_bonus: row.signingBonus,
      two_year_cash: row.twoYearCash,
      three_year_cash: row.threeYearCash,
      resolution_status: resolution.status,
      resolution_candidate_count: resolution.candidateCount,
      raw_contract: row,
      provenance: {
        package: "nhlscraper",
        packageVersion: NHLSCRAPER_CONTRACTS_PACKAGE_VERSION,
        source: "R/sysdata.rda:.contracts_base",
        generatedFrom: "CRAN nhlscraper_0.6.1.tar.gz",
      },
      updated_at: updatedAt,
    };
  });
}

export function chunkRows<T>(rows: T[], batchSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }
  return chunks;
}

export async function fetchContractPlayerRows(
  supabase: any,
): Promise<ContractPlayerRow[]> {
  const rows: ContractPlayerRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("players")
      .select("id, fullName, position, birthDate, team_id")
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch player rows: ${error.message}`);
    }

    if (!data?.length) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

export const __testables = {
  allowedPositions,
  buildPlayerNameIndex,
  contractKey,
  normalizePersonKey,
  resolvePlayer,
};
