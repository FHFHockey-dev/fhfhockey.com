// web/components/WiGO/NameSearchBar.tsx

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ref to track the latest query to handle out-of-order responses
  const latestQueryRef = useRef<string>("");

  // Debounce delay in milliseconds
  const DEBOUNCE_DELAY = 300;

  // Effect to handle debounced search
  useEffect(() => {
    // If searchTerm is empty, reset the state
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

    // Set up the debounce
    const handler = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .ilike("fullName", `%${searchTerm}%`) // Case-insensitive search
          .limit(10); // Limit results for performance

        if (error) {
          console.error("Error fetching players:", error);
          setFetchError("Failed to load players.");
          setFilteredPlayers([]);
          setIsDropdownVisible(false);
        } else {
          // Ensure that the response corresponds to the latest query
          if (searchTerm === latestQueryRef.current) {
            setFilteredPlayers(data as Player[]);
            setIsDropdownVisible(true);
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
        // Only update loading state if the query hasn't changed
        if (searchTerm === latestQueryRef.current) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_DELAY);

    // Cleanup function to cancel the timeout if searchTerm changes
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
   * Checks if `image_url` is available in the database and uses it.
   * If not available, fetches the headshot from NHL API and updates the database.
   *
   * @param {Player} player - The selected player object.
   * @returns {Promise<void>} - A promise that resolves when the selection handling is complete.
   * @throws {Error} - Throws an error if the HTTP response is not ok.
   */
  const handleSelect = async (player: Player) => {
    setSearchTerm(player.fullName);
    setIsDropdownVisible(false);

    // Use existing image URL if available
    if (player.image_url) {
      onSelect(player, player.image_url);
      return;
    }

    // Fetch the image URL from the NHL API if not in the database
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

      // Pass the image URL to the onSelect callback
      onSelect(player, headshotUrl);

      // Update the player's image URL in the database for future use
      await supabase
        .from("players")
        .update({
          image_url: headshotUrl,
          sweater_number: sweaterNumber,
          team_id: teamId,
        })
        .eq("id", player.id);
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
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isDropdownVisible}
        aria-controls="player-dropdown"
      />

      {isLoading && <div className={styles.loading}>Loading...</div>}
      {fetchError && <div className={styles.error}>{fetchError}</div>}
      {isDropdownVisible && (
        <div id="player-dropdown" className={styles.dropdown} role="listbox">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => (
              <div
                key={player.id}
                className={styles.dropdownItem}
                onClick={() => handleSelect(player)}
                role="option"
                aria-selected="false"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleSelect(player);
                  }
                }}
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
