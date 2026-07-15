import type { KeeperEntry, KeeperDraftPick } from "./keepers";

export const PICK_TRADE_CONTRACT_VERSION = 1 as const;

export type PickTradeEntry = {
  version: typeof PICK_TRADE_CONTRACT_VERSION;
  status: "valid";
  round: number;
  pickInRound: number;
  pickNumber: number;
  originalTeamId: string;
  currentTeamId: string;
};

export type PickTradeCandidate = {
  round: unknown;
  pickInRound: unknown;
  currentTeamId: unknown;
};

export type PickTradeContext = {
  draftOrder: string[];
  roundCount: number;
  isSnakeDraft: boolean;
  trades?: PickTradeEntry[];
  keepers?: KeeperEntry[];
  draftedPlayers?: KeeperDraftPick[];
};

const integer = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : null;
};

export function pickTradeKey(
  trade: Pick<PickTradeEntry, "round" | "pickInRound">
) {
  return `${trade.round}-${trade.pickInRound}`;
}

export function originalPickOwner(
  draftOrder: string[],
  round: number,
  pickInRound: number,
  isSnakeDraft: boolean
) {
  const index =
    isSnakeDraft && round % 2 === 0
      ? draftOrder.length - pickInRound
      : pickInRound - 1;
  return draftOrder[index];
}

export function validatePickTradeCandidate(
  candidate: PickTradeCandidate,
  context: PickTradeContext
):
  | { ok: true; trade: PickTradeEntry; warnings: string[] }
  | { ok: false; errors: string[] } {
  const round = integer(candidate.round);
  const pickInRound = integer(candidate.pickInRound);
  const currentTeamId = String(candidate.currentTeamId ?? "").trim();
  const teamCount = context.draftOrder.length;
  const errors: string[] = [];
  if (round == null || round < 1 || round > context.roundCount) {
    errors.push(`Round must be between 1 and ${context.roundCount}.`);
  }
  if (pickInRound == null || pickInRound < 1 || pickInRound > teamCount) {
    errors.push(`Pick must be between 1 and ${teamCount}.`);
  }
  if (!context.draftOrder.includes(currentTeamId)) {
    errors.push("New owner is not in the draft order.");
  }
  if (errors.length || round == null || pickInRound == null) {
    return { ok: false, errors };
  }
  const pickNumber = (round - 1) * teamCount + pickInRound;
  const originalTeamId = originalPickOwner(
    context.draftOrder,
    round,
    pickInRound,
    context.isSnakeDraft
  );
  if (currentTeamId === originalTeamId) {
    errors.push("New owner is already the original owner; remove the override instead.");
  }
  if (
    (context.draftedPlayers ?? []).some(
      (pick) => pick.pickNumber === pickNumber && !pick.isKeeper
    )
  ) {
    errors.push("Completed non-keeper picks cannot be traded.");
  }
  if (errors.length) return { ok: false, errors };

  const warnings: string[] = [];
  const keeper = (context.keepers ?? []).find(
    (entry) => entry.pickNumber === pickNumber
  );
  if (keeper && keeper.teamId !== currentTeamId) {
    warnings.push(
      `Keeper ${keeper.playerId} retains forfeited-pick display ownership for ${keeper.teamId}; this trade becomes active if the keeper is removed.`
    );
  }
  return {
    ok: true,
    trade: {
      version: PICK_TRADE_CONTRACT_VERSION,
      status: "valid",
      round,
      pickInRound,
      pickNumber,
      originalTeamId,
      currentTeamId
    },
    warnings
  };
}

export function upsertPickTrade(
  candidate: PickTradeCandidate,
  context: PickTradeContext
) {
  const existingKey = `${candidate.round}-${candidate.pickInRound}`;
  const otherTrades = (context.trades ?? []).filter(
    (trade) => pickTradeKey(trade) !== existingKey
  );
  const result = validatePickTradeCandidate(candidate, {
    ...context,
    trades: otherTrades
  });
  if (!result.ok) return result;
  return {
    ...result,
    trades: [...otherTrades, result.trade].sort(
      (left, right) => left.pickNumber - right.pickNumber
    )
  };
}

export function tradeOwnerOverrides(trades: PickTradeEntry[]) {
  return Object.fromEntries(
    trades.map((trade) => [pickTradeKey(trade), trade.currentTeamId])
  );
}

export function migratePickTrades(
  value: unknown,
  context: Pick<PickTradeContext, "draftOrder" | "roundCount" | "isSnakeDraft">
) {
  const candidates: PickTradeCandidate[] = Array.isArray(value)
    ? value.map((trade) => {
        const row = trade as Record<string, unknown>;
        return {
          round: row.round,
          pickInRound: row.pickInRound,
          currentTeamId: row.currentTeamId ?? row.teamId
        };
      })
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).map(([key, owner]) => {
          const [round, pickInRound] = key.split("-");
          return { round, pickInRound, currentTeamId: owner };
        })
      : [];
  let trades: PickTradeEntry[] = [];
  for (const candidate of candidates) {
    const result = upsertPickTrade(candidate, { ...context, trades });
    if (result.ok) trades = result.trades;
  }
  return trades;
}

export function resolvePickOwner({
  round,
  pickInRound,
  draftOrder,
  isSnakeDraft,
  trades = [],
  keepers = []
}: {
  round: number;
  pickInRound: number;
  draftOrder: string[];
  isSnakeDraft: boolean;
  trades?: PickTradeEntry[];
  keepers?: KeeperEntry[];
}) {
  const pickNumber = (round - 1) * draftOrder.length + pickInRound;
  const originalTeamId = originalPickOwner(
    draftOrder,
    round,
    pickInRound,
    isSnakeDraft
  );
  const trade = trades.find((entry) => entry.pickNumber === pickNumber);
  const keeper = keepers.find((entry) => entry.pickNumber === pickNumber);
  return {
    pickNumber,
    originalTeamId,
    tradedTeamId: trade?.currentTeamId,
    keeperTeamId: keeper?.teamId,
    currentTeamId: keeper?.teamId ?? trade?.currentTeamId ?? originalTeamId,
    source: keeper ? ("keeper" as const) : trade ? ("trade" as const) : ("original" as const)
  };
}

export function findPicksUntilTeamTurn({
  currentPick,
  teamId,
  draftOrder,
  isSnakeDraft,
  trades = [],
  keepers = [],
  completedPickNumbers = [],
  maxPickNumber
}: {
  currentPick: number;
  teamId: string;
  draftOrder: string[];
  isSnakeDraft: boolean;
  trades?: PickTradeEntry[];
  keepers?: KeeperEntry[];
  completedPickNumbers?: Iterable<number>;
  maxPickNumber: number;
}) {
  const completed = new Set(completedPickNumbers);
  for (let pickNumber = currentPick + 1; pickNumber <= maxPickNumber; pickNumber++) {
    const round = Math.ceil(pickNumber / draftOrder.length);
    const pickInRound = ((pickNumber - 1) % draftOrder.length) + 1;
    const owner = resolvePickOwner({
      round,
      pickInRound,
      draftOrder,
      isSnakeDraft,
      trades,
      keepers
    }).currentTeamId;
    if (owner === teamId && !completed.has(pickNumber)) {
      return pickNumber - currentPick;
    }
  }
  return draftOrder.length;
}

export function parsePickTradeImport(input: string):
  | { ok: true; candidates: PickTradeCandidate[] }
  | { ok: false; errors: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, errors: ["Paste at least one trade row."] };
  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    if (!rows.every((row) => row && typeof row === "object")) {
      return { ok: false, errors: ["JSON trade input must contain objects."] };
    }
    return { ok: true, candidates: rows as PickTradeCandidate[] };
  } catch {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
    const cells = lines.map((line) => line.split(",").map((cell) => cell.trim()));
    const first = cells[0].map((cell) => cell.toLowerCase());
    const hasHeader = first.includes("round") && first.includes("pickinround");
    const header = hasHeader ? first : ["round", "pickinround", "currentteamid"];
    const data = hasHeader ? cells.slice(1) : cells;
    const ownerHeader = header.includes("currentteamid")
      ? "currentteamid"
      : header.includes("teamid")
        ? "teamid"
        : "";
    if (!ownerHeader) {
      return {
        ok: false,
        errors: ["CSV requires round, pickInRound, and currentTeamId columns."]
      };
    }
    return {
      ok: true,
      candidates: data.map((row) => ({
        round: row[header.indexOf("round")],
        pickInRound: row[header.indexOf("pickinround")],
        currentTeamId: row[header.indexOf(ownerHeader)]
      }))
    };
  }
}

export function validatePickTradeBatch(
  candidates: PickTradeCandidate[],
  context: PickTradeContext
) {
  let trades = [...(context.trades ?? [])];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const result = upsertPickTrade(candidate, { ...context, trades });
    if (!result.ok) errors.push(`Row ${index + 1}: ${result.errors.join(" ")}`);
    else {
      trades = result.trades;
      warnings.push(...result.warnings.map((warning) => `Row ${index + 1}: ${warning}`));
    }
  }
  return errors.length
    ? { ok: false as const, trades: context.trades ?? [], errors, warnings }
    : { ok: true as const, trades, errors: [] as string[], warnings };
}
