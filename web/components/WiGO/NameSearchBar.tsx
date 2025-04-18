// web/components/WiGO/NameSearchBar.tsx

import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  useCallback // Import useCallback
} from "react";
import styles from "./NameSearchBar.module.scss";
import supabase from "lib/supabase";
import { Player } from "./types";
import Fetch from "lib/cors-fetch";

interface NameSearchBarProps {
  onSelect: (player: Player, headshotUrl: string) => void;
}

const NameSearchBar: React.FC<NameSearchBarProps> = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listItemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const latestQueryRef = useRef<string>(""); // Ref to track the latest query to handle out-of-order responses
  const isSelectingRef = useRef<boolean>(false); // Ref to track if a selection was made to prevent dropdown from reopening

  const DEBOUNCE_DELAY = 300;

  // Effect to handle debounced search
  useEffect(() => {
    listItemsRef.current = listItemsRef.current.slice(
      0,
      filteredPlayers.length
    );
    setActiveIndex(-1); // Reset active index when players change

    if (searchTerm.trim() === "") {
      setFilteredPlayers([]);
      setIsDropdownVisible(false);
      setIsLoading(false);
      setFetchError(null);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    latestQueryRef.current = searchTerm;

    const handler = setTimeout(async () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .ilike("fullName", `%${searchTerm}%`)
          .limit(10);

        if (error) {
          console.error("Error fetching players:", error);
          if (searchTerm === latestQueryRef.current) {
            setFetchError("Failed to load players.");
            setFilteredPlayers([]);
            setIsDropdownVisible(false);
          }
        } else {
          if (searchTerm === latestQueryRef.current) {
            setFilteredPlayers(data as Player[]);
            setIsDropdownVisible(data.length > 0); // Only show if there are results
            setActiveIndex(-1); // Reset index on new results
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        if (searchTerm === latestQueryRef.current) {
          setFetchError("An unexpected error occurred.");
          setFilteredPlayers([]);
          setIsDropdownVisible(false);
        }
      } finally {
        if (searchTerm === latestQueryRef.current && !isSelectingRef.current) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Handle input changes
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) // Also check if click is outside input
      ) {
        setIsDropdownVisible(false);
        setActiveIndex(-1); // Reset index when closing
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Handles the selection of a player from the search bar.
   */
  const handleSelect = useCallback(
    async (player: Player) => {
      isSelectingRef.current = true; // Mark as selecting
      setSearchTerm(player.fullName);
      setIsDropdownVisible(false);
      setActiveIndex(-1); // Reset index on selection

      // Use existing image URL if available
      if (player.image_url) {
        onSelect(player, player.image_url);
        setTimeout(() => (isSelectingRef.current = false), 50);
        return;
      }

      // Fetch the image URL
      try {
        const response = await Fetch(
          `https://api-web.nhle.com/v1/player/${player.id}/landing`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const headshotUrl = data.headshot;
        const teamId = data.teamId;
        const sweaterNumber = data.sweaterNumber;

        onSelect(player, headshotUrl);

        // Update DB
        await supabase
          .from("players")
          .update({
            image_url: headshotUrl,
            sweater_number: sweaterNumber,
            team_id: teamId
          })
          .eq("id", player.id);
      } catch (error) {
        console.error("Error fetching headshot:", error);
        onSelect(player, "");
      } finally {
        // Reset selecting flag slightly later
        setTimeout(() => (isSelectingRef.current = false), 50);
      }
    },
    [onSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < listItemsRef.current.length) {
      const activeItem = listItemsRef.current[activeIndex];
      activeItem?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [activeIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownVisible || filteredPlayers.length === 0) {
      console.log(" -> Condition not met, returning early.");
      // If dropdown is closed or empty, allow default behavior (except Enter)
      if (e.key === "Enter") {
        // Optionally prevent form submission if inside a form
        // e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); // Prevent cursor move
        setActiveIndex((prevIndex) => {
          const newIndex =
            prevIndex >= filteredPlayers.length - 1 ? 0 : prevIndex + 1;
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault(); // Prevent cursor move
        setActiveIndex((prevIndex) => {
          const newIndex =
            prevIndex <= 0 ? filteredPlayers.length - 1 : prevIndex - 1;
          return newIndex;
        });
        break;
      case "Enter":
      case "Tab": // Consider selecting on Tab as well, or just closing
        e.preventDefault(); // Prevent form submit if inside a form
        if (activeIndex >= 0 && activeIndex < filteredPlayers.length) {
          handleSelect(filteredPlayers[activeIndex]);
        } else if (e.key === "Tab") {
          // If tabbed with no selection, just close
          setIsDropdownVisible(false);
          setActiveIndex(-1);
        }
        break;
      case "Escape":
        e.preventDefault(); // Prevent potential browser actions
        setIsDropdownVisible(false);
        setActiveIndex(-1);
        break;
      default:
        // Allow other keys (like typing) to function normally
        break;
    }
  };

  // Also log activeIndex whenever it changes to confirm state updates
  useEffect(() => {
    console.log(`--- ActiveIndex State Updated To: ${activeIndex} ---`);
  }, [activeIndex]);

  // Determine the active descendant ID for ARIA
  const activeDescendantId =
    activeIndex >= 0 && activeIndex < filteredPlayers.length
      ? `player-option-${filteredPlayers[activeIndex].id}`
      : undefined;

  return (
    <div className={styles.searchBarContainer} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search player..."
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className={styles.searchInput}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isDropdownVisible}
        aria-controls="player-dropdown"
        aria-autocomplete="list"
        aria-activedescendant={activeDescendantId}
        onFocus={() => {
          if (searchTerm.trim() && filteredPlayers.length > 0) {
            setIsDropdownVisible(true);
          }
        }}
      />

      {isLoading && <div className={styles.loading}>Loading...</div>}
      {fetchError && <div className={styles.error}>{fetchError}</div>}
      {isDropdownVisible && (
        <div
          id="player-dropdown"
          className={styles.dropdown}
          role="listbox"
          // capture focus briefly if needed, but keep focus on input
          // tabIndex={-1}
        >
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player, index) => (
              <div
                ref={(el) => {
                  listItemsRef.current[index] = el;
                }}
                key={player.id}
                id={`player-option-${player.id}`} // Unique ID for aria-activedescendant
                className={`${styles.dropdownItem} ${
                  index === activeIndex ? styles.active : ""
                }`}
                onClick={() => handleSelect(player)}
                onMouseDown={(e) => e.preventDefault()}
                role="option"
                aria-selected={index === activeIndex}
              >
                {player.fullName}
              </div>
            ))
          ) : (
            <div className={styles.noResults}>No players found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NameSearchBar;
