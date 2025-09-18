// hooks/useProjectionSourceAnalysis.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProcessedPlayer } from "./useProcessedProjectionsData";

export type SourceControl = {
  id: string; // e.g., "custom_csv" or builtin ids
  label: string;
  enabled: boolean;
  weight: number; // integer 0-100 (0 disables) post-migration
};

export type SourceControlsState = {
  controls: SourceControl[];
  effectiveShares: Record<string, number>; // normalized shares per enabled source
};

const LOCAL_KEY_V3 = "draft.sourceControls.v3" as const;
const LEGACY_KEY_V2 = "draft.sourceControls.v2" as const; // legacy 0-2 float weights

export function useProjectionSourceAnalysis(
  initialSources: { id: string; label: string }[]
) {
  const [controls, setControls] = useState<SourceControl[]>(() => {
    // SSR fallback with even distribution
    if (typeof window === "undefined") {
      const even = initialSources.length
        ? Math.floor(100 / initialSources.length)
        : 0;
      let remainder = 100 - even * initialSources.length;
      return initialSources.map((s) => ({
        id: s.id,
        label: s.label,
        enabled: true,
        weight: even + (remainder-- > 0 ? 1 : 0)
      }));
    }
    try {
      const savedV3 = localStorage.getItem(LOCAL_KEY_V3);
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        if (Array.isArray(parsed)) return parsed as SourceControl[];
      }
      // Attempt migration from legacy v2 (0-2 floats)
      const legacy = localStorage.getItem(LEGACY_KEY_V2);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Array<{
          id: string;
          label: string;
          enabled: boolean;
          weight: number;
        }>;
        if (Array.isArray(parsed) && parsed.length) {
          let legacyTotal = 0;
          parsed.forEach((c) => {
            if (c.enabled && c.weight > 0) legacyTotal += c.weight;
          });
          let migrated: SourceControl[];
          if (legacyTotal > 0) {
            migrated = parsed.map((c) => {
              if (!c.enabled || c.weight <= 0) {
                return { id: c.id, label: c.label, enabled: false, weight: 0 };
              }
              return {
                id: c.id,
                label: c.label,
                enabled: true,
                weight: Math.max(0, Math.round((c.weight / legacyTotal) * 100))
              };
            });
          } else {
            // All zero legacy weights -> even distribution
            const even = parsed.length ? Math.floor(100 / parsed.length) : 0;
            let rem = 100 - even * parsed.length;
            migrated = parsed.map((c) => ({
              id: c.id,
              label: c.label,
              enabled: true,
              weight: even + (rem-- > 0 ? 1 : 0)
            }));
          }
          // Normalize rounding drift
          let sum = migrated.reduce(
            (a, c) => a + (c.enabled ? c.weight : 0),
            0
          );
          if (sum !== 100) {
            const enabledIdx = migrated
              .map((c, idx) => [c, idx] as const)
              .filter(([c]) => c.enabled)
              .sort((a, b) => b[0].weight - a[0].weight)[0]?.[1];
            if (enabledIdx != null) {
              migrated[enabledIdx] = {
                ...migrated[enabledIdx],
                weight: Math.max(0, migrated[enabledIdx].weight + (100 - sum))
              };
            }
          }
          localStorage.setItem(LOCAL_KEY_V3, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch {}
    // Default even distribution
    const even = initialSources.length
      ? Math.floor(100 / initialSources.length)
      : 0;
    let remainder = 100 - even * initialSources.length;
    return initialSources.map((s) => ({
      id: s.id,
      label: s.label,
      enabled: true,
      weight: even + (remainder-- > 0 ? 1 : 0)
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

  // Debounced persistence (avoid thrashing localStorage on slider drags)
  const saveTimerRef = useRef<number | null>(null);
  const prevJsonRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(controls);
    if (json === prevJsonRef.current) return; // no structural change
    prevJsonRef.current = json;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_KEY_V3, json);
      } catch {}
    }, 180);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [controls]);

  const MIN_ENABLED_WEIGHT = 1; // 1% minimum when enabling
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
    setControls((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          weight,
          enabled: weight > 0 ? true : false
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
