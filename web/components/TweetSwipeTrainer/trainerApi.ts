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

export type TrainerQueueResponse = {
  success: boolean;
  type: TrainerType;
  cards: TrainerCard[];
  remainingByType: Partial<Record<TrainerType, number>>;
  players: TrainerPlayerOption[];
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
export async function resolveCardName(args: {
  card: TrainerCard;
  rawName: string;
  playerId: number;
  reason: "trainer_wrong_match" | "trainer_near_match" | "trainer_unmatched";
  unresolvedId?: string | null;
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
  const resolved = await post<{ message?: string }>("/api/v1/db/player-name-aliases", {
    unresolvedId,
    playerId: args.playerId,
    alias: args.rawName
  });
  return resolved.message ?? "Alias saved.";
}
