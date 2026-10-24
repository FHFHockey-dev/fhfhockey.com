import React from "react";
import { Blob as NodeBlob } from "node:buffer";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PlayerCard from "../../../../web/components/player-cards/PlayerCard";
import PlayerCardPreview, { cardPng } from "../../../../web/components/player-cards/PlayerCardPreview";
import { fixtureSnapshot } from "../../../../web/lib/player-cards/fixtures";
import { PLAYER_CARD_CAPABILITIES } from "../../../../web/lib/player-cards/contracts";
import { CURATED_METRICS } from "../../../../web/lib/player-cards/registry";
import { rankMetric } from "../../../../web/lib/player-cards/ranking";

const manifest = JSON.parse(readFileSync(new URL("../slice-01/manifest.json", import.meta.url), "utf8"));
const browser = JSON.parse(readFileSync(new URL("../slice-01/browser-results.json", import.meta.url), "utf8"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function metricGroup(svg: SVGSVGElement, label: string) {
  return [...svg.querySelectorAll("text")].find(t => t.textContent === label)!.parentElement!;
}

describe("independent frozen player-card consistency", () => {
  it("matches saved manifest settings, metric selection, sample and capabilities exactly", () => {
    expect(manifest).toEqual({ snapshot: fixtureSnapshot(), selectedMetrics: CURATED_METRICS, capabilities: PLAYER_CARD_CAPABILITIES });
    expect(manifest.snapshot.sample.gameIds).toHaveLength(manifest.snapshot.sample.gp);
    expect(manifest.snapshot.sample.toiSeconds / 60 / manifest.snapshot.sample.gp).toBe(manifest.snapshot.readings.find((r: any) => r.id === "atoi").value);
  });

  it("independently sorts each fabricated cohort to verify rank and midrank percentile from the same pool", () => {
    const snapshot = fixtureSnapshot();
    for (const [index, reading] of snapshot.readings.entries()) {
      const n = 812 - index * 3;
      const target = reading.value!;
      const values = Array.from({ length: n }, (_, i) => i === 0 ? target : target * (0.2 + ((i * 37 + index * 13) % 101) / 100)).sort((a, b) => a - b);
      const first = values.indexOf(target), last = values.lastIndexOf(target);
      expect(reading.rank).toEqual({ ordinal: n - last, population: n, tied: last > first, percentile: 100 * ((first + last + 1) / 2) / n });
    }
    // A known undefined ratio is excluded while zero stays in the metric pool.
    const rows = Object.freeze([
      Object.freeze({ playerId: "high", value: 8, state: "valid" as const, definitionKey: "same" }),
      Object.freeze({ playerId: "zero", value: 0, state: "valid" as const, definitionKey: "same" }),
      Object.freeze({ playerId: "undefined", value: null, state: "undefined" as const, definitionKey: "same" })
    ]);
    expect(rankMetric("zero", rows, { fullEligiblePopulationVerified: true, definitionKey: "same" }).rank).toEqual({ ordinal: 2, population: 2, percentile: 25, tied: false });
    expect(rows.map(r => r.playerId)).toEqual(["high", "zero", "undefined"]);
  });

  it("keeps missing, valid unranked and observed-zero presentations distinct", () => {
    const snapshot = fixtureSnapshot("missing");
    const zero = snapshot.readings.find(r => r.id === "sog60")!;
    zero.value = 0; zero.rank = { ordinal: 2, population: 2, percentile: 25, tied: false };
    const { container } = render(<PlayerCard snapshot={snapshot} />);
    const svg = container.querySelector("svg")!;
    const missing = metricGroup(svg, "ixG/60"), incomplete = metricGroup(svg, "On-ice xG%"), observed = metricGroup(svg, "SOG/60");
    expect(missing.textContent).toContain("—");
    expect(missing.textContent).toContain("1 source game missing");
    expect(missing.querySelectorAll("rect")).toHaveLength(0);
    expect(incomplete.textContent).toContain("58.7%");
    expect(incomplete.textContent).toContain("Rank unavailable · coverage incomplete");
    expect(incomplete.querySelectorAll("rect")).toHaveLength(0);
    expect(observed.textContent).toContain("0.00");
    expect(observed.textContent).toContain("2 of 2 · 25.0 pct");
    expect(observed.querySelectorAll("rect")).toHaveLength(2);
    expect(observed.querySelectorAll("rect")[1].getAttribute("width")).toBe("116");
  });

  it("matches retained browser SVG text for all four frozen scenarios without browser execution", () => {
    for (const kind of ["curated", "long-name", "partial", "missing"]) {
      const { container } = render(<PlayerCardPreview />);
      if (kind !== "curated") fireEvent.change(screen.getByLabelText("Example scenario"), { target: { value: kind } });
      const saved = browser.checks.find((c: any) => c.name === (kind === "curated" ? "desktop export and manifest" : `scenario ${kind}`));
      expect(container.querySelector("svg")!.textContent).toBe(saved.cardText);
      cleanup();
    }
  });

  it("hands the displayed SVG unchanged to the rasterizer with only fixed output dimensions and class removal", async () => {
    const snapshot = fixtureSnapshot();
    const originalSnapshot = JSON.stringify(snapshot);
    const { container } = render(<PlayerCardPreview />);
    const svg = container.querySelector("svg")!;
    const originalDom = svg.outerHTML;
    const expected = svg.cloneNode(true) as SVGSVGElement;
    expected.setAttribute("width", "1080"); expected.setAttribute("height", "1080"); expected.removeAttribute("class");
    const expectedXml = new XMLSerializer().serializeToString(expected);
    let serialized: NodeBlob | undefined;
    const revoke = vi.fn();
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("URL", { createObjectURL: vi.fn((blob: NodeBlob) => { serialized = blob; return "blob:offline-review"; }), revokeObjectURL: revoke });
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    const draw = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function(this: HTMLCanvasElement, callback) {
      expect([this.width, this.height]).toEqual([1080, 1080]);
      callback(new NodeBlob(["mock-raster-output"], { type: "image/png" }) as any);
    });
    await cardPng(svg, snapshot);
    expect(await serialized!.text()).toBe(expectedXml);
    expect(expectedXml).toContain("SYNTHETIC EXAMPLE");
    expect(expectedXml).not.toContain("Download example PNG");
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1080, 1080);
    expect(revoke).toHaveBeenCalledWith("blob:offline-review");
    expect(svg.outerHTML).toBe(originalDom);
    expect(JSON.stringify(snapshot)).toBe(originalSnapshot);
  });
});
