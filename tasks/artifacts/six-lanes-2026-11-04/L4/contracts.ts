/** Offline proposal v1. No collector, scorer, admission override or application import. */
export type Result<T> = { status: "available"; value: T } | { status: "unavailable"; reasons: readonly string[] };
export type Scope = { gameKey: string; seasonId: string };
export type EventScope = Scope & (
  | { source: "yahoo_trade_market"; leagueKey: string | null }
  | { source: "yahoo_league_transactions"; leagueKey: string }
);
export type Asset =
  | { kind: "player"; rawText: string; yahooKey: string | null; identity: Result<{ scope: Scope; fhfhPlayerId: string; nhlPlayerId: number; receipt: string }> }
  | { kind: "pick"; rawText: string; season: string | null; round: number | null; originalOwnerText: string | null; conditionText: string | null }
  | { kind: "unknown"; rawText: string };
export type SourceUse = {
  receipt: string | null;
  display: "public" | "connected_league_only" | "manager_only" | "unapproved";
  attribution: string | null;
  yahooLogoRequired: boolean;
};
export type Observation = {
  version: "trade-observation-v1";
  sightingId: string;
  captureId: string;
  parserVersion: string;
  source: "yahoo_trade_market" | "yahoo_league_transactions";
  scope: Scope;
  sourceUrl: string;
  sourceUse: SourceUse;
  observedAt: string;
  tradedAt: string | null;
  rawDateText: string | null;
  // Null unless the source proves event identity within this explicit scope.
  // A league-scoped ID requires leagueKey even on a public market page.
  event: { scope: EventScope; id: string } | null;
  sample: "observed" | "synthetic";
  // Preserve all sides and every asset in source order, including unresolved assets.
  sides: readonly { label: string; assets: readonly Asset[] }[];
  context: { scoring: string | null; roster: string | null; leagueSize: number | null; keeper: string | null };
};
export type Coverage = {
  version: "trade-coverage-v1";
  // Set only after verifying the source's explicit empty marker.
  state: "not_captured" | "blocked" | "parse_failed" | "verified_empty" | "sightings";
  captureId: string | null;
  scope: Scope;
  requestedPlayers: number;
  receivedPlayers: number;
  identityResolvedPlayers: number;
  universe: string;
  asOf: string;
};
export type Valuation = {
  version: "league-valuation-v1";
  nhlPlayerId: number;
  leagueProfile: { id: string; version: string; origin: "connected" | "manual" | "fhfh_standard" };
  horizon: { teamGames: number; asOf: string };
  // Receipt supplied by existing consumer admission; a producer closure alone is insufficient.
  forecast: Result<{ issuanceId: string; consumerAdmissionReceipt: string; expiresAt: string }>;
  components: { vor: Result<number>; actualPoints: Result<number>; actualRank: Result<number>; projectedPoints: Result<number>; adp: Result<number> };
  // No weights/thresholds inferred from prose. No summing raw components with incompatible units.
  combined: Result<{ value: number; unit: string; methodVersion: string; validationReceipt: string; normalizationVersion: string }>;
};
export type RosterImpact = {
  version: "roster-impact-v1";
  offerId: string;
  leagueProfileVersion: string;
  rosterSnapshotId: string;
  // Entered offers retain picks/unknown assets; do not coerce them to player IDs.
  offer: readonly { side: string; assets: readonly Asset[] }[];
  legality: Result<{ valid: boolean; reasons: readonly string[] }>;
  consequences: Result<{ beforePlayerIds: readonly number[]; afterPlayerIds: readonly number[]; requiredDropIds: readonly number[]; openSlots: number }>;
  productionChange: Result<{ value: number; unit: string; horizon: string; methodVersion: string }>;
  counterpartyAcceptance: { status: "unavailable"; reasons: readonly string[] };
};

/** Only an offline evidence selection; not a source-access or forecast-admission validator. */
export function selectObservationEvidence(rows: readonly Observation[], options: {
  asOf: string; sample: Observation["sample"];
}): Result<{ records: readonly Observation[]; sightings: number; provenEvents: number }> {
  const asOf = Date.parse(options.asOf);
  if (!Number.isFinite(asOf)) return { status: "unavailable", reasons: ["invalid_cutoff"] };
  const events = new Map<string, string>();
  const sightings = new Map<string, Observation>();
  for (const row of rows) {
    // This public proposal cannot establish same-league membership: private evidence stays unavailable.
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
