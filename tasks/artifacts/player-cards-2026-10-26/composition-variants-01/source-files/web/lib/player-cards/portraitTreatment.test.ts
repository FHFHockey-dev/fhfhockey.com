import { expect, it } from "vitest";
import { portraitPixels, preparePortrait, MAX_PORTRAIT_PIXELS, PORTRAIT_STYLES } from "./portraitTreatment";
import { REVIEWED_HERO_SAMPLES } from "./reviewedHeroSamples";
import { prepareTeamLogo } from "./teamLogo";

const palette = { primaryColor: "#154734", darkColor: "#0b2e21", secondaryColor: "#DDCBA4" };
it("preserves every alpha byte and original input for every deterministic treatment", () => {
  const input = new Uint8ClampedArray([19, 40, 80, 255, 240, 150, 90, 128, 66, 45, 33, 1, 220, 110, 44, 0]);
  const before = new Uint8ClampedArray(input);
  for (const style of PORTRAIT_STYLES) {
    const result = portraitPixels(input, 2, 2, style, palette);
    expect([...result].filter((_, i) => i % 4 === 3)).toEqual([255, 128, 1, 0]);
    expect(result).toEqual(portraitPixels(input, 2, 2, style, palette));
    expect(result).not.toBe(input);
  }
  expect(input).toEqual(before);
});
it("uses nearest source RGB within a pixel block without sampling hidden background", () => {
  const input = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 255, 100, 110, 120, 255]);
  const pixelated = portraitPixels(input, 2, 2, "pixelated", palette);
  expect([...pixelated.slice(0, 7)]).toEqual([100, 110, 120, 255, 100, 110, 120]);
  input[15] = 0;
  expect(portraitPixels(input, 2, 2, "pixelated", palette)).toEqual(input);
});
it("maps team-color darkest and lightest values to explicit palette endpoints", () => {
  const input = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
  expect([...portraitPixels(input, 2, 1, "team-colors", palette)]).toEqual([11, 46, 33, 255, 242, 241, 235, 255]);
  expect(portraitPixels(input, 2, 1, "posterized", palette)).not.toEqual(input);
});
it("combines nearest-neighbor RGB with the team palette and uses flat palette inks for posterization", () => {
  const input = new Uint8ClampedArray([12, 61, 35, 255, 192, 155, 103, 255, 86, 120, 90, 255, 222, 243, 211, 255]);
  const pixelated = portraitPixels(input, 2, 2, "pixelated", palette);
  expect(portraitPixels(input, 2, 2, "pixelated-team-colors", palette)).toEqual(portraitPixels(pixelated, 2, 2, "team-colors", palette));
  const posterized = portraitPixels(input, 2, 2, "posterized-team-colors", palette);
  expect(posterized).not.toEqual(portraitPixels(input, 2, 2, "team-colors", palette));
  expect(posterized).not.toEqual(portraitPixels(input, 2, 2, "pixelated-team-colors", palette));
  for (let i = 0; i < posterized.length; i += 4) expect([[11,46,33], [21,71,52], [221,203,164], [242,241,235]]).toContainEqual([...posterized.slice(i, i + 3)]);
  const middle = new Uint8ClampedArray([120, 120, 120, 255]);
  expect(portraitPixels(middle, 1, 1, "pixelated-team-colors", { primaryColor: "#00205B", secondaryColor: "#FFFFFF" })).not.toEqual(portraitPixels(middle, 1, 1, "pixelated-team-colors", palette));
});
it("does not request unreviewed or guessed team-logo paths", async () => {
  await expect(prepareTeamLogo("unknown")).rejects.toThrow("reviewed local team logo");
});
it("rejects oversized or malformed buffers before processing and bounds image decoding", async () => {
  expect(() => portraitPixels(new Uint8ClampedArray(4), MAX_PORTRAIT_PIXELS + 1, 1, "posterized", palette)).toThrow("dimensions");
  expect(() => portraitPixels(new Uint8ClampedArray(3), 1, 1, "posterized", palette)).toThrow("dimensions");
  await expect(preparePortrait({ ...REVIEWED_HERO_SAMPLES[0], sourceWidth: MAX_PORTRAIT_PIXELS + 1, sourceHeight: 1, dataUrl: "unread" }, "pixelated")).rejects.toThrow("bounded");
});
it("cancels stale work before decode and records original style without raster processing", async () => {
  const hero = { ...REVIEWED_HERO_SAMPLES[0], dataUrl: "data:image/png;base64,AA==" };
  const controller = new AbortController(); controller.abort();
  await expect(preparePortrait(hero, "posterized", controller.signal)).rejects.toThrow();
  const original = await preparePortrait(hero, "original");
  expect(original.dataUrl).toBe(hero.dataUrl); expect(original.treatment?.renderedSha256).toBe(hero.alphaSha256);
  await expect(preparePortrait({ ...original, treatment: { ...original.treatment!, style: "posterized" } }, "pixelated")).rejects.toThrow("original");
});
