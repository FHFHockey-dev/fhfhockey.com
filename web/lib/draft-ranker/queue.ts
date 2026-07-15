export const DRAFT_PAIR_QUEUE_ALGORITHM_VERSION = "deterministic_v1";

export type DraftPairQueueMode =
  | "improve_ranking"
  | "find_sleepers"
  | "place_rookies"
  | "review_goalies"
  | "resolve_close_calls"
  | "quick_five";

export type DraftPairQueuePlayer = {
  playerId: number;
  rank: number;
  position: string | null;
  lifecycleStatus: string;
  seedAdp: number | null;
  watched: boolean;
};

export type DraftPairPreference = {
  lowPlayerId: number;
  highPlayerId: number;
  preferredPlayerId: number;
  establishedAt: string;
};

export type DraftPairQueueCandidate = {
  playerAId: number;
  playerBId: number;
  category: "personal" | "discovery" | "validation" | "editorial";
  reasonCode: string;
  reason: string;
  focusPosition: "F" | "D" | "G" | "mixed";
  allowRecentRepeat: boolean;
};

type BuildQueueInput = {
  players: DraftPairQueuePlayer[];
  preferences: DraftPairPreference[];
  recentPairKeys: Set<string>;
  mode: DraftPairQueueMode;
  now?: Date;
};

export function canonicalPairKey(playerAId: number, playerBId: number) {
  return playerAId < playerBId
    ? `${playerAId}:${playerBId}`
    : `${playerBId}:${playerAId}`;
}

function positionGroup(position: string | null): "F" | "D" | "G" {
  if (position === "G") return "G";
  if (position === "D") return "D";
  return "F";
}

function pairPosition(a: DraftPairQueuePlayer, b: DraftPairQueuePlayer) {
  const aGroup = positionGroup(a.position);
  const bGroup = positionGroup(b.position);
  return aGroup === bGroup ? aGroup : "mixed";
}

function pair(
  a: DraftPairQueuePlayer,
  b: DraftPairQueuePlayer,
  candidate: Omit<
    DraftPairQueueCandidate,
    "playerAId" | "playerBId" | "focusPosition"
  >,
): DraftPairQueueCandidate {
  return {
    playerAId: a.playerId,
    playerBId: b.playerId,
    focusPosition: pairPosition(a, b),
    ...candidate,
  };
}

function modeEligible(
  candidate: DraftPairQueueCandidate,
  playersById: Map<number, DraftPairQueuePlayer>,
  mode: DraftPairQueueMode,
) {
  const a = playersById.get(candidate.playerAId)!;
  const b = playersById.get(candidate.playerBId)!;
  if (mode === "review_goalies") return candidate.focusPosition === "G";
  if (mode === "place_rookies") {
    return [a, b].some(
      (player) => player.lifecycleStatus === "active_prospect",
    );
  }
  if (mode === "find_sleepers") {
    return (
      candidate.category === "discovery" || candidate.category === "editorial"
    );
  }
  if (mode === "resolve_close_calls") {
    return (
      candidate.category === "validation" || candidate.category === "personal"
    );
  }
  return true;
}

function takeDiverse(
  candidates: DraftPairQueueCandidate[],
  count: number,
  selected: DraftPairQueueCandidate[],
  usedPairs: Set<string>,
) {
  const remaining = [...candidates];
  while (remaining.length && selected.length < count) {
    const lastThree = selected.slice(-3).map((item) => item.focusPosition);
    let index = remaining.findIndex((candidate) => {
      const key = canonicalPairKey(candidate.playerAId, candidate.playerBId);
      return (
        !usedPairs.has(key) &&
        !(
          candidate.focusPosition !== "mixed" &&
          lastThree.length === 3 &&
          lastThree.every((position) => position === candidate.focusPosition)
        )
      );
    });
    if (index < 0) {
      index = remaining.findIndex(
        (candidate) =>
          !usedPairs.has(
            canonicalPairKey(candidate.playerAId, candidate.playerBId),
          ),
      );
    }
    if (index < 0) break;
    const [candidate] = remaining.splice(index, 1);
    usedPairs.add(canonicalPairKey(candidate.playerAId, candidate.playerBId));
    selected.push(candidate);
  }
}

export function buildDeterministicDraftPairQueue({
  players,
  preferences,
  recentPairKeys,
  mode,
  now = new Date(),
}: BuildQueueInput): DraftPairQueueCandidate[] {
  const ordered = [...players].sort(
    (a, b) => a.rank - b.rank || a.playerId - b.playerId,
  );
  const playersById = new Map(
    ordered.map((player) => [player.playerId, player]),
  );
  const preferenceByPair = new Map(
    preferences.map((preference) => [
      canonicalPairKey(preference.lowPlayerId, preference.highPlayerId),
      preference,
    ]),
  );
  const available = (candidate: DraftPairQueueCandidate) =>
    (candidate.allowRecentRepeat ||
      !recentPairKeys.has(
        canonicalPairKey(candidate.playerAId, candidate.playerBId),
      )) &&
    modeEligible(candidate, playersById, mode);

  const personal: DraftPairQueueCandidate[] = [];
  for (let index = 0; index < Math.min(249, ordered.length - 1); index += 1) {
    const a = ordered[index];
    const b = ordered[index + 1];
    const key = canonicalPairKey(a.playerId, b.playerId);
    if (!preferenceByPair.has(key)) {
      personal.push(
        pair(a, b, {
          category: "personal",
          reasonCode: "adjacent_unresolved",
          reason: `Adjacent ranks ${a.rank} and ${b.rank} have no explicit comparison.`,
          allowRecentRepeat: false,
        }),
      );
    }
  }
  personal.sort((left, right) => {
    const leftRank = playersById.get(left.playerAId)!.rank;
    const rightRank = playersById.get(right.playerAId)!.rank;
    const leftCutoff = Math.abs(250 - leftRank);
    const rightCutoff = Math.abs(250 - rightRank);
    return leftCutoff - rightCutoff || leftRank - rightRank;
  });

  const candidates = ordered.filter((player) => player.rank > 250).slice(0, 50);
  const cutoff = ordered.filter(
    (player) => player.rank >= 240 && player.rank <= 250,
  );
  const discovery: DraftPairQueueCandidate[] = [];
  for (const candidate of candidates) {
    const group = positionGroup(candidate.position);
    const anchor =
      [...cutoff]
        .reverse()
        .find((player) => positionGroup(player.position) === group) ??
      cutoff[cutoff.length - 1];
    if (!anchor) continue;
    discovery.push(
      pair(candidate, anchor, {
        category: "discovery",
        reasonCode: candidate.watched
          ? "watched_candidate_near_cutoff"
          : "candidate_near_cutoff",
        reason: candidate.watched
          ? `A watched candidate at ${candidate.rank} is being tested near the top-250 cutoff.`
          : `Candidate ${candidate.rank} is being tested near the top-250 cutoff.`,
        allowRecentRepeat: false,
      }),
    );
  }
  discovery.sort((a, b) => {
    const ap = playersById.get(a.playerAId)!;
    const bp = playersById.get(b.playerAId)!;
    return Number(bp.watched) - Number(ap.watched) || ap.rank - bp.rank;
  });

  const validation: DraftPairQueueCandidate[] = [];
  for (const preference of preferences) {
    const low = playersById.get(preference.lowPlayerId);
    const high = playersById.get(preference.highPlayerId);
    if (!low || !high) continue;
    const preferred = playersById.get(preference.preferredPlayerId);
    const other = preference.preferredPlayerId === low.playerId ? high : low;
    if (!preferred) continue;
    const contradictory = preferred.rank > other.rank;
    const stale =
      now.getTime() - new Date(preference.establishedAt).getTime() >=
      30 * 24 * 60 * 60 * 1000;
    if (contradictory || stale) {
      validation.push(
        pair(preferred, other, {
          category: "validation",
          reasonCode: contradictory
            ? "direct_edit_contradiction"
            : "stale_preference",
          reason: contradictory
            ? "A direct ranking edit now conflicts with an earlier explicit comparison."
            : "This explicit comparison is at least 30 days old and may need validation.",
          allowRecentRepeat: true,
        }),
      );
    }
  }
  const boundaryPairs: Array<[number, number]> = [
    [250, 251],
    [245, 252],
    [247, 253],
  ];
  for (const [insideRank, outsideRank] of boundaryPairs) {
    const inside = ordered.find((player) => player.rank === insideRank);
    const outside = ordered.find((player) => player.rank === outsideRank);
    if (!inside || !outside) continue;
    validation.push(
      pair(inside, outside, {
        category: "validation",
        reasonCode: "top_250_cutoff",
        reason: `Ranks ${insideRank} and ${outsideRank} test uncertainty around the top-250 cutoff.`,
        allowRecentRepeat: false,
      }),
    );
  }

  const editorial = discovery
    .filter((candidate) => {
      const player = playersById.get(candidate.playerAId)!;
      return player.watched || player.lifecycleStatus === "active_prospect";
    })
    .map((candidate) => ({
      ...candidate,
      category: "editorial" as const,
      reasonCode:
        playersById.get(candidate.playerAId)!.lifecycleStatus ===
        "active_prospect"
          ? "verified_prospect"
          : "watchlist_interest",
      reason:
        playersById.get(candidate.playerAId)!.lifecycleStatus ===
        "active_prospect"
          ? "A verified prospect in the candidate pool has limited personal evidence."
          : "A watched candidate has limited explicit comparison evidence.",
    }));
  const editorialPairKeys = new Set(
    editorial.map((candidate) =>
      canonicalPairKey(candidate.playerAId, candidate.playerBId),
    ),
  );

  const pools = {
    personal: personal.filter(available),
    discovery: discovery.filter(
      (candidate) =>
        !editorialPairKeys.has(
          canonicalPairKey(candidate.playerAId, candidate.playerBId),
        ) && available(candidate),
    ),
    validation: validation.filter(available),
    editorial: editorial.filter(available),
  };
  const target = mode === "quick_five" ? 5 : 20;
  const quotas =
    mode === "quick_five"
      ? ([
          "personal",
          "personal",
          "discovery",
          "validation",
          "personal",
        ] as const)
      : ([
          "personal",
          "discovery",
          "personal",
          "validation",
          "personal",
          "editorial",
          "personal",
          "discovery",
          "personal",
          "validation",
          "personal",
          "discovery",
          "personal",
          "editorial",
          "personal",
          "validation",
          "personal",
          "discovery",
          "personal",
          "discovery",
        ] as const);
  const selected: DraftPairQueueCandidate[] = [];
  const usedPairs = new Set<string>();
  for (const category of quotas) {
    takeDiverse(pools[category], selected.length + 1, selected, usedPairs);
  }
  if (selected.length < target) {
    takeDiverse(
      [
        ...pools.personal,
        ...pools.discovery,
        ...pools.validation,
        ...pools.editorial,
      ],
      target,
      selected,
      usedPairs,
    );
  }
  return selected;
}
