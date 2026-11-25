import { describe, expect, it } from "vitest";
import pbp from "./fixtures/pbp-2026020356.json";
import { hasPenaltyCuePhrase, readPenaltyClue } from "./ppClue";

const roster = pbp.rosterSpots.map((spot) => ({ playerId: spot.playerId, name: `${spot.firstName.default} ${spot.lastName.default}`, teamId: spot.teamId }));
const curtis = "RT @baileyycurtis: Nikita Nesterenko gets the call for high-sticking and the Avs PP will get another look.\n\nPP1: Hughes, Kadri, Lehkonen, Necas, Toews";

describe("readPenaltyClue", () => {
  it("reads a penalized player and infraction, ignoring the PP unit list", () => {
    expect(readPenaltyClue(curtis, roster)).toMatchObject({ committedByPlayerId: 8481754, drawnByPlayerId: null, infraction: "high-sticking" });
  });
  it("reads a drawn-by player naming our own skater", () => {
    expect(readPenaltyClue("Kadri draws a tripping call", roster)).toMatchObject({ drawnByPlayerId: 8475172, committedByPlayerId: null, infraction: "tripping" });
  });
  it("reads 'drawn by' after the infraction", () => {
    expect(readPenaltyClue("Nesterenko high-sticking, drawn by Malinski", roster)).toMatchObject({ committedByPlayerId: 8481754, drawnByPlayerId: 8484258, infraction: "high-sticking" });
  });
  it("reads 'takes down' as the subject committing and the object drawing", () => {
    expect(readPenaltyClue("Nesterenko takes down Malinski", roster)).toMatchObject({ committedByPlayerId: 8481754, drawnByPlayerId: 8484258, infraction: null });
  });
  it("returns null for a unit list with no clue", () => {
    expect(readPenaltyClue("PP1: Hughes, Kadri, Lehkonen, Necas, Toews", roster)).toBeNull();
  });
  it("returns null for a player in the box with no infraction or drawer", () => {
    expect(readPenaltyClue("Nesterenko in the box", roster)).toBeNull();
  });
  it("returns null when the surname is shared by two roster players", () => {
    const twins = [...roster, { playerId: 1, name: "Ivan Nesterenko", teamId: 24 }];
    expect(readPenaltyClue("Nesterenko gets the call for high-sticking", twins)).toBeNull();
  });
  it("returns null for an infraction with no named player", () => {
    expect(readPenaltyClue("High-sticking call, Avs to the PP", roster)).toBeNull();
  });
  it("records evidence spans that match the text", () => {
    const clue = readPenaltyClue(curtis, roster)!;
    for (const span of clue.evidence) expect(curtis.slice(span.start, span.end)).toBe(span.text);
  });
});

describe("hasPenaltyCuePhrase", () => {
  it("detects a cue without a roster", () => {
    expect(hasPenaltyCuePhrase(curtis)).toBe(true);
    expect(hasPenaltyCuePhrase("PP1: Hughes, Kadri, Lehkonen, Necas, Toews")).toBe(false);
  });
});
