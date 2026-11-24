import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "./tweetNewsAutomation";
import {
  normalizeNewsTeamId,
  resolveAutomatedNewsCardStatus,
  sanitizePublicNewsFeedItem,
} from "../newsFeed";
import { buildNewsLineupSnapshot, readNewsLineupPresentation, validatedNewsLineupRows } from "../newsLineupPresentation";
import { interpretTweetUnits } from "./tweetInterpretation";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { selectClubRosterMoves } from "./reportedClubRosterMoves";
import { pendingNewsAssignments } from "./tweetNewsRosterEvidence";

const players: TweetNewsAutomationPlayer[] = [
  { id: 1, fullName: "Andrei Vasilevskiy", position: "G", team_id: 14 },
  { id: 2, fullName: "Victor Hedman", position: "D", team_id: 14 },
  { id: 3, fullName: "Brayden Point", position: "C", team_id: 14 },
  { id: 4, fullName: "Nikita Kucherov", position: "R", team_id: 14 },
  { id: 5, fullName: "Jake Guentzel", position: "L", team_id: 14 },
  { id: 6, fullName: "Cole Caufield", position: "R", team_id: 8 },
  { id: 7, fullName: "Nick Suzuki", position: "C", team_id: 8 },
  { id: 8, fullName: "Juraj Slafkovsky", position: "L", team_id: 8 },
  { id: 9, fullName: "Connor Bedard", position: "C", team_id: 16 },
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
  afterEach(() => vi.unstubAllEnvs());
  it("separates Winnipeg's retroactive IR placement from the player recalled from Manitoba", () => {
    const id = "2122708840634581339", url = "https://x.com/WpgJetsPR/status/" + id;
    const text = "RT @WpgJetsPR: TRANSACTIONS: The #NHLJets have recalled forward Danny Zhilkin from the Manitoba Moose (AHL). The Jets also placed forward Isak Rosén on injured reserve retroactive to Nov. 12.";
    const roster = { text, source: "wrapper" as const, publishedAt: "2026-11-17T15:10:00Z", reviewSpans: [], players: [
      { id: 8482765, team_id: 52, fullName: "Isak Rosen", lastName: "Rosen", position: "F" },
      { id: 8483526, team_id: 52, fullName: "Danil Zhilkin", lastName: "Zhilkin", position: "F" }] };
    const row = buildRow({ tweet_id: id, source_url: url, tweet_url: url, team_id: 52, team_abbreviation: "WPG",
      source_handle: "WpgJetsPR", review_text: text, raw_text: text, metadata: { intakeRosterEvidence: roster } });
    expect(buildTweetNewsAutomationCandidate({ row, players: [] })).toMatchObject({ category: "INJURY", cardStatus: "published",
      playerAssignments: [{ playerId: 8482765 }], reviewAssignments: [{ ruleId: "club-ir-placement", playerIds: [8482765] }] });
    const [move] = selectClubRosterMoves(roster, 52, url, id);
    expect(move).toMatchObject({ move: "placed_on_ir", retroactive: "Nov. 12", subject: { text: "Isak Rosén" } });
    expect(text.slice(move!.subject.start, move!.subject.end)).toBe("Isak Rosén");
    expect(selectClubRosterMoves({ ...roster, players: [...roster.players, { ...roster.players[0]!, id: 999 }] }, 52, url, id)).toEqual([]);
    expect(selectClubRosterMoves({ ...roster, text: text.replace("The Jets also", "The Ducks also") }, 52, url, id)).toEqual([]);
    expect(selectClubRosterMoves({ ...roster, reviewSpans: [move!.subject] }, 52, url, id)).toEqual([]);
    expect(selectClubRosterMoves({ ...roster, publishedAt: "2026-11-17T15:11:00Z" }, 52, url, id)).toEqual([]);
    expect(selectClubRosterMoves(roster, 52, url.replace("WpgJetsPR", "Other"), id)).toEqual([]);
    expect(buildTweetNewsAutomationCandidate({ row: { ...row, review_status: "ignored" }, players: [] })).toBeNull();
  });

  it("withholds automated roster labels after an edit to an attached suggestion with the same ID", () => {
    const assignment = { id: "auto-club-ir-placement", ruleId: "club-ir-placement", playerIds: [8482765], notes: "Original" };
    const metadata = { automation: { rosterReportAssignments: [assignment] } };
    const check = (current: unknown[], status = "pending") => pendingNewsAssignments(metadata, { review_status: status, review_assignments: current });
    expect(check([{ notes: "Original", ruleId: assignment.ruleId, playerIds: [8482765], id: assignment.id }])).toBe(true);
    expect(check([{ ...assignment, playerIds: [8483526] }])).toBe(false);
    expect(check([{ ...assignment, notes: "Reviewer correction" }])).toBe(false);
    expect(check([assignment], "reviewed")).toBe(false);
    expect(pendingNewsAssignments(null, { review_status: "pending", review_assignments: [assignment] })).toBe(false);
  });

  it("requires a dated club byline for a first-person recall and keeps different full names distinct", () => {
    const id = "2124207149450686645", url = "https://x.com/AnaheimDucks/status/" + id;
    const text = "Roster Move: We have recalled Nico Myatovic from the @SDGullsAHL and placed Beckett Sennecke on IR with an upper-body injury.";
    const roster = { source: "wrapper" as const, text, publishedAt: "2026-11-21T18:23:44Z", reviewSpans: [],
      players: [{ id: 8484201, fullName: "Nico Myatovic", lastName: "Myatovic", team_id: 24, position: "L" },
        { id: 8484762, fullName: "Beckett Sennecke", lastName: "Sennecke", team_id: 24, position: "R" }] };
    expect(selectClubRosterMoves(roster, 24, url, id).map(m => [m.playerId, m.move]))
      .toEqual([[8484201, "recalled"], [8484762, "placed_on_ir"]]);
    expect(selectClubRosterMoves(roster, 24, url.replace("AnaheimDucks", "Reporter"), id)).toEqual([]);
    const wrong = { ...roster, text: text.replace("Nico Myatovic", "Another Myatovic") };
    expect(selectClubRosterMoves(wrong, 24, url, id).map(m => m.playerId)).toEqual([8484762]);
  });

  it("binds consecutive New Jersey transaction sentences to their separate named subjects", () => {
    const id = "2121312309528453495", url = "https://x.com/JamesNicholsNHL/status/" + id;
    const text = "The #NJDevils have placed Johnathan Kovacevic in IR. \n\nThey’ve recalled Anton Silaev.";
    const roster = { text, source: "wrapper" as const, publishedAt: "2026-11-13T18:40:41Z", reviewSpans: [], players: [
      { id: 8480192, fullName: "Johnathan Kovacevic", lastName: "Kovacevic", team_id: 1, position: "D" },
      { id: 8484987, fullName: "Anton Silaev", lastName: "Silaev", team_id: 1, position: "D" },
    ] };
    const read = (value: string) => selectClubRosterMoves({ ...roster, text: value }, 1, url, id);
    const moves = read(text);
    expect(moves.map(m => [m.playerId, m.move])).toEqual([[8480192, "placed_on_ir"], [8484987, "recalled"]]);
    for (const m of moves) {
      expect(text.slice(m.subject.start, m.subject.end)).toBe(m.subject.text);
      expect(text.slice(m.evidence.start, m.evidence.end)).toBe(m.evidence.text);
    }
    expect(read(text.replace("They’ve", "They have"))).toEqual(expect.arrayContaining([expect.objectContaining({ move: "recalled" })]));
    for (const changed of [text.replace("They’ve", "The #Canucks have"), text.replace("have placed", "may place"),
      text.replace("in IR.", "in IR?"), text.replace("Silaev.", "Silaev from Utica if healthy."), text.replace("#NJDevils", "#Canucks")]) {
      expect(read(changed)).toEqual([]);
    }
    expect(read(text.replace("Anton Silaev", "Another Silaev")).map(m => m.playerId)).toEqual([8480192]);
  });

  it("separates the Tampa recall from the injured player named in the same sentence", () => {
    const id = "2120174470593970413", url = "https://x.com/Erik_Erlendsson/status/" + id;
    const text = "With Brayden Point expected to miss some time, #GoBolts have placed Point on injured reserve and recalled C Sam O'Reilly";
    const roster = { text, source: "wrapper" as const, publishedAt: "2026-11-10T15:19:19Z", reviewSpans: [], players: [
      { id: 8478010, fullName: "Brayden Point", lastName: "Point", team_id: 14, position: "C" },
      { id: 8484770, fullName: "Sam O'Reilly", lastName: "O'Reilly", team_id: 14, position: "R" },
    ] };
    expect(selectClubRosterMoves(roster, 14, url, id).map(m => [m.playerId, m.move])).toEqual([
      [8478010, "placed_on_ir"], [8484770, "recalled"],
    ]);
    const mismatch = text.replace("placed Point", "placed Smith");
    expect(selectClubRosterMoves({ ...roster, text: mismatch }, 14, url, id).map(m => m.playerId)).toEqual([8484770]);
    expect(selectClubRosterMoves({ ...roster, text: text.replace("have placed", "may place") }, 14, url, id)).toEqual([]);
  });

  it("keeps a reported waiver destination separate from the player's dated source roster", () => {
    const id = "2120236759145750689", url = "https://x.com/mnwildPR/status/" + id;
    const text = "The #mnwild has activated defenseman Jared Spurgeon from Injured Reserve and reassigned forward Tyler Pitlick to the @IAWild. Defenseman Cameron Crotty has been claimed off waivers by the Vancouver Canucks.";
    const roster = { text, source: "wrapper" as const, publishedAt: "2026-11-10T19:26:50Z", reviewSpans: [], players: [
      { id: 8474716, fullName: "Jared Spurgeon", lastName: "Spurgeon", team_id: 30, position: "D" },
      { id: 8475752, fullName: "Tyler Pitlick", lastName: "Pitlick", team_id: 30, position: "F" },
      { id: 8480075, fullName: "Cameron Crotty", lastName: "Crotty", team_id: 30, position: "D" },
    ] };
    const moves = selectClubRosterMoves(roster, 30, url, id);
    expect(moves.map(move => move.move)).toEqual(["activated_off_ir", "reassigned", "claimed_off_waivers"]);
    expect(moves[2]).toMatchObject({ playerId: 8480075, teamId: 30, reportedDestination: { teamId: 23, name: "Vancouver Canucks" } });
    expect(selectClubRosterMoves({ ...roster, text: text.replace("Vancouver Canucks", "unidentified club") }, 30, url, id))
      .toEqual(moves.slice(0, 2));
  });

  it("leaves a relay's Avery Hayes correction in review without tagging the roster's Travis Hayes", () => {
    const id = "2123813937988964613", url = "https://x.com/NHL_Rosters/status/" + id;
    const text = "Pittsburgh has placed Nick Robertson on IR and recalled Avery Hayes from Wilkes-Barre/Scranton. #LetsGoPens";
    const row = buildRow({ tweet_id: id, tweet_url: url, source_url: url, source_handle: "NHL_Rosters",
      review_text: text, raw_text: text, team_id: 5, metadata: { intakeRosterEvidence: { text, source: "wrapper",
        publishedAt: "2026-11-20T16:21:16Z", reviewSpans: [], players: [
          { id: 8485581, fullName: "Travis Hayes", lastName: "Hayes", team_id: 5, position: "R" }] } } });
    expect(buildTweetNewsAutomationCandidate({ row, players: [] })).toBeNull();
    expect(buildTweetNewsAmbiguousCandidate({ row, players: [] })).toMatchObject({ cardStatus: "draft", playerAssignments: [],
      reviewAssignments: [], metadata: { automation: { ambiguityReason: "missing_required_evidence", dictionaryGap: false } } });
  });
  it.each(["Andrei Vasilevskiy will start if healthy.", "Andrei Vasilevskiy first off, but not confirmed.", "Victor Hedman has not been ruled out tonight.", "Andrei Vasilevskiy will start tonight?", "Connor Bedard could return fully healthy and ready for training camp.", "Connor Bedard is not fully healthy and ready for training camp."])("keeps uncertain claims out of confirmed automated news: %s", (text) => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    const candidate = buildTweetNewsAutomationCandidate({ row: buildRow({ review_text: text }), players });
    if (candidate?.subcategory === "CONFIRMED STARTER" || candidate?.subcategory === "OUT" || candidate?.subcategory === "FULLY HEALTHY") expect(candidate.cardStatus).not.toBe("published");
  });
  it("assigns a retained quote's initials to its publication roster despite a later trade", () => {
    const text = "VH will not play tonight.";
    const admitted = { ...players[1]!, lastName: "Hedman", aliases: ["VH"] };
    const row = buildRow({ team_id: null, team_abbreviation: null, review_text: "Another player will start.",
      quoted_text: text, metadata: { intakeRosterEvidence: { source: "quoted", text, publishedAt: "2026-05-26T15:00:00Z",
        players: [admitted], reviewSpans: [] } } });
    const current = [{ ...admitted, team_id: 8, aliases: [] }, { ...players[0]!, aliases: ["VH"] }];
    const candidate = buildTweetNewsAutomationCandidate({ row, players: current });
    expect(candidate).toMatchObject({ blurb: text, cardStatus: "published", category: "INJURY",
      playerAssignments: [{ playerId: 2, playerName: "Victor Hedman", teamId: 14 }] });
    expect(candidate?.metadata).not.toHaveProperty("intakeRosterEvidence");
    const stored = { ...candidate!.reviewAssignments[0]!, playerNames: ["Later player"], playerIds: [300] };
    const pending = { ...row, review_assignments: [stored] };
    expect(buildTweetNewsAutomationCandidate({ row: pending, players: current })?.playerAssignments).toEqual(candidate!.playerAssignments);
    expect(buildTweetNewsAutomationCandidate({ row: { ...pending, review_status: "reviewed" }, players: current })?.playerAssignments[0]?.playerId).toBe(300);
    const changed = { ...row, quoted_text: "Victor Hedman will not play tonight." };
    expect(buildTweetNewsAutomationCandidate({ row: changed, players: current })).toBeNull();
    expect(buildTweetNewsAmbiguousCandidate({ row: changed, players: current })).toMatchObject({ cardStatus: "draft", playerAssignments: [] });
  });

  it("keeps a review-only subject's predicate off a separate exact mention", () => {
    const text = "Victor Hedman spoke. VH will not play tonight. Andrei Vasilevskiy will start.";
    const start = text.indexOf("VH");
    const row = buildRow({ enriched_text: text, metadata: { intakeRosterEvidence: { source: "wrapper", text,
      publishedAt: "2026-05-26T15:00:00Z", reviewSpans: [{ start, end: start + 2 }],
      players: [{ ...players[1]!, lastName: "Hedman", aliases: ["VH"] }, { ...players[0]!, lastName: "Vasilevskiy" }] } } });
    const candidate = buildTweetNewsAutomationCandidate({ row, players });
    expect(candidate?.reviewAssignments.some(assignment => assignment.subcategory === "OUT")).toBe(false);
    expect(candidate).toMatchObject({ cardStatus: "published", subcategory: "CONFIRMED STARTER", playerAssignments: [{ playerId: 1, teamId: 14 }] });
    expect(candidate?.reviewAssignments.find(assignment => assignment.subcategory === "CONFIRMED STARTER")?.playerIds).toEqual([1]);
  });

  it("keeps an independent signing and leaves a reviewed signing unresolved", () => {
    const text = "Victor Hedman spoke. VH signed yesterday. Brayden Point signed today.";
    const start = text.indexOf("VH");
    const row = buildRow({ enriched_text: text, metadata: { intakeRosterEvidence: { source: "wrapper", text,
      publishedAt: "2026-05-26T15:00:00Z", reviewSpans: [{ start, end: start + 2 }],
      players: [{ ...players[1]!, lastName: "Hedman" }, { ...players[2]!, lastName: "Point" }] } } });
    expect(buildTweetNewsAutomationCandidate({ row, players })).toMatchObject({ category: "SIGNING", cardStatus: "published",
      playerAssignments: [{ playerId: 3, teamId: 14 }] });
  });

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
      sourceAccount: "@BeatWriter",
      sourceLabel: "Beat Writer",
      sourceUrl: "https://twitter.com/BeatWriter/status/100",
      playerAssignments: [{ playerId: 2, playerName: "Victor Hedman" }],
    });
  });
  it("retains affirmative fully healthy publication with interpreted subject evidence", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    const candidate = buildTweetNewsAutomationCandidate({ row: buildRow({ team_id: 16, team_abbreviation: "CHI", review_text: "Connor Bedard is fully healthy and ready for training camp." }), players });
    expect(candidate).toMatchObject({ category: "RETURN", subcategory: "FULLY HEALTHY", cardStatus: "published" });
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

  it("keeps NHL events when a later sentence only mentions minor-league history", () => {
    const retirement = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text:
          "Noah Philp announced his retirement. He previously played in the WHL.",
      }),
      players: [
        ...players,
        { id: 10, fullName: "Luke Philp", position: "C", team_id: 22 },
      ],
    });
    const signing = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text:
          "The Avalanche sign Georgii Merkulov to a one-year deal. He scored 15 goals in the AHL last season.",
      }),
      players,
    });

    expect(retirement).toMatchObject({
      cardStatus: "published",
      category: "RETIREMENT",
      playerAssignments: [],
    });
    expect(signing).toMatchObject({
      cardStatus: "published",
      category: "SIGNING",
    });
  });

  it("does not create news cards for top-performer stat recaps", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text:
          "NHL goalie top performers: Andrei Vasilevskiy 32 saves, 1 goal against.",
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

  it("nulls stale team ids before automated news writes", () => {
    const validTeamIds = new Set([8, 14]);

    expect(normalizeNewsTeamId(14, validTeamIds)).toBe(14);
    expect(normalizeNewsTeamId(59, validTeamIds)).toBeNull();
    expect(normalizeNewsTeamId(null, validTeamIds)).toBeNull();
  });

  it("publishes official signings even before destination-roster data catches up", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 5,
        team_abbreviation: "PIT",
        parser_classification: "other",
        review_text:
          "Nick Robertson and Pittsburgh have a settlement: 2 x $3.25M for him.",
      }),
      players,
      nowIso: "2026-07-14T15:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      category: "SIGNING",
      subcategory: "OFFICIAL SIGNING",
      headline: "PIT signing",
    });
  });

  it("publishes extension negotiations as news updates instead of official signings", () => {
    const mintyukov = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 24,
        team_abbreviation: "ANA",
        parser_classification: "other",
        review_text:
          "Hearing Pavel Mintyukov and the Anaheim Ducks are getting an extension done. It will be in the Brandt Clarke range.",
      }),
      players,
    });
    const hischier = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 1,
        team_abbreviation: "NJD",
        parser_classification: "other",
        review_text:
          "Sources say language and details are being worked on, C Hischier and the Devils are closing in on a 5 Yr Contract Extension just shy of $12M AAV.",
      }),
      players,
    });

    expect(mintyukov).toMatchObject({
      cardStatus: "published",
      category: "NEWS UPDATE",
      subcategory: "CONTRACT NEGOTIATION",
      headline: "ANA news update",
    });
    expect(hischier).toMatchObject({
      cardStatus: "published",
      category: "NEWS UPDATE",
      subcategory: "CONTRACT NEGOTIATION",
      headline: "NJD news update",
    });
  });

  it("publishes specific injury reports while marking them as unconfirmed", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 29,
        team_abbreviation: "CBJ",
        parser_classification: "other",
        review_text:
          "There is a report out of Sweden that Isac Lundestrom has torn his Achilles. The Blue Jackets are aware but are awaiting more information.",
      }),
      players,
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      category: "REPORTED INJURY",
      subcategory: "AWAITING OFFICIAL CONFIRMATION",
      headline: "CBJ reported injury",
    });
  });

  it("publishes identified projected-return timelines", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 16,
        team_abbreviation: "CHI",
        parser_classification: "other",
        review_text: "Connor Bedard's recovery puts a return around late October-ish.",
      }),
      players,
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      category: "RETURN",
      subcategory: "PROJECTED RETURN",
      headline: "Connor Bedard return update",
    });
  });

  it("publishes completed trades but not trade-talk updates", () => {
    const completed = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text:
          "We have acquired Zac Funk in exchange for forward Tyler Kopff.",
      }),
      players,
      nowIso: "2026-07-14T15:00:00.000Z",
    });
    const rumor = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text: "There is no update on Connor Hellebuyck trade talks.",
      }),
      players,
      nowIso: "2026-07-14T15:00:00.000Z",
    });

    expect(completed).toMatchObject({
      cardStatus: "published",
      category: "TRADE",
      subcategory: "COMPLETED TRADE",
    });
    expect(rumor).toBeNull();
  });

  it("falls back to global exact player matching for destination-team news", () => {
    const candidate = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: 8,
        team_abbreviation: "MTL",
        review_text: "Victor Hedman will not play tonight.",
      }),
      players,
      nowIso: "2026-07-14T15:00:00.000Z",
    });

    expect(candidate).toMatchObject({
      cardStatus: "published",
      playerAssignments: [{ playerId: 2, playerName: "Victor Hedman" }],
    });
  });

  it("never downgrades an already published or archived card", () => {
    expect(
      resolveAutomatedNewsCardStatus({
        existingStatus: "published",
        candidateStatus: "draft",
      }),
    ).toBe("published");
    expect(
      resolveAutomatedNewsCardStatus({
        existingStatus: "archived",
        candidateStatus: "published",
      }),
    ).toBe("archived");
    expect(
      resolveAutomatedNewsCardStatus({
        existingStatus: "draft",
        candidateStatus: "published",
      }),
    ).toBe("published");
  });

  it("publishes completed offer sheets and player-specific arbitration filings", () => {
    const offerSheet = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text: "The Ducks have matched the Leo Carlsson offer sheet.",
      }),
      players,
    });
    const arbitration = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text: "Braden Schneider has filed for arbitration.",
      }),
      players,
    });

    expect(offerSheet).toMatchObject({
      cardStatus: "published",
      category: "TRANSACTION",
      subcategory: "OFFER SHEET",
    });
    expect(arbitration).toMatchObject({
      cardStatus: "published",
      category: "TRANSACTION",
      subcategory: "ARBITRATION",
    });
  });

  it("publishes explicit surgery and absence timeline updates", () => {
    const surgery = buildTweetNewsAutomationCandidate({
      row: buildRow({
        review_text: "The team confirms Jett Luchanko is having core surgery.",
      }),
      players,
    });
    const timeline = buildTweetNewsAutomationCandidate({
      row: buildRow({
        review_text: "Connor Bedard will miss at least the first month.",
      }),
      players,
    });

    expect(surgery).toMatchObject({
      cardStatus: "published",
      category: "INJURY",
      subcategory: "SURGERY / REHAB",
    });
    expect(timeline).toMatchObject({
      cardStatus: "published",
      category: "INJURY",
      subcategory: "OUT",
    });
  });

  it("publishes completed surgery, active contract talks, and camp-ready returns", () => {
    const surgery = buildTweetNewsAutomationCandidate({
      row: buildRow({
        review_text: "Connor Bedard had wrist surgery and is expected back in November.",
      }),
      players,
    });
    const contractTalks = buildTweetNewsAutomationCandidate({
      row: buildRow({
        review_text:
          "Brayden Point and the Lightning are still in talks on a contract ahead of arbitration.",
      }),
      players,
    });
    const campReady = buildTweetNewsAutomationCandidate({
      row: buildRow({
        team_id: null,
        team_abbreviation: null,
        review_text:
          "Nikita Grebenkin is fully healthy and ready to go for training camp.",
      }),
      players,
    });

    expect(surgery).toMatchObject({
      cardStatus: "published",
      category: "INJURY",
      subcategory: "SURGERY / REHAB",
    });
    expect(contractTalks).toMatchObject({
      cardStatus: "published",
      category: "NEWS UPDATE",
      subcategory: "CONTRACT NEGOTIATION",
    });
    expect(campReady).toMatchObject({
      cardStatus: "published",
      category: "RETURN",
      subcategory: "FULLY HEALTHY",
    });
  });

  it("excludes historical position and goalie usage recaps", () => {
    expect(
      buildTweetNewsAutomationCandidate({
        row: buildRow({
          review_text:
            "Krebs played 82 games for Buffalo, lining up 49 times at LW and 29 times at C.",
        }),
        players,
      }),
    ).toBeNull();
    expect(
      buildTweetNewsAutomationCandidate({
        row: buildRow({
          review_text:
            "Silovs played 39 games in goal for Pittsburgh, starting 38 times.",
        }),
        players,
      }),
    ).toBeNull();
  });

  it("classifies concise free-agent terms and concrete deployment updates", () => {
    const signing = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text: "Corey Perry 1 x $1M — Los Angeles.",
      }),
      players,
    });
    const deployment = buildTweetNewsAutomationCandidate({
      row: buildRow({
        parser_classification: "other",
        review_text: "The tentative plan is to play him on the wing.",
      }),
      players,
    });

    expect(signing).toMatchObject({ cardStatus: "published", category: "SIGNING" });
    expect(deployment).toMatchObject({
      cardStatus: "published",
      category: "LINE CHANGE",
      subcategory: "PROJECTED ROLE",
    });
  });

  it("excludes roundup links and generic arbitration explainers", () => {
    expect(
      buildTweetNewsAutomationCandidate({
        row: buildRow({ review_text: "Recap of Day 2 of Free Agency https://example.com" }),
        players,
      }),
    ).toBeNull();
    expect(
      buildTweetNewsAutomationCandidate({
        row: buildRow({
          review_text: "The deadline for players to file for arbitration is tomorrow at 5pm ET.",
        }),
        players,
      }),
    ).toBeNull();
  });
});

describe("News lineup cards render validated interpreter units only", () => {
  // Retained FxTwitter post (Zach Cavanagh, tweet 2122126809533923555): ANA warm-up 11/15 vs CGY.
  const text = `RT @ZachCav: Anaheim Ducks warm-up line rushes 11/15 vs. #Flames:

Caulfield-Carlsson-Gauthier
Malott-Granlund-Sennecke
Moore-Washe-Killorn
Nesterenko-McQueen-Terry

LaCombe-Helleson
Hinds-Luneau
Mintyukov-Warren

Husso | Dostál

Scratches: Colangelo, Vatrano, Mitchell`;
  // Fixture roster: Ian Moore is rostered as D, as he was for this game.
  const rows: Array<[string, string]> = [["Judd Caulfield", "R"], ["Leo Carlsson", "C"], ["Cutter Gauthier", "L"], ["Jeffrey Malott", "L"],
    ["Mikael Granlund", "C"], ["Beckett Sennecke", "R"], ["Ian Moore", "D"], ["Tim Washe", "C"], ["Alex Killorn", "L"], ["Nikita Nesterenko", "C"],
    ["Jack McQueen", "C"], ["Troy Terry", "R"], ["Jackson LaCombe", "D"], ["Drew Helleson", "D"], ["Tyson Hinds", "D"], ["Tristan Luneau", "D"],
    ["Pavel Mintyukov", "D"], ["Noah Warren", "D"], ["Ville Husso", "G"], ["Lukas Dostál", "G"], ["Sam Colangelo", "R"], ["Frank Vatrano", "R"], ["Ian Mitchell", "D"]];
  const ANA = 24, GAME = 2026020328;
  const roster = rows.map(([fullName, position], index) => ({ playerId: 9000 + index, fullName, lastName: fullName.split(" ").pop()!, position, teamId: ANA }));
  const automationPlayers = roster.map((player) => ({ id: player.playerId, fullName: player.fullName, position: player.position, team_id: ANA }));
  const retainedInterpretation = () => ({ ...interpretTweetUnits(text, roster), events: extractTweetPlayerEvents({ text, players: roster, publishedAt: "2026-11-16T03:40:00Z" }) });
  const ducksRow = (metadata: Record<string, unknown>) => buildRow({ team_id: ANA, team_abbreviation: "ANA", parser_classification: "lineup",
    tweet_id: "2122126809533923555", review_text: text, metadata });
  const publicLineup = (metadata: Record<string, unknown>, teamId: number | null = ANA) => {
    const item = sanitizePublicNewsFeedItem({ id: "card", headline: "ANA line combination update", blurb: text, team_id: teamId,
      source_url: "https://x.com/ZachCav/status/2122126809533923555", metadata } as any);
    return readNewsLineupPresentation({ metadata: item.metadata, subcategory: "FORWARD LINES", teamId });
  };
  const tiles = (lineup: ReturnType<typeof readNewsLineupPresentation>) => lineup.rows.map((row) => [row.label, row.players.join("-")]);

  it("new card: shows the verified Ducks units with F3 as a reported 'D listed at F' line, both listed goalies, no headline, scratches in their own row", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const candidate = buildTweetNewsAutomationCandidate({ row: ducksRow({ retainedInterpretation: retainedInterpretation(), retainedGameId: GAME }),
      players: automationPlayers, nowIso: "2026-11-16T03:45:00.000Z" });
    expect(candidate?.category).toBe("LINE COMBINATION");
    const lineup = publicLineup(candidate!.metadata);
    expect(tiles(lineup)).toEqual([
      ["F1", "Judd Caulfield-Leo Carlsson-Cutter Gauthier"], ["F2", "Jeffrey Malott-Mikael Granlund-Beckett Sennecke"],
      ["F3", "Ian Moore-Tim Washe-Alex Killorn"], ["F4", "Nikita Nesterenko-Jack McQueen-Troy Terry"],
      ["D1", "Jackson LaCombe-Drew Helleson"], ["D2", "Tyson Hinds-Tristan Luneau"], ["D3", "Pavel Mintyukov-Noah Warren"],
      ["G1", "Ville Husso"], ["G2", "Lukas Dostál"], ["Scratch", "Sam Colangelo-Frank Vatrano-Ian Mitchell"],
    ]);
    expect(lineup.rows.find((row) => row.label === "Scratch")!.kind).toBe("scratch");
    // Moore is rostered D: the post lists him at F. That is reported, not a roster change or proof he played there.
    expect(lineup.rows.find((row) => row.label === "F3")!.notes).toEqual(["D listed at F", null, null]);
    expect(lineup.rows.filter((row) => row.label !== "F3").every((row) => !row.notes)).toBe(true);
    expect(lineup.notice).toBeNull();
    expect(lineup.context).toBe("Warm-up snapshot · reported");
    expect(lineup.startingGoalie).toBeNull();
    expect(JSON.stringify(lineup.rows)).not.toMatch(/ZachCav|warm|Husso \||Scratches:/);
  });

  it("shows a pipe goalie pair in either order as two listed goalies with no starter badge", () => {
    for (const [line, expected] of [["Husso | Dostál", ["Ville Husso", "Lukas Dostál"]], ["Dostál | Husso", ["Lukas Dostál", "Ville Husso"]]] as const) {
      const body = text.replace("Husso | Dostál", line);
      const lineup = validatedNewsLineupRows(buildNewsLineupSnapshot({ interpretation: { ...interpretTweetUnits(body, roster),
        events: extractTweetPlayerEvents({ text: body, players: roster, publishedAt: null }) }, teamId: ANA, gameId: GAME, sourceTweetId: "p" }), ANA)!;
      expect(lineup.rows.filter((row) => row.kind === "goalie").map((row) => [row.label, row.players[0]])).toEqual([["G1", expected[0]], ["G2", expected[1]]]);
      expect(lineup.startingGoalie).toBeNull();
    }
  });

  it("leaves a malformed 'D listed at F' lookalike out and marks the card partial", () => {
    const f3 = (forwardRow: string, extraPair = "") => {
      const body = text.replace("Moore-Washe-Killorn", forwardRow).replace("Mintyukov-Warren", `Mintyukov-Warren${extraPair}`);
      return validatedNewsLineupRows(buildNewsLineupSnapshot({ interpretation: interpretTweetUnits(body, roster), teamId: ANA, gameId: GAME, sourceTweetId: "x" }), ANA)!;
    };
    const lacks = (lineup: ReturnType<typeof f3>, label: string) => {
      expect(lineup.rows.some((row) => row.label === label && row.kind === "forward")).toBe(false);
      expect(lineup.partial).toBe(true);
    };
    lacks(f3("Moore-Washe-Killorn", "\nMoore-Hinds"), "F3"); // also listed in a defense pair: role is ambiguous
    lacks(f3("Moore-Mintyukov-Killorn"), "F3"); // two rostered D in one forward row
    lacks(f3("Moore-Washe-Husso"), "F3"); // a goalie in the row
    lacks(f3("Moore-Washe-Nobody"), "F3"); // an unresolved name
    expect(f3("Moore-Washe").rows.some((row) => row.players.includes("Ian Moore"))).toBe(false); // short row
  });

  it("existing card: never renders the stored text-split lineupCard, even beside retained units without a game binding", () => {
    // The saved shape of the published card: text-split lineupCard plus the row's retained interpretation, no newsLineup.
    const saved = { lineupCard: { forwards: [["Caulfield", "Carlsson", "Gauthier"]], defensePairs: [["RT @ZachCav: Anaheim Ducks warm", "up line rushes 11/15 vs. #Flames:"]],
      goalies: ["Husso | Dostál", "Scratches: Colangelo, Vatrano, Mitchell"], startingGoalie: "Husso | Dostál" }, retainedInterpretation: retainedInterpretation() };
    const lineup = publicLineup(saved);
    expect(lineup.rows).toEqual([]);
    expect(lineup.notice).toBe("Structured lineup unavailable for this report. See the source report.");
    // A game post whose snapshot carries no NHL game id stays source-only too.
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const unbound = buildTweetNewsAutomationCandidate({ row: ducksRow({ retainedInterpretation: retainedInterpretation() }), players: automationPlayers });
    expect(publicLineup(unbound!.metadata).rows).toEqual([]);
  });

  it("wrong team: an AHL lineup or another team's card shows no tiles (Ontario→COL, Hallander/PHI shapes)", () => {
    vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
    const candidate = buildTweetNewsAutomationCandidate({ row: ducksRow({ retainedInterpretation: retainedInterpretation(), retainedGameId: GAME }),
      players: automationPlayers });
    // The same snapshot shown on a card for a different team (COL = 21, PHI = 4) never validates.
    expect(publicLineup(candidate!.metadata, 21).rows).toEqual([]);
    expect(publicLineup(candidate!.metadata, 4).rows).toEqual([]);
    // Synthetic Ontario Reign lines interpreted against Colorado's roster: no AHL name resolves, so no unit passes.
    const colorado = [{ playerId: 1, fullName: "Nathan MacKinnon", lastName: "MacKinnon", position: "C", teamId: 21 }];
    const ontario = buildNewsLineupSnapshot({ interpretation: interpretTweetUnits("Reign lines\nTurcotte-Lambos-Fagemo\nSpence-Clarke", colorado),
      teamId: 21, gameId: GAME, sourceTweetId: "ontario" });
    expect(publicLineup({ newsLineup: ontario }, 21).rows).toEqual([]);
  });

  it("labels a starter only from an explicit claim, never from goalie order", () => {
    const goalies = [{ playerId: 1, fullName: "Ville Husso", lastName: "Husso", position: "G", teamId: ANA },
      { playerId: 2, fullName: "Lukas Dostál", lastName: "Dostál", position: "G", teamId: ANA }];
    const snapshot = (body: string) => {
      const interpretation = { ...interpretTweetUnits(body, goalies), events: extractTweetPlayerEvents({ text: body, players: goalies, publishedAt: null }) };
      return buildNewsLineupSnapshot({ interpretation, teamId: ANA, gameId: GAME, sourceTweetId: "g" });
    };
    const ordered = validatedNewsLineupRows(snapshot("Ducks lines tonight\nG: Husso\nG: Dostál"), ANA)!;
    expect(ordered.rows.map((row) => [row.label, row.players[0]])).toEqual([["G1", "Ville Husso"], ["G2", "Lukas Dostál"]]);
    expect(ordered.startingGoalie).toBeNull();
    const explicit = validatedNewsLineupRows(snapshot("Ducks lines tonight\nG: Husso\nG: Dostál\nHusso gets the start tonight."), ANA)!;
    expect(explicit.rows.filter((row) => row.kind === "goalie")).toHaveLength(2);
    expect(explicit.startingGoalie).toBe("Ville Husso");
  });
});
