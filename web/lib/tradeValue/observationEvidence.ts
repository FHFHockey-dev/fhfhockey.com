import type { Observation, Result } from "./contracts";

/**
 * Select public observation evidence supplied by a trusted adapter.
 * Not a parser for untrusted JSON, permission/identity verifier or source-event admission boundary.
 * Receipt strings, source-use flags and event scopes are assertions; adapters must verify them first.
 * No collection, scalar market valuation, roster benefit or acceptance inference occurs here.
 */
export function selectObservationEvidence(rows: readonly Observation[], options: {
  asOf: string; sample: Observation["sample"];
}): Result<{ records: readonly Observation[]; sightings: number; provenEvents: number }> {
  const asOf = Date.parse(options.asOf);
  if (!Number.isFinite(asOf)) return { status: "unavailable", reasons: ["invalid_cutoff"] };
  const events = new Map<string, string>();
  const sightings = new Map<string, Observation>();
  for (const row of rows) {
    // This public selector cannot establish same-league membership: private evidence stays unavailable.
    if (row.sourceUse.display !== "public" || row.source !== "yahoo_trade_market" || !row.sourceUse.receipt?.trim() || !row.sourceUse.attribution?.trim() || !row.sourceUse.yahooLogoRequired)
      return { status: "unavailable", reasons: ["source_use_unavailable"] };
    if (!/^https:\/\/hockey\.fantasysports\.yahoo\.com\//.test(row.sourceUrl) || row.sample !== options.sample)
      return { status: "unavailable", reasons: ["source_or_sample_mismatch"] };
    const observed = Date.parse(row.observedAt), traded = row.tradedAt === null ? null : Date.parse(row.tradedAt);
    if (!Number.isFinite(observed) || observed > asOf || traded !== null && (!Number.isFinite(traded) || traded > observed))
      return { status: "unavailable", reasons: ["invalid_evidence_time"] };
    if (!row.scope.gameKey.trim() || !row.scope.seasonId.trim() || !row.sightingId.trim() || !row.captureId.trim() || !row.parserVersion.trim() || row.sides.length < 2 || row.sides.some(side => !side.assets.length))
      return { status: "unavailable", reasons: ["incomplete_sides_or_lineage"] };
    // Conservative exact-content comparison. No bundle-based clustering or player-price inference.
    const content = JSON.stringify([row.sides, row.context, row.tradedAt]);
    const previous = sightings.get(row.sightingId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) return { status: "unavailable", reasons: ["conflicting_sighting"] };
    if (row.event) {
      const scope = row.event.scope;
      if (!row.event.id.trim() || scope.source !== row.source || scope.gameKey !== row.scope.gameKey || scope.seasonId !== row.scope.seasonId
        || scope.leagueKey !== null && !scope.leagueKey.trim())
        return { status: "unavailable", reasons: ["invalid_event_identity"] };
      const key = JSON.stringify([scope.source, scope.gameKey, scope.seasonId, scope.leagueKey, row.event.id]);
      if (events.has(key) && events.get(key) !== content) return { status: "unavailable", reasons: ["conflicting_event"] };
      events.set(key, content);
    }
    sightings.set(row.sightingId, row);
  }
  if (!sightings.size) return { status: "unavailable", reasons: ["no_sightings_not_verified_empty"] };
  return { status: "available", value: { records: [...sightings.values()], sightings: sightings.size, provenEvents: events.size } };
}
