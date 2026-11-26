import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Game 2026020399 replayed through the real route, shift ingest, HTML report
// parser, corroboration rule and Gamecenter normalizer. Only the database is
// simulated: raw snapshots keyed by hash, the shared shiftcharts head (advanced
// only by a new insert, which marks the normalization stale), the v2
// normalizer's canonical-head check and the projection input writer.

const FIXTURE_DIR = join(__dirname, "../../../../../lib/projections/ingest/__fixtures__/2026020399");
const fixture = (name: string) => readFileSync(join(FIXTURE_DIR, name), "utf8");
const G0399 = 2026020399;
const PHANTOM_ID = 16944566;
const DACCORD = 8478916;

const db = vi.hoisted(() => ({
  raw: new Map<string, { id: number; payload: unknown }>(),
  head: null as null | { rawPayloadId: number; payloadHash: string; snapshotVersion: number },
  normalization: { status: "complete", shiftPayloadHash: "" },
  shiftRows: [] as Array<Record<string, any>>,
  inputs: null as null | Record<string, any>,
  nextId: 157_000,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("lib/cron/nhlOffSeason", () => ({ withNhlOffSeasonSkip: (handler: any) => handler }));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: vi.fn((table: string) => {
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn(() => query),
        range: vi.fn(async () => ({
          data: table === "games" ? [{ id: G0399, date: "2026-11-25" }] : [],
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({
          data: table === "nhl_api_game_normalization_status"
            ? { status: db.normalization.status }
            : null,
          error: null,
        })),
        insert: vi.fn(async () => ({ error: null })),
      };
      return query;
    }),
  },
}));

vi.mock("lib/projections/pbpCompletenessServer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/projections/pbpCompletenessServer")>()),
  hasCompleteStoredPbpGame: vi.fn(async () => db.inputs !== null),
}));

vi.mock("lib/projections/shiftChartCompletenessServer", () => ({
  classifyStoredShiftChartStrengthGame: vi.fn(async () => ({
    status: db.inputs ? "complete" : "missing",
  })),
}));

vi.mock("lib/projections/projectionPipelineState", () => ({
  acquireProjectionPipelineLease: vi.fn(),
  advanceProjectionPipelineLease: vi.fn(),
  buildProjectionPipelineOperationKey: vi.fn(),
  finishProjectionPipelineLease: vi.fn(),
  PROJECTION_INPUT_PIPELINE_KEY: "projection_input_ingest",
  readOldestProjectionPipelineBacklog: vi.fn(async () => null),
}));

/** Inserts a payload unless its hash exists; only a new insert moves the head. */
function captureShiftSnapshot(hash: string, payload: unknown) {
  if (!db.raw.has(hash)) {
    db.raw.set(hash, { id: (db.nextId += 1), payload });
    db.head = {
      rawPayloadId: db.raw.get(hash)!.id,
      payloadHash: hash,
      snapshotVersion: (db.head?.snapshotVersion ?? 0) + 1,
    };
    if (db.normalization.status === "complete") db.normalization.status = "stale";
  }
  return db.raw.get(hash)!;
}

vi.mock("lib/projections/ingest/rawSnapshotPersistence", async () => {
  const actual = await vi.importActual<typeof import("lib/projections/ingest/rawSnapshotPersistence")>(
    "lib/projections/ingest/rawSnapshotPersistence",
  );
  return {
    ...actual,
    captureProjectionRawSourceSnapshots: vi.fn(async (args: any) => {
      const payload = args.shiftPayload;
      // capture_projection_raw_source_snapshots_v1's shift envelope checks.
      if (!["json-api", "htmlreports"].includes(payload.source) || payload.total !== payload.data.length) {
        throw new Error("INVALID_PROJECTION_RAW_SHIFT_PAYLOAD");
      }
      const hash = actual.hashProjectionRawJson(payload);
      captureShiftSnapshot(hash, JSON.parse(JSON.stringify(payload)));
      if (db.head!.payloadHash !== hash) throw new Error("PROJECTION_RAW_SNAPSHOT_NOT_CURRENT");
      return {
        gameId: args.gameId,
        pbp: { rawPayloadId: 1, snapshotVersion: 1, payloadHash: actual.hashProjectionRawJson(args.pbp) },
        shifts: { rawPayloadId: db.head!.rawPayloadId, snapshotVersion: db.head!.snapshotVersion, payloadHash: hash },
      };
    }),
  };
});

vi.mock("lib/projections/ingest/projectionInputPersistence", async () => {
  const actual = await vi.importActual<typeof import("lib/projections/ingest/projectionInputPersistence")>(
    "lib/projections/ingest/projectionInputPersistence",
  );
  return {
    ...actual,
    readProjectionInputManifest: vi.fn(async () => null),
    persistProjectionGameInputs: vi.fn(async ({ payload }: any) => {
      db.inputs = payload;
      return {
        playCount: payload.playRows.length,
        strengthCount: payload.strengthRows.length,
        prunedPlayRows: 0,
        prunedStrengthRows: 0,
        idempotent: false,
      };
    }),
  };
});

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", async () => {
  const actual = await vi.importActual<typeof import("lib/supabase/Upserts/nhlRawGamecenter.mjs")>(
    "lib/supabase/Upserts/nhlRawGamecenter.mjs",
  );
  return {
    ...actual,
    // persist_nhl_api_gamecenter_normalized_v2: the expected hash must be the
    // head's, and the incoming shift ids must be the head data's canonical ids.
    persistCapturedGameNormalization: vi.fn(async (_supabase: unknown, args: any) => {
      if (args.shiftPayloadHash !== db.head?.payloadHash) {
        throw new Error("NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH");
      }
      const rows = actual.normalizeShiftRows(args.pbp, args.shiftPayload, args.shiftPayloadHash);
      const headPayload = db.raw.get(args.shiftPayloadHash)!.payload as Parameters<typeof actual.selectShiftRowsForGame>[1];
      const canonical = actual.selectShiftRowsForGame(args.pbp, headPayload).map((row: any) => row.id);
      if (JSON.stringify(rows.map((row) => row.shift_id)) !== JSON.stringify(canonical)) {
        throw new Error("NHL_NORMALIZATION_SHIFT_HEAD_MISMATCH");
      }
      db.shiftRows = rows;
      db.normalization = { status: "complete", shiftPayloadHash: args.shiftPayloadHash };
      return { idempotent: false };
    }),
  };
});

import { normalizeShiftRows } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import { fetchNhlApiRawGamePayloads } from "lib/supabase/Upserts/nhlRawGamecenter.mjs";
import { hashProjectionRawJson } from "lib/projections/ingest/rawSnapshotPersistence";

import handler from "../../../../../pages/api/v1/db/ingest-projection-inputs";

function stubNhl() {
  const pbp = JSON.parse(fixture("pbp.json"));
  const box = JSON.parse(fixture("box.json"));
  const shifts = JSON.parse(fixture("shifts.json"));
  const json = (body: unknown) => ({
    ok: true, status: 200, statusText: "OK",
    json: async () => body, text: async () => JSON.stringify(body),
  });
  const text = (body: string) => ({ ok: true, status: 200, statusText: "OK", text: async () => body });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("shiftcharts")) return json(shifts);
    if (url.endsWith(`/gamecenter/${G0399}/play-by-play`)) return json(pbp);
    if (url.endsWith(`/gamecenter/${G0399}/boxscore`)) return json(box);
    if (url.endsWith(`/gamecenter/${G0399}/landing`)) return json({ gameState: pbp.gameState });
    if (url.endsWith("/TV020399.HTM")) return text(fixture("TV.htm"));
    if (url.endsWith("/TH020399.HTM")) return text(fixture("TH.htm"));
    throw new Error(`Unexpected URL: ${url}`);
  }) as unknown as typeof fetch);
  return { pbp, shifts };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    headersSent: false,
    setHeader() {},
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; this.headersSent = true; return this; },
  };
  return res;
}

describe("ingest-projection-inputs recovers game 2026020399 from today's stored state", () => {
  beforeEach(() => {
    db.raw.clear();
    db.head = null;
    db.inputs = null;
    db.nextId = 157_000;
    // Today: the 09:35 Gamecenter writer stored the plain JSON feed (H1) as the
    // head and normalized all 761 rows, phantom included.
    const { pbp, shifts } = stubNhl();
    const h1Payload = { ...shifts, source: "json-api" };
    const h1 = hashProjectionRawJson(h1Payload);
    captureShiftSnapshot(h1, h1Payload);
    db.shiftRows = normalizeShiftRows(pbp, h1Payload, h1);
    db.normalization = { status: "complete", shiftPayloadHash: h1 };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stores the corroborated htmlreports head, re-normalizes to the corrected rows and writes the inputs", async () => {
    const h1 = db.head!.payloadHash;
    expect(db.shiftRows).toHaveLength(761);
    expect(db.shiftRows.some((row) => row.shift_id === PHANTOM_ID)).toBe(true);

    const res = createMockRes();
    await handler({ method: "POST", query: { startDate: "2026-11-25", endDate: "2026-11-25" }, body: {} } as any, res);

    expect(res.body).toMatchObject({ success: true, gamesProcessed: 1, errors: [] });
    expect(res.body.shiftCorroborations).toEqual([
      expect.objectContaining({
        gameId: G0399,
        rule: "shift-clock-mismatch-covered-and-officially-corroborated/v1",
        excluded: [expect.objectContaining({ id: PHANTOM_ID, playerId: DACCORD, coveredByIds: [16944565] })],
      }),
    ]);

    // The head is now the corroborated HTML report, keeping the verbatim JSON.
    const head = db.raw.get(db.head!.payloadHash)!.payload as any;
    expect(db.head!.payloadHash).not.toBe(h1);
    expect(db.head!.snapshotVersion).toBe(2);
    expect(head.source).toBe("htmlreports");
    expect(head.upstream.json.total).toBe(761);
    expect(head.corroboration.excluded.map((row: any) => row.id)).toEqual([PHANTOM_ID]);

    // nhl_api_shift_rows was replaced from that head: no phantom, and Daccord
    // has one P1 shift, 0-1200 s, and 3407 s in all (his boxscore 56:47).
    expect(db.normalization).toEqual({ status: "complete", shiftPayloadHash: db.head!.payloadHash });
    expect(db.shiftRows).toHaveLength(756);
    const daccord = db.shiftRows.filter((row) => row.player_id === DACCORD);
    expect(daccord.filter((row) => row.period === 1).map((row) => [row.start_seconds, row.end_seconds])).toEqual([[0, 1200]]);
    expect(daccord.reduce((total, row) => total + row.duration_seconds, 0)).toBe(3407);

    // The projection inputs were written from the same head.
    expect(db.inputs!.rawSnapshots.shifts.payloadHash).toBe(db.head!.payloadHash);
    expect(db.inputs!.strengthRows).toHaveLength(38);
  });

  it("leaves the head unchanged when the Gamecenter writer re-captures the game afterwards", async () => {
    await handler({ method: "POST", query: { startDate: "2026-11-25", endDate: "2026-11-25" }, body: {} } as any, createMockRes());
    const head = { ...db.head! };

    const gamecenter = await fetchNhlApiRawGamePayloads(G0399, { retries: 1, retryDelayMs: 0, timeoutMs: 50 });
    captureShiftSnapshot(gamecenter.hashes.shiftcharts, gamecenter.payloads.shiftcharts);

    expect(gamecenter.hashes.shiftcharts).toBe(head.payloadHash);
    expect(db.head).toEqual(head);
    expect(db.normalization.status).toBe("complete");
  });
});
