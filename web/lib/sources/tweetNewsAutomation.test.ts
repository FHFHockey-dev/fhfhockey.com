import { describe, expect, it } from "vitest";

import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "./tweetNewsAutomation";

const players: TweetNewsAutomationPlayer[] = [
  { id: 1, fullName: "Andrei Vasilevskiy", position: "G", team_id: 14 },
  { id: 2, fullName: "Victor Hedman", position: "D", team_id: 14 },
  { id: 3, fullName: "Brayden Point", position: "C", team_id: 14 },
  { id: 4, fullName: "Nikita Kucherov", position: "R", team_id: 14 },
  { id: 5, fullName: "Jake Guentzel", position: "L", team_id: 14 },
  { id: 6, fullName: "Cole Caufield", position: "R", team_id: 8 },
  { id: 7, fullName: "Nick Suzuki", position: "C", team_id: 8 },
  { id: 8, fullName: "Juraj Slafkovsky", position: "L", team_id: 8 },
];

function buildRow(
  overrides: Partial<TweetNewsAutomationReviewRow> = {},
): TweetNewsAutomationReviewRow {
  return {
    id: "review-1",
    source_account: "GameDayNewsNHL",
    source_label: "tweet",
    source_handle: "BeatWriter",
    author_name: "Beat Writer",
    source_created_at: "2026-05-27T12:00:00.000Z",
    tweet_id: "100",
    tweet_url: "https://twitter.com/BeatWriter/status/100",
    source_url: "https://twitter.com/BeatWriter/status/100",
    team_id: 14,
    team_abbreviation: "TBL",
    parser_classification: "injury",
    parser_filter_status: "accepted",
    parser_filter_reason: null,
    review_text: "Victor Hedman will not play tonight.",
    raw_text: null,
    enriched_text: null,
    quoted_text: null,
    review_status: "pending",
    reviewed_category: null,
    reviewed_subcategory: null,
    selected_highlights: null,
    review_assignments: null,
    notes: null,
    metadata: null,
    ...overrides,
  };
}

describe("tweet news automation", () => {
  it("publishes high-confidence injury cards with player evidence", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow(),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      category: "INJURY",
      subcategory: "OUT",
      headline: "Victor Hedman injury update",
      playerAssignments: [{ playerId: 2, playerName: "Victor Hedman" }],
    });
  });

  it("keeps review-gated expected goalie starts as drafts", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "goalie_start",
        review_text: "Andrei Vasilevskiy leads the team out for warmups.",
      }),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "draft",
      category: "GOALIE START",
      subcategory: "EXPECTED STARTER",
      playerAssignments: [{ playerId: 1, playerName: "Andrei Vasilevskiy" }],
    });
  });

  it("publishes structured line-combination cards with team evidence", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 8,
        team_abbreviation: "MTL",
        parser_classification: "lineup",
        review_text:
          "Canadiens line rushes\nCole Caufield-Nick Suzuki-Juraj Slafkovsky",
      }),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      category: "LINE COMBINATION",
      headline: "MTL line combination update",
    });
    expect(candidate?.metadata.lineupCard).toMatchObject({
      forwards: [["Cole Caufield", "Nick Suzuki", "Juraj Slafkovsky"]],
    });
  });

  it("does not create cards for excluded non-NHL tweets", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        review_text:
          "AHL Wolves lines\nAHL Wolves Starting Goalie: Cayden Primeau",
      }),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toBeNull();
  });

  it("flags dictionary misses as ambiguous draft candidates", () => {
    const candidate = buildTweetNewsAmbiguousCandidate({
      row: buildRow({
        review_text: "Victor Hedman participated in optional work.",
      }),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "draft",
      category: "OTHER",
      subcategory: "AMBIGUOUS",
      playerAssignments: [{ playerId: 2, playerName: "Victor Hedman" }],
    });
    expect(candidate?.metadata.automation).toMatchObject({
      ambiguityReason: "no_dictionary_match",
      dictionaryGap: true,
      autoPublish: false,
    });
  });

  it("flags phrase hits with missing evidence for dictionary analysis", () => {
    const candidate = buildTweetNewsAmbiguousCandidate({
      row: buildRow({
        team_id: null,
        team_abbreviation: null,
        review_text: "Starting goalie: Mystery Netminder",
      }),
      players,
      nowIso: "2026-05-27T13:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "draft",
      category: "OTHER",
      subcategory: "AMBIGUOUS",
    });
    expect(candidate?.metadata.automation).toMatchObject({
      ambiguityReason: "missing_required_evidence",
      missingRequiredEvidence: ["team", "goalie"],
    });
  });
});
