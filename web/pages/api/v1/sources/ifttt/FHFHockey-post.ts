import type { NextApiRequest, NextApiResponse } from "next";
import { matchPostedCard } from "lib/socialShare/postedWeek";
import { getBodyValue, getSecretFromRequest, parseIftttDateToIso, resolveIftttWebhookSecret, secretsMatch } from "lib/sources/lineSourceIftttReceiver";
import supabase from "lib/supabase/server";

const ACCOUNT = "fhfhockey", SECRET_ENV_VAR = "IFTTT_FHFHOCKEY_WEBHOOK_SECRET";

const isAccount = (name: string | null) => name?.replace(/^@/, "").toLowerCase() === ACCOUNT;

/** The post id and author of an x.com or twitter.com post link. The author is null for an /i/ link, which names none. */
export function parsePostLink(link: string | null) {
  let url: URL;
  try { url = new URL(link ?? ""); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || !/^(www\.|mobile\.)?(x|twitter)\.com$/i.test(url.hostname)) return null;
  const path = url.pathname.match(/^\/(?:i(?:\/web)?|([A-Za-z0-9_]{1,15}))\/status(?:es)?\/(\d+)(?:\/.*)?$/);
  return path ? { author: path[1] ?? null, tweetId: path[2] } : null;
}

/**
 * @FHFHockey's own media posts, from the IFTTT trigger "New photo or video by you", for the Social Share week strip.
 * Same secret check as the line-source receivers, but that secret can be shared across applets, so a post must also
 * prove it is this account's. The first delivery of a post wins, except that a post stored with no readable date takes
 * the date from a later delivery. A date is never invented: unknown stays null and marks no day. Nothing here calls X.
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
  const sourceAccount = getBodyValue(req.body, ["source_account", "sourceAccount"]);
  const post = parsePostLink(postLink);
  if (!post) return res.status(400).json({ success: false, error: "Expected an x.com or twitter.com post link" });
  // Every name given must be this account's, and at least one of the username or the link's author must be given.
  const named = [username, post.author, sourceAccount].filter(Boolean) as string[];
  if (!named.every(isAccount) || !(username || post.author)) return res.status(400).json({ success: false, error: "Unexpected source account" });

  const matchedCard = matchPostedCard(altText);
  const postedAt = parseIftttDateToIso(createdAt), tweetId = post.tweetId;
  const table = () => supabase.from("social_share_x_posts" as any) as any;
  const { error: insertError } = await table().upsert({
    tweet_id: tweetId,
    post_link: postLink,
    username,
    posted_at: postedAt,
    created_at_label: createdAt,
    post_text: getBodyValue(req.body, ["text", "Text"]),
    alt_text: altText,
    matched_card: matchedCard,
    raw_payload: req.body && typeof req.body === "object" ? req.body : {},
  }, { onConflict: "tweet_id", ignoreDuplicates: true });
  const { error } = insertError || !postedAt ? { error: insertError }
    : await table().update({ posted_at: postedAt, created_at_label: createdAt }).eq("tweet_id", tweetId).is("posted_at", null);
  if (error) {
    console.error("FHFHockey IFTTT post ingest failed:", error.code);
    return res.status(500).json({ success: false, error: "Failed to store IFTTT event" });
  }
  return res.status(200).json({ success: true, tweetId, matchedCard });
}
