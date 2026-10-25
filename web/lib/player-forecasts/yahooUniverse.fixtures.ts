import { createHash } from "node:crypto";
import { yahooUniverseRequestUrls, type YahooUniverseReceipt } from "./yahooUniverse";

/** Synthetic Yahoo standard-JSON shapes (no account data) for the universe stage tests. */
type Row = Record<string, any>;
export const syntheticScope = Object.freeze({ leagueKey: "477.l.900", teamKey: "477.l.900.t.3", seasonId: 20262027 });
export const syntheticDate = "2026-10-20";
export const syntheticCapturedAt = "2026-10-20T10:30:00.250Z";
export type SyntheticPlayer = { key: string; positionType?: "P" | "G"; status?: string; statusFull?: string; injuryNote?: string; ownership?: string };
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function playerFields(player: SyntheticPlayer) {
  const fields: Row[] = [{ player_key: player.key }, { player_id: player.key.split(".")[2] }, { name: { full: `Synthetic ${player.key}` } }];
  if (player.status !== undefined) fields.push({ status: player.status });
  if (player.statusFull !== undefined) fields.push({ status_full: player.statusFull });
  if (player.injuryNote !== undefined) fields.push({ injury_note: player.injuryNote });
  fields.push({ position_type: player.positionType ?? "P" });
  return fields;
}
const collection = (players: Row[][]) => players.length ? { ...Object.fromEntries(players.map((player, index) => [String(index), { player }])), count: players.length } : [];

export function syntheticRosterBody(players: SyntheticPlayer[], overrides: { teamKey?: string; date?: string; owned?: number } = {}) {
  return JSON.stringify({ fantasy_content: { team: [[{ team_key: overrides.teamKey ?? syntheticScope.teamKey }, { team_id: "3" },
    { is_owned_by_current_login: overrides.owned ?? 1 }], { roster: { coverage_type: "date", date: overrides.date ?? syntheticDate, is_editable: 1,
    0: { players: collection(players.map(player => [playerFields(player), { selected_position: [{ coverage_type: "date" }, { position: "BN" }] }])) } } }] } });
}

export function syntheticPageBody(players: SyntheticPlayer[], leagueKey: string = syntheticScope.leagueKey) {
  return JSON.stringify({ fantasy_content: { league: [{ league_key: leagueKey },
    { players: collection(players.map(player => [playerFields(player), { ownership: { ownership_type: player.ownership ?? "freeagents" } }])) }] } });
}

export function syntheticReceipt(url: string, rawBody: string, capturedAt = syntheticCapturedAt): YahooUniverseReceipt {
  return { url, capturedAt, responseDate: `${capturedAt.slice(0, 19)}.000Z`, bodySha256: sha(rawBody), rawBody };
}

export function syntheticReceipts(owned: SyntheticPlayer[], page0: SyntheticPlayer[], page1: SyntheticPlayer[] = []) {
  const urls = yahooUniverseRequestUrls(syntheticScope, syntheticDate);
  return [syntheticReceipt(urls[0], syntheticRosterBody(owned)), syntheticReceipt(urls[1], syntheticPageBody(page0)), syntheticReceipt(urls[2], syntheticPageBody(page1))];
}

export function syntheticIdentityRow(key: string, canonicalId: number, nhlId: number, overrides: Row = {}) {
  return { requested_external_player_id: key, external_player_id: key, canonical_id: canonicalId, nhl_player_id: nhlId,
    verification_status: "verified", canonical_verification_status: "verified", context_key: "yahoo:game:477:season:2026", season_id: 20262027,
    canonical_position: "C", lifecycle_status: "active_nhl", canonical_name: `Synthetic ${key}`,
    reverse_owner_count: 1, forward_mapping_count: 1, canonical_nhl_owner_count: 1,
    current_roster_memberships: [{ teamId: 10, createdAt: "2026-10-01T12:00:00+00:00" }], ...overrides };
}

export const unmappedIdentityRow = (key: string) => ({ requested_external_player_id: key, external_player_id: null, canonical_id: null, nhl_player_id: null,
  verification_status: null, canonical_verification_status: null, context_key: null, season_id: null, canonical_position: null, lifecycle_status: null,
  canonical_name: null, reverse_owner_count: 0, forward_mapping_count: null, canonical_nhl_owner_count: null, current_roster_memberships: null });
