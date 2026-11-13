/**
 * 5v5 lines from observed `team_unit_toi` units (decisions 107 and 137).
 *
 * Decision 107: a "line" is the most-used observed 5v5 unit, after L5's
 * shift-overlap repair of `team_unit_toi`. Decision 137: the Lines board shows
 * disjoint units; each player occupies one slot, and units are chosen
 * greedily by shared 5v5 TOI so the board reads as a line chart.
 *
 * Serving waits on the production `team_unit_toi` rebuild, so the switch is
 * off and Lines keeps the labelled all-strength legacy grouping until then.
 */
export const LINES_FIVE_ON_FIVE_ENABLED = false;

export type FiveOnFiveUnitType = "forward_line" | "defense_pair";

/** One stored `team_unit_toi` row (the columns this reader needs). */
export type TeamUnitToiReaderRow = {
  game_id: number;
  team_id: number;
  snapshot_date: string;
  unit_type: string;
  player_ids: number[];
  player_count: number;
  /** Pooled player-seconds: a 10 s trio segment stores 30. */
  unit_toi_seconds: number;
  coverage_status: string;
};

export type ObservedUnit = {
  /** Distinct player ids, ascending. */
  playerIds: number[];
  /** Clock seconds the unit was on the ice together at 5v5. */
  sharedSeconds: number;
};

const UNIT_SIZE: Record<FiveOnFiveUnitType, number> = {
  forward_line: 3,
  defense_pair: 2
};

/** Lines board slots: four forward lines and three defense pairs. */
export const FIVE_ON_FIVE_SLOTS: Record<FiveOnFiveUnitType, number> = {
  forward_line: 4,
  defense_pair: 3
};

function compareIds(a: readonly number[], b: readonly number[]) {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

/**
 * Higher shared 5v5 seconds first; equal seconds are ordered by the sorted
 * player ids, so the result never depends on input order (rule 20).
 */
export function compareObservedUnits(a: ObservedUnit, b: ObservedUnit) {
  return b.sharedSeconds - a.sharedSeconds || compareIds(a.playerIds, b.playerIds);
}

/**
 * Sums each unit's 5v5 clock seconds over the given games. Only the latest
 * snapshot of each team-game is read, and only team-games whose rows are all
 * `complete`: a partial or source-gap game is excluded and counted, never
 * read as zero (rule 13).
 */
export function aggregateObservedUnits(
  rows: readonly TeamUnitToiReaderRow[],
  unitType: FiveOnFiveUnitType
) {
  const latestSnapshot = new Map<string, string>();
  for (const row of rows) {
    const key = `${row.game_id}:${row.team_id}`;
    const latest = latestSnapshot.get(key);
    if (!latest || row.snapshot_date > latest) latestSnapshot.set(key, row.snapshot_date);
  }
  const current = rows.filter(
    (row) => latestSnapshot.get(`${row.game_id}:${row.team_id}`) === row.snapshot_date
  );
  const incompleteGames = new Set(
    current
      .filter((row) => row.coverage_status !== "complete")
      .map((row) => `${row.game_id}:${row.team_id}`)
  );

  const size = UNIT_SIZE[unitType];
  const byKey = new Map<string, ObservedUnit>();
  for (const row of current) {
    if (row.unit_type !== unitType) continue;
    if (incompleteGames.has(`${row.game_id}:${row.team_id}`)) continue;
    const playerIds = [...new Set(row.player_ids)].sort((a, b) => a - b);
    if (playerIds.length !== size || row.player_count !== size) continue;
    const key = playerIds.join(",");
    const unit = byKey.get(key) ?? { playerIds, sharedSeconds: 0 };
    // Pooled player-seconds to clock seconds (the migration's stated basis).
    unit.sharedSeconds += row.unit_toi_seconds / row.player_count;
    byKey.set(key, unit);
  }

  return {
    units: [...byKey.values()].sort(compareObservedUnits),
    excludedTeamGames: incompleteGames.size
  };
}

/**
 * Decision 137: walk the units from most to least shared 5v5 time and keep a
 * unit only if none of its players already holds a slot, until the slots are
 * filled. Observed units can share players (W2-6 §3); the board cannot.
 */
export function assignDisjointUnits(units: readonly ObservedUnit[], slots: number) {
  const used = new Set<number>();
  const chosen: ObservedUnit[] = [];
  for (const unit of [...units].sort(compareObservedUnits)) {
    if (chosen.length >= slots) break;
    if (unit.playerIds.some((playerId) => used.has(playerId))) continue;
    unit.playerIds.forEach((playerId) => used.add(playerId));
    chosen.push(unit);
  }
  return chosen;
}

/**
 * Forward lines and defense pairs for the Lines board from `team_unit_toi`
 * rows, or null when no complete 5v5 rows exist (the caller keeps the
 * labelled legacy grouping).
 */
export function buildFiveOnFiveLines(rows: readonly TeamUnitToiReaderRow[]) {
  const forwards = aggregateObservedUnits(rows, "forward_line");
  const defense = aggregateObservedUnits(rows, "defense_pair");
  if (forwards.units.length === 0 || defense.units.length === 0) return null;
  return {
    forwardLines: assignDisjointUnits(forwards.units, FIVE_ON_FIVE_SLOTS.forward_line),
    defensePairs: assignDisjointUnits(defense.units, FIVE_ON_FIVE_SLOTS.defense_pair),
    excludedTeamGames: Math.max(forwards.excludedTeamGames, defense.excludedTeamGames)
  };
}
