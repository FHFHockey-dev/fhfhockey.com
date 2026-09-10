import { createHash, randomUUID } from "crypto";

import serviceRoleClient from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

import { cleanupPrivateImports } from "./privateImportCleanup";

const BUCKET = "draft-pro-private-imports";
export const PRIVATE_IMPORT_CHUNK_BYTES = 750 * 1024;
const client = serviceRoleClient;
type UploadRow = Database["public"]["Functions"]["read_draft_pro_private_import_upload"]["Returns"][number];
type OwnedBytes = Uint8Array<ArrayBuffer>;

function bytesFrom(value: ArrayBuffer | ArrayLike<number>): OwnedBytes { return value instanceof ArrayBuffer ? new Uint8Array(value) : Uint8Array.from(value); }
function bytesEqual(left: OwnedBytes, right: OwnedBytes) { return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]); }

function requireRow<T>(rows: T[] | null, message = "Private import transaction returned no result."): T {
  const value = rows?.[0];
  if (!value) throw new Error(message);
  return value;
}

async function ownedUpload(userId: string, uploadId: string) {
  const { data, error } = await client.rpc("read_draft_pro_private_import_upload", { p_user_id: userId, p_upload_id: uploadId });
  if (error) throw error;
  const upload: UploadRow = requireRow(data);
  if (upload.save_session_status !== "pending" || Date.parse(upload.save_session_expires_at) <= Date.now() || Date.parse(upload.expires_at) <= Date.now()) throw new Error("Private import upload is unavailable.");
  return upload;
}

export async function beginPrivateImport(args: { userId: string; draftId: string | null; expectedVersion: number | null; attemptKey: string; name: string; mapping: unknown; declaredMaxBytes: number; replacementImportId?: string | null }) {
  await cleanupPrivateImports(args.userId);
  const { data: sessionRows, error: sessionError } = await client.rpc("begin_draft_pro_save_session", { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion, p_attempt_key: args.attemptKey });
  if (sessionError) throw sessionError;
  const session = requireRow(sessionRows);
  if (session.status !== "ready") return { status: session.status, session };
  if (!session.save_session_id) throw new Error("Private import transaction returned no save session.");
  const { data: uploadRows, error: uploadError } = await client.rpc("begin_draft_pro_private_import_upload", { p_user_id: args.userId, p_save_session_id: session.save_session_id, p_replacement_import_id: args.replacementImportId ?? null, p_declared_max_bytes: args.declaredMaxBytes, p_name: args.name, p_content_type: "application/json", p_mapping: args.mapping === undefined ? null : args.mapping as Json });
  if (uploadError) throw uploadError;
  const upload = requireRow(uploadRows);
  return { status: "ready", session, upload };
}

export async function putPrivateImportChunk(args: { userId: string; uploadId: string; prefix: string; ordinal: number; bytes: ArrayLike<number> }) {
  const uploadRecord = await ownedUpload(args.userId, args.uploadId);
  const chunkBytes = bytesFrom(args.bytes);
  if (uploadRecord.status !== "uploading") throw new Error("Private import upload is unavailable.");
  if (chunkBytes.byteLength === 0 || chunkBytes.byteLength > PRIVATE_IMPORT_CHUNK_BYTES) throw new Error("Private import chunks must be between 1 byte and 750 KiB.");
  const maxChunks = Math.ceil(uploadRecord.declared_max_bytes / PRIVATE_IMPORT_CHUNK_BYTES);
  if (!Number.isInteger(args.ordinal) || args.ordinal < 0 || args.ordinal >= maxChunks || args.prefix !== uploadRecord.storage_prefix) throw new Error("Invalid private import chunk ordinal.");
  const remaining = uploadRecord.declared_max_bytes - args.ordinal * PRIVATE_IMPORT_CHUNK_BYTES;
  if (chunkBytes.byteLength > Math.min(PRIVATE_IMPORT_CHUNK_BYTES, remaining)) throw new Error("Chunk exceeds its upload reservation.");
  const path = `${uploadRecord.storage_prefix}/${args.ordinal}`;
  // Chunks encode the normalized JSON document; keep the bucket MIME policy
  // aligned with its explicit private-import allowlist.
  const upload = await client.storage.from(BUCKET).upload(path, chunkBytes, { contentType: "application/json", upsert: false });
  if (upload.error) {
    if (!/already exists/i.test(upload.error.message)) throw upload.error;
    const existing = await client.storage.from(BUCKET).download(path);
    if (existing.error) throw existing.error;
    if (!bytesEqual(bytesFrom(await existing.data.arrayBuffer()), chunkBytes)) throw new Error("Private import retry chunk differs from the existing chunk.");
  }
  return path;
}

export async function stagePrivateImport(args: { userId: string; uploadId: string; chunkPaths: string[] }) {
  const uploadRecord = await ownedUpload(args.userId, args.uploadId);
  if (uploadRecord.status !== "uploading" && uploadRecord.status !== "staged") throw new Error("Private import upload is unavailable.");
  const maxChunks = Math.ceil(uploadRecord.declared_max_bytes / PRIVATE_IMPORT_CHUNK_BYTES);
  if (!args.chunkPaths.length || args.chunkPaths.length > Math.min(32, maxChunks)) throw new Error("Private import requires a bounded set of chunks.");
  const derivedPaths = args.chunkPaths.map((_path, ordinal) => `${uploadRecord.storage_prefix}/${ordinal}`);
  if (args.chunkPaths.some((path, ordinal) => path !== derivedPaths[ordinal])) throw new Error("Private import paths are not server-owned.");
  const chunks: OwnedBytes[] = [];
  let totalBytes = 0;
  for (const path of derivedPaths) {
    const downloaded = await client.storage.from(BUCKET).download(path);
    if (downloaded.error) throw downloaded.error;
    const chunk = bytesFrom(await downloaded.data.arrayBuffer());
    if (!chunk.byteLength || chunk.byteLength > PRIVATE_IMPORT_CHUNK_BYTES || totalBytes + chunk.byteLength > uploadRecord.declared_max_bytes) throw new Error("Private import chunks exceed their reservation.");
    totalBytes += chunk.byteLength;
    chunks.push(chunk);
  }
  const body = new Uint8Array(totalBytes);
  let bodyOffset = 0;
  for (const chunk of chunks) { body.set(chunk, bodyOffset); bodyOffset += chunk.byteLength; }
  if (body.byteLength > uploadRecord.declared_max_bytes) throw new Error("Normalized private import exceeds its reservation.");
  let rows: unknown;
  try { rows = JSON.parse(new TextDecoder().decode(body)); } catch { throw new Error("Normalized private import must be valid JSON."); }
  if (!Array.isArray(rows) || rows.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) throw new Error("Normalized private import rows are invalid.");
  if (rows.length > 100_000) throw new Error("Normalized private import exceeds the 100,000-row limit.");
  const hash = createHash("sha256").update(body).digest("hex");
  const finalPath = uploadRecord.final_storage_path;
  if (uploadRecord.status === "staged") {
    if (uploadRecord.actual_bytes !== body.byteLength || uploadRecord.row_count !== rows.length || uploadRecord.content_sha256 !== hash) throw new Error("Private import retry content differs from the staged upload.");
    const existing = await client.storage.from(BUCKET).download(finalPath);
    if (existing.error) throw existing.error;
    const existingHash = createHash("sha256").update(bytesFrom(await existing.data.arrayBuffer())).digest("hex");
    if (existingHash !== hash) throw new Error("Private import retry content differs from the existing staged object.");
    const { data: stagedRows, error: stagedError } = await client.rpc("stage_draft_pro_private_import_upload", { p_user_id: args.userId, p_upload_id: args.uploadId, p_chunk_paths: derivedPaths, p_actual_bytes: body.byteLength, p_row_count: rows.length, p_content_sha256: hash });
    if (stagedError) throw stagedError;
    const staged = requireRow(stagedRows);
    if (staged.status !== "staged") throw new Error("Private import could not be staged.");
    return { importId: staged.upload_id, rowCount: rows.length, bytes: body.byteLength, hash };
  }
  const finalUpload = await client.storage.from(BUCKET).upload(finalPath, body, { contentType: "application/json", upsert: false });
  if (finalUpload.error) {
    if (!/already exists/i.test(finalUpload.error.message)) throw finalUpload.error;
    const existing = await client.storage.from(BUCKET).download(finalPath);
    if (existing.error) throw existing.error;
    const existingHash = createHash("sha256").update(bytesFrom(await existing.data.arrayBuffer())).digest("hex");
    if (existingHash !== hash) throw new Error("Private import retry content differs from the existing staged object.");
  }
  const { data: stagedRows, error: stagedError } = await client.rpc("stage_draft_pro_private_import_upload", { p_user_id: args.userId, p_upload_id: args.uploadId, p_chunk_paths: derivedPaths, p_actual_bytes: body.byteLength, p_row_count: rows.length, p_content_sha256: hash });
  if (stagedError) throw stagedError;
  const staged = requireRow(stagedRows);
  if (staged.status !== "staged") throw new Error("Private import could not be staged.");
  return { importId: String(staged.upload_id), rowCount: rows.length, bytes: body.byteLength, hash };
}

export function newSavedDraftAttemptKey() { return randomUUID(); }

export async function readPrivateImportRows(args: { userId: string; draftId: string; importId: string }) {
  const { data, error } = await client.rpc("read_draft_pro_private_import_blob", { p_user_id: args.userId, p_draft_id: args.draftId, p_import_id: args.importId });
  if (error) throw error;
  const metadata = requireRow(data);
  const downloaded = await client.storage.from(BUCKET).download(String(metadata.storage_path));
  if (downloaded.error) throw downloaded.error;
  const bytes = bytesFrom(await downloaded.data.arrayBuffer());
  if (bytes.byteLength !== Number(metadata.byte_size) || createHash("sha256").update(bytes).digest("hex") !== metadata.content_sha256) throw new Error("Private import file validation failed.");
  const rows: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(rows) || rows.length !== Number(metadata.row_count)) throw new Error("Private import file is incomplete.");
  return rows;
}

export async function readPrivateImportChunk(args: { userId: string; draftId: string; importId: string; ordinal: number }) {
  const { data, error } = await client.rpc("read_draft_pro_private_import_blob", { p_user_id: args.userId, p_draft_id: args.draftId, p_import_id: args.importId });
  if (error) throw error;
  const metadata = requireRow(data);
  const totalBytes = Number(metadata.byte_size);
  const totalChunks = Math.ceil(totalBytes / PRIVATE_IMPORT_CHUNK_BYTES);
  if (!Number.isInteger(args.ordinal) || args.ordinal < 0 || args.ordinal >= totalChunks) throw new Error("Private import chunk is unavailable.");
  const downloaded = await client.storage.from(BUCKET).download(String(metadata.storage_path));
  if (downloaded.error) throw downloaded.error;
  const bytes = bytesFrom(await downloaded.data.arrayBuffer());
  if (bytes.byteLength !== totalBytes || createHash("sha256").update(bytes).digest("hex") !== metadata.content_sha256) throw new Error("Private import file validation failed.");
  const start = args.ordinal * PRIVATE_IMPORT_CHUNK_BYTES;
  return { bytes: bytes.subarray(start, Math.min(start + PRIVATE_IMPORT_CHUNK_BYTES, bytes.length)), totalBytes, totalChunks, sha256: String(metadata.content_sha256), rowCount: Number(metadata.row_count) };
}
