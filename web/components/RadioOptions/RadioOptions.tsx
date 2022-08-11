import React from "react";
import classNames from "classnames";

import { OptionsProps } from "components/Options/Options";
import styles from "./RadioOptions.module.scss";

function RadioOptions<T extends string>({
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={classNames(styles.options, className)}>
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
