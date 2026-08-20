import { useId, useRef, useState } from "react";
import Link from "next/link";
import classNames from "classnames";
import Image from "next/image";

import type {
  NavbarItem,
  NavbarItemCategory as NavbarItemCategoryType,
  NavbarItemLink,
} from "./NavbarItemsData";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";

import styles from "./NavbarItems.module.scss";

function isCategoryActive(category: NavbarItemCategoryType): boolean {
  return category.items.some((item) => {
    const currentPath = window.location.pathname;

    if (item.type === "link") {
      // TODO: handle external site
      return item.href === currentPath;
    } else if (item.type === "category") {
      return isCategoryActive(item);
    }
  });
}

function isLinkActive(link: NavbarItemLink): boolean {
  const currentPath = window.location.pathname;
  return link.href === currentPath;
}

type NavBarCategoryProps = {
  item: NavbarItemCategoryType;
  onItemClick: (item?: NavbarItem) => void;
  large: boolean;
};

function NavbarItemCategory({
  item,
  onItemClick,
  large,
}: NavBarCategoryProps) {
  const [disclosureOpen, setDisclosureOpen] = useState(
    () => !large && isCategoryActive(item),
  );
  const [hoverOpen, setHoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reactId = useId();
  const submenuId = `navbar-submenu-${reactId.replace(/:/g, "")}`;
  const expanded = disclosureOpen || hoverOpen;

  const close = () => {
    setDisclosureOpen(false);
    setHoverOpen(false);
  };

  const handleItemClick = (selectedItem?: NavbarItem) => {
    close();
    onItemClick(selectedItem);
  };

  return (
    <li
      className={classNames(styles.category, {
        [styles.active]: isCategoryActive(item),
        [styles.expanded]: expanded,
      })}
      onMouseEnter={() => {
        if (large) setHoverOpen(true);
      }}
      onMouseLeave={() => {
        if (large) setHoverOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          close();
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.categoryTrigger}
        aria-expanded={expanded}
        aria-controls={submenuId}
        onClick={() => {
          setDisclosureOpen((open) => !open);
          setHoverOpen(false);
        }}
      >
        <span className={styles.category_item}>
          {item.label}{" "}
          <span className={styles.arrow} aria-hidden="true">
            <Image
              src="/pictures/menu-arrow-drop-down.svg"
              alt=""
              width={32}
              height={32}
            />
          </span>
        </span>
      </button>
      <NavbarItems_
        id={submenuId}
        hidden={!expanded}
        large={large}
        onItemClick={handleItemClick}
        items={item.items}
      />
    </li>
  );
}

type NavBarItemsProps = {
  items: NavbarItem[];
  onItemClick: (item?: NavbarItem) => void;
  className?: string;
  forceLarge?: boolean;
};

type NavBarItemsListProps = Pick<NavBarItemsProps, "items" | "onItemClick"> & {
  large: boolean;
  id?: string;
  hidden?: boolean;
};

function NavbarItems_({
  items,
  onItemClick,
  large,
  id,
  hidden,
}: NavBarItemsListProps) {
  return (
    <>
      {/* navbar items */}
      <ul className={styles.menu_list} id={id} hidden={hidden}>
        {items.map((item, idx) => {
          if (item.type === "category") {
            return (
              <NavbarItemCategory
                key={idx}
                item={item}
                onItemClick={onItemClick}
                large={large}
              />
            );
          } else if (item.type === "link") {
            return (
              <li
                key={idx}
                className={classNames(styles.link, {
                  [styles.active]: isLinkActive(item),
                  [styles.underlyingStatsLink]: item.accent === "yellow",
                })}
                onClick={() => onItemClick(item)}
              >
                <Link href={item.href}>{item.label}</Link>
              </li>
            );
          }
        })}
      </ul>
    </>
  );
}

export default function NavbarItems({
  className,
  forceLarge = false,
  ...props
}: NavBarItemsProps) {
  const size = useScreenSize();
  const large = forceLarge || size.screen === BreakPoint.l;
  return (
    <nav
      className={classNames(
        styles.items,
        className,
        large ? styles.large : styles.small,
      )}
    >
      <NavbarItems_ {...props} large={large} />
    </nav>
  );
}
