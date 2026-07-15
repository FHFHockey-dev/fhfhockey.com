import { describe, expect, it } from "vitest";

import type {
  TweetNewsAutomationPlayer,
  TweetNewsAutomationReviewRow,
} from "./tweetNewsAutomation";
import {
  buildTweetNewsInferenceCandidate,
  buildTweetNewsInferenceDedupeKey,
  buildTweetNewsInferencePlayerCandidates,
  buildTweetNewsInferenceSources,
  normalizeTweetNewsInferenceResult,
  validateTweetNewsInference,
  type TweetNewsInferenceResult,
  type TweetNewsInferenceTeam,
} from "./tweetNewsInference";

const teams: TweetNewsInferenceTeam[] = [
  { id: 1, abbreviation: "NJD", name: "New Jersey Devils" },
  { id: 16, abbreviation: "CHI", name: "Chicago Blackhawks" },
  { id: 29, abbreviation: "CBJ", name: "Columbus Blue Jackets" },
];

const players: TweetNewsAutomationPlayer[] = [
  { id: 8480002, fullName: "Nico Hischier", position: "C", team_id: 1 },
  { id: 8484144, fullName: "Connor Bedard", position: "C", team_id: 16 },
];

function buildRow(
  overrides: Partial<TweetNewsAutomationReviewRow> = {},
): TweetNewsAutomationReviewRow {
  return {
    id: "1218d175-2549-428d-9561-c86bd99d266e",
    source_account: "GameDayNewsNHL",
    source_label: "tweet",
    source_handle: "KevinWeekes",
    author_name: "Kevin Weekes",
    source_created_at: "2026-07-01T12:00:00.000Z",
    tweet_id: "2072313317964517690",
    tweet_url: "https://x.com/KevinWeekes/status/2072313317964517690",
    source_url: "https://x.com/KevinWeekes/status/2072313317964517690",
    team_id: 1,
    team_abbreviation: "NJD",
    parser_classification: "other",
    parser_filter_status: "accepted",
    parser_filter_reason: null,
    review_text:
      "Sources say language and details are being worked on, C Hischier and the Devils are closing in on a 5 Yr Contract Extension.",
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

function buildNewsUpdateResult(
  overrides: Partial<TweetNewsInferenceResult> = {},
): TweetNewsInferenceResult {
  return {
    decision: "publish",
    category: "NEWS UPDATE",
    subcategory: "CONTRACT NEGOTIATION",
    verificationState: "reported",
    teamAbbreviation: "NJD",
    subjects: [{ playerId: 8480002, playerName: "Nico Hischier" }],
    summary:
      "Nico Hischier and the Devils are closing in on a five-year contract extension.",
    confidence: 0.94,
    evidence: [
      {
        sourceId: "wrapper",
        excerpt: "closing in on a 5 Yr Contract Extension",
      },
    ],
    rationaleCode: "reported_unconfirmed",
    ...overrides,
  };
}

describe("tweet news inference", () => {
  it("publishes schema-valid contract progress with grounded evidence", () => {
    const row = buildRow();
    const sources = buildTweetNewsInferenceSources(row);
    const playerCandidates = buildTweetNewsInferencePlayerCandidates({
      row,
      players,
      sources,
    });
    const result = buildNewsUpdateResult();

    expect(
      validateTweetNewsInference({
        result,
        row,
        sources,
        playerCandidates,
        teams,
      }),
    ).toEqual({ publish: true, errors: [] });

    expect(
      buildTweetNewsInferenceCandidate({
        result,
        row,
        sources,
        playerCandidates,
        teams,
        model: "openai/gpt-5.4-mini",
        nowIso: "2026-07-14T18:00:00.000Z",
      }),
    ).toMatchObject({
      cardStatus: "published",
      category: "NEWS UPDATE",
      subcategory: "CONTRACT NEGOTIATION",
      headline: "Nico Hischier news update",
      playerAssignments: [
        { playerId: 8480002, playerName: "Nico Hischier", teamId: 1 },
      ],
      metadata: {
        automation: {
          source: "tweet_news_model_inference",
          autoPublish: true,
          summary:
            "Nico Hischier and the Devils are closing in on a five-year contract extension.",
        },
      },
    });
  });

  it("fails closed when the model cites evidence not present in the source", () => {
    const row = buildRow();
    const sources = buildTweetNewsInferenceSources(row);
    const playerCandidates = buildTweetNewsInferencePlayerCandidates({
      row,
      players,
      sources,
    });
    const validation = validateTweetNewsInference({
      result: buildNewsUpdateResult({
        evidence: [
          { sourceId: "wrapper", excerpt: "the contract is now official" },
        ],
      }),
      row,
      sources,
      playerCandidates,
      teams,
    });

    expect(validation.publish).toBe(false);
    expect(validation.errors).toContain("unsupported_evidence_excerpt");
  });

  it("does not upgrade negotiation language to an official signing", () => {
    const row = buildRow();
    const sources = buildTweetNewsInferenceSources(row);
    const playerCandidates = buildTweetNewsInferencePlayerCandidates({
      row,
      players,
      sources,
    });
    const validation = validateTweetNewsInference({
      result: buildNewsUpdateResult({
        category: "SIGNING",
        subcategory: "OFFICIAL SIGNING",
        verificationState: "official",
        confidence: 0.99,
      }),
      row,
      sources,
      playerCandidates,
      teams,
    });

    expect(validation.publish).toBe(false);
    expect(validation.errors).toContain("signing_missing_completed_language");
  });

  it("discards generated summaries for line-combination candidates", () => {
    const row = buildRow();
    const sources = buildTweetNewsInferenceSources(row);
    const playerCandidates = buildTweetNewsInferencePlayerCandidates({
      row,
      players,
      sources,
    });
    const candidate = buildTweetNewsInferenceCandidate({
      result: buildNewsUpdateResult({
        category: "LINE COMBINATION",
        subcategory: "PROJECTED LINES",
        subjects: [],
        summary: "An AI-authored lineup summary that must not be persisted.",
      }),
      row,
      sources,
      playerCandidates,
      teams,
      model: "openai/gpt-5.4-mini",
      nowIso: "2026-07-14T18:00:00.000Z",
    });

    expect(candidate.metadata).toMatchObject({
      automation: { summary: null },
    });
    expect(candidate.blurb).toContain("closing in on a 5 Yr Contract Extension");
    expect(
      normalizeTweetNewsInferenceResult(
        buildNewsUpdateResult({
          category: "LINE COMBINATION",
          subcategory: "PROJECTED LINES",
          subjects: [],
          summary: "This must not survive inference-state persistence.",
        }),
      ).summary,
    ).toBeNull();
  });

  it("includes retained nested-source identity in stable inference deduplication", () => {
    const row = buildRow({
      team_id: null,
      team_abbreviation: null,
      source_handle: "CcCMiddleton",
      review_text: "Puts a return around late October-ish… https://t.co/4qdCIOMuSt",
      raw_text: "Puts a return around late October-ish… https://t.co/4qdCIOMuSt",
      metadata: {
        quotedTweetUrl:
          "https://twitter.com/i/web/status/2074932007746842910",
        quotedAuthorHandle: "NHLBlackhawks",
        quotedRetrievalStatus: "resolved_url_only",
      },
    });
    const sources = buildTweetNewsInferenceSources(row);

    expect(sources).toEqual([
      expect.objectContaining({
        id: "wrapper",
        authorHandle: "CcCMiddleton",
      }),
      expect.objectContaining({
        id: "quoted",
        text: "",
        authorHandle: "NHLBlackhawks",
        url: "https://twitter.com/i/web/status/2074932007746842910",
      }),
    ]);
    expect(
      buildTweetNewsInferenceDedupeKey({
        row,
        sources,
        model: "openai/gpt-5.4-mini",
      }),
    ).toMatch(/^tweet-news:[a-f0-9]{64}$/);
  });
});
