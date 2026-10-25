export type MetricId = "atoi" | "sog60" | "icf60" | "iscf60" | "ixg60" | "cf60" | "scf60" | "xgf60" | "xgPct" | "ipp" | "shPct" | "oiShPct";
export type MetricCategory = "Opportunity" | "Individual generation" | "On-ice context" | "Finishing & involvement";
export type Strength = "all" | "5v5" | "pp";
export type Period = { mode: "appearances"; count: 5 | 10 | 20 } | { mode: "calendar"; start: string; end: string; timezone: "UTC" };
export type CardSettings = {
  season: number;
  gameType: "regular";
  strength: Strength;
  cutoff: string;
  period: Period;
  seasonPolicy: "season-only-proposed";
  shortSamplePolicy: "allow-known-short-proposed" | "require-full-proposed";
  rankPolicy: "competition-midrank-proposed";
};
export type MetricDefinition = {
  id: MetricId; label: string; help: string; category: MetricCategory; unit: string;
  numerator: string; denominator: string; formula: "atoi" | "per60" | "percentage";
  provider: "NST"; fieldMapping: string; toiUnit: "seconds"; precision: number;
  strength: "selected"; seasonType: "regular"; validity: string;
  universe: "provider-definition-unverified"; entitlement: "allocation-pending";
};
export type Rank = { ordinal: number; population: number; percentile: number; tied: boolean };
export type MetricReading = {
  id: MetricId;
  value: number | null;
  state: "valid" | "undefined" | "missing";
  reason?: string;
  rank: Rank | null;
  rankReason?: string;
};
export type PlayerCardSnapshot = {
  id: string; renderVersion: "player-card-v0"; registryVersion: "proposed-nst-v0";
  source: "synthetic";
  capturedAt: string; settings: CardSettings;
  player: { id: string; name: string; team: string; position: string };
  sample: { gp: number; requested: number; toiSeconds: number; firstDate: string; lastDate: string; gameIds: string[]; warning?: string };
  poolId: string; sourceVersion: string; readings: MetricReading[];
};

// Existing in-season capabilities currently cover RSO only. No card entitlement
// is inferred until allocation and server/export integration receive review.
export const PLAYER_CARD_CAPABILITIES = Object.freeze({
  liveData: false, premiumMetrics: false, comparison: false, comparisonExport: false,
});

