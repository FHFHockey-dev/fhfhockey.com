import { z } from "zod";

const finiteNumber = z.number().finite();
const boundedRecord = (value: z.ZodTypeAny) => z.record(z.string().max(100), value).refine(
  (record) => Object.keys(record).length <= 80,
  "At most 80 values are allowed.",
);

export const draftProRecommendationsInputSchema = z.object({
  dataOrigin: z.enum(["server", "local_csv", "private_import"]),
  leagueType: z.enum(["points", "categories"]),
  candidates: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    role: z.enum(["skater", "goalie"]),
    eligiblePositions: z.array(z.string().min(1).max(12)).max(12),
    globalVorp: finiteNumber,
    rankValue: finiteNumber,
    baselineScore: finiteNumber.optional(),
    tieBreaker: finiteNumber.optional(),
    categoryValues: boundedRecord(finiteNumber.nullable()).optional(),
    adp: finiteNumber.nullable().optional(),
  }).strict()).min(1).max(2_000),
  positionNeeds: boundedRecord(finiteNumber).optional(),
  categoryNeeds: boundedRecord(finiteNumber).optional(),
  categoryWeights: boundedRecord(finiteNumber).optional(),
  needAlpha: finiteNumber.min(0).max(1).optional(),
  currentPick: finiteNumber.int().min(1).max(2_000).optional(),
  teamCount: finiteNumber.int().min(1).max(32).optional(),
  limit: finiteNumber.int().min(1).max(100).optional(),
}).strict();

export type DraftProRecommendationsInput = z.infer<typeof draftProRecommendationsInputSchema>;
