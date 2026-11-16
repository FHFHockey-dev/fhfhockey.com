/**
 * One-time repair: bind named published News lineup cards to their retained source report's NHL game so the
 * renderer can show validated interpreter units (no feed-time reads, no reparse).
 *
 *   RUN="NODE_PATH=. npx ts-node --compiler-options '{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}' scripts/repair-news-lineup-binding.ts"
 *   $RUN --find --team=24          read-only: list published cards whose stored tiles hold @ : | or #
 *   $RUN --item=<id> --item=<id>   read-only dry run (default; at most two cards)
 *   $RUN --item=<id> ... --apply   writes newsLineup to exactly those ids (needs TJ's approval)
 *
 * A card is repaired only when its original tweet and team match retained snapshot rows whose units agree and that
 * name exactly one NHL game, and that game involves the team on the post's Eastern date. Anything else stays source-only.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { buildNewsLineupSnapshot, validatedNewsLineupRows, type NewsLineupSnapshot } from "../lib/newsLineupPresentation";

dotenv.config({ path: ".env.local" });

export type RepairItem = { id: string; team_id: number | null; category: string | null; published_at: string | null;
  original_tweet_id: string | null; source_tweet_id: string | null; source_url: string | null; metadata: Record<string, unknown> | null };
export type RepairSource = { table: string; capture_key: string; tweet_id: string | null; quoted_tweet_id: string | null;
  team_id: number | null; game_id: number | null; interpretation: unknown };
export type RepairGame = { id: number; date: string; homeTeamId: number; awayTeamId: number };
export type RepairPlan = { itemId: string; status: "repairable" | "source_only" | "already_bound"; reason: string;
  originalTweetId: string | null; gameId: number | null; sources: string[]; tiles: Array<[string, string]>; partial: boolean;
  newsLineup: NewsLineupSnapshot | null };

export function originalTweetIdFor(item: RepairItem): string | null {
  return item.original_tweet_id ?? item.source_tweet_id ?? item.source_url?.match(/\/status\/(\d+)/)?.[1] ?? null;
}

function easternDate(instant: string | null): string | null {
  if (!instant || !Number.isFinite(Date.parse(instant))) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(instant));
}

function unitSignature(interpretation: unknown): string | null {
  const units = (interpretation as { units?: unknown } | null)?.units;
  if (!Array.isArray(units)) return null;
  return JSON.stringify(units.map((unit: any) => [unit?.situation, unit?.number, unit?.complete,
    Array.isArray(unit?.players) ? unit.players.map((player: any) => player?.playerId) : null]));
}

/** Pure planning step: decide one card's repair from its retained sources and their game. */
export function planNewsLineupRepair(args: { item: RepairItem; sources: RepairSource[]; games: RepairGame[] }): RepairPlan {
  const { item } = args;
  const originalTweetId = originalTweetIdFor(item);
  const base = { itemId: item.id, originalTweetId, gameId: null, sources: [] as string[], tiles: [] as Array<[string, string]>, partial: false, newsLineup: null };
  if (item.metadata?.newsLineup) return { ...base, status: "already_bound", reason: "card already carries newsLineup" };
  if (!Number.isSafeInteger(item.team_id) || !originalTweetId) return { ...base, status: "source_only", reason: "card has no team or original tweet id" };
  const matched = args.sources.filter((source) => source.team_id === item.team_id
    && (source.tweet_id === originalTweetId || source.quoted_tweet_id === originalTweetId) && unitSignature(source.interpretation) != null);
  const sources = matched.map((source) => `${source.table}:${source.capture_key}`);
  if (!matched.length) return { ...base, sources, status: "source_only", reason: "no retained report with units for this tweet and team" };
  const signatures = new Set(matched.map((source) => unitSignature(source.interpretation)));
  if (signatures.size !== 1) return { ...base, sources, status: "source_only", reason: "retained reports disagree on units" };
  const gameIds = [...new Set(matched.map((source) => source.game_id).filter((id): id is number => Number.isSafeInteger(id)))];
  if (gameIds.length !== 1) return { ...base, sources, status: "source_only", reason: gameIds.length ? "retained reports name more than one game" : "retained reports carry no game id" };
  const game = args.games.find((candidate) => candidate.id === gameIds[0]);
  const postDate = easternDate(item.published_at);
  if (!game || (game.homeTeamId !== item.team_id && game.awayTeamId !== item.team_id) || !postDate || game.date !== postDate) {
    return { ...base, sources, gameId: gameIds[0]!, status: "source_only", reason: "game does not involve the team on the post's Eastern date" };
  }
  const newsLineup = buildNewsLineupSnapshot({ interpretation: matched[0]!.interpretation, teamId: item.team_id, gameId: game.id, sourceTweetId: originalTweetId });
  const validated = validatedNewsLineupRows(newsLineup, item.team_id);
  if (!newsLineup || !validated?.rows.length) return { ...base, sources, gameId: game.id, status: "source_only", reason: "no unit passes validation" };
  return { itemId: item.id, originalTweetId, gameId: game.id, sources, status: "repairable", reason: validated.partial ? "partial: some units left out" : "all units validated",
    tiles: validated.rows.map((row) => [row.label, row.players.map((player, index) => row.notes?.[index] ? `${player} (${row.notes[index]})` : player).join("-")]),
    partial: validated.partial, newsLineup };
}

async function main() {
  const argv = process.argv.slice(2);
  const value = (prefix: string) => argv.filter((argument) => argument.startsWith(prefix)).map((argument) => argument.slice(prefix.length));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const columns = "id, team_id, category, published_at, original_tweet_id, source_tweet_id, source_url, metadata";
  if (argv.includes("--find")) {
    const team = Number(value("--team=")[0]);
    if (!Number.isSafeInteger(team)) throw new Error("--find needs --team=<id>.");
    const { data, error } = await supabase.from("news_feed_items").select(columns).eq("team_id", team).eq("card_status", "published")
      .order("published_at", { ascending: false }).limit(40);
    if (error) throw error;
    const suspect = (data as RepairItem[]).filter((item) => /[@:|#]/.test(JSON.stringify((item.metadata as any)?.lineupCard ?? null)));
    console.log(JSON.stringify(suspect.map((item) => ({ id: item.id, published_at: item.published_at, originalTweetId: originalTweetIdFor(item),
      lineupCard: (item.metadata as any)?.lineupCard })), null, 2));
    return;
  }
  const ids = value("--item=");
  if (!ids.length || ids.length > 2) throw new Error("Name one or two --item=<id> cards.");
  const { data: items, error } = await supabase.from("news_feed_items").select(columns).in("id", ids);
  if (error) throw error;
  const plans: RepairPlan[] = [];
  for (const item of items as RepairItem[]) {
    const tweetId = originalTweetIdFor(item);
    const sources: RepairSource[] = [];
    if (tweetId && item.team_id != null) for (const table of ["line_source_snapshots", "lines_ccc"]) {
      const result = await supabase.from(table).select("capture_key, tweet_id, quoted_tweet_id, team_id, game_id, interpretation:metadata->interpretation")
        .eq("team_id", item.team_id).or(`tweet_id.eq.${tweetId},quoted_tweet_id.eq.${tweetId}`).limit(20);
      if (result.error) throw result.error;
      sources.push(...(result.data as Omit<RepairSource, "table">[]).map((row) => ({ ...row, table })));
    }
    const gameIds = [...new Set(sources.map((source) => source.game_id).filter((id): id is number => Number.isSafeInteger(id)))];
    const games = gameIds.length ? ((await supabase.from("games").select("id, date, homeTeamId, awayTeamId").in("id", gameIds)).data ?? []) as RepairGame[] : [];
    plans.push(planNewsLineupRepair({ item, sources, games }));
  }
  for (const id of ids) if (!plans.some((plan) => plan.itemId === id)) plans.push({ itemId: id, status: "source_only", reason: "card not found",
    originalTweetId: null, gameId: null, sources: [], tiles: [], partial: false, newsLineup: null });
  console.log(JSON.stringify(plans.map(({ newsLineup, ...plan }) => ({ ...plan, writes: plan.status === "repairable" })), null, 2));
  if (!argv.includes("--apply")) { console.log("Dry run: no writes."); return; }
  for (const plan of plans.filter((candidate) => candidate.status === "repairable")) {
    const item = (items as RepairItem[]).find((candidate) => candidate.id === plan.itemId)!;
    const write = await supabase.from("news_feed_items").update({ metadata: { ...(item.metadata ?? {}), newsLineup: plan.newsLineup } }).eq("id", plan.itemId);
    if (write.error) throw write.error;
    console.log(`Wrote newsLineup to ${plan.itemId}.`);
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
