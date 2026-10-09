import { CONTRIBUTION_RESOLVER_POLICY_VERSION, resolveContribution, type ContributionGame, type ContributionSource, type ResolvedContribution } from "./contributions";
import type { ContributionPlanningSnapshot, GameForecast, StatLine } from "../rosterScheduleOptimizer/planningTypes";

type Contributions = NonNullable<GameForecast["contributions"]>;
const denied = { assignment: false, totals: false, comparison: false, conditionalTieBreak: false };
const sameInstant = (left: string, right: string) => Number.isFinite(Date.parse(left)) && Date.parse(left) === Date.parse(right);

function matchingGame(left: ContributionGame, right: ContributionGame): boolean {
  return left.playerId === right.playerId && left.nhlPlayerId === right.nhlPlayerId
    && left.seasonId === right.seasonId && left.teamId === right.teamId && left.gameId === right.gameId
    && left.scheduleRevision === right.scheduleRevision && left.rosterRevision === right.rosterRevision
    && sameInstant(left.scheduledAt, right.scheduledAt);
}

/** Rebuild every displayed value and timestamp from the same selected target inputs. */
export function forecastFromContributions(original: GameForecast, contributions: Contributions, goalie: boolean): GameForecast {
  if (goalie) {
    const volumeTargets = ["SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "GOALIE_MINUTES"];
    const appearanceBased = (row: ResolvedContribution | undefined) => row?.sourceKind === "baseline"
      && row.inputs?.baseline?.basis === "per_appearance";
    const hasStartBranch = volumeTargets.some(target => {
      const row = contributions[target];
      return row?.sourceKind && !appearanceBased(row);
    });
    if (hasStartBranch) for (const target of volumeTargets) {
      const row = contributions[target];
      if (!appearanceBased(row)) continue;
      contributions[target] = { ...row, unconditionalMean: null,
        allowedUses: { ...denied, conditionalTieBreak: row.allowedUses.conditionalTieBreak },
        exclusionReasons: [...new Set([...row.exclusionReasons, "incompatible_component_basis" as const])],
        limitations: [...new Set([...row.limitations, "Goalie ratio components use incompatible start and appearance bases."])] };
    }
  }
  const stats: StatLine = Object.fromEntries(Object.keys(original.stats).map(key => [key, null]));
  const assignmentStats: StatLine = {}, tieBreakStats: StatLine = {};
  const sources: ContributionSource[] = [];
  const participation = [] as NonNullable<NonNullable<ResolvedContribution["inputs"]>["participation"]>[];
  for (const [target, row] of Object.entries(contributions)) {
    stats[target] = row.allowedUses.totals ? row.unconditionalMean : null;
    assignmentStats[target] = row.allowedUses.assignment ? row.unconditionalMean : null;
    tieBreakStats[target] = row.allowedUses.conditionalTieBreak ? row.conditionalMean : null;
    for (const source of [row.inputs?.detailed, row.inputs?.baseline]) {
      if (row.sourceKind && source && row.sourceIds.includes(source.sourceId)) sources.push(source);
    }
    const evidence = row.inputs?.participation;
    if (evidence && evidence.revisionId === row.participationRevisionId) participation.push(evidence);
  }
  const kinds = new Set(Object.values(contributions).flatMap(row => row.sourceKind ? [row.sourceKind] : []));
  const detailUsed = sources.some(source => source.kind === "detailed");
  const times = [...sources, ...participation];
  const orderedTimes = (key: "issuedAt" | "cutoffAt" | "expiresAt") => times.map(row => row[key])
    .filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(a) - Date.parse(b));
  const start = participation.find(row => row.basis === "start");
  const appearance = participation.find(row => row.basis === "appearance");
  const sourceIds = [...new Set(sources.map(source => source.sourceId))].sort();
  return { ...original, stats, assignmentStats, tieBreakStats, contributions,
    allowedUses: { ...denied },
    sourceKind: kinds.has("blended") || kinds.size > 1 ? "blended" : kinds.has("detailed") ? "detailed" : "baseline",
    revisionId: sourceIds.join(":") || original.revisionId,
    issuedAt: orderedTimes("issuedAt").at(-1) ?? original.issuedAt,
    cutoffAt: orderedTimes("cutoffAt").at(-1) ?? original.cutoffAt,
    expiresAt: orderedTimes("expiresAt")[0] ?? original.expiresAt,
    issuedContext: detailUsed || participation.length ? original.issuedContext : undefined,
    sourceWatermark: detailUsed || participation.length ? original.sourceWatermark : undefined,
    conditionalStats: undefined,
    startProbability: start?.probability ?? (detailUsed ? original.startProbability : null),
    appearanceProbability: appearance?.probability ?? null,
    confirmedStart: original.confirmedStart && (start?.probability === 1 || detailUsed && original.startProbability === 1),
    modelVersion: sources.find(source => source.kind === "detailed")?.policyVersion ?? sources[0]?.policyVersion ?? original.modelVersion,
    limitations: [...new Set([...original.limitations, ...Object.values(contributions).flatMap(row => row.limitations)])] };
}

export function revalidateResolvedForecast(forecast: GameForecast, snapshot: ContributionPlanningSnapshot,
  issuedIdentity: ContributionGame | null, validGoalieMass: boolean, expandTargets = true): GameForecast {
  const player = snapshot.players.find(row => row.id === forecast.playerId);
  const game = snapshot.games.find(row => row.id === forecast.gameId && row.teamAbbreviation === player?.teamAbbreviation);
  const identity: ContributionGame | null = player?.nhlId && player.nhlTeamId && player.rosterRevision
    && game?.startsAt && game.scheduleRevision && game.status === "scheduled"
    && Date.parse(game.startsAt) > Date.parse(snapshot.context.asOf)
    ? { playerId: Number(player.id), nhlPlayerId: player.nhlId, seasonId: snapshot.context.seasonId,
      teamId: player.nhlTeamId, gameId: Number(game.id), scheduledAt: game.startsAt,
      scheduleRevision: game.scheduleRevision, rosterRevision: player.rosterRevision } : null;
  const contributions: Contributions = {};
  const calendarPolicy = snapshot.forecastManifest?.calendarPolicy;
  const retained = Object.values(forecast.contributions ?? {});
  const listed = snapshot.forecastManifest?.issuedRevisionIds;
  const retainedParticipation = (row: ResolvedContribution) => {
    const evidence = row.inputs?.participation;
    return identity && issuedIdentity && row.resolverVersion === CONTRIBUTION_RESOLVER_POLICY_VERSION
      && matchingGame(row.game, identity) && evidence
      && (!listed || listed.some(id => evidence.revisionId === `${id}:participation`
        || evidence.revisionId === `${id}:appearance` || evidence.revisionId === `${id}:start`))
      ? evidence : undefined;
  };
  for (const [target, previous] of Object.entries(forecast.contributions ?? {})) {
    if (!identity || previous.game.playerId !== identity.playerId || previous.game.nhlPlayerId !== identity.nhlPlayerId
      || previous.game.gameId !== identity.gameId || previous.game.seasonId !== identity.seasonId
      || previous.targetKey !== target || !previous.inputs || previous.resolverVersion !== CONTRIBUTION_RESOLVER_POLICY_VERSION
      || player?.playerClass === "goalie" && !validGoalieMass) {
      contributions[target] = { ...previous, unconditionalMean: null, conditionalMean: null,
        sourceKind: null, participationRevisionId: null, allowedUses: { ...denied },
        exclusionReasons: [...new Set([...previous.exclusionReasons, "identity_conflict" as const])],
        limitations: [...new Set([...previous.limitations, "Stored contribution inputs are absent or conflict with the current opportunity."])] };
      continue;
    }
    const inputs = calendarPolicy ? { ...previous.inputs, calendarPolicy, horizonDays: calendarPolicy.calendarDays } : previous.inputs;
    const sameContext = matchingGame(previous.game, identity);
    const detailed = sameContext && issuedIdentity && (!listed || !inputs.detailed || listed.includes(inputs.detailed.sourceId))
      ? inputs.detailed : undefined;
    // A refresh supplies the current approved rate catalog, including an explicit
    // empty catalog. A retained snapshot without a refresh uses its captured input.
    const rates = snapshot.baselineSources?.filter(source => source.playerId === identity.playerId && source.targetKey === target)
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt) || a.sourceId.localeCompare(b.sourceId));
    const baseline = rates === undefined ? inputs.baseline : rates.find(source => resolveContribution({
      game: identity, targetKey: target, now: snapshot.context.asOf, baseline: source,
    }).sourceKind !== null) ?? rates[0];
    const participation = retainedParticipation(previous);
    contributions[target] = resolveContribution({ ...inputs, detailed, baseline, participation,
      game: identity, targetKey: target, now: snapshot.context.asOf });
  }
  // Revalidation must also discover newly approved targets. Reuse only the
  // retained resolver policy and compatible participation, never another
  // target's production mean or the aggregate forecast's derived permissions.
  const policies = retained.filter(row => row.resolverVersion === CONTRIBUTION_RESOLVER_POLICY_VERSION)
    .flatMap(row => row.inputs ? [calendarPolicy
      ? { ...row.inputs, calendarPolicy, horizonDays: calendarPolicy.calendarDays } : row.inputs] : []);
  const policy = policies[0];
  if (expandTargets && identity && policy && policies.every(row => row.horizonDays === policy.horizonDays
    && row.servingEnabled === policy.servingEnabled) && (player?.playerClass !== "goalie" || validGoalieMass)) {
    const rates = (snapshot.baselineSources ?? []).filter(source => source.playerId === identity.playerId
      && !(source.targetKey in contributions)
      && (player?.playerClass === "goalie") === (source.targetKey.endsWith("_GOALIE") || source.targetKey === "GOALIE_MINUTES"))
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt) || a.sourceId.localeCompare(b.sourceId));
    for (const target of new Set(rates.map(source => source.targetKey))) {
      const candidates = rates.filter(source => source.targetKey === target);
      const input = { game: identity, targetKey: target, now: snapshot.context.asOf,
        horizonDays: policy.horizonDays, calendarPolicy: policy.calendarPolicy, servingEnabled: policy.servingEnabled };
      const baseline = candidates.find(source => resolveContribution({ ...input, baseline: source }).sourceKind !== null)
        ?? candidates[0];
      const evidence = retained.flatMap(row => {
        const participation = retainedParticipation(row);
        return participation && resolveContribution({ ...input, baseline, participation }).participationRevisionId
          === participation.revisionId ? [participation] : [];
      }).sort((a, b) => a.revisionId.localeCompare(b.revisionId));
      const first = evidence[0];
      const issuedRevision = (revision: string) => revision.replace(/:(participation|appearance|start)$/, "");
      const participation = first && evidence.every(row => issuedRevision(row.revisionId) === issuedRevision(first.revisionId)
        && row.probability === first.probability && row.basis === first.basis
        && sameInstant(row.cutoffAt, first.cutoffAt) && sameInstant(row.issuedAt, first.issuedAt)
        && sameInstant(row.expiresAt, first.expiresAt)
        && Object.keys(denied).every(use => row.allowedUses?.[use as keyof typeof denied]
          === first.allowedUses?.[use as keyof typeof denied])) ? first : undefined;
      contributions[target] = resolveContribution({ ...input, baseline, participation });
    }
  }
  return forecastFromContributions(forecast, contributions, player?.playerClass === "goalie");
}
