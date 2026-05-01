import { describe, expect, it } from "vitest";

import { collectUnresolvedNamesFromLineRows } from "./lineSourceProcessing";

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    capture_key: "capture-1",
    source: "gamedaylines",
    source_url: "https://twitter.com/i/web/status/2050267867149672449",
    tweet_id: "2050267867149672449",
    quoted_tweet_id: null,
    team_id: 54,
    team_abbreviation: "VGK",
    status: "observed",
    nhl_filter_status: "accepted",
    classification: "lineup",
    raw_text: null,
    enriched_text:
      "Karlsson didn’t take line rushes.\nR. Smith-Hertl-Kolesar\nC. Smith-Dowd-Sissons",
    quoted_raw_text: null,
    quoted_enriched_text: null,
    unmatched_names: null,
    line_1_player_ids: null,
    line_1_player_names: null,
    line_2_player_ids: null,
    line_2_player_names: null,
    line_3_player_ids: null,
    line_3_player_names: null,
    line_4_player_ids: null,
    line_4_player_names: null,
    pair_1_player_ids: null,
    pair_1_player_names: null,
    pair_2_player_ids: null,
    pair_2_player_names: null,
    pair_3_player_ids: null,
    pair_3_player_names: null,
    scratches_player_ids: null,
    scratches_player_names: null,
    injured_player_ids: null,
    injured_player_names: null,
    goalie_1_player_id: null,
    goalie_1_name: null,
    goalie_2_player_id: null,
    goalie_2_name: null,
    ...overrides,
  };
}

describe("lineSourceProcessing", () => {
  it("expands ambiguous unmatched last names to initial-qualified context aliases", () => {
    const rows = collectUnresolvedNamesFromLineRows([
      buildRow({
        unmatched_names: ["Smith"],
      }),
    ] as any);

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw_name: "R. Smith",
          normalized_name: "r. smith",
          metadata: expect.objectContaining({
            reason: "unmatched_names",
            contextAlias: "R. Smith",
          }),
        }),
        expect.objectContaining({
          raw_name: "C. Smith",
          normalized_name: "c. smith",
          metadata: expect.objectContaining({
            reason: "unmatched_names",
            contextAlias: "C. Smith",
          }),
        }),
      ])
    );
  });
});
