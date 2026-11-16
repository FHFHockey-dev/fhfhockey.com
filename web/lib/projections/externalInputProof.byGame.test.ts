// H3 (audit 2026-11-16): a selected_games rerun serves only its own games; the date's full-slate run serves the rest.
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: lookup.from } }));

import { forgeRunScopedGameIds, keepRowsOfServingRun, provenRunIdsByGame, requireLatestExternalInputProvenRun,
  requireLatestExternalInputProvenRunId, selectProvenRunsByGame, selectRunsByGame, type ExternalInputProof } from "./externalInputProof";
import { provenSnapshotRow, unprovenSnapshotRow } from "./externalInputProof.fixtures";

const PROOF = { basis: "captured_snapshot" } as ExternalInputProof;
const SLATE_GAMES = Array.from({ length: 11 }, (_, index) => 2026020300 + index);
const RERUN_GAME = 2026020308;
const slateRun = { run_id: "slate", execution_scope: { mode: "full_slate", requested_game_ids: [] }, scope_key: "h1:full" };
const rerun = { run_id: "rerun", execution_scope: { mode: "selected_games", requested_game_ids: [RERUN_GAME] }, scope_key: `h1:${RERUN_GAME}` };

describe("forgeRunScopedGameIds", () => {
  it.each([
    ["a full-slate run", { execution_scope: { mode: "full_slate", requested_game_ids: [] }, scope_key: "h1:full" }, null],
    ["a run that records no scope (older runs were all full)", {}, null],
    ["a selected_games run, from its execution scope", { execution_scope: { mode: "selected_games", requested_game_ids: [3, 1, 3] } }, [1, 3]],
    ["a selected_games run, from its resume scope key", { scope_key: "h1:2026020308,2026020301" }, [2026020301, 2026020308]],
    ["a selected_games run with no readable ids", { execution_scope: { mode: "selected_games" } }, []],
  ])("reads %s", (_label, row, expected) => {
    expect(forgeRunScopedGameIds(row)).toEqual(expected);
  });
});

describe("selectProvenRunsByGame", () => {
  it("keeps newer proven reruns over the newest proven slate run, and nothing older or unproven", () => {
    const rows = [
      { run_id: "unproven-rerun", scope_key: `h1:${SLATE_GAMES[0]}` },
      rerun,
      { run_id: "unproven-slate", scope_key: "h1:full" },
      slateRun,
      { run_id: "older-rerun", scope_key: `h1:${SLATE_GAMES[1]}` },
      { run_id: "older-slate", scope_key: "h1:full" },
    ];
    const proof = new Map(["rerun", "slate", "older-rerun", "older-slate"].map(id => [id, PROOF]));
    const selected = selectProvenRunsByGame(rows, proof);
    expect(selected).toEqual({ baseRunId: "slate", overlays: [{ runId: "rerun", proof: PROOF, gameIds: [RERUN_GAME] }] });
    expect(provenRunIdsByGame(selected)).toEqual(["slate", "rerun"]);
  });

  it("has no base when the date's only proven runs are reruns", () => {
    expect(selectRunsByGame([rerun, { run_id: "rerun-2", scope_key: "h1:1,2" }])).toEqual({ baseRunId: null,
      overlays: [{ runId: "rerun", gameIds: [RERUN_GAME] }, { runId: "rerun-2", gameIds: [1, 2] }] });
  });
});

describe("keepRowsOfServingRun", () => {
  const row = (runId: string, gameId: number, playerId: number) => ({ run_id: runId, game_id: gameId, player_id: playerId });
  // A full slate of 11 games, 36 skaters each (396 rows), and a rerun of one game with 36 rows, one player new.
  const slateRows = SLATE_GAMES.flatMap(gameId => Array.from({ length: 36 }, (_, index) => row("slate", gameId, gameId * 100 + index)));
  const rerunRows = [...Array.from({ length: 35 }, (_, index) => row("rerun", RERUN_GAME, RERUN_GAME * 100 + index)), row("rerun", RERUN_GAME, 1)];

  it("serves all 11 games: the rerun's game from the rerun only, every other game from the slate run", () => {
    const kept = keepRowsOfServingRun([...slateRows, ...rerunRows], { baseRunId: "slate", overlays: [{ runId: "rerun", gameIds: [RERUN_GAME] }] });
    expect(new Set(kept.map(r => r.game_id)).size).toBe(11);
    expect(kept).toHaveLength(10 * 36 + 36);
    expect(kept.filter(r => r.game_id === RERUN_GAME).every(r => r.run_id === "rerun")).toBe(true);
    // The slate run's line for the player the rerun dropped is not kept.
    expect(kept.some(r => r.player_id === RERUN_GAME * 100 + 35)).toBe(false);
  });

  it("keeps the slate run's rows for a game the rerun requested but wrote nothing for", () => {
    const kept = keepRowsOfServingRun([...slateRows, ...rerunRows],
      { baseRunId: "slate", overlays: [{ runId: "rerun", gameIds: [RERUN_GAME, SLATE_GAMES[0]] }] });
    expect(kept.filter(r => r.game_id === SLATE_GAMES[0]).every(r => r.run_id === "slate")).toBe(true);
    expect(kept.filter(r => r.game_id === SLATE_GAMES[0])).toHaveLength(36);
  });

  it("serves only a newer rerun's games when the date has no slate run, and only the base when there is no rerun", () => {
    expect(keepRowsOfServingRun([...slateRows, ...rerunRows], { baseRunId: null, overlays: [{ runId: "rerun", gameIds: [RERUN_GAME] }] }))
      .toEqual(rerunRows);
    expect(keepRowsOfServingRun([...slateRows, ...rerunRows], { baseRunId: "slate", overlays: [] })).toEqual(slateRows);
  });
});

describe("requireLatestExternalInputProvenRun with a slate run and a later selected_games run of the same date", () => {
  let runs: Array<Record<string, unknown>> = [];
  let snapshots: Array<Record<string, unknown>> = [];
  const selects: string[] = [];
  beforeEach(() => {
    selects.length = 0;
    lookup.from.mockReset().mockImplementation((table: string) => {
      if (table === "forge_runs") {
        const chain: any = { select: (columns: string) => { selects.push(columns); return chain; }, eq: () => chain, not: () => chain,
          or: () => chain, order: () => chain, limit: async () => ({ data: runs, error: null }) };
        return chain;
      }
      const chain: any = { select: () => chain, eq: () => chain,
        in: async (_column: string, ids: string[]) => ({ data: snapshots.filter(row => ids.includes(row.entity_key as string)), error: null }) };
      return chain;
    });
  });

  it("selects the slate run as the date's run, with the rerun serving its own game", async () => {
    runs = [rerun, slateRun]; snapshots = [provenSnapshotRow("rerun"), provenSnapshotRow("slate")];
    const selected = await requireLatestExternalInputProvenRun("2026-11-12");
    expect(selected.runId).toBe("slate");
    expect(selected.proof.basis).toBe("captured_snapshot");
    expect(selected.runsByGame).toMatchObject({ baseRunId: "slate", overlays: [{ runId: "rerun", gameIds: [RERUN_GAME] }] });
    expect(selects).toEqual(["run_id,execution_scope:metrics->execution_scope,scope_key:metrics->resume->>scope_key"]);
    expect(await requireLatestExternalInputProvenRunId("2026-11-12")).toBe("slate");
  });

  it("never selects an unproven rerun: its game stays with the proven slate run", async () => {
    runs = [rerun, slateRun]; snapshots = [unprovenSnapshotRow("rerun"), provenSnapshotRow("slate")];
    const selected = await requireLatestExternalInputProvenRun("2026-11-12");
    expect(selected).toMatchObject({ runId: "slate", runsByGame: { baseRunId: "slate", overlays: [] } });
  });

  it("keeps the 404 when neither run is proven", async () => {
    runs = [rerun, slateRun]; snapshots = [unprovenSnapshotRow("rerun"), unprovenSnapshotRow("slate")];
    await expect(requireLatestExternalInputProvenRun("2026-11-12")).rejects.toMatchObject({ statusCode: 404,
      details: { reason: "external_input_provenance_unproven", withheldRuns: 2 } });
  });
});
