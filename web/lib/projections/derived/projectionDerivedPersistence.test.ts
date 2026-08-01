import { describe, expect, it, vi } from "vitest";

import type { PreparedGoalieGameV2 } from "./buildGoalieGameV2";
import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "../relationshipMaterialization";
import type {
  ProjectionPlayerStrengthRow,
  ProjectionTeamStrengthRow,
} from "./buildStrengthTablesV2";
import {
  PROJECTION_DERIVED_ALGORITHM_VERSION,
  ProjectionDerivedPersistenceError,
  persistProjectionGameDerivedV1,
  readProjectionGameInputManifest,
  type ProjectionDerivedPersistenceClient,
  type ProjectionGameInputManifest,
} from "./projectionDerivedPersistence";

const gameId = 2025020001;
const inputFingerprint = "a".repeat(64);
const manifest: ProjectionGameInputManifest = {
  gameId,
  inputFingerprint,
  inputVersion: 7,
};
const playerRows: ProjectionPlayerStrengthRow[] = [
  {
    game_id: gameId,
    player_id: 10,
    team_id: 1,
    opponent_team_id: 2,
    game_date: "2025-10-07",
    toi_es_seconds: 600,
    toi_pp_seconds: 0,
    toi_pk_seconds: 60,
    shots_es: 1,
    shots_pp: 0,
    shots_pk: 0,
    goals_es: 0,
    goals_pp: 0,
    goals_pk: 0,
    assists_es: 0,
    assists_pp: 0,
    assists_pk: 0,
    hits: null,
    blocks: null,
    pim: null,
    plus_minus: null,
  },
];
const teamRows: ProjectionTeamStrengthRow[] = [
  {
    game_id: gameId,
    team_id: 1,
    opponent_team_id: 2,
    game_date: "2025-10-07",
    toi_es_seconds: 600,
    toi_pp_seconds: 0,
    toi_pk_seconds: 60,
    shots_es: 1,
    shots_pp: 0,
    shots_pk: 0,
    goals_es: 0,
    goals_pp: 0,
    goals_pk: 0,
  },
  {
    game_id: gameId,
    team_id: 2,
    opponent_team_id: 1,
    game_date: "2025-10-07",
    toi_es_seconds: 600,
    toi_pp_seconds: 60,
    toi_pk_seconds: 0,
    shots_es: 0,
    shots_pp: 0,
    shots_pk: 0,
    goals_es: 0,
    goals_pp: 0,
    goals_pk: 0,
  },
];

function receipt(args: Record<string, unknown>, overrides = {}) {
  return {
    game_id: gameId,
    input_fingerprint: inputFingerprint,
    input_version: manifest.inputVersion,
    derived_status: "complete",
    derived_fingerprint: args.p_derived_fingerprint,
    derived_version: 4,
    algorithm_version: PROJECTION_DERIVED_ALGORITHM_VERSION,
    goalie_outcome: args.p_goalie_outcome,
    goalie_justification: args.p_goalie_justification,
    expected_player_rows: playerRows.length,
    observed_player_rows: playerRows.length,
    expected_team_rows: teamRows.length,
    observed_team_rows: teamRows.length,
    expected_goalie_rows: args.p_expected_goalie_rows,
    observed_goalie_rows: args.p_expected_goalie_rows,
    pruned_player_rows: 0,
    pruned_team_rows: 0,
    pruned_goalie_rows: 1,
    idempotent: false,
    completed_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function clientWithRpc(
  implementation: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>,
) {
  const deleteMock = vi.fn();
  const fromMock = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: deleteMock,
  }));
  return {
    client: {
      from: fromMock,
      rpc: vi.fn(implementation),
    } as unknown as ProjectionDerivedPersistenceClient,
    fromMock,
    deleteMock,
  };
}

describe("projection derived transactional persistence", () => {
  it("reads exactly one complete input manifest version", async () => {
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          game_id: gameId,
          input_status: "complete",
          input_fingerprint: inputFingerprint,
          input_version: 7,
          relationship_status: "complete",
          relationship_input_fingerprint: inputFingerprint,
          relationship_version: 3,
          relationship_algorithm_version: SHIFT_RELATIONSHIP_ALGORITHM_VERSION,
        },
        error: null,
      }),
    };
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    } as unknown as ProjectionDerivedPersistenceClient;
    await expect(
      readProjectionGameInputManifest({ gameId, client }),
    ).resolves.toEqual(manifest);
    expect(client.from).toHaveBeenCalledWith(
      "projection_game_materialization_status",
    );
    expect(query.eq).toHaveBeenCalledWith("game_id", gameId);
  });

  it("rejects a complete input while its required relationship generation is pending", async () => {
    const query: any = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          game_id: gameId,
          input_status: "complete",
          input_fingerprint: inputFingerprint,
          input_version: 7,
          relationship_status: "pending",
          relationship_input_fingerprint: null,
          relationship_version: 2,
          relationship_algorithm_version: null,
        },
        error: null,
      }),
    };
    const client = {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    } as unknown as ProjectionDerivedPersistenceClient;

    await expect(
      readProjectionGameInputManifest({ gameId, client }),
    ).rejects.toMatchObject({ phase: "input_manifest", gameId });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("sends an explicit empty goalie scope so the RPC prunes stale goalie rows", async () => {
    const { client, fromMock, deleteMock } = clientWithRpc(
      async (_functionName, args) => ({
        data: [receipt(args)],
        error: null,
      }),
    );
    const goalie: PreparedGoalieGameV2 = {
      rows: [],
      outcome: "not_observed",
      justification: "completed_pbp_contains_no_countable_shot_events",
      emptyNetEvents: 0,
    };

    const result = await persistProjectionGameDerivedV1({
      gameId,
      manifest,
      playerRows,
      teamRows,
      goalie,
      client,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "persist_projection_game_derived_v1",
      expect.objectContaining({
        p_expected_input_fingerprint: inputFingerprint,
        p_expected_input_version: manifest.inputVersion,
        p_algorithm_version: PROJECTION_DERIVED_ALGORITHM_VERSION,
        p_derived_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_goalie_rows: [],
        p_expected_goalie_rows: 0,
        p_goalie_outcome: "not_observed",
        p_goalie_justification:
          "completed_pbp_contains_no_countable_shot_events",
      }),
    );
    expect(result).toMatchObject({
      goalieOutcome: "not_observed",
      goalieJustification: "completed_pbp_contains_no_countable_shot_events",
      observedGoalieRows: 0,
      prunedGoalieRows: 1,
      verifiedRows: 3,
      upsertedRows: 3,
      prunedRows: 1,
      affectedRows: 4,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("fails closed on an RPC error and performs no client-side delete", async () => {
    const { client, deleteMock } = clientWithRpc(async () => ({
      data: null,
      error: { code: "XX000", message: "transaction failed" },
    }));
    await expect(
      persistProjectionGameDerivedV1({
        gameId,
        manifest,
        playerRows,
        teamRows,
        goalie: {
          rows: [],
          outcome: "not_observed",
          justification: "completed_pbp_contains_no_countable_shot_events",
          emptyNetEvents: 0,
        },
        client,
      }),
    ).rejects.toMatchObject({ phase: "persistence_rpc", gameId });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("surfaces the expected-input CAS rejection without accepting a receipt", async () => {
    const { client } = clientWithRpc(async () => ({
      data: null,
      error: {
        code: "P0001",
        message: "projection input fingerprint changed",
      },
    }));
    try {
      await persistProjectionGameDerivedV1({
        gameId,
        manifest,
        playerRows,
        teamRows,
        goalie: {
          rows: [],
          outcome: "not_observed",
          justification: "completed_pbp_contains_no_countable_shot_events",
          emptyNetEvents: 0,
        },
        client,
      });
      throw new Error("Expected input-version rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectionDerivedPersistenceError);
      expect(error).toMatchObject({ phase: "persistence_rpc", gameId });
    }
  });

  it("rejects a receipt from a different input version", async () => {
    const { client } = clientWithRpc(async (_functionName, args) => ({
      data: [receipt(args, { input_version: manifest.inputVersion + 1 })],
      error: null,
    }));
    await expect(
      persistProjectionGameDerivedV1({
        gameId,
        manifest,
        playerRows,
        teamRows,
        goalie: {
          rows: [],
          outcome: "not_observed",
          justification: "completed_pbp_contains_no_countable_shot_events",
          emptyNetEvents: 0,
        },
        client,
      }),
    ).rejects.toMatchObject({ phase: "receipt_validation", gameId });
  });

  it("separates an idempotent verification from logical writes", async () => {
    const { client } = clientWithRpc(async (_functionName, args) => ({
      data: [
        receipt(args, {
          idempotent: true,
          pruned_goalie_rows: 0,
        }),
      ],
      error: null,
    }));

    await expect(
      persistProjectionGameDerivedV1({
        gameId,
        manifest,
        playerRows,
        teamRows,
        goalie: {
          rows: [],
          outcome: "not_observed",
          justification: "completed_pbp_contains_no_countable_shot_events",
          emptyNetEvents: 0,
        },
        client,
      }),
    ).resolves.toMatchObject({
      idempotent: true,
      verifiedRows: 3,
      upsertedRows: 0,
      prunedRows: 0,
      affectedRows: 0,
    });
  });

  it("rejects a receipt without a valid completion timestamp", async () => {
    const { client } = clientWithRpc(async (_functionName, args) => ({
      data: [receipt(args, { completed_at: "not-a-timestamp" })],
      error: null,
    }));

    await expect(
      persistProjectionGameDerivedV1({
        gameId,
        manifest,
        playerRows,
        teamRows,
        goalie: {
          rows: [],
          outcome: "not_observed",
          justification: "completed_pbp_contains_no_countable_shot_events",
          emptyNetEvents: 0,
        },
        client,
      }),
    ).rejects.toMatchObject({ phase: "receipt_validation", gameId });
  });
});
