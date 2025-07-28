import React, { useEffect, useState } from "react";
import { animated, useTransition } from "@react-spring/web";
import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import supabase from "lib/supabase";

import SocialMedias from "components/SocialMedias";

import styles from "./MobileMenu.module.scss";

type MobileMenuProps = {
  onItemClick: () => void;
  visible: boolean;
};

interface PlayerResult {
  id: number;
  fullName: string;
  image_url: string | null;
  team_id: number | null;
}

// Define navigation items with icons
const NAVIGATION_ITEMS = [
  {
    id: "home",
    label: "Home",
    href: "/",
    icon: "/pictures/homeNavIcon.png"
  },
  {
    id: "stats",
    label: "Stats",
    href: "/stats",
    icon: "/pictures/statsIcon.png"
  },
  {
    id: "gameGrid",
    label: "Game Grid",
    href: "/game-grid",
    icon: "/pictures/gameGrid.png"
  },
  {
    id: "lines",
    label: "Line Combinations",
    href: "/lines",
    icon: "/pictures/lineCombosIcon.png"
  },
  {
    id: "wigo",
    label: "WiGO Charts",
    href: "/wigoCharts",
    icon: "/pictures/wigoIcon.png"
  },
  {
    id: "shifts",
    label: "Shift Chart",
    href: "/shiftChart",
    icon: "/pictures/shiftChartsIcon.png"
  },
  {
    id: "matrix",
    label: "Date Range Line Matrix",
    href: "/drm",
    icon: "/pictures/drmIcon.png"
  },
  {
    id: "podcast",
    label: "Podcast",
    href: "/podfeed",
    iconType: "svg", // Mark as SVG icon
    svgIcon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 1C8.688 1 6 3.688 6 7C6 8.5 6.5 9.875 7.375 10.938L6.219 17.375C6.094 18.125 6.625 18.781 7.406 18.781H16.594C17.375 18.781 17.906 18.125 17.781 17.375L16.625 10.938C17.5 9.875 18 8.5 18 7C18 3.688 15.312 1 12 1ZM12 3C14.219 3 16 4.781 16 7C16 9.219 14.219 11 12 11C9.781 11 8 9.219 8 7C8 4.781 9.781 3 12 3ZM9.5 5.5C9.219 5.5 9 5.781 9 6C9 6.219 9.219 6.5 9.5 6.5C9.781 6.5 10 6.219 10 6C10 5.781 9.781 5.5 9.5 5.5ZM14.5 5.5C14.219 5.5 14 5.781 14 6C14 6.219 14.219 6.5 14.5 6.5C14.781 6.5 15 6.219 15 6C15 5.781 14.781 5.5 14.5 5.5ZM9 20.5V22H15V20.5H9Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: "blog",
    label: "Blog",
    href: "/blog",
    iconType: "svg", // Mark as SVG icon
    svgIcon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path
          d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6ZM6 4H13V9H18V20H6V4ZM8 12V14H16V12H8ZM8 16V18H13V16H8Z"
          fill="currentColor"
        />
      </svg>
    )
  }
];

function MobileMenu({ onItemClick, visible }: MobileMenuProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const transitions = useTransition(visible, {
    from: {
      opacity: 0,
      transform: "translateY(100%)"
    },
    enter: {
      opacity: 1,
      transform: "translateY(0%)"
    },
    leave: {
      opacity: 0,
      transform: "translateY(100%)"
    },
    config: {
      tension: 280,
      friction: 26
    }
  });

  // Prevent scroll when menu is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [visible]);

  // Handle player search with debouncing
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    const searchTimeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("players")
          .select("id, fullName, image_url, team_id")
          .ilike("fullName", `%${searchQuery}%`)
          .limit(8);

        setSearchResults((data as PlayerResult[]) || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handlePlayerSelect = (playerId: number) => {
    setSearchQuery("");
    setShowSearchResults(false);
    onItemClick();
    router.push(`/stats/player/${playerId}`);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleNavItemClick = () => {
    onItemClick();
  };

  return (
    <>
      {transitions((style, show) =>
        show ? (
          <animated.div className={styles.overlay} style={style}>
            <div className={styles.menuContainer}>
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.logo}>
                  <span className={styles.logoText}>FHF</span>
                  <span className={styles.logoAccent}>HOCKEY</span>
                </div>
                <button
                  className={styles.closeButton}
                  onClick={onItemClick}
                  aria-label="Close menu"
                >
                  <div className={styles.closeIcon}>
                    <span></span>
                    <span></span>
                  </div>
                </button>
              </div>

              {/* Search Section */}
              <div className={styles.searchSection}>
                <div className={styles.searchContainer}>
                  <div className={styles.searchInputWrapper}>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={searchQuery}
                      onChange={handleSearchInputChange}
                      className={styles.searchInput}
                    />
                    <div className={styles.searchIcon}>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M21 21L16.5 16.5M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {isSearching && (
                    <div className={styles.searchStatus}>Searching...</div>
                  )}

                  {showSearchResults && searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((player) => (
                        <button
                          key={player.id}
                          className={styles.searchResultItem}
                          onClick={() => handlePlayerSelect(player.id)}
                        >
                          {player.image_url && (
                            <img
                              src={player.image_url}
                              alt={player.fullName}
                              className={styles.playerImage}
                            />
                          )}
                          <span className={styles.playerName}>
                            {player.fullName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSearchResults &&
                    searchResults.length === 0 &&
                    !isSearching &&
                    searchQuery.length >= 2 && (
                      <div className={styles.noResults}>No players found</div>
                    )}
                </div>
              </div>

              {/* Navigation Grid */}
              <div className={styles.navigationSection}>
                <h3 className={styles.sectionTitle}>Navigation</h3>
                <div className={styles.iconGrid}>
                  {NAVIGATION_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={styles.iconGridItem}
                      onClick={handleNavItemClick}
                    >
                      <div className={styles.iconContainer}>
                        {item.iconType === "svg" ? (
                          item.svgIcon
                        ) : item.icon ? (
                          <Image
                            src={item.icon}
                            alt={item.label}
                            width={32}
                            height={32}
                            className={styles.navIcon}
                          />
                        ) : null}
                      </div>
                      <span className={styles.iconLabel}>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className={styles.footer}>
                <div className={styles.socialSection}>
                  <SocialMedias />
                </div>
                <div className={styles.appInfo}>
                  <span className={styles.appName}>
                    Five Hole Fantasy Hockey
                  </span>
                  <span className={styles.appVersion}>Premium Analytics</span>
                </div>
              </div>
            </div>
          </animated.div>
        ) : null
      )}
    </>
  );
}

export default MobileMenu;
