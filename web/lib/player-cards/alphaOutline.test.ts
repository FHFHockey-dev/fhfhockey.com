import { expect, it } from "vitest";
import { alphaOutlinePixels, outlineInks, outlineBandPixels, stackedOutlinePixels } from "./alphaOutline";
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
  const inks = outlineInks("MIN").filter(option => option.id !== "stacked" && option.id !== "custom");
  expect(inks.map(({ id, color }) => [id, color])).toEqual([["white", "#FFFFFF"], ["primary", "#154734"], ["jersey", "#A6192E"], ["secondary", "#DDCBA4"]]);
  expect(outlineInks("unknown").map(option => option.id)).toEqual(["white", "custom"]);
  const input = frame(); opaque(input, 50, 50); const baseline = alphaOutlinePixels(input, 100, 100);
  for (const ink of inks) {
    const colored = alphaOutlinePixels(input, 100, 100, 10, ink.color);
    expect([...colored].filter((_, i) => i % 4 === 3)).toEqual([...baseline].filter((_, i) => i % 4 === 3));
    expect([...colored.slice((50 * 100 + 60) * 4, (50 * 100 + 60) * 4 + 3)]).toEqual([1, 3, 5].map(start => parseInt(ink.color.slice(start, start + 2), 16)));
  }
});
it("partitions genuine 5/10/15px disk dilation differences into three consecutive 5px bands", () => {
  const size = 200, input = frame(size), option = outlineInks("MIN").find(option => option.id === "stacked")!;
  expect(option.bands).toEqual(["#154734", "#A6192E", "#DDCBA4"]);
  for (let y = 40; y < 160; y++) for (let x = 80; x < 160; x++) opaque(input, x, y, size);
  const before = new Uint8ClampedArray(input), result = stackedOutlinePixels(input, size, size, option.bands!);
  const reading = (x: number) => [...result.slice((100 * size + x) * 4, (100 * size + x) * 4 + 4)];
  for (let x = 50; x < 60; x++) expect(reading(x)).toEqual([221,203,164,255]);
  for (let x = 60; x < 70; x++) expect(reading(x)).toEqual([166,25,46,255]);
  for (let x = 70; x < 80; x++) expect(reading(x)).toEqual([21,71,52,255]);
  expect(reading(49)).toEqual([0,0,0,0]); expect(reading(80)).toEqual([0,0,0,0]); expect(input).toEqual(before);
});
it("keeps antialiased band transitions opaque without overlap gaps and clips only at the final frame", () => {
  const size = 200, input = frame(size); opaque(input, 100, 100, size);
  const colors = ["#154734", "#A6192E", "#DDCBA4"], result = stackedOutlinePixels(input, size, size, colors);
  const pixel = (x: number, y: number) => [...result.slice((y * size + x) * 4, (y * size + x) * 4 + 4)];
  expect(pixel(110, 102)[3]).toBe(255); expect(pixel(110, 102)[0]).toBeGreaterThan(21); expect(pixel(110, 102)[0]).toBeLessThan(166);
  expect(pixel(130, 100)).toEqual([221,203,164,255]); expect(pixel(131, 100)[3]).toBe(0); expect(pixel(130, 130)[3]).toBe(0);
  expect(pixel(130, 105)[3]).toBeGreaterThan(0); expect(pixel(130, 105)[3]).toBeLessThan(255);
  expect(() => stackedOutlinePixels(input, size, size, ["#154734", "#154734", "#DDCBA4"])).toThrow("colors");
});
it("preserves wide alpha holes and excludes soft interior pixels in stacked mode", () => {
  const size = 200, input = frame(size);
  for (let y = 10; y < 190; y++) for (let x = 10; x < 190; x++) if (x < 60 || x >= 140 || y < 60 || y >= 140) opaque(input, x, y, size);
  opaque(input, 30, 100, size, 200);
  const output = stackedOutlinePixels(input, size, size, ["#154734", "#A6192E", "#DDCBA4"]);
  expect(alpha(output, 100, 100, size)).toBe(0); expect(alpha(output, 60, 100, size)).toBe(255); expect(alpha(output, 30, 100, size)).toBe(0);
});

it("uses cumulative independently sized bands and keeps the fixed preset pixel-identical", () => {
  const size = 200, input = frame(size); for (let y = 40; y < 160; y++) for (let x = 80; x < 160; x++) opaque(input, x, y, size);
  const rings = [{ color: "#154734", width: 2 }, { color: "#A6192E", width: 7 }, { color: "#DDCBA4", width: 3.5 }];
  const output = outlineBandPixels(input, size, size, rings), pixel = (x: number) => [...output.slice((100 * size + x) * 4, (100 * size + x) * 4 + 4)];
  for (let x = 76; x < 80; x++) expect(pixel(x)).toEqual([21,71,52,255]);
  for (let x = 62; x < 76; x++) expect(pixel(x)).toEqual([166,25,46,255]);
  for (let x = 55; x < 62; x++) expect(pixel(x)).toEqual([221,203,164,255]);
  expect(pixel(54)[3]).toBe(0);
  const colors = rings.map(r => r.color);
  expect(outlineBandPixels(input, size, size, colors.map(color => ({ color, width: 5 })))).toEqual(stackedOutlinePixels(input, size, size, colors));
  expect(outlineBandPixels(input, size, size, [{ color: "#FFFFFF", width: 5 }])).toEqual(alphaOutlinePixels(input, size, size));
  expect(outlineBandPixels(input, size, size, []).every(v => v === 0)).toBe(true);
  expect(() => outlineBandPixels(input, size, size, [{ color: "#FFFFFF", width: Infinity }])).toThrow("width");
});
