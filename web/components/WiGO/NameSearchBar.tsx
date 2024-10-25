// web/components/WiGO/NameSearchBar.tsx

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import styles from "./NameSearchBar.module.scss";
import supabase from "lib/supabase";
import { Player } from "./types";
import debounce from "utils/debounce";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced fetch function
  const debouncedFetchPlayers = useRef(
    debounce(async (query: string) => {
      if (query.trim() === "") {
        setFilteredPlayers([]);
        setIsDropdownVisible(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setFetchError(null);

      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .ilike("fullName", `%${query}%`) // Case-insensitive search
          .limit(10); // Limit results for performance

        if (error) {
          console.error("Error fetching players:", error);
          setFetchError("Failed to load players.");
          setFilteredPlayers([]);
          setIsDropdownVisible(false);
        } else {
          setFilteredPlayers(data as Player[]);
          setIsDropdownVisible(true);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setFetchError("An unexpected error occurred.");
        setFilteredPlayers([]);
        setIsDropdownVisible(false);
      } finally {
        setIsLoading(false);
      }
    }, 300) // 300ms debounce delay
  ).current;

  // Handle input changes
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedFetchPlayers(value);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Handles the selection of a player from the search bar.
   *
   * @param {Player} player - The selected player object.
   * @returns {Promise<void>} - A promise that resolves when the selection handling is complete.
   * @throws {Error} - Throws an error if the HTTP response is not ok.
   */
  const handleSelect = async (player: Player) => {
    setSearchTerm(player.fullName);
    setIsDropdownVisible(false);

    try {
      //
      const response = await Fetch(
        `https://api-web.nhle.com/v1/player/${player.id}/landing`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const headshotUrl = data.headshot;
      onSelect(player, headshotUrl);
    } catch (error) {
      console.error("Error fetching headshot:", error);
      onSelect(player, ""); // Optionally set a default or placeholder image URL
    }
  };

  return (
    <div className={styles.searchBarContainer} ref={dropdownRef}>
      <input
        type="text"
        placeholder="Search player..."
        value={searchTerm}
        onChange={handleInputChange}
        className={styles.searchInput}
        aria-haspopup="listbox"
        aria-expanded={isDropdownVisible}
      />

      {isLoading && <div className={styles.loading}>Loading...</div>}
      {fetchError && <div className={styles.error}>{fetchError}</div>}
      {isDropdownVisible && (
        <div className={styles.dropdown} role="listbox">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={styles.dropdownItem}
                onClick={() => handleSelect(player)}
                role="option"
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
