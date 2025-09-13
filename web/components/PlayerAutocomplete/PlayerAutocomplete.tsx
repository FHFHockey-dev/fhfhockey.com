import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/legacy/image";
import { createFilterOptions, useAutocomplete } from "@mui/material";
import usePlayers from "hooks/usePlayers";

import styles from "./PlayerAutocomplete.module.scss";
import classNames from "classnames";
import type { Player } from "lib/NHL/types";

type PlayerAutocompleteProps = {
  playerId: number | undefined;
  onPlayerIdChange?: React.Dispatch<React.SetStateAction<number | undefined>>;
  onPlayerChange?: (player: MinimalPlayer | null) => void;
  inputClassName?: string;
  listClassName?: string;
  showButton?: boolean;
  adpByPlayerId?: Map<number, number> | Record<number, number>;
  sortByAdp?: boolean;
  // Optional override to supply a custom player pool (e.g., processed projections)
  // Sweater numbers may be missing in projections, so allow them to be optional
  playersOverride?: Array<
    Pick<Player, "id" | "fullName"> &
      Partial<Pick<Player, "sweaterNumber" | "teamId">>
  >;
};

// Minimal shape we render/search on
type MinimalPlayer = {
  id: number;
  fullName: string;
  sweaterNumber?: number | null;
  teamId?: number | undefined;
};

function PlayerAutocomplete({
  playerId,
  onPlayerIdChange = () => {},
  onPlayerChange = () => {},
  inputClassName,
  listClassName,
  showButton = true,
  adpByPlayerId,
  sortByAdp = false,
  playersOverride
}: PlayerAutocompleteProps) {
  const defaultPlayers = usePlayers();
  const players: MinimalPlayer[] =
    playersOverride && playersOverride.length > 0
      ? playersOverride
      : (defaultPlayers as MinimalPlayer[]);
  const [playerOption, setPlayerOption] = useState<MinimalPlayer | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const optionsSorted = useMemo(() => {
    if (!sortByAdp || !adpByPlayerId) return players;

    const getAdp = (id: number): number => {
      if (adpByPlayerId instanceof Map) {
        return adpByPlayerId.get(id) ?? Number.POSITIVE_INFINITY;
      }
      return (
        (adpByPlayerId as Record<number, number>)[id] ??
        Number.POSITIVE_INFINITY
      );
    };

    return [...players].sort((a, b) => {
      const adpA = getAdp(a.id);
      const adpB = getAdp(b.id);
      if (adpA === adpB) return a.fullName.localeCompare(b.fullName);
      return adpA - adpB;
    });
  }, [players, adpByPlayerId, sortByAdp]);

  const {
    getRootProps,
    getInputLabelProps,
    getInputProps,
    getListboxProps,
    getOptionProps,
    groupedOptions
  } = useAutocomplete({
    id: "use-autocomplete-players",
    options: optionsSorted,
    // Always show names only for completeness and consistency with projections
    getOptionLabel: (option) => option.fullName,
    isOptionEqualToValue: (option, value) => option.id === value.id,
    value: playerOption,
    onChange: (_e, newValue, reason) => {
      if (reason === "selectOption") {
        const id = newValue ? newValue.id : undefined;
        onPlayerIdChange(id as any);
        onPlayerChange(newValue);
        setPlayerOption(newValue);
        inputRef.current?.blur();
      } else if (reason === "clear") {
        onPlayerIdChange(undefined as any);
        onPlayerChange(null);
        setPlayerOption(null);
      } else {
        // ignore blur and other reasons to avoid clearing selection unintentionally
      }
    },
    filterOptions: createFilterOptions({
      stringify(option) {
        return option.fullName.replaceAll(".", "");
      },
      // Ensure a complete list is available without truncation
      limit: 10000
    })
  });

  // Create input props once so we can merge refs
  const inputProps = useMemo(() => getInputProps(), [getInputProps]);

  // Merge our ref with MUI's ref (which can be a callback or RefObject)
  const mergedInputRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    const refFromMUI = (inputProps as any).ref;
    if (typeof refFromMUI === "function") {
      refFromMUI(el);
    } else if (refFromMUI && typeof refFromMUI === "object") {
      (refFromMUI as React.MutableRefObject<HTMLInputElement | null>).current =
        el;
    }
  };

  useEffect(() => {
    if (players.length) {
      setPlayerOption(players.find((p) => p.id === playerId) || null);
    }
  }, [playerId, players]);

  return (
    <div className={styles.autocomplete}>
      <div {...getRootProps()} className={styles.wrapper}>
        <label {...getInputLabelProps()} hidden>
          Player Name
        </label>
        <input
          {...inputProps}
          ref={mergedInputRef}
          placeholder="Search Player..."
          className={classNames(inputClassName)}
        />
        {showButton && (
          <button className={styles.button} type="submit">
            <Image
              src="/pictures/IconSearch.png"
              alt="search button"
              layout="fixed"
              width="32"
              height="32"
            />
          </button>
        )}
      </div>
      {groupedOptions.length > 0 ? (
        <ul {...getListboxProps()} className={listClassName}>
          {(groupedOptions as MinimalPlayer[]).map((option, index) => (
            <li {...getOptionProps({ option, index })} key={`${option.id}`}>
              {option.fullName}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PlayerAutocomplete;
