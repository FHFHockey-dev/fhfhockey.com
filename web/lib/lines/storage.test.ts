import { describe, expect, it, vi } from "vitest";
import { appendLineEvidence, persistLineReconciliation } from "./storage";
import { fixtureClaim, fixtureGame, fixtureNow } from "./testFixtures";
import { lineTestDatabase } from "./testDatabase";

describe("append-only persistence", () => {
  it("writes captures before interpretations and never updates or deletes existing rows", async () => {
    const calls: Array<{ table: string; rows: any[]; options: unknown }> = [];
    const db = { from: (table: string) => ({ upsert: async (rows: any[], options: unknown) => { calls.push({ table, rows, options }); return { error: null }; } }) };
    await appendLineEvidence(db, [fixtureClaim()], [fixtureGame]);
    expect(calls.map((call) => call.table)).toEqual(["line_source_captures", "line_claim_revisions", "line_game_state_observations"]);
    expect(calls.every((call) => (call.options as any).ignoreDuplicates === true)).toBe(true);
    expect(calls[0]!.rows[0]!.payload.text).toContain("Kucherv");
  });
  it("propagates storage errors and cannot partially select uncaptured evidence", async () => {
    const from = vi.fn(() => ({ upsert: async () => ({ error: new Error("capture rejected") }) }));
    await expect(appendLineEvidence({ from }, [fixtureClaim()], [fixtureGame])).rejects.toThrow("capture rejected");
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("keeps unresolved targets in immutable history without aborting state capture or reconciliation", async () => {
    const db = lineTestDatabase({});
    const claim = fixtureClaim("unresolved-correction", { kind: "entry_correction", supersedes: ["missing-target"], relationAuthority: "original_author",
      reviewReasons: ["relation_target_unresolved:missing-target"] });
    await appendLineEvidence(db, [claim], [fixtureGame]);
    await persistLineReconciliation(db, { game: fixtureGame, teamId: 14, games: [fixtureGame], now: fixtureNow, carryForward: true });
    expect(db.tables.line_claim_revisions![0]!.payload).toEqual(claim);
    expect(db.tables.line_claim_relations ?? []).toHaveLength(0);
    expect(db.tables.line_game_state_observations).toHaveLength(1);
    expect(db.tables.line_entry_revisions![0]!.payload.units).toHaveLength(0);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    // The fixture enforces the same target FK instead of accepting invalid inserts.
    const invalid = await db.from("line_claim_relations").upsert([{ claim_id: claim.id, target_claim_id: "missing-target", kind: "supersedes", authority: "original_author" }], { onConflict: "claim_id,target_claim_id,kind" });
    expect(invalid.error?.message).toContain("23503");
  });
  it.each(["supersedes", "retracts"] as const)("delayed %s targets require a new reviewed interpretation, preserving retries and authority", async (kind) => {
    const db = lineTestDatabase({});
    const target = fixtureClaim("delayed-target");
    const unresolved = fixtureClaim("attempt", { kind: kind === "supersedes" ? "entry_correction" : "retraction",
      [kind]: [target.id], relationAuthority: "none", reviewReasons: [`relation_target_unresolved:${target.id}`] });
    await appendLineEvidence(db, [unresolved], [fixtureGame]);
    await appendLineEvidence(db, [target], []);
    // Even changed input under an existing ID cannot rewrite the original review/authority.
    const revisedInput = { ...unresolved, relationAuthority: "original_author" as const, reviewReasons: [] };
    await appendLineEvidence(db, [revisedInput], [fixtureGame]);
    await appendLineEvidence(db, [revisedInput], [fixtureGame]);
    expect(db.tables.line_claim_relations ?? []).toHaveLength(0);
    expect(db.tables.line_claim_revisions!.find((row) => row.claim_id === unresolved.id)!.payload).toEqual(unresolved);
    const reviewed = { ...revisedInput, id: "reviewed-attempt", version: "fixture:reviewed:2" };
    await appendLineEvidence(db, [reviewed], [fixtureGame]);
    await appendLineEvidence(db, [reviewed], [fixtureGame]);
    expect(db.tables.line_claim_revisions).toHaveLength(3);
    expect(db.tables.line_source_captures).toHaveLength(2);
    expect(db.tables.line_game_state_observations).toHaveLength(1);
    expect(db.tables.line_claim_relations).toEqual([{ claim_id: reviewed.id, target_claim_id: target.id, kind, authority: "original_author" }]);
  });
  it("skips a missing target even when an upstream review marker is absent", async () => {
    const db = lineTestDatabase({});
    const claim = fixtureClaim("unmarked-attempt", { kind: "entry_correction", supersedes: ["missing"], relationAuthority: "original_author" });
    await appendLineEvidence(db, [claim], [fixtureGame]);
    expect(db.tables.line_claim_revisions![0]!.payload.supersedes).toEqual(["missing"]);
    expect(db.tables.line_claim_relations ?? []).toHaveLength(0);
    expect(db.tables.line_game_state_observations).toHaveLength(1);
  });
  it("resolves valid same-batch links independent of order and rejects unauthorized, cross-scope and self links", async () => {
    const db = lineTestDatabase({});
    const target = fixtureClaim("target");
    const valid = fixtureClaim("valid", { kind: "entry_correction", supersedes: [target.id], relationAuthority: "original_author" });
    const wrongAuthor = { ...valid, id: "wrong-author", author: "relay" };
    const wrongGame = { ...valid, id: "wrong-game", gameId: 999 };
    const wrongUnit = { ...valid, id: "wrong-unit", unit: { ...valid.unit!, number: 2 } };
    const self = { ...valid, id: "self", supersedes: ["self"] };
    await appendLineEvidence(db, [valid, wrongAuthor, wrongGame, wrongUnit, self, target], [fixtureGame]);
    await appendLineEvidence(db, [valid], [fixtureGame]);
    expect(db.tables.line_claim_relations).toEqual([{ claim_id: valid.id, target_claim_id: target.id, kind: "supersedes", authority: "original_author" }]);
    expect(db.tables.line_claim_revisions).toHaveLength(6);
  });
  it("retries a racing writer only after re-reading the current decisions", async () => {
    let reads = 0;
    const db = { from: (table: string) => {
      const q: any = { select: () => q, in: () => q, lte: () => q, order: () => q, eq: () => q, range: async () => ({ data: table === "line_claim_revisions" ? [{ payload: fixtureClaim() }] : [], error: null }), limit: async () => { reads++; return { data: [], error: null }; } }; return q;
    }, rpc: vi.fn().mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: true, error: null }) };
    const result = await persistLineReconciliation(db, { game: fixtureGame, teamId: 14, games: [fixtureGame], now: fixtureNow, carryForward: true });
    expect(result.entry.status).toBe("frozen"); expect(reads).toBe(2); expect(db.rpc).toHaveBeenCalledTimes(2);
  });
});
