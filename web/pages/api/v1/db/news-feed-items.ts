import type { NextApiResponse } from "next";

import adminOnly from "utils/adminOnlyMiddleware";
import {
  fetchNewsFeedItems,
  fetchNewsFeedKeywordPhrases,
  normalizeKeywordScopeKey,
  normalizeNewsCategory,
  normalizeNewsText,
} from "lib/newsFeed";

type CardStatus = "draft" | "published" | "archived";

function parseLimit(value: string | string[] | undefined, fallback = 50): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : fallback;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : fallback;
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseCardStatus(value: unknown): CardStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function parsePlayerAssignments(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{
    playerId: number | null;
    playerName: string;
    teamId: number | null;
  }>;

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const playerName = normalizeNewsText(record.playerName as string);
      if (!playerName) return null;
      const playerId = Number(record.playerId);
      const teamId = Number(record.teamId);
      return {
        playerId: Number.isFinite(playerId) && playerId > 0 ? playerId : null,
        playerName,
        teamId: Number.isFinite(teamId) && teamId > 0 ? teamId : null,
      };
    })
    .filter(
      (item): item is { playerId: number | null; playerName: string; teamId: number | null } =>
        Boolean(item)
    );
}

async function handleGet(req: any, res: NextApiResponse) {
  const reviewItemId = parseString(req.query.reviewItemId);
  const statusParam = parseString(req.query.status);
  const status =
    statusParam === "draft" || statusParam === "published" || statusParam === "archived"
      ? statusParam
      : "all";

  const [items, keywordPhrases] = await Promise.all([
    fetchNewsFeedItems({
      supabase: req.supabase,
      reviewItemId,
      status: status as any,
      limit: parseLimit(req.query.limit, 25),
    }),
    fetchNewsFeedKeywordPhrases({
      supabase: req.supabase,
      reviewItemId,
      limit: parseLimit(req.query.keywordLimit, 50),
    }),
  ]);

  return res.json({
    success: true,
    items,
    keywordPhrases,
  });
}

async function handlePost(req: any, res: NextApiResponse) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const action = parseString(body.action) ?? "saveCard";

  if (action === "saveKeywordPhrase") {
    const phrase = parseString(body.phrase);
    if (!phrase) {
      return res.status(400).json({
        success: false,
        message: "Missing phrase.",
      });
    }

    const category = parseString(body.category);
    const subcategory = parseString(body.subcategory);
    const nowIso = new Date().toISOString();
    const { error } = await req.supabase
      .from("news_feed_keyword_phrases" as any)
      .upsert(
        {
          source_review_item_id: parseString(body.sourceReviewItemId),
          source: "manual_review",
          phrase,
          normalized_phrase: normalizeNewsText(phrase).toLowerCase(),
          scope_key: normalizeKeywordScopeKey({ phrase, category, subcategory }),
          category: normalizeNewsCategory(category) || null,
          subcategory: normalizeNewsCategory(subcategory) || null,
          notes: parseString(body.notes),
          status: "active",
          updated_at: nowIso,
        },
        { onConflict: "scope_key" }
      );
    if (error) throw error;

    return res.json({
      success: true,
      message: `Saved keyword phrase "${phrase}".`,
    });
  }

  const headline = parseString(body.headline);
  const blurb = parseString(body.blurb) ?? "";
  const category = normalizeNewsCategory(parseString(body.category));
  const subcategory = normalizeNewsCategory(parseString(body.subcategory));
  if (!headline || !category) {
    return res.status(400).json({
      success: false,
      message: "Headline and category are required.",
    });
  }

  const itemId = parseString(body.itemId);
  const cardStatus = parseCardStatus(body.cardStatus);
  const nowIso = new Date().toISOString();
  const publishedAt = cardStatus === "published" ? nowIso : null;
  const itemPayload = {
    source_review_item_id: parseString(body.sourceReviewItemId),
    source_tweet_id: parseString(body.sourceTweetId),
    source_url: parseString(body.sourceUrl),
    tweet_url: parseString(body.tweetUrl),
    source_label: parseString(body.sourceLabel),
    source_account: parseString(body.sourceAccount),
    team_id: Number.isFinite(Number(body.teamId)) ? Number(body.teamId) : null,
    team_abbreviation: parseString(body.teamAbbreviation),
    headline,
    blurb,
    category,
    subcategory: subcategory || null,
    card_status: cardStatus,
    observed_at: parseString(body.observedAt),
    published_at: publishedAt,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    updated_at: nowIso,
  };

  let savedItemId = itemId;
  if (itemId) {
    const { error } = await req.supabase
      .from("news_feed_items" as any)
      .update(itemPayload)
      .eq("id", itemId);
    if (error) throw error;
  } else {
    const { data, error } = await req.supabase
      .from("news_feed_items" as any)
      .insert({
        ...itemPayload,
        created_at: nowIso,
      })
      .select("id")
      .single();
    if (error) throw error;
    savedItemId = data?.id ?? null;
  }

  if (!savedItemId) {
    return res.status(500).json({
      success: false,
      message: "Failed to save news card.",
    });
  }

  const { error: deleteError } = await req.supabase
    .from("news_feed_item_players" as any)
    .delete()
    .eq("news_item_id", savedItemId);
  if (deleteError) throw deleteError;

  const players = parsePlayerAssignments(body.playerAssignments);
  if (players.length > 0) {
    const { error: playerError } = await req.supabase
      .from("news_feed_item_players" as any)
      .insert(
        players.map((player) => ({
          news_item_id: savedItemId,
          player_id: player.playerId,
          player_name: player.playerName,
          team_id: player.teamId,
          role: "subject",
          created_at: nowIso,
          updated_at: nowIso,
        }))
      );
    if (playerError) throw playerError;
  }

  return res.json({
    success: true,
    itemId: savedItemId,
    message: `Saved news card as ${cardStatus}.`,
  });
}

export default adminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "POST") {
    return handlePost(req, res);
  }
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({
    success: false,
    message: "Method not allowed.",
  });
});
