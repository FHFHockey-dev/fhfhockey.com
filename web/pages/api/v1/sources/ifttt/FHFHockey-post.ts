import type { NextApiRequest, NextApiResponse } from "next";
import { matchPostedCard } from "lib/socialShare/postedWeek";
import { extractTweetId, getBodyValue, getSecretFromRequest, parseIftttDateToIso, resolveIftttWebhookSecret, secretsMatch } from "lib/sources/lineSourceIftttReceiver";
import supabase from "lib/supabase/server";

const ACCOUNT = "fhfhockey", SECRET_ENV_VAR = "IFTTT_FHFHOCKEY_WEBHOOK_SECRET";

/**
 * @FHFHockey's own media posts, from the IFTTT trigger "New photo or video by you", for the Social Share week strip.
 * Same secret check as the line-source receivers. It keeps only this account's posts with a real post id, and the first
 * delivery of a post wins. Nothing here calls X.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  const expectedSecret = resolveIftttWebhookSecret(SECRET_ENV_VAR);
  if (!expectedSecret) return res.status(500).json({ success: false, error: `${SECRET_ENV_VAR} is not configured` });
  if (!secretsMatch(getSecretFromRequest(req), expectedSecret)) return res.status(401).json({ success: false, error: "Unauthorized" });

  const username = getBodyValue(req.body, ["username", "UserName"]);
  const postLink = getBodyValue(req.body, ["link_to_tweet", "linkToTweet", "LinkToTweet"]);
  const createdAt = getBodyValue(req.body, ["created_at", "createdAt", "CreatedAt"]);
  const altText = getBodyValue(req.body, ["alt_text", "altText", "AltText"]);
  if (username && username.replace(/^@/, "").toLowerCase() !== ACCOUNT) return res.status(400).json({ success: false, error: "Unexpected source account" });
  const tweetId = extractTweetId(postLink);
  if (!tweetId) return res.status(400).json({ success: false, error: "Expected link_to_tweet with a post id" });

  const matchedCard = matchPostedCard(altText);
  const { error } = await supabase.from("social_share_x_posts" as any).upsert({
    tweet_id: tweetId,
    post_link: postLink,
    username,
    posted_at: parseIftttDateToIso(createdAt) ?? new Date().toISOString(),
    created_at_label: createdAt,
    post_text: getBodyValue(req.body, ["text", "Text"]),
    alt_text: altText,
    matched_card: matchedCard,
    raw_payload: req.body && typeof req.body === "object" ? req.body : {},
  } as any, { onConflict: "tweet_id", ignoreDuplicates: true });
  if (error) {
    console.error("FHFHockey IFTTT post ingest failed:", error.code);
    return res.status(500).json({ success: false, error: "Failed to store IFTTT event" });
  }
  return res.status(200).json({ success: true, tweetId, matchedCard });
}
