import { createHash } from "node:crypto";
import { fetchAllSupabaseFilterChunks } from "lib/supabase/pagination";
import type { TrainerExtraction, TrainerSlotValue } from "lib/sources/tweetSwipeTrainer";
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

const CONTEXTS = new Set(["warmup", "game", "practice", "projected"]);
const slots = (value: unknown): TrainerSlotValue[] => Array.isArray(value) ? value.filter((slot) => slot && typeof slot.name === "string") : [];

export function readReviewedDecision(reviewItemId: string, metadata: unknown): ReviewedLineDecision | null {
  const key = (metadata as { answerKey?: any } | null)?.answerKey;
  if (!key || (key.version !== 1 && key.version !== 2) || !key.expected || typeof key.textSha256 !== "string") return null;
  const expected: TrainerExtraction = { ...key.expected, forwards: key.expected.forwards ?? [], defensePairs: key.expected.defensePairs ?? [], goalies: key.expected.goalies ?? [],
    extraForwards: key.expected.extraForwards ?? [], extraDefensemen: key.expected.extraDefensemen ?? [], powerPlay: key.expected.powerPlay ?? [], offPowerPlay: key.expected.offPowerPlay ?? [] };
  // v2 (Lane E) keeps context, scope, game and powerPlaySwaps on the extraction itself.
  const v2 = key.version === 2;
  const game = v2 ? key.expected.game : null;
  const binding = game && typeof game === "object" ? {
    gameId: Number.isSafeInteger(game.gameId) ? game.gameId : null,
    opponentId: Number.isSafeInteger(game.opponentTeamId) ? game.opponentTeamId : null,
    date: typeof game.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(game.date) ? game.date : null } : null;
  const v2Swaps = v2 && Array.isArray(key.expected.powerPlaySwaps) ? key.expected.powerPlaySwaps.flatMap((swap: any) => [1, 2].includes(swap?.unit)
    ? [{ unitNumber: swap.unit as 1 | 2, playersIn: slots(swap.in), playersOut: slots(swap.out) }] : []) : [];
  // v1: a partly filled PP unit plus "off the power play" names is a swap on that unit.
  const v1Swaps = !v2Swaps.length && expected.offPowerPlay.length ? expected.powerPlay.flatMap((unit, index) =>
    index < 2 && unit.length > 0 && unit.length < 5 ? [{ unitNumber: (index + 1) as 1 | 2, playersIn: unit, playersOut: expected.offPowerPlay }] : []) : [];
  return { reviewItemId, version: key.version, textSha256: key.textSha256, verdict: key.verdict === "wrong" ? "wrong" : "correct", expected,
    context: v2 && CONTEXTS.has(key.expected.context) ? key.expected.context : null, binding: binding && (binding.gameId || binding.opponentId && binding.date) ? binding : null,
    scope: v2 && ["full", "partial", "change"].includes(key.expected.scope) ? key.expected.scope : null,
    swaps: (v2Swaps.length ? v2Swaps : v1Swaps).filter((swap: { playersIn: unknown[]; playersOut: unknown[] }) => swap.playersIn.length && swap.playersIn.length === swap.playersOut.length) };
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
