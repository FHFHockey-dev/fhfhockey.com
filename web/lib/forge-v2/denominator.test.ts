import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ScheduleGame } from "./contracts";
import { fixtureAffiliation, fixtureSource, FIXTURE_CLOCK } from "./fixtures";
import { buildDenominator, freezeDenominator, measureCoverage, MembershipEvidence, ParticipationEvidence, reconcileDenominators, resolveMembership, serializeDenominator, TransactionType, DenominatorInput, ForecastRow } from "./denominator";
import { parseReceiptKeys, receiptDenominator } from "./denominatorReceipts";
import { resolveAffiliations } from "./schedule";

/** Synthetic fixture. The player ids are the real NHL ids of Astra's 2026-11-23 audit (Larkin 8477946, Dach 8481523,
 * Montembeault 8478470) and the teams are DET 17 and MTL 8. Clocks, games and forecasts are synthetic. */
const SEASON = 20262027, DET = 17, MTL = 8;
const LARKIN = 8477946, DACH = 8481523, MONTY = 8478470, SKATER = 8470001, CALLUP = 8470002;
const TRADE_AT = "2026-11-22T18:00:00.000Z", TRADE_RECEIVED = "2026-11-22T18:05:00.000Z";
const BEFORE = "2026-11-21T12:00:00.000Z", AFTER = "2026-11-23T10:05:00.000Z";

const at = (time: string, extra: Partial<ReturnType<typeof fixtureSource>> = {}) => fixtureSource({ observedAt: time, publishedAt: time, firstReceivedAt: time, ...extra });
function snap(playerId: number, teamId: number | null, time: string, extra: Partial<MembershipEvidence> = {}): MembershipEvidence {
  return { ...fixtureAffiliation({ playerId, teamId, effectiveAt: time, revision: `snap:${playerId}:${teamId}:${time}`, source: at(time, { id: "nhl-roster", revision: `roster:${teamId}:${time}` }) }), kind: "roster_snapshot", transactionType: null, supersedesRevision: null, ...extra };
}
const STATUS: Record<TransactionType, MembershipEvidence["status"]> = { trade: "roster", waiver_claim: "roster", signing: "roster", recall: "roster", assignment: "assigned", ir_placement: "injury_reserve", ltir_placement: "injury_reserve", ir_activation: "roster" };
function txn(playerId: number, teamId: number, type: TransactionType, effectiveAt: string, receivedAt: string, extra: Partial<MembershipEvidence> = {}): MembershipEvidence {
  return { ...fixtureAffiliation({ playerId, teamId, status: STATUS[type], effectiveAt, revision: `txn:${playerId}:${type}:${teamId}:${effectiveAt}`, source: fixtureSource({ id: "nhl-transactions", revision: `txn:${receivedAt}`, observedAt: receivedAt, publishedAt: receivedAt, firstReceivedAt: receivedAt }) }), kind: "official_transaction", transactionType: type, supersedesRevision: null, ...extra };
}
/** DET and MTL play every day from 2026-11-19, each against its own synthetic opponent, alternating home and away. */
function schedule(days = 30): ScheduleGame[] {
  const games: ScheduleGame[] = [];
  for (let d = 0; d < days; d += 1) {
    const date = new Date(Date.UTC(2026, 10, 19 + d)).toISOString().slice(0, 10);
    for (const [i, team] of [DET, MTL].entries()) {
      const opponent = 20 + i, home = d % 2 === 0;
      games.push({ gameId: 2026020300 + d * 2 + i, seasonId: SEASON, gameType: "regular", homeTeamId: home ? team : opponent, awayTeamId: home ? opponent : team,
        sourceGameDate: date, scheduledStartAt: `${date}T23:${i ? "30" : "00"}:00.000Z`, actualStartAt: null, status: "scheduled", revision: "schedule-1",
        source: at("2026-11-01T00:00:00.000Z", { id: "nhl-schedule", revision: "schedule-1" }), noPlayConfirmed: false, replacementGameId: null });
    }
  }
  return games;
}
const ROSTER = "2026-11-01T12:00:00.000Z";
const baseEvidence = (): MembershipEvidence[] => [
  snap(LARKIN, DET, ROSTER), snap(DACH, MTL, ROSTER), snap(MONTY, MTL, ROSTER, { position: "G" }), snap(SKATER, DET, ROSTER),
  txn(LARKIN, MTL, "trade", TRADE_AT, TRADE_RECEIVED), txn(DACH, DET, "trade", TRADE_AT, TRADE_RECEIVED), txn(MONTY, DET, "trade", TRADE_AT, TRADE_RECEIVED, { position: "G" }),
];
const build = (asOf: string, extra: Partial<DenominatorInput> = {}) => buildDenominator({ evidence: baseEvidence(), schedule: schedule(), asOf, seasonId: SEASON, scheduleComplete: true, evidenceClass: "fixture", ...extra });
const keysOf = (d: ReturnType<typeof build>, playerId: number) => d.keys.filter(key => key.playerId === playerId);
const numericSkater = { G: 0.3, A: 0.4, PPP: 0.1, SOG: 2.5, HIT: 1, BLK: 0.5 };
const forecastFor = (d: ReturnType<typeof build>, playerId: number, issuedAt: string, values: ForecastRow["values"] = numericSkater): ForecastRow[] =>
  keysOf(d, playerId).map(key => ({ playerId, gameId: key.gameId, teamId: key.teamId, issuedAt, runId: `run:${issuedAt}`, values }));

describe("Larkin trade (Detroit → Montréal)", () => {
  it("moves future keys to Montréal after the effective time and leaves pre-trade Detroit keys and forecasts untouched", () => {
    const before = build(BEFORE);
    const beforeBytes = serializeDenominator(before);
    expect(keysOf(before, LARKIN).map(key => key.teamId)).toEqual(Array(10).fill(DET));
    const detroitForecasts = forecastFor(before, LARKIN, "2026-11-21T12:01:00.000Z");
    const frozenForecasts = structuredClone(detroitForecasts);
    expect(measureCoverage(before, detroitForecasts)).toMatchObject({ numeric: 10, stray: [] });

    const after = build(AFTER);
    const larkin = keysOf(after, LARKIN);
    expect(larkin).toHaveLength(10);
    expect(larkin.every(key => key.teamId === MTL && key.membershipBasis === "official_transaction" && key.membershipEffectiveAt === TRADE_AT)).toBe(true);
    expect(larkin.every(key => Date.parse(key.scheduledStartAt!) > Date.parse(AFTER))).toBe(true);
    expect(larkin.map(key => key.horizon)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const delta = reconcileDenominators(before, after);
    const closed = delta.closed.filter(key => key.playerId === LARKIN);
    expect(closed).toEqual(keysOf(before, LARKIN));
    expect(closed.every(key => key.teamId === DET)).toBe(true);
    expect(delta.opened.filter(key => key.playerId === LARKIN)).toEqual(larkin);
    // The earlier artifact and its forecasts are unchanged, and so is the earlier coverage.
    expect(serializeDenominator(before)).toBe(beforeBytes);
    expect(detroitForecasts).toEqual(frozenForecasts);
    expect(measureCoverage(before, detroitForecasts).numeric).toBe(10);
    // The earlier cutoff is the same whether or not the later trade evidence exists.
    const withoutTrade = baseEvidence().filter(row => row.kind !== "official_transaction");
    expect(serializeDenominator(build(BEFORE, { evidence: withoutTrade }))).toBe(beforeBytes);
  });

  it("flags new Detroit rows issued after the trade as stray (the Nov 23 audit failure) and gives none of them coverage", () => {
    const after = build(AFTER), before = build(BEFORE);
    const lateDetroit = forecastFor(before, LARKIN, "2026-11-23T10:10:00.000Z").filter(row => Date.parse(schedule().find(g => g.gameId === row.gameId)!.scheduledStartAt!) > Date.parse(AFTER));
    expect(lateDetroit.length).toBe(8);
    const coverage = measureCoverage(after, lateDetroit);
    expect(coverage.numeric).toBe(0);
    expect(coverage.stray.length).toBe(lateDetroit.length);
    expect(new Set(coverage.stray.map(row => row.reason))).toEqual(new Set(["no_denominator_key"]));
  });

  it("does not let a stale Detroit roster row that arrives after the trade move Larkin back; the contradiction is listed", () => {
    const stale = snap(LARKIN, DET, "2026-11-23T09:00:00.000Z");
    const after = build(AFTER, { evidence: [...baseEvidence(), stale] });
    expect(keysOf(after, LARKIN).every(key => key.teamId === MTL)).toBe(true);
    expect(after.conflicts).toEqual([{ playerId: LARKIN, reason: "roster_contradicts_transaction", teamIds: [MTL, DET].sort((a, b) => a - b), revisions: [stale.revision, `txn:${LARKIN}:trade:${MTL}:${TRADE_AT}`].sort() }]);
    // A later Montréal roster row agreeing with the trade refines it and is not a conflict.
    const confirmed = build(AFTER, { evidence: [...baseEvidence(), snap(LARKIN, MTL, "2026-11-23T09:00:00.000Z")] });
    expect(keysOf(confirmed, LARKIN).every(key => key.membershipBasis === "transaction_confirmed_by_roster")).toBe(true);
    expect(confirmed.conflicts).toEqual([]);
  });
});

describe("Dach and Montembeault (Montréal → Detroit) reverse-team controls", () => {
  it("moves a skater and a goalie the other way at the same effective time; the goalie keeps its class", () => {
    const before = build(BEFORE), after = build(AFTER);
    for (const playerId of [DACH, MONTY]) {
      expect(keysOf(before, playerId).every(key => key.teamId === MTL)).toBe(true);
      expect(keysOf(after, playerId).every(key => key.teamId === DET)).toBe(true);
      expect(keysOf(after, playerId)).toHaveLength(10);
    }
    expect(new Set(keysOf(after, MONTY).map(key => key.playerClass))).toEqual(new Set(["goalie"]));
    expect(after.counts.byClass).toEqual([{ playerClass: "goalie", players: 1, keys: 10 }, { playerClass: "skater", players: 3, keys: 30 }]);
    // Detroit's keys after the trade are its own game ids, never Montréal's.
    const detGames = new Set(keysOf(after, SKATER).map(key => key.gameId));
    expect(keysOf(after, DACH).every(key => detGames.has(key.gameId))).toBe(true);
    expect(keysOf(after, LARKIN).some(key => detGames.has(key.gameId))).toBe(false);
  });

  it("the v2 skater default still drops goalies, now listed rather than silent", () => {
    const resolved = resolveAffiliations([fixtureAffiliation({ position: "G" })], FIXTURE_CLOCK);
    expect(resolved.eligible).toEqual([]);
    expect(resolved.outOfScope.map(row => row.reason)).toEqual(["goalie_out_of_scope"]);
    expect(resolveAffiliations([fixtureAffiliation({ position: "G" })], FIXTURE_CLOCK, { includeGoalies: true }).eligible).toHaveLength(1);
  });
});

describe("membership changes", () => {
  it("follows a reverse trade back and keeps each frozen cutoff intact", () => {
    const back = "2026-11-25T18:00:00.000Z";
    const evidence = [...baseEvidence(), txn(LARKIN, DET, "trade", back, "2026-11-25T18:01:00.000Z")];
    const mid = build(AFTER, { evidence }), end = build("2026-11-26T10:00:00.000Z", { evidence });
    expect(keysOf(mid, LARKIN).every(key => key.teamId === MTL)).toBe(true);
    expect(keysOf(end, LARKIN).every(key => key.teamId === DET)).toBe(true);
    expect(serializeDenominator(mid)).toBe(serializeDenominator(build(AFTER)));
  });

  it("keeps healthy scratches, injured and IR/LTIR players in the denominator; participation is annotated, never removed", () => {
    const scratch: ParticipationEvidence = { playerId: SKATER, gameId: 0, state: "healthy_scratch", source: at("2026-11-23T09:30:00.000Z", { id: "lineup", revision: "scratch-1" }) };
    const firstGame = keysOf(build(AFTER), SKATER)[0].gameId;
    const evidence = [...baseEvidence(), txn(DACH, DET, "ir_placement", "2026-11-23T08:00:00.000Z", "2026-11-23T08:01:00.000Z"), txn(MONTY, DET, "ltir_placement", "2026-11-23T08:00:00.000Z", "2026-11-23T08:01:00.000Z", { position: "G" })];
    const d = build(AFTER, { evidence, participation: [{ ...scratch, gameId: firstGame }, { ...scratch, playerId: DACH, gameId: firstGame, state: "injured", source: at("2026-11-23T09:31:00.000Z", { revision: "injury-1" }) }] });
    expect(keysOf(d, SKATER)).toHaveLength(10);
    expect(keysOf(d, DACH).every(key => key.membershipStatus === "injury_reserve")).toBe(true);
    expect(keysOf(d, MONTY).every(key => key.membershipStatus === "injury_reserve" && key.playerClass === "goalie")).toBe(true);
    expect(d.participation).toEqual([{ playerId: SKATER, gameId: firstGame, state: "healthy_scratch", revision: "scratch-1" }, { playerId: DACH, gameId: firstGame, state: "injured", revision: "injury-1" }].sort((a, b) => a.playerId - b.playerId));
    expect(d.counts.keys).toBe(40);
  });

  it("drops a sent-down player from later cutoffs into outOfScope, restores him on recall, and leaves earlier keys alone", () => {
    const down = "2026-11-22T12:00:00.000Z", up = "2026-11-24T12:00:00.000Z";
    const evidence = [...baseEvidence(), txn(SKATER, DET, "assignment", down, "2026-11-22T12:01:00.000Z"), txn(SKATER, DET, "recall", up, "2026-11-24T12:01:00.000Z")];
    const before = build(BEFORE, { evidence }), sent = build(AFTER, { evidence }), recalled = build("2026-11-24T13:00:00.000Z", { evidence });
    expect(keysOf(before, SKATER)).toHaveLength(10);
    expect(keysOf(sent, SKATER)).toEqual([]);
    expect(sent.outOfScope).toEqual([expect.objectContaining({ playerId: SKATER, reason: "assigned", teamIds: [DET] })]);
    expect(keysOf(recalled, SKATER)).toHaveLength(10);
    expect(keysOf(recalled, SKATER).every(key => key.membershipStatus === "roster" && key.membershipBasis === "official_transaction")).toBe(true);
    expect(serializeDenominator(before)).toBe(serializeDenominator(build(BEFORE)));
  });

  it("gives a transaction that omits position the player's latest roster position", () => {
    const trade = (playerId: number) => txn(playerId, MTL, "trade", TRADE_AT, TRADE_RECEIVED, { position: "unknown" });
    const evidence = [snap(LARKIN, DET, ROSTER), snap(MONTY, DET, ROSTER, { position: "G" }), trade(LARKIN), trade(MONTY), txn(SKATER, MTL, "trade", TRADE_AT, TRADE_RECEIVED, { position: "unknown" })];
    const d = build(AFTER, { evidence });
    expect(new Set(keysOf(d, LARKIN).map(key => `${key.teamId}:${key.playerClass}`))).toEqual(new Set([`${MTL}:skater`]));
    expect(new Set(keysOf(d, MONTY).map(key => `${key.teamId}:${key.playerClass}`))).toEqual(new Set([`${MTL}:goalie`]));
    // With no roster position at all, the player is unresolved and listed.
    expect(d.unresolved).toEqual([expect.objectContaining({ playerId: SKATER, reason: "unresolved_affiliation" })]);
  });

  it("keeps a call-up with no NHL history (sparse) in the denominator; only numeric forecasts count as coverage", () => {
    const evidence = [...baseEvidence(), txn(CALLUP, DET, "recall", "2026-11-23T06:00:00.000Z", "2026-11-23T06:01:00.000Z")];
    const d = build(AFTER, { evidence });
    expect(keysOf(d, CALLUP)).toHaveLength(10);
    const issued = "2026-11-23T10:30:00.000Z";
    const rows = forecastFor(d, CALLUP, issued, { ...numericSkater, G: null });
    rows[0] = { ...rows[0], values: numericSkater };
    rows[1] = { ...rows[1], values: { ...numericSkater, SOG: Number.NaN } };
    const coverage = measureCoverage(d, rows);
    expect(coverage).toMatchObject({ numeric: 1, nonNumeric: 9, playersWithAllTen: 0 });
    // A goalie row needs the goalie core; skater fields do not count.
    const goalie = measureCoverage(d, forecastFor(d, MONTY, issued));
    expect(goalie).toMatchObject({ numeric: 0, nonNumeric: 10 });
    expect(measureCoverage(d, forecastFor(d, MONTY, issued, { SAVES: 25, SHOTS_AGAINST: 28, GOALS_ALLOWED: 3, WIN: 0.5, SHUTOUT: 0.05 }))).toMatchObject({ numeric: 10, playersWithAllTen: 1 });
    // A forecast issued before the denominator froze is not coverage of it.
    expect(measureCoverage(d, forecastFor(d, SKATER, "2026-11-23T10:00:00.000Z")).stray.every(row => row.reason === "issued_before_denominator")).toBe(true);
  });
});

describe("conflicts and late evidence", () => {
  it("reports same-time conflicting transactions as unresolved, unless one supersedes the other", () => {
    const a = txn(SKATER, MTL, "trade", "2026-11-22T20:00:00.000Z", "2026-11-22T20:01:00.000Z");
    const b = txn(SKATER, 25, "trade", "2026-11-22T20:00:00.000Z", "2026-11-22T20:02:00.000Z");
    const d = build(AFTER, { evidence: [...baseEvidence(), a, b] });
    expect(keysOf(d, SKATER)).toEqual([]);
    expect(d.unresolved).toEqual([{ playerId: SKATER, reason: "conflicting_transactions", teamIds: [MTL, 25], revisions: [a.revision, b.revision].sort() }]);
    const fixed = build(AFTER, { evidence: [...baseEvidence(), a, { ...b, supersedesRevision: a.revision }] });
    expect(resolveMembership([...baseEvidence(), a, { ...b, supersedesRevision: a.revision }], AFTER).members.find(m => m.affiliation.playerId === SKATER)?.affiliation.teamId).toBe(25);
    expect(fixed.unresolved).toEqual([]);
    expect(fixed.shortfalls).toEqual([{ playerId: SKATER, teamId: 25, count: 0, reason: "verified_schedule_exhausted" }]);
  });

  it("reports same-clock conflicting roster snapshots as unresolved", () => {
    const d = build(AFTER, { evidence: [...baseEvidence(), snap(SKATER, MTL, ROSTER)] });
    expect(d.unresolved).toEqual([expect.objectContaining({ playerId: SKATER, reason: "conflicting_affiliation", teamIds: [MTL, DET].sort((x, y) => x - y) })]);
  });

  it("ignores evidence first received after the cutoff even when it is effective before it", () => {
    const late = txn(SKATER, MTL, "trade", "2026-11-22T00:00:00.000Z", "2026-11-23T12:00:00.000Z");
    const without = build(AFTER), withLate = build(AFTER, { evidence: [...baseEvidence(), late] });
    expect(serializeDenominator(withLate)).toBe(serializeDenominator(without));
    expect(keysOf(build("2026-11-23T12:30:00.000Z", { evidence: [...baseEvidence(), late] }), SKATER).every(key => key.teamId === MTL)).toBe(true);
  });

  it("rejects a transaction whose status does not match its type", () => {
    expect(() => resolveMembership([{ ...txn(SKATER, DET, "trade", ROSTER, ROSTER), status: "assigned" }], AFTER)).toThrow("must carry status roster");
  });
});

describe("schedule changes", () => {
  it("drops a postponed game, shifts later horizons, and places the rescheduled game by its new start", () => {
    const games = schedule();
    const detFuture = build(AFTER).keys.filter(key => key.playerId === SKATER).map(key => key.gameId);
    const postponedId = detFuture[2];
    const original = games.find(g => g.gameId === postponedId)!;
    const postponed: ScheduleGame = { ...original, status: "postponed", scheduledStartAt: null, revision: "postponed", source: at("2026-11-23T08:00:00.000Z", { id: "nhl-schedule", revision: "postponed" }) };
    const d = build(AFTER, { schedule: [...games, postponed] });
    expect(keysOf(d, SKATER).map(key => key.gameId)).toEqual([...detFuture.filter(id => id !== postponedId), games.filter(g => g.homeTeamId === DET || g.awayTeamId === DET).map(g => g.gameId).find(id => !detFuture.includes(id) && id > detFuture[9])]);
    expect(d.excludedGames).toContainEqual({ gameId: postponedId, reason: "unknown_start", replacementGameId: null });
    const rescheduled: ScheduleGame = { ...original, scheduledStartAt: "2026-12-30T23:00:00.000Z", sourceGameDate: "2026-12-30", revision: "rescheduled", source: at("2026-11-23T09:00:00.000Z", { id: "nhl-schedule", revision: "rescheduled" }) };
    const r = build(AFTER, { schedule: [...games, postponed, rescheduled] });
    expect(keysOf(r, SKATER).some(key => key.gameId === postponedId)).toBe(false); // now beyond H10
    const near: ScheduleGame = { ...rescheduled, scheduledStartAt: "2026-11-23T20:00:00.000Z", sourceGameDate: "2026-11-23", revision: "rescheduled-near", source: at("2026-11-23T09:30:00.000Z", { id: "nhl-schedule", revision: "rescheduled-near" }) };
    const n = build(AFTER, { schedule: [...games, postponed, near] });
    expect(keysOf(n, SKATER).find(key => key.gameId === postponedId)).toMatchObject({ horizon: 1, scheduleRevision: "rescheduled-near" });
  });
});

describe("frozen artifact", () => {
  it("gives identical bytes and hash for shuffled inputs, and refuses a tampered body", () => {
    const a = build(AFTER);
    const shuffled = buildDenominator({ evidence: [...baseEvidence()].reverse(), schedule: [...schedule()].reverse(), asOf: AFTER, seasonId: SEASON, scheduleComplete: true, evidenceClass: "fixture" });
    expect(serializeDenominator(shuffled)).toBe(serializeDenominator(a));
    expect(a.denominatorSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => serializeDenominator({ ...a, keys: a.keys.slice(1) })).toThrow("hash mismatch");
  });

  it("requires exact NHL game ids and unique player/game keys", () => {
    const key = build(AFTER).keys[0];
    const body = { evidenceClass: "fixture" as const, asOf: AFTER, seasonId: SEASON, orderingBasis: "scheduled_start" as const, inputs: [], unresolved: [], conflicts: [], outOfScope: [], shortfalls: [], excludedGames: [], participation: [], limitations: [] };
    expect(() => freezeDenominator({ ...body, keys: [{ ...key, gameId: 378 }] })).toThrow("Inexact NHL game id");
    expect(() => freezeDenominator({ ...body, keys: [key, { ...key }] })).toThrow("Duplicate player/game key");
  });
});

describe("receipt adapter (Astra 2026-11-23)", () => {
  const header = "affiliation_basis,team_id,player_id,player_class,team_horizon,nhl_game_id,writer";
  const csv = (rows: string[]) => `${[header, ...rows].join("\r\n")}\r\n`;
  const games = (base: number) => Array.from({ length: 10 }, (_, i) => [i + 1, base + i] as const);

  it("keeps the trade-reconciled floor, lists contradictions and stale roster rows, and leaves clocks null", () => {
    const reconciled = parseReceiptKeys(csv([
      ...games(2026020400).map(([h, g]) => `official,${DET},${SKATER},S,${h},${g},missing`),
      ...games(2026020500).map(([h, g]) => `club_trade_2026-11-22,${MTL},${LARKIN},S,${h},${g},${h < 3 ? "lineup" : "missing"}`),
    ]));
    const enumerated = parseReceiptKeys(csv([
      ...games(2026020400).map(([h, g]) => `official,${DET},${SKATER},S,${h},${g},missing`),
      ...games(2026020400).map(([h, g]) => `other,${DET},${LARKIN},S,${h},${g},missing`),
      ...games(2026020400).map(([h, g]) => `other,${DET},${CALLUP},S,${h},${g},missing`),
    ]));
    const d = receiptDenominator({ reconciled, enumerated, inputs: [], seasonId: SEASON });
    expect(d.counts).toMatchObject({ players: 2, keys: 20, expectedKeys: 20, unresolved: 1, conflicts: 1 });
    expect(d.conflicts).toEqual([{ playerId: LARKIN, reason: "receipt_roster_contradicts_trade", teamIds: [MTL, DET], revisions: ["club_trade_2026-11-22", "other"] }]);
    expect(d.unresolved).toEqual([{ playerId: CALLUP, reason: "roster_not_officially_seen_at_audit", teamIds: [DET], revisions: ["other"] }]);
    expect(d.keys.every(key => key.scheduledStartAt === null && key.membershipEffectiveAt === null && key.home === null)).toBe(true);
    expect(serializeDenominator(receiptDenominator({ reconciled: [...reconciled].reverse(), enumerated: [...enumerated].reverse(), inputs: [], seasonId: SEASON }))).toBe(serializeDenominator(d));
  });

  const receipts = join(__dirname, "../../../tasks/artifacts/forge-full-nhl-h10-2026-11-23/astra-audit-receipts");
  it.runIf(existsSync(receipts))("reproduces the frozen 804-player / 8,040-key denominator from the saved receipts", () => {
    const reconciled = parseReceiptKeys(readFileSync(join(receipts, "trade-reconciled-keys.csv"), "utf8"));
    const enumerated = parseReceiptKeys(readFileSync(join(receipts, "player-game-keys.csv"), "utf8"));
    const file = (name: string) => createHash("sha256").update(new Uint8Array(readFileSync(join(receipts, name)))).digest("hex");
    const d = receiptDenominator({ reconciled, enumerated, seasonId: SEASON, inputs: [
      { name: "astra-audit-receipts/trade-reconciled-keys.csv", sha256: file("trade-reconciled-keys.csv"), rows: reconciled.length },
      { name: "astra-audit-receipts/player-game-keys.csv", sha256: file("player-game-keys.csv"), rows: enumerated.length },
      { name: "astra-audit-receipts/enumeration.sql", sha256: file("enumeration.sql"), rows: 1 },
    ] });
    // Pins the committed frozen artifact byte for byte.
    expect(serializeDenominator(d)).toBe(readFileSync(join(receipts, "../denominator/denominator.json"), "utf8"));
    expect(d.denominatorSha256).toBe("9c61686e672438d590055dc90697ac2b759ca58971767da5bcf925d4751f1049");
    expect(d.counts).toMatchObject({ players: 804, keys: 8040, expectedKeys: 8040, unresolved: 533, conflicts: 3, shortfallPlayers: 0 });
    expect(d.counts.byClass).toEqual([{ playerClass: "goalie", players: 73, keys: 730 }, { playerClass: "skater", players: 731, keys: 7310 }]);
    expect(new Set(d.keys.map(key => key.teamId)).size).toBe(32);
    expect(d.conflicts.map(row => row.playerId)).toEqual([LARKIN, MONTY, DACH].sort((a, b) => a - b));
    expect(d.keys.filter(key => key.playerId === LARKIN).every(key => key.teamId === MTL)).toBe(true);
    expect(d.keys.filter(key => key.playerId === MONTY).every(key => key.teamId === DET && key.playerClass === "goalie")).toBe(true);
  });
});
