import { describe, expect, it } from "vitest";

import {
  buildTweetNewsAmbiguousCandidate,
  buildTweetNewsAutomationCandidate,
  type TweetNewsAutomationPlayer,
  type TweetNewsAutomationReviewRow,
} from "./tweetNewsAutomation";
import {
  normalizeNewsTeamId,
  resolveAutomatedNewsCardStatus,
} from "../newsFeed";

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
