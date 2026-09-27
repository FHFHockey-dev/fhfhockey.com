import { weightedAssignment } from "../projections/weightedAssignment";
import { localDate, zonedMidnight } from "./planningDates";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import { buildTimeline } from "./planningTimeline";
import type { GameForecast, PlanEvaluation, PlanIntent, PlanStep, PlanningAssignment, PlanningGame, PlanningObjective, PlanningPlayer, PlanningResult, PlanningSnapshot, ScoringCategory, StatLine } from "./planningTypes";

export type PlanningSearchOptions = { maxEvaluations?: number; beamWidth?: number; maxCandidates?: number; maxSteps?: number; timeBudgetMs?: number };
type Play = { player: PlanningPlayer; game: PlanningGame; forecast: GameForecast | null; gamesCount?: number };
const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);
const time = (value: string) => Date.parse(value);
const gameTime = (game: PlanningGame, zone: string) => game.startsAt ?? zonedMidnight(game.date, zone);
const eligibleGame = (game: PlanningGame, snapshot: PlanningSnapshot) => game.startsAt
  ? time(game.startsAt) >= time(snapshot.context.asOf)
  : game.date > localDate(snapshot.context.asOf, snapshot.context.timeZone);
const preferredGoalieDate = (date: string, intent: PlanIntent) => {
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
  const early = weekday <= (intent.goalieSplit === "mon_wed" ? 3 : 4);
  return intent.goalieWindow === "any" || (intent.goalieWindow === "early" ? early : !early);
};

function categoryValue(stats: StatLine, category: ScoringCategory): number | null {
  const numerator = stats[category.numerator ?? category.key];
  if (!finite(numerator)) return null;
  if (!category.denominator) return numerator * (category.multiplier ?? 1);
  const denominator = stats[category.denominator];
  return finite(denominator) && denominator > 0 ? numerator / denominator * (category.multiplier ?? 1) : null;
}
function opponentStats(snapshot: PlanningSnapshot): StatLine | null {
  if (!snapshot.opponent || snapshot.opponent.remaining === null) return null;
  const stats: StatLine = { ...snapshot.opponent.realized };
  for (const [key, value] of Object.entries(snapshot.opponent.remaining ?? {})) stats[key] = finite(value) && finite(stats[key]) ? stats[key]! + value : null;
  return stats;
}
type Applicability = Record<"skater" | "goalie", Set<string>>;
const GOALIE_STATS = new Set(["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE", "SHOTS_AGAINST_GOALIE", "SAVES", "GOALSAGAINST", "SHOTSAGAINST", "WINS", "SHUTOUTS", "GAA", "SV%", "SAVE_PERCENTAGE"]);
function statApplicability(snapshot: PlanningSnapshot): Applicability {
  const playerClass = new Map(snapshot.players.map(player => [player.id, player.playerClass]));
  const result: Applicability = { skater: new Set(), goalie: new Set() };
  for (const forecast of snapshot.forecasts) {
    const kind = playerClass.get(forecast.playerId);
    if (kind) for (const [key, value] of Object.entries(forecast.stats)) if (finite(value)) result[kind].add(key);
  }
  return result;
}
function applies(key: string, kind: "skater" | "goalie", applicability: Applicability): boolean {
  if (GOALIE_STATS.has(key.toUpperCase())) return kind === "goalie";
  return applicability[kind].has(key) || !applicability.skater.has(key) && !applicability.goalie.has(key);
}
function playValue(play: Play, snapshot: PlanningSnapshot, opponent: StatLine | null, applicability: Applicability): number | null {
  if (!play.forecast || play.forecast.conditioning !== "unconditional") return null;
  const stats = play.forecast.stats;
  if (snapshot.rules.scoring.mode === "points") {
    const weights = Object.entries(snapshot.rules.scoring.weights).filter(([key, weight]) => weight !== 0 && applies(key, play.player.playerClass, applicability));
    if (!Object.keys(snapshot.rules.scoring.weights).length || weights.some(([key]) => !finite(stats[key]))) return null;
    return weights.reduce((sum, [key, weight]) => sum + stats[key]! * weight, 0);
  }
  if (!opponent) return null;
  let value = 0;
  for (const category of snapshot.rules.scoring.categories) {
    if (!applies(category.numerator ?? category.key, play.player.playerClass, applicability)) continue;
    const target = categoryValue(opponent, category);
    const numerator = stats[category.numerator ?? category.key];
    const denominator = category.denominator ? stats[category.denominator] : 1;
    if (!finite(target) || !finite(numerator) || !finite(denominator)) return null;
    // Ratio contribution is measured against the opponent's current ratio.
    value += (numerator - (category.denominator ? target / (category.multiplier ?? 1) * denominator : 0)) * (category.direction === "higher" ? 1 : -1);
  }
  return value;
}
function assign(snapshot: PlanningSnapshot, intent: PlanIntent, objective: PlanningObjective, plays: Play[], date: string, locked: Array<{ playerId: string; slotId: string | null }>, limitations: Set<string>, applicability: Applicability, goalieNeeded: boolean, allowNoGameLocks = false): PlanningAssignment[] {
  const expanded = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const slots = [...expanded];
  const output: PlanningAssignment[] = [];
  const benchLocked = new Set(locked.filter(lock => lock.slotId === null).map(lock => lock.playerId));
  for (const lock of locked) {
    if (lock.slotId === null) continue;
    const play = plays.find(item => item.player.id === lock.playerId);
    const slotIndex = slots.findIndex(slot => slot.id === lock.slotId);
    const slotType = expanded.find(slot => slot.id === lock.slotId)?.type;
    const player = play?.player ?? snapshot.players.find(item => item.id === lock.playerId);
    if ((!play && !allowNoGameLocks) || slotIndex < 0 || !slotType || !player || !canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slotType)) { limitations.add(`Locked assignment for ${lock.playerId} on ${date} cannot be verified.`); continue; }
    const [slot] = slots.splice(slotIndex, 1);
    if (play) output.push({ date, playerId: play.player.id, gameId: play.game.id, slotId: slot.id, locked: true });
    else benchLocked.add(player.id);
  }
  const fixed = new Set(output.map(row => row.playerId));
  const candidate = plays.filter(play => !fixed.has(play.player.id) && !benchLocked.has(play.player.id));
  if (!slots.length || !candidate.length) return output;
  const opponent = opponentStats(snapshot);
  const values = new Map(candidate.map(play => {
    const value = playValue(play, snapshot, opponent, applicability);
    if (value === null) limitations.add("Some scheduled games lack unconditional scoring forecasts; projected outcome is incomplete.");
    return [play, value] as const;
  }));
  const agpBonus = 1 + [...values.values()].reduce<number>((sum, value) => sum + (finite(value) ? Math.abs(value) : 0), 0);
  for (const row of weightedAssignment(slots, candidate, (slot, play) =>
    canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type)
      ? objective === "agp" ? (play.gamesCount ?? 1) * agpBonus + (values.get(play) ?? 0)
        : values.get(play) === null ? null : values.get(play)! + (goalieNeeded && play.player.playerClass === "goalie" ? 1e5 : 0)
      : null)) {
    if (row.playerIndex === null) continue;
    const play = candidate[row.playerIndex];
    output.push({ date, playerId: play.player.id, gameId: play.game.id, slotId: slots[row.slotIndex].id, locked: false });
  }
  return output;
}

/** Compare complete category lineups; local moves are bounded for worker responsiveness. */
function refineCategoryLineup(
  snapshot: PlanningSnapshot, intent: PlanIntent, seed: PlanningAssignment[],
  playsByDate: Map<string, Play[]>, windowByDate: Map<string, string>, weeklyCandidates: Map<string, Play[]>,
  forecasts: Map<string, GameForecast>, opponent: StatLine, applicability: Applicability, limitations: Set<string>,
): PlanningAssignment[] {
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const playByKey = new Map([...playsByDate.values()].flat().map(play => [`${play.player.id}:${play.game.id}`, play]));
  const needed = new Set(snapshot.rules.scoring.categories.flatMap(category =>
    [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]));
  const score = (rows: PlanningAssignment[]) => {
    const stats: StatLine = { ...snapshot.realized };
    const goalieGroups = new Map<string, number>();
    for (const row of rows) {
      const play = playByKey.get(`${row.playerId}:${row.gameId}`);
      const forecast = forecasts.get(`${row.playerId}:${row.gameId}`);
      if (!play || !forecast || forecast.conditioning !== "unconditional") return -Infinity;
      for (const key of needed) {
        if (!applies(key, play.player.playerClass, applicability)) continue;
        const value = forecast.stats[key];
        if (!finite(value)) return -Infinity;
        stats[key] = (stats[key] ?? 0)! + value;
      }
      if (play.player.playerClass === "goalie" && snapshot.rules.goalieMinimum.required !== null && snapshot.rules.goalieMinimum.counts === "starts") {
        const probability = forecast.confirmedStart ? 1 : forecast.startProbability;
        if (!finite(probability)) return -Infinity;
        const key = `${play.game.id}:${play.player.teamAbbreviation}`;
        goalieGroups.set(key, Math.min(1, (goalieGroups.get(key) ?? 0) + probability));
      }
    }
    let total = 0;
    for (const category of snapshot.rules.scoring.categories) {
      const own = categoryValue(stats, category), other = categoryValue(opponent, category);
      if (!finite(own) || !finite(other)) return -Infinity;
      const difference = (own - other) * (category.direction === "higher" ? 1 : -1);
      total += Math.sign(difference) + Math.tanh(difference / Math.max(1, Math.abs(other))) * 0.01;
    }
    const minimum = snapshot.rules.goalieMinimum;
    if (minimum.required !== null && minimum.counts === "starts" && finite(minimum.credited)) {
      const projected = minimum.credited + [...goalieGroups.values()].reduce((sum, value) => sum + value, 0);
      if (projected < minimum.required) {
        if (minimum.penalty === "lose_goalie_categories") total -= 100;
        if (intent.goalieCoverage === "cover") total -= 10;
      }
    }
    return total;
  };
  const key = (rows: PlanningAssignment[]) => rows.map(row => `${row.date}:${row.slotId}:${row.playerId}`).sort().join("|");
  function* neighbors(rows: PlanningAssignment[]): Generator<PlanningAssignment[]> {
    if (snapshot.rules.lineupMode === "weekly") {
      for (const [window, candidates] of weeklyCandidates) {
        const dates = [...windowByDate].filter(([, id]) => id === window).map(([date]) => date);
        for (const slot of slots) {
          if (dates.some(date => snapshot.lockedAssignments.some(lock => lock.date === date && lock.slotId === slot.id))) continue;
          const current = rows.find(row => dates.includes(row.date) && row.slotId === slot.id)?.playerId;
          for (const player of [null, ...candidates]) {
            if (player?.player.id === current) continue;
            if (player && !canEligibilityOccupySlot(normalizeEligibility(player.player.eligiblePositions), slot.type)) continue;
            if (player && dates.some(date => snapshot.lockedAssignments.some(lock => lock.date === date && lock.playerId === player.player.id && lock.slotId === null))) continue;
            const retained = rows.filter(row => !(dates.includes(row.date) && row.slotId === slot.id));
            if (!player) { yield retained; continue; }
            const replacement = dates.flatMap(date => playsByDate.get(date)?.filter(play => play.player.id === player.player.id).map(play =>
              ({ date, playerId: play.player.id, gameId: play.game.id, slotId: slot.id, locked: true })) ?? []);
            if (replacement.some(row => retained.some(other => other.date === row.date && other.playerId === row.playerId))) continue;
            yield [...retained, ...replacement];
          }
        }
      }
    } else {
      for (const [date, plays] of playsByDate) for (const slot of slots) {
        const current = rows.find(row => row.date === date && row.slotId === slot.id);
        if (current?.locked) continue;
        const retained = rows.filter(row => !(row.date === date && row.slotId === slot.id));
        if (current) yield retained;
        for (const play of plays) {
          if (current?.playerId === play.player.id || !canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type)) continue;
          if (retained.some(row => row.date === date && row.playerId === play.player.id)) continue;
          if (snapshot.lockedAssignments.some(lock => lock.date === date && lock.playerId === play.player.id)) continue;
          yield [...retained, { date, playerId: play.player.id, gameId: play.game.id, slotId: slot.id, locked: false }];
        }
      }
    }
  }
  const seen = new Set([key(seed)]);
  let best = seed, bestScore = score(seed), frontier = [seed], evaluated = 1;
  for (let depth = 0; depth < 3 && evaluated < 100; depth++) {
    const next: Array<{ rows: PlanningAssignment[]; value: number }> = [];
    for (const rows of frontier) {
      if (evaluated >= 100) break;
      for (const candidate of neighbors(rows)) {
        const identity = key(candidate);
        if (seen.has(identity)) continue;
        seen.add(identity);
        const value = score(candidate);
        evaluated++;
        if (value > bestScore + 1e-8) { best = candidate; bestScore = value; }
        if (Number.isFinite(value)) next.push({ rows: candidate, value });
        if (evaluated >= 100) break;
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.value - a.value);
    frontier = next.slice(0, 6).map(item => item.rows);
  }
  if (seen.size > 1) limitations.add("Category lineup alternatives were bounded; the selected lineup is best found, not proven optimal.");
  return best;
}

export function evaluatePlan(snapshot: PlanningSnapshot, intent: PlanIntent, objective: PlanningObjective, steps: PlanStep[] = intent.steps): PlanEvaluation {
  const limitations = new Set<string>(snapshot.rules.unsupported);
  const timeline = buildTimeline(snapshot, intent, steps);
  const slotDiagnostics = expandActiveSlots(snapshot.rules.rosterSlots).diagnostics;
  for (const diagnostic of slotDiagnostics) limitations.add(diagnostic.message);
  if (snapshot.rules.lineupMode === "unsupported") limitations.add("Lineup mode is unsupported.");
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const forecasts = new Map(snapshot.forecasts.map(forecast => [`${forecast.playerId}:${forecast.gameId}`, forecast]));
  const applicability = statApplicability(snapshot);
  const games = snapshot.games.filter(game => ["scheduled", "live"].includes(game.status) && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot)).sort((a, b) => time(gameTime(a, snapshot.context.timeZone)) - time(gameTime(b, snapshot.context.timeZone)) || a.id.localeCompare(b.id));
  const dates = [...new Set(games.map(game => game.date))];
  const assignments: PlanningAssignment[] = [];
  const chosen = new Map<string, Play>();
  const playsByDate = new Map<string, Play[]>();
  const windowByDate = new Map<string, string>();
  const weeklyCandidates = new Map<string, Play[]>();
  let invalidLocks = false;
  let weeklyEvidenceMissing = false;
  let scheduledGames = 0, forecastedOpportunities = 0;
  const weekly = new Map<string, Map<string, string>>();
  const lineupPeriodForDate = (date: string) => {
    const midnight = time(zonedMidnight(date, snapshot.context.timeZone));
    return snapshot.rules.lineupPeriods?.find(item => time(item.start) <= midnight && midnight < time(item.end));
  };
  for (const date of dates) {
    const dayGames = games.filter(game => game.date === date);
    const plays: Play[] = [];
    for (const game of dayGames) for (const [id, member] of timeline.at(gameTime(game, snapshot.context.timeZone))) {
      const player = players.get(id);
      if (!player || player.teamAbbreviation !== game.teamAbbreviation || ["IR", "IR+", "NA"].includes(member.position) || time(member.since) > time(gameTime(game, snapshot.context.timeZone))) continue;
      if (!game.startsAt && time(member.since) >= time(zonedMidnight(game.date, snapshot.context.timeZone))) continue;
      const forecast = forecasts.get(`${id}:${game.id}`) ?? null;
      if (forecast?.conditioning === "unconditional") forecastedOpportunities++;
      plays.push({ player, game, forecast });
    }
    if (dayGames.some(game => !game.startsAt)) limitations.add("Some game start times are unknown; same-day acquisitions cannot claim those starts.");
    playsByDate.set(date, plays);
    scheduledGames += plays.length;
    const creditedExpected = new Map<string, number>();
    for (const play of chosen.values()) if (play.player.playerClass === "goalie") {
      const key = `${play.game.id}:${play.player.teamAbbreviation}`;
      const value = play.forecast?.confirmedStart ? 1 : play.forecast?.startProbability ?? 0;
      creditedExpected.set(key, Math.min(1, (creditedExpected.get(key) ?? 0) + value));
    }
    const goalieNeeded = intent.goalieCoverage === "cover" && snapshot.rules.goalieMinimum.required !== null &&
      (snapshot.rules.goalieMinimum.credited ?? 0) + [...creditedExpected.values()].reduce((sum, value) => sum + value, 0) < snapshot.rules.goalieMinimum.required;
    let rows: PlanningAssignment[];
    if (snapshot.rules.lineupMode === "weekly") {
      const period = lineupPeriodForDate(date);
      const window = period?.id ?? `unsupported:${date}`;
      windowByDate.set(date, window);
      const lockAt = period?.lockAt;
      if (!period || !lockAt) limitations.add(`Weekly lineup window or lock time is unverified for ${date}.`);
      let locked = weekly.get(window);
      if (!locked) {
        const weekGames = games.filter(game => {
          const candidate = lineupPeriodForDate(game.date);
          return candidate?.id === window;
        });
        const aggregate: Play[] = [];
        for (const [id, member] of timeline.at(gameTime(dayGames[0], snapshot.context.timeZone))) {
          const player = players.get(id);
          if (!player || ["IR", "IR+", "NA"].includes(member.position) || !lockAt || time(member.since) > time(lockAt)) continue;
          const playerGames = weekGames.filter(game => game.teamAbbreviation === player.teamAbbreviation);
          if (!playerGames.length) continue;
          const stats: StatLine = {};
          let missing = false;
          for (const game of playerGames) {
            const forecast = forecasts.get(`${id}:${game.id}`);
            if (!forecast) { missing = true; break; }
            for (const [key, value] of Object.entries(forecast.stats)) if (finite(value)) stats[key] = (stats[key] ?? 0)! + value; else missing = true;
          }
          aggregate.push({ player, game: playerGames[0], gamesCount: playerGames.length, forecast: missing ? null : { ...forecasts.get(`${id}:${playerGames[0].id}`)!, stats } });
        }
        const locks = snapshot.lockedAssignments.filter(item => lineupPeriodForDate(item.date)?.id === window);
        const slotOwners = new Map<string, string>(), playerSlots = new Map<string, string | null>();
        const uniqueLocks: typeof locks = [];
        for (const lock of locks) {
          if ((lock.slotId !== null && slotOwners.has(lock.slotId) && slotOwners.get(lock.slotId) !== lock.playerId) ||
            (playerSlots.has(lock.playerId) && playerSlots.get(lock.playerId) !== lock.slotId)) {
            limitations.add(`Conflicting weekly locks in ${window}.`);
            invalidLocks = true;
            continue;
          }
          if (lock.slotId !== null) slotOwners.set(lock.slotId, lock.playerId);
          playerSlots.set(lock.playerId, lock.slotId);
          if (!uniqueLocks.some(item => item.playerId === lock.playerId && item.slotId === lock.slotId)) uniqueLocks.push(lock);
        }
        const rosterAtWindow = timeline.at(gameTime(dayGames[0], snapshot.context.timeZone));
        for (const lock of uniqueLocks) if (!rosterAtWindow.has(lock.playerId)) {
          limitations.add(`Locked weekly player ${lock.playerId} is not rostered in ${window}.`);
          invalidLocks = true;
        }
        weeklyCandidates.set(window, aggregate);
        const seed = assign(snapshot, intent, objective, aggregate, date, uniqueLocks, limitations, applicability, goalieNeeded, true);
        locked = new Map(seed.map(row => [row.slotId, row.playerId]));
        for (const lock of uniqueLocks) if (lock.slotId !== null) locked.set(lock.slotId, lock.playerId);
        weekly.set(window, locked);
        if (lockAt && time(snapshot.context.asOf) > time(lockAt) && locks.length === 0) {
          limitations.add("Current weekly lineup lock lacks authoritative slot evidence.");
          weeklyEvidenceMissing = true;
        }
      }
      rows = [];
      for (const [slotId, id] of locked) {
        const play = plays.find(item => item.player.id === id);
        if (play) rows.push({ date, playerId: id, gameId: play.game.id, slotId, locked: true });
      }
      for (const lock of snapshot.lockedAssignments.filter(item => item.date === date)) {
        const inactiveLock = lock.slotId !== null && !plays.some(play => play.player.id === lock.playerId) && locked.get(lock.slotId) === lock.playerId;
        if (lock.slotId === null ? rows.some(row => row.playerId === lock.playerId) : !inactiveLock && !rows.some(row => row.playerId === lock.playerId && row.slotId === lock.slotId))
          limitations.add(`Locked assignment for ${lock.playerId} on ${date} conflicts with weekly lineup.`);
      }
    } else rows = assign(snapshot, intent, objective, plays, date, snapshot.lockedAssignments.filter(item => item.date === date), limitations, applicability, goalieNeeded);
    for (const lock of snapshot.lockedAssignments.filter(item => item.date === date)) {
      const inactiveLock = snapshot.rules.lineupMode === "weekly" && lock.slotId !== null && !plays.some(play => play.player.id === lock.playerId) && weekly.get(windowByDate.get(date) ?? "")?.get(lock.slotId) === lock.playerId;
      if (lock.slotId === null ? rows.some(row => row.playerId === lock.playerId) : !inactiveLock && !rows.some(row => row.playerId === lock.playerId && row.slotId === lock.slotId)) invalidLocks = true;
    }
    for (const row of rows) {
      assignments.push(row);
      const play = plays.find(item => item.player.id === row.playerId && item.game.id === row.gameId);
      if (play) chosen.set(`${row.playerId}:${row.gameId}`, play);
    }
  }
  if (objective === "outcome" && snapshot.rules.scoring.mode === "categories") {
    const opponent = opponentStats(snapshot);
    if (opponent) {
      const refined = refineCategoryLineup(snapshot, intent, assignments, playsByDate, windowByDate, weeklyCandidates, forecasts, opponent, applicability, limitations);
      assignments.splice(0, assignments.length, ...refined);
      chosen.clear();
      for (const row of assignments) {
        const play = playsByDate.get(row.date)?.find(item => item.player.id === row.playerId && item.game.id === row.gameId);
        if (play) chosen.set(`${row.playerId}:${row.gameId}`, play);
      }
    }
  }
  timeline.at("9999-12-31T23:59:59Z");
  for (const limitation of timeline.limitations) limitations.add(limitation);
  const stats: StatLine = { ...snapshot.realized };
  const missing = new Set<string>();
  let missingSelectedForecast = false;
  for (const play of chosen.values()) {
    if (!play.forecast || play.forecast.conditioning !== "unconditional") { limitations.add("An active game lacks an unconditional forecast."); missingSelectedForecast = true; continue; }
    for (const [key, value] of Object.entries(play.forecast.stats)) {
      if (!applies(key, play.player.playerClass, applicability)) continue;
      if (finite(value)) stats[key] = (stats[key] ?? 0)! + value; else missing.add(key);
    }
  }
  for (const key of missing) stats[key] = null;
  if (scheduledGames > 0 && forecastedOpportunities === 0) limitations.add("No remaining opportunities have usable forecasts; projected outcome is unavailable.");
  const needed = snapshot.rules.scoring.mode === "points" ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key) : snapshot.rules.scoring.categories.flatMap(category => [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]);
  for (const key of needed) if (!finite(stats[key])) limitations.add(`Projected ${key} is incomplete.`);
  const opponent = opponentStats(snapshot);
  const categoryResults = snapshot.rules.scoring.categories.map(category => {
    const own = categoryValue(stats, category), other = opponent ? categoryValue(opponent, category) : null;
    const result = own === null || other === null ? "unknown" : own === other ? "tie" : ((own - other) * (category.direction === "higher" ? 1 : -1) > 0 ? "win" : "loss");
    return { key: category.key, own, opponent: other, result } as const;
  });
  let projectedValue: number | null = null;
  if (snapshot.rules.scoring.mode === "points") projectedValue = !missingSelectedForecast && (scheduledGames === 0 || forecastedOpportunities > 0) && needed.length && needed.every(key => finite(stats[key])) ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).reduce((sum, [key, weight]) => sum + stats[key]! * weight, 0) : null;
  else {
    limitations.add("Category outcomes use provisional means; calibrated joint probabilities are unavailable.");
    if (!opponent) limitations.add("Opponent projection is unavailable; matchup strategy is unverified.");
    projectedValue = !missingSelectedForecast && (scheduledGames === 0 || forecastedOpportunities > 0) && categoryResults.every(row => row.result !== "unknown") && categoryResults.length ? categoryResults.reduce((sum, row) => sum + (row.result === "win" ? 1 : row.result === "loss" ? -1 : 0), 0) : null;
  }
  const minimum = snapshot.rules.goalieMinimum;
  const minimumLastDate = minimum.periodEnd && Number.isFinite(time(minimum.periodEnd))
    ? new Date(time(minimum.periodEnd) - 1).toISOString().slice(0, 10) : null;
  const minimumWindowVerified = !!minimum.periodStart && !!minimum.periodEnd &&
    !!minimumLastDate && snapshot.context.startDate >= minimum.periodStart.slice(0, 10) && snapshot.context.endDate >= minimumLastDate && snapshot.context.endDate < minimum.periodEnd.slice(0, 10);
  if (minimum.required !== null && !minimumWindowVerified) limitations.add("Goalie minimum progress applies to an unverified or narrower period; coverage cannot be confirmed for this range.");
  let projected = minimum.credited, confirmed = 0;
  const minimumAlreadyMet = minimum.required !== null && finite(minimum.credited) && minimum.credited >= minimum.required;
  const goalieByTeamGame = new Map<string, number>();
  for (const play of chosen.values()) if (play.player.playerClass === "goalie") {
    if (play.forecast?.confirmedStart) confirmed++;
    const probability = play.forecast?.confirmedStart ? 1 : play.forecast?.startProbability;
    const key = `${play.game.id}:${play.player.teamAbbreviation}`;
    if (finite(probability)) goalieByTeamGame.set(key, Math.min(1, (goalieByTeamGame.get(key) ?? 0) + probability));
    else if (!minimumAlreadyMet) projected = null;
  }
  if (minimum.counts === "appearances" && minimum.required !== null) {
    if (!minimumAlreadyMet) { projected = null; limitations.add("Appearance probabilities are unavailable; starter probabilities cannot verify this goalie minimum."); }
  } else if (finite(projected)) projected += [...goalieByTeamGame.values()].reduce((sum, value) => sum + value, 0);
  if (!minimumWindowVerified && minimum.required !== null) projected = null;
  const risk = minimum.required !== null && (projected === null || projected < minimum.required);
  if (risk && intent.goalieCoverage === "cover") limitations.add("Goalie minimum coverage is not verified.");
  if (minimum.required !== null && intent.goalieCoverage === "cover" && intent.goalieWindow !== "any") {
    const available = games.some(game => preferredGoalieDate(game.date, intent) && snapshot.players.some(player => player.playerClass === "goalie" && player.teamAbbreviation === game.teamAbbreviation &&
      (snapshot.roster.some(entry => entry.playerId === player.id) || ["free_agent", "manager_available", "waivers"].includes(player.availability)) &&
      (forecasts.get(`${player.id}:${game.id}`)?.confirmedStart || (forecasts.get(`${player.id}:${game.id}`)?.startProbability ?? 0) > 0)));
    if (!available) limitations.add("Preferred goalie coverage window has no verified usable start; coverage is infeasible with current evidence.");
    else if (![...chosen.values()].some(play => play.player.playerClass === "goalie" && preferredGoalieDate(play.game.date, intent))) limitations.add("This plan does not cover the preferred goalie window.");
  }
  if (minimum.required !== null && (minimum.counts === "unknown" || minimum.penalty === "unknown")) limitations.add("Goalie minimum semantics are incomplete.");
  if (risk && minimum.penalty === "lose_goalie_categories" && snapshot.rules.scoring.mode === "categories") { projectedValue = null; limitations.add("Goalie-category forfeiture risk makes the matchup projection incomplete."); }
  return { objective, steps, legal: timeline.legal && !invalidLocks && !weeklyEvidenceMissing && snapshot.rules.lineupMode !== "unsupported" && (snapshot.rules.lineupMode !== "weekly" || dates.every(date => !!lineupPeriodForDate(date)?.lockAt)) && !slotDiagnostics.some(item => item.severity === "error"), budgetVerified: timeline.budgetVerified,
    assignments, scheduledGames, activeGames: assignments.length, benchGames: Math.max(0, scheduledGames - assignments.length), projectedValue, projectedStats: stats,
    categoryResults, goalie: { credited: minimum.credited, confirmed, projected, required: minimum.required, risk }, acquisitions: { ...timeline.acquisitions }, limitations: [...limitations] };
}

function compareEvaluations(a: PlanEvaluation, b: PlanEvaluation, intent: PlanIntent, preferred: PlanningObjective): number {
  if (a.objective !== b.objective) return a.objective === preferred ? -1 : 1;
  if (intent.goalieCoverage === "cover" && a.goalie.risk !== b.goalie.risk) return a.goalie.risk ? 1 : -1;
  if (a.objective === "agp" && a.activeGames !== b.activeGames) return b.activeGames - a.activeGames;
  if ((a.projectedValue ?? -Infinity) !== (b.projectedValue ?? -Infinity)) return (b.projectedValue ?? -Infinity) - (a.projectedValue ?? -Infinity);
  if (a.activeGames !== b.activeGames) return b.activeGames - a.activeGames;
  if (intent.goalieCoverage === "cover" && intent.goalieWindow !== "any") {
    const preferredCount = (evaluation: PlanEvaluation) => evaluation.assignments.filter(row => row.slotId.startsWith("G#") && preferredGoalieDate(row.date, intent)).length;
    return preferredCount(b) - preferredCount(a);
  }
  return 0;
}
function safeAlternative(snapshot: PlanningSnapshot, baseline: PlanEvaluation, evaluation: PlanEvaluation): boolean {
  const hasDrop = evaluation.steps.some(step => !!step.dropPlayerId || step.type === "drop");
  if (!hasDrop && evaluation.objective === "agp" && evaluation.activeGames > baseline.activeGames &&
    (baseline.projectedValue === null || evaluation.projectedValue === null || evaluation.projectedValue >= baseline.projectedValue)) return true;
  if (baseline.projectedValue === null || evaluation.projectedValue === null || evaluation.projectedValue < baseline.projectedValue) return false;
  if (evaluation.projectedValue === baseline.projectedValue && evaluation.activeGames <= baseline.activeGames && !(baseline.goalie.risk && !evaluation.goalie.risk)) return false;
  for (const step of evaluation.steps) if (step.dropPlayerId) {
    if (evaluation.activeGames < baseline.activeGames) return false;
    const added = snapshot.players.find(player => player.id === step.playerId);
    const dropped = snapshot.players.find(player => player.id === step.dropPlayerId);
    if (!added || !dropped) return false;
    if (finite(added.holdValue) && finite(dropped.holdValue) && added.holdValue < dropped.holdValue) return false;
  }
  return true;
}
/** Marginal lineup capacity only: one hypothetical extra roster place, no acquisition/drop claim. */
export function scheduleFits(snapshot: PlanningSnapshot, intent: PlanIntent, baseline: PlanEvaluation, budgetMs = Infinity) {
  const started = Date.now();
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  const groups = new Map<string, PlanningPlayer[]>();
  const teams = new Set(snapshot.games.filter(game => game.status === "scheduled" && eligibleGame(game, snapshot)).map(game => game.teamAbbreviation));
  for (const player of snapshot.players) {
    if (owned.has(player.id) || intent.excludedPlayerIds.includes(player.id) || !player.teamAbbreviation || !teams.has(player.teamAbbreviation) || player.availability === "rostered" || !player.eligiblePositions.length) continue;
    const key = `${player.teamAbbreviation}:${[...player.eligiblePositions].sort().join(",")}`;
    groups.set(key, [...(groups.get(key) ?? []), player]);
  }
  const fits: NonNullable<PlanningResult["scheduleFits"]> = [];
  let complete = true;
  for (const candidates of groups.values()) {
    if (Date.now() - started >= budgetMs) { complete = false; break; }
    const player = candidates[0];
    const hypothetical = { ...snapshot, roster: [...snapshot.roster, { playerId: player.id, position: "bench" as const }],
      rules: { ...snapshot.rules, rosterSlots: { ...snapshot.rules.rosterSlots, BN: (snapshot.rules.rosterSlots.BN ?? 0) + 1 } } };
    const evaluation = evaluatePlan(hypothetical, { ...intent, goalieCoverage: "accept_risk" }, "agp", []);
    const addedGames = evaluation.activeGames - baseline.activeGames;
    if (addedGames <= 0) continue;
    const dates = [...new Set(evaluation.assignments.map(row => row.date))].filter(date => evaluation.assignments.filter(row => row.date === date).length > baseline.assignments.filter(row => row.date === date).length);
    fits.push({ teamAbbreviation: player.teamAbbreviation!, positions: [...player.eligiblePositions], playerIds: candidates.map(row => row.id), addedGames, dates });
  }
  fits.sort((a, b) => b.addedGames - a.addedGames || a.teamAbbreviation.localeCompare(b.teamAbbreviation) || a.positions.join(",").localeCompare(b.positions.join(",")));
  return { fits, complete };
}

function shortlist(snapshot: PlanningSnapshot, intent: PlanIntent, limit: number, fits: NonNullable<PlanningResult["scheduleFits"]>): PlanningPlayer[] {
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  const games = snapshot.games.filter(game => game.status === "scheduled" && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot));
  const forecasted = new Set(snapshot.forecasts.map(item => `${item.playerId}:${item.gameId}`));
  const candidates = snapshot.players.filter(player => !owned.has(player.id) && !intent.excludedPlayerIds.includes(player.id) && ["free_agent", "manager_available", "waivers"].includes(player.availability));
  const fitScores = new Map(fits.flatMap(fit => fit.playerIds.map(id => [id, fit.addedGames] as const)));
  const sorted = candidates.map(player => ({ player, coverage: games.filter(game => game.teamAbbreviation === player.teamAbbreviation && forecasted.has(`${player.id}:${game.id}`)).length }))
    .sort((a, b) => (fitScores.get(b.player.id) ?? 0) - (fitScores.get(a.player.id) ?? 0) || b.coverage - a.coverage || a.player.id.localeCompare(b.player.id));
  const selected: PlanningPlayer[] = [], used = new Set<string>();
  for (const label of ["G", "C", "LW", "RW", "D", ...new Set(games.map(game => game.date))]) {
    const item = sorted.find(({ player }) => !used.has(player.id) && (label.match(/^\d{4}-/) ? games.some(game => game.date === label && game.teamAbbreviation === player.teamAbbreviation) : player.eligiblePositions.includes(label)));
    if (item && selected.length < limit) { selected.push(item.player); used.add(item.player.id); }
  }
  for (const item of sorted) if (selected.length < limit && !used.has(item.player.id)) { selected.push(item.player); used.add(item.player.id); }
  return selected;
}
function* extensions(snapshot: PlanningSnapshot, intent: PlanIntent, prior: PlanStep[], candidates: PlanningPlayer[]): Generator<PlanStep[]> {
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  for (const step of prior) {
    if (step.dropPlayerId) owned.delete(step.dropPlayerId);
    if (step.type === "add") owned.add(step.playerId);
    if (step.type === "drop") owned.delete(step.playerId);
  }
  const dates = [...new Set(snapshot.games.filter(game => game.status === "scheduled" && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot)).map(game => game.date))].sort();
  const drops = snapshot.players.filter(player => owned.has(player.id) && player.canDrop === true && !intent.protectedPlayerIds.includes(player.id))
    .sort((a, b) => (a.holdValue ?? 0) - (b.holdValue ?? 0) || a.id.localeCompare(b.id));
  const proposals: Array<{ player: PlanningPlayer; date: string; step: PlanStep }> = [];
  const useful = candidates.map(player => ({ player, dates: owned.has(player.id) ? [] : dates.filter(date => snapshot.games.some(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation)) }));
  const maxDates = Math.max(0, ...useful.map(item => item.dates.length));
  for (let dateIndex = 0; dateIndex < maxDates; dateIndex++) for (const { player, dates: playerDates } of useful) {
    const date = playerDates[dateIndex];
    if (!date) continue;
    const actionDate = snapshot.rules.acquisitionTiming === "next_day"
      ? new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : date;
    let at = zonedMidnight(actionDate, snapshot.context.timeZone);
    if (time(at) < time(snapshot.context.asOf)) at = snapshot.context.asOf;
    if (prior.length && time(at) < time(prior[prior.length - 1].effectiveAt)) continue;
    let effectiveAt = snapshot.rules.acquisitionTiming === "next_day" ? zonedMidnight(date, snapshot.context.timeZone) : at;
    if (snapshot.rules.acquisitionTiming === "next_day" && localDate(at, snapshot.context.timeZone) >= date) continue;
    if (player.availability === "waivers" && player.waiverClearsAt && time(player.waiverClearsAt) > time(effectiveAt)) effectiveAt = player.waiverClearsAt;
    const step: PlanStep = { id: `add:${player.id}:${prior.length}:${date}`, type: "add", playerId: player.id, at, effectiveAt,
      conditional: player.availability === "waivers" || time(at) > time(snapshot.context.asOf), dependsOn: prior.length ? [prior[prior.length - 1].id] : [] };
    proposals.push({ player, date, step });
  }
  // Give every candidate/date a chance before expanding the long tail of drop choices.
  for (const { player, date, step } of proposals) {
    yield [step];
    for (const drop of drops.slice(0, 2)) if (drop.id !== player.id) yield [{ ...step, id: `${step.id}:drop:${drop.id}`, dropPlayerId: drop.id }];
    for (const entry of snapshot.roster) {
      const reservePlayer = snapshot.players.find(item => item.id === entry.playerId);
      if (!reservePlayer || !owned.has(entry.playerId) || ["IR", "IR+", "NA"].includes(entry.position)) continue;
      for (const position of reservePlayer.reserveEligibility) if (snapshot.rules.rosterSlots[position]) {
        const prerequisite: PlanStep = { id: `reserve:${entry.playerId}:${prior.length}:${date}`, type: "reserve", playerId: entry.playerId, reservePosition: position, at: step.at, effectiveAt: step.at, conditional: false, dependsOn: step.dependsOn };
        yield [prerequisite, { ...step, dependsOn: [prerequisite.id] }];
      }
    }
  }
  for (const { player, step } of proposals) for (const drop of drops.slice(2)) if (drop.id !== player.id)
    yield [{ ...step, id: `${step.id}:drop:${drop.id}`, dropPlayerId: drop.id }];
}

/** Synchronous and serializable; terminate the owning Worker to cancel a running search. */
export function planRoster(snapshot: PlanningSnapshot, intent: PlanIntent, options: PlanningSearchOptions = {}): PlanningResult {
  const start = Date.now();
  const maxEvaluations = Math.max(3, options.maxEvaluations ?? 250);
  const beamWidth = Math.max(2, options.beamWidth ?? 8);
  const maxCandidates = Math.max(1, options.maxCandidates ?? 40);
  const maxSteps = Math.max(0, options.maxSteps ?? 4);
  const timeBudgetMs = Math.max(1, options.timeBudgetMs ?? 2000);
  const noMoveAgp = evaluatePlan(snapshot, intent, "agp", []);
  const noMoveOutcome = evaluatePlan(snapshot, intent, "outcome", []);
  const objective: PlanningObjective = noMoveOutcome.projectedValue !== null ? "outcome" : "agp";
  const baseline = objective === "outcome" ? noMoveOutcome : noMoveAgp;
  const selected = evaluatePlan(snapshot, intent, objective);
  const noClaimContinuations = intent.steps.flatMap((step, index) => {
    if (step.type !== "add" || !step.conditional) return [];
    const prefix = intent.steps.slice(0, index);
    const evaluation = evaluatePlan(snapshot, intent, objective, prefix);
    return evaluation.legal && evaluation.budgetVerified ? [{ claimStepId: step.id, evaluation }] : [];
  });
  const fitResult = scheduleFits(snapshot, intent, noMoveAgp, Math.min(500, timeBudgetMs / 3));
  const candidates = shortlist(snapshot, intent, maxCandidates, fitResult.fits);
  const limitations = new Set<string>();
  if (!fitResult.complete) limitations.add("Schedule-fit analysis reached its time budget; additional team/position targets remain unevaluated.");
  if (snapshot.rules.acquisitionTiming === "unknown") limitations.add("Add/drop plans need acquisition-effective timing. Review League rules and scoring.");
  if (snapshot.rules.acquisitionCost === null || !snapshot.rules.periods.length || snapshot.rules.periods.some(period => period.remaining === null)) limitations.add("Add/drop plans need acquisition cost and remaining allowance for every affected period. Review Scoring, budgets, and lock windows.");
  if (baseline.projectedValue === null) limitations.add("Safe drop recommendations need game-level contribution forecasts. Schedule-fit targets remain available, but are not verified add/drop plans.");
  const availableCount = snapshot.players.filter(player => ["free_agent", "manager_available", "waivers"].includes(player.availability)).length;
  const coverageComplete = candidates.length >= availableCount;
  if (!coverageComplete) limitations.add(`Candidate shortlist contains ${candidates.length} of ${availableCount} available players.`);
  type State = { steps: PlanStep[]; evaluation: PlanEvaluation };
  const noMoves: Record<PlanningObjective, State> = { agp: { steps: [], evaluation: noMoveAgp }, outcome: { steps: [], evaluation: noMoveOutcome } };
  const frontiers: Record<PlanningObjective, State[]> = { agp: [noMoves.agp], outcome: [noMoves.outcome] };
  let evaluated = 3, generated = 0, maxDepthReached = 0, complete = true, beamPruned = false, phasePruned = false;
  const phaseBudget = maxSteps ? Math.max(1, Math.floor((maxEvaluations - evaluated) / (maxSteps * 2))) : 0;
  const all: State[] = [], seen = new Set(["agp:", "outcome:"]);
  for (let depth = 0; depth < maxSteps; depth++) {
    let anyNext = false;
    for (const searchObjective of ["agp", "outcome"] as const) {
      const next: State[] = [];
      let phaseEvaluated = 0;
      for (const state of frontiers[searchObjective]) {
        if (depth > 0 && state.steps.length === 0) continue;
        for (const addition of extensions(snapshot, intent, state.steps, candidates)) {
          generated++;
          const steps = [...state.steps, ...addition];
          const key = `${searchObjective}:` + steps.map(step => `${step.type}:${step.playerId}:${step.dropPlayerId ?? ""}:${step.reservePosition ?? ""}:${step.effectiveAt}`).join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const evaluation = evaluatePlan(snapshot, intent, searchObjective, steps);
          evaluated++;
          phaseEvaluated++;
          if (evaluation.legal && evaluation.budgetVerified) {
            const candidate = { steps, evaluation }; next.push(candidate); all.push(candidate);
            maxDepthReached = Math.max(maxDepthReached, steps.filter(step => step.type === "add").length);
          }
          if (evaluated >= maxEvaluations || Date.now() - start >= timeBudgetMs) { complete = false; break; }
          if (phaseEvaluated >= phaseBudget) { phasePruned = true; break; }
        }
        if (!complete || phaseEvaluated >= phaseBudget) break;
      }
      if (!complete) break;
      next.sort((a, b) => compareEvaluations(a.evaluation, b.evaluation, intent, searchObjective) || a.steps.length - b.steps.length);
      if (next.length) anyNext = true;
      if (next.length > beamWidth - 1) beamPruned = true;
      frontiers[searchObjective] = [noMoves[searchObjective], ...next.slice(0, beamWidth - 1)];
    }
    if (!complete || !anyNext) break;
  }
  if (!complete) limitations.add("Search budget exhausted; plans are best found in the evaluated search, not proven optimal.");
  if (phasePruned) limitations.add("Per-depth sampling left candidate transitions unexplored.");
  if (beamPruned) limitations.add("Beam width pruned feasible plans; search is incomplete.");
  const depthPruned = maxSteps === 0 ? candidates.length > 0 : (["agp", "outcome"] as const).some(searchObjective => frontiers[searchObjective].slice(1).some(state => !extensions(snapshot, intent, state.steps, candidates).next().done));
  if (depthPruned) limitations.add("Acquisition depth limit left additional sequences unexplored.");
  if (snapshot.rules.scoring.mode === "categories") limitations.add("Category alternatives use projected means without calibrated joint scenarios.");
  all.sort((a, b) => compareEvaluations(a.evaluation, b.evaluation, intent, objective) || a.steps.length - b.steps.length);
  const alternatives = [baseline, ...all.filter(state => state.steps.length && safeAlternative(snapshot, state.evaluation.objective === "agp" ? noMoveAgp : noMoveOutcome, state.evaluation)).map(state => state.evaluation)].slice(0, intent.alternativeCount);
  return { snapshotId: snapshot.id, intentRevision: intent.revision, baseline, noMoveAgp, noMoveOutcome, selected, alternatives, noClaimContinuations, scheduleFits: fitResult.fits,
    search: { evaluated, candidates: generated, maxDepthReached, complete: complete && fitResult.complete && !phasePruned && coverageComplete && !beamPruned && !depthPruned, elapsedMs: Date.now() - start, limitations: [...limitations] } };
}
