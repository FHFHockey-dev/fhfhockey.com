import { randomUUID } from "node:crypto";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import supabase from "lib/supabase/server";

type RunClient = SupabaseClient<Database>;
type HealthStatus = "ok" | "warning" | "error";

export type PredictionsSkoHealth = {
  status: HealthStatus;
  alerts: Array<{
    code: "run_failed" | "partial_write" | "low_rows_written";
    severity: "warning" | "error";
    message: string;
  }>;
};

async function rpc(
  client: RunClient,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await (client as any).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function requestValue(req: NextApiRequest, key: string): unknown {
  let body: any = req.body ?? {};
  if (typeof body === "string" && body) {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body?.[key] ?? req.query?.[key];
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(first(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function asOfDate(value: unknown): string {
  const parsed = new Date(String(first(value) ?? ""));
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

export function predictionsSkoRunKey(req: NextApiRequest): string {
  return [
    "sko-predictions",
    "baseline-moving-average",
    "v0.2",
    asOfDate(requestValue(req, "asOfDate")),
    positiveInt(requestValue(req, "horizon"), 5),
  ].join(":");
}

export function buildPredictionsSkoHealth(
  body: any,
  statusCode: number,
): PredictionsSkoHealth {
  const alerts: PredictionsSkoHealth["alerts"] = [];
  if (statusCode >= 400 || body?.success === false) {
    alerts.push({
      code: "run_failed",
      severity: "error",
      message:
        body?.message ?? body?.error ?? `Run failed with HTTP ${statusCode}`,
    });
  }

  const attempted = Number(body?.write?.attemptedRows ?? 0);
  const upserted = Number(
    body?.write?.upsertedRows ?? body?.rowsUpserted ?? body?.upserts ?? 0,
  );
  const selected = Number(
    body?.coverage?.selectedPlayers ?? body?.players ?? 0,
  );
  if (body?.write?.partial === true || upserted < attempted) {
    alerts.push({
      code: "partial_write",
      severity: "error",
      message: `Only ${upserted} of ${attempted} attempted rows were written.`,
    });
  } else if (selected > 0 && upserted < selected) {
    alerts.push({
      code: "low_rows_written",
      severity: "warning",
      message: `Only ${upserted} rows were written for ${selected} selected players.`,
    });
  }

  return {
    status: alerts.some((alert) => alert.severity === "error")
      ? "error"
      : alerts.length
        ? "warning"
        : "ok",
    alerts,
  };
}

export function withPredictionsSkoRunControl(
  handler: NextApiHandler,
  options: { ttlSeconds?: number } = {},
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const runKey = predictionsSkoRunKey(req);
    const ownerToken = randomUUID();
    const ttlSeconds = Math.min(86400, Math.max(30, options.ttlSeconds ?? 900));
    const acquiredRows = (await rpc(supabase, "acquire_sko_prediction_run", {
      p_run_key: runKey,
      p_owner_token: ownerToken,
      p_ttl_seconds: ttlSeconds,
      p_metadata: {
        method: req.method ?? null,
        url: req.url ?? null,
      },
    })) as Array<{
      acquired: boolean;
      lease_expires_at: string | null;
      attempt_count: number;
    }> | null;
    const acquired = acquiredRows?.[0];
    if (!acquired?.acquired) {
      return res.status(409).json({
        success: false,
        error: `SKO prediction run is already active: ${runKey}`,
        runKey,
        leaseExpiresAt: acquired?.lease_expires_at ?? null,
        retryable: true,
      });
    }

    let heartbeatError: Error | null = null;
    let capturedBody: any = null;
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      capturedBody = body;
      return res;
    }) as any;
    const heartbeat = setInterval(
      () => {
        void rpc(supabase, "heartbeat_sko_prediction_run", {
          p_run_key: runKey,
          p_owner_token: ownerToken,
          p_ttl_seconds: ttlSeconds,
        })
          .then((renewed) => {
            if (renewed !== true) {
              heartbeatError = new Error(
                `Lost SKO prediction run lease: ${runKey}`,
              );
            }
          })
          .catch((error) => {
            heartbeatError =
              error instanceof Error ? error : new Error(String(error));
          });
      },
      Math.max(10_000, Math.floor((ttlSeconds * 1000) / 3)),
    );
    heartbeat.unref?.();

    try {
      await handler(req, res);
      if (heartbeatError) throw heartbeatError;
      const health = buildPredictionsSkoHealth(capturedBody, res.statusCode);
      const succeeded = health.status !== "error";
      const warnings = health.alerts
        .filter((alert) => alert.severity === "warning")
        .map((alert) => ({ code: alert.code, message: alert.message }));
      const responseBody =
        capturedBody && typeof capturedBody === "object"
          ? {
              ...capturedBody,
              health,
              warnings,
              runManifest: {
                runKey,
                attempt: acquired.attempt_count,
                state: succeeded ? "succeeded" : "failed",
              },
            }
          : capturedBody;
      const finished = await rpc(supabase, "finish_sko_prediction_run", {
        p_run_key: runKey,
        p_owner_token: ownerToken,
        p_succeeded: succeeded,
        p_error: succeeded
          ? null
          : health.alerts.map((alert) => alert.message).join(" "),
        p_metadata: {
          health,
          response: responseBody,
        },
      });
      if (finished !== true) {
        throw new Error(`Could not finish SKO prediction run: ${runKey}`);
      }
      if (health.status === "warning") {
        console.warn(`[update-predictions-sko] health warning`, health);
      } else if (health.status === "error") {
        console.error(`[update-predictions-sko] health error`, health);
      }
      return originalJson(responseBody);
    } catch (error) {
      await rpc(supabase, "finish_sko_prediction_run", {
        p_run_key: runKey,
        p_owner_token: ownerToken,
        p_succeeded: false,
        p_error: error instanceof Error ? error.message : String(error),
        p_metadata: {
          health: {
            status: "error",
            alerts: [
              {
                code: "run_failed",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
              },
            ],
          },
        },
      }).catch(() => undefined);
      throw error;
    } finally {
      clearInterval(heartbeat);
      res.json = originalJson as any;
    }
  };
}
