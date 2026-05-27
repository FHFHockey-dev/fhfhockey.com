import { describe, expect, it } from "vitest";

import {
  buildTweetPatternReviewExportSummary,
  buildTweetPatternReviewText
} from "./tweetPatternReview";

describe("tweetPatternReview", () => {
  it("uses quoted tweet text directly when the quoted oEmbed is primary", () => {
    const text = buildTweetPatternReviewText({
      enrichedText: "Canadiens lines https://t.co/dp8aQg57lf",
      quotedEnrichedText:
        "Canadiens Game 7 warmup lines and pairings:\nCaufield-Suzuki-Slafkovsky",
      primaryTextSource: "quoted_oembed"
    });

    expect(text).toBe(
      "Canadiens Game 7 warmup lines and pairings:\nCaufield-Suzuki-Slafkovsky"
    );
  });

  it("summarizes reviewed assignments into phrase and ambiguity exports", () => {
    const summary = buildTweetPatternReviewExportSummary([
      {
        id: "review-1",
        source_key: "gamedaylines",
        author_name: "Gabby Shirley",
        team_abbreviation: "TBL",
        parser_classification: "practice_lines",
        parser_filter_status: "accepted",
        parser_filter_reason: null,
        review_text: "Vasilevskiy in the starter net at warmups.",
        review_status: "reviewed",
        source_url: "https://x.com/Gabby_Shirley_/status/2051055219883331670",
        review_assignments: [
          {
            id: "assignment-1",
            category: "GOALIE START",
            subcategory: "EXPECTED STARTER",
            playerIds: [29],
            playerNames: ["Andrei Vasilevskiy"],
            highlightPhrases: ["starter net", "warmups"],
            notes: null
          }
        ]
      },
      {
        id: "review-2",
        source_key: "cccmiddleton",
        team_abbreviation: null,
        parser_classification: null,
        parser_filter_status: "rejected_ambiguous",
        parser_filter_reason: "insufficient_team_signal",
        review_text: "AHL lines from warmups.",
        review_status: "reviewed",
        review_assignments: [
          {
            id: "assignment-1",
            category: "OTHER",
            subcategory: "AMBIGUOUS",
            playerIds: [],
            playerNames: [],
            highlightPhrases: ["AHL lines"],
            notes: "Reject from NHL feed."
          }
        ]
      },
      {
        id: "ignored-1",
        review_status: "ignored"
      }
    ]);

    expect(summary.totalRows).toBe(3);
    expect(summary.reviewedRows).toBe(2);
    expect(summary.ignoredRows).toBe(1);
    expect(summary.assignmentCount).toBe(2);
    expect(summary.categoryCounts).toEqual([
      { category: "GOALIE START", count: 1 },
      { category: "OTHER", count: 1 }
    ]);
    expect(summary.phraseSuggestions).toContainEqual(
      expect.objectContaining({
        phrase: "AHL lines",
        category: "OTHER",
        subcategory: "AMBIGUOUS",
        count: 1
      })
    );
    expect(summary.phraseSuggestions).toContainEqual(
      expect.objectContaining({
        phrase: "starter net",
        category: "GOALIE START",
        playerNames: ["Andrei Vasilevskiy"],
        sourceAccounts: ["Gabby Shirley"],
        tweetIds: ["2051055219883331670"]
      })
    );
    expect(summary.ambiguousBuckets).toEqual([
      {
        parserFilterStatus: "rejected_ambiguous",
        parserFilterReason: "insufficient_team_signal",
        reviewedCategory: "OTHER",
        reviewedSubcategory: "AMBIGUOUS",
        count: 1,
        exampleReviewItemIds: ["review-2"]
      }
    ]);
  });
});
