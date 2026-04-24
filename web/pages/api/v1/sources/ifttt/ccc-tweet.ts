import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";

import supabase from "lib/supabase/server";

type ResponseBody =
  | {
      success: true;
      tweetId: string | null;
      processingStatus: "pending";
    }
  | {
      success: false;
      error: string;
    };

function getSecretFromRequest(req: NextApiRequest): string {
  const headerSecret = req.headers["x-fhfh-ifttt-secret"];
  if (typeof headerSecret === "string") return headerSecret;
  const querySecret = req.query.secret;
  if (typeof querySecret === "string") return querySecret;
  return "";
}

function secretsMatch(received: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const receivedBuffer = encoder.encode(received);
  const expectedBuffer = encoder.encode(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function getBodyValue(body: unknown, keys: string[]): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function extractTweetId(value: string | null): string | null {
  if (!value) return null;
  return value.match(/\/status(?:es)?\/(\d+)/i)?.[1] ?? null;
}

function parseDateToIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const record = error as Record<string, unknown>;
  return JSON.stringify({
    code: record.code,
    message: record.message,
    details: record.details,
    hint: record.hint
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const expectedSecret = process.env.IFTTT_CCC_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({
      success: false,
      error: "IFTTT_CCC_WEBHOOK_SECRET is not configured"
    });
  }

  if (!secretsMatch(getSecretFromRequest(req), expectedSecret)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  const text = getBodyValue(req.body, ["text", "Text"]);
  const username = getBodyValue(req.body, ["username", "UserName"]);
  const linkToTweet = getBodyValue(req.body, [
    "link_to_tweet",
    "linkToTweet",
    "LinkToTweet"
  ]);
  const createdAt = getBodyValue(req.body, ["created_at", "createdAt", "CreatedAt"]);
  const tweetEmbedCode = getBodyValue(req.body, [
    "tweet_embed_code",
    "tweetEmbedCode",
    "TweetEmbedCode"
  ]);
  const sourceAccount =
    getBodyValue(req.body, ["source_account", "sourceAccount"]) ?? "CcCMiddleton";
  const tweetId = extractTweetId(linkToTweet);

  if (!linkToTweet && !text) {
    return res.status(400).json({
      success: false,
      error: "Expected at least link_to_tweet or text in request body"
    });
  }

  const row = {
    source: "ifttt",
    source_account: sourceAccount,
    username,
    text,
    link_to_tweet: linkToTweet,
    tweet_id: tweetId,
    tweet_embed_code: tweetEmbedCode,
    tweet_created_at: parseDateToIso(createdAt),
    created_at_label: createdAt,
    processing_status: "pending",
    raw_payload: req.body && typeof req.body === "object" ? req.body : {},
    updated_at: new Date().toISOString()
  };

  const query = supabase.from("lines_ccc_ifttt_events" as any);
  const { error } = tweetId
    ? await query.upsert(row as any, {
        onConflict: "tweet_id"
      })
    : await query.insert(row as any);

  if (error) {
    console.error("IFTTT CCC tweet ingest failed:", formatSupabaseError(error));
    return res.status(500).json({
      success: false,
      error: "Failed to store IFTTT event"
    });
  }

  return res.status(200).json({
    success: true,
    tweetId,
    processingStatus: "pending"
  });
}
