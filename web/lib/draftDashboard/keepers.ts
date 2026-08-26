export const KEEPER_CONTRACT_VERSION = 2 as const;

type KeeperEntryBase = {
  version: typeof KEEPER_CONTRACT_VERSION;
  status: "valid";
  playerId: string;
  teamId: string;
};

export type PickCostKeeperEntry = KeeperEntryBase & {
  cost: "pick";
  round: number;
  pickInRound: number;
  pickNumber: number;
};

export type NoPickKeeperEntry = KeeperEntryBase & {
  cost: "none";
};

export type KeeperEntry = PickCostKeeperEntry | NoPickKeeperEntry;

export type KeeperCandidate = {
  playerId: unknown;
  teamId: unknown;
  cost?: unknown;
  round?: unknown;
  pickInRound?: unknown;
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
  rosterCapacity?: number;
  teamRosterCounts?: Readonly<Record<string, number>>;
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

export function keeperPickKey(
  keeper: Pick<PickCostKeeperEntry, "round" | "pickInRound">
) {
  return `${keeper.round}-${keeper.pickInRound}`;
}

export function keeperUsesPick(
  keeper: KeeperEntry,
): keeper is PickCostKeeperEntry {
  return keeper.cost === "pick";
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
  const rawCost = String(candidate.cost ?? "pick").trim().toLowerCase();
  const cost = rawCost === "none" ? "none" : rawCost === "pick" ? "pick" : null;
  const teamIds = new Set(Array.from(context.teamIds, String));
  const playerIds = new Set(Array.from(context.playerIds, String));
  const errors: string[] = [];

  if (!playerId || !playerIds.has(playerId)) errors.push("Player does not exist.");
  if (!teamId || !teamIds.has(teamId)) errors.push("Keeper team is invalid.");
  if (!cost) errors.push('Keeper cost must be "pick" or "none".');
  if (
    teamId &&
    context.rosterCapacity != null &&
    (context.teamRosterCounts?.[teamId] ?? 0) >= context.rosterCapacity
  ) {
    errors.push("That team's roster is already full.");
  }
  const keepers = context.keepers ?? [];
  const drafted = context.draftedPlayers ?? [];
  if (keepers.some((keeper) => keeper.playerId === playerId)) {
    errors.push("Player is already configured as a keeper.");
  }
  if (drafted.some((pick) => pick.playerId === playerId && !pick.isKeeper)) {
    errors.push("Player has already been drafted.");
  }
  if (!cost) return { ok: false, errors };

  if (cost === "none") {
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      keeper: {
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        cost,
        playerId,
        teamId,
      },
    };
  }

  const round = integer(candidate.round);
  const pickInRound = integer(candidate.pickInRound);
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
  if (
    keepers.some(
      (keeper) => keeperUsesPick(keeper) && keeper.pickNumber === pickNumber,
    )
  ) {
    errors.push("That pick is already assigned to a keeper.");
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
      cost,
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
  const pickKeepers = keepers.filter(keeperUsesPick);
  const keeperPickNumbers = new Set(
    pickKeepers.map((keeper) => keeper.pickNumber),
  );
  const keeperPlayerIds = new Set(keepers.map((keeper) => keeper.playerId));
  const ordinaryPicks = draftedPlayers.filter(
    (pick) =>
      !pick.isKeeper &&
      !keeperPickNumbers.has(pick.pickNumber) &&
      !keeperPlayerIds.has(pick.playerId)
  );
  return [
    ...ordinaryPicks,
    ...pickKeepers.map((keeper) => ({
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
    const cost = candidate.cost === "none" ? "none" : "pick";
    if (!playerId || !teamId || playerIds.has(playerId)) continue;
    if (cost === "none") {
      playerIds.add(playerId);
      migrated.push({
        version: KEEPER_CONTRACT_VERSION,
        status: "valid",
        cost,
        playerId,
        teamId,
      });
      continue;
    }
    const round = integer(candidate.round);
    const pickInRound = integer(candidate.pickInRound);
    if (
      round == null ||
      round < 1 ||
      pickInRound == null ||
      pickInRound < 1 ||
      pickInRound > teamCount
    ) {
      continue;
    }
    const pickNumber = keeperPickNumber(round, pickInRound, teamCount);
    if (pickNumbers.has(pickNumber)) continue;
    playerIds.add(playerId);
    pickNumbers.add(pickNumber);
    migrated.push({
      version: KEEPER_CONTRACT_VERSION,
      status: "valid",
      cost,
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
    const required = ["playerid", "teamid"];
    if (required.some((key) => !header.includes(key))) {
      return {
        ok: false,
        errors: ["CSV requires playerId and teamId columns."]
      };
    }
    return {
      ok: true,
      candidates: data.map((row) => ({
        playerId: row[header.indexOf("playerid")],
        teamId: row[header.indexOf("teamid")],
        cost: header.includes("cost") ? row[header.indexOf("cost")] : "pick",
        round: header.includes("round") ? row[header.indexOf("round")] : undefined,
        pickInRound: header.includes("pickinround")
          ? row[header.indexOf("pickinround")]
          : undefined
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
  const teamRosterCounts = { ...(context.teamRosterCounts ?? {}) };
  for (const [index, candidate] of candidates.entries()) {
    const result = validateKeeperCandidate(candidate, {
      ...context,
      keepers: [...(context.keepers ?? []), ...accepted],
      draftedPlayers: materializeKeeperPicks(
        context.draftedPlayers ?? [],
        [...(context.keepers ?? []), ...accepted]
      ),
      teamRosterCounts,
    });
    if (!result.ok) {
      errors.push(`Row ${index + 1}: ${result.errors.join(" ")}`);
    } else {
      accepted.push(result.keeper);
      teamRosterCounts[result.keeper.teamId] =
        (teamRosterCounts[result.keeper.teamId] ?? 0) + 1;
    }
  }
  return errors.length
    ? { ok: false as const, keepers: [] as KeeperEntry[], errors }
    : { ok: true as const, keepers: accepted, errors: [] as string[] };
}
