import { createHash } from "node:crypto";
import { rosterSeasonForDate } from "./playerIdentity";
import type { Player } from "./nhlRosterPreview";

/** Hashes the normalized completed refresh, not unavailable provider response bytes. */
export function currentOrganizationReceipt(input: {
  seasonId: number; observedAt: string; complete: boolean;
  players: Pick<Player, "id" | "teamId" | "teamName" | "teamAbbreviation">[];
}) {
  if (!input.complete || !Number.isFinite(Date.parse(input.observedAt))
    || input.seasonId !== rosterSeasonForDate(input.observedAt)
    || !input.players.length || input.players.length > 2000) {
    throw new Error("Canonical organization sync requires a completed current-season roster refresh.");
  }
  const seen = new Set<number>();
  const players = input.players.map(player => {
    if (!Number.isSafeInteger(player.id) || player.id < 1_000_000 || player.id > 9_999_999
      || !Number.isSafeInteger(player.teamId) || player.teamId <= 0 || seen.has(player.id)
      || typeof player.teamName !== "string" || !player.teamName.trim()
      || !/^[A-Z]{2,3}$/.test(player.teamAbbreviation)) {
      throw new Error("Canonical organization sync requires unique official player/team bindings.");
    }
    seen.add(player.id);
    return { nhlPlayerId: player.id, teamId: player.teamId, organizationName: player.teamName.trim(),
      sourceUrl: `https://api-web.nhle.com/v1/roster/${player.teamAbbreviation}/current` };
  }).sort((a, b) => a.nhlPlayerId - b.nhlPlayerId);
  const receipt = { version: "current-canonical-organization-sync-v1", sourceKind: "official_nhl_current_roster",
    seasonId: input.seasonId, observedAt: input.observedAt, complete: true, players };
  const serialized = JSON.stringify(receipt);
  return { receipt, serialized, receiptHash: createHash("sha256").update(serialized, "utf8").digest("hex") };
}

/** Activation is owned by rollout; the RPC independently validates membership and stale evidence. */
export async function syncCurrentCanonicalOrganizations(db: any, input: Parameters<typeof currentOrganizationReceipt>[0]) {
  const capture = currentOrganizationReceipt(input);
  const { data, error } = await db.rpc("sync_current_canonical_organizations", {
    p_receipt_text: capture.serialized, p_receipt_hash: capture.receiptHash,
  });
  if (error) throw error;
  if (!data || data.receiptHash !== capture.receiptHash || !Array.isArray(data.changedIds) || !Array.isArray(data.skipped)) {
    throw new Error("Canonical organization sync returned an invalid receipt.");
  }
  return data;
}
