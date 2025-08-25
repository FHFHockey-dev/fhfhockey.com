// hooks/useProjectionSourceAnalysis.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProcessedPlayer } from "./useProcessedProjectionsData";
import { PROJECTION_SOURCES_CONFIG } from "lib/projectionsConfig/projectionSourcesConfig";

export type SourceControl = {
  id: string; // e.g., "custom_csv" or builtin ids
  label: string;
  enabled: boolean;
  weight: number; // 0.0 - 2.0 (0 means disabled)
};

export type SourceControlsState = {
  controls: SourceControl[];
  effectiveShares: Record<string, number>; // normalized shares per enabled source
};

const LOCAL_KEY = "draft.sourceControls.v1" as const;

export function useProjectionSourceAnalysis(
  initialSources: { id: string; label: string }[]
) {
  const [controls, setControls] = useState<SourceControl[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialSources.map((s) => ({
      id: s.id,
      label: s.label,
      enabled: true,
      weight: 1
    }));
  });

  // Ensure any new sources appear with defaults
  useEffect(() => {
    setControls((prev) => {
      const map = new Map(prev.map((c) => [c.id, c] as const));
      let changed = false;
      for (const s of initialSources) {
        if (!map.has(s.id)) {
          map.set(s.id, { id: s.id, label: s.label, enabled: true, weight: 1 });
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

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(controls));
    } catch {}
  }, [controls]);

  const setEnabled = useCallback((id: string, enabled: boolean) => {
    setControls((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, enabled, weight: enabled ? Math.max(0.1, c.weight) : 0 }
          : c
      )
    );
  }, []);

  const setWeight = useCallback((id: string, weight: number) => {
    setControls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, weight, enabled: weight > 0 } : c))
    );
  }, []);

  const removeSource = useCallback((id: string) => {
    setControls((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const effectiveShares = useMemo(() => {
    const weights = controls.map((c) =>
      c.enabled && c.weight > 0 ? c.weight : 0
    );
    const total = weights.reduce((a, b) => a + b, 0);
    const shares: Record<string, number> = {};
    for (const c of controls) {
      const w = c.enabled && c.weight > 0 ? c.weight : 0;
      shares[c.id] = total > 0 ? w / total : 0;
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
