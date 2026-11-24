import { describe, expect, it } from "vitest";
import { appearanceSnapshots, classifyNewsCard, effectiveSnapshots, recheckDue, mergeSnapshots, moveEvidence, NewsCardRow, NewsSnapshot, officialMoves, OfficialRoster, OverlayKey, parseOfficialRoster,
  planRecheck, resolveAvailability, servedForecast } from "./h10News";
import { resolveMembership } from "./denominator";
import { DET, LARKIN, MONTEMBEAULT, MTL } from "./h10Fixtures";

const H = 3600000, T0 = Date.UTC(2026, 10, 24, 12), at = (hours: number) => new Date(T0 + hours * H).toISOString();
let serial = 0;
const card = (over: Partial<NewsCardRow> & { players?: NewsCardRow["players"] }): NewsCardRow => ({
  id: over.id ?? `card-${++serial}`, card_status: "published", category: "INJURY", subcategory: "OUT", source_account: "canadiensmtl", source_tweet_id: `t${serial}`,
  original_tweet_id: `t${serial}`, tweet_url: `https://x.com/canadiensmtl/status/${serial}`, team_id: MTL, headline: "update", observed_at: at(0), published_at: at(0.5), updated_at: at(0.5),
  players: [{ player_id: 1001, team_id: MTL, role: "subject" }], ...over });
/** Snapshots as the route stores them: each batch of rows first seen at its own time. */
const seen = (...batches: Array<[number, NewsCardRow[]]>) => batches.reduce<NewsSnapshot[]>((all, [hours, rows]) => mergeSnapshots(all, rows, at(hours)).all, []);
// Player 1001 (MTL skater) has games 6 h, 30 h and 54 h after T0; goalies 2001 and 2002 share MTL's games.
const keys: OverlayKey[] = [6, 30, 54].flatMap((h, i) => [
  { playerId: 1001, gameId: 100 + i, teamId: MTL, scheduledStartAt: at(h), playerClass: "skater" as const },
  { playerId: 2001, gameId: 100 + i, teamId: MTL, scheduledStartAt: at(h), playerClass: "goalie" as const },
  { playerId: 2002, gameId: 100 + i, teamId: MTL, scheduledStartAt: at(h), playerClass: "goalie" as const }]);
const state = (overlays: ReturnType<typeof resolveAvailability>, playerId: number) => [100, 101, 102].map(g => overlays.find(o => o.playerId === playerId && o.gameId === g)?.availability ?? "available");

describe("news card classification", () => {
  it("separates membership reports, availability, confirmed returns and projections by subcategory", () => {
    expect(classifyNewsCard("TRADE", "COMPLETED TRADE")).toBe("membership_report");
    expect(classifyNewsCard("TRANSACTION", "ROSTER MOVE")).toBe("membership_report");
    expect(classifyNewsCard("TRANSACTION", "CONTRACT NEGOTIATION")).toBe("not_applicable");
    expect(classifyNewsCard("INJURY", "OUT")).toBe("out");
    expect(classifyNewsCard("INJURY", "DAY TO DAY")).toBe("questionable");
    expect(classifyNewsCard("SCRATCHES", "CONFIRMED SCRATCH")).toBe("scratch");
    expect(classifyNewsCard("RETURN", "RETURNING")).toBe("confirmed_return");
    expect(classifyNewsCard("RETURN", "RETURNING TO LINEUP")).toBe("confirmed_return");
    expect(classifyNewsCard("RETURN", "PROJECTED RETURN")).toBe("projected_return");
    expect(classifyNewsCard("GOALIE START", "CONFIRMED STARTER")).toBe("goalie_confirmed_start");
    expect(classifyNewsCard("GOALIE START", "EXPECTED STARTER")).toBe("goalie_expected_start");
    expect(classifyNewsCard("LINE COMBINATION", "PRACTICE LINES")).toBe("lineup_report");
  });
});

describe("card snapshots: provenance, redelivery and corrections", () => {
  it("keeps the post, source and first-seen time; an identical redelivery is the same snapshot", () => {
    const row = card({ id: "c-redeliver" });
    const first = mergeSnapshots([], [row], at(1));
    expect(first.added[0]).toMatchObject({ cardId: "c-redeliver", postId: row.original_tweet_id, postUrl: row.tweet_url, account: "canadiensmtl", tier: "team", postedAt: at(0), firstSeenAt: at(1), supersedes: null });
    // The feed re-stamps published_at and updated_at; the revision hashes meaning only, so nothing new is stored.
    const again = mergeSnapshots(first.all, [{ ...row, published_at: at(3), updated_at: at(3) }], at(3));
    expect(again).toMatchObject({ added: [], duplicates: 1 });
    expect(again.all).toEqual(first.all);
  });

  it("records a correction as a new revision that supersedes the first; the latest revision decides", () => {
    const row = card({ id: "c-correct", subcategory: "OUT" });
    const all = seen([1, [row]], [2, [{ ...row, subcategory: "DAY TO DAY", updated_at: at(2) }]]);
    expect(all).toHaveLength(2);
    expect(all[1].supersedes).toBe(all[0].id);
    expect(effectiveSnapshots(all, at(3)).map(s => s.signal)).toEqual(["questionable"]);
    expect(state(resolveAvailability(keys, all, at(3)), 1001)).toEqual(["questionable", "available", "available"]);
    // Withdrawn from publication: the card no longer has any effect.
    const withdrawn = seen([1, [row]], [2, [{ ...row, card_status: "archived", updated_at: at(2) }]]);
    expect(resolveAvailability(keys, withdrawn, at(3))).toEqual([]);
  });
});

describe("availability overlay", () => {
  it("an out report withholds every later game; a confirmed return lifts it and the same vintage is served again", () => {
    const out = card({ observed_at: at(1) }), returning = card({ category: "RETURN", subcategory: "RETURNING", observed_at: at(20) });
    const stored = { id: "vintage:1001:101", outputHash: "h101" };
    const injured = resolveAvailability(keys, seen([1.5, [out]]), at(2));
    expect(state(injured, 1001)).toEqual(["out", "out", "out"]);
    expect(servedForecast(stored, injured.find(o => o.gameId === 101)!)).toMatchObject({ vintageId: "vintage:1001:101", outputHash: "h101", served: "withheld_player_out" });
    // The return arrives late (first seen at 26 h, posted at 20 h): it still lifts from its own post time.
    const back = resolveAvailability(keys, seen([1.5, [out]], [26, [returning]]), at(26));
    expect(state(back, 1001)).toEqual(["out", "available", "available"]);
    expect(servedForecast(stored, back.find(o => o.gameId === 101)!)).toEqual({ vintageId: "vintage:1001:101", outputHash: "h101", availability: "available", role: null, served: "if_playing" });
  });

  // The official-appearance rule (TJ, approved 2026-11-23).
  const played = (gameId: number, startHours: number, observedHours: number, toi = 900) =>
    appearanceSnapshots([{ playerId: 1001, gameId, gameStartAt: at(startHours), timeOnIceSeconds: toi, firstObservedAt: at(observedHours) }]);
  it("an appearance with ice time after the OUT report lifts it for games after FORGE first observed it; later play is assumed", () => {
    const snapshots = [...seen([1.5, [card({ observed_at: at(1) })]]), ...played(90, 4, 40)];
    expect(state(resolveAvailability(keys, snapshots, at(39)), 1001)).toEqual(["out", "out", "out"]); // not observed yet
    const back = resolveAvailability(keys, snapshots, at(41));
    // Game 101 (30 h) started before the first observation (40 h): it stays held; game 102 (54 h) is lifted.
    expect(state(back, 1001)).toEqual(["out", "out", "available"]);
    expect(back.find(o => o.gameId === 102)).toMatchObject({ evidence: ["forge-h10-appearance:1001:90"], annotations: ["participation_assumed_not_confirmed"] });
    // An explicit return post never marks participation as assumed.
    const posted = resolveAvailability(keys, [...seen([1.5, [card({ observed_at: at(1) })]]), ...seen([3, [card({ category: "RETURN", subcategory: "RETURNING", observed_at: at(2) })]])], at(3));
    expect(posted.find(o => o.gameId === 101)!.annotations).toEqual([]);
  });

  it("dressing without ice time (a lineup listing, a backup goalie who sat) lifts nothing", () => {
    expect(played(90, 4, 5, 0)).toEqual([]);
    expect(state(resolveAvailability(keys, [...seen([1.5, [card({ observed_at: at(1) })]]), ...played(90, 4, 5, 0)], at(6)), 1001)).toEqual(["out", "out", "out"]);
  });

  it("must follow the OUT report, and never overrides a newer credible OUT report", () => {
    // Played before the OUT was posted: nothing to lift.
    expect(state(resolveAvailability(keys, [...seen([3, [card({ observed_at: at(2) })]]), ...played(90, 1, 3.5)], at(4)), 1001)).toEqual(["out", "out", "out"]);
    // An OUT posted after the game began (an in-game injury) is newer than the appearance, even though FORGE observed
    // the box score later: the player stays out.
    const injured = [...seen([1.5, [card({ observed_at: at(1) })]]), ...played(90, 4, 10), ...seen([6, [card({ observed_at: at(5) })]])];
    expect(state(resolveAvailability(keys, injured, at(11)), 1001)).toEqual(["out", "out", "out"]);
    // A newer OUT after a lift applies again and drops the participation assumption.
    const relapse = [...seen([1.5, [card({ observed_at: at(1) })]]), ...played(90, 4, 5), ...seen([21, [card({ observed_at: at(20) })]])];
    expect(resolveAvailability(keys, relapse, at(21)).filter(o => o.playerId === 1001).map(o => [o.availability, o.annotations])).toEqual([["available", ["participation_assumed_not_confirmed"]], ["out", []], ["out", []]]);
    // An appearance never creates an overlay for a player who was not out.
    expect(resolveAvailability(keys, appearanceSnapshots([{ playerId: 2001, gameId: 90, gameStartAt: at(4), timeOnIceSeconds: 3600, firstObservedAt: at(5) }]), at(6))).toEqual([]);
  });

  it("a projected return, a questionable tag or a projected line never lifts an out overlay", () => {
    const out = card({ observed_at: at(1) });
    const soft = [card({ category: "RETURN", subcategory: "PROJECTED RETURN", observed_at: at(2) }), card({ category: "INJURY", subcategory: "DAY TO DAY", observed_at: at(3) }),
      card({ category: "LINE COMBINATION", subcategory: "PRACTICE LINES", observed_at: at(4) })];
    const overlays = resolveAvailability(keys, seen([1.5, [out]], [5, soft]), at(5));
    expect(state(overlays, 1001)).toEqual(["out", "out", "out"]);
    // Each is recorded on the next game as an annotation only.
    expect(overlays.find(o => o.playerId === 1001 && o.gameId === 100)!.annotations).toEqual(["lineup_report", "projected_return"]);
  });

  it("a stale report that arrives after newer evidence does not overwrite it", () => {
    const returning = card({ category: "RETURN", subcategory: "RETURNING TO LINEUP", observed_at: at(2) }), olderOut = card({ observed_at: at(1) });
    // The return (posted 2 h) is seen first; the older out report (posted 1 h) arrives at 4 h.
    expect(state(resolveAvailability(keys, seen([3, [returning]], [4, [olderOut]]), at(4)), 1001)).toEqual(["available", "available", "available"]);
  });

  it("same-time contradictions are recorded as conflicts and applied neither way; duplicates change nothing", () => {
    const out = card({ observed_at: at(1) });
    const scratch = card({ category: "SCRATCHES", subcategory: "CONFIRMED SCRATCH", observed_at: at(3) }), back = card({ category: "RETURN", subcategory: "RETURNING", observed_at: at(3) });
    const overlays = resolveAvailability(keys, seen([1.5, [out]], [4, [scratch, back]]), at(4));
    expect(state(overlays, 1001)).toEqual(["out", "out", "out"]);
    expect(overlays.find(o => o.playerId === 1001 && o.gameId === 101)!.conflicts).toHaveLength(2);
    // A second card repeating the out report (another post) leaves the same state.
    const repeated = resolveAvailability(keys, seen([1.5, [out]], [2, [card({ observed_at: at(1.2) })]]), at(4));
    expect(state(repeated, 1001)).toEqual(["out", "out", "out"]);
  });

  it("game-specific reports bind to the next game only, and only within 48 h", () => {
    const scratch = card({ category: "SCRATCHES", subcategory: "CONFIRMED SCRATCH", observed_at: at(10) });
    expect(state(resolveAvailability(keys, seen([11, [scratch]]), at(11)), 1001)).toEqual(["available", "out", "available"]);
    const early = card({ category: "SCRATCHES", subcategory: "CONFIRMED SCRATCH", observed_at: at(-60) });
    expect(resolveAvailability(keys, seen([-59, [early]]), at(11))).toEqual([]);
  });

  it("a confirmed goalie start marks his club's other goalie as not confirmed for that game; an expected start does not", () => {
    const confirmed = card({ category: "GOALIE START", subcategory: "CONFIRMED STARTER", observed_at: at(2), players: [{ player_id: 2001, team_id: MTL, role: "subject" }] });
    const overlays = resolveAvailability(keys, seen([3, [confirmed]]), at(3));
    expect(overlays.filter(o => o.gameId === 100).map(o => [o.playerId, o.role])).toEqual([[2001, "confirmed_starter"], [2002, "not_confirmed_starter"]]);
    const expected = card({ category: "GOALIE START", subcategory: "EXPECTED STARTER", observed_at: at(2), players: [{ player_id: 2002, team_id: MTL, role: "subject" }] });
    expect(resolveAvailability(keys, seen([3, [expected]]), at(3)).map(o => [o.playerId, o.gameId, o.role])).toEqual([[2002, 100, "expected_starter"]]);
  });

  it("only club accounts and reviewed beat reporters change availability", () => {
    expect(resolveAvailability(keys, seen([2, [card({ source_account: "some_fan_account", observed_at: at(1) })]]), at(2))).toEqual([]);
    expect(resolveAvailability(keys, seen([2, [card({ source_account: "dfofantasy", observed_at: at(1) })]]), at(2))).toEqual([]); // relay: never a source
    // Read #3: 109 of 385 published cards carry no source_account (and no post URL). They are "unknown": never credible
    // for availability or role. Handles arrive as "@Name"; the tier lookup normalises them.
    const anonymous = seen([2, [card({ source_account: null, tweet_url: null, observed_at: at(1) })]]);
    expect(anonymous[0].tier).toBe("unknown");
    expect(resolveAvailability(keys, anonymous, at(2))).toEqual([]);
    expect(seen([2, [card({ source_account: "@CanadiensMTL", observed_at: at(1) })]])[0].tier).toBe("team");
  });
});

describe("membership: a report triggers an official recheck but never moves a player", () => {
  const roster = (teamId: number, abbrev: string, ids: Array<[number, "F" | "D" | "G"]>, fetchedAt: string): OfficialRoster =>
    parseOfficialRoster({ forwards: ids.filter(([, p]) => p === "F").map(([id]) => ({ id })), defensemen: ids.filter(([, p]) => p === "D").map(([id]) => ({ id })), goalies: ids.filter(([, p]) => p === "G").map(([id]) => ({ id })) }, teamId, abbrev, fetchedAt);
  const current = new Map([[MONTEMBEAULT, MTL], [LARKIN, DET], [1001, MTL]]);
  const trade = card({ id: "c-trade", category: "TRADE", subcategory: "COMPLETED TRADE", observed_at: at(1), team_id: DET, players: [{ player_id: MONTEMBEAULT, team_id: null, role: "subject" }] });

  it("rechecks a pending report on a schedule (first sight, 1, 3, 6, 12, 24, 48 h), not on every call", () => {
    const window = 30 * 60000, firstSeen = at(0);
    const due = Array.from({ length: 2 * 72 }, (_, i) => i * 0.5).filter(h => recheckDue(firstSeen, at(h), window));
    expect(due).toEqual([0, 1, 3, 6, 12, 24, 48]);
    const snapshots = seen([1.5, [trade]]);
    expect(planRecheck(snapshots, current, [], at(1.5), { maximumTeams: 4, expiryHours: 72, windowMs: window }).teams).toEqual([MTL, DET]);
    const quiet = planRecheck(snapshots, current, [], at(2), { maximumTeams: 4, expiryHours: 72, windowMs: window });
    expect(quiet).toMatchObject({ teams: [], pending: [{ due: false }] });
  });

  it("a report FORGE already reflects (the player is on the club it names) is settled without a recheck", () => {
    const named = seen([1.5, [{ ...trade, id: "c-named", players: [{ player_id: MONTEMBEAULT, team_id: DET, role: "subject" }] }]]);
    expect(planRecheck(named, new Map(current).set(MONTEMBEAULT, DET), [], at(2), { maximumTeams: 4, expiryHours: 72 })).toMatchObject({ reflected: [named[0].id], pending: [], teams: [] });
    expect(planRecheck(named, current, [], at(2), { maximumTeams: 4, expiryHours: 72 }).pending).toHaveLength(1);
  });

  it("an unattributed trade report may still ask for a recheck (it moves nobody)", () => {
    const anonymous = seen([1.5, [{ ...trade, id: "c-anon", source_account: null, tweet_url: null }]]);
    expect(planRecheck(anonymous, current, [], at(2), { maximumTeams: 4, expiryHours: 72 }).teams).toEqual([MTL, DET]);
  });

  it("plans a bounded recheck of the player's club and the card's club; the report stays pending until the official roster moves him", () => {
    const snapshots = seen([1.5, [trade]]);
    const plan = planRecheck(snapshots, current, [], at(2), { maximumTeams: 4, expiryHours: 72 });
    expect(plan).toMatchObject({ teams: [MTL, DET], confirmed: [], expired: [] });
    expect(plan.pending.map(p => p.playerIds)).toEqual([[MONTEMBEAULT]]);
    // The official MTL roster still lists him: no move, the report stays pending.
    expect(officialMoves([roster(MTL, "MTL", [[MONTEMBEAULT, "G"], [1001, "F"]], at(2)), roster(DET, "DET", [[LARKIN, "F"]], at(2))], current, [])).toEqual([]);
    // Once DET lists him, the official observation is the move; the report is then confirmed.
    const moves = officialMoves([roster(MTL, "MTL", [[1001, "F"]], at(3)), roster(DET, "DET", [[LARKIN, "F"], [MONTEMBEAULT, "G"]], at(3))], current, []);
    expect(moves).toMatchObject([{ playerId: MONTEMBEAULT, fromTeamId: MTL, toTeamId: DET, position: "G", firstObservedAt: at(3) }]);
    expect(planRecheck(snapshots, current, moves, at(3.5), { maximumTeams: 4, expiryHours: 72 })).toMatchObject({ pending: [], confirmed: [{ moveIds: [moves[0].id] }], teams: [] });
    expect(planRecheck(snapshots, current, [], at(80), { maximumTeams: 4, expiryHours: 72 })).toMatchObject({ pending: [], expired: [snapshots[0].id] });
    expect(planRecheck(snapshots, current, [], at(2), { maximumTeams: 1, expiryHours: 72 }).teams).toEqual([MTL]);
  });

  it("dates a move by its first official observation, reuses it on re-observation, and handles a reverse trade", () => {
    const first = officialMoves([roster(DET, "DET", [[MONTEMBEAULT, "G"]], at(3))], current, []);
    const again = officialMoves([roster(DET, "DET", [[MONTEMBEAULT, "G"]], at(9))], current, first);
    expect(again).toEqual(first);
    const moved = new Map(current).set(MONTEMBEAULT, DET);
    const back = officialMoves([roster(MTL, "MTL", [[MONTEMBEAULT, "G"]], at(30))], moved, first);
    expect(back).toMatchObject([{ fromTeamId: DET, toTeamId: MTL, firstObservedAt: at(30), after: first[0].id }]);
    // As membership evidence the latest official move wins over the lagging rosters snapshot (reported as a conflict).
    const snapshot = { ...moveEvidence(first[0]), kind: "roster_snapshot" as const, transactionType: null, teamId: MTL, effectiveAt: at(31), revision: "rosters:8",
      source: { ...moveEvidence(first[0]).source, firstReceivedAt: at(31), observedAt: at(31) } };
    const resolved = resolveMembership([moveEvidence(first[0]), snapshot], at(32));
    expect(resolved.members[0]).toMatchObject({ affiliation: { teamId: DET }, basis: "official_transaction" });
    expect(resolved.conflicts.map(c => c.reason)).toEqual(["roster_contradicts_transaction"]);
  });

  it("never infers a departure from absence, and waits when two clubs list the same player", () => {
    expect(officialMoves([roster(DET, "DET", [[LARKIN, "F"]], at(3))], current, [])).toEqual([]);
    expect(officialMoves([roster(DET, "DET", [[MONTEMBEAULT, "G"]], at(3)), roster(MTL, "MTL", [[MONTEMBEAULT, "G"]], at(3))], current, [])).toEqual([]);
    // A player FORGE does not list at all (a call-up) is a move from nowhere.
    expect(officialMoves([roster(DET, "DET", [[9000001, "D"]], at(3))], current, [])).toMatchObject([{ playerId: 9000001, fromTeamId: null, toTeamId: DET, position: "D" }]);
    expect(moveEvidence(officialMoves([roster(DET, "DET", [[9000001, "D"]], at(3))], current, [])[0])).toMatchObject({ kind: "official_transaction", transactionType: "recall", status: "roster" });
    expect(() => parseOfficialRoster({ forwards: [] }, DET, "DET", at(3))).toThrow(/official_roster_malformed/);
  });

  it("a complete read of every club closes a member no roster lists (a send-down after a call-up); a partial read never does", () => {
    const called = officialMoves([roster(DET, "DET", [[9000002, "F"]], at(3))], current, []);
    expect(called).toMatchObject([{ playerId: 9000002, fromTeamId: null, toTeamId: DET }]);
    const member = new Map(current).set(9000002, DET);
    const everyClub = [roster(DET, "DET", [[LARKIN, "F"]], at(30)), roster(MTL, "MTL", [[MONTEMBEAULT, "G"], [1001, "F"]], at(30))];
    // Partial (a recheck): his absence means nothing.
    expect(officialMoves(everyClub, member, called)).toEqual([]);
    const sent = officialMoves(everyClub, member, called, true);
    expect(sent).toMatchObject([{ playerId: 9000002, fromTeamId: DET, toTeamId: null, firstObservedAt: at(30), after: called[0].id }]);
    // The departure outranks the earlier call-up: he leaves the issued set and is listed out of scope.
    const resolved = resolveMembership([moveEvidence(called[0]), moveEvidence(sent[0])], at(31));
    expect(resolved.members).toEqual([]);
    expect(resolved.outOfScope.map(i => [i.playerId, i.reason])).toEqual([[9000002, "assigned"]]);
    // Re-reading the same absence reuses the stored departure; a later listing calls him up again after it.
    expect(officialMoves(everyClub, member, [...called, ...sent], true)).toEqual(sent);
    expect(officialMoves([roster(MTL, "MTL", [[9000002, "F"]], at(50))], current, [...called, ...sent])).toMatchObject([{ fromTeamId: null, toTeamId: MTL, after: sent[0].id }]);
  });
});
