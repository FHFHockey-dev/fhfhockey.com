import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { applyNativeDailyReview, buildDailyMaterializationRequest, buildDailyParticipationInputs, dailyExpiresAt, dailyGames, dailyScheduleBindings,
  reobserveHistoryWindow, type HttpReceipt } from "./nativeDailyPipeline";
import { buildRosterObservationSkaterParticipationReceipt, type RosterObservationSkaterParticipationInput } from "./modeledSkaterParticipation";
import { normalizeNhlGameToTeamRows } from "../rosterScheduleData/normalize";
import { normalizePlanningGames } from "../rosterScheduleData/planningInputs";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import { captureOriginals, morningDueAt } from "../../scripts/forge-daily";

const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const receipt = (url: string, body: unknown, capturedAt = "2026-10-20T10:00:00.000Z"): HttpReceipt => {
  const rawBody = JSON.stringify(body); return { url, capturedAt, bodySha256: sha(rawBody), rawBody };
};
const game = (id: number, start: string, extra: Record<string, unknown> = {}) => ({ id, season: 20262027, gameType: 2, startTimeUTC: start,
  gameState: "FUT", gameScheduleState: "OK", homeTeam: { id: 1, abbrev: "AAA" }, awayTeam: { id: 2, abbrev: "BBB" }, ...extra });
const week = (games: any[]) => ({ gameWeek: [{ date: "2026-10-20", games: games.filter(g => g.startTimeUTC < "2026-10-21T04:00:00Z") },
  { date: "2026-10-21", games: games.filter(g => g.startTimeUTC >= "2026-10-21T04:00:00Z") }] });
const yahoo = { gameKey: "477", season: "2026" };

const old = { id: "synthetic-only", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
function template(knownConflict: boolean | null): RosterObservationSkaterParticipationInput {
  const eligibility = () => ({ playerId: 7, nhlPlayerId: 77, teamId: 1, eligible: true, effectiveFrom: "2026-09-29T04:00:00Z", effectiveUntil: "2026-10-16T00:00:00Z", evidence: old });
  return { version: "skater-roster-observation-participation-input-v1", playerClass: "skater", cutoffAt: "2026-10-16T10:00:00Z",
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30, scheduledAt: "2026-10-17T23:00:00Z", scheduleRevision: "old", rosterRevision: "roster-a" },
    scheduleEvidence: old, rosterEvidence: old,
    targetRosterObservation: { playerId: 7, nhlPlayerId: 77, teamId: 1, seasonId: 20262027, listed: true, sourceKind: "official_season_roster",
      knownConflict, continuationAssumptionVersion: "fresh-official-season-roster-continuation-v1", evidence: old },
    history: { complete: true, windowStartAt: "2026-09-29T04:00:00Z", windowEndAt: "2026-10-13T04:00:00Z", scheduleEvidence: old,
      games: [2, 6, 10].map((day, index) => ({ gameId: 10 + index, teamId: 1, scheduledAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`, occurred: true,
        positiveMinutes: index !== 1, resolution: index === 1 ? "complete_official_nonappearance" as const : "positive_toi" as const,
        outcomeEvidence: old, eligibility: eligibility() })) } };
}
const daysFrom = (start: string) => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
const weekOf = (start: string, games: any[], at = "2026-10-20T10:00:00.000Z") => receipt(`https://api-web.nhle.com/v1/schedule/${start}`,
  { gameWeek: daysFrom(start).map(date => ({ date, games: games.filter(g => g.day === date).map(({ day: _d, ...g }) => g) })) }, at);
const frameGame = (id: number, day: string) => ({ ...game(id, `${day}T00:00:00Z`, { gameState: "OFF", homeTeam: { id: 1, abbrev: "TST" } }), day: new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) });

describe("v1 daily FORGE driver (synthetic)", () => {
  it("binds the next scheduled club games after the cutoff with the hosted schedule revision", () => {
    const games = [game(11, "2026-10-20T09:00:00Z"), game(12, "2026-10-20T23:00:00Z"), game(13, "2026-10-21T23:00:00Z", { gameScheduleState: "PPD" }),
      game(14, "2026-10-22T00:00:00Z", { gameType: 1 })];
    const source = receipt("https://api-web.nhle.com/v1/schedule/2026-10-20", week(games));
    const bindings = dailyScheduleBindings([source], "2026-10-20T10:00:00.000Z", yahoo);
    expect(bindings.byTeam.get("AAA")!.map(row => row.id)).toEqual(["12"]);
    expect(bindings.exclusions).toEqual([{ gameId: 13, status: "postponed" }]);
    // Same content-only revision a hosted roster_optimizer_team_games row produces for that game.
    const rows = normalizeNhlGameToTeamRows({ game: { ...games[1], gameDate: "2026-10-20" } as any, fetchedAt: "2026-10-01T00:00:00Z",
      sourceUrl: "https://elsewhere.invalid", gameKey: "477", yahooSeason: "2026", mapping: { status: "unmapped", reason: "no_week" } });
    expect(bindings.byTeam.get("AAA")![0].scheduleRevision).toBe(normalizePlanningGames(rows, "America/New_York").find(row => row.teamAbbreviation === "AAA")!.scheduleRevision);
    expect(dailyGames(bindings, "2026-10-20")).toEqual([{ gameId: 12, startsAt: "2026-10-20T23:00:00.000Z" }]);
    const conflicting = receipt("https://api-web.nhle.com/v1/schedule/2026-10-21", week([game(12, "2026-10-20T23:30:00Z")]));
    expect(() => dailyScheduleBindings([source, conflicting], "2026-10-20T10:00:00.000Z", yahoo)).toThrow("schedule_source_conflict");
    const tampered = { ...source, rawBody: source.rawBody.replace("AAA", "AAB") };
    expect(() => dailyScheduleBindings([tampered], "2026-10-20T10:00:00.000Z", yahoo)).toThrow("invalid_original_receipt");
    expect(() => dailyScheduleBindings([source], "2026-10-20T09:59:00.000Z", yahoo)).toThrow("invalid_original_receipt");
  });

  it("re-observes the frozen window so scope evidence is current, and fails closed when the frame changed", () => {
    const cutoffAt = "2026-10-20T11:00:00.000Z";
    const weeks = [weekOf("2026-09-29", [frameGame(10, "2026-10-02"), frameGame(11, "2026-10-06")]), weekOf("2026-10-06", [frameGame(12, "2026-10-10")])];
    const history = reobserveHistoryWindow({ retained: [template(null)], weeks, cutoffAt });
    expect(history.evidence).toMatchObject({ capturedAt: cutoffAt, availableAt: cutoffAt });
    expect(history.parent.derived.parentHashes).toEqual(weeks.map(week => week.bodySha256));
    expect(() => reobserveHistoryWindow({ retained: [template(null)], weeks: [weeks[0]], cutoffAt })).toThrow("history_window_not_fully_reobserved");
    const moved = [weeks[0], weekOf("2026-10-06", [frameGame(12, "2026-10-09")])];
    expect(() => reobserveHistoryWindow({ retained: [template(null)], weeks: moved, cutoffAt })).toThrow("history_frame_changed");
    const roster = receipt("https://api-web.nhle.com/v1/roster/TST/20262027", { forwards: [{ id: 77 }], defensemen: [], goalies: [] }, "2026-10-20T10:30:00.000Z");
    const future = weekOf("2026-10-20", [{ ...game(40, "2026-10-20T23:00:00Z", { homeTeam: { id: 1, abbrev: "TST" } }), day: "2026-10-20" }]);
    const bindings = dailyScheduleBindings([future], cutoffAt, yahoo);
    const issuance = { issuedAt: "2026-10-20T12:10:00.000Z", expiresAt: "2026-10-20T22:59:59.999Z" };
    const build = (conflict: boolean | null) => buildDailyParticipationInputs({ retained: [template(conflict)], rosterReceipts: [roster], bindings,
      historyEvidence: history.evidence, cutoffAt, seasonId: 20262027 });
    const fresh = build(false), input = fresh.inputs[0] as RosterObservationSkaterParticipationInput;
    expect(fresh.inputs).toHaveLength(1);
    expect(input).toMatchObject({ cutoffAt, scope: { gameId: 40, rosterRevision: "roster-a" }, history: { scheduleEvidence: history.evidence },
      targetRosterObservation: { listed: true, knownConflict: null } });
    expect(input.history.games).toEqual(template(false).history.games);
    expect(buildRosterObservationSkaterParticipationReceipt(input, issuance)).toMatchObject({ probability: 2 / 3, reasons: [] });
    // The unrefreshed Oct 16 manifest would make every receipt stale once 24 hours pass.
    expect(buildRosterObservationSkaterParticipationReceipt({ ...input, history: { ...input.history, scheduleEvidence: old } }, issuance).reasons).toContain("stale_scope_evidence");
    const conflicted = build(true).inputs[0] as RosterObservationSkaterParticipationInput;
    expect(buildRosterObservationSkaterParticipationReceipt(conflicted, issuance)).toMatchObject({ probability: null, reasons: ["known_current_roster_conflict"] });
    expect(build(null).coverage).toEqual([expect.objectContaining({ playerId: 7, games: 1, reasons: [] })]);
    expect(buildDailyParticipationInputs({ retained: [template(null)], rosterReceipts: [], bindings, historyEvidence: history.evidence, cutoffAt, seasonId: 20262027 }).coverage[0].reasons)
      .toEqual(["missing_official_club_roster"]);
  });

  it("expires at twelve hours or one millisecond before the first bound game, never at or before issuance", () => {
    const at = (scheduledAt: string) => ({ scope: { scheduledAt } }) as any;
    expect(dailyExpiresAt("2026-10-20T12:30:00.000Z", [at("2026-10-20T23:00:00.000Z"), at("2026-10-22T00:00:00.000Z")])).toBe("2026-10-20T22:59:59.999Z");
    expect(dailyExpiresAt("2026-10-20T08:00:00.000Z", [at("2026-10-21T00:00:00.000Z")])).toBe("2026-10-20T20:00:00.000Z");
    expect(dailyExpiresAt("2026-10-20T12:30:00.000Z", [at("2026-10-20T12:00:00.000Z")])).toBe("2026-10-21T00:30:00.000Z");
    expect(() => dailyExpiresAt("2026-10-20T12:30:00.000Z", [at("2026-10-20T12:30:00.001Z")])).toThrow("no_valid_daily_expiry");
  });

  it("resolves the 08:00 New York due time across daylight saving", () => {
    expect(morningDueAt("2026-10-20")).toBe("2026-10-20T12:00:00.000Z");
    expect(morningDueAt("2026-12-01")).toBe("2026-12-01T13:00:00.000Z");
  });

  it("keeps only retained parents that frozen inputs reach, adds fresh receipts and rebinds the run", () => {
    const parent = (id: string, extra: any = {}) => ({ id: `http:${id}`, hash: id, availableAt: "2026-10-16T01:00:00Z", capturedAt: "2026-10-16T01:00:00Z", ...extra });
    const [kept, ancestor, dropped] = ["a", "b", "c"].map(letter => letter.repeat(64));
    const retained: any = { runId: "x", sourceKey: "old", date: "2026-10-16", closureScopeHash: "0".repeat(64), nativeSelection: [],
      acquisition: { seasonId: 20262027, cutoffAt: "2026-10-16T07:00:00Z", roster: [], games: [], receipts: [] },
      parents: [parent(kept, { derived: { payload: {}, parentHashes: [ancestor] } }), parent(ancestor, { original: { url: "https://api-web.nhle.com/v1/x" } }), parent(dropped, { original: { url: "https://api-web.nhle.com/v1/y" } })],
      requiredParents: [], additionalNativeObservations: [{ payload: { evidence: { contentHash: kept } } }], existingInputs: [] };
    const fresh = receipt("https://api-web.nhle.com/v1/roster/AAA/20262027", { forwards: [] });
    const bound = buildDailyMaterializationRequest({ retained, freshReceipts: [fresh], participationInputs: [], cutoffAt: "2026-10-20T10:00:00.000Z",
      runId: "00000000-0000-4000-8000-000000000001", date: "2026-10-20", sourceKey: "native-daily-selected-inputs", seasonId: 20262027, games: [] });
    expect(bound.request.parents!.map(value => value.hash).sort()).toEqual([kept, ancestor, fresh.bodySha256].sort());
    expect(bound.droppedParents).toBe(1);
    expect(bound.request.requiredParents!.find(value => value.hash === fresh.bodySha256)).toMatchObject({ url: fresh.url, capturedAt: fresh.capturedAt });
    expect(bound.request).toMatchObject({ runId: "00000000-0000-4000-8000-000000000001", date: "2026-10-20", closureScopeHash: bound.closureScopeHash,
      acquisition: { cutoffAt: "2026-10-20T10:00:00.000Z" } });
    expect(retained.acquisition.cutoffAt).toBe("2026-10-16T07:00:00Z");
    // A fresh body identical to a still-referenced retained parent cannot carry two clocks under one hash.
    const reused = structuredClone(retained);
    reused.parents[0].hash = fresh.bodySha256; reused.additionalNativeObservations[0].payload.evidence.contentHash = fresh.bodySha256;
    expect(() => buildDailyMaterializationRequest({ retained: reused, freshReceipts: [fresh], participationInputs: [], cutoffAt: "2026-10-20T10:00:00.000Z",
      runId: "00000000-0000-4000-8000-000000000001", date: "2026-10-20", sourceKey: "s", seasonId: 20262027, games: [] })).toThrow("fresh_receipt_collides_with_retained_parent");
  });

  it("applies only an explicit approval of the exact plan and moves review clocks to the review time", () => {
    const row = (kind: string, payload: any) => ({ id: "00000000-0000-4000-8000-000000000009", provider: "fhfh", dataset_key: kind, entity_kind: kind,
      entity_key: "20262027", source_url: null, source_revision_key: null, observed_at: "2026-10-20T12:10:00.000Z", available_at: "2026-10-20T12:10:00.000Z",
      payload_hash: hash(payload), payload, metadata: {} });
    const plan: any = { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: [
      row("baseline_validation_review", { status: "pending_independent_review", eligible: false, ownerApprovalRef: "", reviewedAt: null }),
      row("participation_bundle", { reviewRef: "", entries: [] })] };
    const decision = { version: "native-daily-review-decision-v1" as const, planHash: hash(plan), decision: "approve" as const, reviewer: "r",
      reviewRef: "review:1", reviewedAt: "2026-10-20T12:20:00.000Z", findings: [] };
    const reviewed = applyNativeDailyReview(plan, decision);
    expect(reviewed.rows[0]).toMatchObject({ available_at: decision.reviewedAt, observed_at: decision.reviewedAt,
      payload: { status: "owner_approved", eligible: true, ownerApprovalRef: "review:1", reviewedAt: decision.reviewedAt } });
    expect(reviewed.rows[1].payload).toMatchObject({ reviewRef: "review:1" });
    expect(reviewed.rows.every(value => value.payload_hash === hash(value.payload))).toBe(true);
    expect(() => applyNativeDailyReview(plan, { ...decision, planHash: "f".repeat(64) })).toThrow("review_decision_plan_mismatch");
    expect(() => applyNativeDailyReview(plan, { ...decision, decision: "reject" })).toThrow("review_rejected");
    expect(() => applyNativeDailyReview(plan, { ...decision, reviewedAt: "2026-10-20T12:09:59.999Z" })).toThrow("review_precedes_issuance");
  });

  it("captures only allowlisted NHL URLs serially, records intent first and stops at the first failure without retrying", async () => {
    const events: Array<{ action: string }> = [], waits: number[] = [];
    const urls = ["https://api-web.nhle.com/v1/roster/AAA/20262027", "https://api-web.nhle.com/v1/schedule/2026-10-20", "https://api-web.nhle.com/v1/roster/BBB/20262027"];
    const network = vi.fn(async (url: any) => url.endsWith("2026-10-20") ? new Response("busy", { status: 503 }) : new Response(JSON.stringify({ forwards: [] })));
    const result = await captureOriginals(urls, action => events.push({ action }), network as any, async ms => { waits.push(ms); });
    expect(network).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ attempted: 2, failures: [{ url: urls[1] }] });
    expect(result.receipts).toHaveLength(1);
    expect(events.map(event => event.action)).toEqual(["request_intent", "response_completed", "request_intent", "response_completed", "request_failed"]);
    expect(waits).toEqual([1000]);
    await expect(captureOriginals(["https://api-web.nhle.com/v1/gamecenter/2026020120/boxscore"], () => {}, network as any)).rejects.toThrow("capture_scope_denied");
    await expect(captureOriginals([urls[0], urls[0]], () => {}, network as any)).rejects.toThrow("capture_scope_denied");
  });
});
