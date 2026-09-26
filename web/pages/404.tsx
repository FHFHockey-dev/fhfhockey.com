import { useState } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import Container from "components/Layout/Container";
import MobileMenu from "components/Layout/MobileMenu";
import styles from "styles/InfoPage.module.scss";

export default function Custom404() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Container>
      <NextSeo
        title="Page not found | Five Hole Fantasy Hockey"
        description="Get back to fantasy hockey tools, player stats, and articles on Five Hole Fantasy Hockey."
        noindex
      />
      <article className={styles.page}>
        <header>
          <p className={styles.eyebrow}>404 · Off the ice</p>
          <h1>Page not found</h1>
          <p>This link may have moved, or the address may be mistyped. Get back to your next fantasy hockey decision.</p>
        </header>
        <div className={styles.actions}>
          <Link className={styles.action} href="/">Go to home</Link>
          <button
            className={styles.action}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSearchOpen(true)}
          >
            Find a player
          </button>
        </div>
        <section className={styles.panel} aria-labelledby="recovery-heading">
          <h2 id="recovery-heading">Get back in the game</h2>
          <nav aria-label="Page recovery" className={styles.destinations}>
            <Link href="/game-grid/7-Day-Forecast">
              <strong>Game Grid</strong>
              <span>Plan your week around the NHL schedule.</span>
            </Link>
            <Link href="/underlying-stats">
              <strong>Underlying Stats</strong>
              <span>Explore player, goalie, and team performance.</span>
            </Link>
            <Link href="/blog">
              <strong>Blog</strong>
              <span>Read fantasy hockey analysis and advice.</span>
            </Link>
          </nav>
        </section>
      </article>
      <MobileMenu
        visible={searchOpen}
        entryPoint="search"
        onItemClick={() => setSearchOpen(false)}
      />
    </Container>
  );
}
