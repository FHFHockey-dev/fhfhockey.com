/** Types for the byte-identical retained reference, not a current provider SDK. */
export type ReferenceSource = { id: string; text: string; authorId: string; url: string; publishedAt: string; ingestedAt: string };
export type ReferenceClaim = { id: string; sourceId: string; playerId: string; statement: string; sourceSpan: { start: number; end: number; quote: string } };
export type ReferenceInput = { source: ReferenceSource; claims: ReferenceClaim[]; extractionVersion: string };
export type ReferenceQuestion = { type: "predicate" | "choice"; name: string; instructions: string; choices?: { value: string; description: string }[] };
export type ReferenceRequest = { model: string; input: string; questions: ReferenceQuestion[] };
export const MODEL: string;
export const PROMPT_VERSION: string;
export const DEFAULT_CONFIG: Readonly<{ enabled: boolean; maxRequests: number; maxInputTokens: number; maxEstimatedUsd: number; maxInputBytesPerRequest: number; maxReservedTokensPerRequest: number; timeoutMs: number; usdPerMillionInputTokens: number; billingMultiplier: number }>;
export function buildRequest(input: ReferenceInput): { request: ReferenceRequest; evidence: { extractionVersion: string; source: ReferenceSource; claims: (ReferenceClaim & { index: number; inputIndex: number })[] }; invalidClaims: unknown[] };
export function createShadowAdapter(options?: { config?: Partial<typeof DEFAULT_CONFIG>; transport?: (request: ReferenceRequest, options: { signal: AbortSignal; idempotencyKey: string }) => Promise<{ body: unknown; requestId?: string }>; now?: () => string; calibration?: unknown }): { evaluate(input: unknown): Promise<unknown>; budget(): unknown };
