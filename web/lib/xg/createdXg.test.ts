import { describe, expect, it } from "vitest";

import {
  buildCreatedXgAggregates,
  type CreatedXgShotAssistRow,
  type CreatedXgShotIdentityRow,
  type CreatedXgTransitionEventRow,
} from "./createdXg";

function shotAssist(
  overrides: Partial<CreatedXgShotAssistRow> = {}
): CreatedXgShotAssistRow {
  return {
    model_version: "model-v1",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    shot_assist_player_id: 92,
    expected_primary_assists: 0.24,
    ...overrides,
  };
}

function transition(
  overrides: Partial<CreatedXgTransitionEventRow> = {}
): CreatedXgTransitionEventRow {
  return {
    model_version: "model-v1",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    transition_type: "entry_assist_proxy",
    season_id: 20252026,
    game_date: "2025-10-07",
    team_id: 10,
    player_id: 93,
    shot_event_id: 102,
    transition_created_xg: 0.18,
    ...overrides,
  };
}

function shotIdentity(
  overrides: Partial<CreatedXgShotIdentityRow> = {}
): CreatedXgShotIdentityRow {
  return {
    feature_version: 1,
    game_id: 2025020001,
    event_id: 102,
    shooter_player_id: 91,
    event_owner_team_id: 10,
    ...overrides,
  };
}

describe("buildCreatedXgAggregates", () => {
  it("builds created-xG game and rolling rows from shot-assist and transition components", () => {
    const result = buildCreatedXgAggregates({
      shotAssistRows: [shotAssist()],
      transitionRows: [transition()],
      shotIdentityRows: [shotIdentity()],
      options: {
        generatedAt: "2026-05-27T20:00:00.000Z",
        rollingWindows: [2],
      },
    });

    expect(result.playerGameRows).toEqual([
      expect.objectContaining({
        player_id: 92,
        team_id: 10,
        shot_assist_created_xg: 0.24,
        transition_created_xg: 0,
        rebound_created_xg: 0,
        created_xg: 0.24,
        shot_assist_events: 1,
        transition_events: 0,
      }),
      expect.objectContaining({
        player_id: 93,
        team_id: 10,
        shot_assist_created_xg: 0,
        transition_created_xg: 0.18,
        rebound_created_xg: 0,
        created_xg: 0.18,
        shot_assist_events: 0,
        transition_events: 1,
      }),
    ]);
    expect(result.playerRollingRows).toContainEqual(
      expect.objectContaining({
        player_id: 92,
        window_games: 2,
        games_count: 1,
        created_xg: 0.24,
      })
    );
    expect(result.reconciliation).toMatchObject({
      passed: true,
      expected: {
        shotAssistCreatedXg: 0.24,
        transitionCreatedXg: 0.18,
        createdXg: 0.42,
        shotAssistEvents: 1,
        transitionEvents: 1,
      },
      actual: {
        shotAssistCreatedXg: 0.24,
        transitionCreatedXg: 0.18,
        createdXg: 0.42,
        shotAssistEvents: 1,
        transitionEvents: 1,
      },
    });
  });

  it("excludes shooter self-credit and picks one transition credit per player-shot", () => {
    const result = buildCreatedXgAggregates({
      shotAssistRows: [shotAssist({ shot_assist_player_id: 91 })],
      transitionRows: [
        transition({ transition_type: "transition_created_shot", player_id: 91 }),
        transition({ transition_type: "controlled_entry_proxy", player_id: 91 }),
        transition({ transition_type: "controlled_entry_proxy", player_id: 93, transition_created_xg: 0.12 }),
        transition({ transition_type: "controlled_exit_proxy", player_id: 93, transition_created_xg: 0.2 }),
      ],
      shotIdentityRows: [shotIdentity()],
      options: {
        generatedAt: "2026-05-27T20:00:00.000Z",
        rollingWindows: [2],
      },
    });

    expect(result.playerGameRows).toEqual([
      expect.objectContaining({
        player_id: 93,
        transition_created_xg: 0.2,
        created_xg: 0.2,
        transition_events: 1,
      }),
    ]);
    expect(result.reconciliation.skippedTransitionRows).toContainEqual(
      expect.objectContaining({
        transitionType: "controlled_entry_proxy",
        reason: "shooter_self_credit_excluded",
      })
    );
    expect(result.reconciliation).toMatchObject({
      passed: true,
      expected: {
        shotAssistEvents: 0,
        transitionEvents: 1,
        transitionCreatedXg: 0.2,
        createdXg: 0.2,
      },
    });
  });
});
