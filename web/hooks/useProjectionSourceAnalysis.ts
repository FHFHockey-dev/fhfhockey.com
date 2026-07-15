// hooks/useProjectionSourceAnalysis.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProcessedPlayer } from "./useProcessedProjectionsData";

export type SourceControl = {
  id: string; // e.g., "custom_csv" or builtin ids
  label: string;
  enabled: boolean;
  weight: number; // scalar 0.0-2.0; durable preferences belong to the dashboard owner
};

export type SourceControlsState = {
  controls: SourceControl[];
  effectiveShares: Record<string, number>; // normalized shares per enabled source
};

export function useProjectionSourceAnalysis(
  initialSources: { id: string; label: string }[]
) {
  const [controls, setControls] = useState<SourceControl[]>(() => {
    return initialSources.map((s) => ({
      id: s.id,
      label: s.label,
      enabled: true,
      weight: 1
    }));
  });

  // Keep last non-zero weight so re-enabling restores prior intent
  const lastNonZeroWeightRef = useRef<Record<string, number>>({});
  useEffect(() => {
    controls.forEach((c) => {
      if (c.weight > 0) lastNonZeroWeightRef.current[c.id] = c.weight;
    });
  }, [controls]);

  // Ensure any new sources appear with defaults
  useEffect(() => {
    setControls((prev) => {
      const map = new Map(prev.map((c) => [c.id, c] as const));
      let changed = false;
      for (const s of initialSources) {
        if (!map.has(s.id)) {
          map.set(s.id, { id: s.id, label: s.label, enabled: true, weight: 0 });
          changed = true;
        } else {
          const curr = map.get(s.id)!;
          if (curr.label !== s.label) {
            map.set(s.id, { ...curr, label: s.label });
            changed = true;
          }
        }
      }
      // Remove missing sources
      const initialIds = new Set(initialSources.map((s) => s.id));
      for (const id of Array.from(map.keys())) {
        if (!initialIds.has(id)) {
          map.delete(id);
          changed = true;
        }
      }
      return changed ? Array.from(map.values()) : prev;
    });
  }, [initialSources]);

  const MIN_ENABLED_WEIGHT = 0.1;
  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setControls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (enabled) {
          const restore = lastNonZeroWeightRef.current[id];
          const nextWeight =
            restore && restore > 0 ? restore : MIN_ENABLED_WEIGHT;
          return { ...c, enabled: true, weight: nextWeight };
        }
        return { ...c, enabled: false, weight: 0 };
      })
    );
  }, []);

  const setWeight = useCallback((id: string, weight: number) => {
    const scalar = Math.max(0, Math.min(2, weight));
    setControls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          weight: scalar,
          enabled: scalar > 0 ? true : false
        };
      })
    );
  }, []);

  const removeSource = useCallback((id: string) => {
    setControls((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const effectiveShares = useMemo(() => {
    // Early exit for zero-length
    if (!controls.length) return {} as Record<string, number>;
    let total = 0;
    for (let i = 0; i < controls.length; i++) {
      const c = controls[i];
      if (c.enabled && c.weight > 0) total += c.weight;
    }
    if (total <= 0) {
      const zeroShares: Record<string, number> = {};
      controls.forEach((c) => (zeroShares[c.id] = 0));
      return zeroShares;
    }
    const shares: Record<string, number> = {};
    for (let i = 0; i < controls.length; i++) {
      const c = controls[i];
      shares[c.id] = c.enabled && c.weight > 0 ? c.weight / total : 0;
    }
    return shares;
  }, [controls]);

  return {
    controls,
    setEnabled,
    setWeight,
    removeSource,
    effectiveShares
  } as const;
}
