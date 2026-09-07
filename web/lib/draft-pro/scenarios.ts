import { categoryAppliesToRole, isInvertedCategory } from "lib/scoring/categoryScores";
import type { DraftProDustResult } from "./dust";

export type ScenarioPlayer = Readonly<{
  id: string; name: string; role: "skater" | "goalie"; eligiblePositions: readonly string[];
  teamAbbreviation: string | null; projectionSeason: string; status?: "active" | "bench" | "ir" | "ir+" | "na" | "inactive";
  globalVorp: number; rankValue: number; projectedPoints?: number; available?: boolean; drafted?: boolean;
  categoryValues?: Readonly<Record<string, number | null | undefined>>;
}>;
export type ScenarioSource = Readonly<{
  projection: Readonly<{ id: string; version: string; origin: "server" | "saved_private_import"; privateImports?: readonly Readonly<{ id: string; contentFingerprint: string }>[] }>;
  schedule: Readonly<{ season: string; gameKey?: string; startWeek: number; endWeek: number; lineupMode: "daily" | "weekly"; rosterSlots: Readonly<Record<string, number>> }>;
}>;
export type ScenarioInput = Readonly<{ roster: readonly ScenarioPlayer[]; candidateA: ScenarioPlayer; candidateB: ScenarioPlayer; leagueType: "points" | "categories"; categoryWeights?: Readonly<Record<string, number>>; positionNeeds?: Readonly<Record<string, number>>; source: ScenarioSource }>;
export type ScenarioCategoryResult = Readonly<{ baseline: number | null; after: number | null; delta: number | null; direction: "higher" | "lower"; state: "available" | "missing" | "irrelevant" }>;
export type ScenarioResult = Readonly<{
  fingerprint: string;
  baseline: { rawVorp: number; projectedPoints: number | null; categories: Record<string, number | null> };
  schedule: { state: DraftProDustResult["state"] | "schedule_unavailable" | "not_requested"; freshness: DraftProDustResult["freshness"] | null; window: DraftProDustResult["window"] | null; diagnostics: readonly string[] };
  candidates: readonly ScenarioCandidateResult[];
}>;
export type ScenarioCandidateResult = Readonly<{
  id: string; name: string; rawVorpDelta: number; rawVorpAfter: number; projectedPointsDelta: number | null; projectedPointsAfter: number | null; positionNeeds: readonly string[];
  categories: Record<string, ScenarioCategoryResult>;
  dust: { activeGamesAdded: number | null; marginalBenchGames: number | null; unavailable: boolean; reason: string | null };
}>;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const ratioParts: Record<string, readonly [string, string]> = { SAVE_PERCENTAGE: ["SAVES_GOALIE", "SHOTS_AGAINST_GOALIE"], GOALS_AGAINST_AVERAGE: ["GOALS_AGAINST_GOALIE", "TOTAL_TOI"] };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
export function scenarioFingerprint(value: unknown) { const text = canonical(value); const hashes = [2166136261, 2246822507, 3266489909, 668265263].map((seed) => { let hash = seed; for (const character of text) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, "0"); }); return `scenario-v1-${hashes.join("")}`; }
function values(player: ScenarioPlayer) { return player.categoryValues ?? {}; }
function applicable(players: readonly ScenarioPlayer[], key: string) { return players.filter((player) => categoryAppliesToRole(key, player.role)); }
function sum(players: readonly ScenarioPlayer[], key: string): number | null { const selected = applicable(players, key); if (!selected.length) return 0; const found = selected.map((player) => values(player)[key]); if (found.some((value) => !finite(value))) return null; return (found as number[]).reduce((total, value) => total + value, 0); }
function categoryTotal(players: readonly ScenarioPlayer[], key: string): number | null {
  const ratio = ratioParts[key]; if (!ratio) return sum(players, key);
  const selected = applicable(players, key); if (!selected.length) return null;
  const rows = selected.map((player) => [values(player)[ratio[0]], values(player)[ratio[1]]] as const);
  if (rows.some(([numerator, denominator]) => !finite(numerator) || !finite(denominator) || numerator < 0 || denominator <= 0 || (key === "SAVE_PERCENTAGE" && numerator > denominator))) return null;
  const numerator = rows.reduce((total, row) => total + (row[0] as number), 0); const denominator = rows.reduce((total, row) => total + (row[1] as number), 0);
  return key === "GOALS_AGAINST_AVERAGE" ? numerator * 3600 / denominator : numerator / denominator;
}
function pointsTotal(players: readonly ScenarioPlayer[]) { if (!players.length) return 0; const all = players.map((player) => player.projectedPoints); return all.every(finite) ? all.reduce((total, value) => total + (value as number), 0) : null; }
function serializable(player: ScenarioPlayer) { return { ...player, eligiblePositions: [...player.eligiblePositions].sort(), categoryValues: values(player) }; }

export type ScenarioDustResult = DraftProDustResult | Readonly<{ state: "schedule_unavailable"; freshness: DraftProDustResult["freshness"]; window: DraftProDustResult["window"]; baseline: null; insights: readonly []; diagnostics: readonly string[] }>;
export function compareDraftProScenarios(input: ScenarioInput, dust: ScenarioDustResult | null = null): ScenarioResult {
  if (input.candidateA.id === input.candidateB.id) throw new Error("Choose two distinct candidates.");
  const rosterIds = new Set(input.roster.map((player) => player.id));
  for (const candidate of [input.candidateA, input.candidateB]) if (rosterIds.has(candidate.id) || candidate.drafted || candidate.available === false) throw new Error("Candidates must be available players outside the current roster.");
  const keys = Object.keys(input.categoryWeights ?? {}).filter((key) => finite(input.categoryWeights?.[key]) && input.categoryWeights?.[key] !== 0);
  const fingerprint = scenarioFingerprint({ roster: input.roster.map(serializable).sort((a, b) => a.id.localeCompare(b.id)), candidates: [input.candidateA, input.candidateB].map(serializable).sort((a, b) => a.id.localeCompare(b.id)), leagueType: input.leagueType, categoryWeights: input.categoryWeights ?? {}, positionNeeds: input.positionNeeds ?? {}, source: input.source, scheduleAnalysis: dust });
  const baselineCategories = Object.fromEntries(keys.map((key) => [key, categoryTotal(input.roster, key)]));
  const baseline = { rawVorp: input.roster.reduce((total, player) => total + player.globalVorp, 0), projectedPoints: pointsTotal(input.roster), categories: baselineCategories };
  const makeCandidate = (candidate: ScenarioPlayer): ScenarioCandidateResult => {
    const afterRoster = [...input.roster, candidate]; const afterPoints = pointsTotal(afterRoster); const insight = dust?.state === "ready" ? dust.insights.find((item) => item.playerId === candidate.id) : undefined;
    const categories: Record<string, ScenarioCategoryResult> = Object.fromEntries(keys.map((key) => { const baselineValue = baselineCategories[key] ?? null; if (!categoryAppliesToRole(key, candidate.role)) return [key, { baseline: baselineValue, after: baselineValue, delta: 0, direction: isInvertedCategory(key) ? "lower" as const : "higher" as const, state: "irrelevant" as const }]; const after = categoryTotal(afterRoster, key); return [key, { baseline: baselineValue, after, delta: baselineValue === null || after === null ? null : after - baselineValue, direction: isInvertedCategory(key) ? "lower" as const : "higher" as const, state: baselineValue === null || after === null ? "missing" as const : "available" as const }]; }));
    return { id: candidate.id, name: candidate.name, rawVorpDelta: candidate.globalVorp, rawVorpAfter: baseline.rawVorp + candidate.globalVorp, projectedPointsDelta: baseline.projectedPoints === null || afterPoints === null ? null : afterPoints - baseline.projectedPoints, projectedPointsAfter: afterPoints, positionNeeds: candidate.eligiblePositions.filter((position) => (input.positionNeeds?.[position] ?? 0) > 0), categories, dust: { activeGamesAdded: insight?.activeGamesAdded ?? null, marginalBenchGames: insight?.marginalBenchGames ?? null, unavailable: !insight, reason: insight ? null : dust?.diagnostics[0] ?? "Schedule analysis is unavailable." } };
  };
  return { fingerprint, baseline, schedule: { state: dust?.state ?? "not_requested", freshness: dust?.freshness ?? null, window: dust?.window ?? null, diagnostics: dust?.diagnostics ?? [] }, candidates: [makeCandidate(input.candidateA), makeCandidate(input.candidateB)] };
}
export function scenarioIsStale(savedFingerprint: string, input: ScenarioInput, dust: ScenarioDustResult | null = null) { return savedFingerprint !== compareDraftProScenarios(input, dust).fingerprint; }
