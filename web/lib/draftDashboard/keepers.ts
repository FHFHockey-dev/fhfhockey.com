export const KEEPER_CONTRACT_VERSION = 1 as const;

export type KeeperEntry = {
  version: typeof KEEPER_CONTRACT_VERSION;
  status: "valid";
  playerId: string;
  teamId: string;
  round: number;
  pickInRound: number;
  pickNumber: number;
};

export type KeeperCandidate = {
  playerId: unknown;
  teamId: unknown;
  round: unknown;
  pickInRound: unknown;
};

export type KeeperDraftPick = {
  playerId: string;
  teamId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  isKeeper?: boolean;
  keeperVersion?: number;
};

export type KeeperValidationContext = {
  teamCount: number;
  roundCount: number;
  teamIds: Iterable<string>;
  playerIds: Iterable<string>;
  keepers?: KeeperEntry[];
  draftedPlayers?: KeeperDraftPick[];
};

export type KeeperValidationResult =
  | { ok: true; keeper: KeeperEntry }
  | { ok: false; errors: string[] };

const integer = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : null;
};

export function keeperPickNumber(
  round: number,
  pickInRound: number,
  teamCount: number
) {
  return (round - 1) * teamCount + pickInRound;
}

export function keeperPickKey(keeper: Pick<KeeperEntry, "round" | "pickInRound">) {
  return `${keeper.round}-${keeper.pickInRound}`;
}

export function getNextOpenPick(
  startPick: number,
  totalPicks: number,
  draftedPlayers: Iterable<Pick<KeeperDraftPick, "pickNumber">>
) {
  const completed = new Set(
    Array.from(draftedPlayers, (pick) => pick.pickNumber)
  );
  let pick = Math.max(1, Math.floor(startPick));
  while (pick <= totalPicks && completed.has(pick)) pick += 1;
  return pick;
}

export function validateKeeperCandidate(
  candidate: KeeperCandidate,
  context: KeeperValidationContext
): KeeperValidationResult {
  const playerId = String(candidate.playerId ?? "").trim();
  const teamId = String(candidate.teamId ?? "").trim();
  const round = integer(candidate.round);
  const pickInRound = integer(candidate.pickInRound);
  const teamIds = new Set(Array.from(context.teamIds, String));
  const playerIds = new Set(Array.from(context.playerIds, String));
  const errors: string[] = [];

  if (!playerId || !playerIds.has(playerId)) errors.push("Player does not exist.");
  if (!teamId || !teamIds.has(teamId)) errors.push("Keeper team is invalid.");
  if (round == null || round < 1 || round > context.roundCount) {
    errors.push(`Round must be between 1 and ${context.roundCount}.`);
  }
  if (pickInRound == null || pickInRound < 1 || pickInRound > context.teamCount) {
    errors.push(`Pick must be between 1 and ${context.teamCount}.`);
  }
  if (errors.length || round == null || pickInRound == null) {
    return { ok: false, errors };
  }

  const pickNumber = keeperPickNumber(round, pickInRound, context.teamCount);
  const keepers = context.keepers ?? [];
  const drafted = context.draftedPlayers ?? [];
  if (keepers.some((keeper) => keeper.playerId === playerId)) {
    errors.push("Player is already configured as a keeper.");
  }
  if (keepers.some((keeper) => keeper.pickNumber === pickNumber)) {
    errors.push("That pick is already assigned to a keeper.");
  }
  if (drafted.some((pick) => pick.playerId === playerId && !pick.isKeeper)) {
    errors.push("Player has already been drafted.");
  }
  if (drafted.some((pick) => pick.pickNumber === pickNumber && !pick.isKeeper)) {
    errors.push("That pick has already been completed.");
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    keeper: {
      version: KEEPER_CONTRACT_VERSION,
      status: "valid",
      playerId,
      teamId,
      round,
      pickInRound,
      pickNumber
    }
  };
}

export function materializeKeeperPicks(
  draftedPlayers: KeeperDraftPick[],
  keepers: KeeperEntry[]
) {
  const keeperPickNumbers = new Set(keepers.map((keeper) => keeper.pickNumber));
  const keeperPlayerIds = new Set(keepers.map((keeper) => keeper.playerId));
  const ordinaryPicks = draftedPlayers.filter(
    (pick) =>
      !pick.isKeeper &&
      !keeperPickNumbers.has(pick.pickNumber) &&
      !keeperPlayerIds.has(pick.playerId)
  );
  return [
    ...ordinaryPicks,
    ...keepers.map((keeper) => ({
      playerId: keeper.playerId,
      teamId: keeper.teamId,
      pickNumber: keeper.pickNumber,
      round: keeper.round,
      pickInRound: keeper.pickInRound,
      isKeeper: true,
      keeperVersion: keeper.version
    }))
  ].sort((left, right) => left.pickNumber - right.pickNumber);
}

export function migrateKeeperEntries(value: unknown, teamCount: number) {
  if (!Array.isArray(value) || !Number.isInteger(teamCount) || teamCount < 1) {
    return [] as KeeperEntry[];
  }
  const migrated: KeeperEntry[] = [];
  const playerIds = new Set<string>();
  const pickNumbers = new Set<number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const playerId = String(candidate.playerId ?? "").trim();
    const teamId = String(candidate.teamId ?? "").trim();
    const round = integer(candidate.round);
    const pickInRound = integer(candidate.pickInRound);
    if (
      !playerId ||
      !teamId ||
      round == null ||
      round < 1 ||
      pickInRound == null ||
      pickInRound < 1 ||
      pickInRound > teamCount
    ) {
      continue;
    }
    const pickNumber = keeperPickNumber(round, pickInRound, teamCount);
    if (playerIds.has(playerId) || pickNumbers.has(pickNumber)) continue;
    playerIds.add(playerId);
    pickNumbers.add(pickNumber);
    migrated.push({
      version: KEEPER_CONTRACT_VERSION,
      status: "valid",
      playerId,
      teamId,
      round,
      pickInRound,
      pickNumber
    });
  }
  return migrated;
}

export function parseKeeperImport(input: string):
  | { ok: true; candidates: KeeperCandidate[] }
  | { ok: false; errors: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, errors: ["Paste at least one keeper row."] };
  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    if (!rows.every((row) => row && typeof row === "object")) {
      return { ok: false, errors: ["JSON keeper input must contain objects."] };
    }
    return { ok: true, candidates: rows as KeeperCandidate[] };
  } catch {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
    const cells = lines.map((line) => line.split(",").map((cell) => cell.trim()));
    const first = cells[0].map((cell) => cell.toLowerCase());
    const hasHeader = first.includes("playerid") && first.includes("teamid");
    const header = hasHeader
      ? first
      : ["playerid", "teamid", "round", "pickinround"];
    const data = hasHeader ? cells.slice(1) : cells;
    const required = ["playerid", "teamid", "round", "pickinround"];
    if (required.some((key) => !header.includes(key))) {
      return {
        ok: false,
        errors: ["CSV requires playerId, teamId, round, and pickInRound columns."]
      };
    }
    return {
      ok: true,
      candidates: data.map((row) => ({
        playerId: row[header.indexOf("playerid")],
        teamId: row[header.indexOf("teamid")],
        round: row[header.indexOf("round")],
        pickInRound: row[header.indexOf("pickinround")]
      }))
    };
  }
}

export function validateKeeperBatch(
  candidates: KeeperCandidate[],
  context: KeeperValidationContext
) {
  const accepted: KeeperEntry[] = [];
  const errors: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const result = validateKeeperCandidate(candidate, {
      ...context,
      keepers: [...(context.keepers ?? []), ...accepted],
      draftedPlayers: materializeKeeperPicks(
        context.draftedPlayers ?? [],
        [...(context.keepers ?? []), ...accepted]
      )
    });
    if (!result.ok) {
      errors.push(`Row ${index + 1}: ${result.errors.join(" ")}`);
    } else {
      accepted.push(result.keeper);
    }
  }
  return errors.length
    ? { ok: false as const, keepers: [] as KeeperEntry[], errors }
    : { ok: true as const, keepers: accepted, errors: [] as string[] };
}
