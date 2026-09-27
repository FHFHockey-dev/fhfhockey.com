import type { LeagueRules, PlanIntent, PlanningContext, PlanningData, PlanningPlayer, PlanningSnapshot, PlanningWorkspace } from "./planningTypes";
import { workspaceSchema } from "lib/in-season/workspaceSchema";

export const WORKSPACE_KEY = "fhfh:rso:workspace:v1";

export function defaultContext(now = new Date()): PlanningContext {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const localDate = (date: Date) => { const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}`; };
  const start = localDate(now);
  const end = new Date(`${start}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 13);
  const year = Number(start.slice(0, 4)) - (Number(start.slice(5, 7)) < 8 ? 1 : 0);
  return { provider: "manual", seasonId: year * 10000 + year + 1, leagueId: "manual", teamId: "manual", startDate: start, endDate: end.toISOString().slice(0, 10), timeZone, asOf: now.toISOString() };
}

export function defaultRules(): LeagueRules {
  return { lineupMode: "daily", rosterSlots: { C: 2, LW: 2, RW: 2, D: 4, G: 2, UTIL: 1, BN: 4 }, acquisitionTiming: "unknown", acquisitionCost: null, periods: [], lineupPeriods: [], scoring: { mode: "points", weights: {}, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "unknown", periodStart: null, periodEnd: null }, unsupported: [] };
}

export function defaultIntent(): PlanIntent {
  return { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "early", goalieSplit: "mon_thu", alternativeCount: 10 };
}

export function defaultWorkspace(now = new Date()): PlanningWorkspace {
  return { version: 1, context: defaultContext(now), rules: defaultRules(), managerRuleOverrides: {}, roster: [], lockedAssignments: [], intent: defaultIntent(), manualPlayers: [], unresolvedNames: [], realized: {}, opponent: null };
}

export function readWorkspace(storage: Pick<Storage, "getItem">): PlanningWorkspace | null {
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    const parsed = workspaceSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function writeWorkspace(storage: Pick<Storage, "setItem">, workspace: PlanningWorkspace): string | null {
  try { storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace)); return null; }
  catch { return "This browser could not save the workspace. Your current changes remain available until this tab closes."; }
}

/** Keep only inputs needed to resume a local plan; provider availability must be reverified. */
export function retainProviderInputs(workspace: PlanningWorkspace, snapshot: PlanningSnapshot): PlanningWorkspace {
  const referenced = new Set([
    ...snapshot.roster.map((entry) => entry.playerId),
    ...workspace.intent.steps.flatMap((step) => [step.playerId, step.dropPlayerId].filter((id): id is string => Boolean(id))),
    ...workspace.intent.protectedPlayerIds,
    ...workspace.intent.excludedPlayerIds,
  ]);
  const players = new Map([...workspace.manualPlayers, ...snapshot.players].filter((player) => referenced.has(player.id)).map((player) => [player.id, player]));
  const manualPlayers: PlanningPlayer[] = [...players.values()].map((player) => ({
    id: player.id, nhlId: player.nhlId, name: player.name, teamAbbreviation: player.teamAbbreviation,
    eligiblePositions: player.eligiblePositions, playerClass: player.playerClass,
    availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [],
  }));
  return { ...workspace, context: snapshot.context, rules: snapshot.rules, roster: snapshot.roster, manualPlayers };
}

export function resolveImportedNames(names: string, catalog: readonly PlanningPlayer[]): { matched: PlanningPlayer[]; unresolved: string[] } {
  const byName = new Map<string, PlanningPlayer[]>();
  for (const player of catalog) {
    const key = player.name.trim().toLocaleLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), player]);
  }
  const matched = new Map<string, PlanningPlayer>();
  const unresolved: string[] = [];
  for (const name of names.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean)) {
    const candidates = byName.get(name.toLocaleLowerCase()) ?? [];
    if (candidates.length === 1) matched.set(candidates[0].id, candidates[0]);
    else unresolved.push(name);
  }
  return { matched: [...matched.values()], unresolved };
}

/** Retained roster evidence supports schedule analysis, never fresh availability or transactions. */
export function retainedScheduleSnapshot(workspace: PlanningWorkspace, data: PlanningData, asOf: string): PlanningSnapshot | null {
  if (!workspace.roster.length) return null;
  const players = [...new Map([...data.players, ...workspace.manualPlayers].map(player => [player.id, { ...player, availability: "unknown" as const, canDrop: null, reserveEligibility: [] }])).values()];
  return {
    id: `retained:${workspace.context.teamId}:${workspace.context.startDate}:${workspace.context.endDate}:${asOf}`,
    context: { ...workspace.context, asOf }, players, roster: workspace.roster, games: data.games, forecasts: data.forecasts,
    rules: { ...workspace.rules, acquisitionTiming: "unknown", acquisitionCost: null, periods: [], goalieMinimum: { ...workspace.rules.goalieMinimum, credited: null }, unsupported: [...workspace.rules.unsupported, "Retained roster inputs are unverified; this is provisional schedule analysis."] },
    lockedAssignments: workspace.lockedAssignments ?? [], realized: {}, opponent: null,
    evidence: { ...data.evidence, roster: { source: "Retained local roster", asOf: workspace.context.asOf, seasonId: workspace.context.seasonId, completeness: "partial", limitations: ["Yahoo has not verified this roster, its locks or player availability for the current analysis."] } },
  };
}
