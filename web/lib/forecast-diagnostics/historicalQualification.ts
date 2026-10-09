import { z } from "zod";
import { projectionInputHash } from "../projections/inputCapture";
import { acceptedNewsSupersedes } from "../projections/acceptedNews";

const instant = z.string().datetime({ offset: true }).refine(value => !acceptedNewsSupersedes(value, value));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const factSchema = z.object({
  factId: z.string().min(1), revisionId: z.string().min(1), sourceVersion: z.string().min(1),
  payload: z.unknown(), payloadHash: hash, occurredAt: instant, retrievedAt: instant,
  correctionOf: z.string().min(1).nullable(),
  availability: z.discriminatedUnion("basis", [
    z.object({ basis: z.literal("retained_capture"), receivedAt: instant, verifiedAt: instant }).strict(),
    z.object({ basis: z.literal("versioned_source"), publishedAt: instant,
      proof: z.object({ revisionId: z.string().min(1), sourceVersion: z.string().min(1), payloadHash: hash,
        publishedAt: instant, immutable: z.literal(true) }).strict() }).strict(),
    z.object({ basis: z.literal("unproved") }).strict(),
  ]),
}).strict();
export type HistoricalFeatureFact = z.infer<typeof factSchema>;
export type HistoricalFeatureRequirement = {
  featureId: string;
  kind: "team_rate" | "completed_game_inventory" | "schedule" | "goalie_ability" | "starter" | "roster" | "news" | "player_history";
  required: boolean;
  fallbackPolicy: string | null;
  facts: HistoricalFeatureFact[];
};
export type RetainedIssuance = {
  revisionId: string; cutoffAt: string; issuedAt: string; retainedAt: string;
  payload: unknown; payloadHash: string; immutable: boolean;
  proof?: { revisionId: string; payloadHash: string; scopeHash: string; cutoffAt: string; issuedAt: string;
    firstReceivedAt: string; verifiedAt: string; immutable: true };
};
type QualificationScope = { gameId: number; seasonId: number; phase: number; homeTeamId: number; awayTeamId: number };

function qualifyFact(input: HistoricalFeatureFact, cutoffAt: string) {
  const parsed = factSchema.safeParse(input);
  if (!parsed.success) return { factId: input.factId, status: "rejected" as const, reason: "invalid_fact_contract", availableAt: null };
  const fact = parsed.data;
  if (projectionInputHash(fact.payload) !== fact.payloadHash)
    return { factId: fact.factId, status: "rejected" as const, reason: "revision_payload_hash_mismatch", availableAt: null };
  if (fact.availability.basis === "unproved")
    return { factId: fact.factId, status: "unproved" as const, reason: "historical_availability_unproved", availableAt: null };
  let availableAt: string;
  if (fact.availability.basis === "retained_capture") {
    const { receivedAt, verifiedAt } = fact.availability;
    if (acceptedNewsSupersedes(fact.occurredAt, receivedAt)
      || acceptedNewsSupersedes(receivedAt, verifiedAt) || acceptedNewsSupersedes(verifiedAt, fact.retrievedAt))
      return { factId: fact.factId, status: "rejected" as const, reason: "invalid_receipt_order", availableAt: null };
    availableAt = verifiedAt;
  } else {
    const { proof, publishedAt } = fact.availability;
    if (proof.revisionId !== fact.revisionId || proof.sourceVersion !== fact.sourceVersion
      || proof.payloadHash !== fact.payloadHash || acceptedNewsSupersedes(proof.publishedAt, publishedAt)
      || acceptedNewsSupersedes(publishedAt, proof.publishedAt))
      return { factId: fact.factId, status: "rejected" as const, reason: "unbound_source_revision_proof", availableAt: null };
    availableAt = publishedAt;
  }
  if (acceptedNewsSupersedes(availableAt, fact.retrievedAt) || acceptedNewsSupersedes(fact.occurredAt, availableAt))
    return { factId: fact.factId, status: "rejected" as const, reason: "invalid_fact_availability_order", availableAt };
  if (!acceptedNewsSupersedes(cutoffAt, fact.occurredAt) || !acceptedNewsSupersedes(cutoffAt, availableAt))
    return { factId: fact.factId, status: "rejected" as const,
      reason: fact.correctionOf ? "post_cutoff_correction" : "post_cutoff_fact", availableAt };
  return { factId: fact.factId, status: "qualified" as const, reason: null, availableAt };
}

/** Qualification uses only the declared features; later retrieval never becomes an old receipt. */
export function qualifyHistoricalFeatures(input: {
  scope: QualificationScope; cutoffAt: string; startAt: string; features: HistoricalFeatureRequirement[]; issuance?: RetainedIssuance | null;
}) {
  const cutoffAt = instant.parse(input.cutoffAt), startAt = instant.parse(input.startAt);
  if (!acceptedNewsSupersedes(startAt, cutoffAt)) throw new Error("Qualification requires a pregame cutoff.");
  if (!Object.values(input.scope).every(value => Number.isSafeInteger(value) && value > 0)
    || input.scope.homeTeamId === input.scope.awayTeamId) throw new Error("Invalid qualification game scope.");
  if (!input.features.some(feature => feature.required) || new Set(input.features.map(feature => feature.featureId)).size !== input.features.length
    || input.features.some(feature => !feature.featureId || !feature.required && !feature.fallbackPolicy))
    throw new Error("A unique feature manifest and explicit optional fallback policies are required.");
  const features = input.features.map(feature => {
    const facts = feature.facts.map(fact => qualifyFact(fact, cutoffAt));
    const duplicate = new Set(feature.facts.map(fact => fact.factId)).size !== feature.facts.length;
    const qualified = !duplicate && facts.length > 0 && facts.every(fact => fact.status === "qualified");
    return { featureId: feature.featureId, kind: feature.kind, required: feature.required,
      status: qualified ? "qualified" as const : duplicate || facts.some(fact => fact.status === "rejected") ? "rejected" as const : "unproved" as const,
      use: qualified ? "selected" as const : feature.required ? "unavailable" as const : "declared_fallback" as const,
      fallbackPolicy: qualified ? null : feature.fallbackPolicy, facts, inputFacts: feature.facts,
      sourceRevisions: feature.facts.map(fact => ({ revisionId: fact.revisionId, sourceVersion: fact.sourceVersion,
        payloadHash: fact.payloadHash, retrievedAt: fact.retrievedAt, correctionOf: fact.correctionOf })),
      reasons: duplicate ? ["duplicate_constituent_fact"] : facts.length ? facts.flatMap(fact => fact.reason ? [fact.reason] : []) : ["missing_feature_facts"] };
  });
  const issuance = input.issuance;
  const proof = issuance?.proof;
  const originalRetained = !!issuance && issuance.immutable && !!issuance.revisionId
    && !!proof && proof.immutable && proof.revisionId === issuance.revisionId && proof.payloadHash === issuance.payloadHash
    && proof.scopeHash === projectionInputHash({ ...input.scope, cutoffAt, startAt })
    && proof.cutoffAt === issuance.cutoffAt && proof.issuedAt === issuance.issuedAt
    && projectionInputHash(issuance.payload) === issuance.payloadHash
    && [issuance.cutoffAt, issuance.issuedAt, issuance.retainedAt, proof.firstReceivedAt, proof.verifiedAt].every(value => instant.safeParse(value).success)
    && !acceptedNewsSupersedes(issuance.cutoffAt, cutoffAt) && !acceptedNewsSupersedes(cutoffAt, issuance.cutoffAt)
    && !acceptedNewsSupersedes(cutoffAt, issuance.issuedAt) && acceptedNewsSupersedes(startAt, issuance.issuedAt)
    && !acceptedNewsSupersedes(issuance.issuedAt, proof.firstReceivedAt) && acceptedNewsSupersedes(startAt, proof.firstReceivedAt)
    && !acceptedNewsSupersedes(proof.firstReceivedAt, proof.verifiedAt) && !acceptedNewsSupersedes(proof.verifiedAt, issuance.retainedAt);
  const reconstructionEligible = features.filter(feature => feature.required).every(feature => feature.status === "qualified");
  const result = { version: "historical-feature-qualification-v1", scope: input.scope, cutoffAt, startAt, features,
    issuanceStatus: originalRetained ? "retained_original" as const : issuance ? "unproved_issuance" as const : "not_issued" as const,
    issuance: issuance ?? null, reconstructionEligible,
    evidenceClass: originalRetained ? "retained_issued_forecast" as const : reconstructionEligible ? "cutoff_qualified_reconstruction" as const : "diagnostic_only" as const,
    limitations: ["Source revision proofs are supplied evidence contracts; this adapter does not authenticate a provider or invent publication times.",
      "Feature qualification and original issuance are separate. Optional failures keep their declared fallback; predictive promotion is not authorized."] };
  return { ...result, qualificationHash: projectionInputHash(result) };
}

type Qualification = ReturnType<typeof qualifyHistoricalFeatures>;
export type QualificationCohortGame = {
  gameId: number; seasonId: number; phase: number; cutoffAt: string; startAt: string;
  homeTeamId: number; awayTeamId: number;
  qualification: Qualification;
  /** A complete inventory is required for population eligibility, not a selected last-n sample. */
  inventories: { teamId: number; featureId: string; complete: boolean; gameIds: number[] }[];
  forecastStatus: "available" | "missing" | "failed";
};

/** One row per paired game, including failures and unknown early-season eligibility. No outcomes are consumed. */
export function buildHistoricalQualificationCohort(games: QualificationCohortGame[]) {
  if (new Set(games.map(game => game.gameId)).size !== games.length) throw new Error("Duplicate paired game in qualification cohort.");
  const ledger = games.map(game => {
    const { qualificationHash, ...qualificationBody } = game.qualification;
    const qualificationIntegrity = projectionInputHash(qualificationBody) === qualificationHash;
    const counts = [game.homeTeamId, game.awayTeamId].map(teamId => {
      const rows = game.inventories.filter(row => row.teamId === teamId);
      const inventory = rows[0], feature = game.qualification.features.find(row => row.featureId === inventory?.featureId);
      const boundInventory = feature?.inputFacts.some(fact => {
        const payload = fact.payload as { teamId?: unknown; seasonId?: unknown; phase?: unknown; complete?: unknown; gameIds?: unknown; cutoffAt?: unknown } | null;
        return payload?.teamId === teamId && payload.seasonId === game.seasonId && payload.complete === true
          && payload.phase === 2
          && payload.cutoffAt === game.cutoffAt && projectionInputHash(payload.gameIds) === projectionInputHash(inventory?.gameIds);
      });
      return qualificationIntegrity && rows.length === 1 && inventory.complete && boundInventory && feature?.kind === "completed_game_inventory" && feature.status === "qualified"
        && new Set(inventory.gameIds).size === inventory.gameIds.length
        && inventory.gameIds.every(id => Number.isSafeInteger(id) && id !== game.gameId
          && String(id).length === 10 && String(id).slice(4, 6) === "02"
          && Number(String(id).slice(0, 4)) === Math.floor(game.seasonId / 10000))
        ? inventory.gameIds.length : null;
    });
    const scopeValid = game.homeTeamId !== game.awayTeamId
      && !acceptedNewsSupersedes(game.cutoffAt, game.qualification.cutoffAt) && !acceptedNewsSupersedes(game.qualification.cutoffAt, game.cutoffAt)
      && !acceptedNewsSupersedes(game.startAt, game.qualification.startAt) && !acceptedNewsSupersedes(game.qualification.startAt, game.startAt)
      && ["gameId", "seasonId", "phase", "homeTeamId", "awayTeamId"].every(key =>
        game[key as keyof QualificationScope] === game.qualification.scope[key as keyof QualificationScope]);
    const diagnostic = [2026020053, 2026020055].includes(game.gameId);
    const population = diagnostic ? "diagnostic_exclusion" as const : !scopeValid ? "invalid_scope" as const
      : game.phase !== 2 ? "outside_regular_season" as const : counts.some(count => count === null) ? "unknown_eligibility" as const
      : counts.some(count => count === 0) ? "zero_history_coverage" as const
      : counts.some(count => count! >= 1 && count! <= 3) ? "early_season_target" as const : "outside_early_season_target" as const;
    const eligible = population === "early_season_target";
    return { gameId: game.gameId, seasonId: game.seasonId, cutoffAt: game.cutoffAt, population,
      teams: [game.homeTeamId, game.awayTeamId].map((teamId, index) => ({ teamId, completedGames: counts[index],
        primaryTeam: eligible && counts[index]! <= 3 })),
      qualificationHash, qualificationIntegrity, issuanceStatus: game.qualification.issuanceStatus,
      reconstructionEligible: qualificationIntegrity && game.qualification.reconstructionEligible, forecastStatus: game.forecastStatus,
      evaluable: eligible && (game.qualification.issuanceStatus === "retained_original" || game.qualification.reconstructionEligible)
        && game.forecastStatus === "available" };
  });
  return { version: "paired-qualification-cohort-v1", ledger, pairedGames: ledger.length,
    primaryPopulationGames: ledger.filter(row => row.population === "early_season_target").length,
    evaluableGames: ledger.filter(row => row.evaluable).length,
    coverageFailures: ledger.filter(row => row.population === "early_season_target" && !row.evaluable).length,
    unknownEligibilityGames: ledger.filter(row => row.population === "unknown_eligibility").length,
    coldStartGames: ledger.filter(row => row.population === "zero_history_coverage").length };
}
