import React, { useId, useState } from "react";
import { PLAYER_CATALOG_DATE, searchPlayerCatalog, type PlayerCatalogEntry } from "../../lib/player-cards/playerCatalog";
import styles from "./PlayerLookup.module.scss";

export default function PlayerLookup({ disabled, onSelect }: { disabled: boolean; onSelect: (player: PlayerCatalogEntry) => void }) {
  const uid = useId(), [query, setQuery] = useState("");
  const result = searchPlayerCatalog(query), ready = query.trim().length >= 2;
  return <fieldset className={styles.lookup} disabled={disabled}>
    <legend>Find a player by name</legend>
    <label htmlFor={`${uid}-query`}>Player name, team or NHL ID</label>
    <input id={`${uid}-query`} name="playerLookup" type="search" autoComplete="off" maxLength={100} value={query} aria-describedby={`${uid}-help`} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(""); }} />
    <p id={`${uid}-help`}>Identity catalog: {PLAYER_CATALOG_DATE}. Team labels may have changed; Load NHL results verifies the selected player’s current identity and team. You can also paste an ID or FHFH player URL below.</p>
    <p role="status" aria-live="polite">{query.trim() ? !ready ? "Enter at least two characters." : result.total ? `${result.total} catalog ${result.total === 1 ? "match" : "matches"}.${result.total > result.matches.length ? ` Showing the first ${result.matches.length}; refine your search for more.` : " Choose a player, then load results."}` : "No catalog matches. Try another spelling, or enter an NHL ID below." : ""}</p>
    {ready && result.matches.length > 0 && <ul aria-label="Matching players">{result.matches.map(player => <li key={player.id}>
      <button type="button" disabled={player.position === "G"} onClick={() => { setQuery(""); onSelect(player); }}><strong>{player.name}</strong><span>{player.team} · {player.position} · NHL {player.id}</span></button>
      {player.position === "G" && <span className={styles.unavailable}>Goalie card data is unavailable in this skater flow.</span>}
    </li>)}</ul>}
  </fieldset>;
}
