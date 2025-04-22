// web/components/WiGO/NameSearchBar.tsx

import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  useCallback
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
  // --- State to track the last selected player name ---
  const [lastSelectedPlayerName, setLastSelectedPlayerName] = useState<
    string | null
  >(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listItemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const latestQueryRef = useRef<string>("");
  const isSelectingRef = useRef<boolean>(false); // Keep this for edge cases

  const DEBOUNCE_DELAY = 300;

  // --- Modify useEffect that watches searchTerm ---
  useEffect(() => {
    // Reset list refs and active index (no change needed here)
    listItemsRef.current = listItemsRef.current.slice(
      0,
      filteredPlayers.length
    );
    setActiveIndex(-1);

    const trimmedSearch = searchTerm.trim();

    // --- Guard 1: Prevent effect if search term matches the last selected name ---
    // This stops fetching/showing dropdown if the effect runs due to setSearchTerm(player.fullName) in handleSelect
    if (trimmedSearch !== "" && trimmedSearch === lastSelectedPlayerName) {
      console.log(
        "Search term effect: Term matches last selected, skipping fetch and dropdown update."
      );
      setIsLoading(false); // Ensure loading indicator is off
      // setIsDropdownVisible(false); // Ensure dropdown remains closed
      return; // Stop this effect run
    }

    // Clear results and last selected name if input is cleared
    if (trimmedSearch === "") {
      setFilteredPlayers([]);
      setIsDropdownVisible(false);
      setIsLoading(false);
      setFetchError(null);
      setLastSelectedPlayerName(null); // <<< Clear last selected when input is empty
      return;
    }

    // If we get here, it's a new search, or the initial load after selection was blocked by Guard 1
    setIsLoading(true);
    setFetchError(null);
    latestQueryRef.current = searchTerm;

    const handler = setTimeout(async () => {
      // Secondary guard using isSelectingRef (less critical now but good backup)
      if (isSelectingRef.current) {
        console.log(
          "Search term effect (timeout): isSelectingRef is true, bailing out."
        );
        setIsLoading(false);
        return;
      }

      // --- Guard 2: Inside timeout, double-check against last selected name ---
      // Protects against race conditions if state updates happen late
      if (searchTerm.trim() === lastSelectedPlayerName) {
        console.log(
          "Search term effect (timeout): Term matches last selected, skipping fetch."
        );
        setIsLoading(false);
        return;
      }

      try {
        // Fetch data (use original searchTerm in case of leading/trailing spaces during typing)
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .ilike("fullName", `%${searchTerm}%`)
          .limit(10);

        // Process results only if this timeout corresponds to the latest search term entered
        if (searchTerm === latestQueryRef.current) {
          if (error) {
            console.error("Error fetching players:", error);
            setFetchError("Failed to load players.");
            setFilteredPlayers([]);
            setIsDropdownVisible(false);
          } else {
            console.log(
              "Search term effect (timeout): Fetched players for:",
              searchTerm,
              data
            );
            setFilteredPlayers(data as Player[]);
            // <<< Show dropdown ONLY if it's a valid result for a NEW search term
            setIsDropdownVisible(
              data.length > 0 && searchTerm.trim() !== lastSelectedPlayerName
            );
            setActiveIndex(-1); // Reset index on new results
          }
        } else {
          console.log(
            "Search term effect (timeout): Stale timeout ignored for",
            searchTerm
          );
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        if (searchTerm === latestQueryRef.current) {
          setFetchError("An unexpected error occurred.");
          setFilteredPlayers([]);
          setIsDropdownVisible(false);
        }
      } finally {
        // Stop loading only if this timeout corresponds to the latest search term
        if (searchTerm === latestQueryRef.current) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(handler);
    };
    // --- Add lastSelectedPlayerName to dependency array ---
  }, [searchTerm, lastSelectedPlayerName]);

  // Handle input changes - Clear last selected name on manual change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    // If user types something different than the selected name, clear the lock
    if (value !== lastSelectedPlayerName) {
      setLastSelectedPlayerName(null);
    }
  };

  // Handle click outside (no change needed)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownVisible(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Modify handleSelect ---
  const handleSelect = useCallback(
    async (player: Player) => {
      console.log("handleSelect:", player.fullName);
      isSelectingRef.current = true; // Mark selecting start

      // Set states needed for UI update and guards
      setSearchTerm(player.fullName);
      setLastSelectedPlayerName(player.fullName); // <<< Store the selected name
      setIsDropdownVisible(false); // Close dropdown
      setActiveIndex(-1); // Reset keyboard nav index

      // --- Blur the input field ---
      inputRef.current?.blur(); // <<< Remove focus from input

      // --- Perform async actions ---
      let headshotUrl = player.image_url || ""; // Default to existing or empty string

      if (!player.image_url) {
        try {
          const response = await Fetch(
            `https://api-web.nhle.com/v1/player/${player.id}/landing`
          );
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          headshotUrl = data.headshot || ""; // Use fetched or empty string
          const teamId = data.teamId;
          const sweaterNumber = data.sweaterNumber;

          // Update DB asynchronously (don't wait for UI)
          supabase
            .from("players")
            .update({
              image_url: headshotUrl,
              sweater_number: sweaterNumber,
              team_id: teamId
            })
            .eq("id", player.id)
            .then(({ error }) => {
              if (error) console.error("DB Update error:", error);
            });
        } catch (error) {
          console.error("Error fetching headshot:", error);
          // headshotUrl remains empty string
        }
      }

      // Call the parent callback
      onSelect(player, headshotUrl);

      // Reset selecting flag after logic completes
      isSelectingRef.current = false;
      console.log("handleSelect finished for:", player.fullName);
    },
    [onSelect] // Dependency array
  );

  // Scroll active item into view (no change needed)
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < listItemsRef.current.length) {
      listItemsRef.current[activeIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [activeIndex]);

  // --- Modify handleKeyDown ---
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownVisible || filteredPlayers.length === 0) {
      if (e.key === "Enter") {
        // Optional: Prevent form submission if Enter pressed when closed
        // e.preventDefault();
        // Blur if user hits Enter on an empty/closed search
        if (searchTerm.trim() === "" || filteredPlayers.length === 0) {
          inputRef.current?.blur();
        }
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        const direction = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((prevIndex) => {
          const nextIndex = prevIndex + direction;
          if (nextIndex >= filteredPlayers.length) return 0;
          if (nextIndex < 0) return filteredPlayers.length - 1;
          return nextIndex;
        });
        break;
      case "Enter":
        e.preventDefault(); // Prevent form submission
        if (activeIndex >= 0 && activeIndex < filteredPlayers.length) {
          handleSelect(filteredPlayers[activeIndex]);
          // Blur and state updates are now handled within handleSelect
        } else {
          // If Enter is pressed with no item highlighted, just close and blur
          setIsDropdownVisible(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
        }
        break;
      case "Tab":
        // Close dropdown on Tab, allow default focus change
        // If an item is active, maybe select it first? Decide on desired UX.
        // Example: Close without selecting
        setIsDropdownVisible(false);
        setActiveIndex(-1);
        break;
      case "Escape":
        e.preventDefault(); // Prevent other actions
        setIsDropdownVisible(false);
        setActiveIndex(-1);
        inputRef.current?.blur(); // Also blur on Escape
        break;
      default:
        break;
    }
  };

  // Active Index Log (no change needed)
  useEffect(() => {
    // console.log(`--- ActiveIndex State Updated To: ${activeIndex} ---`);
  }, [activeIndex]);

  // Determine the active descendant ID (no change needed)
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
        // --- Modify onFocus handler ---
        onFocus={() => {
          const currentVal = searchTerm.trim();
          console.log(
            "Input Focus - Value:",
            currentVal,
            "LastSelected:",
            lastSelectedPlayerName,
            "#Filtered:",
            filteredPlayers.length
          );

          // --- Guard: Don't reopen if focus happens right after selection OR if input is empty ---
          if (
            currentVal &&
            currentVal !== lastSelectedPlayerName &&
            filteredPlayers.length > 0
          ) {
            console.log("Input Focus: Reopening dropdown.");
            setIsDropdownVisible(true); // Reopen only if it's a different name and there are results
          } else if (currentVal && currentVal === lastSelectedPlayerName) {
            console.log(
              "Input Focus: Value matches last selected, keeping dropdown closed."
            );
            setIsDropdownVisible(false); // Ensure it stays closed
          } else {
            console.log(
              "Input Focus: Empty or no players, keeping dropdown closed."
            );
            // Don't open if search term is empty or no results exist for current term
            setIsDropdownVisible(false);
          }
        }}
        // Optional: Add onBlur to explicitly close if needed, though blur() should handle it
        // onBlur={() => setTimeout(() => setIsDropdownVisible(false), 100)} // Delay allows click selection
      />

      {/* Loading/Error Indicators */}
      {isLoading && <div className={styles.loading}>Loading...</div>}
      {fetchError && <div className={styles.error}>{fetchError}</div>}

      {/* Dropdown List */}
      {isDropdownVisible && (
        <div id="player-dropdown" className={styles.dropdown} role="listbox">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player, index) => (
              <div
                ref={(el) => {
                  listItemsRef.current[index] = el;
                }}
                key={player.id}
                id={`player-option-${player.id}`}
                className={`${styles.dropdownItem} ${
                  index === activeIndex ? styles.active : ""
                }`}
                // Use onMouseDown to select before blur potentially hides the dropdown
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur before selection registers
                  handleSelect(player);
                }}
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
