import { useEffect, useMemo, useState } from "react";

import { buildPersonalizedRecommendations, type RecommendationCandidate, type RecommendationOptions, type RecommendationResult } from "lib/draft-pro/recommendations";
import { draftProRecommendationsInputSchema } from "lib/draft-pro/recommendationsContract";
import supabase from "lib/supabase/client";

type Input = RecommendationOptions & { candidates: RecommendationCandidate[]; dataOrigin: "server" | "local_csv" | "private_import" };

export function useDraftProRecommendations(input: Input | null, enabled: boolean) {
  const [state, setState] = useState<{ key: string | null; status: "idle" | "loading" | "ready" | "error"; results: RecommendationResult[] | null; error: string | null }>({ key: null, status: "idle", results: null, error: null });
  const body = useMemo(() => input ? JSON.stringify(input) : null, [input]);

  useEffect(() => {
    if (!enabled || !body) {
      setState({ key: body, status: "idle", results: null, error: null });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setState({ key: body, status: "loading", results: null, error: null });
        const session = (await supabase.auth.getSession()).data.session;
        if (controller.signal.aborted) return;
        if (!session?.access_token) throw new Error("Sign in to use Draft Pro recommendations.");
        const localInput = JSON.parse(body) as Input;
        const isPrivate = localInput.dataOrigin !== "server";
        // Validate locally without transmitting private player names or statistics.
        if (isPrivate) draftProRecommendationsInputSchema.parse(localInput);
        const response = await fetch("/api/v1/draft-pro/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: isPrivate ? JSON.stringify({ dataOrigin: localInput.dataOrigin, authorizeOnly: true }) : body,
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? "Draft Pro recommendations are unavailable.");
        if (controller.signal.aborted) return;
        if (isPrivate && payload.data.authorized !== true) throw new Error("Draft Pro access could not be verified.");
        const results = isPrivate
          ? buildPersonalizedRecommendations(localInput.candidates, localInput)
          : payload.data as RecommendationResult[];
        setState({ key: body, status: "ready", results, error: null });
      })().catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ key: body, status: "error", results: null, error: error instanceof Error ? error.message : "Draft Pro recommendations are unavailable." });
      });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [body, enabled]);

  return enabled && state.key === body
    ? state
    : { key: body, status: enabled && body ? "loading" as const : "idle" as const, results: null, error: null };
}
