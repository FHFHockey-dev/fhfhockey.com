import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const getSession = vi.hoisted(() => vi.fn()); const onAuthStateChange = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession, onAuthStateChange } } }));
import { useSavedDrafts } from "./useSavedDrafts";

const rows = [{ player: "A" }, { player: "B" }]; const bytes = new TextEncoder().encode(JSON.stringify(rows)); const hash = createHash("sha256").update(bytes).digest("hex");
const snapshot: any = { settings: {}, picks: [], keepers: [], trades: [], team: {}, sourceWeights: {}, importMappings: [], favorites: [], notes: [], tiers: {}, recommendationPreferences: {} };
const imported = { name: "My CSV", sourceId: "custom_csv_1", mapping: [{ original: "Player", standardized: "name", selected: true }], rows };
const detail = { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "2026-01-01", snapshot, privateImports: [{ id: "import", name: "My CSV", mapping: { sourceId: "custom_csv_1", headers: imported.mapping } }] };
function json(data: unknown, ok = true, status = 200) { return { ok, status, headers: new Headers(), json: async () => data }; }
function binary(part: Uint8Array, ordinal: number) { const split = Math.ceil(bytes.length / 2); return { ok: true, headers: new Headers({ "X-Draft-Pro-Total-Chunks": "2", "X-Draft-Pro-Total-Bytes": String(bytes.byteLength), "X-Draft-Pro-SHA256": hash, "X-Draft-Pro-Row-Count": "2" }), arrayBuffer: async () => part.slice(ordinal ? split : 0, ordinal ? part.length : split).buffer }; }

describe("useSavedDrafts", () => {
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token" } } }); onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("reassembles a two-chunk private import into bookmark-compatible source data", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("?ordinal=") ? binary(bytes, Number(url.at(-1))) : json({ data: url.endsWith("/draft") ? detail : [] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.open("draft"); });
    expect(result.current.opened?.privateImports[0]).toMatchObject({ id: "import", sourceId: "custom_csv_1", name: "My CSV", mapping: imported.mapping, rows });
  });
  it("uploads normalized rows in bounded chunks, stages them, then commits the same attempt key", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "/api/v1/account/draft-pro/drafts") return Promise.resolve(json({ data: init?.method === "POST" ? { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "now" } : [] }, true, init?.method === "POST" ? 201 : 200));
      if (url === "/api/v1/account/draft-pro/private-imports") return Promise.resolve(json({ data: { status: "ready", upload: { upload_id: "upload-1", storage_prefix: "prefix" } } }, true, 201));
      if (url.includes("/chunks/")) return Promise.resolve(json({ data: { path: "prefix/0" } }, true, 201));
      if (url.endsWith("/stage")) return Promise.resolve(json({ data: { importId: "upload-1" } }, true, 201));
      if (url.endsWith("/draft")) return Promise.resolve(json({ data: detail }));
      throw new Error(`Unexpected ${url}`);
    }));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: true, privateImports: [imported] }); });
    const begin = calls.find((call) => call.url === "/api/v1/account/draft-pro/private-imports")!; const commit = calls.find((call) => call.url === "/api/v1/account/draft-pro/drafts" && call.init?.method === "POST")!;
    const beginBody = JSON.parse(String(begin.init?.body)); const commitBody = JSON.parse(String(commit.init?.body));
    expect(beginBody).toMatchObject({ attemptKey: expect.any(String), mapping: { sourceId: "custom_csv_1", headers: imported.mapping } });
    expect(commitBody).toMatchObject({ attemptKey: beginBody.attemptKey, importIds: [] }); expect(JSON.stringify(commitBody)).not.toContain("player");
    const uploadCall = calls.find((call) => call.url.includes("/chunks/"))!; expect(new Uint8Array(uploadCall.init?.body as Uint8Array).byteLength).toBeLessThanOrEqual(750 * 1024);
    expect(result.current.opened?.id).toBe("draft");
  });
  it("keeps local hook state and exposes a persistent error when private upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => Promise.resolve(url === "/api/v1/account/draft-pro/drafts" && !init?.method ? json({ data: [] }) : url === "/api/v1/account/draft-pro/private-imports" ? json({ error: { message: "quota" } }, false, 400) : json({ data: [] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await expect(result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: true, privateImports: [imported] })).rejects.toThrow("quota"); });
    expect(result.current.opened).toBeNull(); expect(result.current.status).toBe("error"); expect(result.current.error).toBe("quota");
  });
  it("surfaces a final save conflict with reload/save-as state", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => Promise.resolve(url === "/api/v1/account/draft-pro/drafts" && !init?.method ? json({ data: [] }) : url === "/api/v1/account/draft-pro/drafts/draft" ? json({ data: { current: { id: "draft", name: "Elsewhere", status: "active", lockVersion: 2, updatedAt: "now" } } }, false, 409) : json({ data: [] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await expect(result.current.saveNow("draft", { name: "Draft", snapshot, expectedVersion: 1, accountSaveConsent: true })).rejects.toThrow("changed elsewhere"); });
    expect(result.current.conflict?.current?.lockVersion).toBe(2); expect(result.current.status).toBe("error");
  });
  it("does not start an upload without explicit consent", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ data: [] }))); vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSavedDrafts()); await expect(result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: false, privateImports: [imported] })).rejects.toThrow("Confirm saving");
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/v1/account/draft-pro/private-imports");
  });
  it("cancels a pending open when the auth identity changes", async () => {
    let resolve!: (value: unknown) => void; const pending = new Promise((done) => { resolve = done; }); vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/draft") ? pending : Promise.resolve(json({ data: [] }))));
    const { result } = renderHook(() => useSavedDrafts()); const opening = result.current.open("draft"); (onAuthStateChange.mock.calls[0][0] as () => void)(); resolve(json({ data: { ...detail, privateImports: [] } })); await expect(opening).rejects.toThrow("cancelled");
  });
});
