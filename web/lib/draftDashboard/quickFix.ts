export type QuickFixPick = {
  playerId: string;
  pickNumber: number;
  isKeeper?: boolean;
  source?: "manual" | "yahoo" | "espn" | "fantrax";
  fantraxMappingStatus?: "mapped" | "unresolved";
  fantraxPlayerId?: string;
  fantraxDisplayName?: string;
};

export function replaceManualDraftPick<T extends QuickFixPick>({
  draftedPlayers,
  currentPick,
  targetPickNumber,
  replacementPlayerId,
  selectablePlayerIds,
}: {
  draftedPlayers: T[];
  currentPick: number;
  targetPickNumber: number;
  replacementPlayerId: string;
  selectablePlayerIds: ReadonlySet<string>;
}):
  | { ok: true; players: T[] }
  | { ok: false; message: string } {
  const target = draftedPlayers.find(
    (player) => player.pickNumber === targetPickNumber,
  );
  if (
    !target ||
    target.isKeeper ||
    targetPickNumber >= currentPick ||
    (target.source != null && target.source !== "manual" &&
      !(target.source === "fantrax" && target.fantraxMappingStatus === "unresolved"))
  ) {
    return {
      ok: false,
      message: "Quick Fix supports completed manual picks and unresolved Fantrax picks after sync stops.",
    };
  }
  if (!selectablePlayerIds.has(replacementPlayerId)) {
    return { ok: false, message: "Choose an available replacement player." };
  }
  return {
    ok: true,
    players: draftedPlayers.map((player) =>
      player.pickNumber === targetPickNumber
        ? {
            ...player,
            playerId: replacementPlayerId,
            ...(player.source === "fantrax" ? {
              source: "manual" as const,
              fantraxMappingStatus: undefined,
              fantraxPlayerId: undefined,
              fantraxDisplayName: undefined,
            } : {}),
          }
        : player,
    ),
  };
}
