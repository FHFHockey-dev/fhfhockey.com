import supabase from "lib/supabase";
import type { TrainerCard } from "lib/sources/tweetSwipeTrainerServer";
import type { TrainerExtraction, TrainerType } from "lib/sources/tweetSwipeTrainer";

export type TrainerPlayerOption = {
  id: number;
  fullName: string;
  lastName: string;
  position: string | null;
  team_id: number | null;
};

export type TrainerCategoryOption = { category: string; subcategories: string[] };

export type TrainerTeamOption = { id: number; abbreviation: string; name: string };

export type TrainerQueueResponse = {
  success: boolean;
  type: TrainerType;
  cards: TrainerCard[];
  remainingByType: Partial<Record<TrainerType, number>>;
  players: TrainerPlayerOption[];
  teams?: TrainerTeamOption[];
  categoryOptions: TrainerCategoryOption[];
  message?: string;
};

// Client copy of the server labels: the trainer lib pulls in the parser, which the browser bundle doesn't need.
export const TYPE_TABS: Array<{ value: TrainerType | "auto"; label: string }> = [
  { value: "auto", label: "Next up" },
  { value: "line_combination", label: "Line combos" },
  { value: "goalie", label: "Goalies" },
  { value: "injury", label: "Injuries" },
  { value: "transaction", label: "Transactions" }
];

export const TYPE_LABELS: Record<TrainerType, string> = {
  line_combination: "Line combination",
  goalie: "Goalie",
  injury: "Injury",
  transaction: "Transaction",
  other: "Other"
};

// Accents don't matter when matching typed names: "Brandsegg-Nygard" finds "Brandsegg-Nygård".
export function foldName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readPayload<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message ?? "Request failed.");
  return payload as T;
}

export async function fetchTrainerQueue(args: {
  type: TrainerType | "auto";
  exclude: string[];
  fresh?: boolean;
}): Promise<TrainerQueueResponse> {
  const params = new URLSearchParams({ mode: "trainer", type: args.type, limit: "10" });
  if (args.exclude.length) params.set("exclude", args.exclude.slice(-200).join(","));
  if (args.fresh) params.set("fresh", "1");
  const response = await fetch(`/api/v1/db/tweet-pattern-review?${params}`, { headers: await authHeaders() });
  return readPayload<TrainerQueueResponse>(response);
}

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body)
  });
  return readPayload<T>(response);
}

/** Re-reads the card after a name fix, so the card shows what the parser now makes of the tweet. */
export async function reparseCard(card: TrainerCard): Promise<TrainerCard> {
  const result = await post<{ card: TrainerCard }>("/api/v1/db/tweet-pattern-review", {
    action: "trainer-reparse",
    reviewItemId: card.reviewItemId,
    shadowPostId: card.shadowPostId
  });
  return result.card;
}

export function saveVerdict(card: TrainerCard, verdict: "correct" | "wrong", correction?: TrainerExtraction, notes?: string) {
  return post<{ success: true; message: string }>("/api/v1/db/tweet-pattern-review", {
    action: "trainer-verdict",
    reviewItemId: card.reviewItemId,
    shadowPostId: card.shadowPostId,
    verdict,
    correction,
    notes
  });
}

/**
 * Fixes or confirms a name match through the existing alias tool: the name is queued (unless the parser already
 * queued it) and then resolved by /api/v1/db/player-name-aliases, which saves the alias for future mentions.
 */
/**
 * The alias tool refused to learn a blanket alias (a surname several NHL players share). The name is still queued,
 * so it can be assigned to the player for this tweet only.
 */
export class AliasRefusedError extends Error {
  constructor(message: string, readonly unresolvedId: string, readonly canAssignOnce: boolean) {
    super(message);
    this.name = "AliasRefusedError";
  }
}

/**
 * Fixes or confirms a name match through the existing alias tool: the name is queued (unless the parser already
 * queued it) and then resolved by /api/v1/db/player-name-aliases, which saves the alias for future mentions.
 */
export async function resolveCardName(args: {
  card: TrainerCard;
  rawName: string;
  playerId: number;
  reason: "trainer_wrong_match" | "trainer_near_match" | "trainer_unmatched";
  unresolvedId?: string | null;
  /** Learns the alias for this team's forwards, defensemen or goalies only (the parser applies it in that spot). */
  positionGroup?: PositionGroup | null;
}): Promise<string> {
  const unresolvedId =
    args.unresolvedId ??
    (
      await post<{ unresolvedId: string }>("/api/v1/db/tweet-pattern-review", {
        action: "trainer-queue-alias",
        reviewItemId: args.card.reviewItemId,
        shadowPostId: args.card.shadowPostId,
        rawName: args.rawName,
        teamId: args.card.parse.teamId,
        reason: args.reason
      })
    ).unresolvedId;
  try {
    const resolved = await post<{ message?: string }>("/api/v1/db/player-name-aliases", {
      unresolvedId,
      playerId: args.playerId,
      alias: args.rawName,
      ...(args.positionGroup ? { positionGroup: args.positionGroup } : {})
    });
    return resolved.message ?? "Alias saved.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alias save failed.";
    throw new AliasRefusedError(message, unresolvedId, /assign this occurrence/i.test(message));
  }
}

/** Assigns a queued name to a player for this one tweet, without learning an alias (the alias tool's own option). */
export async function assignCardNameOnce(args: { unresolvedId: string; playerId: number; rawName: string }): Promise<string> {
  const assigned = await post<{ message?: string }>("/api/v1/db/player-name-aliases", {
    unresolvedId: args.unresolvedId,
    playerId: args.playerId,
    alias: args.rawName,
    action: "assign_occurrence"
  });
  return assigned.message ?? "Assigned for this tweet only.";
}

/** The alias tool's refusal, in plain words. */
export type PositionGroup = "F" | "D" | "G";

export function positionGroupFor(position: string | null | undefined): PositionGroup | null {
  const value = (position ?? "").toUpperCase();
  if (value === "G") return "G";
  if (value === "D") return "D";
  return ["C", "L", "R", "LW", "RW", "F"].includes(value) ? "F" : null;
}

/** "TOR forwards": the narrower alias offered when a surname is shared. */
export function aliasScopeLabel(teamLabel: string | null | undefined, group: PositionGroup): string {
  const role = group === "F" ? "forwards" : group === "D" ? "defensemen" : "goalies";
  return teamLabel ? `${teamLabel} ${role}` : role;
}

export function aliasRefusalText(rawName: string, playerName: string, scope?: string | null): string {
  return scope
    ? `“${rawName}” can't be an alias for every future tweet: more than one NHL player has that surname. Learn it for ${scope} only, or use ${playerName} for this tweet only.`
    : `“${rawName}” can't be saved as an alias for every future tweet: more than one NHL player has that surname. You can still use ${playerName} for this tweet only.`;
}
