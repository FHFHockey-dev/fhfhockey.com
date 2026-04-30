import { timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/server";

type LineSourceIftttReceiverConfig = {
  sourceGroup: string;
  sourceKey: string;
  sourceAccount: string;
  secretEnvVar: string;
  processorPath?: string;
};

type ResponseBody =
  | {
      success: true;
      sourceKey: string;
      tweetId: string | null;
      processingStatus: "pending" | "processed_attempted";
      processor?: {
        success: boolean;
        status: number | null;
        skipped?: boolean;
        error?: string;
      };
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

function parseBooleanQueryFlag(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getBaseUrl(req: NextApiRequest): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? null;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const host = getHeaderValue(req.headers.host);
  const forwardedProto =
    getHeaderValue(req.headers["x-forwarded-proto"]) ?? "https";
  if (host) return `${forwardedProto}://${host}`;

  return "http://localhost:3000";
}

async function processStoredTweetEvent(args: {
  req: NextApiRequest;
  config: LineSourceIftttReceiverConfig;
  tweetId: string;
}): Promise<{
  success: boolean;
  status: number | null;
  skipped?: boolean;
  error?: string;
}> {
  if (!args.config.processorPath) {
    return {
      success: false,
      status: null,
      skipped: true,
      error: "No processor route is configured for this source yet",
    };
  }

  const params = new URLSearchParams({
    limit: "1",
    reprocess: "true",
    tweetId: args.tweetId,
    sourceKey: args.config.sourceKey,
    date: new Date().toISOString().slice(0, 10),
  });
  const url = `${getBaseUrl(args.req)}${args.config.processorPath}?${params.toString()}`;
  const headers: Record<string, string> = {};

  if (process.env.CRON_SECRET) {
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: await response.text(),
      };
    }

    return {
      success: true,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const record = error as Record<string, unknown>;
  return JSON.stringify({
    code: record.code,
    message: record.message,
    details: record.details,
    hint: record.hint,
  });
}

export function createLineSourceIftttReceiver(
  config: LineSourceIftttReceiverConfig,
) {
  return async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseBody>,
  ) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }

    const expectedSecret = process.env[config.secretEnvVar];
    if (!expectedSecret) {
      return res.status(500).json({
        success: false,
        error: `${config.secretEnvVar} is not configured`,
      });
    }

    if (!secretsMatch(getSecretFromRequest(req), expectedSecret)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const text = getBodyValue(req.body, ["text", "Text"]);
    const username = getBodyValue(req.body, ["username", "UserName"]);
    const linkToTweet = getBodyValue(req.body, [
      "link_to_tweet",
      "linkToTweet",
      "LinkToTweet",
    ]);
    const createdAt = getBodyValue(req.body, [
      "created_at",
      "createdAt",
      "CreatedAt",
    ]);
    const tweetEmbedCode = getBodyValue(req.body, [
      "tweet_embed_code",
      "tweetEmbedCode",
      "TweetEmbedCode",
    ]);
    const sourceAccount =
      getBodyValue(req.body, ["source_account", "sourceAccount"]) ??
      config.sourceAccount;
    const tweetId = extractTweetId(linkToTweet);
    const shouldProcessImmediately = parseBooleanQueryFlag(req.query.process);

    if (!linkToTweet && !text) {
      return res.status(400).json({
        success: false,
        error: "Expected at least link_to_tweet or text in request body",
      });
    }

    const row = {
      source: "ifttt",
      source_group: config.sourceGroup,
      source_key: config.sourceKey,
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
      updated_at: new Date().toISOString(),
    };

    const query = supabase.from("line_source_ifttt_events" as any);
    const { error } = tweetId
      ? await query.upsert(row as any, {
          onConflict: "source_key,tweet_id",
        })
      : await query.insert(row as any);

    if (error) {
      console.error(
        "Line source IFTTT tweet ingest failed:",
        formatSupabaseError(error),
      );
      return res.status(500).json({
        success: false,
        error: "Failed to store IFTTT event",
      });
    }

    const processor =
      shouldProcessImmediately && tweetId
        ? await processStoredTweetEvent({ req, config, tweetId })
        : undefined;

    if (processor && !processor.success && !processor.skipped) {
      console.warn("Line source IFTTT processor follow-up failed:", processor);
    }

    return res.status(200).json({
      success: true,
      sourceKey: config.sourceKey,
      tweetId,
      processingStatus: processor ? "processed_attempted" : "pending",
      ...(processor ? { processor } : {}),
    });
  };
}
