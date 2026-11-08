// Local component verification only; no Next providers, environment files, or external data.
import React from "react";
import { createRoot } from "react-dom/client";
import BuyLowSellHighPreview from "../../../web/components/buyLowSellHigh/BuyLowSellHighPreview";
import BlshTradeComparison from "../../../web/components/blshTrade/BlshTradeComparison";
import { FIXTURE_BLSH_EVIDENCE } from "../../../web/components/blshTrade/fixtureEvidence";
import { fixtureRecords } from "../../../web/lib/skoElement/fixtures";
import { HORIZON_OPTIONS, type HorizonGames, type InterpretationRecord } from "../../../web/lib/skoElement/contract";
import { parseCurrentResearchSnapshot } from "../../../web/lib/buyLowSellHigh/researchSnapshot";
import shared from "../../../web/components/skoElement/SkoElement.module.scss";

const root = createRoot(document.getElementById("root")!);
if (location.pathname === "/trade") {
  const records = Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, fixtureRecords(horizon)])) as Record<HorizonGames, InterpretationRecord[]>;
  root.render(<main className={shared.page}><BlshTradeComparison recordsByHorizon={records} evidence={FIXTURE_BLSH_EVIDENCE}
    fixtureBanner="SYNTHETIC FIXTURE DATA · not real forecasts" initialGive={["fx-f5"]} initialReceive={["fx-f3"]} /></main>);
} else {
  fetch("/snapshot.json").then(response => response.json()).then(value => {
    root.render(<main className={shared.page}><BuyLowSellHighPreview snapshot={parseCurrentResearchSnapshot(value)} /></main>);
  });
}
