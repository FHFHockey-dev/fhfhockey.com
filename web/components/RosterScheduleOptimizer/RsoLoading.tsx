import { useEffect, useState } from "react";
import type { NextRouter } from "next/router";
import styles from "./RsoLoading.module.scss";

/** Kept independent of the optimizer bundle so navigation can acknowledge a cold load. */
export function RsoNavigationFeedback({ router }: { router: Pick<NextRouter, "events"> }) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    const events = router.events;
    if (!events) return;
    const start = (url: string, { shallow }: { shallow: boolean }) => {
      setPending(!shallow && /^\/roster-schedule-optimizer\/?(?:[?#]|$)/.test(url) ? url : null);
    };
    const complete = (url: string) => setPending(current => current === url ? null : current);
    const error = (_error: unknown, url: string) => complete(url);
    events.on("routeChangeStart", start);
    events.on("routeChangeComplete", complete);
    events.on("routeChangeError", error);
    return () => {
      events.off("routeChangeStart", start);
      events.off("routeChangeComplete", complete);
      events.off("routeChangeError", error);
    };
  }, [router.events]);
  return pending ? <div className={styles.navigation} role="status">Opening Roster Schedule Optimizer…</div> : null;
}

export default function RsoLoading() {
  return <section className={styles.loading} aria-label="Roster Schedule Optimizer loading" aria-busy="true">
    <h1>Roster Schedule Optimizer</h1>
    <p role="status">Loading your planning workspace…</p>
    <div className={styles.panels} aria-hidden="true">
      {["Current Roster", "Optimized Week", "Best Fit Available"].map(title => <div className={styles.panel} key={title}>
        <strong>{title}</strong>
        {[0, 1, 2, 3].map(row => <div className={styles.row} key={row} />)}
      </div>)}
    </div>
  </section>;
}
