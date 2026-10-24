// C7 controls for C4 BLSH-3.1/3.4: every number in the detail must already exist in the supplied record/row (no derived
// volatility, confidence or duration), and keyboard focus behaviour.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import BlshPlayerDetail from "components/buyLowSellHigh/BlshPlayerDetail";
import BuyLowSellHighPreview, { FIXTURE_LEAGUE } from "components/buyLowSellHigh/BuyLowSellHighPreview"; // run1: FIXTURE_LEAGUE wrongly imported from fixtures
import { fixtureRecords } from "lib/skoElement/fixtures";
import { buildWatchlists } from "lib/buyLowSellHigh/market";
import { SKATER_TARGETS, HORIZON_OPTIONS } from "lib/skoElement/contract";

const OUT = process.env.C7_BLSH_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
afterEach(cleanup);
const weights = Object.fromEntries(Object.entries(FIXTURE_LEAGUE.weights).filter(([k]) => (SKATER_TARGETS as readonly string[]).includes(k)));
function allowedNumbers(value: unknown) {
  const set = new Set<string>();
  const add = (n: number) => { for (const d of [0, 1, 2]) { const t = n.toFixed(d); set.add(t); set.add(`+${t}`); set.add(t.replace(/^-/, "")); } set.add(String(n)); };
  JSON.stringify(value, (_k, v) => { if (typeof v === "number") add(v); if (typeof v === "string") for (const m of v.match(/\d+(?:\.\d+)?/g) ?? []) set.add(m); return v; });
  return set;
}
const memory = () => { const d = new Map<string, string>(); return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k), clear: () => d.clear(), key: () => null, length: 0 } as unknown as Storage; };

describe("C7 BLSH detail provenance", () => {
  it("D1 across all fixture players × horizons × targets, every displayed number exists in the record or watch row", () => {
    const strays: string[] = []; let renders = 0;
    for (const horizon of HORIZON_OPTIONS) {
      const records = fixtureRecords(horizon);
      for (const target of [...SKATER_TARGETS, "LEAGUE_POINTS"] as any[]) {
        const lists = buildWatchlists(records, target, weights as any); const rows = [...lists.rebound, ...lists.cooling, ...lists.level, ...lists.unranked];
        for (const record of records) {
          const row = rows.find(r => r.playerId === record.identity.playerId) ?? null;
          const allowed = allowedNumbers([record, row, horizon]);
          const { container } = render(<BlshPlayerDetail id="d" record={record} row={row} target={target} inCurrentList={true} onClose={() => {}} />);
          renders++;
          const text = container.textContent ?? "";
          for (const n of text.match(/[+-]?\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(n) && !allowed.has(n.replace(/^[+-]/, ""))) strays.push(`${record.identity.name}/${target}/${horizon}: ${n}`);
          for (const banned of [/buy now|sell now/i, /confidence:\s*(high|medium|low|\d)/i, /expected (duration|persistence)/i]) if (banned.test(text)) strays.push(`${record.identity.name}: banned ${banned}`);
          cleanup();
        }
      }
    }
    observed.D1 = { renders, strays: strays.slice(0, 20), strayCount: strays.length };
    expect(strays).toEqual([]);
  });
  it("D2 keyboard: Enter on a toggle opens one detail with focus on its heading; Escape returns focus; opening another closes the first", () => {
    render(<BuyLowSellHighPreview storage={memory()} />);
    const toggles = screen.getAllByRole("button", { name: /^Details for/ });
    toggles[0].focus(); fireEvent.click(toggles[0]);
    const heading = screen.getByRole("heading", { level: 2, name: /Fixture/ });
    const focusedIsHeading = document.activeElement === heading;
    const section = heading.closest("section")!;
    fireEvent.keyDown(section, { key: "Escape" });
    const back = document.activeElement === toggles[0], closed = !document.querySelector("section[aria-labelledby$='-heading']");
    fireEvent.click(toggles[0]); fireEvent.click(toggles[1]);
    const openCount = document.querySelectorAll("section[aria-labelledby$='-heading']").length;
    observed.D2 = { toggles: toggles.length, focusedIsHeading, focusReturned: back, closed, openCount, expanded: toggles.map(t => t.getAttribute("aria-expanded")).slice(0, 3) };
    expect(focusedIsHeading).toBe(true); expect(back).toBe(true); expect(closed).toBe(true); expect(openCount).toBe(1);
  });
  it("D3 source/as-of/coverage and unavailable states are visible for every fixture record", () => {
    const missing: string[] = [];
    for (const record of fixtureRecords(10)) {
      const { container } = render(<BlshPlayerDetail id="d" record={record} row={null} target={"LEAGUE_POINTS" as any} inCurrentList={false} onClose={() => {}} />);
      const t = container.textContent ?? "";
      for (const needle of ["as of", "contract", "Evidence", "Forecast", "Horizon:", "Recent window:", "Limitations", "Predictive spread", "Confidence: not supplied", "Not in the current list"]) if (!t.includes(needle)) missing.push(`${record.identity.name}: ${needle}`);
      cleanup();
    }
    observed.D3 = { missing };
    expect(missing).toEqual([]);
  });
});
