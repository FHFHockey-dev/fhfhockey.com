import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";

import { Footer } from "components/Layout/Layout";
import ITEMS_DATA, {
  NavbarItem,
  NavbarItemCategory as NavbarItemCategoryType,
  NavbarItemLink,
} from "components/Layout/navbarItems";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function isCategoryActive(
  category: NavbarItemCategoryType,
  currentPath: string
): boolean {
  return category.items.some((item) => {
    if (item.type === "link") {
      // TODO: handle external site
      return item.href === currentPath;
    } else if (item.type === "category") {
      return isCategoryActive(item, currentPath);
    }
  });
}

function isLinkActive(link: NavbarItemLink, currentPath: string): boolean {
  return link.href === currentPath;
}

type NavBarCategoryProps = {
  item: NavbarItemCategoryType;
  onItemClick: (item?: NavbarItem) => void;
};

function NavbarItemCategory({ item, onItemClick }: NavBarCategoryProps) {
  const [collapsed, setCollapsed] = useState(() =>
    isCategoryActive(item, window.location.pathname)
  );

  return (
    <li
      className={classNames(styles.category, {
        [styles.active]: isCategoryActive(item, window.location.pathname),
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
          <Image
            src="/pictures/menu-arrow-drop-down.svg"
            alt="expand category"
            width={32}
            height={32}
          />
        </div>
      </div>
      {collapsed && (
        <NavBarItems onItemClick={onItemClick} items={item.items} />
      )}
    </li>
  );
}

type NavBarItemsProps = {
  items: NavbarItem[];
  onItemClick: (item?: NavbarItem) => void;
};
function NavBarItems({ items, onItemClick }: NavBarItemsProps) {
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
                  [styles.active]: isLinkActive(item, window.location.pathname),
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

function MobileMenu({ setMenuOpen }: MobileMenuProps) {
  // prevent scroll penetration
  useEffect(() => {
    document
      .getElementsByTagName("body")[0]
      .setAttribute("style", "overflow: hidden;");
    return () => {
      document
        .getElementsByTagName("body")[0]
        .setAttribute("style", "overflow: visible;");
    };
  });
  return (
    <div className={styles.menu}>
      <nav>
        <NavBarItems
          items={ITEMS_DATA}
          onItemClick={() => setMenuOpen(false)}
        />
      </nav>

      <div>
        {/* social medias */}
        <SocialMedias />
        {/* join button */}
        <button className={styles.join}>JOIN COMMUNITY</button>
        <Footer />
      </div>
    </div>
  );
}

function SocialMedias() {
  return (
    <div className={styles.socialMedias}>
      <a
        href="https://www.twitter.com/fhfhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-twitter.png"
          alt="Twitter"
          width={32}
          height={28}
        />
      </a>
      <a
        href="https://discord.gg/kfnyrn7"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-discord.png"
          alt="Discord"
          width={38}
          height={28}
        />
      </a>
      <a
        href="https://www.patreon.com/FHFHRadio"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-patreon.png"
          alt="Patreon"
          width={28}
          height={28}
        />
      </a>
      <a
        href="https://www.youtube.com/fiveholefantasyhockey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-youtube.png"
          alt="Youtube"
          width={28}
          height={28}
        />
      </a>
      <a
        href="https://open.spotify.com/show/0tcyfS62ZHdLYA3Xf3QgSQ?si=HtfgMe8_QD6KfwiOw2fC1g"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/pictures/white-spotify.png"
          alt="Spotify"
          width={28}
          height={28}
        />
      </a>
    </div>
  );
}

export default MobileMenu;
