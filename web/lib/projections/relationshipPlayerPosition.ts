export type RelationshipPlayerType = "G" | "F" | "D";
export type RelationshipPrimaryPosition = "C" | "LW" | "RW" | "D" | "G";

export type RelationshipYahooPosition = {
  display_position: string | null;
  primary_position: string | null;
};

export type RelationshipRosterPosition = {
  game_id: number;
  player_id: number;
  position_code: string | null;
  source_play_by_play_hash: string;
  team_id: number;
};

export type ResolvedRelationshipPlayerPosition = {
  displayPosition: string;
  playerType: RelationshipPlayerType;
  primaryPosition: RelationshipPrimaryPosition;
  source: "yahoo" | "nhl_roster";
};

const SHA256_HEX = /^[a-f0-9]{64}$/;
const DISPLAY_POSITION = /^[A-Z]{1,2}(,[A-Z]{1,2})*$/;

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return Number(value);
}

export function normalizeRelationshipPrimaryPosition(
  value: unknown,
): RelationshipPrimaryPosition | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "C") return "C";
  if (normalized === "L" || normalized === "LW") return "LW";
  if (normalized === "R" || normalized === "RW") return "RW";
  if (normalized === "D" || normalized === "LD" || normalized === "RD") {
    return "D";
  }
  if (normalized === "G" || normalized === "GK" || normalized === "GOALIE") {
    return "G";
  }
  return null;
}

export function getRelationshipPlayerType(
  position: RelationshipPrimaryPosition,
): RelationshipPlayerType {
  if (position === "G") return "G";
  if (position === "D") return "D";
  return "F";
}

function normalizeRelationshipRosterPosition(
  value: unknown,
): RelationshipPrimaryPosition | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "C") return "C";
  if (normalized === "L") return "LW";
  if (normalized === "R") return "RW";
  if (normalized === "D") return "D";
  if (normalized === "G") return "G";
  return null;
}

function normalizeYahooDisplayPosition(args: {
  displayPosition: unknown;
  playerType: RelationshipPlayerType;
  primaryPosition: RelationshipPrimaryPosition;
}): string | null {
  if (typeof args.displayPosition !== "string") return null;
  const raw = args.displayPosition.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw || raw.length > 10 || !DISPLAY_POSITION.test(raw)) return null;

  const positions = raw.split(",").map(normalizeRelationshipPrimaryPosition);
  if (
    positions.some((position) => position == null) ||
    !positions.includes(args.primaryPosition) ||
    positions.some(
      (position) =>
        position != null && getRelationshipPlayerType(position) !== args.playerType,
    )
  ) {
    return null;
  }

  return Array.from(new Set(positions)).join(",");
}

export function buildRelationshipRosterPositionMap(args: {
  expectedPbpRawPayloadHash: string;
  gameId: number;
  rows: readonly RelationshipRosterPosition[];
}): Map<number, RelationshipRosterPosition> {
  const gameId = requirePositiveInteger(args.gameId, "relationship roster game ID");
  if (!SHA256_HEX.test(args.expectedPbpRawPayloadHash)) {
    throw new Error("Invalid relationship roster PBP snapshot hash");
  }
  if (args.rows.length === 0 || args.rows.length > 100) {
    throw new Error(`Invalid relationship roster scope for game ${gameId}`);
  }

  const positions = new Map<number, RelationshipRosterPosition>();
  for (const row of args.rows) {
    const playerId = requirePositiveInteger(
      row.player_id,
      "relationship roster player ID",
    );
    requirePositiveInteger(row.team_id, "relationship roster team ID");
    if (
      row.game_id !== gameId ||
      row.source_play_by_play_hash !== args.expectedPbpRawPayloadHash ||
      positions.has(playerId)
    ) {
      throw new Error(`Invalid relationship roster identity for player ${playerId}`);
    }
    positions.set(playerId, row);
  }
  return positions;
}

export function resolveRelationshipPlayerPosition(args: {
  expectedPbpRawPayloadHash: string;
  gameId: number;
  playerId: number;
  rosterPosition: RelationshipRosterPosition | undefined;
  teamId: number;
  yahooPosition?: RelationshipYahooPosition;
}): ResolvedRelationshipPlayerPosition {
  const gameId = requirePositiveInteger(args.gameId, "relationship game ID");
  const playerId = requirePositiveInteger(args.playerId, "relationship player ID");
  const teamId = requirePositiveInteger(args.teamId, "relationship team ID");
  if (!SHA256_HEX.test(args.expectedPbpRawPayloadHash)) {
    throw new Error("Invalid relationship roster PBP snapshot hash");
  }
  const roster = args.rosterPosition;
  if (
    !roster ||
    roster.game_id !== gameId ||
    roster.player_id !== playerId ||
    roster.team_id !== teamId ||
    roster.source_play_by_play_hash !== args.expectedPbpRawPayloadHash
  ) {
    throw new Error(`Missing current relationship roster position for player ${playerId}`);
  }

  const rosterPrimary = normalizeRelationshipRosterPosition(roster.position_code);
  if (!rosterPrimary) {
    throw new Error(`Invalid relationship roster position for player ${playerId}`);
  }
  const rosterType = getRelationshipPlayerType(rosterPrimary);

  if (args.yahooPosition) {
    const yahooPrimary = normalizeRelationshipPrimaryPosition(
      args.yahooPosition.primary_position,
    );
    if (yahooPrimary) {
      const yahooType = getRelationshipPlayerType(yahooPrimary);
      if (yahooType !== rosterType) {
        throw new Error(`Conflicting relationship position for player ${playerId}`);
      }
      const yahooDisplay = normalizeYahooDisplayPosition({
        displayPosition: args.yahooPosition.display_position,
        playerType: yahooType,
        primaryPosition: yahooPrimary,
      });
      if (yahooDisplay) {
        return {
          displayPosition: yahooDisplay,
          playerType: yahooType,
          primaryPosition: yahooPrimary,
          source: "yahoo",
        };
      }
    }
  }

  return {
    displayPosition: rosterPrimary,
    playerType: rosterType,
    primaryPosition: rosterPrimary,
    source: "nhl_roster",
  };
}

export function isCompleteRelationshipPlayerPosition(value: {
  display_position?: unknown;
  player_type?: unknown;
  primary_position?: unknown;
}): boolean {
  if (
    typeof value.primary_position !== "string" ||
    typeof value.display_position !== "string"
  ) {
    return false;
  }
  const primary = normalizeRelationshipPrimaryPosition(value.primary_position);
  if (
    !primary ||
    value.primary_position !== primary ||
    typeof value.player_type !== "string" ||
    getRelationshipPlayerType(primary) !== value.player_type
  ) {
    return false;
  }
  const normalizedDisplay = normalizeYahooDisplayPosition({
    displayPosition: value.display_position,
    playerType: value.player_type as RelationshipPlayerType,
    primaryPosition: primary,
  });
  return normalizedDisplay != null && value.display_position === normalizedDisplay;
}
