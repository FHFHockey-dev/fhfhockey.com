import { createHash } from "node:crypto";
import { z } from "zod";
import { availableBefore, provenanceSchema } from "../forecast-diagnostics/pairedInputs";
import { projectionInputHash } from "./inputCapture";
import type { ResearchGoalAppearance } from "./researchGoalBaseline";

const id = z.number().int().positive(), instant = z.string().datetime({ offset: true });
const revisionId = z.string().regex(/^[A-Za-z0-9-]{1,128}$/), hash = z.string().regex(/^[a-f0-9]{64}$/);
const role = z.enum(["skater", "goalie"]);
export const researchGoalAppearanceManifestSchema = z.object({
  version: z.literal("research-player-season-appearance-manifest-v1"), researchCodeCommit: z.string().regex(/^[a-f0-9]{40}$/),
  cohortResultHash: hash, seasonId: id, phase: z.literal(2), featureCutoffAt: instant, collectedAt: instant,
  historyTargetAt: instant.optional(),
  sourceBasis: z.literal("official_nhl_all_club_player_season_game_log_and_per_game_index"),
  cohortPlayerIds: z.array(id).min(1).max(100),
  players: z.array(z.object({ playerId: id, role, gameLogRevisionId: revisionId,
    indexRevisionIds: z.array(revisionId).min(1).max(2) }).strict()).min(1).max(100),
  acquisitionScope: z.object({ concurrency: z.literal(2), pageLimit: z.literal(100), maximumIndexPagesPerPlayer: z.literal(2),
    boxscoreRequests: z.literal(0), pbpRequests: z.literal(0), credentialsSent: z.literal(false), hostedWrites: z.literal(false) }).strict(),
}).strict();
const sourceSchema = z.object({
  kind: z.enum(["official_player_game_log", "official_player_game_index"]), nhlPlayerId: id, role,
  seasonId: id, gameTypeId: z.literal(2), pageStart: z.number().int().min(0).max(100), pageLimit: z.literal(100).nullable(),
  url: z.string().url(), requestedAt: instant, httpStatus: z.number().int().nullable(), revisionId,
  bodyUtf8: z.string().max(8 * 1024 * 1024), rawBytesHash: hash, payload: z.unknown(), failure: z.string().nullable(),
  provenance: provenanceSchema,
}).strict();
type Observation = { playerId: number; position: string; gameDate: string; teamAbbrev: string; opponentAbbrev: string;
  appearance: ResearchGoalAppearance };
const ids = (rows: { gameId: number }[]) => rows.map(row => row.gameId).sort((a, b) => a - b);
const sameIds = (a: readonly number[], b: readonly number[]) => projectionInputHash([...a].sort((x, y) => x - y))
  === projectionInputHash([...b].sort((x, y) => x - y));
const validId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const historicalIdentitySchema = z.object({
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
  }),
  teamAbbrev: z.string().regex(/^[A-Z]{2,4}$/), opponentAbbrev: z.string().regex(/^[A-Z]{2,4}$/),
});
function toi(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number); return minutes * 60 + seconds;
}

/** Reconcile actual all-club provider records with verified BOX/PBP observations.
 * A supplied completeness flag or aggregate GP count cannot substitute for this join.
 */
export function reconcileResearchGoalAppearanceManifest(input: {
  manifest: unknown; revisions: unknown[]; cohortResultHash: string; seasonId: number; featureCutoffAt: string;
  expectedPlayerIds: number[]; observations: Observation[];
}) {
  const manifest = researchGoalAppearanceManifestSchema.parse(input.manifest), sources = input.revisions.map(source => sourceSchema.parse(source));
  const entries = manifest.players, refs = entries.flatMap(player => [player.gameLogRevisionId, ...player.indexRevisionIds]);
  if (manifest.seasonId !== input.seasonId || Date.parse(manifest.featureCutoffAt) !== Date.parse(input.featureCutoffAt)
    || manifest.cohortResultHash !== input.cohortResultHash
    || new Set(manifest.cohortPlayerIds).size !== manifest.cohortPlayerIds.length
    || !sameIds(manifest.cohortPlayerIds, input.expectedPlayerIds) || !sameIds(entries.map(player => player.playerId), input.expectedPlayerIds)
    || new Set(refs).size !== refs.length
    || sources.length !== refs.length || new Set(sources.map(source => source.revisionId)).size !== sources.length
    || sources.some(source => !refs.includes(source.revisionId))) throw new Error("Appearance manifest cohort, scope, or revision population mismatch");
  const additionalGameIds = new Set<number>();
  const historyTargetAt = manifest.historyTargetAt ?? input.featureCutoffAt;
  const players = entries.map(entry => {
    const reasons = new Set<string>();
    const retained = input.observations.filter(row => row.playerId === entry.playerId);
    if (new Set(retained.map(row => row.appearance.gameId)).size !== retained.length) throw new Error("Duplicate retained player/game observation");
    const selected = [entry.gameLogRevisionId, ...entry.indexRevisionIds].map(ref => sources.find(source => source.revisionId === ref)!);
    // This cap prevents extending the requested target. A client timestamp is
    // not evidence that the provider included every appearance before it.
    const requestTimeCapAt = new Date(Math.min(...selected.map(source => Date.parse(source.requestedAt)))).toISOString();
    if (Date.parse(historyTargetAt) > Date.parse(requestTimeCapAt)) reasons.add("history_target_exceeds_retained_request_cap");
    if (Date.parse(historyTargetAt) > Date.parse(input.featureCutoffAt)) reasons.add("history_target_after_feature_cutoff");
    if (retained.some(row => !historicalIdentitySchema.safeParse(row).success)) reasons.add("appearance_historical_identity_missing_or_invalid");
    for (const [index, source] of selected.entries()) {
      const expectedKind = index === 0 ? "official_player_game_log" : "official_player_game_index";
      const url = new URL(source.url);
      let urlValid = source.url === `https://api-web.nhle.com/v1/player/${entry.playerId}/game-log/${input.seasonId}/2`;
      if (expectedKind === "official_player_game_index") {
        const params = url.searchParams;
        urlValid = url.origin === "https://api.nhle.com" && url.pathname === `/stats/rest/en/${entry.role}/summary` && !url.hash
          && [...params.keys()].length === 6 && params.get("isAggregate") === "false" && params.get("isGame") === "true"
          && params.get("start") === String(source.pageStart) && params.get("limit") === "100"
          && params.get("cayenneExp") === `seasonId=${input.seasonId} and gameTypeId=2 and playerId=${entry.playerId}`;
        try { urlValid &&= projectionInputHash(JSON.parse(params.get("sort")!)) === projectionInputHash([{ property: "gameId", direction: "ASC" }]); }
        catch { urlValid = false; }
      }
      if (!urlValid || source.kind !== expectedKind || source.nhlPlayerId !== entry.playerId || source.role !== entry.role
        || source.seasonId !== input.seasonId || source.revisionId !== source.provenance.revisionId || source.url !== source.provenance.source
        || createHash("sha256").update(source.bodyUtf8).digest("hex") !== source.rawBytesHash
        || projectionInputHash(source.payload) !== source.provenance.payloadHash
        || Date.parse(source.requestedAt) > Date.parse(source.provenance.firstReceivedAt)
        || Date.parse(source.provenance.verifiedAt) > Date.parse(manifest.collectedAt)) throw new Error("Unverified appearance source identity, bytes, query, or receipt time");
      if (source.failure !== null || source.httpStatus !== 200) reasons.add("appearance_source_request_failed");
      else {
        let parsed: unknown;
        try { parsed = JSON.parse(source.bodyUtf8); } catch { throw new Error("Invalid successful appearance source JSON"); }
        if (projectionInputHash(parsed) !== projectionInputHash(source.payload)) throw new Error("Appearance source raw/payload mismatch");
      }
      if (!availableBefore(source.provenance, input.featureCutoffAt) || Date.parse(manifest.collectedAt) >= Date.parse(input.featureCutoffAt))
        reasons.add("appearance_evidence_unavailable_at_feature_cutoff");
    }
    const logPayload: any = selected[0].payload;
    const log: any[] | null = Array.isArray(logPayload?.gameLog) ? logPayload.gameLog : null;
    if (!log || logPayload?.seasonId !== input.seasonId || logPayload?.gameTypeId !== 2
      || selected[0].pageStart !== 0 || selected[0].pageLimit !== null) reasons.add("unverified_player_season_game_log_shape");
    const pages = selected.slice(1), first: any = pages[0].payload;
    let indexRows: any[] | null = [];
    if (!count(first?.total) || first.total > 200 || pages.length !== Math.max(1, Math.ceil(first.total / 100))) {
      reasons.add("incomplete_per_game_index_pagination"); indexRows = null;
    }
    pages.forEach((page, pageNumber) => {
      const payload: any = page.payload;
      if (!Array.isArray(payload?.data) || payload.total !== first?.total || page.pageStart !== pageNumber * 100 || page.pageLimit !== 100
        || payload.data.length !== Math.min(100, Math.max(0, first?.total - page.pageStart))) {
        reasons.add("incomplete_per_game_index_pagination"); indexRows = null;
      } else if (indexRows !== null) indexRows.push(...payload.data);
    });
    const records = [...(log ?? []), ...(indexRows ?? [])];
    for (const record of records) if (validId(record?.gameId) && !retained.some(row => row.appearance.gameId === record.gameId))
      additionalGameIds.add(record.gameId);
    if (records.some(row => !row || !validId(row.gameId))) reasons.add("invalid_appearance_game_identity");
    else if (log && indexRows) {
      if (new Set(log.map(row => row.gameId)).size !== log.length || new Set(indexRows.map(row => row.gameId)).size !== indexRows.length
        || indexRows.some((row, index) => index > 0 && row.gameId <= indexRows![index - 1].gameId)) reasons.add("duplicate_or_unordered_appearance_game_identity");
      if (!sameIds(ids(log), ids(indexRows))) reasons.add("player_game_log_and_index_populations_differ");
      if (retained.some(row => row.appearance.toiSeconds !== null && row.appearance.toiSeconds > 0 && !log.some(record => record.gameId === row.appearance.gameId)))
        reasons.add("known_positive_appearance_missing_from_provider_history");
      for (const record of log) {
        const index = indexRows.find(row => row.gameId === record.gameId), observed = retained.find(row => row.appearance.gameId === record.gameId);
        if (!observed) { additionalGameIds.add(record.gameId); reasons.add("appearance_game_without_retained_boxscore_pbp_evidence"); continue; }
        const official = observed.appearance, indexToi = entry.role === "goalie" ? index?.timeOnIce : index?.timeOnIcePerGame;
        if (!historicalIdentitySchema.safeParse(record).success || !historicalIdentitySchema.safeParse({
          gameDate: index?.gameDate, teamAbbrev: index?.teamAbbrev, opponentAbbrev: index?.opponentTeamAbbrev,
        }).success) reasons.add("appearance_historical_identity_missing_or_invalid");
        if (!index || index.playerId !== entry.playerId || index.gamesPlayed !== 1 || (observed.position === "G") !== (entry.role === "goalie")
          || record.gameDate !== observed.gameDate || index.gameDate !== observed.gameDate
          || record.teamAbbrev !== observed.teamAbbrev || index.teamAbbrev !== observed.teamAbbrev
          || record.opponentAbbrev !== observed.opponentAbbrev || index.opponentTeamAbbrev !== observed.opponentAbbrev)
          reasons.add("appearance_game_credit_or_historical_team_identity_mismatch");
        if (toi(record.toi) === null || toi(record.toi) !== official.toiSeconds || !Number.isFinite(indexToi) || indexToi !== official.toiSeconds)
          reasons.add("appearance_toi_sources_differ_or_unproved");
        if (!count(record.goals) || !count(index?.goals) || record.goals !== official.officialGoals || index?.goals !== official.officialGoals)
          reasons.add("appearance_goal_credit_sources_differ_or_unproved");
        if (official.gaps.length || official.toiSeconds === null || official.officialGoals === null || official.goalsByCell === null)
          reasons.add("retained_appearance_accounting_unproved");
        if (Date.parse(official.availableAt) >= Date.parse(input.featureCutoffAt) || Date.parse(official.startedAt) >= Date.parse(input.featureCutoffAt))
          reasons.add("retained_appearance_unavailable_at_research_cutoff");
        if (Date.parse(official.availableAt) >= Date.parse(historyTargetAt) || Date.parse(official.startedAt) >= Date.parse(historyTargetAt))
          reasons.add("retained_final_unproved_at_history_target");
      }
    }
    const availableAt = new Date(Math.max(...selected.map(source => Math.max(Date.parse(source.provenance.firstReceivedAt), Date.parse(source.provenance.verifiedAt),
      source.provenance.publishedAt === null ? -Infinity : Date.parse(source.provenance.publishedAt))), Date.parse(manifest.collectedAt))).toISOString();
    const cohortReconciled = reasons.size === 0;
    const providerIds = log && log.every(row => validId(row?.gameId)) ? ids(log) : null;
    return { playerId: entry.playerId, role: entry.role, status: cohortReconciled ? "cohort_reconciled" as const : "unproved" as const,
      reasons: [...reasons].sort(), providerGameIds: providerIds, sourceRevisionIds: selected.map(source => source.revisionId), availableAt,
      requestTimeCapAt, historyCoverageThroughAt: null, providerSeasonCoverageStatus: "unproved" as const,
      retainedProviderCohortGameIds: cohortReconciled ? retained.filter(row => row.appearance.toiSeconds! > 0).map(row => row.appearance.gameId).sort((a, b) => a - b) : null,
      provedSeasonAppearanceGameIds: null,
      appearances: retained.map(row => ({ ...row.appearance, availableAt: new Date(Math.max(Date.parse(row.appearance.availableAt), Date.parse(availableAt))).toISOString() })) };
  }).sort((a, b) => a.playerId - b.playerId);
  return { version: manifest.version, manifestHash: projectionInputHash(manifest), cohortResultHash: manifest.cohortResultHash,
    researchCodeCommit: manifest.researchCodeCommit, featureCutoffAt: input.featureCutoffAt,
    historyTargetAt, historyTargetBasis: manifest.historyTargetAt ? "requested_retained_cohort_target" as const : "feature_cutoff" as const,
    requestTimeCapAt: new Date(Math.min(...players.map(player => Date.parse(player.requestTimeCapAt)))).toISOString(),
    historyCoverageThroughAt: null, providerSeasonCoverageStatus: "unproved" as const,
    populationScope: "fixed_retained_provider_game_id_cohort" as const,
    additionalGameIds: [...additionalGameIds].sort((a, b) => a - b), players };
}
