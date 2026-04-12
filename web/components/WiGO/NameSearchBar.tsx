import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent
} from "react";
import { useQuery } from "@tanstack/react-query";

import Fetch from "lib/cors-fetch";
import supabase from "lib/supabase";
import styles from "./NameSearchBar.module.scss";
import { Player } from "./types";

interface NameSearchBarProps {
  onSelect: (player: Player, headshotUrl: string) => void;
}

const DEBOUNCE_DELAY = 300;

const NameSearchBar: React.FC<NameSearchBarProps> = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(
    null
  );
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listItemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, DEBOUNCE_DELAY);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  const shouldQueryPlayers =
    debouncedSearchTerm.length > 0 && debouncedSearchTerm !== selectedPlayerName;

  const {
    data: filteredPlayers = [],
    isLoading,
    error
  } = useQuery<Player[]>({
    queryKey: ["wigoPlayerSearch", debouncedSearchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .ilike("fullName", `%${debouncedSearchTerm}%`)
        .limit(10);

      if (error) {
        throw error;
      }

      return (data as Player[]) ?? [];
    },
    enabled: shouldQueryPlayers
  });

  const fetchError =
    error instanceof Error ? "Failed to load players." : null;
  const shouldShowDropdown =
    isDropdownVisible &&
    searchTerm.trim().length > 0 &&
    searchTerm.trim() !== selectedPlayerName &&
    filteredPlayers.length > 0;

  useEffect(() => {
    listItemsRef.current = listItemsRef.current.slice(0, filteredPlayers.length);
    setActiveIndex(-1);
  }, [filteredPlayers]);

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

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < listItemsRef.current.length) {
      listItemsRef.current[activeIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [activeIndex]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setSearchTerm(nextValue);
      setIsDropdownVisible(nextValue.trim().length > 0);

      if (nextValue !== selectedPlayerName) {
        setSelectedPlayerName(null);
      }

      if (nextValue.trim() === "") {
        setActiveIndex(-1);
      }
    },
    [selectedPlayerName]
  );

  const handleSelect = useCallback(
    async (player: Player) => {
      setSearchTerm(player.fullName);
      setSelectedPlayerName(player.fullName);
      setIsDropdownVisible(false);
      setActiveIndex(-1);
      inputRef.current?.blur();

      let headshotUrl = player.image_url || "";

      if (!player.image_url) {
        try {
          const response = await Fetch(
            `https://api-web.nhle.com/v1/player/${player.id}/landing`
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          headshotUrl = data.headshot || "";

          void supabase
            .from("players")
            .update({
              image_url: headshotUrl,
              sweater_number: data.sweaterNumber,
              team_id: data.teamId
            })
            .eq("id", player.id);
        } catch (fetchError) {
          console.error("Error fetching headshot:", fetchError);
        }
      }

      onSelect(player, headshotUrl);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!shouldShowDropdown) {
        if (event.key === "Enter") {
          inputRef.current?.blur();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;

          setActiveIndex((previousIndex) => {
            const nextIndex = previousIndex + direction;

            if (nextIndex >= filteredPlayers.length) {
              return 0;
            }

            if (nextIndex < 0) {
              return filteredPlayers.length - 1;
            }

            return nextIndex;
          });
          break;
        }
        case "Enter":
          event.preventDefault();
          if (activeIndex >= 0 && activeIndex < filteredPlayers.length) {
            void handleSelect(filteredPlayers[activeIndex]);
          } else {
            setIsDropdownVisible(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
          }
          break;
        case "Tab":
          setIsDropdownVisible(false);
          setActiveIndex(-1);
          break;
        case "Escape":
          event.preventDefault();
          setIsDropdownVisible(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
        default:
          break;
      }
    },
    [activeIndex, filteredPlayers, handleSelect, shouldShowDropdown]
  );

  const activeDescendantId = useMemo(
    () =>
      activeIndex >= 0 && activeIndex < filteredPlayers.length
        ? `player-option-${filteredPlayers[activeIndex].id}`
        : undefined,
    [activeIndex, filteredPlayers]
  );

  return (
    <div className={styles.searchBarContainer} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filteredPlayers.length > 0 && searchTerm.trim() !== selectedPlayerName) {
            setIsDropdownVisible(true);
          }
        }}
        placeholder="Search player"
        className={styles.searchInput}
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-controls="player-search-results"
        aria-activedescendant={activeDescendantId}
        aria-autocomplete="list"
      />

      {isLoading && <div className={styles.loadingIndicator}>Loading...</div>}
      {fetchError && <div className={styles.errorMessage}>{fetchError}</div>}

      {shouldShowDropdown && (
        <div className={styles.dropdown} id="player-search-results" role="listbox">
          {filteredPlayers.map((player, index) => (
            <div
              key={player.id}
              id={`player-option-${player.id}`}
              ref={(element) => {
                listItemsRef.current[index] = element;
              }}
              className={`${styles.dropdownItem} ${
                index === activeIndex ? styles.activeDropdownItem : ""
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                void handleSelect(player);
              }}
              role="option"
              aria-selected={index === activeIndex}
            >
              {player.fullName}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NameSearchBar;
