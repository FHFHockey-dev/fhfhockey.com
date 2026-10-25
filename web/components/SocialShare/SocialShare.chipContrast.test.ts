import path from "node:path";
import { compile } from "sass";
import { describe, expect, it } from "vitest";

// Role chips and streak badges sit on team-coloured bands (TOR is white). Their backing must be opaque, so contrast
// never depends on the band behind them (C7 SS1-15 contrast nit, SS1-21), and their text must stay legible on it.
const web = path.resolve(__dirname, "../..");
const css = compile(path.join(__dirname, "SocialShare.module.scss"), { loadPaths: [web], style: "expanded", logger: { warn() {}, debug() {} } }).css;

type Rgb = [number, number, number];
const hex = (value: string): Rgb => { const h = value.replace("#", ""); const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h; return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb; };
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function rules(selector: RegExp) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match => selector.test(match[1])).map(match => ({ selector: match[1].trim(), body: match[2] }));
}
function chip(body: string) {
  const color = body.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{3,6})/i)?.[1];
  // background: linear-gradient(rgba(r, g, b, a), …), <base>
  const tint = body.match(/linear-gradient\(rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/i);
  const background = body.match(/background:\s*([^;]+);/i)?.[1] ?? "";
  const base = background.includes("),") ? background.slice(background.lastIndexOf("),") + 2).trim() : undefined;
  return { color, tint, base };
}

describe("chip and badge contrast on any team band", () => {
  const targets = [...rules(/\.roleChips i\[data-tone=/), ...rules(/\.streak\[data-streak=/)];

  it("covers every role-chip tone and both streak kinds", () => {
    expect(targets.map(target => target.selector.match(/\[data-(?:tone|streak)="?(\w+)"?\]/)?.[1]).sort()).toEqual(["cold", "green", "hot", "orange", "red", "yellow"]);
  });

  it.each(targets.map(target => [target.selector, target.body]))("%s has an opaque backing and readable text", (_selector, body) => {
    const { color, tint, base } = chip(body);
    expect(color, "text colour").toBeTruthy();
    expect(tint, "tone tint").toBeTruthy();
    // Opaque base: a hex colour, never rgba()/transparent, so the team band can't show through.
    expect(base, "backing").toMatch(/^#[0-9a-f]{3,6}$/i);
    const alpha = Number(tint![4]), tone: Rgb = [Number(tint![1]), Number(tint![2]), Number(tint![3])], under = hex(base!);
    const composite = tone.map((c, i) => c * alpha + under[i] * (1 - alpha)) as Rgb;
    // WCAG AA for small text.
    expect(contrast(hex(color!), composite)).toBeGreaterThanOrEqual(4.5);
  });
});
