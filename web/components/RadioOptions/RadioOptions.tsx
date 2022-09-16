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
        <button
          key={op.value}
          className={classNames({
            [styles.checked]: option === op.value,
          })}
          onClick={() => onOptionChange(op.value)}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}

export default RadioOptions;
