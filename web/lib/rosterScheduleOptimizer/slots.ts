import { CANONICAL_POSITION_ORDER } from "./eligibility";
import type {
  ActiveSlotType,
  OptimizerDiagnostic,
  SlotExpansion,
} from "./types";

const ACTIVE_SLOT_ALIASES: Readonly<Record<string, ActiveSlotType>> = {
  C: "C",
  LW: "LW",
  RW: "RW",
  F: "F",
  FWD: "F",
  W: "W",
  D: "D",
  UTIL: "UTIL",
  UTILITY: "UTIL",
  G: "G",
};

const BENCH_SLOT_LABELS = new Set(["BN", "BENCH", "BE"]);
const INACTIVE_SLOT_LABELS = new Set(["IR", "IR+", "NA", "IL", "IL+"]);

function canonicalLabel(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function expandActiveSlots(
  rosterSlots: Readonly<Record<string, number>>,
): SlotExpansion {
  const counts = new Map<ActiveSlotType, number>();
  const diagnostics: OptimizerDiagnostic[] = [];
  let benchCapacity = 0;
  let inactiveCapacity = 0;

  for (const [sourceType, count] of Object.entries(rosterSlots).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const label = canonicalLabel(sourceType);
    if (!Number.isSafeInteger(count) || count < 0) {
      diagnostics.push({
        code: "INVALID_SLOT_COUNT",
        severity: "error",
        position: sourceType,
        message: `Roster slot ${sourceType} has invalid count ${String(count)}.`,
      });
      continue;
    }
    if (BENCH_SLOT_LABELS.has(label)) {
      benchCapacity += count;
      continue;
    }
    if (INACTIVE_SLOT_LABELS.has(label)) {
      inactiveCapacity += count;
      continue;
    }
    const activeType = ACTIVE_SLOT_ALIASES[label];
    if (!activeType) {
      diagnostics.push({
        code: "UNKNOWN_ROSTER_SLOT",
        severity: "error",
        position: sourceType,
        message: `Roster slot ${sourceType} is not supported by the optimizer.`,
      });
      continue;
    }
    counts.set(activeType, (counts.get(activeType) ?? 0) + count);
  }

  const activeSlots = CANONICAL_POSITION_ORDER.flatMap((type) => {
    const count = counts.get(type) ?? 0;
    return Array.from({ length: count }, (_, offset) => ({
      id: `${type}#${offset + 1}`,
      type,
      index: offset + 1,
    }));
  });

  return { activeSlots, benchCapacity, inactiveCapacity, diagnostics };
}
