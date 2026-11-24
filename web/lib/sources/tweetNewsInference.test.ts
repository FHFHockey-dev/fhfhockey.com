// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock("ai", () => ({ generateText, Output: { object: vi.fn() } }));

import type {
  TweetNewsAutomationPlayer,
  TweetNewsAutomationReviewRow,
} from "./tweetNewsAutomation";
import {
  buildTweetNewsInferenceCandidate,
  buildTweetNewsInferenceDedupeKey,
  buildTweetNewsInferencePlayerCandidates,
  buildTweetNewsInferenceSources,
  inferTweetNewsCandidate,
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
        excerpt: "C Hischier and the Devils are closing in on a 5 Yr Contract Extension",
      },
    ],
    rationaleCode: "reported_unconfirmed",
    ...overrides,
  };
}

describe("tweet news inference", () => {
  it("keeps each timeframe on its own player even when a proposal copies both Colorado sentences", () => {
    const text = "Avs coach Jared Bednar confirms that Nathan MacKinnon is out at least a month. Cale Makar will be out approximately two weeks.";
    const roster = [{ id: 8477492, fullName: "Nathan MacKinnon", lastName: "MacKinnon", team_id: 21, position: "C" },
      { id: 8480069, fullName: "Cale Makar", lastName: "Makar", team_id: 21, position: "D" }];
    const url = "https://x.com/cmasisak22/status/2121654880410468660";
    const row = buildRow({ team_id: 21, team_abbreviation: "COL", quoted_text: text, quoted_tweet_url: url, metadata: {
      primaryTextSource: "quoted_oembed", quotedTweetUrl: url, quotedAuthorHandle: "cmasisak22",
      intakeRosterEvidence: { source: "quoted", text, publishedAt: "2026-11-14T17:21:56Z", players: roster, reviewSpans: [] } } });
    const build = (timeframe: string) => buildTweetNewsInferenceCandidate({ model: "fixture", row, sources: buildTweetNewsInferenceSources(row),
      playerCandidates: roster, teams: [{ id: 21, abbreviation: "COL", name: "Colorado Avalanche" }],
      result: buildNewsUpdateResult({ category: "INJURY", subcategory: "OUT", teamAbbreviation: "COL", subjects: [{ playerId: 8480069, playerName: "Cale Makar" }],
        evidence: [{ sourceId: "quoted", excerpt: text }], playerEvents: [{ sourceId: "quoted", playerId: 8480069, excerpt: text, state: "unknown", timeframe }] }) });
    expect(build("at least a month")).toMatchObject({ cardStatus: "draft", metadata: { automation: {
      validationErrors: expect.arrayContaining(["unsupported_timeframe"]), playerEvents: [{ timeline: null }] } } });
    expect(build("two weeks").cardStatus).toBe("draft");
    expect(build("approximately two weeks")).toMatchObject({ cardStatus: "published", metadata: { automation: {
      validationErrors: [], playerEvents: [{ playerId: 8480069, timeline: { purpose: "absence", approximate: true,
        estimate: 2, minimum: null, maximum: null, unit: "weeks", targetDate: null } }] } } });
  });
  it.each(["Nico Hischier remains out. Connor Bedard will play tonight.", "Nico Hischier will return tonight if healthy."])("rejects unsupported confirmed returns in copied evidence: %s", (text) => {
    const row = buildRow({ review_text: text });
    const validation = validateTweetNewsInference({ row, sources: buildTweetNewsInferenceSources(row), playerCandidates: players, teams,
      result: buildNewsUpdateResult({ playerEvents: [{ playerId: 8480002, sourceId: "wrapper", excerpt: text, state: "confirmed_return", timeframe: null }] }) });
    expect(validation.publish).toBe(false);
    expect(validation.errors).toContain("event_requires_review");
  });
  it("uses the quote's dated alias and team for model validation, assignments and deduplication", async () => {
    const text = "NH and the Devils are closing in on a contract extension.";
    const admitted = { ...players[0]!, lastName: "Hischier", aliases: ["NH"] };
    const row = buildRow({ enriched_text: "An unrelated wrapper.", quoted_text: text,
      metadata: { quotedAuthorHandle: "Devils", intakeRosterEvidence: { source: "quoted", text,
        publishedAt: "2026-06-30T23:12:00Z", players: [admitted], reviewSpans: [] } } });
    const current = [{ ...admitted, team_id: 16, aliases: [] }, { ...players[1]!, aliases: ["NH"] }];
    const sources = buildTweetNewsInferenceSources(row);
    expect(sources).toEqual([expect.objectContaining({ id: "quoted", text, authorHandle: "Devils" })]);
    expect(buildTweetNewsInferencePlayerCandidates({ row, players: current, sources })).toEqual([admitted]);
    const args = { row, sources, teams, model: "fixture", playerCandidates: current,
      result: buildNewsUpdateResult({ evidence: [{ sourceId: "quoted", excerpt: text }] }) };
    const candidate = buildTweetNewsInferenceCandidate(args);
    expect(candidate).toMatchObject({ cardStatus: "published", blurb: text, playerAssignments: [
      { playerId: admitted.id, playerName: admitted.fullName, teamId: 1 }] });
    expect(candidate.metadata).not.toHaveProperty("intakeRosterEvidence");
    expect(buildTweetNewsInferenceDedupeKey({ ...args, players: current }))
      .toBe(buildTweetNewsInferenceDedupeKey({ ...args, players: [] }));
    generateText.mockResolvedValueOnce({ output: args.result });
    const inferred = await inferTweetNewsCandidate({ row, players: current, teams, model: "fixture" });
    expect(JSON.parse(generateText.mock.calls[0]![0].prompt)).toMatchObject({ sources, playerCandidates: [admitted] });
    expect(inferred.candidate.playerAssignments).toEqual(candidate.playerAssignments);
    const staleRow = { ...row, quoted_text: "NH signed today." };
    expect(buildTweetNewsInferencePlayerCandidates({ row: staleRow, sources, players: current })).toEqual([]);
    expect(validateTweetNewsInference({ ...args, row: staleRow }).publish).toBe(false);
  });

  it("blocks a reviewed occurrence as evidence even when that player appears elsewhere", () => {
    const text = "Nico Hischier spoke. NH will not play tonight.";
    const start = text.indexOf("NH");
    const row = buildRow({ enriched_text: text, metadata: { intakeRosterEvidence: { source: "wrapper", text,
      publishedAt: "2026-06-30T23:12:00Z", players: [{ ...players[0]!, lastName: "Hischier", aliases: ["NH"] }],
      reviewSpans: [{ start, end: start + 2 }] } } });
    const args = { row, sources: buildTweetNewsInferenceSources(row), teams, playerCandidates: players };
    const result = buildNewsUpdateResult({ category: "INJURY", subcategory: "OUT",
      evidence: [{ sourceId: "wrapper", excerpt: "NH will not play tonight." }] });
    expect(validateTweetNewsInference({ ...args, result })).toEqual({ publish: false, errors: expect.arrayContaining([
      "unsupported_evidence_excerpt", "unsupported_confirmed_claim"]) });
    const unrelated = buildNewsUpdateResult({ evidence: [{ sourceId: "wrapper", excerpt: "Nico Hischier spoke." }] });
    expect(validateTweetNewsInference({ ...args, result: unrelated }).errors).toContain("claim_missing_admitted_evidence");
    expect(validateTweetNewsInference({ ...args, result: { ...result, subjects: [{ playerId: null, playerName: "NH" }] } }).publish).toBe(false);
  });

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
