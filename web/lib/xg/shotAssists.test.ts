import { describe, expect, it } from "vitest";

import {
  buildShotAssistCandidateRows,
  fetchShotAssistPriorEvents,
  type ShotAssistFeatureRow,
} from "./shotAssists";

function feature(overrides: Partial<ShotAssistFeatureRow> = {}): ShotAssistFeatureRow {
  return {
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    shot_event_type: "shot-on-goal",
    is_unblocked_shot_attempt: true,
    is_rebound_shot: false,
    is_penalty_shot_event: false,
    is_shootout_event: false,
    previous_event_id: 101,
    previous_event_type_desc_key: "takeaway",
    previous_event_team_id: 10,
    previous_event_same_team: true,
    time_since_previous_event_seconds: 2,
    distance_from_previous_event: 25,
    feature_payload: {
      possessionSequenceId: "2025020001:10:1",
      possessionEventCount: 2,
      possessionDurationSeconds: 2,
      possessionEnteredOffensiveZone: true,
      possessionRegainedFromOpponent: true,
    },
    ...overrides,
  };
}

describe("buildShotAssistCandidateRows", () => {
  it("creates weighted expected primary assist candidates from same-team prior events", () => {
    const rows = buildShotAssistCandidateRows({
      features: [feature()],
      predictions: [
        {
          model_version: "model-v1",
          prediction_type: "shot_goal",
          feature_version: 1,
          game_id: 2025020001,
          event_id: 102,
          xg: 0.4,
          model_approved: true,
        },
      ],
      priorEvents: [
        {
          game_id: 2025020001,
          event_id: 101,
          type_desc_key: "takeaway",
          event_owner_team_id: 10,
          player_id: 92,
          shooting_player_id: null,
          scoring_player_id: null,
          winning_player_id: null,
          hitting_player_id: null,
          blocking_player_id: null,
          zone_code: "N",
        },
      ],
      generatedAt: "2026-05-27T20:00:00.000Z",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        model_version: "model-v1",
        game_id: 2025020001,
        event_id: 102,
        shot_assist_player_id: 92,
        source_event_id: 101,
        confidence: 0.85,
        confidence_tier: "high",
        xg: 0.4,
        expected_primary_assists: 0.34,
      }),
    ]);
  });

  it("does not infer candidates for rebounds, faceoffs, self events, or unapproved predictions", () => {
    const basePrediction = {
      model_version: "model-v1",
      prediction_type: "shot_goal",
      feature_version: 1,
      game_id: 2025020001,
      event_id: 102,
      xg: 0.4,
      model_approved: true,
    };
    const priorEvent = {
      game_id: 2025020001,
      event_id: 101,
      type_desc_key: "takeaway",
      event_owner_team_id: 10,
      player_id: 92,
      shooting_player_id: null,
      scoring_player_id: null,
      winning_player_id: null,
      hitting_player_id: null,
      blocking_player_id: null,
      zone_code: "N",
    };

    expect(
      buildShotAssistCandidateRows({
        features: [
          feature({ is_rebound_shot: true }),
          feature({ previous_event_type_desc_key: "faceoff" }),
          feature({ previous_event_type_desc_key: "missed-shot" }),
          feature({ previous_event_type_desc_key: "blocked-shot" }),
          feature({ previous_event_type_desc_key: "giveaway" }),
          feature({ previous_event_type_desc_key: "line-change" }),
          feature({ previous_event_same_team: false }),
          feature({ shooter_player_id: 92 }),
        ],
        predictions: [basePrediction],
        priorEvents: [priorEvent],
      })
    ).toEqual([]);

    expect(
      buildShotAssistCandidateRows({
        features: [feature()],
        predictions: [{ ...basePrediction, model_approved: false }],
        priorEvents: [priorEvent],
      })
    ).toEqual([]);
  });
});

describe("shot-assist candidates at an empty net (decision 7)", () => {
  const args = (overrides: Partial<ShotAssistFeatureRow>) => ({
    features: [feature(overrides)],
    predictions: [
      { model_version: "model-v1", prediction_type: "shot_goal", feature_version: 1, game_id: 2025020001, event_id: 102, xg: 0.4, model_approved: true },
    ],
    priorEvents: [
      {
        game_id: 2025020001, event_id: 101, type_desc_key: "takeaway", event_owner_team_id: 10, player_id: 92,
        shooting_player_id: null, scoring_player_id: null, winning_player_id: null, hitting_player_id: null,
        blocking_player_id: null, zone_code: "N",
      },
    ],
    generatedAt: "2026-05-27T20:00:00.000Z",
  });

  it("credits no assist xG on a shot at an empty net, but keeps the shooter's own empty net", () => {
    expect(buildShotAssistCandidateRows(args({ is_empty_net_event: true, goalie_in_net_id: null }))).toEqual([]);
    expect(buildShotAssistCandidateRows(args({ is_empty_net_event: true, goalie_in_net_id: 31 }))).toHaveLength(1);
  });
});

describe("fetchShotAssistPriorEvents (capped client, BA W1-1 B)", () => {
  /** PostgREST-like fake: filters, orders and applies range, but never returns more than `cap` rows. */
  function cappedClient(table: Array<{ game_id: number; event_id: number }>, cap = 1000) {
    let requests = 0;
    const client = {
      from: () => {
        const filters: Array<(row: { game_id: number; event_id: number }) => boolean> = [];
        let range: [number, number] | null = null;
        const query: any = {
          select: () => query,
          eq: (column: "game_id" | "event_id", value: number) => {
            filters.push((row) => row[column] === value);
            return query;
          },
          in: (column: "game_id" | "event_id", values: number[]) => {
            const allowed = new Set(values);
            filters.push((row) => allowed.has(row[column]));
            return query;
          },
          order: () => query,
          range: (from: number, to: number) => {
            range = [from, to];
            return query;
          },
          then: (resolve: (value: unknown) => void) => {
            requests += 1;
            const matched = table
              .filter((row) => filters.every((filter) => filter(row)))
              .sort((a, b) => a.game_id - b.game_id || a.event_id - b.event_id);
            const windowed = range ? matched.slice(range[0], range[1] + 1) : matched;
            return Promise.resolve({ data: windowed.slice(0, cap), error: null }).then(resolve);
          },
        };
        return query;
      },
    };
    return { client, requests: () => requests };
  }

  it("resolves every eligible (game, previous event) pair despite a 1,000-row response cap", async () => {
    // Three games with 600 shots each; every previous event exists in the PBP table.
    const games = [2025020001, 2025020002, 2025020003];
    const features = games.flatMap((gameId) =>
      Array.from({ length: 600 }, (_, index) => ({ game_id: gameId, previous_event_id: 1000 + index * 2 }))
    );
    const pbp = games.flatMap((gameId) =>
      Array.from({ length: 1300 }, (_, index) => ({ game_id: gameId, event_id: 1000 + index }))
    );
    const { client } = cappedClient(pbp);
    const result = await fetchShotAssistPriorEvents(client, features, { pageSize: 1000 });
    expect(result.eligiblePairs).toBe(1800);
    expect(result.resolvedPairs).toBe(1800);
    // Only requested pairs come back, once each.
    expect(result.rows).toHaveLength(1800);
  });

  it("reports pairs missing from the play-by-play as unresolved", async () => {
    const features = [
      { game_id: 2025020001, previous_event_id: 5 },
      { game_id: 2025020001, previous_event_id: 6 },
      { game_id: 2025020002, previous_event_id: 5 },
    ];
    const { client } = cappedClient([{ game_id: 2025020001, event_id: 5 }, { game_id: 2025020002, event_id: 6 }]);
    const result = await fetchShotAssistPriorEvents(client, features);
    expect(result).toMatchObject({ eligiblePairs: 3, resolvedPairs: 1 });
    expect(result.rows).toEqual([{ game_id: 2025020001, event_id: 5 }]);
  });
});
