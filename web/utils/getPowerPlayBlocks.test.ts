import { describe, expect, it } from "vitest";

import { getPairwiseTOI, type Shift } from "components/LinemateMatrix/utilities";
import getPowerPlayBlocks, {
  PP_CLOCK_SOURCE,
  PP_CLOCK_QUALIFIED,
  PP_CLOCK_UNQUALIFIED_REASON,
  auditPpBlocksAgainstSituationCodes,
  buildTeamPpClock,
  teamPpClockSeconds
} from "./getPowerPlayBlocks";
import { hasCompletePenaltyClockSource } from "lib/projections/penaltyClock";

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
  play("shot-on-goal", 1, "00:01", "1551", { eventOwnerTeamId: AWAY })
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

  it("rejects a contradictory clock and independently audits the mismatched situation event", () => {
    const plays = [
      ...opening(),
      minor(3, "10:00", AWAY),
      play("shot-on-goal", 3, "10:30", "1551"),
      periodEnd("1551")
    ];
    expect(() => getPowerPlayBlocks(plays, teams)).toThrow(/penalty-clock disagrees with PBP manpower/i);
    const blocks = [{
      teamId: HOME,
      start: { period: 3 as const, type: "REG" as const, timeInPeriod: "10:00" },
      end: { period: 3 as const, type: "REG" as const, timeInPeriod: "12:00" }
    }];
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

describe("penalty-service timing regressions", () => {
  const openingTeams = () => [
    play("faceoff", 1, "00:00", "1551"),
    play("shot-on-goal", 1, "00:10", "1551", { eventOwnerTeamId: AWAY })
  ];
  const endAt = (time = "10:00") => play("game-end", 1, time, "1551");
  const assessed = (time: string, playerId: number, duration = 2, teamId = AWAY) =>
    play("penalty", 1, time, "1551", {
      eventOwnerTeamId: teamId,
      committedByPlayerId: playerId,
      typeCode: duration === 5 ? "MAJ" : "MIN",
      duration
    });
  const span = (start: string, end: string, teamId = HOME) => ({
    teamId,
    start: { period: 1, type: "REG", timeInPeriod: start },
    end: { period: 1, type: "REG", timeInPeriod: end }
  });

  it("a penalty-shot goal does not release an unrelated active minor", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      play("goal", 1, "02:00", "1010"),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:00", "03:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(120);
  });

  it("a new minor to the same offender at a later stoppage waits for his first minor", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      assessed("02:00", 201),
      endAt()
    ]);
    // One player serves four penalty minutes in sequence, not two concurrent clocks.
    expect(blocks).toEqual([span("01:00", "05:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(240);
  });

  it("the third distinct offender's minor waits until one of two serving slots opens", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      assessed("01:30", 202),
      assessed("02:00", 203),
      endAt()
    ]);
    // The third clock starts at 03:00 and ends 05:00; a 5v3 second is counted once.
    expect(blocks).toEqual([span("01:00", "05:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(240);
  });

  it("a goal during the first half of a double minor starts its second two-minute half", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201, 4),
      play("goal", 1, "02:00", "1451"),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:00", "04:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(180);
  });

  it("a goal at an expiry instant cancels the other still-active minor, not the expired one", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      assessed("02:00", 202),
      play("goal", 1, "03:00", "1451"),
      endAt()
    ]);
    // [01:00,03:00) has elapsed before the 03:00 goal releases the second offender.
    expect(blocks).toEqual([span("01:00", "03:00")]);
  });

  it.each([
    { name: "power-play", scoringTeam: HOME, expectedEnd: "02:00", seconds: 60 },
    { name: "shorthanded", scoringTeam: AWAY, expectedEnd: "03:00", seconds: 120 }
  ])("a $name goal has the correct minor-release effect", ({ scoringTeam, expectedEnd, seconds }) => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      play("goal", 1, "02:00", "1451", { eventOwnerTeamId: scoringTeam }),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:00", expectedEnd)]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(seconds);
  });

  it("a major runs its full five minutes through multiple power-play goals", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201, 5),
      play("goal", 1, "02:00", "1451"),
      play("goal", 1, "03:00", "1451"),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:00", "06:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(300);
  });

  it("a major and minor to one offender serve major first, then a goal can release the minor", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("03:00", 201, 5),
      assessed("03:00", 201),
      play("goal", 1, "08:30", "1451"),
      endAt("12:00")
    ]);
    // NHL Rulebook Table 12, example B2: 5+2 at 03:00, goal 08:30, return 08:30.
    expect(blocks).toEqual([span("03:00", "08:30")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(330);
  });

  it("releases a single minor before an equally aged double minor under Table 12 C5", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201, 4),
      assessed("01:00", 202),
      play("goal", 1, "02:00", "1451"),
      endAt()
    ], teams);
    // The double minor has three minutes on its clock; the single has one.
    expect(blocks).toEqual([span("01:00", "05:00")]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(240);
  });

  it("refuses an unresolved captain choice between equally expiring minors before later serial service", () => {
    const plays = [
      ...openingTeams(),
      assessed("01:00", 201),
      assessed("01:00", 202),
      play("goal", 1, "02:00", "1451"),
      { ...assessed("02:01", 201), details: {
        eventOwnerTeamId: AWAY, committedByPlayerId: 201,
        duration: 2, typeCode: "MIN", descKey: "unsportsmanlike-conduct"
      } },
      endAt()
    ];
    expect(() => getPowerPlayBlocks(plays, teams))
      .toThrow(/ambiguous.*penalty|penalty.*ambiguous/i);
  });

  it.each([
    { code: "1551", expectedEnd: "04:01", seconds: 181 },
    { code: "1451", expectedEnd: "05:00", seconds: 240 }
  ])("interior $code resolves a goal-release captain choice before later serial service", ({ code, expectedEnd, seconds }) => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 201),
      assessed("01:00", 202),
      play("goal", 1, "02:00", "1451"),
      { ...assessed("02:01", 201), details: {
        eventOwnerTeamId: AWAY, committedByPlayerId: 201,
        duration: 2, typeCode: "MIN", descKey: "unsportsmanlike-conduct"
      } },
      play("shot-on-goal", 1, "04:30", code),
      endAt()
    ], teams);
    expect(blocks).toEqual([span("01:00", expectedEnd)]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(seconds);
  });

  it("a regulation minor carries its remaining clock into overtime", () => {
    const overtime = (type: string, time: string) => ({
      ...play(type, 4, time, "1451"),
      periodDescriptor: { number: 4, periodType: "OT" }
    });
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      minor(3, "19:00", AWAY),
      periodEnd("1451"),
      overtime("period-start", "00:00"),
      overtime("game-end", "02:00")
    ]);
    expect(blocks).toEqual([{
      teamId: HOME,
      start: { period: 3, type: "REG", timeInPeriod: "19:00" },
      end: { period: 4, type: "OT", timeInPeriod: "01:00" }
    }]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(120);
  });

  it("coincidental minors cancel while an additional offender creates a two-minute PP", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 101, 2, HOME),
      assessed("01:00", 201),
      assessed("01:00", 202),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:00", "03:00")]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(0);
  });

  const captainChoice = () => [
    play("faceoff", 1, "00:00", "1551"),
    play("faceoff", 1, "00:00", "1551", { eventOwnerTeamId: AWAY }),
    assessed("00:00", 101, 5, HOME),
    assessed("00:00", 101, 2, HOME),
    assessed("00:00", 102, 2, HOME),
    assessed("00:00", 201, 2, AWAY)
  ];

  it("flags ambiguous captain-choice cancellation for either same-stoppage event order", () => {
    const plays = captainChoice();
    const reordered = [...plays.slice(0, 2), ...plays.slice(2).reverse()];
    // Rulebook Table 13 permits a single 7-minute offender or parallel 5+2 service.
    for (const ordered of [plays, reordered]) {
      expect(() => getPowerPlayBlocks([...ordered, endAt()]))
        .toThrow(/ambiguous.*penalty|penalty.*ambiguous/i);
    }
  });

  it.each([
    { code: "1551", end: "05:00", seconds: 300 },
    { code: "1541", end: "07:00", seconds: 420 }
  ])("interior $code evidence resolves captain-choice service independently of event order", ({ code, end, seconds }) => {
    const plays = captainChoice();
    const reordered = [...plays.slice(0, 2), ...plays.slice(2).reverse()];
    for (const ordered of [plays, reordered]) {
      const blocks = getPowerPlayBlocks([
        ...ordered,
        play("shot-on-goal", 1, "05:30", code, { eventOwnerTeamId: AWAY }),
        endAt()
      ]);
      expect(blocks).toEqual([span("00:00", end, AWAY)]);
      expect(teamPpClockSeconds(blocks, AWAY)).toBe(seconds);
    }
  });

  it("coincident 4v4 penalties retain service slots when two later home minors arrive", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 101, 2, HOME),
      assessed("01:00", 201),
      assessed("01:30", 102, 2, HOME),
      assessed("02:00", 103, 2, HOME),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:30", "05:00", AWAY)]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(210);
  });

  it("regular-season OT coincident minors do not occupy regulation 4v4 service slots", () => {
    const overtime = (type: string, time: string, details: Record<string, unknown> = {}) => {
      const [minutes, seconds] = time.split(":").map(Number);
      const remaining = 300 - minutes * 60 - seconds;
      return {
        ...play(type, 4, time, "1331", details),
        periodDescriptor: { number: 4, periodType: "OT" },
        timeRemaining: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
      };
    };
    const penalty = (time: string, playerId: number, teamId: number) => overtime("penalty", time, {
      eventOwnerTeamId: teamId, committedByPlayerId: playerId, duration: 2, typeCode: "MIN"
    });
    const regularSeasonTeams = { ...teams, gameType: 2 };
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      overtime("period-start", "00:00"),
      penalty("01:00", 101, HOME),
      penalty("01:00", 201, AWAY),
      penalty("01:30", 102, HOME),
      penalty("02:00", 103, HOME),
      overtime("game-end", "05:00")
    ], regularSeasonTeams);
    expect(blocks).toEqual([{
      teamId: AWAY,
      start: { period: 4, type: "OT", timeInPeriod: "01:30" },
      end: { period: 4, type: "OT", timeInPeriod: "04:00" }
    }]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(150);
  });

  it("PP goals release eligible minors while the protected coincident offender keeps serving", () => {
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      assessed("01:00", 101, 2, HOME),
      assessed("01:00", 201),
      assessed("01:30", 102, 2, HOME),
      assessed("02:00", 103, 2, HOME),
      play("goal", 1, "02:00", "1541", { eventOwnerTeamId: AWAY }),
      play("goal", 1, "02:30", "1541", { eventOwnerTeamId: AWAY }),
      endAt()
    ]);
    expect(blocks).toEqual([span("01:30", "02:30", AWAY)]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(60);
  });

  it.each([
    { duration: 2, expectedEnd: "19:00", seconds: 180 },
    { duration: 4, expectedEnd: "17:00", seconds: 60 }
  ])("Rule 19.4 serves the late major-minus-$duration-minute difference first without goal release", ({ duration, expectedEnd, seconds }) => {
    const penalty = (teamId: number, playerId: number, minutes: number) =>
      play("penalty", 3, "16:00", "1551", {
        eventOwnerTeamId: teamId, committedByPlayerId: playerId,
        duration: minutes, typeCode: minutes === 5 ? "MAJ" : "MIN"
      });
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      penalty(HOME, 101, 5),
      penalty(AWAY, 201, duration),
      play("goal", 3, "16:30", "1541", { eventOwnerTeamId: AWAY }),
      periodEnd("1551")
    ]);
    expect(blocks).toEqual([{
      teamId: AWAY,
      start: { period: 3, type: "REG", timeInPeriod: "16:00" },
      end: { period: 3, type: "REG", timeInPeriod: expectedEnd }
    }]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(seconds);
  });

  it("Rule 19.4 does not net a major against minors served by two distinct opponents", () => {
    const penalty = (teamId: number, playerId: number, duration: number) =>
      play("penalty", 3, "16:00", "1551", {
        eventOwnerTeamId: teamId, committedByPlayerId: playerId,
        duration, typeCode: duration === 5 ? "MAJ" : "MIN"
      });
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      penalty(HOME, 101, 5),
      penalty(AWAY, 201, 2),
      penalty(AWAY, 202, 2),
      periodEnd("1541"),
      { ...play("game-end", 4, "02:00", "1551"), periodDescriptor: { number: 4, periodType: "OT" } }
    ]);
    expect(blocks).toEqual([
      { teamId: HOME, start: { period: 3, type: "REG", timeInPeriod: "16:00" }, end: { period: 3, type: "REG", timeInPeriod: "18:00" } },
      { teamId: AWAY, start: { period: 3, type: "REG", timeInPeriod: "18:00" }, end: { period: 4, type: "OT", timeInPeriod: "01:00" } }
    ]);
    expect(teamPpClockSeconds(blocks, HOME)).toBe(120);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(180);
  });

  it("applies Rule 19.4 after ordinary cancellation under Table 13 example 22", () => {
    const penalty = (teamId: number, playerId: number, duration: number) =>
      play("penalty", 3, "16:00", "1551", {
        eventOwnerTeamId: teamId, committedByPlayerId: playerId,
        duration, typeCode: duration === 5 ? "MAJ" : "MIN"
      });
    const blocks = getPowerPlayBlocks([
      ...openingTeams(),
      penalty(HOME, 101, 5),
      penalty(HOME, 102, 2),
      penalty(AWAY, 201, 4),
      penalty(AWAY, 202, 2),
      play("shot-on-goal", 3, "17:30", "1551"),
      periodEnd("1551")
    ], teams);
    // The ordinary minors cancel; the major-minus-double-minor runs immediately.
    expect(blocks).toEqual([{
      teamId: AWAY,
      start: { period: 3, type: "REG", timeInPeriod: "16:00" },
      end: { period: 3, type: "REG", timeInPeriod: "17:00" }
    }]);
    expect(teamPpClockSeconds(blocks, AWAY)).toBe(60);
  });

  it("a pulled goalie with no penalty creates no penalty-advantage clock", () => {
    const plays = [
      ...openingTeams(),
      play("shot-on-goal", 1, "01:00", "1560"),
      play("goal", 1, "02:00", "1560", { eventOwnerTeamId: AWAY }),
      endAt()
    ];
    expect(getPowerPlayBlocks(plays)).toEqual([]);
    expect(teamPpClockSeconds(getPowerPlayBlocks(plays), HOME)).toBe(0);
    expect(auditPpBlocksAgainstSituationCodes(plays, [], teams).disagreements).toEqual([]);
  });

  it("removes regulation coincident clock slots at regular-season overtime", () => {
    const plays = [
      ...openingTeams(),
      minor(3, "19:00", HOME), minor(3, "19:00", AWAY),
      play("penalty", 4, "00:10", "1331", { eventOwnerTeamId: HOME, committedByPlayerId: 101, duration: 2, typeCode: "MIN" }),
      play("penalty", 4, "00:20", "1341", { eventOwnerTeamId: HOME, committedByPlayerId: 102, duration: 2, typeCode: "MIN" }),
      play("period-end", 4, "05:00", "1331")
    ];
    expect(getPowerPlayBlocks(plays, { ...teams, gameType: 2 })).toEqual([{
      teamId: AWAY,
      start: { period: 4, type: "OT", timeInPeriod: "00:10" },
      end: { period: 4, type: "OT", timeInPeriod: "02:20" }
    }]);
  });

  describe("per-game observed-clock qualification", () => {
    const gameId = 2026020001;
    const completeRegulation = (withMinor = true): Array<ReturnType<typeof play> & {
      timeRemaining?: string;
      details: Record<string, unknown>;
    }> => {
      const clocked = (type: string, period: number, time: string, code = "1551", details: Record<string, unknown> = {}) => {
        const [minutes, seconds] = time.split(":").map(Number);
        const remaining = 1200 - minutes * 60 - seconds;
        return {
          ...play(type, period, time, code, details),
          timeRemaining: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
        };
      };
      return [
        clocked("period-start", 1, "00:00"),
        ...(withMinor ? [clocked("penalty", 1, "01:00", "1551", {
          eventOwnerTeamId: AWAY, committedByPlayerId: 201, typeCode: "MIN", duration: 2
        })] : []),
        clocked("shot-on-goal", 1, "01:30", withMinor ? "1451" : "1551"),
        clocked("shot-on-goal", 1, "03:30", "1551", { eventOwnerTeamId: AWAY }),
        clocked("period-end", 1, "20:00"),
        clocked("period-start", 2, "00:00"),
        clocked("period-end", 2, "20:00"),
        clocked("period-start", 3, "00:00"),
        clocked("game-end", 3, "20:00")
      ];
    };

    it.each([
      { name: "observed two-minute advantage", withMinor: true, seconds: 120 },
      { name: "verified zero opportunity", withMinor: false, seconds: 0 }
    ])("qualifies a complete final game with $name", ({ withMinor, seconds }) => {
      const plays = completeRegulation(withMinor);
      expect(PP_CLOCK_SOURCE).toBe("fhfh-nhl-penalty-context-clock-v2");
      expect(PP_CLOCK_QUALIFIED).toBe(true);
      expect(hasCompletePenaltyClockSource(plays, 2)).toBe(true);
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays })).toMatchObject({
        seconds,
        qualified: true,
        unqualifiedReason: null,
        audit: { disagreements: 0 }
      });
    });

    it.each(["missing period", "missing clock", "missing game end", "duplicate event ID", "incorrect period type"])(
      "keeps a calculable clock unqualified with %s",
      (defect) => {
        let plays = completeRegulation();
        if (defect === "missing period") plays = plays.filter(p => p.periodDescriptor.number !== 2);
        if (defect === "missing clock") delete plays[2].timeRemaining;
        if (defect === "missing game end") plays[plays.length - 1].typeDescKey = "period-end";
        if (defect === "duplicate event ID") plays[3].eventId = plays[2].eventId;
        if (defect === "incorrect period type") plays[5].periodDescriptor.periodType = "OT";
        expect(hasCompletePenaltyClockSource(plays, 2)).toBe(false);
        expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays })).toMatchObject({
          seconds: 120,
          qualified: false,
          unqualifiedReason: PP_CLOCK_UNQUALIFIED_REASON
        });
      }
    );

    it("returns unknown seconds for unresolved captain-selected cancellation", () => {
      expect(buildTeamPpClock({ gameId, teamId: AWAY, ...teams, plays: [...captainChoice(), endAt()] })).toMatchObject({
        seconds: null,
        qualified: false,
        unqualifiedReason: expect.stringMatching(/ambiguous.*penalty|penalty.*ambiguous/i),
        audit: null
      });
    });

    it("returns unknown seconds for an unsupported penalty instead of a qualified zero", () => {
      const plays = completeRegulation();
      plays[1] = { ...plays[1], details: { ...plays[1].details, duration: 3 } };
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays })).toMatchObject({
        seconds: null,
        qualified: false,
        unqualifiedReason: expect.stringMatching(/penalty/i),
        audit: null
      });
    });

    it("returns unknown seconds for malformed event time", () => {
      const plays = completeRegulation();
      plays[2].timeInPeriod = "01:99";
      expect(hasCompletePenaltyClockSource(plays, 2)).toBe(false);
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays })).toMatchObject({
        seconds: null,
        qualified: false,
        audit: null
      });
    });

    it("catches a malformed numeric situation code even on the terminal event", () => {
      const plays = completeRegulation();
      // Deliberately violate the source contract without weakening the normal fixture type.
      plays[plays.length - 1].situationCode = 1551 as unknown as string;
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays })).toMatchObject({
        seconds: null,
        qualified: false,
        unqualifiedReason: expect.stringMatching(/situation/i),
        audit: null
      });
    });

    it("never qualifies a requested team outside the game's two teams", () => {
      expect(buildTeamPpClock({ gameId, teamId: 999, ...teams, plays: completeRegulation() })).toMatchObject({
        seconds: null,
        qualified: false,
        audit: null
      });
    });
  });
});
