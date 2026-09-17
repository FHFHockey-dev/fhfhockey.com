/** Pure, today-only assignment. Provider access and identity resolution stay server-side. */
export type TodayPlayer = {
  id: string;
  eligiblePositions: string[];
  selectedPosition: string | null;
  lock: "locked" | "unlocked" | "unknown";
  value: number | null;
  valueBasis: "unconditional" | "conditional" | "no_game" | "missing";
  scheduleStatus?: "scheduled" | "no_game" | "unknown";
  identityVerified: boolean;
  canDrop: boolean | null;
};
export type TodayStream = TodayPlayer & {
  availability: "free_agent" | "waivers" | "rostered" | "unknown";
  usableToday: boolean | null;
  acquisitionLimitations?: string[];
};
export type TodaySlot = { id: string; position: string };
const inactive = new Set(["BN", "IR", "IR+", "IL", "IL+", "NA"]);
const supported = new Set(["C", "LW", "RW", "W", "F", "D", "G", "Util"]);

function eligible(player: TodayPlayer, position: string) {
  const positions = new Set(player.eligiblePositions);
  if (positions.has(position)) return true;
  if (position === "W") return positions.has("LW") || positions.has("RW");
  if (position === "F") return ["C", "LW", "RW", "W"].some((key) => positions.has(key));
  return position === "Util" && ["C", "LW", "RW", "W", "F", "D"].some((key) => positions.has(key));
}

function usable(player: TodayPlayer) {
  return player.identityVerified && (player.valueBasis === "unconditional" || (player.valueBasis === "no_game" && player.value === 0))
    && player.value !== null && Number.isFinite(player.value);
}

/** Rectangular Hungarian assignment, with one zero-value empty choice per slot. */
function assign(slots: TodaySlot[], players: TodayPlayer[]) {
  const n = slots.length, m = players.length + n;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0);
  const p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  const cost = (row: number, col: number) => col > players.length ? 0
    : eligible(players[col - 1], slots[row - 1].position) ? -players[col - 1].value! : 1e12;
  for (let row = 1; row <= n; row++) {
    p[0] = row;
    let col = 0;
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[col] = true;
      const current = p[col];
      let delta = Infinity, next = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const reduced = cost(current, j) - u[current] - v[j];
        if (reduced < min[j]) { min[j] = reduced; way[j] = col; }
        if (min[j] < delta) { delta = min[j]; next = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      col = next;
    } while (p[col] !== 0);
    do { const previous = way[col]; p[col] = p[previous]; col = previous; } while (col !== 0);
  }
  const result = slots.map((slot) => ({ ...slot, playerId: null as string | null, value: 0 as number | null, preserved: false }));
  for (let j = 1; j <= players.length; j++) if (p[j] && eligible(players[j - 1], slots[p[j] - 1].position)) {
    result[p[j] - 1] = { ...result[p[j] - 1], playerId: players[j - 1].id, value: players[j - 1].value, preserved: false };
  }
  return result;
}

export function optimizeToday(args: { slots: TodaySlot[]; roster: TodayPlayer[]; limitations?: string[] }) {
  if (args.slots.length > 40 || args.roster.length > 100
    || new Set(args.slots.map((slot) => slot.id)).size !== args.slots.length
    || new Set(args.roster.map((player) => player.id)).size !== args.roster.length) throw new Error("Invalid roster or slot identities");
  const limitations = new Set(args.limitations ?? []);
  const players = [...args.roster].sort((a, b) => a.id.localeCompare(b.id));
  const active = args.slots.filter((slot) => !inactive.has(slot.position)).sort((a, b) => a.id.localeCompare(b.id));
  if (active.some((slot) => !supported.has(slot.position))) limitations.add("Unsupported active roster slots.");
  const free = active.filter((slot) => supported.has(slot.position));
  const preserved: ReturnType<typeof assign> = [];
  for (const player of players) {
    if (!player.identityVerified) limitations.add("Some Yahoo player identities are unresolved.");
    if (!usable(player)) limitations.add("Some players lack unconditional expected production.");
    if (player.lock === "unknown") limitations.add("Unknown lock status; affected players remain in their current positions.");
    if (!player.selectedPosition) limitations.add("A player's selected position is missing.");
    if (player.lock === "unlocked" && usable(player) && player.selectedPosition) continue;
    if (player.selectedPosition && !inactive.has(player.selectedPosition)) {
      const index = free.findIndex((slot) => slot.position === player.selectedPosition);
      if (index < 0) limitations.add("Current roster positions do not match the league's available slots.");
      else {
        const [slot] = free.splice(index, 1);
        preserved.push({ ...slot, playerId: player.id, value: usable(player) ? player.value : null, preserved: true });
      }
    }
  }
  const movable = players.filter((player) => player.lock === "unlocked" && usable(player)
    && player.selectedPosition && !["IR", "IR+", "IL", "IL+", "NA"].includes(player.selectedPosition));
  const assignments = [...preserved, ...assign(free, movable)].sort((a, b) => a.id.localeCompare(b.id));
  const total = assignments.every((row) => row.value !== null) ? assignments.reduce((sum, row) => sum + row.value!, 0) : null;
  return { status: limitations.size ? "incomplete" as const : "complete" as const,
    assignments, expectedValue: total, limitations: [...limitations],
    // Bench and inactive locks remain visible even though they occupy no scoring slot.
    preservedPlayers: players.filter((player) => player.lock !== "unlocked" || !usable(player)
      || ["IR", "IR+", "IL", "IL+", "NA"].includes(player.selectedPosition ?? ""))
      .map((player) => ({ playerId: player.id, selectedPosition: player.selectedPosition, lock: player.lock })),
  };
}

export type TodayStreamRecommendation = { playerId: string; availability: TodayStream["availability"]; usableToday: boolean | null; incrementalValue: number | null; dropPlayerId: string | null; limitations: string[] };
export function rankTodayStreams(args: Parameters<typeof optimizeToday>[0] & { candidates: TodayStream[]; openRosterSpots: number | null }): TodayStreamRecommendation[] {
  if (args.candidates.length > 1000) throw new Error("Too many streaming candidates");
  const base = optimizeToday(args);
  return args.candidates.filter((candidate) => !args.roster.some((player) => player.id === candidate.id)).map((candidate) => {
    const limitations: string[] = [...(candidate.acquisitionLimitations ?? [])];
    if (candidate.availability !== "free_agent") limitations.push(`Availability: ${candidate.availability}.`);
    if (candidate.usableToday !== true && !candidate.acquisitionLimitations?.length) limitations.push(candidate.usableToday === false
      ? "This player cannot be acquired for today's lineup." : "Acquisition timing does not establish usability today.");
    if (!usable(candidate) || candidate.lock !== "unlocked") limitations.push("A usable, unconditional pregame projection is unavailable.");
    if (base.status !== "complete" || base.expectedValue === null) limitations.push("The roster calculation is incomplete.");
    if (args.openRosterSpots === null) limitations.push("Available roster capacity is unknown.");
    let gain: number | null = null, dropPlayerId: string | null = null;
    if (!limitations.length) {
      const drops: Array<TodayPlayer | null> = args.openRosterSpots! > 0 ? [null]
        : args.roster.filter((player) => player.canDrop === true && player.lock === "unlocked"
          && !["IR", "IR+", "IL", "IL+", "NA"].includes(player.selectedPosition ?? ""))
          .sort((a, b) => a.id.localeCompare(b.id));
      for (const drop of drops) {
        const revised = optimizeToday({ ...args, roster: [...args.roster.filter((player) => player.id !== drop?.id),
          { ...candidate, selectedPosition: "BN" }] });
        if (revised.status !== "complete" || revised.expectedValue === null) continue;
        const improvement = revised.expectedValue - base.expectedValue!;
        if (gain === null || improvement > gain) { gain = improvement; dropPlayerId = drop?.id ?? null; }
      }
      if (gain === null) limitations.push("No verified legal roster addition or drop is available.");
    }
    return { playerId: candidate.id, availability: candidate.availability, usableToday: candidate.usableToday, incrementalValue: gain, dropPlayerId, limitations };
  }).sort((a, b) => (b.incrementalValue ?? -Infinity) - (a.incrementalValue ?? -Infinity) || a.playerId.localeCompare(b.playerId));
}
