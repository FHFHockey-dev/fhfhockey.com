import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireApiUser } from "lib/api/requireApiUser";
import serviceRoleClient from "lib/supabase/server";
import {
  loadDraftProAccess,
  requireDraftProServerCapability,
} from "lib/draft-pro/server";
import { getDraftProFeatureFlags } from "lib/draft-pro/features";
import {
  eventsSchema,
  leagueSchema,
  registrationSchema,
  stableJson,
} from "./contracts";
import { mockFlags } from "./flags";

// Narrow typed boundary for the new RPCs; regenerate database types after local migration validation.
type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (serviceRoleClient as unknown as RpcClient).rpc(
    name,
    args,
  );
  if (error) throw new Error(error.message);
  return data;
}
const querySchema = z.object({
  season: z.string().min(1).max(30),
  cohort: z.string().max(12000),
  tier: z.enum(["all", "free", "pro"]).default("all"),
  completed: z.enum(["true", "false"]).default("false"),
  search: z.string().max(100).default(""),
  position: z.enum(["", "C", "LW", "RW", "FWD", "D", "G"]).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export function mockHandler(
  action: "access" | "register" | "events" | "withdraw" | "adp",
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader("Cache-Control", "private, no-store");
    const method =
      action === "adp" ? "GET" : action === "withdraw" ? "DELETE" : "POST";
    if (req.method !== method) {
      res.setHeader("Allow", method);
      return res
        .status(405)
        .json({ error: { message: "Method not allowed." } });
    }
    const flags = mockFlags();
    if (
      action !== "withdraw" &&
      (!flags.enabled ||
        (action === "adp"
          ? !flags.board
          : action !== "access" && !flags.collection))
    )
      return res
        .status(503)
        .json({
          error: { message: "This mock feature is not available yet." },
        });
    try {
      if (action === "adp") {
        const q = querySchema.parse(req.query),
          parsed = leagueSchema.parse(JSON.parse(q.cohort));
        const data = await rpc("mock_draft_adp", {
          p_season: q.season,
          p_cohort: stableJson(parsed),
          p_tier: q.tier,
          p_completed: q.completed === "true",
          p_search: q.search,
          p_position: q.position,
          p_page: q.page,
        });
        res.setHeader("Cache-Control", "public, max-age=60");
        return res.status(200).json({ data });
      }
      const user = await requireApiUser(req, res, {
        onUnauthorized: (message) =>
          res.status(401).json({ error: { message } }),
      });
      if (!user) return;
      if (action === "access") {
        const access = await loadDraftProAccess(user.id, {
          now: new Date(),
          flags: getDraftProFeatureFlags(),
          patreonVerificationAvailable: true,
        });
        requireDraftProServerCapability(access, "mock_draft_advanced");
        return res
          .status(200)
          .json({
            data: {
              authorized: true,
              expiresAt: access.expiresAt,
              nextVerificationAt: access.nextVerificationAt,
            },
          });
      }
      if (action === "register") {
        const input = registrationSchema.parse(req.body);
        let advanced = false;
        if (input.tier === "pro") {
          try {
            const access = await loadDraftProAccess(user.id, {
              now: new Date(),
              flags: getDraftProFeatureFlags(),
              patreonVerificationAvailable: true,
            });
            advanced =
              access.eligible &&
              access.capabilities.includes("mock_draft_advanced");
          } catch {
            /* Existing registrations can retry after access expires or verification fails. */
          }
        }
        return res
          .status(200)
          .json({
            data: await rpc("mock_draft_register", {
              p_user: user.id,
              p_input: input,
              p_cohort: stableJson(input.league),
              p_pro_allowed: advanced,
            }),
          });
      }
      const id = z.string().uuid().parse(req.query.id);
      if (action === "withdraw")
        return res
          .status(200)
          .json({
            data: await rpc("mock_draft_withdraw", {
              p_user: user.id,
              p_session: id,
            }),
          });
      const input = eventsSchema.parse(req.body);
      return res
        .status(200)
        .json({
          data: await rpc("mock_draft_ingest", {
            p_user: user.id,
            p_session: id,
            p_events: input.events,
            p_complete: input.complete,
          }),
        });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      const validation = e instanceof z.ZodError || e instanceof SyntaxError;
      const status = validation
        ? 400
        : message.includes("daily_limit")
          ? 429
          : message.includes("not_found")
            ? 404
            : /conflict|invalid_|out_of_order|unknown_player|incomplete|withdrawn|duplicate key/.test(
                  message,
                )
              ? 409
              : message.includes("advanced_required") ||
                  (typeof e === "object" &&
                    e &&
                    "statusCode" in e &&
                    e.statusCode === 403)
                ? 403
                : 503;
      return res
        .status(status)
        .json({
          error: {
            message: validation
              ? "Invalid mock request."
              : status === 429
                ? "Daily ADP contribution limit reached. Continue practicing without contribution."
                : status === 403
                  ? "Draft Pro access is required. Resume after verifying your account."
                  : status === 409
                    ? "Mock history conflicts with the stored contribution. Practice remains available."
                    : status === 404
                      ? "Mock session not found."
                      : "Mock service unavailable. Your saved practice can continue.",
          },
        });
    }
  };
}
