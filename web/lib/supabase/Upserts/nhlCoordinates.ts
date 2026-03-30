export type TeamSide = "home" | "away";
export type RinkSide = "left" | "right";

export type NormalizedCoordinateContext = {
  homeTeamDefendingSide: RinkSide | null;
  teamSide: TeamSide | null;
};

export type NormalizedCoordinates = {
  rawX: number | null;
  rawY: number | null;
  normalizedX: number | null;
  normalizedY: number | null;
  isMirrored: boolean | null;
  attackingSide: RinkSide | null;
  attackingNetX: number | null;
  attackingNetY: number | null;
};

export const OFFENSIVE_NET_X = 89;
export const OFFENSIVE_NET_Y = 0;

function normalizeNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

function normalizeRinkSide(
  value: string | null | undefined
): RinkSide | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "left" || normalized === "right") return normalized;
  return null;
}

export function getTeamAttackingSide(
  homeTeamDefendingSide: string | null | undefined,
  teamSide: TeamSide | null | undefined
): RinkSide | null {
  const normalizedHomeDefendingSide = normalizeRinkSide(homeTeamDefendingSide);
  if (!normalizedHomeDefendingSide || !teamSide) return null;

  if (teamSide === "home") {
    return normalizedHomeDefendingSide === "left" ? "right" : "left";
  }

  return normalizedHomeDefendingSide;
}

export function normalizeCoordinatesToAttackingDirection(
  xCoord: number | null | undefined,
  yCoord: number | null | undefined,
  context: NormalizedCoordinateContext
): NormalizedCoordinates {
  const rawX = normalizeNumber(xCoord);
  const rawY = normalizeNumber(yCoord);
  const attackingSide = getTeamAttackingSide(
    context.homeTeamDefendingSide,
    context.teamSide
  );

  if (rawX == null || rawY == null || attackingSide == null) {
    return {
      rawX,
      rawY,
      normalizedX: null,
      normalizedY: null,
      isMirrored: null,
      attackingSide,
      attackingNetX: attackingSide == null ? null : OFFENSIVE_NET_X,
      attackingNetY: attackingSide == null ? null : OFFENSIVE_NET_Y,
    };
  }

  const isMirrored = attackingSide === "left";

  return {
    rawX,
    rawY,
    normalizedX: isMirrored ? rawX * -1 : rawX,
    normalizedY: isMirrored ? rawY * -1 : rawY,
    isMirrored,
    attackingSide,
    attackingNetX: OFFENSIVE_NET_X,
    attackingNetY: OFFENSIVE_NET_Y,
  };
}
