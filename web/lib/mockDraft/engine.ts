import { getEffectiveRosterConfig } from "lib/draftDashboard/forwardGrouping";
import {
  ENGINE_VERSION,
  configSchema,
  freePersonalities,
  personalities,
  type BotDecision,
  type BotProfile,
  type MockConfig,
  type MockPlayer,
  type MockSession,
} from "./contracts";
import { contrarianAdjustment, researchAvailable, reviewedResearch } from "./research";
import { feasibleRosters } from "./feasibility";
import {
  buildPositionTiers,
  remainingBands,
  type PositionTiers,
} from "lib/draftDashboard/positionalTiers";

const tierCache = new WeakMap<MockPlayer[], Map<string, PositionTiers>>();
function sessionTiers(players: MockPlayer[]) {
  let tiers = tierCache.get(players);
  if (!tiers) {
    tiers = new Map(
      [...new Set(players.flatMap((p) => p.positions))].map((pos) => [
        pos,
        buildPositionTiers(
          pos,
          players
            .filter((p) => p.positions.includes(pos))
            .map((p) => ({
              id: p.id,
              name: p.name,
              value: p.value,
              adp: p.adp,
            })),
        ),
      ]),
    );
    tierCache.set(players, tiers);
  }
  return tiers;
}

export const tuning = {
  shortlist: 6,
  aggressiveShortlist: 10,
  needWeight: 0.28,
  scarcityWeight: 0.22,
  replacementWeight: 0.15,
};
export function random(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seatAt(pick: number, count: number) {
  const offset = (pick - 1) % count;
  return Math.floor((pick - 1) / count) % 2 ? count - offset - 1 : offset;
}
export function waitUntilNext(pick: number, count: number) {
  const seat = seatAt(pick, count);
  let next = pick + 1;
  while (seatAt(next, count) !== seat) next++;
  return next - pick - 1;
}
export function slots(config: Pick<MockConfig, "roster" | "grouping">) {
  const priority = ["C", "LW", "RW", "FWD", "D", "G", "utility", "bench"];
  return Object.entries(
    getEffectiveRosterConfig(config.roster, config.grouping),
  )
    .sort(([a], [b]) => priority.indexOf(a) - priority.indexOf(b))
    .flatMap(([key, count]) => Array.from({ length: count }, () => key));
}
export function fits(player: MockPlayer, slot: string) {
  return (
    slot === "bench" ||
    (slot === "utility"
      ? !player.positions.includes("G")
      : player.positions.includes(slot))
  );
}

/** Augmenting paths reassign dual-eligible players; greedy allocation can falsely fill a bench. */
export function allocate(players: MockPlayer[], slotList: string[]) {
  const assigned = new Map<number, number>();
  function place(index: number, seen: Set<number>): boolean {
    for (let s = 0; s < slotList.length; s++) {
      if (seen.has(s) || !fits(players[index], slotList[s])) continue;
      seen.add(s);
      const other = assigned.get(s);
      if (other === undefined || place(other, seen)) {
        assigned.set(s, index);
        return true;
      }
    }
    return false;
  }
  for (let p = 0; p < players.length; p++) place(p, new Set());
  return assigned;
}
export function roster(session: MockSession, seat: number) {
  const ids = new Set(
    session.picks.filter((p) => p.seat === seat).map((p) => p.playerId),
  );
  return session.players.filter((p) => ids.has(p.id));
}
export function available(session: MockSession) {
  const ids = new Set(session.picks.map((p) => p.playerId));
  return session.players.filter((p) => !ids.has(p.id));
}

/** All held players must remain assigned; free players can fill any team's remaining slots. */
export function canComplete(
  session: MockSession,
  candidate?: MockPlayer,
): boolean {
  const config = session.config,
    currentSeat = seatAt(session.picks.length + 1, config.teamCount);
  const held = session.picks.map((p) => ({
    player: session.players.find((v) => v.id === p.playerId)!,
    seat: p.seat,
  }));
  if (candidate) held.push({ player: candidate, seat: currentSeat });
  const ids = new Set(held.map((v) => v.player.id));
  const remaining = session.players.filter((p) => !ids.has(p.id));
  return feasibleRosters(
    config.teamCount,
    slots(config),
    held,
    remaining,
    fits,
  );
}
export function makeRoom(
  config: Pick<MockConfig, "teamCount" | "tier" | "roster"> & {
    userSeat?: number;
    season?: string;
  },
  seed: string,
): BotProfile[] {
  const rng = random(seed);
  const choices = (
    config.tier === "pro"
      ? personalities.filter((p) => p !== "Contrarian" || researchAvailable(config.season))
      : [...freePersonalities]
  )
    .map((p) => ({ p, order: rng() }))
    .sort((a, b) => a.order - b.order)
    .map((v) => v.p);
  const positions = Object.keys(config.roster).filter(
    (p) => !["bench", "utility"].includes(p) && config.roster[p] > 0,
  );
  let botIndex = 0;
  return Array.from({ length: config.teamCount }, (_, i) => ({
    personality:
      choices[(i === (config.userSeat ?? 0) ? 0 : botIndex++) % choices.length],
    position: positions[Math.floor(rng() * positions.length)],
    variation: rng(),
  }));
}
export function decide(
  session: MockSession,
  override?: BotProfile,
): BotDecision {
  const { config } = session,
    pick = session.picks.length + 1,
    seat = seatAt(pick, config.teamCount);
  const profile = override ?? config.bots[seat];
  const pool = available(session).sort(
    (a, b) => b.value - a.value || a.id.localeCompare(b.id),
  );
  const held = roster(session, seat),
    slotList = slots(config),
    assigned = allocate(held, slotList);
  const needs = slotList.filter((s, i) => s !== "bench" && !assigned.has(i));
  const wait = waitUntilNext(pick, config.teamCount);
  const planningWait =
    wait === 0 ? waitUntilNext(pick + 1, config.teamCount) : wait;
  const planningPick = wait === 0 ? pick + 1 : pick;
  const rng = random(`${session.seed}:selection:${pick}`);
  const range = Math.max(
    1,
    (pool[0]?.value ?? 1) -
      (pool[Math.min(pool.length - 1, config.teamCount * 3)]?.value ?? 0),
  );
  const availableIds = new Set(pool.map((p) => p.id));
  const tiers = config.tier === "pro" ? sessionTiers(session.players) : null;
  const positionContext = new Map(
    [...new Set(pool.flatMap((p) => p.positions))].map((pos) => {
      const positionPool = pool.filter((p) => p.positions.includes(pos));
      const demand =
        config.tier === "pro"
          ? Array.from({ length: planningWait }, (_, i) =>
              seatAt(planningPick + 1 + i, config.teamCount),
            ).reduce((sum, opponent) => {
              const theirs = roster(session, opponent),
                filled = allocate(theirs, slotList);
              return (
                sum +
                (slotList.some((s, j) => s === pos && !filled.has(j))
                  ? 1
                  : 0.25)
              );
            }, 0)
          : 1;
      const replacement =
        positionPool[
          Math.min(positionPool.length - 1, Math.max(1, Math.round(demand)))
        ];
      const fullPool = session.players
        .filter((p) => p.positions.includes(pos))
        .sort((a, b) => b.value - a.value);
      const baseline =
        fullPool[
          Math.min(
            fullPool.length - 1,
            Math.max(0, (config.roster[pos] ?? 0) * config.teamCount - 1),
          )
        ]?.value ?? 0;
      const bands = tiers?.get(pos);
      return [
        pos,
        {
          positionPool,
          replacement,
          baseline,
          bands: bands ? remainingBands(bands, availableIds) : [],
        },
      ];
    }),
  );
  const ranked = pool.map((p, rank) => {
    const pos = p.positions.find((v) => needs.includes(v)) ?? p.positions[0];
    const { positionPool, replacement, baseline, bands } =
      positionContext.get(pos)!;
    const scarcity =
      Math.max(0, p.value - (replacement?.value ?? p.value)) / range;
    const needed = needs.some((s) => fits(p, s));
    const market = p.adp ?? rank + 1;
    let score = (p.value - (pool[0]?.value ?? 0)) / range;
    score += ((p.value - baseline) / range) * tuning.replacementWeight;
    const reasons = ["League-adjusted value"];
    score -=
      Math.max(0, market - pick) /
      (config.teamCount * (profile.personality === "Vanilla" ? 1 : 4));
    score += needed
      ? profile.personality === "Conservative"
        ? 0.65
        : tuning.needWeight
      : -0.25;
    if (needed) reasons.push("Fills a roster need");
    const samePosition = held.filter((q) => q.positions.includes(pos)).length;
    score -= Math.max(0, samePosition - (config.roster[pos] ?? 0)) * 0.25;
    if (config.tier === "pro") {
      score +=
        scarcity *
        tuning.scarcityWeight *
        Math.min(2, planningWait / config.teamCount);
      const band = bands.find((b) => b.remaining.some((v) => v.id === p.id));
      if (
        needed &&
        band?.meaningfulBreak &&
        band.remaining.length <= Math.max(1, planningWait / 2)
      ) {
        score += Math.min(0.3, (band.gap ?? 0) / range);
        reasons.push("A positional tier is nearly exhausted");
      }
      if (scarcity > 0.2 && needed)
        reasons.push("Positional drop before the next turn");
      if (config.leagueType === "categories") {
        const keys = Object.keys(p.categories);
        const weakness = keys.reduce(
          (sum, key) =>
            sum +
            p.categories[key] /
              (1 +
                Math.max(
                  0,
                  held.reduce(
                    (total, q) => total + (q.categories[key] ?? 0),
                    0,
                  ),
                )),
          0,
        );
        score += Math.max(-0.2, Math.min(0.2, weakness * 0.04));
      }
    } else score += Math.min(0.15, scarcity * 0.08);
    const progress = held.length / slotList.length;
    if (profile.personality === "Zero-G" && p.positions.includes("G"))
      score -= Math.max(0, 0.9 - progress) * 1.5;
    if (
      profile.personality === "Fade" &&
      p.positions.includes(profile.position ?? "C")
    )
      score -= (1 - progress) * 0.65;
    if (
      profile.personality === "Reach" &&
      p.positions.includes(profile.position ?? "D") &&
      needed
    )
      score += 0.5 + scarcity * 0.3;
    if (
      profile.personality === "Hero-G" &&
      p.positions.includes("G") &&
      !held.some((q) => q.positions.includes("G")) &&
      p.workload !== null &&
      positionPool.indexOf(p) < Math.max(2, Math.ceil(config.teamCount / 3))
    ) {
      score +=
        Math.min(0.9, p.workload / 70) * (p.workloadKind === "games" ? 0.6 : 1);
      reasons.push("Top-tier goalie with projected workload");
    }
    const research =
      reviewedResearch.version === session.researchVersion && researchAvailable(config.season)
        ? reviewedResearch.players.find(
            (v) => v.playerId === p.id && v.formats.includes(config.leagueType),
          )
        : undefined;
    if (profile.personality === "Contrarian" && research) {
      score += contrarianAdjustment(research);
      reasons.push(`Research: ${research.tags.join(", ")} (${research.confidence} confidence)`);
    }
    if (profile.personality === "BPA")
      score += ((p.value - (pool[0]?.value ?? 0)) / range) * 0.4;
    return { player: p, score, reasons, rank, market, needed, scarcity };
  });
  const width =
    profile.personality === "Aggressive" && config.tier === "pro"
      ? tuning.aggressiveShortlist
      : tuning.shortlist;
  const plausible = ranked.filter(
    (p) =>
      p.rank < config.teamCount * 2 ||
      p.market <= pick + config.teamCount * 2 ||
      (p.needed && p.scarcity > 0.2),
  );
  const shortlist: typeof ranked = [];
  for (const row of (plausible.length ? plausible : ranked).sort(
    (a, b) => b.score - a.score || a.player.id.localeCompare(b.player.id),
  )) {
    if (canComplete(session, row.player)) shortlist.push(row);
    if (shortlist.length === width) break;
  }
  // Roster feasibility can legitimately force a pick outside the ordinary reach window.
  if (!shortlist.length)
    for (const row of ranked.sort((a, b) => b.score - a.score)) {
      if (canComplete(session, row.player)) {
        shortlist.push(row);
        row.reasons.push("Required to complete legal rosters");
        break;
      }
    }
  if (!shortlist.length)
    throw new Error(
      "No selection can complete all required rosters. Restart with a deeper player pool or different roster settings.",
    );
  if (
    config.tier === "pro" &&
    wait === 0 &&
    pick < config.teamCount * slotList.length
  ) {
    for (const row of shortlist) {
      const after = [...held, row.player],
        filled = allocate(after, slotList);
      const next = shortlist
        .filter((v) => v !== row)
        .map(
          (v) =>
            v.score +
            (slotList.some(
              (s, i) => s !== "bench" && !filled.has(i) && fits(v.player, s),
            )
              ? 0.35
              : 0),
        );
      row.score += Math.max(...next, 0) * 0.3;
      row.reasons.push("Plans both picks at the turn");
    }
  }
  const temperature =
    profile.personality === "Vanilla" || profile.personality === "BPA"
      ? 0.08
      : (profile.personality === "Aggressive" ? 0.22 : 0.13) +
        profile.variation * 0.04;
  const max = Math.max(...shortlist.map((v) => v.score));
  const weights = shortlist.map((v) => Math.exp((v.score - max) / temperature));
  let draw = rng() * weights.reduce((a, b) => a + b, 0),
    chosen = shortlist[0];
  for (let i = 0; i < weights.length; i++) {
    draw -= weights[i];
    if (draw <= 0) {
      chosen = shortlist[i];
      break;
    }
  }
  return {
    playerId: chosen.player.id,
    reasons: [...chosen.reasons, profile.personality],
    shortlist: shortlist.map((v) => ({
      playerId: v.player.id,
      score: v.score,
    })),
  };
}
export function delayMs(session: MockSession) {
  const rng = random(`${session.seed}:delay:${session.picks.length + 1}`),
    bucket = rng();
  const fraction =
    bucket < 0.25
      ? 0.1 + rng() * 0.15
      : bucket < 0.8
        ? 0.35 + rng() * 0.35
        : bucket < 0.95
          ? 0.85 + rng() * 0.14
          : 1;
  return Math.round(session.config.seconds * 1000 * fraction);
}
export function newSession(
  config: MockConfig,
  players: MockPlayer[],
  seed: string,
  id: string,
  contributor: string | null,
  consent: boolean,
): MockSession {
  configSchema.parse(config);
  if (
    !Number.isInteger(config.userSeat) ||
    config.userSeat < 0 ||
    config.userSeat >= config.teamCount ||
    config.bots.length !== config.teamCount ||
    ![15, 30, 60, 90, 120].includes(config.seconds)
  )
    throw new Error("Invalid mock seat, room, or clock settings.");
  if (
    config.bots.some(
      (b) =>
        !personalities.includes(b.personality) ||
        (config.tier === "free" &&
          !freePersonalities.includes(b.personality)) ||
        (b.personality === "Contrarian" &&
          reviewedResearch?.season !== config.season),
    )
  )
    throw new Error("This room includes an unavailable personality.");
  const session: MockSession = {
    version: 1,
    id,
    engineVersion: ENGINE_VERSION,
    researchVersion:
      reviewedResearch?.season === config.season
        ? reviewedResearch.version
        : null,
    seed,
    config,
    players,
    picks: [],
    queue: [],
    status: "paused",
    pending: null,
    contributor,
    consent,
    withdrawn: false,
    createdAt: new Date().toISOString(),
  };
  if (
    new Set(players.map((p) => p.id)).size !== players.length ||
    !canComplete(session)
  )
    throw new Error(
      "The projection pool cannot fill every team’s roster. Adjust roster settings or load more players.",
    );
  return session;
}
export function commitPick(
  session: MockSession,
  playerId: string,
  source: "human" | "bot" | "timeout",
  reasons: string[] = [],
  expectedPick = session.picks.length + 1,
): MockSession {
  if (session.status !== "running" || expectedPick !== session.picks.length + 1)
    return session;
  const seat = seatAt(expectedPick, session.config.teamCount);
  if ((source === "bot") === (seat === session.config.userSeat)) return session;
  const player = available(session).find((p) => p.id === playerId);
  if (!player || !canComplete(session, player))
    throw new Error("This pick would prevent a legal completed roster.");
  const picks = [
    ...session.picks,
    {
      pick: expectedPick,
      seat,
      playerId,
      source,
      reasons,
      contributes:
        source === "human" &&
        session.consent &&
        !session.withdrawn &&
        !!session.contributor,
    },
  ];
  return {
    ...session,
    picks,
    queue: session.queue.filter((id) => id !== playerId),
    pending: null,
    status:
      picks.length === slots(session.config).length * session.config.teamCount
        ? "complete"
        : "running",
  };
}
