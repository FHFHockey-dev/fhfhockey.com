import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

const projectionQuerySchema = z.object({
  date: z
    .string({ required_error: "date is required" })
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "date must be YYYY-MM-DD"),
  profile: z
    .union([z.string().uuid(), z.literal("default")])
    .optional(),
  mode: z.enum(["points"]).default("points"),
});

type ProjectionQuery = z.infer<typeof projectionQuerySchema>;

function normalizeQuery(req: NextApiRequest): ProjectionQuery {
  const rawDate = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;
  const rawProfile = Array.isArray(req.query.profile)
    ? req.query.profile[0]
    : req.query.profile;
  const rawMode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;

  const parsed = projectionQuerySchema.safeParse({
    date: rawDate,
    profile: rawProfile,
    mode: rawMode ?? "points",
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
    const { date, profile, mode } = normalizeQuery(req);

    // TODO: wire up projections once model pipeline is implemented.
    const response = {
      date,
      mode,
      profileId: profile ?? null,
      projections: [] as Array<{
        playerId: number;
        gameId: number;
        lambdas: {
          goals: number;
          assists: number;
          shots: number;
          peripherals: Record<string, number>;
        };
        projectedPoints: number;
      }>,
      meta: {
        modelVersion: "start-chart-internal-dev",
        message: "Projection engine scaffolded; replace stub with model output.",
      },
    };

    return res.status(200).json(response);
  } catch (err) {
    const statusCode = (err as any)?.statusCode ?? 400;
    return res.status(statusCode).json({
      error: (err as Error).message,
      details: (err as any)?.details,
    });
  }
}
