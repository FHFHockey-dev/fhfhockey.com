import { acquisitionEffectiveAt } from "./planningTimeline";
import type { PlanIntent, PlanningSnapshot, RevisionProposal } from "./planningTypes";

/** Recheck selected intent against new authoritative inputs; repairs require explicit acceptance. */
export function reconcileIntent(snapshot: PlanningSnapshot, intent: PlanIntent, previous?: PlanningSnapshot | null): RevisionProposal {
  const roster = new Set(snapshot.roster.map((entry) => entry.playerId));
  const players = new Map(snapshot.players.map((player) => [player.id, player]));
  const issues: RevisionProposal["issues"] = [];
  const invalid = new Set<string>();
  const warn = (stepId: string | null, message: string, remove = false) => { issues.push({ stepId, message }); if (stepId && remove) invalid.add(stepId); };
  const invalidateDependents = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const step of intent.steps) if (!invalid.has(step.id) && step.dependsOn.some((id) => invalid.has(id))) {
        warn(step.id, "A prerequisite step needs repair.", true); changed = true;
      }
    }
  };
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
  const ordered = [...intent.steps].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const step of ordered) {
    const player = players.get(step.playerId);
    if (!player) { warn(step.id, "Selected player is missing from the refreshed catalog.", true); continue; }
    const actionAt = Date.parse(step.at);
    if (!Number.isFinite(actionAt) || actionAt < asOf) warn(step.id, "Selected action time has passed; review this step.", true);
    if (step.type === "add") {
      if (roster.has(player.id)) warn(step.id, `${player.name} appears on the actual roster; review whether this selected add is complete.`, true);
      else if (!["free_agent", "manager_available", "waivers"].includes(player.availability)) warn(step.id, `${player.name} is no longer verified as available.`, true);
      if (step.dropPlayerId) {
        const dropped = players.get(step.dropPlayerId);
        if (!dropped) warn(step.id, "Selected drop prerequisite is no longer on the actual or planned roster.", true);
        else if (dropped.canDrop === false || intent.protectedPlayerIds.includes(dropped.id)) warn(step.id, `${dropped.name} cannot be dropped for this add.`, true);
      }
      const period = snapshot.rules.periods.find((candidate) => actionAt >= Date.parse(candidate.start) && actionAt < Date.parse(candidate.end));
      if (!period) warn(step.id, "No current acquisition period covers this selected add.", true);
      // Same verified earliest time the timeline enforces (next-day timing, waiver clearance); unknown timing is reported there.
      const earliest = acquisitionEffectiveAt(snapshot, player, step.at);
      if (earliest && Date.parse(step.effectiveAt) < Date.parse(earliest)) warn(step.id, `${player.name} cannot take effect at the selected time under current league timing or waiver clearance.`, true);
    }
    if (step.type === "drop" && (player.canDrop === false || intent.protectedPlayerIds.includes(player.id))) warn(step.id, `${player.name} cannot be dropped.`, true);
    if (step.type === "reserve" && (!step.reservePosition || !player.reserveEligibility.includes(step.reservePosition))) warn(step.id, `${player.name} is no longer verified for ${step.reservePosition ?? "a reserve slot"}.`, true);
  }
  invalidateDependents();
  // At the same action time, charge an explicit prerequisite before its dependent move.
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && Date.parse(ordered[end].at) === Date.parse(ordered[start].at)) end++;
    const pending = ordered.slice(start, end);
    const group: typeof pending = [];
    while (pending.length) {
      const index = pending.findIndex(step => step.dependsOn.every(id => !pending.some(candidate => candidate.id === id)));
      group.push(...pending.splice(index < 0 ? 0 : index, 1));
    }
    ordered.splice(start, end - start, ...group);
    start = end;
  }
  const spent = new Map<string, number>();
  const hasRetainedAdd = (playerId: string, step: PlanIntent["steps"][number]) => ordered.some(earlier =>
    earlier.type === "add" && earlier.playerId === playerId && !invalid.has(earlier.id)
    && Date.parse(earlier.effectiveAt) <= Date.parse(step.at)
    && (Date.parse(earlier.at) < Date.parse(step.at) || step.dependsOn.includes(earlier.id)));
  const reserveHolders = new Map<string, string>(snapshot.roster.filter(entry => ["IR", "IR+", "NA"].includes(entry.position)).map(entry => [entry.playerId, entry.position]));
  for (const step of ordered) {
    if (invalid.has(step.id)) continue;
    if (step.type === "reserve") {
      if (!roster.has(step.playerId) && !hasRetainedAdd(step.playerId, step)) {
        warn(step.id, `${players.get(step.playerId)!.name} is no longer on the actual or planned roster.`, true);
        invalidateDependents();
      } else if ([...reserveHolders].filter(([id, position]) => id !== step.playerId && position === step.reservePosition).length
        >= (snapshot.rules.rosterSlots[step.reservePosition!] ?? 0)) {
        warn(step.id, `Selected moves exceed ${step.reservePosition} capacity.`, true);
        invalidateDependents();
      } else reserveHolders.set(step.playerId, step.reservePosition!);
      continue;
    }
    if (step.type === "drop") {
      if (!roster.has(step.playerId) && !hasRetainedAdd(step.playerId, step)) {
        warn(step.id, `${players.get(step.playerId)!.name} is no longer on the actual or planned roster.`, true);
        invalidateDependents();
      } else reserveHolders.delete(step.playerId);
      continue;
    }
    if (step.type !== "add") continue;
    const actionAt = Date.parse(step.at);
    if (step.dropPlayerId && !roster.has(step.dropPlayerId) && !hasRetainedAdd(step.dropPlayerId, step)) {
      warn(step.id, "Selected drop prerequisite is no longer on the actual or planned roster.", true);
      invalidateDependents();
      continue;
    }
    const period = snapshot.rules.periods.find(candidate => actionAt >= Date.parse(candidate.start) && actionAt < Date.parse(candidate.end));
    if (period?.remaining !== null && period?.remaining !== undefined && snapshot.rules.acquisitionCost !== null) {
      const next = (spent.get(period.id) ?? 0) + snapshot.rules.acquisitionCost;
      if (next > period.remaining) {
        warn(step.id, `Selected moves exceed the ${period.id} acquisition allowance.`, true);
        invalidateDependents();
      } else spent.set(period.id, next);
    }
    if (!invalid.has(step.id) && step.dropPlayerId) reserveHolders.delete(step.dropPlayerId);
  }
  return { snapshotId: snapshot.id, intentRevision: intent.revision, issues, suggestedSteps: invalid.size ? intent.steps.filter((step) => !invalid.has(step.id)) : null };
}
