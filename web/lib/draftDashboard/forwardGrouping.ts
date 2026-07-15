export type ForwardGrouping = "split" | "fwd";
export type RosterConfig = Record<string, number>;

export const FORWARD_GROUPING_STORAGE_KEY =
  "draftDashboard.forwardGrouping.v1";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function loadForwardGroupingPreference(
  storage: Pick<PreferenceStorage, "getItem">
): ForwardGrouping {
  try {
    return storage.getItem(FORWARD_GROUPING_STORAGE_KEY) === "fwd"
      ? "fwd"
      : "split";
  } catch {
    return "split";
  }
}

export function saveForwardGroupingPreference(
  storage: Pick<PreferenceStorage, "setItem">,
  grouping: ForwardGrouping
) {
  storage.setItem(FORWARD_GROUPING_STORAGE_KEY, grouping);
}

const FORWARD_POSITIONS = new Set(["C", "LW", "RW", "F", "FWD"]);

export function normalizePlayerEligibility(
  displayPosition?: string | null,
  eligiblePositions?: string[] | null
) {
  const source =
    Array.isArray(eligiblePositions) && eligiblePositions.length
      ? eligiblePositions
      : String(displayPosition ?? "").split(",");
  const output = new Set<string>();
  for (const raw of source) {
    const position = String(raw).trim().toUpperCase();
    if (position === "F" || position === "FWD") {
      output.add("C");
      output.add("LW");
      output.add("RW");
    } else if (["C", "LW", "RW", "D", "G"].includes(position)) {
      output.add(position);
    }
  }
  return Array.from(output);
}

export function groupPlayerEligibility(
  positions: string[],
  grouping: ForwardGrouping
) {
  if (grouping === "split") return Array.from(new Set(positions));
  const grouped = new Set<string>();
  for (const position of positions) {
    if (FORWARD_POSITIONS.has(position)) grouped.add("FWD");
    else if (position === "D" || position === "G") grouped.add(position);
  }
  return Array.from(grouped);
}

export function getForwardRosterTotal(rosterConfig: RosterConfig) {
  if (Number.isFinite(rosterConfig.FWD)) return Math.max(0, rosterConfig.FWD);
  return ["C", "LW", "RW"].reduce(
    (sum, position) => sum + Math.max(0, Number(rosterConfig[position]) || 0),
    0
  );
}

export function getRosterPositions(grouping: ForwardGrouping) {
  return grouping === "fwd" ? ["FWD", "D", "G"] : ["C", "LW", "RW", "D", "G"];
}

export function getEffectiveRosterConfig(
  rosterConfig: RosterConfig,
  grouping: ForwardGrouping
): RosterConfig {
  if (grouping === "split") return { ...rosterConfig };
  const { C: _c, LW: _lw, RW: _rw, ...rest } = rosterConfig;
  return { ...rest, FWD: getForwardRosterTotal(rosterConfig) };
}

export function setForwardRosterTotal(
  rosterConfig: RosterConfig,
  requestedTotal: number
) {
  const total = Math.max(0, Math.round(requestedTotal));
  const current = ["C", "LW", "RW"].map(
    (position) => Math.max(0, Number(rosterConfig[position]) || 0)
  );
  const currentTotal = current.reduce((sum, value) => sum + value, 0);
  const basis = currentTotal > 0 ? current : [1, 1, 1];
  const basisTotal = basis.reduce((sum, value) => sum + value, 0);
  const exact = basis.map((value) => (value / basisTotal) * total);
  const distributed = exact.map(Math.floor);
  let remainder = total - distributed.reduce((sum, value) => sum + value, 0);
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        distributed[index] += 1;
        remainder -= 1;
      }
    });
  return {
    ...rosterConfig,
    C: distributed[0],
    LW: distributed[1],
    RW: distributed[2]
  };
}

export function buildPositionPools(
  playerIds: Iterable<string>,
  values: ReadonlyMap<string, number>,
  eligibility: ReadonlyMap<string, string[]>,
  grouping: ForwardGrouping
) {
  const pools: Record<string, Array<{ id: string; value: number }>> = {};
  for (const position of getRosterPositions(grouping)) pools[position] = [];
  for (const id of playerIds) {
    const groupedPositions = groupPlayerEligibility(
      eligibility.get(id) ?? [],
      grouping
    );
    for (const position of groupedPositions) {
      if (!pools[position]) continue;
      pools[position].push({ id, value: values.get(id) ?? 0 });
    }
  }
  for (const pool of Object.values(pools)) {
    pool.sort((left, right) => right.value - left.value || left.id.localeCompare(right.id));
  }
  return pools;
}

export function allocateGroupedRosterSlots({
  players,
  rosterConfig,
  grouping,
  overrides = {}
}: {
  players: Array<{ id: string; eligibility: string[] }>;
  rosterConfig: RosterConfig;
  grouping: ForwardGrouping;
  overrides?: Record<string, string>;
}) {
  const effective = getEffectiveRosterConfig(rosterConfig, grouping);
  const positions = getRosterPositions(grouping);
  const counts: Record<string, number> = Object.fromEntries([
    ...positions.map((position) => [position, 0] as const),
    ["UTILITY", 0],
    ["BENCH", 0]
  ]);
  const assignments: Record<string, string> = {};

  for (const player of players) {
    const eligible = groupPlayerEligibility(player.eligibility, grouping);
    const override = overrides[player.id]?.toUpperCase();
    const canUse = (position: string) =>
      eligible.includes(position) &&
      counts[position] < Math.max(0, Number(effective[position]) || 0);
    let assignment = override && canUse(override) ? override : undefined;
    if (!assignment) assignment = eligible.find(canUse);
    if (
      !assignment &&
      !eligible.includes("G") &&
      counts.UTILITY < Math.max(0, Number(effective.utility) || 0)
    ) {
      assignment = "UTILITY";
    }
    assignment ||= "BENCH";
    counts[assignment] += 1;
    assignments[player.id] = assignment;
  }
  return { assignments, counts, effectiveRosterConfig: effective };
}
