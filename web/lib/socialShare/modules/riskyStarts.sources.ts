import type { SharePostContext, SharePostLoadResult, SharePostReadClient, SharePostSource } from "./contract";
import { riskyRows, riskyStartsResult, type RiskyGameLine, type RiskyMarketLines, type RiskyRow, type RiskyStartsData, type RiskyStartsSettings } from "./riskyStarts";
import { editionDate } from "./shared/definitions";
import { inventoryWindow, loadGoalieInventoryDetail, serverObservationClient } from "./shared/goalieInventory.sources";

/*
 * Market lines. Each game takes one row from one source, so two books never meet in a game: the latest stored DraftKings snapshot
 * before puck drop, otherwise NHL.com's partner feed. Other stored books are ignored. `normalizeNhlScheduleOdds` reads the schedule's provider-keyed odds, a different
 * shape, and it files prices for the ledger, so it is not reused. Nothing here turns a price into a probability.
 */
const STORED_TABLE = "game_prediction_market_odds_snapshots";
const STORED_BOOK = "DraftKings";
const STORED_COLUMNS = "game_id, provider, captured_at, event_start_at, home_team_abbreviation, away_team_abbreviation, home_moneyline, away_moneyline, total_line";
/** A 14-day window is about 110 games, at 5 snapshots a game at most so far. Reaching this fails closed. */
const STORED_LIMIT = 1000;
export const NHL_PARTNER_URL = "https://api-web.nhle.com/v1/partner-game/US/now";
const NHL_PARTNER_TIMEOUT_MS = 4000;
export const MARKET_LINES_NOTE = "Moneylines and totals are market lines, the book's own prices, not FHFH numbers. NHL.com's feed covers only its current odds date, so a later game shows No line yet.";
export const STORED_FAILED_NOTE = "Stored market lines could not be read.";
export const NHL_FAILED_NOTE = "NHL.com partner odds could not be read, so games without a stored line show No line yet.";

export type StoredLineRow = { game_id: number; provider: string; captured_at: string; event_start_at: string | null; home_team_abbreviation: string; away_team_abbreviation: string; home_moneyline: number; away_moneyline: number; total_line: number | null };
type PartnerOdd = { description?: string; value?: unknown; qualifier?: unknown };
type PartnerTeam = { abbrev?: string; odds?: PartnerOdd[] };
export type PartnerFeed = { lastUpdatedUTC?: string; bettingPartner?: { name?: string }; games?: { gameId?: number; startTimeUTC?: string; homeTeam?: PartnerTeam; awayTeam?: PartnerTeam }[] };
export type RiskyLineGame = { gameId: number; home: string; away: string; startTimeUtc: string | null };

const lineGames = (rows: readonly RiskyRow[]) => [...new Map(rows.map(row => [row.gameId, { gameId: row.gameId, home: row.home ? row.team : row.opponent, away: row.home ? row.opponent : row.team, startTimeUtc: row.startTimeUtc }])).values()];
const before = (at: string, limit: string | null | undefined) => !!limit && Date.parse(at) < Date.parse(limit);
const price = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : null;
const moneyline = (team: PartnerTeam) => price(team.odds?.find(odd => odd.description === "MONEY_LINE_2_WAY")?.value);
const totalOf = (team: PartnerTeam) => {
  const match = /^[OU](\d+(?:\.\d+)?)$/.exec(String(team.odds?.find(odd => odd.description === "OVER_UNDER")?.qualifier ?? ""));
  return match ? Number(match[1]) : null;
};

/** The latest stored DraftKings row captured before puck drop. A row for other teams, or with no puck drop to compare, proves nothing. */
export function storedLine(game: RiskyLineGame, rows: readonly StoredLineRow[], generatedAt: string): RiskyGameLine | null {
  const usable = rows.filter(row => row.provider === STORED_BOOK && row.game_id === game.gameId && row.home_team_abbreviation === game.home && row.away_team_abbreviation === game.away && before(row.captured_at, game.startTimeUtc ?? row.event_start_at) && Date.parse(row.captured_at) <= Date.parse(generatedAt))
    .sort((a, b) => Date.parse(b.captured_at) - Date.parse(a.captured_at));
  const row = usable[0];
  return row ? { gameId: game.gameId, source: "stored", book: row.provider, capturedAt: row.captured_at, home: game.home, away: game.away, homeMoneyline: row.home_moneyline, awayMoneyline: row.away_moneyline, total: row.total_line } : null;
}
/** One game from the feed. It keeps live prices for games under way, so an update after puck drop is refused. Both moneylines or none; a total only if both sides agree. */
export function partnerLine(game: RiskyLineGame, feed: PartnerFeed): RiskyGameLine | null {
  const entry = feed.games?.find(item => item.gameId === game.gameId), book = feed.bettingPartner?.name, capturedAt = feed.lastUpdatedUTC;
  if (!entry?.homeTeam || !entry.awayTeam || !book || !capturedAt || entry.homeTeam.abbrev !== game.home || entry.awayTeam.abbrev !== game.away || !before(capturedAt, game.startTimeUtc ?? entry.startTimeUTC)) return null;
  const homeMoneyline = moneyline(entry.homeTeam), awayMoneyline = moneyline(entry.awayTeam), homeTotal = totalOf(entry.homeTeam);
  if (homeMoneyline === null || awayMoneyline === null) return null;
  return { gameId: game.gameId, source: "nhl", book, capturedAt, home: game.home, away: game.away, homeMoneyline, awayMoneyline, total: homeTotal !== null && homeTotal === totalOf(entry.awayTeam) ? homeTotal : null };
}
async function readStored(client: SharePostReadClient, gameIds: readonly number[], generatedAt: string) {
  const { data, error } = await client.from(STORED_TABLE).select(STORED_COLUMNS).in("game_id", gameIds).eq("provider", STORED_BOOK).lte("captured_at", generatedAt).order("captured_at", { ascending: false }).limit(STORED_LIMIT);
  if (error || !data || data.length >= STORED_LIMIT) throw new Error("Stored market lines could not be read.");
  return data as unknown as StoredLineRow[];
}
/** One request, one timeout, read only when a game still has no line. Any failure is the caller's "No line yet". */
async function readPartnerFeed(fetchImpl: typeof fetch): Promise<PartnerFeed> {
  const response = await fetchImpl(NHL_PARTNER_URL, { signal: AbortSignal.timeout(NHL_PARTNER_TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`NHL partner odds returned ${response.status}`);
  return await response.json() as PartnerFeed;
}
const source = (name: string, tables: readonly string[], lines: readonly RiskyGameLine[]): SharePostSource => {
  const newest = lines.map(line => line.capturedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return { name, tables, state: "ready", asOf: newest && editionDate(newest), updatedAt: newest };
};
/** A failure in either source costs only its lines. The server client keeps the stored read off the browser. */
export async function loadRiskyMarketLines(rows: readonly RiskyRow[], generatedAt: string, { client, fetchImpl = fetch }: { client?: SharePostReadClient; fetchImpl?: typeof fetch }): Promise<RiskyMarketLines> {
  const games = lineGames(rows), notes = [MARKET_LINES_NOTE], sources: SharePostSource[] = [], lines: Record<string, RiskyGameLine> = {};
  if (!games.length) return { lines, sources, notes };
  let stored: StoredLineRow[] = [];
  try {
    if (!client) throw new Error("No server client.");
    stored = await readStored(client, games.map(game => game.gameId), generatedAt);
    for (const game of games) { const line = storedLine(game, stored, generatedAt); if (line) lines[game.gameId] = line; }
    // Named from the lines it supplied, so a read that supplied none puts no book on the footer.
    const used = Object.values(lines);
    if (used.length) sources.push(source(`${used[0].book} market lines (stored)`, [STORED_TABLE], used));
  } catch { notes.push(STORED_FAILED_NOTE); }
  const remaining = games.filter(game => !lines[game.gameId]);
  if (!remaining.length) return { lines, sources, notes };
  try {
    const feed = await readPartnerFeed(fetchImpl), added: RiskyGameLine[] = [];
    for (const game of remaining) { const line = partnerLine(game, feed); if (line) { lines[game.gameId] = line; added.push(line); } }
    sources.push(source(`NHL.com partner odds${added.length ? ` (${added[0].book})` : ""}`, ["api-web.nhle.com/v1/partner-game/US/now"], added));
  } catch { notes.push(NHL_FAILED_NOTE); }
  return { lines, sources, notes };
}

export async function loadRiskyStarts({ client, generatedAt }: SharePostContext, settings: RiskyStartsSettings): Promise<SharePostLoadResult<RiskyStartsData>> {
  const observationClient = await serverObservationClient();
  const detail = await loadGoalieInventoryDetail(client, { ...inventoryWindow(generatedAt, settings.days), generatedAt }, { observationClient });
  if (detail.inventory.state === "missing") return riskyStartsResult(detail);
  return riskyStartsResult(detail, await loadRiskyMarketLines(riskyRows(detail.inventory, detail.conflicts, detail.lowFirstRanks), generatedAt, { client: observationClient }));
}
