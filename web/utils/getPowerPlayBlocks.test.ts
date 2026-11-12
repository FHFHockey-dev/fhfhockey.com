import { describe, expect, it } from "vitest";

import { getPairwiseTOI, type Shift } from "components/LinemateMatrix/utilities";
import getPowerPlayBlocks, {
  PP_CLOCK_SOURCE,
  PP_CLOCK_UNQUALIFIED_REASON,
  auditPpBlocksAgainstSituationCodes,
  buildTeamPpClock,
  teamPpClockSeconds
} from "./getPowerPlayBlocks";

const HOME = 10;
const AWAY = 20;
const teams = { homeTeamId: HOME, awayTeamId: AWAY };

let nextEventId = 1;
function play(
  typeDescKey: string,
  period: number,
  timeInPeriod: string,
  situationCode: string,
  details: Record<string, unknown> = {}
) {
  return {
    eventId: nextEventId++,
    typeDescKey,
    periodDescriptor: { number: period, periodType: "REG" },
    timeInPeriod,
    situationCode,
    details: { eventOwnerTeamId: HOME, ...details }
  };
}
const minor = (period: number, time: string, penalizedTeamId: number, code = "1551") =>
  play("penalty", period, time, code, {
    eventOwnerTeamId: penalizedTeamId,
    typeCode: "MIN",
    duration: 2,
    committedByPlayerId: penalizedTeamId * 100
  });
const opening = () => [
  play("faceoff", 1, "00:00", "1551"),
  play("shot-on-goal", 1, "05:00", "1551", { eventOwnerTeamId: AWAY })
];
const periodEnd = (code: string) => play("period-end", 3, "20:00", code);

describe("decision-71 PP clock and situation-code audit (M-FRG-058)", () => {
  it("1560 with no penalty: a 6v5 is even strength, no PP clock", () => {
    const plays = [...opening(), play("shot-on-goal", 3, "19:00", "1560"), periodEnd("1560")];
    const blocks = getPowerPlayBlocks(plays);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(0);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(0);
    expect(auditPpBlocksAgainstSituationCodes(plays, blocks, teams).disagreements).toEqual([]);
  });

  it("1460 during a real away minor: the pulled-goalie PP stays a home PP, then expires", () => {
    const plays = [
      ...opening(),
      minor(3, "10:00", AWAY),
      play("faceoff", 3, "10:00", "1451"),
      play("shot-on-goal", 3, "10:30", "1451"),
      play("shot-on-goal", 3, "11:00", "1460"),
      play("shot-on-goal", 3, "13:00", "1560"),
      periodEnd("1560")
    ];
    const blocks = getPowerPlayBlocks(plays);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(120);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(0);
    const audit = auditPpBlocksAgainstSituationCodes(plays, blocks, teams);
    expect(audit.checkedEvents).toBe(6);
    expect(audit.disagreements).toEqual([]);
  });

  it("0551: a shorthanded away team with its goalie pulled is still PK", () => {
    const plays = [
      ...opening(),
      minor(3, "18:00", AWAY),
      play("faceoff", 3, "18:00", "1451"),
      play("shot-on-goal", 3, "18:30", "0551", { eventOwnerTeamId: AWAY }),
      periodEnd("0551")
    ];
    const blocks = getPowerPlayBlocks(plays);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(120);
    expect(auditPpBlocksAgainstSituationCodes(plays, blocks, teams).disagreements).toEqual([]);
  });

  it("flags an event whose situation code disagrees with the simulated PP", () => {
    const plays = [
      ...opening(),
      minor(3, "10:00", AWAY),
      play("shot-on-goal", 3, "10:30", "1551"),
      periodEnd("1551")
    ];
    const blocks = getPowerPlayBlocks(plays);
    const { disagreements } = auditPpBlocksAgainstSituationCodes(plays, blocks, teams);
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0]).toMatchObject({
      situationCode: "1551",
      simulatedAdvantageTeamId: HOME,
      situationAdvantageTeamId: null
    });
  });

  it("a player's unioned PP seconds never exceed the team clock, even with overlapping shift rows", () => {
    const plays = [...opening(), minor(3, "10:00", AWAY), periodEnd("1551")];
    const blocks = getPowerPlayBlocks(plays);
    const shift = (id: number, start: string, duration: string): Shift => ({
      id,
      gameId: 1,
      playerId: 7,
      period: 3,
      firstName: "A",
      lastName: "B",
      teamId: HOME,
      teamName: "Home",
      duration,
      startTime: start,
      endTime: start
    });
    const shifts = [shift(1, "09:30", "03:00"), shift(2, "10:30", "01:00")];
    const playerPpSeconds = getPairwiseTOI(shifts, 7, 7, blocks);
    expect(playerPpSeconds).toBe(120);
    expect(playerPpSeconds).toBeLessThanOrEqual(teamPpClockSeconds(blocks, HOME));
  });

  it("buildTeamPpClock reports the clock but stays unqualified until validated", () => {
    const plays = [...opening(), minor(3, "10:00", AWAY), periodEnd("1551")];
    expect(buildTeamPpClock({ gameId: 1, teamId: HOME, ...teams, plays })).toEqual({
      gameId: 1,
      teamId: HOME,
      seconds: 120,
      source: PP_CLOCK_SOURCE,
      qualified: false,
      unqualifiedReason: PP_CLOCK_UNQUALIFIED_REASON,
      audit: { checkedEvents: 3, disagreements: 0 }
    });
    expect(buildTeamPpClock({ gameId: 1, teamId: HOME, ...teams, plays: null })).toMatchObject({
      seconds: null,
      qualified: false
    });
  });
});
