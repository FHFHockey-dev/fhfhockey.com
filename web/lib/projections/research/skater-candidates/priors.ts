import { nonNegative, shrinkRate, type Position, type Strength, type CountExposure } from "./accounting";

export type PriorMetric = "shotsPer60" | "goalsPerShot" | "assistsPerOnIceGoal" | "pointsPerOnIceGoal" | "goalsPer60" | "assistsPer60";
export type HistoricalCounts = {
  playerId: number; gameId: number; season: string; position: Position; strength: Strength;
  playedAt: string; availableAt: string;
  toiSeconds: number | null; shots: number | null; goals: number | null;
  assists: number | null; onIceGoals: number | null;
};
export type PriorScope = { season: string; before: string; position: Position; strength: Strength; metric: PriorMetric };

/** Returns paired raw counts only. Per-game averages cannot stand in for exposures. */
function pair(row: HistoricalCounts, metric: PriorMetric): CountExposure | null {
  const onIceShare = metric === "assistsPerOnIceGoal" || metric === "pointsPerOnIceGoal";
  const events = metric === "pointsPerOnIceGoal" ? row.goals === null || row.assists === null ? null : row.goals + row.assists
    : metric === "shotsPer60" ? row.shots : metric.startsWith("goals") ? row.goals : row.assists;
  const exposure = metric === "goalsPerShot" ? row.shots : onIceShare ? row.onIceGoals
    : row.toiSeconds === null ? null : row.toiSeconds / 3600;
  if (events === null || exposure === null) return null;
  nonNegative(events, "historical events"); nonNegative(exposure, "historical exposure");
  if (events > 0 && exposure === 0) throw new Error("Historical events without exposure");
  if ((metric === "goalsPerShot" || onIceShare) && events > exposure) throw new Error("Historical share exceeds one");
  return exposure > 0 ? { events, exposure } : null;
}

function select(rows: HistoricalCounts[], scope: PriorScope) {
  const cutoff = Date.parse(scope.before);
  if (!Number.isFinite(cutoff)) throw new Error("Invalid prior cutoff");
  const ids = new Set<string>();
  const selected: { row: HistoricalCounts; pair: CountExposure }[] = [];
  const excluded = { outsideScope: 0, notAvailableBeforeCutoff: 0, missingExposure: 0 };
  for (const row of rows) {
    if (row.season !== scope.season || row.position !== scope.position || row.strength !== scope.strength) { excluded.outsideScope++; continue; }
    const played = Date.parse(row.playedAt), available = Date.parse(row.availableAt);
    if (!Number.isFinite(played) || !Number.isFinite(available) || available < played) throw new Error("Invalid historical vintage");
    if (played >= cutoff || available >= cutoff) { excluded.notAvailableBeforeCutoff++; continue; }
    if (!Number.isSafeInteger(row.playerId) || !Number.isSafeInteger(row.gameId)) throw new Error("Invalid historical identity");
    const key = `${row.playerId}:${row.gameId}`;
    if (ids.has(key)) throw new Error("Duplicate historical player-game-strength");
    ids.add(key);
    const counts = pair(row, scope.metric);
    if (!counts) { excluded.missingExposure++; continue; }
    selected.push({ row, pair: counts });
  }
  selected.sort((a, b) => a.row.playerId - b.row.playerId || Date.parse(a.row.playedAt) - Date.parse(b.row.playedAt) || a.row.gameId - b.row.gameId);
  return { selected, excluded };
}

const total = (pairs: CountExposure[]): CountExposure => pairs.reduce((a, b) => ({ events: a.events + b.events, exposure: a.exposure + b.exposure }), { events: 0, exposure: 0 });
export const priorExposureUnit = (metric: PriorMetric) => metric === "goalsPerShot" ? "shots"
  : metric === "assistsPerOnIceGoal" || metric === "pointsPerOnIceGoal" ? "onIceGoals" : "hours";

/** Season-current, strength- and position-specific empirical mean. No fallback constants. */
export function estimatePositionPrior(rows: HistoricalCounts[], scope: PriorScope) {
  const { selected, excluded } = select(rows, scope);
  const counts = total(selected.map((entry) => entry.pair));
  return { scope, unit: priorExposureUnit(scope.metric), ...counts, mean: counts.exposure > 0 ? counts.events / counts.exposure : null,
    players: new Set(selected.map((entry) => entry.row.playerId)).size, rows: selected.length, excluded };
}

/**
 * Deterministic alternating-game halves within the requested historical scope.
 * Each direction's prior uses only OTHER players' training halves. The peer's
 * held-out counts never enter the prior. k candidates are supplied, in named
 * exposure units. This is tuning evidence, not independent predictive evidence.
 */
export function fitSplitHalfK(rows: HistoricalCounts[], scope: PriorScope, candidates: number[]) {
  if (candidates.length < 2 || new Set(candidates).size !== candidates.length) throw new Error("Supply distinct k candidates");
  candidates.forEach((k) => nonNegative(k, "k"));
  const { selected, excluded } = select(rows, scope);
  const players = new Map<number, CountExposure[]>();
  for (const entry of selected) players.set(entry.row.playerId, [...(players.get(entry.row.playerId) ?? []), entry.pair]);
  const halves = [...players.entries()].filter(([, entries]) => entries.length >= 2).map(([playerId, entries]) => ({
    playerId, parts: [total(entries.filter((_, i) => i % 2 === 0)), total(entries.filter((_, i) => i % 2 === 1))],
  }));
  if (halves.length < 2) return { status: "blocked" as const, reason: "need_two_players_with_two_supported_games", excluded, unit: priorExposureUnit(scope.metric) };
  const totals = [0, 1].map((i) => total(halves.map((player) => player.parts[i])));
  const trials = candidates.map((k) => {
    let squaredError = 0, error = 0, n = 0;
    for (const player of halves) for (const direction of [0, 1]) {
      const train = player.parts[direction], test = player.parts[1 - direction];
      const peerExposure = totals[direction].exposure - train.exposure;
      if (peerExposure <= 0) throw new Error("Missing peer training exposure");
      const mean = (totals[direction].events - train.events) / peerExposure;
      const predicted = shrinkRate(train, { mean, exposure: k })! * test.exposure;
      const residual = predicted - test.events;
      squaredError += residual ** 2; error += residual; n++;
    }
    return { k, n, bias: error / n, rmse: Math.sqrt(squaredError / n) };
  }).sort((a, b) => a.rmse - b.rmse || a.k - b.k);
  const k = trials[0].k;
  return { status: "candidate" as const, scope, unit: priorExposureUnit(scope.metric), k, trials,
    boundary: k === Math.min(...candidates) || k === Math.max(...candidates), players: halves.length, excluded,
    evidence: "historical_split_half_tuning_only" as const };
}
