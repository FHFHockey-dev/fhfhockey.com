import { localDate, zonedMidnight } from "./planningDates";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import { acquisitionEffectiveAt } from "./planningTimeline";
import { dropEligible, providerListsOut, reservedPlayerIds } from "./retention";
import type { PlanEvaluation, PlanIntent, PlanStep, PlanningGame, PlanningPlayer, PlanningSnapshot, StreamingChain, StreamingLeg, StreamingOption, StreamingPlan } from "./planningTypes";

/** Streaming chains (TJ, 2026-10-27): turn the period's remaining adds into the most added active games, then projected
 * fantasy points. A stream spot is a sequence of contiguous day windows; each window's streamer is dropped by the next
 * add. Windows come from team schedules and open lineup slots (small per-day matchings); players are ranked within a
 * window by projected points over the games they would start. Proposals are heuristic; every returned chain is
 * certified by the plan evaluator, which alone supplies its legality and net totals. */
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
type Value = { games: number; points: number; known: boolean; adds: number };
type Candidate = StreamingOption & { player: PlanningPlayer; playDays: number[]; pointsKnown: boolean };
type Window = { start: number; end: number; ranked: Candidate[] };
type SpotPlan = { start: number; drop: PlanningPlayer; windows: Window[]; chosen: Candidate[]; value: Value };
type Context = { removedFrom: Map<string, number>; extras: Elig[][] };

const time = (value: string) => Date.parse(value);
const STREAMABLE = new Set(["free_agent", "manager_available"]);
const RESERVES = new Set(["IR", "IR+", "NA"]);
/** Projected points this close are a near tie: recent scoring orders them. */
const NEAR_TIE = 0.1;
const OPTION_COUNT = 5, RANKED_COUNT = 12, DROP_CANDIDATES = 3;
const ZERO: Value = { games: 0, points: 0, known: true, adds: 0 };
const better = (a: Value, b: Value) => a.games !== b.games ? a.games > b.games
  : Math.abs(a.points - b.points) > 1e-9 ? a.points > b.points : a.adds < b.adds;
const plus = (a: Value, b: Value): Value => ({ games: a.games + b.games, points: a.points + b.points, known: a.known && b.known, adds: a.adds + b.adds });
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function rankOptions(a: Candidate, b: Candidate) {
  if (a.games !== b.games) return b.games - a.games;
  if (a.points !== null && b.points !== null && Math.abs(a.points - b.points) > NEAR_TIE) return b.points - a.points;
  if (a.points === null !== (b.points === null)) return a.points === null ? 1 : -1;
  const recent = (b.recentPointsPerGame ?? -Infinity) - (a.recentPointsPerGame ?? -Infinity);
  if (recent && Number.isFinite(recent)) return recent;
  return (b.points ?? 0) - (a.points ?? 0) || a.player.id.localeCompare(b.player.id);
}
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
  const recent = (player: PlanningPlayer) => player.form && player.form.games > 0 ? player.form.points / player.form.games : null;

  /** Best chain for one spot that starts by dropping `drop`, on top of `context` (another spot's streamers). */
  const runSpot = (context: Context, drop: PlanningPlayer, adds: number, used: ReadonlySet<string>): SpotPlan | null => {
    const without: Context = { removedFrom: new Map([...context.removedFrom, [drop.id, 0]]), extras: context.extras };
    const gain = new Map<string, number[]>();
    const gainFor = (value: Elig) => {
      if (!gain.has(value.key)) gain.set(value.key, dates.map((_, day) => capacity(day, without, value) - capacity(day, without)));
      return gain.get(value.key)!;
    };
    const lossGames = dates.map((_, day) => capacity(day, context) - capacity(day, without));
    const lossPoints = dates.map((date, day) => {
      const row = lossGames[day] > 0 ? baseline.assignments.find(item => item.playerId === drop.id && item.date === date) : undefined;
      return row ? inputs.points(drop.id, row.gameId) : 0;
    });
    // Per player: games he would start on each day, their projected points and the first-day claim for each window start.
    const rows = pool.filter(player => !used.has(player.id)).map(player => {
      const gains = gainFor(elig(player));
      const games = dates.map(date => gameOn.get(`${player.teamAbbreviation}:${date}`));
      const starts = games.map((game, day) => !!game && gains[day] > 0);
      const points = games.map((game, day) => starts[day] ? inputs.points(player.id, game!.id) : 0);
      const firstDay = timing.map((item, day) => !!item && starts[day] && claimable(games[day]!, item.effectiveAt));
      return { player, games, starts, points, firstDay, form: recent(player) };
    });
    const windows: Window[][] = dates.map(() => []);
    for (let start = 0; start < n; start++) if (timing[start]) for (let end = start + 1; end <= n; end++) {
      const ranked: Candidate[] = [];
      for (const row of rows) {
        const playDays = [...(row.firstDay[start] ? [start] : [])];
        for (let day = start + 1; day < end; day++) if (row.starts[day]) playDays.push(day);
        if (!playDays.length) continue;
        const values = playDays.map(day => row.points[day]);
        const known = values.every(value => value !== null && Number.isFinite(value));
        ranked.push({ player: row.player, playerId: row.player.id, games: playDays.length, gameDates: playDays.map(day => dates[day]), playDays,
          points: known ? values.reduce<number>((sum, value) => sum + value!, 0) : null, pointsKnown: known,
          recentPointsPerGame: row.form, recentGames: row.player.form?.games ?? null });
      }
      windows[start][end] = { start, end, ranked: ranked.sort(rankOptions).slice(0, RANKED_COUNT) };
    }
    const legValue = (window: Window | undefined): Value | null => {
      const best = window?.ranked[0];
      return best ? { games: best.games, points: best.points ?? 0, known: best.pointsKnown, adds: 1 } : null;
    };
    // best[start][used]: the most from a leg effective on dates[start] onward, `used` adds already spent.
    const best: Array<Array<{ value: Value; end: number } | null>> = Array.from({ length: n + 1 }, () => new Array(adds).fill(null));
    for (let start = n - 1; start >= 0; start--) if (timing[start]) for (let spent = 0; spent < adds; spent++) {
      for (let end = start + 1; end <= n; end++) {
        const leg = legValue(windows[start][end]);
        // The last streamer is held to the end; any other is dropped by the next leg, effective the day his window ends.
        const rest = end === n ? ZERO : spent + 1 < adds && timing[end] ? best[end][spent + 1]?.value ?? null : null;
        if (!leg || !rest) continue;
        const total = plus(leg, rest);
        if (!best[start][spent] || better(total, best[start][spent]!.value)) best[start][spent] = { value: total, end };
      }
    }
    let chosen: { start: number; value: Value } | null = null;
    for (let start = 0; start < n; start++) {
      const entry = best[start][0];
      if (!entry) continue;
      const lost = lossGames.slice(start).reduce((sum, value) => sum + value, 0);
      const lostPoints = lossPoints.slice(start);
      const value: Value = { games: entry.value.games - lost, adds: entry.value.adds, known: entry.value.known && lostPoints.every(item => item !== null),
        points: entry.value.points - lostPoints.reduce<number>((sum, item) => sum + (item ?? 0), 0) };
      if (!chosen || better(value, chosen.value)) chosen = { start, value };
    }
    if (!chosen || chosen.value.games <= 0) return null;
    const legs: Window[] = [];
    for (let start = chosen.start, spent = 0; start < n; spent++) {
      const entry = best[start][spent]!;
      legs.push(windows[start][entry.end]);
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
      if (first <= window.start || !timing[first] || !windows[first][window.end]) continue;
      legs[index] = windows[first][window.end];
      if (index) legs[index - 1] = windows[legs[index - 1].start][first];
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
    return { spots: spots.length as 1 | 2, legs, steps, evaluation, netGames: evaluation.activeGames - baseline.activeGames, netPoints,
      addsUsed: steps.length, addsAvailable: budget };
  };
  const chainBetter = (a: StreamingChain, b: StreamingChain) => a.netGames !== b.netGames ? a.netGames > b.netGames
    : a.netPoints !== null && b.netPoints !== null && Math.abs(a.netPoints - b.netPoints) > 1e-9 ? a.netPoints > b.netPoints : a.addsUsed < b.addsUsed;
  const pickBest = (proposals: SpotPlan[][]) => {
    let result: StreamingChain | null = null;
    for (const spots of proposals) {
      const chain = certify(spots);
      if (chain && chain.netGames > 0 && (!result || chainBetter(chain, result))) result = chain;
    }
    return result;
  };
  const one = pickBest(drops.flatMap(drop => { const spot = runSpot(empty, drop, budget, new Set()); return spot ? [[spot]] : []; }));
  // Two spots: the first spot keeps `split` adds, the second spends the rest on top of it.
  const pairs: SpotPlan[][] = [];
  if (budget >= 2) for (const [index, firstDrop] of drops.entries()) for (const secondDrop of drops.slice(index + 1)) {
    let bestPair: { spots: SpotPlan[]; value: Value } | null = null;
    for (const [a, b] of [[firstDrop, secondDrop], [secondDrop, firstDrop]]) for (let split = 1; split < budget; split++) {
      const spotA = runSpot(empty, a, split, new Set());
      if (!spotA) continue;
      const spotB = runSpot(contextWith(empty, spotA), b, budget - split, new Set(spotA.chosen.map(option => option.playerId)));
      if (!spotB) continue;
      const value = plus(spotA.value, spotB.value);
      if (!bestPair || better(value, bestPair.value)) bestPair = { spots: [spotA, spotB], value };
    }
    if (bestPair) pairs.push(bestPair.spots);
  }
  const two = pickBest(pairs);
  // A two-spot split is suggested only when it adds more than the one-spot chain; the one-spot chain is always offered.
  if (one && two && chainBetter(two, one)) { plan.recommended = 2; plan.chains = [two, one]; }
  else if (one) { plan.recommended = 1; plan.chains = [one]; }
  else if (two) { plan.recommended = 2; plan.chains = [two]; }
  if (!plan.chains.length) plan.limitations.push("No streaming chain adds active games over holding the roster.");
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
