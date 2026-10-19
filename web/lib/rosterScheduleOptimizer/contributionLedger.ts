import { canEligibilityOccupySlot, normalizeEligibility } from "./eligibility";
import { localDate, zonedMidnight } from "./planningDates";
import { playerAssignedPoints } from "./planning";
import { buildTimeline } from "./planningTimeline";
import { expandActiveSlots } from "./slots";
import type { BenchDecision, PlanEvaluation, PlanIntent, PlanningSnapshot } from "./planningTypes";

export type ContributionDay = {
  date: string; gameId: string | null;
  state: "active" | "bench" | "reserve" | "outside_roster" | "ineligible" | "elapsed" | "cancelled" | "no_game" | "unknown";
  slotId?: string;
  reason?: BenchDecision["reason"];
  competingPlayerIds: string[];
};
export type PlayerContribution = {
  playerId: string;
  scheduledGames: number | null; knownScheduledGames: number;
  activeGames: number | null; knownActiveGames: number;
  benchGames: number | null; knownBenchGames: number;
  projectedPoints: number | null;
  days: ContributionDay[];
};

/** Readback of an existing plan, never a second optimizer or a drop recommendation. */
export function contributionLedger(snapshot: PlanningSnapshot | null, evaluation: PlanEvaluation | null,
  intent: PlanIntent): Map<string, PlayerContribution> {
  const result = new Map<string, PlayerContribution>();
  if (!snapshot) return result;
  const dates: string[] = [];
  for (let time = Date.parse(`${snapshot.context.startDate}T12:00:00Z`); time <= Date.parse(`${snapshot.context.endDate}T12:00:00Z`); time += 86400000)
    dates.push(new Date(time).toISOString().slice(0, 10));
  const games = [...new Map(snapshot.games.filter(game => dates.includes(game.date))
    .map(game => [`${game.id}:${game.teamAbbreviation}`, game])).values()];
  const slots = expandActiveSlots(snapshot.rules.rosterSlots).activeSlots;
  const assignments = evaluation?.assignments ?? [];
  const legal = evaluation?.legal === true;
  const timeline = evaluation ? buildTimeline(snapshot, intent, evaluation.steps) : null;
  const membersAtGame = new Map<string, ReturnType<NonNullable<typeof timeline>["at"]>>();
  for (const game of [...games].sort((a, b) => Date.parse(a.startsAt ?? zonedMidnight(a.date, snapshot.context.timeZone))
    - Date.parse(b.startsAt ?? zonedMidnight(b.date, snapshot.context.timeZone)))) {
    if (game.status !== "scheduled" && game.status !== "live") continue;
    const at = game.startsAt ?? zonedMidnight(game.date, snapshot.context.timeZone);
    if (Date.parse(at) < Date.parse(snapshot.context.asOf)) continue;
    if (timeline) membersAtGame.set(`${game.id}:${game.teamAbbreviation}`, timeline.at(at));
  }
  for (const playerId of new Set(snapshot.roster.map(row => row.playerId))) {
    const player = snapshot.players.find(row => row.id === playerId);
    const coverageKnown = Boolean(player?.teamAbbreviation && snapshot.evidence.schedule?.completeness === "complete");
    let gpComplete = coverageKnown && (Boolean(evaluation) || !intent.steps.length);
    const days: ContributionDay[] = [];
    let gp = 0, agp = 0, bench = 0;
    for (const date of dates) {
      const matches = player?.teamAbbreviation ? games.filter(game => game.date === date && game.teamAbbreviation === player.teamAbbreviation) : [];
      if (!matches.length) {
        days.push({ date, gameId: null, state: coverageKnown ? "no_game" : "unknown", competingPlayerIds: [] });
        continue;
      }
      for (const game of matches) {
        const day: ContributionDay = { date, gameId: game.id, state: "unknown", competingPlayerIds: [] };
        days.push(day);
        if (game.status === "cancelled" || game.status === "postponed") { day.state = "cancelled"; continue; }
        if (game.status === "final") { day.state = "elapsed"; continue; }
        const today = localDate(snapshot.context.asOf, snapshot.context.timeZone);
        if (!game.startsAt && date >= today && (date === today || evaluation?.steps.some(step =>
          (step.playerId === playerId || step.dropPlayerId === playerId)
            && localDate(step.effectiveAt, snapshot.context.timeZone) === date))) {
          gpComplete = false; continue;
        }
        const upcoming = game.startsAt ? Date.parse(game.startsAt) >= Date.parse(snapshot.context.asOf) : date > today;
        if (!upcoming) { day.state = "elapsed"; continue; }
        const member = membersAtGame.get(`${game.id}:${game.teamAbbreviation}`)?.get(playerId);
        if (timeline && !member) { day.state = "outside_roster"; continue; }
        gp++;
        if (!legal || !member || !player?.eligibilityVerified) continue;
        if (["IR", "IR+", "NA"].includes(member.position)) { day.state = "reserve"; continue; }
        if (!game.startsAt && Date.parse(member.since) >= Date.parse(zonedMidnight(date, snapshot.context.timeZone))) continue;
        const rows = assignments.filter(row => row.date === date && row.gameId === game.id && row.playerId === playerId);
        const assignment = rows[0];
        const slot = slots.find(row => row.id === assignment?.slotId);
        if (assignment && rows.length === 1 && slot && canEligibilityOccupySlot(normalizeEligibility(player.eligiblePositions), slot.type)
          && !assignments.some(row => row.date === date && row.slotId === assignment.slotId && row.playerId !== playerId)) {
          day.state = "active"; day.slotId = assignment.slotId; agp++; continue;
        }
        if (rows.length) continue;
        const receipt = evaluation?.recommendation?.exclusions?.find(row => row.date === date && row.gameId === game.id && row.playerId === playerId);
        if (!receipt) continue;
        if (receipt.reason === "ineligible") { day.state = "ineligible"; continue; }
        day.state = "bench";
        const scoringReason = ["lower_lineup_value", "equal_lineup_value", "category_tradeoff", "minimum_priority", "negative_value", "decision_unresolved"].includes(receipt.reason);
        day.reason = scoringReason && !receipt.evidence ? "whole_lineup_scoring" : receipt.reason;
        bench++;
        // This is a competing assigned set, not a unique causal replacement.
        day.competingPlayerIds = [...new Set(receipt.competingPlayerIds.filter(id => assignments.some(row => row.date === date && row.playerId === id)))].sort();
      }
    }
    const complete = gpComplete && legal && player?.eligibilityVerified === true && !days.some(day => day.state === "unknown");
    result.set(playerId, { playerId, knownScheduledGames: gp, scheduledGames: gpComplete ? gp : null,
      knownActiveGames: agp, activeGames: complete ? agp : null, knownBenchGames: bench, benchGames: complete ? bench : null,
      projectedPoints: complete && evaluation ? playerAssignedPoints(snapshot, evaluation, playerId) : null, days });
  }
  return result;
}
