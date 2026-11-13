/** Pure historical arithmetic shared by goalie readers. No database, provider or forecast logic. */
export type OfficialStartAppearance = { goalieId: number; started: boolean | null };
export type HistoryAppearance = OfficialStartAppearance & { gameId: number; team: string; date: string; name: string | null };
export type CompletedTeamGame = { gameId: number; team: string; date: string };

/** A missing, duplicate or contradictory label is unresolved, never inferred from TOI or row order. */
export function resolveOfficialStarter(rows: readonly OfficialStartAppearance[]): number | null {
  const seen = new Set<number>();
  let starter: number | null = null;
  for (const row of rows) {
    if (!Number.isInteger(row.goalieId) || row.goalieId <= 0 || seen.has(row.goalieId)
      || typeof row.started !== "boolean") return null;
    seen.add(row.goalieId);
    if (row.started) {
      if (starter !== null) return null;
      starter = row.goalieId;
    }
  }
  return starter;
}

export type TeamStartShareGoalie = {
  goalieId: number; name: string | null; starts: number; reliefAppearances: number;
  /** Full share only with complete starter labels. Zero is reserved for a supported zero. */
  share: number | null;
  /** Known portion over all supplied team games. Never renormalize over resolved games. */
  knownShare: number | null;
};
export type TeamStartShare = {
  team: string; requested: number | null; teamGames: number; short: boolean; firstDate: string | null; lastDate: string | null;
  unresolvedGames: number[]; goalies: TeamStartShareGoalie[]; complete: boolean;
};

/**
 * Team crease split, not a player's tenure-adjusted workload and not a future probability.
 * Caller must supply independently reconciled completed team games for one season/game type.
 * `complete` describes starter labels in this input, not completeness of the upstream schedule.
 */
export function teamStartShare(team: string, games: readonly CompletedTeamGame[], appearances: readonly HistoryAppearance[], n: number | null, skip = 0): TeamStartShare {
  if (n !== null && (!Number.isInteger(n) || n <= 0) || !Number.isInteger(skip) || skip < 0) throw new Error("Invalid goalie history window.");
  const ordered = games.filter(g => g.team === team).sort((a, b) => a.date.localeCompare(b.date) || a.gameId - b.gameId);
  if (new Set(ordered.map(g => g.gameId)).size !== ordered.length) throw new Error("Duplicate team-game identity.");
  const pool = skip ? ordered.slice(0, Math.max(0, ordered.length - skip)) : ordered;
  const window = n === null ? pool : pool.slice(-n);
  const goalies = new Map<number, TeamStartShareGoalie>(), unresolvedGames: number[] = [];
  for (const game of window) {
    const rows = appearances.filter(r => r.team === team && r.gameId === game.gameId);
    const starter = resolveOfficialStarter(rows);
    if (starter === null) unresolvedGames.push(game.gameId);
    for (const row of rows) {
      const goalie = goalies.get(row.goalieId) ?? { goalieId: row.goalieId, name: row.name, starts: 0, reliefAppearances: 0, share: null, knownShare: null };
      goalie.name = row.name ?? goalie.name;
      // Do not credit either side of contradictory evidence. Appearances are not starts.
      if (starter !== null) {
        if (row.goalieId === starter) goalie.starts++;
      }
      if (row.started === false && rows.filter(r => r.goalieId === row.goalieId).length === 1) goalie.reliefAppearances++;
      goalies.set(row.goalieId, goalie);
    }
  }
  const complete = unresolvedGames.length === 0 && window.length > 0;
  return { team, requested: n, teamGames: window.length, short: n !== null && window.length < n,
    firstDate: window[0]?.date ?? null, lastDate: window.at(-1)?.date ?? null, unresolvedGames, complete,
    goalies: [...goalies.values()].map(goalie => ({ ...goalie,
      share: complete ? goalie.starts / window.length : null,
      knownShare: window.length ? goalie.starts / window.length : null
    })).sort((a, b) => b.starts - a.starts || a.goalieId - b.goalieId) };
}
