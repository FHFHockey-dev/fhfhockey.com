import type { ClaimDecisionEvidence, LineClaim, LineGame } from "./types";
import type { TweetUnit } from "lib/sources/tweetInterpretation";
import { reconcileEntry, reconcilePP } from "./reconcile";
import type { GameLinesResponse } from "./types";

// Synthetic IDs/timestamps for deterministic tests, not authenticated screenshot evidence.
export const fixtureNow = "2026-10-02T01:00:00Z";
export function fixtureDecisionEvidence(text: string, phaseText = text): ClaimDecisionEvidence {
  const start = text.indexOf(phaseText);
  return { producerVersion: "synthetic-fixture:2", decisionId: `fixture:${phaseText}`, sourceReferences: ["fixture:authenticated-source", "fixture:actual-game-state"],
    binding: [{ start: 0, end: text.length, text }], phase: [{ start, end: start + phaseText.length, text: phaseText }] };
}
export const fixtureGame: LineGame = { id: 2026010001, date: "2026-10-01", homeTeamId: 3, awayTeamId: 14,
  homeAbbreviation: "NYR", awayAbbreviation: "TBL", scheduledStart: "2026-10-01T23:00:00Z", phase: "live",
  actualStart: "2026-10-01T23:07:00Z", observedAt: fixtureNow, stateSource: "fixture:state",
  scheduleIdentity: "fixture:game:1", replacesGameId: null };
export const fixtureNext: LineGame = { ...fixtureGame, id: 2026010002, date: "2026-10-03", phase: "scheduled", actualStart: null,
  scheduledStart: "2026-10-03T23:00:00Z", scheduleIdentity: "fixture:game:2" };
export function fixtureUnit(names = ["Mikheyev", "Point", "Kucherov"], situation: TweetUnit["situation"] = "es_forward", number: number | null = 1): TweetUnit {
  return { situation, number, explicitNumber: situation === "pp", complete: true, group: null,
    players: names.map((name, index) => ({ playerId: index + 1, name })), evidence: names.map((name, index) => ({ start: index * 15, end: index * 15 + name.length, text: name })) };
}
export function fixtureClaim(id = "warmup", overrides: Partial<LineClaim> = {}): LineClaim {
  return { id, captureId: `capture:${id}`, version: "fixture:1", originalIdentity: `original:${id}`,
    teamId: 14, gameId: fixtureGame.id, binding: { status: "bound", evidence: ["fixture explicit matchup"], resolverVersion: "fixture:1", scheduleIdentity: fixtureGame.scheduleIdentity },
    kind: "entry", phase: "pregame", unit: fixtureUnit(), relationship: null,
    text: "Lightning warmup lines: Mikheyev-Point-Kucherv", sourceUrl: "https://x.com/fixtureauthor/status/123", author: "fixtureauthor",
    time: { originalPublishedAt: "2026-10-01T22:34:00Z", relayPublishedAt: "2026-10-01T22:35:00Z", ingestedAt: "2026-10-01T22:36:00Z", interpretedAt: "2026-10-01T22:37:00Z", effectiveAt: "2026-10-01T22:34:00Z", effectiveUntil: null, rawDisplay: "6:34 PM", timezone: "America/New_York", precision: "instant", basis: "fixture" },
    explicit: true, authority: 1, certainty: "reported", confirmationEvidence: [], specificity: "warmup", identityStatus: "resolved_at_event", identityEvidence: ["fixture:event_roster"],
    accepted: true, reviewReasons: [], supersedes: [], retracts: [], relationAuthority: "none", ...overrides };
}
export function fixturePP(number: number, overrides: Partial<LineClaim> = {}): LineClaim {
  const names = number === 1 ? ["Carlson", "Point", "Kucherov", "Guentzel", "Hagel"] : ["D'Astous", "Geekie", "Holmberg", "Cirelli", "Goncalves"];
  const claim = fixtureClaim(`pp${number}`, { kind: "pp", phase: "in_game", unit: fixtureUnit(names, "pp", number), specificity: "game" });
  return { ...claim, time: { ...claim.time, originalPublishedAt: "2026-10-01T23:33:00Z", effectiveAt: "2026-10-01T23:33:00Z", ingestedAt: "2026-10-01T23:34:00Z", interpretedAt: "2026-10-01T23:35:00Z" }, ...overrides };
}
export function fixtureResponse(updates = 1): GameLinesResponse {
  const warmup = fixtureClaim();
  const entry = reconcileEntry({ game: fixtureGame, teamId: 14, claims: [warmup], previous: null, now: fixtureNow });
  const observations = Array.from({ length: updates }, (_, index) => fixtureClaim(`iga${index}`, { kind: "iga", phase: "in_game", unit: null,
    text: `Kucherov with Hagel/Cirelli. Holmberg/Point/Guentzel together. Update ${index + 1}.`, relationship: { kind: "continuity", playerIds: [1, 2, 3], evidence: { start: 0, end: 30, text: "Kucherov with Hagel/Cirelli" } } }));
  return { enabled: true, mode: "snapshots", status: "ready", controls: { observations: true, entryServing: true, carryForward: true }, game: fixtureGame, games: [fixtureGame, fixtureNext],
    teams: [{ teamId: 14, abbreviation: "TBL", entry, entryRevisions: [entry], fallback: null, observations, history: [warmup, ...observations],
      ppDefaults: reconcilePP({ game: fixtureGame, teamId: 14, games: [fixtureGame, fixtureNext], claims: [fixturePP(1)], now: fixtureNow, carryForward: true }), unresolved: [], conflicts: [] }] };
}
