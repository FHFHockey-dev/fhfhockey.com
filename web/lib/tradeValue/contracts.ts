/** Observation-only v1 contracts for trusted adapters. No valuation or roster-impact implementation. */
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
/** Assertions from a trusted adapter; these fields do not authenticate permission or attribution. */
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
