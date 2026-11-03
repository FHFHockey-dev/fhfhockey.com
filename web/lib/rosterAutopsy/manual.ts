import { z } from "zod";

import { canEligibilityOccupySlot, normalizeEligibility } from "lib/rosterScheduleOptimizer/eligibility";
import { assignPlayersToActiveSlots } from "lib/rosterScheduleOptimizer/matching";
import { recentPointsPerGame } from "lib/rosterScheduleOptimizer/recentForm";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import type { PlanningWorkspace } from "lib/rosterScheduleOptimizer/planningTypes";
import type { ActiveSlotType, OptimizerPlayer } from "lib/rosterScheduleOptimizer/types";

export const SLOT_TYPES = ["C", "LW", "RW", "D", "G", "F", "W", "UTIL"] as const;
export const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;
export const MAX_PLAYERS = 100;
export const MAX_STARTING_SLOTS = 40;
export type Position = (typeof POSITIONS)[number];

const slotInputsSchema = z.object({
  C: z.string().max(3), LW: z.string().max(3), RW: z.string().max(3), D: z.string().max(3), G: z.string().max(3),
  F: z.string().max(3), W: z.string().max(3), UTIL: z.string().max(3),
}).strict();
const playerSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  team: z.string().max(80),
  eligibility: z.string().max(100),
  status: z.enum(["active", "bench", "IR", "IR+", "NA"]),
  recent: z.object({
    playerClass: z.enum(["skater", "goalie"]),
    games: z.number().int().min(1).max(10),
    stats: z.record(z.number().finite().nullable()),
  }).strict().nullable(),
}).strict();
const workspaceSchema = z.object({
  version: z.literal(1),
  slots: slotInputsSchema,
  slotsReviewed: z.boolean(),
  rosterReviewed: z.boolean(),
  players: z.array(playerSchema).max(MAX_PLAYERS),
  unresolved: z.array(z.string().max(200)).max(200),
  scoring: z.object({
    mode: z.enum(["points", "categories"]),
    weights: z.record(z.number().finite()),
    unsupported: z.array(z.string()),
  }).strict().nullable(),
}).strict();
export type ManualPlayer = z.infer<typeof playerSchema>;
export type ManualWorkspace = z.infer<typeof workspaceSchema>;

export function emptyWorkspace(): ManualWorkspace {
  return { version: 1, slots: { C: "0", LW: "0", RW: "0", D: "0", G: "0", F: "0", W: "0", UTIL: "0" },
    slotsReviewed: false, rosterReviewed: false, players: [], unresolved: [], scoring: null };
}

export function storageKey(principalId: string | null): string {
  return principalId ? `fhfh:roster-autopsy:v1:principal:${encodeURIComponent(principalId)}` : "fhfh:roster-autopsy:v1:anonymous";
}

/** Invalid or newer data is not silently replaced with a blank workspace. */
export function parseWorkspace(raw: string): ManualWorkspace | null {
  try {
    const parsed = workspaceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || new Set(parsed.data.players.map(player => player.id)).size !== parsed.data.players.length) return null;
    return parsed.data;
  } catch { return null; }
}

/** Read-only copy from the same principal's manual RSO workspace. No provider refresh or RSO write. */
export function copyManualRsoWorkspace(source: PlanningWorkspace): ManualWorkspace | null {
  if (source.context.provider !== "manual") return null;
  const workspace = emptyWorkspace();
  const rawCounts = Object.values(source.rules.rosterSlots);
  const countsSafe = rawCounts.every(count => Number.isSafeInteger(count) && count >= 0 && count <= 25)
    && rawCounts.reduce((sum, count) => sum + count, 0) <= 80;
  const expansion = countsSafe ? expandActiveSlots(source.rules.rosterSlots) : null;
  if (!expansion || expansion.diagnostics.some(diagnostic => diagnostic.severity === "error")) {
    workspace.unresolved.push("Some RSO slot rules could not be imported. Enter and review starting slots here.");
  } else {
    for (const slot of expansion.activeSlots) workspace.slots[slot.type] = String(Number(workspace.slots[slot.type]) + 1);
  }
  const byId = new Map<string, typeof source.manualPlayers>();
  for (const player of source.manualPlayers) byId.set(player.id, [...(byId.get(player.id) ?? []), player]);
  const seen = new Set<string>();
  for (const entry of source.roster) {
    if (seen.has(entry.playerId)) { workspace.unresolved.push(`Duplicate RSO roster entry: ${entry.playerId}`); continue; }
    seen.add(entry.playerId);
    const candidates = byId.get(entry.playerId) ?? [];
    if (candidates.length !== 1) {
      workspace.unresolved.push(candidates.length ? `Ambiguous RSO player details: ${entry.playerId}` : `RSO player details unavailable: ${entry.playerId}`);
      continue;
    }
    const player = candidates[0];
    const recent = player.recentTotals && player.recentTotals.games >= 1 && player.recentTotals.games <= 10
      ? { playerClass: player.playerClass, ...player.recentTotals } : null;
    const candidate = playerSchema.safeParse({ id: `rso:${player.id}`, name: player.name, team: player.teamAbbreviation ?? "",
      eligibility: player.eligiblePositions.join(", "), status: entry.position,
      recent });
    if (candidate.success) workspace.players.push(candidate.data);
    else workspace.unresolved.push(`RSO player details need review: ${entry.playerId}`);
  }
  workspace.unresolved.push(...source.unresolvedNames);
  workspace.scoring = { mode: source.rules.scoring.mode, weights: { ...source.rules.scoring.weights },
    unsupported: [...source.rules.unsupported] };
  // Both confirmations deliberately start false; imported data may be retained or stale.
  const result = workspaceSchema.safeParse(workspace);
  return result.success ? result.data : null;
}

export type RsoMergeCandidate = { player: ManualPlayer; status: "new" | "possible_duplicate" | "already_present" };

/** Names are only a warning, never an identity match; the manager can select a possible duplicate explicitly. */
export function rsoMergeCandidates(current: ManualWorkspace, source: ManualWorkspace): RsoMergeCandidate[] {
  const ids = new Set(current.players.map(player => player.id));
  const names = new Set(current.players.map(player => player.name.trim().toLocaleLowerCase()));
  const sourceCounts = new Map<string, number>();
  for (const player of source.players) {
    const key = player.name.trim().toLocaleLowerCase();
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  return source.players.map(player => {
    const key = player.name.trim().toLocaleLowerCase();
    return { player, status: ids.has(player.id) ? "already_present"
      : names.has(key) || (sourceCounts.get(key) ?? 0) > 1 ? "possible_duplicate" : "new" };
  });
}

function sameScoring(left: ManualWorkspace["scoring"], right: ManualWorkspace["scoring"]): boolean {
  if (!left || !right || left.mode !== right.mode) return false;
  const leftKeys = Object.keys(left.weights).sort(), rightKeys = Object.keys(right.weights).sort();
  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys)
    && leftKeys.every(key => left.weights[key] === right.weights[key])
    && JSON.stringify([...left.unsupported].sort()) === JSON.stringify([...right.unsupported].sort());
}

/** Merge only selected new identities. Existing players and scoring are never replaced. */
export function mergeManualRsoWorkspace(current: ManualWorkspace, source: ManualWorkspace,
  selectedIds: readonly string[], replaceSlots: boolean):
  | { ok: true; workspace: ManualWorkspace; added: number; unresolvedAdded: number; recentOmitted: boolean }
  | { ok: false; message: string } {
  const selected = new Set(selectedIds);
  const candidates = rsoMergeCandidates(current, source)
    .filter(candidate => candidate.status !== "already_present" && selected.has(candidate.player.id));
  if (current.players.length + candidates.length > MAX_PLAYERS) return { ok: false, message: `This workspace supports up to ${MAX_PLAYERS} players.` };
  if (replaceSlots && !parseSlotCounts(source.slots)) return { ok: false, message: "The RSO starting slots need review and cannot be copied." };
  const scoring = current.players.length === 0 && current.scoring === null && candidates.length ? source.scoring : current.scoring;
  const keepRecent = sameScoring(scoring, source.scoring);
  const recentOmitted = !keepRecent && candidates.some(candidate => candidate.player.recent !== null);
  const players = candidates.map(({ player }) => keepRecent ? player : { ...player, recent: null });
  const unresolved = [...current.unresolved];
  for (const item of source.unresolved) if (!unresolved.includes(item)) unresolved.push(item);
  if (unresolved.length > 200) return { ok: false, message: "Review some unresolved items before importing more." };
  const unresolvedAdded = unresolved.length - current.unresolved.length;
  return { ok: true, added: players.length, unresolvedAdded, recentOmitted, workspace: { ...current,
    players: [...current.players, ...players], unresolved, scoring,
    ...(replaceSlots ? { slots: { ...source.slots }, slotsReviewed: false } : {}),
    rosterReviewed: players.length || unresolvedAdded ? false : current.rosterReviewed } };
}

export function parseSlotCounts(inputs: ManualWorkspace["slots"]): Record<ActiveSlotType, number> | null {
  const counts = {} as Record<ActiveSlotType, number>;
  for (const type of SLOT_TYPES) {
    const value = inputs[type].trim();
    if (!/^\d+$/.test(value) || Number(value) > 25) return null;
    counts[type] = Number(value);
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return total > 0 && total <= MAX_STARTING_SLOTS ? counts : null;
}

/** A generic F/W/UTIL designation does not establish a specific fantasy position. */
function mayHaveUnspecifiedPosition(eligibility: ReturnType<typeof normalizeEligibility>, position: Position): boolean {
  if (!eligibility.valid || canEligibilityOccupySlot(eligibility, position)) return false;
  const values = new Set(eligibility.positions);
  return position === "D" ? values.has("UTIL")
    : position === "C" ? values.has("F") || values.has("UTIL")
      : position === "LW" || position === "RW" ? values.has("F") || values.has("W") || values.has("UTIL") : false;
}

export type PositionCoverage = {
  position: Position;
  eligible: ManualPlayer[];
  dedicatedSlots: number;
  usableSlotCount: number;
  uncertainPlayers: number;
  state: "needs_review" | "short" | "covered" | "flex_only" | "no_slot";
};

export function analyzeRoster(workspace: ManualWorkspace) {
  const counts = parseSlotCounts(workspace.slots);
  if (!counts || !workspace.slotsReviewed || !workspace.players.length) return null;
  const expansion = expandActiveSlots(counts);
  const available = workspace.players.filter(player => player.status === "active" || player.status === "bench");
  const evaluated = available.map(player => ({ player, eligibility: normalizeEligibility(player.eligibility) }));
  const invalid = evaluated.filter(item => !item.eligibility.valid);
  const valid = evaluated.filter(item => item.eligibility.valid);
  const incomplete = !workspace.rosterReviewed || workspace.unresolved.length > 0 || invalid.length > 0;
  const optimizerPlayers: OptimizerPlayer[] = valid.map(({ player }) => ({ id: player.id, name: player.name,
    teamAbbreviation: player.team || null, eligiblePositions: player.eligibility, value: 1 }));
  const match = assignPlayersToActiveSlots(optimizerPlayers, expansion.activeSlots);
  const positions: PositionCoverage[] = POSITIONS.map(position => {
    const eligible = valid.filter(item => canEligibilityOccupySlot(item.eligibility, position)).map(item => item.player);
    const unknownSpecific = valid.filter(item => mayHaveUnspecifiedPosition(item.eligibility, position)).length;
    const usableSlotCount = expansion.activeSlots.filter(slot => canEligibilityOccupySlot(normalizeEligibility(position), slot.type)).length;
    const dedicatedSlots = counts[position];
    const uncertainPlayers = invalid.length + unknownSpecific;
    const state: PositionCoverage["state"] = usableSlotCount === 0 ? "no_slot"
      : dedicatedSlots === 0 ? "flex_only"
        : incomplete || unknownSpecific ? "needs_review"
          : eligible.length < dedicatedSlots ? "short" : "covered";
    return { position, eligible, dedicatedSlots, usableSlotCount, uncertainPlayers, state };
  });
  const unknownSpecific = positions.some(position => position.dedicatedSlots > 0 && position.uncertainPlayers > 0);
  return { positions, assignments: match.assignment.assignments, totalSlots: expansion.activeSlots.length,
    available: available.length, excludedReserves: workspace.players.length - available.length,
    incomplete: incomplete || unknownSpecific, invalidPlayers: invalid.map(item => item.player) };
}

/** Retained RSO values are historical hints; they are never player grades or forecasts. */
export function retainedRecentPoints(player: ManualPlayer, scoring: ManualWorkspace["scoring"]): number | null {
  const eligibility = normalizeEligibility(player.eligibility);
  if (!player.recent || !scoring || scoring.unsupported.length || !eligibility.valid
    || eligibility.playerClass !== player.recent.playerClass) return null;
  return recentPointsPerGame({ playerClass: player.recent.playerClass, recentTotals: player.recent }, scoring);
}
