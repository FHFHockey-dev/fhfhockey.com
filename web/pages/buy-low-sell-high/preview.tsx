import type { GetStaticProps } from "next";
import Head from "next/head";
import React from "react";

import BuyLowSellHighPreview from "components/buyLowSellHigh/BuyLowSellHighPreview";
import styles from "components/skoElement/SkoElement.module.scss";

/** Local fixture preview only: production builds return 404. The legacy /buyLowSellHigh route is unchanged. */
export const getStaticProps: GetStaticProps = async () =>
  process.env.NODE_ENV === "production" ? { notFound: true } : { props: {} };

export default function BuyLowSellHighPreviewPage() {
  return (
    <main className={styles.page}>
      <Head>
        <title>Buy Low / Sell High (fixture preview) | FHFHockey</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <BuyLowSellHighPreview />
    </main>
  );
}
