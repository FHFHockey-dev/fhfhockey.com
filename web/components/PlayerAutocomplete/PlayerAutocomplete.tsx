import React, { useEffect, useState } from "react";
import { createFilterOptions, useAutocomplete } from "@mui/material";
import usePlayers, { Player } from "hooks/usePlayers";

import styles from "./PlayerAutocomplete.module.scss";
import classNames from "classnames";

type PlayerAutocompleteProps = {
  playerId: number | undefined;
  onPlayerIdChange: React.Dispatch<React.SetStateAction<number | undefined>>;
  inputClassName?: string;
  listClassName?: string;
};

function PlayerAutocomplete({
  playerId,
  onPlayerIdChange,
  inputClassName,
  listClassName,
}: PlayerAutocompleteProps) {
  const players = usePlayers();
  //   const [playerId, setPlayerId] = useState<number>();
  const [playerOption, setPlayerOption] = useState<Player["person"] | null>(
    null
  );

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
    getOptionLabel: (option) => `${option.fullName} (${option.primaryNumber})`,
    isOptionEqualToValue: (option, value) => option.id === value.id,
    value: playerOption,
    onChange: (e, newValue, reason) => {
      onPlayerIdChange(Number(newValue?.id));
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
      <div {...getRootProps()}>
        <label {...getInputLabelProps()} hidden>
          Player Name
        </label>
        <input
          {...getInputProps()}
          placeholder="Search Player..."
          className={classNames(inputClassName)}
        />
      </div>
      {groupedOptions.length > 0 ? (
        <ul {...getListboxProps()} className={listClassName}>
          {(groupedOptions as typeof players).map((option, index) => (
            <li {...getOptionProps({ option, index })} key={option.id}>
              {`${option.fullName} (${option.primaryNumber ?? "unknown"})`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PlayerAutocomplete;
