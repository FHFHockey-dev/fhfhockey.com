/**
 * Labelled adapter: Astra's 2026-11-23 audit receipts → a frozen Full-NHL H1–H10 denominator. The receipts hold
 * membership basis, team, class, ordered horizon and exact NHL game id. They hold no per-row clocks, no home/away and
 * no start times. Those fields stay null here and nothing is inferred. The dated ledger (`buildDenominator`) is the
 * production path once roster clocks, an official transaction feed and the full schedule are captured.
 */
import { Horizon, assertHorizon } from "./contracts";
import { DENOMINATOR_HORIZONS, DenominatorKey, FrozenDenominator, MembershipIssue, freezeDenominator } from "./denominator";

export interface ReceiptKeyRow { basis: string; teamId: number; playerId: number; playerClass: "S" | "G"; horizon: Horizon; gameId: number; writer: string }
const HEADER = "affiliation_basis,team_id,player_id,player_class,team_horizon,nhl_game_id,writer";

export function parseReceiptKeys(text: string): ReceiptKeyRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.length > 0);
  if (lines[0] !== HEADER) throw new Error("Unexpected receipt key header");
  return lines.slice(1).map((line, index) => {
    const cells = line.split(",");
    if (cells.length !== 7) throw new Error(`Malformed receipt row ${index + 2}`);
    const [basis, team, player, playerClass, horizon, game, writer] = cells;
    const row = { basis, teamId: Number(team), playerId: Number(player), playerClass: playerClass as "S" | "G", horizon: Number(horizon) as Horizon, gameId: Number(game), writer };
    if (!["S", "G"].includes(row.playerClass) || !Number.isSafeInteger(row.teamId) || !Number.isSafeInteger(row.playerId) || !Number.isSafeInteger(row.gameId)) throw new Error(`Malformed receipt row ${index + 2}`);
    assertHorizon(row.horizon);
    return row;
  });
}

function teamSchedules(rows: readonly ReceiptKeyRow[]) {
  const schedule = new Map<number, Map<number, number>>();
  for (const row of rows) {
    const team = schedule.get(row.teamId) ?? new Map<number, number>();
    const known = team.get(row.horizon);
    if (known !== undefined && known !== row.gameId) throw new Error(`Team ${row.teamId} H${row.horizon} names two games`);
    team.set(row.horizon, row.gameId); schedule.set(row.teamId, team);
  }
  return schedule;
}

export interface ReceiptDenominatorInput {
  /** The trade-reconciled floor (`trade-reconciled-keys.csv`). */
  reconciled: readonly ReceiptKeyRow[];
  /** Astra's raw enumeration (`player-game-keys.csv`), including stale `other` roster rows. */
  enumerated: readonly ReceiptKeyRow[];
  inputs: Array<{ name: string; sha256: string; rows: number }>;
  seasonId: number;
}

export function receiptDenominator(input: ReceiptDenominatorInput): FrozenDenominator {
  const schedule = teamSchedules([...input.reconciled, ...input.enumerated]);
  const teamsByGame = new Map<number, Set<number>>();
  for (const [teamId, games] of schedule) for (const gameId of games.values()) teamsByGame.set(gameId, (teamsByGame.get(gameId) ?? new Set()).add(teamId));
  for (const [gameId, teams] of teamsByGame) if (teams.size > 2) throw new Error(`Game ${gameId} has ${teams.size} teams`);
  const keys: DenominatorKey[] = [];
  const floor = new Map<number, ReceiptKeyRow[]>();
  for (const row of input.reconciled) floor.set(row.playerId, [...(floor.get(row.playerId) ?? []), row]);
  const shortfalls: Array<{ playerId: number; teamId: number; count: number; reason: string }> = [];
  for (const [playerId, rows] of floor) {
    const teams = new Set(rows.map(row => row.teamId)), classes = new Set(rows.map(row => row.playerClass)), bases = new Set(rows.map(row => row.basis));
    if (teams.size !== 1 || classes.size !== 1 || bases.size !== 1) throw new Error(`Player ${playerId} has mixed receipt membership`);
    if (rows.length < DENOMINATOR_HORIZONS) shortfalls.push({ playerId, teamId: rows[0].teamId, count: rows.length, reason: "receipt_schedule_exhausted" });
    for (const row of rows) {
      const others = [...(teamsByGame.get(row.gameId) ?? [])].filter(team => team !== row.teamId);
      keys.push({
        playerId, playerClass: row.playerClass === "G" ? "goalie" : "skater", teamId: row.teamId, gameId: row.gameId, seasonId: input.seasonId,
        horizon: row.horizon, opponentId: others.length === 1 ? others[0] : null, home: null, scheduledStartAt: null, membershipStatus: null,
        membershipBasis: row.basis === "official" ? "receipt_official_roster" : "receipt_trade_reconciliation",
        membershipEffectiveAt: null, membershipFirstReceivedAt: null, affiliationRevision: row.basis, scheduleRevision: null,
      });
    }
  }
  const enumeratedTeam = new Map<number, { teamId: number; basis: string }>();
  for (const row of input.enumerated) enumeratedTeam.set(row.playerId, { teamId: row.teamId, basis: row.basis });
  const unresolved: MembershipIssue[] = [], conflicts: MembershipIssue[] = [];
  for (const [playerId, seen] of enumeratedTeam) {
    const kept = floor.get(playerId)?.[0];
    if (!kept) unresolved.push({ playerId, reason: seen.basis === "official" ? "official_roster_dropped_by_receipt" : "roster_not_officially_seen_at_audit", teamIds: [seen.teamId], revisions: [seen.basis] });
    else if (kept.teamId !== seen.teamId) conflicts.push({ playerId, reason: "receipt_roster_contradicts_trade", teamIds: [seen.teamId, kept.teamId].sort((a, b) => a - b), revisions: [seen.basis, kept.basis].sort() });
  }
  return freezeDenominator({
    evidenceClass: "audit_receipt_reconstruction", asOf: null, seasonId: input.seasonId, orderingBasis: "receipt_team_horizon",
    inputs: input.inputs, keys, unresolved, conflicts, outOfScope: [], shortfalls, excludedGames: [], participation: [],
    limitations: [
      "receipt_clocks_absent:effective_and_first_received_times_not_in_receipts",
      "receipt_home_and_start_time_absent:only_horizon_ordinals_from_enumeration_sql",
      "receipt_membership_status_absent:roster_ir_reserve_not_distinguished",
      "receipt_trade_effective_time_date_only:club_trade_2026-11-22",
      "receipt_assigned_players_not_enumerated:outOfScope_unknown",
    ],
  });
}

/** Astra's stored-row classification (`writer` column) over the floor, by horizon and class. It is reported beside
 * the denominator and is not recomputed coverage; the receipts carry no forecast values. */
export function receiptStoredRows(reconciled: readonly ReceiptKeyRow[]) {
  return Array.from({ length: DENOMINATOR_HORIZONS }, (_, i) => (i + 1) as Horizon).map(horizon => {
    const rows = reconciled.filter(row => row.horizon === horizon);
    const stored = (cls: "S" | "G") => rows.filter(row => row.playerClass === cls && row.writer !== "missing").length;
    return { horizon, skaters: rows.filter(row => row.playerClass === "S").length, goalies: rows.filter(row => row.playerClass === "G").length, storedSkaters: stored("S"), storedGoalies: stored("G") };
  });
}
