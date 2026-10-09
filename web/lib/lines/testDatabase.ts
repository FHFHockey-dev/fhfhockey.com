import { vi } from "vitest";

/** Minimal PostgREST fixture query implementation for the actual service/processor paths. */
export function lineTestDatabase(seed: Record<string, any[]>) {
  const tables = structuredClone(seed);
  const writes: string[] = [];
  const from = vi.fn((table: string) => {
    let filters: Array<(row: any) => boolean> = [], orders: Array<{ key: string; ascending: boolean }> = [], start = 0, end = Infinity;
    const result = () => {
      const data = [...tables[table] ?? []].filter((row) => filters.every((test) => test(row)));
      data.sort((a, b) => {
        for (const { key, ascending } of orders) { const diff = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; if (diff) return ascending ? diff : -diff; } return 0;
      });
      return { data: data.slice(start, end + 1), error: null };
    };
    const q: any = {
      select: () => q,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return q; },
      lte: (key: string, value: any) => { filters.push((row) => row[key] <= value); return q; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return q; },
      or: (value: string) => { const choices = value.split(",").map((value) => value.split(".eq.")); filters.push((row) => choices.some(([key, value]) => String(row[key!]) === value)); return q; },
      order: (key: string, options?: { ascending?: boolean }) => { orders.push({ key, ascending: options?.ascending !== false }); return q; },
      range: (from: number, to: number) => { start = from; end = to; return q; },
      limit: (value: number) => { end = value - 1; return q; },
      then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
      upsert: async (rows: any[], options: { onConflict: string }) => {
        writes.push(table); tables[table] ??= [];
        if (table === "line_claim_relations" && rows.some((row) => !tables.line_claim_revisions?.some((claim) => claim.claim_id === row.claim_id)
          || !tables.line_claim_revisions?.some((claim) => claim.claim_id === row.target_claim_id))) {
          return { error: new Error("23503 line_claim_relations_target_claim_id_fkey") };
        }
        const keys = options.onConflict.split(",");
        for (const row of rows) if (!tables[table]!.some((existing) => keys.every((key) => existing[key] === row[key]))) tables[table]!.push(row);
        return { error: null };
      },
    }; return q;
  });
  const rpc = vi.fn(async (_name: string, args: any) => {
    writes.push("append_line_decisions");
    tables.line_entry_revisions ??= [];
    if (!tables.line_entry_revisions.some((row) => row.entry_id === args.p_entry.id)) tables.line_entry_revisions.push({ entry_id: args.p_entry.id, team_id: args.p_team_id, game_id: args.p_game_id, revision: args.p_entry.revision, payload: args.p_entry });
    tables.line_pp_decisions ??= [];
    for (const decision of args.p_pp) if (!tables.line_pp_decisions.some((row) => row.decision_id === decision.id)) tables.line_pp_decisions.push({ decision_id: decision.id, revision: decision.revision, unit_number: decision.unitNumber, team_id: decision.teamId, game_id: decision.gameId, payload: decision });
    return { data: true, error: null };
  });
  return { from, rpc, writes, tables };
}
