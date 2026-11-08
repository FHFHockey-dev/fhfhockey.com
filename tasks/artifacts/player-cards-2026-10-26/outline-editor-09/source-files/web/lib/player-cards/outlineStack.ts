import { teamsInfo } from "../teamsInfo";

export const OUTLINE_LIMITS = { rings: 5, minWidth: .5, maxWidth: 12, totalWidth: 40, debounceMs: 250 } as const;
export type OutlineRing = { color: string; width: number };
export type OutlineDraftRing = { id: string; color: string; width: string; colorMode: "preset" | "custom" };
export const outlineTotal = (rings: readonly OutlineRing[]) => rings.reduce((sum, ring) => sum + ring.width, 0);

/** All geometry/allocation entry points validate the same bounded, normalized recipe. */
export function validateOutlineStack(value: readonly OutlineRing[]): OutlineRing[] {
  if (!Array.isArray(value) || value.length > OUTLINE_LIMITS.rings) throw new Error("Use at most 5 outline rings.");
  const rings = value.map(ring => {
    if (!ring || typeof ring.color !== "string" || !/^#[\da-f]{6}$/i.test(ring.color)) throw new Error("Choose a valid color for every ring.");
    if (typeof ring.width !== "number" || !Number.isFinite(ring.width) || ring.width < OUTLINE_LIMITS.minWidth || ring.width > OUTLINE_LIMITS.maxWidth || !Number.isInteger(ring.width * 2)) throw new Error("Each width must be 0.5–12 px, in 0.5 px steps.");
    return { color: ring.color.toUpperCase(), width: ring.width };
  });
  if (outlineTotal(rings) > OUTLINE_LIMITS.totalWidth) throw new Error("Keep the total outline width at 40 px or less.");
  return rings;
}
export const outlineStackKey = (rings: readonly OutlineRing[]) => JSON.stringify(validateOutlineStack(rings));
export function readOutlineDraft(draft: readonly OutlineDraftRing[]): { rings: OutlineRing[] | null; error: string } {
  try { return { rings: validateOutlineStack(draft.map(ring => ({ color: ring.color, width: ring.width.trim() ? Number(ring.width) : NaN }))), error: "" }; }
  catch (error) { return { rings: null, error: error instanceof Error ? error.message : "Check the outline stack." }; }
}
export function teamOutlineColors(team: string): { id: string; label: string; color: string }[] {
  const palette = teamsInfo[team], result = [{ id: "white", label: "White · #FFFFFF", color: "#FFFFFF" }];
  for (const [id, label, color] of [["primary", "Primary", palette?.primaryColor], ["jersey", "Jersey", palette?.jersey], ["secondary", "Secondary", palette?.secondaryColor], ["accent", "Accent", palette?.accent]] as const) {
    if (typeof color === "string" && /^#[\da-f]{6}$/i.test(color) && !result.some(option => option.color.toUpperCase() === color.toUpperCase())) result.push({ id, label: `${label} · ${color}`, color: color.toUpperCase() });
  }
  return result;
}
export function defaultOutlineStack(team: string): OutlineRing[] {
  const p = teamsInfo[team], colors = [p?.primaryColor, p?.jersey, p?.secondaryColor].filter((c): c is string => typeof c === "string" && /^#[\da-f]{6}$/i.test(c));
  return colors.length === 3 && new Set(colors.map(c => c.toUpperCase())).size === 3 ? colors.map(color => ({ color: color.toUpperCase(), width: 5 })) : [{ color: "#FFFFFF", width: 5 }];
}
export function moveOutlineRing(draft: readonly OutlineDraftRing[], index: number, direction: -1 | 1): OutlineDraftRing[] {
  const target = index + direction, next = [...draft];
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]]; return next;
}
