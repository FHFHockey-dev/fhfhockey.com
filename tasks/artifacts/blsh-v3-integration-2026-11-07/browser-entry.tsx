// Verification harness only: actual components/styles, retained local candidate, no app providers.
import React from "react";
import { createRoot } from "react-dom/client";
import BuyLowSellHighPreview from "../../../web/components/buyLowSellHigh/BuyLowSellHighPreview";
import { parseCurrentResearchSnapshot } from "../../../web/lib/buyLowSellHigh/researchSnapshot";
import shared from "../../../web/components/skoElement/SkoElement.module.scss";

fetch("/snapshot.json").then(response => response.json()).then(value => {
  const snapshot = parseCurrentResearchSnapshot(value);
  createRoot(document.getElementById("root")!).render(<main className={shared.page}><BuyLowSellHighPreview snapshot={snapshot} /></main>);
});
