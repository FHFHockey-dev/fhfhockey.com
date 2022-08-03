import React from "react";

import { OptionsProps } from "components/Options/Options";
import styles from "./RadioOptions.module.scss";

function RadioOptions<T extends string>({
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={styles.options}>
      {options.map((op) => (
        <label key={op.value} className={styles.radioButton}>
          <input
            type="radio"
            checked={option === op.value}
            onChange={() => {}}
            onClick={() => onOptionChange(op.value)}
          />
          <span className={styles.label}>{op.label}</span>
        </label>
      ))}
    </div>
  );
}

export default RadioOptions;
