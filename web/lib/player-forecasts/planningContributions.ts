import { calendarLeadDay, forecastCalendarPolicy, validForecastCalendarPolicy, resolveContribution, type ContributionGame, type ContributionParticipation, type ContributionSource } from "./contributions";
import { forecastFromContributions, revalidateResolvedForecast } from "./resolvedPlanningForecast";
import type { ContributionPlanningSnapshot, ForecastExclusionReason, GameForecast, PlanningSnapshot, StatLine } from "../rosterScheduleOptimizer/planningTypes";

function issuedGame(forecast: GameForecast | undefined, snapshot: ContributionPlanningSnapshot): ContributionGame | null {
  if (!forecast) return null;
  const context = forecast.issuedContext;
  const player = snapshot.players.find(row => row.id === forecast.playerId);
  const game = snapshot.games.find(row => row.id === forecast.gameId && row.teamAbbreviation === player?.teamAbbreviation);
  if (!context || context.version !== "forge-issued-context-v1" || !forecast.sourceWatermark || !player || !game
    || context.playerId !== player.id || context.gameId !== game.id
    || context.nhlPlayerId !== player.nhlId || context.seasonId !== snapshot.context.seasonId
    || context.teamId !== player.nhlTeamId || !Number.isFinite(Date.parse(context.scheduledAt))
    || Date.parse(context.scheduledAt) !== Date.parse(game.startsAt ?? "")
    || context.scheduleRevision !== game.scheduleRevision || context.rosterRevision !== player.rosterRevision
    || !Number.isFinite(Date.parse(context.observedAt)) || !Number.isFinite(Date.parse(forecast.issuedAt))
    || Date.parse(context.observedAt) > Date.parse(forecast.issuedAt)) return null;
  return { playerId: Number(context.playerId), nhlPlayerId: context.nhlPlayerId,
    seasonId: context.seasonId, teamId: context.teamId, gameId: Number(context.gameId),
    scheduledAt: context.scheduledAt, scheduleRevision: context.scheduleRevision,
    rosterRevision: context.rosterRevision };
}

function unusableDetailed(forecast: GameForecast,
  limitation = "Issued forecast context is absent or conflicts with current game and roster identity."): GameForecast {
  return { ...forecast, stats: Object.fromEntries(Object.keys(forecast.stats).map(key => [key, null])),
    assignmentStats: Object.fromEntries(Object.keys(forecast.assignmentStats ?? forecast.stats).map(key => [key, null])),
    allowedUses: { assignment: false, totals: false, comparison: false, conditionalTieBreak: false },
    tieBreakStats: undefined, conditionalStats: undefined, contributions: undefined, issuedContext: undefined,
    appearanceProbability: null, startProbability: null, confirmedStart: false,
    limitations: [...new Set([...forecast.limitations, limitation])] };
}

/** Apply immutable shared rates only to actual requested schedule opportunities.
 * No model generation, database reads, league scoring, or cache writes occur here. */
export function resolvePlanningContributions(snapshot: PlanningSnapshot,
  options?: { playerIds?: ReadonlySet<string> }): PlanningSnapshot;
export function resolvePlanningContributions(snapshot: ContributionPlanningSnapshot,
  options?: { playerIds?: ReadonlySet<string> }): ContributionPlanningSnapshot;
export function resolvePlanningContributions(snapshot: ContributionPlanningSnapshot,
  options: { playerIds?: ReadonlySet<string> } = {}): ContributionPlanningSnapshot {
  const calendarPolicy = snapshot.forecastManifest?.calendarPolicy ?? forecastCalendarPolicy();
  const exclusions = [...(snapshot.forecastInputExclusions ?? [])];
  const exclude = (gameId: string, playerId: string, reason: ForecastExclusionReason) => {
    if (!exclusions.some(row => row.gameId === gameId && row.playerId === playerId
      && !row.targetKey && row.reasons.includes(reason))) {
      exclusions.push({ gameId, playerId, reasons: [reason] });
    }
  };
  const reject = (forecast: GameForecast, reason: ForecastExclusionReason, limitation?: string) => {
    exclude(forecast.gameId, forecast.playerId, reason);
    return unusableDetailed(forecast, limitation);
  };
  const asOf = Date.parse(snapshot.context.asOf);
  snapshot = { ...snapshot, forecasts: snapshot.forecasts.map(forecast => {
    // Resolved rates must be rebuilt from their retained inputs below. Raw rows
    // require the issued contract regardless of whether a rate catalog exists.
    if (forecast.contributions) return forecast;
    if (forecast.sourceKind !== "detailed" || !issuedGame(forecast, snapshot)
      || !forecast.revisionId?.trim() || !forecast.modelVersion?.trim()) {
      return reject(forecast, "identity_conflict");
    }
    const cutoff = Date.parse(forecast.cutoffAt ?? ""), issued = Date.parse(forecast.issuedAt);
    const expiry = Date.parse(forecast.expiresAt ?? "");
    if (!Number.isFinite(cutoff) || !Number.isFinite(issued) || cutoff > issued
      || !Number.isFinite(asOf) || issued > asOf || !Number.isFinite(expiry) || expiry <= asOf || expiry <= issued) {
      return reject(forecast, issued > asOf ? "future_input" : "stale_source",
        "Forecast source is stale or its cutoff cannot be verified.");
    }
    const listed = snapshot.forecastManifest?.issuedRevisionIds;
    if (listed && !listed.includes(forecast.revisionId)) return reject(forecast, "unreleased_source",
      "Issued forecast revision is no longer permitted by the current snapshot.");
    return forecast;
  }), forecastInputExclusions: exclusions };
  const playerById = new Map(snapshot.players.map(player => [player.id, player]));
  if (snapshot.forecasts.some(forecast => forecast.contributions)) {
    snapshot = { ...snapshot, forecasts: snapshot.forecasts.map(forecast => forecast.contributions
      ? revalidateResolvedForecast(forecast, snapshot, issuedGame(forecast, snapshot), true,
        !options.playerIds || options.playerIds.has(forecast.playerId))
      : forecast) };
  }
  // Validate fresh competition before limiting the requested player set or
  // assigning slots. A benched teammate is still part of the same start event.
  const goalieMass = new Map<string, number>(), invalidGoalieGroups = new Set<string>();
  for (const forecast of snapshot.forecasts) {
    const player = playerById.get(forecast.playerId);
    if (player?.playerClass !== "goalie" || !player.nhlTeamId) continue;
    const key = `${forecast.gameId}:${player.nhlTeamId}`;
    const probability = forecast.confirmedStart ? 1 : forecast.startProbability;
    if (probability != null && (!Number.isFinite(probability) || probability < 0 || probability > 1)
      || forecast.confirmedStart && forecast.startProbability !== null && forecast.startProbability !== 1) {
      invalidGoalieGroups.add(key);
    } else if (probability != null) goalieMass.set(key, (goalieMass.get(key) ?? 0) + probability);
  }
  for (const [key, mass] of goalieMass) if (mass > 1.000001) invalidGoalieGroups.add(key);
  if (invalidGoalieGroups.size) {
    for (const game of snapshot.games) for (const player of snapshot.players) {
      if (player.playerClass === "goalie" && player.teamAbbreviation === game.teamAbbreviation
        && invalidGoalieGroups.has(`${game.id}:${player.nhlTeamId}`)) {
        exclude(game.id, player.id, "unsupported_conditioning");
      }
    }
  }
  if (invalidGoalieGroups.size) snapshot = { ...snapshot, forecasts: snapshot.forecasts.map(forecast => {
    if (!invalidGoalieGroups.has(`${forecast.gameId}:${playerById.get(forecast.playerId)?.nhlTeamId}`)) return forecast;
    const rejected = forecast.contributions
      ? revalidateResolvedForecast(forecast, snapshot, issuedGame(forecast, snapshot), false)
      : forecast;
    const result = reject(rejected, "unsupported_conditioning",
      "Goalie starter evidence conflicts within this team-game; dependent forecasts and start claims are unavailable.");
    return forecast.contributions ? { ...result, contributions: rejected.contributions } : result;
  }) };
  if (!snapshot.baselineSources?.length) {
    const forecasts = snapshot.forecasts.map((forecast) => {
      if (forecast.contributions) return forecast;
      const identity = issuedGame(forecast, snapshot);
      if (identity && (!validForecastCalendarPolicy(calendarPolicy)
        || calendarLeadDay(identity.scheduledAt, snapshot.context.asOf) >= calendarPolicy.calendarDays)) {
        return reject(forecast, "outside_horizon",
          "Detailed forecast is outside the declared calendar policy or that policy is unsupported.");
      }
      return forecast;
    });
    return { ...snapshot, forecasts, forecastInputExclusions: exclusions };
  }
  const forecasts = new Map(snapshot.forecasts.map(row => [`${row.playerId}:${row.gameId}`, row]));
  const sources = new Map<string, ContributionSource[]>();
  for (const source of snapshot.baselineSources ?? []) {
    const key = String(source.playerId);
    sources.set(key, [...(sources.get(key) ?? []), source]);
  }
  for (const player of snapshot.players) {
    if (options.playerIds && !options.playerIds.has(player.id)) continue;
    const rates = (sources.get(player.id) ?? []).filter(rate =>
      player.playerClass === "goalie" ? rate.targetKey.endsWith("_GOALIE") || rate.targetKey === "GOALIE_MINUTES"
        : !rate.targetKey.endsWith("_GOALIE") && rate.targetKey !== "GOALIE_MINUTES");
    if (player.nhlId === null
      || !player.nhlTeamId || !player.rosterRevision) continue;
    const byTarget = new Map<string, ContributionSource[]>();
    for (const rate of [...rates].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt) || a.sourceId.localeCompare(b.sourceId))) {
      byTarget.set(rate.targetKey, [...(byTarget.get(rate.targetKey) ?? []), rate]);
    }
    for (const game of snapshot.games) {
      if (game.teamAbbreviation !== player.teamAbbreviation || game.status !== "scheduled" || !game.startsAt
        || game.date < snapshot.context.startDate || game.date > snapshot.context.endDate
        || Date.parse(game.startsAt) <= Date.parse(snapshot.context.asOf) || !game.scheduleRevision) continue;
      const identity: ContributionGame = { playerId: Number(player.id), nhlPlayerId: player.nhlId,
        seasonId: snapshot.context.seasonId, teamId: player.nhlTeamId, gameId: Number(game.id), scheduledAt: game.startsAt,
        scheduleRevision: game.scheduleRevision, rosterRevision: player.rosterRevision };
      const key = `${player.id}:${game.id}`, original = forecasts.get(key);
      if (original?.contributions) continue;
      if (!rates.length && (!original || !original.cutoffAt && !original.expiresAt)) continue;
      const issuedIdentity = issuedGame(original, snapshot);
      const originalFresh = !!issuedIdentity && !!original?.cutoffAt && !!original.expiresAt
        && Date.parse(original.expiresAt) > Date.parse(snapshot.context.asOf)
        && Date.parse(original.cutoffAt) <= Date.parse(original.issuedAt)
        && Date.parse(original.issuedAt) <= Date.parse(snapshot.context.asOf);
      const effectiveStartProbability = original?.confirmedStart ? 1 : original?.startProbability;
      const goalieStartUsable = player.playerClass === "goalie" && originalFresh
        && effectiveStartProbability != null && Number.isFinite(effectiveStartProbability)
        && effectiveStartProbability >= 0 && effectiveStartProbability <= 1
        && !invalidGoalieGroups.has(`${game.id}:${player.nhlTeamId}`);
      const stats: StatLine = { ...original?.stats }, assignmentStats: StatLine = {}, tieBreakStats: StatLine = {};
      const contributions: NonNullable<GameForecast["contributions"]> = {};
      const targets = new Set([...byTarget.keys(), ...Object.keys(original?.stats ?? {})]);
      for (const targetKey of targets) {
        const candidates = byTarget.get(targetKey) ?? [];
        const baseline = candidates.find(rate => resolveContribution({ game: identity, targetKey,
          now: snapshot.context.asOf, baseline: rate }).sourceKind !== null) ?? candidates[0];
        let detailed: ContributionSource | undefined;
        let participation: ContributionParticipation | undefined;
        if (issuedIdentity && original?.cutoffAt && original.expiresAt
          && (player.playerClass !== "goalie" || goalieStartUsable)
          && (original.stats[targetKey] != null || original.conditionalStats?.[targetKey] != null)) {
          const conditional = original.conditionalStats?.[targetKey];
          detailed = { ...issuedIdentity, kind: "detailed", sourceId: original.revisionId, policyVersion: original.modelVersion ?? "FORGE",
            released: true, allowedUses: original.allowedUses,
            targetKey, unit: targetKey.includes("MINUTES") || targetKey === "TIME_ON_ICE_PER_GAME" ? "minutes" : "count",
            basis: conditional != null ? player.playerClass === "goalie" ? "per_start" : "per_appearance" : "unconditional_game",
            mean: conditional ?? original.stats[targetKey]!, participationIntegrated: conditional == null,
            cutoffAt: original.cutoffAt, issuedAt: original.issuedAt, expiresAt: original.expiresAt,
            sourceWatermark: original.sourceWatermark!, limitations: original.limitations };
          const probability = player.playerClass === "goalie" ? effectiveStartProbability : original.appearanceProbability;
          if (probability != null) participation = { ...issuedIdentity, released: true,
            allowedUses: original.allowedUses, issuedAt: original.issuedAt,
            basis: player.playerClass === "goalie" ? "start" : "appearance", probability,
            revisionId: `${original.revisionId}:participation`, cutoffAt: original.cutoffAt, expiresAt: original.expiresAt };
        }
        if (!participation && originalFresh && player.playerClass === "skater"
          && baseline?.basis === "per_appearance" && original?.appearanceProbability != null) {
          participation = { ...identity, released: true, basis: "appearance", allowedUses: original.allowedUses, issuedAt: original.issuedAt,
            probability: original.appearanceProbability,
            revisionId: `${original.revisionId}:appearance`, cutoffAt: original.cutoffAt!, expiresAt: original.expiresAt! };
        }
        if (!participation && originalFresh && player.playerClass === "goalie"
          && baseline?.basis === "per_appearance" && original?.appearanceProbability != null) {
          participation = { ...identity, released: true, basis: "appearance", allowedUses: original.allowedUses, issuedAt: original.issuedAt,
            probability: original.appearanceProbability,
            revisionId: `${original.revisionId}:appearance`, cutoffAt: original.cutoffAt!, expiresAt: original.expiresAt! };
        }
        if (!participation && goalieStartUsable && baseline?.basis === "per_start"
          && effectiveStartProbability != null) {
          participation = { ...identity, released: true, basis: "start", allowedUses: original!.allowedUses, issuedAt: original!.issuedAt,
            probability: effectiveStartProbability,
            revisionId: `${original.revisionId}:start`, cutoffAt: original.cutoffAt!, expiresAt: original.expiresAt! };
        }
        const resolved = resolveContribution({ game: identity, targetKey, now: snapshot.context.asOf,
          calendarPolicy, detailed, baseline, participation });
        contributions[targetKey] = resolved;
        stats[targetKey] = resolved.allowedUses.totals ? resolved.unconditionalMean : null;
        assignmentStats[targetKey] = resolved.allowedUses.assignment ? resolved.unconditionalMean : null;
        tieBreakStats[targetKey] = resolved.allowedUses.conditionalTieBreak ? resolved.conditionalMean : null;
      }
      if (!Object.keys(contributions).length) continue;
      const chosen = Object.values(contributions).filter(row => row.sourceKind !== null);
      if (!chosen.length && !original) continue;
      forecasts.set(key, forecastFromContributions({ ...original, playerId: player.id, gameId: game.id,
        conditioning: "unconditional", stats, assignmentStats, tieBreakStats,
        revisionId: original?.revisionId ?? "unresolved", issuedAt: original?.issuedAt ?? snapshot.context.asOf,
        modelVersion: original?.modelVersion ?? null,
        startProbability: goalieStartUsable ? effectiveStartProbability ?? null : null,
        confirmedStart: goalieStartUsable && original?.confirmedStart === true,
        limitations: [...new Set([...(original?.limitations ?? []),
          "Includes provisional baseline estimates; no calibrated uncertainty."])],
      }, contributions, player.playerClass === "goalie"));
    }
  }
  return { ...snapshot, baselineSources: undefined, forecasts: [...forecasts.values()] };
}
