import { weightedAssignment } from "../projections/weightedAssignment";
import { resolvePlanningContributions } from "../player-forecasts/planningContributions";
import { summarizeContributionCoverage, type ResolvedContribution } from "../player-forecasts/contributions";
import { lineupPeriodAtDate, localDate, zonedMidnight } from "./planningDates";
import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { expandActiveSlots } from "./slots";
import { acquisitionEffectiveAt, buildTimeline } from "./planningTimeline";
import { deferBenchDecisions, explainBenchDecisions, reserveBenchEvaluation, type BenchEvaluationBudget } from "./benchDecisions";
import type { ContributionPlanningSnapshot, ForecastExclusionReason, ForecastOpportunityExclusion, GameForecast, PlanEvaluation, PlanIntent, PlanStep, PlanningAssignment, PlanningGame, PlanningObjective, PlanningPlayer, PlanningResult, PlanningSnapshot, ScoringCategory, StatLine } from "./planningTypes";

export type PlanningSearchOptions = { maxEvaluations?: number; beamWidth?: number; maxCandidates?: number; maxSteps?: number; timeBudgetMs?: number; maxBenchEvaluations?: number };
type Play = { player: PlanningPlayer; game: PlanningGame; forecast: GameForecast | null; gamesCount?: number };
const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);
type CoverageIssue = NonNullable<PlanEvaluation["recommendation"]>["unresolved"][number];
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stableValue(item)]));
  return value;
}
function conflictFingerprint(value: unknown): string {
  let hash = 0;
  for (const char of JSON.stringify(stableValue(value))) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}
export function sanitizeForecastInputs<T extends ContributionPlanningSnapshot>(snapshot: T): T {
  const groups = new Map<string, GameForecast[]>();
  for (const forecast of snapshot.forecasts) {
    const key = `${forecast.playerId}:${forecast.gameId}`;
    groups.set(key, [...(groups.get(key) ?? []), forecast]);
  }
  const forecasts: GameForecast[] = [];
  const conflicts = [...(snapshot.forecastInputExclusions ?? [])];
  for (const [, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (rows.length > 1 && new Set(rows.map(row => JSON.stringify(stableValue(row)))).size > 1) {
      const row = rows[0];
      if (!conflicts.some(item => item.gameId === row.gameId && item.playerId === row.playerId
        && item.reasons.includes("conflicting_forecast"))) conflicts.push({ gameId: row.gameId,
        playerId: row.playerId, reasons: ["conflicting_forecast"] });
    } else forecasts.push(rows[0]);
  }
  if (forecasts.length === snapshot.forecasts.length && conflicts.length === (snapshot.forecastInputExclusions?.length ?? 0)) return snapshot;
  return { ...snapshot, forecasts, forecastInputExclusions: conflicts.sort((a, b) =>
    a.gameId.localeCompare(b.gameId) || (a.playerId ?? "").localeCompare(b.playerId ?? "")) };
}
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
/** A native-unit partial order, never a cross-category utility or global rank. */
function categoryRelation(a: Array<number | null>, b: Array<number | null>, categories: ScoringCategory[]) {
  if (!categories.length || a.length !== categories.length || b.length !== categories.length
    || !a.every(finite) || !b.every(finite)) return "unknown";
  let better = false, worse = false;
  categories.forEach((category, index) => {
    if (a[index] === b[index]) return;
    if (category.direction === "higher" ? a[index]! > b[index]! : a[index]! < b[index]!) better = true;
    else worse = true;
  });
  return better && worse ? "tradeoff" : better ? "better" : worse ? "worse" : "equal";
}
function opponentStats(snapshot: PlanningSnapshot): StatLine | null {
  if (!snapshot.opponent || snapshot.opponent.remaining === null) return null;
  const stats: StatLine = { ...snapshot.opponent.realized };
  for (const [key, value] of Object.entries(snapshot.opponent.remaining ?? {})) stats[key] = finite(value) && finite(stats[key]) ? stats[key]! + value : null;
  return stats;
}
type Applicability = Record<"skater" | "goalie", Set<string>>;
const GOALIE_STATS = new Set(["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES", "SAVES", "GOALSAGAINST", "SHOTSAGAINST", "WINS", "SHUTOUTS", "GAA", "SV%", "SAVE_PERCENTAGE"]);
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
export function forecastAllows(forecast: GameForecast | null, key: string, use: "assignment" | "totals" | "comparison" | "conditionalTieBreak"): boolean {
  if (use !== "conditionalTieBreak" && forecast?.conditioning !== "unconditional") return false;
  return (forecast?.contributions ? forecast.contributions[key]?.allowedUses[use] : forecast?.allowedUses?.[use]) === true;
}
export function assignmentStats(forecast: GameForecast): StatLine {
  return forecast.assignmentStats ?? forecast.stats;
}
/** Supported remaining points on a player's selected assignments, excluding banked results. */
export function playerAssignedPoints(snapshot: PlanningSnapshot, evaluation: PlanEvaluation, playerId: string): number | null {
  const player = snapshot.players.find(row => row.id === playerId);
  if (!player?.eligibilityVerified || !evaluation.legal || !evaluation.comparisonEligible
    || !finite(evaluation.projectedValue) || snapshot.rules.scoring.mode !== "points") return null;
  const forecasts = evaluation.forecastInputs ?? [];
  const applicability = statApplicability({ ...snapshot, forecasts });
  const weights = Object.entries(snapshot.rules.scoring.weights)
    .filter(([key, weight]) => weight !== 0 && applies(key, player.playerClass, applicability));
  if (!weights.length || weights.some(([, weight]) => !finite(weight))) return null;
  let total = 0;
  for (const assignment of evaluation.assignments.filter(row => row.playerId === playerId)) {
    const rows = forecasts.filter(row => row.playerId === playerId && row.gameId === assignment.gameId);
    if (rows.length !== 1) return null;
    for (const [key, weight] of weights) {
      const forecast = rows[0];
      if (!forecastAllows(forecast, key, "totals") || !forecastAllows(forecast, key, "comparison")
        || !finite(forecast.stats[key])) return null;
      total += forecast.stats[key]! * weight;
    }
  }
  return finite(total) ? total : null;
}
/** Candidate horizon totals are separate from incremental active-game capacity.
 * Use the same source validation, stat applicability and permissions as plans. */
export function candidateHorizonPoints(input: PlanningSnapshot): Map<string, number | null> {
  const snapshot = sanitizeForecastInputs(resolvePlanningContributions(sanitizeForecastInputs(input)));
  const applicability = statApplicability(snapshot);
  const forecasts = new Map(snapshot.forecasts.map(row => [`${row.playerId}:${row.gameId}`, row]));
  const points = new Map<string, number | null>();
  for (const player of snapshot.players) {
    const weights = Object.entries(snapshot.rules.scoring.weights).filter(([key, weight]) => weight !== 0 && applies(key, player.playerClass, applicability));
    const games = snapshot.games.filter(game => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled"
      && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot));
    let value = 0;
    const eligibility = normalizeEligibility(player.eligiblePositions);
    let complete = snapshot.rules.scoring.mode === "points" && player.eligibilityVerified === true
      && eligibility.valid && eligibility.playerClass === player.playerClass && games.length > 0
      && weights.length > 0 && weights.every(([, weight]) => Number.isFinite(weight));
    for (const game of games) {
      const forecast = forecasts.get(`${player.id}:${game.id}`) ?? null;
      for (const [key, weight] of weights) {
        if (forecast?.conditioning !== "unconditional" || !forecastAllows(forecast, key, "totals")
          || !forecastAllows(forecast, key, "comparison") || !finite(forecast.stats[key])) { complete = false; continue; }
        value += forecast.stats[key]! * weight;
      }
    }
    points.set(player.id, complete && Number.isFinite(value) ? value : null);
  }
  return points;
}
/** A hypothetical extra roster place, not an executable acquisition or optimal plan.
 * Reuse the complete-plan objective so bench capacity and displaced points count. */
export function candidateActivePoints(input: PlanningSnapshot, intent: PlanIntent,
  horizonPoints = candidateHorizonPoints(input)): Map<string, number | null> {
  const points = new Map(input.players.map(player => [player.id, null as number | null]));
  if (input.rules.scoring.mode !== "points") return points;
  const prepared = prepareEvaluation(input);
  const baseline = evaluatePreparedPlan(prepared, intent, "outcome", [], false);
  if (!baseline.comparisonEligible || baseline.projectedValue === null) return points;
  const owned = new Set(input.roster.map(row => row.playerId));
  for (const player of input.players) {
    if (owned.has(player.id) || player.availability === "rostered" || intent.excludedPlayerIds.includes(player.id)
      || horizonPoints.get(player.id) == null) continue;
    const hypothetical = { ...prepared.snapshot, roster: [...input.roster, { playerId: player.id, position: "bench" as const }],
      rules: { ...input.rules, rosterSlots: { ...input.rules.rosterSlots, BN: (input.rules.rosterSlots.BN ?? 0) + 1 } } };
    const evaluation = evaluatePreparedPlan({ ...prepared, snapshot: hypothetical }, intent, "outcome", [], false);
    if (evaluation.comparisonEligible && evaluation.projectedValue !== null) {
      points.set(player.id, evaluation.projectedValue - baseline.projectedValue);
    }
  }
  return points;
}
function playValue(play: Play, snapshot: PlanningSnapshot, opponent: StatLine | null, applicability: Applicability): number | null {
  if (play.player.eligibilityVerified !== true || !play.forecast || play.forecast.conditioning !== "unconditional") return null;
  const stats = assignmentStats(play.forecast);
  if (snapshot.rules.scoring.mode === "points") {
    const weights = Object.entries(snapshot.rules.scoring.weights).filter(([key, weight]) => weight !== 0 && applies(key, play.player.playerClass, applicability));
    if (!Object.keys(snapshot.rules.scoring.weights).length || weights.some(([key]) => !forecastAllows(play.forecast, key, "assignment") || !finite(stats[key]))) return null;
    return weights.reduce((sum, [key, weight]) => sum + stats[key]! * weight, 0);
  }
  if (!opponent) return null;
  for (const category of snapshot.rules.scoring.categories) {
    if (!applies(category.numerator ?? category.key, play.player.playerClass, applicability)) continue;
    const target = categoryValue(opponent, category);
    const numerator = stats[category.numerator ?? category.key];
    const denominator = category.denominator ? stats[category.denominator] : 1;
    if (!forecastAllows(play.forecast, category.numerator ?? category.key, "assignment")
      || category.denominator && !forecastAllows(play.forecast, category.denominator, "assignment")
      || !finite(target) || !finite(numerator) || !finite(denominator)) return null;
  }
  // Category forecasts establish supported inputs, not an additive utility.
  // Assignment starts from neutral capacity; complete lineups compare below.
  return 0;
}
function scoringTargets(snapshot: PlanningSnapshot, play: Play, applicability: Applicability): string[] {
  const keys = snapshot.rules.scoring.mode === "points"
    ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key)
    : snapshot.rules.scoring.categories.flatMap(category => [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]);
  return [...new Set(keys)].filter(key => applies(key, play.player.playerClass, applicability));
}
function competitorCoverage(snapshot: PlanningSnapshot, playsByDate: Map<string, Play[]>, applicability: Applicability) {
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const plays = [...playsByDate.entries()].flatMap(([date, daily]) => {
    const locks = snapshot.lockedAssignments.filter(lock => lock.date === date);
    const openSlots = slots.filter(slot => !locks.some(lock => lock.slotId === slot.id));
    return daily.filter(play => !locks.some(lock => lock.playerId === play.player.id && lock.slotId === null)
      && (locks.some(lock => lock.playerId === play.player.id && lock.slotId !== null)
        || openSlots.some(slot => canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type))));
  });
  const resolved = new Map<string, ResolvedContribution>();
  const resolvedConflicts = new Set<string>();
  for (const play of plays) for (const target of scoringTargets(snapshot, play, applicability)) {
    const contribution = play.forecast?.contributions?.[target];
    if (!contribution) continue;
    const key = `${contribution.game.seasonId}:${contribution.game.gameId}:${contribution.game.playerId}:${target}`;
    const previous = resolved.get(key);
    if (previous && JSON.stringify(stableValue(previous)) !== JSON.stringify(stableValue(contribution))) {
      resolvedConflicts.add(key);
      resolved.delete(key);
    } else if (!resolvedConflicts.has(key)) resolved.set(key, contribution);
  }
  const sourceCoverage = summarizeContributionCoverage([...resolved.values()].map(row => ({ game: row.game, targetKey: row.targetKey })), [...resolved.values()]);
  const sourceExclusions = new Map(sourceCoverage.exclusions.map(row =>
    [`${row.gameId}:${row.playerId}:${row.targetKey}`, row.reasons]));
  const manifest = [...(snapshot.forecastManifest?.exclusions ?? []), ...(snapshot.forecastInputExclusions ?? [])];
  const exclusions: ForecastOpportunityExclusion[] = [];
  let requiredCount = 0, assignmentEligibleCount = 0, totalsEligibleCount = 0, comparisonEligibleCount = 0;
  const seen = new Set<string>();
  for (const play of plays) for (const targetKey of scoringTargets(snapshot, play, applicability)) {
    const identity = `${play.player.id}:${play.game.id}:${targetKey}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    requiredCount++;
    const forecast = play.forecast;
    const contribution = forecast?.contributions?.[targetKey];
    const conflict = contribution ? resolvedConflicts.has(`${contribution.game.seasonId}:${contribution.game.gameId}:${contribution.game.playerId}:${targetKey}`) : false;
    const assignment = !conflict && play.player.eligibilityVerified === true && forecastAllows(forecast, targetKey, "assignment")
      && !!forecast && finite(assignmentStats(forecast)[targetKey]);
    const totals = !conflict && forecastAllows(forecast, targetKey, "totals") && !!forecast && finite(forecast.stats[targetKey]);
    const comparison = totals && forecastAllows(forecast, targetKey, "comparison");
    if (assignment) assignmentEligibleCount++;
    if (totals) totalsEligibleCount++;
    if (comparison) comparisonEligibleCount++;
    if (assignment && totals && comparison) continue;
    const reasons = new Set<ForecastExclusionReason>();
    if (conflict) reasons.add("conflicting_forecast");
    if (play.player.eligibilityVerified !== true) reasons.add("eligibility_unverified");
    for (const row of manifest) if (row.gameId === play.game.id && (!row.playerId || row.playerId === play.player.id)
      && (!row.targetKey || row.targetKey === targetKey)) row.reasons.forEach(reason => reasons.add(reason));
    if (forecast?.contributions?.[targetKey]) {
      const contribution = forecast.contributions[targetKey];
      contribution.exclusionReasons.forEach(reason => reasons.add(reason));
      sourceExclusions.get(`${contribution.game.gameId}:${contribution.game.playerId}:${targetKey}`)?.forEach(reason => reasons.add(reason));
    }
    if (!forecast) {
      if (snapshot.forecasts.some(row => row.playerId === play.player.id && row.gameId === play.game.id
        && ((row.expiresAt && Date.parse(row.expiresAt) <= Date.parse(snapshot.context.asOf))
          || row.limitations.some(limit => limit.includes("Forecast source is stale"))))) reasons.add("stale_source");
      if (!reasons.size) reasons.add("no_issued_revision");
    } else {
      if (forecast.limitations.some(limit => limit.includes("Forecast source is stale"))) reasons.add("stale_source");
      if (forecast.conditioning !== "unconditional") reasons.add("unsupported_conditioning");
      if (!finite(forecast.stats[targetKey]) && !finite(assignmentStats(forecast)[targetKey])) reasons.add("missing_target");
      if (!forecastAllows(forecast, targetKey, "assignment") || !forecastAllows(forecast, targetKey, "totals")
        || !forecastAllows(forecast, targetKey, "comparison")) reasons.add("use_not_approved");
    }
    if (!reasons.size) reasons.add("missing_target");
    exclusions.push({ playerId: play.player.id, gameId: play.game.id, targetKey, reasons: [...reasons].sort() });
  }
  return { requiredCount, assignmentEligibleCount, totalsEligibleCount, comparisonEligibleCount, exclusions };
}
function assign(snapshot: PlanningSnapshot, intent: PlanIntent, objective: PlanningObjective, plays: Play[], date: string, locked: Array<{ playerId: string; slotId: string | null }>, limitations: Set<string>, applicability: Applicability, unresolved: CoverageIssue[], allowNoGameLocks = false, forcePlayerId?: string): PlanningAssignment[] {
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
  const candidate = plays.filter(play => !fixed.has(play.player.id) && !benchLocked.has(play.player.id))
    .sort((a, b) => a.player.id.localeCompare(b.player.id) || a.game.id.localeCompare(b.game.id));
  if (!slots.length || !candidate.length) return output;
  const opponent = opponentStats(snapshot);
  const values = new Map(candidate.map(play => {
    const value = playValue(play, snapshot, opponent, applicability);
    if (play.player.eligibilityVerified !== true) limitations.add("League positional eligibility is unverified; review player evidence before using a quality recommendation.");
    if (value === null) limitations.add("Some scheduled games lack unconditional scoring forecasts; projected outcome is incomplete.");
    return [play, value] as const;
  }));
  // Unknown quality contaminates the whole competing slot component, including UTIL.
  // Keep legal schedule capacity in that component; never prefer a covered player
  // merely because an equally eligible competitor has no forecast.
  const compatible = new Map(candidate.map(play => [play, slots.filter(slot => canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type)).map(slot => slot.id)]));
  const unknown = new Set(candidate.filter(play => compatible.get(play)!.length && values.get(play) === null));
  for (const play of unknown) unresolved.push({ date, playerId: play.player.id, gameId: play.game.id,
    missingTargets: scoringTargets(snapshot, play, applicability).filter(key => play.player.eligibilityVerified !== true || play.forecast?.conditioning !== "unconditional" || !forecastAllows(play.forecast, key, "assignment") || !finite(play.forecast && assignmentStats(play.forecast)[key])) });
  const affectedSlots = new Set([...unknown].flatMap(play => compatible.get(play)!));
  let changed = true;
  while (changed) {
    changed = false;
    for (const play of candidate) if (!unknown.has(play) && compatible.get(play)!.some(id => affectedSlots.has(id))) {
      unknown.add(play);
      for (const id of compatible.get(play)!) affectedSlots.add(id);
      changed = true;
    }
  }
  const conditionalTies = new Map<Play, number>();
  const pending = new Set(unknown);
  while (pending.size) {
    const component = new Set<Play>([pending.values().next().value!]);
    const componentSlots = new Set([...component].flatMap(play => compatible.get(play)!));
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const play of pending) if (!component.has(play) && compatible.get(play)!.some(id => componentSlots.has(id))) {
        component.add(play); compatible.get(play)!.forEach(id => componentSlots.add(id)); expanded = true;
      }
    }
    for (const play of component) pending.delete(play);
    if (snapshot.rules.scoring.mode !== "points") continue;
    const conditional = [...component].map(play => {
      const stats = play.forecast?.tieBreakStats ?? play.forecast?.conditionalStats;
      const targets = scoringTargets(snapshot, play, applicability);
      return play.player.eligibilityVerified === true && play.player.playerClass === "skater" && stats && targets.length && targets.every(key => forecastAllows(play.forecast, key, "conditionalTieBreak") && finite(stats[key]))
        ? targets.reduce((sum, key) => sum + stats[key]! * snapshot.rules.scoring.weights[key], 0) : null;
    });
    if (conditional.some(value => value === null)) continue;
    const scale = 1 + conditional.reduce<number>((sum, value) => sum + Math.abs(value!), 0);
    [...component].forEach((play, index) => conditionalTies.set(play, conditional[index]! / scale * 0.5));
    limitations.add("Comparable conditional ability breaks schedule-capacity ties assuming participation; it does not establish projected totals or a start/sit recommendation.");
  }
  const agpBonus = 1 + [...values.values()].reduce<number>((sum, value) => sum + (finite(value) ? Math.abs(value) : 0), 0);
  for (const row of weightedAssignment(slots, candidate, (slot, play) => {
    if (!canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type)) return null;
    const value = unknown.has(play) ? (play.gamesCount ?? 1) * agpBonus + (conditionalTies.get(play) ?? 0)
      : objective === "agp" || snapshot.rules.scoring.mode === "categories" ? (play.gamesCount ?? 1) * agpBonus + (values.get(play) ?? 0)
        : values.get(play) === null ? null : values.get(play)!;
    return value === null ? null : value + (play.player.id === forcePlayerId ? agpBonus : 0);
  })) {
    if (row.playerIndex === null) continue;
    const play = candidate[row.playerIndex];
    output.push({ date, playerId: play.player.id, gameId: play.game.id, slotId: slots[row.slotIndex].id, locked: false });
  }
  return output;
}

function goalieMinimumWindowVerified(snapshot: PlanningSnapshot): boolean {
  const minimum = snapshot.rules.goalieMinimum;
  const lastDate = minimum.periodEnd && Number.isFinite(time(minimum.periodEnd))
    ? new Date(time(minimum.periodEnd) - 1).toISOString().slice(0, 10) : null;
  return !!minimum.periodStart && !!minimum.periodEnd && !!lastDate && snapshot.context.startDate >= minimum.periodStart.slice(0, 10)
    && snapshot.context.endDate >= lastDate && snapshot.context.endDate < minimum.periodEnd.slice(0, 10);
}
function pointsGoalieCoverageTarget(snapshot: PlanningSnapshot, intent: PlanIntent): number | null {
  const minimum = snapshot.rules.goalieMinimum;
  return snapshot.rules.scoring.mode === "points" && intent.goalieCoverage === "cover"
    && minimum.counts === "starts" && finite(minimum.required) && finite(minimum.credited)
    && minimum.credited < minimum.required && goalieMinimumWindowVerified(snapshot) ? minimum.required : null;
}
function categoryGoalieCoverageTarget(snapshot: PlanningSnapshot, intent: PlanIntent): number | null {
  const minimum = snapshot.rules.goalieMinimum;
  return snapshot.rules.scoring.mode === "categories" && intent.goalieCoverage === "cover"
    && minimum.counts === "starts" && finite(minimum.required) && finite(minimum.credited)
    && minimum.credited < minimum.required && goalieMinimumWindowVerified(snapshot) ? minimum.required : null;
}

/** Compare complete category or points-goalie lineups; local moves remain bounded. */
function refineOutcomeLineup(
  snapshot: PlanningSnapshot, intent: PlanIntent, seed: PlanningAssignment[],
  playsByDate: Map<string, Play[]>, windowByDate: Map<string, string>, weeklyCandidates: Map<string, Play[]>,
  forecasts: Map<string, GameForecast>, opponent: StatLine | null, applicability: Applicability, limitations: Set<string>,
  pointsCoverageTarget: number | null, objective: PlanningObjective,
): PlanningAssignment[] {
  const points = snapshot.rules.scoring.mode === "points";
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots.filter(slot => !points || slot.type === "G");
  const playByKey = new Map([...playsByDate.values()].flat().map(play => [`${play.player.id}:${play.game.id}`, play]));
  const needed = new Set(points ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key)
    : snapshot.rules.scoring.categories.flatMap(category => [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]));
  const categoryCoverageTarget = categoryGoalieCoverageTarget(snapshot, intent);
  const invalid = { value: -Infinity, coverage: -Infinity, capacity: -Infinity, categories: null as Array<number | null> | null };
  const score = (rows: PlanningAssignment[]) => {
    const stats: StatLine = { ...snapshot.realized };
    const goalieGroups = new Map<string, number>();
    for (const row of rows) {
      const play = playByKey.get(`${row.playerId}:${row.gameId}`);
      // A locked row with no plannable play is a game already under way: it holds its slot but adds nothing.
      if (!play && row.locked) continue;
      const forecast = forecasts.get(`${row.playerId}:${row.gameId}`);
      if (!play || play.player.eligibilityVerified !== true || !forecast || forecast.conditioning !== "unconditional") return invalid;
      for (const key of needed) {
        if (!applies(key, play.player.playerClass, applicability)) continue;
        const value = assignmentStats(forecast)[key];
        if (!forecastAllows(forecast, key, "assignment") || !finite(value)) return invalid;
        stats[key] = (stats[key] ?? 0)! + value;
      }
      if (play.player.playerClass === "goalie" && (points ? pointsCoverageTarget : categoryCoverageTarget) !== null) {
        const probability = forecast.confirmedStart ? 1 : forecast.startProbability;
        if (!finite(probability)) return invalid;
        const key = `${play.game.id}:${play.player.teamAbbreviation}`;
        goalieGroups.set(key, Math.min(1, (goalieGroups.get(key) ?? 0) + probability));
      }
    }
    const credited = snapshot.rules.goalieMinimum.credited;
    const projected = finite(credited) ? credited + [...goalieGroups.values()].reduce((sum, value) => sum + value, 0) : null;
    if (points) return { value: [...needed].reduce((sum, key) => sum + (stats[key] ?? 0)! * snapshot.rules.scoring.weights[key], 0),
      coverage: Math.min(pointsCoverageTarget!, projected!), capacity: rows.length, categories: null };
    const categories = snapshot.rules.scoring.categories.map(category => categoryValue(stats, category));
    if (!categories.length || !categories.every(finite)
      || snapshot.rules.scoring.categories.some(category => !finite(categoryValue(opponent!, category)))) return invalid;
    return { value: 0, coverage: categoryCoverageTarget === null ? 0 : Math.min(categoryCoverageTarget, projected!),
      capacity: rows.length, categories };
  };
  const compare = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) => {
    if (points) return a.coverage !== b.coverage ? a.coverage > b.coverage ? 1 : -1 : a.value === b.value ? 0 : a.value > b.value ? 1 : -1;
    if (!a.categories || !b.categories) return 0;
    if (a.coverage !== b.coverage) return a.coverage > b.coverage ? 1 : -1;
    if (objective === "agp" && a.capacity !== b.capacity) return a.capacity > b.capacity ? 1 : -1;
    const relation = categoryRelation(a.categories, b.categories, snapshot.rules.scoring.categories);
    return relation === "better" ? 1 : relation === "worse" ? -1 : 0;
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
    const next: Array<{ rows: PlanningAssignment[]; value: ReturnType<typeof score> }> = [];
    for (const rows of frontier) {
      if (evaluated >= 100) break;
      for (const candidate of neighbors(rows)) {
        const identity = key(candidate);
        if (seen.has(identity)) continue;
        seen.add(identity);
        const value = score(candidate);
        evaluated++;
        if (compare(value, bestScore) > 0) { best = candidate; bestScore = value; }
        if (Number.isFinite(value.value)) next.push({ rows: candidate, value });
        if (evaluated >= 100) break;
      }
    }
    if (!next.length) break;
    if (points) next.sort((a, b) => compare(b.value, a.value));
    const retained = points ? next : next.filter(candidate => !next.some(other => compare(other.value, candidate.value) > 0))
      .sort((a, b) => key(a.rows).localeCompare(key(b.rows)));
    frontier = retained.slice(0, 6).map(item => item.rows);
  }
  if (seen.size > 1) limitations.add(points
    ? "Projected goalie coverage uses expected starts and bounded lineup alternatives; it is not a satisfied minimum or proven optimum."
    : "Category lineup analysis is bounded and incomplete; incomparable tradeoffs are not globally ranked.");
  if (!points && categoryCoverageTarget !== null) limitations.add("Cover choice prioritizes supported projected goalie starts before category outcomes; it is a coverage preference, not category dominance or credited progress.");
  return best;
}

/** Provider injury designations that mean the player won't play (day-to-day still might). */
const OUT_INJURY_STATUSES = new Set(["IR", "IR-LT", "IR-NR", "O"]);
function prepareEvaluation(snapshot: PlanningSnapshot, playerIds?: ReadonlySet<string>) {
  snapshot = resolvePlanningContributions(sanitizeForecastInputs(snapshot), playerIds ? { playerIds } : undefined);
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  const forecasts = new Map(snapshot.forecasts.filter(forecast => !forecast.expiresAt || Date.parse(forecast.expiresAt) > time(snapshot.context.asOf)).map(forecast => [`${forecast.playerId}:${forecast.gameId}`, forecast]));
  const applicability = statApplicability({ ...snapshot, forecasts: [...forecasts.values()] });
  const games = snapshot.games.filter(game => ["scheduled", "live"].includes(game.status) && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot)).sort((a, b) => time(gameTime(a, snapshot.context.timeZone)) - time(gameTime(b, snapshot.context.timeZone)) || a.id.localeCompare(b.id));
  return { snapshot, players, forecasts, applicability, games };
}
export function evaluatePlan(snapshot: PlanningSnapshot, intent: PlanIntent, objective: PlanningObjective, steps: PlanStep[] = intent.steps,
  includeBenchEvidence = true, benchBudget?: BenchEvaluationBudget): PlanEvaluation {
  return evaluatePreparedPlan(prepareEvaluation(snapshot, new Set([...snapshot.roster.map(row => row.playerId), ...steps.flatMap(step => [step.playerId, ...(step.dropPlayerId ? [step.dropPlayerId] : [])])])), intent, objective, steps, includeBenchEvidence, benchBudget);
}
function evaluatePreparedPlan(prepared: ReturnType<typeof prepareEvaluation>, intent: PlanIntent, objective: PlanningObjective,
  steps: PlanStep[], includeBenchEvidence: boolean, benchBudget?: BenchEvaluationBudget): PlanEvaluation {
  const { snapshot, players, forecasts, applicability, games } = prepared;
  const limitations = new Set<string>(snapshot.rules.unsupported);
  // Missing roster members must remain in the coverage basis even when no
  // team/game join can create an opportunity (including a proposed drop).
  const requiredPlayers = new Set([...snapshot.roster.map(row => row.playerId),
    ...steps.flatMap(step => [step.playerId, ...(step.dropPlayerId ? [step.dropPlayerId] : [])])]);
  const unknownTeams = [...requiredPlayers].filter(id => !players.get(id)?.teamAbbreviation);
  const opportunitiesComplete = snapshot.evidence.schedule?.completeness === "complete" && !unknownTeams.length;
  if (snapshot.evidence.schedule?.completeness !== "complete") limitations.add("Planning schedule coverage is incomplete or unknown.");
  for (const id of unknownTeams) limitations.add(`Player ${id} has unknown current NHL team membership; remaining opportunities and net gains are indeterminate.`);
  const unresolved: CoverageIssue[] = [];
  const timeline = buildTimeline(snapshot, intent, steps);
  const slotDiagnostics = expandActiveSlots(snapshot.rules.rosterSlots).diagnostics;
  for (const diagnostic of slotDiagnostics) limitations.add(diagnostic.message);
  if (snapshot.rules.lineupMode === "unsupported") limitations.add("Lineup mode is unsupported.");
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
  const lineupPeriodForDate = (date: string) => lineupPeriodAtDate(date, snapshot.rules.lineupPeriods, snapshot.context.timeZone);
  // Daily providers lock each player at his game time for the rest of the day. Players whose game today has
  // started keep the slot the provider locked, else the slot today's lineup gave them before puck drop, so a
  // later game cannot take it. These rows are shown but never planned, valued or counted as remaining games.
  const today = localDate(snapshot.context.asOf, snapshot.context.timeZone);
  const startedPlays: Play[] = [], startedRows: PlanningAssignment[] = [];
  if (snapshot.rules.lineupMode === "daily" && today >= snapshot.context.startDate && today <= snapshot.context.endDate) {
    const todayGames = snapshot.games.filter(game => game.date === today && ["scheduled", "live", "final"].includes(game.status));
    const started = (game: PlanningGame) => game.startsAt ? time(game.startsAt) < time(snapshot.context.asOf) : game.status !== "scheduled";
    if (todayGames.some(started)) {
      const allForecasts = new Map(snapshot.forecasts.map(forecast => [`${forecast.playerId}:${forecast.gameId}`, forecast]));
      const preStart: Play[] = [];
      for (const entry of snapshot.roster) {
        const player = players.get(entry.playerId);
        if (!player || ["IR", "IR+", "NA"].includes(entry.position) || player.injury && OUT_INJURY_STATUSES.has(player.injury.status.toUpperCase())) continue;
        for (const game of todayGames.filter(game => game.teamAbbreviation === player.teamAbbreviation)) {
          const play = { player, game, forecast: allForecasts.get(`${player.id}:${game.id}`) ?? null };
          preStart.push(play);
          if (started(game)) startedPlays.push(play);
        }
      }
      const locks = snapshot.lockedAssignments.filter(lock => lock.date === today);
      const unlocked = startedPlays.some(play => !locks.some(lock => lock.playerId === play.player.id));
      const beforeStart = unlocked ? assign(snapshot, intent, objective, preStart, today, locks, new Set(), applicability, []) : [];
      for (const play of startedPlays) {
        const lock = locks.find(item => item.playerId === play.player.id);
        const slotId = lock ? lock.slotId : beforeStart.find(row => row.playerId === play.player.id)?.slotId ?? null;
        if (slotId) startedRows.push({ date: today, playerId: play.player.id, gameId: play.game.id, slotId, locked: true });
      }
    }
  }
  const injuredOut = new Set<string>();
  for (const date of dates) {
    const dayGames = games.filter(game => game.date === date);
    const plays: Play[] = [];
    for (const game of dayGames) for (const [id, member] of timeline.at(gameTime(game, snapshot.context.timeZone))) {
      const player = players.get(id);
      if (!player || player.teamAbbreviation !== game.teamAbbreviation || ["IR", "IR+", "NA"].includes(member.position) || time(member.since) > time(gameTime(game, snapshot.context.timeZone))) continue;
      if (!game.startsAt && time(member.since) >= time(zonedMidnight(game.date, snapshot.context.timeZone))) continue;
      // Out per the provider (IR/O): not a lineup option, so his missing projection can't block the totals.
      if (player.injury && OUT_INJURY_STATUSES.has(player.injury.status.toUpperCase())) { injuredOut.add(player.name); continue; }
      const forecast = forecasts.get(`${id}:${game.id}`) ?? null;
      if (forecast?.conditioning === "unconditional") forecastedOpportunities++;
      plays.push({ player, game, forecast });
    }
    if (dayGames.some(game => !game.startsAt)) limitations.add("Some game start times are unknown; same-day acquisitions cannot claim those starts.");
    playsByDate.set(date, plays);
    scheduledGames += plays.length;
  }
  if (injuredOut.size) limitations.add(`Not lined up while injured (provider IR/out): ${[...injuredOut].sort().join(", ")}.`);
  // Record game-time ownership before choosing a weekly lineup. The mutable
  // timeline cannot answer an earlier lock-time query after a later transaction.
  for (const date of dates) {
    const plays = playsByDate.get(date)!;
    let rows: PlanningAssignment[];
    if (snapshot.rules.lineupMode === "weekly") {
      const period = lineupPeriodForDate(date);
      const window = period?.id ?? `unsupported:${date}`;
      windowByDate.set(date, window);
      const lockAt = period?.lockAt;
      if (!period || !lockAt) limitations.add(`Weekly lineup window or lock time is unverified for ${date}.`);
      let locked = weekly.get(window);
      if (!locked) {
        const weekPlays = dates.filter(candidateDate => {
          const candidate = lineupPeriodForDate(candidateDate);
          return candidate?.id === window;
        }).flatMap(candidateDate => playsByDate.get(candidateDate) ?? []);
        const rosterAtWindow = buildTimeline(snapshot, intent, steps).at(lockAt ?? snapshot.context.asOf);
        const aggregate: Play[] = [];
        for (const [id, member] of rosterAtWindow) {
          const player = players.get(id);
          if (!player || ["IR", "IR+", "NA"].includes(member.position) || !lockAt || time(member.since) > time(lockAt)) continue;
          const playerGames = weekPlays.filter(play => play.player.id === id).map(play => play.game);
          if (!playerGames.length) continue;
          const stats: StatLine = {};
          let missing = false;
          for (const game of playerGames) {
            const forecast = forecasts.get(`${id}:${game.id}`);
            if (!forecast || forecast.conditioning !== "unconditional") { missing = true; break; }
            const required = scoringTargets(snapshot, { player, game, forecast }, applicability);
            if (required.some(key => !forecastAllows(forecast, key, "assignment") || !finite(assignmentStats(forecast)[key]))) missing = true;
            for (const [key, value] of Object.entries(assignmentStats(forecast))) if (forecastAllows(forecast, key, "assignment") && finite(value)) stats[key] = (stats[key] ?? 0)! + value;
          }
          aggregate.push({ player, game: playerGames[0], gamesCount: playerGames.length, forecast: missing ? null : { ...forecasts.get(`${id}:${playerGames[0].id}`)!, stats, assignmentStats: stats, contributions: undefined, allowedUses: { assignment: true, totals: false, comparison: false, conditionalTieBreak: false } } });
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
        for (const lock of uniqueLocks) if (!rosterAtWindow.has(lock.playerId)) {
          limitations.add(`Locked weekly player ${lock.playerId} is not rostered in ${window}.`);
          invalidLocks = true;
        }
        weeklyCandidates.set(window, aggregate);
        const seed = assign(snapshot, intent, objective, aggregate, date, uniqueLocks, limitations, applicability, unresolved, true);
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
    } else rows = date === today && startedPlays.length
      ? assign(snapshot, intent, objective, [...plays, ...startedPlays], date, [
        ...snapshot.lockedAssignments.filter(item => item.date === date && !startedPlays.some(play => play.player.id === item.playerId)),
        ...startedPlays.map(play => ({ playerId: play.player.id, slotId: startedRows.find(row => row.playerId === play.player.id)?.slotId ?? null })),
      ], limitations, applicability, unresolved)
      : assign(snapshot, intent, objective, plays, date, snapshot.lockedAssignments.filter(item => item.date === date), limitations, applicability, unresolved);
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
  if (startedRows.length && !dates.includes(today)) assignments.push(...startedRows);
  const scopeForDate = (date: string) => {
    const window = windowByDate.get(date);
    return { dates: snapshot.rules.lineupMode === "weekly" ? dates.filter(item => windowByDate.get(item) === window) : [date],
      locks: snapshot.lockedAssignments.filter(lock => snapshot.rules.lineupMode === "weekly"
        ? lineupPeriodForDate(lock.date)?.id === window : lock.date === date) };
  };
  const pointsCoverageTarget = pointsGoalieCoverageTarget(snapshot, intent);
  const categoryCoverageTarget = categoryGoalieCoverageTarget(snapshot, intent);
  const coverageTarget = snapshot.rules.scoring.mode === "categories" ? categoryCoverageTarget : pointsCoverageTarget;
  const requestedMinimum = snapshot.rules.goalieMinimum;
  const categoryCoverageRequested = snapshot.rules.scoring.mode === "categories" && intent.goalieCoverage === "cover"
    && finite(requestedMinimum.required) && requestedMinimum.required > 0 && !(finite(requestedMinimum.credited) && requestedMinimum.credited >= requestedMinimum.required);
  const categoryCoverageSupported = !categoryCoverageRequested || categoryCoverageTarget !== null;
  const goalieSlots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots.filter(slot => slot.type === "G");
  const coverageKnown = categoryCoverageSupported && (coverageTarget === null || [...playsByDate].flatMap(([date, plays]) => {
    const { locks } = scopeForDate(date);
    return plays.filter(play => play.player.playerClass === "goalie" && !locks.some(lock => lock.playerId === play.player.id && lock.slotId === null)
      && goalieSlots.some(slot => canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type)
        && !locks.some(lock => lock.slotId === slot.id && lock.playerId !== play.player.id)));
  })
    .every(play => play.forecast?.confirmedStart || finite(play.forecast?.startProbability)));
  if (!coverageKnown) limitations.add("Missing starter probabilities leave requested projected goalie coverage unresolved.");
  if (!unresolved.length && coverageKnown && (snapshot.rules.scoring.mode === "categories" || objective === "outcome" && pointsCoverageTarget !== null)) {
    const opponent = opponentStats(snapshot);
    if (opponent || snapshot.rules.scoring.mode === "points") {
      const refined = refineOutcomeLineup(snapshot, intent, assignments, playsByDate, windowByDate, weeklyCandidates, forecasts,
        opponent, applicability, limitations, pointsCoverageTarget, objective);
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
  const coverage = competitorCoverage(snapshot, playsByDate, applicability);
  const conflictingTargets = new Set(coverage.exclusions.filter(row => row.reasons.includes("conflicting_forecast"))
    .map(row => row.targetKey));
  for (const row of coverage.exclusions.filter(item => item.reasons.includes("conflicting_forecast"))) {
    const date = games.find(game => game.id === row.gameId)?.date ?? snapshot.context.startDate;
    unresolved.push({ date, playerId: row.playerId, gameId: row.gameId,
      missingTargets: [row.targetKey], reasons: ["conflicting_forecast"] });
  }
  if (conflictingTargets.size) limitations.add("Conflicting forecast evidence prevents a player-quality recommendation.");
  const stats: StatLine = { ...snapshot.realized };
  const missing = new Set<string>();
  let missingSelectedForecast = false;
  for (const play of chosen.values()) {
    const required = scoringTargets(snapshot, play, applicability);
    const assignmentMissing = required.filter(key => play.player.eligibilityVerified !== true
      || !play.forecast || !forecastAllows(play.forecast, key, "assignment")
      || !finite(assignmentStats(play.forecast)[key]));
    if (assignmentMissing.length || play.player.eligibilityVerified !== true || !play.forecast) {
      unresolved.push({ date: play.game.date, playerId: play.player.id, gameId: play.game.id, missingTargets: assignmentMissing });
    }
    const missingTargets = required.filter(key => !play.forecast || !forecastAllows(play.forecast, key, "totals") || !finite(play.forecast.stats[key]));
    if (!play.forecast || missingTargets.length) {
      limitations.add("An active game lacks a complete approved unconditional totals forecast.");
      missingSelectedForecast = true;
      missingTargets.forEach(key => missing.add(key));
    }
    if (!play.forecast) continue;
    for (const [key, value] of Object.entries(play.forecast.stats)) {
      if (!applies(key, play.player.playerClass, applicability)) continue;
      if (forecastAllows(play.forecast, key, "totals") && finite(value)) stats[key] = (stats[key] ?? 0)! + value;
      else missing.add(key);
    }
  }
  for (const key of [...missing, ...conflictingTargets]) stats[key] = null;
  if (unresolved.length) limitations.add("Start/sit quality is unresolved because competing eligible players lack comparable scoring forecasts. This is a schedule-capacity assignment.");
  if (scheduledGames > 0 && forecastedOpportunities === 0) limitations.add("No remaining opportunities have usable forecasts; projected outcome is unavailable.");
  const needed = snapshot.rules.scoring.mode === "points" ? Object.entries(snapshot.rules.scoring.weights).filter(([, weight]) => weight !== 0).map(([key]) => key) : snapshot.rules.scoring.categories.flatMap(category => [category.numerator ?? category.key, ...(category.denominator ? [category.denominator] : [])]);
  for (const key of needed) if (!finite(stats[key])) limitations.add(`Projected ${key} is incomplete.`);
  const opponent = opponentStats(snapshot);
  const categoryResults = snapshot.rules.scoring.categories.map(category => {
    const own = unresolved.some(issue => issue.missingTargets.includes(category.numerator ?? category.key) || !!category.denominator && issue.missingTargets.includes(category.denominator)) ? null : categoryValue(stats, category), other = opponent ? categoryValue(opponent, category) : null;
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
  // A zero requirement means the league has no goalie minimum, so its checks are bypassed.
  const hasMinimum = finite(minimum.required) && minimum.required > 0;
  const minimumWindowVerified = goalieMinimumWindowVerified(snapshot);
  if (hasMinimum && !minimumWindowVerified) limitations.add("Goalie minimum progress applies to an unverified or narrower period; coverage cannot be confirmed for this range.");
  let projected = minimum.credited, confirmed = 0, startsKnown = true;
  const minimumAlreadyMet = minimum.required === 0 || minimum.required !== null && finite(minimum.credited) && minimum.credited >= minimum.required;
  const goalieByTeamGame = new Map<string, number>();
  for (const play of chosen.values()) if (play.player.playerClass === "goalie") {
    if (play.forecast?.confirmedStart) confirmed++;
    const probability = play.forecast?.confirmedStart ? 1 : play.forecast?.startProbability;
    const key = `${play.game.id}:${play.player.teamAbbreviation}`;
    if (finite(probability)) goalieByTeamGame.set(key, Math.min(1, (goalieByTeamGame.get(key) ?? 0) + probability));
    else { startsKnown = false; if (!minimumAlreadyMet) projected = null; }
  }
  const expectedStarts = startsKnown ? [...goalieByTeamGame.values()].reduce((sum, value) => sum + value, 0) : null;
  if (minimum.counts === "appearances" && hasMinimum) {
    if (!minimumAlreadyMet) { projected = null; limitations.add("Appearance probabilities are unavailable; starter probabilities cannot verify this goalie minimum."); }
  } else if (hasMinimum && minimum.counts === "unknown" && !minimumAlreadyMet) projected = null;
  else if (finite(projected)) projected += [...goalieByTeamGame.values()].reduce((sum, value) => sum + value, 0);
  if (!minimumWindowVerified && hasMinimum) projected = null;
  const risk = hasMinimum && (projected === null || projected < (minimum.required ?? 0));
  if (risk && intent.goalieCoverage === "cover") limitations.add("Goalie minimum coverage is not verified.");
  if (hasMinimum && intent.goalieCoverage === "cover" && intent.goalieWindow !== "any") {
    const available = games.some(game => preferredGoalieDate(game.date, intent) && snapshot.players.some(player => player.playerClass === "goalie" && player.teamAbbreviation === game.teamAbbreviation &&
      (snapshot.roster.some(entry => entry.playerId === player.id) || ["free_agent", "manager_available", "waivers"].includes(player.availability)) &&
      (forecasts.get(`${player.id}:${game.id}`)?.confirmedStart || (forecasts.get(`${player.id}:${game.id}`)?.startProbability ?? 0) > 0)));
    if (!available) limitations.add("Preferred goalie coverage window has no verified usable start; coverage is infeasible with current evidence.");
    else if (![...chosen.values()].some(play => play.player.playerClass === "goalie" && preferredGoalieDate(play.game.date, intent))) limitations.add("This plan does not cover the preferred goalie window.");
  }
  if (hasMinimum && (minimum.counts === "unknown" || minimum.penalty === "unknown")) limitations.add("Goalie minimum semantics are incomplete.");
  if (risk && minimum.penalty === "lose_goalie_categories" && snapshot.rules.scoring.mode === "categories") { projectedValue = null; limitations.add("Goalie-category forfeiture risk makes the matchup projection incomplete."); }
  if (unresolved.length || !opportunitiesComplete) projectedValue = null;
  const legal = timeline.legal && !invalidLocks && !weeklyEvidenceMissing && snapshot.rules.lineupMode !== "unsupported" && (snapshot.rules.lineupMode !== "weekly" || dates.every(date => !!lineupPeriodForDate(date)?.lockAt)) && !slotDiagnostics.some(item => item.severity === "error");
  if ([...chosen.values()].some(play => ["baseline", "blended"].includes(play.forecast?.sourceKind ?? ""))) limitations.add("Includes provisional baseline estimates; no calibrated uncertainty.");
  if (conflictingTargets.size) projectedValue = null;
  const assignmentValue = unresolved.length || (scheduledGames > 0 && forecastedOpportunities === 0) ? null
    : [...chosen.values()].reduce<number | null>((sum, play) => { const value = playValue(play, snapshot, opponent, applicability); return sum === null || value === null ? null : sum + value; }, 0);
  const inputEligible = legal && opportunitiesComplete && !unresolved.length && coverageKnown && assignmentValue !== null && !invalidLocks && !weeklyEvidenceMissing && !snapshot.rules.unsupported.length;
  const categoryMode = snapshot.rules.scoring.mode === "categories";
  if (categoryMode) limitations.add("Category assignments use schedule capacity and supported componentwise changes. Incomparable tradeoffs have no approved overall utility; start/sit and acquisition recommendations need manager choice.");
  // Complete per-category facts remain comparable without certifying a scalar
  // winner. This also bypasses scalar category bench-counterfactual certification.
  const recommendationEligible = inputEligible && !categoryMode;
  const unresolvedWithReasons = [...new Map(unresolved.map(issue => [`${issue.date}:${issue.playerId}:${issue.gameId}`, issue])).values()]
    .map(issue => ({ ...issue, reasons: [...new Set(coverage.exclusions.filter(row => row.playerId === issue.playerId
      && row.gameId === issue.gameId && (!issue.missingTargets.length || issue.missingTargets.includes(row.targetKey)))
      .flatMap(row => row.reasons))].sort() }));
  const activeSlots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const exclusions: NonNullable<PlanEvaluation["recommendation"]>["exclusions"] = [...playsByDate.entries()].flatMap(([date, plays]) => plays.filter(play => !chosen.has(`${play.player.id}:${play.game.id}`)).map(play => {
    const eligibleSlots = activeSlots.filter(slot => canEligibilityOccupySlot(normalizeEligibility(play.player.eligiblePositions), slot.type));
    const competing = assignments.filter(row => row.date === date && eligibleSlots.some(slot => slot.id === row.slotId));
    // Fixed weekly assignments are not necessarily explicit user/provider locks.
    const locks = snapshot.lockedAssignments.filter(lock => snapshot.rules.lineupMode === "weekly"
      ? lineupPeriodForDate(lock.date)?.id === windowByDate.get(date) : lock.date === date);
    const weeklyPeriod = snapshot.rules.lineupMode === "weekly" ? lineupPeriodForDate(date) : null;
    const weeklyLockedOut = !!weeklyPeriod?.lockAt && Number.isFinite(time(weeklyPeriod.lockAt))
      && !weeklyCandidates.get(weeklyPeriod.id)?.some(candidate => candidate.player.id === play.player.id);
    const value = playValue(play, snapshot, opponent, applicability);
    const reason = locks.some(lock => lock.playerId === play.player.id && lock.slotId === null) ? "locked_bench"
      : !eligibleSlots.length ? "ineligible"
        : weeklyLockedOut ? "weekly_lock"
          : eligibleSlots.every(slot => locks.some(lock => lock.slotId === slot.id)) ? "locked_capacity"
            : !recommendationEligible ? "unresolved_quality"
              : objective === "agp" ? "schedule_capacity"
                : value !== null && value < 0 && competing.length < eligibleSlots.length ? "negative_value" : "whole_lineup_scoring";
    return { date, playerId: play.player.id, gameId: play.game.id, reason, value, competingPlayerIds: competing.map(row => row.playerId) };
  }));
  const comparisonEligible = inputEligible && projectedValue !== null && [...playsByDate.values()].flat()
    .filter(play => !snapshot.lockedAssignments.some(lock => lock.date === play.game.date && lock.playerId === play.player.id && lock.slotId === null))
    .every(play => scoringTargets(snapshot, play, applicability).every(key => forecastAllows(play.forecast, key, "comparison")));
  const plannedRows = assignments.filter(row => !startedRows.some(started => started.playerId === row.playerId && started.gameId === row.gameId)).length;
  const evaluation: PlanEvaluation = { assignmentValue, comparisonEligible,
    forecastManifestId: conflictingTargets.size
      ? `${snapshot.forecastManifest?.id ?? snapshot.id}:conflict:${conflictFingerprint(coverage.exclusions
        .filter(row => row.reasons.includes("conflicting_forecast")))}` : snapshot.forecastManifest?.id ?? snapshot.id,
    forecastInputs: [...chosen.values()].flatMap(play => play.forecast ? [{ ...play.forecast, stats: { ...play.forecast.stats } }] : []),
    recommendation: { eligible: recommendationEligible, mode: recommendationEligible ? "quality" : "schedule_capacity",
    reasons: recommendationEligible ? [] : [...limitations], exclusions, unresolved: unresolvedWithReasons, coverage },
    objective, steps, legal, budgetVerified: timeline.budgetVerified,
    assignments, scheduledGames, activeGames: plannedRows, benchGames: Math.max(0, scheduledGames - plannedRows), projectedValue, projectedStats: stats,
    categoryResults, goalie: { credited: minimum.credited, confirmed, projected, expectedStarts, required: minimum.required, risk, minimumSatisfied: minimum.required === null ? null : minimumAlreadyMet }, acquisitions: { ...timeline.acquisitions }, limitations: [...limitations] };
  if (!includeBenchEvidence) return evaluation;
  const playByKey = new Map([...playsByDate.values()].flat().map(play => [`${play.player.id}:${play.game.id}`, play]));
  const rowValue = (row: PlanningAssignment) => {
    const play = playByKey.get(`${row.playerId}:${row.gameId}`);
    return play ? playValue(play, snapshot, opponent, applicability) : null;
  };
  const budget = benchBudget ?? { maxEvaluations: defaultWorkQuotas(snapshot).benchEvaluations, evaluated: 0,
    deadline: Infinity, workQuotaReached: false, timeLimitReached: false };
  return explainBenchDecisions({ snapshot, intent, evaluation, budget, pointsCoverageTarget: coverageKnown ? pointsCoverageTarget : null,
    scopeForDate, evaluateForced: lock => {
      const player = snapshot.players.find(item => item.id === lock.playerId)!;
      if (snapshot.rules.scoring.mode !== "points" || player.playerClass === "goalie") {
        return evaluatePlan({ ...snapshot, lockedAssignments: [...snapshot.lockedAssignments, { ...lock, slotId: lock.slotId! }] }, intent, objective, steps, false);
      }
      // Additive skater scores need only the affected matching window. Preserve
      // every goalie assignment/minimum input and reuse already resolved plays.
      const scope = scopeForDate(lock.date), window = windowByDate.get(lock.date);
      const candidates = snapshot.rules.lineupMode === "weekly" ? weeklyCandidates.get(window!) ?? [] : playsByDate.get(lock.date) ?? [];
      const placed = assign(snapshot, intent, objective, candidates, lock.date, scope.locks,
        new Set<string>(), applicability, [], snapshot.rules.lineupMode === "weekly", lock.playerId)
        .filter(row => snapshot.players.find(item => item.id === row.playerId)?.playerClass === "skater");
      const replacement = scope.dates.flatMap(date => placed.flatMap(row => {
        const play = playsByDate.get(date)?.find(item => item.player.id === row.playerId);
        return play ? [{ ...row, date, gameId: play.game.id }] : [];
      }));
      const removed = assignments.filter(row => scope.dates.includes(row.date)
        && snapshot.players.find(item => item.id === row.playerId)?.playerClass === "skater");
      const forced = [...assignments.filter(row => !removed.includes(row)), ...replacement];
      const oldValues = removed.map(rowValue), newValues = replacement.map(rowValue);
      const delta = oldValues.every(finite) && newValues.every(finite)
        ? newValues.reduce((sum, value) => sum + value, 0) - oldValues.reduce((sum, value) => sum + value, 0) : null;
      return { legal, budgetVerified: timeline.budgetVerified, assignments: forced,
        assignmentValue: delta === null || assignmentValue === null ? null : assignmentValue + delta,
        projectedValue: delta === null || projectedValue === null ? null : projectedValue + delta,
        goalie: evaluation.goalie, categoryResults: [],
        forecastInputs: forced.flatMap(row => { const play = playByKey.get(`${row.playerId}:${row.gameId}`); return play?.forecast ? [play.forecast] : []; }) };
    } });
}

function compareCategoryEvaluations(snapshot: PlanningSnapshot, a: PlanEvaluation, b: PlanEvaluation, target: number | null) {
  if (!a.comparisonEligible || !b.comparisonEligible || !a.legal || !b.legal || !a.budgetVerified || !b.budgetVerified
    || !a.forecastManifestId || a.forecastManifestId !== b.forecastManifestId) return "unknown";
  const categories = snapshot.rules.scoring.categories;
  const rows = categories.map(category => [a.categoryResults.find(row => row.key === category.key), b.categoryResults.find(row => row.key === category.key)]);
  if (rows.some(([left, right]) => !left || !right || !finite(left.opponent) || left.opponent !== right.opponent)) return "unknown";
  let relation = categoryRelation(rows.map(([left]) => left?.own ?? null), rows.map(([, right]) => right?.own ?? null), categories);
  if (relation === "unknown") return relation;
  let coveragePreferred = false;
  if (target !== null) {
    if (!finite(a.goalie.projected) || !finite(b.goalie.projected)) return "unknown";
    const left = Math.min(target, a.goalie.projected), right = Math.min(target, b.goalie.projected);
    if (left !== right) {
      relation = left > right ? "better" : "worse";
      coveragePreferred = true;
    }
  } else if (a.goalie.required !== null && !a.goalie.minimumSatisfied
    && (a.goalie.projected !== b.goalie.projected || a.goalie.risk !== b.goalie.risk)) {
    // Accepting risk does not assign a utility to different coverage scenarios.
    return "tradeoff";
  }
  if (a.objective === b.objective && a.objective === "agp" && a.activeGames !== b.activeGames && !coveragePreferred) relation = a.activeGames > b.activeGames ? "better" : "worse";
  let lowerCost = false, higherCost = false;
  for (const period of new Set([...Object.keys(a.acquisitions), ...Object.keys(b.acquisitions)])) {
    const left = a.acquisitions[period] ?? 0, right = b.acquisitions[period] ?? 0;
    if (!finite(left) || !finite(right)) return "unknown";
    lowerCost ||= left < right;
    higherCost ||= left > right;
  }
  const adds = (plan: PlanEvaluation) => plan.steps.filter(step => step.type === "add").length;
  lowerCost ||= adds(a) < adds(b);
  higherCost ||= adds(a) > adds(b);
  if (lowerCost && higherCost || relation === "better" && higherCost || relation === "worse" && lowerCost) return "tradeoff";
  if (relation === "equal" && (lowerCost || higherCost)) {
    // Equality is exact in retained native-unit values (zero computational
    // tolerance), including relevant minimum/coverage facts. No significance
    // floor, category weighting or five-percent tie rule is applied.
    if (a.goalie.required !== b.goalie.required || a.goalie.credited !== b.goalie.credited
      || a.goalie.confirmed !== b.goalie.confirmed || a.goalie.projected !== b.goalie.projected
      || a.goalie.risk !== b.goalie.risk || a.goalie.minimumSatisfied !== b.goalie.minimumSatisfied) return "tradeoff";
    return lowerCost ? "better" : "worse";
  }
  return relation;
}
function compareEvaluations(a: PlanEvaluation, b: PlanEvaluation, intent: PlanIntent, preferred: PlanningObjective, pointsCoverageTarget: number | null, categoryMode: boolean): number {
  if (a.objective !== b.objective) return a.objective === preferred ? -1 : 1;
  // Category presentation orders only the declared starts objective. Partial
  // dominance is handled by frontier filtering, never used as a global sort.
  if (categoryMode) {
    if (pointsCoverageTarget !== null && a.comparisonEligible && b.comparisonEligible
      && a.forecastManifestId === b.forecastManifestId && finite(a.goalie.projected) && finite(b.goalie.projected)) {
      const difference = Math.min(pointsCoverageTarget, b.goalie.projected) - Math.min(pointsCoverageTarget, a.goalie.projected);
      if (difference) return difference;
    }
    return a.objective === "agp" ? b.activeGames - a.activeGames : 0;
  }
  if (intent.goalieCoverage === "cover" && a.goalie.risk !== b.goalie.risk) return a.goalie.risk ? 1 : -1;
  if (a.objective === "outcome" && pointsCoverageTarget !== null && finite(a.goalie.projected) && finite(b.goalie.projected)) {
    const difference = Math.min(pointsCoverageTarget, b.goalie.projected) - Math.min(pointsCoverageTarget, a.goalie.projected);
    if (difference) return difference;
  }
  if (a.objective === "agp" && a.activeGames !== b.activeGames) return b.activeGames - a.activeGames;
  if ((a.projectedValue ?? a.assignmentValue ?? -Infinity) !== (b.projectedValue ?? b.assignmentValue ?? -Infinity)) return (b.projectedValue ?? b.assignmentValue ?? -Infinity) - (a.projectedValue ?? a.assignmentValue ?? -Infinity);
  if (a.activeGames !== b.activeGames) return b.activeGames - a.activeGames;
  if (intent.goalieCoverage === "cover" && intent.goalieWindow !== "any") {
    const preferredCount = (evaluation: PlanEvaluation) => evaluation.assignments.filter(row => row.slotId.startsWith("G#") && preferredGoalieDate(row.date, intent)).length;
    return preferredCount(b) - preferredCount(a);
  }
  return 0;
}
function safeAlternative(snapshot: PlanningSnapshot, baseline: PlanEvaluation, evaluation: PlanEvaluation,
  pointsCoverageTarget: number | null): boolean {
  if (snapshot.rules.scoring.mode === "categories") {
    const relation = compareCategoryEvaluations(snapshot, evaluation, baseline, pointsCoverageTarget);
    return relation === "better" || relation === "tradeoff";
  }
  const hasDrop = evaluation.steps.some(step => !!step.dropPlayerId || step.type === "drop");
  if (evaluation.objective === "agp" && evaluation.activeGames > baseline.activeGames &&
    (baseline.projectedValue === null || evaluation.projectedValue === null || evaluation.projectedValue >= baseline.projectedValue)) {
    if (!hasDrop) return true;
    // A schedule comparison needs a complete opportunity basis, but missing
    // quality forecasts do not make a legal capacity comparison unavailable.
    const required = new Set([...snapshot.roster.map(row => row.playerId),
      ...evaluation.steps.flatMap(step => [step.playerId, ...(step.dropPlayerId ? [step.dropPlayerId] : [])])]);
    if (snapshot.evidence.schedule?.completeness === "complete"
      && [...required].every(id => !!snapshot.players.find(player => player.id === id)?.teamAbbreviation)) return true;
  }
  const coverageImproves = evaluation.objective === "outcome" && pointsCoverageTarget !== null
    && finite(baseline.goalie.projected) && finite(evaluation.goalie.projected)
    && Math.min(pointsCoverageTarget, evaluation.goalie.projected) > Math.min(pointsCoverageTarget, baseline.goalie.projected);
  if (!baseline.comparisonEligible || !evaluation.comparisonEligible || baseline.projectedValue === null || evaluation.projectedValue === null || evaluation.projectedValue < baseline.projectedValue && !coverageImproves) return false;
  if (evaluation.projectedValue === baseline.projectedValue && evaluation.activeGames <= baseline.activeGames && !coverageImproves && !(baseline.goalie.risk && !evaluation.goalie.risk)) return false;
  for (const step of evaluation.steps) if (step.dropPlayerId) {
    const added = snapshot.players.find(player => player.id === step.playerId);
    const dropped = snapshot.players.find(player => player.id === step.dropPlayerId);
    if (!added || !dropped) return false;
  }
  return true;
}
/** Marginal lineup capacity only: one hypothetical extra roster place, no acquisition/drop claim. */
function defaultWorkQuotas(snapshot: PlanningSnapshot) {
  const startDay = Date.parse(`${snapshot.context.startDate}T00:00:00Z`);
  const endDay = Date.parse(`${snapshot.context.endDate}T00:00:00Z`);
  const days = Number.isFinite(startDay) && Number.isFinite(endDay)
    ? Math.max(1, Math.floor((endDay - startDay) / 86_400_000) + 1) : 1;
  const available = snapshot.players.filter(player => ["free_agent", "manager_available", "waivers"].includes(player.availability)).length;
  // More dates and candidates make each evaluation costlier. These are work
  // bounds, not wall-clock guesses, so identical inputs visit the same frontier.
  const rangeScale = Math.sqrt(Math.ceil(days / 14));
  const scale = Math.sqrt(Math.ceil(days / 14) * Math.ceil(Math.max(1, available) / 25));
  // Bench checks operate on the returned roster, independent of catalog size.
  return { evaluations: Math.max(12, Math.floor(250 / scale)), fitGroups: Math.max(4, Math.floor(80 / scale)),
    benchEvaluations: Math.max(12, Math.floor(250 / rangeScale)) };
}

export function scheduleFits(snapshot: PlanningSnapshot, intent: PlanIntent, baseline: PlanEvaluation, budgetMs = Infinity, maxGroups = defaultWorkQuotas(snapshot).fitGroups, includeZero = false) {
  const started = Date.now();
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  const groups = new Map<string, PlanningPlayer[]>();
  const teams = new Set(snapshot.games.filter(game => game.status === "scheduled" && eligibleGame(game, snapshot)).map(game => game.teamAbbreviation));
  for (const player of snapshot.players) {
    if (owned.has(player.id) || intent.excludedPlayerIds.includes(player.id) || !player.teamAbbreviation || !teams.has(player.teamAbbreviation) || player.availability === "rostered" || !player.eligiblePositions.length) continue;
    if (includeZero && (!player.eligibilityVerified || !normalizeEligibility(player.eligiblePositions).valid
      || normalizeEligibility(player.eligiblePositions).playerClass !== player.playerClass)) continue;
    const key = `${player.teamAbbreviation}:${[...player.eligiblePositions].sort().join(",")}`;
    groups.set(key, [...(groups.get(key) ?? []), player]);
  }
  const prepared = includeZero ? prepareEvaluation(snapshot) : null;
  const fits: NonNullable<PlanningResult["scheduleFits"]> = [];
  let complete = true, timeLimitReached = false, workQuotaReached = false, groupsEvaluated = 0;
  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (groupsEvaluated >= maxGroups) { complete = false; workQuotaReached = true; break; }
    if (budgetMs !== Infinity && Date.now() - started >= budgetMs) { complete = false; timeLimitReached = true; break; }
    groupsEvaluated++;
    const candidates = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const player = candidates[0];
    const hypothetical = { ...snapshot, roster: [...snapshot.roster, { playerId: player.id, position: "bench" as const }],
      rules: { ...snapshot.rules, rosterSlots: { ...snapshot.rules.rosterSlots, BN: (snapshot.rules.rosterSlots.BN ?? 0) + 1 } } };
    const evaluation = prepared
      ? evaluatePreparedPlan({ ...prepared, snapshot: { ...prepared.snapshot, roster: hypothetical.roster, rules: hypothetical.rules } }, { ...intent, goalieCoverage: "accept_risk" }, "agp", [], false)
      : evaluatePlan(hypothetical, { ...intent, goalieCoverage: "accept_risk" }, "agp", [], false);
    const addedGames = evaluation.activeGames - baseline.activeGames;
    if (addedGames < 0 || addedGames === 0 && !includeZero) continue;
    const dates = [...new Set(evaluation.assignments.map(row => row.date))].filter(date => evaluation.assignments.filter(row => row.date === date).length > baseline.assignments.filter(row => row.date === date).length);
    fits.push({ teamAbbreviation: player.teamAbbreviation!, positions: [...player.eligiblePositions], playerIds: candidates.map(row => row.id), addedGames, dates });
  }
  fits.sort((a, b) => b.addedGames - a.addedGames || a.teamAbbreviation.localeCompare(b.teamAbbreviation) || a.positions.join(",").localeCompare(b.positions.join(",")));
  return { fits, complete, groupsEvaluated, workQuotaReached, timeLimitReached };
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
  for (const label of ["G", "C", "LW", "RW", "D", ...new Set(games.map(game => game.date).sort())]) {
    const item = sorted.find(({ player }) => !used.has(player.id) && (label.match(/^\d{4}-/) ? games.some(game => game.date === label && game.teamAbbreviation === player.teamAbbreviation) : player.eligiblePositions.includes(label)));
    if (item && selected.length < limit) { selected.push(item.player); used.add(item.player.id); }
  }
  for (const item of sorted) if (selected.length < limit && !used.has(item.player.id)) { selected.push(item.player); used.add(item.player.id); }
  return selected;
}
function* extensions(snapshot: PlanningSnapshot, intent: PlanIntent, prior: PlanStep[], candidates: PlanningPlayer[], dropOrder?: ReadonlyMap<string, number>): Generator<PlanStep[]> {
  const owned = new Set(snapshot.roster.map(entry => entry.playerId));
  for (const step of prior) {
    if (step.dropPlayerId) owned.delete(step.dropPlayerId);
    if (step.type === "add") owned.add(step.playerId);
    if (step.type === "drop") owned.delete(step.playerId);
  }
  const dates = [...new Set(snapshot.games.filter(game => game.status === "scheduled" && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate && eligibleGame(game, snapshot)).map(game => game.date))].sort();
  // Dropping a player held in IR/IR+/NA frees no active or bench spot, so it can't make room for an add. A player out
  // injured projects nothing this week, which says nothing about his value on return, so he is never an automatic drop.
  const reserved = new Set([...snapshot.roster.filter(entry => ["IR", "IR+", "NA"].includes(entry.position)).map(entry => entry.playerId),
    ...prior.filter(step => step.type === "reserve").map(step => step.playerId)]);
  const drops = snapshot.players.filter(player => owned.has(player.id) && !reserved.has(player.id) && player.canDrop === true
    && !(player.injury && OUT_INJURY_STATUSES.has(player.injury.status.toUpperCase())) && !intent.protectedPlayerIds.includes(player.id))
    .sort((a, b) => (dropOrder?.get(a.id) ?? Infinity) - (dropOrder?.get(b.id) ?? Infinity)
      || (a.holdValue ?? 0) - (b.holdValue ?? 0) || a.id.localeCompare(b.id));
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
    if (snapshot.rules.acquisitionTiming === "next_day" && localDate(at, snapshot.context.timeZone) >= date) continue;
    const effectiveAt = acquisitionEffectiveAt(snapshot, player, at);
    if (!effectiveAt) continue;
    const step: PlanStep = { id: `add:${player.id}:${prior.length}:${date}`, type: "add", playerId: player.id, at, effectiveAt,
      conditional: player.availability === "waivers" || time(at) > time(snapshot.context.asOf), dependsOn: prior.length ? [prior[prior.length - 1].id] : [] };
    proposals.push({ player, date, step });
  }
  const reserveUsed = (position: string) => snapshot.roster.filter(entry => entry.position === position && owned.has(entry.playerId)).length
    + prior.filter(step => step.type === "reserve" && step.reservePosition === position).length;
  // Give every candidate/date a chance before expanding the long tail of drop choices.
  for (const { player, date, step } of proposals) {
    yield [step];
    for (const entry of [...snapshot.roster].sort((a, b) => a.playerId.localeCompare(b.playerId))) {
      const reservePlayer = snapshot.players.find(item => item.id === entry.playerId);
      if (!reservePlayer || !owned.has(entry.playerId) || ["IR", "IR+", "NA"].includes(entry.position)) continue;
      // Only a reserve slot with room: a full IR+ would make every such proposal illegal and spend the budget.
      for (const position of [...reservePlayer.reserveEligibility].sort()) if ((snapshot.rules.rosterSlots[position] ?? 0) > reserveUsed(position)) {
        const prerequisite: PlanStep = { id: `reserve:${entry.playerId}:${prior.length}:${date}`, type: "reserve", playerId: entry.playerId, reservePosition: position, at: step.at, effectiveAt: step.at, conditional: false, dependsOn: step.dependsOn };
        yield [prerequisite, { ...step, dependsOn: [prerequisite.id] }];
      }
    }
    for (const drop of drops.slice(0, 2)) if (drop.id !== player.id) yield [{ ...step, id: `${step.id}:drop:${drop.id}`, dropPlayerId: drop.id }];
  }
  for (const { player, step } of proposals) for (const drop of drops.slice(2)) if (drop.id !== player.id)
    yield [{ ...step, id: `${step.id}:drop:${drop.id}`, dropPlayerId: drop.id }];
}

/** Reuse the same timed acquisition/reserve/drop proposals for bounded candidate comparisons. */
export function candidateAcquisitionSteps(snapshot: PlanningSnapshot, intent: PlanIntent, player: PlanningPlayer, dropOrder?: ReadonlyMap<string, number>) {
  return extensions(snapshot, intent, [], [player], dropOrder);
}

/** Synchronous and serializable; terminate the owning Worker to cancel a running search. */
export function planRoster(snapshot: PlanningSnapshot, intent: PlanIntent, options: PlanningSearchOptions = {}): PlanningResult {
  const start = Date.now();
  snapshot = sanitizeForecastInputs(snapshot);
  const sourceSnapshot = snapshot;
  const relevantPlayerIds = new Set([...snapshot.roster.map(row => row.playerId), ...intent.steps.flatMap(step => [step.playerId, ...(step.dropPlayerId ? [step.dropPlayerId] : [])])]);
  snapshot = resolvePlanningContributions(snapshot, { playerIds: relevantPlayerIds });
  const maxEvaluations = Math.max(3, options.maxEvaluations ?? defaultWorkQuotas(snapshot).evaluations);
  const beamWidth = Math.max(2, options.beamWidth ?? 8);
  const maxCandidates = Math.max(1, options.maxCandidates ?? 40);
  const maxSteps = Math.max(0, options.maxSteps ?? 4);
  // Work quotas produce the same search frontier for the same snapshot. An explicit
  // wall-clock limit may stop at a completed phase checkpoint for responsiveness.
  const timeBudgetMs = options.timeBudgetMs == null ? Infinity : Math.max(1, options.timeBudgetMs);
  const benchBudget: BenchEvaluationBudget = {
    maxEvaluations: Number.isSafeInteger(options.maxBenchEvaluations) && options.maxBenchEvaluations! >= 0
      ? options.maxBenchEvaluations! : defaultWorkQuotas(snapshot).benchEvaluations,
    evaluated: 0, deadline: start + timeBudgetMs, workQuotaReached: false, timeLimitReached: false,
  };
  const noMoveAgp = evaluatePlan(snapshot, intent, "agp", [], false);
  const pointsCoverageTarget = pointsGoalieCoverageTarget(snapshot, intent);
  const categoryMode = snapshot.rules.scoring.mode === "categories";
  const coverageTarget = categoryMode ? categoryGoalieCoverageTarget(snapshot, intent) : pointsCoverageTarget;
  const noMoveOutcome = evaluatePlan(snapshot, intent, "outcome", [], false);
  // The manager can ask for most starts or best projected points. Points need projections that qualify for the
  // whole lineup, so until then a points request (or "auto") plans for most starts.
  const outcomeEligible = noMoveOutcome.recommendation?.eligible === true;
  const objective: PlanningObjective = intent.objective !== "agp" && outcomeEligible ? "outcome" : "agp";
  const baseline = objective === "outcome" ? noMoveOutcome : noMoveAgp;
  const selected = evaluatePlan(snapshot, intent, objective, intent.steps, false);
  const noClaimContinuations = intent.steps.flatMap((step, index) => {
    if (step.type !== "add" || !step.conditional) return [];
    const prefix = intent.steps.slice(0, index);
    const evaluation = evaluatePlan(snapshot, intent, objective, prefix, false);
    return evaluation.legal && evaluation.budgetVerified ? [{ claimStepId: step.id, evaluation }] : [];
  });
  const fitResult = scheduleFits(snapshot, intent, noMoveAgp, timeBudgetMs === Infinity ? Infinity : Math.min(500, timeBudgetMs / 3));
  const candidates = shortlist(snapshot, intent, maxCandidates, fitResult.fits);
  candidates.forEach(player => relevantPlayerIds.add(player.id));
  snapshot = resolvePlanningContributions(sourceSnapshot, { playerIds: relevantPlayerIds });
  const limitations = new Set<string>();
  if (intent.objective === "outcome" && !outcomeEligible) limitations.add("Best projected points needs projections for your whole lineup; planning for most starts until then.");
  if (fitResult.timeLimitReached) limitations.add("Schedule-fit analysis reached its time budget; additional team/position targets remain unevaluated.");
  if (fitResult.workQuotaReached) limitations.add("Schedule-fit analysis reached its work quota; additional team/position targets remain unevaluated.");
  if (snapshot.rules.acquisitionTiming === "unknown") limitations.add("Add/drop plans need acquisition-effective timing. Review League rules and scoring.");
  if (snapshot.rules.acquisitionCost === null || !snapshot.rules.periods.length || snapshot.rules.periods.some(period => period.remaining === null)) limitations.add("Add/drop plans need acquisition cost and remaining allowance for every affected period. Review Scoring, budgets, and lock windows.");
  if (baseline.projectedValue === null) limitations.add("Fantasy-point drop recommendations need game-level contribution forecasts. Legal hypothetical schedule comparisons may still be returned with net points and drop cost unknown; schedule-fit targets alone are not verified add/drop plans.");
  const availableCount = snapshot.players.filter(player => ["free_agent", "manager_available", "waivers"].includes(player.availability)).length;
  const coverageComplete = candidates.length >= availableCount;
  if (!coverageComplete) limitations.add(`Candidate shortlist contains ${candidates.length} of ${availableCount} available players.`);
  type State = { steps: PlanStep[]; evaluation: PlanEvaluation };
  const orderStates = (states: State[], preferred: PlanningObjective) => {
    const stableOrder = (a: State, b: State) => a.steps.map(step => step.id).join("|").localeCompare(b.steps.map(step => step.id).join("|"));
    const adds = (state: State) => state.steps.filter(step => step.type === "add").length;
    const drops = (state: State) => state.steps.filter(step => step.type === "drop" || step.dropPlayerId).length;
    states.sort((a, b) => compareEvaluations(a.evaluation, b.evaluation, intent, preferred, coverageTarget, categoryMode) || stableOrder(a, b));
    // Reorder only exact supported equivalents in their existing positions.
    // Pairwise category tradeoffs are not a transitive global sort relation.
    const groups = new Map<string, number[]>();
    states.forEach((state, index) => {
      const plan = state.evaluation;
      if (!plan.comparisonEligible || !plan.forecastManifestId
        || (categoryMode ? !plan.categoryResults.length || plan.categoryResults.some(row => !finite(row.own)) : !finite(plan.projectedValue))) return;
      const key = JSON.stringify(stableValue({ objective: plan.objective, manifest: plan.forecastManifestId,
        activeGames: plan.activeGames, outcome: categoryMode ? plan.categoryResults : plan.projectedValue, goalie: plan.goalie,
        preferredGoalieStarts: intent.goalieCoverage === "cover" && intent.goalieWindow !== "any"
          ? plan.assignments.filter(row => row.slotId.startsWith("G#") && preferredGoalieDate(row.date, intent)).length : null,
        // Category acquisition-period tradeoffs retain the existing partial order.
        categoryCost: categoryMode ? { acquisitions: plan.acquisitions, adds: adds(state) } : null }));
      const group = groups.get(key) ?? [];
      group.push(index); groups.set(key, group);
    });
    for (const indices of groups.values()) {
      const equivalent = indices.map(index => states[index]).sort((a, b) => adds(a) - adds(b) || drops(a) - drops(b) || stableOrder(a, b));
      indices.forEach((index, offset) => { states[index] = equivalent[offset]; });
    }
  };
  const noMoves: Record<PlanningObjective, State> = { agp: { steps: [], evaluation: noMoveAgp }, outcome: { steps: [], evaluation: noMoveOutcome } };
  const frontiers: Record<PlanningObjective, State[]> = { agp: [noMoves.agp], outcome: [noMoves.outcome] };
  let evaluated = 3, generated = 0, maxDepthReached = 0, complete = true, beamPruned = false, phasePruned = false, timedOut = false;
  const phaseBudget = maxSteps ? Math.max(1, Math.floor((maxEvaluations - evaluated) / (maxSteps * 2))) : 0;
  const all: State[] = [], seen = new Set(["agp:", "outcome:"]);
  for (let depth = 0; depth < maxSteps; depth++) {
    let anyNext = false;
    for (const searchObjective of ["agp", "outcome"] as const) {
      const next: State[] = [];
      const completedCheckpoint = all.length;
      let phaseEvaluated = 0;
      for (const state of frontiers[searchObjective]) {
        if (depth > 0 && state.steps.length === 0) continue;
        for (const addition of extensions(snapshot, intent, state.steps, candidates)) {
          generated++;
          const steps = [...state.steps, ...addition];
          const key = `${searchObjective}:` + steps.map(step => `${step.type}:${step.playerId}:${step.dropPlayerId ?? ""}:${step.reservePosition ?? ""}:${step.effectiveAt}`).join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          const evaluation = evaluatePlan(snapshot, intent, searchObjective, steps, false);
          evaluated++;
          phaseEvaluated++;
          if (evaluation.legal && evaluation.budgetVerified) {
            const candidate = { steps, evaluation }; next.push(candidate); all.push(candidate);
            maxDepthReached = Math.max(maxDepthReached, steps.filter(step => step.type === "add").length);
          }
          if (evaluated >= maxEvaluations) { complete = false; break; }
          if (timeBudgetMs !== Infinity && Date.now() - start >= timeBudgetMs) {
            timedOut = true;
            complete = false;
            all.length = completedCheckpoint;
            maxDepthReached = all.reduce((max, state) => Math.max(max,
              state.steps.filter(step => step.type === "add").length), 0);
            break;
          }
          if (phaseEvaluated >= phaseBudget) { phasePruned = true; break; }
        }
        if (!complete || phaseEvaluated >= phaseBudget) break;
      }
      if (!complete) break;
      // Different acquisition prefixes may have different future extensions.
      // Keep them until the existing disclosed beam bound; current category
      // dominance alone cannot prove their extension paths interchangeable.
      const retained = next;
      orderStates(retained, searchObjective);
      if (retained.length) anyNext = true;
      if (retained.length > beamWidth - 1) beamPruned = true;
      frontiers[searchObjective] = [noMoves[searchObjective], ...retained.slice(0, beamWidth - 1)];
    }
    if (!complete || !anyNext) break;
  }
  if (!complete) limitations.add(timedOut
    ? "Search time limit interrupted a phase; plans use the last completed search checkpoint."
    : "Search work quota exhausted; plans are best found in the evaluated search, not proven optimal.");
  if (phasePruned) limitations.add("Per-depth sampling left candidate transitions unexplored.");
  if (beamPruned) limitations.add("Beam width pruned feasible plans; search is incomplete.");
  const depthPruned = maxSteps === 0 ? candidates.length > 0 : (["agp", "outcome"] as const).some(searchObjective => frontiers[searchObjective].slice(1).some(state => !extensions(snapshot, intent, state.steps, candidates).next().done));
  if (depthPruned) limitations.add("Acquisition depth limit left additional sequences unexplored.");
  if (categoryMode) limitations.add("Category alternatives use projected means without calibrated joint scenarios and are not globally ranked. Presentation order is deterministic; incomparable supported tradeoffs remain available within search bounds.");
  orderStates(all, objective);
  const supported = all.filter(state => state.steps.length && safeAlternative(snapshot, state.evaluation.objective === "agp" ? noMoveAgp : noMoveOutcome, state.evaluation, coverageTarget));
  const retained = categoryMode ? supported.filter(candidate => !supported.some(other => other.evaluation.objective === candidate.evaluation.objective
    && compareCategoryEvaluations(snapshot, other.evaluation, candidate.evaluation, coverageTarget) === "better")) : supported;
  const alternatives = [baseline, ...retained.map(state => state.evaluation)].slice(0, intent.alternativeCount);
  const categoryLineupBounded = categoryMode && [noMoveAgp, noMoveOutcome, selected, ...alternatives]
    .some(plan => plan.limitations.some(text => text.startsWith("Category lineup analysis is bounded and incomplete")));
  // Only returned plans receive bench evidence. Counterfactuals never recursively
  // explain themselves, and identical objective/intent inputs reuse one result.
  const explained = new Map<string, PlanEvaluation>();
  const explain = (evaluation: PlanEvaluation) => {
    const key = `${evaluation.objective}:${JSON.stringify(evaluation.steps)}`;
    if (!explained.has(key)) {
      const needsEvidence = evaluation.objective === "outcome" && evaluation.recommendation?.eligible
        && evaluation.recommendation.exclusions?.some(row => !["locked_bench", "locked_capacity", "weekly_lock", "ineligible"].includes(row.reason));
      explained.set(key, !needsEvidence ? evaluation : reserveBenchEvaluation(benchBudget)
        ? evaluatePlan(snapshot, intent, evaluation.objective, evaluation.steps, true, benchBudget)
        : deferBenchDecisions(evaluation));
    }
    return explained.get(key)!;
  };
  // Prioritize the user's selected plan; repeated baseline/selected plans share a receipt.
  const selectedExplained = explain(selected), baselineExplained = explain(baseline);
  const noMoveAgpExplained = explain(noMoveAgp), noMoveOutcomeExplained = explain(noMoveOutcome);
  const alternativesExplained = alternatives.map(explain).map(evaluation => {
    if (evaluation.objective !== "agp" || !evaluation.steps.some(step => step.dropPlayerId || step.type === "drop")
      || evaluation.comparisonEligible && noMoveAgp.comparisonEligible || !evaluation.recommendation) return evaluation;
    const retainedGames = new Set(evaluation.assignments.map(row => `${row.playerId}:${row.gameId}:${row.date}`));
    const dropped = new Set(evaluation.steps.flatMap(step => step.dropPlayerId ? [step.dropPlayerId] : step.type === "drop" ? [step.playerId] : []));
    const reasons = ["Hypothetical schedule comparison using supplied availability and drop permissions; net fantasy points and drop cost are unknown.",
      ...[...dropped].map(id => {
        const lost = noMoveAgp.assignments.filter(row => row.playerId === id && !retainedGames.has(`${row.playerId}:${row.gameId}:${row.date}`)).length;
        return `Dropping ${snapshot.players.find(player => player.id === id)?.name ?? id}: ${lost} scheduled active games from the no-move lineup are absent in this plan; fantasy-point cost is unknown.`;
      })];
    return { ...evaluation, recommendation: { ...evaluation.recommendation, eligible: false, mode: "schedule_capacity" as const,
      reasons: [...evaluation.recommendation.reasons, ...reasons] }, limitations: [...evaluation.limitations, ...reasons] };
  });
  const continuationsExplained = noClaimContinuations.map(row => ({ ...row, evaluation: explain(row.evaluation) }));
  const benchComplete = !benchBudget.workQuotaReached && !benchBudget.timeLimitReached;
  if (!benchComplete) limitations.add(benchBudget.timeLimitReached
    ? "Bench explanations reached the response time limit; unchecked scoring decisions remain unresolved."
    : "Bench explanations reached their work quota; unchecked scoring decisions remain unresolved.");
  return { snapshotId: snapshot.id, intentRevision: intent.revision, baseline: baselineExplained,
    noMoveAgp: noMoveAgpExplained, noMoveOutcome: noMoveOutcomeExplained, selected: selectedExplained,
    alternatives: alternativesExplained, noClaimContinuations: continuationsExplained, scheduleFits: fitResult.fits,
    search: { policyVersion: "rso-search-v3", evaluated, candidates: generated, maxDepthReached,
      complete: complete && fitResult.complete && !phasePruned && coverageComplete && !beamPruned && !depthPruned && benchComplete && !categoryLineupBounded,
      elapsedMs: Date.now() - start, limitations: [...limitations], benchEvidence: { policyVersion: "rso-bench-v1",
        evaluated: benchBudget.evaluated, maxEvaluations: benchBudget.maxEvaluations, complete: benchComplete,
        workQuotaReached: benchBudget.workQuotaReached, timeLimitReached: benchBudget.timeLimitReached } } };
}

/** Full candidate metrics; run off the UI thread. Missing rows remain unknown. */
export function candidateMetrics(snapshot: PlanningSnapshot, intent: PlanIntent) {
  const points = candidateHorizonPoints(snapshot);
  const activePoints = candidateActivePoints(snapshot, intent, points);
  const baseline = evaluatePlan(snapshot, { ...intent, goalieCoverage: "accept_risk" }, "agp", [], false);
  const fits = scheduleFits(snapshot, intent, baseline, Infinity, Infinity, true).fits;
  return { points: [...points], activePoints: [...activePoints],
    activeGames: fits.flatMap(fit => fit.playerIds.map(id => [id, fit.addedGames] as [string, number])) };
}
