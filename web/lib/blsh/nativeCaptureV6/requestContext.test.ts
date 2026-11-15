// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { qualifyCurrentInputs } from "lib/buyLowSellHigh/currentInput";
import { buildRequestFromContextV1, REQUEST_CONTEXT_COLUMNS, type RequestContextResult } from "./requestContext";

const REPO = resolve(__dirname, "../../../..");
const READER = resolve(REPO, "tasks/artifacts/blsh-request-reader-20261111");
// The fixture is the function's own output on the disposable database (supabase/tests/blsh_capture_v6.py --write-fixture).
const fixture = (): RequestContextResult => JSON.parse(readFileSync(resolve(__dirname, "__fixtures__/request-context-v1.sample.json"), "utf8"));
// The request reader's exact-key contract, loaded read-only from its own (untracked) folder when present.
const READER_PRESENT = existsSync(resolve(READER, "export_context.cjs")) && existsSync(resolve(READER, "COLUMNS.json"));
const checkRequestShape = (request: unknown) => (createRequire(__filename)(resolve(READER, "export_context.cjs")) as { checkRequestShape: (value: unknown) => void }).checkRequestShape(request);
const CAPTURED = "2026-11-20T12:40:05.000Z";

describe("request/context v1 builder", () => {
  it.skipIf(!READER_PRESENT)("uses the reader's COLUMNS.json verbatim", () => {
    expect(JSON.parse(readFileSync(resolve(READER, "COLUMNS.json"), "utf8"))).toEqual(REQUEST_CONTEXT_COLUMNS);
  });

  it("builds a request that passes the reader's exact-key contract and the real qualifyCurrentInputs", () => {
    const built = buildRequestFromContextV1(fixture(), { capturedAtUTC: CAPTURED });
    if (READER_PRESENT) expect(() => checkRequestShape(built.request)).not.toThrow();
    else console.warn("reader folder absent: export_context checkRequestShape not run");
    expect(built.request).toMatchObject({ seasonId: 20262027, eventThroughDate: "2026-11-19", asOfUTC: CAPTURED, captureContext: "definer_function_request_context_v1" });
    expect(built.rows).toEqual({ wgo: 3, individual: 3, onIce: 3, calendar: 2 }); // 8473 has NST rows only on another date
    const qualified = qualifyCurrentInputs(built.request as never);
    expect(qualified.records.length).toBe(3);
    for (const feed of ["wgo", "individual", "onIce", "calendar"]) {
      const raw = built.rawFiles[`RAW-${feed}.json`];
      expect((built.request[feed] as { capture: { sha256: string } }).capture.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(raw.toString("utf8").endsWith("\n")).toBe(true);
    }
  });

  it("refuses the reader's failure cases: added keys, out-of-scope rows, > 8 linked rows, cross-join and conflicting duplicates", () => {
    const mutate = (change: (value: RequestContextResult) => void) => { const value = fixture(); change(value); return () => buildRequestFromContextV1(value, { capturedAtUTC: CAPTURED }); };
    expect(mutate(v => { v.keySeal.ids = [...v.keySeal.ids, 999]; v.keySeal.rows++; })).toThrow("missing_or_added_sealed_key");
    expect(mutate(v => { (v.rows[0] as unknown[][])[0][4] = "2026-11-20"; })).toThrow("wgo_out_of_scope");
    expect(mutate(v => { const linked = (v.rows[0] as unknown[][])[1]; for (let i = 0; i < 8; i++) linked.push([900 + i, 8471, 20262027, "2026-11-18", 1, 1, 0, 0, 0]); })).toThrow("linked_row_bound");
    expect(mutate(v => { ((v.rows[0] as unknown[][])[1][0] as unknown[])[1] = 1; })).toThrow("process_join_scope");
    expect(mutate(v => { ((v.rows[0] as unknown[][])[3][0] as unknown[])[0] = 2026020302; })).toThrow("calendar_join_scope");
    expect(mutate(v => { ((v.rows[2] as unknown[][])[3][0] as unknown[])[3] = 3; })).toThrow("same_id_different_values");
    expect(mutate(v => { v.columnsSHA256 = "0".repeat(64); })).toThrow("column_contract_changed");
    expect(() => buildRequestFromContextV1(fixture(), { capturedAtUTC: "2026-11-20T12:39:00.000Z" })).toThrow("capture_before_snapshot");
  });
});
