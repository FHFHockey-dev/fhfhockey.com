import type { GetStaticProps } from "next";
import Head from "next/head";
import React, { useMemo, useState } from "react";

import BlshTradeComparison from "components/blshTrade/BlshTradeComparison";
import ReviewedSkaterPreview from "components/blshTrade/ReviewedSkaterPreview";
import { FIXTURE_BLSH_EVIDENCE } from "components/blshTrade/fixtureEvidence";
import styles from "components/blshTrade/BlshTrade.module.scss";
import type { DisplayProfile } from "lib/buyLowSellHigh/displayProfile";
import type { ArmCPreview } from "lib/buyLowSellHigh/armCPreview.server";
import { HORIZON_OPTIONS, type HorizonGames, type InterpretationRecord } from "lib/skoElement/contract";
import { FIXTURE_DISCLAIMER, fixtureRecords } from "lib/skoElement/fixtures";

type Props = { saved: DisplayProfile[]; eventThroughDate: string | null; reviewed: ArmCPreview };
const noForecasts = { 5: [], 10: [], 20: [] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  if (process.env.NODE_ENV === "production") return { notFound: true };
  const { readCurrentBlshSnapshot } = await import("lib/buyLowSellHigh/researchSnapshot.server");
  const { readArmCPreview } = await import("lib/buyLowSellHigh/armCPreview.server");
  const reviewed = await readArmCPreview(new Date().toISOString(), process.env.BLSH_LOCAL_ARM_C_DIRECTORY, process.env.BLSH_LOCAL_ARM_C_THROUGH_DATE);
  try {
    const snapshot = readCurrentBlshSnapshot();
    // Fixed local review sample. Selection is independent of score and list membership.
    const saved = snapshot.profiles.filter(p => p.evidence.window.games === 5).sort((a, b) => a.playerId - b.playerId).slice(0, 2);
    return { props: { saved, eventThroughDate: snapshot.eventThroughDate, reviewed } };
  } catch {
    return { props: { saved: [], eventThroughDate: null, reviewed } };
  }
};

export default function BlshTradePage({ saved, eventThroughDate, reviewed }: Props) {
  const [source, setSource] = useState("reviewed");
  const recordsByHorizon = useMemo(() => Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, fixtureRecords(horizon)])) as Record<HorizonGames, InterpretationRecord[]>, []);
  const evidence = useMemo(() => Object.fromEntries(saved.map(p => [String(p.playerId), p])), [saved]);
  return (
    <main className={styles.page}>
      <Head>
        <title>Trade comparison (local preview) | FHFHockey</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <label>Preview data{" "}
        <select value={source} onChange={event => setSource(event.target.value)}>
          <option value="reviewed">Five-game review · arm C</option>
          <option value="saved" disabled={eventThroughDate === null}>{eventThroughDate
            ? `Two saved skaters · arm A · ${eventThroughDate}` : "Saved arm-A sample unavailable"}</option>
          <option value="fixture">Synthetic trade example</option>
        </select>
      </label>
      {source === "reviewed" ? <ReviewedSkaterPreview preview={reviewed} /> : source === "saved" ? <BlshTradeComparison savedSample recordsByHorizon={noForecasts} evidence={evidence} /> :
        <BlshTradeComparison recordsByHorizon={recordsByHorizon} evidence={FIXTURE_BLSH_EVIDENCE}
          fixtureBanner={`${FIXTURE_DISCLAIMER} Buy Low / Sell High evidence here is synthetic too.`}
          initialGive={["fx-f5"]} initialReceive={["fx-f3"]} />}
    </main>
  );
}
