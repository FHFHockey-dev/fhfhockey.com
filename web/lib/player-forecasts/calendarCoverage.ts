import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlanningData } from "../rosterScheduleData/planning";
import { assignmentStats, forecastAllows, sanitizeForecastInputs } from "../rosterScheduleOptimizer/planning";
import type { ContributionPlanningSnapshot, ForecastExclusionReason, PlanningData } from "../rosterScheduleOptimizer/planningTypes";
import { resolvePlanningContributions } from "./planningContributions";
import type { PlayerForecastCalendarScope } from "./schedule";
import type { CalendarForgeScopeReceipts } from "./orchestration";

export type CalendarCoverageProfile = { skaterTargets: string[]; goalieTargets: string[] };

/** An explicit statistical target profile, not invented league scoring/eligibility. */
export function parseCalendarCoverageProfile(query: Record<string, unknown>): CalendarCoverageProfile | undefined {
  if (query.skaterTargets === undefined && query.goalieTargets === undefined) return undefined;
  const targets = (value: unknown, goalie: boolean) => {
    if (value === undefined || value === "") return [];
    if (typeof value !== "string") throw new Error("Invalid coverage targets");
    const keys = value.split(",");
    if (keys.length > 20 || keys.some(key => !/^[A-Z][A-Z0-9_]{0,63}$/.test(key)
      || (key.endsWith("_GOALIE") || key === "GOALIE_MINUTES") !== goalie)) throw new Error("Invalid coverage targets");
    return [...new Set(keys)].sort();
  };
  const profile = { skaterTargets: targets(query.skaterTargets, false), goalieTargets: targets(query.goalieTargets, true) };
  if (!profile.skaterTargets.length && !profile.goalieTargets.length) throw new Error("Coverage targets are required");
  return profile;
}

/** Count every catalog competitor in the declared population, including unforecasted players. */
export function summarizeCalendarConsumerCoverage(data: PlanningData, scopes: PlayerForecastCalendarScope[],
  profile: CalendarCoverageProfile, context: ContributionPlanningSnapshot["context"], receipts?: CalendarForgeScopeReceipts) {
  profile = parseCalendarCoverageProfile({ skaterTargets: profile.skaterTargets.join(","),
    goalieTargets: profile.goalieTargets.join(",") })!;
  if (new Set(data.players.map(player => player.id)).size !== data.players.length) throw new Error("Consumer catalog has duplicate players");
  const snapshot = resolvePlanningContributions(sanitizeForecastInputs({ ...data, context }));
  const gameByKey = new Map(data.games.map(game => [`${game.id}:${game.teamAbbreviation}`, game]));
  const seen = new Set<string>(), forecastByKey = new Map(snapshot.forecasts.map(row => [`${row.playerId}:${row.gameId}`, row]));
  const exclusions: Record<string, number> = {};
  const discoveryByGame = new Map<string, NonNullable<ContributionPlanningSnapshot["forecastInputExclusions"]>>();
  for (const row of [...(snapshot.forecastManifest?.exclusions ?? []), ...(snapshot.forecastInputExclusions ?? [])]) {
    discoveryByGame.set(row.gameId, [...(discoveryByGame.get(row.gameId) ?? []), row]);
  }
  for (const gameId of new Set(scopes.map(scope => scope.gameId))) {
    const sides = scopes.filter(scope => scope.gameId === gameId);
    if (sides.length !== 2 || new Set(sides.map(scope => scope.teamId)).size !== 2
      || sides.some(scope => scope.teamId === scope.opponentTeamId
        || scope.opponentTeamId !== sides.find(side => side.teamId !== scope.teamId)?.teamId)) {
      throw new Error("Consumer calendar requires both team-game sides");
    }
  }
  const targetIdentity = (gameId: number, teamId: number, seasonId: number, playerId: number,
    nhlPlayerId: number | null, population: string, target: string) =>
    JSON.stringify([gameId, teamId, seasonId, playerId, nhlPlayerId, population, target]);
  const inspectedGames = new Set(receipts?.gameIds ?? []), queueByGame = new Map(receipts?.queue.map(row => [row.gameId, row.status]));
  const historicallyIssued = new Set<string>(), unverifiedGames = new Set<number>();
  let unverifiedIssuedRevisions = 0;
  if (receipts) {
    const scopedGames = new Set(scopes.map(scope => scope.gameId));
    if (inspectedGames.size !== receipts.gameIds.length || receipts.gameIds.some(id => !scopedGames.has(id))
      || queueByGame.size !== receipts.queue.length
      || new Set(receipts.revisions.map(row => row.revisionId)).size !== receipts.revisions.length
      || [...receipts.queue, ...receipts.revisions].some(row => !inspectedGames.has(row.gameId))) {
      throw new Error("Consumer storage receipt scope conflicts with calendar");
    }
    for (const revision of receipts.revisions) {
      const manifest = revision.targetManifest;
      if (!manifest || !Number.isFinite(Date.parse(revision.publishedAt ?? ""))
        || Date.parse(revision.publishedAt!) > Date.parse(context.asOf)) {
        unverifiedGames.add(revision.gameId); unverifiedIssuedRevisions++; continue;
      }
      if (manifest.unmappedOutputs) { unverifiedGames.add(revision.gameId); unverifiedIssuedRevisions++; }
      for (const row of manifest.opportunities) for (const target of row.targetKeys) {
        historicallyIssued.add(targetIdentity(row.gameId, row.teamId, row.seasonId, row.playerId, row.nhlPlayerId, row.population, target));
      }
    }
  }
  const storageCounts = { inspectedPlayerGameTargets: 0, queueReceiptPlayerGameTargets: 0, pendingQueuePlayerGameTargets: 0,
    historicallyIssuedPlayerGameTargets: 0, unverifiedIssuedPlayerGameTargets: 0, missingIssuedPlayerGameTargets: 0,
    uninspectedPlayerGameTargets: 0, queueStatusPlayerGameTargets: {} as Record<string, number> };
  const consumerRevisionMismatches = receipts ? new Set(data.forecasts.filter(row => inspectedGames.has(Number(row.gameId))
    && row.sourceKind === "detailed" && !receipts.revisions.some(revision => revision.revisionId === row.revisionId))
    .map(row => row.revisionId)).size : 0;
  let requiredPlayerGameTargets = 0, assignmentEligiblePlayerGameTargets = 0, conditionalOnlyTieBreakCandidatePlayerGameTargets = 0,
    totalsEligiblePlayerGameTargets = 0, comparisonEligiblePlayerGameTargets = 0, eligiblePlayerGameTargets = 0;
  for (const scope of scopes) {
    const identity = `${scope.gameId}:${scope.teamId}`;
    const game = gameByKey.get(`${scope.gameId}:${scope.teamAbbreviation}`);
    if (seen.has(identity) || scope.seasonId !== context.seasonId || !scope.scheduleRevision || !scope.teamAbbreviation
      || !game || game.status !== "scheduled" || game.scheduleRevision !== scope.scheduleRevision
      || Date.parse(game.startsAt ?? "") !== Date.parse(scope.scheduledStartAt)) {
      throw new Error("Consumer schedule changed or is incomplete");
    }
    seen.add(identity);
    const starterProbabilities = data.players.filter(player => player.playerClass === "goalie" && player.nhlTeamId === scope.teamId)
      .flatMap(player => {
        const forecast = forecastByKey.get(`${player.id}:${scope.gameId}`);
        const probability = forecast?.confirmedStart ? 1 : forecast?.startProbability;
        return probability == null ? [] : [probability];
      });
    const invalidCompetition = starterProbabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1)
      || starterProbabilities.reduce((sum, value) => sum + value, 0) > 1.000001;
    for (const player of data.players.filter(player => player.nhlTeamId === scope.teamId)) {
      if (player.teamAbbreviation !== scope.teamAbbreviation) throw new Error("Consumer team identity conflicts with schedule");
      const forecast = forecastByKey.get(`${player.id}:${scope.gameId}`) ?? null;
      for (const target of player.playerClass === "goalie" ? profile.goalieTargets : profile.skaterTargets) {
        requiredPlayerGameTargets++;
        if (requiredPlayerGameTargets > 200000) throw new Error("Consumer target scope exceeded its bound");
        if (receipts) {
          if (!inspectedGames.has(scope.gameId)) storageCounts.uninspectedPlayerGameTargets++;
          else {
            storageCounts.inspectedPlayerGameTargets++;
            const queueStatus = queueByGame.get(scope.gameId);
            if (queueStatus) {
              storageCounts.queueReceiptPlayerGameTargets++;
              storageCounts.queueStatusPlayerGameTargets[queueStatus] = (storageCounts.queueStatusPlayerGameTargets[queueStatus] ?? 0) + 1;
              if (["pending", "running"].includes(queueStatus)) storageCounts.pendingQueuePlayerGameTargets++;
            }
            if (historicallyIssued.has(targetIdentity(scope.gameId, scope.teamId, scope.seasonId, Number(player.id),
              player.nhlId, player.playerClass, target))) storageCounts.historicallyIssuedPlayerGameTargets++;
            else if (unverifiedGames.has(scope.gameId)) storageCounts.unverifiedIssuedPlayerGameTargets++;
            else storageCounts.missingIssuedPlayerGameTargets++;
          }
        }
        const finite = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value);
        const competitionValid = player.playerClass !== "goalie" || !invalidCompetition;
        const assignment = competitionValid && !!forecast && forecast.conditioning === "unconditional"
          && forecastAllows(forecast, target, "assignment") && finite(assignmentStats(forecast)[target]);
        const totals = competitionValid && !!forecast && forecast.conditioning === "unconditional"
          && forecastAllows(forecast, target, "totals") && finite(forecast.stats[target]);
        const comparison = totals && forecastAllows(forecast, target, "comparison");
        const conditional = competitionValid && !assignment && !totals && !!forecast
          && forecastAllows(forecast, target, "conditionalTieBreak")
          && finite(forecast.contributions?.[target]?.conditionalMean ?? forecast.tieBreakStats?.[target]);
        if (conditional) conditionalOnlyTieBreakCandidatePlayerGameTargets++;
        if (assignment) assignmentEligiblePlayerGameTargets++;
        if (totals) totalsEligiblePlayerGameTargets++;
        if (comparison) comparisonEligiblePlayerGameTargets++;
        if (assignment && totals && comparison) { eligiblePlayerGameTargets++; continue; }
        const reasons = new Set<ForecastExclusionReason>(forecast?.contributions?.[target]?.exclusionReasons ?? []);
        if (!competitionValid) reasons.add("unsupported_conditioning");
        for (const row of discoveryByGame.get(String(scope.gameId)) ?? []) {
          if (row.gameId === String(scope.gameId) && (!row.playerId || row.playerId === player.id)
            && (!row.targetKey || row.targetKey === target)) row.reasons.forEach(reason => reasons.add(reason));
        }
        if (forecast && !finite(forecast.stats[target]) && !finite(assignmentStats(forecast)[target])) reasons.add("missing_target");
        if (!reasons.size) reasons.add(forecast ? "use_not_approved" : "no_issued_revision");
        reasons.forEach(reason => { exclusions[reason] = (exclusions[reason] ?? 0) + 1; });
      }
    }
  }
  const requiredClass = (goalie: boolean) => (goalie ? profile.goalieTargets : profile.skaterTargets).length > 0;
  const unmappedPlayers = data.players.filter(player => requiredClass(player.playerClass === "goalie")
    && (!player.nhlId || !player.nhlTeamId || !player.teamAbbreviation || !player.rosterRevision)).length;
  const teamsWithoutTargetPopulation = [...new Set(scopes.map(scope => scope.teamId))].flatMap(teamId =>
    (["skater", "goalie"] as const).flatMap(population => requiredClass(population === "goalie")
      && !data.players.some(player => player.nhlTeamId === teamId && player.playerClass === population)
      ? [{ teamId, population }] : []));
  const incompleteInputs = ["schedule", "identities"].filter(key => data.evidence[key]?.completeness !== "complete");
  return { status: "evaluated" as const, basis: "sanitized_consumer_targets" as const, profile,
    population: "Verified canonical identities selected by NHL lifecycle tag and stored current-season membership; all scoped catalog competitors",
    requiredPlayerGameTargets, assignmentEligiblePlayerGameTargets, totalsEligiblePlayerGameTargets,
    comparisonEligiblePlayerGameTargets, conditionalOnlyTieBreakCandidatePlayerGameTargets, eligiblePlayerGameTargets, exclusions, unmappedPlayers,
    storageCoverage: receipts ? { status: "evaluated" as const, basis: "immutable_issued_target_receipts" as const,
      ...storageCounts, unverifiedIssuedRevisions, consumerRevisionMismatches, snapshotCoherence: "independent_reads_not_atomic" as const }
      : { status: "not_evaluated" as const, reason: "Storage scope receipts were not supplied." },
    inputStatus: incompleteInputs.length || unmappedPlayers || teamsWithoutTargetPopulation.length || consumerRevisionMismatches ? "partial" as const : "complete" as const,
    incompleteInputs, teamsWithoutTargetPopulation, manifestId: data.forecastManifest?.id ?? null,
    calendarPolicy: data.forecastManifest?.calendarPolicy ?? null, asOf: context.asOf,
    recommendationReadiness: "not_evaluated" as const,
    limitations: ["Statistical use permissions are separate from verified league eligibility, locks and scoring.",
      "This denominator follows stored catalog records; it does not independently verify current NHL roster completeness.",
      "Queue receipts describe game work, not producer support for every linked target. Historical issuance does not establish current eligibility.",
      "Conditional tie-breaking counts describe candidates, not comparable cohorts or league recommendations.",
      "Unknown team mappings prevent full-population coverage; no missing ability is treated as zero."] };
}

/** Public reader gates/canaries remain authoritative; no research reads or generation. */
export async function inspectCalendarConsumerCoverage(db: SupabaseClient<any>, scopes: PlayerForecastCalendarScope[],
  profile: CalendarCoverageProfile, now: Date, calendarDays: number, receipts?: CalendarForgeScopeReceipts) {
  if (!scopes.length) {
    if (receipts && (receipts.gameIds.length || receipts.queue.length || receipts.revisions.length)) {
      throw new Error("Consumer storage receipt scope conflicts with empty calendar");
    }
    return { status: "empty_scope" as const, profile, requiredPlayerGameTargets: 0,
      assignmentEligiblePlayerGameTargets: 0, totalsEligiblePlayerGameTargets: 0, comparisonEligiblePlayerGameTargets: 0,
      conditionalOnlyTieBreakCandidatePlayerGameTargets: 0, eligiblePlayerGameTargets: 0,
      storageCoverage: { status: "empty_scope" as const, inspectedPlayerGameTargets: 0, queueReceiptPlayerGameTargets: 0,
        pendingQueuePlayerGameTargets: 0, historicallyIssuedPlayerGameTargets: 0, unverifiedIssuedPlayerGameTargets: 0,
        missingIssuedPlayerGameTargets: 0, uninspectedPlayerGameTargets: 0, queueStatusPlayerGameTargets: {} },
      recommendationReadiness: "not_evaluated" as const };
  }
  const seasons = [...new Set(scopes.map(scope => scope.seasonId))];
  if (seasons.length !== 1) throw new Error("Consumer calendar spans incompatible seasons");
  const startDate = now.toISOString().slice(0, 10);
  const endDate = new Date(Date.parse(`${startDate}T00:00:00Z`) + (calendarDays - 1) * 86400000).toISOString().slice(0, 10);
  const data = await loadPlanningData(db, { seasonId: seasons[0], startDate, endDate, timeZone: "UTC" }, { now });
  return summarizeCalendarConsumerCoverage(data, scopes, profile, { seasonId: seasons[0], asOf: now.toISOString(), startDate, endDate }, receipts);
}
