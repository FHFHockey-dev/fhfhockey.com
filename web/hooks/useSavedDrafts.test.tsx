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
  beforeEach(() => { getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "user-1" } } } }); onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }); });
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
    const fetchMock = vi.fn((..._args: Parameters<typeof fetch>) => Promise.resolve(json({ data: [] }))); vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSavedDrafts()); await expect(result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: false, privateImports: [imported] })).rejects.toThrow("Confirm saving");
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/v1/account/draft-pro/private-imports");
  });
  it("retains an unchanged opened import without requiring consent or uploading it again", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { calls.push({ url, init }); if (url.includes("?ordinal=")) return Promise.resolve(binary(bytes, Number(url.at(-1)))); if (url.endsWith("/draft")) return Promise.resolve(json({ data: detail })); if (url === "/api/v1/account/draft-pro/drafts/draft") return Promise.resolve(json({ data: { ...detail, lockVersion: 2 } })); return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { const loaded = await result.current.open("draft"); await result.current.saveNow("draft", { name: "Draft", snapshot, accountSaveConsent: false, privateImports: loaded.privateImports }); });
    expect(calls.some((call) => call.url === "/api/v1/account/draft-pro/private-imports")).toBe(false);
    const commit = calls.find((call) => call.url === "/api/v1/account/draft-pro/drafts/draft" && call.init?.method === "PUT"); expect(JSON.parse(String(commit?.init?.body)).importIds).toEqual(["import"]);
  });
  it("uses the latest lock version for queued saves", async () => {
    const versions: number[] = []; let detailVersion = 1;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { if (url.includes("?ordinal=")) return Promise.resolve(binary(bytes, Number(url.at(-1)))); if (url.endsWith("/draft") && init?.method !== "PUT") return Promise.resolve(json({ data: { ...detail, lockVersion: detailVersion } })); if (url === "/api/v1/account/draft-pro/drafts/draft") { versions.push(JSON.parse(String(init?.body)).expectedVersion); detailVersion += 1; return Promise.resolve(json({ data: { id: "draft", name: "Draft", status: "active", lockVersion: detailVersion, updatedAt: "now" } })); } return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { const loaded = await result.current.open("draft"); await Promise.all([result.current.saveNow("draft", { name: "Draft", snapshot, accountSaveConsent: false, privateImports: loaded.privateImports }), result.current.saveNow("draft", { name: "Draft", snapshot, accountSaveConsent: false, privateImports: loaded.privateImports })]); });
    expect(versions).toEqual([1, 2]);
  });
  it("verifies a recovered staged upload without sending its chunks again", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { calls.push(url); if (url === "/api/v1/account/draft-pro/private-imports") return Promise.resolve(json({ data: { status: "ready", upload: { upload_id: "upload-1", storage_prefix: "prefix", status: "staged" } } }, true, 201)); if (url.endsWith("/stage")) return Promise.resolve(json({ data: { importId: "upload-1" } }, true, 201)); if (url === "/api/v1/account/draft-pro/drafts" && init?.method === "POST") return Promise.resolve(json({ data: { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "now" } }, true, 201)); if (url.endsWith("/draft")) return Promise.resolve(json({ data: detail })); return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: true, privateImports: [imported] }); });
    expect(calls.some((url) => url.includes("/chunks/"))).toBe(false); expect(calls.some((url) => url.endsWith("/stage"))).toBe(true);
  });
  it("recovers a lost begin response with the same attempt key and no duplicate chunks", async () => {
    const bodies: any[] = []; let begins = 0;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { if (url === "/api/v1/account/draft-pro/private-imports") { bodies.push(JSON.parse(String(init?.body))); begins += 1; return begins === 1 ? Promise.reject(new Error("lost")) : Promise.resolve(json({ data: { status: "ready", upload: { upload_id: "u", storage_prefix: "p", status: "staged" } } }, true, 201)); } if (url.endsWith("/stage")) return Promise.resolve(json({ data: { importId: "u" } }, true, 201)); if (url === "/api/v1/account/draft-pro/drafts" && init?.method === "POST") return Promise.resolve(json({ data: { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "now" } }, true, 201)); if (url.endsWith("/draft")) return Promise.resolve(json({ data: detail })); return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); const options = { name: "Draft", snapshot, accountSaveConsent: true, privateImports: [imported] }; await expect(result.current.saveNow(null, options)).rejects.toThrow("lost"); await act(async () => { await result.current.saveNow(null, options); });
    expect(bodies).toHaveLength(2); expect(bodies[1].attemptKey).toBe(bodies[0].attemptKey);
  });
  it("recovers a lost stage response without uploading chunks twice", async () => {
    const bodies: any[] = []; let stages = 0; let begins = 0; let chunks = 0;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { if (url === "/api/v1/account/draft-pro/private-imports") { bodies.push(JSON.parse(String(init?.body))); begins += 1; return Promise.resolve(json({ data: { status: "ready", upload: { upload_id: "u", storage_prefix: "p", status: begins === 1 ? "uploading" : "staged" } } }, true, 201)); } if (url.includes("/chunks/")) { chunks += 1; return Promise.resolve(json({ data: { path: "p/0" } }, true, 201)); } if (url.endsWith("/stage")) { stages += 1; return stages === 1 ? Promise.reject(new Error("lost stage")) : Promise.resolve(json({ data: { importId: "u" } }, true, 201)); } if (url === "/api/v1/account/draft-pro/drafts" && init?.method === "POST") return Promise.resolve(json({ data: { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "now" } }, true, 201)); if (url.endsWith("/draft")) return Promise.resolve(json({ data: detail })); return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); const options = { name: "Draft", snapshot, accountSaveConsent: true, privateImports: [imported] }; await expect(result.current.saveNow(null, options)).rejects.toThrow("lost stage"); await act(async () => { await result.current.saveNow(null, options); });
    expect(bodies[1].attemptKey).toBe(bodies[0].attemptKey); expect(chunks).toBe(1);
  });
  it("does not let a stale save replace a newly opened draft", async () => {
    let resolveSave!: (value: unknown) => void; const pendingSave = new Promise((resolve) => { resolveSave = resolve; });
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { if (url === "/api/v1/account/draft-pro/drafts" && init?.method === "POST") return pendingSave; if (url.endsWith("/other")) return Promise.resolve(json({ data: { ...detail, id: "other", privateImports: [] } })); return Promise.resolve(json({ data: [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); const saving = expect(result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: true })).rejects.toThrow("cancelled");
    await act(async () => { await result.current.open("other"); }); resolveSave(json({ data: { id: "draft", name: "Draft", status: "active", lockVersion: 1, updatedAt: "now" } }, true, 201)); await saving;
    expect(result.current.opened?.id).toBe("other");
  });
  it("keeps the opened draft through a same-account token refresh", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(json({ data: url.endsWith("/draft") ? { ...detail, privateImports: [] } : [] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.open("draft"); });
    await act(async () => { (onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void)("TOKEN_REFRESHED", { user: { id: "user-1" } }); });
    expect(result.current.opened?.id).toBe("draft");
  });
  it("clears prior account cloud names when an account switch refresh fails", async () => {
    let failRefresh = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/draft") ? json({ data: { ...detail, privateImports: [] } }) : failRefresh ? json({ error: { message: "unavailable" } }, false, 503) : json({ data: [{ id: "draft", name: "Account A", status: "active", lockVersion: 1, updatedAt: "now" }] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await Promise.resolve(); await result.current.open("draft"); }); failRefresh = true;
    await act(async () => { (onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void)("SIGNED_OUT", null); await Promise.resolve(); });
    expect(result.current.drafts).toEqual([]); expect(result.current.opened).toBeNull(); expect(result.current.status).toBe("error");
  });
  it("keeps the current draft and exposes an error when opening another draft fails", async () => {
    let unavailable = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/other") && unavailable ? json({ error: { message: "unavailable" } }, false, 404) : json({ data: url.endsWith("/draft") ? { ...detail, privateImports: [] } : [] }))));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.open("draft"); }); unavailable = true;
    await act(async () => { await expect(result.current.open("other")).rejects.toThrow("unavailable"); });
    expect(result.current.opened?.id).toBe("draft"); expect(result.current.status).toBe("error"); expect(result.current.error).toBe("unavailable");
  });
  it("cancels a pending autosave when deleting the opened draft", async () => {
    vi.useFakeTimers(); const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => { calls.push({ url, init }); if (url.endsWith("/draft") && init?.method === "DELETE") return Promise.resolve(json({ data: undefined })); return Promise.resolve(json({ data: url.endsWith("/draft") ? { ...detail, privateImports: [] } : [] })); }));
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await result.current.open("draft"); result.current.autosave("draft", { name: "Draft", snapshot, accountSaveConsent: true }); await result.current.remove("draft", 1); vi.advanceTimersByTime(2_000); });
    expect(calls.some((call) => call.url.endsWith("/draft") && call.init?.method === "PUT")).toBe(false); vi.useRealTimers();
  });
  it("does not send a save with a new account token after session resolution", async () => {
    const fetchMock = vi.fn((..._args: Parameters<typeof fetch>) => Promise.resolve(json({ data: [] }))); vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useSavedDrafts()); await act(async () => { await Promise.resolve(); });
    let resolveSession!: (value: unknown) => void; getSession.mockImplementationOnce(() => new Promise((resolve) => { resolveSession = resolve; }));
    const cancelled = expect(result.current.saveNow(null, { name: "Draft", snapshot, accountSaveConsent: true })).rejects.toThrow("cancelled");
    await act(async () => { await Promise.resolve(); (onAuthStateChange.mock.calls[0][0] as (event: string, session: unknown) => void)("SIGNED_OUT", null); resolveSession({ data: { session: { access_token: "new-token", user: { id: "user-2" } } } }); });
    await cancelled;
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST" || (init as RequestInit | undefined)?.method === "PUT")).toBe(false);
  });
  it("cancels a pending open when the auth identity changes", async () => {
    let resolve!: (value: unknown) => void; const pending = new Promise((done) => { resolve = done; }); vi.stubGlobal("fetch", vi.fn((url: string) => url.endsWith("/draft") ? pending : Promise.resolve(json({ data: [] }))));
    const { result } = renderHook(() => useSavedDrafts()); const opening = result.current.open("draft"); (onAuthStateChange.mock.calls[0][0] as (event: string, session: null) => void)("SIGNED_OUT", null); resolve(json({ data: { ...detail, privateImports: [] } })); await expect(opening).rejects.toThrow("cancelled");
  });
});
