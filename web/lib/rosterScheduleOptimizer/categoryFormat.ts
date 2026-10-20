import type { CategorySwapRow } from "./planning";

/** Category display units, shared by the category gains panel and candidate cards. Percentage ratios (SH%, SV%, FO%, PP%)
 * read as one-decimal percentages with changes in percentage points; other ratios (rates such as GAA) use two decimals;
 * counting categories keep the caller's count format. Display only: values are never rounded before comparison. */
export function categoryFormatter(category: Pick<CategorySwapRow, "key" | "ratio" | "multiplier">, count: (value: number) => string) {
  const signed = (value: number, text: string) => `${value > 0 ? "+" : ""}${text}`;
  if (!category.ratio) return { value: count, delta: (value: number) => signed(value, count(value)) };
  if (category.key.trim().endsWith("%")) {
    // A league multiplier of 100 already expresses the ratio in percent.
    const scale = category.multiplier >= 100 ? 1 : 100;
    return { value: (value: number) => `${(value * scale).toFixed(1)}%`, delta: (value: number) => signed(value, `${(value * scale).toFixed(1)} pts`) };
  }
  return { value: (value: number) => value.toFixed(2), delta: (value: number) => signed(value, value.toFixed(2)) };
}
