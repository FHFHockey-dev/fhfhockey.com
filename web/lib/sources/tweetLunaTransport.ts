import { identityDigest } from "./playerIdentitySnapshot";

export const LUNA_MODEL = "gpt-6-luna";
export const LUNA_ENDPOINTS = { responses: "https://api.openai.com/v1/responses", decisions: "https://api.openai.com/v1/decisions" } as const;
export type LunaEndpoint = keyof typeof LUNA_ENDPOINTS;
// Full 1.05M context at long-input rates + 2048 output tokens, regional premium.
// Explicit caching without breakpoints disables caching; unexpected cache usage is held.
export const LUNA_RESERVATION_NANO_USD = 233_000_000;
export const LUNA_MAX_OUTPUT_TOKENS = 2048;
export type LunaReceipt = { body: any; requestId: string | null; endpoint: LunaEndpoint; chargeNanoUsd: number };
export interface LunaAdmissionStore {
  reserve(key: string, amountNanoUsd: number): Promise<{ status: "reserved" } | { status: "replay"; receipt: LunaReceipt }>;
  settle(key: string, receipt: LunaReceipt): Promise<void>;
  uncertain(key: string, requestId?: string | null): Promise<void>;
}

/** Standard rates checked 2026-10-23. Conservative regional ceiling, not invoice attribution. */
export function priceLunaUsage(body: any, endpoint: LunaEndpoint): number {
  const input = body?.usage?.input_tokens, output = endpoint === "decisions" ? 0 : body?.usage?.output_tokens;
  const details = body?.usage?.input_tokens_details;
  if (body?.model !== LUNA_MODEL || !Number.isSafeInteger(input) || input < 0 || input > 1_050_000
    || !Number.isSafeInteger(output) || output < 0 || output > LUNA_MAX_OUTPUT_TOKENS
    || (details?.cached_tokens ?? 0) !== 0 || (details?.cache_write_tokens ?? 0) !== 0
    || (body.service_tier != null && body.service_tier !== "default")) throw new Error("luna_usage_unresolved");
  const long = input > 272_000;
  return Math.ceil((input * (long ? 200 : 100) + output * (long ? 750 : 500)) * 1.1);
}

/** No environment/key lookup, redirect, SDK retries, tools, or implicit endpoint. */
export function createLunaTransport(args: {
  enabled?: boolean; stopped: () => boolean; apiKey: () => string | undefined;
  admission: LunaAdmissionStore; fetch?: typeof fetch; timeoutMs?: number;
}) {
  return async (endpoint: LunaEndpoint, input: Record<string, unknown>, hooks: { onAdmitted?: () => void } = {}): Promise<LunaReceipt> => {
    if (args.enabled !== true || args.stopped()) throw new Error("luna_dispatch_disabled");
    const timeout = args.timeoutMs ?? 15_000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 15_000 || input.model !== LUNA_MODEL
      || typeof input.input !== "string" || (endpoint !== "responses" && endpoint !== "decisions")) throw new Error("invalid_luna_transport_input");
    // Transport controls override input; callers cannot enable tools or server storage.
    const body = endpoint === "responses" ? {
      model: LUNA_MODEL, input: input.input, instructions: input.instructions, text: input.text,
      max_output_tokens: LUNA_MAX_OUTPUT_TOKENS, reasoning: { effort: "none" }, tools: [],
      store: false, service_tier: "default", prompt_cache_options: { mode: "explicit" },
    } : { model: LUNA_MODEL, input: input.input, questions: input.questions, prompt_cache_options: { mode: "explicit" } };
    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized) > 65_536) throw new Error("luna_request_too_large");
    const key = identityDigest({ endpoint, body });
    const admission = await args.admission.reserve(key, LUNA_RESERVATION_NANO_USD);
    if (admission.status === "replay") return admission.receipt;
    // Only a fresh durable reservation is an attempt; refusals and replays reserve nothing.
    hooks.onAdmitted?.();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observedRequestId: string | null = null;
    const controller = new AbortController();
    try {
      // Check again after durable admission. A stop here retains reservation conservatively.
      if (args.stopped()) throw new Error("luna_dispatch_disabled");
      const keyValue = args.apiKey();
      if (!keyValue) throw new Error("luna_existing_access_missing");
      const operation = async () => {
        const response = await (args.fetch ?? globalThis.fetch)(LUNA_ENDPOINTS[endpoint], {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { Authorization: `Bearer ${keyValue}`, "Content-Type": "application/json" }, body: serialized,
        });
        const headerId = response.headers.get("x-request-id");
        observedRequestId = headerId && /^[A-Za-z0-9_-]{1,200}$/.test(headerId) ? headerId : null;
        if (!response.ok || !response.body) throw new Error("luna_provider_failed");
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 262_144) throw new Error("luna_response_too_large");
            chunks.push(part.value);
          }
        } finally { await reader.cancel().catch(() => undefined); }
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const receipt: LunaReceipt = { body: value, requestId: observedRequestId, endpoint,
          chargeNanoUsd: priceLunaUsage(value, endpoint) };
        if (receipt.chargeNanoUsd > LUNA_RESERVATION_NANO_USD) throw new Error("luna_reservation_exceeded");
        return receipt;
      };
      const receipt = await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("luna_timeout")); }, timeout);
      })]);
      await args.admission.settle(key, receipt);
      return receipt;
    } catch {
      controller.abort();
      await args.admission.uncertain(key, observedRequestId);
      throw new Error("luna_attempt_held_no_retry");
    } finally { if (timer) clearTimeout(timer); }
  };
}

export type LunaTransport = ReturnType<typeof createLunaTransport>;
