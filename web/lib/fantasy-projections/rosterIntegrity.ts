export const SEASON_ROSTER_STATUSES = [
  "active_nhl",
  "injured_nhl",
  "affiliate",
  "prospect_reserve",
  "unsigned",
  "unresolved",
] as const;

export type SeasonRosterStatus = (typeof SEASON_ROSTER_STATUSES)[number];

export type SeasonRosterObservationKind =
  | "official_roster"
  | "player_landing"
  | "official_transaction"
  | "trusted_ifttt";

export type SeasonRosterObservation = {
  id: string;
  observationKind: SeasonRosterObservationKind;
  organizationTeamId: number | null;
  rosterStatus: SeasonRosterStatus;
  availableAt: string;
  confidence: number;
  supersedesId?: string | null;
};

export type SeasonRosterConsensus = {
  resolution: "automatic" | "review_required";
  organizationTeamId: number | null;
  rosterStatus: SeasonRosterStatus;
  confidence: number;
  observationIds: string[];
  sourceFreshAt: string | null;
  conflictType: "single_source" | "team_disagreement" | "status_disagreement" | null;
  summary: string | null;
};

function finiteConfidence(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function activeRosterObservations(
  observations: SeasonRosterObservation[],
): SeasonRosterObservation[] {
  const superseded = new Set(
    observations.map((observation) => observation.supersedesId).filter(Boolean),
  );
  return observations
    .filter((observation) => !superseded.has(observation.id))
    .sort((left, right) => Date.parse(right.availableAt) - Date.parse(left.availableAt));
}

function latestByKind(
  observations: SeasonRosterObservation[],
): Map<SeasonRosterObservationKind, SeasonRosterObservation> {
  const latest = new Map<SeasonRosterObservationKind, SeasonRosterObservation>();
  for (const observation of activeRosterObservations(observations)) {
    if (!latest.has(observation.observationKind)) {
      latest.set(observation.observationKind, observation);
    }
  }
  return latest;
}

function latestAvailableAt(observations: SeasonRosterObservation[]): string | null {
  return observations.reduce<string | null>(
    (latest, observation) =>
      !latest || Date.parse(observation.availableAt) > Date.parse(latest)
        ? observation.availableAt
        : latest,
    null,
  );
}

export function resolveSeasonRosterConsensus(args: {
  observations: SeasonRosterObservation[];
  currentOrganizationTeamId: number | null;
  currentRosterStatus?: SeasonRosterStatus;
}): SeasonRosterConsensus {
  const byKind = latestByKind(args.observations);
  const official = [
    byKind.get("official_roster"),
    byKind.get("player_landing"),
    byKind.get("official_transaction"),
  ].filter((value): value is SeasonRosterObservation => Boolean(value));
  const observationIds = activeRosterObservations(args.observations).map(
    (observation) => observation.id,
  );
  const fallback = {
    organizationTeamId: args.currentOrganizationTeamId,
    rosterStatus: args.currentRosterStatus ?? "unresolved",
  } as const;

  if (official.length < 2) {
    return {
      resolution: "review_required",
      ...fallback,
      confidence: official[0] ? finiteConfidence(official[0].confidence) : 0,
      observationIds,
      sourceFreshAt: latestAvailableAt(official),
      conflictType: "single_source",
      summary: "Fewer than two current official sources support a roster change.",
    };
  }

  const distinctTeams = new Set(
    official
      .map((observation) => observation.organizationTeamId)
      .filter((teamId): teamId is number => teamId != null),
  );
  const hasUnsigned = official.some(
    (observation) =>
      observation.organizationTeamId == null && observation.rosterStatus === "unsigned",
  );
  if (distinctTeams.size > 1 || (hasUnsigned && distinctTeams.size > 0)) {
    return {
      resolution: "review_required",
      ...fallback,
      confidence: Math.max(...official.map((observation) => finiteConfidence(observation.confidence))),
      observationIds,
      sourceFreshAt: latestAvailableAt(official),
      conflictType: "team_disagreement",
      summary: "Current official sources disagree on the player's organization.",
    };
  }

  const roster = byKind.get("official_roster");
  const landing = byKind.get("player_landing");
  const transaction = byKind.get("official_transaction");
  const rosterLandingAgreement =
    roster &&
    landing &&
    roster.organizationTeamId != null &&
    roster.organizationTeamId === landing.organizationTeamId;
  const landingTransactionAgreement =
    landing &&
    transaction &&
    landing.organizationTeamId === transaction.organizationTeamId &&
    (landing.organizationTeamId != null ||
      (landing.rosterStatus === "unsigned" && transaction.rosterStatus === "unsigned"));

  if (!rosterLandingAgreement && !landingTransactionAgreement) {
    return {
      resolution: "review_required",
      ...fallback,
      confidence: Math.max(...official.map((observation) => finiteConfidence(observation.confidence))),
      observationIds,
      sourceFreshAt: latestAvailableAt(official),
      conflictType: "single_source",
      summary: "Official evidence exists, but no approved two-source pair agrees.",
    };
  }

  const agreeing = rosterLandingAgreement
    ? [roster, landing]
    : [landing!, transaction!];
  const organizationTeamId = agreeing[0].organizationTeamId;
  const concreteStatuses = new Set(
    agreeing
      .map((observation) => observation.rosterStatus)
      .filter((status) => status !== "unresolved"),
  );
  if (concreteStatuses.size > 1) {
    return {
      resolution: "review_required",
      ...fallback,
      confidence: Math.max(
        ...agreeing.map((observation) => finiteConfidence(observation.confidence)),
      ),
      observationIds: agreeing.map((observation) => observation.id),
      sourceFreshAt: latestAvailableAt(agreeing),
      conflictType: "status_disagreement",
      summary: "Current official sources agree on the organization but disagree on roster status.",
    };
  }
  const rosterStatus =
    concreteStatuses.values().next().value ?? fallback.rosterStatus;

  return {
    resolution: "automatic",
    organizationTeamId,
    rosterStatus,
    confidence: Math.min(...agreeing.map((observation) => finiteConfidence(observation.confidence))),
    observationIds: agreeing.map((observation) => observation.id),
    sourceFreshAt: latestAvailableAt(agreeing),
    conflictType: null,
    summary: null,
  };
}

export function rosterStatusFromPoolStatus(poolStatus: string): SeasonRosterStatus {
  if (poolStatus === "active_prospect") return "prospect_reserve";
  if (poolStatus === "unsigned_relevant") return "unsigned";
  return poolStatus === "verified_active" ? "active_nhl" : "unresolved";
}
