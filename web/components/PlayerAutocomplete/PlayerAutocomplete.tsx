import React, { useEffect, useState } from "react";
import Image from "next/legacy/image";
import { createFilterOptions, useAutocomplete } from "@mui/material";
import usePlayers from "hooks/usePlayers";

import styles from "./PlayerAutocomplete.module.scss";
import classNames from "classnames";
import type { Player } from "lib/NHL/types";

type PlayerAutocompleteProps = {
  playerId: number | undefined;
  onPlayerIdChange?: React.Dispatch<React.SetStateAction<number | undefined>>;
  onPlayerChange?: (player: Player | null) => void;
  inputClassName?: string;
  listClassName?: string;
  showButton?: boolean;
};

function PlayerAutocomplete({
  playerId,
  onPlayerIdChange = () => {},
  onPlayerChange = () => {},
  inputClassName,
  listClassName,
  showButton = true,
}: PlayerAutocompleteProps) {
  const players = usePlayers();
  //   const [playerId, setPlayerId] = useState<number>();
  const [playerOption, setPlayerOption] = useState<Player | null>(null);

  const {
    getRootProps,
    getInputLabelProps,
    getInputProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
  } = useAutocomplete({
    id: "use-autocomplete-players",
    options: players,
    getOptionLabel: (option) => `${option.fullName} (${option.sweaterNumber})`,
    isOptionEqualToValue: (option, value) => option.id === value.id,
    value: playerOption,
    onChange: (e, newValue, reason) => {
      onPlayerIdChange(Number(newValue?.id));
      onPlayerChange(newValue);
      setPlayerOption(newValue);

      // hide keyboard on mobile after a selection has been made
      if (reason === "selectOption") {
        // @ts-ignore
        getInputProps()?.ref.current?.blur();
      }
    },
    filterOptions: createFilterOptions({
      stringify(option) {
        // ignore periods
        // e.g. display T.J Oshine in option list while entering TJ
        return option.fullName.replaceAll(".", "");
      },
    }),
  });

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
          {...getInputProps()}
          placeholder="Search Player..."
          className={classNames(inputClassName)}
        />
        {showButton && (
          <button className={styles.button} type="submit">
            <Image
              src="/pictures/IconSearch.png"
              alt="search button"
              layout="fixed"
              width="32px"
              height="32px"
            />
          </button>
        )}
      </div>
      {groupedOptions.length > 0 ? (
        <ul {...getListboxProps()} className={listClassName}>
          {(groupedOptions as typeof players).map((option, index) => (
            <li
              {...getOptionProps({ option, index })}
              key={`${option.teamId}-${option.id}`}
            >
              {`${option.fullName} (${option.sweaterNumber ?? "unknown"})`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PlayerAutocomplete;
