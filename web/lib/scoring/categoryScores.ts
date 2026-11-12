import {
  canonicalStatKey,
  getCategoryRegistryEntry,
  resolveStatDirection,
  statAppliesToRole,
  type StatDirection,
} from "lib/projectionsConfig/statsMasterList";

export type CategoryScorePlayer = {
  id: string;
  role: "skater" | "goalie";
  values: Record<string, number | null | undefined>;
};

/**
 * Category value contract (owner decision 62; audit W1 P0 #30, BC W1-12 R1).
 *
 * - Counting categories are z-scored against a reference pool of the same role.
 * - Ratio categories (SV%, GAA, SH%, FO%, TOI/G) are valued by their effect on
 *   roster totals: numerator − poolRate × denominator (sign follows the
 *   category's direction), e.g. saves above the pool's SV% on the goalie's own
 *   shots against, and goals prevented at the pool GAA over the goalie's own
 *   minutes (TOI, not starts). That impact is then z-scored like a count.
 * - No second shrink: projections are already regressed by their sources.
 * - Unknown stays unknown: a weighted category the player lacks (or lacks the
 *   exposure for) leaves the player's score null, never average or zero.
 * - Reference pool: when `referencePool` gives the league's rostered count per
 *   role, means, SDs and pool rates come from the top N of that role
 *   (iterated); otherwise every projected player of the role is the pool.
 */
export type CategoryScoreOptions = {
  /** League direction overrides from the provider (decision 55). */
  directions?: Readonly<Record<string, StatDirection>>;
  /** League-aware reference pool size per role (rostered slots). */
  referencePool?: { skater?: number; goalie?: number };
};

export type CategoryScoreDetail = {
  /** Sum of weighted z values; null when any weighted category is unknown. */
  score: number | null;
  /** Weighted z contribution per category key; null when unknown. */
  contributions: Record<string, number | null>;
  /** Weighted categories that apply to the player and are unknown. */
  missing: string[];
};

export type CategoryReference = {
  kind: "league-pool" | "all-projected";
  size: Record<"skater" | "goalie", number>;
  /** Pool rate used for each ratio category (role → key → rate). */
  poolRates: Record<"skater" | "goalie", Record<string, number | null>>;
};

const DEFAULT_CATEGORIES = [
  "GOALS",
  "ASSISTS",
  "PP_POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
];

const POOL_ITERATIONS = 3;

/** Goalie categories route through the shared registry. */
export function isGoalieCategory(key: string) {
  return getCategoryRegistryEntry(key)?.role === "goalie";
}

/** Default lower-is-better direction from the shared registry. */
export function isInvertedCategory(
  key: string,
  directions?: Readonly<Record<string, StatDirection>>,
) {
  return resolveStatDirection(key, { overrides: directions }) === "lower";
}

export function categoryAppliesToRole(key: string, role: "skater" | "goalie") {
  return statAppliesToRole(key, role);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readValue(player: CategoryScorePlayer, key: string): number | null {
  const direct = player.values[key];
  if (finite(direct)) return direct;
  const canonical = canonicalStatKey(key);
  const aliased = player.values[canonical];
  if (finite(aliased)) return aliased;
  for (const [alias, target] of Object.entries({
    GAMES_STARTED: "GAMES_STARTED_GOALIE",
    TOI_PER_GAME: "TIME_ON_ICE_PER_GAME",
  })) {
    if (target === canonical && finite(player.values[alias])) {
      return player.values[alias] as number;
    }
  }
  return null;
}

type Components = { numerator: number; denominator: number };

/**
 * A player's ratio components. Missing components are derived only from the
 * player's own supplied values (never from the pool), and only where the
 * registry declares the rate's units. Missing exposure stays unknown.
 */
function ratioComponents(
  player: CategoryScorePlayer,
  key: string,
): Components | null {
  const entry = getCategoryRegistryEntry(key);
  const ratio = entry?.ratio;
  if (!ratio) return null;
  let numerator = readValue(player, ratio.numerator);
  let denominator: number | null = 0;
  for (const part of ratio.denominator) {
    if (part === ratio.numerator) {
      denominator = numerator == null ? null : (denominator ?? 0) + numerator;
      continue;
    }
    let value = readValue(player, part);
    // SA = saves + goals against when SA itself is not supplied.
    if (value == null && part === "SHOTS_AGAINST_GOALIE") {
      const saves = readValue(player, "SAVES_GOALIE");
      const against = readValue(player, "GOALS_AGAINST_GOALIE");
      if (saves != null && against != null) value = saves + against;
    }
    denominator = value == null || denominator == null ? null : denominator + value;
  }
  const rate = readValue(player, entry.key);
  if (ratio.rateUnitsDeclared && rate != null) {
    if (entry.key === "SAVE_PERCENTAGE" && (rate < 0 || rate > 1)) return null;
    if (numerator == null && denominator != null) {
      numerator = (rate * denominator) / ratio.scale;
    } else if (denominator == null && numerator != null && rate > 0) {
      denominator = (numerator * ratio.scale) / rate;
    }
  }
  if (numerator == null || denominator == null || denominator < 0 || numerator < 0) {
    return null;
  }
  return { numerator, denominator };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

type RoleStats = {
  rate: number | null;
  mean: number | null;
  sd: number | null;
};

export function calculateCategoryScoreDetails(
  players: readonly CategoryScorePlayer[],
  categoryWeights: Record<string, number>,
  options: CategoryScoreOptions = {},
): { players: Map<string, CategoryScoreDetail>; reference: CategoryReference } {
  const keys = Object.keys(categoryWeights).length
    ? Object.keys(categoryWeights).filter((key) => {
        const weight = categoryWeights[key];
        return !finite(weight) || weight !== 0;
      })
    : DEFAULT_CATEGORIES;
  const weightOf = (key: string) =>
    finite(categoryWeights[key]) ? Math.abs(categoryWeights[key]) : 1;
  const directionOf = (key: string) =>
    resolveStatDirection(key, {
      overrides: options.directions,
      weight: categoryWeights[key],
    });

  // Raw per-player inputs, independent of the pool.
  const inputs = new Map<string, Record<string, number | Components | null>>();
  for (const player of players) {
    const record: Record<string, number | Components | null> = {};
    for (const key of keys) {
      if (!categoryAppliesToRole(key, player.role)) continue;
      const entry = getCategoryRegistryEntry(key);
      record[key] =
        entry?.aggregation === "ratio"
          ? ratioComponents(player, key)
          : readValue(player, key);
    }
    inputs.set(player.id, record);
  }

  const impact = (
    input: number | Components | null,
    key: string,
    stats: RoleStats,
  ): number | null => {
    if (input == null) return null;
    const sign = directionOf(key) === "lower" ? -1 : 1;
    if (typeof input === "number") return input;
    if (stats.rate == null) return null;
    const scale = getCategoryRegistryEntry(key)?.ratio?.scale ?? 1;
    // Effect on roster totals relative to the pool rate.
    return sign * (input.numerator - (stats.rate * input.denominator) / scale);
  };

  const computeStats = (pool: readonly CategoryScorePlayer[]) => {
    const stats: Record<"skater" | "goalie", Record<string, RoleStats>> = {
      skater: {},
      goalie: {},
    };
    for (const role of ["skater", "goalie"] as const) {
      const members = pool.filter((player) => player.role === role);
      for (const key of keys) {
        if (!categoryAppliesToRole(key, role)) continue;
        const entry = getCategoryRegistryEntry(key);
        let rate: number | null = null;
        if (entry?.aggregation === "ratio") {
          let numerator = 0;
          let denominator = 0;
          for (const member of members) {
            const input = inputs.get(member.id)?.[key];
            if (input && typeof input !== "number") {
              numerator += input.numerator;
              denominator += input.denominator;
            }
          }
          rate = denominator > 0 ? ((entry.ratio?.scale ?? 1) * numerator) / denominator : null;
        }
        const partial: RoleStats = { rate, mean: null, sd: null };
        const values = members
          .map((member) => impact(inputs.get(member.id)?.[key] ?? null, key, partial))
          .filter(finite);
        partial.mean = values.length ? mean(values) : null;
        partial.sd = values.length ? sampleSd(values) : null;
        stats[role][key] = partial;
      }
    }
    return stats;
  };

  const score = (
    stats: Record<"skater" | "goalie", Record<string, RoleStats>>,
  ) => {
    const details = new Map<string, CategoryScoreDetail>();
    for (const player of players) {
      const contributions: Record<string, number | null> = {};
      const missing: string[] = [];
      let total = 0;
      for (const key of keys) {
        if (!categoryAppliesToRole(key, player.role)) continue;
        const roleStats = stats[player.role][key];
        const value = impact(inputs.get(player.id)?.[key] ?? null, key, roleStats);
        if (value == null) {
          contributions[key] = null;
          missing.push(key);
          continue;
        }
        // A category with no spread in the pool separates nobody: 0 for all.
        const z =
          roleStats.mean == null || !roleStats.sd
            ? 0
            : (directionOf(key) === "lower" && getCategoryRegistryEntry(key)?.aggregation !== "ratio"
                ? roleStats.mean - value
                : value - roleStats.mean) / roleStats.sd;
        const contribution = weightOf(key) * z;
        contributions[key] = contribution;
        total += contribution;
      }
      details.set(player.id, {
        score: missing.length ? null : total,
        contributions,
        missing,
      });
    }
    return details;
  };

  const poolSizes = options.referencePool;
  let pool: readonly CategoryScorePlayer[] = players;
  let stats = computeStats(pool);
  let details = score(stats);
  const leagueAware =
    poolSizes != null &&
    (["skater", "goalie"] as const).some((role) => finite(poolSizes[role]) && (poolSizes[role] as number) > 0);
  if (leagueAware) {
    for (let iteration = 0; iteration < POOL_ITERATIONS; iteration += 1) {
      const next: CategoryScorePlayer[] = [];
      for (const role of ["skater", "goalie"] as const) {
        const members = players.filter((player) => player.role === role);
        const size = poolSizes?.[role];
        if (!finite(size) || size <= 0) {
          next.push(...members);
          continue;
        }
        // Order-invariant selection: score desc, then id; unknowns excluded.
        const ranked = members
          .filter((player) => details.get(player.id)?.score != null)
          .sort(
            (a, b) =>
              (details.get(b.id)!.score as number) -
                (details.get(a.id)!.score as number) ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
          );
        next.push(...ranked.slice(0, Math.floor(size)));
      }
      pool = next;
      stats = computeStats(pool);
      details = score(stats);
    }
  }

  const size = {
    skater: pool.filter((player) => player.role === "skater").length,
    goalie: pool.filter((player) => player.role === "goalie").length,
  };
  const poolRates: CategoryReference["poolRates"] = { skater: {}, goalie: {} };
  for (const role of ["skater", "goalie"] as const) {
    for (const [key, roleStats] of Object.entries(stats[role])) {
      if (getCategoryRegistryEntry(key)?.aggregation === "ratio") {
        poolRates[role][key] = roleStats.rate;
      }
    }
  }
  return {
    players: details,
    reference: { kind: leagueAware ? "league-pool" : "all-projected", size, poolRates },
  };
}

/**
 * Category value per player id, for players whose value is known. A player
 * absent from the map has an unknown value (a weighted category or its
 * exposure is missing): readers must not treat it as 0 or average. Use
 * `calculateCategoryScoreDetails` for the missing categories.
 */
export function calculateCategoryScores(
  players: readonly CategoryScorePlayer[],
  categoryWeights: Record<string, number>,
  options: CategoryScoreOptions = {},
): Map<string, number> {
  const { players: details } = calculateCategoryScoreDetails(
    players,
    categoryWeights,
    options,
  );
  const scores = new Map<string, number>();
  details.forEach((detail, id) => {
    if (detail.score !== null) scores.set(id, detail.score);
  });
  return scores;
}
