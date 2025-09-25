import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import supabase from "lib/supabase/client";
import { lookupTeamLabel } from "lib/trends/skoUtils";
import type { PlayerSearchResult } from "lib/trends/skoTypes";
import styles from "../../pages/trends/index.module.scss";

const SEARCH_MIN_LENGTH = 2;

type Props = {
  onSelect: (player: PlayerSearchResult) => void;
};

export default function SearchBox({ onSelect }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const executeSearch = useCallback(async (query: string) => {
    if (query.length < SEARCH_MIN_LENGTH) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("players")
        .select("id, fullName, position, team_id")
        .ilike("fullName", `%${query}%`)
        .order("fullName", { ascending: true })
        .limit(20);
      if (error) throw error;
      setSearchResults(
        ((data ?? []) as PlayerSearchResult[]).map((row) => ({
          ...row,
          fullName: row.fullName ?? `Player #${row.id}`
        }))
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Player search error", e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchTerm(value);
      setShowResults(true);
      executeSearch(value.trim());
    },
    [executeSearch]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.searchContainer} ref={ref}>
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search skaters…"
        value={searchTerm}
        onChange={handleChange}
        onFocus={() => setShowResults(true)}
      />
      {showResults ? (
        <div className={styles.searchResults}>
          {searching ? (
            <div className={styles.emptyResult}>Searching…</div>
          ) : searchTerm.length < SEARCH_MIN_LENGTH ? (
            <div className={styles.emptyResult}>
              Type at least {SEARCH_MIN_LENGTH} letters
            </div>
          ) : searchResults.length ? (
            searchResults.map((player) => (
              <div
                key={player.id}
                className={styles.searchResultItem}
                onClick={() => onSelect(player)}
              >
                <span>{player.fullName}</span>
                <span>
                  {[
                    lookupTeamLabel(player.team_id) ?? "",
                    player.position ?? ""
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyResult}>No skaters found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
