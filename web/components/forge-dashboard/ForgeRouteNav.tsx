import Link from "next/link";

import { buildForgeHref } from "lib/dashboard/forgeLinks";
import styles from "styles/ForgeDashboard.module.scss";

type ForgeRouteKey =
  | "dashboard"
  | "startChart"
  | "trends"
  | "teamDetail"
  | "playerDetail"
  | "landing";

type ForgeRouteNavProps = {
  current: ForgeRouteKey;
  teamHref?: string | null;
  playerHref?: string | null;
  date?: string | null;
  mode?: "tonight" | "week" | null;
  resolvedDate?: string | null;
  team?: string | null;
  position?: "all" | "f" | "d" | "g" | null;
};

type NavItem = {
  key: ForgeRouteKey;
  label: string;
  href: string | null;
  disabledTitle?: string;
};

function buildNavItems({
  teamHref,
  playerHref,
  date,
  mode,
  resolvedDate,
  team,
  position
}: Pick<
  ForgeRouteNavProps,
  "teamHref" | "playerHref" | "date" | "mode" | "resolvedDate" | "team" | "position"
>): NavItem[] {
  const sharedContext = {
    date,
    mode,
    resolvedDate,
    team,
    position
  } as const;

  return [
    {
      key: "dashboard",
      label: "Dashboard",
      href: buildForgeHref("/forge/dashboard", sharedContext)
    },
    {
      key: "startChart",
      label: "Start Chart",
      href: buildForgeHref("/start-chart", sharedContext)
    },
    {
      key: "trends",
      label: "Trends",
      href: buildForgeHref("/trends", sharedContext)
    },
    {
      key: "teamDetail",
      label: "Team Detail",
      href: teamHref ?? null,
      disabledTitle: "Team detail becomes active once a team context is selected."
    },
    {
      key: "playerDetail",
      label: "Player Detail",
      href: playerHref ?? null,
      disabledTitle: "Player detail becomes active once a player context is selected."
    },
    {
      key: "landing",
      label: "FORGE Landing",
      href: buildForgeHref("/FORGE", sharedContext)
    }
  ];
}

export default function ForgeRouteNav({
  current,
  teamHref,
  playerHref,
  date,
  mode,
  resolvedDate,
  team,
  position
}: ForgeRouteNavProps) {
  const items = buildNavItems({
    teamHref,
    playerHref,
    date,
    mode,
    resolvedDate,
    team,
    position
  });

  return (
    <nav className={styles.secondaryNav} aria-label="Forge dashboard navigation">
      {items.map((item) => {
        const className = `${styles.navLink} ${
          item.key === current ? styles.navLinkActive : ""
        } ${!item.href ? styles.navLinkDisabled : ""}`.trim();

        if (!item.href) {
          return (
            <span
              key={item.key}
              className={className}
              aria-disabled="true"
              title={item.disabledTitle}
            >
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            className={className}
            aria-current={item.key === current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
