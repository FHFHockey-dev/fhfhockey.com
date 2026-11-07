import { describe, expect, it, vi } from "vitest";
// The existing resolver is server-owned. Its storage import must never run in these offline tests.
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("No database reads in card tests"); } } }));
import { resolveDailyBoardEvidence, type BoardConflict, type BoardGoalieEvidence } from "../projections/dailyBoardEvidence";
import { GOALIE_INVENTORY_FIXTURE } from "../socialShare/modules/shared/goalieInventory.fixture";
import { goalieFixture, sharedGoalieFixture } from "./analysisFixtures";
import { sharedGoalieOutlook } from "./sharedGoalieOutlook";

const selected = goalieFixture().player;
describe("frozen shared goalie inventory consumer", () => {
  it("consumes the producer's handoff fixture without losing pooled metrics or promoting conflicts", () => {
    const fixture = GOALIE_INVENTORY_FIXTURE;
    const player = (id: number, team: string) => ({ ...selected, id, team, season: fixture.season });
    const njd = sharedGoalieOutlook(fixture, player(7001, "NJD"), "fixture");
    expect(njd.state).toBe("fixture");
    expect(njd.games[0].confirmation).toContain("confirmed");
    expect(njd.games[0].forecast).toContain("unavailable");
    expect(njd.games[0].dimensions.find(d => d.label === "Opponent shots for")?.text).toMatch(/^26 /);
    expect(njd.games[0].dimensions.find(d => d.label === "Team shots against")?.text).toMatch(/^26\.5 /);
    expect(njd.games[0].dimensions.find(d => d.label === "Team goal differential")?.text).toMatch(/^1\.5 /);
    expect(sharedGoalieOutlook(fixture, player(7004, "MTL"), "fixture").games[0].forecast).toContain("62.0%");
    const tor = sharedGoalieOutlook(fixture, player(7005, "TOR"), "fixture");
    expect(tor.games.find(g => g.id === 900012)?.confirmation).toContain("No current resolved");
    expect(tor.sharedProvenance?.sourceNotes.join(" ")).toMatch(/conflict/i);
    expect(tor.games[0].forecast).toContain("unavailable");
  });
  it("preserves independent dimensions, missing values, negative goal differential and source provenance", () => {
    const result = sharedGoalieOutlook(sharedGoalieFixture(), selected, "fixture");
    expect(result.state).toBe("fixture"); expect(result.games[0].dimensions).toHaveLength(12);
    expect(new Set(result.games[0].dimensions.map(d => d.group)).size).toBe(3);
    expect(result.games[0].dimensions.find(d => d.label === "Team xGA")?.text).toContain("Unavailable");
    expect(result.games[0].dimensions.find(d => d.label === "Team goal differential")?.text).toContain("-0.3");
    expect(result.sharedProvenance?.sourceNotes[0]).toContain("player_forecast_goalie_start_observations");
    expect(result.sharedProvenance?.recentStarts).toMatchObject({ starts: 6, reliefAppearances: 1, share: 0.6 });
    expect(result.games[0].forecast).not.toContain("60%");
  });
  it("rejects stale/mismatched/duplicate schedules and never admits observed inventory", () => {
    const f = sharedGoalieFixture();
    expect(sharedGoalieOutlook(f, { ...selected, team: "TOR" }, "fixture").state).toBe("unavailable");
    expect(sharedGoalieOutlook(f, { ...selected, season: 20252026 }, "fixture").state).toBe("unavailable");
    expect(sharedGoalieOutlook(f, selected, "observed" as "fixture").state).toBe("unavailable");
    f.state = "stale"; expect(sharedGoalieOutlook(f, selected, "fixture").state).toBe("unavailable");
    f.state = "partial"; f.goalies[0].games.push(f.goalies[0].games[0]);
    expect(sharedGoalieOutlook(f, selected, "fixture").state).toBe("unavailable");
    f.goalies[0].games.pop(); f.goalies[0].games[0].date = "2026-11-40";
    expect(sharedGoalieOutlook(f, selected, "fixture").state).toBe("unavailable");
  });
  it("keeps confirmation separate from forecasts and rejects expired or future evidence", () => {
    const f = sharedGoalieFixture(), game = f.goalies[0].games[0];
    game.confirmation = { state: "confirmed", source: "Fixture original reporter", sourceUrl: "https://example.test/fixture", observedAt: "2026-10-31T11:00:00Z", expiresAt: "2026-10-31T12:00:00Z" };
    expect(sharedGoalieOutlook(f, selected, "fixture").games[0].confirmation).toContain("No current resolved");
    game.confirmation.expiresAt = "2026-11-01T12:00:00Z";
    const r = sharedGoalieOutlook(f, selected, "fixture");
    expect(r.games[0].confirmation).toContain("https://example.test/fixture");
    expect(r.games[0].forecast).toContain("unavailable");
    game.confirmation.observedAt = "2026-10-31T13:00:00Z";
    expect(sharedGoalieOutlook(f, selected, "fixture").games[0].confirmation).toContain("No current resolved");
  });
  it("uses only a qualified unexpired Start Chart fixture, without borrowing workload share", () => {
    const f = sharedGoalieFixture(), game = f.goalies[0].games[0];
    game.forecast = { state: "qualified", startProbability: 0.75, revisionId: "fixture-v1", modelLabel: "Fixture", issuedAt: "2026-10-31T11:00:00Z", expiresAt: "2026-11-01T12:00:00Z" };
    expect(sharedGoalieOutlook(f, selected, "fixture").games[0].forecast).toContain("75.0%");
    game.forecast.expiresAt = f.generatedAt;
    expect(sharedGoalieOutlook(f, selected, "fixture").games[0].forecast).toContain("unavailable");
  });
});

const cutoff = "2026-10-31T12:00:00Z";
const row = (patch: Partial<BoardGoalieEvidence> = {}): BoardGoalieEvidence => ({ id: "gdl-1", game_id: 2026020200, team_id: 14, player_id: 8476883, observation_status: "confirmed", observed_at: "2026-10-31T11:00:00Z", available_at: "2026-10-31T11:01:00Z", created_at: "2026-10-31T11:02:00Z", expires_at: "2026-11-02T02:00:00Z", accepted: true, source_key: "tweet_projection", source_account: "GameDayGoalies", source_url: "https://example.test/fixture-original", ...patch });
const resolve = (goalies: BoardGoalieEvidence[], conflicts: BoardConflict[] = []) => resolveDailyBoardEvidence({ cutoff, lineups: [], goalies, conflicts });
describe("reuse of existing dailyBoardEvidence goalie semantics (offline)", () => {
  it("does not turn IFTTT and table copies or repost counts into multiple votes", () => {
    const r = resolve([row(), row(), row({ id: "repost", source_key: "ifttt" })]);
    expect(r.assertions).toHaveLength(1); expect(r.conflicts).toHaveLength(0);
    expect(r.assertions[0]).toMatchObject({ sourceKey: "GameDayGoalies", sourceUrl: "https://example.test/fixture-original", playerId: 8476883 });
    expect(r.informationCutoffAt).toBe(cutoff);
  });
  it("uses the original reporter's latest publication, regardless of arrival order", () => {
    const r = resolve([row({ id: "newer", player_id: 999, observed_at: "2026-10-31T11:30:00Z", available_at: "2026-10-31T11:31:00Z", created_at: "2026-10-31T11:32:00Z" }), row({ available_at: "2026-10-31T11:50:00Z", created_at: "2026-10-31T11:51:00Z" })]);
    expect(r.assertions).toHaveLength(1); expect(r.assertions[0].playerId).toBe(999);
  });
  it("withholds expired, unaccepted, invalid and not-yet-known observations", () => {
    const r = resolve([row({ expires_at: cutoff }), row({ accepted: false }), row({ observed_at: "invalid" }), row({ available_at: "2026-10-31T12:01:00Z" }), row({ created_at: "2026-10-31T12:01:00Z" })]);
    expect(r.assertions).toEqual([]);
  });
  it("withholds conflicting starters until a review was known at the cutoff", () => {
    const inputs = [row(), row({ id: "second", source_account: "Independent reporter", player_id: 999, observed_at: "2026-10-31T11:05:00Z", available_at: "2026-10-31T11:06:00Z", created_at: "2026-10-31T11:07:00Z" })];
    expect(resolve(inputs).conflicts).toHaveLength(1); expect(resolve(inputs).assertions).toEqual([]);
    const conflict: BoardConflict = { id: "conflict", game_id: 2026020200, team_id: 14, player_id: null, conflict_type: "goalie_start", detected_at: "2026-10-31T11:10:00Z", player_forecast_conflict_resolutions: [{ action: "select_observation", selected_observation_id: "second", resolved_at: "2026-10-31T11:20:00Z", created_at: "2026-10-31T12:01:00Z" }] };
    expect(resolve(inputs, [conflict]).assertions).toEqual([]);
    conflict.player_forecast_conflict_resolutions[0].created_at = "2026-10-31T11:21:00Z";
    expect(resolve(inputs, [conflict]).assertions[0].evidenceId).toBe("second");
  });
});
