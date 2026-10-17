import Link from "next/link";
import { useRouter } from "next/router";
import { UNDERLYING_STATS_NAV_LINKS } from "lib/navigation/analyticsSurfaceOwnership";
import styles from "./UnderlyingStatsNavBar.module.scss";

type UnderlyingStatsNavBarProps = {
  pinnedTeamId?: number | null;
  showDetails?: boolean;
  variant?: "cards" | "connected";
};

const NAV_DETAILS: Record<string, { description: string; icon: JSX.Element }> = {
  "/underlying-stats/teamStats": {
    description: "Compare teams across key metrics and opponent or game-state context.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5 13.4 13.4 8.5 15.5 10.6 10.6Z" />
      </svg>
    )
  },
  "/underlying-stats/playerStats": {
    description: "Evaluate skater impact using shot, chance, and goal metrics.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="14" cy="4.5" r="2" />
        <path d="M13 7.5 9.5 11l3 2.5-1.5 4.5M13 7.5l3 3.5h3M9.5 11 6 10.5M4 20h9.5l1.5-2" />
      </svg>
    )
  },
  "/underlying-stats/goalieStats": {
    description: "Go behind the saves with goalie impact and workload metrics.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c4 0 6.5 2.5 6.5 7 0 5.5-3 10-6.5 11-3.5-1-6.5-5.5-6.5-11 0-4.5 2.5-7 6.5-7Z" />
        <path d="M9 10.5h6M9 13.5h6M10.5 16.5h3M12 10.5v6" />
      </svg>
    )
  },
  "/underlying-stats/xg": {
    description: "Inspect expected-goal model outputs before they are promoted.",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.5 3h5M10 3v6.5L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9.5V3" />
        <path d="M7.5 15h9" />
      </svg>
    )
  }
};

const descriptionId = (href: string) =>
  `uls-nav-${href.split("/").filter(Boolean).join("-")}`;

export default function UnderlyingStatsNavBar({
  pinnedTeamId = null,
  showDetails = false,
  variant = "cards"
}: UnderlyingStatsNavBarProps) {
  const router = useRouter();
  const pathname = router.pathname;

  return (
    <nav
      className={`${styles.navBar} ${
        variant === "connected" ? styles.connected : ""
      } ${showDetails ? styles.detailed : ""}`}
      aria-label="Underlying Stats Hub Navigation"
    >
      {UNDERLYING_STATS_NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        const details = showDetails ? NAV_DETAILS[link.href] : undefined;
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
            aria-label={details ? link.label : undefined}
            aria-describedby={details ? `${descriptionId(link.href)}` : undefined}
          >
            {details ? (
              <>
                <span className={styles.navIcon}>{details.icon}</span>
                <span className={styles.navCopy}>
                  <span className={styles.navLabel}>{link.label}</span>
                  <span className={styles.navDescription} id={descriptionId(link.href)}>
                    {details.description}
                  </span>
                </span>
                <span className={styles.navChevron} aria-hidden="true">
                  ›
                </span>
              </>
            ) : (
              link.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
