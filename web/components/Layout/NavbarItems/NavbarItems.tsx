import { useState } from "react";
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
};

function NavbarItemCategory({ item, onItemClick }: NavBarCategoryProps) {
  const [collapsed, setCollapsed] = useState(() => isCategoryActive(item));
  const size = useScreenSize();
  return (
    <li
      className={classNames(styles.category, {
        [styles.active]: isCategoryActive(item),
        [styles.collapsed]: collapsed,
      })}
    >
      <div
        onClick={() => {
          setCollapsed((prev) => !prev);
        }}
      >
        <div className={styles.category_item}>
          {item.label}{" "}
          <div className={styles.arrow}>
            <Image
              src="/pictures/menu-arrow-drop-down.svg"
              alt="expand category"
              width={32}
              height={32}
            />
          </div>
        </div>
      </div>
      {/* always show the sublist but with display: none applied */}
      {(size.screen === BreakPoint.l || collapsed) && (
        <NavbarItems_ onItemClick={onItemClick} items={item.items} />
      )}
    </li>
  );
}

type NavBarItemsProps = {
  items: NavbarItem[];
  onItemClick: (item?: NavbarItem) => void;
};

function NavbarItems_({ items, onItemClick }: NavBarItemsProps) {
  return (
    <>
      {/* navbar items */}
      <ul className={styles.menu_list}>
        {items.map((item, idx) => {
          if (item.type === "category") {
            return (
              <NavbarItemCategory
                key={idx}
                item={item}
                onItemClick={onItemClick}
              />
            );
          } else if (item.type === "link") {
            return (
              <li
                key={idx}
                className={classNames(styles.link, {
                  [styles.active]: isLinkActive(item),
                })}
                onClick={() => onItemClick(item)}
              >
                <Link href={item.href}>
                  <a>{item.label}</a>
                </Link>
              </li>
            );
          }
        })}
      </ul>
    </>
  );
}

export default function NavbarItems(props: NavBarItemsProps) {
  const size = useScreenSize();
  return (
    <nav
      className={classNames(
        styles.items,
        size.screen === BreakPoint.l ? styles.large : styles.small
      )}
    >
      <NavbarItems_ {...props} />
    </nav>
  );
}
