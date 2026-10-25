import { nonNegative } from "./accounting";

/** One causal effect, one owner and one channel. Magnitudes need separate qualification. */
export type ContextEffect =
  | { effect: "home"; owner: "team"; channel: "shotVolume" | "goalEnvironment"; multiplier: number; evidence: string }
  | { effect: "rest"; owner: "team"; channel: "opportunity" | "shotVolume" | "goalEnvironment"; multiplier: number; evidence: string }
  | { effect: "opponentGoalie"; owner: "team"; channel: "goalEnvironment"; multiplier: number; evidence: string }
  | { effect: "shotDanger"; owner: "skater"; channel: "finishing"; multiplier: number; evidence: string };
export type ContextBase = { seconds: number; shotsPer60: number; goalsPerShot: number; onIceGoalsPer60: number; assistShare: number };

/** Call on neutral inputs once; never feed previously context-adjusted counts back in. */
export function projectContext(base: ContextBase, effects: ContextEffect[]) {
  Object.entries(base).forEach(([name, value]) => nonNegative(value, name));
  if (base.goalsPerShot > 1 || base.assistShare > 1) throw new Error("Base share exceeds one");
  const factors = { opportunity: 1, shotVolume: 1, goalEnvironment: 1, finishing: 1 };
  const seen = new Set<string>();
  for (const effect of effects) {
    if (seen.has(effect.effect)) throw new Error(`Duplicate context ownership: ${effect.effect}`);
    seen.add(effect.effect);
    nonNegative(effect.multiplier, "context multiplier");
    if (!effect.evidence.trim()) throw new Error("Context evidence reference required");
    const valid = effect.effect === "home" ? effect.owner === "team" && ["shotVolume", "goalEnvironment"].includes(effect.channel)
      : effect.effect === "rest" ? effect.owner === "team" && ["opportunity", "shotVolume", "goalEnvironment"].includes(effect.channel)
        : effect.effect === "opponentGoalie" ? effect.owner === "team" && effect.channel === "goalEnvironment"
          : effect.effect === "shotDanger" && effect.owner === "skater" && effect.channel === "finishing";
    if (!valid) throw new Error("Invalid context owner or channel");
    factors[effect.channel] *= effect.multiplier;
  }
  const seconds = base.seconds * factors.opportunity;
  const shots = seconds / 3600 * base.shotsPer60 * factors.shotVolume;
  const conversion = base.goalsPerShot * factors.finishing * factors.goalEnvironment;
  if (conversion > 1) throw new Error("Context conversion exceeds one");
  const onIceGoals = seconds / 3600 * base.onIceGoalsPer60 * factors.goalEnvironment;
  return { seconds, shots, goals: shots * conversion, onIceGoals, assists: onIceGoals * base.assistShare, factors };
}

export function ablateContexts(base: ContextBase, effects: ContextEffect[]) {
  return { all: projectContext(base, effects), neutral: projectContext(base, []),
    omitted: Object.fromEntries(effects.map((effect) => [effect.effect, projectContext(base, effects.filter((entry) => entry.effect !== effect.effect))])) };
}

/** Law of total variance for a Poisson rate with random exposure, holding its mean fixed. */
export function opportunityCountMoments(args: { expectedSeconds: number; varianceSeconds: number; ratePer60: number }) {
  Object.entries(args).forEach(([name, value]) => nonNegative(value, name));
  if (args.expectedSeconds === 0 && args.varianceSeconds > 0) throw new Error("Nonnegative exposure with zero mean has zero variance");
  const ratePerSecond = args.ratePer60 / 3600;
  const mean = args.expectedSeconds * ratePerSecond;
  return { mean, variance: mean + ratePerSecond ** 2 * args.varianceSeconds,
    opportunityVariance: ratePerSecond ** 2 * args.varianceSeconds };
}
