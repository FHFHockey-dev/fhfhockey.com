import type { DraftProAccessInput } from "./access";

export const draftProAccessFixtures: Record<"unauthenticated" | "purchase" | "stalePatreon", DraftProAccessInput> = {
  unauthenticated: { now: new Date("2026-09-07T00:00:00Z"), userId: null, entitlements: [], patreonVerificationAvailable: true, flags: { checkout: false, recommendations: false, dust: false, blended_csv: false, saved_drafts: false, private_imports: false, scenarios: false, reports: false } },
  purchase: { now: new Date("2026-09-07T00:00:00Z"), userId: "00000000-0000-4000-8000-000000000001", entitlements: [{ source: "purchase", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2027-07-01T04:00:00Z" }], patreonVerificationAvailable: true, flags: { checkout: false, recommendations: true, dust: true, blended_csv: true, saved_drafts: true, private_imports: true, scenarios: true, reports: true } },
  stalePatreon: { now: new Date("2026-09-07T02:00:00Z"), userId: "00000000-0000-4000-8000-000000000001", entitlements: [{ source: "patreon", status: "active", effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2026-10-01T00:00:00Z", verifiedAt: "2026-09-07T00:00:00Z" }], patreonVerificationAvailable: true, flags: { checkout: false, recommendations: true, dust: true, blended_csv: true, saved_drafts: true, private_imports: true, scenarios: true, reports: true } },
};
