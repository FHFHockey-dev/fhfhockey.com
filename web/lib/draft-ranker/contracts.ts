import { createHash } from "node:crypto";

import { z } from "zod";

import { placementRoughRanges } from "./placementEngine";

export const DRAFT_RANKER_TARGET_SEASON_ID = 20262027;
export const DRAFT_RANKER_SCHEMA_VERSION = 1;
export const DRAFT_RANKER_CONSENT_POLICY_VERSION =
  "draft-ranker-community-v1";

export const operationContextSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export type DraftRankerOperationContext = z.infer<
  typeof operationContextSchema
>;

const scoringProfileSchema = z
  .record(z.unknown())
  .refine(
    (value) => JSON.stringify(value).length <= 16_384,
    "scoringProfile must be 16 KB or smaller",
  );

export const initializeDraftRankingSchema = z
  .object({
    operationId: z.string().uuid(),
    scoringProfile: scoringProfileSchema.optional().default({}),
  })
  .strict();

export type InitializeDraftRankingInput = z.infer<
  typeof initializeDraftRankingSchema
>;

const reorderBaseSchema = z.object({
  operationId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  rankingId: z.string().uuid(),
  playerId: z.number().int().positive(),
});

export const reorderDraftRankingSchema = z.discriminatedUnion("action", [
  reorderBaseSchema.extend({
    action: z.literal("move_to_rank"),
    targetRank: z.number().int().positive(),
  }),
  reorderBaseSchema.extend({
    action: z.literal("insert_above"),
    anchorPlayerId: z.number().int().positive(),
  }),
  reorderBaseSchema.extend({
    action: z.literal("insert_below"),
    anchorPlayerId: z.number().int().positive(),
  }),
  reorderBaseSchema.extend({
    action: z.literal("remove_to_bench"),
  }),
]);

export type ReorderDraftRankingInput = z.infer<
  typeof reorderDraftRankingSchema
>;

export const draftRankingEntriesQuerySchema = z
  .object({
    rankingId: z.string().uuid(),
  })
  .strict();

export type DraftRankingEntriesQuery = z.infer<
  typeof draftRankingEntriesQuerySchema
>;

export const draftPlayerSearchQuerySchema = z
  .object({
    query: z.string().trim().min(2).max(80),
    includeArchived: z.boolean().optional().default(false),
    limit: z.number().int().min(1).max(25).optional().default(20),
  })
  .strict();

export type DraftPlayerSearchQuery = z.infer<
  typeof draftPlayerSearchQuerySchema
>;

export const requestDraftPlayerAdditionSchema = z
  .object({
    rawName: z.string().trim().min(2).max(120),
    organization: z.string().trim().max(120).optional(),
    position: z.string().trim().max(20).optional(),
    notes: z.string().trim().max(500).optional(),
    candidatePlayerIds: z
      .array(z.number().int().positive())
      .max(10)
      .optional()
      .default([]),
  })
  .strict();

export type RequestDraftPlayerAdditionInput = z.infer<
  typeof requestDraftPlayerAdditionSchema
>;

export const draftPlayerActionsQuerySchema = z
  .object({ rankingId: z.string().uuid() })
  .strict();

export const draftPlayerActionSchema = z
  .object({
    rankingId: z.string().uuid(),
    playerId: z.number().int().positive(),
    operationId: z.string().uuid(),
    action: z.enum([
      "watch",
      "unwatch",
      "dismiss",
      "not_relevant",
      "restore",
      "compare_now",
    ]),
    priority: z.number().int().min(1).max(5).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type DraftPlayerActionsQuery = z.infer<
  typeof draftPlayerActionsQuerySchema
>;
export type DraftPlayerActionInput = z.infer<typeof draftPlayerActionSchema>;

export const draftPlacementQuerySchema = z
  .object({
    rankingId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
  })
  .strict()
  .refine((value) => value.rankingId || value.sessionId, {
    message: "rankingId or sessionId is required",
  });

const placementOperationSchema = z.object({
  operationId: z.string().uuid(),
});

export const draftPlacementMutationSchema = z.discriminatedUnion("action", [
  placementOperationSchema.extend({
    action: z.literal("start"),
    rankingId: z.string().uuid(),
    playerId: z.number().int().positive(),
    expectedVersion: z.number().int().nonnegative(),
    roughRange: z.enum(placementRoughRanges),
  }).strict(),
  placementOperationSchema.extend({
    action: z.literal("answer"),
    sessionId: z.string().uuid(),
    outcome: z.enum([
      "target_over_anchor",
      "anchor_over_target",
      "too_close",
      "skip",
    ]),
  }).strict(),
  placementOperationSchema.extend({
    action: z.literal("confirm"),
    sessionId: z.string().uuid(),
  }).strict(),
  placementOperationSchema.extend({
    action: z.literal("cancel"),
    sessionId: z.string().uuid(),
  }).strict(),
]);

export type DraftPlacementQuery = z.infer<typeof draftPlacementQuerySchema>;
export type DraftPlacementMutationInput = z.infer<
  typeof draftPlacementMutationSchema
>;

export const draftContributionPreferenceSchema = z
  .object({
    contributionEnabled: z.boolean(),
    operationId: z.string().uuid(),
  })
  .strict();

export const draftPairPromptIssueSchema = z
  .object({
    rankingId: z.string().uuid(),
    playerAId: z.number().int().positive(),
    playerBId: z.number().int().positive(),
    queueMode: z.string().trim().min(1).max(80),
    queueReason: z.string().trim().min(1).max(240),
    algorithmVersion: z.string().trim().min(1).max(80),
    expectedVersion: z.number().int().nonnegative(),
    operationId: z.string().uuid(),
  })
  .strict()
  .refine((value) => value.playerAId !== value.playerBId, {
    message: "A comparison requires two different players.",
  });

export const draftPairComparisonSchema = z
  .object({
    promptId: z.string().uuid(),
    outcome: z.enum(["low", "high", "too_close", "skip"]),
    expectedVersion: z.number().int().nonnegative(),
    operationId: z.string().uuid(),
  })
  .strict();

export const draftPairQueueModes = [
  "improve_ranking",
  "find_sleepers",
  "place_rookies",
  "review_goalies",
  "resolve_close_calls",
  "quick_five",
] as const;

export const draftPairQueueSchema = z
  .object({
    rankingId: z.string().uuid(),
    mode: z.enum(draftPairQueueModes).default("improve_ranking"),
    expectedVersion: z.number().int().nonnegative(),
    operationId: z.string().uuid(),
  })
  .strict();

export type DraftContributionPreferenceInput = z.infer<
  typeof draftContributionPreferenceSchema
>;
export type DraftPairPromptIssueInput = z.infer<
  typeof draftPairPromptIssueSchema
>;
export type DraftPairComparisonInput = z.infer<
  typeof draftPairComparisonSchema
>;
export type DraftPairQueueInput = z.infer<typeof draftPairQueueSchema>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
}

export function operationPayloadHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}
