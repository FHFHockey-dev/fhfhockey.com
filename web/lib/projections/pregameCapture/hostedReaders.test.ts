import { describe, expect, it } from "vitest";
import type { ForecastDiscoveryExclusion } from "lib/rosterScheduleOptimizer/planningTypes";
import { DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_LINE_ROLE_NOTE, DETAILED_PARTICIPATION_NOTES,
  overlayChangeNote } from "../rsoParticipationNotes";
import { attributeDetailedExclusion, HOSTED_RSO_CONTEXT, hostedParticipation, type HostedRsoReader } from "./hostedReaders";

// Shapes from the sealed real-input rehearsal of 2026020360 (2026-11-20): the published revision carries a game-level
// identity_conflict (no playerId) for another payload row; the asked player (10398) has no published row at all.
const GAME = "2026020360";
const gameLevel: ForecastDiscoveryExclusion = { gameId: GAME, reasons: ["identity_conflict"] };

describe("attributeDetailedExclusion", () => {
  it("never reports a game-level exclusion as the asked player's reason (sealed 0360)", () => {
    expect(attributeDetailedExclusion([gameLevel], [gameLevel], GAME, "10398"))
      .toEqual({ reason: "no_usable_target", gameExclusions: ["identity_conflict"] });
  });

  it("keeps an exclusion that names the asked player, with the game-level one as context (sealed 0360, lineup centre)", () => {
    const own: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "9013", reasons: ["missing_participation"] };
    expect(attributeDetailedExclusion([gameLevel, own], [gameLevel, own], GAME, "9013"))
      .toEqual({ reason: "missing_participation", gameExclusions: ["identity_conflict"] });
  });

  it("ignores another player's exclusion and anything the planner did not report", () => {
    const other: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "1", reasons: ["stale_source"] };
    const unreported: ForecastDiscoveryExclusion = { gameId: GAME, playerId: "9013", reasons: ["future_input"] };
    expect(attributeDetailedExclusion([other, unreported, gameLevel], [other], GAME, "9013"))
      .toEqual({ reason: "no_usable_target", gameExclusions: [] });
  });
});

// Postgres jsonb text form, as `octet_length(readers::text)` measures it: ", " and ": " separators.
const jsonbText = (value: unknown): string => Array.isArray(value) ? `[${value.map(jsonbText).join(", ")}]`
  : value && typeof value === "object" ? `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${JSON.stringify(key)}: ${jsonbText(item)}`).join(", ")}}` : JSON.stringify(value);
const LIVE_READERS_MAX_BYTES = 4000; // forge_live_publish_finish_v1 and live_runs.readers check

describe("Detailed reader participation receipt (TJ 2026-11-21)", () => {
  const uuid = (n: number) => `${String(n).padStart(8, "0")}-aaaa-4bbb-8ccc-dddddddddddd`;
  // Seven changes from every source kind, longest ids; the receipt keeps the last five, compacted.
  const changes = [
    overlayChangeNote({ at: "2026-10-10T12:30:00.123456Z", source: "roster event 2147483647 (RETURN)", detail: "possible return reported; does not clear the injury" }),
    ...[1, 2, 3, 4].map(n => overlayChangeNote({ at: `2026-10-10T1${n}:45:00.123456Z`,
      source: `accepted news ${uuid(n)} (availability:return, confirmed)`, detail: "confirmed in this game's lineup" })),
    overlayChangeNote({ at: "2026-10-10T23:59:59Z", source: "official appearance 2026-10-10 (wgo_skater_stats 2147483647)", detail: "played after the injury; assumed playing for later games" }),
    overlayChangeNote({ at: "2026-10-11T17:30:00.123456Z", source: "roster event 2147483646 (NON_ROSTER)", detail: "non-roster: excluded" }),
  ];
  const row = { limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated.", ...changes,
    DETAILED_PARTICIPATION_CONFLICT_NOTE, DETAILED_PARTICIPATION_LINE_ROLE_NOTE, DETAILED_PARTICIPATION_NOTES.confirmed_out] };

  it("keeps the basis, flags and the last five changes as [at, source id]", () => {
    expect(hostedParticipation(row)).toEqual({ basis: "confirmed_out", conflict: true, lineRoleChanged: true, changes: [
      ["2026-10-10T12:45:00.123456Z", `news:${uuid(2)}`], ["2026-10-10T13:45:00.123456Z", `news:${uuid(3)}`],
      ["2026-10-10T14:45:00.123456Z", `news:${uuid(4)}`], ["2026-10-10T23:59:59Z", "wgo:2147483647"],
      ["2026-10-11T17:30:00.123456Z", "roster:2147483646:NON_ROSTER"]] });
    // Rows the policy did not label (Daily rows, goalies, start chart) carry no participation.
    expect(hostedParticipation({ limitations: ["Game forecasts are provisional; joint plan uncertainty is not calibrated."] })).toBeUndefined();
  });

  it("fits the live receipt's 4000-byte readers limit in the worst case", () => {
    const claim = uuid(9), revision = uuid(8);
    const allReasons = ["serving_disabled", "no_issued_revision", "unreleased_source", "stale_source", "future_input", "identity_conflict",
      "missing_target", "unsupported_conditioning", "missing_participation", "incompatible_overlap", "incompatible_component_basis",
      "outside_horizon", "use_not_approved", "canary_excluded", "discovery_timeout", "discovery_failed", "incomplete_refresh",
      "eligibility_unverified", "game_mismatch", "invalid_cutoff", "no_usable_target", "conflicting_forecast"];
    const daily: HostedRsoReader = { selectedRun: claim, revisionId: `forge-daily-bridge-v1:${claim}`, playerId: "2147483647",
      points: 12.345678901234567, legalSlot: "C#1", reason: "signed_verdict:verdict_signature_unverifiable_for_this_claim" };
    // Upper bound: participation and every game exclusion at once (the reader never emits both on one row).
    const detailed: HostedRsoReader = { selectedRun: claim, revisionId: revision, playerId: "2147483647", points: 12.345678901234567,
      legalSlot: "C#1", reason: "use_not_approved", gameExclusions: allReasons, participation: hostedParticipation(row) };
    const readers = { contextId: HOSTED_RSO_CONTEXT, playerNhlId: 2147483647, evaluatedAt: "2026-10-10T17:25:03.960Z", daily, detailed };
    const bytes = new TextEncoder().encode(jsonbText(readers)).byteLength;
    expect(bytes).toBeLessThan(LIVE_READERS_MAX_BYTES);
    expect(bytes).toBeLessThan(2000);
    console.log(`WORST_CASE_READERS_BYTES ${bytes}`);
  });
});
