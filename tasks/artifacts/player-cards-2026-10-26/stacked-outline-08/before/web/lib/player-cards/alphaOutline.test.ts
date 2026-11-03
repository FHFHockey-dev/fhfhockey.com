import { expect, it } from "vitest";
import { alphaOutlinePixels, outlineInks } from "./alphaOutline";
const frame = (size = 100) => new Uint8ClampedArray(size * size * 4);
const alpha = (p: Uint8ClampedArray, x: number, y: number, size = 100) => p[(y * size + x) * 4 + 3];
const opaque = (p: Uint8ClampedArray, x: number, y: number, size = 100, a = 255) => p.set([35, 80, 24, a], (y * size + x) * 4);
it("keeps fully transparent background transparent without a rectangular border or input mutation", () => {
  const input = frame(); input[0] = 255; const before = new Uint8ClampedArray(input);
  expect(alphaOutlinePixels(input, 100, 100).every(value => value === 0)).toBe(true); expect(input).toEqual(before);
});
it("makes a ten-raster-pixel/five-design-pixel outward ring, with no opaque interior paint", () => {
  const input = frame(); for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) opaque(input, x, y);
  const result = alphaOutlinePixels(input, 100, 100);
  expect(alpha(result, 20, 50)).toBe(255); expect(alpha(result, 19, 50)).toBe(0); expect(alpha(result, 79, 50)).toBe(255); expect(alpha(result, 80, 50)).toBe(0);
  expect(alpha(result, 50, 20)).toBe(255); expect(alpha(result, 50, 19)).toBe(0); expect(alpha(result, 30, 50)).toBe(0); expect(alpha(result, 50, 50)).toBe(0);
  expect([...result.slice((50 * 100 + 20) * 4, (50 * 100 + 20) * 4 + 4)]).toEqual([255,255,255,255]);
});
it("uses a Euclidean disk rather than a box dilation and antialiases its outer boundary", () => {
  const input = frame(); opaque(input, 50, 50); const result = alphaOutlinePixels(input, 100, 100);
  expect(alpha(result, 60, 50)).toBe(255); expect(alpha(result, 57, 57)).toBe(255); expect(alpha(result, 60, 60)).toBe(0);
  const edge = alpha(result, 59, 55); expect(edge).toBeGreaterThan(0); expect(edge).toBeLessThan(255);
});
it("respects antialiased source edges and retains holes wider than twice the stroke", () => {
  const input = frame(); for (let y = 10; y < 90; y++) for (let x = 10; x < 90; x++) if (x < 30 || x >= 70 || y < 30 || y >= 70) opaque(input, x, y);
  opaque(input, 9, 50, 100, 64); opaque(input, 20, 50, 100, 200); const result = alphaOutlinePixels(input, 100, 100);
  expect(alpha(result, 9, 50)).toBe(191); expect(alpha(result, 30, 50)).toBe(255); expect(alpha(result, 50, 50)).toBe(0);
  expect(alpha(input, 9, 50)).toBe(64);
  expect(alpha(result, 20, 50)).toBe(0);
});
it("pads the true contour separately from final card clipping and rejects unbounded inputs", () => {
  const input = frame(); opaque(input, 11, 11); const result = alphaOutlinePixels(input, 100, 100);
  expect(alpha(result, 0, 11)).toBe(0); expect(alpha(result, 1, 11)).toBe(255); expect(alpha(result, 11, 0)).toBe(0);
  expect(() => alphaOutlinePixels(frame(), 100, 99)).toThrow("dimensions"); expect(() => alphaOutlinePixels(frame(), 100, 100, 50)).toThrow("radius");
});
it("uses only distinct actual team palette colors and preserves exactly the same alpha ring", () => {
  const inks = outlineInks("MIN");
  expect(inks.map(({ id, color }) => [id, color])).toEqual([["white", "#FFFFFF"], ["primary", "#154734"], ["jersey", "#A6192E"], ["secondary", "#DDCBA4"]]);
  expect(outlineInks("unknown").map(option => option.id)).toEqual(["white"]);
  const input = frame(); opaque(input, 50, 50); const baseline = alphaOutlinePixels(input, 100, 100);
  for (const ink of inks) {
    const colored = alphaOutlinePixels(input, 100, 100, 10, ink.color);
    expect([...colored].filter((_, i) => i % 4 === 3)).toEqual([...baseline].filter((_, i) => i % 4 === 3));
    expect([...colored.slice((50 * 100 + 60) * 4, (50 * 100 + 60) * 4 + 3)]).toEqual([1, 3, 5].map(start => parseInt(ink.color.slice(start, start + 2), 16)));
  }
});
