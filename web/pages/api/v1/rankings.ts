import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const positions = ["C", "LW", "RW", "W", "F", "D", "G", "UTIL"] as const;

const rankingsQuerySchema = z.object({
  date: z
    .string({ required_error: "date is required" })
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD"),
  mode: z.enum(["points"]).default("points"),
  position: z.enum(positions).optional()
});

type RankingsQuery = z.infer<typeof rankingsQuerySchema>;

function normalizeQuery(req: NextApiRequest): RankingsQuery {
  const rawDate = Array.isArray(req.query.date)
    ? req.query.date[0]
    : req.query.date;
  const rawMode = Array.isArray(req.query.mode)
    ? req.query.mode[0]
    : req.query.mode;
  const rawPosition = Array.isArray(req.query.position)
    ? req.query.position[0]
    : req.query.position;

  const parsed = rankingsQuerySchema.safeParse({
    date: rawDate,
    mode: rawMode ?? "points",
    position: rawPosition ? String(rawPosition).toUpperCase() : undefined
  });

  if (!parsed.success) {
    const error = parsed.error.flatten();
    const message = error.formErrors.join("; ") || "Invalid query parameters";
    const details = { ...error.fieldErrors };
    throw Object.assign(new Error(message), { statusCode: 400, details });
  }

  return parsed.data;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { date, mode, position } = normalizeQuery(req);

    // TODO: populate with ranked projection output when model is wired up.
    const response = {
      date,
      mode,
      position: position ?? null,
      rankings: [] as Array<{
        playerId: number;
        projectedPoints: number;
        opponent: string;
        goalieSvProj: number | null;
        multipliers: {
          fiveOnFive: number;
          penaltyKill: number;
        };
        usage: {
          lineRole: string | null;
          powerPlayShare: number | null;
        };
      }>,
      meta: {
        modelVersion: "start-chart-internal-dev",
        message: "Rankings endpoint scaffolded; plug in projection pipeline."
      }
    };

    return res.status(200).json(response);
  } catch (err) {
    const statusCode = (err as any)?.statusCode ?? 400;
    return res.status(statusCode).json({
      error: (err as Error).message,
      details: (err as any)?.details
    });
  }
}
