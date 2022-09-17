import classNames from "classnames";
import { Footer } from "components/Layout/Layout";
import ITEMS_DATA, {
  NavbarItem,
  NavbarItemCategory,
  NavbarItemLink,
} from "components/Layout/navbarItems";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function isCategoryActive(
  category: NavbarItemCategory,
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

function NavBarItems({ items }: { items: NavbarItem[] }) {
  return (
    <>
      {/* navbar items */}
      <ul className={styles.menu_list}>
        {items.map((item, idx) => {
          if (item.type === "category") {
            return (
              <li
                key={idx}
                className={classNames(styles.category, {
                  [styles.active]: isCategoryActive(
                    item,
                    window.location.pathname
                  ),
                })}
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
                <NavBarItems items={item.items} />
              </li>
            );
          } else if (item.type === "link") {
            return (
              <li
                key={idx}
                className={classNames(styles.link, {
                  [styles.active]: isLinkActive(item, window.location.pathname),
                })}
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
  return (
    <div className={styles.menu}>
      <div>
        <nav>
          <NavBarItems items={ITEMS_DATA} />
        </nav>
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
