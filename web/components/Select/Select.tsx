// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\Select\Select.tsx

import React from "react";
import classNames from "classnames";

import { OptionsProps } from "components/Options/Options";
import styles from "./Select.module.scss";

function Select<T extends string>({
  ariaLabel = "Select option",
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={classNames(styles.selectWrapper, className)}>
      <select
        aria-label={ariaLabel}
        className={styles.select}
        value={option}
        onChange={(event) => onOptionChange(event.target.value as T)}
      >
        {options.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default Select;
