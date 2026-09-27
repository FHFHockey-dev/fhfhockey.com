import type { PlanIntent, PlanningSnapshot, RevisionProposal } from "./planningTypes";

/** Recheck selected intent against new authoritative inputs; repairs require explicit acceptance. */
export function reconcileIntent(snapshot: PlanningSnapshot, intent: PlanIntent, previous?: PlanningSnapshot | null): RevisionProposal {
  const roster = new Set(snapshot.roster.map((entry) => entry.playerId));
  const players = new Map(snapshot.players.map((player) => [player.id, player]));
  const issues: RevisionProposal["issues"] = [];
  const invalid = new Set<string>();
  const warn = (stepId: string | null, message: string, remove = false) => { issues.push({ stepId, message }); if (stepId && remove) invalid.add(stepId); };
  const contextKey = (value: PlanningSnapshot) => JSON.stringify([value.context.provider, value.context.leagueId, value.context.teamId, value.context.seasonId, value.context.startDate, value.context.endDate]);
  if (previous && contextKey(previous) === contextKey(snapshot)) {
    const budgets = (value: PlanningSnapshot) => JSON.stringify([value.rules.acquisitionCost, value.rules.periods, value.rules.waivers]);
    if (budgets(previous) !== budgets(snapshot)) warn(null, "Acquisition allowances or waiver constraints changed; review the selected itinerary.");
    const relevant = new Set([...snapshot.roster.map(row => row.playerId), ...previous.roster.map(row => row.playerId), ...intent.steps.map(step => step.playerId)]);
    const goalieEvidence = (value: PlanningSnapshot) => {
      const goalies = new Set(value.players.filter(player => player.playerClass === "goalie" && relevant.has(player.id)).map(player => player.id));
      return JSON.stringify([value.rules.goalieMinimum, value.forecasts.filter(forecast => goalies.has(forecast.playerId)).map(forecast => [forecast.playerId, forecast.gameId, forecast.startProbability, forecast.confirmedStart]).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])))]);
    };
    if (goalieEvidence(previous) !== goalieEvidence(snapshot)) warn(null, "Goalie minimum progress or starter evidence changed; review coverage and outcome tradeoffs.");
  }
  const asOf = Date.parse(snapshot.context.asOf);
  const spent = new Map<string, number>();
  for (const step of [...intent.steps].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const player = players.get(step.playerId);
    if (!player) { warn(step.id, "Selected player is missing from the refreshed catalog.", true); continue; }
    const actionAt = Date.parse(step.at);
    if (!Number.isFinite(actionAt) || actionAt < asOf) warn(step.id, "Selected action time has passed; review this step.", true);
    if (step.type === "add") {
      if (roster.has(player.id)) warn(step.id, `${player.name} appears on the actual roster; review whether this selected add is complete.`, true);
      else if (!["free_agent", "manager_available", "waivers"].includes(player.availability)) warn(step.id, `${player.name} is no longer verified as available.`, true);
      if (step.dropPlayerId) {
        const dropped = players.get(step.dropPlayerId);
        if (!dropped || (!roster.has(dropped.id) && !intent.steps.some((earlier) => earlier.type === "add" && earlier.playerId === dropped.id && Date.parse(earlier.effectiveAt) <= actionAt))) warn(step.id, "Selected drop prerequisite is no longer on the actual or planned roster.", true);
        else if (dropped.canDrop === false || intent.protectedPlayerIds.includes(dropped.id)) warn(step.id, `${dropped.name} cannot be dropped for this add.`, true);
      }
      const period = snapshot.rules.periods.find((candidate) => actionAt >= Date.parse(candidate.start) && actionAt < Date.parse(candidate.end));
      if (!period) warn(step.id, "No current acquisition period covers this selected add.", true);
      else if (period.remaining !== null && snapshot.rules.acquisitionCost !== null) {
        const next = (spent.get(period.id) ?? 0) + snapshot.rules.acquisitionCost;
        spent.set(period.id, next);
        if (next > period.remaining) warn(step.id, `Selected moves exceed the ${period.id} acquisition allowance.`, true);
      }
    }
    if (step.type === "drop" && !roster.has(player.id)) warn(step.id, `${player.name} is no longer on the actual roster.`, true);
    if (step.type === "drop" && (player.canDrop === false || intent.protectedPlayerIds.includes(player.id))) warn(step.id, `${player.name} cannot be dropped.`, true);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of intent.steps) if (!invalid.has(step.id) && step.dependsOn.some((id) => invalid.has(id))) { warn(step.id, "A prerequisite step needs repair.", true); changed = true; }
  }
  return { snapshotId: snapshot.id, intentRevision: intent.revision, issues, suggestedSteps: invalid.size ? intent.steps.filter((step) => !invalid.has(step.id)) : null };
}
