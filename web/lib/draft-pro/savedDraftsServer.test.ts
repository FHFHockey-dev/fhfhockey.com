import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: { rpc } }));

import { commitSavedDraft, listSavedDrafts, readSavedDraft } from "./savedDraftsServer";

const snapshot = { settings: {}, picks: [], keepers: [], trades: [], team: {}, sourceWeights: {}, importMappings: {}, favorites: [], notes: [], tiers: {}, recommendationPreferences: {} } as any;

describe("saved draft SQL adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the same attempt-key save session for an owned create and maps the SQL commit row", async () => {
    rpc.mockResolvedValueOnce({ data: [{ status: "ready", save_session_id: "save-session-1", draft_id: null, current_version: 0, expires_at: "2099-01-01T00:00:00.000Z" }], error: null });
    rpc.mockResolvedValueOnce({ data: [{ status: "saved", draft_id: "draft-1", lock_version: 1, name: "My draft", updated_at: "2026-09-07T12:00:00.000Z", import_count: 0, conflict_lock_version: null }], error: null });
    await expect(commitSavedDraft({ userId: "owner-1", draftId: null, name: "My draft", snapshot, attemptKey: "attempt-1" })).resolves.toMatchObject({ conflict: false, draft: { id: "draft-1", lockVersion: 1 } });
    expect(rpc).toHaveBeenNthCalledWith(1, "begin_draft_pro_save_session", expect.objectContaining({ p_user_id: "owner-1", p_attempt_key: "attempt-1" }));
    expect(rpc).toHaveBeenNthCalledWith(2, "commit_draft_pro_save_session", expect.objectContaining({ p_user_id: "owner-1", p_save_session_id: "save-session-1" }));
  });

  it("maps SQL imports and excludes soft-deleted summary rows", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "deleted", name: "Deleted", status: "deleted", lock_version: 4, updated_at: "2026-09-07T12:00:00.000Z", import_count: 0 }, { id: "active", name: "Active", status: "active", lock_version: 2, updated_at: "2026-09-07T13:00:00.000Z", import_count: 1 }], error: null });
    await expect(listSavedDrafts("owner-1")).resolves.toEqual([{ id: "active", name: "Active", status: "active", lockVersion: 2, updatedAt: "2026-09-07T13:00:00.000Z" }]);
    rpc.mockResolvedValueOnce({ data: [{ id: "active", name: "Active", lock_version: 2, snapshot: { picks: [] }, updated_at: "2026-09-07T13:00:00.000Z", imports: [{ id: "import-1", name: "keepers.json", content_type: "application/json", byte_size: 15, row_count: 1, mapping: { player: "name" } }] }], error: null });
    await expect(readSavedDraft("owner-1", "active")).resolves.toMatchObject({ id: "active", privateImports: [{ id: "import-1", row_count: 1 }] });
  });

  it("fails closed for an unknown transaction status", async () => {
    rpc.mockResolvedValueOnce({ data: [{ status: "busy", save_session_id: null, draft_id: "draft-1", current_version: 1, expires_at: null }], error: null });
    await expect(commitSavedDraft({ userId: "owner-1", draftId: "draft-1", name: "My draft", expectedVersion: 1, snapshot, attemptKey: "attempt-1" })).rejects.toThrow("unsupported save session status");
  });
});
