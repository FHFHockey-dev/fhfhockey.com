import { describe, expect, it } from "vitest";

import { parseNhlPlayByPlayEvents } from "../supabase/Upserts/nhlPlayByPlayParser";
import { buildRichReboundLabels } from "./reboundRichLabels";

function parse(plays: Record<string, unknown>[]) {
  return parseNhlPlayByPlayEvents(
    {
      id: 2025020999,
      season: 20252026,
      gameDate: "2026-04-01",
      homeTeam: { id: 10, abbrev: "TOR" },
      awayTeam: { id: 20, abbrev: "NYR" },
      plays,
    },
    { sourcePlayByPlayHash: "rich-rebound", now: "2026-04-01T12:00:00.000Z" }
  );
}

function play(args: {
  eventId: number;
  second: number;
  typeDescKey: string;
  teamId?: number;
  x?: number;
  y?: number;
}) {
  const minutes = Math.floor(args.second / 60);
  const seconds = String(args.second % 60).padStart(2, "0");
  return {
    eventId: args.eventId,
    sortOrder: args.eventId,
    periodDescriptor: { number: 1, periodType: "REG" },
    timeInPeriod: `${String(minutes).padStart(2, "0")}:${seconds}`,
    timeRemaining: "10:00",
    situationCode: "1551",
    homeTeamDefendingSide: "left",
    typeCode:
      args.typeDescKey === "goal"
        ? 505
        : args.typeDescKey === "shot-on-goal"
          ? 506
          : args.typeDescKey === "missed-shot"
            ? 507
            : args.typeDescKey === "stoppage"
              ? 521
              : 503,
    typeDescKey: args.typeDescKey,
    details: {
      eventOwnerTeamId: args.teamId,
      shootingPlayerId: 91,
      scoringPlayerId: args.typeDescKey === "goal" ? 91 : undefined,
      goalieInNetId: 30,
      xCoord: args.x,
      yCoord: args.y,
    },
  };
}

describe("rich rebound labels", () => {
  it("finds the bounded next attempt through an intervening same-possession event", () => {
    const labels = buildRichReboundLabels(
      parse([
        play({ eventId: 1, second: 600, typeDescKey: "shot-on-goal", teamId: 10, x: 70, y: 5 }),
        play({ eventId: 2, second: 601, typeDescKey: "hit", teamId: 10 }),
        play({ eventId: 3, second: 602, typeDescKey: "goal", teamId: 10, x: 82, y: 2 }),
      ])
    );

    expect(labels[0]).toMatchObject({
      sourceEventId: 1,
      termination: "next_attempt",
      nextAttemptEventId: 3,
      nextAttemptDeltaSeconds: 2,
      samePossessionVerified: true,
      reboundCreated: 1,
      conditionalHighDanger: 1,
      goalieFreezeCoveredPuck: 0,
      conditionalNextAttemptGoal: 1,
      labelVersion: "rebound_rich_labels_v1",
    });
  });

  it("terminates at opponent control instead of searching into a later possession", () => {
    const labels = buildRichReboundLabels(
      parse([
        play({ eventId: 10, second: 600, typeDescKey: "missed-shot", teamId: 10, x: 70, y: 5 }),
        play({ eventId: 11, second: 601, typeDescKey: "takeaway", teamId: 20 }),
        play({ eventId: 12, second: 602, typeDescKey: "shot-on-goal", teamId: 10, x: 82, y: 2 }),
      ])
    );

    expect(labels[0]).toMatchObject({
      termination: "opponent_control",
      reboundCreated: 0,
      conditionalHighDanger: null,
      conditionalNextAttemptGoal: null,
    });
  });

  it("treats a bounded shot-on-goal stoppage as freeze/covered-puck termination", () => {
    const labels = buildRichReboundLabels(
      parse([
        play({ eventId: 20, second: 600, typeDescKey: "shot-on-goal", teamId: 10, x: 70, y: 5 }),
        play({ eventId: 21, second: 601, typeDescKey: "stoppage" }),
      ])
    );

    expect(labels[0]).toMatchObject({
      termination: "goalie_freeze_covered_puck",
      reboundCreated: 0,
      goalieFreezeCoveredPuck: 1,
    });
  });
});
