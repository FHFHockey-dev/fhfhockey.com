import {evaluatePlan,playerValueKnown,playerAssignedPoints,noMoveDropOrder,candidateAcquisitionSteps} from 'lib/rosterScheduleOptimizer/planning';
const fixtureId = (value: string) => [...value].reduce((id, char) => (id * 31 + char.charCodeAt(0)) % 100000000, 1) + 1;
const player = (id: string, team: string, availability: PlanningPlayer["availability"] = "rostered"): PlanningPlayer => ({
  id, nhlId: fixtureId(id), nhlTeamId: fixtureId(team), rosterRevision: `roster-${id}-${team}`,
  name: id, teamAbbreviation: team, eligiblePositions: ["C"], playerClass: "skater",
  availability, eligibilityVerified: true, ownership: null, canDrop: true, holdValue: null, reserveEligibility: [],
});
const intent: PlanIntent = { revision: 3, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
function snapshot(): PlanningSnapshot {
  const players = [player("a", "A"), player("b", "B"), player("c", "C", "free_agent")];
  const games = ["2026-10-05", "2026-10-06"].flatMap((date, index) => ["A", "B", "C"].map(team => ({
    id: `${team}${index}`, scheduleRevision: `schedule-${team}${index}`, date, startsAt: `${date}T20:00:00Z`, teamAbbreviation: team, opponent: "X", home: true, status: "scheduled" as const,
  })));
  const data: PlanningSnapshot = {
    id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t", startDate: "2026-10-05", endDate: "2026-10-06", timeZone: "UTC", asOf: "2026-10-04T00:00:00Z" },
    players, roster: [{ playerId: "a", position: "active" }, { playerId: "b", position: "bench" }], games,
    forecasts: [],
    rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "same_day", acquisitionCost: 1,
      periods: [{ id: "p", start: "2026-10-04T00:00:00Z", end: "2026-10-12T00:00:00Z", remaining: 2, source: "manager" }],
      scoring: { mode: "points", weights: { pts: 1 }, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
    lockedAssignments: [], realized: { pts: 0 }, opponent: null, evidence: { schedule: {
      source: "synthetic complete schedule", asOf: "2026-10-04T00:00:00Z", seasonId: 20262027,
      completeness: "complete", limitations: [],
    } },
  };
  return data;
}
const data=snapshot();data.games=data.games.filter(g=>g.teamAbbreviation!=='A');const result=evaluatePlan(data,intent,'outcome',[],false);const order=noMoveDropOrder(data,intent);const a=data.players[0];const plan=candidateAcquisitionSteps(data,intent,data.players[2],order);console.log(JSON.stringify({valueKnown:playerValueKnown(result,a.id),assignedPoints:playerAssignedPoints(data,result,a.id),remainingGames:data.games.filter(g=>g.teamAbbreviation==='A').length,dropOrder:[...order],firstFive:[...plan].slice(0,5)},null,2));