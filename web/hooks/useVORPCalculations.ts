import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";
// hooks/useVORPCalculations.ts
import { useMemo } from "react";
import { ProcessedPlayer } from "hooks/useProcessedProjectionsData";
import {
  getEffectiveRosterConfig,
  getRosterPositions,
} from "lib/draftDashboard/forwardGrouping";
import { buildPlayerValues } from "lib/draftDashboard/playerValues";
import {
  buildReplacementReference,
  leagueSlotCapacities,
  type SlotPlayer,
} from "lib/draftDashboard/replacementReference";

export type LeagueType = "points" | "categories";

const EMPTY_NUMERIC_RECORD: Record<string, number> = {};

// Minimal shape needed from DraftSettings for calculations
export interface DraftSettings {
  teamCount: number;
  rosterConfig: Record<string, number> & { utility?: number };
  leagueType?: LeagueType;
  categoryWeights?: Record<string, number>;
}

/**
 * Draft value metrics (owner decisions 76, 77; audit W2-P0-14, W2-5 D3/D4).
 * `null` means unknown (a missing projection or category input): readers show
 * it as unavailable and rank it after known values, never as 0.
 */
export interface PlayerVorpMetrics {
  value: number | null; // comparable single value (fp for points; category value for categories)
  unweightedValue?: number; // preserves projection sorting when position weights apply
  /** Value over the frozen, league-aware replacement reference (the base score). */
  vorp: number | null;
  /** Value over the last starter at the best position in the frozen reference. */
  vols: number | null;
  /** Value over the expected best survivor at the next pick (its own column; never blended). */
  vona: number | null;
  /** Draft base score. Equals VORP: VONA joins it only after a held-out replay (decision 76). */
  vbd: number | null;
  /** Value over the current available replacement (live board, labelled availability). */
  scarcity: number | null;
  bestPos: string;
  eligible: string[];
}

export interface UseVORPParams {
  players: ProcessedPlayer[]; // full pool
  availablePlayers: ProcessedPlayer[]; // exclude drafted
  draftSettings: DraftSettings;
  picksUntilNext: number; // estimated picks before user's next turn
  leagueType?: LeagueType;
  baselineMode?: "remaining" | "full"; // replacement baseline source
  categoryWeights?: Record<string, number>; // used when leagueType === 'categories'
  //  forward grouping mode: split C/LW/RW or combined F
  forwardGrouping?: "split" | "fwd";
  // personalized replacement context
  /** Kept for saved-draft compatibility; personalization now uses actual league fills. */
  myFilledSlots?: Record<string, number>;
  personalizeReplacement?: boolean;
  // Full-season proration toggle for skater counting stats (points leagues only)
  prorate84?: boolean;
  // Optional fantasy scoring overrides (will merge with defaults inside helper)
  fantasyPointSettings?: Record<string, number>;
  // Draft Pro multipliers resolved from the selected position source, not roster slots.
  positionWeightMultipliers?: ReadonlyMap<string, number>;
}

export interface UseVORPResult {
  playerMetrics: Map<string, PlayerVorpMetrics>;
  /** Frozen league reference: replacement (`vorp`) and last starter (`vols`) per position. */
  replacementByPos: Record<string, { vorp: number | null; vols: number | null }>;
  /** Live board: best available player per position after league-wide fills. */
  liveReplacementByPos?: Record<string, number | null>;
  /** Version label of the frozen reference (pool, slots, cutoff). */
  referenceLabel?: string;
  expectedTakenByPos?: Record<string, number>;
  expectedN?: number;
  /** Players whose value is unknown (missing projection or category input). */
  unknownValueCount?: number;
}

export function useVORPCalculations(params: UseVORPParams): UseVORPResult {
  const {
    players,
    availablePlayers,
    draftSettings,
    picksUntilNext,
    leagueType = "points",
    baselineMode = "remaining",
    categoryWeights = EMPTY_NUMERIC_RECORD,
    forwardGrouping = "split",
    myFilledSlots = EMPTY_NUMERIC_RECORD,
    personalizeReplacement = false,
    prorate84 = false,
    fantasyPointSettings = DEFAULT_SKATER_FANTASY_POINTS,
    positionWeightMultipliers,
  } = params;
  return useMemo(
    () =>
      computeVorpMetrics({
        players,
        availablePlayers,
        draftSettings,
        picksUntilNext,
        leagueType,
        baselineMode,
        categoryWeights,
        forwardGrouping,
        myFilledSlots,
        personalizeReplacement,
        prorate84,
        fantasyPointSettings,
        positionWeightMultipliers,
      }),
    [
      players,
      availablePlayers,
      draftSettings,
      picksUntilNext,
      leagueType,
      baselineMode,
      categoryWeights,
      forwardGrouping,
      personalizeReplacement,
      myFilledSlots,
      prorate84,
      fantasyPointSettings,
      positionWeightMultipliers,
    ],
  );
}

/**
 * Pure VORP computation.
 *
 * - VORP uses one frozen reference built from the full player pool with a
 *   global slot assignment (teams × starters, UTIL = any non-goalie, bench =
 *   any position). Drafting
 *   players never moves it; `baselineMode` no longer changes VORP (decision
 *   77) and is kept only for saved-draft compatibility.
 * - The live board assigns the already-drafted players to league slots first
 *   and reports the best available player per position (`scarcity`).
 * - VONA compares the candidate with the best other player at his position
 *   expected to survive to the next pick (ADP-based departures, whole players).
 */
export function computeVorpMetrics({
  players,
  availablePlayers,
  draftSettings,
  picksUntilNext,
  leagueType = "points",
  categoryWeights = EMPTY_NUMERIC_RECORD,
  forwardGrouping = "split",
  personalizeReplacement = false,
  prorate84 = false,
  fantasyPointSettings = DEFAULT_SKATER_FANTASY_POINTS,
  positionWeightMultipliers,
}: UseVORPParams): UseVORPResult {
  const { values, eligibility, unweightedValues } = buildPlayerValues({
    players,
    draftSettings,
    leagueType,
    categoryWeights,
    forwardGrouping,
    prorate84,
    fantasyPointSettings,
    positionWeightMultipliers,
  });

  const T = draftSettings.teamCount;
  const starters = getEffectiveRosterConfig(
    draftSettings.rosterConfig,
    forwardGrouping,
  );
  const positions = getRosterPositions(forwardGrouping, starters);
  // Rostered slots: starters, UTIL (any skater) and the league's bench (any
  // position) — TJ, 2026-11-11: the bench counts in the frozen reference.
  const capacities = leagueSlotCapacities({
    teamCount: T,
    starters,
    positions,
    includeBench: true,
  });

  const slotPlayer = (player: ProcessedPlayer): SlotPlayer | null => {
    const id = String(player.playerId);
    const value = values.get(id);
    if (value === undefined) return null;
    const eligible = (eligibility.get(id) ?? []).filter((position) =>
      positions.includes(position),
    );
    return eligible.length ? { id, value, eligible } : null;
  };
  const allSlotPlayers = players
    .map(slotPlayer)
    .filter((player): player is SlotPlayer => player !== null);
  const frozen = buildReplacementReference({
    players: allSlotPlayers,
    positions,
    capacities,
  });

  const availableIds = new Set(
    availablePlayers.map((player) => String(player.playerId)),
  );
  const availableSlotPlayers = allSlotPlayers.filter((player) =>
    availableIds.has(player.id),
  );
  const draftedSlotPlayers = allSlotPlayers.filter(
    (player) => !availableIds.has(player.id),
  );
  const live = buildReplacementReference({
    players: availableSlotPlayers,
    positions,
    capacities,
    fixed: draftedSlotPlayers,
  });

  // The personalized (suggestion-only) map measures against the live board:
  // the league's actual fills, not my filled slots multiplied by the team
  // count. The global map always uses the frozen reference.
  const reference = personalizeReplacement ? live : frozen;
  const replacementByPos: UseVORPResult["replacementByPos"] = {};
  for (const position of positions) {
    replacementByPos[position] = {
      vorp: reference.replacementByPos[position],
      vols: reference.lastStarterByPos[position],
    };
  }

  // Expected departures before the next pick: whole players by ADP.
  const N = Math.max(0, Math.floor(picksUntilNext));
  const departing = new Set(
    [...availablePlayers]
      .filter((player) => Number.isFinite(player.yahooAvgPick))
      .sort(
        (left, right) =>
          left.yahooAvgPick! - right.yahooAvgPick! ||
          String(left.playerId).localeCompare(String(right.playerId)),
      )
      .slice(0, N)
      .map((player) => String(player.playerId)),
  );
  const expectedTaken: Record<string, number> = Object.fromEntries(
    positions.map((position) => [position, 0]),
  );
  for (const id of departing) {
    const valid = (eligibility.get(id) ?? []).filter((position) =>
      positions.includes(position),
    );
    for (const position of valid) expectedTaken[position] += 1;
  }
  const survivorsByPos: Record<string, SlotPlayer[]> = Object.fromEntries(
    positions.map((position) => [
      position,
      availableSlotPlayers
        .filter(
          (player) =>
            !departing.has(player.id) && player.eligible.includes(position),
        )
        .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)),
    ]),
  );

  const playerMetrics = new Map<string, PlayerVorpMetrics>();
  const diff = (value: number | null, baseline: number | null | undefined) =>
    value === null || baseline === null || baseline === undefined
      ? null
      : value - baseline;
  let unknownValueCount = 0;

  players.forEach((p) => {
    const id = String(p.playerId);
    const known = values.get(id);
    const value = known === undefined ? null : known;
    if (value === null) unknownValueCount += 1;
    const elig = eligibility.get(id) || [];
    const unweightedValue = unweightedValues.has(id)
      ? { unweightedValue: unweightedValues.get(id)! }
      : {};
    const usable = elig.filter((position) => positions.includes(position));

    if (usable.length === 0) {
      playerMetrics.set(id, {
        value,
        ...unweightedValue,
        vorp: null,
        vols: null,
        vona: null,
        vbd: null,
        scarcity: null,
        bestPos: "",
        eligible: elig,
      });
      return;
    }

    // Best position = lowest replacement (highest VORP); fixed order on ties.
    let bestPos = usable[0];
    for (const position of usable) {
      const current = reference.replacementByPos[bestPos];
      const candidate = reference.replacementByPos[position];
      if (candidate !== null && (current === null || candidate < current)) {
        bestPos = position;
      }
    }
    const vorp = diff(value, reference.replacementByPos[bestPos]);
    const survivor = survivorsByPos[bestPos]?.find((player) => player.id !== id);
    const nextBaseline =
      survivor?.value ??
      live.replacementByPos[bestPos] ??
      reference.replacementByPos[bestPos];

    playerMetrics.set(id, {
      value,
      ...unweightedValue,
      vorp,
      vols: diff(value, reference.lastStarterByPos[bestPos]),
      vona: diff(value, nextBaseline),
      vbd: vorp,
      scarcity: diff(value, live.replacementByPos[bestPos]),
      bestPos,
      eligible: elig,
    });
  });

  return {
    playerMetrics,
    replacementByPos,
    liveReplacementByPos: live.replacementByPos,
    referenceLabel: `${personalizeReplacement ? "live-board" : frozen.version} · ${T} teams · ${allSlotPlayers.length} valued players · UTIL any skater · bench included`,
    expectedTakenByPos: expectedTaken,
    expectedN: N,
    unknownValueCount,
  };
}
