import type { SupabaseClient } from "@supabase/supabase-js";
import type { YahooGameContext } from "./gameContext";

type Row = Record<string, any>;

/** RSO Yahoo diet (TJ D2–D8): one server flag, default off. */
export const RSO_YAHOO_DIET_FLAG = "RSO_YAHOO_DIET";
export const rsoYahooDietEnabled = (environment: NodeJS.ProcessEnv = process.env) => environment[RSO_YAHOO_DIET_FLAG] === "1";

/** The identity scope `fhfh_player_external_identities` uses for one Yahoo game and season (start year of the FHFH season). */
export const yahooIdentityContextKey = (context: Pick<YahooGameContext, "gameKey" | "targetSeasonId">) =>
  `yahoo:game:${context.gameKey}:season:${String(context.targetSeasonId).slice(0, 4)}`;

const fullKey = (raw: unknown, gameKey: string) => {
  const value = String(raw ?? "");
  const key = /^\d+$/.test(value) ? `${gameKey}.p.${value}` : value;
  return /^\d+\.p\.\d+$/.test(key) && key.startsWith(`${gameKey}.p.`) ? key : null;
};

/** Yahoo player key → FHFH player id, kept only when unique in both directions. */
export function uniqueVerifiedYahooIdentities(rows: Row[], gameKey: string): Map<string, string> {
  const byKey = new Map<string, Set<string>>(), byPlayer = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = fullKey(row.external_player_id, gameKey), id = String(row.fhfh_player_id ?? "");
    if (!key || !/^[1-9]\d{0,14}$/.test(id)) continue;
    byKey.set(key, new Set([...(byKey.get(key) ?? []), id]));
    byPlayer.set(id, new Set([...(byPlayer.get(id) ?? []), key]));
  }
  return new Map([...byKey].flatMap(([key, ids]) => {
    const [id] = ids;
    return ids.size === 1 && byPlayer.get(id)?.size === 1 ? [[key, id] as const] : [];
  }));
}

/** The legacy `yahoo_nhl_player_map_read` rule (unique Yahoo ↔ NHL, then NHL → catalog player), as a key → player id map. */
export function legacyYahooIdentities(rows: Row[], gameKey: string, players: ReadonlyArray<{ id: string; nhlId: number | null }>): Map<string, string> {
  const byNhl = new Map(players.map(player => [player.nhlId, player.id]));
  const byYahoo = new Map<string, Set<number>>(), reverse = new Map<number, Set<string>>();
  for (const row of rows) {
    const nhl = Number(row.nhl_player_id), key = fullKey(row.yahoo_player_id, gameKey);
    if (!Number.isSafeInteger(nhl) || !key) continue;
    byYahoo.set(key, new Set([...(byYahoo.get(key) ?? []), nhl]));
    reverse.set(nhl, new Set([...(reverse.get(nhl) ?? []), key]));
  }
  return new Map([...byYahoo].flatMap(([key, ids]) => {
    const [nhl] = ids, id = byNhl.get(nhl);
    return ids.size === 1 && reverse.get(nhl)?.size === 1 && id !== undefined ? [[key, id] as const] : [];
  }));
}

/** Offline agreement between two resolvers over the same Yahoo keys (counts only). */
export function compareYahooIdentityMaps(legacy: Map<string, string>, verified: Map<string, string>, keys?: Iterable<string>) {
  const scope = [...new Set(keys ?? [...legacy.keys(), ...verified.keys()])];
  let agree = 0, disagree = 0, legacyOnly = 0, verifiedOnly = 0, neither = 0;
  for (const key of scope) {
    const left = legacy.get(key), right = verified.get(key);
    if (left !== undefined && right !== undefined) left === right ? agree++ : disagree++;
    else if (left !== undefined) legacyOnly++;
    else if (right !== undefined) verifiedOnly++;
    else neither++;
  }
  return { keys: scope.length, agree, disagree, legacyOnly, verifiedOnly, neither };
}

const verifiedScope = (db: SupabaseClient<any>, context: Pick<YahooGameContext, "gameKey" | "targetSeasonId">) =>
  db.from("fhfh_player_external_identities").select("external_player_id,fhfh_player_id").eq("provider", "yahoo")
    .eq("context_key", yahooIdentityContextKey(context)).eq("season_id", context.targetSeasonId).eq("verification_status", "verified");

/** Every verified Yahoo identity for the season, paged. A read error throws; it is never an empty mapping. */
export async function loadVerifiedYahooIdentityMap(db: SupabaseClient<any>, context: Pick<YahooGameContext, "gameKey" | "targetSeasonId">) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await verifiedScope(db, context).order("external_player_id").order("fhfh_player_id").range(offset, offset + 999);
    if (page.error) throw page.error;
    rows.push(...page.data ?? []);
    if ((page.data?.length ?? 0) < 1000) break;
  }
  return uniqueVerifiedYahooIdentities(rows, context.gameKey);
}

/** Bounded two-way read for known Yahoo keys: forward by key, then reverse by every owning player. Null when unverifiable. */
export async function loadVerifiedYahooIdentitiesForKeys(db: SupabaseClient<any>, context: Pick<YahooGameContext, "gameKey" | "targetSeasonId">, keys: string[]) {
  const scoped = [...new Set(keys)].filter(key => fullKey(key, context.gameKey) === key);
  if (!scoped.length) return new Map<string, string>();
  const forward = await verifiedScope(db, context).in("external_player_id", scoped).limit(1001);
  if (forward.error || !forward.data || forward.data.length > 1000) return null;
  const ids = [...new Set(forward.data.map((row: Row) => String(row.fhfh_player_id)))].filter(id => /^[1-9]\d{0,14}$/.test(id));
  const reverse = ids.length ? await verifiedScope(db, context).in("fhfh_player_id", ids.map(Number)).limit(1001) : { data: [], error: null };
  if (reverse.error || !reverse.data || reverse.data.length > 1000) return null;
  return uniqueVerifiedYahooIdentities([...forward.data, ...reverse.data], context.gameKey);
}
