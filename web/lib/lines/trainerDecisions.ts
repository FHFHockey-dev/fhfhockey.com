import { createHash } from "node:crypto";
import { fetchAllSupabaseFilterChunks } from "lib/supabase/pagination";
import { readAnswerKeyRecord, type TrainerExtraction, type TrainerSlotValue } from "lib/sources/tweetSwipeTrainer";
import type { TweetUnit } from "lib/sources/tweetInterpretation";
import type { PPSwap } from "./decisions";
import type { ClaimContext } from "./types";

/**
 * A trainer answer key used as a reviewed decision. v1 carries the extraction only; v2
 * (Lane E, 4218359a8) adds expected.context, .game, .scope and .powerPlaySwaps. Unknown versions are ignored.
 */
export type ReviewedLineDecision = {
  reviewItemId: string; version: 1 | 2; textSha256: string; verdict: "correct" | "wrong"; expected: TrainerExtraction;
  context: ClaimContext | null;
  binding: { gameId: number | null; opponentId: number | null; date: string | null } | null;
  scope: "full" | "partial" | "change" | null;
  swaps: Array<{ unitNumber: 1 | 2; playersIn: TrainerSlotValue[]; playersOut: TrainerSlotValue[] }>;
};

const slots = (value: unknown): TrainerSlotValue[] => Array.isArray(value) ? value.filter((slot) => slot && typeof slot.name === "string") : [];

/** Lane E's reader decides the version and defaults; this maps `record.expected` onto engine decisions. */
export function readReviewedDecision(reviewItemId: string, metadata: unknown): ReviewedLineDecision | null {
  const record = readAnswerKeyRecord(metadata);
  if (!record || typeof record.textSha256 !== "string") return null;
  const expected = record.expected;
  const game = expected.game;
  // gameId is always null from the trainer; a date alone never binds, so opponent + date is required.
  const binding = game && (game.gameId != null || game.opponentTeamId != null && game.date) ? {
    gameId: Number.isSafeInteger(game.gameId) ? game.gameId : null,
    opponentId: Number.isSafeInteger(game.opponentTeamId) ? game.opponentTeamId : null,
    date: typeof game.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(game.date) ? game.date : null } : null;
  const v2Swaps = (expected.powerPlaySwaps ?? []).flatMap((swap) => swap.unit === 1 || swap.unit === 2
    ? [{ unitNumber: swap.unit as 1 | 2, playersIn: slots(swap.in), playersOut: slots(swap.out) }] : []);
  // v1: a partly filled PP unit plus "off the power play" names is a swap on that unit.
  const v1Swaps = record.version === 1 && expected.offPowerPlay.length ? expected.powerPlay.flatMap((unit, index) =>
    index < 2 && unit.length > 0 && unit.length < 5 ? [{ unitNumber: (index + 1) as 1 | 2, playersIn: unit, playersOut: expected.offPowerPlay }] : []) : [];
  return { reviewItemId, version: record.version, textSha256: record.textSha256, verdict: record.verdict, expected,
    context: expected.context ?? null, binding: binding && (binding.gameId || binding.opponentId && binding.date) ? binding : null,
    scope: expected.scope ?? null,
    swaps: (record.version === 2 ? v2Swaps : v1Swaps).filter((swap) => swap.playersIn.length > 0 && swap.playersOut.length > 0) };
}

/** Read-only lookup of reviewed answer keys by tweet id (relay, original or quoted). */
export async function fetchReviewedDecisions(supabase: any, tweetIds: string[]): Promise<Map<string, ReviewedLineDecision[]>> {
  const ids = [...new Set(tweetIds.filter((id) => /^\d+$/.test(id)))];
  const result = new Map<string, ReviewedLineDecision[]>();
  if (!ids.length) return result;
  const rows = await fetchAllSupabaseFilterChunks<{ id: string; tweet_id: string | null; quoted_tweet_id: string | null; metadata: unknown }, string>(ids, (chunk, { from, to }) =>
    supabase.from("tweet_pattern_review_items").select("id,tweet_id,quoted_tweet_id,metadata").in("tweet_id", chunk).order("id").range(from, to));
  for (const row of rows) {
    const decision = readReviewedDecision(String(row.id), row.metadata);
    if (!decision || !row.tweet_id) continue;
    result.set(row.tweet_id, [...result.get(row.tweet_id) ?? [], decision]);
  }
  return result;
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
/** Applies only when the key pins one of the texts this source was read from. */
export function matchingDecision(decisions: ReviewedLineDecision[], texts: Array<string | null | undefined>): ReviewedLineDecision | null {
  const hashes = new Set(texts.flatMap((text) => text ? [sha(text), sha(text.trim())] : []));
  return decisions.find((decision) => hashes.has(decision.textSha256)) ?? null;
}

const ids = (values: TrainerSlotValue[]) => values.map((value) => value.playerId);
/** The reviewed slot for a parsed unit, or undefined when the key does not speak to that situation. */
export function expectedSlot(decision: ReviewedLineDecision, unit: TweetUnit): Array<number | null> | null | undefined {
  const pick = (rows: TrainerSlotValue[][]) => unit.number != null && unit.number >= 1 ? rows[unit.number - 1] ? ids(rows[unit.number - 1]!) : null : null;
  if (unit.situation === "es_forward") return decision.expected.forwards.length ? pick(decision.expected.forwards) : undefined;
  if (unit.situation === "es_defense") return decision.expected.defensePairs.length ? pick(decision.expected.defensePairs) : undefined;
  if (unit.situation === "pp") return decision.expected.powerPlay.length ? pick(decision.expected.powerPlay) : undefined;
  if (unit.situation === "goalie") return decision.expected.goalies.length ? ids(decision.expected.goalies) : undefined;
  return undefined;
}

/** "reviewed" when the key lists exactly this unit's players; a reason when it contradicts it. */
export function reviewUnit(decision: ReviewedLineDecision, unit: TweetUnit): { authority: "reviewed" } | { reason: string } | null {
  const expected = expectedSlot(decision, unit);
  if (expected === undefined) return null;
  const parsed = unit.players.map((player) => player.playerId).sort((a, b) => a - b).join(",");
  if (expected && expected.every((id) => id != null) && [...expected as number[]].sort((a, b) => a - b).join(",") === parsed) return { authority: "reviewed" };
  return { reason: `reviewed_key_mismatch:${decision.reviewItemId}` };
}

/** Swaps from the key, with each literal located in the text when it appears there. */
export function reviewedSwaps(decision: ReviewedLineDecision, text: string): PPSwap[] {
  const locate = (slot: TrainerSlotValue) => {
    const index = text.toLowerCase().indexOf(slot.name.toLowerCase());
    return { playerId: slot.playerId, name: slot.name, span: index >= 0 ? { start: index, end: index + slot.name.length, text: text.slice(index, index + slot.name.length) } : null };
  };
  return decision.swaps.map((swap) => ({ unitNumber: swap.unitNumber, playersIn: swap.playersIn.map(locate), playersOut: swap.playersOut.map(locate), source: `trainer:${decision.reviewItemId}` }));
}
