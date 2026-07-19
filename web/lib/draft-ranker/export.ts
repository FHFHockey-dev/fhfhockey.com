export const DRAFT_RANKING_EXPORT_SCHEMA_VERSION = "fhfh-draft-ranking-v1";

export const DRAFT_RANKING_CSV_COLUMNS = [
  "schema_version",
  "exported_at",
  "ranking_id",
  "target_season",
  "scoring_profile",
  "rank",
  "list_state",
  "fhfh_player_id",
  "nhl_player_id",
  "player_name",
  "organization",
  "position",
  "identity_status",
  "yahoo_eligibility",
  "prior_yahoo_adp",
  "adp_state",
  "community_rank",
  "community_confidence",
  "projection_fpts_per_game",
  "tier",
  "notes",
  "watchlisted",
  "updated_at",
] as const;

export type DraftRankingExportPlayer = {
  rank: number | null;
  listState: "top_250" | "candidate" | "watchlist";
  fhfhPlayerId: number;
  nhlPlayerId: number | null;
  playerName: string;
  organization: string | null;
  position: string | null;
  identityStatus: string;
  yahooEligibility: "verified" | "unavailable";
  priorYahooAdp: number | null;
  adpState: "numeric" | "previously_undrafted" | "unavailable";
  communityRank: number | null;
  communityConfidence: string | null;
  projectionFptsPerGame: number | null;
  tier: string | null;
  notes: string | null;
  watchlisted: boolean;
  updatedAt: string;
};

export type DraftRankingExportDocument = {
  schemaVersion: typeof DRAFT_RANKING_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  ranking: {
    id: string;
    name: string;
    status: string;
    version: number;
    targetSeason: number;
    scoringProfile: unknown;
    schemaVersion: number;
    seedRevision: string | null;
    seedProvenance: null | {
      seedRevision: string;
      sourceSeasonId: number;
      sourceCount: number;
      seededCount: number;
      fallbackCount: number;
      completedAt: string | null;
    };
  };
  options: {
    includeCandidates: boolean;
    includeWatchlist: boolean;
    includeEventSummary: boolean;
    privateComparisonEvidenceIncluded: false;
  };
  top250: DraftRankingExportPlayer[];
  candidates: DraftRankingExportPlayer[];
  watchlist: DraftRankingExportPlayer[];
  eventSummary: null | {
    totalEvents: number;
    byType: Record<string, number>;
    latestAt: string | null;
  };
};

function csvValue(value: unknown): string {
  if (value == null) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(
  document: DraftRankingExportDocument,
  player: DraftRankingExportPlayer,
): Record<(typeof DRAFT_RANKING_CSV_COLUMNS)[number], unknown> {
  return {
    schema_version: document.schemaVersion,
    exported_at: document.exportedAt,
    ranking_id: document.ranking.id,
    target_season: document.ranking.targetSeason,
    scoring_profile: document.ranking.scoringProfile,
    rank: player.rank,
    list_state: player.listState,
    fhfh_player_id: player.fhfhPlayerId,
    nhl_player_id: player.nhlPlayerId,
    player_name: player.playerName,
    organization: player.organization,
    position: player.position,
    identity_status: player.identityStatus,
    yahoo_eligibility: player.yahooEligibility,
    prior_yahoo_adp: player.priorYahooAdp,
    adp_state: player.adpState,
    community_rank: player.communityRank,
    community_confidence: player.communityConfidence,
    projection_fpts_per_game: player.projectionFptsPerGame,
    tier: player.tier,
    notes: player.notes,
    watchlisted: player.watchlisted,
    updated_at: player.updatedAt,
  };
}

export function serializeDraftRankingCsv(
  document: DraftRankingExportDocument,
): string {
  const players = [
    ...document.top250,
    ...document.candidates,
    ...document.watchlist,
  ];
  return [
    DRAFT_RANKING_CSV_COLUMNS.join(","),
    ...players.map((player) => {
      const row = csvRow(document, player);
      return DRAFT_RANKING_CSV_COLUMNS.map((column) =>
        csvValue(row[column]),
      ).join(",");
    }),
  ].join("\r\n");
}

export function draftRankingExportFilename(
  targetSeason: number,
  format: "csv" | "json",
): string {
  const start = Math.floor(targetSeason / 10_000);
  const end = String(targetSeason).slice(-4);
  return `fhfh-draft-rankings-${start}-${end}.${format}`;
}
