import { z } from "zod";

export const DRAFT_PRO_SEASON = "draft_pro_2026_27" as const;
export const DRAFT_PRO_EXPIRATION = "2027-07-01T04:00:00.000Z" as const;
export const DRAFT_PRO_SCHEMA_VERSION = 1 as const;
export const DRAFT_PRO_ENTITLEMENT_KEY = "draft_pro" as const;
// Patreon keeps its existing, anti-transfer supporter row. It grants Draft Pro
// only when its server-written metadata records configured-campaign eligibility.
export const DRAFT_PRO_PATREON_ENTITLEMENT_KEY = "patreon_supporter" as const;
export const DRAFT_PRO_PRICE_CENTS = 599 as const;
export const DRAFT_PRO_MAX_SAVED_DRAFTS = 10 as const;
export const DRAFT_PRO_MAX_PRIVATE_IMPORT_BYTES = 10 * 1024 * 1024;
export const DRAFT_PRO_MAX_ACCOUNT_IMPORT_BYTES = 100 * 1024 * 1024;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

const boundedJson = (maxBytes: number) =>
  jsonValueSchema.refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes,
    `JSON payload must be ${maxBytes} bytes or smaller`,
  );

export const draftProCapabilitySchema = z.enum([
  "recommendations",
  "dust",
  "blended_csv",
  "saved_drafts",
  "private_imports",
  "scenarios",
  "reports",
  "god_view",
  "mock_draft_advanced",
]);
export type DraftProCapability = z.infer<typeof draftProCapabilitySchema>;

export const draftProEligibilityReasonSchema = z.enum([
  "eligible",
  "authentication_required",
  "no_active_grant",
  "expired",
  "verification_unavailable",
  "feature_disabled",
  "provider_not_ready",
]);
export type DraftProEligibilityReason = z.infer<
  typeof draftProEligibilityReasonSchema
>;

export const draftProAccessSchema = z
  .object({
    eligible: z.boolean(),
    grantingSources: z.array(z.enum(["purchase", "patreon", "complimentary"])),
    expiresAt: z.string().datetime().nullable(),
    verifiedAt: z.string().datetime().nullable(),
    nextVerificationAt: z.string().datetime().nullable(),
    reason: draftProEligibilityReasonSchema,
    capabilities: z.array(draftProCapabilitySchema),
    providerReadiness: z.object({ stripe: z.boolean(), patreon: z.boolean(), yahoo: z.boolean() }).strict(),
  })
  .strict();
export type DraftProAccess = z.infer<typeof draftProAccessSchema>;

export const draftProSnapshotSchema = z
  .object({
    settings: boundedJson(256 * 1024).default({}),
    picks: z.array(boundedJson(16 * 1024)).max(500).default([]),
    keepers: z.array(boundedJson(16 * 1024)).max(200).default([]),
    trades: z.array(boundedJson(16 * 1024)).max(200).default([]),
    team: boundedJson(64 * 1024).default({}),
    sourceWeights: boundedJson(64 * 1024).default({}),
    importMappings: boundedJson(64 * 1024).default({}),
    favorites: z.array(z.union([z.string().max(100), z.number().int()])).max(1000).default([]),
    notes: z.array(z.object({ id: z.string().max(100), text: z.string().max(5000) }).strict()).max(500).default([]),
    tiers: boundedJson(128 * 1024).default({}),
    recommendationPreferences: boundedJson(64 * 1024).default({}),
  })
  .strict()
  .superRefine((value, context) => {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > DRAFT_PRO_MAX_PRIVATE_IMPORT_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Draft snapshot exceeds 10 MiB." });
    }
  });
export type DraftProSnapshot = z.infer<typeof draftProSnapshotSchema>;

export const saveDraftProDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().nonnegative().optional(),
  snapshot: draftProSnapshotSchema,
}).strict();
export type SaveDraftProDraftInput = z.infer<typeof saveDraftProDraftSchema>;

export const createDraftProRefundRequestSchema = z.object({
  purchaseId: z.string().uuid(),
  reason: z.enum(["accidental_purchase", "technical_issue", "missing_feature", "confusing_experience", "not_useful_for_my_draft", "other"]),
  explanation: z.string().trim().min(10).max(2000),
  improvementNotes: z.string().trim().max(2000).optional(),
  usedDuringLiveDraft: z.boolean().optional(),
}).strict();
export type CreateDraftProRefundRequestInput = z.infer<typeof createDraftProRefundRequestSchema>;

export const draftProScenarioInputSchema = z.object({
  draftId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  sourceFingerprint: z.string().min(1).max(128),
  input: boundedJson(256 * 1024),
}).strict();
export type DraftProScenarioInput = z.infer<typeof draftProScenarioInputSchema>;

export const draftProReportInputSchema = z.object({
  draftId: z.string().uuid().optional(),
  scenarioId: z.string().uuid().optional(),
  reportType: z.enum(["draft_summary", "scenario_comparison"]),
  sourceFingerprint: z.string().min(1).max(128),
  payload: boundedJson(512 * 1024),
}).strict();
export type DraftProReportInput = z.infer<typeof draftProReportInputSchema>;
