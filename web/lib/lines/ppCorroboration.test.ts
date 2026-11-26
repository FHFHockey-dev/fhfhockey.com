import { describe, expect, it } from "vitest";
import { officialPowerPlayEvidence, type OfficialPowerPlayEvidence } from "./officialPowerPlay";
import { corroborateInGamePP } from "./ppCorroboration";
import type { PenaltyClue } from "./ppClue";
import { curtisClaim, game0356, game0392, html0356, html0392, pbp0356, pbp0392, silberFive, silberPostedAt, silberText, silberUrl, url0356, url0392 } from "./testPpFixtures";
import type { LineClaim, LineGame } from "./types";

const base = officialPowerPlayEvidence(game0356, pbp0356, html0356, url0356)!;
const clue: PenaltyClue = { committedByPlayerId: 8481754, drawnByPlayerId: null, infraction: "high-sticking", evidence: [] };
const reader = (evidence: OfficialPowerPlayEvidence | null = base) => (gameId: number) => gameId === game0356.id ? evidence : null;
const withTime = (claim: LineClaim, at: string): LineClaim => ({ ...claim, time: { ...claim.time, originalPublishedAt: at, effectiveAt: at } });
const run = (overrides: { claim?: LineClaim; games?: LineGame[]; evidence?: OfficialPowerPlayEvidence | null; clue?: PenaltyClue | null } = {}) =>
  corroborateInGamePP(overrides.claim ?? curtisClaim, overrides.games ?? [game0356], reader("evidence" in overrides ? overrides.evidence : base), "clue" in overrides ? overrides.clue! : clue);

describe("corroborateInGamePP (Curtis PP1, ANA–COL 2026020356)", () => {
  it("binds Curtis PP1 to 2026020356", () => {
    const result = run();
    expect(result).toMatchObject({ status: "bound", gameId: 2026020356, scheduleIdentity: game0356.scheduleIdentity });
    expect(result.evidence).toEqual(expect.arrayContaining(["live_game:2026020356", "nhl_penalty:320", "nhl_pp_faceoff:315",
      `nhl_report:${url0356}`, "faceoff_before_publication:unverified"]));
    expect(result.evidence.some((item) => item.startsWith("nhl_verified_at:"))).toBe(false);
  });
  it("is deterministic for identical evidence", () => {
    expect(run()).toEqual(run());
  });
  it("refuses a wrong five", () => {
    const players = curtisClaim.unit!.players.map((player) => player.playerId === 8478038 ? { playerId: 8482178, name: "John Moore" } : player);
    expect(run({ claim: { ...curtisClaim, unit: { ...curtisClaim.unit!, players } } })).toEqual({ status: "unresolved", evidence: ["five_not_on_ice"] });
  });
  it("binds by period time with no clue (TJ 2026-11-25: a penalty clue is optional)", () => {
    const result = run({ clue: null });
    expect(result).toMatchObject({ status: "bound", gameId: 2026020356 });
    expect(result.evidence).toEqual(expect.arrayContaining(["binding_basis:period_time", "personnel_verified_no_penalty_clue", "faceoff_before_publication:unverified"]));
    expect(result.evidence.some((item) => item.startsWith("nhl_penalty:"))).toBe(false);
  });
  it("refuses a clue matching a different penalty", () => {
    expect(run({ clue: { ...clue, infraction: "tripping" } })).toEqual({ status: "unresolved", evidence: ["clue_match_count:0"] });
  });
  it("refuses two matching penalties", () => {
    const duplicate = { ...base.penalties.find((item) => item.eventId === 320)!, eventId: 9320, order: 100, period: 1, elapsed: "05:00" };
    expect(run({ evidence: { ...base, penalties: [...base.penalties, duplicate] } })).toEqual({ status: "unresolved", evidence: ["clue_match_count:2"] });
  });
  it("ignores a matching penalty called after the post, so later passes agree", () => {
    const later = { ...base.penalties.find((item) => item.eventId === 320)!, eventId: 9321, order: 700, period: 3, elapsed: "05:00" };
    const opportunities = [...base.opportunities, { penaltyEventId: 9321, beneficiaryTeamId: 21, fromOrder: 700, toOrder: 720, endedBy: "expiry" as const }];
    const observations = [...base.observations, { ...base.observations.find((item) => item.eventId === 315)!, eventId: 9999, order: 710, period: 3, elapsed: "05:00" }];
    const result = run({ evidence: { ...base, penalties: [...base.penalties, later], opportunities, observations, faceoffEventIds: [...base.faceoffEventIds, 9999] } });
    expect(result).toEqual(run());
  });
  it("lists only faceoffs that could precede the post", () => {
    const span = base.opportunities.find((item) => item.penaltyEventId === 320)!;
    const late = { ...base.observations.find((item) => item.eventId === 315)!, eventId: 9998, order: span.toOrder - 1, period: 1, elapsed: "19:59" };
    const result = run({ claim: withTime(curtisClaim, "2026-11-20T02:23:00.000Z"), evidence: { ...base, observations: [...base.observations, late], faceoffEventIds: [...base.faceoffEventIds, 9998] } });
    expect(result.status).toBe("bound");
    expect(result.evidence).not.toContain("nhl_pp_faceoff:9998");
  });
  it("refuses two live games", () => {
    const other: LineGame = { ...game0356, id: 2026029999, awayTeamId: 8, actualStart: "2026-11-20T02:05:00Z", phase: "live", scheduleIdentity: "other" };
    expect(run({ games: [game0356, other] })).toEqual({ status: "unresolved", evidence: ["live_game_count:2"] });
  });
  it("refuses a relay's own post clock as the original time", () => {
    const relayed = { ...curtisClaim, publicationEvidence: ["publication_basis:provider_timestamp", "relay_own_post_clock"],
      provenance: { relayTweetId: "1", originalTweetId: null, attributionStatus: "pending" as const } };
    expect(run({ claim: relayed })).toEqual({ status: "unresolved", evidence: ["not_qualifying"] });
  });
  it("refuses a delayed relay without a verified original time", () => {
    const claim = { ...curtisClaim, time: { ...curtisClaim.time, originalPublishedAt: null } };
    expect(run({ claim }).status).toBe("unresolved");
  });
  it("refuses a post after puck drop but before the clue's penalty could have happened", () => {
    expect(run({ claim: withTime(curtisClaim, "2026-11-20T02:15:00.000Z") })).toEqual({ status: "unresolved", evidence: ["clue_match_count:0"] });
  });
  it("refuses a post after the penalty but before the earliest matching faceoff", () => {
    const observations = base.observations.map((item) => item.eventId === 315 ? { ...item, elapsed: "14:40" } : item);
    expect(run({ claim: withTime(curtisClaim, "2026-11-20T02:22:30.000Z"), evidence: { ...base, observations } })).toEqual({ status: "unresolved", evidence: ["faceoff_after_publication"] });
  });
  it("refuses a five found only after the opportunity ended", () => {
    const span = base.opportunities.find((item) => item.penaltyEventId === 320)!;
    const five = new Set(curtisClaim.unit!.players.map((player) => player.playerId));
    const observations = base.observations.map((item) => item.players.every((player) => five.has(player.playerId)) ? { ...item, order: span.toOrder + 1 } : item);
    expect(run({ evidence: { ...base, observations } })).toEqual({ status: "unresolved", evidence: ["five_not_on_ice"] });
  });
  it("is pending when the opportunity end is unknown", () => {
    const opportunities = base.opportunities.map((item) => item.penaltyEventId === 320 ? { ...item, endedBy: "unknown" as const } : item);
    expect(run({ evidence: { ...base, opportunities } })).toEqual({ status: "pending", evidence: ["opportunity_end_unknown"] });
  });
  it("is pending without a period anchor", () => {
    const games = [{ ...game0356, actualStart: "2026-11-20T02:09:00Z" }];
    expect(run({ games, evidence: { ...base, periods: [] } })).toEqual({ status: "pending", evidence: ["period_anchor_missing"] });
  });
  it("refuses a post during the final", () => {
    expect(run({ claim: withTime(curtisClaim, "2026-11-20T04:40:00.000Z") })).toEqual({ status: "unresolved", evidence: ["live_game_count:0"] });
  });
  it("is pending when NHL data is missing", () => {
    expect(run({ games: [{ ...game0356, actualStart: "2026-11-20T02:09:00Z", phase: "live" }], evidence: null })).toEqual({ status: "pending", evidence: ["nhl_corroboration_pending"] });
  });
  it("binds on a drawn-by clue naming our player", () => {
    expect(run({ clue: { committedByPlayerId: null, drawnByPlayerId: 8484258, infraction: null, evidence: [] } }).status).toBe("bound");
  });
  it("refuses a clue naming the penalty drawn by a player who drew none", () => {
    expect(run({ clue: { committedByPlayerId: null, drawnByPlayerId: 8475172, infraction: null, evidence: [] } })).toEqual({ status: "unresolved", evidence: ["clue_match_count:0"] });
  });
  it("leaves a non-qualifying claim alone", () => {
    expect(run({ claim: { ...curtisClaim, phase: "pregame" } }).status).toBe("unresolved");
    expect(run({ claim: { ...curtisClaim, binding: { ...curtisClaim.binding, status: "bound" } } }).status).toBe("unresolved");
  });
});

describe("corroborateInGamePP by period time (Silber PP1, PHI@WSH 2026020392)", () => {
  const official = officialPowerPlayEvidence(game0392, pbp0392, html0392, url0392)!;
  const names = ["Dylan Strome", "Tom Wilson", "Justin Sourdif", "Jakob Chychrun", "Alex Ovechkin"];
  // The claim as intake builds it: no session context in the text, so phase unknown until timing settles it.
  const silber: LineClaim = { ...curtisClaim, id: "silber-pp1", captureId: "capture:silber", teamId: 15, gameId: null, phase: "unknown", context: undefined, specificity: "practice",
    text: silberText, sourceUrl: silberUrl, author: "sammisilber", originalAuthor: "sammisilber", originalIdentity: "2125747628642336776", publicationEvidence: ["publication_basis:provider_timestamp"],
    provenance: { relayTweetId: "2125747628642336776", originalTweetId: "2125747628642336776", attributionStatus: "resolved" },
    time: { ...curtisClaim.time, originalPublishedAt: silberPostedAt, effectiveAt: silberPostedAt },
    binding: { status: "unresolved", evidence: ["no_game_binding_evidence"], resolverVersion: "2026-11-18.1", scheduleIdentity: null },
    unit: { situation: "pp", number: 1, explicitNumber: true, complete: true, group: null, players: silberFive.map((playerId, i) => ({ playerId, name: names[i]! })), evidence: [] } };
  const at = (value: string) => ({ ...silber, time: { ...silber.time, originalPublishedAt: value, effectiveAt: value } });
  const bind = (claim = silber, evidence: OfficialPowerPlayEvidence | null = official, games = [game0392]) =>
    corroborateInGamePP(claim, games, (id) => id === game0392.id ? evidence : null, null);
  const expected = ["live_game:2026020392", "binding_basis:period_time", "nhl_period:1:2026-11-26T00:17:00Z",
    "nhl_pp_on_ice:124", "nhl_pp_on_ice:201", "nhl_pp_on_ice:158", "nhl_pp_on_ice:10", `nhl_report:${url0392}`,
    "personnel_verified_no_penalty_clue", "faceoff_before_publication:unverified"];

  it("binds the exact five to 0392 inside P1 (00:17–00:52Z), listing only on-ice events that could precede the post", () => {
    expect(bind()).toEqual({ status: "bound", gameId: 2026020392, scheduleIdentity: game0392.scheduleIdentity, evidence: expected,
      metadata: ["nhl_period_window:1:2026-11-26T00:17:00Z/2026-11-26T00:52:00Z"] });
  });
  it("gives the same result from a report read earlier, during P1", () => {
    const early = { ...official, periods: [{ ...official.periods[0]!, endedAt: null }], observations: official.observations.filter((item) => item.period === 1 && item.elapsed <= "09:00") };
    const result = bind(silber, early);
    expect(result.evidence).toEqual(expected);
    expect(result).toMatchObject({ metadata: ["nhl_period_window:1:2026-11-26T00:17:00Z/open"] });
  });
  it("binds the same way on a reprocess after the game, once the report has its game-end anchor", () => {
    const final = { ...game0392, phase: "final" as const, actualStart: null };
    expect(bind(silber, { ...official, gameEndedAt: "2026-11-26T02:45:00Z" }, [final])).toMatchObject({ status: "bound", evidence: expected });
    // Without the game-end anchor a final game's span is unknown.
    expect(bind(silber, official, [final])).toEqual({ status: "pending", evidence: ["nhl_corroboration_pending"] });
  });
  it("refuses a wrong five", () => {
    const players = silber.unit!.players.map((player) => player.playerId === 8471214 ? { playerId: 8477949, name: "Alex Tuch" } : player);
    const final = { ...game0392, phase: "final" as const };
    expect(bind({ ...silber, unit: { ...silber.unit!, players } }, { ...official, gameEndedAt: "2026-11-26T02:45:00Z" }, [final])).toEqual({ status: "unresolved", evidence: ["five_not_on_ice"] });
    // While the game is live the report may still be catching up.
    expect(bind({ ...silber, unit: { ...silber.unit!, players } })).toEqual({ status: "pending", evidence: ["nhl_corroboration_pending"] });
  });
  it("refuses a post in the intermission or in the first minute of a period", () => {
    expect(bind(at("2026-11-26T01:00:00.000Z"))).toEqual({ status: "unresolved", evidence: ["publication_outside_period"] });
    expect(bind(at("2026-11-26T00:17:30.000Z"))).toEqual({ status: "unresolved", evidence: ["publication_outside_period"] });
  });
  it("is pending when the period's end is not yet anchored in a report that is not current", () => {
    const stale = { ...official, periods: [{ ...official.periods[0]!, endedAt: null }, official.periods[1]!] };
    expect(bind(silber, stale)).toEqual({ status: "pending", evidence: ["period_end_unknown"] });
  });
  it("is pending without period anchors or NHL data", () => {
    expect(bind(silber, { ...official, periods: [] })).toEqual({ status: "pending", evidence: ["period_anchor_missing"] });
    expect(bind(silber, null)).toEqual({ status: "pending", evidence: ["nhl_corroboration_pending"] });
  });
  it("refuses two live games", () => {
    const other: LineGame = { ...game0392, id: 2026029998, awayTeamId: 8, scheduleIdentity: "other" };
    expect(bind(silber, official, [game0392, other])).toEqual({ status: "unresolved", evidence: ["live_game_count:2"] });
  });
  it("refuses a delayed relay without the original time, and a relay's own clock", () => {
    expect(bind({ ...silber, time: { ...silber.time, originalPublishedAt: null } })).toEqual({ status: "unresolved", evidence: ["not_qualifying"] });
    expect(bind({ ...silber, publicationEvidence: ["relay_own_post_clock"] })).toEqual({ status: "unresolved", evidence: ["not_qualifying"] });
  });
  it("leaves stated practice, warm-up or projected context alone", () => {
    for (const context of ["practice", "warmup", "projected"] as const) expect(bind({ ...silber, context })).toEqual({ status: "unresolved", evidence: ["not_qualifying"] });
    expect(bind({ ...silber, phase: "pregame" })).toEqual({ status: "unresolved", evidence: ["not_qualifying"] });
  });
});
