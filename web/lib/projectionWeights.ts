// web/lib/projectionWeights.ts
// Helper utilities for projection source weight management (0-100 integer percentage model).

/** Evenly distribute 100 across count buckets using integer weights.
 * Deterministic: earlier indices get +1 when remainder exists.
 */
export function evenlyDistribute(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  const arr = new Array(count).fill(base);
  for (let i = 0; i < remainder; i++) arr[i] += 1;
  return arr;
}

/** Normalize an array of integer weights so they sum to 100 preserving anchor index value exactly.
 * Other weights scaled proportionally then rounded (largest absorbs drift).
 */
export function normalizeWithAnchor(
  weights: number[],
  anchorIndex: number
): number[] {
  if (!weights.length) return [];
  if (anchorIndex < 0 || anchorIndex >= weights.length) anchorIndex = 0;
  const anchorVal = weights[anchorIndex];
  const othersTotal = weights.reduce(
    (a, w, i) => (i === anchorIndex ? a : a + w),
    0
  );
  const remaining = Math.max(0, 100 - anchorVal);
  if (othersTotal <= 0) {
    // All weight assigned to anchor (cap at 100) and zeros elsewhere
    const out = new Array(weights.length).fill(0);
    out[anchorIndex] = Math.min(100, anchorVal || 100);
    return out;
  }
  const scaled: number[] = [];
  let running = 0;
  const lastOtherIndex = weights
    .map((_, i) => i)
    .filter((i) => i !== anchorIndex)
    .slice(-1)[0];
  for (let i = 0; i < weights.length; i++) {
    if (i === anchorIndex) {
      scaled[i] = anchorVal;
      continue;
    }
    if (i === lastOtherIndex) {
      scaled[i] = Math.max(0, remaining - running);
    } else {
      const raw = (weights[i] / othersTotal) * remaining;
      const val = Math.floor(raw);
      scaled[i] = val;
      running += val;
    }
  }
  // Adjust for any rounding drift (rare if anchor > 100 scenario handled above)
  let sum = scaled.reduce((a, b) => a + b, 0);
  const drift = 100 - sum;
  if (drift !== 0) {
    // Apply drift to the largest non-anchor (or anchor if all zeros)
    const candidates = scaled
      .map((w, i) => [w, i] as const)
      .filter(([, i]) => i !== anchorIndex)
      .sort((a, b) => b[0] - a[0]);
    const target = candidates[0]?.[1] ?? anchorIndex;
    scaled[target] = Math.max(0, scaled[target] + drift);
  }
  return scaled;
}

/** Convenience: normalize without preserving any specific anchor (anchor first enabled). */
export function normalize(weights: number[]): number[] {
  const anchor =
    weights.findIndex((w) => w > 0) !== -1
      ? weights.findIndex((w) => w > 0)
      : 0;
  return normalizeWithAnchor(weights, anchor);
}
