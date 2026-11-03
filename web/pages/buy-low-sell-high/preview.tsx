import type { GetStaticProps } from "next";
import Head from "next/head";
import React from "react";

import BuyLowSellHighPreview from "components/buyLowSellHigh/BuyLowSellHighPreview";
import type { BlshPreviewSnapshot } from "lib/buyLowSellHigh/researchSnapshot";
import styles from "components/skoElement/SkoElement.module.scss";

type Props = { snapshot: BlshPreviewSnapshot };

/** Immutable local research preview only; production 404 restriction retained. */
export const getStaticProps: GetStaticProps<Props> = async () => {
  if (process.env.NODE_ENV === "production") return { notFound: true };
  const { readCurrentBlshSnapshot } = await import("lib/buyLowSellHigh/researchSnapshot.server");
  return { props: { snapshot: readCurrentBlshSnapshot() } };
};

export default function BuyLowSellHighPreviewPage({ snapshot }: Props) {
  return (
    <main className={styles.page}>
      <Head>
        <title>Buy Low / Sell High (research preview) | FHFHockey</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <BuyLowSellHighPreview snapshot={snapshot} />
    </main>
  );
}
