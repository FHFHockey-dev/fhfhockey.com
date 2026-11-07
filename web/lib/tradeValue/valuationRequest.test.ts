import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GameExpectationsResponse } from "lib/player-forecasts/gameExpectations";
import { leagueValuationComponents } from "./valuationComponents";
import { datedAdp, qualifiedValuationComponents, type AdpHistoryRow, type IdentityRow, type ValuationInputs, type ValuationRequest } from "./valuationRequest";

// SYNTHETIC fixtures only: they exercise binding and withholding, never real admission, identity or Yahoo data.
const cutoff = "2026-11-04T12:00:00Z";
const player = "8400001";
const view: GameExpectationsResponse = {
  version: "forge-game-expectations-v1", readAsOf: cutoff,
  scope: { seasonId: 20262027, startDate: "2026-11-05", endDate: "2026-11-20", timeZone: "America/New_York", mode: "next_n", games: 5 },
  manifestId: null, baselineChecksum: null, limitations: ["Synthetic adapter check only"],
  players: [{ playerId: player, nhlPlayerId: 1, teamId: 1, name: "Synthetic", team: "SYN", playerClass: "skater", positions: ["C"],
    scheduledOpportunities: 5, requestedGames: 5, horizonComplete: true, expectedAppearances: null, expectedStarts: null,
    games: Array.from({ length: 5 }, (_, i) => ({ gameId: `synthetic-${i}`, date: "2026-11-05", scheduledAt: "2026-11-05T12:00:00Z",
      team: "SYN", opponent: "OTHER", homeTeam: "SYN", awayTeam: "OTHER", scheduleRevision: "synthetic-schedule", rosterRevision: "synthetic-roster",
      appearanceProbability: null, startProbability: null, powerPlayRole: { value: null, status: "unavailable" as const, reason: "current_role_evidence_unavailable" as const, source: null }, limitations: [],
      targets: { GOALS: { expected: 1, conditional: null, basis: "unconditional_game", unit: "count" as const, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: false }, sourceKind: null,
        sourceIds: ["synthetic-source"], methodVersions: ["synthetic-method"], sourceWatermarks: ["synthetic-watermark"], cutoffAt: "2026-11-04T10:00:00Z", issuedAt: "2026-11-04T11:00:00Z", expiresAt: "2026-11-05T12:00:00Z",
        sources: [], participation: null, participationRevisionId: null, reasons: [], limitations: [] } } })),
    totals: { GOALS: { expected: 5, coveredSum: 5, coveredGames: 5, requiredGames: 5, unit: "count", reason: null } }, ratios: {} }],
};
const request: ValuationRequest = {
  leagueKey: "465.l.1234", gameKey: "465", seasonId: 20262027,
  scoringProfile: { id: "synthetic-league", version: "v1", origin: "manual", scoring: { mode: "points", scoringBasis: "points:synthetic", weights: { GOALS: 3 } } },
  horizon: { mode: "next_n", games: 5 }, decisionCutoff: cutoff, fhfhPlayerId: player,
  adpPolicy: { id: "synthetic-adp-policy", maxCaptureAgeDays: 30 },
};
const row = (overrides: Partial<AdpHistoryRow> = {}): AdpHistoryRow => ({
  player_key: "465.p.100", captured_at: "2026-11-01T09:00:00Z", average_draft_pick: 42.5, average_draft_round: 4, average_draft_cost: null, percent_drafted: 0.9,
  source: "upsert_yahoo_players_atomic", ...overrides,
});
const identityRow = (overrides: Partial<IdentityRow> = {}): IdentityRow => ({
  provider: "yahoo", context_key: "yahoo:game:465:season:2026", season_id: 20262027, verification_status: "verified",
  external_player_id: "465.p.100", fhfh_player_id: Number(player), ...overrides,
});
const identity = (rows: IdentityRow[]): ValuationInputs["identity"] => ({
  capture: { table: "fhfh_player_external_identities", retrievedAt: "2026-11-04T13:00:00Z", sha256: "synthetic-identity-sha", completeness: "two_way" }, rows,
});
const inputs = (overrides: Partial<ValuationInputs> = {}, rows: AdpHistoryRow[] = [row()]): ValuationInputs => ({
  forecastView: view,
  adp: { capture: { table: "yahoo_player_draft_analysis_history", retrievedAt: "2026-11-04T13:00:00Z", sha256: "synthetic-capture-sha" }, rows },
  identity: identity([identityRow(), identityRow({ external_player_id: "465.p.200", fhfh_player_id: 8400002 })]),
  ...overrides,
});
const reasons = (result: { status: string; reasons?: readonly string[] }) => result.status === "unavailable" ? result.reasons : result.status;

describe("qualified valuation request binding", () => {
  it("bound request delegates projected points unchanged and selects the latest qualifying ADP", () => {
    const result = qualifiedValuationComponents(request, inputs({}, [row({ captured_at: "2026-10-01T09:00:00Z", average_draft_pick: 50 }), row()]));
    expect(result.binding).toEqual({ status: "bound" });
    expect(result.projectedPoints).toEqual(leagueValuationComponents({ view, playerId: player, asOf: cutoff,
      leagueProfile: { id: "synthetic-league", version: "v1", origin: "manual" }, scoring: request.scoringProfile.scoring }).projectedPoints);
    expect(result.projectedPoints).toEqual({ status: "available", value: 15 });
    expect(result.adp).toEqual({ status: "available", value: { value: 42.5, capturedAt: "2026-11-01T09:00:00Z", playerKey: "465.p.100",
      scope: "yahoo_public_adp", source: "upsert_yahoo_players_atomic", captureSha256: "synthetic-capture-sha", policyId: "synthetic-adp-policy" } });
    expect(result.request).toMatchObject({ leagueKey: "465.l.1234", seasonId: 20262027, decisionCutoff: cutoff, horizon: { mode: "next_n", games: 5 } });
  });

  it("view mismatches withhold every component with a specific reason", () => {
    const cases: Array<[string, GameExpectationsResponse]> = [
      ["horizon_mismatch", { ...view, scope: { ...view.scope, games: 10 } }],
      ["cutoff_mismatch", { ...view, readAsOf: "2026-11-04T11:00:00Z" }],
      ["player_mismatch", { ...view, players: [{ ...view.players[0], playerId: "8400002" }] }],
      ["season_mismatch", { ...view, scope: { ...view.scope, seasonId: 20252026 } }],
    ];
    for (const [reason, changed] of cases) {
      const result = qualifiedValuationComponents(request, inputs({ forecastView: changed }));
      expect(result.binding).toEqual({ status: "unbound", reasons: [reason] });
      expect(reasons(result.projectedPoints)).toEqual([reason]);
      expect(reasons(result.adp)).toEqual([reason]);
    }
  });

  it("malformed requests withhold without partial values", () => {
    const cases: Array<[string, ValuationRequest]> = [
      ["request_league_key_missing", { ...request, leagueKey: " " }],
      ["league_game_mismatch", { ...request, leagueKey: "453.l.1234" }],
      ["request_scoring_profile_missing", { ...request, scoringProfile: { ...request.scoringProfile, version: "" } }],
      ["request_cutoff_invalid", { ...request, decisionCutoff: "yesterday" }],
      ["request_adp_policy_invalid", { ...request, adpPolicy: { id: "p", maxCaptureAgeDays: 0 } }],
    ];
    for (const [reason, changed] of cases) {
      const result = qualifiedValuationComponents(changed, inputs());
      expect(result.binding).toEqual({ status: "unbound", reasons: [reason] });
      expect(result.projectedPoints.status).toBe("unavailable");
      expect(result.adp.status).toBe("unavailable");
    }
  });

  it("known-zero projected value stays available through the wrapper", () => {
    const zero = structuredClone(view);
    zero.players[0].games.forEach(game => { game.targets.GOALS.expected = 0; });
    zero.players[0].totals.GOALS.expected = 0;
    expect(qualifiedValuationComponents(request, inputs({ forecastView: zero })).projectedPoints).toEqual({ status: "available", value: 0 });
  });

  it("a missing view leaves projected points unavailable but ADP may still qualify", () => {
    const result = qualifiedValuationComponents(request, inputs({ forecastView: null }));
    expect(result.binding).toEqual({ status: "bound" });
    expect(reasons(result.projectedPoints)).toEqual(["current_admitted_view_required"]);
    expect(result.adp.status).toBe("available");
  });
});

describe("dated Yahoo ADP component", () => {
  const adp = (rows: AdpHistoryRow[], overrides: Partial<ValuationInputs> = {}, changed: ValuationRequest = request) =>
    reasons(qualifiedValuationComponents(changed, inputs(overrides, rows)).adp);

  it("ignores rows after the cutoff and withholds when only those exist", () => {
    const result = qualifiedValuationComponents(request, inputs({}, [row({ captured_at: "2026-11-04T12:00:01Z", average_draft_pick: 10 }), row()])).adp;
    expect(result.status === "available" && result.value.value).toBe(42.5);
    expect(adp([row({ captured_at: "2026-11-04T12:00:01Z" })])).toEqual(["adp_after_cutoff"]);
  });
  it("withholds a wrong game, an ambiguous identity or another player's key", () => {
    expect(adp([row({ player_key: "453.p.100" })])).toEqual(["adp_wrong_game"]);
    expect(adp([row()], { identity: identity([identityRow(), identityRow({ fhfh_player_id: 8400003 })]) })).toEqual(["adp_identity_unresolved"]);
    expect(adp([row({ player_key: "465.p.200" })])).toEqual(["adp_identity_unresolved"]);
  });
  it("withholds identity rows outside the request's provider, season or context, or not verified", () => {
    expect(adp([row()], { identity: identity([identityRow({ season_id: 20252026 })]) })).toEqual(["identity_wrong_season"]);
    expect(adp([row()], { identity: identity([identityRow({ context_key: "yahoo:game:453:season:2025" })]) })).toEqual(["identity_wrong_context"]);
    expect(adp([row()], { identity: identity([identityRow({ verification_status: "unverified" })]) })).toEqual(["identity_unverified"]);
    expect(adp([row()], { identity: identity([identityRow({ provider: "espn" })]) })).toEqual(["identity_wrong_provider"]);
    // Review reproduction: an unverified, prior-season row that is unique must not yield ADP.
    expect(adp([row()], { identity: identity([identityRow({ verification_status: "unverified", season_id: 20252026, context_key: "yahoo:game:465:season:2025" })]) }))
      .toEqual(["identity_unverified", "identity_wrong_context", "identity_wrong_season"]);
    expect(adp([row()], { identity: { ...identity([identityRow()]), capture: null } })).toEqual(["identity_capture_unavailable"]);
    const qualified = qualifiedValuationComponents(request, inputs({ identity: identity([identityRow()]) })).adp;
    expect(qualified.status === "available" && qualified.value.value).toBe(42.5);
  });
  it("direct datedAdp calls validate the policy and request", () => {
    const direct = (adpPolicy: ValuationRequest["adpPolicy"]) =>
      reasons(datedAdp({ ...request, adpPolicy }, inputs({}, [row({ captured_at: "2026-09-01T09:00:00Z" })])));
    for (const maxCaptureAgeDays of [NaN, Infinity, -1]) expect(direct({ id: "synthetic-adp-policy", maxCaptureAgeDays })).toEqual(["request_adp_policy_invalid"]);
    expect(direct({ id: "", maxCaptureAgeDays: 30 })).toEqual(["request_adp_policy_invalid"]);
    expect(direct({ id: "", maxCaptureAgeDays: NaN })).toEqual(["request_adp_policy_invalid"]);
    expect(reasons(datedAdp({ ...request, decisionCutoff: "later" }, inputs()))).toEqual(["request_cutoff_invalid"]);
    expect(datedAdp(request, inputs()).status).toBe("available");
  });
  it("withholds conflicting duplicate captures", () => {
    expect(adp([row(), row({ average_draft_pick: 40 })])).toEqual(["conflicting_adp_rows"]);
  });
  it("withholds a stale capture", () => {
    expect(adp([row({ captured_at: "2026-09-01T09:00:00Z" })])).toEqual(["adp_stale"]);
  });
  it("never turns a null ADP into zero", () => {
    expect(adp([row({ average_draft_pick: null })])).toEqual(["adp_missing_value"]);
  });
  it("withholds rows from any writer other than the atomic Yahoo writer", () => {
    expect(adp([row({ source: "manual_backfill" })])).toEqual(["adp_unqualified_source"]);
  });
  it("withholds when the capture is missing or for another table", () => {
    expect(adp([row()], { adp: { capture: null, rows: [row()] } })).toEqual(["adp_capture_unavailable"]);
    expect(adp([row()], { adp: { capture: { table: "yahoo_players", retrievedAt: cutoff, sha256: "x" }, rows: [row()] } })).toEqual(["adp_capture_unavailable"]);
  });
});

describe("withheld components and frozen baseline", () => {
  it("actuals, rank, VOR, combined and plausibility are always unavailable with no numeric value", () => {
    const result = qualifiedValuationComponents(request, inputs());
    expect(reasons(result.actualPoints)).toEqual(["season_actuals_untrusted_upstream"]);
    expect(reasons(result.actualRank)).toEqual(["season_rank_requires_qualified_actuals_and_universe"]);
    expect(reasons(result.vor)).toEqual(["replacement_universe_incomplete"]);
    expect(reasons(result.combined)).toEqual(["validated_normalization_and_weights_unavailable"]);
    expect(reasons(result.plausibility)).toEqual(["validated_guard_thresholds_unavailable"]);
    for (const key of ["actualPoints", "actualRank", "vor", "combined", "plausibility"] as const) expect(result[key]).not.toHaveProperty("value");
  });
  it("accepted tradeValue files stay byte-identical", () => {
    const accepted: Record<string, string> = {
      "contracts.ts": "24e132e2c1ea715ccd0cf572eaa9162349f32f545e5dd49aafbdb948a470b9cd",
      "observationEvidence.ts": "bafb1916b8e42ecd684dd332a4743da7110db7741d252e061a505e341d77ed12",
      "observationEvidence.test.ts": "e0cde9df893283f9a204147357083934892a0d6d0f29b5865974e204e3b094e8",
      "valuationComponents.ts": "a11683b789dc3b2f010b81164de26733039c4d48d248d836828a57f086ebd940",
      "valuationComponents.test.ts": "c3aff71efd20ed61a5666d163e68436abf3bcf1df9c0b33523fce1b6b2667010",
    };
    for (const [file, sha] of Object.entries(accepted)) {
      expect(createHash("sha256").update(new Uint8Array(readFileSync(join(__dirname, file)))).digest("hex")).toBe(sha);
    }
  });
});
