import React, { Dispatch, SetStateAction } from "react";
import CheckButton from "components/CheckButton";

import styles from "./Options.module.scss";

type OptionsProps<T> = {
  options: readonly { label: string; value: T }[];
  option: T;
  onOptionChange: Dispatch<SetStateAction<T>>;
};

function Options<T extends string>({
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={styles.options}>
      {options.map((op) => (
        <CheckButton
          key={op.value}
          checked={option === op.value}
          onClick={() => onOptionChange(op.value)}
        >
          {op.label}
        </CheckButton>
      ))}
    </div>
  );
}

export default Options;
