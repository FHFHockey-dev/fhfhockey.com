import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const getSession = vi.hoisted(() => vi.fn()); const onAuthStateChange = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange } } }));
import { useSavedDrafts } from "./useSavedDrafts";

const body = new TextEncoder().encode(JSON.stringify([{ player: "A" }, { player: "B" }]));
const hash = createHash("sha256").update(body).digest("hex");
const detail = { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "2026-01-01", snapshot: {}, privateImports: [{ id: "import" }] };
function binary(bytes: Uint8Array, ordinal: number) { return { ok: true, headers: new Headers({ "X-Draft-Pro-Total-Chunks": "2", "X-Draft-Pro-Total-Bytes": String(body.byteLength), "X-Draft-Pro-SHA256": hash, "X-Draft-Pro-Row-Count": "2" }), arrayBuffer: async () => bytes.slice(ordinal ? Math.ceil(body.length / 2) : 0, ordinal ? body.length : Math.ceil(body.length / 2)).buffer }; }
describe("useSavedDrafts restore", () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token" } } }); onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("reassembles a two-chunk private import", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("?ordinal=") ? binary(body, Number(url.at(-1))) : { ok: true, json: async () => ({ data: url.endsWith("/draft") ? detail : [] }) })));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.open("draft"); });
    expect((result.current.opened?.privateImports[0] as any).rows).toEqual([{ player: "A" }, { player: "B" }]);
  });
  it("fails closed when an import chunk is missing", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("?ordinal=") ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ data: url.endsWith("/draft") ? detail : [] }) })));
    const { result } = renderHook(() => useSavedDrafts()); await expect(result.current.open("draft")).rejects.toThrow("unavailable");
    expect(result.current.opened).toBeNull();
  });
});
