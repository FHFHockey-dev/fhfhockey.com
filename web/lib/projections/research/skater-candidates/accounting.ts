/** Offline candidates only. No production imports or default fitted coefficients. */
export type Position = "F" | "D";
export type Strength = "ES" | "PP" | "SH";
export type CountExposure = { events: number; exposure: number };
export type RatePrior = { mean: number; exposure: number };

export function nonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}

/** Exposure and prior exposure must have the same units; absent evidence is not a zero. */
export function shrinkRate(observed: CountExposure | null, prior: RatePrior | null): number | null {
  if (observed) {
    nonNegative(observed.events, "events");
    nonNegative(observed.exposure, "exposure");
    if (observed.exposure === 0 && observed.events > 0) throw new Error("Events without exposure");
  }
  if (prior) {
    nonNegative(prior.mean, "prior mean");
    nonNegative(prior.exposure, "prior exposure");
  }
  const exposure = (observed?.exposure ?? 0) + (prior?.exposure ?? 0);
  return exposure > 0 ? ((observed?.events ?? 0) + (prior?.mean ?? 0) * (prior?.exposure ?? 0)) / exposure : null;
}

/** Assists / on-ice goals, not assists / the player's goals. k is in on-ice goals. */
export function projectAssists(args: {
  expectedOnIceGoals: number;
  history: { assists: number; onIceGoals: number } | null;
  prior: RatePrior | null;
}) {
  nonNegative(args.expectedOnIceGoals, "expected on-ice goals");
  if (args.history && args.history.assists > args.history.onIceGoals) throw new Error("Assists exceed on-ice goals");
  if (args.prior && args.prior.mean > 1) throw new Error("Assist share exceeds one");
  const share = shrinkRate(args.history ? { events: args.history.assists, exposure: args.history.onIceGoals } : null, args.prior);
  return { share, assists: args.expectedOnIceGoals === 0 ? 0 : share === null ? null : args.expectedOnIceGoals * share };
}

/** Proportional allocation with hard capacities. Never invent weights for unsupported players. */
function allocate(total: number, rows: { id: number; weight: number; capacity: number }[]): number[] | null {
  nonNegative(total, "allocation total");
  const ids = new Set<number>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || ids.has(row.id)) throw new Error("Invalid or duplicate player identity");
    ids.add(row.id);
    nonNegative(row.weight, "allocation weight");
    nonNegative(row.capacity, "allocation capacity");
  }
  if (total === 0) return rows.map(() => 0);
  if (rows.reduce((sum, row) => sum + (row.weight > 0 ? row.capacity : 0), 0) + 1e-9 < total) return null;
  const values = rows.map(() => 0);
  let active = rows.map((_, i) => i).filter((i) => rows[i].weight > 0 && rows[i].capacity > 0);
  let remaining = total;
  while (active.length > 0 && remaining > 0) {
    const weights = active.reduce((sum, i) => sum + rows[i].weight, 0);
    const capped = active.filter((i) => remaining * rows[i].weight / weights > rows[i].capacity);
    if (capped.length === 0) {
      for (const i of active) values[i] = remaining * rows[i].weight / weights;
      break;
    }
    for (const i of capped) { values[i] = rows[i].capacity; remaining -= values[i]; }
    active = active.filter((i) => !capped.includes(i));
  }
  return values;
}

/**
 * A complete team-strength roster is required. The observed team A/G ratio is a
 * separate input; summing player on-ice goals would count each goal several times.
 * A player cannot assist their own goal. Infeasible targets remain unresolved.
 */
export function reconcileTeamAssists(args: {
  completeRoster: boolean;
  teamGoals: number;
  observedTeamAssistsPerGoal: number;
  players: { id: number; goals: number; onIceGoals: number; assists: number | null }[];
}) {
  nonNegative(args.teamGoals, "team goals");
  nonNegative(args.observedTeamAssistsPerGoal, "team assists per goal");
  if (args.observedTeamAssistsPerGoal > 2) throw new Error("At most two assists per goal");
  const target = args.teamGoals * args.observedTeamAssistsPerGoal;
  const blocked = (reason: string) => ({ status: "blocked" as const, reason, target, players: null });
  if (!args.completeRoster) return blocked("incomplete_roster");
  for (const p of args.players) {
    nonNegative(p.goals, "player goals");
    nonNegative(p.onIceGoals, "player on-ice goals");
    if (p.goals > p.onIceGoals + 1e-9 || p.onIceGoals > args.teamGoals + 1e-9) throw new Error("Inconsistent goal accounting");
    if (p.assists === null) return blocked("missing_assist_support");
  }
  if (Math.abs(args.players.reduce((sum, p) => sum + p.goals, 0) - args.teamGoals) > 1e-8) return blocked("player_goals_do_not_reconcile");
  const values = allocate(target, args.players.map((p) => ({ id: p.id, weight: p.assists!, capacity: Math.max(0, p.onIceGoals - p.goals) })));
  if (!values) return blocked("insufficient_supported_assist_capacity");
  return { status: "ok" as const, reason: null, target, players: args.players.map((p, i) => ({ ...p, assists: values[i] })) };
}

/** Explicit skater-seconds budget supports 4v5/3v5 mixtures; no assumed PK manpower. */
export function allocatePkMinutes(args: {
  teamPkSkaterSeconds: number;
  players: { id: number; totalSeconds: number; ppSeconds: number; pkWeight: number }[];
}) {
  for (const p of args.players) {
    nonNegative(p.totalSeconds, "total seconds");
    nonNegative(p.ppSeconds, "PP seconds");
    if (p.ppSeconds > p.totalSeconds) throw new Error("PP exceeds total exposure");
  }
  const values = allocate(args.teamPkSkaterSeconds, args.players.map((p) => ({ id: p.id, weight: p.pkWeight, capacity: p.totalSeconds - p.ppSeconds })));
  return values === null ? null : args.players.map((p, i) => ({
    id: p.id, esSeconds: p.totalSeconds - p.ppSeconds - values[i], ppSeconds: p.ppSeconds, shSeconds: values[i],
  }));
}

/** SH rates are per 60 minutes; shrinkage exposure is minutes, not games or shots. */
export function projectShorthanded(args: {
  pkSeconds: number;
  history: { toiSeconds: number; goals: number | null; assists: number | null; shots: number | null } | null;
  priors: Record<"goals" | "assists" | "shots", { per60: number; minutes: number } | null>;
}) {
  nonNegative(args.pkSeconds, "PK seconds");
  if (args.history) nonNegative(args.history.toiSeconds, "SH history seconds");
  const head = (key: "goals" | "assists" | "shots") => {
    const events = args.history?.[key];
    const prior = args.priors[key];
    const ratePerMinute = shrinkRate(events == null ? null : { events, exposure: args.history!.toiSeconds / 60 },
      prior ? { mean: prior.per60 / 60, exposure: prior.minutes } : null);
    return args.pkSeconds === 0 ? 0 : ratePerMinute === null ? null : args.pkSeconds / 60 * ratePerMinute;
  };
  return { goals: head("goals"), assists: head("assists"), shots: head("shots") };
}

export type StrengthHeads = { goals: number | null; assists: number | null; shots: number | null };
/** Missing positive-exposure SH heads cannot silently produce complete G/A/SOG totals. */
export function combineStrengthHeads(heads: Record<Strength, StrengthHeads>) {
  const sum = (values: (number | null)[]) => {
    for (const value of values) if (value !== null) nonNegative(value, "projected count");
    return values.some((value) => value === null) ? null : (values as number[]).reduce((a, b) => a + b, 0);
  };
  return {
    G: sum([heads.ES.goals, heads.PP.goals, heads.SH.goals]),
    A: sum([heads.ES.assists, heads.PP.assists, heads.SH.assists]),
    SOG: sum([heads.ES.shots, heads.PP.shots, heads.SH.shots]),
    PPP: sum([heads.PP.goals, heads.PP.assists]), SHP: sum([heads.SH.goals, heads.SH.assists]),
  };
}
