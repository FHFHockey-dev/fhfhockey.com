import { randomUUID } from "node:crypto";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";

export class XgExecutionLeaseConflictError extends Error {
  constructor(public readonly leaseKey: string, public readonly leaseExpiresAt: string | null) {
    super(`xG execution lease is already held: ${leaseKey}`);
    this.name = "XgExecutionLeaseConflictError";
  }
}

type LeaseClient = SupabaseClient<Database>;

async function rpc(client: LeaseClient, name: string, args: Record<string, unknown>) {
  const result = await (client as any).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

export async function runWithXgExecutionLease<T>(args: {
  client: LeaseClient;
  leaseKey: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> {
  const ownerToken = randomUUID();
  const ttlSeconds = Math.min(86400, Math.max(30, args.ttlSeconds ?? 900));
  const acquiredRows = (await rpc(args.client, "acquire_xg_execution_lease", {
    p_lease_key: args.leaseKey,
    p_owner_token: ownerToken,
    p_ttl_seconds: ttlSeconds,
    p_metadata: args.metadata ?? {},
  })) as Array<{ acquired: boolean; lease_expires_at: string | null }> | null;
  const acquired = acquiredRows?.[0];
  if (!acquired?.acquired) {
    throw new XgExecutionLeaseConflictError(args.leaseKey, acquired?.lease_expires_at ?? null);
  }

  let heartbeatError: Error | null = null;
  const heartbeat = setInterval(() => {
    void rpc(args.client, "heartbeat_xg_execution_lease", {
      p_lease_key: args.leaseKey,
      p_owner_token: ownerToken,
      p_ttl_seconds: ttlSeconds,
    }).then((renewed) => {
      if (renewed !== true) heartbeatError = new Error(`Lost xG execution lease: ${args.leaseKey}`);
    }).catch((error) => {
      heartbeatError = error instanceof Error ? error : new Error(String(error));
    });
  }, Math.max(10_000, Math.floor((ttlSeconds * 1000) / 3)));
  heartbeat.unref?.();

  try {
    const result = await args.run();
    if (heartbeatError) throw heartbeatError;
    const finished = await rpc(args.client, "finish_xg_execution_lease", {
      p_lease_key: args.leaseKey,
      p_owner_token: ownerToken,
      p_succeeded: true,
      p_error: null,
      p_metadata: { completed_by: "runWithXgExecutionLease" },
    });
    if (finished !== true) throw new Error(`Could not finish xG execution lease: ${args.leaseKey}`);
    return result;
  } catch (error) {
    await rpc(args.client, "finish_xg_execution_lease", {
      p_lease_key: args.leaseKey,
      p_owner_token: ownerToken,
      p_succeeded: false,
      p_error: error instanceof Error ? error.message : String(error),
      p_metadata: { completed_by: "runWithXgExecutionLease" },
    }).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function bypassLease(req: NextApiRequest): boolean {
  const dryRun = first(req.query.dryRun)?.toLowerCase();
  const action = first(req.query.action)?.toLowerCase();
  return ["1", "true", "yes", "y"].includes(dryRun ?? "") || action === "health" || action === "status";
}

export function withXgExecutionLeaseApi(
  handler: NextApiHandler,
  options: { leaseKey: string; ttlSeconds?: number },
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (bypassLease(req)) return handler(req, res);
    try {
      return await runWithXgExecutionLease({
        client: supabase,
        leaseKey: options.leaseKey,
        ttlSeconds: options.ttlSeconds,
        metadata: { method: req.method ?? null, url: req.url ?? null },
        run: async () => {
          await handler(req, res);
        },
      });
    } catch (error) {
      if (res.headersSent) throw error;
      if (error instanceof XgExecutionLeaseConflictError) {
        return res.status(409).json({ success: false, error: error.message, leaseKey: error.leaseKey, leaseExpiresAt: error.leaseExpiresAt, retryable: true });
      }
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "xG execution lease failure" });
    }
  };
}
