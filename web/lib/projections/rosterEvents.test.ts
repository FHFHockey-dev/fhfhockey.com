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

  it("publishes a scratch as a game-scoped SCRATCH and an injury with no timer (decision 31)", () => {
    const row = {
      id: "review-2", team_id: 10, team_abbreviation: "BOS", review_status: "reviewed",
      reviewed_at: "2026-11-09T23:00:00.000Z", review_text: "Scratches: Winger C. Center D is out.",
      review_assignments: [
        { id: "s", category: "SCRATCHES", subcategory: null, playerIds: [300], playerNames: ["Winger C"], highlightPhrases: [], notes: null },
        { id: "i", category: "INJURY", subcategory: "OUT", playerIds: [400], playerNames: ["Center D"], highlightPhrases: [], notes: null },
        { id: "d", category: "INJURY", subcategory: "DAY TO DAY", playerIds: [500], playerNames: ["Defender E"], highlightPhrases: [], notes: null },
      ],
    } as any;
    const scoped = buildRosterEventsFromReviewedTweet(row, { scratchGameId: 2026020200 });
    expect(scoped[0]).toMatchObject({ player_id: 300, event_type: "SCRATCH", effective_to: null,
      payload: { game_id: 2026020200, game_scope: "game_id" } });
    expect(scoped[1]).toMatchObject({ player_id: 400, event_type: "INJURY_OUT", effective_to: null });
    // Day-to-day stays a short-lived status.
    expect(scoped[2].effective_to).toBe("2026-11-11T05:00:00.000Z");
    const unresolved = buildRosterEventsFromReviewedTweet(row);
    expect(unresolved[0]).toMatchObject({ event_type: "SCRATCH", payload: { game_id: null, game_scope: "unresolved" } });
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
