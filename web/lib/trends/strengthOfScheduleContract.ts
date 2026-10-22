/** Event-level research contract. Legacy aggregate snapshots cannot satisfy it. */
export const DESCRIPTIVE_SOS_VERSION = "descriptive-sos-v1" as const;
export type SosMetric = "win-pct" | "points-pct";
export type SosView = "past-as-known-then" | "past-retrospective" | "future";

export type SosFixture = {
  id: string;
  teamA: string;
  teamB: string;
  startsAt: string;
  scheduleKnownAt: string;
};

export type SosResult = SosFixture & {
  winner: string;
  overtime: boolean;
  completedAt: string;
  resultKnownAt: string;
};

export function recordPercentage(
  wins: number | null,
  losses: number | null,
  otLosses: number | null,
  metric: SosMetric,
): number | null {
  const counts = [wins, losses, otLosses];
  if (counts.some((value) => value === null || !Number.isInteger(value) || value! < 0)) {
    return null;
  }
  const games = wins! + losses! + otLosses!;
  if (!games) return null;
  return metric === "win-pct" ? wins! / games : (2 * wins! + otLosses!) / (2 * games);
}

const opponentOf = (game: SosFixture, team: string): string | null =>
  game.teamA === team ? game.teamB : game.teamB === team ? game.teamA : null;

const timestamp = (value: string): number => {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts) throw new Error(`Invalid SOS timestamp: ${value}`);
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const parsed = Date.parse(value);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
      hour > 23 || minute > 59 || second > 59 || !Number.isFinite(parsed)) {
    throw new Error(`Invalid SOS timestamp: ${value}`);
  }
  return parsed;
};

/**
 * Requires complete, deduplicated regular-season results and the schedule being
 * described. Caller certifies stable source IDs and resolves schedule revisions.
 * Availability timestamps are source evidence, never inferred
 * from game date. Each scheduled meeting has equal weight, irrespective of the
 * opponent's history length. No priors or team-strength estimates are used.
 */
export function computeDescriptiveSos({
  team,
  fixtures,
  results,
  cutoff,
  view,
  metric,
}: {
  team: string;
  fixtures: SosFixture[];
  results: SosResult[];
  cutoff: string;
  view: SosView;
  metric: SosMetric;
}) {
  const cutoffMs = timestamp(cutoff);
  const fixturesById = new Map<string, SosFixture>();
  const seenResults = new Set<string>();
  fixtures.forEach((game) => {
    if (fixturesById.has(game.id) || game.teamA === game.teamB) {
      throw new Error("Duplicate or self SOS fixture");
    }
    fixturesById.set(game.id, game);
    timestamp(game.startsAt);
    timestamp(game.scheduleKnownAt);
  });
  const historical = results.filter((game) => {
    if (seenResults.has(game.id) || game.teamA === game.teamB ||
        (game.winner !== game.teamA && game.winner !== game.teamB)) {
      throw new Error("Invalid or duplicate SOS result");
    }
    seenResults.add(game.id);
    const start = timestamp(game.startsAt);
    const fixture = fixturesById.get(game.id);
    if (fixture && (timestamp(fixture.startsAt) !== start ||
        ![fixture.teamA, fixture.teamB].includes(game.teamA) ||
        ![fixture.teamA, fixture.teamB].includes(game.teamB))) {
      throw new Error("SOS result/fixture identity mismatch");
    }
    const completed = timestamp(game.completedAt);
    const known = timestamp(game.resultKnownAt);
    timestamp(game.scheduleKnownAt);
    if (completed < start || known < completed) throw new Error("Invalid SOS result chronology");
    return start < cutoffMs && completed < cutoffMs && known < cutoffMs;
  });
  const record = (opponent: string, at: number, excluded: Set<string>) => {
    let wins = 0;
    let losses = 0;
    let otLosses = 0;
    historical.forEach((game) => {
      if (timestamp(game.resultKnownAt) >= at || timestamp(game.completedAt) >= at ||
          excluded.has(game.teamA) || excluded.has(game.teamB) || !opponentOf(game, opponent)) return;
      if (game.winner === opponent) wins += 1;
      else if (game.overtime) otLosses += 1;
      else losses += 1;
    });
    return { value: recordPercentage(wins, losses, otLosses, metric), games: wins + losses + otLosses };
  };
  const selected = fixtures.filter((game) => {
    const start = timestamp(game.startsAt);
    const knowledgeCutoff = view === "past-as-known-then" ? Math.min(start, cutoffMs) : cutoffMs;
    return opponentOf(game, team) && timestamp(game.scheduleKnownAt) < knowledgeCutoff &&
      (view === "future" ? start >= cutoffMs : start < cutoffMs);
  });
  const observations = selected.map((fixture) => {
    const opponent = opponentOf(fixture, team)!;
    const at = view === "past-as-known-then" ? timestamp(fixture.startsAt) : cutoffMs;
    const direct = record(opponent, at, new Set([team]));
    // Historical opposition quality, including for the future view. Never use
    // opponents' remaining schedules as opponents-of-opponents performance.
    const opponentHistory = historical.filter((game) =>
      timestamp(game.resultKnownAt) < at && timestamp(game.completedAt) < at &&
      !opponentOf(game, team) && opponentOf(game, opponent),
    );
    const indirectRecords = opponentHistory.map((game) =>
      record(opponentOf(game, opponent)!, at, new Set([team, opponent])),
    );
    const indirect = indirectRecords.length && indirectRecords.every((item) => item.value !== null)
      ? indirectRecords.reduce((sum, item) => sum + item.value!, 0) / indirectRecords.length
      : null;
    return { fixtureId: fixture.id, opponent, recordCutoff: new Date(at).toISOString(),
      opponentRecordGames: direct.games, direct: direct.value, indirect };
  });
  const mean = (key: "direct" | "indirect") =>
    observations.length && observations.every((item) => item[key] !== null)
      ? observations.reduce((sum, item) => sum + item[key]!, 0) / observations.length
      : null;
  return {
    version: DESCRIPTIVE_SOS_VERSION,
    kind: "descriptive-schedule" as const,
    team, cutoff, view, metric,
    fixtures: observations.length,
    directSupportedFixtures: observations.filter((item) => item.direct !== null).length,
    indirectSupportedFixtures: observations.filter((item) => item.indirect !== null).length,
    direct: mean("direct"),
    indirect: mean("indirect"),
    observations,
  };
}
