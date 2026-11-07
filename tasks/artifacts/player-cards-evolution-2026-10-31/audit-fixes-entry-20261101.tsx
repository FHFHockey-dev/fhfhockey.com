import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import PlayerAnalysisCard, { type AnalysisPresentation } from "../../../web/components/player-cards/PlayerAnalysisCard";
import { goalieFixture, sharedGoalieFixture } from "../../../web/lib/player-cards/analysisFixtures";
import { sharedGoalieOutlook } from "../../../web/lib/player-cards/sharedGoalieOutlook";
import { assertAnalysisExport, analysisManifest, rasterizeAnalysis } from "../../../web/lib/player-cards/analysisExport";
import { saveCardFile } from "../../../web/lib/player-cards/shareExport";

const cases = {
  normal: ["Reports aren't separated by reporter, so conflicts between sources can't be detected.", "No source link or expiry exists for these reports."],
  "long-token": ["https://example.test/" + "w".repeat(300)],
  "wide-token": ["W".repeat(120)],
  "wrapped-wide": ["W".repeat(60) + " " + "W".repeat(60)],
};
const root = createRoot(document.getElementById("root")!);
let presentation: AnalysisPresentation, selected: keyof typeof cases;
const svg = () => document.querySelector("svg")!;
Object.assign(globalThis, {
  auditSelect(name: keyof typeof cases) {
    selected = name;
    const input = sharedGoalieFixture(); input.sources[0].reasons = cases[name];
    presentation = { goalie: sharedGoalieOutlook(input, goalieFixture().player, "fixture"), gameIndex: 0 };
    flushSync(() => root.render(<PlayerAnalysisCard presentation={presentation} />));
  },
  auditProbe() {
    const element = svg(), warning = element.querySelector<SVGTextElement>('[data-confirmation-warnings="true"]')!;
    let accepted = true, error = null;
    try { assertAnalysisExport(element, presentation); } catch (e) { accepted = false; error = (e as Error).message; }
    const box = warning.getBBox();
    return { selected, accepted, error, truncated: element.querySelector('[data-evidence-truncated="true"]') !== null,
      spans: [...warning.querySelectorAll("tspan")].map(s => s.textContent), width: box.width, right: box.x + box.width,
      ariaPreservesFullWarning: cases[selected].every(w => element.getAttribute("aria-label")!.includes(w)), manifest: analysisManifest(presentation) };
  },
  async auditDownload() {
    try { const blob = await rasterizeAnalysis(svg(), presentation); saveCardFile(blob, selected + ".png"); return { exported: true }; }
    catch (e) { return { exported: false, error: (e as Error).message }; }
  },
});
(globalThis as any).auditSelect("normal");
