import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pbpFixture from "./fixtures/pbp-2026020356.json";
import curtisFixture from "./fixtures/curtis-2123606497813053505.json";
import type { PlayByPlay } from "./officialPowerPlay";
import type { LineClaim, LineGame } from "./types";

// Local fixtures for PP carry-forward (ANA–COL 2026020356 → MTL–COL 2026020397). Offline evidence only.
export const pbp0356 = pbpFixture as unknown as PlayByPlay;
export const html0356 = readFileSync(resolve(__dirname, "fixtures/pl-020356-trimmed.html"), "utf8");
export const url0356 = "https://www.nhl.com/scores/htmlreports/20262027/PL020356.HTM";
export const game0356: LineGame = { id: 2026020356, date: "2026-11-19", homeTeamId: 21, awayTeamId: 24, homeAbbreviation: "COL", awayAbbreviation: "ANA",
  scheduledStart: "2026-11-20T02:00:00Z", phase: "final", actualStart: null, observedAt: "2026-11-20T05:00:00Z", stateSource: "fixture",
  scheduleIdentity: "2026020356:2026-11-20T02:00:00Z:OK", replacesGameId: null };
export const game0397: LineGame = { id: 2026020397, date: "2026-11-25", homeTeamId: 21, awayTeamId: 8, homeAbbreviation: "COL", awayAbbreviation: "MTL",
  scheduledStart: "2026-11-26T02:30:00Z", phase: "scheduled", actualStart: null, observedAt: null, stateSource: null,
  scheduleIdentity: "2026020397:2026-11-26T02:30:00Z:OK", replacesGameId: null };
export const curtisFive = [8486171, 8475172, 8477476, 8480039, 8478038];
/** The retained, resolved, unbound Curtis claim as production stored it. */
export const curtisClaim = curtisFixture.claim as unknown as LineClaim;

/** Curtis bound to 0356 as intake binds it (seeded only for unit tests; the end-to-end test binds through intake). */
export const curtisBound: LineClaim = { ...curtisClaim, gameId: game0356.id, explicit: true, reviewReasons: [],
  binding: { status: "bound", evidence: ["live_game:2026020356", "nhl_penalty:320", "nhl_pp_faceoff:315", "faceoff_before_publication:unverified"], resolverVersion: "2026-11-18.1", scheduleIdentity: game0356.scheduleIdentity } };
export const rawalTime = { originalPublishedAt: "2026-11-24T18:41:42.000Z", relayPublishedAt: null, ingestedAt: "2026-11-24T18:46:15.221Z", interpretedAt: "2026-11-24T18:46:15.221Z",
  effectiveAt: "2026-11-24T18:41:42.000Z", effectiveUntil: null, rawDisplay: null, timezone: null, precision: "instant" as const, basis: "verified_original_publication" };
const name = (id: number, full: string) => ({ playerId: id, name: full });
export const rawalUnits = {
  1: [name(8480069, "Cale Makar"), name(8480039, "Martin Necas"), name(8475172, "Nazem Kadri"), name(8478462, "Nicolas Roy"), name(8476455, "Gabriel Landeskog")],
  2: [name(8478038, "Devon Toews"), name(8475754, "Brock Nelson"), name(8475768, "Jaden Schwartz"), name(8486171, "T.J. Hughes"), name(8477476, "Artturi Lehkonen")],
};
// Rawal's Nov 24 practice report (rows in tasks/TASKS/lines-pp-carry-forward/rawal-2026-11-24-rows.json; original time reconstructed from the tweet ID).
export const rawal = (number: 1 | 2, overrides: Partial<LineClaim> = {}): LineClaim => ({ ...curtisClaim, id: `rawal-pp${number}`, captureId: "capture:rawal",
  originalIdentity: "2125298833580339606", provenance: { relayTweetId: null, originalTweetId: "2125298833580339606", attributionStatus: "resolved" },
  text: "New PP units at Avs practice today.", sourceUrl: "https://x.com/evanrawal/status/2125298833580339606", author: "evanrawal", originalAuthor: "evanrawal",
  gameId: null, phase: "pregame", context: "practice", specificity: "practice", time: rawalTime, explicit: false,
  binding: { status: "unresolved", evidence: ["no_game_binding_evidence"], resolverVersion: "2026-11-18.1", scheduleIdentity: null }, reviewReasons: ["no_game_binding_evidence", "binding_decision_unverified"],
  unit: { ...curtisClaim.unit!, number, players: rawalUnits[number], evidence: [] }, ...overrides });

// PHI@WSH 2026020392 → FLA@WSH 2026020406 (Silber's in-game PP1, Nov 25). Trimmed official reports; offline evidence only.
export const pbp0392 = JSON.parse(readFileSync(resolve(__dirname, "fixtures/pbp-2026020392.json"), "utf8")) as PlayByPlay;
export const html0392 = readFileSync(resolve(__dirname, "fixtures/pl-020392-trimmed.html"), "utf8");
export const url0392 = "https://www.nhl.com/scores/htmlreports/20262027/PL020392.HTM";
export const game0392: LineGame = { id: 2026020392, date: "2026-11-25", homeTeamId: 15, awayTeamId: 4, homeAbbreviation: "WSH", awayAbbreviation: "PHI",
  scheduledStart: "2026-11-26T00:00:00Z", phase: "live", actualStart: "2026-11-26T00:17:00Z", observedAt: "2026-11-26T00:28:00Z", stateSource: "fixture",
  scheduleIdentity: "2026020392:2026-11-26T00:00:00Z:OK", replacesGameId: null };
export const game0406: LineGame = { id: 2026020406, date: "2026-11-27", homeTeamId: 15, awayTeamId: 13, homeAbbreviation: "WSH", awayAbbreviation: "FLA",
  scheduledStart: "2026-11-27T20:00:00Z", phase: "scheduled", actualStart: null, observedAt: null, stateSource: null,
  scheduleIdentity: "2026020406:2026-11-27T20:00:00Z:OK", replacesGameId: null };
/** Silber's post as the production snapshot's primary (enriched) text stores it: one newline between the two lines. */
export const silberText = "Justin Sourdif takes Jordan Kyrou's spot on PP1\nSo Strome, Wilson, Sourdif, Chychrun, Ovechkin out there now";
export const silberUrl = "https://x.com/sammisilber/status/2125747628642336776";
export const silberPostedAt = "2026-11-26T00:25:03.000Z";
/** Strome, Wilson, Sourdif, Chychrun, Ovechkin. */
export const silberFive = [8478440, 8476880, 8482088, 8479345, 8471214];

/** The production publication roster for Silber's post (includes Kyrou, the replaced player, and two Protas) and the five's rosters rows. */
const wshPublication = JSON.parse(readFileSync(resolve(__dirname, "fixtures/wsh-publication-roster-2026-11-26.json"), "utf8")) as { rosterRevision: string;
  rosters: { playerId: number; teamId: number; seasonId: number; created_at: string; ended_at: string | null }[] };
export const wshPublicationRoster = wshPublication.rosterRevision.split("|").map((entry) => {
  const [id, fullName, lastName, teamId, position, ...aliases] = entry.split(":");
  return { playerId: Number(id), fullName: fullName!, lastName: lastName!, teamId: Number(teamId), position: position!, aliases: [...new Set(aliases)] };
});
export const wshFiveRosterRows = wshPublication.rosters;
