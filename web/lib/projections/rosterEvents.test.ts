import { describe, expect, it } from "vitest";

import {
  buildRosterEventsFromReviewedTweet,
  evaluateRosterEventPreflight
} from "./rosterEvents";

describe("forge roster events", () => {
  it("maps reviewed goalie and injury tweet assignments into canonical events", () => {
    const events = buildRosterEventsFromReviewedTweet(
      {
        id: "review-1",
        team_id: 10,
        team_abbreviation: "BOS",
        source_account: "gamedaygoalies",
        review_status: "reviewed",
        reviewed_at: "2026-03-01T15:00:00.000Z",
        review_text: "Goalie A starts. Winger B is out.",
        review_assignments: [
          {
            id: "g",
            category: "GOALIE START",
            subcategory: "CONFIRMED STARTER",
            playerIds: [100],
            playerNames: ["Goalie A"],
            highlightPhrases: ["starts"],
            notes: null
          },
          {
            id: "i",
            category: "INJURY",
            subcategory: "OUT",
            playerIds: [200],
            playerNames: ["Winger B"],
            highlightPhrases: ["out"],
            notes: null
          }
        ]
      } as any,
      { defaultTtlHours: 12 }
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      team_id: 10,
      player_id: 100,
      event_type: "GOALIE_START_CONFIRMED",
      confidence: 0.95
    });
    expect(events[1]).toMatchObject({
      player_id: 200,
      event_type: "INJURY_OUT"
    });
    expect(events[0].payload).toMatchObject({
      source: "tweet_pattern_review",
      reviewItemId: "review-1"
    });
  });

  it("returns preflight gates for stale or missing current-state inputs", () => {
    const gates = evaluateRosterEventPreflight({
      asOfDate: "2026-03-01",
      events: [],
      hasCurrentLineCombinations: false,
      hasGoaliePriors: false,
      lineCombinationAgeDays: 4,
      rosterAssignmentAgeDays: 5,
      acceptedGoalieSourceAgeHours: 24
    });

    expect(gates.map((gate) => gate.code)).toEqual(
      expect.arrayContaining([
        "missing_current_line_combinations",
        "missing_goalie_priors",
        "stale_line_combinations_hard",
        "stale_roster_assignments",
        "stale_accepted_goalie_source"
      ])
    );
    expect(gates.some((gate) => gate.severity === "block")).toBe(true);
  });
});
