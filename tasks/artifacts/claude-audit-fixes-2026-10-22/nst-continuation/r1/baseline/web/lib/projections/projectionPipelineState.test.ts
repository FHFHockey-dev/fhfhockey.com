import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  in: vi.fn(),
  like: vi.fn(),
  limit: vi.fn(),
  lte: vi.fn(),
  maybeSingle: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

import {
  acquireProjectionPipelineLease,
  advanceProjectionPipelineLease,
  buildProjectionPipelineOperationKey,
  finishProjectionPipelineLease,
  readOldestProjectionPipelineBacklog,
  type ProjectionPipelineLease,
} from "./projectionPipelineState";

const supabase = {
  from: mocks.from,
  rpc: mocks.rpc,
} as any;

function stateRow(overrides: Record<string, unknown> = {}) {
  return {
    pipeline_key: "projection_input_ingest",
    scope_key: "completed_game_slates",
    operation_key: "canonical:2026-07-19:2026-07-19",
    revision: 1,
    status: "running",
    cursor_game_id: null,
    cursor_date: "2026-07-19",
    range_start_date: "2026-07-19",
    range_end_date: "2026-07-19",
    lease_owner: "00000000-0000-4000-8000-000000000001",
    lease_expires_at: "2026-07-20T10:10:00.000Z",
    last_error: null,
    updated_at: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("projection pipeline durable state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      eq: mocks.eq,
      in: mocks.in,
      like: mocks.like,
      limit: mocks.limit,
      lte: mocks.lte,
      maybeSingle: mocks.maybeSingle,
      order: mocks.order,
    };
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue(chain);
    mocks.eq.mockReturnValue(chain);
    mocks.in.mockReturnValue(chain);
    mocks.like.mockReturnValue(chain);
    mocks.limit.mockReturnValue(chain);
    mocks.lte.mockReturnValue(chain);
    mocks.order.mockReturnValue(chain);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("builds a bounded operation identity from range and mode", () => {
    expect(
      buildProjectionPipelineOperationKey({
        startDate: "2026-07-19",
        endDate: "2026-07-20",
        force: false,
      }),
    ).toBe("canonical:2026-07-19:2026-07-20");
  });

  it("selects the oldest unfinished canonical slate through the scheduled date", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: stateRow({
        status: "failed",
        lease_owner: null,
        lease_expires_at: null,
        last_error: "projection_input_failed",
      }),
      error: null,
    });

    await expect(
      readOldestProjectionPipelineBacklog({
        supabase,
        throughDate: "2026-07-20",
      }),
    ).resolves.toEqual({
      operationKey: "canonical:2026-07-19:2026-07-19",
      rangeStartDate: "2026-07-19",
      rangeEndDate: "2026-07-19",
      cursorDate: "2026-07-19",
      cursorGameId: null,
      status: "failed",
    });
    expect(mocks.in).toHaveBeenCalledWith("status", ["running", "failed"]);
    expect(mocks.like).toHaveBeenCalledWith("operation_key", "canonical:%");
    expect(mocks.lte).toHaveBeenCalledWith("range_end_date", "2026-07-20");
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("acquires an absent operation with revision zero and a bounded lease", async () => {
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: [
        stateRow({
          revision: 1,
          cursor_date: args.p_next_cursor_date,
          lease_owner: args.p_lease_owner,
          lease_expires_at: String(args.p_lease_expires_at).replace(
            ".000Z",
            "+00:00",
          ),
        }),
      ],
      error: null,
    }));

    const lease = await acquireProjectionPipelineLease({
      supabase,
      operationKey: "canonical:2026-07-19:2026-07-19",
      rangeStartDate: "2026-07-19",
      rangeEndDate: "2026-07-19",
      initialCursorDate: "2026-07-19",
      now: new Date("2026-07-20T10:00:00.000Z"),
    });

    expect(lease).toMatchObject({
      revision: 1,
      status: "running",
      cursorDate: "2026-07-19",
      leaseOwner: expect.any(String),
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "advance_projection_pipeline_state_v1",
      expect.objectContaining({
        p_expected_revision: 0,
        p_transition: "acquire",
        p_next_status: "running",
        p_lease_expires_at: "2026-07-20T10:10:00.000Z",
        p_lease_owner: lease.leaseOwner,
      }),
    );
  });

  it("resumes the exact failed cursor and compare-and-swaps its revision", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: stateRow({
        revision: 7,
        status: "failed",
        cursor_game_id: 2025020999,
        cursor_date: "2026-07-19",
        lease_owner: null,
        lease_expires_at: null,
        last_error: "projection_input_failed",
      }),
      error: null,
    });
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: [
        stateRow({
          revision: 8,
          cursor_game_id: args.p_next_cursor_game_id,
          cursor_date: args.p_next_cursor_date,
          lease_owner: args.p_lease_owner,
          lease_expires_at: args.p_lease_expires_at,
        }),
      ],
      error: null,
    }));

    const lease = await acquireProjectionPipelineLease({
      supabase,
      operationKey: "canonical:2026-07-19:2026-07-19",
      rangeStartDate: "2026-07-19",
      rangeEndDate: "2026-07-19",
      initialCursorDate: "2026-07-19",
      now: new Date("2026-07-20T10:00:00.000Z"),
    });

    expect(lease.cursorGameId).toBe(2025020999);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "advance_projection_pipeline_state_v1",
      expect.objectContaining({
        p_expected_revision: 7,
        p_next_cursor_game_id: 2025020999,
      }),
    );
  });

  it("returns an already-complete operation without resetting its cursor", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: stateRow({
        revision: 9,
        status: "complete",
        cursor_game_id: 2025020999,
        cursor_date: "2026-07-19",
        lease_owner: null,
        lease_expires_at: null,
      }),
      error: null,
    });

    await expect(
      acquireProjectionPipelineLease({
        supabase,
        operationKey: "canonical:2026-07-19:2026-07-19",
        rangeStartDate: "2026-07-19",
        rangeEndDate: "2026-07-19",
        initialCursorDate: "2026-07-19",
      }),
    ).resolves.toMatchObject({
      revision: 9,
      status: "complete",
      cursorGameId: 2025020999,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the same key boundaries as the SQL contract", async () => {
    mocks.rpc.mockImplementation(async (_name, args) => ({
      data: [
        stateRow({
          scope_key: args.p_scope_key,
          revision: 1,
          cursor_date: args.p_next_cursor_date,
          lease_owner: args.p_lease_owner,
          lease_expires_at: args.p_lease_expires_at,
        }),
      ],
      error: null,
    }));
    await expect(
      acquireProjectionPipelineLease({
        supabase,
        pipelineKey: "invalid.pipeline",
        operationKey: "canonical:2026-07-19:2026-07-19",
        rangeStartDate: "2026-07-19",
        rangeEndDate: "2026-07-19",
        initialCursorDate: "2026-07-19",
      }),
    ).rejects.toThrow("Invalid pipeline key");
    await expect(
      acquireProjectionPipelineLease({
        supabase,
        scopeKey: "Completed/Slate+1",
        operationKey: "canonical:2026-07-19:2026-07-19",
        rangeStartDate: "2026-07-19",
        rangeEndDate: "2026-07-19",
        initialCursorDate: "2026-07-19",
      }),
    ).resolves.toMatchObject({ status: "running" });
  });

  it("advances then completes only from the current active lease", async () => {
    const lease = {
      pipelineKey: "projection_input_ingest",
      scopeKey: "completed_game_slates",
      operationKey: "canonical:2026-07-19:2026-07-19",
      revision: 3,
      status: "running",
      cursorGameId: 2025020001,
      cursorDate: "2026-07-19",
      rangeStartDate: "2026-07-19",
      rangeEndDate: "2026-07-19",
      leaseOwner: "00000000-0000-4000-8000-000000000001",
      leaseExpiresAt: "2026-07-20T10:10:00.000Z",
      lastError: null,
      updatedAt: "2026-07-20T10:00:00.000Z",
    } satisfies ProjectionPipelineLease;
    mocks.rpc
      .mockImplementationOnce(async (_name, args) => ({
        data: [
          stateRow({
            revision: 4,
            cursor_game_id: args.p_next_cursor_game_id,
            cursor_date: args.p_next_cursor_date,
            lease_owner: args.p_lease_owner,
            lease_expires_at: args.p_lease_expires_at,
          }),
        ],
        error: null,
      }))
      .mockImplementationOnce(async (_name, args) => ({
        data: [
          stateRow({
            revision: 5,
            status: "complete",
            cursor_game_id: args.p_next_cursor_game_id,
            cursor_date: args.p_next_cursor_date,
            lease_owner: null,
            lease_expires_at: null,
            last_error: args.p_last_error,
          }),
        ],
        error: null,
      }));

    const advanced = await advanceProjectionPipelineLease({
      supabase,
      lease,
      nextCursorDate: "2026-07-19",
      nextCursorGameId: 2025020002,
      now: new Date("2026-07-20T10:01:00.000Z"),
    });
    await expect(
      finishProjectionPipelineLease({
        supabase,
        lease: advanced,
        outcome: "complete",
      }),
    ).resolves.toMatchObject({ revision: 5, status: "complete" });

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_expected_revision: 3,
      p_transition: "advance",
      p_next_cursor_game_id: 2025020002,
    });
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({
      p_expected_revision: 4,
      p_transition: "complete",
      p_next_status: "complete",
    });
  });
});
