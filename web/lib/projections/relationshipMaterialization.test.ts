import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

import {
  buildShiftRelationshipFingerprint,
  persistShiftChartRelationships,
  selectPendingRelationshipGameIds,
} from "./relationshipMaterialization";
import { buildShiftChartRelationshipUpsert } from "./shiftChartRelationshipPayload";

const GAME_ID = 2025020001;
const INPUT_FINGERPRINT = "1".repeat(64);
const PBP_SOURCE_HASH = "3".repeat(64);
const SHIFT_SOURCE_HASH = "2".repeat(64);

function relationshipRow(playerId: number) {
  return buildShiftChartRelationshipUpsert({
    game_id: GAME_ID,
    game_type: "2",
    game_date: "2025-10-07",
    season_id: 20252026,
    player_id: playerId,
    player_first_name: "Test",
    player_last_name: `Player ${playerId}`,
    team_id: 1,
    team_abbreviation: "AAA",
    home_or_away: "home",
    opponent_team_id: 2,
    opponent_team_abbreviation: "BBB",
    shifts: [
      {
        shift_number: 1,
        period: 1,
        start_time: "0:00",
        end_time: "0:30",
        duration: "0:30",
        playerId,
      },
    ],
    pp_shifts: [],
    es_shifts: [],
    game_toi: "0:30",
    game_length: "60:00",
    time_spent_with: {},
    percent_toi_with: {},
    time_spent_with_mixed: {},
    percent_toi_with_mixed: {},
    display_position: "C",
    primary_position: "C",
    player_type: "F",
    line_combination: 1,
    pairing_combination: null,
  });
}

describe("relationship materialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        input_fingerprint: INPUT_FINGERPRINT,
        input_status: "complete",
        input_version: 3,
        pbp_source_hash: PBP_SOURCE_HASH,
        shift_source_hash: SHIFT_SOURCE_HASH,
      },
      error: null,
    });
  });

  it("builds an order-independent player-scope fingerprint", () => {
    const first = relationshipRow(10);
    const second = relationshipRow(20);

    expect(
      buildShiftRelationshipFingerprint({
        inputFingerprint: INPUT_FINGERPRINT,
        rows: [first, second],
      }),
    ).toBe(
      buildShiftRelationshipFingerprint({
        inputFingerprint: INPUT_FINGERPRINT,
        rows: [second, first],
      }),
    );
  });

  it("selects only stale or incomplete relationships in deterministic game order", () => {
    expect(
      selectPendingRelationshipGameIds({
        games: [
          { id: 30, date: "2025-10-09" },
          { id: 10, date: "2025-10-07" },
          { id: 20, date: "2025-10-07" },
        ],
        statuses: [
          {
            game_id: 10,
            input_status: "complete",
            input_fingerprint: INPUT_FINGERPRINT,
            relationship_status: "complete",
            relationship_input_fingerprint: INPUT_FINGERPRINT,
            relationship_algorithm_version:
              "shift_relationship_materializer_v2_pbp_bound",
          },
          {
            game_id: 20,
            input_status: "complete",
            input_fingerprint: INPUT_FINGERPRINT,
            relationship_status: "pending",
            relationship_input_fingerprint: null,
            relationship_algorithm_version: null,
          },
          {
            game_id: 30,
            input_status: "complete",
            input_fingerprint: INPUT_FINGERPRINT,
            relationship_status: "complete",
            relationship_input_fingerprint: SHIFT_SOURCE_HASH,
            relationship_algorithm_version:
              "shift_relationship_materializer_v2_pbp_bound",
          },
        ],
        maxGames: 2,
      }),
    ).toEqual([20, 30]);
  });

  it("fails closed on duplicate queue status rows", () => {
    const status = {
      game_id: GAME_ID,
      input_status: "complete",
      input_fingerprint: INPUT_FINGERPRINT,
      relationship_status: "pending",
      relationship_input_fingerprint: null,
      relationship_algorithm_version: null,
    };
    expect(() =>
      selectPendingRelationshipGameIds({
        games: [{ id: GAME_ID, date: "2025-10-07" }],
        statuses: [status, status],
        maxGames: 1,
      }),
    ).toThrow("Invalid relationship queue status");
  });

  it("requeues a complete relationship produced by an older algorithm", () => {
    expect(
      selectPendingRelationshipGameIds({
        games: [{ id: GAME_ID, date: "2025-10-07" }],
        statuses: [
          {
            game_id: GAME_ID,
            input_status: "complete",
            input_fingerprint: INPUT_FINGERPRINT,
            relationship_status: "complete",
            relationship_input_fingerprint: INPUT_FINGERPRINT,
            relationship_algorithm_version:
              "shift_relationship_materializer_v1",
          },
        ],
        maxGames: 1,
      }),
    ).toEqual([GAME_ID]);
  });

  it("binds exact relationship replacement to the current input fingerprint", async () => {
    const rows = [relationshipRow(20), relationshipRow(10)];
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: [
        {
          game_id: GAME_ID,
          input_fingerprint: INPUT_FINGERPRINT,
          input_version: 3,
          relationship_status: "complete",
          relationship_fingerprint: args.p_relationship_fingerprint,
          relationship_version: 4,
          algorithm_version: args.p_algorithm_version,
          expected_rows: rows.length,
          observed_rows: rows.length,
          pruned_rows: 1,
          idempotent: false,
          completed_at: "2026-07-20T10:00:00.000Z",
        },
      ],
      error: null,
    }));

    await expect(
      persistShiftChartRelationships({
        gameId: GAME_ID,
        sourcePbpHash: PBP_SOURCE_HASH,
        sourceShiftHash: SHIFT_SOURCE_HASH,
        rows,
      }),
    ).resolves.toMatchObject({
      gameId: GAME_ID,
      inputFingerprint: INPUT_FINGERPRINT,
      inputVersion: 3,
      relationshipVersion: 4,
      relationshipRows: 2,
      prunedRows: 1,
      idempotent: false,
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "persist_shift_chart_relationships_v1",
      expect.objectContaining({
        p_expected_input_fingerprint: INPUT_FINGERPRINT,
        p_expected_input_version: 3,
        p_expected_rows: 2,
        p_game_id: GAME_ID,
        p_rows: [relationshipRow(10), relationshipRow(20)],
      }),
    );
  });

  it("rejects a source correction that has not entered the input manifest", async () => {
    await expect(
      persistShiftChartRelationships({
        gameId: GAME_ID,
        sourcePbpHash: PBP_SOURCE_HASH,
        sourceShiftHash: "4".repeat(64),
        rows: [relationshipRow(10)],
      }),
    ).rejects.toThrow(
      "Shift source fingerprint does not match projection inputs",
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a PBP correction that has not entered the input manifest", async () => {
    await expect(
      persistShiftChartRelationships({
        gameId: GAME_ID,
        sourcePbpHash: "4".repeat(64),
        sourceShiftHash: SHIFT_SOURCE_HASH,
        rows: [relationshipRow(10)],
      }),
    ).rejects.toThrow(
      "PBP source fingerprint does not match projection inputs",
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a receipt whose exact count does not match the request", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          game_id: GAME_ID,
          input_fingerprint: INPUT_FINGERPRINT,
          input_version: 3,
          relationship_status: "complete",
          relationship_fingerprint: "4".repeat(64),
          relationship_version: 1,
          algorithm_version: "shift_relationship_materializer_v1",
          expected_rows: 1,
          observed_rows: 0,
          pruned_rows: 0,
          idempotent: false,
          completed_at: "2026-07-20T10:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      persistShiftChartRelationships({
        gameId: GAME_ID,
        sourcePbpHash: PBP_SOURCE_HASH,
        sourceShiftHash: SHIFT_SOURCE_HASH,
        rows: [relationshipRow(10)],
      }),
    ).rejects.toThrow("Invalid relationship receipt");
  });
});
