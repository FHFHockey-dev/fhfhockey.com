import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  players: [] as Array<Record<string, any>>,
  payloads: [] as any[][],
  receiptOverride: null as Record<string, unknown> | null,
  failAtBatch: 0,
  rateLimitAtBatch: 0,
  providerBatches: 0,
  providerErrorStatus: 429,
  providerFailureAt: 0,
  sheet: vi.fn(),
  provider: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const result = { data: state.players.map(p => ({ player_key: p.player_key })), count: 0, error: null };
      const query: any = {
        select: () => query, eq: () => query, not: () => query, order: () => query,
        range: async (from: number, to: number) => ({ ...result, data: result.data.slice(from, to + 1) }),
        maybeSingle: async () => ({ data: { game_id: 477, game_key: "477", season: 2026 }, error: null }),
        then: (resolve: (value: any) => unknown) => Promise.resolve(table === "yahoo_player_keys" ? result : { count: 1, error: null }).then(resolve),
      };
      return query;
    },
    rpc: async (name: string, args: any) => {
      if (name === "replace_yahoo_player_keys_snapshot") return { data: {
        snapshotId: args.p_snapshot_id, gameId: 477, sourceCount: args.p_players.length,
        added: 0, reactivated: 0, changed: 0, deactivated: 0, replayed: false,
      }, error: null };
      if (name !== "upsert_yahoo_players_atomic") throw new Error("Unexpected RPC");
      state.payloads.push(args.players_data);
      return { data: state.receiptOverride ?? (state.failAtBatch === state.payloads.length ? {
        processed: args.players_data.length, ownershipHistoryUpserted: 0, ownershipOmitted: 0, draftHistoryUpserted: 0,
      } : {
        processed: args.players_data.length,
        ownershipHistoryUpserted: args.players_data.filter((p: any) => p.percent_ownership !== null).length,
        ownershipOmitted: args.players_data.filter((p: any) => p.percent_ownership === null).length,
        draftHistoryUpserted: 0,
      }), error: null };
    },
  }),
}));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/integrations/yahoo/ingestionLifecycle", async importOriginal => ({
  ...await importOriginal<typeof import("lib/integrations/yahoo/ingestionLifecycle")>(),
  fetchYahooPublicJson: (...args: any[]) => state.provider(...args),
  withYahooRetry: (work: () => unknown) => work(),
  prepareYahooGameWeekSnapshot: () => ({ game: { game_id: 477, game_key: "477", season: 2026 }, weeks: [] }),
  fetchCompleteYahooPlayerKeySnapshot: async () => ({
    players: state.players.map(p => ({ player_key: p.player_key, player_id: 1, player_name: "Fixture" })), pagesFetched: 1,
  }),
  requestYahooSheetExport: (...args: any[]) => state.sheet(...args),
}));

import handler from "../../../../../pages/api/v1/db/update-yahoo-players";

const player = (key: string, ownership: unknown) => ({ player_key: key, name: { full: "Fixture" }, percent_owned: ownership });
async function run() {
  const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; } };
  const work = handler({ method: "GET", query: {} } as any, res);
  await vi.runAllTimersAsync(); await work; return res;
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T08:40:00Z"));
  state.players = []; state.payloads = []; state.receiptOverride = null; state.failAtBatch = 0; state.rateLimitAtBatch = 0; state.providerBatches = 0; state.providerErrorStatus = 429; state.providerFailureAt = 0;
  state.provider.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith("game/")) return {};
    state.providerBatches += 1;
    if (state.providerBatches === state.rateLimitAtBatch) {
      state.providerFailureAt = Date.now();
      throw { status: state.providerErrorStatus, response: { status: state.providerErrorStatus,
        headers: new Headers(state.providerErrorStatus === 429 ? { "Retry-After": "120" } : {}) } };
    }
    const keys = path.split("player_keys=")[1].split(";")[0].split(",").map(decodeURIComponent);
    return { fantasy_content: { players: state.players.filter(player => keys.includes(player.player_key)).map(player => ({ player })) } };
  });
  state.sheet.mockReset().mockResolvedValue({ attempted: true, succeeded: true, statusCode: 200, reason: null });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Yahoo ownership source-to-receipt health", () => {
  it("keeps the captured missing-value shapes unknown, preserves an explicit zero and returns partial", async () => {
    // The first three shapes come from the retained Oct29 three-player source
    // comparison. The fourth is an explicit-zero control, not an imputation.
    state.players = [
      player("477.p.30000", { coverage_type: "week", week: 5, delta: "0" }),
      player("477.p.30024", { coverage_type: "week", week: 5, value: 10, delta: "-2" }),
      player("477.p.30106", { coverage_type: "week", week: 5, delta: "0" }),
      player("477.p.99999", { coverage_type: "week", week: 5, value: 0 }),
    ];
    const res = await run();
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: false, status: "partial", completeSnapshot: false,
      succeeded: 4, ownershipHistoryUpserted: 2, ownershipOmitted: 2, providerOmitted: 0,
      ownershipDiagnostics: { observed: 2, explicitZero: 1, unavailable: 2, omissionReasons: { missing_value: 2 } } });
    expect(state.payloads.flat().map(p => p.percent_ownership)).toEqual([null, 10, null, 0]);
    expect(state.payloads.flat().map(p => p.snapshot_status)).toEqual(["omitted", "observed", "omitted", "observed"]);
    expect(state.sheet).not.toHaveBeenCalled();
    expect(state.provider).toHaveBeenCalledTimes(2); // game metadata + one player batch; no omission retry
  });

  it("allows a complete explicit-zero snapshot and the receipt-gated export", async () => {
    state.players = [player("477.p.1", { value: 0 }), player("477.p.2", [{ value: "37.5" }])];
    const res = await run();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, completeSnapshot: true, ownershipHistoryUpserted: 2, ownershipOmitted: 0,
      ownershipDiagnostics: { observed: 2, explicitZero: 1, unavailable: 0 } });
    expect(state.sheet).toHaveBeenCalledTimes(1);
  });

  it("does not turn malformed or explicit-null ownership into zero", async () => {
    state.players = [player("477.p.1", { value: false }), player("477.p.2", { value: null }), player("477.p.3", undefined)];
    const res = await run();
    expect(res.statusCode).toBe(207);
    expect(state.payloads.flat().map(p => p.percent_ownership)).toEqual([null, null, null]);
    expect(res.body.ownershipDiagnostics).toMatchObject({ observed: 0, explicitZero: 0, unavailable: 3,
      omissionReasons: { invalid_value: 1, null_value: 1, missing_percentage: 1 } });
    expect(state.sheet).not.toHaveBeenCalled();
  });

  it("rejects an inconsistent ownership receipt without claiming a complete snapshot or exporting", async () => {
    state.players = [player("477.p.1", { value: 0 })];
    state.receiptOverride = { processed: 1, ownershipHistoryUpserted: 0, ownershipOmitted: 0, draftHistoryUpserted: 0 };
    const res = await run();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, requiresReview: true, retrySafe: false,
      persistenceAcknowledgement: { state: "unverified", acknowledgedPlayerRows: 0, unverifiedPlayerRows: 1 } });
    expect(state.sheet).not.toHaveBeenCalled();
  });
  it("reports the1606/1027 omission pattern as incomplete with bounded diagnostics and acknowledged counts", async () => {
    state.players = Array.from({ length: 1606 }, (_, index) => player(`477.p.${50000 + index}`,
      index < 579 ? { value: index === 0 ? 0 : 10 } : { coverage_type: "week", week: 5, delta: "0" }));
    const res = await run();
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: false, status: "partial", sourceRows: 1606, succeeded: 1606,
      ownershipHistoryUpserted: 579, ownershipOmitted: 1027, completeSnapshot: false,
      ownershipDiagnostics: { observed: 579, explicitZero: 1, unavailable: 1027, omissionReasons: { missing_value: 1027 } } });
    expect(res.body.ownershipDiagnostics.samples).toHaveLength(5);
    expect(state.payloads).toHaveLength(4);
    expect(state.provider).toHaveBeenCalledTimes(66); // one metadata +65planned batches, no recovery sweep
    expect(state.sheet).not.toHaveBeenCalled();
  });

  it("retains the acknowledged prefix when a later batch receipt is unverified", async () => {
    state.players = Array.from({ length: 501 }, (_, index) => player(`477.p.${60000 + index}`, { value: 0 }));
    state.failAtBatch = 2;
    const res = await run();
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, requiresReview: true, retrySafe: false,
      persistenceAcknowledgement: { state: "unverified", acknowledgedPlayerRows: 500,
        ownershipHistoryUpserted: 500, ownershipOmitted: 0, unverifiedPlayerRows: 1 } });
    expect(state.payloads).toHaveLength(2);
    expect(state.sheet).not.toHaveBeenCalled();
  });

  it.each([1, 2])("stops new batches after429 at batch%s and preserves any known prefix", async atBatch => {
    state.players = Array.from({ length: 51 }, (_, index) => player(`477.p.${70000 + index}`, { value: 0 }));
    state.rateLimitAtBatch = atBatch;
    const res = await run();
    const known = (atBatch - 1) * 25;
    expect(state.provider).toHaveBeenCalledTimes(1 + atBatch);
    expect(res.body).toMatchObject({ success: false, completeSnapshot: false, sourceRows: 51,
      processed: atBatch * 25, succeeded: known, failedRows: 25, deferredRows: 51 - atBatch * 25,
      ownershipHistoryUpserted: known, rateLimitEvents: 1, retryNotBefore: new Date(state.providerFailureAt + 120000).toISOString() });
    expect(state.payloads.flat()).toHaveLength(known);
    expect(state.sheet).not.toHaveBeenCalled();
  });

  it("stops remaining keys after an access/token failure instead of trying another batch", async () => {
    state.players = Array.from({ length: 51 }, (_, index) => player(`477.p.${80000 + index}`, { value: 0 }));
    state.rateLimitAtBatch = 1; state.providerErrorStatus = 401;
    const res = await run();
    expect(state.provider).toHaveBeenCalledTimes(2);
    expect(res.body).toMatchObject({ success: false, errorCategory: "token_failure", sourceRows: 51,
      processed: 25, failedRows: 25, deferredRows: 26, retryNotBefore: null });
    expect(state.payloads).toHaveLength(0);
    expect(state.sheet).not.toHaveBeenCalled();
  });

});
