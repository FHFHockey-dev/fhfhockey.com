import serviceRoleClient from "lib/supabase/server";
import { randomUUID } from "crypto";

import type { DraftProSnapshot } from "./contracts";

type RpcResult = { data: unknown; error: { message: string } | null };
type SavedDraftRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
const rpcClient = serviceRoleClient as unknown as SavedDraftRpcClient;

export type SavedDraftSummary = { id: string; name: string; status: "active" | "archived"; lockVersion: number; updatedAt: string };

function summary(value: unknown): SavedDraftSummary {
  const row = value as Record<string, unknown>;
  return { id: String(row.draft_id ?? row.id), name: String(row.name), status: row.status === "archived" ? "archived" : "active", lockVersion: Number(row.lock_version ?? row.lockVersion), updatedAt: String(row.updated_at ?? row.updatedAt) };
}

async function call(name: string, args: Record<string, unknown>) {
  const { data, error } = await rpcClient.rpc(name, args);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  if (!rows[0] || typeof rows[0] !== "object") throw new Error("Saved Drafts transaction returned no result.");
  return rows[0] as Record<string, unknown>;
}

export async function listSavedDrafts(userId: string): Promise<SavedDraftSummary[]> {
  const { data, error } = await rpcClient.rpc("list_draft_pro_saved_drafts", { p_user_id: userId });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Saved Drafts list returned an invalid result.");
  return data.map(summary);
}

export async function commitSavedDraft(args: { userId: string; draftId: string | null; name: string; expectedVersion?: number; snapshot: DraftProSnapshot; attemptKey?: string; uploadIds?: string[]; importIds?: string[] }) {
  const bytes = new TextEncoder().encode(JSON.stringify(args.snapshot)).byteLength;
  const session = await call("begin_draft_pro_save_session", {
    p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion ?? null, p_attempt_key: args.attemptKey ?? randomUUID(),
  });
  if (session.status === "conflict") return { conflict: true as const, current: summary(session) };
  const data = await call("commit_draft_pro_save_session", {
    p_user_id: args.userId, p_save_session_id: session.save_session_id, p_name: args.name,
    p_snapshot: args.snapshot, p_snapshot_bytes: bytes, p_import_ids: args.importIds ?? [],
  });
  if (data.status === "conflict") return { conflict: true as const, current: summary(data) };
  return { conflict: false as const, draft: summary(data) };
}

export async function readSavedDraft(userId: string, draftId: string) {
  const data = await call("read_draft_pro_snapshot", { p_user_id: userId, p_draft_id: draftId });
  return { ...summary(data), snapshot: data.snapshot, privateImports: data.imports ?? [] };
}

export async function mutateSavedDraft(args: { userId: string; draftId: string; action: "rename" | "duplicate" | "delete"; name?: string; expectedVersion?: number }) {
  const functionName = args.action === "rename" ? "rename_draft_pro_saved_draft" : args.action === "duplicate" ? "duplicate_draft_pro_saved_draft" : "delete_draft_pro_saved_draft";
  const mutationArgs = { p_user_id: args.userId, p_draft_id: args.draftId, p_expected_version: args.expectedVersion ?? null };
  const data = await call(functionName, args.action === "delete" ? mutationArgs : { ...mutationArgs, p_name: args.name ?? null });
  if (data.status === "conflict") return { conflict: true as const, current: summary(data) };
  return { conflict: false as const, draft: args.action === "delete" ? null : summary(data) };
}
