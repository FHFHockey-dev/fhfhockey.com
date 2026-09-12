import { estimatePlayerAvailability, type SelectionHorizon } from "./availability";

export type TierPlayer = { id: string; name: string; value: number | null; adp?: number | null };
export type ValueBand = { tier: number | null; players: TierPlayer[]; min: number; max: number };
export type PositionTiers = { position: string; bands: ValueBand[]; missing: TierPlayer[]; breakThreshold: number };

function quantile(sorted: number[], fraction: number) {
  const index = (sorted.length - 1) * fraction;
  const lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
}

/** Exact contiguous 1-D k-means; tied values cannot be split. */
function cluster(values: number[]) {
  const n = values.length;
  const unique = new Set(values).size;
  if (n < 4 || unique === 1) return [[0, n]];
  // Translation/scaling preserves partitions and improves prefix-sum precision.
  const scale = values[n - 1] - values[0];
  const x = values.map(value => (value - values[0]) / scale);
  const sums = new Float64Array(n + 1), squares = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { sums[i + 1] = sums[i] + x[i]; squares[i + 1] = squares[i] + x[i] ** 2; }
  const cost = (a: number, b: number) => Math.max(0, squares[b] - squares[a] - (sums[b] - sums[a]) ** 2 / (b - a));
  const maxK = Math.min(8, unique, n - 1);
  let previous = new Float64Array(n + 1).fill(Infinity); previous[0] = 0;
  const splits: Int32Array[] = [new Int32Array(n + 1)];
  let bestScore = -Infinity, best: number[][] = [[0, n]];
  for (let k = 1; k <= maxK; k++) {
    const next = new Float64Array(n + 1).fill(Infinity);
    const split = new Int32Array(n + 1);
    for (let end = k; end <= n; end++) {
      if (end < n && values[end] === values[end - 1]) continue;
      for (let start = k - 1; start < end; start++) {
        if (start > 0 && values[start] === values[start - 1]) continue;
        const candidate = previous[start] + cost(start, end);
        if (candidate < next[end]) { next[end] = candidate; split[end] = start; }
      }
    }
    splits.push(split); previous = next;
    if (k < 2 || !Number.isFinite(next[n])) continue;
    const groups: number[][] = [];
    let end = n;
    for (let count = k; count > 0; count--) { const start = splits[count][end]; groups.unshift([start, end]); end = start; }
    let silhouette = 0;
    groups.forEach(([start, stop], group) => {
      if (stop - start === 1) return; // Defined as zero for a singleton.
      for (let i = start; i < stop; i++) {
        const within = (x[i] * (i - start) - (sums[i] - sums[start]) + (sums[stop] - sums[i + 1]) - x[i] * (stop - i - 1)) / (stop - start - 1);
        let between = Infinity;
        for (const neighbor of [groups[group - 1], groups[group + 1]]) {
          if (neighbor) between = Math.min(between, Math.abs((sums[neighbor[1]] - sums[neighbor[0]]) / (neighbor[1] - neighbor[0]) - x[i]));
        }
        silhouette += Math.max(within, between) > 0 ? (between - within) / Math.max(within, between) : 0;
      }
    });
    silhouette /= n;
    if (silhouette > bestScore + 1e-9) { bestScore = silhouette; best = groups; }
  }
  // Silhouette finds broad structure, but can merge the entire draftable pool.
  // Refine wide bands at their minimum-SSE boundary so comparable value stays
  // local. This width is a product heuristic, independent of cliff detection.
  const tight: number[][] = [];
  const refine = (start: number, end: number) => {
    if (x[end - 1] - x[start] <= 0.05 + 1e-12) {
      tight.push([start, end]);
      return;
    }
    let boundary = start + 1, bestCost = Infinity;
    for (let split = start + 1; split < end; split++) {
      if (values[split] === values[split - 1]) continue;
      const candidate = cost(start, split) + cost(split, end);
      if (candidate < bestCost) { bestCost = candidate; boundary = split; }
    }
    refine(start, boundary);
    refine(boundary, end);
  };
  best.forEach(([start, end]) => refine(start, end));
  return tight;
}

export function buildPositionTiers(position: string, input: readonly TierPlayer[]): PositionTiers {
  const players = [...new Map(input.map(player => [player.id, player])).values()];
  const valid = players.filter(player => typeof player.value === "number" && Number.isFinite(player.value)).sort((a, b) => a.value! - b.value! || a.id.localeCompare(b.id));
  const missing = players.filter(player => player.value == null || !Number.isFinite(player.value));
  if (!valid.length) return { position, bands: [], missing, breakThreshold: Infinity };
  const values = valid.map(player => player.value!);
  const gaps = values.slice(1).map((value, index) => value - values[index]).sort((a, b) => a - b);
  const breakThreshold = Math.max(gaps.length ? 3 * quantile(gaps, 0.5) : 0, 0.25 * (quantile(values, 0.75) - quantile(values, 0.25)));
  const bands = cluster(values).reverse().map(([start, end], index) => ({ tier: valid.length < 4 ? null : index + 1, players: valid.slice(start, end).reverse(), min: values[start], max: values[end - 1] }));
  return { position, bands, missing, breakThreshold };
}

export function remainingBands(tiers: PositionTiers, available: ReadonlySet<string>) {
  const bands = tiers.bands.map(band => ({ ...band, remaining: band.players.filter(player => available.has(player.id)) }));
  return bands.map((band, index) => {
    const lower = bands.slice(index + 1).find(other => other.remaining.length);
    const gap = band.remaining.length && lower ? band.remaining[band.remaining.length - 1].value! - lower.remaining[0].value! : null;
    return { ...band, gap, meaningfulBreak: band.tier !== null && gap !== null && gap > tiers.breakThreshold };
  });
}

export function advisePosition(tiers: PositionTiers, available: ReadonlySet<string>, horizon: SelectionHorizon | null, spread: number, onClock: boolean, openSlot: boolean, contextReady = true) {
  const band = remainingBands(tiers, available).find(item => item.remaining.length);
  const estimates = band?.remaining.map(player => estimatePlayerAvailability(player.adp, horizon, spread)) ?? [];
  const incomplete = tiers.missing.some(player => available.has(player.id)) || estimates.some(value => value === null);
  const expected = estimates.length && !incomplete ? estimates.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  let label = "Uncertain";
  if (!contextReady) label = "Draft context unavailable";
  else if (!horizon) label = onClock ? "No later pick" : "No upcoming pick";
  else if (!openSlot) label = "No open starting slot";
  else if (band?.tier !== null && band && expected !== null) {
    if (!onClock) label = "Next-turn preview";
    else if (horizon.opposingPicks === 0 || (expected >= 1.5 && band.gap !== null)) label = "Can wait";
    else if (expected < 0.5 && band.meaningfulBreak) label = "Take now";
  }
  return { label, expected, band, targetPick: horizon?.targetPick ?? null };
}
