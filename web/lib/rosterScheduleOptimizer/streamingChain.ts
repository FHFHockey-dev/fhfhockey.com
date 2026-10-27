import { localDate, zonedMidnight } from "./planningDates";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import { acquisitionEffectiveAt } from "./planningTimeline";
import { dropEligible, providerListsOut, reservedPlayerIds } from "./retention";
import { recentPointsPerGame } from "./recentForm";
import type { PlanEvaluation, PlanIntent, PlanStep, PlanningGame, PlanningPlayer, PlanningSnapshot, StreamingChain, StreamingLeg, StreamingOption, StreamingPlan } from "./planningTypes";

/** Streaming chains (TJ, 2026-10-27): turn the period's remaining adds into the most added active games, then projected
 * fantasy points. A stream spot is a sequence of contiguous day windows; each window's streamer is dropped by the next
 * add. Windows come from team schedules and open lineup slots (small per-day matchings); players are ranked within a
 * window by a per-game blend over the games they would start: the average of projected FPts and last-10 FPts/G when both are
 * known (TJ, 10-27: past + future), else the projection. Under "Best projected points" chains are FPts-first: the week's
 * blended total beats added games, so a one-game star wins only when he adds more for the matchup. Proposals are heuristic; every returned chain is
 * certified by the plan evaluator, which alone supplies its legality and net totals.
 * Goalie minimum (TJ, 2026-10-27): with goalie coverage set to cover, when the no-move plan falls short of the minimum, a second search
 * puts expected goalie starts (up to the shortfall) ahead of games, and certified chains that meet the minimum rank first. */
export type StreamingInputs = {
  snapshot: PlanningSnapshot; intent: PlanIntent;
  /** The no-move plan for the same objective the chains are evaluated with. */
  baseline: PlanEvaluation;
  dropOrder: ReadonlyMap<string, number>;
  /** `latestEquivalentActionAt` for this read: when a move due now is timed. */
  dueNow: string | null;
  evaluate: (steps: PlanStep[]) => PlanEvaluation;
  /** Admitted expected fantasy points for one player-game; null when unknown. */
  points: (playerId: string, gameId: string) => number | null;
};
type Elig = ReturnType<typeof normalizeEligibility> & { key: string };
/** `points`: blended FPts (see above); `starts`: expected goalie starts the streamers add, net of the drop's. */
type Value = { games: number; points: number; known: boolean; adds: number; starts: number };
/** `points` stays the projection (shown); `score` is the blended total that ranks. */
type Candidate = StreamingOption & { player: PlanningPlayer; playDays: number[]; score: number | null; starts: number };
type Window = { start: number; end: number; ranked: Candidate[] };
type SpotPlan = { start: number; drop: PlanningPlayer; windows: Window[]; chosen: Candidate[]; value: Value };
type Context = { removedFrom: Map<string, number>; extras: Elig[][] };

const time = (value: string) => Date.parse(value);
const STREAMABLE = new Set(["free_agent", "manager_available"]);
const RESERVES = new Set(["IR", "IR+", "NA"]);
/** Blended points this close are a near tie: last-10 FPts/G orders them. */
const NEAR_TIE = 0.1;
const OPTION_COUNT = 5, RANKED_COUNT = 12, DROP_CANDIDATES = 3;
const ZERO: Value = { games: 0, points: 0, known: true, adds: 0, starts: 0 };
/** More games, then points (points first when `pointsFirst`), then fewer adds; with a goalie-start `need`, expected starts
 * up to it come first. */
const better = (a: Value, b: Value, need: number, pointsFirst: boolean) => {
  const starts = Math.min(need, a.starts) - Math.min(need, b.starts);
  if (Math.abs(starts) > 1e-9) return starts > 0;
  const points = Math.abs(a.points - b.points) > 1e-9 ? a.points > b.points : null;
  if (pointsFirst && points !== null) return points;
  return a.games !== b.games ? a.games > b.games : points ?? a.adds < b.adds;
};
const plus = (a: Value, b: Value): Value => ({ games: a.games + b.games, points: a.points + b.points, known: a.known && b.known, adds: a.adds + b.adds, starts: a.starts + b.starts });
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

const rankOptions = (pointsFirst: boolean) => (a: Candidate, b: Candidate) => {
  if (!pointsFirst && a.games !== b.games) return b.games - a.games;
  if (a.score !== null && b.score !== null && Math.abs(a.score - b.score) > NEAR_TIE) return b.score - a.score;
  if (a.score === null !== (b.score === null)) return a.score === null ? 1 : -1;
  if (a.games !== b.games) return b.games - a.games;
  const recent = (b.recentPointsPerGame ?? -Infinity) - (a.recentPointsPerGame ?? -Infinity);
  if (recent && Number.isFinite(recent)) return recent;
  return (b.score ?? 0) - (a.score ?? 0) || a.player.id.localeCompare(b.player.id);
};
function maxMatch(slots: string[], players: Elig[]) {
  const owner = new Array<number>(slots.length).fill(-1);
  const fits = players.map(player => slots.map(slot => canEligibilityOccupySlot(player, slot as never)));
  const augment = (index: number, seen: boolean[]): boolean => {
    for (let slot = 0; slot < slots.length; slot++) if (fits[index][slot] && !seen[slot]) {
      seen[slot] = true;
      if (owner[slot] < 0 || augment(owner[slot], seen)) { owner[slot] = index; return true; }
    }
    return false;
  };
  return players.reduce((count, _, index) => count + (augment(index, new Array(slots.length).fill(false)) ? 1 : 0), 0);
}

export function buildStreamingChains(inputs: StreamingInputs): StreamingPlan {
  const { snapshot, intent, baseline, dropOrder } = inputs;
  const plan: StreamingPlan = { policyVersion: "rso-stream-v1", recommended: null, chains: [], limitations: [] };
  const zone = snapshot.context.timeZone, asOf = snapshot.context.asOf, rules = snapshot.rules;
  // The minimum is reported when missing it costs something, and targeted only when the manager chose to cover it
  // (TJ, 10-27: "accept risk" never pushes goalies up). The evaluator alone says whether it is met.
  const required = rules.goalieMinimum.required ?? 0;
  const cover = intent.goalieCoverage === "cover";
  const targeted = required > 0 && rules.goalieMinimum.penalty !== "none" && cover;
  if (required > 0 && rules.goalieMinimum.penalty !== "none") plan.goalieMinimum = { required, baseline: baseline.goalie.projected, met: !baseline.goalie.risk, cover };
  const need = targeted && rules.goalieMinimum.counts === "starts" && baseline.goalie.risk && baseline.goalie.projected !== null
    ? required - baseline.goalie.projected : 0;
  if (rules.lineupMode !== "daily") { plan.limitations.push("Streaming chains need a daily lineup league."); return plan; }
  if (rules.acquisitionTiming === "unknown" || rules.acquisitionCost === null || rules.acquisitionCost <= 0) {
    plan.limitations.push("Streaming chains need acquisition timing and cost. Review League rules and scoring."); return plan;
  }
  const today = localDate(asOf, zone);
  const dates: string[] = [];
  for (let date = snapshot.context.startDate > today ? snapshot.context.startDate : today; date <= snapshot.context.endDate; date = addDays(date, 1)) dates.push(date);
  const n = dates.length;
  // When a leg effective on dates[i] is claimed: the search's add timing. A move due now is timed by `dueNow`, and must
  // still fall on its action date (same-day) or before the day it takes effect (next-day).
  const nextDay = rules.acquisitionTiming === "next_day";
  const timing = dates.map(date => {
    let at = zonedMidnight(nextDay ? addDays(date, -1) : date, zone);
    if (time(at) < time(asOf)) at = inputs.dueNow ?? asOf;
    const claimedOn = localDate(at, zone);
    if (nextDay ? claimedOn >= date : claimedOn !== date) return null;
    const effectiveAt = acquisitionEffectiveAt(snapshot, { availability: "free_agent" } as PlanningPlayer, at);
    return effectiveAt ? { at, effectiveAt, actionDate: claimedOn } : null;
  });
  const first = timing.find(Boolean);
  const period = first ? rules.periods.find(item => time(item.start) <= time(first.at) && time(first.at) < time(item.end)) : undefined;
  if (!first || !period) { plan.limitations.push("No remaining day in this range can take a streaming add."); return plan; }
  if (period.remaining === null || period.source === "unknown") { plan.limitations.push("Streaming chains need the period's remaining adds."); return plan; }
  // One acquisition period per chain; a later period's allowance is not spent here.
  let periodEnds = false;
  timing.forEach((item, index) => {
    if (item && !(time(period.start) <= time(item.at) && time(item.at) < time(period.end))) { timing[index] = null; periodEnds = true; }
  });
  if (periodEnds) plan.limitations.push("Streaming chains stop at the end of the current acquisition period.");
  const budget = Math.floor(period.remaining / rules.acquisitionCost);
  if (budget < 1) { plan.limitations.push("No adds remain this period; hold the roster."); return plan; }

  const claimable = (game: PlanningGame, effectiveAt: string) => game.startsAt ? time(effectiveAt) <= time(game.startsAt) : time(effectiveAt) < time(zonedMidnight(game.date, zone));
  const open = (game: PlanningGame) => game.status === "scheduled" && (game.startsAt ? time(game.startsAt) >= time(asOf) : game.date > today);
  const gameOn = new Map<string, PlanningGame>();
  for (const game of snapshot.games) if (open(game)) gameOn.set(`${game.teamAbbreviation}:${game.date}`, game);
  const elig = (player: PlanningPlayer): Elig => { const value = normalizeEligibility(player.eligiblePositions); return { ...value, key: value.positions.join(",") }; };
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  // Per day: slots held by locked or started rows, and the roster players who compete for the rest.
  const activeSlots = expandActiveSlots(rules.rosterSlots).activeSlots;
  const days = dates.map(date => {
    const locks = snapshot.lockedAssignments.filter(lock => lock.date === date);
    const fixed = baseline.assignments.filter(row => row.date === date && row.locked);
    const taken = new Set([...fixed.map(row => row.slotId), ...locks.flatMap(lock => lock.slotId ? [lock.slotId] : [])]);
    const held = new Set([...fixed.map(row => row.playerId), ...locks.map(lock => lock.playerId)]);
    const flexible = snapshot.roster.flatMap(entry => {
      const player = players.get(entry.playerId);
      return player && !RESERVES.has(entry.position) && !held.has(player.id) && !providerListsOut(player)
        && gameOn.has(`${player.teamAbbreviation}:${date}`) ? [player] : [];
    });
    return { fixed: taken.size, slots: activeSlots.filter(slot => !taken.has(slot.id)).map(slot => slot.type as string), flexible };
  });
  const memo = new Map<string, number>();
  const capacity = (day: number, context: Context, extra?: Elig) => {
    const removed = [...context.removedFrom].filter(([, from]) => from <= day).map(([id]) => id).sort();
    const extras = [...context.extras[day], ...(extra ? [extra] : [])];
    const key = `${day}|${removed.join(",")}|${extras.map(item => item.key).sort().join(";")}`;
    if (!memo.has(key)) memo.set(key, days[day].fixed + maxMatch(days[day].slots,
      [...days[day].flexible.filter(player => !removed.includes(player.id)).map(elig), ...extras]));
    return memo.get(key)!;
  };
  const pool = snapshot.players.filter(player => !owned.has(player.id) && STREAMABLE.has(player.availability)
    && !intent.excludedPlayerIds.includes(player.id) && !!player.teamAbbreviation && elig(player).valid
    && elig(player).playerClass === player.playerClass && dates.some(date => gameOn.has(`${player.teamAbbreviation}:${date}`)));
  if (!pool.length) { plan.limitations.push("No available player has a remaining game to stream."); return plan; }
  const reserved = reservedPlayerIds(snapshot.roster);
  const drops = snapshot.roster.flatMap(entry => players.get(entry.playerId) ?? [])
    .filter(player => dropOrder.has(player.id) && dropEligible(player, intent, reserved))
    .sort((a, b) => dropOrder.get(a.id)! - dropOrder.get(b.id)!).slice(0, DROP_CANDIDATES);
  if (!drops.length) { plan.limitations.push("No droppable roster player has a known contribution; streaming chains need a drop candidate."); return plan; }
  const forms = new Map<string, number | null>();
  const recent = (player: PlanningPlayer) => {
    if (!forms.has(player.id)) forms.set(player.id, recentPointsPerGame(player, rules.scoring));
    return forms.get(player.id)!;
  };
  /** Ranking value of one player-game: the average of projected FPts and last-10 FPts/G, or the projection alone. */
  const blended = (player: PlanningPlayer, gameId: string) => {
    const projected = inputs.points(player.id, gameId), form = recent(player);
    return projected === null ? null : form === null ? projected : (projected + form) / 2;
  };
  const pointsFirst = baseline.objective === "outcome";
  const rank = rankOptions(pointsFirst);
  if (targeted && baseline.goalie.risk && !need) plan.limitations.push("Goalie start progress is unknown, so streaming chains can't target the goalie minimum.");
  const forecasts = new Map(snapshot.forecasts.filter(row => !row.expiresAt || time(row.expiresAt) > time(asOf)).map(row => [`${row.playerId}:${row.gameId}`, row]));
  /** Expected start for a goalie's game (proposals only; the evaluator certifies). */
  const startChance = (player: PlanningPlayer, gameId: string) => {
    if (player.playerClass !== "goalie") return 0;
    const forecast = forecasts.get(`${player.id}:${gameId}`);
    return forecast?.confirmedStart ? 1 : forecast?.startProbability ?? 0;
  };

  /** Best chain for one spot that starts by dropping `drop`, on top of `context` (another spot's streamers). With a goalie
   * `goal`, each window also offers its best goalie by expected starts, and starts up to `goal` outrank games. */
  const runSpot = (context: Context, drop: PlanningPlayer, adds: number, used: ReadonlySet<string>, goal = 0): SpotPlan | null => {
    const without: Context = { removedFrom: new Map([...context.removedFrom, [drop.id, 0]]), extras: context.extras };
    const gain = new Map<string, number[]>();
    const gainFor = (value: Elig) => {
      if (!gain.has(value.key)) gain.set(value.key, dates.map((_, day) => capacity(day, without, value) - capacity(day, without)));
      return gain.get(value.key)!;
    };
    const lossGames = dates.map((_, day) => capacity(day, context) - capacity(day, without));
    const lossRows = dates.map((date, day) => lossGames[day] > 0 ? baseline.assignments.find(item => item.playerId === drop.id && item.date === date) : undefined);
    const lossPoints = lossRows.map(row => row ? blended(drop, row.gameId) : 0);
    const lossStarts = lossRows.map(row => row ? startChance(drop, row.gameId) : 0);
    // Per player: games he would start on each day, their projected points and the first-day claim for each window start.
    const rows = pool.filter(player => !used.has(player.id)).map(player => {
      const gains = gainFor(elig(player));
      const games = dates.map(date => gameOn.get(`${player.teamAbbreviation}:${date}`));
      const starts = games.map((game, day) => !!game && gains[day] > 0);
      const points = games.map((game, day) => starts[day] ? inputs.points(player.id, game!.id) : 0);
      const scores = games.map((game, day) => starts[day] ? blended(player, game!.id) : 0);
      const chances = games.map((game, day) => starts[day] ? startChance(player, game!.id) : 0);
      const firstDay = timing.map((item, day) => !!item && starts[day] && claimable(games[day]!, item.effectiveAt));
      return { player, games, starts, points, scores, chances, firstDay, form: recent(player) };
    });
    const windows: Window[][] = dates.map(() => []), goalieWindows: Window[][] = dates.map(() => []);
    for (let start = 0; start < n; start++) if (timing[start]) for (let end = start + 1; end <= n; end++) {
      const ranked: Candidate[] = [];
      for (const row of rows) {
        const playDays = [...(row.firstDay[start] ? [start] : [])];
        for (let day = start + 1; day < end; day++) if (row.starts[day]) playDays.push(day);
        if (!playDays.length) continue;
        const sum = (values: Array<number | null>) => values.every(value => value !== null && Number.isFinite(value))
          ? values.reduce<number>((total, value) => total + value!, 0) : null;
        ranked.push({ player: row.player, playerId: row.player.id, games: playDays.length, gameDates: playDays.map(day => dates[day]), playDays,
          points: sum(playDays.map(day => row.points[day])), score: sum(playDays.map(day => row.scores[day])),
          starts: playDays.reduce((sum, day) => sum + row.chances[day], 0),
          recentPointsPerGame: row.form, recentGames: row.form === null ? null : row.player.recentTotals?.games ?? null });
      }
      ranked.sort(rank);
      windows[start][end] = { start, end, ranked: ranked.slice(0, RANKED_COUNT) };
      if (goal > 0) goalieWindows[start][end] = { start, end, ranked: ranked.filter(option => option.starts > 0)
        .sort((a, b) => Math.min(goal, b.starts) - Math.min(goal, a.starts) || rank(a, b)).slice(0, RANKED_COUNT) };
    }
    // Tables a leg can come from: the games ranking and, with a goalie goal, the expected-starts ranking.
    const tables = goal > 0 ? [windows, goalieWindows] : [windows];
    const legValue = (window: Window | undefined): Value | null => {
      const best = window?.ranked[0];
      return best ? { games: best.games, points: best.score ?? 0, known: best.score !== null, adds: 1, starts: best.starts } : null;
    };
    // best[start][used]: the most from a leg effective on dates[start] onward, `used` adds already spent.
    const best: Array<Array<{ value: Value; end: number; table: number } | null>> = Array.from({ length: n + 1 }, () => new Array(adds).fill(null));
    for (let start = n - 1; start >= 0; start--) if (timing[start]) for (let spent = 0; spent < adds; spent++) {
      for (let end = start + 1; end <= n; end++) for (const [table, windowsFor] of tables.entries()) {
        const leg = legValue(windowsFor[start][end]);
        // The last streamer is held to the end; any other is dropped by the next leg, effective the day his window ends.
        const rest = end === n ? ZERO : spent + 1 < adds && timing[end] ? best[end][spent + 1]?.value ?? null : null;
        if (!leg || !rest) continue;
        const total = plus(leg, rest);
        if (!best[start][spent] || better(total, best[start][spent]!.value, goal, pointsFirst)) best[start][spent] = { value: total, end, table };
      }
    }
    let chosen: { start: number; value: Value } | null = null;
    for (let start = 0; start < n; start++) {
      const entry = best[start][0];
      if (!entry) continue;
      const lost = lossGames.slice(start).reduce((sum, value) => sum + value, 0);
      const lostPoints = lossPoints.slice(start);
      const value: Value = { games: entry.value.games - lost, adds: entry.value.adds, known: entry.value.known && lostPoints.every(item => item !== null),
        points: entry.value.points - lostPoints.reduce<number>((sum, item) => sum + (item ?? 0), 0),
        starts: entry.value.starts - lossStarts.slice(start).reduce((sum, item) => sum + item, 0) };
      if (!chosen || better(value, chosen.value, goal, pointsFirst)) chosen = { start, value };
    }
    if (!chosen || chosen.value.games <= 0 && !(goal > 0 && chosen.value.starts > 1e-9) && !(pointsFirst && chosen.value.known && chosen.value.points > 1e-9)) return null;
    const legs: Window[] = [], kinds: number[] = [];
    for (let start = chosen.start, spent = 0; start < n; spent++) {
      const entry = best[start][spent]!;
      legs.push(tables[entry.table][start][entry.end]);
      kinds.push(entry.table);
      start = entry.end;
    }
    const taken = new Set<string>();
    const picks = legs.map(window => {
      const pick = window.ranked.find(option => !taken.has(option.playerId)) ?? null;
      if (pick) taken.add(pick.playerId);
      return pick;
    });
    if (picks.some(pick => !pick)) return null;
    // Claim each streamer for his first game, not earlier: the player he replaces stays on the roster until then.
    for (const [index, pick] of (picks as Candidate[]).entries()) {
      const first = Math.min(...pick.playDays), window = legs[index];
      if (first <= window.start || !timing[first] || !tables[kinds[index]][first][window.end]) continue;
      legs[index] = tables[kinds[index]][first][window.end];
      if (index) legs[index - 1] = tables[kinds[index - 1]][legs[index - 1].start][first];
    }
    return { start: legs[0].start, drop, windows: legs, chosen: picks as Candidate[], value: chosen.value };
  };
  const contextWith = (base: Context, spot: SpotPlan): Context => ({
    removedFrom: new Map([...base.removedFrom, [spot.drop.id, spot.start]]),
    extras: base.extras.map((items, day) => {
      const index = spot.windows.findIndex(window => window.start <= day && day < window.end);
      return index >= 0 && spot.chosen[index].playDays.includes(day) ? [...items, elig(spot.chosen[index].player)] : items;
    }),
  });
  const empty: Context = { removedFrom: new Map(), extras: dates.map(() => []) };

  const toLegs = (spots: SpotPlan[]): StreamingLeg[] => spots.flatMap((spot, index) => spot.windows.map((window, leg) => {
    const pick = spot.chosen[leg], item = timing[window.start]!;
    const prior = leg ? spot.chosen[leg - 1].playerId : spot.drop.id;
    const step: PlanStep = { id: `stream:${index}:${leg}:${pick.playerId}`, type: "add", playerId: pick.playerId, dropPlayerId: prior,
      at: item.at, effectiveAt: acquisitionEffectiveAt(snapshot, pick.player, item.at)!,
      conditional: time(item.at) > time(asOf), dependsOn: leg ? [`stream:${index}:${leg - 1}:${spot.chosen[leg - 1].playerId}`] : [] };
    const others = spots.flatMap(other => other === spot ? spot.chosen.filter((_, position) => position !== leg) : other.chosen).map(option => option.playerId);
    const options = window.ranked.filter(option => !others.includes(option.playerId)).slice(0, OPTION_COUNT)
      .map(({ playerId, games, gameDates, points, recentPointsPerGame, recentGames }) => ({ playerId, games, gameDates, points, recentPointsPerGame, recentGames }));
    return { spot: index, step, actionDate: item.actionDate, startDate: dates[window.start], endDate: dates[window.end - 1],
      playerId: pick.playerId, dropPlayerId: prior, games: pick.games, gameDates: pick.gameDates, points: pick.points, options };
  }));
  const openGames = new Set([...gameOn.values()].map(game => game.id));
  /** Blended FPts over a lineup's remaining assignments; null when any is unknown. */
  const scoreOf = (evaluation: PlanEvaluation) => {
    let total = 0;
    for (const row of evaluation.assignments) if (openGames.has(row.gameId) && row.date >= dates[0]) {
      const player = players.get(row.playerId), value = player ? blended(player, row.gameId) : null;
      if (value === null) return null;
      total += value;
    }
    return total;
  };
  const baselineScore = scoreOf(baseline);
  const certify = (spots: SpotPlan[]): StreamingChain | null => {
    const legs = toLegs(spots), steps = legs.map(leg => leg.step);
    const evaluation = inputs.evaluate(steps);
    if (!evaluation.legal || !evaluation.budgetVerified) {
      plan.limitations.push(`A proposed ${spots.length === 1 ? "one" : "two"}-spot chain failed rule checks: ${evaluation.limitations[0] ?? "unknown reason"}`);
      return null;
    }
    // Leg games and points come from the certified lineup, not the proposal.
    for (const leg of legs) {
      const rows = evaluation.assignments.filter(row => row.playerId === leg.playerId && row.date >= leg.startDate && row.date <= leg.endDate);
      const values = rows.map(row => inputs.points(leg.playerId, row.gameId));
      Object.assign(leg, { games: rows.length, gameDates: rows.map(row => row.date).sort(),
        points: values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + value!, 0) : null });
      const own = leg.options.find(option => option.playerId === leg.playerId);
      if (own) Object.assign(own, { games: leg.games, gameDates: leg.gameDates, points: leg.points });
    }
    const netPoints = evaluation.comparisonEligible && baseline.comparisonEligible && evaluation.projectedValue !== null && baseline.projectedValue !== null
      ? evaluation.projectedValue - baseline.projectedValue : null;
    const score = scoreOf(evaluation);
    return { spots: spots.length as 1 | 2, legs, steps, evaluation, netGames: evaluation.activeGames - baseline.activeGames, netPoints,
      netScore: score !== null && baselineScore !== null ? score - baselineScore : null, addsUsed: steps.length, addsAvailable: budget };
  };
  /** Blended net when known, else the evaluator's projected net. */
  const pointsOf = (chain: StreamingChain) => chain.netScore ?? chain.netPoints;
  // "Most starts": games, then points. "Best projected points": the week's points, then games.
  const objectiveBetter = (a: StreamingChain, b: StreamingChain) => {
    const left = pointsOf(a), right = pointsOf(b);
    const points = left !== null && right !== null && Math.abs(left - right) > 1e-9 ? left > right : null;
    if (pointsFirst && points !== null) return points;
    return a.netGames !== b.netGames ? a.netGames > b.netGames : points ?? a.addsUsed < b.addsUsed;
  };
  const meets = (chain: StreamingChain) => !chain.evaluation.goalie.risk;
  // A chain that keeps (or reaches) the goalie minimum beats one that misses it, whatever its AGP or points.
  const chainBetter = (a: StreamingChain, b: StreamingChain) => targeted && meets(a) !== meets(b) ? meets(a) : objectiveBetter(a, b);
  const certifyAll = (proposals: SpotPlan[][]) => {
    const seen = new Set<string>();
    return proposals.flatMap(spots => {
      const key = spots.map(spot => `${spot.drop.id}:${spot.windows.map(window => window.start)}:${spot.chosen.map(option => option.playerId)}`).join("/");
      if (seen.has(key)) return [];
      seen.add(key);
      const chain = certify(spots);
      return chain && (chain.netGames > 0 || need > 0 && meets(chain) || pointsFirst && (pointsOf(chain) ?? 0) > 1e-9) ? [chain] : [];
    });
  };
  const top = (chains: StreamingChain[], order: typeof objectiveBetter) => chains.reduce<StreamingChain | null>((result, chain) => !result || order(chain, result) ? chain : result, null);
  const goals = need > 0 ? [0, need] : [0];
  const ones = certifyAll(drops.flatMap(drop => goals.flatMap(goal => { const spot = runSpot(empty, drop, budget, new Set(), goal); return spot ? [[spot]] : []; })));
  // Two spots: the first spot keeps `split` adds, the second spends the rest on top of it (and any goalie shortfall left).
  const pairs: SpotPlan[][] = [];
  if (budget >= 2) for (const [index, firstDrop] of drops.entries()) for (const secondDrop of drops.slice(index + 1)) for (const goal of goals) {
    let bestPair: { spots: SpotPlan[]; value: Value } | null = null;
    for (const [a, b] of [[firstDrop, secondDrop], [secondDrop, firstDrop]]) for (let split = 1; split < budget; split++) {
      const spotA = runSpot(empty, a, split, new Set(), goal);
      if (!spotA) continue;
      const spotB = runSpot(contextWith(empty, spotA), b, budget - split, new Set(spotA.chosen.map(option => option.playerId)), Math.max(0, goal - spotA.value.starts));
      if (!spotB) continue;
      const value = plus(spotA.value, spotB.value);
      if (!bestPair || better(value, bestPair.value, goal, pointsFirst)) bestPair = { spots: [spotA, spotB], value };
    }
    if (bestPair) pairs.push(bestPair.spots);
  }
  const twos = certifyAll(pairs);
  const one = top(ones, chainBetter), two = top(twos, chainBetter);
  // A two-spot split is suggested only when it ranks above the one-spot chain; the one-spot chain is always offered.
  if (one && two && chainBetter(two, one)) { plan.recommended = 2; plan.chains = [two, one]; }
  else if (one) { plan.recommended = 1; plan.chains = [one]; }
  else if (two) { plan.recommended = 2; plan.chains = [two]; }
  if (!plan.chains.length) plan.limitations.push("No streaming chain adds active games over holding the roster.");
  // Meeting the minimum is never traded silently: the best chain that misses it is offered beside the one that meets it.
  const unconstrained = top([...ones, ...twos], objectiveBetter);
  if (targeted && unconstrained && !meets(unconstrained) && plan.chains.length && meets(plan.chains[0]) && !plan.chains.includes(unconstrained)) plan.chains.push(unconstrained);
  if (need > 0 && plan.chains.length && !plan.chains.some(meets)) plan.limitations.push("No streaming chain reaches the goalie minimum with the adds left.");
  if (pool.some(player => player.availability === "waivers")) plan.limitations.push("Streaming chains use free agents only; waiver claims are not chained.");
  return plan;
}

/** The chain's steps with some legs swapped to another ranked option (leg index → player id). Timing is unchanged:
 * every option is a free agent claimed at the same moment; the next leg drops whoever this leg adds. */
export function streamingChainSteps(chain: Pick<StreamingChain, "legs">, overrides: Readonly<Record<number, string>> = {}): PlanStep[] {
  const lastBySpot = new Map<number, PlanStep>();
  return chain.legs.map((leg, index) => {
    const playerId = overrides[index] ?? leg.playerId, prior = lastBySpot.get(leg.spot);
    const position = chain.legs.slice(0, index).filter(item => item.spot === leg.spot).length;
    const step: PlanStep = { ...leg.step, id: `stream:${leg.spot}:${position}:${playerId}`, playerId,
      dropPlayerId: prior ? prior.playerId : leg.dropPlayerId, dependsOn: prior ? [prior.id] : [] };
    lastBySpot.set(leg.spot, step);
    return step;
  });
}
