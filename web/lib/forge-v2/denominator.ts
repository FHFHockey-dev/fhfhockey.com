/**
 * FORGE Full-NHL H1–H10 denominator. Every NHL-affiliated skater and goalie (roster, IR/LTIR, reserve, recalled) has
 * one key for each of their team's next ten issuable scheduled games, with the as-issued team. This module is a
 * ledger and a frozen artifact only. It issues nothing and does not change the v2 skater product's defaults.
 *
 * Membership precedence, at a cutoff `asOf` (evidence first received after it does not exist yet):
 *  1. An official transaction outranks a roster snapshot of the same or earlier effective time.
 *  2. A later roster snapshot that agrees with the latest transaction's team refines it (for example to IR status).
 *  3. A later roster snapshot that disagrees does not move the player. It is listed as `roster_contradicts_transaction`
 *     (the stale-roster failure from Astra's 2026-11-23 audit, where Larkin was still issued on Detroit).
 *  4. Transactions at the same effective time that disagree, with none superseding the others, are unresolved.
 *  5. With no transaction, the v2 rule applies to snapshots: latest wins, and same-clock disagreement is unresolved.
 * Game-level participation (healthy scratch, injury, suspension) never removes a key. Injury gates lineup
 * contribution only.
 */
import { Affiliation, Horizon, Instant, ScheduleGame, SourceReference, assertId, assertSource, instant } from "./contracts";
import { canonicalJson } from "./identity";
import { contentHash } from "./hash.server";
import { latestAffiliations, resolveSchedule } from "./schedule";

export const DENOMINATOR_VERSION = "forge-full-nhl-h10-denominator-v1" as const;
export const DENOMINATOR_HORIZONS = 10;
export type PlayerClass = "skater" | "goalie";
export type TransactionType = "trade" | "waiver_claim" | "signing" | "recall" | "assignment" | "ir_placement" | "ltir_placement" | "ir_activation";
const TRANSACTION_STATUS: Record<TransactionType, Affiliation["status"]> = {
  trade: "roster", waiver_claim: "roster", signing: "roster", recall: "roster", assignment: "assigned",
  ir_placement: "injury_reserve", ltir_placement: "injury_reserve", ir_activation: "roster",
};

/** One dated membership observation. `effectiveAt` and the source clocks are required and pinned. A snapshot's
 * effective time is when that roster page was true (normally its `observedAt`). A transaction's is the league's
 * official effective time. */
export interface MembershipEvidence extends Affiliation {
  kind: "roster_snapshot" | "official_transaction";
  /** Required for `official_transaction`; null for snapshots. */
  transactionType: TransactionType | null;
  /** A corrected transaction names the revision it replaces; the replaced row stops counting. */
  supersedesRevision: string | null;
}

export interface ParticipationEvidence {
  playerId: number;
  gameId: number;
  state: "healthy_scratch" | "injured" | "day_to_day" | "suspended";
  source: SourceReference;
}

export type MembershipBasis = "roster_snapshot" | "official_transaction" | "transaction_confirmed_by_roster"
  | "receipt_official_roster" | "receipt_trade_reconciliation";

export interface DenominatorKey {
  playerId: number;
  playerClass: PlayerClass;
  teamId: number;
  gameId: number;
  seasonId: number;
  horizon: Horizon;
  opponentId: number | null;
  home: boolean | null;
  scheduledStartAt: Instant | null;
  membershipStatus: Affiliation["status"] | null;
  membershipBasis: MembershipBasis;
  membershipEffectiveAt: Instant | null;
  membershipFirstReceivedAt: Instant | null;
  affiliationRevision: string | null;
  scheduleRevision: string | null;
}

export interface MembershipIssue { playerId: number; reason: string; teamIds: number[]; revisions: string[] }

export interface DenominatorBody {
  version: typeof DENOMINATOR_VERSION;
  evidenceClass: "fixture" | "audit_receipt_reconstruction" | "prospective_shadow";
  asOf: Instant | null;
  seasonId: number;
  orderingBasis: "scheduled_start" | "receipt_team_horizon";
  inputs: Array<{ name: string; sha256: string; rows: number }>;
  keys: DenominatorKey[];
  counts: {
    players: number; keys: number; expectedKeys: number;
    byClass: Array<{ playerClass: PlayerClass; players: number; keys: number }>;
    byHorizon: Array<{ horizon: Horizon; skaters: number; goalies: number }>;
    byTeamHorizon: Array<{ teamId: number; horizon: Horizon; skaters: number; goalies: number }>;
    unresolved: number; conflicts: number; outOfScope: number; shortfallPlayers: number;
  };
  unresolved: MembershipIssue[];
  conflicts: MembershipIssue[];
  outOfScope: MembershipIssue[];
  shortfalls: Array<{ playerId: number; teamId: number; count: number; reason: string }>;
  excludedGames: Array<{ gameId: number; reason: string; replacementGameId: number | null }>;
  participation: Array<{ playerId: number; gameId: number; state: ParticipationEvidence["state"]; revision: string }>;
  limitations: string[];
}
export interface FrozenDenominator extends DenominatorBody { denominatorSha256: string }

const byCanonical = <T>(rows: readonly T[]) => [...rows].sort((a, b) => { const x = canonicalJson(a), y = canonicalJson(b); return x < y ? -1 : x > y ? 1 : 0; });
const classOf = (position: Affiliation["position"]): PlayerClass => position === "G" ? "goalie" : "skater";

function assertEvidence(row: MembershipEvidence): void {
  if (row.kind === "official_transaction") {
    if (!row.transactionType || !(row.transactionType in TRANSACTION_STATUS)) throw new Error("Official transaction requires a transaction type");
    if (TRANSACTION_STATUS[row.transactionType] !== row.status) throw new Error(`Transaction ${row.transactionType} must carry status ${TRANSACTION_STATUS[row.transactionType]}`);
  } else if (row.kind !== "roster_snapshot" || row.transactionType !== null || row.supersedesRevision !== null) throw new Error("Roster snapshots carry no transaction fields");
  instant(row.effectiveAt);
}

export interface ResolvedMembership {
  members: Array<{ affiliation: Affiliation; basis: MembershipBasis }>;
  unresolved: MembershipIssue[];
  conflicts: MembershipIssue[];
  outOfScope: MembershipIssue[];
}

/** Applies the precedence rule above. Pure; evidence first received after `asOf` is ignored entirely. */
export function resolveMembership(evidence: readonly MembershipEvidence[], asOf: Instant): ResolvedMembership {
  const cutoff = instant(asOf);
  evidence.forEach(assertEvidence);
  const admitted = evidence.filter(row => instant(row.source.firstReceivedAt) <= cutoff && instant(row.effectiveAt) <= cutoff);
  const superseded = new Set(admitted.filter(row => row.kind === "official_transaction" && row.supersedesRevision).map(row => `${row.playerId}:${row.supersedesRevision}`));
  const transactions = admitted.filter(row => row.kind === "official_transaction" && !superseded.has(`${row.playerId}:${row.revision}`));
  const snapshots = admitted.filter(row => row.kind === "roster_snapshot");
  const latestTx = new Map(latestAffiliations(transactions, asOf).map(entry => [entry.playerId, entry]));
  const latestSnap = new Map(latestAffiliations(snapshots, asOf).map(entry => [entry.playerId, entry]));
  const players = [...new Set(admitted.map(row => row.playerId))].sort((a, b) => a - b);
  const out: ResolvedMembership = { members: [], unresolved: [], conflicts: [], outOfScope: [] };
  const issue = (playerId: number, reason: string, rows: readonly Affiliation[]): MembershipIssue => ({
    playerId, reason,
    teamIds: [...new Set(rows.map(row => row.teamId).filter((id): id is number => id !== null))].sort((a, b) => a - b),
    revisions: [...new Set(rows.map(row => row.revision))].sort(),
  });
  for (const playerId of players) {
    const tx = latestTx.get(playerId), snap = latestSnap.get(playerId);
    const playerTx = transactions.filter(row => row.playerId === playerId);
    if (tx && !tx.row) { out.unresolved.push(issue(playerId, tx.reason === "conflicting_affiliation" ? "conflicting_transactions" : "unverified_transaction", playerTx)); continue; }
    let chosen: Affiliation, basis: MembershipBasis;
    if (tx?.row) {
      const top = playerTx.filter(row => row.effectiveAt === tx.row!.effectiveAt);
      if (new Set(top.map(row => canonicalJson([row.teamId, row.status, row.position]))).size > 1) { out.unresolved.push(issue(playerId, "conflicting_transactions", top)); continue; }
      chosen = tx.row; basis = "official_transaction";
      if (snap && !snap.row) out.conflicts.push(issue(playerId, `roster_${snap.reason}_after_transaction`, snapshots.filter(row => row.playerId === playerId)));
      else if (snap?.row && instant(snap.row.effectiveAt) > instant(tx.row.effectiveAt)) {
        if (snap.row.teamId === tx.row.teamId) { chosen = snap.row; basis = "transaction_confirmed_by_roster"; }
        else out.conflicts.push(issue(playerId, "roster_contradicts_transaction", [tx.row, snap.row]));
      }
      // A transaction that omits position inherits it from the player's latest roster snapshot.
      if (chosen.position === "unknown" && snap?.row && snap.row.position !== "unknown") chosen = { ...chosen, position: snap.row.position };
    } else if (snap?.row) { chosen = snap.row; basis = "roster_snapshot"; }
    else { out.unresolved.push(issue(playerId, snap?.reason ?? "no_admissible_evidence", snapshots.filter(row => row.playerId === playerId))); continue; }
    if (chosen.status === "assigned") { out.outOfScope.push(issue(playerId, "assigned", [chosen])); continue; }
    if (chosen.teamId === null || chosen.position === "unknown" || chosen.status === "unresolved") { out.unresolved.push(issue(playerId, "unresolved_affiliation", [chosen])); continue; }
    out.members.push({ affiliation: structuredClone(chosen), basis });
  }
  return out;
}

function tally(keys: readonly DenominatorKey[]): DenominatorBody["counts"]["byTeamHorizon"] {
  const cells = new Map<string, { teamId: number; horizon: Horizon; skaters: number; goalies: number }>();
  for (const key of keys) {
    const id = `${key.teamId}:${key.horizon}`;
    const cell = cells.get(id) ?? { teamId: key.teamId, horizon: key.horizon, skaters: 0, goalies: 0 };
    if (key.playerClass === "goalie") cell.goalies += 1; else cell.skaters += 1;
    cells.set(id, cell);
  }
  return [...cells.values()].sort((a, b) => a.teamId - b.teamId || a.horizon - b.horizon);
}

const sortKeys = (keys: DenominatorKey[]) => keys.sort((a, b) => a.teamId - b.teamId || a.horizon - b.horizon || a.playerId - b.playerId);
const sortIssues = (rows: MembershipIssue[]) => rows.sort((a, b) => a.playerId - b.playerId || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));

/** Seals a body: canonical ordering, counts, and the sha256 over everything else. The same inputs give the same bytes. */
export function freezeDenominator(body: Omit<DenominatorBody, "counts" | "version">): FrozenDenominator {
  const keys = sortKeys(structuredClone(body.keys));
  const seen = new Set<string>();
  for (const key of keys) {
    assertId(key.playerId); assertId(key.gameId); assertId(key.teamId);
    if (!/^20\d{2}0[1-4]\d{4}$/.test(String(key.gameId))) throw new Error(`Inexact NHL game id ${key.gameId}`);
    const id = `${key.playerId}:${key.gameId}`;
    if (seen.has(id)) throw new Error(`Duplicate player/game key ${id}`);
    seen.add(id);
  }
  const playerClasses = new Map(keys.map(key => [key.playerId, key.playerClass]));
  const byClass = (["goalie", "skater"] as const).map(playerClass => ({ playerClass, players: [...playerClasses.values()].filter(c => c === playerClass).length, keys: keys.filter(key => key.playerClass === playerClass).length }));
  const byHorizon = Array.from({ length: DENOMINATOR_HORIZONS }, (_, i) => (i + 1) as Horizon).map(horizon => ({ horizon, skaters: keys.filter(key => key.horizon === horizon && key.playerClass === "skater").length, goalies: keys.filter(key => key.horizon === horizon && key.playerClass === "goalie").length }));
  const sealed: DenominatorBody = {
    version: DENOMINATOR_VERSION,
    evidenceClass: body.evidenceClass, asOf: body.asOf, seasonId: body.seasonId, orderingBasis: body.orderingBasis,
    inputs: [...body.inputs].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    keys,
    counts: {
      players: playerClasses.size, keys: keys.length, expectedKeys: playerClasses.size * DENOMINATOR_HORIZONS,
      byClass, byHorizon, byTeamHorizon: tally(keys),
      unresolved: body.unresolved.length, conflicts: body.conflicts.length, outOfScope: body.outOfScope.length, shortfallPlayers: body.shortfalls.length,
    },
    unresolved: sortIssues(structuredClone(body.unresolved)),
    conflicts: sortIssues(structuredClone(body.conflicts)),
    outOfScope: sortIssues(structuredClone(body.outOfScope)),
    shortfalls: [...body.shortfalls].sort((a, b) => a.playerId - b.playerId),
    excludedGames: [...body.excludedGames].sort((a, b) => a.gameId - b.gameId),
    participation: [...body.participation].sort((a, b) => a.playerId - b.playerId || a.gameId - b.gameId || (a.revision < b.revision ? -1 : 1)),
    limitations: [...new Set(body.limitations)].sort(),
  };
  return { ...sealed, denominatorSha256: contentHash(sealed) };
}

export function serializeDenominator(artifact: FrozenDenominator): string {
  const { denominatorSha256, ...body } = artifact;
  if (contentHash(body) !== denominatorSha256) throw new Error("Denominator hash mismatch");
  return `${canonicalJson(artifact)}\n`;
}

export interface DenominatorInput {
  evidence: readonly MembershipEvidence[];
  schedule: readonly ScheduleGame[];
  participation?: readonly ParticipationEvidence[];
  asOf: Instant;
  seasonId: number;
  scheduleComplete: boolean;
  evidenceClass: "fixture" | "prospective_shadow";
}

/** Builds the frozen denominator from dated evidence. Input hashes cover only evidence admitted at `asOf`, so evidence
 * that arrives later cannot change a denominator already frozen for an earlier cutoff. */
export function buildDenominator(input: DenominatorInput): FrozenDenominator {
  const cutoff = instant(input.asOf);
  const membership = resolveMembership(input.evidence, input.asOf);
  const { games, excludedGames } = resolveSchedule(input.schedule, input.asOf, input.seasonId);
  const keys: DenominatorKey[] = [], shortfalls: DenominatorBody["shortfalls"] = [];
  for (const { affiliation, basis } of membership.members) {
    const teamId = affiliation.teamId!;
    const next = games.filter(game => game.homeTeamId === teamId || game.awayTeamId === teamId).slice(0, DENOMINATOR_HORIZONS);
    if (next.length < DENOMINATOR_HORIZONS) shortfalls.push({ playerId: affiliation.playerId, teamId, count: next.length, reason: input.scheduleComplete ? "verified_schedule_exhausted" : "schedule_capture_incomplete" });
    next.forEach((game, index) => {
      const home = game.homeTeamId === teamId;
      keys.push({
        playerId: affiliation.playerId, playerClass: classOf(affiliation.position), teamId, gameId: game.gameId, seasonId: game.seasonId,
        horizon: (index + 1) as Horizon, opponentId: home ? game.awayTeamId : game.homeTeamId, home, scheduledStartAt: game.scheduledStartAt,
        membershipStatus: affiliation.status, membershipBasis: basis, membershipEffectiveAt: affiliation.effectiveAt,
        membershipFirstReceivedAt: affiliation.source.firstReceivedAt, affiliationRevision: affiliation.revision, scheduleRevision: game.revision,
      });
    });
  }
  const keyIds = new Set(keys.map(key => `${key.playerId}:${key.gameId}`));
  const notes = (input.participation ?? []).filter(row => instant(row.source.firstReceivedAt) <= cutoff);
  notes.forEach(row => assertSource(row.source, input.asOf));
  const admittedEvidence = input.evidence.filter(row => instant(row.source.firstReceivedAt) <= cutoff);
  const admittedSchedule = input.schedule.filter(row => row.seasonId === input.seasonId && instant(row.source.firstReceivedAt) <= cutoff);
  return freezeDenominator({
    evidenceClass: input.evidenceClass, asOf: input.asOf, seasonId: input.seasonId, orderingBasis: "scheduled_start",
    inputs: [
      { name: "membership_evidence", sha256: contentHash(byCanonical(admittedEvidence)), rows: admittedEvidence.length },
      { name: "participation_evidence", sha256: contentHash(byCanonical(notes)), rows: notes.length },
      { name: "schedule", sha256: contentHash(byCanonical(admittedSchedule)), rows: admittedSchedule.length },
    ],
    keys, unresolved: membership.unresolved, conflicts: membership.conflicts, outOfScope: membership.outOfScope, shortfalls, excludedGames,
    participation: notes.filter(row => keyIds.has(`${row.playerId}:${row.gameId}`)).map(row => ({ playerId: row.playerId, gameId: row.gameId, state: row.state, revision: row.source.revision })),
    limitations: input.scheduleComplete ? [] : ["schedule_capture_incomplete"],
  });
}

/** Keys opened, closed and kept between two frozen denominators. Earlier artifacts are inputs only and are never
 * edited, so a closed key keeps its original team, horizon and clocks. */
export function reconcileDenominators(previous: FrozenDenominator, current: FrozenDenominator) {
  const id = (key: DenominatorKey) => `${key.playerId}:${key.gameId}:${key.teamId}`;
  const before = new Map(previous.keys.map(key => [id(key), key])), after = new Map(current.keys.map(key => [id(key), key]));
  return {
    closed: previous.keys.filter(key => !after.has(id(key))),
    opened: current.keys.filter(key => !before.has(id(key))),
    kept: current.keys.filter(key => before.has(id(key))).length,
  };
}

/** Numeric core fields per class. A forecast covers a key only if every core value is a finite number. */
export const CORE_FIELDS: Record<PlayerClass, readonly string[]> = {
  skater: ["G", "A", "PPP", "SOG", "HIT", "BLK"],
  goalie: ["SAVES", "SHOTS_AGAINST", "GOALS_ALLOWED", "WIN", "SHUTOUT"],
};
export interface ForecastRow { playerId: number; gameId: number; teamId: number; issuedAt: Instant; runId: string; values: Record<string, number | null> }

/** Coverage over a frozen denominator. It is separate from the denominator hash and counts numeric forecasts only. */
export function measureCoverage(denominator: FrozenDenominator, forecasts: readonly ForecastRow[]) {
  const keys = new Map(denominator.keys.map(key => [`${key.playerId}:${key.gameId}`, key]));
  const numeric = new Set<string>(), nonNumeric = new Set<string>();
  const stray: Array<{ playerId: number; gameId: number; teamId: number; runId: string; reason: string }> = [];
  for (const row of forecasts) {
    const id = `${row.playerId}:${row.gameId}`, key = keys.get(id);
    if (!key) { stray.push({ playerId: row.playerId, gameId: row.gameId, teamId: row.teamId, runId: row.runId, reason: "no_denominator_key" }); continue; }
    if (key.teamId !== row.teamId) { stray.push({ playerId: row.playerId, gameId: row.gameId, teamId: row.teamId, runId: row.runId, reason: "team_mismatch" }); continue; }
    if (denominator.asOf !== null && instant(row.issuedAt) < instant(denominator.asOf)) { stray.push({ playerId: row.playerId, gameId: row.gameId, teamId: row.teamId, runId: row.runId, reason: "issued_before_denominator" }); continue; }
    const complete = CORE_FIELDS[key.playerClass].every(field => typeof row.values[field] === "number" && Number.isFinite(row.values[field]));
    (complete ? numeric : nonNumeric).add(id);
  }
  for (const id of numeric) nonNumeric.delete(id);
  const perPlayer = new Map<number, number>();
  for (const id of numeric) { const playerId = keys.get(id)!.playerId; perPlayer.set(playerId, (perPlayer.get(playerId) ?? 0) + 1); }
  const byHorizon = Array.from({ length: DENOMINATOR_HORIZONS }, (_, i) => (i + 1) as Horizon).map(horizon => {
    const ids = denominator.keys.filter(key => key.horizon === horizon).map(key => `${key.playerId}:${key.gameId}`);
    return { horizon, expected: ids.length, numeric: ids.filter(id => numeric.has(id)).length, nonNumeric: ids.filter(id => nonNumeric.has(id)).length };
  });
  return {
    denominatorSha256: denominator.denominatorSha256, expected: denominator.keys.length, numeric: numeric.size, nonNumeric: nonNumeric.size,
    missing: denominator.keys.length - numeric.size - nonNumeric.size,
    playersWithAllTen: [...perPlayer.values()].filter(count => count === DENOMINATOR_HORIZONS).length,
    byHorizon, stray: stray.sort((a, b) => a.playerId - b.playerId || a.gameId - b.gameId || (a.runId < b.runId ? -1 : 1)),
  };
}

