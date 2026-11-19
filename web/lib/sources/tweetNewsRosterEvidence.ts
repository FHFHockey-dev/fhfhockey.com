import type { TweetNewsAutomationPlayer, TweetNewsAutomationReviewRow } from "./tweetNewsAutomation";

export type TweetNewsRosterEvidence = {
  source: "wrapper" | "quoted";
  text: string;
  publishedAt: string | null;
  players: TweetNewsAutomationPlayer[];
  reviewSpans: { start: number; end: number }[];
};

type ReviewSource = Pick<TweetNewsAutomationReviewRow, "metadata" | "enriched_text" | "raw_text" | "quoted_text" | "parser_filter_status">;

/** A legacy review has no receipt. A mismatched receipt cannot lend its player IDs to different text. */
export function readTweetNewsRosterEvidence(row: ReviewSource): TweetNewsRosterEvidence | null {
  const value = row.metadata?.intakeRosterEvidence;
  if (value == null) return null;
  const evidence = value as Partial<TweetNewsRosterEvidence>;
  const source = evidence.source === "quoted" ? "quoted" : "wrapper";
  const text = ((source === "quoted" ? row.quoted_text : row.enriched_text ?? row.raw_text) ?? "").trim();
  if (text !== evidence.text || row.parser_filter_status !== "accepted" || !text
    || typeof evidence.publishedAt !== "string" || !Number.isFinite(Date.parse(evidence.publishedAt))
    || !Array.isArray(evidence.players) || !Array.isArray(evidence.reviewSpans)
    || !evidence.reviewSpans.every(span => span && Number.isInteger(span.start) && Number.isInteger(span.end)
      && span.start >= 0 && span.start < span.end && span.end <= text.length)
    || !evidence.players.every(player => player && Number.isSafeInteger(player.id) && player.id > 0 && Number.isSafeInteger(player.team_id)
      && typeof player.fullName === "string" && typeof player.lastName === "string" && (player.position == null || typeof player.position === "string")
      && (!player.aliases || Array.isArray(player.aliases) && player.aliases.every(alias => typeof alias === "string")))) {
    return { source, text, publishedAt: null, players: [], reviewSpans: [] };
  }
  return { source, text, publishedAt: evidence.publishedAt, players: evidence.players, reviewSpans: evidence.reviewSpans };
}
