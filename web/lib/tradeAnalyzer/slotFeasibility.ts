import type { Result } from "lib/tradeValue/contracts";
import { analyzeRoster, emptyWorkspace, parseSlotCounts, POSITIONS, SLOT_TYPES, type ManualWorkspace, type PositionCoverage } from "lib/rosterAutopsy/manual";

import type { ManualPlayer, OfferInput, previewOffer, TeamId } from "./offer";

export type SlotEntry = { slots: ManualWorkspace["slots"]; slotsReviewed: boolean };
export type SlotIssue = { code: string; teamId?: TeamId; message: string };
export type PositionChange = {
  position: PositionCoverage["position"]; dedicatedSlots: number;
  filledBefore: number; filledAfter: number; eligibleBefore: number; eligibleAfter: number;
};
export type CoverageSnapshot = { totalSlots: number; filled: number; unfilled: number; excludedReserves: number;
  assignments: { playerName: string; slotType: string }[] };
export type IncomingStatus = { name: string; status: string };
export type TeamSlotFeasibility = {
  teamId: TeamId;
  incoming: IncomingStatus[];
  coverage: Result<{ before: CoverageSnapshot; after: CoverageSnapshot; positions: PositionChange[]; unfilledChange: number }>;
};

export const INCOMING_STATUS_NOTE = "Status carried from the sending manager's entry; reserve eligibility on the receiving roster unverified.";
// A Map cannot match inherited keys such as "__proto__" or "constructor".
const STATUSES = new Map<string, ManualWorkspace["players"][number]["status"]>([["active", "active"], ["bench", "bench"], ["ir", "IR"], ["ir+", "IR+"], ["na", "NA"]]);
const unavailable = <T>(...reasons: string[]): Result<T> => ({ status: "unavailable", reasons });

export function emptySlots(): ManualWorkspace["slots"] { return { C: "", LW: "", RW: "", D: "", G: "", F: "", W: "", UTIL: "" }; }

/** Maps manager-entered rows into the Roster Autopsy workspace; unknown status is reported, never defaulted. */
function toWorkspace(players: ManualPlayer[], slots: ManualWorkspace["slots"]) {
  const unknownStatus: string[] = [];
  const mapped = players.map(player => {
    const status = STATUSES.get(player.status.trim().toLocaleLowerCase());
    if (!status) unknownStatus.push(player.name || player.id);
    return { id: player.id, name: player.name, team: "", eligibility: player.positions, status: status ?? "NA", recent: null };
  });
  const workspace: ManualWorkspace = { ...emptyWorkspace(), slots, slotsReviewed: true, rosterReviewed: true, players: mapped };
  return { workspace, unknownStatus };
}

type Analysis = { totalSlots: number; excludedReserves: number; assignments: { playerId: string; slotType: string }[];
  positions: { position: PositionCoverage["position"]; dedicatedSlots: number; eligible: number }[] };

/** Caller guarantees reviewed, valid slot counts. A confirmed empty roster fills no slots; it is not missing input. */
function evaluate(players: ManualPlayer[], slots: ManualWorkspace["slots"], label: string): { reasons: string[]; result?: Analysis } {
  if (!players.length) {
    const counts = parseSlotCounts(slots)!;
    return { reasons: [], result: { totalSlots: SLOT_TYPES.reduce((sum, type) => sum + counts[type], 0), excludedReserves: 0, assignments: [],
      positions: POSITIONS.map(position => ({ position, dedicatedSlots: counts[position], eligible: 0 })) } };
  }
  const { workspace, unknownStatus } = toWorkspace(players, slots);
  const reasons = unknownStatus.length
    ? [`${label}: status must be active, bench, IR, IR+ or NA for ${unknownStatus.join(", ")}.`] : [];
  const result = analyzeRoster(workspace);
  if (!result) return { reasons: [...reasons, `${label}: starting slots could not be read.`] };
  if (result.invalidPlayers.length) reasons.push(`${label}: league positions are unknown for ${result.invalidPlayers.map(player => player.name).join(", ")}.`);
  const generic = result.positions.filter(row => row.dedicatedSlots > 0 && row.uncertainPlayers > result.invalidPlayers.length).map(row => row.position);
  if (generic.length) reasons.push(`${label}: generic F, W or UTIL positions leave ${generic.join(", ")} coverage unknown.`);
  return { reasons, result: { totalSlots: result.totalSlots, excludedReserves: result.excludedReserves, assignments: [...result.assignments],
    positions: result.positions.map(row => ({ position: row.position, dedicatedSlots: row.dedicatedSlots, eligible: row.eligible.length })) } };
}

const snapshot = (result: Analysis, players: ManualPlayer[]): CoverageSnapshot => ({
  totalSlots: result.totalSlots, filled: result.assignments.length, unfilled: result.totalSlots - result.assignments.length,
  excludedReserves: result.excludedReserves,
  assignments: result.assignments.map(assignment => ({ playerName: players.find(player => player.id === assignment.playerId)?.name ?? assignment.playerId, slotType: assignment.slotType })),
});

/**
 * Starting-slot coverage with reviewed positions, before and after the entered exchange and selected drops.
 * Structural only: no lock/timing legality, production, drop cost or value.
 */
export function slotFeasibility(input: OfferInput, preview: ReturnType<typeof previewOffer>, entries: [SlotEntry, SlotEntry]) {
  const issues: SlotIssue[] = [];
  const counts = entries.map(entry => parseSlotCounts(entry.slots));
  input.teams.forEach((team, index) => {
    if (!counts[index]) issues.push({ code: "slots_missing", teamId: team.id, message: `${team.name || team.id}: enter whole-number starting-slot counts (0–25 each, 1–40 total). No starting slots are assumed.` });
    else if (!entries[index].slotsReviewed) issues.push({ code: "slots_review", teamId: team.id, message: `${team.name || team.id}: review the starting-slot counts.` });
  });
  if (counts[0] && counts[1] && SLOT_TYPES.some(type => counts[0]![type] !== counts[1]![type])) {
    issues.push({ code: "slots_mismatch", message: "The two teams' starting-slot counts differ. Same-league teams usually share slots; each side is shown as entered." });
  }

  const teams: TeamSlotFeasibility[] = input.teams.map((team, index) => {
    const other = input.teams[1 - index];
    const incoming = other.roster.filter(player => other.givePlayerIds.includes(player.id)).map(player => ({ name: player.name, status: player.status || "Status unknown" }));
    const name = team.name || team.id;
    const after = preview.teams[index].after;
    if (!team.rosterReviewed) return { teamId: team.id, incoming, coverage: unavailable(`${name}: confirm the complete before-roster first.`) };
    if (!counts[index] || !entries[index].slotsReviewed) return { teamId: team.id, incoming, coverage: unavailable(`${name}: starting slots are missing or unreviewed. No starting slots are assumed.`) };
    // The after-roster includes the sender's entries, so it depends on the sender's roster review too.
    if (incoming.length && !other.rosterReviewed) return { teamId: team.id, incoming, coverage: unavailable(`${name} after: incoming players come from ${other.name || other.id}'s unreviewed roster. Review that roster before comparing coverage.`) };
    if (after.status === "unavailable") return { teamId: team.id, incoming, coverage: unavailable(...after.reasons) };
    const before = evaluate(team.roster, entries[index].slots, `${name} before`);
    const later = evaluate(after.value, entries[index].slots, `${name} after`);
    const reasons = [...before.reasons, ...later.reasons];
    if (reasons.length || !before.result || !later.result) return { teamId: team.id, incoming, coverage: unavailable(...reasons) };
    const b = before.result, a = later.result;
    const positions: PositionChange[] = b.positions.map((row, rowIndex) => ({ position: row.position, dedicatedSlots: row.dedicatedSlots,
      filledBefore: b.assignments.filter(item => item.slotType === row.position).length,
      filledAfter: a.assignments.filter(item => item.slotType === row.position).length,
      eligibleBefore: row.eligible, eligibleAfter: a.positions[rowIndex].eligible }));
    const beforeSnapshot = snapshot(b, team.roster), afterSnapshot = snapshot(a, after.value);
    return { teamId: team.id, incoming, coverage: { status: "available", value: { before: beforeSnapshot, after: afterSnapshot,
      positions, unfilledChange: afterSnapshot.unfilled - beforeSnapshot.unfilled } } };
  });
  return { issues, teams };
}
