/** Event-level research contract. Legacy aggregate snapshots cannot satisfy it. */
/** v2: "past" means final only; started or postponed fixtures are pending (decision 21). */
export const DESCRIPTIVE_SOS_VERSION = "descriptive-sos-v2" as const;
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
  // Timestamps are parsed once; every comparison below uses these numbers.
  const fixtureTimes = new Map<string, { start: number; scheduleKnown: number }>();
  const seenResults = new Set<string>();
  fixtures.forEach((game) => {
    if (fixturesById.has(game.id) || game.teamA === game.teamB) {
      throw new Error("Duplicate or self SOS fixture");
    }
    fixturesById.set(game.id, game);
    fixtureTimes.set(game.id, {
      start: timestamp(game.startsAt),
      scheduleKnown: timestamp(game.scheduleKnownAt),
    });
  });
  type TimedResult = { game: SosResult; completed: number; known: number };
  const historical: TimedResult[] = [];
  results.forEach((game) => {
    if (seenResults.has(game.id) || game.teamA === game.teamB ||
        (game.winner !== game.teamA && game.winner !== game.teamB)) {
      throw new Error("Invalid or duplicate SOS result");
    }
    seenResults.add(game.id);
    const start = timestamp(game.startsAt);
    const fixture = fixturesById.get(game.id);
    if (fixture && (fixtureTimes.get(game.id)!.start !== start ||
        ![fixture.teamA, fixture.teamB].includes(game.teamA) ||
        ![fixture.teamA, fixture.teamB].includes(game.teamB))) {
      throw new Error("SOS result/fixture identity mismatch");
    }
    const completed = timestamp(game.completedAt);
    const known = timestamp(game.resultKnownAt);
    timestamp(game.scheduleKnownAt);
    if (completed < start || known < completed) throw new Error("Invalid SOS result chronology");
    if (start < cutoffMs && completed < cutoffMs && known < cutoffMs) {
      historical.push({ game, completed, known });
    }
  });
  // A record depends only on (team, availability time, excluded teams), so it
  // is computed once per key; repeated opponents reuse it.
  const records = new Map<string, { value: number | null; games: number }>();
  const record = (opponent: string, at: number, excluded: string[]) => {
    const key = `${opponent}\u0000${at}\u0000${excluded.join("\u0000")}`;
    const cached = records.get(key);
    if (cached) return cached;
    let wins = 0;
    let losses = 0;
    let otLosses = 0;
    historical.forEach(({ game, completed, known }) => {
      if (known >= at || completed >= at || excluded.includes(game.teamA) ||
          excluded.includes(game.teamB) || !opponentOf(game, opponent)) return;
      if (game.winner === opponent) wins += 1;
      else if (game.overtime) otLosses += 1;
      else losses += 1;
    });
    const computed = { value: recordPercentage(wins, losses, otLosses, metric), games: wins + losses + otLosses };
    records.set(key, computed);
    return computed;
  };
  // Decision 21: a past fixture counts only with its own final result known
  // before the cutoff. Started, unfinished or postponed fixtures are pending.
  const finalIds = new Set(historical.map(({ game }) => game.id));
  const inView = fixtures.filter((game) => {
    const { start, scheduleKnown } = fixtureTimes.get(game.id)!;
    const knowledgeCutoff = view === "past-as-known-then" ? Math.min(start, cutoffMs) : cutoffMs;
    return opponentOf(game, team) && scheduleKnown < knowledgeCutoff &&
      (view === "future" ? start >= cutoffMs : start < cutoffMs);
  });
  const selected = view === "future"
    ? inView
    : inView.filter((game) => finalIds.has(game.id));
  const pendingFixtureIds = view === "future"
    ? []
    : inView.filter((game) => !finalIds.has(game.id)).map((game) => game.id);
  const observations = selected.map((fixture) => {
    const opponent = opponentOf(fixture, team)!;
    const at = view === "past-as-known-then" ? fixtureTimes.get(fixture.id)!.start : cutoffMs;
    const direct = record(opponent, at, [team]);
    // Historical opposition quality, including for the future view. Never use
    // opponents' remaining schedules as opponents-of-opponents performance.
    const opponentHistory = historical.filter(({ game, completed, known }) =>
      known < at && completed < at &&
      !opponentOf(game, team) && opponentOf(game, opponent),
    );
    const indirectRecords = opponentHistory.map(({ game }) =>
      record(opponentOf(game, opponent)!, at, [team, opponent]),
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
    pendingFixtures: pendingFixtureIds.length,
    pendingFixtureIds,
    directSupportedFixtures: observations.filter((item) => item.direct !== null).length,
    indirectSupportedFixtures: observations.filter((item) => item.indirect !== null).length,
    direct: mean("direct"),
    indirect: mean("indirect"),
    observations,
  };
}
