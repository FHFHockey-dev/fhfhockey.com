import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

const BUCKET = "draft-pro-private-imports";
const BLOB_PATH = /^draft-pro-imports\/[0-9a-f-]{36}\/normalized\.json$/;

function uploadPaths(uploadId: string, chunkPaths: Json, finalStoragePath: string | null, deleteFinal: boolean): string[] | null {
  if (!Array.isArray(chunkPaths)) return null;
  const stagingPath = new RegExp(`^draft-pro-import-staging/[0-9a-f-]{36}/${uploadId}/(?:[0-9]|[12][0-9]|3[01])$`);
  if (!chunkPaths.every((path) => typeof path === "string" && stagingPath.test(path))) return null;
  if (!deleteFinal) return chunkPaths as string[];
  if (!finalStoragePath || finalStoragePath !== `draft-pro-imports/${uploadId}/normalized.json`) return null;
  return [...chunkPaths as string[], finalStoragePath];
}

async function removeAll(paths: readonly string[]) {
  // Supabase Storage supports removing up to 1,000 paths in one request. A
  // NoSuchKey is also an error, so leave the lease unconfirmed for retry.
  const { error } = await serviceRoleClient.storage.from(BUCKET).remove([...paths]);
  return !error;
}

/** Best-effort cleanup is intentionally non-throwing so a failed bucket delete
 * leaves its SQL lease for a later retry instead of blocking a new save. */
export async function cleanupPrivateImports(userId: string) {
  let deletedBlobCount = 0;
  let cleanedUploadCount = 0;
  try {
    const { data: blobs, error: blobClaimError } = await serviceRoleClient.rpc("claim_draft_pro_private_import_cleanup", { p_user_id: userId, p_limit: 20 });
    if (!blobClaimError) {
      const confirmedByLease = new Map<string, string[]>();
      for (const blob of blobs ?? []) {
        if (!BLOB_PATH.test(blob.storage_path) || !(await removeAll([blob.storage_path]))) continue;
        const ids = confirmedByLease.get(blob.cleanup_lease_id) ?? [];
        ids.push(blob.blob_id); confirmedByLease.set(blob.cleanup_lease_id, ids);
      }
      for (const [leaseId, blobIds] of confirmedByLease) {
        const { data, error } = await serviceRoleClient.rpc("confirm_draft_pro_private_import_cleanup", { p_user_id: userId, p_blob_ids: blobIds, p_cleanup_lease_id: leaseId });
        if (!error) deletedBlobCount += data ?? 0;
      }
    }

    const { data: uploads, error: uploadClaimError } = await serviceRoleClient.rpc("claim_draft_pro_private_import_upload_cleanup", { p_user_id: userId, p_limit: 20 });
    if (!uploadClaimError) {
      const cleanedIds: string[] = [];
      for (const upload of uploads ?? []) {
        const paths = uploadPaths(upload.upload_id, upload.chunk_paths, upload.final_storage_path, upload.delete_final);
        if (paths && await removeAll(paths)) cleanedIds.push(upload.upload_id);
      }
      if (cleanedIds.length) {
        const { data, error } = await serviceRoleClient.rpc("confirm_draft_pro_private_import_upload_cleanup", { p_user_id: userId, p_upload_ids: cleanedIds });
        if (!error) cleanedUploadCount += data ?? 0;
      }
    }
  } catch {
    // A storage or RPC failure must leave the lease and metadata for retry.
  }
  return { deletedBlobCount, cleanedUploadCount };
}
