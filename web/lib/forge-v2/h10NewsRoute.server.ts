/**
 * Storage and I/O for the H1–H10 news, official-roster and availability steps (pure rules in `h10News.ts`).
 * Everything is an immutable `forge_h10_evidence` row (migration 20261123210000): a small table that is never
 * partitioned or archived, because long injuries and move chains outlive any archive window.
 *  - `forge-h10-news`: one row per card revision, first sight only; a correction names its predecessor.
 *  - `forge-h10-official-roster`: one row per distinct official roster content (content-addressed, so an unchanged
 *    re-fetch writes nothing); the response hash is stored before any move derived from it.
 *  - `forge-h10-official-move`: one row per official move, dated by its first observation.
 *  - `forge-h10-overlay`: one row per availability/role revision of a player/game; each names its predecessor and
 *    the stored vintage it applies to.
 * The only outbound HTTP is the official NHL roster read (`api-web.nhle.com/v1/roster/{club}/{season}`), one request
 * per club, sequential, with a timeout. NST is never called.
 */
import { Instant, instant } from "./contracts";
import { contentHash } from "./hash.server";
import { SqlConnection } from "./history.server";
import { teamsInfo } from "../teamsInfo";
import { inferredLogReceipt } from "./h10Reader.server";
import { AvailabilityOverlay, credibleForAvailability, effectiveSnapshots, mergeSnapshots, OfficialAppearance, NewsCardRow, NewsSnapshot, OfficialMove, OfficialRoster, OverlayKey, officialMoves, parseOfficialRoster, resolveAvailability } from "./h10News";

const EVIDENCE = "forge_v2_private.forge_h10_evidence";
export const H10_NEWS_SCOPES = { news: "forge-h10-news", roster: "forge-h10-official-roster", move: "forge-h10-official-move", overlay: "forge-h10-overlay", appearance: "forge-h10-appearance" } as const;

/** Accepted cards changed since `$1` in the categories the material path reads (published and withdrawn, so a
 * retraction is seen), one keyset page at a time after (`$2`, `$3`), `$4` rows per page, in a deterministic order.
 * Real volume (read #3, 11-16..11-23): at most 192 such cards in any 72 h window. */
export const H10_NEWS_SQL = `select i.id::text as id, i.card_status, i.category, i.subcategory, i.source_account, i.source_tweet_id, i.original_tweet_id, i.tweet_url,
  i.team_id::int as team_id, i.headline, i.observed_at, i.published_at, i.updated_at,
  coalesce((select jsonb_agg(jsonb_build_object('player_id', p.player_id, 'team_id', p.team_id, 'role', p.role) order by p.player_id, p.role)
    from public.news_feed_item_players p where p.news_item_id = i.id), '[]'::jsonb) as players
from public.news_feed_items i
where i.updated_at > $1 and (i.updated_at, i.id::text) > ($2::timestamptz, $3::text) and i.card_status in ('published', 'archived')
  and upper(i.category) in ('TRADE', 'SIGNING', 'WAIVER', 'ROSTER MOVE', 'RETIREMENT', 'TRANSACTION', 'INJURY', 'REPORTED INJURY', 'SCRATCHES', 'RETURN',
    'RETURNING', 'GOALIE START', 'LINE COMBINATION', 'LINE CHANGE', 'LINEUP', 'PRACTICE LINES')
order by i.updated_at, i.id::text limit $4`;
export const H10_NEWS_PAGE = 500, H10_NEWS_MAX_PAGES = 10;

/** More accepted cards than the read cap (5,000) changed in the window: the call refuses the news step and reports the
 * gap rather than processing a partial set. */
export class H10NewsReadOverflow extends Error {
  constructor(readonly since: Instant, readonly through: { updatedAt: Instant; id: string }, readonly read: number) { super("h10_news_read_cap_exceeded"); }
}

/** Official appearances with actual participation (time on ice above zero: never a scratch, a dressed-but-unused
 * player or a backup goalie who did not enter) of the given players since a date. Goalie lines are placed through the
 * game their club played that date (the Utah-safe mapping). Bounded. */
export const H10_APPEARANCES_SQL = `select w.player_id::int as player_id, w.game_id::text as game_id, g."startTime" as start_time, w.toi_per_game::float8 as toi
from public.wgo_skater_stats w join public.games g on g.id = w.game_id
where w.player_id = any($1::int[]) and w.date >= $2::date and w.game_id is not null and w.games_played = 1 and coalesce(w.toi_per_game, 0) > 0
union
select s.goalie_id::int, g.id::text, g."startTime", s.time_on_ice::float8
from public.wgo_goalie_stats s join public.teams t on t.abbreviation = s.team_abbreviation
join public.games g on g.date = s.date and g.type = 2 and t.id in (g."homeTeamId", g."awayTeamId")
where s.goalie_id = any($1::int[]) and s.date >= $2::date and s.games_played = 1 and coalesce(s.time_on_ice, 0) > 0
limit 5000`;
/** Participating appearances after a credible out or scratch report in effect at `asOf`, for those players only.
 * A line counts once it was available (the inferred WGO receipt clock) and is stamped with the time FORGE first
 * observed it: stored on first read (`forge-h10-appearance`), so a later call keeps the first time. */
export async function readAppearances(db: SqlConnection, snapshots: readonly NewsSnapshot[], asOf: Instant, clock: { logIngestUtcMinute: number; gameHours: number }): Promise<OfficialAppearance[]> {
  const outs = effectiveSnapshots(snapshots, asOf).filter(s => (s.signal === "out" || s.signal === "scratch") && credibleForAvailability(s));
  if (!outs.length) return [];
  const players = [...new Set(outs.flatMap(s => s.players.map(p => p.playerId)))].sort((a, b) => a - b);
  const since = outs.map(s => s.postedAt!).sort()[0].slice(0, 10);
  const { rows } = await db.query<{ player_id: number; game_id: string; start_time: Date | string; toi: number }>(H10_APPEARANCES_SQL, [players, since]);
  if (rows.length >= 5000) throw new Error("h10_appearances_read_limit_reached");
  const lines = rows.map(r => ({ playerId: r.player_id, gameId: Number(r.game_id), gameStartAt: new Date(r.start_time).toISOString(), timeOnIceSeconds: Number(r.toi) }))
    .filter(a => instant(inferredLogReceipt(a.gameStartAt, clock.logIngestUtcMinute, clock.gameHours)) <= instant(asOf))
    .sort((a, b) => a.playerId - b.playerId || a.gameId - b.gameId);
  if (!lines.length) return [];
  const ids = lines.map(a => `forge-h10-appearance:${a.playerId}:${a.gameId}`);
  const known = new Map((await db.query<{ id: string; payload: string }>(`select id, payload from ${EVIDENCE} where id = any($1::text[])`, [ids])).rows
    .map(r => [r.id, JSON.parse(r.payload) as OfficialAppearance]));
  const out: OfficialAppearance[] = [];
  for (const [i, line] of lines.entries()) {
    out.push(known.get(ids[i]) ?? await append(db, ids[i], H10_NEWS_SCOPES.appearance, { ...line, firstObservedAt: asOf }, null) as OfficialAppearance);
  }
  return out;
}

export type ReadNews = (db: SqlConnection, since: Instant) => Promise<NewsCardRow[]>;
export type FetchRoster = (abbrev: string, seasonId: number) => Promise<unknown>;

export const readNewsRows: ReadNews = async (db, since) => {
  const rows: NewsCardRow[] = [];
  let after = { updatedAt: since, id: "" };
  for (let page = 0; page < H10_NEWS_MAX_PAGES; page++) {
    const batch = (await db.query(H10_NEWS_SQL, [since, after.updatedAt, after.id, H10_NEWS_PAGE])).rows as unknown as NewsCardRow[];
    rows.push(...batch);
    if (batch.length < H10_NEWS_PAGE) return rows;
    const last = batch[batch.length - 1];
    after = { updatedAt: new Date(last.updated_at).toISOString(), id: last.id };
  }
  // A full last page may hide more: refuse rather than truncate.
  const more = (await db.query(H10_NEWS_SQL, [since, after.updatedAt, after.id, 1])).rows;
  if (more.length) throw new H10NewsReadOverflow(since, after, rows.length);
  return rows;
};
/** The official roster read: one GET, 8 s timeout, no retry (a failure leaves the report pending). */
export const fetchOfficialRoster: FetchRoster = async (abbrev, seasonId) => {
  const response = await fetch(`https://api-web.nhle.com/v1/roster/${encodeURIComponent(abbrev)}/${seasonId}`, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`official_roster_http_${response.status}`);
  return response.json();
};
export const clubAbbrev = (teamId: number) => Object.values(teamsInfo).find(team => team.id === teamId)?.abbrev ?? null;

async function load<T>(db: SqlConnection, scope: string, since: Instant): Promise<T[]> {
  const { rows } = await db.query<{ payload: string }>(`select payload from ${EVIDENCE} where scope_key = $1 and recorded_at > $2 order by ordinal`, [scope, since]);
  return rows.map(row => JSON.parse(row.payload) as T);
}
async function append(db: SqlConnection, id: string, scope: string, payload: object, predecessor: string | null) {
  await db.query(`insert into ${EVIDENCE} (id, scope_key, predecessor_id, payload) values ($1, $2, $3, $4) on conflict (id) do nothing`,
    [id, scope, predecessor, JSON.stringify(payload)]);
  const { rows } = await db.query<{ payload: string }>(`select payload from ${EVIDENCE} where id = $1`, [id]);
  return JSON.parse(rows[0].payload);
}

/** Reads cards changed in the lookback window, snapshots new revisions and returns every stored snapshot in it. */
export async function newsStep(db: SqlConnection, readNews: ReadNews, seenAt: Instant, lookbackHours: number) {
  const since = new Date(instant(seenAt) - lookbackHours * 3600000).toISOString();
  const recent = await load<NewsSnapshot>(db, H10_NEWS_SCOPES.news, new Date(instant(since) - lookbackHours * 3600000).toISOString());
  // An out overlay lasts until an explicit return, however long that takes: every revision of any card that was ever
  // an out or a return stays loaded (small: those cards only), so an old injury neither lapses nor misses a correction.
  const { rows: lasting } = await db.query<{ payload: string }>(`select payload from ${EVIDENCE} where scope_key = $1
    and payload::jsonb->>'cardId' in (select payload::jsonb->>'cardId' from ${EVIDENCE} where scope_key = $1
      and payload::jsonb->>'signal' in ('out', 'confirmed_return')) order by ordinal`, [H10_NEWS_SCOPES.news]);
  const byId = new Map([...lasting.map(row => JSON.parse(row.payload) as NewsSnapshot), ...recent].map(snapshot => [snapshot.id, snapshot]));
  const stored = [...byId.values()];
  const rows = await readNews(db, since);
  const merged = mergeSnapshots(stored, rows, seenAt);
  // A concurrent call may have stored the same revision first; the stored row (and its first-seen time) wins.
  const added: NewsSnapshot[] = [];
  for (const snapshot of merged.added) added.push(await append(db, snapshot.id, H10_NEWS_SCOPES.news, snapshot, snapshot.supersedes) as NewsSnapshot);
  const all = [...stored, ...added];
  return { snapshots: all, added: added.length, duplicates: merged.duplicates, read: rows.length };
}

/** Stored official moves (and departures) recorded in the window. */
export async function storedMoves(db: SqlConnection, sinceDays: number, now: number): Promise<OfficialMove[]> {
  return load<OfficialMove>(db, H10_NEWS_SCOPES.move, new Date(now - sinceDays * 86400000).toISOString());
}

/** Fetches the named clubs' official rosters one at a time, stores each distinct response, and stores any new
 * official move against the current FORGE membership. A failed club is listed and skipped. */
export async function officialStep(db: SqlConnection, teams: readonly number[], seasonId: number, fetchRoster: FetchRoster, now: () => Instant,
  current: ReadonlyMap<number, number>, stored: readonly OfficialMove[], options: { everyClub?: boolean } = {}) {
  const rosters: OfficialRoster[] = [], failures: Array<{ teamId: number; reason: string }> = [];
  for (const teamId of [...teams].sort((a, b) => a - b)) {
    const abbrev = clubAbbrev(teamId);
    if (!abbrev) { failures.push({ teamId, reason: "club_abbreviation_unknown" }); continue; }
    try {
      const fetchedAt = now(), roster = parseOfficialRoster(await fetchRoster(abbrev, seasonId), teamId, abbrev, fetchedAt);
      const kept = await append(db, `forge-h10-official-roster:${abbrev}:${roster.sha256.slice(0, 32)}`, H10_NEWS_SCOPES.roster, roster, null) as OfficialRoster;
      // An unchanged roster keeps its first fetch time, so a move it shows is dated by its first observation.
      rosters.push({ ...roster, fetchedAt: instant(kept.fetchedAt) < instant(fetchedAt) ? kept.fetchedAt : fetchedAt });
    } catch (error) { failures.push({ teamId, reason: error instanceof Error ? error.message.slice(0, 80) : "official_roster_failed" }); }
  }
  // Departures are read only from a complete read of every club; a failed club makes the read partial.
  const complete = options.everyClub === true && failures.length === 0 && rosters.length === teams.length;
  const moves = officialMoves(rosters, current, stored, complete), known = new Set(stored.map(m => m.id)), fresh: OfficialMove[] = [];
  for (const move of moves.filter(m => !known.has(m.id))) fresh.push(await append(db, move.id, H10_NEWS_SCOPES.move, move, move.after) as OfficialMove);
  return { rosters, failures, complete, newMoves: fresh, moves: [...stored, ...fresh] };
}

interface StoredOverlay { overlay: AvailabilityOverlay; asOf: Instant; vintage: { id: string; outputHash: string } | null }
/** Writes an overlay revision for every key whose state changed since its latest stored revision, including keys
 * whose reports were withdrawn (back to available). Each revision names the stored vintage it applies to. */
export async function overlayStep(db: SqlConnection, keys: readonly OverlayKey[], snapshots: readonly NewsSnapshot[], asOf: Instant, lookbackDays: number) {
  const overlays = resolveAvailability(keys, snapshots, asOf);
  const { rows } = await db.query<{ id: string; payload: string }>(`select id, payload from ${EVIDENCE} where scope_key = $1 and recorded_at > $2 order by ordinal`,
    [H10_NEWS_SCOPES.overlay, new Date(instant(asOf) - lookbackDays * 86400000).toISOString()]);
  const latest = new Map<string, { id: string; value: StoredOverlay }>();
  for (const row of rows) { const value = JSON.parse(row.payload) as StoredOverlay; latest.set(`${value.overlay.playerId}:${value.overlay.gameId}`, { id: row.id, value }); }
  const keyed = new Set(keys.map(k => `${k.playerId}:${k.gameId}`)), next = new Map(overlays.map(o => [`${o.playerId}:${o.gameId}`, o]));
  for (const [id, prior] of latest) if (keyed.has(id) && !next.has(id) && (prior.value.overlay.availability !== "available" || prior.value.overlay.role !== null)) {
    next.set(id, { ...prior.value.overlay, availability: "available", role: null, annotations: ["no_effective_report"], evidence: [], conflicts: [] });
  }
  let written = 0, unchanged = 0;
  for (const [id, overlay] of [...next].sort((a, b) => a[0].localeCompare(b[0]))) {
    const prior = latest.get(id);
    if (prior && contentHash(prior.value.overlay) === contentHash(overlay)) { unchanged += 1; continue; }
    const vintage = await latestVintage(db, overlay.playerId, overlay.gameId);
    const value: StoredOverlay = { overlay, asOf, vintage };
    await append(db, `forge-h10-overlay:${id}:${contentHash(overlay).slice(0, 16)}:after:${prior?.id ?? "none"}`, H10_NEWS_SCOPES.overlay, value, prior?.id ?? null);
    written += 1;
  }
  return { overlays: [...next.values()], written, unchanged };
}

/** The latest receipted vintage of a player/game (skater or goalie table), as served before the overlay. */
export async function latestVintage(db: SqlConnection, playerId: number, gameId: number) {
  const skater = await db.query<{ id: string; output_hash: string }>(`select v.id, v.output_hash from forge_v2_private.forge_v2_vintages v
    join forge_v2_private.forge_v2_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash where v.player_id = $1 and v.game_id = $2 order by v.issuance_sequence desc limit 1`, [playerId, gameId]);
  if (skater.rows[0]) return { id: skater.rows[0].id, outputHash: skater.rows[0].output_hash };
  const migrated = (await db.query<{ ok: boolean }>("select to_regclass('forge_v2_private.forge_v2_goalie_vintages') is not null as ok")).rows[0]?.ok;
  if (!migrated) return null;
  const goalie = await db.query<{ id: string; output_hash: string }>(`select v.id, v.output_hash from forge_v2_private.forge_v2_goalie_vintages v
    join forge_v2_private.forge_v2_goalie_publication_receipts r on r.vintage_id = v.id and r.output_hash = v.output_hash where v.player_id = $1 and v.game_id = $2 order by v.issuance_sequence desc limit 1`, [playerId, gameId]);
  return goalie.rows[0] ? { id: goalie.rows[0].id, outputHash: goalie.rows[0].output_hash } : null;
}
