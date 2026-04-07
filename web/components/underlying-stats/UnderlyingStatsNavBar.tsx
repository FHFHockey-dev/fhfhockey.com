import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./UnderlyingStatsNavBar.module.scss";

export default function UnderlyingStatsNavBar() {
  const router = useRouter();
  const pathname = router.pathname;

  const links = [
    { href: "/underlying-stats/playerStats", label: "Player Stats" },
    { href: "/underlying-stats/goalieStats", label: "Goalie Stats" },
    { href: "/underlying-stats/teamStats", label: "Team Stats" },
  ];

  return (
    <nav className={styles.navBar} aria-label="Underlying Stats Hub Navigation">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.navButton} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}