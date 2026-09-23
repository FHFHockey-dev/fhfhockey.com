import { createHash } from "node:crypto";

export type FantraxDraftPick = {
  pickNumber: number;
  roundNumber: number;
  pickInRound: number;
  teamId: string;
  playerId: string;
  playerName?: string | null;
};

export type FantraxDraftSlot = Omit<FantraxDraftPick, "playerId" | "playerName"> & {
  playerId: string | null;
};

export type FantraxDraftSnapshot = {
  providerStatus: string;
  draftType: string;
  draftOrder: string[];
  slots: FantraxDraftSlot[];
  picks: FantraxDraftPick[];
  safeToApply: boolean;
  warning: string | null;
  hash: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Only numbered Fantrax draft results are authoritative. Roster membership is not a pick. */
export function normalizeFantraxDraftResults(payload: unknown): FantraxDraftSnapshot {
  const source = record(payload);
  const order = source?.draftOrder;
  const rows = source?.draftPicks;
  const draftOrder = Array.isArray(order) && order.every((id) => typeof id === "string" && id.trim())
    ? order as string[]
    : [];
  const picks: FantraxDraftPick[] = [];
  const slots: FantraxDraftSlot[] = [];
  let ambiguous = !Array.isArray(rows) || rows.length > 1000 ||
    draftOrder.length === 0 || new Set(draftOrder).size !== draftOrder.length;
  const seen = new Set<number>();
  const seenPlayers = new Set<string>();
  for (const raw of Array.isArray(rows) ? rows.slice(0, 1001) : []) {
    const pick = record(raw);
    if (!pick || !positiveInteger(pick.pick) || !positiveInteger(pick.round) ||
        !positiveInteger(pick.pickInRound) || seen.has(pick.pick)) {
      ambiguous = true;
      continue;
    }
    seen.add(pick.pick);
    if (typeof pick.teamId !== "string" || !draftOrder.includes(pick.teamId) ||
        !(pick.playerId == null || typeof pick.playerId === "string") ||
        (typeof pick.playerId === "string" && pick.playerId.trim() !== "" && seenPlayers.has(pick.playerId))) {
      ambiguous = true;
      continue;
    }
    const playerId = typeof pick.playerId === "string" && pick.playerId.trim() ? pick.playerId : null;
    const slot = {
      pickNumber: pick.pick,
      roundNumber: pick.round,
      pickInRound: pick.pickInRound,
      teamId: pick.teamId,
      playerId,
    };
    slots.push(slot);
    if (!playerId) continue;
    seenPlayers.add(playerId);
    picks.push({ ...slot, playerId });
  }
  slots.sort((a, b) => a.pickNumber - b.pickNumber);
  picks.sort((a, b) => a.pickNumber - b.pickNumber);
  if (slots.length === 0 || slots.some((slot, index) => slot.pickNumber !== index + 1)) ambiguous = true;
  const lastSelected = picks.at(-1)?.pickNumber ?? 0;
  const interiorEmpty = slots.some((slot) => slot.playerId === null && slot.pickNumber <= lastSelected);
  if (interiorEmpty) ambiguous = true;
  const draftType = typeof source?.draftType === "string" ? source.draftType : "unknown";
  const providerStatus = typeof source?.draftState === "string" ? source.draftState : "unknown";
  if (providerStatus.toLowerCase() === "completed" && (picks.length === 0 || slots.some((slot) => slot.playerId === null))) {
    ambiguous = true;
  }
  const auction = /auction/i.test(draftType);
  const safeToApply = !ambiguous && !auction;
  const warning = interiorEmpty
    ? "An empty Fantrax pick appears before a later selection. It could be skipped or missing; continue manually."
    : ambiguous
      ? "Fantrax did not return an unambiguous consecutive pick order. Continue manually."
    : auction
      ? "Fantrax auction results cannot be placed on this pick-based draft board. Continue manually."
      : null;
  const hash = createHash("sha256").update(JSON.stringify({ providerStatus, draftType, draftOrder, slots })).digest("hex");
  return { providerStatus, draftType, draftOrder, slots, picks, safeToApply, warning, hash };
}
