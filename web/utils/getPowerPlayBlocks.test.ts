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
import { buildNhlGameSummaryReportUrl } from "lib/NHL/htmlReports";
import { PP_PENALTY_SUMMARY_REFERENCES, penaltySummarySeconds } from "./ppPenaltySummaryRegistry";

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
    // The period-end code is transitional and not checked (decision 144).
    expect(audit.checkedEvents).toBe(5);
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
    const official = { powerPlayToi: "02:00", powerPlay: "0/1" };
    expect(buildTeamPpClock({ gameId: 1, teamId: HOME, ...teams, plays, official })).toEqual({
      gameId: 1,
      teamId: HOME,
      seconds: 120,
      source: PP_CLOCK_SOURCE,
      qualified: false,
      unqualifiedReason: PP_CLOCK_UNQUALIFIED_REASON,
      audit: { checkedEvents: 2, disagreements: 0 },
      official: { class: "nonzero", seconds: 120, diffSeconds: 0 },
      referenceSource: "teamGameStats",
      penaltySummary: null
    });
    expect(buildTeamPpClock({ gameId: 1, teamId: HOME, ...teams, plays: null, official })).toMatchObject({
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

    const official = { powerPlayToi: "02:00", powerPlay: "0/1" };

    it.each([
      { name: "observed two-minute advantage", withMinor: true, seconds: 120, official },
      { name: "verified zero opportunity", withMinor: false, seconds: 0, official: { powerPlayToi: "00:00", powerPlay: "0/0" } }
    ])("qualifies a complete final game with $name", ({ withMinor, seconds, official }) => {
      const plays = completeRegulation(withMinor);
      expect(PP_CLOCK_SOURCE).toBe("fhfh-nhl-penalty-context-clock-v2");
      expect(PP_CLOCK_QUALIFIED).toBe(true);
      expect(hasCompletePenaltyClockSource(plays, 2)).toBe(true);
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays, official })).toMatchObject({
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
        expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays, official })).toMatchObject({
          seconds: 120,
          qualified: false,
          unqualifiedReason: PP_CLOCK_UNQUALIFIED_REASON
        });
      }
    );

    it("returns unknown seconds for unresolved captain-selected cancellation", () => {
      expect(buildTeamPpClock({ gameId, teamId: AWAY, ...teams, plays: [...captainChoice(), endAt()], official })).toMatchObject({
        seconds: null,
        qualified: false,
        unqualifiedReason: expect.stringMatching(/ambiguous.*penalty|penalty.*ambiguous/i),
        audit: null
      });
    });

    it("returns unknown seconds for an unsupported penalty instead of a qualified zero", () => {
      const plays = completeRegulation();
      plays[1] = { ...plays[1], details: { ...plays[1].details, duration: 3 } };
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays, official })).toMatchObject({
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
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays, official })).toMatchObject({
        seconds: null,
        qualified: false,
        audit: null
      });
    });

    it("catches a malformed numeric situation code even on the terminal event", () => {
      const plays = completeRegulation();
      // Deliberately violate the source contract without weakening the normal fixture type.
      plays[plays.length - 1].situationCode = 1551 as unknown as string;
      expect(buildTeamPpClock({ gameId, teamId: HOME, ...teams, plays, official })).toMatchObject({
        seconds: null,
        qualified: false,
        unqualifiedReason: expect.stringMatching(/situation/i),
        audit: null
      });
    });

    it("never qualifies a requested team outside the game's two teams", () => {
      expect(buildTeamPpClock({ gameId, teamId: 999, ...teams, plays: completeRegulation(), official })).toMatchObject({
        seconds: null,
        qualified: false,
        audit: null
      });
    });
  });
});

describe("match penalty recorded as MAT/15 (decision 144, F11 C3)", () => {
  // Stored 2025-26 game 2025021128 (nhl_api_pbp_events): every penalty, goal and
  // period marker. The NHL records the match penalty with its game-misconduct
  // minutes folded in (MAT/15); only the 5-minute major changes manpower.
  // Official team PP TOI (teamGameStats): home 05:00, away 04:00.
  const homeTeamId = 19;
  const awayTeamId = 15;
  const gameTeams = { homeTeamId, awayTeamId, gameType: 2 };
  type Row = [eventId: number, sortOrder: number, period: number, time: string, code: string, type: string,
    teamId?: number, typeCode?: string, descKey?: string, duration?: number, committedBy?: number, servedBy?: number];
  const rows: Row[] = [
    [54, 10, 1, "00:00", "1551", "period-start"],
    [156, 106, 1, "07:46", "1551", "penalty", homeTeamId, "MIN", "hooking", 2, 8484188],
    [324, 172, 1, "13:45", "1551", "penalty", awayTeamId, "MIN", "tripping", 2, 8479345],
    [395, 236, 1, "19:12", "1551", "penalty", homeTeamId, "MIN", "slashing", 2, 8482089],
    [17, 248, 1, "20:00", "1541", "period-end"],
    [410, 254, 2, "00:00", "1541", "period-start"],
    [444, 291, 2, "02:39", "1551", "goal", homeTeamId],
    [616, 355, 2, "07:38", "1551", "penalty", homeTeamId, "MAJ", "fighting", 5, 8484230],
    [612, 357, 2, "07:38", "1551", "penalty", awayTeamId, "MAJ", "fighting", 5, 8484186],
    [34, 412, 2, "12:04", "1551", "penalty", awayTeamId, "MIN", "roughing", 2, 8476880],
    [681, 414, 2, "12:04", "1551", "penalty", awayTeamId, "MIN", "roughing", 2, 8476880],
    [678, 416, 2, "12:04", "1551", "penalty", homeTeamId, "MIN", "roughing", 2, 8483516],
    [685, 418, 2, "12:04", "1551", "penalty", homeTeamId, "MIN", "roughing", 2, 8480023],
    [718, 444, 2, "14:34", "1560", "penalty", awayTeamId, "MIN", "slashing", 2, 8481580],
    [39, 516, 2, "20:00", "1551", "period-end"],
    [790, 523, 3, "00:00", "1551", "period-start"],
    [893, 622, 3, "08:25", "1551", "penalty", awayTeamId, "MAT", "match-penalty", 15, 8479400, 8483491],
    [50, 624, 3, "08:25", "1551", "penalty", homeTeamId, "MIN", "interference", 2, 8480023, 8480459],
    [918, 647, 3, "10:38", "1451", "penalty", homeTeamId, "BEN", "too-many-men-on-the-ice", 2, undefined, 8482089],
    [970, 699, 3, "14:52", "1551", "goal", homeTeamId],
    [1038, 768, 3, "19:19", "0651", "goal", homeTeamId],
    [463, 772, 3, "20:00", "1551", "period-end"],
    [467, 776, 3, "20:00", "1551", "game-end"]
  ];
  const storedPlays = () => rows.map(
    ([eventId, sortOrder, period, timeInPeriod, situationCode, typeDescKey, teamId, typeCode, descKey, duration, committedBy, servedBy]) => ({
      eventId,
      sortOrder,
      typeDescKey,
      periodDescriptor: { number: period, periodType: "REG" },
      timeInPeriod,
      situationCode,
      details: {
        ...(teamId == null ? {} : { eventOwnerTeamId: teamId }),
        ...(typeCode == null ? {} : { typeCode, descKey, duration }),
        ...(committedBy == null ? {} : { committedByPlayerId: committedBy }),
        ...(servedBy == null ? {} : { servedByPlayerId: servedBy })
      }
    })
  );
  const at = (period: number, timeInPeriod: string) => ({ period, type: "REG", timeInPeriod });

  it("serves the match penalty as one 5-minute major and reproduces the official PP totals", () => {
    const blocks = getPowerPlayBlocks(storedPlays(), gameTeams);
    expect(blocks).toEqual([
      { teamId: awayTeamId, start: at(1, "07:46"), end: at(1, "09:46") },
      { teamId: homeTeamId, start: at(1, "13:45"), end: at(1, "15:45") },
      { teamId: awayTeamId, start: at(1, "19:12"), end: at(2, "01:12") },
      { teamId: homeTeamId, start: at(2, "14:34"), end: at(2, "16:34") },
      // 08:25 major vs the home minor: 4v4 to 10:25, then the major alone;
      // the 10:38 bench minor evens it until 12:38; the major ends at 13:25.
      { teamId: homeTeamId, start: at(3, "10:25"), end: at(3, "10:38") },
      { teamId: homeTeamId, start: at(3, "12:38"), end: at(3, "13:25") }
    ]);
    expect(teamPpClockSeconds(blocks, homeTeamId)).toBe(300);
    expect(teamPpClockSeconds(blocks, awayTeamId)).toBe(240);
  });

  it("still refuses a match penalty recorded with any other duration", () => {
    const plays = storedPlays().map((p) =>
      p.eventId === 893 ? { ...p, details: { ...p.details, duration: 10 } } : p
    );
    expect(() => getPowerPlayBlocks(plays, gameTeams)).toThrow("Unsupported penalty-clock penalty MAT/10");
  });
});

describe("stored-game qualification (decision 144, F11 C1 and C2)", () => {
  // Stored 2025-26 and 2026-27 games (nhl_api_pbp_events): every penalty, goal
  // and period marker, each event the old audit flagged, and the first interior
  // event of each PP span. Each subset rebuilds the full game's spans exactly.
  // Official totals are the stored teamGameStats rows.
  type Side = "H" | "A";
  type Row = [eventId: number, sortOrder: number, period: number, time: string, code: string, type: string,
    side?: Side, typeCode?: string, descKey?: string, duration?: number, committedBy?: number, servedBy?: number];
  type StoredGame = {
    gameId: number; homeTeamId: number; awayTeamId: number; gameType?: number;
    official: Record<Side, { powerPlayToi: string; powerPlay: string }>;
    rows: Row[];
  };
  const storedPlays = ({ homeTeamId, awayTeamId, rows }: StoredGame) => rows.map(
    ([eventId, sortOrder, period, timeInPeriod, situationCode, typeDescKey, side, typeCode, descKey, duration, committedBy, servedBy]) => {
      const [minutes, seconds] = timeInPeriod.split(":").map(Number);
      const remaining = 1200 - minutes * 60 - seconds;
      return {
        eventId,
        sortOrder,
        typeDescKey,
        periodDescriptor: { number: period, periodType: "REG" },
        timeInPeriod,
        timeRemaining: `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`,
        situationCode,
        details: {
          ...(side == null ? {} : { eventOwnerTeamId: side === "H" ? homeTeamId : awayTeamId }),
          ...(typeCode == null ? {} : { typeCode, descKey, duration }),
          ...(committedBy == null ? {} : { committedByPlayerId: committedBy }),
          ...(servedBy == null ? {} : { servedByPlayerId: servedBy })
        }
      };
    }
  );
  const clockFor = (game: StoredGame, side: Side, official: StoredGame["official"][Side] | null = game.official[side]) =>
    buildTeamPpClock({
      gameId: game.gameId,
      teamId: side === "H" ? game.homeTeamId : game.awayTeamId,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      gameType: game.gameType ?? 2,
      plays: storedPlays(game),
      official
    });

  // The old audit flagged period-end 1146 and game-end 516 (1550 at the final
  // horn, after a penalty at 60:00).
  const game2026020002: StoredGame = {
    gameId: 2026020002, homeTeamId: 10, awayTeamId: 8,
    official: { H: { powerPlayToi: "06:00", powerPlay: "0/3" }, A: { powerPlayToi: "04:00", powerPlay: "0/2" } },
    rows: [
      [52, 8, 1, "00:00", "1551", "period-start"],
      [62, 20, 1, "00:48", "1551", "goal", "H"],
      [172, 124, 1, "08:33", "1551", "penalty", "H", "MIN", "hooking", 2, 8477426],
      [181, 130, 1, "08:41", "1541", "giveaway", "A"],
      [203, 154, 1, "10:53", "1551", "goal", "A"],
      [217, 163, 1, "11:42", "1551", "penalty", "A", "MIN", "tripping", 2, 8484984],
      [223, 169, 1, "12:05", "1451", "takeaway", "A"],
      [20, 284, 1, "20:00", "1551", "period-end"],
      [390, 290, 2, "00:00", "1551", "period-start"],
      [602, 358, 2, "04:52", "1551", "goal", "A"],
      [718, 465, 2, "12:56", "1551", "penalty", "H", "MIN", "roughing", 2, 8476931],
      [721, 467, 2, "12:56", "1551", "penalty", "A", "MIN", "roughing", 2, 8481618],
      [792, 536, 2, "17:45", "1551", "penalty", "A", "MIN", "tripping", 2, 8481540],
      [802, 544, 2, "18:46", "1451", "giveaway", "H"],
      [40, 556, 2, "20:00", "1551", "period-end"],
      [816, 563, 3, "00:00", "1551", "period-start"],
      [912, 660, 3, "07:01", "0651", "penalty", "H", "MIN", "tripping", 2, 8475171],
      [915, 665, 3, "07:27", "1541", "shot-on-goal", "A"],
      [941, 687, 3, "09:16", "1551", "penalty", "A", "MIN", "interference", 2, 8480074],
      [945, 692, 3, "09:29", "1451", "shot-on-goal", "H"],
      [1047, 744, 3, "13:12", "1551", "goal", "A"],
      [1088, 781, 3, "15:46", "1551", "goal", "H"],
      [511, 842, 3, "20:00", "1560", "penalty", "H", "MIN", "roughing", 2, 8475166],
      [1146, 844, 3, "20:00", "1550", "period-end"],
      [516, 848, 3, "20:00", "1550", "game-end"]
    ]
  };
  // The old audit flagged stoppage 1231 and penalties 802 and 36, logged at the
  // same second as a PP goal, with a stale 1551 inside the merged PP.
  const game2026020058: StoredGame = {
    gameId: 2026020058, homeTeamId: 8, awayTeamId: 18,
    official: { H: { powerPlayToi: "04:26", powerPlay: "0/3" }, A: { powerPlayToi: "06:53", powerPlay: "2/5" } },
    rows: [
      [61, 8, 1, "00:00", "1551", "period-start"],
      [159, 62, 1, "03:11", "1551", "penalty", "A", "MIN", "hooking", 2, 8475158],
      [173, 67, 1, "03:23", "1451", "giveaway", "A"],
      [374, 171, 1, "10:46", "1551", "penalty", "H", "MIN", "tripping", 2, 8483457],
      [378, 178, 1, "11:08", "1541", "faceoff", "A"],
      [15, 291, 1, "20:00", "1551", "period-end"],
      [497, 298, 2, "00:00", "1551", "period-start"],
      [528, 326, 2, "02:40", "1551", "penalty", "H", "MIN", "broken-stick", 2, 8476981],
      [23, 331, 2, "03:04", "1541", "delayed-penalty", "A"],
      [534, 332, 2, "03:06", "1541", "penalty", "A", "MIN", "tripping", 2, 8484241],
      [539, 339, 2, "03:12", "1441", "goal", "H"],
      [650, 402, 2, "08:50", "1551", "goal", "H"],
      [737, 483, 2, "15:06", "1551", "goal", "A"],
      [775, 513, 2, "18:00", "1551", "penalty", "H", "MIN", "tripping", 2, 8480865],
      [781, 518, 2, "18:35", "1541", "shot-on-goal", "A"],
      [795, 533, 2, "19:28", "1541", "goal", "A"],
      [1231, 534, 2, "19:28", "1551", "stoppage"],
      [802, 535, 2, "19:28", "1551", "penalty", "H", "MIN", "cross-checking", 2, 8476981],
      [36, 537, 2, "19:28", "1551", "penalty", "H", "MIS", "misconduct", 10, 8482964],
      [43, 546, 2, "20:00", "1541", "period-end"],
      [812, 553, 3, "00:00", "1541", "period-start"],
      [878, 612, 3, "04:55", "1551", "penalty", "A", "MIN", "holding", 2, 8479980],
      [882, 617, 3, "05:34", "1451", "missed-shot", "H"],
      [1007, 735, 3, "15:45", "1551", "penalty", "H", "MIN", "tripping", 2, 8476875],
      [1012, 740, 3, "16:44", "1541", "goal", "A"],
      [1025, 751, 3, "17:23", "1560", "goal", "A"],
      [1037, 763, 3, "18:34", "1560", "goal", "A"],
      [562, 779, 3, "20:00", "1551", "period-end"],
      [566, 783, 3, "20:00", "1551", "game-end"]
    ]
  };
  // The old audit flagged penalty 210, the second of two coincident minors,
  // which carries the first one's post-change code.
  const game2026020093: StoredGame = {
    gameId: 2026020093, homeTeamId: 12, awayTeamId: 15,
    official: { H: { powerPlayToi: "08:07", powerPlay: "1/5" }, A: { powerPlayToi: "03:46", powerPlay: "0/2" } },
    rows: [
      [102, 8, 1, "00:00", "1551", "period-start"],
      [205, 58, 1, "03:18", "1551", "penalty", "H", "MIN", "interference", 2, 8477478],
      [210, 61, 1, "03:18", "1541", "penalty", "A", "MIN", "tripping", 2, 8479345],
      [293, 140, 1, "09:26", "1551", "goal", "A"],
      [502, 240, 1, "17:27", "1551", "penalty", "H", "MIN", "cross-checking", 2, 8475235],
      [520, 250, 1, "18:51", "1541", "hit", "H"],
      [522, 258, 1, "19:13", "0641", "penalty", "H", "MIN", "unsportsmanlike-conduct", 2, 8480830],
      [71, 273, 1, "20:00", "1541", "period-end"],
      [538, 280, 2, "00:00", "1541", "period-start"],
      [303, 329, 2, "03:58", "1551", "goal", "H"],
      [590, 331, 2, "03:58", "1551", "penalty", "A", "BEN", "delaying-game-unsuccessful-challenge", 2, undefined, 8471214],
      [593, 337, 2, "04:25", "1451", "faceoff", "A"],
      [713, 356, 2, "06:39", "1551", "goal", "A"],
      [771, 406, 2, "10:45", "1551", "penalty", "A", "MIN", "delaying-game-puck-over-glass", 2, 8484873],
      [775, 411, 2, "10:50", "1451", "shot-on-goal", "H"],
      [866, 502, 2, "18:49", "1551", "goal", "H"],
      [98, 503, 2, "18:49", "1551", "penalty", "H", "MIN", "roughing", 2, 8482809],
      [95, 505, 2, "18:49", "1551", "penalty", "A", "MIN", "roughing", 2, 8484186],
      [875, 512, 2, "19:25", "1441", "penalty", "A", "MIN", "hooking", 2, 8479345],
      [880, 518, 2, "19:30", "1341", "faceoff", "A"],
      [601, 521, 2, "20:00", "1341", "period-end"],
      [888, 527, 3, "00:00", "1341", "period-start"],
      [973, 612, 3, "07:12", "1551", "penalty", "A", "MIN", "slashing", 2, 8484186],
      [978, 617, 3, "07:25", "1451", "blocked-shot", "H"],
      [1050, 687, 3, "13:49", "1551", "penalty", "A", "MIN", "tripping", 2, 8482088],
      [1054, 692, 3, "13:56", "1451", "goal", "H"],
      [1118, 755, 3, "18:33", "0651", "goal", "H"],
      [623, 774, 3, "20:00", "0651", "period-end"],
      [627, 778, 3, "20:00", "0651", "game-end"]
    ]
  };

  // Coincident-penalty scrum mismatch (REPORT.md section 2). The clock agrees
  // with every interior situation code.
  const game2026020036: StoredGame = {
    gameId: 2026020036, homeTeamId: 3, awayTeamId: 68,
    official: { H: { powerPlayToi: "06:12", powerPlay: "0/4" }, A: { powerPlayToi: "02:00", powerPlay: "1/1" } },
    rows: [
      [52, 8, 1, "00:00", "1551", "period-start"],
      [101, 56, 1, "03:31", "1551", "penalty", "H", "MIN", "interference", 2, 8477969],
      [108, 64, 1, "04:17", "1541", "missed-shot", "A"],
      [244, 144, 1, "10:39", "1551", "penalty", "A", "MIN", "tripping", 2, 8477346],
      [248, 149, 1, "11:03", "1451", "blocked-shot", "H"],
      [398, 246, 1, "17:18", "1551", "goal", "H"],
      [404, 247, 1, "17:18", "1551", "penalty", "A", "MIN", "roughing", 2, 8480849],
      [407, 249, 1, "17:18", "1551", "penalty", "H", "MIN", "roughing", 2, 8482157],
      [417, 258, 1, "18:03", "1441", "penalty", "A", "MIN", "cross-checking", 2, 8477951],
      [424, 264, 1, "18:29", "1341", "blocked-shot", "H"],
      [15, 281, 1, "20:00", "1451", "period-end"],
      [446, 287, 2, "00:00", "1451", "period-start"],
      [607, 347, 2, "04:28", "1560", "penalty", "A", "MIN", "interference", 2, 8477346],
      [615, 352, 2, "04:40", "1451", "missed-shot", "H"],
      [749, 469, 2, "14:01", "1551", "penalty", "H", "MIN", "roughing", 2, 8482157, 8482877],
      [746, 471, 2, "14:01", "1551", "penalty", "H", "MIN", "boarding", 2, 8482157],
      [739, 473, 2, "14:01", "1551", "penalty", "A", "MIN", "cross-checking", 2, 8479410],
      [752, 479, 2, "14:21", "1541", "missed-shot", "A"],
      [801, 481, 2, "14:29", "1541", "goal", "A"],
      [38, 552, 2, "20:00", "1551", "period-end"],
      [877, 559, 3, "00:00", "1551", "period-start"],
      [155, 571, 3, "01:03", "1551", "penalty", "H", "MAJ", "fighting", 5, 8482157],
      [45, 573, 3, "01:03", "1551", "penalty", "A", "MAJ", "fighting", 5, 8480855],
      [977, 604, 3, "03:15", "1551", "goal", "H"],
      [1111, 736, 3, "12:47", "1551", "goal", "H"],
      [1143, 766, 3, "14:57", "1551", "goal", "A"],
      [1205, 821, 3, "18:45", "0651", "goal", "H"],
      [1219, 831, 3, "19:48", "0651", "penalty", "A", "MIN", "interference", 2, 8479410],
      [559, 836, 3, "20:00", "1451", "period-end"],
      [563, 840, 3, "20:00", "1451", "game-end"]
    ]
  };
  // Decision 152 scrum games (REPORT.md section 9); same subset rule.
  const game2026020153: StoredGame = {
    gameId: 2026020153, homeTeamId: 9, awayTeamId: 13,
    official: { H: { powerPlayToi: "12:26", powerPlay: "1/9" }, A: { powerPlayToi: "05:53", powerPlay: "1/5" } },
    rows: [
      [54, 8, 1, "00:00", "1551", "period-start"],
      [119, 78, 1, "04:23", "1551", "penalty", "A", "MIN", "high-sticking", 2, 8477932],
      [129, 85, 1, "05:00", "1451", "shot-on-goal", "H"],
      [209, 159, 1, "09:51", "1551", "penalty", "H", "MIN", "tripping", 2, 8482245],
      [214, 164, 1, "10:00", "1541", "goal", "A"],
      [15, 169, 1, "10:05", "1551", "penalty", "H", "MAJ", "fighting", 5, 8478173],
      [227, 171, 1, "10:05", "1551", "penalty", "A", "MAJ", "fighting", 5, 8478147],
      [323, 209, 1, "12:45", "1551", "penalty", "A", "MIN", "cross-checking", 2, 8475462],
      [327, 215, 1, "12:53", "1451", "faceoff", "H"],
      [335, 222, 1, "14:13", "1451", "goal", "H"],
      [359, 241, 1, "15:32", "1551", "penalty", "A", "MIN", "roughing", 2, 8480801],
      [363, 243, 1, "15:32", "1551", "penalty", "H", "MIN", "roughing", 2, 8482245],
      [367, 245, 1, "15:32", "1551", "penalty", "H", "MIN", "roughing", 2, 8476393],
      [371, 247, 1, "15:32", "1551", "penalty", "A", "MIN", "roughing", 2, 8475462],
      [378, 256, 1, "16:00", "1551", "penalty", "H", "MIN", "high-sticking", 2, 8484321],
      [385, 261, 1, "16:12", "1541", "shot-on-goal", "A"],
      [24, 321, 1, "20:00", "1551", "penalty", "H", "MIN", "roughing-removing-opponents-helmet", 2, 8484759],
      [495, 323, 1, "20:00", "1541", "period-end"],
      [507, 329, 2, "00:00", "1541", "period-start"],
      [508, 334, 2, "00:31", "1541", "faceoff", "H"],
      [527, 347, 2, "01:37", "1541", "penalty", "A", "MIN", "holding", 2, 8477932],
      [543, 365, 2, "03:18", "1451", "shot-on-goal", "H"],
      [645, 415, 2, "06:58", "1551", "penalty", "A", "MIN", "tripping", 2, 8478859],
      [707, 421, 2, "07:05", "1451", "penalty", "H", "MIN", "slashing", 2, 8480208],
      [738, 452, 2, "09:34", "1551", "goal", "H"],
      [771, 483, 2, "11:43", "1551", "penalty", "A", "MIN", "high-sticking", 2, 8479314],
      [789, 499, 2, "12:59", "1451", "shot-on-goal", "A"],
      [848, 561, 2, "17:18", "1551", "goal", "H"],
      [34, 588, 2, "19:43", "1551", "penalty", "A", "MIN", "slashing", 2, 8477935],
      [884, 593, 2, "19:46", "1451", "shot-on-goal", "H"],
      [890, 597, 2, "20:00", "1451", "period-end"],
      [898, 604, 3, "00:00", "1451", "period-start"],
      [924, 627, 3, "02:17", "1551", "penalty", "H", "MAJ", "fighting", 5, 8482092],
      [38, 629, 3, "02:17", "1551", "penalty", "A", "MAJ", "fighting", 5, 8477935],
      [412, 652, 3, "03:35", "1551", "penalty", "A", "MIN", "roughing", 2, 8479314],
      [415, 654, 3, "03:35", "1551", "penalty", "H", "MIN", "roughing", 2, 8476393],
      [418, 656, 3, "03:35", "1551", "penalty", "A", "MIN", "roughing", 2, 8480801],
      [421, 658, 3, "03:35", "1551", "penalty", "H", "MIN", "roughing", 2, 8481528],
      [424, 660, 3, "03:35", "1551", "penalty", "H", "MIS", "misconduct", 10, 8476393],
      [1031, 725, 3, "07:58", "1551", "goal", "H"],
      [1101, 792, 3, "12:04", "1551", "penalty", "H", "MIN", "slashing", 2, 8478173],
      [1112, 798, 3, "12:07", "1541", "hit", "A"],
      [1137, 827, 3, "14:57", "1551", "goal", "H"],
      [50, 841, 3, "15:34", "1551", "penalty", "A", "MIS", "misconduct", 10, 8478147],
      [1206, 888, 3, "18:46", "1551", "penalty", "A", "MIN", "roughing", 2, 8480801, 8477409],
      [409, 890, 3, "18:46", "1551", "penalty", "H", "MIN", "roughing", 2, 8482092],
      [406, 892, 3, "18:46", "1551", "penalty", "A", "MIN", "roughing", 2, 8479314],
      [1217, 897, 3, "18:57", "1451", "hit", "A"],
      [1213, 901, 3, "20:00", "1451", "period-end"],
      [405, 905, 3, "20:00", "1451", "game-end"]
    ]
  };
  const game2025021248: StoredGame = {
    gameId: 2025021248, homeTeamId: 8, awayTeamId: 14,
    official: { H: { powerPlayToi: "12:26", powerPlay: "0/7" }, A: { powerPlayToi: "08:00", powerPlay: "0/4" } },
    rows: [
      [52, 8, 1, "00:00", "1551", "period-start"],
      [106, 71, 1, "03:48", "1551", "penalty", "A", "MIN", "high-sticking-double-minor", 4, 8476826],
      [113, 76, 1, "03:59", "1451", "missed-shot", "H"],
      [288, 192, 1, "13:11", "0651", "penalty", "H", "MIN", "roughing", 2, 8482964],
      [292, 197, 1, "13:48", "1541", "shot-on-goal", "A"],
      [325, 225, 1, "16:03", "0651", "penalty", "H", "MIN", "high-sticking", 2, 8484984],
      [331, 231, 1, "16:28", "1541", "faceoff", "H"],
      [345, 239, 1, "17:40", "1541", "penalty", "H", "MIN", "roughing", 2, 8476981],
      [349, 242, 1, "17:40", "1541", "penalty", "A", "MIN", "slashing", 2, 8476453],
      [22, 277, 1, "20:00", "1551", "period-end"],
      [437, 285, 2, "00:00", "1551", "period-start"],
      [529, 319, 2, "03:33", "1551", "penalty", "H", "MIN", "roughing", 2, 8480813],
      [526, 321, 2, "03:33", "1551", "penalty", "H", "MIN", "roughing", 2, 8481593],
      [535, 323, 2, "03:33", "1551", "penalty", "A", "MIN", "roughing", 2, 8480426],
      [532, 325, 2, "03:33", "1551", "penalty", "A", "MIN", "roughing", 2, 8477426],
      [522, 327, 2, "03:33", "1551", "penalty", "A", "MIN", "roughing", 2, 8470621],
      [538, 329, 2, "03:33", "1551", "penalty", "H", "MIN", "roughing", 2, 8476981],
      [30, 331, 2, "03:33", "1551", "penalty", "H", "MIN", "cross-checking", 2, 8476981],
      [542, 338, 2, "04:03", "1541", "faceoff", "H"],
      [572, 367, 2, "06:30", "1551", "goal", "H"],
      [583, 375, 2, "07:04", "1551", "penalty", "A", "MIN", "roughing", 2, 8478519],
      [602, 380, 2, "07:07", "1451", "giveaway", "A"],
      [655, 437, 2, "12:20", "1551", "penalty", "A", "MIN", "slashing", 2, 8477416],
      [652, 439, 2, "12:20", "1551", "penalty", "H", "MIS", "misconduct", 10, 8481593],
      [649, 441, 2, "12:20", "1551", "penalty", "A", "MIS", "misconduct", 10, 8477426],
      [672, 448, 2, "12:58", "1451", "takeaway", "A"],
      [47, 474, 2, "15:00", "1551", "penalty", "A", "MIN", "instigator", 2, 8483398, 8470621],
      [44, 476, 2, "15:00", "1551", "penalty", "H", "MAJ", "fighting", 5, 8476981],
      [50, 478, 2, "15:00", "1551", "penalty", "A", "MAJ", "fighting", 5, 8483398],
      [452, 480, 2, "15:00", "1551", "penalty", "A", "MIS", "instigator-misconduct", 10, 8483398],
      [697, 489, 2, "16:09", "1451", "blocked-shot", "H"],
      [722, 511, 2, "17:34", "1551", "penalty", "A", "MIN", "interference-goalkeeper", 2, 8478010],
      [456, 513, 2, "17:34", "1551", "penalty", "A", "MIN", "roughing", 2, 8478178],
      [469, 515, 2, "17:34", "1551", "penalty", "H", "MIN", "roughing", 2, 8480074],
      [459, 517, 2, "17:34", "1551", "penalty", "A", "MIN", "roughing", 2, 8478178],
      [461, 519, 2, "17:34", "1551", "penalty", "H", "MIN", "roughing", 2, 8478133],
      [464, 521, 2, "17:34", "1551", "penalty", "H", "MIS", "misconduct", 10, 8478133],
      [480, 523, 2, "17:34", "1551", "penalty", "A", "MIS", "misconduct", 10, 8478178],
      [472, 525, 2, "17:34", "1551", "penalty", "H", "MIS", "misconduct", 10, 8480074],
      [726, 527, 2, "17:34", "1551", "penalty", "A", "MIS", "misconduct", 10, 8480426],
      [731, 532, 2, "18:02", "1451", "missed-shot", "H"],
      [466, 556, 2, "20:00", "1551", "period-end"],
      [760, 563, 3, "00:00", "1551", "period-start"],
      [483, 716, 3, "11:02", "1551", "penalty", "A", "MIN", "roughing", 2, 8482655],
      [1005, 723, 3, "11:24", "1451", "hit", "A"],
      [1007, 761, 3, "14:22", "1551", "penalty", "H", "MIN", "kneeing", 2, 8484984],
      [208, 770, 3, "14:37", "1541", "missed-shot", "A"],
      [1054, 808, 3, "18:09", "0651", "goal", "A"],
      [1067, 823, 3, "18:56", "1551", "goal", "H"],
      [497, 838, 3, "20:00", "0651", "period-end"],
      [801, 842, 3, "20:00", "0651", "game-end"]
    ]
  };
  const game2025021097: StoredGame = {
    gameId: 2025021097, homeTeamId: 20, awayTeamId: 13,
    official: { H: { powerPlayToi: "09:24", powerPlay: "2/7" }, A: { powerPlayToi: "03:39", powerPlay: "0/2" } },
    rows: [
      [54, 10, 1, "00:00", "1551", "period-start"],
      [125, 76, 1, "04:45", "1560", "penalty", "A", "MIN", "tripping", 2, 8481518],
      [128, 81, 1, "04:48", "1451", "shot-on-goal", "H"],
      [21, 284, 1, "20:00", "1551", "period-end"],
      [438, 290, 2, "00:00", "1551", "period-start"],
      [626, 383, 2, "07:44", "1551", "goal", "H"],
      [722, 418, 2, "10:10", "1551", "goal", "H"],
      [778, 471, 2, "14:36", "1551", "penalty", "A", "MIN", "slashing", 2, 8475179],
      [782, 477, 2, "15:02", "1451", "shot-on-goal", "H"],
      [820, 511, 2, "17:22", "1551", "penalty", "H", "MIN", "roughing", 2, 8481028],
      [826, 516, 2, "17:50", "1541", "shot-on-goal", "A"],
      [40, 540, 2, "20:00", "1551", "period-end"],
      [855, 546, 3, "00:00", "1551", "period-start"],
      [904, 602, 3, "04:17", "1551", "goal", "A"],
      [917, 608, 3, "04:41", "1551", "penalty", "A", "MIN", "high-sticking", 2, 8478859],
      [923, 613, 3, "05:20", "1451", "shot-on-goal", "H"],
      [937, 622, 3, "06:20", "1451", "penalty", "H", "MIN", "holding", 2, 8482679],
      [942, 631, 3, "06:42", "1541", "faceoff", "H"],
      [1004, 685, 3, "11:14", "1551", "penalty", "A", "MIN", "hooking", 2, 8478421, 8476994],
      [517, 687, 3, "11:14", "1551", "penalty", "A", "MAJ", "interference", 5, 8478421, 8476994],
      [505, 689, 3, "11:14", "1551", "penalty", "A", "GAM", "game-misconduct", 10, 8478421],
      [1023, 704, 3, "11:58", "1451", "giveaway", "H"],
      [1050, 731, 3, "14:04", "1451", "penalty", "H", "MIN", "tripping", 2, 8480797],
      [1072, 757, 3, "16:05", "1451", "blocked-shot", "A"],
      [1084, 766, 3, "16:39", "1460", "penalty", "A", "MIN", "tripping", 2, 8477931],
      [1088, 775, 3, "16:59", "1351", "goal", "H"],
      [1098, 781, 3, "17:30", "1451", "goal", "H"],
      [512, 820, 3, "20:00", "1551", "period-end"],
      [516, 824, 3, "20:00", "1551", "game-end"]
    ]
  };
  const game2025030112: StoredGame = {
    gameId: 2025030112, homeTeamId: 7, awayTeamId: 6, gameType: 3,
    official: { H: { powerPlayToi: "10:00", powerPlay: "0/5" }, A: { powerPlayToi: "10:12", powerPlay: "1/6" } },
    rows: [
      [52, 8, 1, "00:00", "1551", "period-start"],
      [73, 31, 1, "01:10", "1551", "penalty", "A", "MIN", "roughing", 2, 8477496],
      [78, 33, 1, "01:10", "1551", "penalty", "H", "MIN", "holding", 2, 8480839],
      [10, 72, 1, "04:10", "1551", "penalty", "A", "MIN", "roughing", 2, 8477507, 8478042],
      [120, 74, 1, "04:10", "1551", "penalty", "A", "MIN", "cross-checking", 2, 8477507],
      [124, 76, 1, "04:10", "1551", "penalty", "H", "MIN", "roughing", 2, 8479359],
      [138, 81, 1, "04:34", "1451", "giveaway", "A"],
      [246, 145, 1, "08:43", "0651", "penalty", "H", "MIN", "hooking", 2, 8482659],
      [250, 151, 1, "09:19", "1541", "missed-shot", "A"],
      [270, 166, 1, "10:40", "0641", "penalty", "H", "MIN", "cross-checking", 2, 8479982],
      [495, 290, 1, "19:29", "1551", "penalty", "A", "MIN", "tripping", 2, 8477956],
      [27, 295, 1, "20:00", "1451", "period-end"],
      [561, 301, 2, "00:00", "1451", "period-start"],
      [560, 303, 2, "00:00", "1451", "faceoff", "H"],
      [677, 371, 2, "04:54", "1551", "goal", "A"],
      [715, 404, 2, "07:38", "1551", "penalty", "H", "MIN", "delaying-game-puck-over-glass", 2, 8481524],
      [718, 410, 2, "08:08", "1541", "missed-shot", "A"],
      [746, 434, 2, "09:59", "1551", "penalty", "A", "MIN", "interference", 2, 8479661],
      [773, 439, 2, "10:04", "1451", "giveaway", "A"],
      [901, 505, 2, "16:29", "1551", "goal", "A"],
      [853, 535, 2, "17:55", "1551", "penalty", "H", "MIN", "interference", 2, 8479420],
      [859, 540, 2, "18:10", "1541", "goal", "A"],
      [501, 570, 2, "20:00", "1551", "period-end"],
      [895, 577, 3, "00:00", "1551", "period-start"],
      [896, 579, 3, "00:16", "1551", "goal", "A"],
      [984, 614, 3, "02:26", "1551", "penalty", "A", "MIN", "tripping", 2, 8479325],
      [996, 616, 3, "02:26", "1551", "penalty", "A", "MIN", "roughing", 2, 8479325, 8478042],
      [981, 618, 3, "02:26", "1551", "penalty", "H", "MIN", "roughing", 2, 8479359],
      [988, 620, 3, "02:26", "1551", "penalty", "H", "MAJ", "fighting", 5, 8479378],
      [507, 622, 3, "02:26", "1551", "penalty", "A", "MAJ", "fighting", 5, 8480355],
      [1000, 627, 3, "02:35", "1451", "shot-on-goal", "H"],
      [1061, 683, 3, "06:14", "1551", "penalty", "A", "MIN", "roughing", 2, 8477507],
      [528, 685, 3, "06:14", "1551", "penalty", "A", "MIN", "roughing", 2, 8479369],
      [1065, 687, 3, "06:14", "1551", "penalty", "H", "MIN", "roughing", 2, 8477949],
      [515, 689, 3, "06:14", "1551", "penalty", "H", "MIN", "roughing", 2, 8479420],
      [1072, 691, 3, "06:14", "1551", "penalty", "A", "MIN", "roughing", 2, 8479987],
      [1076, 693, 3, "06:14", "1551", "penalty", "H", "MIN", "roughing", 2, 8484145],
      [531, 695, 3, "06:14", "1551", "penalty", "A", "MIS", "misconduct", 10, 8479369],
      [526, 697, 3, "06:14", "1551", "penalty", "H", "MIS", "misconduct", 10, 8484145],
      [521, 699, 3, "06:14", "1551", "penalty", "A", "MIS", "misconduct", 10, 8477507],
      [518, 701, 3, "06:14", "1551", "penalty", "H", "MIS", "misconduct", 10, 8479420],
      [1115, 744, 3, "09:17", "1551", "penalty", "H", "MIN", "cross-checking", 2, 8481522],
      [1149, 753, 3, "09:26", "1541", "hit", "A"],
      [1145, 769, 3, "11:20", "1560", "penalty", "A", "MIN", "hooking", 2, 8485395],
      [1150, 775, 3, "11:29", "1451", "shot-on-goal", "H"],
      [1219, 800, 3, "13:54", "1551", "goal", "H"],
      [902, 817, 3, "15:08", "1560", "goal", "H"],
      [538, 894, 3, "20:00", "1551", "period-end"],
      [543, 898, 3, "20:00", "1551", "game-end"]
    ]
  };

  describe("C2: the audit skips the observations the clock refuses", () => {
    it.each([
      { game: game2026020002, checkedEvents: 5 },
      { game: game2026020058, checkedEvents: 5 },
      { game: game2026020093, checkedEvents: 5 }
    ])("$game.gameId: no disagreement, and both teams qualify on the official totals", ({ game, checkedEvents }) => {
      const gameTeams = { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, gameType: 2 };
      const plays = storedPlays(game);
      expect(hasCompletePenaltyClockSource(plays, 2)).toBe(true);
      const audit = auditPpBlocksAgainstSituationCodes(plays, getPowerPlayBlocks(plays, gameTeams), gameTeams);
      expect(audit).toEqual({ checkedEvents, disagreements: [] });
      for (const side of ["H", "A"] as const) {
        expect(clockFor(game, side)).toMatchObject({
          qualified: true,
          unqualifiedReason: null,
          audit: { checkedEvents, disagreements: 0 },
          official: { class: "nonzero", diffSeconds: 0 }
        });
      }
    });

    it("still flags a wrong code on an interior event", () => {
      // Faceoff 593 (P2 04:25) is inside the home 03:58-05:58 PP; recode it 5v5.
      const game = {
        ...game2026020093,
        rows: game2026020093.rows.map((row): Row => row[0] === 593 ? [593, 337, 2, "04:25", "1551", "faceoff", "A"] : row)
      };
      const gameTeams = { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, gameType: 2 };
      const blocks = getPowerPlayBlocks(storedPlays(game2026020093), gameTeams);
      expect(auditPpBlocksAgainstSituationCodes(storedPlays(game), blocks, gameTeams).disagreements).toEqual([
        { eventId: 593, gameSecond: 1465, situationCode: "1551", simulatedAdvantageTeamId: 12, situationAdvantageTeamId: null }
      ]);
    });
  });

  describe("C1: qualification needs the official team PP total", () => {
    it("2026020036: the home clock matches and qualifies; the away clock is +28 s off teamGameStats", () => {
      const game = game2026020036;
      expect(clockFor(game, "H")).toMatchObject({
        seconds: 372,
        qualified: true,
        unqualifiedReason: null,
        official: { class: "nonzero", seconds: 372, diffSeconds: 0 },
        referenceSource: "teamGameStats"
      });
      // Withheld on teamGameStats alone (the decision-152 tests below show
      // that verdict); its registry entry now judges it on the Penalty Summary.
      expect(clockFor(game, "A")).toMatchObject({
        seconds: 148,
        audit: { disagreements: 0 },
        official: { class: "nonzero", seconds: 120, diffSeconds: 28 },
        referenceSource: "nhlPenaltySummary"
      });
    });

    it("2025020665: a legacy \"00:00\" placeholder never qualifies, even with a clean clock", () => {
      // 2025-26 failed-fetch default: both rows read "00:00" with one opportunity each.
      const game: StoredGame = {
        gameId: 2025020665, homeTeamId: 20, awayTeamId: 55,
        official: { H: { powerPlayToi: "00:00", powerPlay: "0/1" }, A: { powerPlayToi: "00:00", powerPlay: "0/1" } },
        rows: [
          [54, 9, 1, "00:00", "1551", "period-start"],
          [148, 112, 1, "06:33", "1551", "goal", "H"],
          [15, 162, 1, "09:48", "1551", "penalty", "A", "PS", "ps-hooking-on-breakaway", 0, 8476457],
          [438, 295, 1, "19:18", "1551", "penalty", "H", "MIN", "holding", 2, 8480797],
          [23, 302, 1, "20:00", "1541", "period-end"],
          [449, 308, 2, "00:00", "1541", "period-start"],
          [448, 310, 2, "00:00", "1541", "faceoff", "A"],
          [522, 333, 2, "02:17", "1551", "goal", "A"],
          [630, 386, 2, "06:44", "1560", "penalty", "A", "MIN", "hooking", 2, 8476905],
          [636, 392, 2, "07:04", "1451", "shot-on-goal", "H"],
          [48, 575, 2, "20:00", "1551", "period-end"],
          [828, 581, 3, "00:00", "1551", "period-start"],
          [858, 613, 3, "01:57", "1551", "goal", "A"],
          [906, 653, 3, "05:12", "1551", "goal", "A"],
          [1084, 824, 3, "17:25", "1560", "goal", "A"],
          [1091, 830, 3, "17:39", "1551", "goal", "A"],
          [468, 865, 3, "20:00", "1551", "period-end"],
          [472, 869, 3, "20:00", "1551", "game-end"]
        ]
      };
      for (const side of ["H", "A"] as const) {
        expect(clockFor(game, side)).toMatchObject({
          seconds: 120,
          qualified: false,
          unqualifiedReason: 'The official team PP time is a legacy "00:00" placeholder (powerPlayToi "00:00", powerPlay "0/1").',
          audit: { disagreements: 0 },
          official: { class: "placeholder", seconds: null, diffSeconds: null }
        });
      }
    });

    // 2026020093 home: clock 487 s, official "08:07" "1/5".
    it.each([
      { name: "2 s over (tolerance)", official: { powerPlayToi: "08:05", powerPlay: "1/5" }, qualified: true,
        reason: null, officialClass: { class: "nonzero", seconds: 485, diffSeconds: 2 } },
      { name: "2 s under (tolerance)", official: { powerPlayToi: "08:09", powerPlay: "1/5" }, qualified: true,
        reason: null, officialClass: { class: "nonzero", seconds: 489, diffSeconds: -2 } },
      { name: "3 s under", official: { powerPlayToi: "08:10", powerPlay: "1/5" }, qualified: false,
        reason: "The clock differs from the official team PP total by -3 s (clock 487 s, official 490 s).",
        officialClass: { class: "nonzero", seconds: 490, diffSeconds: -3 } },
      { name: "a missing row", official: null, qualified: false,
        reason: "No official team PP total (teamGameStats) for this game.",
        officialClass: { class: "missing", seconds: null, diffSeconds: null } },
      { name: "an unparseable time", official: { powerPlayToi: "8:7", powerPlay: "1/5" }, qualified: false,
        reason: 'The official team PP record is malformed (powerPlayToi "8:7", powerPlay "1/5").',
        officialClass: { class: "malformed", seconds: null, diffSeconds: null } },
      { name: "more goals than opportunities", official: { powerPlayToi: "08:07", powerPlay: "6/5" }, qualified: false,
        reason: 'The official team PP record is malformed (powerPlayToi "08:07", powerPlay "6/5").',
        officialClass: { class: "malformed", seconds: null, diffSeconds: null } },
      { name: "PP time with no opportunity", official: { powerPlayToi: "08:07", powerPlay: "0/0" }, qualified: false,
        reason: 'The official team PP record is malformed (powerPlayToi "08:07", powerPlay "0/0").',
        officialClass: { class: "malformed", seconds: null, diffSeconds: null } },
      { name: "an official zero while the clock has PP time", official: { powerPlayToi: "00:00", powerPlay: "0/0" },
        qualified: false,
        reason: 'The official record shows no PP (powerPlayToi "00:00", powerPlay "0/0") but the clock has 487 s; it may be a failed-fetch default.',
        officialClass: { class: "zero", seconds: 0, diffSeconds: 487 } }
    ])("2026020093 home with $name", ({ official, qualified, reason, officialClass }) => {
      expect(clockFor(game2026020093, "H", official)).toMatchObject({
        seconds: 487,
        qualified,
        unqualifiedReason: reason,
        official: officialClass
      });
    });
  });

  describe("decision 152: the NHL Penalty Summary as the reference for registered team-games", () => {
    // `official` is the stored teamGameStats row, which stays as stored.
    it.each([
      { game: game2026020036, side: "A" as Side, clock: 148, official: { class: "nonzero", seconds: 120, diffSeconds: 28 } },
      { game: game2026020153, side: "H" as Side, clock: 626, official: { class: "nonzero", seconds: 746, diffSeconds: -120 } },
      { game: game2025021248, side: "H" as Side, clock: 840, official: { class: "nonzero", seconds: 746, diffSeconds: 94 } },
      { game: game2025021097, side: "H" as Side, clock: 595, official: { class: "nonzero", seconds: 564, diffSeconds: 31 } },
      { game: game2025030112, side: "A" as Side, clock: 492, official: { class: "nonzero", seconds: 612, diffSeconds: -120 } }
    ])("$game.gameId $side: qualifies on the exact Penalty Summary and keeps the stored total", ({ game, side, clock, official }) => {
      const teamId = side === "H" ? game.homeTeamId : game.awayTeamId;
      const reference = PP_PENALTY_SUMMARY_REFERENCES.find((entry) => entry.gameId === game.gameId && entry.teamId === teamId);
      expect(reference?.teamGameStats).toEqual(game.official[side]);
      expect(clockFor(game, side)).toMatchObject({
        seconds: clock,
        qualified: true,
        unqualifiedReason: null,
        audit: { disagreements: 0 },
        official,
        referenceSource: "nhlPenaltySummary",
        penaltySummary: { reference, seconds: clock, diffSeconds: 0 }
      });
      // The other team is not registered and still qualifies on its stored row.
      expect(clockFor(game, side === "H" ? "A" : "H")).toMatchObject({
        qualified: true,
        official: { class: "nonzero", diffSeconds: 0 },
        referenceSource: "teamGameStats",
        penaltySummary: null
      });
    });

    it.each([
      { time: "14:30", clock: 149, diffSeconds: 1 },
      { time: "14:28", clock: 147, diffSeconds: -1 }
    ])("2026020036 away: a clock $diffSeconds s off the Penalty Summary keeps the teamGameStats verdict", ({ time, clock, diffSeconds }) => {
      // Move the goal that ends the 28 s power play (P2 14:29).
      const game = {
        ...game2026020036,
        rows: game2026020036.rows.map((row): Row => row[0] === 801 ? [801, 481, 2, time, "1541", "goal", "A"] : row)
      };
      expect(clockFor(game, "A")).toMatchObject({
        seconds: clock,
        qualified: false,
        unqualifiedReason: `The clock differs from the official team PP total by +${clock - 120} s (clock ${clock} s, official 120 s).`,
        audit: { disagreements: 0 },
        referenceSource: "teamGameStats",
        penaltySummary: { seconds: 148, diffSeconds }
      });
    });

    it.each([
      { name: "a missing stored row", official: null, reason: "No official team PP total (teamGameStats) for this game." },
      { name: "a changed stored row", official: { powerPlayToi: "02:01", powerPlay: "1/1" },
        reason: "The clock differs from the official team PP total by +27 s (clock 148 s, official 121 s)." }
    ])("2026020036 away with $name: the entry no longer applies", ({ official, reason }) => {
      expect(clockFor(game2026020036, "A", official)).toMatchObject({
        seconds: 148,
        qualified: false,
        unqualifiedReason: reason,
        referenceSource: "teamGameStats",
        penaltySummary: { diffSeconds: 0 }
      });
    });

    it("2026020036 away: incomplete play-by-play stays withheld even though the clock equals the summary", () => {
      const game = { ...game2026020036, rows: game2026020036.rows.filter((row) => row[1] !== 840) };
      expect(clockFor(game, "A")).toMatchObject({
        seconds: 148,
        qualified: false,
        unqualifiedReason: PP_CLOCK_UNQUALIFIED_REASON,
        referenceSource: "teamGameStats",
        penaltySummary: { diffSeconds: 0 }
      });
    });

    it("is never a blanket override: the same team and plays under another game id keep the teamGameStats verdict", () => {
      expect(clockFor({ ...game2026020036, gameId: 2026020037 }, "A")).toMatchObject({
        seconds: 148,
        qualified: false,
        unqualifiedReason: "The clock differs from the official team PP total by +28 s (clock 148 s, official 120 s).",
        referenceSource: "teamGameStats",
        penaltySummary: null
      });
    });

    it("a verified zero stays on teamGameStats (shown as not applicable), even under a registered team-game id", () => {
      const game: StoredGame = {
        gameId: 2026020036, homeTeamId: 3, awayTeamId: 68,
        official: { H: { powerPlayToi: "00:00", powerPlay: "0/0" }, A: { powerPlayToi: "00:00", powerPlay: "0/0" } },
        rows: [
          [1, 1, 1, "00:00", "1551", "period-start"],
          [2, 2, 1, "05:00", "1551", "shot-on-goal", "A"],
          [3, 3, 1, "20:00", "1551", "period-end"],
          [4, 4, 2, "00:00", "1551", "period-start"],
          [5, 5, 2, "20:00", "1551", "period-end"],
          [6, 6, 3, "00:00", "1551", "period-start"],
          [7, 7, 3, "20:00", "1551", "game-end"]
        ]
      };
      expect(clockFor(game, "A")).toMatchObject({
        seconds: 0,
        qualified: true,
        unqualifiedReason: null,
        official: { class: "zero", seconds: 0, diffSeconds: 0 },
        referenceSource: "teamGameStats",
        penaltySummary: { seconds: 148, diffSeconds: -148 }
      });
    });

    it("each registry entry is one team-game with its source page and fetch evidence", () => {
      const keys = PP_PENALTY_SUMMARY_REFERENCES.map((entry) => `${entry.gameId}/${entry.teamId}`);
      expect(keys).toEqual(["2026020036/68", "2026020153/9", "2025021248/8", "2025021097/20", "2025030112/6"]);
      for (const entry of PP_PENALTY_SUMMARY_REFERENCES) {
        const season = Math.floor(entry.gameId / 1_000_000);
        expect(entry.sourceUrl).toBe(buildNhlGameSummaryReportUrl(`${season}${season + 1}`, String(entry.gameId).slice(-6)));
        expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(entry.fetchedAt).toMatch(/^2026-11-13T\d\d:\d\d:\d\dZ$/);
        expect(entry.decision).toBe(152);
        expect(penaltySummarySeconds(entry.penaltySummary)).toBeGreaterThan(0);
      }
    });
  });
});
