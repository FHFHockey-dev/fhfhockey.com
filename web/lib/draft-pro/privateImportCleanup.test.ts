import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/server", () => ({ default: { rpc, storage: { from: () => ({ remove }) } } }));

import { cleanupPrivateImports } from "./privateImportCleanup";

const blob = { blob_id: "11111111-1111-4111-8111-111111111111", storage_path: "draft-pro-imports/11111111-1111-4111-8111-111111111111/normalized.json", cleanup_lease_id: "lease-1" };
const upload = (overrides: Record<string, unknown> = {}) => ({ upload_id: "22222222-2222-4222-8222-222222222222", chunk_paths: ["draft-pro-import-staging/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/0"], final_storage_path: "draft-pro-imports/22222222-2222-4222-8222-222222222222/normalized.json", delete_final: false, ...overrides });

describe("private import cleanup leases", () => {
  beforeEach(() => { vi.clearAllMocks(); remove.mockResolvedValue({ error: null }); });

  it("does not confirm a blob when Storage fails and confirms it on a later successful retry", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "claim_draft_pro_private_import_cleanup") return Promise.resolve({ data: [blob], error: null });
      if (name === "claim_draft_pro_private_import_upload_cleanup") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: 1, error: null });
    });
    remove.mockResolvedValueOnce({ error: { message: "bucket unavailable" } });
    await expect(cleanupPrivateImports("owner-1")).resolves.toEqual({ deletedBlobCount: 0, cleanedUploadCount: 0 });
    expect(rpc).not.toHaveBeenCalledWith("confirm_draft_pro_private_import_cleanup", expect.anything());
    await expect(cleanupPrivateImports("owner-1")).resolves.toEqual({ deletedBlobCount: 1, cleanedUploadCount: 0 });
    expect(rpc).toHaveBeenCalledWith("confirm_draft_pro_private_import_cleanup", { p_user_id: "owner-1", p_blob_ids: [blob.blob_id], p_cleanup_lease_id: blob.cleanup_lease_id });
  });

  it("cleans committed staging chunks without deleting the active final object", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "claim_draft_pro_private_import_cleanup") return Promise.resolve({ data: [], error: null });
      if (name === "claim_draft_pro_private_import_upload_cleanup") return Promise.resolve({ data: [upload()], error: null });
      if (name === "confirm_draft_pro_private_import_upload_cleanup") return Promise.resolve({ data: 1, error: null });
      return Promise.resolve({ data: [], error: null });
    });
    await expect(cleanupPrivateImports("owner-1")).resolves.toEqual({ deletedBlobCount: 0, cleanedUploadCount: 1 });
    expect(remove).toHaveBeenCalledWith([upload().chunk_paths[0]]); expect(remove).not.toHaveBeenCalledWith([upload().final_storage_path]);
  });

  it("does not confirm an expired partial upload until every staged chunk and final object delete", async () => {
    const expired = upload({ delete_final: true });
    rpc.mockImplementation((name: string) => {
      if (name === "claim_draft_pro_private_import_cleanup") return Promise.resolve({ data: [], error: null });
      if (name === "claim_draft_pro_private_import_upload_cleanup") return Promise.resolve({ data: [expired], error: null });
      return Promise.resolve({ data: 1, error: null });
    });
    remove.mockResolvedValueOnce({ error: { message: "final missing" } });
    await expect(cleanupPrivateImports("owner-1")).resolves.toEqual({ deletedBlobCount: 0, cleanedUploadCount: 0 });
    expect(remove).toHaveBeenCalledWith([expired.chunk_paths[0], expired.final_storage_path]);
    expect(rpc).not.toHaveBeenCalledWith("confirm_draft_pro_private_import_upload_cleanup", expect.anything());
  });
});
