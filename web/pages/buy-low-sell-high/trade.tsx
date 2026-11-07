import type { GetStaticProps } from "next";
import Head from "next/head";
import React, { useMemo } from "react";

import BlshTradeComparison from "components/blshTrade/BlshTradeComparison";
import { FIXTURE_BLSH_EVIDENCE } from "components/blshTrade/fixtureEvidence";
import styles from "components/blshTrade/BlshTrade.module.scss";
import { HORIZON_OPTIONS, type HorizonGames, type InterpretationRecord } from "lib/skoElement/contract";
import { FIXTURE_DISCLAIMER, fixtureRecords } from "lib/skoElement/fixtures";

/** Local fixture preview only: production builds return 404, like the BLSH and Sko previews. */
export const getStaticProps: GetStaticProps = async () =>
  process.env.NODE_ENV === "production" ? { notFound: true } : { props: {} };

export default function BlshTradePage() {
  const recordsByHorizon = useMemo(() => Object.fromEntries(HORIZON_OPTIONS.map(horizon => [horizon, fixtureRecords(horizon)])) as Record<HorizonGames, InterpretationRecord[]>, []);
  return (
    <main className={styles.page}>
      <Head>
        <title>Trade comparison (fixture preview) | FHFHockey</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <BlshTradeComparison recordsByHorizon={recordsByHorizon} evidence={FIXTURE_BLSH_EVIDENCE}
        fixtureBanner={`${FIXTURE_DISCLAIMER} Buy Low / Sell High evidence here is synthetic too.`}
        initialGive={["fx-f5"]} initialReceive={["fx-f3"]} />
    </main>
  );
}
