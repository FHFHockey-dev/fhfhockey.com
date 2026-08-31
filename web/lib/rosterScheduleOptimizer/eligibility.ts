import type {
  ActiveSlotType,
  CanonicalEligibility,
  NormalizedEligibility,
  PlayerClass,
} from "./types";

const POSITION_ORDER: readonly CanonicalEligibility[] = [
  "C",
  "LW",
  "RW",
  "F",
  "W",
  "D",
  "UTIL",
  "G",
];

const POSITION_ALIASES: Readonly<Record<string, CanonicalEligibility>> = {
  C: "C",
  CENTER: "C",
  CENTRE: "C",
  LW: "LW",
  "LEFT WING": "LW",
  RW: "RW",
  "RIGHT WING": "RW",
  F: "F",
  FWD: "F",
  FORWARD: "F",
  W: "W",
  WING: "W",
  WINGER: "W",
  D: "D",
  DEF: "D",
  DEFENSE: "D",
  DEFENCE: "D",
  UTIL: "UTIL",
  UTILITY: "UTIL",
  G: "G",
  GOALIE: "G",
};

function sourceLabels(value: string | readonly string[] | null): string[] {
  if (value == null) return [];
  const values = typeof value === "string" ? [value] : value;
  return values
    .flatMap((entry) => entry.split(/[,/|]+/))
    .map((entry) => entry.trim().toUpperCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

function resolvePlayerClass(
  positions: ReadonlySet<CanonicalEligibility>,
): PlayerClass | null {
  const hasGoalie = positions.has("G");
  const hasSkater = Array.from(positions).some((position) => position !== "G");
  if (hasGoalie === hasSkater) return null;
  return hasGoalie ? "goalie" : "skater";
}

export function normalizeEligibility(
  value: string | readonly string[] | null,
): NormalizedEligibility {
  const labels = sourceLabels(value);
  const normalized = new Set<CanonicalEligibility>();
  const unknown = new Set<string>();

  for (const label of labels) {
    const position = POSITION_ALIASES[label];
    if (position) normalized.add(position);
    else unknown.add(label);
  }

  const positions = POSITION_ORDER.filter((position) => normalized.has(position));
  const playerClass = resolvePlayerClass(normalized);
  return {
    valid: labels.length > 0 && unknown.size === 0 && playerClass !== null,
    positions,
    playerClass,
    unknownLabels: Array.from(unknown).sort(),
    sourceLabels: Array.from(new Set(labels)).sort(),
  };
}

export function canEligibilityOccupySlot(
  eligibility: NormalizedEligibility,
  slotType: ActiveSlotType,
): boolean {
  if (!eligibility.valid || eligibility.playerClass === null) return false;
  if (eligibility.playerClass === "goalie") return slotType === "G";
  if (slotType === "G") return false;
  if (slotType === "UTIL") return true;

  const positions = new Set(eligibility.positions);
  if (slotType === "F") {
    return ["C", "LW", "RW", "F", "W"].some((position) =>
      positions.has(position as CanonicalEligibility),
    );
  }
  if (slotType === "W") {
    return ["LW", "RW", "W"].some((position) =>
      positions.has(position as CanonicalEligibility),
    );
  }
  return positions.has(slotType);
}

export function compatibleActiveSlotTypes(
  value: string | readonly string[] | null,
  activeSlotTypes: readonly ActiveSlotType[],
): readonly ActiveSlotType[] {
  const eligibility = normalizeEligibility(value);
  return POSITION_ORDER.filter(
    (position) =>
      activeSlotTypes.includes(position) &&
      canEligibilityOccupySlot(eligibility, position),
  );
}

export const CANONICAL_POSITION_ORDER = POSITION_ORDER;
