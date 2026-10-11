import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const { auditInsert } = vi.hoisted(() => ({ auditInsert: vi.fn() }));
vi.mock("lib/supabase/server", () => ({
  default: { from: vi.fn(() => ({ insert: auditInsert })) },
}));

import { withCronJobAudit } from "lib/cron/withCronJobAudit";

import {
  captureProjectionRawSourceSnapshots,
  hashProjectionRawJson,
} from "./rawSnapshotPersistence";
import {
  buildProjectionPbpSourceHash,
  buildProjectionShiftSourceHash,
} from "./projectionInputPersistence";

const GAME_ID = 2025020001;

const pbp = {
  id: GAME_ID,
  season: 20252026,
  gameType: 2,
  gameState: "OFF",
  gameDate: "2025-10-07",
  startTimeUTC: "2025-10-07T23:00:00Z",
  awayTeam: {
    id: 2,
    abbrev: "BBB",
    commonName: { default: "Away" },
    score: 1,
  },
  homeTeam: {
    id: 1,
    abbrev: "AAA",
    commonName: { default: "Home" },
    score: 2,
  },
  plays: [{ eventId: 1 }, { eventId: 2, typeDescKey: "game-end" }],
};

const shiftPayload = {
  total: 2,
  source: "json-api" as const,
  data: [
    {
      gameId: GAME_ID,
      playerId: 10,
      teamId: 1,
      teamAbbrev: "AAA",
      firstName: "Home",
      lastName: "Player",
      shiftNumber: 1,
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
    {
      gameId: GAME_ID,
      playerId: 20,
      teamId: 2,
      teamAbbrev: "BBB",
      firstName: "Away",
      lastName: "Player",
      shiftNumber: 1,
      period: 1,
      startTime: "0:00",
      endTime: "0:30",
      duration: "0:30",
      typeCode: 517,
    },
  ],
};

describe("projection raw snapshot persistence", () => {
  it("uses the existing immutable writer's exact JSON byte hash", () => {
    expect(hashProjectionRawJson(pbp)).toBe(
      createHash("sha256").update(JSON.stringify(pbp)).digest("hex"),
    );
    expect(hashProjectionRawJson({ b: 1, a: 2 })).not.toBe(
      hashProjectionRawJson({ a: 2, b: 1 }),
    );
    expect(hashProjectionRawJson(pbp)).not.toBe(
      buildProjectionPbpSourceHash(pbp),
    );
    expect(hashProjectionRawJson(shiftPayload)).not.toBe(
      buildProjectionShiftSourceHash(shiftPayload.data),
    );
  });

  it("captures both raw endpoints and validates exact current identities", async () => {
    const pbpHash = hashProjectionRawJson(pbp);
    const shiftHash = hashProjectionRawJson(shiftPayload);
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          game_id: GAME_ID,
          pbp_raw_payload_id: 101,
          pbp_raw_snapshot_version: 7,
          pbp_raw_payload_hash: pbpHash,
          shift_raw_payload_id: 102,
          shift_raw_snapshot_version: 9,
          shift_raw_payload_hash: shiftHash,
        },
      ],
      error: null,
    });

    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: { rpc } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload,
      }),
    ).resolves.toEqual({
      gameId: GAME_ID,
      pbp: { rawPayloadId: 101, snapshotVersion: 7, payloadHash: pbpHash },
      shifts: {
        rawPayloadId: 102,
        snapshotVersion: 9,
        payloadHash: shiftHash,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "capture_projection_raw_source_snapshots_v1",
      expect.objectContaining({
        p_game_id: GAME_ID,
        p_pbp_payload: pbp,
        p_pbp_payload_hash: pbpHash,
        p_shift_payload: shiftPayload,
        p_shift_payload_hash: shiftHash,
      }),
    );
  });

  it("fails closed on incomplete pagination or a stale/malformed receipt", async () => {
    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: { rpc: vi.fn() } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload: { ...shiftPayload, total: 3 },
      }),
    ).rejects.toThrow("incomplete");

    await expect(
      captureProjectionRawSourceSnapshots({
        supabase: {
          rpc: vi.fn().mockResolvedValue({
            data: [
              {
                game_id: GAME_ID,
                pbp_raw_payload_id: 101,
                pbp_raw_snapshot_version: 7,
                pbp_raw_payload_hash: "0".repeat(64),
                shift_raw_payload_id: 102,
                shift_raw_snapshot_version: 9,
                shift_raw_payload_hash: "1".repeat(64),
              },
            ],
            error: null,
          }),
        } as any,
        gameId: GAME_ID,
        pbp,
        shiftPayload,
      }),
    ).rejects.toThrow("invalid PBP identity");
  });
});

type RawPayload = Parameters<typeof captureProjectionRawSourceSnapshots>[0]["shiftPayload"];
const ROW_ERROR = "INVALID_PROJECTION_RAW_SHIFT_ROWS";

async function rejectedWitness(rows: Record<string, unknown>[], thrown = false) {
  const payload = { source: "json-api", total: rows.length, data: rows } as RawPayload;
  const before = JSON.stringify(payload);
  const rpc = thrown
    ? vi.fn().mockRejectedValue(new Error(ROW_ERROR))
    : vi.fn().mockResolvedValue({ data: null, error: { message: ROW_ERROR } });
  let message = "";
  try {
    await captureProjectionRawSourceSnapshots({ supabase: { rpc } as any, gameId: GAME_ID, pbp, shiftPayload: payload });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[0][1].p_shift_payload).toBe(payload);
  expect(JSON.stringify(payload)).toBe(before);
  expect(message.startsWith(`${ROW_ERROR} `)).toBe(true);
  // The natural ingest receipt copies Error.message into its JSON errors array.
  const receipt = JSON.parse(JSON.stringify({ errors: [{ stage: "capture_raw_sources", message }] }));
  const witness = JSON.parse(receipt.errors[0].message.slice(ROW_ERROR.length + 1));
  expect(witness.envelopeHash).toBe(hashProjectionRawJson(payload));
  return { witness, message };
}

describe("SQL rejection witnesses", () => {
  it("compares typed tuples rather than provider IDs or arbitrary metadata", async () => {
    const { witness } = await rejectedWitness([
      { ...shiftPayload.data[0], id: 101 },
      { ...shiftPayload.data[0], id: 102, playerId: "0010", teamId: "1", period: "01", shiftNumber: "1", typeCode: "517", firstName: "private metadata" },
    ]);
    expect(witness).toMatchObject({ rawRows: 2, distinctTypedRows: 1, offendingRows: 1, witnesses: [{ ordinal: 2, providerId: 102, duplicateOfOrdinal: 1, reasons: ["duplicate_typed_tuple"] }] });
  });

  it("reports nonpositive IDs even on non-interval records", async () => {
    const { witness } = await rejectedWitness([{ ...shiftPayload.data[0], id: 103, typeCode: 505, playerId: 0, teamId: -1 }]);
    expect(witness.witnesses[0].reasons).toEqual(["playerId_nonpositive", "teamId_nonpositive"]);
  });

  it.each(["playerId", "teamId", "shiftNumber", "period", "startTime", "endTime", "typeCode"])("reports missing and null %s", async (field) => {
    const missing: Record<string, unknown> = { ...shiftPayload.data[0], id: 104 };
    delete missing[field];
    for (const row of [missing, { ...missing, [field]: null }]) {
      const { witness } = await rejectedWitness([row]);
      expect(witness.witnesses[0].reasons).toContain(`${field}_null`);
      expect(witness.distinctTypedRows).toBe(1);
    }
  });

  it("bounds witnesses and never includes provider metadata or unsafe IDs", async () => {
    const { witness, message } = await rejectedWitness(Array.from({ length: 200 }, () => ({ ...shiftPayload.data[0], id: "SECRET-ID", firstName: "SECRET-METADATA".repeat(1000) })));
    expect(witness).toMatchObject({ rawRows: 200, distinctTypedRows: 1, offendingRows: 199, truncated: true });
    expect(witness.witnesses).toHaveLength(3);
    expect(witness.witnesses.every((row: { providerId: unknown }) => row.providerId === null)).toBe(true);
    expect(message.length).toBeLessThan(1500);
    expect(message).not.toContain("SECRET");
  });

  it("enriches thrown RPC rejections and preserves unrelated errors", async () => {
    const { witness } = await rejectedWitness([{ ...shiftPayload.data[0], period: -1, shiftNumber: -1 }], true);
    expect(witness.witnesses[0].reasons).toEqual(["shiftNumber_negative", "period_negative"]);
    const original = new Error("transport failed");
    await expect(captureProjectionRawSourceSnapshots({ supabase: { rpc: vi.fn().mockRejectedValue(original) } as any, gameId: GAME_ID, pbp, shiftPayload })).rejects.toBe(original);
  });

  it("keeps unsupported text casts unresolved instead of guessing", async () => {
    const { witness } = await rejectedWitness([{ ...shiftPayload.data[0], duration: { arbitrary: "private" } }]);
    expect(witness.distinctTypedRows).toBeNull();
    expect(witness.typedProjectionComplete).toBe(false);
    expect(witness.witnesses[0].reasons).toEqual(["duration_typed_projection_unresolved"]);
  });


  it("keeps SQL's nullable duration and zero-valued shift/period/type semantics", async () => {
    const { duration: _duration, ...withoutDuration } = shiftPayload.data[0];
    const base = { ...withoutDuration, shiftNumber: 0, period: 0, typeCode: 0 };
    const { witness } = await rejectedWitness([
      { ...base, id: 201 }, { ...base, id: 202, duration: null }, { ...base, id: 203, duration: "" },
    ]);
    expect(witness).toMatchObject({ distinctTypedRows: 2, offendingRows: 1 });
    expect(witness.witnesses[0]).toMatchObject({ ordinal: 2, duplicateOfOrdinal: 1, reasons: ["duplicate_typed_tuple"] });
  });

  it("compares supported SQL text casts as typed text", async () => {
    const { witness } = await rejectedWitness([
      { ...shiftPayload.data[0], startTime: 0, endTime: false, id: 301 },
      { ...shiftPayload.data[0], startTime: "0", endTime: "false", id: 302 },
    ]);
    expect(witness).toMatchObject({ distinctTypedRows: 1, typedProjectionComplete: true });
    expect(witness.witnesses[0].reasons).toEqual(["duplicate_typed_tuple"]);
  });

  it("bounds a witness with every required predicate failing", async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({ gameId: GAME_ID, id: Number.MAX_SAFE_INTEGER - index }));
    const { witness, message } = await rejectedWitness(rows);
    expect(witness.witnesses).toHaveLength(3);
    expect(message.length).toBeLessThan(1500);
    expect(JSON.stringify({ errors: [{ message }] }).length).toBeLessThan(2000);
  });


  it("retains the safe witness through the actual audit response-message path", async () => {
    const { message } = await rejectedWitness([{ ...shiftPayload.data[0], playerId: 0 }]);
    auditInsert.mockReset().mockResolvedValue({ error: null });
    const handler = withCronJobAudit(async (_req, res) => {
      try { throw new Error(message); }
      catch (error) {
        res.status(200).json({ success: false, failedRows: 1, errors: [{ gameId: GAME_ID, stage: "capture_raw_sources", message: (error as Error).message }] });
      }
    }, { jobName: "synthetic-raw-capture" });
    const res = {
      statusCode: 200, headersSent: false, body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; this.headersSent = true; return this; },
    };
    await handler({ method: "GET", url: "/synthetic-only" }, res);
    expect(auditInsert).toHaveBeenCalledTimes(1);
    const stored = auditInsert.mock.calls[0][0].details.response;
    expect(stored.length).toBeLessThan(4000);
    expect(JSON.parse(stored).errors[0].message).toBe(message);
    expect((res.body as { errors: { message: string }[] }).errors[0].message).toBe(message);
  });

  it("accepts equal physical intervals with distinct shift numbers and preserves RPC bytes", async () => {
    const payload = { ...shiftPayload, data: [{ ...shiftPayload.data[0], id: 105 }, { ...shiftPayload.data[0], id: 106, shiftNumber: 2, duration: { deliberately: "unsupported local text cast" }, extra: { private: "metadata" } }] } as unknown as RawPayload;
    const before = JSON.stringify(payload);
    const rpc = vi.fn().mockResolvedValue({ data: [{ game_id: GAME_ID, pbp_raw_payload_id: 101, pbp_raw_snapshot_version: 7, pbp_raw_payload_hash: hashProjectionRawJson(pbp), shift_raw_payload_id: 102, shift_raw_snapshot_version: 9, shift_raw_payload_hash: hashProjectionRawJson(payload) }], error: null });
    await expect(captureProjectionRawSourceSnapshots({ supabase: { rpc } as any, gameId: GAME_ID, pbp, shiftPayload: payload })).resolves.toMatchObject({ gameId: GAME_ID });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_shift_payload).toBe(payload);
    expect(JSON.stringify(payload)).toBe(before);
  });
});
