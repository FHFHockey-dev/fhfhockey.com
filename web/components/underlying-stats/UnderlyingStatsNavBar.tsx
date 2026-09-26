import Link from "next/link";
import { useRouter } from "next/router";
import { UNDERLYING_STATS_NAV_LINKS } from "lib/navigation/analyticsSurfaceOwnership";
import styles from "./UnderlyingStatsNavBar.module.scss";

type UnderlyingStatsNavBarProps = {
  pinnedTeamId?: number | null;
  variant?: "cards" | "connected";
};

export default function UnderlyingStatsNavBar({
  pinnedTeamId = null,
  variant = "cards"
}: UnderlyingStatsNavBarProps) {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <nav
      className={`${styles.navBar} ${
        variant === "connected" ? styles.connected : ""
      }`}
      aria-label="Underlying Stats Hub Navigation"
    >
      {UNDERLYING_STATS_NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={
              pinnedTeamId != null && link.label === "Team Explorer"
                ? { pathname: link.href, query: { teamId: pinnedTeamId } }
                : link.href
            }
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
