import supabase from "lib/supabase/server";

export type TeamTokenMatchType = "id" | "abbreviation" | "name";

export type TeamTokenTeamRow = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

export type ResolvedTeamToken = {
  input: string;
  teamId: number;
  abbreviation: string | null;
  name: string | null;
  matchedBy: TeamTokenMatchType;
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

export function resolveTeamTokenFromRows(
  token: string | null | undefined,
  rows: readonly TeamTokenTeamRow[],
): ResolvedTeamToken | null {
  const input = token?.trim() ?? "";
  if (input === "") return null;

  if (/^\d+$/.test(input)) {
    const teamId = Number(input);
    const row = rows.find((entry) => entry.id === teamId);
    return {
      input,
      teamId,
      abbreviation: row?.abbreviation ?? null,
      name: row?.name ?? null,
      matchedBy: "id",
    };
  }

  const normalized = normalizeToken(input);
  const row = rows.find((entry) => {
    const abbreviation = entry.abbreviation?.trim().toLowerCase() ?? "";
    const name = entry.name?.trim().toLowerCase() ?? "";
    return abbreviation === normalized || name === normalized;
  });

  if (!row) return null;

  return {
    input,
    teamId: row.id,
    abbreviation: row.abbreviation,
    name: row.name,
    matchedBy:
      row.abbreviation?.trim().toLowerCase() === normalized
        ? "abbreviation"
        : "name",
  };
}

export async function resolveTeamToken(
  token: string | null | undefined,
): Promise<ResolvedTeamToken | null> {
  const input = token?.trim() ?? "";
  if (input === "") return null;

  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation,name");

  if (error) {
    throw new Error(`Unable to resolve team filter: ${error.message}`);
  }

  return resolveTeamTokenFromRows(
    input,
    (data ?? []) as unknown as TeamTokenTeamRow[],
  );
}
