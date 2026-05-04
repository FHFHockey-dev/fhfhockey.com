import { getTeamLogoSvg, fallbackNHLLogo } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";

export type NewsFeedItemPlayer = {
  id: string;
  news_item_id: string;
  player_id: number | null;
  player_name: string;
  team_id: number | null;
  role: string;
};

export type NewsFeedItemRow = {
  id: string;
  source_review_item_id: string | null;
  source_tweet_id: string | null;
  source_url: string | null;
  tweet_url: string | null;
  source_label: string | null;
  source_account: string | null;
  team_id: number | null;
  team_abbreviation: string | null;
  headline: string;
  blurb: string;
  category: string;
  subcategory: string | null;
  card_status: "draft" | "published" | "archived";
  observed_at: string | null;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type NewsFeedItem = NewsFeedItemRow & {
  players: NewsFeedItemPlayer[];
};

export type NewsFeedKeywordPhrase = {
  id: string;
  source_review_item_id: string | null;
  source: string;
  phrase: string;
  normalized_phrase: string;
  scope_key: string;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  status: "active" | "ignored";
  created_at: string;
  updated_at: string;
};

export type PlayerNewsFlag = {
  category: string;
  subcategory: string | null;
  label: string;
  headline: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  tone: "danger" | "success" | "info" | "warning" | "neutral";
};

export type TeamOption = {
  id: number;
  abbreviation: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accent: string;
  logoUrl: string;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeNewsText(value: string | null | undefined): string {
  return normalizeWhitespace(String(value ?? ""));
}

export function normalizeNewsCategory(value: string | null | undefined): string {
  return normalizeNewsText(value).replace(/[_-]+/g, " ").toUpperCase();
}

export function formatNewsFeedLabel(value: string | null | undefined): string {
  return normalizeNewsCategory(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function normalizeKeywordScopeKey(args: {
  phrase: string;
  category?: string | null;
  subcategory?: string | null;
}): string {
  const phrase = normalizeNewsText(args.phrase).toLowerCase();
  const category = normalizeNewsCategory(args.category).toLowerCase();
  const subcategory = normalizeNewsCategory(args.subcategory).toLowerCase();
  return [phrase, category, subcategory].join("::");
}

export function getTeamOptions(): TeamOption[] {
  return Object.values(teamsInfo)
    .map((team) => ({
      id: team.id,
      abbreviation: team.abbrev,
      name: team.name,
      shortName: team.shortName,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      accent: team.accent,
      logoUrl: getTeamLogoSvg(team.abbrev),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getNewsItemTone(category: string | null | undefined): PlayerNewsFlag["tone"] {
  switch (normalizeNewsCategory(category)) {
    case "INJURY":
    case "WAIVER":
      return "danger";
    case "RETURN":
    case "RETURNING":
      return "success";
    case "GOALIE START":
    case "LINE COMBINATION":
    case "LINE CHANGE":
      return "info";
    case "TRANSACTION":
    case "TRADE":
    case "SIGNING":
    case "ROSTER MOVE":
      return "warning";
    default:
      return "neutral";
  }
}

export function buildNewsFlagLabel(args: {
  category: string;
  subcategory?: string | null;
}): string {
  const category = formatNewsFeedLabel(args.category);
  const subcategory = formatNewsFeedLabel(args.subcategory);
  return subcategory ? `${category} · ${subcategory}` : category;
}

export function buildNewsFeedHeadline(args: {
  playerNames: string[];
  category?: string | null;
  subcategory?: string | null;
  teamAbbreviation?: string | null;
}): string {
  const category = normalizeNewsCategory(args.category);
  const subcategory = normalizeNewsCategory(args.subcategory);
  const primaryName = args.playerNames.find(Boolean)?.trim() ?? "";
  const team = args.teamAbbreviation?.trim() ?? "";

  if (category === "INJURY" && primaryName) return `${primaryName} injury update`;
  if ((category === "RETURN" || category === "RETURNING") && primaryName) {
    return `${primaryName} return update`;
  }
  if (category === "GOALIE START" && primaryName) return `${primaryName} goalie update`;
  if (category === "LINE COMBINATION" && team) return `${team} line combination update`;
  if (category === "LINE CHANGE" && team) return `${team} line change`;
  if ((category === "TRADE" || category === "SIGNING" || category === "ROSTER MOVE") && primaryName) {
    return `${primaryName} ${category.toLowerCase()}`;
  }
  if (primaryName && category) return `${primaryName} ${category.toLowerCase()}`;
  if (team && category) return `${team} ${category.toLowerCase()}`;
  if (subcategory) return subcategory;
  return "Update";
}

export function getNewsItemTeamColors(teamAbbreviation: string | null | undefined) {
  const team = teamAbbreviation ? teamsInfo[teamAbbreviation as keyof typeof teamsInfo] : null;
  return {
    primary: team?.primaryColor ?? "#14a2d2",
    secondary: team?.secondaryColor ?? "#24282e",
    accent: team?.accent ?? "#14a2d2",
    logoUrl: team ? getTeamLogoSvg(team.abbrev) : fallbackNHLLogo,
    shortName: team?.shortName ?? teamAbbreviation ?? "NHL",
  };
}

export async function fetchNewsFeedItems(args: {
  supabase: any;
  status?: "draft" | "published" | "archived" | "all";
  limit?: number;
  reviewItemId?: string | null;
}): Promise<NewsFeedItem[]> {
  let query = args.supabase
    .from("news_feed_items" as any)
    .select(
      "id, source_review_item_id, source_tweet_id, source_url, tweet_url, source_label, source_account, team_id, team_abbreviation, headline, blurb, category, subcategory, card_status, observed_at, published_at, metadata, created_at, updated_at"
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }
  if (args.status && args.status !== "all") {
    query = query.eq("card_status", args.status);
  }

  const { data: itemRows, error: itemError } = await query;
  if (itemError) throw itemError;

  const items = (itemRows ?? []) as NewsFeedItemRow[];
  if (items.length === 0) return [];

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("id, news_item_id, player_id, player_name, team_id, role")
    .in(
      "news_item_id",
      items.map((item) => item.id)
    )
    .order("created_at", { ascending: true });
  if (playerError) throw playerError;

  const playersByItemId = new Map<string, NewsFeedItemPlayer[]>();
  for (const row of (playerRows ?? []) as NewsFeedItemPlayer[]) {
    const bucket = playersByItemId.get(row.news_item_id) ?? [];
    bucket.push(row);
    playersByItemId.set(row.news_item_id, bucket);
  }

  return items.map((item) => ({
    ...item,
    players: playersByItemId.get(item.id) ?? [],
  }));
}

export async function fetchNewsFeedKeywordPhrases(args: {
  supabase: any;
  reviewItemId?: string | null;
  limit?: number;
}): Promise<NewsFeedKeywordPhrase[]> {
  let query = args.supabase
    .from("news_feed_keyword_phrases" as any)
    .select(
      "id, source_review_item_id, source, phrase, normalized_phrase, scope_key, category, subcategory, notes, status, created_at, updated_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 100);

  if (args.reviewItemId) {
    query = query.eq("source_review_item_id", args.reviewItemId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NewsFeedKeywordPhrase[];
}

export async function fetchLatestPlayerNewsFlags(args: {
  supabase: any;
  playerIds: number[];
}): Promise<Map<number, PlayerNewsFlag>> {
  const playerIds = Array.from(new Set(args.playerIds.filter((id) => Number.isFinite(id))));
  if (playerIds.length === 0) return new Map();

  const { data: playerRows, error: playerError } = await args.supabase
    .from("news_feed_item_players" as any)
    .select("news_item_id, player_id")
    .in("player_id", playerIds);
  if (playerError) throw playerError;

  const itemIds = Array.from(
    new Set(
      (playerRows ?? [])
        .map((row: any) => row.news_item_id)
        .filter((value: unknown): value is string => typeof value === "string")
    )
  );
  if (itemIds.length === 0) return new Map();

  const { data: itemRows, error: itemError } = await args.supabase
    .from("news_feed_items" as any)
    .select("id, category, subcategory, headline, source_url, published_at, created_at, card_status")
    .in("id", itemIds)
    .eq("card_status", "published");
  if (itemError) throw itemError;

  const itemById = new Map<string, any>((itemRows ?? []).map((row: any) => [row.id, row]));
  const flags = new Map<number, PlayerNewsFlag>();

  const rows = ((playerRows ?? []) as Array<{ news_item_id: string; player_id: number | null }>).sort(
    (left, right) => {
      const leftItem = itemById.get(left.news_item_id);
      const rightItem = itemById.get(right.news_item_id);
      const leftTime = Date.parse(leftItem?.published_at ?? leftItem?.created_at ?? "");
      const rightTime = Date.parse(rightItem?.published_at ?? rightItem?.created_at ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    }
  );

  for (const row of rows) {
    if (!row.player_id || flags.has(row.player_id)) continue;
    const item = itemById.get(row.news_item_id);
    if (!item) continue;
    flags.set(row.player_id, {
      category: item.category,
      subcategory: item.subcategory ?? null,
      label: buildNewsFlagLabel({
        category: item.category,
        subcategory: item.subcategory ?? null,
      }),
      headline: item.headline,
      sourceUrl: item.source_url ?? null,
      publishedAt: item.published_at ?? item.created_at ?? null,
      tone: getNewsItemTone(item.category),
    });
  }

  return flags;
}
