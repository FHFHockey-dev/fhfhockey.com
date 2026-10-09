import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import classNames from "classnames";
import SocialMedias from "components/SocialMedias";
import NavigationIcon from "../NavigationIcon";
import {
  isNavigationLinkActive,
  SUPPORT_URL,
  type NavbarItem,
} from "./NavbarItemsData";
import styles from "./NavbarItems.module.scss";

export default function NavbarItems({
  items,
  onItemClick,
  className,
}: {
  items: NavbarItem[];
  onItemClick: () => void;
  className?: string;
}) {
  const { pathname } = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open && !hovered) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
        setHovered(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, hovered]);

  useEffect(() => {
    setOpen(null);
    setHovered(null);
  }, [pathname]);

  return (
    <nav
      ref={rootRef}
      aria-label="Primary navigation"
      className={classNames(styles.items, className)}
    >
      <ul className={styles.menuList}>
        {items.map((item) => {
          if (item.type === "link")
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.topLink}
                  aria-current={
                    isNavigationLinkActive(pathname, item.href)
                      ? "page"
                      : undefined
                  }
                  onClick={() => {
                    setOpen(null);
                    setHovered(null);
                    onItemClick();
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          const expanded = open === item.id || (!open && hovered === item.id);
          const active = item.groups.some((group) =>
            group.items.some((link) =>
              isNavigationLinkActive(pathname, link.href),
            ),
          );
          const panelId = `${id}-${item.id}`;
          return (
            <li
              key={item.id}
              className={styles.category}
              onMouseEnter={() => {
                setHovered(item.id);
                if (open !== item.id) setOpen(null);
              }}
              onMouseLeave={() => setHovered(null)}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setOpen(null);
                  setHovered(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && expanded) {
                  event.preventDefault();
                  setOpen(null);
                  setHovered(null);
                  event.currentTarget
                    .querySelector<HTMLButtonElement>("button")
                    ?.focus();
                }
              }}
            >
              <button
                type="button"
                className={classNames(styles.trigger, {
                  [styles.active]: active,
                })}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => {
                  setHovered(null);
                  setOpen(open === item.id ? null : item.id);
                }}
              >
                {item.label}
                <NavigationIcon name="chevron" />
              </button>
              <div
                id={panelId}
                hidden={!expanded}
                className={classNames(styles.panel, styles[item.id])}
              >
                <div className={styles.groups}>
                  {item.groups.map((group) => (
                    <div key={group.label} className={styles.group}>
                      <p className={styles.groupTitle}>{group.label}</p>
                      <ul>
                        {group.items.map((link) => (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className={styles.destination}
                              aria-current={
                                isNavigationLinkActive(pathname, link.href)
                                  ? "page"
                                  : undefined
                              }
                              onClick={() => {
                                setOpen(null);
                                setHovered(null);
                                onItemClick();
                              }}
                            >
                              <NavigationIcon name={link.icon} />
                              <span>
                                <strong>{link.label}</strong>
                                <small>{link.description}</small>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {item.id === "community" && (
                  <div className={styles.communityLinks}>
                    <p className={styles.groupTitle}>Follow & connect</p>
                    <SocialMedias labeled />
                    <a
                      className={styles.support}
                      href={SUPPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <NavigationIcon name="heart" />
                      Support FHFH
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
