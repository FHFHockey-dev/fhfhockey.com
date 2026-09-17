import { z } from "zod";
import type { MockPlayer } from "./contracts";
import suppliedResearch from "components/DraftDashboard/mock-sleepers-value-list.json";

const entrySchema = z.object({
  playerId: z.string(),
  tags: z.array(
    z.enum([
      "sleeper",
      "breakout",
      "value",
      "bust_risk",
      "reach_target",
      "fade",
      "bounce_back",
      "high_volume_goalie",
    ]),
  ),
  confidence: z.enum(["high", "medium", "low"]),
  formats: z.array(z.enum(["points", "categories"])),
  workload: z.number().nonnegative().nullable(),
  citations: z.array(z.string().url()).min(1),
  thesis: z.string().optional(),
  scoringFit: z.array(z.string()).optional(),
  scoringCautions: z.array(z.string()).optional(),
});
export const researchSchema = z.object({
  version: z.string().min(1),
  season: z.string(),
  researchedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  players: z.array(entrySchema),
});
export type MockResearch = z.infer<typeof researchSchema>;
export function validateResearch(
  input: unknown,
  season: string,
  players: MockPlayer[],
) {
  const data = researchSchema.parse(input);
  const ids = new Set(players.map((p) => p.id));
  if (
    data.season !== season ||
    data.players.some((p) => !ids.has(p.playerId)) ||
    new Set(data.players.map((p) => p.playerId)).size !== data.players.length
  )
    throw new Error(
      "Research season or player identities do not match this pool.",
    );
  return data;
}
const suppliedSchema = z.object({
  season: z.string().regex(/^\d{4}-\d{2}$/),
  researchedAt: researchSchema.shape.researchedAt,
  players: z.array(z.object({
    nhlPlayerId: z.number().int().positive(),
    tags: entrySchema.shape.tags,
    confidence: entrySchema.shape.confidence,
    thesis: z.string(),
    scoringFit: z.array(z.string()),
    scoringCautions: z.array(z.string()),
    goalieWorkload: z.object({ projectedStarts: z.union([z.number().nonnegative(), z.string()]).nullable() }).passthrough().nullable(),
    sources: z.array(z.object({ url: z.string().url() })).min(1),
  })).min(1),
});

export function normalizeSuppliedResearch(input: unknown): MockResearch {
  const raw = suppliedSchema.parse(input);
  const firstYear = Number(raw.season.slice(0, 4));
  if (String(firstYear + 1).slice(-2) !== raw.season.slice(-2)) throw new Error("Invalid research season.");
  const season = `${firstYear}${firstYear + 1}`;
  if (new Set(raw.players.map(p => p.nhlPlayerId)).size !== raw.players.length) throw new Error("Duplicate research player identities.");
  return researchSchema.parse({
    // Bump the revision when updating this season's research asset.
    version: `contrarian-${season}-${raw.researchedAt}-v1`,
    season,
    researchedAt: raw.researchedAt,
    players: raw.players.map(p => ({
      playerId: String(p.nhlPlayerId),
      tags: p.tags,
      confidence: p.confidence,
      formats: ["points", "categories"],
      // Conditional text ("50+ if…") and prior appearances are not projected starts.
      workload: typeof p.goalieWorkload?.projectedStarts === "number" ? p.goalieWorkload.projectedStarts : null,
      citations: [...new Set(p.sources.map(s => s.url))],
      thesis: p.thesis,
      scoringFit: p.scoringFit,
      scoringCautions: p.scoringCautions,
    })),
  });
}

export function contrarianAdjustment(entry: MockResearch["players"][number]) {
  const positive = entry.tags.some(tag => ["sleeper", "breakout", "value", "reach_target", "bounce_back", "high_volume_goalie"].includes(tag));
  // Mixed upside/bust tags represent a smaller upside preference; explicit fades dominate.
  const upside = positive ? 0.4 : 0;
  const downside = entry.tags.includes("fade") ? 0.6 : entry.tags.includes("bust_risk") ? 0.3 : 0;
  const confidence = entry.confidence === "high" ? 1 : entry.confidence === "medium" ? 0.7 : 0.4;
  return (upside - downside) * confidence;
}

export const reviewedResearch = normalizeSuppliedResearch(suppliedResearch);
export function researchAvailable(season: string | undefined) {
  return season === reviewedResearch.season;
}
