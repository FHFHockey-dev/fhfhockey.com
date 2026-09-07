import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";

import type { DraftProSnapshot } from "./contracts";
import { cleanupPrivateImports } from "./privateImportCleanup";

type DraftRow = { id: string; name: string; lock_version: number; updated_at: string };
type SummaryRow = DraftRow & { status: string };
type ConflictRow = { draft_id: string; lock_version: number; name?: string; updated_at?: string };

export type SavedDraftSummary = { id: string; name: string; status: "active" | "archived"; lockVersion: number; updatedAt: string };
export type SavedDraftConflict = { id: string; lockVersion: number; name?: string; updatedAt?: string };

function requireRow<T>(rows: T[] | null, message: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(message);
  return row;
}

function savedDraft(row: DraftRow, status: "active" | "archived" = "active"): SavedDraftSummary {
  return { id: row.id, name: row.name, status, lockVersion: row.lock_version, updatedAt: row.updated_at };
}

function summary(row: SummaryRow): SavedDraftSummary {
  if (row.status === "active" || row.status === "archived") return savedDraft(row, row.status);
  throw new Error("Saved Drafts transaction returned an unsupported draft status.");
}

function conflict(row: ConflictRow): SavedDraftConflict {
  return { id: row.draft_id, lockVersion: row.lock_version, ...(row.name === undefined ? {} : { name: row.name }), ...(row.updated_at === undefined ? {} : { updatedAt: row.updated_at }) };
}

async function cleanupAfterSave(userId: string) {
  try { await cleanupPrivateImports(userId); } catch { /* Successful saves must not fail because cleanup can retry later. */ }
}

export async function listSavedDrafts(userId: string): Promise<SavedDraftSummary[]> {
  const { data, error } = await serviceRoleClient.rpc("list_draft_pro_saved_drafts", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []).filter((row) => row.status !== "deleted").map(summary);
}

export async function commitSavedDraft(args: { userId: string; draftId: string | null; name: string; expectedVersion?: number; snapshot: DraftProSnapshot; attemptKey: string; importIds?: string[] }) {
  const bytes = new TextEncoder().encode(JSON.stringify(args.snapshot)).byteLength;
  const { data: sessionRows, error: sessionError } = await serviceRoleClient.rpc("begin_draft_pro_save_session", { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion ?? null, p_attempt_key: args.attemptKey });
  if (sessionError) throw sessionError;
  const session = requireRow(sessionRows, "Saved Drafts transaction returned no save session.");
  if (session.status === "conflict" || session.status === "busy") {
    if (!session.draft_id) throw new Error("Saved Drafts conflict returned no draft.");
    return { conflict: true as const, current: conflict({ draft_id: session.draft_id, lock_version: session.current_version }) };
  }
  if (session.status !== "ready" && session.status !== "saved") throw new Error("Saved Drafts transaction returned an unsupported save session status.");
  if (!session.save_session_id) throw new Error("Saved Drafts transaction returned no save session.");
  const { data: commitRows, error: commitError } = await serviceRoleClient.rpc("commit_draft_pro_save_session", { p_user_id: args.userId, p_save_session_id: session.save_session_id, p_name: args.name, p_snapshot: args.snapshot as Json, p_snapshot_bytes: bytes, p_import_ids: args.importIds ?? [] });
  if (commitError) throw commitError;
  const result = requireRow(commitRows, "Saved Drafts transaction returned no result.");
  if (result.status === "conflict") return { conflict: true as const, current: conflict(result) };
  if (result.status !== "saved") throw new Error("Saved Drafts transaction returned an unsupported save status.");
  const saved = { conflict: false as const, draft: savedDraft({ id: result.draft_id, name: result.name, lock_version: result.lock_version, updated_at: result.updated_at }) };
  await cleanupAfterSave(args.userId);
  return saved;
}

export async function readSavedDraft(userId: string, draftId: string) {
  const { data, error } = await serviceRoleClient.rpc("read_draft_pro_snapshot", { p_user_id: userId, p_draft_id: draftId });
  if (error) throw error;
  const result = requireRow(data, "Saved Drafts transaction returned no result.");
  if (!Array.isArray(result.imports)) throw new Error("Saved Drafts transaction returned invalid imports.");
  return { ...savedDraft(result), snapshot: result.snapshot, privateImports: result.imports };
}

export async function mutateSavedDraft(args: { userId: string; draftId: string; action: "rename" | "duplicate" | "delete"; name?: string; expectedVersion: number }) {
  const mutationArgs = { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion };
  if (args.action === "delete") {
    const { data, error } = await serviceRoleClient.rpc("delete_draft_pro_saved_draft", mutationArgs);
    if (error) throw error;
    const result = requireRow(data, "Saved Drafts transaction returned no result.");
    if (result.status === "conflict") return { conflict: true as const, current: conflict(result) };
    if (result.status !== "deleted") throw new Error("Saved Drafts transaction returned an unsupported delete status.");
    const deleted = { conflict: false as const, draft: null };
    await cleanupAfterSave(args.userId);
    return deleted;
  }
  const { data, error } = await serviceRoleClient.rpc(args.action === "rename" ? "rename_draft_pro_saved_draft" : "duplicate_draft_pro_saved_draft", { ...mutationArgs, p_name: args.name ?? "" });
  if (error) throw error;
  const result = requireRow(data, "Saved Drafts transaction returned no result.");
  if (result.status === "conflict") return { conflict: true as const, current: conflict(result) };
  if (result.status !== "saved") throw new Error("Saved Drafts transaction returned an unsupported mutation status.");
  return { conflict: false as const, draft: savedDraft({ id: result.draft_id, name: result.name, lock_version: result.lock_version, updated_at: result.updated_at }) };
}
