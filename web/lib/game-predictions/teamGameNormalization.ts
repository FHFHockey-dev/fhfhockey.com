import type { GameRow, NstTeamGamelogRow, TeamRow } from "./featureBuilder";

export type CanonicalTeamGameFact = NstTeamGamelogRow & {
  game_id: number;
  team_id: number;
  phase: number;
  strength: string;
  available_at: string;
  completed_at: string;
  gp: 1;
  derivation: "direct" | "cumulative_difference";
};
export type TeamGameExclusion = { rowIndex: number; reason: string };
export type TeamGameNormalizationResult = {
  facts: CanonicalTeamGameFact[];
  exclusions: TeamGameExclusion[];
  legacyTotals: { gp: number; gf: number; ga: number };
  correctedTotals: { gp: number; gf: number; ga: number };
};
const number = (value: unknown): number | null =>
  value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = (value: string | undefined | null): number =>
  value && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
const provedAvailability = (row: NstTeamGamelogRow) =>
  row.availability_basis === "original_source" || row.availability_basis === "retained_capture";
const observationValues = (row: NstTeamGamelogRow) => JSON.stringify(Object.fromEntries(
  Object.entries(row).filter(([key]) => key !== "available_at" && key !== "availability_basis")
    .sort(([a], [b]) => a.localeCompare(b)),
));

/**
 * Callers must supply proved source metadata or a retained contemporaneous capture receipt.
 * available_at is the actual source/receipt timestamp, never an assigned prediction cutoff.
 * Legacy dates, later reads, and fictional fixtures do not establish historical evidence.
 */
export function normalizeTeamGameFacts(args: {
  rows: NstTeamGamelogRow[];
  games: GameRow[];
  teams: TeamRow[];
  cutoffAt: string;
  phase: number | null;
  strength?: string;
}): TeamGameNormalizationResult {
  const cutoff = timestamp(args.cutoffAt);
  const result: TeamGameNormalizationResult = {
    facts: [], exclusions: [], legacyTotals: { gp: 0, gf: 0, ga: 0 }, correctedTotals: { gp: 0, gf: 0, ga: 0 },
  };
  const candidates = new Map<string, Array<{ fact: CanonicalTeamGameFact; rowIndex: number }>>();
  args.rows.forEach((original, rowIndex) => {
    let row = original;
    let derivation: CanonicalTeamGameFact["derivation"] = "direct";
    for (const field of ["gp", "gf", "ga"] as const) result.legacyTotals[field] += number(original[field]) ?? 0;
    const exclude = (reason: string) => result.exclusions.push({ rowIndex, reason });
    if (!Number.isFinite(cutoff)) return exclude("invalid_cutoff");
    if (number(row.gp) !== 1 || row.observation_kind === "cumulative") {
      const predecessors = args.rows.filter((candidate) => candidate !== original &&
        candidate.team_abbreviation === row.team_abbreviation && candidate.season_id === row.season_id &&
        candidate.phase === row.phase && candidate.strength === row.strength &&
        timestamp(candidate.available_at) < timestamp(row.available_at))
        .sort((a, b) => timestamp(b.available_at) - timestamp(a.available_at));
      const previous = predecessors[0];
      if (previous && predecessors.some((candidate) => timestamp(candidate.available_at) === timestamp(previous.available_at) &&
        observationValues(candidate) !== observationValues(previous)))
        return exclude("ambiguous_cumulative_predecessor");
      if (!previous || row.observation_kind !== "cumulative" || previous.observation_kind !== "cumulative" || !row.stat_definition || previous.stat_definition !== row.stat_definition ||
        !provedAvailability(row) || !provedAvailability(previous) ||
        row.correction_of_available_at != null || previous.correction_of_available_at != null ||
        number(row.gp) == null || number(previous.gp) == null || Number(row.gp) - Number(previous.gp) !== 1)
        return exclude("cumulative_or_invalid_gp");
      const teamIds = args.teams.filter((team) => team.abbreviation === row.team_abbreviation).map((team) => team.id);
      const intervalCandidates = args.games.filter((game) =>
        game.seasonId === row.season_id && game.type === row.phase &&
        (teamIds.includes(game.homeTeamId) || teamIds.includes(game.awayTeamId)) &&
        timestamp(game.startTime) > timestamp(previous.available_at) && timestamp(game.startTime) <= timestamp(row.available_at));
      if (intervalCandidates.some((game) => !Number.isFinite(timestamp(game.completed_at)) || timestamp(game.completed_at) > timestamp(row.available_at)))
        return exclude("unproved_cumulative_interval_completion");
      const intervalGames = [...new Map(args.games.filter((game) =>
        game.seasonId === row.season_id && game.type === row.phase &&
        (teamIds.includes(game.homeTeamId) || teamIds.includes(game.awayTeamId)) &&
        timestamp(game.completed_at) > timestamp(previous.available_at) &&
        timestamp(game.completed_at) <= timestamp(row.available_at) && timestamp(game.completed_at) < cutoff)
        .map((game) => [game.id, game])).values()];
      if (intervalGames.length !== 1) return exclude("cumulative_interval_not_one_completed_game");
      const counts = ["wins", "losses", "otl", "points", "gf", "ga", "xgf", "xga", "sf", "sa", "ff", "fa", "cf", "ca", "toi_seconds"] as const;
      const delta = { ...row };
      for (const field of counts) {
        const current = number(row[field]); const prior = number(previous[field]);
        if ((current == null) !== (prior == null) || (current != null && prior != null && (current < prior || prior < 0))) return exclude("cumulative_reset_or_invalid_counts");
        delta[field] = current != null && prior != null ? current - prior : null;
      }
      for (const field of ["point_pct", "gf_pct", "xgf_pct", "sf_pct", "ff_pct", "cf_pct", "xga_per_60"] as const) delta[field] = null;
      row = { ...delta, gp: 1, game_id: intervalGames[0]!.id, date: intervalGames[0]!.date };
      derivation = "cumulative_difference";
    }
    if (row.phase == null || row.phase !== args.phase) return exclude("unknown_or_mismatched_phase");
    if (row.strength !== (args.strength ?? "all")) return exclude("unknown_or_mismatched_strength");
    const teams = args.teams.filter((team) => team.abbreviation === row.team_abbreviation);
    const teamIds = [...new Set(teams.map((team) => team.id))];
    if (teamIds.length !== 1) return exclude("ambiguous_team");
    const teamId = teamIds[0]!;
    const matches = args.games.filter((game) =>
      game.seasonId === row.season_id && game.type === row.phase && game.date === row.date &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId) &&
      (row.game_id == null || row.game_id === game.id));
    const unique = [...new Map(matches.map((game) => [game.id, game])).values()];
    if (matches.some((game) => matches.some((other) => game.id === other.id &&
      (game.completed_at !== other.completed_at || game.startTime !== other.startTime || game.homeTeamId !== other.homeTeamId || game.awayTeamId !== other.awayTeamId))))
      return exclude("conflicting_game_records");
    if (unique.length !== 1) return exclude("ambiguous_or_missing_game");
    const game = unique[0]!;
    const completedAt = timestamp(game.completed_at);
    if (!Number.isFinite(completedAt) || completedAt >= cutoff || (!Number.isFinite(timestamp(game.startTime)) || completedAt <= timestamp(game.startTime))) return exclude("unproved_or_future_completion");
    const availableAt = timestamp(row.available_at);
    if (!provedAvailability(row) || !Number.isFinite(availableAt)) return exclude("unknown_original_availability");
    if (availableAt >= cutoff || availableAt < completedAt) return exclude("future_or_invalid_availability");
    if (row.correction_of_available_at != null &&
      (!Number.isFinite(timestamp(row.correction_of_available_at)) || timestamp(row.correction_of_available_at) >= availableAt)) return exclude("invalid_correction");
    if (row.correction_of_available_at != null) return exclude("unverified_correction_chain");
    if ([row.gf, row.ga, row.xgf, row.xga, row.sf, row.sa, row.ff, row.fa, row.cf, row.ca, row.toi_seconds]
      .some((value) => value != null && (number(value) == null || Number(value) < 0))) return exclude("invalid_counts");
    const fact: CanonicalTeamGameFact = { ...row, game_id: game.id, team_id: teamId, phase: row.phase!, strength: row.strength!, available_at: row.available_at!, completed_at: game.completed_at!, gp: 1, derivation };
    const key = `${game.id}:${teamId}:${row.season_id}:${row.phase}:${row.strength}`;
    candidates.set(key, [...(candidates.get(key) ?? []), { fact, rowIndex }]);
  });
  for (const rows of candidates.values()) {
    // Independent qualifying receipts may retain the same game facts repeatedly.
    // Availability metadata proves eligibility, but does not create another game.
    if (rows.some(({ fact }) => observationValues(fact) !== observationValues(rows[0]!.fact))) {
      rows.forEach(({ rowIndex }) => result.exclusions.push({ rowIndex, reason: "duplicate_or_conflicting_game" }));
      continue;
    }
    rows.sort((a, b) => timestamp(a.fact.available_at) - timestamp(b.fact.available_at) || a.rowIndex - b.rowIndex);
    rows.slice(1).forEach(({ rowIndex }) => result.exclusions.push({ rowIndex, reason: "duplicate_identical_game" }));
    const fact = rows[0]!.fact;
    result.facts.push(fact);
    for (const field of ["gp", "gf", "ga"] as const) result.correctedTotals[field] += number(fact[field]) ?? 0;
  }
  result.facts.sort((a, b) => timestamp(b.completed_at) - timestamp(a.completed_at) || b.game_id - a.game_id);
  return result;
}
