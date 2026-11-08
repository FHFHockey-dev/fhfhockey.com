import { useId, useMemo, useState, type InputHTMLAttributes, type KeyboardEvent, type Ref } from "react";

import { foldName } from "./TrainerCard";
import type { TrainerPlayerOption } from "./trainerApi";
import styles from "./TweetSwipeTrainer.module.scss";

const MAX_RESULTS = 8;

function matches(player: TrainerPlayerOption, query: string): boolean {
  const name = foldName(player.fullName);
  return name.includes(query) || name.split(/[\s-]+/).some((part) => part.startsWith(query));
}

/**
 * Player search that opens under its field (the native datalist rendered as a full-height side panel).
 * Searches the tweet's team first; when that team has no match it offers "Search all players", because
 * a traded or called-up player may not be on the roster the parser used yet.
 */
export default function PlayerCombobox(props: {
  value: string;
  onChange: (value: string) => void;
  players: TrainerPlayerOption[];
  teamId: number | null;
  teamLabel?: string | null;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra handlers for the field (slots use them for tap-to-place and drops). */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"team" | "all">(props.teamId == null ? "all" : "team");
  const [active, setActive] = useState(0);
  const query = foldName(props.value);
  const readOnly = Boolean(props.inputProps?.readOnly);

  const results = useMemo(() => {
    if (!query) return [];
    const pool = scope === "team" ? props.players.filter((player) => player.team_id === props.teamId) : props.players;
    return pool.filter((player) => matches(player, query)).slice(0, MAX_RESULTS);
  }, [props.players, props.teamId, query, scope]);
  const offerAll = scope === "team" && props.teamId != null;
  const showList = open && !readOnly && query.length > 0;
  const optionCount = results.length + (offerAll ? 1 : 0);

  function pick(player: TrainerPlayerOption) {
    props.onChange(player.fullName);
    setOpen(false);
  }

  function choose(index: number) {
    if (index < results.length) pick(results[index]!);
    else if (offerAll) {
      setScope("all");
      setActive(0);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    props.inputProps?.onKeyDown?.(event);
    if (event.defaultPrevented || !showList) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((value) => (value + step + optionCount) % Math.max(optionCount, 1));
    } else if (event.key === "Enter" && optionCount) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      // Closing the list must not also close the editor or the card.
      event.stopPropagation();
      setOpen(false);
    }
  }

  const activeId = showList && optionCount ? `${listId}-${active}` : undefined;

  return (
    <span className={styles.combo}>
      <input
        {...props.inputProps}
        ref={props.inputRef}
        className={props.className}
        value={props.value}
        placeholder={props.placeholder}
        role="combobox"
        aria-label={props.inputProps?.["aria-label"] ?? props.ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showList}
        // Point at the list only while it exists.
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={activeId}
        autoComplete="off"
        onChange={(event) => {
          props.onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(event) => {
          props.inputProps?.onFocus?.(event);
          if (!readOnly) setOpen(true);
        }}
        onBlur={(event) => {
          props.inputProps?.onBlur?.(event);
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" className={styles.comboList} aria-label={`Players matching ${props.value}`}>
          {results.map((player, index) => (
            <li
              key={player.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? `${styles.comboOption} ${styles.comboOptionActive}` : styles.comboOption}
              // Keep focus in the field so the click lands before blur closes the list.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(player)}
            >
              <span>{player.fullName}</span>
              <span className={styles.comboMeta}>{player.position ?? ""}</span>
            </li>
          ))}
          {!results.length ? (
            <li className={styles.comboEmpty} role="presentation">
              No {scope === "team" && props.teamLabel ? `${props.teamLabel} ` : ""}players match &ldquo;{props.value}&rdquo;.
            </li>
          ) : null}
          {offerAll ? (
            <li
              id={`${listId}-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              className={active === results.length ? `${styles.comboOption} ${styles.comboOptionActive} ${styles.comboExpand}` : `${styles.comboOption} ${styles.comboExpand}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(results.length)}
            >
              Search all players
            </li>
          ) : null}
        </ul>
      ) : null}
    </span>
  );
}
