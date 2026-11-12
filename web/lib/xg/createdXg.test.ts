import { describe, expect, it } from "vitest";

import {
  buildCreatedXgAggregates,
  type CreatedXgShotAssistRow,
  type CreatedXgShotIdentityRow,
  type CreatedXgShotXgRow,
  type CreatedXgTransitionEventRow,
} from "./createdXg";
import { xgCoverageGameKey } from "./aggregates";

function shotXg(eventId: number, xg: number, gameId = 2025020001): CreatedXgShotXgRow {
  return { model_version: "model-v1", feature_version: 1, game_id: gameId, event_id: eventId, xg, model_approved: true };
}

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
      shotXgRows: [shotXg(102, 0.5)],
      options: {
        generatedAt: "2026-05-27T20:00:00.000Z",
        rollingWindows: [2],
        participation: [92, 93].map((playerId) => ({
          entity_id: playerId, game_id: 2025020001, game_date: "2025-10-07", season_id: 20252026, team_id: 10,
        })),
        coveredGameKeys: new Set([xgCoverageGameKey({ modelVersion: "model-v1", featureVersion: 1, gameId: 2025020001 })]),
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
      shotXgRows: [shotXg(102, 0.5)],
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

  it("caps a shot's exclusive credits at its xG whatever the credit order (decision 22)", () => {
    // Raw credits 0.24 (assist) + 0.18 (transition) = 0.42 on a 0.3 xG shot.
    const build = (order: "forward" | "reverse") => {
      const transitions = [transition(), transition({ player_id: 94, transition_type: "controlled_exit_proxy", transition_created_xg: 0.1 })];
      return buildCreatedXgAggregates({
        shotAssistRows: [shotAssist()],
        transitionRows: order === "forward" ? transitions : [...transitions].reverse(),
        shotIdentityRows: [shotIdentity()],
        shotXgRows: [shotXg(102, 0.3)],
        options: { generatedAt: "2026-05-27T20:00:00.000Z", rollingWindows: [2] },
      });
    };
    const forward = build("forward");
    const total = forward.playerGameRows.reduce((sum, row) => sum + row.created_xg, 0);
    expect(total).toBeCloseTo(0.3, 6);
    for (const row of forward.playerGameRows) {
      const raw = { 92: 0.24, 93: 0.18, 94: 0.1 }[row.player_id as 92 | 93 | 94];
      expect(row.created_xg).toBeLessThanOrEqual(raw);
    }
    expect(forward.reconciliation.passed).toBe(true);
    expect(forward.reconciliation.creditCap).toMatchObject({ creditedShots: 1, cappedShots: 1, shotsOverCap: 0 });
    expect(forward.reconciliation.creditCap.creditAboveShotXg).toBeCloseTo(0.22, 6);
    const byPlayer = (rows: typeof forward.playerGameRows) =>
      Object.fromEntries(rows.map((row) => [row.player_id, row.created_xg]));
    expect(byPlayer(build("reverse").playerGameRows)).toEqual(byPlayer(forward.playerGameRows));
  });

  it("leaves credit on a shot with unknown xG uncounted rather than uncapped", () => {
    const result = buildCreatedXgAggregates({
      shotAssistRows: [shotAssist()],
      transitionRows: [transition()],
      shotIdentityRows: [shotIdentity()],
      shotXgRows: [],
      options: { generatedAt: "2026-05-27T20:00:00.000Z" },
    });
    expect(result.playerGameRows).toEqual([]);
    expect(result.reconciliation.creditCap.creditsWithoutShotXg).toBe(2);
  });

  it("rolls over the last N dressed games, not the last N games with a credit", () => {
    // Player 92 dressed in games 1-3 and was credited only in games 1 and 3.
    const games = [1, 2, 3].map((index) => ({ gameId: 2025020000 + index, date: `2025-10-0${index}` }));
    const result = buildCreatedXgAggregates({
      shotAssistRows: [1, 3].map((index) =>
        shotAssist({ game_id: 2025020000 + index, game_date: `2025-10-0${index}`, event_id: 100 + index })
      ),
      transitionRows: [],
      shotIdentityRows: [],
      shotXgRows: [1, 3].map((index) => shotXg(100 + index, 0.5, 2025020000 + index)),
      options: {
        generatedAt: "2026-05-27T20:00:00.000Z",
        rollingWindows: [2],
        participation: games.map((game) => ({
          entity_id: 92, game_id: game.gameId, game_date: game.date, season_id: 20252026, team_id: 10,
        })),
        coveredGameKeys: new Set(
          games.map((game) => xgCoverageGameKey({ modelVersion: "model-v1", featureVersion: 1, gameId: game.gameId }))
        ),
      },
    });
    expect(result.playerRollingRows.find((row) => row.as_of_game_id === 2025020003)).toMatchObject({
      games_count: 2,
      created_xg: 0.24,
      shot_assist_events: 1,
    });
  });
});
