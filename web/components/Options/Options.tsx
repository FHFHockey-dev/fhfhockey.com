import React, { Dispatch, SetStateAction } from "react";
import classNames from "classnames";

import styles from "./Options.module.scss";

export type OptionsProps<T> = {
  className?: string;
  type?: "row" | "column";
  options: readonly { label: string; value: T }[];
  option: T;
  onOptionChange: Dispatch<SetStateAction<T>>;
};

function Options<T extends string>({
  className,
  options,
  option,
  onOptionChange,
}: OptionsProps<T>) {
  return (
    <div className={classNames(styles.options, className)}>
      {options.map((op) => (
        <div
          key={op.value}
          className={classNames(styles.button, {
            [styles.checked]: option === op.value,
          })}
          onClick={() => onOptionChange(op.value)}
        >
          {op.label}
        </div>
      ))}
    </div>
  );
}

export default Options;
