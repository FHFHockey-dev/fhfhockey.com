import type { GetStaticProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useCallback, useMemo } from "react";

import SkoElementPreview, { DEFAULT_SKO_STATE, parseSkoState, type SkoViewState } from "components/skoElement/SkoElementPreview";
import styles from "components/skoElement/SkoElement.module.scss";

/** Local fixture preview only: production builds return 404 until a route/release decision is made. */
export const getStaticProps: GetStaticProps = async () =>
  process.env.NODE_ENV === "production" ? { notFound: true } : { props: {} };

export default function SkoElementPreviewPage() {
  const router = useRouter();
  const { state, invalid } = useMemo(() => (router.isReady ? parseSkoState(router.query) : { state: DEFAULT_SKO_STATE, invalid: [] }),
    [router.isReady, router.query]);
  const onStateChange = useCallback((next: SkoViewState) => {
    const query: Record<string, string> = { view: next.view, horizon: String(next.horizon), recent: String(next.recent), target: next.target };
    if (next.q) query.q = next.q;
    if (next.player) query.player = next.player;
    // Selections create history entries for back/forward; search keystrokes replace the current entry.
    const navigate = next.q !== state.q ? router.replace : router.push;
    void navigate({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }, [router, state.q]);
  return (
    <main className={styles.page}>
      <Head>
        <title>The Sko Element (fixture preview) | FHFHockey</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <SkoElementPreview state={state} onStateChange={onStateChange} invalid={invalid} />
    </main>
  );
}
